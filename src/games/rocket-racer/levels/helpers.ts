import { G_STEP, launchVector } from '../physics';
import type { Pt, Ramp } from './types';

/** Münzreihe */
export function coinLine(x1: number, x2: number, y: number, step = 60): Pt[] {
  const out: Pt[] = [];
  for (let x = x1; x <= x2 + 0.1; x += step) out.push([Math.round(x), y]);
  return out;
}

/** Münzen entlang einer ballistischen Flugbahn (gleiche Gravitation wie im Spiel) */
export function coinArc(x0: number, y0: number, vx: number, vy: number, count: number, every = 9, startStep = 8): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const t = startStep + i * every;
    out.push([Math.round(x0 + vx * t), Math.round(y0 + vy * t + 0.5 * G_STEP * t * t)]);
  }
  return out;
}

/** Punkt auf der Flugbahn nach t Schritten */
export function arcAt(x0: number, y0: number, vx: number, vy: number, t: number): Pt {
  return [x0 + vx * t, y0 + vy * t + 0.5 * G_STEP * t * t];
}

/** Abflugpunkt (Auto-Mitte) + Geschwindigkeit einer Boost-Rampe */
export function rampLaunch(r: Ramp, carLift = 34): { x: number; y: number; vx: number; vy: number } {
  const lipX = r.dir === 1 ? r.x + r.w : r.x;
  const lipY = r.base - r.h;
  const { vx, vy } = launchVector(r.boost, r.angle ?? 0.62);
  return { x: lipX, y: lipY - carLift, vx: vx * r.dir, vy };
}

/** Sanfte Hügel (Bettdecke) als Bodenpunkte */
export function hills(x0: number, x1: number, baseY: number, amp: number, wave: number, step = 25): Pt[] {
  const out: Pt[] = [];
  for (let x = x0; x <= x1; x += step) {
    out.push([x, Math.round(baseY - (amp * (1 - Math.cos(((x - x0) / wave) * Math.PI * 2))) / 2)]);
  }
  return out;
}
