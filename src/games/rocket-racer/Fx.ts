import Phaser from 'phaser';
import { TEX_K } from './textures';

interface P {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  max: number;
  s0: number;
  s1: number;
  a0: number;
  g: number;
  spin: number;
  drag: number;
  alive: boolean;
}

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

/** Minimaler Partikel-Pool (Flammen, Funken, Konfetti) – unabhängig von der Partikel-API der Engine. */
export class Fx {
  private pool: P[] = [];

  constructor(private scene: Phaser.Scene, private depth = 50) {}

  spawn(x: number, y: number, o: SpawnOpts = {}): void {
    let p = this.pool.find((q) => !q.alive);
    if (!p) {
      if (this.pool.length > 400) return;
      const img = this.scene.add.image(0, 0, o.tex ?? 'soft').setDepth(this.depth);
      p = { img, vx: 0, vy: 0, life: 0, max: 1, s0: 1, s1: 1, a0: 1, g: 0, spin: 0, drag: 1, alive: false };
      this.pool.push(p);
    }
    const tex = o.tex ?? 'soft';
    if (p.img.texture.key !== tex) p.img.setTexture(tex);
    const k = 1 / TEX_K;
    p.alive = true;
    p.vx = o.vx ?? 0;
    p.vy = o.vy ?? 0;
    p.life = 0;
    p.max = o.life ?? 30;
    p.s0 = (o.s0 ?? 1) * k;
    p.s1 = (o.s1 ?? 0) * k;
    p.a0 = o.alpha ?? 1;
    p.g = o.gravity ?? 0;
    p.spin = o.spin ?? 0;
    p.drag = o.drag ?? 0.97;
    p.img
      .setVisible(true)
      .setPosition(x, y)
      .setScale(p.s0)
      .setAlpha(p.a0)
      .setRotation(o.rotation ?? 0)
      .setTint(o.tint ?? 0xffffff)
      .setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
  }

  /** dt in Schritten (1 = 1/60 s) */
  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.max) {
        p.alive = false;
        p.img.setVisible(false);
        continue;
      }
      const t = p.life / p.max;
      p.vy += p.g * dt;
      const d = Math.pow(p.drag, dt);
      p.vx *= d;
      p.vy *= d;
      p.img.x += p.vx * dt;
      p.img.y += p.vy * dt;
      p.img.rotation += p.spin * dt;
      p.img.setScale(p.s0 + (p.s1 - p.s0) * t);
      p.img.setAlpha(p.a0 * (1 - t * t));
    }
  }

  burst(x: number, y: number, n: number, o: SpawnOpts & { speed?: number } = {}): void {
    const sp = o.speed ?? 4;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = sp * (0.4 + Math.random() * 0.6);
      this.spawn(x, y, { ...o, vx: Math.cos(a) * v + (o.vx ?? 0), vy: Math.sin(a) * v + (o.vy ?? 0) });
    }
  }
}
