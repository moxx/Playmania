/** Gemeinsame Physik-Konstanten (Einheiten: px und Schritte à 1/60 s) */

/** Matter-Gravitation – bewusst niedrig (Erde wäre 1.0) für lange, weiche Sprünge */
export const GRAVITY_Y = 0.55;
/** Resultierende Beschleunigung in px/Schritt² (Matter: g * 0.001 * (1000/60)²) */
export const G_STEP = GRAVITY_Y * 0.001 * (1000 / 60) ** 2;
export const STEP_MS = 1000 / 60;

export function launchVector(speed: number, angle: number): { vx: number; vy: number } {
  return { vx: Math.cos(angle) * speed, vy: -Math.sin(angle) * speed };
}
