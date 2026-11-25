import Phaser from 'phaser';

export const FONT = 'Fredoka, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

export const C = {
  bgDeep: 0x1b1035,
  bg: 0x2a1858,
  panel: 0x3b2478,
  panelLight: 0x5a3aa8,
  yellow: 0xffc928,
  orange: 0xff8a1f,
  red: 0xff4d5e,
  green: 0x3ddc84,
  blue: 0x38b6ff,
  pink: 0xff6ec7,
  white: 0xffffff,
  ink: 0x24123f,
} as const;

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

export interface TxtOpts {
  color?: string;
  stroke?: string;
  strokeThickness?: number;
  weight?: '400' | '500' | '600' | '700';
  align?: 'left' | 'center' | 'right';
  wrap?: number;
  origin?: [number, number];
  shadow?: boolean;
}

/** Text in der richtigen Auflösung für die aktuelle Kamera-Zoomstufe (bleibt scharf auf Retina). */
export function txt(scene: Phaser.Scene, x: number, y: number, s: string, size: number, o: TxtOpts = {}): Phaser.GameObjects.Text {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: o.weight ?? '700',
    color: o.color ?? '#ffffff',
    align: o.align ?? 'center',
  };
  if (o.stroke) {
    style.stroke = o.stroke;
    style.strokeThickness = o.strokeThickness ?? Math.max(2, Math.round(size / 7));
  }
  if (o.wrap) style.wordWrap = { width: o.wrap, useAdvancedWrap: true };
  const t = scene.add.text(x, y, s, style);
  if (o.shadow) t.setShadow(0, Math.max(2, size / 12), 'rgba(0,0,0,0.35)', 0, true, true);
  const zoom = scene.cameras.main.zoom || 1;
  t.setResolution(Math.max(1, Math.min(3, zoom * 1.1)));
  const [ox, oy] = o.origin ?? [0.5, 0.5];
  t.setOrigin(ox, oy);
  return t;
}
