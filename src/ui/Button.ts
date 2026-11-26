import Phaser from 'phaser';
import { sfx } from '../core/audio';
import { C, txt } from './theme';

export interface ButtonOpts {
  color?: number;
  textColor?: string;
  fontSize?: number;
  radius?: number;
  icon?: string;
  iconScale?: number;
  sound?: boolean;
}

/** Bonbon-Button: abgerundet, mit "3D"-Kante, drückt sich beim Tippen ein. */
export class Button extends Phaser.GameObjects.Container {
  /**
   * Alle sichtbaren Teile liegen in `face`. Nur `face` wird animiert (Drück-Effekt, Pulsieren) –
   * der Button selbst bleibt unbewegt, sonst verliert Phasers Treffertest Klicks.
   */
  readonly face: Phaser.GameObjects.Container;
  private pressed = false;
  private bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  private icon?: Phaser.GameObjects.Image;
  private enabled = true;
  private color: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly w: number,
    readonly h: number,
    text: string,
    private onClick: () => void,
    private opts: ButtonOpts = {},
  ) {
    super(scene, x, y);
    this.color = opts.color ?? C.yellow;
    this.face = scene.add.container(0, 0);
    this.add(this.face);
    this.bg = scene.add.graphics();
    this.face.add(this.bg);
    const fs = opts.fontSize ?? Math.round(h * 0.42);
    this.label = txt(scene, 0, -3, text, fs, { color: opts.textColor ?? '#3a1d00' });
    this.face.add(this.label);
    if (opts.icon) {
      this.icon = scene.add.image(0, -3, opts.icon);
      this.icon.setScale(opts.iconScale ?? (h * 0.5) / this.icon.height);
      this.face.add(this.icon);
      if (text) {
        // Icon + Text gemeinsam zentrieren
        const gap = 8;
        const iw = this.icon.displayWidth;
        const total = iw + gap + this.label.width;
        this.icon.x = -total / 2 + iw / 2;
        this.label.x = -total / 2 + iw + gap + this.label.width / 2;
      }
    }
    this.draw();
    this.setSize(w, h);
    // Achtung: Container-Trefferflächen beginnen oben links (Phaser rechnet displayOrigin = Größe/2 selbst ein)
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    if (this.input) this.input.cursor = 'pointer';
    this.on('pointerdown', () => {
      if (!this.enabled) {
        sfx.error();
        return;
      }
      this.pressed = true;
      this.face.setScale(0.94);
    });
    this.on('pointerout', () => {
      this.pressed = false;
      this.face.setScale(1);
    });
    this.on('pointerup', () => {
      const wasDown = this.pressed;
      this.pressed = false;
      this.face.setScale(1);
      if (!this.enabled || !wasDown) return;
      if (opts.sound !== false) sfx.click();
      this.onClick();
    });
    scene.add.existing(this);
  }

  setColor(c: number): this {
    this.color = c;
    this.draw();
    return this;
  }

  setText(t: string): this {
    this.label.setText(t);
    return this;
  }

  setEnabled(e: boolean): this {
    this.enabled = e;
    this.setAlpha(e ? 1 : 0.55);
    return this;
  }

  private draw(): void {
    const { w, h } = this;
    const r = this.opts.radius ?? Math.min(22, h / 2);
    const g = this.bg;
    const dark = Phaser.Display.Color.IntegerToColor(this.color).darken(28).color;
    const light = Phaser.Display.Color.IntegerToColor(this.color).lighten(18).color;
    g.clear();
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(-w / 2, -h / 2 + 8, w, h, r);
    g.fillStyle(dark, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, r);
    g.fillStyle(this.color, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h - 2, r);
    g.fillStyle(light, 0.9);
    g.fillRoundedRect(-w / 2 + 8, -h / 2 + 5, w - 16, Math.max(6, h * 0.22), Math.min(r, h * 0.11));
  }
}

/** Runder Icon-Button (Pause, Zurück, Ton …) */
export function iconButton(scene: Phaser.Scene, x: number, y: number, size: number, label: string, onClick: () => void, color: number = C.panelLight): Button {
  const b = new Button(scene, x, y, size, size, label, onClick, { color, textColor: '#ffffff', fontSize: Math.round(size * 0.46), radius: size / 2 });
  return b;
}
