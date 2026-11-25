import * as THREE from 'three';
import type { Car } from '../Car';
import type { CarDef } from '../cars';
import { bounds, fitUniform, getModel } from './assets3d';
import { rimTex } from './textures3d';

/** Feinabstimmung pro Auto-Modell: Länge relativ zur Physik, Höhe der Schweller relativ zur Radmitte (in Radradien) */
const FIT: Record<string, { len: number; sill: number; dx: number }> = {
  flitzer: { len: 1.12, sill: -0.15, dx: 0 },
  pickup: { len: 1.1, sill: -0.1, dx: 0 },
  blitz: { len: 1.1, sill: -0.2, dx: 0 },
  monster: { len: 1.15, sill: 0.05, dx: 0 },
};

/** Prozedurales Ersatz-Auto, falls kein Modell geladen ist */
function fallbackBody(def: CarDef, S: number): THREE.Object3D {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.35, metalness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8f5, roughness: 0.1 });
  const lower = new THREE.Mesh(new THREE.BoxGeometry(def.bodyW * S, def.bodyH * S, 0.5), mat);
  lower.position.y = (def.bodyH * S) / 2;
  const cab = new THREE.Mesh(new THREE.BoxGeometry((def.cabFront - def.cabBack) * S, def.cabH * S, 0.44), glass);
  cab.position.set(((def.cabFront + def.cabBack) / 2) * S, def.bodyH * S + (def.cabH * S) / 2, 0);
  g.add(lower, cab);
  g.traverse((m) => ((m as THREE.Mesh).castShadow = true));
  return g;
}

function fallbackRocket(): THREE.Object3D {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.3 });
  const red = new THREE.MeshStandardMaterial({ color: 0xff4d5e, roughness: 0.35 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.42, 16).rotateZ(Math.PI / 2), white);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 16).rotateZ(-Math.PI / 2), red);
  nose.position.x = 0.3;
  g.add(body, nose);
  for (const s of [1, -1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.02), red);
    fin.position.set(-0.16, 0.07 * s, 0);
    g.add(fin);
  }
  g.position.y = 0.08;
  const outer = new THREE.Group();
  outer.add(g);
  return outer;
}

export class Car3D {
  readonly root = new THREE.Group();
  private readonly wheels: { mesh: THREE.Mesh; idx: number; z: number }[] = [];
  private readonly axles: [number, number];
  private readonly axleY: number;
  private readonly rocket: THREE.Object3D;
  private readonly nozzleLocal = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly own: { dispose(): void }[] = [];

  constructor(
    parent: THREE.Object3D,
    def: CarDef,
    private S: number,
    private floorY: number,
  ) {
    this.axles = def.axles;
    this.axleY = def.axleY;
    const fit = FIT[def.id] ?? { len: 1.1, sill: -0.15, dx: 0 };
    const body = getModel(`car-${def.id}`) ?? fallbackBody(def, S);
    fitUniform(body, 'x', def.bodyW * S * fit.len);
    const wheelCenterY = -def.axleY * S;
    body.position.set(((def.axles[0] + def.axles[1]) / 2) * S + fit.dx, wheelCenterY + fit.sill * def.wheelR * S, 0);
    this.root.add(body);
    const bb = bounds(body);
    const depth = bb.max.z - bb.min.z;

    // Rakete aufs Dach
    this.rocket = getModel('rocket') ?? fallbackRocket();
    fitUniform(this.rocket, 'x', 0.62 + def.bodyW * S * 0.05);
    const rx = def.style === 'pickup' ? def.axles[0] * S * 0.55 : ((def.cabBack + def.cabFront) / 2) * S - 0.05;
    this.rocket.position.set(rx, bb.max.y - 0.04, 0);
    this.root.add(this.rocket);
    const rb = bounds(this.rocket);
    this.nozzleLocal.set(rb.min.x + 0.02, (rb.min.y + rb.max.y) / 2, 0);

    // Räder: Reifen + Felge auf beiden Seiten
    const r = def.wheelR * S;
    const w = r * (def.style === 'monster' ? 0.95 : 0.7);
    const geo = new THREE.CylinderGeometry(r, r, w, 28, 1).rotateX(Math.PI / 2);
    const tire = new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.85 });
    const rim = new THREE.MeshStandardMaterial({ map: rimTex(), roughness: 0.35, metalness: 0.4 });
    this.own.push(geo, tire, rim);
    const zSide = Math.max(0.12, depth / 2 - w * 0.45);
    for (let i = 0; i < 2; i++)
      for (const s of [1, -1]) {
        const m = new THREE.Mesh(geo, [tire, rim, rim]);
        m.castShadow = true;
        parent.add(m);
        this.wheels.push({ mesh: m, idx: i, z: zSide * s });
      }
    this.root.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = true;
    });
    parent.add(this.root);
  }

  update(car: Car): void {
    const S = this.S;
    const F = this.floorY;
    const o = car.toWorld(0, 0);
    this.root.position.set(o.x * S, (F - o.y) * S, 0);
    this.root.rotation.z = -car.angle;
    for (const w of this.wheels) {
      const b = car.wheels[w.idx];
      w.mesh.position.set(b.position.x * S, (F - b.position.y) * S, w.z);
      w.mesh.rotation.z = -b.angle;
    }
  }

  /** Standbild (Garage): Auto im Ursprung des Elternobjekts, Räder an den Achsen */
  staticPose(spin = 0): void {
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    for (const w of this.wheels) {
      w.mesh.position.set(this.axles[w.idx] * this.S, -this.axleY * this.S, w.z);
      w.mesh.rotation.z = -spin;
    }
  }

  /** Düsen-Position in Spielkoordinaten (px) */
  nozzle(): { x: number; y: number } {
    this.root.updateMatrixWorld();
    this.tmp.copy(this.nozzleLocal);
    this.root.localToWorld(this.tmp);
    return { x: this.tmp.x / this.S, y: this.floorY - this.tmp.y / this.S };
  }

  dispose(): void {
    for (const w of this.wheels) w.mesh.removeFromParent();
    this.root.removeFromParent();
    this.own.forEach((d) => d.dispose());
  }
}
