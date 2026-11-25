import Phaser from 'phaser';
import type { LevelDef, Pt, Ramp } from './levels/types';

const FLOOR_DEPTH = 500;

export interface CoinObj {
  x: number;
  y: number;
  taken: boolean;
}
export interface RingObj {
  x: number;
  y: number;
  cd: number;
}
export interface BoostObj {
  ramp: Ramp;
  lipX: number;
  lipY: number;
  cd: number;
}

export interface LevelLogic {
  coins: CoinObj[];
  rings: RingObj[];
  boosts: BoostObj[];
}

/** Baut die statischen Matter-Körper eines Levels und die Spiel-Logikobjekte (Münzen, Ringe, Boosts). Gerendert wird in 3D. */
export function buildLevelPhysics(scene: Phaser.Scene, L: LevelDef): LevelLogic {
  const M = scene.matter;
  const poly = (pts: Pt[], label: string) => {
    const verts = pts.map(([x, y]) => ({ x, y }));
    const c = M.vertices.centre(verts as unknown as MatterJS.Vector[]) as { x: number; y: number };
    M.add.fromVertices(c.x, c.y, verts as unknown as object[], { isStatic: true, label, friction: 1, frictionStatic: 1, restitution: 0 });
  };

  // Boden (lange Segmente zerteilt)
  const g = L.ground;
  const bottom = L.floorY + FLOOR_DEPTH;
  for (let i = 0; i < g.length - 1; i++) {
    const [x1, y1] = g[i];
    const [x2, y2] = g[i + 1];
    if (x2 - x1 < 1) continue;
    const n = Math.max(1, Math.ceil((x2 - x1) / 400));
    for (let j = 0; j < n; j++) {
      const ax = x1 + ((x2 - x1) * j) / n;
      const bx = x1 + ((x2 - x1) * (j + 1)) / n;
      const ay = y1 + ((y2 - y1) * j) / n;
      const by = y1 + ((y2 - y1) * (j + 1)) / n;
      poly(
        [
          [ax, ay],
          [bx, by],
          [bx, bottom],
          [ax, bottom],
        ],
        'ground',
      );
    }
  }

  for (const b of L.blocks) M.add.rectangle(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, { isStatic: true, label: 'block', friction: 1, frictionStatic: 1 });

  const boosts: BoostObj[] = [];
  for (const r of L.ramps) {
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
    poly(pts, r.boost ? 'boostRamp' : 'ramp');
    if (r.boost) boosts.push({ ramp: r, lipX: r.dir === 1 ? r.x + r.w : r.x, lipY: r.base - r.h, cd: 0 });
  }

  // Wände & Decke
  M.add.rectangle(-150, L.floorY - 1000, 100, 3000, { isStatic: true, label: 'wall' });
  M.add.rectangle(L.endX + 450, L.floorY - 1000, 100, 3000, { isStatic: true, label: 'wall' });
  M.add.rectangle(L.endX / 2, -1500, L.endX + 1000, 100, { isStatic: true, label: 'ceiling' });

  return {
    coins: L.coins.map(([x, y]) => ({ x, y, taken: false })),
    rings: L.rings.map(({ x, y }) => ({ x, y, cd: 0 })),
    boosts,
  };
}
