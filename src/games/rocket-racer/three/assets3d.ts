import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * 3D-Modelle (GLB, generiert mit Higgsfield/Tripo). yaw dreht das Modell so,
 * dass Autos nach +X schauen und Möbel ihre Vorderseite zur Kamera (+Z) zeigen.
 */
export interface ModelSpec {
  file: string;
  yaw: number;
}

export const MODELS: Record<string, ModelSpec> = {
  'car-flitzer': { file: 'models/car-flitzer.glb', yaw: Math.PI / 2 },
  'car-pickup': { file: 'models/car-pickup.glb', yaw: Math.PI / 2 },
  'car-blitz': { file: 'models/car-blitz.glb', yaw: 0 },
  'car-monster': { file: 'models/car-monster.glb', yaw: Math.PI / 2 },
  rocket: { file: 'models/rocket.glb', yaw: -Math.PI / 2 },
  bed: { file: 'models/bed.glb', yaw: 0 },
  shelf: { file: 'models/shelf.glb', yaw: -Math.PI / 2 },
  lamp: { file: 'models/lamp.glb', yaw: 0 },
  chest: { file: 'models/chest.glb', yaw: 0 },
  dino: { file: 'models/dino.glb', yaw: 0 },
  teddy: { file: 'models/teddy.glb', yaw: -Math.PI / 2 },
  desk: { file: 'models/desk.glb', yaw: 0 },
};

const templates = new Map<string, THREE.Object3D>();
let loading: Promise<void> | null = null;

/** Normiert ein Modell: gedreht, zentriert in x/z, Unterkante auf y=0 */
function normalize(obj: THREE.Object3D, yaw: number): THREE.Object3D {
  const inner = new THREE.Group();
  inner.add(obj);
  inner.rotation.y = yaw;
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const c = box.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -box.min.y, -c.z);
  const outer = new THREE.Group();
  outer.add(inner);
  obj.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        const sm = mat as THREE.MeshStandardMaterial;
        // generierte PBR-Materialien sind oft zu metallisch/dunkel für einen Spielzeug-Look
        if (sm.isMeshStandardMaterial) {
          sm.metalness = Math.min(sm.metalness, 0.35);
          sm.envMapIntensity = 1;
        }
      }
    }
  });
  return outer;
}

/** Lädt alle Modelle einmalig. Fehlende Dateien sind ok – dann greifen prozedurale Ersatzformen. */
export function preloadModels(onProgress?: (f: number) => void): Promise<void> {
  if (loading) return loading;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const entries = Object.entries(MODELS);
  let done = 0;
  loading = Promise.all(
    entries.map(([key, spec]) =>
      loader
        .loadAsync(import.meta.env.BASE_URL + spec.file)
        .then((g) => {
          templates.set(key, normalize(g.scene, spec.yaw));
        })
        .catch((e) => console.warn(`[3D] Modell ${key} nicht geladen`, e))
        .finally(() => onProgress?.(++done / entries.length)),
    ),
  ).then(() => undefined);
  return loading;
}

export function hasModel(key: string): boolean {
  return templates.has(key);
}

/** Klon eines Modells (Geometrie/Material geteilt) */
export function getModel(key: string): THREE.Object3D | null {
  const t = templates.get(key);
  return t ? t.clone(true) : null;
}

export function bounds(obj: THREE.Object3D): THREE.Box3 {
  obj.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(obj);
}

/** Skaliert gleichmäßig, sodass die gewählte Achse die Zielgröße hat */
export function fitUniform(obj: THREE.Object3D, axis: 'x' | 'y' | 'z', size: number): number {
  const s0 = obj.scale.x;
  obj.scale.setScalar(1);
  const b = bounds(obj).getSize(new THREE.Vector3());
  const k = size / (b[axis] || 1);
  obj.scale.setScalar(k);
  void s0;
  return k;
}
