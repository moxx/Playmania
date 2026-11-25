import Phaser from 'phaser';
import { setupUiCamera } from '../core/view';
import { preloadModels } from '../games/rocket-racer/three/assets3d';
import { getRenderer } from '../games/rocket-racer/three/renderer3d';
import { makeRacerTextures } from '../games/rocket-racer/textures';
import { txt } from '../ui/theme';

/** Erzeugt 2D-Texturen und lädt die 3D-Modelle (mit Ladebalken). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'boot' });
  }

  create(): void {
    const { W, H } = setupUiCamera(this);
    this.add.rectangle(W / 2, H / 2, W + 400, H + 400, 0x1b1035);
    makeRacerTextures(this);
    getRenderer();
    txt(this, W / 2, H / 2 - 50, 'Playmania', 72, { color: '#ffc928', stroke: '#24123f', strokeThickness: 12 });
    const bar = this.add.graphics();
    const draw = (f: number) => {
      bar.clear();
      bar.fillStyle(0x000000, 0.35);
      bar.fillRoundedRect(W / 2 - 200, H / 2 + 30, 400, 22, 11);
      bar.fillStyle(0xffc928, 1);
      bar.fillRoundedRect(W / 2 - 198, H / 2 + 32, Math.max(18, 396 * f), 18, 9);
    };
    draw(0);
    void preloadModels(draw).then(() => {
      const start = new URLSearchParams(location.search).get('scene');
      if (start === 'race') this.scene.start('race', { levelId: 'kids-1' });
      else if (start === 'garage') this.scene.start('garage');
      else this.scene.start('hub');
    });
  }
}
