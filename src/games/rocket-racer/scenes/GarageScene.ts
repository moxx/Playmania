import Phaser from 'phaser';
import { sfx } from '../../../core/audio';
import { loadSave, updateSave } from '../../../core/save';
import { restartOnResize, safeInsets, setupUiCamera } from '../../../core/view';
import { Button, iconButton } from '../../../ui/Button';
import { C, txt } from '../../../ui/theme';
import { coinPill } from '../../../ui/widgets';
import { CARS, ROCKET_COSTS, ROCKET_MAX_LEVEL } from '../cars';
import { LEVELS, UPCOMING } from '../levels';
import { Showroom3D } from '../three/Showroom3D';
import { TEX_K } from '../textures';

/** Garage: Auto wählen/kaufen, Rakete verstärken, Level starten. */
export class GarageScene extends Phaser.Scene {
  private idx = 0;
  private showroom: Showroom3D | null = null;
  private stage = { fx: 0.3, fy: 0.45 };

  constructor() {
    super({ key: 'garage' });
  }

  create(): void {
    const v = setupUiCamera(this);
    restartOnResize(this);
    const { W, H } = v;
    const ins = safeInsets(v);
    const L = Math.max(24, ins.left + 12);
    const R = W - Math.max(24, ins.right + 12);
    const save = loadSave();
    if (!this.idx) this.idx = Math.max(0, CARS.findIndex((c) => c.id === save.racer.car));

    this.drawBackground(W, H);

    // Kopfzeile
    iconButton(this, L + 32, 50, 64, '‹', () => this.scene.start('hub'));
    txt(this, L + 80, 50, 'Rocket Racer', 40, { origin: [0, 0.5], stroke: '#24123f', strokeThickness: 8 });
    const pill = coinPill(this, R, 50);

    // ---- Auto-Vitrine (links) ----
    const leftW = W * 0.56;
    const cx = L + (leftW - L) / 2;
    const car = CARS[this.idx];
    const owned = save.racer.ownedCars.includes(car.id);
    const selected = save.racer.car === car.id;

    txt(this, cx, 122, car.name, 38, { stroke: '#24123f', strokeThickness: 8 });
    txt(this, cx, 160, car.desc, 20, { weight: '500', color: '#e6dcff' });

    this.showroom = new Showroom3D();
    this.showroom.setCar(car, owned);
    this.stage = { fx: cx / W, fy: 268 / H };
    this.events.once('shutdown', () => {
      this.showroom?.dispose();
      this.showroom = null;
    });

    const prev = iconButton(this, cx - leftW * 0.42, 280, 72, '◀', () => this.flip(-1), C.panelLight);
    const next = iconButton(this, cx + leftW * 0.42, 280, 72, '▶', () => this.flip(1), C.panelLight);
    prev.setVisible(CARS.length > 1);
    next.setVisible(CARS.length > 1);
    txt(this, cx, 395, `${this.idx + 1} / ${CARS.length}`, 18, { color: '#ffffff99', weight: '600' });

    // Werte
    const stats: [string, number][] = [
      ['Tempo', car.stats.speed],
      ['Power', car.stats.accel],
      ['Grip', car.stats.grip],
    ];
    stats.forEach(([name, val], i) => {
      const y = 438 + i * 36;
      txt(this, cx - 150, y, name, 22, { origin: [0, 0.5], weight: '600' });
      const g = this.add.graphics();
      for (let s = 0; s < 5; s++) {
        g.fillStyle(s < val ? C.yellow : 0x000000, s < val ? 1 : 0.3);
        g.fillRoundedRect(cx - 40 + s * 40, y - 10, 34, 20, 6);
      }
    });

    const by = 580;
    if (selected) {
      new Button(this, cx, by, 280, 72, '✓ Ausgewählt', () => undefined, { color: C.green, textColor: '#ffffff' }).setEnabled(true);
    } else if (owned) {
      new Button(this, cx, by, 280, 72, 'Auswählen', () => {
        updateSave((s) => (s.racer.car = car.id));
        this.scene.restart();
      }, { color: C.yellow });
    } else {
      const can = save.coins >= car.price;
      const b = new Button(
        this,
        cx,
        by,
        280,
        72,
        `Kaufen  ${car.price}`,
        () => {
          updateSave((s) => {
            s.coins -= car.price;
            s.racer.ownedCars.push(car.id);
            s.racer.car = car.id;
          });
          sfx.buy();
          pill.set(loadSave().coins);
          this.time.delayedCall(250, () => this.scene.restart());
        },
        { color: C.orange, icon: 'coin', sound: false },
      );
      b.setEnabled(can);
      if (!can) txt(this, cx, by + 56, `Dir fehlen noch ${car.price - save.coins} Münzen`, 18, { color: '#ffb3bd', weight: '600' });
    }

    // ---- Rechte Spalte: Rakete + Level ----
    const px = leftW + 10;
    const pw = R - px;
    this.panelBox(px, 100, pw, 228);
    txt(this, px + 24, 128, 'Rakete', 30, { origin: [0, 0.5], color: '#ffc928' });
    this.add.image(px + pw - 50, 128, 'rocket').setScale(1.2 / TEX_K);
    this.upgradeRow(px, 186, pw, 'Schub', 'rocketPower', pill.set);
    this.upgradeRow(px, 270, pw, 'Tank', 'rocketTank', pill.set);

    this.panelBox(px, 344, pw, H - 344 - Math.max(20, ins.bottom + 10));
    txt(this, px + 24, 374, 'Level', 30, { origin: [0, 0.5], color: '#ffc928' });
    const lvl = LEVELS[0];
    const rec = save.racer.levels[lvl.id];
    const card = this.add.graphics();
    card.fillStyle(0xa9dcf5, 1);
    card.fillRoundedRect(px + 16, 400, pw - 32, 130, 20);
    card.fillStyle(0xc98b52, 1);
    card.fillRoundedRect(px + 16, 490, pw - 32, 40, { tl: 0, tr: 0, bl: 20, br: 20 });
    txt(this, px + 36, 428, `1  ${lvl.name}`, 28, { origin: [0, 0.5], color: '#24123f' });
    txt(this, px + 36, 462, rec?.done ? `★ ${rec.bestCoins}/${lvl.coins.length} Münzen · ${rec.bestTime?.toFixed(1)} s` : lvl.subtitle, 18, {
      origin: [0, 0.5],
      color: '#24123f',
      weight: '600',
    });
    const play = new Button(this, px + pw - 100, 510, 150, 64, 'LOS ▶', () => this.scene.start('race', { levelId: lvl.id }), { color: C.green, textColor: '#ffffff' });
    this.tweens.add({ targets: play.face, scale: 1.06, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const sw = (pw - 32 - 12) / 2;
    UPCOMING.forEach((u, i) => {
      const x = px + 16 + i * (sw + 12);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.25);
      g.fillRoundedRect(x, 548, sw, 92, 18);
      txt(this, x + sw / 2, 580, `🔒 ${u.name}`, 22, { color: '#ffffffcc' });
      txt(this, x + sw / 2, 612, 'bald', 18, { color: '#ffffff77', weight: '600' });
    });

    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('race', { levelId: lvl.id }));
  }

