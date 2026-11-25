import * as THREE from 'three';
import { softDot, starTex } from './textures3d';

export interface SpawnOpts {
  tex?: string;
  vx?: number;
  vy?: number;
  life?: number;
  s0?: number;
  s1?: number;
  alpha?: number;
  tint?: number;
  add?: boolean;
  gravity?: number;
  spin?: number;
  drag?: number;
  rotation?: number;
}

interface P {
  sp: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  s0: number;
  s1: number;
  a0: number;
  g: number;
  drag: number;
  alive: boolean;
}

const BASE: Record<string, number> = { soft: 32, star: 24, confetti: 10 };

/**
 * 3D-Gegenstück zu Fx: gleiche API in Spiel-Koordinaten (px, y nach unten),
 * rendert aber Sprites in der Three.js-Szene.
 */
export class Fx3D {
  private pool: P[] = [];
  private confettiTex: THREE.Texture;

  constructor(
    private root: THREE.Object3D,
    private S: number,
    private floorY: number,
  ) {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 10;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 16, 10);
    this.confettiTex = new THREE.CanvasTexture(c);
  }

  private tex(key: string): THREE.Texture {
    if (key === 'star') return starTex();
    if (key === 'confetti') return this.confettiTex;
    return softDot();
  }

  spawn(x: number, y: number, o: SpawnOpts & { z?: number; vz?: number } = {}): void {
    let p = this.pool.find((q) => !q.alive);
    if (!p) {
      if (this.pool.length > 500) return;
      const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      sp.renderOrder = 10;
      this.root.add(sp);
      p = { sp, mat, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, s0: 1, s1: 1, a0: 1, g: 0, drag: 1, alive: false };
      this.pool.push(p);
    }
    const key = o.tex ?? 'soft';
    const base = BASE[key] ?? 32;
    p.mat.map = this.tex(key);
    p.mat.color.setHex(o.tint ?? 0xffffff);
    p.mat.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending;
    p.mat.rotation = o.rotation ?? Math.random() * Math.PI;
    p.mat.needsUpdate = true;
    p.alive = true;
    p.x = x;
    p.y = y;
    p.z = o.z ?? 0;
    p.vx = o.vx ?? 0;
    p.vy = o.vy ?? 0;
    p.vz = o.vz ?? 0;
    p.life = 0;
    p.max = o.life ?? 30;
    p.s0 = (o.s0 ?? 1) * base * this.S;
    p.s1 = (o.s1 ?? 0) * base * this.S;
    p.a0 = o.alpha ?? 1;
    p.g = o.gravity ?? 0;
    p.drag = o.drag ?? 0.97;
    p.sp.visible = true;
    this.place(p, 0);
  }

  burst(x: number, y: number, n: number, o: SpawnOpts & { speed?: number } = {}): void {
    const sp = o.speed ?? 4;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = sp * (0.4 + Math.random() * 0.6);
      this.spawn(x, y, { ...o, vx: Math.cos(a) * v + (o.vx ?? 0), vy: Math.sin(a) * v + (o.vy ?? 0), vz: (Math.random() - 0.5) * v });
    }
  }

  private place(p: P, t: number): void {
    p.sp.position.set(p.x * this.S, (this.floorY - p.y) * this.S, p.z);
    const s = p.s0 + (p.s1 - p.s0) * t;
    p.sp.scale.set(s, s, 1);
    p.mat.opacity = p.a0 * (1 - t * t);
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.max) {
        p.alive = false;
        p.sp.visible = false;
        continue;
      }
      p.vy += p.g * dt;
      const d = Math.pow(p.drag, dt);
      p.vx *= d;
      p.vy *= d;
      p.vz *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt * this.S;
      this.place(p, p.life / p.max);
    }
  }

  dispose(): void {
    for (const p of this.pool) p.mat.dispose();
    this.confettiTex.dispose();
  }
}
