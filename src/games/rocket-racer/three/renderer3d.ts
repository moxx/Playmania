import * as THREE from 'three';

/** Ein gemeinsamer WebGL-Renderer hinter dem (transparenten) Phaser-Canvas. */
let renderer: THREE.WebGLRenderer | null = null;
const listeners = new Set<() => void>();

export function getRenderer(): THREE.WebGLRenderer {
  if (renderer) return renderer;
  const canvas = document.createElement('canvas');
  canvas.id = 'three';
  document.body.prepend(canvas);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const onResize = () => {
    renderer!.setSize(window.innerWidth, window.innerHeight, false);
    listeners.forEach((l) => l());
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
  showRenderer(false);
  return renderer;
}

export function onRendererResize(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function showRenderer(v: boolean): void {
  if (renderer) renderer.domElement.style.visibility = v ? 'visible' : 'hidden';
}

export function viewportAspect(): number {
  return window.innerWidth / Math.max(1, window.innerHeight);
}
