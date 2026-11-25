import Phaser from 'phaser';
import { loadSave } from '../../../core/save';
import { safeInsets, setupUiCamera, type View } from '../../../core/view';
import { Button, iconButton } from '../../../ui/Button';
import { C, txt } from '../../../ui/theme';
import { TEX_K } from '../textures';
import type { RaceResult, RaceScene } from './RaceScene';

interface Zone {
  kind: 'gas' | 'brake' | 'rocket';
  test: (x: number, y: number) => boolean;
}

/** Bedien-Oberfläche über dem Rennen: Pedale, Rakete, Münzen, Fortschritt, Pause & Ergebnis. */
export class HudScene extends Phaser.Scene {
  private v!: View;
  private race!: RaceScene;
  private coinText!: Phaser.GameObjects.Text;
  private progress!: Phaser.GameObjects.Graphics;
  private progressCar!: Phaser.GameObjects.Image;
  private progressX = 0;
  private progressW = 0;
  private fuelRing!: Phaser.GameObjects.Graphics;
  private gasBtn!: Phaser.GameObjects.Container;
  private brakeBtn!: Phaser.GameObjects.Container;
  private rocketBtn!: Phaser.GameObjects.Container;
  private rocketPos = { x: 0, y: 0, r: 0 };
  private zones: Zone[] = [];
  private overlay: Phaser.GameObjects.Container | null = null;
  private lastCoins = -1;

  constructor() {
    super({ key: 'hud' });
  }

  create(): void {
    this.race = this.scene.get('race') as RaceScene;
    this.v = setupUiCamera(this);
    this.overlay = null;
    this.lastCoins = -1;
    this.input.addPointer(3);
    this.layout();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
  }

  private onResize(): void {
    this.time.delayedCall(80, () => {
      const pausedOverlay = !!this.overlay;
      this.children.removeAll(true);
      this.overlay = null;
      this.v = setupUiCamera(this);
      this.lastCoins = -1;
      this.layout();
      if (pausedOverlay && this.race.paused) this.showPause(true);
    });
  }

  private layout(): void {
    const { W, H } = this.v;
    const ins = safeInsets(this.v);
    const L = Math.max(24, ins.left + 12);
    const R = W - Math.max(24, ins.right + 12);
    const T = Math.max(18, ins.top + 8);
    const B = H - Math.max(18, ins.bottom + 6);

    // Münzen
    const pill = this.add.graphics();
    pill.fillStyle(0x000000, 0.35);
    pill.fillRoundedRect(L, T, 170, 56, 28);
    this.add.image(L + 30, T + 28, 'coin').setScale(1.05 / TEX_K);
    this.coinText = txt(this, L + 58, T + 28, '0', 34, { origin: [0, 0.5] });

    // Fortschritt
    this.progressW = Math.min(420, W * 0.32);
    this.progressX = W / 2 - this.progressW / 2;
    this.progress = this.add.graphics();
    this.progressCar = this.add.image(this.progressX, T + 26, `car-${this.race.car.def.id}`).setScale(0.32 / TEX_K);
    const flag = this.add.graphics({ x: this.progressX + this.progressW + 14, y: T + 14 });
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 2; j++) {
        flag.fillStyle((i + j) % 2 ? 0x222222 : 0xffffff, 1);
        flag.fillRect(i * 8, j * 8, 8, 8);
      }
    flag.fillStyle(0xffffff, 1);
    flag.fillRect(-3, 0, 3, 28);

    // Pause
    iconButton(this, R - 32, T + 30, 64, 'II', () => this.race.togglePause());

    // Pedale & Rakete
    const ped = 150;
    this.brakeBtn = this.pedal(L + ped / 2 + 6, B - ped / 2 - 4, ped, C.red, '◀', 'BREMSE');
    this.gasBtn = this.pedal(R - ped / 2 - 6, B - ped / 2 - 4, ped, C.green, '▶', 'GAS');
    const rr = 66;
    this.rocketPos = { x: R - ped - 30 - rr, y: B - rr - 20, r: rr };
    this.rocketBtn = this.add.container(this.rocketPos.x, this.rocketPos.y);
    const rb = this.add.graphics();
    rb.fillStyle(0x000000, 0.3);
    rb.fillCircle(0, 6, rr);
    rb.fillStyle(C.orange, 1);
    rb.fillCircle(0, 0, rr);
    rb.fillStyle(0xffb066, 1);
    rb.fillCircle(-rr * 0.25, -rr * 0.3, rr * 0.45);
    rb.fillStyle(C.orange, 1);
    rb.fillCircle(0, 0, rr * 0.78);
    const rimg = this.add.image(4, 0, 'rocket').setScale(1.55 / TEX_K).setRotation(-0.6);
    this.fuelRing = this.add.graphics();
    this.rocketBtn.add([rb, rimg, this.fuelRing]);
    this.rocketBtn.add(txt(this, 0, rr * 0.62, 'RAKETE', 15, { color: '#4a1d00' }));

