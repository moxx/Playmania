/**
 * Matchbox-Autos. Geometrie ist relativ zum "Auto-Ursprung" = Mitte des Unterbaus.
 * Physik-Einheiten: Pixel und "pro Physik-Schritt" (1/60 s).
 */
export type CarStyle = 'sport' | 'pickup' | 'monster' | 'bus';

export interface CarDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  style: CarStyle;
  color: number;
  accent: number;
  /** Unterbau */
  bodyW: number;
  bodyH: number;
  /** Kabine (x relativ zum Ursprung, Höhe über Unterbau-Oberkante) */
  cabBack: number;
  cabFront: number;
  cabH: number;
  wheelR: number;
  /** Achsen x-Positionen (hinten, vorne) */
  axles: [number, number];
  /** Achse y unterhalb des Ursprungs */
  axleY: number;
  /** max. Raddrehung rad/Schritt → Top-Speed = maxSpin * wheelR */
  maxSpin: number;
  /** Raddrehungs-Zuwachs pro Schritt */
  accel: number;
  grip: number;
  /** Federung 0..1 (1 = starr) */
  stiffness: number;
  mass: number;
  wheelMass: number;
  /** Anzeige-Werte 1..5 */
  stats: { speed: number; accel: number; grip: number };
}

export const CARS: CarDef[] = [
  {
    id: 'flitzer',
    name: 'Roter Flitzer',
    desc: 'Klein, flink, mutig.',
    price: 0,
    style: 'sport',
    color: 0xe8333f,
    accent: 0xffffff,
    bodyW: 112, bodyH: 24, cabBack: -34, cabFront: 20, cabH: 20,
    wheelR: 17, axles: [-36, 36], axleY: 12,
    maxSpin: 0.56, accel: 0.03, grip: 0.95, stiffness: 0.7, mass: 4, wheelMass: 2.2,
    stats: { speed: 2, accel: 2, grip: 2 },
  },
  {
    id: 'pickup',
    name: 'Blauer Pickup',
    desc: 'Schwer und stabil – kippt kaum.',
    price: 150,
    style: 'pickup',
    color: 0x2f7de1,
    accent: 0xffd23f,
    bodyW: 122, bodyH: 28, cabBack: -6, cabFront: 30, cabH: 24,
    wheelR: 19, axles: [-40, 40], axleY: 14,
    maxSpin: 0.55, accel: 0.034, grip: 1, stiffness: 0.6, mass: 5, wheelMass: 3,
    stats: { speed: 3, accel: 2, grip: 4 },
  },
  {
    id: 'blitz',
    name: 'Gelber Blitz',
    desc: 'Ein Rennwagen. Sehr schnell!',
    price: 400,
    style: 'sport',
    color: 0xffc21a,
    accent: 0x1d1d1d,
    bodyW: 118, bodyH: 22, cabBack: -30, cabFront: 18, cabH: 17,
    wheelR: 17, axles: [-40, 38], axleY: 11,
    maxSpin: 0.72, accel: 0.045, grip: 0.95, stiffness: 0.75, mass: 4, wheelMass: 2.2,
    stats: { speed: 5, accel: 4, grip: 3 },
  },
  {
    id: 'monster',
    name: 'Grünes Monster',
    desc: 'Riesenräder – fährt über alles.',
    price: 800,
    style: 'monster',
    color: 0x2ecc71,
    accent: 0xff7a00,
    bodyW: 110, bodyH: 30, cabBack: -30, cabFront: 18, cabH: 22,
    wheelR: 27, axles: [-44, 44], axleY: 26,
    maxSpin: 0.5, accel: 0.03, grip: 1, stiffness: 0.45, mass: 4.5, wheelMass: 3,
    stats: { speed: 4, accel: 3, grip: 5 },
  },
];

export function carById(id: string): CarDef {
  return CARS.find((c) => c.id === id) ?? CARS[0];
}

/** Raketen-Upgrades */
export const ROCKET_MAX_LEVEL = 5;
export const ROCKET_COSTS = [60, 120, 220, 350, 500];
/** Geschwindigkeitszuwachs pro Schritt beim Zünden */
export const rocketThrust = (lvl: number) => 0.19 + 0.055 * lvl;
/** Tankinhalt in Schritten (60 = 1 Sekunde) */
export const rocketTank = (lvl: number) => 80 + 32 * lvl;

/** Kabinen-Umriss (für Zeichnung und Physik-Hülle) */
export function carHullPoints(c: CarDef): { x: number; y: number }[] {
  const top = -c.bodyH / 2;
  const bot = c.bodyH / 2;
  const hw = c.bodyW / 2;
  return [
    { x: -hw, y: bot },
    { x: hw, y: bot },
    { x: hw, y: top + 6 },
    { x: c.cabFront + 14, y: top },
    { x: c.cabFront, y: top - c.cabH },
    { x: c.cabBack + 6, y: top - c.cabH },
    { x: c.cabBack - 8, y: top },
    { x: -hw, y: top + 2 },
  ];
}
