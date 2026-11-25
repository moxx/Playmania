import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import Phaser from 'phaser';
import { sfx } from './core/audio';
import { DPR } from './core/view';
import { GarageScene } from './games/rocket-racer/scenes/GarageScene';
import { HudScene } from './games/rocket-racer/scenes/HudScene';
import { RaceScene } from './games/rocket-racer/scenes/RaceScene';
import { BootScene } from './scenes/BootScene';
import { HubScene } from './scenes/HubScene';

// iOS: Audio erst nach erster Berührung erlaubt
const unlock = () => sfx.unlock();
window.addEventListener('pointerdown', unlock, { passive: true });
window.addEventListener('touchend', unlock, { passive: true });
// Doppeltipp-Zoom / Kontextmenü unterdrücken
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());

const size = () => ({ w: Math.round(window.innerWidth * DPR), h: Math.round(window.innerHeight * DPR) });

async function boot(): Promise<void> {
  // Schrift laden, bevor Texte gerendert werden (max. 1,5 s warten)
  await Promise.race([
    Promise.all(['500', '600', '700'].map((w) => document.fonts.load(`${w} 32px Fredoka`))),
    new Promise((r) => setTimeout(r, 1500)),
  ]).catch(() => undefined);

  const { w, h } = size();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    // transparent: Darunter liegt der Three.js-Canvas (3D-Welt im Rennen / Garage)
    transparent: true,
    width: w,
    height: h,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / DPR },
    input: { activePointers: 4 },
    render: { antialias: true, powerPreference: 'high-performance' },
    banner: false,
    scene: [BootScene, HubScene, GarageScene, RaceScene, HudScene],
  });

  let t: number | undefined;
  const onResize = () => {
    window.clearTimeout(t);
    t = window.setTimeout(() => {
      const s = size();
      game.scale.resize(s.w, s.h);
    }, 60);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __game: Phaser.Game }).__game = game;
}

void boot();
