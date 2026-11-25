import Phaser from 'phaser';
import type { Block, Decor, LevelDef, Pt, Ramp } from './levels/types';
import { TEX_K } from './textures';

const CHUNK = 1200;
const FLOOR_DEPTH = 500;

export interface CoinObj {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  taken: boolean;
}
export interface RingObj {
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  cd: number;
}
export interface BoostObj {
  ramp: Ramp;
  lipX: number;
  lipY: number;
  cd: number;
  arrows: Phaser.GameObjects.Graphics;
}

export interface BuiltLevel {
  chunks: { g: Phaser.GameObjects.Graphics; x0: number; x1: number }[];
  wall: Phaser.GameObjects.TileSprite;
  skirting: Phaser.GameObjects.TileSprite;
  decor: Phaser.GameObjects.Container;
  coins: CoinObj[];
  rings: RingObj[];
  boosts: BoostObj[];
  flag: Phaser.GameObjects.Graphics;
}

/** Deterministischer Zufall, damit das Level immer gleich aussieht */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const BOOK_COLORS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xff6b9d];
const TOY_COLORS = [0xff5a5f, 0x3fa7ff, 0xffd23f, 0x4cd97b];

export class LevelBuilder {
  private chunks = new Map<number, Phaser.GameObjects.Graphics>();
  private rand = rng(7);

  constructor(private scene: Phaser.Scene, private L: LevelDef) {}

  private chunk(x: number): Phaser.GameObjects.Graphics {
    const i = Math.floor(x / CHUNK);
    let g = this.chunks.get(i);
    if (!g) {
      g = this.scene.add.graphics().setDepth(10);
      this.chunks.set(i, g);
    }
    return g;
  }

  build(): BuiltLevel {
    const { scene, L } = this;
    const wall = scene.add.tileSprite(0, 0, 2600, 1400, L.wallTexture).setOrigin(0, 0).setDepth(0);
    if (L.wallTint) wall.setTint(L.wallTint);
    const decor = scene.add.container(0, 0).setDepth(2);
    for (const d of L.decor) this.drawDecor(decor, d);
    const skirting = scene.add.tileSprite(0, L.floorY - 44, 2600, 48, 'skirting').setOrigin(0, 0).setDepth(3);

    this.buildGround();
    for (const r of L.rugs) this.drawRug(r.x1, r.x2, r.color);
    for (const b of L.blocks) this.buildBlock(b);
    const boosts: BoostObj[] = [];
    for (const r of L.ramps) {
      const bo = this.buildRamp(r);
      if (bo) boosts.push(bo);
    }
    this.buildWalls();
    this.drawStart();
    const flag = this.drawFinish();

    const k = 1 / TEX_K;
    const coins: CoinObj[] = L.coins.map(([x, y]) => ({
      img: scene.add.image(x, y, 'coin').setScale(k).setDepth(20),
      x,
      y,
      taken: false,
    }));
    const rings: RingObj[] = L.rings.map(({ x, y }) => ({
      glow: scene.add.image(x, y, 'soft').setScale(9 * k * 3).setAlpha(0.35).setTint(0x38b6ff).setDepth(19).setBlendMode(Phaser.BlendModes.ADD),
      img: scene.add.image(x, y, 'ring').setScale(k * 1.2).setDepth(32),
      x,
      y,
      cd: 0,
    }));

    const chunks = [...this.chunks.entries()].map(([i, g]) => ({ g, x0: i * CHUNK, x1: (i + 1) * CHUNK }));
    return { chunks, wall, skirting, decor, coins, rings, boosts, flag };
  }

  // ---------- Physik ----------

  private staticPoly(pts: Pt[], label: string, friction = 1): void {
    const M = this.scene.matter;
    const verts = pts.map(([x, y]) => ({ x, y }));
    const c = M.vertices.centre(verts as unknown as MatterJS.Vector[]) as { x: number; y: number };
    M.add.fromVertices(c.x, c.y, verts as unknown as object[], { isStatic: true, label, friction, frictionStatic: 1, restitution: 0 });
  }

