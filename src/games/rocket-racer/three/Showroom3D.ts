import * as THREE from 'three';
import type { CarDef } from '../cars';
import { Car3D } from './Car3D';
import { getRenderer, showRenderer, viewportAspect } from './renderer3d';

const S = 0.01;

function pegboard(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2f3a5c';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let x = 16; x < 256; x += 32) for (let y = 16; y < 256; y += 32) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 4);
  return t;
}

/** Garage-Vitrine: Auto auf einem Drehteller, Hintergrund Lochwand. */
export class Showroom3D {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  private readonly turntable = new THREE.Group();
  private car: Car3D | null = null;
  private readonly carHolder = new THREE.Group();
  private readonly own: { dispose(): void }[] = [];
  private t = 0;

  constructor() {
    const tex = pegboard();
    const wallMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 12), wallMat);
    wall.position.set(0, 3, -4);
    wall.receiveShadow = true;
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4f, roughness: 0.8 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 12).rotateX(-Math.PI / 2), floorMat);
    floor.position.set(0, -0.12, 1);
    floor.receiveShadow = true;
    const discMat = new THREE.MeshStandardMaterial({ color: 0x7a5ad0, roughness: 0.35, metalness: 0.1 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xffc928, roughness: 0.4 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.2, 0.12, 48), [rimMat, discMat, discMat]);
    disc.position.y = -0.06;
    disc.receiveShadow = true;
    this.turntable.add(disc, this.carHolder);
    this.scene.add(wall, floor, this.turntable);
    this.own.push(tex, wallMat, floorMat, discMat, rimMat, wall.geometry, floor.geometry, disc.geometry);

    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3f4f, 1.6));
    const spot = new THREE.SpotLight(0xfff4e0, 60, 14, 0.6, 0.5, 1.6);
    spot.position.set(1.5, 5, 3.5);
    spot.target.position.set(0, 0, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0005;
    this.scene.add(spot, spot.target);
    const fill = new THREE.DirectionalLight(0x9be7ff, 0.8);
    fill.position.set(-4, 2, 2);
    this.scene.add(fill);
    getRenderer();
    showRenderer(true);
  }

  setCar(def: CarDef, owned: boolean): void {
    this.car?.dispose();
    this.carHolder.clear();
    const holder = new THREE.Group();
    this.carHolder.add(holder);
    this.car = new Car3D(holder, def, S, 0);
    this.car.staticPose();
    holder.position.y = (def.axleY + def.wheelR) * S;
    holder.position.x = -((def.axles[0] + def.axles[1]) / 2) * S;
    // noch nicht gekauft: als dunkle Silhouette zeigen
    if (!owned)
      holder.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((mm) => {
          const c = (mm as THREE.MeshStandardMaterial).clone();
          c.color = new THREE.Color(0x222244);
          c.map = null;
          c.emissive = new THREE.Color(0x111133);
          this.own.push(c);
          return c;
        });
        m.material = Array.isArray(m.material) ? mats : mats[0];
      });
  }

  /** fx/fy: gewünschte Bildschirmposition der Drehteller-Mitte (0..1) */
  render(dt: number, fx: number, fy: number): void {
    this.t += dt / 60;
    this.turntable.rotation.y = -0.6 + Math.sin(this.t * 0.6) * 0.75;
    this.car?.staticPose(this.t * 4);
    const r = getRenderer();
    const size = r.getSize(new THREE.Vector2());
    const cam = this.camera;
    cam.aspect = viewportAspect();
    cam.position.set(0, 1.7, 6.4);
    cam.lookAt(0, 0.35, 0);
    cam.setViewOffset(size.x, size.y, (0.5 - fx) * size.x, (0.5 - fy) * size.y, size.x, size.y);
    cam.updateProjectionMatrix();
    r.render(this.scene, cam);
  }

  dispose(): void {
    showRenderer(false);
    this.car?.dispose();
    this.own.forEach((d) => d.dispose());
    this.scene.clear();
  }
}
