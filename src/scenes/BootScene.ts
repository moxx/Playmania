import Phaser from 'phaser';
import { makeRacerTextures } from '../games/rocket-racer/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'boot' });
  }

  create(): void {
    makeRacerTextures(this);
    const start = new URLSearchParams(location.search).get('scene');
    if (start === 'race') this.scene.start('race', { levelId: 'kids-1' });
    else if (start === 'garage') this.scene.start('garage');
    else this.scene.start('hub');
  }
}