  private buildGround(): void {
    const { L } = this;
    const pts = L.ground;
    const bottom = L.floorY + FLOOR_DEPTH;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      if (x2 - x1 < 1) continue; // doppelte Punkte ignorieren
      // lange Segmente zerteilen (Culling + Physik-Stabilität)
      const n = Math.max(1, Math.ceil((x2 - x1) / 400));
      for (let j = 0; j < n; j++) {
        const ax = x1 + ((x2 - x1) * j) / n;
        const bx = x1 + ((x2 - x1) * (j + 1)) / n;
        const ay = y1 + ((y2 - y1) * j) / n;
        const by = y1 + ((y2 - y1) * (j + 1)) / n;
        this.staticPoly(
          [
            [ax, ay],
            [bx, by],
            [bx, bottom],
            [ax, bottom],
          ],
          'ground',
        );
        this.drawFloorSeg(ax, ay, bx, by, bottom);
      }
    }
  }

  private buildBlock(b: Block): void {
    const M = this.scene.matter;
    M.add.rectangle(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, { isStatic: true, label: 'block', friction: 1, frictionStatic: 1 });
    switch (b.kind) {
      case 'books':
        this.drawBooks(b);
        break;
      case 'toy':
        this.drawToyBlocks(b);
        break;
      case 'plank':
        this.drawPlank(b);
        break;
      case 'box':
        this.drawToyBox(b);
        break;
      case 'pillow':
        this.drawPillow(b);
        break;
    }
  }

  private rampPts(r: Ramp): Pt[] {
    return r.dir === 1
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
  }

  private buildRamp(r: Ramp): BoostObj | null {
    const pts = this.rampPts(r);
    this.staticPoly(pts, r.boost ? 'boostRamp' : 'ramp');
    if (r.boost) return this.drawBoostRamp(r, pts);
    this.drawWoodRamp(r, pts);
    return null;
  }

  private buildWalls(): void {
    const M = this.scene.matter;
    const { L } = this;
    M.add.rectangle(-150, L.floorY - 1000, 100, 3000, { isStatic: true, label: 'wall' });
    M.add.rectangle(L.endX + 450, L.floorY - 1000, 100, 3000, { isStatic: true, label: 'wall' });
    M.add.rectangle(L.endX / 2, -1500, L.endX + 1000, 100, { isStatic: true, label: 'ceiling' });
  }

  // ---------- Zeichnen ----------

  private drawFloorSeg(ax: number, ay: number, bx: number, by: number, bottom: number): void {
    const g = this.chunk(ax);
    const col = this.L.floorColor;
    const dark = Phaser.Display.Color.IntegerToColor(col).darken(12).color;
    const light = Phaser.Display.Color.IntegerToColor(col).lighten(14).color;
    g.fillStyle(col, 1);
    g.fillPoints([new Phaser.Math.Vector2(ax, ay), new Phaser.Math.Vector2(bx, by), new Phaser.Math.Vector2(bx, bottom), new Phaser.Math.Vector2(ax, bottom)], true);
    // Dielen
    g.lineStyle(3, dark, 0.6);
    for (let d = 34; d < 300; d += 34) {
      g.lineBetween(ax, ay + d, bx, by + d);
    }
    // Dielen-Fugen (versetzt)
    g.lineStyle(2, dark, 0.45);
    for (let row = 0; row < 8; row++) {
      const off = (row % 2) * 110;
      for (let x = Math.ceil((ax - off) / 220) * 220 + off; x < bx; x += 220) {
        const t = (x - ax) / (bx - ax);
        const y = ay + (by - ay) * t + row * 34;
        g.lineBetween(x, y + 4, x, y + 32);
      }
    }
    // Kante oben
    g.fillStyle(light, 1);
    g.fillPoints([new Phaser.Math.Vector2(ax, ay), new Phaser.Math.Vector2(bx, by), new Phaser.Math.Vector2(bx, by + 7), new Phaser.Math.Vector2(ax, ay + 7)], true);
  }

  private groundY(x: number): number {
    const p = this.L.ground;
    for (let i = 0; i < p.length - 1; i++) {
      if (x >= p[i][0] && x <= p[i + 1][0]) {
        const t = (x - p[i][0]) / (p[i + 1][0] - p[i][0] || 1);
        return p[i][1] + (p[i + 1][1] - p[i][1]) * t;
      }
    }
    return this.L.floorY;
  }

  private drawRug(x1: number, x2: number, color: number): void {
    const dark = Phaser.Display.Color.IntegerToColor(color).darken(20).color;
    for (let x = x1; x < x2; x += 100) {
      const xe = Math.min(x2, x + 100);
      const g = this.chunk(x);
      const ya = this.groundY(x);
      const yb = this.groundY(xe);
      g.fillStyle(color, 1);
      g.fillPoints([new Phaser.Math.Vector2(x, ya - 6), new Phaser.Math.Vector2(xe, yb - 6), new Phaser.Math.Vector2(xe, yb + 8), new Phaser.Math.Vector2(x, ya + 8)], true);
      g.fillStyle(dark, 1);
      for (let s = x + 10; s < xe; s += 24) g.fillRect(s, this.groundY(s) - 2, 10, 4);
    }
    // Fransen
    const g1 = this.chunk(x1);
    g1.fillStyle(0xfff3d6, 1);
    for (let i = 0; i < 4; i++) g1.fillRect(x1 - 10, this.groundY(x1) - 5 + i * 3.5, 10, 2);
    const g2 = this.chunk(x2);
    for (let i = 0; i < 4; i++) g2.fillRect(x2, this.groundY(x2) - 5 + i * 3.5, 10, 2);
  }

  private drawBooks(b: Block): void {
    const g = this.chunk(b.x);
    const n = Math.max(1, Math.round(b.h / 30));
    const bh = b.h / n;
    // Bücher von unten nach oben; oberstes exakt bündig
    for (let i = 0; i < n; i++) {
      const y = b.y + b.h - (i + 1) * bh;
      const jitter = i === n - 1 ? 0 : (this.rand() - 0.5) * 24;
      const x = b.x + jitter;
      const w = b.w - (i === n - 1 ? 0 : this.rand() * 10);
      const col = BOOK_COLORS[Math.floor(this.rand() * BOOK_COLORS.length)];
      const dark = Phaser.Display.Color.IntegerToColor(col).darken(25).color;
      g.fillStyle(dark, 1);
      g.fillRoundedRect(x, y, w, bh, 5);
      g.fillStyle(col, 1);
      g.fillRoundedRect(x, y + 1, w, bh - 4, 5);
      // Seiten (cremefarben) an der Vorderkante
      g.fillStyle(0xfff6e0, 1);
      g.fillRect(x + 8, y + 5, w - 16, 4);
      g.fillRect(x + 8, y + bh - 12, w - 16, 3);
      // Rücken-Deko
      g.fillStyle(0xffe08a, 0.9);
      for (let s = x + 40; s < x + w - 40; s += 180) g.fillRect(s, y + 11, 50, bh - 26 > 2 ? bh - 26 : 2);
    }
  }

  private drawToyBlocks(b: Block): void {
    const g = this.chunk(b.x);
    const size = Math.min(b.w, 70);
    const cols = Math.round(b.w / size);
    const rows = Math.round(b.h / size) || 1;
    const sw = b.w / cols;
    const sh = b.h / rows;
    const label = b.label ?? 'ABC';
    let li = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = b.x + c * sw;
        const y = b.y + r * sh;
        const col = TOY_COLORS[(r + c) % TOY_COLORS.length];
        const dark = Phaser.Display.Color.IntegerToColor(col).darken(25).color;
        g.fillStyle(dark, 1);
        g.fillRoundedRect(x + 1, y + 1, sw - 2, sh - 2, 8);
        g.fillStyle(col, 1);
        g.fillRoundedRect(x + 5, y + 5, sw - 10, sh - 12, 6);
        const t = this.scene.add
          .text(x + sw / 2, y + sh / 2 - 3, label[li++ % label.length], {
            fontFamily: 'Fredoka, sans-serif',
            fontSize: `${Math.round(sh * 0.55)}px`,
            fontStyle: '700',
            color: '#ffffff',
          })
          .setOrigin(0.5)
          .setDepth(11)
          .setResolution(2);
        t.setStroke(Phaser.Display.Color.IntegerToColor(dark).rgba, 4);
      }
    }
  }

  private drawPlank(b: Block): void {
    const g = this.chunk(b.x);
    // Halterungen
    g.fillStyle(0x8d99a6, 1);
    for (const x of [b.x + 40, b.x + b.w - 60]) {
      g.fillRect(x, b.y + b.h, 14, 40);
      g.fillTriangle(x, b.y + b.h, x + 14, b.y + b.h, x, b.y + b.h + 40);
    }
    g.fillStyle(0x9c6a3a, 1);
    g.fillRoundedRect(b.x, b.y, b.w, b.h, 4);
    g.fillStyle(0xc28a52, 1);
    g.fillRoundedRect(b.x, b.y, b.w, b.h - 5, 4);
    g.lineStyle(2, 0x9c6a3a, 0.6);
    g.lineBetween(b.x + 20, b.y + 6, b.x + b.w - 30, b.y + 6);
  }

  private drawToyBox(b: Block): void {
    const g = this.chunk(b.x);
    g.fillStyle(0x7a3fb0, 1);
    g.fillRoundedRect(b.x, b.y, b.w, b.h + 20, 14);
    g.fillStyle(0x9b59d6, 1);
    g.fillRoundedRect(b.x + 8, b.y + 26, b.w - 16, b.h - 20, 10);
    g.fillStyle(0xffc928, 1);
    g.fillRoundedRect(b.x - 10, b.y - 10, b.w + 20, 34, 12);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(TOY_COLORS[i], 1);
      g.fillCircle(b.x + 60 + i * 90, b.y + 120, 26);
    }
    this.scene.add
      .text(b.x + b.w / 2, b.y + 200, 'SPIELZEUG', { fontFamily: 'Fredoka, sans-serif', fontSize: '40px', fontStyle: '700', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(11)
      .setResolution(2);
  }

  private drawPillow(b: Block): void {
    const g = this.chunk(b.x);
    g.fillStyle(0xf8c6d8, 1);
    g.fillRoundedRect(b.x, b.y, b.w, b.h, 30);
  }

  /** Schräge Oberkante einer Rampe (von unten nach oben bzw. oben nach unten, immer links→rechts) */
  private rampSlope(r: Ramp, pts: Pt[]): { A: Phaser.Math.Vector2; B: Phaser.Math.Vector2 } {
    const A = new Phaser.Math.Vector2(pts[0][0], pts[0][1]);
    const B = r.dir === 1 ? new Phaser.Math.Vector2(pts[2][0], pts[2][1]) : new Phaser.Math.Vector2(pts[1][0], pts[1][1]);
    return { A, B };
  }

  private drawWoodRamp(r: Ramp, pts: Pt[]): void {
    const g = this.chunk(pts[0][0]);
    const v = pts.map(([x, y]) => new Phaser.Math.Vector2(x, y));
    g.fillStyle(0xb5793f, 1);
    g.fillPoints(v, true);
    // Holzmaserung
    g.lineStyle(2, 0x8f5c2c, 0.5);
    for (let i = 1; i < 5; i++) {
      const y = r.base - (r.h * i) / 5;
      const t = i / 5;
      const xa = r.dir === 1 ? r.x + r.w * t : r.x;
      const xb = r.dir === 1 ? r.x + r.w : r.x + r.w * (1 - t);
      g.lineBetween(xa + 4, y, xb - 4, y);
    }
    // Lineal als Fahrbahn
    const { A, B } = this.rampSlope(r, pts);
    const len = A.distance(B);
    const nx = -(B.y - A.y) / len;
    const ny = (B.x - A.x) / len;
    const th = 12;
    g.fillStyle(0xffd23f, 1);
    g.fillPoints([A, B, new Phaser.Math.Vector2(B.x + nx * th, B.y + ny * th), new Phaser.Math.Vector2(A.x + nx * th, A.y + ny * th)], true);
    g.lineStyle(2, 0x6b4a00, 0.8);
    for (let d = 10, i = 0; d < len - 4; d += 14, i++) {
      const t = d / len;
      const px = A.x + (B.x - A.x) * t;
      const py = A.y + (B.y - A.y) * t;
      const l = i % 5 === 0 ? 9 : 5;
      g.lineBetween(px, py, px + nx * l, py + ny * l);
    }
  }

  private drawBoostRamp(r: Ramp, pts: Pt[]): BoostObj {
    const g = this.chunk(pts[0][0]);
    const v = pts.map(([x, y]) => new Phaser.Math.Vector2(x, y));
    g.fillStyle(0xd95f00, 1);
    g.fillPoints(v, true);
    const { A, B } = this.rampSlope(r, pts);
    const len = A.distance(B);
    const nx = -(B.y - A.y) / len;
    const ny = (B.x - A.x) / len;
    // Bahn
    g.fillStyle(0xff8a1f, 1);
    g.fillPoints([A, B, new Phaser.Math.Vector2(B.x + nx * 16, B.y + ny * 16), new Phaser.Math.Vector2(A.x + nx * 16, A.y + ny * 16)], true);
    // Stütze
    const lipX = r.dir === 1 ? r.x + r.w : r.x;
    const lipY = r.base - r.h;
    g.fillStyle(0xa94600, 1);
    g.fillRect(lipX - (r.dir === 1 ? 14 : 0), lipY + 10, 14, r.h - 10);
    // Pfeile (animiert)
    const arrows = this.scene.add.graphics().setDepth(12);
    const dirx = (B.x - A.x) / len;
    const diry = (B.y - A.y) / len;
    for (let d = 40; d < len - 20; d += 45) {
      const cx = A.x + dirx * d + nx * 8;
      const cy = A.y + diry * d + ny * 8;
      const s = 9;
      arrows.fillStyle(0xfff36b, 1);
      arrows.fillTriangle(cx + dirx * s, cy + diry * s, cx - dirx * s + nx * s * 0.7, cy - diry * s + ny * s * 0.7, cx - dirx * s - nx * s * 0.7, cy - diry * s - ny * s * 0.7);
    }
    // Blitz-Symbol an der Seite
    const mx = r.dir === 1 ? r.x + r.w * 0.7 : r.x + r.w * 0.3;
    const my = r.base - r.h * 0.28;
    g.fillStyle(0xfff36b, 1);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(mx + 4, my - 16),
        new Phaser.Math.Vector2(mx - 8, my + 2),
        new Phaser.Math.Vector2(mx, my + 2),
        new Phaser.Math.Vector2(mx - 4, my + 16),
        new Phaser.Math.Vector2(mx + 8, my - 2),
        new Phaser.Math.Vector2(mx, my - 2),
      ],
      true,
    );
    this.scene.tweens.add({ targets: arrows, alpha: 0.35, duration: 380, yoyo: true, repeat: -1 });
    return { ramp: r, lipX, lipY, cd: 0, arrows };
  }

  private drawStart(): void {
    const x = this.L.startX - 90;
    const g = this.chunk(x);
    const y = this.groundY(x);
    g.fillStyle(0xffffff, 0.95);
    g.fillRect(x, y - 2, 14, 9);
    this.scene.add
      .text(x + 7, y - 90, 'START', { fontFamily: 'Fredoka, sans-serif', fontSize: '30px', fontStyle: '700', color: '#ffffff', stroke: '#3b2478', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(11)
      .setResolution(2);
  }

  private drawFinish(): Phaser.GameObjects.Graphics {
    const x = this.L.finishX;
    const y = this.groundY(x);
    const g = this.chunk(x);
    // Zielstreifen am Boden
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle((i + j) % 2 ? 0x222222 : 0xffffff, 1);
        g.fillRect(x - 12 + i * 12, y + j * 6, 12, 6);
      }
    // Bleistift-Mast
    const top = y - 330;
    g.fillStyle(0xffc928, 1);
    g.fillRect(x - 9, top, 18, y - top);
    g.fillStyle(0xe0a800, 1);
    g.fillRect(x + 3, top, 6, y - top);
    g.fillStyle(0xff7aa2, 1);
    g.fillRoundedRect(x - 9, top - 22, 18, 24, 4);
    g.fillStyle(0xb0b0b0, 1);
    g.fillRect(x - 9, top - 2, 18, 8);
    // Flagge (separat, weht)
    const flag = this.scene.add.graphics({ x: x + 9, y: top + 6 }).setDepth(11);
    const cs = 22;
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 4; j++) {
        flag.fillStyle((i + j) % 2 ? 0x222222 : 0xffffff, 1);
        flag.fillRect(i * cs, j * cs, cs, cs);
      }
    this.scene.tweens.add({ targets: flag, scaleX: 0.86, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.scene.add
      .text(x + 75, top - 34, 'ZIEL', { fontFamily: 'Fredoka, sans-serif', fontSize: '40px', fontStyle: '700', color: '#ffc928', stroke: '#3b2478', strokeThickness: 8 })
      .setOrigin(0.5)
      .setDepth(11)
      .setResolution(2);
    return flag;
  }

  // ---------- Möbel (Parallax-Ebene) ----------

  private drawDecor(c: Phaser.GameObjects.Container, d: Decor): void {
    const g = this.scene.add.graphics();
    c.add(g);
    const F = this.L.floorY;
    const x = d.x;
    switch (d.kind) {
      case 'window': {
        g.fillStyle(0xffffff, 1);
        g.fillRoundedRect(x - 130, 110, 260, 290, 10);
        g.fillGradientStyle(0x6fc7ff, 0x6fc7ff, 0xd6f1ff, 0xd6f1ff, 1);
        g.fillRect(x - 116, 124, 232, 262);
        g.fillStyle(0xfff3a0, 1);
        g.fillCircle(x + 60, 180, 30);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x - 50, 240, 22);
        g.fillCircle(x - 25, 230, 28);
        g.fillCircle(x, 242, 20);
        g.fillStyle(0x7ed957, 1);
        g.fillEllipse(x, 400, 300, 90);
        g.fillStyle(0xffffff, 1);
        g.fillRect(x - 4, 124, 8, 262);
        g.fillRect(x - 116, 251, 232, 8);
        // Vorhänge
        g.fillStyle(0xff8fb1, 1);
        g.fillRoundedRect(x - 160, 95, 50, 330, 20);
        g.fillRoundedRect(x + 110, 95, 50, 330, 20);
        g.fillStyle(0x8d6e63, 1);
        g.fillRoundedRect(x - 175, 88, 350, 12, 6);
        break;
      }
      case 'bed': {
        g.fillStyle(0x8d5a3b, 1);
        g.fillRoundedRect(x - 240, F - 260, 36, 260, 10);
        g.fillRoundedRect(x + 204, F - 190, 36, 190, 10);
        g.fillStyle(0xffffff, 1);
        g.fillRoundedRect(x - 210, F - 150, 420, 70, 20);
        g.fillStyle(0x5ab0ff, 1);
        g.fillRoundedRect(x - 120, F - 175, 330, 95, 26);
        g.fillStyle(0xffffff, 0.5);
        for (let i = 0; i < 5; i++) g.fillCircle(x - 80 + i * 65, F - 128, 9);
        g.fillStyle(0xfff3e0, 1);
        g.fillRoundedRect(x - 205, F - 185, 100, 50, 22);
        g.fillStyle(0x8d5a3b, 1);
        g.fillRect(x - 210, F - 85, 420, 30);
        break;
      }
      case 'shelf': {
        g.fillStyle(0xc28a52, 1);
        g.fillRect(x - 110, F - 330, 220, 330);
        g.fillStyle(0x9c6a3a, 1);
        for (let i = 0; i < 4; i++) g.fillRect(x - 110, F - 330 + i * 100, 220, 12);
        for (let s = 0; s < 3; s++) {
          let bx = x - 98;
          const by = F - 318 + s * 100;
          while (bx < x + 80) {
            const w = 14 + Math.floor(this.rand() * 12);
            const h = 50 + Math.floor(this.rand() * 34);
            g.fillStyle(BOOK_COLORS[Math.floor(this.rand() * BOOK_COLORS.length)], 1);
            g.fillRect(bx, by + 88 - h, w, h);
            bx += w + 2;
            if (this.rand() > 0.8) bx += 24;
          }
        }
        g.fillStyle(0xff5a5f, 1);
        g.fillCircle(x + 60, F - 360, 30);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x + 50, F - 370, 9);
        break;
      }
      case 'poster': {
        g.fillStyle(0x1b1035, 1);
        g.fillRoundedRect(x - 85, 130, 170, 230, 8);
        g.fillStyle(0xffffff, 0.9);
        for (let i = 0; i < 12; i++) g.fillCircle(x - 70 + this.rand() * 140, 145 + this.rand() * 200, 2);
        g.fillStyle(0xffffff, 1);
        g.fillEllipse(x, 245, 40, 110);
        g.fillStyle(0xff4d5e, 1);
        g.fillTriangle(x - 20, 210, x + 20, 210, x, 175);
        g.fillTriangle(x - 20, 270, x - 40, 300, x - 18, 300);
        g.fillTriangle(x + 20, 270, x + 40, 300, x + 18, 300);
        g.fillStyle(0x38b6ff, 1);
        g.fillCircle(x, 235, 10);
        g.fillStyle(0xffc928, 1);
        g.fillTriangle(x - 12, 300, x + 12, 300, x, 335);
        break;
      }
      case 'lamp': {
        g.fillStyle(0x666b78, 1);
        g.fillRect(x - 4, F - 330, 8, 330);
        g.fillEllipse(x, F - 4, 90, 18);
        g.fillStyle(0xffd23f, 1);
        g.fillTriangle(x - 60, F - 300, x + 60, F - 300, x, F - 380);
        g.fillStyle(0xfff6c4, 0.25);
        g.fillTriangle(x - 60, F - 300, x + 60, F - 300, x, F - 120);
        break;
      }
      case 'clock': {
        g.fillStyle(0xff8a1f, 1);
        g.fillCircle(x, 200, 56);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x, 200, 46);
        g.lineStyle(6, 0x24123f, 1);
        g.lineBetween(x, 200, x, 168);
        g.lineBetween(x, 200, x + 24, 208);
        g.fillStyle(0x24123f, 1);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          g.fillCircle(x + Math.cos(a) * 38, 200 + Math.sin(a) * 38, 3);
        }
        break;
      }
      case 'door': {
        g.fillStyle(0xffffff, 1);
        g.fillRect(x - 110, F - 470, 220, 470);
        g.fillStyle(0xf2c48d, 1);
        g.fillRect(x - 95, F - 455, 190, 455);
        g.fillStyle(0xe0ad73, 1);
        g.fillRoundedRect(x - 75, F - 430, 150, 170, 8);
        g.fillRoundedRect(x - 75, F - 235, 150, 200, 8);
        g.fillStyle(0xc0c0c0, 1);
        g.fillCircle(x + 70, F - 240, 10);
        break;
      }
      case 'chest': {
        g.fillStyle(0x4cd97b, 1);
        g.fillRoundedRect(x - 120, F - 170, 240, 170, 12);
        g.fillStyle(0x2fae5c, 1);
        g.fillRect(x - 120, F - 170, 240, 24);
        g.fillStyle(0xffd23f, 1);
        g.fillCircle(x - 40, F - 90, 18);
        g.fillCircle(x + 40, F - 90, 18);
        g.fillStyle(0xffffff, 1);
        g.fillRoundedRect(x - 20, F - 160, 40, 14, 6);
        break;
      }
      case 'dino': {
        g.fillStyle(0x6ccf6c, 1);
        g.fillEllipse(x, F - 80, 170, 110);
        g.fillCircle(x + 90, F - 150, 34);
        g.fillRect(x + 66, F - 150, 34, 80);
        g.fillTriangle(x - 80, F - 90, x - 160, F - 40, x - 70, F - 50);
        g.fillRect(x - 50, F - 40, 26, 40);
        g.fillRect(x + 30, F - 40, 26, 40);
        g.fillStyle(0x3fa34d, 1);
        for (let i = 0; i < 5; i++) g.fillTriangle(x - 60 + i * 30, F - 130, x - 45 + i * 30, F - 160, x - 30 + i * 30, F - 130);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x + 100, F - 160, 9);
        g.fillStyle(0x222222, 1);
        g.fillCircle(x + 103, F - 160, 4);
        break;
      }
    }
  }
}
