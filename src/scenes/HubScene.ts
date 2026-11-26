import Phaser from 'phaser';
import { sfx } from '../core/audio';
import { loadSave, updateSave } from '../core/save';
import { restartOnResize, safeInsets, setupUiCamera } from '../core/view';
import { TEX_K } from '../games/rocket-racer/textures';
import { iconButton } from '../ui/Button';
import { C, hex, txt } from '../ui/theme';
import { coinPill, partyBackground } from '../ui/widgets';

interface GameCard {
  title: string;
  subtitle: string;
  color: number;
  scene?: string;
  art: (c: Phaser.GameObjects.Container, w: number, h: number) => void;
}

/** Playmania-Startbildschirm: Auswahl der Mini-Spiele */
export class HubScene extends Phaser.Scene {
  constructor() {
    super({ key: 'hub' });
  }

  create(): void {
    const v = setupUiCamera(this);
    restartOnResize(this);
    const { W, H } = v;
    const ins = safeInsets(v);
    const L = Math.max(24, ins.left + 12);
    const R = W - Math.max(24, ins.right + 12);
    partyBackground(this, W, H, 0x3b1f7a, 0x150a30);

    // Logo
    const title = 'Playmania';
    const cols = [C.yellow, C.pink, C.blue, C.green, C.orange, C.yellow, C.pink, C.blue, C.green];
    const size = 92;
    const letters = [...title].map((ch, i) => txt(this, 0, 0, ch, size, { color: hex(cols[i]), stroke: '#24123f', strokeThickness: 14 }));
    const total = letters.reduce((s, t) => s + t.width * 0.86, 0);
    let x = W / 2 - total / 2;
    letters.forEach((t, i) => {
      t.setPosition(x + t.width * 0.43, 112);
      x += t.width * 0.86;
      this.tweens.add({ targets: t, y: 100, duration: 700, yoyo: true, repeat: -1, delay: i * 90, ease: 'Sine.easeInOut' });
    });
    txt(this, W / 2, 186, 'Wähle ein Spiel', 26, { color: '#d9ccff', weight: '600' });

    // Kopfzeile
    const sound = iconButton(this, L + 32, 44, 60, loadSave().muted ? '🔇' : '🔊', () => {
      const m = !loadSave().muted;
      updateSave((s) => (s.muted = m));
      sfx.unlock();
      sfx.setMuted(m);
      sound.setText(m ? '🔇' : '🔊');
    });
    coinPill(this, R, 44);

    // Spielkarten
    const cards: GameCard[] = [
      {
        title: 'Rocket Racer',
        subtitle: 'Matchbox-Autos mit Raketen!',
        color: C.orange,
        scene: 'garage',
        art: (c, w) => {
          const g = this.add.graphics();
          g.fillStyle(0xa9dcf5, 1);
          g.fillRoundedRect(-w / 2 + 14, -110, w - 28, 150, 18);
          g.fillStyle(0xc98b52, 1);
          g.fillRoundedRect(-w / 2 + 14, 10, w - 28, 30, { tl: 0, tr: 0, bl: 18, br: 18 });
          g.fillStyle(0xd95f00, 1);
          g.fillTriangle(w / 2 - 110, 10, w / 2 - 20, 10, w / 2 - 20, -30);
          c.add(g);
          const k = 1.25 / TEX_K;
          const car = this.add.container(-40, -18);
          car.add(this.add.image(-10 * 1.25, -38 * 1.25, 'rocket').setScale(k));
          car.add(this.add.image(0, 0, 'car-flitzer').setOrigin(0.5, 65 / 110).setScale(k));
          car.add(this.add.image(-36 * 1.25, 12 * 1.25, 'wheel-flitzer').setScale(k));
          car.add(this.add.image(36 * 1.25, 12 * 1.25, 'wheel-flitzer').setScale(k));
          car.setRotation(-0.12);
          c.add(car);
          this.tweens.add({ targets: car, y: -30, rotation: -0.2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          for (let i = 0; i < 4; i++) {
            const f = this.add.image(-118 - i * 14, -28 + i * 3, 'soft').setTint(i < 2 ? 0xffd23f : 0xff6a00).setScale((1.4 - i * 0.2) / TEX_K).setBlendMode(Phaser.BlendModes.ADD);
            c.add(f);
            this.tweens.add({ targets: f, alpha: 0.3, duration: 120 + i * 40, yoyo: true, repeat: -1 });
          }
        },
      },
      {
        title: 'Bald verfügbar',
        subtitle: 'Neues Spiel in Arbeit …',
        color: C.blue,
        art: (c) => {
          c.add(txt(this, 0, -40, '?', 120, { color: '#ffffff55' }));
        },
      },
      {
        title: 'Bald verfügbar',
        subtitle: 'Hast du eine Idee?',
        color: C.pink,
        art: (c) => {
          c.add(txt(this, 0, -40, '?', 120, { color: '#ffffff55' }));
        },
      },
    ];

    const cw = Math.min(380, (R - L - 40) / 3);
    const ch = 380;
    const gap = Math.min(30, (R - L - cw * 3) / 2);
    const startX = W / 2 - (cw * 3 + gap * 2) / 2 + cw / 2;
    cards.forEach((card, i) => {
      const cx = startX + i * (cw + gap);
      const cy = 440;
      const big = i === 0;
      // Äußerer Container = Klickfläche (bleibt unbewegt), innerer = Grafik (darf wackeln)
      const hit = this.add.container(cx, cy);
      const c = this.add.container(0, 0);
      hit.add(c);
      const g = this.add.graphics();
      const dark = Phaser.Display.Color.IntegerToColor(card.color).darken(30).color;
      g.fillStyle(0x000000, 0.35);
      g.fillRoundedRect(-cw / 2, -ch / 2 + 12, cw, ch, 32);
      g.fillStyle(dark, 1);
      g.fillRoundedRect(-cw / 2, -ch / 2 + 6, cw, ch, 32);
      g.fillStyle(big ? card.color : 0x3b2478, 1);
      g.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 32);
      if (!big) {
        g.lineStyle(4, card.color, 0.6);
        g.strokeRoundedRect(-cw / 2 + 6, -ch / 2 + 6, cw - 12, ch - 12, 28);
      }
      c.add(g);
      card.art(c, cw, ch);
      c.add(txt(this, 0, 92, card.title, big ? 38 : 28, { stroke: '#24123f', strokeThickness: big ? 8 : 6, color: big ? '#ffffff' : '#ffffffaa' }));
      c.add(txt(this, 0, 134, card.subtitle, 19, { weight: '600', color: big ? '#3a1d00' : '#ffffff77', wrap: cw - 30 }));
      if (card.scene) {
        hit.setSize(cw, ch);
        hit.setInteractive(new Phaser.Geom.Rectangle(0, 0, cw, ch), Phaser.Geom.Rectangle.Contains);
        if (hit.input) hit.input.cursor = 'pointer';
        let pressed = false;
        hit.on('pointerdown', () => {
          pressed = true;
          c.setScale(0.96);
        });
        hit.on('pointerout', () => {
          pressed = false;
          c.setScale(1);
        });
        hit.on('pointerup', () => {
          c.setScale(1);
          if (!pressed) return;
          pressed = false;
          sfx.unlock();
          sfx.click();
          this.scene.start(card.scene!);
        });
        this.tweens.add({ targets: c, angle: 1.2, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      } else {
        hit.setAlpha(0.8);
      }
    });

    txt(this, W / 2, H - Math.max(18, ins.bottom + 6), `v${__APP_VERSION__}`, 14, { color: '#ffffff44', weight: '500' });
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.start('garage'));
  }
}
