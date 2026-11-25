import Phaser from 'phaser';

/** Virtuelle Höhe: Alle Szenen rechnen mit 720 "Einheiten" Höhe, die Breite ergibt sich aus dem Seitenverhältnis. */
export const VH = 720;

/** Pixel-Dichte (gedeckelt auf 2, damit ältere Geräte flüssig bleiben). */
export const DPR = Math.min(window.devicePixelRatio || 1, 2);

export interface View {
  /** Faktor virtuelle Einheit → Canvas-Pixel */
  s: number;
  /** virtuelle Breite */
  W: number;
  /** virtuelle Höhe (immer VH) */
  H: number;
}

export function getView(scene: Phaser.Scene): View {
  const s = scene.scale.height / VH;
  return { s, W: scene.scale.width / s, H: VH };
}

/** Richtet die Hauptkamera so ein, dass man in virtuellen Koordinaten (0..W, 0..720) layouten kann. */
export function setupUiCamera(scene: Phaser.Scene): View {
  const v = getView(scene);
  const cam = scene.cameras.main;
  cam.setSize(scene.scale.width, scene.scale.height);
  cam.setZoom(v.s);
  cam.centerOn(v.W / 2, v.H / 2);
  return v;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Safe-Area (Notch / Home-Indikator) in virtuellen Einheiten. */
export function safeInsets(view: View): Insets {
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string) => (parseFloat(cs.getPropertyValue(name)) || 0) * DPR / view.s;
  return { top: read('--sat'), right: read('--sar'), bottom: read('--sab'), left: read('--sal') };
}

/** Startet die Szene bei Größen-/Orientierungswechsel neu (für Menü-Szenen am einfachsten). */
export function restartOnResize(scene: Phaser.Scene): void {
  let timer: number | undefined;
  const onResize = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (scene.scene.isActive()) scene.scene.restart();
    }, 120);
  };
  scene.scale.on('resize', onResize);
  scene.events.once('shutdown', () => {
    window.clearTimeout(timer);
    scene.scale.off('resize', onResize);
  });
}
