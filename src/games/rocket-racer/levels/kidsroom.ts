import { G_STEP } from '../physics';
import { arcAt, coinArc, coinLine, hills, rampLaunch } from './helpers';
import type { LevelDef, Pt, Ramp } from './types';

/**
 * Level 1 – Kinderzimmer
 * Abschnitte: Start → erster Jump-Boost → Bücher-Kette (Boost zu Boost, Ringe in der Luft)
 * → Bettdecken-Hügel → Bauklotz-Finale → Ziel.
 */
const F = 620; // Fußboden

const rampA: Ramp = { x: 1300, base: F, w: 220, h: 60, dir: 1, boost: 15, angle: 0.62 };
const rampB: Ramp = { x: 3400, base: F, w: 240, h: 80, dir: 1, boost: 16, angle: 0.62 };
const BOOK_TOP = 500;
const rampC: Ramp = { x: 5450, base: BOOK_TOP, w: 250, h: 70, dir: 1, boost: 17, angle: 0.66 };
const rampD: Ramp = { x: 10200, base: F, w: 240, h: 80, dir: 1, boost: 16, angle: 0.6 };

const A = rampLaunch(rampA);
const B = rampLaunch(rampB);
const Cl = rampLaunch(rampC);
const D = rampLaunch(rampD);

// Ringe: Ring 1 im Scheitel von Rampe C, Ring 2 auf der Bahn nach Ring 1
const RING_KICK = { vx: 15, vy: -6 };
const tApexC = -Cl.vy / G_STEP;
const ring1 = arcAt(Cl.x, Cl.y, Cl.vx, Cl.vy, tApexC);
const ring2 = arcAt(ring1[0], ring1[1], RING_KICK.vx, RING_KICK.vy, 52);

const ground: Pt[] = [
  [-400, F],
  [8800, F],
  ...hills(8825, 10000, F, 70, 390),
  [10000, F],
  [13600, F],
];

export const kidsroom: LevelDef = {
  id: 'kids-1',
  name: 'Kinderzimmer',
  subtitle: 'Spring von Boost zu Boost!',
  theme: 'kids',
  wallTexture: 'wall-kids',
  floorColor: 0xc98b52,
  floorY: F,
  startX: 260,
  finishX: 12350,
  endX: 13000,
  ground,
  rugs: [
    { x1: 380, x2: 1250, color: 0xff6b6b },
    { x1: 6100, x2: 7600, color: 0x7bd88f },
    { x1: 11500, x2: 12900, color: 0xb18cff },
  ],
  blocks: [
    // Regalbrett hoch oben (nur mit Rakete erreichbar)
    { x: 2350, y: 170, w: 520, h: 18, kind: 'plank' },
    // Großer Bücherstapel
    { x: 4700, y: BOOK_TOP, w: 1000, h: F - BOOK_TOP, kind: 'books' },
    // Bauklotz-Hügel im Finale
    { x: 10900, y: 480, w: 200, h: F - 480, kind: 'toy', label: 'ABC' },
    // Spielzeugkiste am Ende
    { x: 13000, y: 300, w: 400, h: F - 300, kind: 'box' },
  ],
  ramps: [
    rampA,
    rampB,
    // Auffahrt auf den Bücherstapel (falls man zu kurz springt)
    { x: 4450, base: F, w: 250, h: F - BOOK_TOP, dir: 1, boost: 0 },
    rampC,
    rampD,
    // Bauklotz-Hügel: rauf und runter
    { x: 10700, base: F, w: 200, h: F - 480, dir: 1, boost: 0 },
    { x: 11100, base: F, w: 200, h: F - 480, dir: -1, boost: 0 },
  ],
  rings: [
    { x: Math.round(ring1[0]), y: Math.round(ring1[1]) },
    { x: Math.round(ring2[0]), y: Math.round(ring2[1]) },
  ],
  coins: [
    ...coinLine(520, 1000, 584),
    ...coinArc(A.x, A.y, A.vx, A.vy, 12, 9),
    ...coinLine(2420, 2800, 140, 76),
    ...coinLine(3050, 3290, 584),
    ...coinArc(B.x, B.y, B.vx, B.vy, 12, 9),
    ...coinLine(5250, 5400, 464, 50),
    ...coinArc(Cl.x, Cl.y, Cl.vx, Cl.vy, 6, 9),
    ...coinArc(ring1[0], ring1[1], RING_KICK.vx, RING_KICK.vy, 5, 8, 8),
    ...coinArc(ring2[0], ring2[1], RING_KICK.vx, RING_KICK.vy, 8, 9, 10),
    ...coinLine(6200, 7400, 584, 80),
    // Hügelspitzen
    ...[9020, 9410, 9800].flatMap((x) => coinLine(x - 40, x + 40, 515, 40)),
    ...coinArc(D.x, D.y, D.vx, D.vy, 12, 9),
    ...coinLine(12150, 12550, 584, 50),
  ],
  decor: [
    { kind: 'window', x: 250 },
    { kind: 'bed', x: 700 },
    { kind: 'poster', x: 1300 },
    { kind: 'shelf', x: 1700 },
    { kind: 'clock', x: 2150 },
    { kind: 'teddy', x: 2300 },
    { kind: 'lamp', x: 2500 },
    { kind: 'window', x: 2900 },
    { kind: 'dino', x: 3450 },
    { kind: 'door', x: 3850 },
    { kind: 'chest', x: 4300 },
    { kind: 'poster', x: 4700 },
    { kind: 'bed', x: 5150 },
    { kind: 'window', x: 5800 },
    { kind: 'shelf', x: 6300 },
    { kind: 'desk', x: 6650 },
    { kind: 'lamp', x: 7000 },
    { kind: 'dino', x: 7450 },
    { kind: 'window', x: 7900 },
    { kind: 'door', x: 8400 },
    { kind: 'chest', x: 8800 },
    { kind: 'teddy', x: 9000 },
    { kind: 'poster', x: 9200 },
  ],
};