  update(_t: number, delta: number): void {
    this.showroom?.render(delta / (1000 / 60), this.stage.fx, this.stage.fy);
  }

  private flip(d: number): void {
    this.idx = (this.idx + d + CARS.length) % CARS.length;
    this.scene.restart();
  }

  private panelBox(x: number, y: number, w: number, h: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(x, y + 6, w, h, 26);
    g.fillStyle(C.panel, 0.95);
    g.fillRoundedRect(x, y, w, h, 26);
  }

  private upgradeRow(px: number, y: number, pw: number, label: string, key: 'rocketPower' | 'rocketTank', setCoins: (n: number) => void): void {
    const save = loadSave();
    const lvl = save.racer[key];
    txt(this, px + 24, y - 16, label, 24, { origin: [0, 0.5], weight: '600' });
    const g = this.add.graphics();
    const pipW = Math.min(34, (pw - 230) / ROCKET_MAX_LEVEL - 6);
    for (let i = 0; i < ROCKET_MAX_LEVEL; i++) {
      g.fillStyle(i < lvl ? C.orange : 0x000000, i < lvl ? 1 : 0.3);
      g.fillRoundedRect(px + 24 + i * (pipW + 6), y + 4, pipW, 18, 5);
    }
    if (lvl >= ROCKET_MAX_LEVEL) {
      txt(this, px + pw - 90, y, 'MAX', 26, { color: '#3ddc84' });
      return;
    }
    const cost = ROCKET_COSTS[lvl];
    const b = new Button(
      this,
      px + pw - 90,
      y,
      150,
      58,
      String(cost),
      () => {
        updateSave((s) => {
          s.coins -= cost;
          s.racer[key] += 1;
        });
        sfx.buy();
        setCoins(loadSave().coins);
        this.time.delayedCall(200, () => this.scene.restart());
      },
      { color: C.orange, icon: 'coin', sound: false, fontSize: 26 },
    );
    b.setEnabled(save.coins >= cost);
  }

  private drawBackground(W: number, _H: number): void {
    // Die Garage selbst ist 3D (Showroom3D) – hier nur die Kopfleiste
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3);
    g.fillRect(-100, -100, W + 200, 200);
  }
}
