import * as THREE from 'three';
import type { Car } from '../Car';
import type { CarDef } from '../cars';
import type { Block, LevelDef, Pt, Ramp } from '../levels/types';
import { bounds, fitUniform, getModel } from './assets3d';
import { Car3D } from './Car3D';
import { Fx3D } from './Fx3D';
import { getRenderer, showRenderer, viewportAspect } from './renderer3d';
import * as T from './textures3d';

/** 1 Spiel-Pixel = 0.01 Welteinheiten */
export const S = 0.01;
const WALL_Z = -6.5;
const FOV = 40;
const BOOK_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#ff6b9d'];
const TOY_COLORS = ['#ff5a5f', '#3fa7ff', '#ffc928', '#4cd97b'];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

interface CoinState {
  x: number;
  y: number;
  takenAt: number;
}

/**
 * 2,5D-Darstellung des Rennens: Physik bleibt 2D (Matter.js in der Ebene z=0),
 * gerendert wird ein echter 3D-Raum mit Licht, Schatten und Perspektive.
 */
export class World3D {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 150);
  readonly fx: Fx3D;
  private readonly sun: THREE.DirectionalLight;
  private readonly car3d: Car3D;
  private readonly F: number;
  private readonly rand = rng(7);
  private readonly own: { dispose(): void }[] = [];
  private coins!: THREE.InstancedMesh;
  private coinState: CoinState[] = [];
  private rings: { mesh: THREE.Mesh; glow: THREE.Sprite; hitAt: number }[] = [];
  private boostMats: THREE.MeshStandardMaterial[] = [];
  private boostHitAt: number[] = [];
  private flag: THREE.Mesh | null = null;
  private time = 0;
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v3 = new THREE.Vector3();
  private readonly sc = new THREE.Vector3();
  private readonly yAxis = new THREE.Vector3(0, 1, 0);

  constructor(
    private L: LevelDef,
    carDef: CarDef,
  ) {
    this.F = L.floorY;
    this.scene.background = new THREE.Color(0xa9dcf5);
    this.buildLights();
    this.sun = this.scene.getObjectByName('sun') as THREE.DirectionalLight;
    this.buildRoom();
    this.buildHills();
    for (const r of L.rugs) this.buildRug(r.x1, r.x2, r.color);
    for (const b of L.blocks) this.buildBlock(b);
    for (const r of L.ramps) this.buildRamp(r);
    this.buildCoins();
    this.buildRings();
    this.buildStartFinish();
    this.buildDecor();
    this.car3d = new Car3D(this.scene, carDef, S, this.F);
    this.fx = new Fx3D(this.scene, S, this.F);
    getRenderer();
    showRenderer(true);
  }

  // ---------- Hilfen ----------

  private p(x: number, y: number): THREE.Vector3 {
    return new THREE.Vector3(x * S, (this.F - y) * S, 0);
  }

  private std(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial(params);
    this.own.push(m);
    return m;
  }

  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], shadow = true): THREE.Mesh {
    this.own.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow;
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  // ---------- Aufbau ----------

  private buildLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc9a27a, 1.5));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.3);
    sun.name = 'sun';
    sun.castShadow = true;
    const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    const c = sun.shadow.camera;
    c.left = -9;
    c.right = 9;
    c.top = 9;
    c.bottom = -9;
    c.near = 1;
    c.far = 45;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun, sun.target);
  }

  private buildRoom(): void {
    const x0 = -14;
    const x1 = this.L.endX * S + 16;
    const w = x1 - x0;
    const floorTex = T.woodFloor().clone();
    floorTex.needsUpdate = true;
    floorTex.repeat.set(w / 5, 34 / 5);
    this.own.push(floorTex);
    const floor = this.mesh(new THREE.PlaneGeometry(w, 34).rotateX(-Math.PI / 2), this.std({ map: floorTex, roughness: 0.62 }), false);
    floor.position.set(x0 + w / 2, 0, WALL_Z + 17);

    const wallTex = T.wallpaperKids().clone();
    wallTex.needsUpdate = true;
    wallTex.repeat.set(w / 5, 18 / 5);
    this.own.push(wallTex);
    const wall = this.mesh(new THREE.PlaneGeometry(w, 18), this.std({ map: wallTex, roughness: 0.9 }), false);
    wall.position.set(x0 + w / 2, 9, WALL_Z);

    const skirt = this.mesh(new THREE.BoxGeometry(w, 0.45, 0.14), this.std({ color: 0xffffff, roughness: 0.5 }), false);
    skirt.position.set(x0 + w / 2, 0.22, WALL_Z + 0.07);
  }

  /** Bodenpunkte über dem Fußboden (z. B. Bettdecken-Hügel) als extrudierte Decke */
  private buildHills(): void {
    const pts = this.L.ground;
    let run: Pt[] = [];
    const flush = () => {
      if (run.length < 2) return (run = []);
      const shape = new THREE.Shape();
      shape.moveTo(run[0][0] * S, 0);
      for (const [x, y] of run) shape.lineTo(x * S, (this.F - y) * S);
      shape.lineTo(run[run.length - 1][0] * S, 0);
      const depth = 3;
      const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.25, bevelSegments: 3, curveSegments: 4 });
      geo.translate(0, 0, -depth / 2);
      const tex = T.blanket().clone();
      tex.needsUpdate = true;
      tex.repeat.set(0.8, 0.8);
      this.own.push(tex);
      this.mesh(geo, this.std({ map: tex, roughness: 0.95 }));
      run = [];
    };
    for (let i = 0; i < pts.length; i++) {
      const [, y] = pts[i];
      if (y < this.F - 0.5) {
        if (!run.length && i > 0) run.push(pts[i - 1]);
        run.push(pts[i]);
      } else if (run.length) {
        run.push(pts[i]);
        flush();
      }
    }
    flush();
  }

  private buildRug(x1: number, x2: number, color: number): void {
    const m = this.mesh(new THREE.BoxGeometry((x2 - x1) * S, 0.03, 3.4), this.std({ color, roughness: 1 }), false);
    m.position.set(((x1 + x2) / 2) * S, 0.016, 0);
    const fringe = this.std({ color: 0xfff3d6, roughness: 1 });
    for (const x of [x1, x2]) {
      const f = this.mesh(new THREE.BoxGeometry(0.12, 0.02, 3.4), fringe, false);
      f.position.set(x * S + (x === x1 ? -0.06 : 0.06), 0.012, 0);
    }
  }

  private buildBlock(b: Block): void {
    const x = b.x * S;
    const top = (this.F - b.y) * S;
    const bottom = (this.F - b.y - b.h) * S;
    const w = b.w * S;
    const h = b.h * S;
    switch (b.kind) {
      case 'books': {
        const n = Math.max(1, Math.round(b.h / 30));
        const bh = h / n;
        const pageMat = this.std({ map: T.pages(), roughness: 0.9 });
        for (let i = 0; i < n; i++) {
          const last = i === n - 1;
          const col = BOOK_COLORS[Math.floor(this.rand() * BOOK_COLORS.length)];
          const cover = this.std({ color: col, roughness: 0.55 });
          const spine = this.std({ map: T.bookSpine(col, i + Math.floor(b.x)), roughness: 0.55 });
          const bw = w - (last ? 0 : this.rand() * 0.12);
          const depth = 1.9 + this.rand() * 0.5;
          const m = this.mesh(new THREE.BoxGeometry(bw, bh, depth), [pageMat, pageMat, cover, cover, spine, pageMat]);
          m.position.set(x + w / 2 + (last ? 0 : (this.rand() - 0.5) * 0.24), bottom + bh * (i + 0.5), (this.rand() - 0.5) * 0.2);
        }
        break;
      }
      case 'toy': {
        const size = Math.min(b.w, 70) * S;
        const cols = Math.max(1, Math.round(w / size));
        const rows = Math.max(1, Math.round(h / size));
        const sw = w / cols;
        const sh = h / rows;
        const label = b.label ?? 'ABC';
        let li = 0;
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++)
            for (const z of [-sw / 2, sw / 2]) {
              const col = TOY_COLORS[(r + c + (z > 0 ? 1 : 0)) % TOY_COLORS.length];
              const plain = this.std({ color: col, roughness: 0.5 });
              const face = this.std({ map: T.letterTile(label[li++ % label.length], col), roughness: 0.5 });
              const m = this.mesh(new THREE.BoxGeometry(sw * 0.98, sh * 0.98, sw * 0.98), [face, face, plain, plain, face, face]);
              m.position.set(x + sw * (c + 0.5), bottom + sh * (r + 0.5), z);
            }
        break;
      }
      case 'plank': {
        const wood = this.std({ color: 0xc28a52, roughness: 0.7 });
        const m = this.mesh(new THREE.BoxGeometry(w, h, 1.5), wood);
        m.position.set(x + w / 2, top - h / 2, -0.1);
        // Stützen aus Bauklötzen hinter der Fahrbahn
        const cube = 0.68;
        const n = Math.ceil((top - h) / cube);
        for (const px of [x + 0.4, x + w - 0.4]) {
          for (let i = 0; i < n; i++) {
            const col = TOY_COLORS[i % TOY_COLORS.length];
            const face = this.std({ map: T.letterTile('ABCDEFG'[i % 7], col), roughness: 0.5 });
            const c = this.mesh(new THREE.BoxGeometry(cube, Math.min(cube, top - h - i * cube) * 0.99, cube), face);
            c.position.set(px, i * cube + Math.min(cube, top - h - i * cube) / 2, -1.25);
          }
        }
        break;
      }
      case 'box': {
        const chest = getModel('chest');
        if (chest) {
          chest.scale.setScalar(1);
          const sz = bounds(chest).getSize(new THREE.Vector3());
          chest.scale.set(w / sz.x, h / sz.y, Math.min(4, (w / sz.x) * 1.2));
          chest.position.set(x + w / 2, bottom, 0);
          this.scene.add(chest);
        } else {
          const m = this.mesh(new THREE.BoxGeometry(w, h, 3), this.std({ color: 0x8e4fd0, roughness: 0.6 }));
          m.position.set(x + w / 2, bottom + h / 2, 0);
          const lid = this.mesh(new THREE.BoxGeometry(w + 0.2, 0.35, 3.2), this.std({ color: 0xffc928, roughness: 0.5 }));
          lid.position.set(x + w / 2, top + 0.1, 0);
        }
        break;
      }
      case 'pillow': {
        const m = this.mesh(new THREE.BoxGeometry(w, h, 2), this.std({ color: 0xf8c6d8, roughness: 1 }));
        m.position.set(x + w / 2, bottom + h / 2, 0);
        break;
      }
    }
  }

  private rampShape(r: Ramp): THREE.Shape {
    const pts: Pt[] =
      r.dir === 1
        ? [
            [r.x, r.base],
            [r.x + r.w, r.base],
            [r.x + r.w, r.base - r.h],
          ]
        : [
            [r.x, r.base - r.h],
            [r.x + r.w, r.base],
            [r.x, r.base],
          ];
    const s = new THREE.Shape();
    pts.forEach(([x, y], i) => (i ? s.lineTo(x * S, (this.F - y) * S) : s.moveTo(x * S, (this.F - y) * S)));
    s.closePath();
    return s;
  }

  private buildRamp(r: Ramp): void {
    const depth = r.boost ? 1.7 : 1.5;
    const geo = new THREE.ExtrudeGeometry(this.rampShape(r), { depth, bevelEnabled: false });
    geo.translate(0, 0, -depth / 2);
    this.mesh(geo, this.std(r.boost ? { color: 0xe8670c, roughness: 0.38 } : { color: 0xb5793f, roughness: 0.75 }));
    // Fahrbahn-Belag (Pfeile bzw. Lineal)
    const A = r.dir === 1 ? this.p(r.x, r.base) : this.p(r.x, r.base - r.h);
    const B = r.dir === 1 ? this.p(r.x + r.w, r.base - r.h) : this.p(r.x + r.w, r.base);
    const len = A.distanceTo(B);
    const ang = Math.atan2(B.y - A.y, B.x - A.x);
    const tex = (r.boost ? T.boostArrows() : T.rulerTex()).clone();
    tex.needsUpdate = true;
    tex.repeat.set(r.boost ? len / 0.9 : len / 2.5, 1);
    this.own.push(tex);
    const mat = this.std(r.boost ? { map: tex, emissive: 0xffe066, emissiveMap: tex, emissiveIntensity: 0.4, roughness: 0.4 } : { map: tex, roughness: 0.6 });
    const strip = this.mesh(new THREE.PlaneGeometry(len, depth * 0.86).rotateX(-Math.PI / 2), mat, false);
    strip.rotation.z = ang;
    strip.position.set((A.x + B.x) / 2 - Math.sin(ang) * 0.006, (A.y + B.y) / 2 + Math.cos(ang) * 0.006, 0);
    if (r.boost) {
      this.boostMats.push(mat);
      this.boostHitAt.push(-10);
    }
  }

  private buildCoins(): void {
    const geo = new THREE.CylinderGeometry(0.17, 0.17, 0.05, 28).rotateX(Math.PI / 2);
    const edge = this.std({ color: 0xf2b300, metalness: 0.55, roughness: 0.3 });
    const face = this.std({ map: T.coinFace(), metalness: 0.45, roughness: 0.3, emissive: 0x553300, emissiveIntensity: 0.25 });
    this.own.push(geo);
    this.coins = new THREE.InstancedMesh(geo, [edge, face, face], this.L.coins.length);
    this.coins.castShadow = true;
    this.coins.frustumCulled = false;
    this.scene.add(this.coins);
    this.coinState = this.L.coins.map(([x, y]) => ({ x: x * S, y: (this.F - y) * S, takenAt: -1 }));
  }

  private buildRings(): void {
    const geo = new THREE.TorusGeometry(0.6, 0.08, 14, 48);
    const mat = this.std({ color: 0x38b6ff, emissive: 0x38b6ff, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.2 });
    this.own.push(geo);
    for (const r of this.L.rings) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(this.p(r.x, r.y));
      m.rotation.y = 1.05;
      m.castShadow = true;
      this.scene.add(m);
      const gm = new THREE.SpriteMaterial({ map: T.softDot(), color: 0x38b6ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5 });
      this.own.push(gm);
      const glow = new THREE.Sprite(gm);
      glow.scale.set(2.4, 2.4, 1);
      glow.position.copy(m.position);
      this.scene.add(glow);
      this.rings.push({ mesh: m, glow, hitAt: -10 });
    }
  }

  private sign(text: string, x: number, y: number, w: number, color = '#ffffff'): void {
    const mat = new THREE.SpriteMaterial({ map: T.label(text, color), transparent: true, depthWrite: false });
    this.own.push(mat);
    const s = new THREE.Sprite(mat);
    s.scale.set(w, w * (160 / 512), 1);
    s.position.set(x, y, 0.3);
    this.scene.add(s);
  }

  private buildStartFinish(): void {
    const L = this.L;
    // Startlinie
    const sx = (L.startX - 90) * S;
    const start = this.mesh(new THREE.PlaneGeometry(0.14, 2.6).rotateX(-Math.PI / 2), this.std({ color: 0xffffff, roughness: 0.6 }), false);
    start.position.set(sx, 0.035, 0);
    this.sign('START', sx, 1.5, 2.2);

    // Ziel: Bleistift-Masten, Querbalken, Fahne
    const fx = L.finishX * S;
    const tex = T.checker().clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, 6);
    this.own.push(tex);
    const line = this.mesh(new THREE.PlaneGeometry(0.34, 3).rotateX(-Math.PI / 2), this.std({ map: tex, roughness: 0.6 }), false);
    line.position.set(fx, 0.035, 0);
    const H = 3.6;
    const yellow = this.std({ color: 0xffc928, roughness: 0.5 });
    const pink = this.std({ color: 0xff7aa2, roughness: 0.6 });
    for (const z of [-1.5, 1.5]) {
      const p = this.mesh(new THREE.CylinderGeometry(0.1, 0.1, H, 6), yellow);
      p.position.set(fx, H / 2, z);
      const e = this.mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.25, 12), pink);
      e.position.set(fx, H + 0.12, z);
    }
    const barTex = T.checker().clone();
    barTex.needsUpdate = true;
    barTex.repeat.set(6, 1);
    this.own.push(barTex);
    const bar = this.mesh(new THREE.BoxGeometry(0.1, 0.45, 3), this.std({ map: barTex, roughness: 0.6 }));
    bar.position.set(fx, H - 0.25, 0);
    const flagTex = T.checker().clone();
    flagTex.needsUpdate = true;
    flagTex.repeat.set(1.5, 1);
    this.own.push(flagTex);
    this.flag = this.mesh(new THREE.PlaneGeometry(1.3, 0.85, 8, 1), this.std({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 }));
    this.flag.position.set(fx + 0.7, H - 0.1, -1.5);
    this.sign('ZIEL', fx, H + 0.9, 2.4, '#ffc928');
  }

  /** Möbel an der Wand. Die x-Positionen der Leveldaten werden über die Levellänge verteilt. */
  private buildDecor(): void {
    const L = this.L;
    const maxX = Math.max(...L.decor.map((d) => d.x), 1);
    const k = (L.endX + 400) / (maxX + 400);
    for (const d of L.decor) {
      const x = d.x * k * S;
      switch (d.kind) {
        case 'window':
          this.window(x);
          break;
        case 'poster':
          this.poster(x);
          break;
        case 'clock':
          this.clock(x);
          break;
        case 'door':
          this.door(x);
          break;
        default:
          this.furniture(d.kind, x);
      }
    }
  }

  private furniture(kind: string, x: number): void {
    const SIZE: Record<string, ['x' | 'y', number]> = {
      bed: ['x', 8.5],
      shelf: ['y', 7],
      lamp: ['y', 8.5],
      chest: ['x', 3.4],
      dino: ['y', 3.8],
      teddy: ['y', 3.2],
      desk: ['y', 4.4],
    };
    const [axis, size] = SIZE[kind] ?? ['y', 3];
    const m = getModel(kind);
    if (!m) {
      const box = this.mesh(new THREE.BoxGeometry(axis === 'x' ? size : size * 0.6, axis === 'y' ? size : size * 0.4, 1.5), this.std({ color: 0xd9a066, roughness: 0.8 }));
      box.position.set(x, (axis === 'y' ? size : size * 0.4) / 2, WALL_Z + 1);
      return;
    }
    fitUniform(m, axis, size);
    const b = bounds(m);
    const depth = b.max.z - b.min.z;
    m.position.set(x, 0, WALL_Z + depth / 2 + 0.1);
    this.scene.add(m);
  }

  private window(x: number): void {
    const white = this.std({ color: 0xffffff, roughness: 0.4 });
    const skyMat = this.std({ map: T.sky(), emissive: 0xffffff, emissiveMap: T.sky(), emissiveIntensity: 0.75, roughness: 1 });
    const glass = this.mesh(new THREE.PlaneGeometry(3.4, 3.8), skyMat, false);
    glass.position.set(x, 7.6, WALL_Z + 0.02);
    for (const [w, h, px, py] of [
      [3.8, 0.2, 0, 1.95],
      [3.8, 0.2, 0, -1.95],
      [0.2, 4.1, 1.8, 0],
      [0.2, 4.1, -1.8, 0],
      [0.12, 3.8, 0, 0],
      [3.4, 0.12, 0, 0.2],
    ])
      this.mesh(new THREE.BoxGeometry(w, h, 0.16), white).position.set(x + px, 7.6 + py, WALL_Z + 0.08);
    const sill = this.mesh(new THREE.BoxGeometry(4.2, 0.16, 0.6), white);
    sill.position.set(x, 5.55, WALL_Z + 0.3);
    const curtain = this.std({ color: 0xff8fb1, roughness: 1 });
    for (const s of [-1, 1]) {
      const c = this.mesh(new THREE.BoxGeometry(0.8, 4.8, 0.18), curtain);
      c.position.set(x + s * 2.3, 7.4, WALL_Z + 0.25);
    }
    const rod = this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 5.6, 8).rotateZ(Math.PI / 2), this.std({ color: 0x8d6e63 }));
    rod.position.set(x, 9.9, WALL_Z + 0.3);
  }

  private poster(x: number): void {
    const m = this.mesh(new THREE.PlaneGeometry(2.3, 3.2), this.std({ map: T.posterRocket(), roughness: 0.8 }), false);
    m.position.set(x, 7, WALL_Z + 0.03);
  }

  private clock(x: number): void {
    const rim = this.mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.15, 32).rotateX(Math.PI / 2), this.std({ color: 0xff8a1f, roughness: 0.4 }));
    rim.position.set(x, 8.6, WALL_Z + 0.08);
    const face = this.mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.16, 32).rotateX(Math.PI / 2), this.std({ color: 0xffffff, roughness: 0.6 }));
    face.position.set(x, 8.6, WALL_Z + 0.1);
    const ink = this.std({ color: 0x24123f });
    const h1 = this.mesh(new THREE.BoxGeometry(0.08, 0.55, 0.04), ink);
    h1.position.set(x, 8.85, WALL_Z + 0.2);
    const h2 = this.mesh(new THREE.BoxGeometry(0.4, 0.08, 0.04), ink);
    h2.position.set(x + 0.2, 8.6, WALL_Z + 0.2);
  }

  private door(x: number): void {
    const frame = this.mesh(new THREE.BoxGeometry(4.6, 9.2, 0.14), this.std({ color: 0xffffff, roughness: 0.5 }), false);
    frame.position.set(x, 4.6, WALL_Z + 0.05);
    const leaf = this.mesh(new THREE.BoxGeometry(4.0, 8.9, 0.2), this.std({ color: 0xf2c48d, roughness: 0.6 }));
    leaf.position.set(x, 4.45, WALL_Z + 0.1);
    const panel = this.std({ color: 0xe0ad73, roughness: 0.6 });
    for (const [py, ph] of [
      [6.6, 3],
      [2.6, 3.6],
    ]) {
      const p = this.mesh(new THREE.BoxGeometry(3, ph, 0.06), panel);
      p.position.set(x, py, WALL_Z + 0.22);
    }
    const knob = this.mesh(new THREE.SphereGeometry(0.18, 12, 8), this.std({ color: 0xcfcfcf, metalness: 0.8, roughness: 0.25 }));
    knob.position.set(x + 1.5, 4.4, WALL_Z + 0.3);
  }

  // ---------- Laufzeit ----------

  coinTaken(i: number): void {
    if (this.coinState[i]) this.coinState[i].takenAt = this.time;
  }

  ringHit(i: number): void {
    if (this.rings[i]) this.rings[i].hitAt = this.time;
  }

  boostHit(i: number): void {
    if (i < this.boostHitAt.length) this.boostHitAt[i] = this.time;
  }

  rocketNozzle(): { x: number; y: number } {
    return this.car3d.nozzle();
  }

  /**
   * @param camX/camY Kameramitte in Spielkoordinaten
   * @param viewH sichtbare Höhe (Spiel-px) auf der Fahrbahnebene
   */
  render(dt: number, car: Car, camX: number, camY: number, viewH: number): void {
    this.time += dt / 60;
    const t = this.time;
    this.car3d.update(car);
    this.fx.update(dt);

    // Münzen drehen / einsammeln
    this.coinState.forEach((c, i) => {
      let s = 1;
      let y = c.y;
      if (c.takenAt >= 0) {
        const k = (t - c.takenAt) / 0.3;
        s = k >= 1 ? 0 : 1 + k * 0.6;
        y += k * 0.5;
        if (k >= 1) s = 0;
      }
      this.q.setFromAxisAngle(this.yAxis, t * 3 + i * 0.5);
      this.v3.set(c.x, y, 0);
      this.sc.setScalar(s);
      this.m4.compose(this.v3, this.q, this.sc);
      this.coins.setMatrixAt(i, this.m4);
    });
    this.coins.instanceMatrix.needsUpdate = true;

    for (const r of this.rings) {
      const k = Math.max(0, 1 - (t - r.hitAt) / 0.35);
      r.mesh.scale.setScalar(1 + k * 0.35);
      r.mesh.rotation.x = Math.sin(t * 2) * 0.08;
      (r.glow.material as THREE.SpriteMaterial).opacity = 0.35 + 0.15 * Math.sin(t * 5) + k * 0.5;
    }
    this.boostMats.forEach((m, i) => {
      const k = Math.max(0, 1 - (t - this.boostHitAt[i]) / 0.5);
      m.emissiveIntensity = 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(t * 7)) + k * 1.5;
    });
    if (this.flag) {
      const pos = this.flag.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setZ(i, Math.sin(t * 6 + x * 4) * 0.08 * (x + 0.65));
      }
      pos.needsUpdate = true;
    }

    // Kamera: leicht von oben, Abstand so, dass viewH auf der Fahrbahn sichtbar ist
    const tx = camX * S;
    const ty = (this.F - camY) * S;
    const d = (viewH * S) / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const cam = this.camera;
    cam.aspect = viewportAspect();
    // etwas erhöht und nach unten geneigt: mehr Fußboden, Auto weiter oben im Bild (unten liegt das HUD)
    cam.position.set(tx, ty + 1.6, d);
    cam.lookAt(tx, ty - 0.75, 0);
    cam.updateProjectionMatrix();
    this.sun.position.set(tx - 5, ty + 13, 10);
    this.sun.target.position.set(tx, ty - 2, 0);

    getRenderer().render(this.scene, cam);
  }

  dispose(): void {
    showRenderer(false);
    this.car3d.dispose();
    this.fx.dispose();
    this.own.forEach((d) => d.dispose());
    this.coins.dispose();
    this.scene.clear();
  }
}
