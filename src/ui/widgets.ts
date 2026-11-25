import Phaser from 'phaser';
import { loadSave } from '../core/save';
import { TEX_K } from '../games/rocket-racer/textures';
import { txt } from './theme';

/** Münz-Anzeige (oben rechts) */
export function coinPill(scene: Phaser.Scene, rightX: number, y: number): { set: (n: number) => void; bump: () => void } {
  const c = scene.add.container(rightX, y);
  const g = scene.add.graphics();
  const t = txt(scene, -24, 0, String(loadSave().coins), 32, { origin: [1, 0.5] });
  const draw = () => {
    const w = Math.max(150, t.width + 90);
    g.clear();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-w, -28, w, 56, 28);
    icon.x = -w + 30;
  };
  const icon = scene.add.image(0, 0, 'coin').setScale(1.05 / TEX_K);
  c.add([g, icon, t]);
  draw();
  return {
    set: (n: number) => {
      t.setText(String(n));
      draw();
    },
    bump: () => scene.tweens.add({ targets: c, scale: 1.15, duration: 90, yoyo: true }),
  };
}

/** Weicher Verlaufshintergrund mit schwebenden Formen */
export function partyBackground(scene: Phaser.Scene, W: number, H: number, top: number, bottom: number): void {
  const g = scene.add.graphics();
  g.fillGradientStyle(top, top, bottom, bottom, 1);
  g.fillRect(-200, -200, W + 400, H + 400);
  const shapes = scene.add.graphics();
  const cols = [0xffc928, 0xff6ec7, 0x38b6ff, 0x3ddc84, 0xff8a1f];
  let seed = 3;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    shapes.fillStyle(cols[i % cols.length], 0.12);
    const x = r() * W;
    const y = r() * H;
    const s = 12 + r() * 40;
    if (i % 3 === 0) shapes.fillCircle(x, y, s);
    else if (i % 3 === 1) shapes.fillRoundedRect(x, y, s * 1.4, s * 1.4, 8);
    else shapes.fillTriangle(x, y - s, x + s, y + s, x - s, y + s);
  }
  scene.tweens.add({ targets: shapes, y: 14, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}