    // Touch-Zonen (großzügiger als die Grafik, Finger dürfen gleiten)
    const rp = this.rocketPos;
    this.zones = [
      { kind: 'rocket', test: (x, y) => (x - rp.x) ** 2 + (y - rp.y) ** 2 < (rp.r + 26) ** 2 },
      { kind: 'gas', test: (x, y) => x > rp.x + rp.r + 4 && y > H * 0.38 },
      { kind: 'brake', test: (x, y) => x < W * 0.3 && y > H * 0.38 },
    ];
  }

  private pedal(x: number, y: number, size: number, color: number, icon: string, label: string): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const w = size * 0.82;
    const h = size;
    const dark = Phaser.Display.Color.IntegerToColor(color).darken(30).color;
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(-w / 2, -h / 2 + 8, w, h, 24);
    g.fillStyle(dark, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 24);
    g.fillStyle(color, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h - 3, 24);
    g.fillStyle(0xffffff, 0.18);
    for (let i = 0; i < 4; i++) g.fillRoundedRect(-w / 2 + 16, -h / 2 + 18 + i * 22, w - 32, 9, 4);
    c.add(g);
    c.add(txt(this, 0, -4, icon, 54, { color: '#ffffff', stroke: Phaser.Display.Color.IntegerToColor(dark).rgba, strokeThickness: 6 }));
    c.add(txt(this, 0, h / 2 - 22, label, 16, { color: '#ffffff' }));
    c.setAlpha(0.88);
    return c;
  }

  update(): void {
    if (!this.race || !this.race.car) return;
    const race = this.race;

    // Touch auswerten
    const t = { gas: false, brake: false, rocket: false };
    if (!this.overlay) {
      const cam = this.cameras.main;
      for (const p of this.input.manager.pointers) {
        if (!p || !p.isDown) continue;
        const wp = cam.getWorldPoint(p.x, p.y);
        const z = this.zones.find((zz) => zz.test(wp.x, wp.y));
        if (z) t[z.kind] = true;
      }
    }
    race.touch = t;
    const inp = race.input2;
    this.gasBtn.setScale(inp.gas ? 0.93 : 1).setAlpha(inp.gas ? 1 : 0.88);
    this.brakeBtn.setScale(inp.brake ? 0.93 : 1).setAlpha(inp.brake ? 1 : 0.88);
    this.rocketBtn.setScale(race.car.rocketOn ? 0.93 : 1);

    // Münzen
    if (race.coins !== this.lastCoins) {
      if (this.lastCoins >= 0) this.tweens.add({ targets: this.coinText, scale: 1.25, duration: 80, yoyo: true });
      this.lastCoins = race.coins;
      this.coinText.setText(String(race.coins));
    }

    // Fortschritt
    const L = race.level;
    const f = Phaser.Math.Clamp((race.car.position.x - L.startX) / (L.finishX - L.startX), 0, 1);
    const g = this.progress;
    const y = this.progressCar.y + 14;
    g.clear();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(this.progressX - 6, y - 6, this.progressW + 12, 12, 6);
    g.fillStyle(C.yellow, 1);
    g.fillRoundedRect(this.progressX - 4, y - 4, Math.max(8, this.progressW * f + 8), 8, 4);
    this.progressCar.x = this.progressX + this.progressW * f;

    // Tank-Anzeige
    const fr = this.fuelRing;
    const r = this.rocketPos.r + 7;
    const frac = race.car.fuel / race.car.fuelMax;
    fr.clear();
    fr.lineStyle(9, 0x000000, 0.35);
    fr.beginPath();
    fr.arc(0, 0, r, 0, Math.PI * 2);
    fr.strokePath();
    fr.lineStyle(9, frac > 0.25 ? 0x9be7ff : 0xff4d5e, 1);
    fr.beginPath();
    fr.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    fr.strokePath();
  }

  countdown(s: string): void {
    const { W, H } = this.v;
    const t = txt(this, W / 2, H * 0.4, s, s.length > 1 ? 110 : 130, { color: s.length > 1 ? '#3ddc84' : '#ffffff', stroke: '#24123f', strokeThickness: 14 });
    t.setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 420, duration: 200, onComplete: () => t.destroy() });
  }

  toast(s: string, color: string): void {
    const { W, H } = this.v;
    const t = txt(this, W / 2, H * 0.3, s, 64, { color, stroke: '#24123f', strokeThickness: 10 });
    t.setScale(0.4).setRotation(-0.08);
    this.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: H * 0.24, alpha: 0, delay: 500, duration: 300, onComplete: () => t.destroy() });
  }

  private panel(w: number, h: number, title: string): Phaser.GameObjects.Container {
    const { W, H } = this.v;
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(W / 2, H / 2, W + 400, H + 400, 0x120826, 0.6).setInteractive();
    const g = this.add.graphics();
    const x = W / 2 - w / 2;
    const y = H / 2 - h / 2;
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(x, y + 10, w, h, 34);
    g.fillStyle(C.panel, 1);
    g.fillRoundedRect(x, y, w, h, 34);
    g.lineStyle(6, C.panelLight, 1);
    g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 31);
    c.add([dim, g, txt(this, W / 2, y + 52, title, 56, { color: '#ffc928', stroke: '#24123f', strokeThickness: 10 })]);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 160 });
    return c;
  }

  showPause(show: boolean): void {
    if (!this.v) return;
    this.overlay?.destroy();
    this.overlay = null;
    if (!show) return;
    const { W, H } = this.v;
    const c = this.panel(460, 420, 'Pause');
    c.add(new Button(this, W / 2, H / 2 - 40, 320, 76, 'Weiter', () => this.race.setPaused(false), { color: C.green }));
    c.add(
      new Button(this, W / 2, H / 2 + 50, 320, 76, 'Neustart', () => {
        this.race.scene.restart();
      }, { color: C.yellow }),
    );
    c.add(new Button(this, W / 2, H / 2 + 140, 320, 76, 'Garage', () => this.leave(), { color: C.blue, textColor: '#ffffff' }));
    this.overlay = c;
  }

  showResult(r: RaceResult): void {
    const { W, H } = this.v;
    this.overlay?.destroy();
    const c = this.panel(600, 520, 'Geschafft!');
    const y0 = H / 2 - 260;
    const rows: [string, string][] = [
      ['Münzen', `${r.coins} / ${r.total}`],
      ['Zeit', `${r.time.toFixed(1)} s${r.newBestTime ? '  ★ Rekord!' : ''}`],
      [r.firstClear ? 'Erstes Mal im Ziel' : 'Ziel-Bonus', `+${r.bonus}`],
    ];
    rows.forEach(([a, b], i) => {
      const y = y0 + 140 + i * 58;
      c.add(txt(this, W / 2 - 230, y, a, 30, { origin: [0, 0.5], weight: '600' }));
      c.add(txt(this, W / 2 + 230, y, b, 32, { origin: [1, 0.5], color: '#ffc928' }));
    });
    const total = r.coins + r.bonus;
    const sum = this.add.container(W / 2, y0 + 340);
    sum.add(this.add.image(-70, 0, 'coin').setScale(1.4 / TEX_K));
    const st = txt(this, -38, 0, `+0`, 50, { origin: [0, 0.5], color: '#ffffff', stroke: '#24123f', strokeThickness: 8 });
    sum.add(st);
    c.add(sum);
    const counter = { v: 0 };
    this.tweens.add({ targets: counter, v: total, duration: 900, delay: 300, onUpdate: () => st.setText(`+${Math.round(counter.v)}`) });
    c.add(txt(this, W / 2, y0 + 392, `Kontostand: ${loadSave().coins}`, 22, { color: '#ffffffaa', weight: '600' }));
    c.add(new Button(this, W / 2 - 140, y0 + 460, 250, 76, 'Nochmal', () => this.race.scene.restart(), { color: C.yellow }));
    c.add(new Button(this, W / 2 + 140, y0 + 460, 250, 76, 'Garage', () => this.leave(), { color: C.blue, textColor: '#ffffff' }));
    this.overlay = c;
  }

  private leave(): void {
    this.scene.stop('race');
    this.scene.start('garage');
  }
}
