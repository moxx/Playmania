import Phaser from 'phaser';
import { carHullPoints, rocketTank, rocketThrust, type CarDef } from './cars';
import { CAR_TEX, TEX_K } from './textures';

type Body = MatterJS.BodyType;

export interface CarInput {
  gas: boolean;
  brake: boolean;
  rocket: boolean;
}

const MAX_SPEED = 28;
/** Luft-Lageregelung */
const AIR_TILT = 0.5;
const AIR_SPRING = 0.0035;
const AIR_DAMP = 0.09;
const AIR_SPIN_MAX = 0.09;

/**
 * Matchbox-Auto: Chassis (konvexe Hülle aus Karosserie + Kabine) und zwei Räder,
 * verbunden über leicht federnde Constraints. Angetrieben wird über die Raddrehung,
 * in der Luft kippt Gas/Bremse das Auto (wie bei Hill-Climb-Spielen).
 */
export class Car {
  readonly chassis: Body;
  readonly wheels: Body[];
  readonly parts: Body[];
  private readonly c: { x: number; y: number };
  private readonly bodyImg: Phaser.GameObjects.Image;
  private readonly wheelImgs: Phaser.GameObjects.Image[];
  private readonly rocketImg: Phaser.GameObjects.Image;
  private readonly rocketLocal: { x: number; y: number };
  private readonly scaleK = 1 / TEX_K;

  /** pro Schritt durch Kollisions-Events gesetzt */
  wheelContact = [false, false];
  chassisContact = false;

  fuel: number;
  readonly fuelMax: number;
  readonly thrust: number;
  rocketOn = false;
  airSteps = 0;

  constructor(
    private scene: Phaser.Scene,
    readonly def: CarDef,
    x: number,
    y: number,
    rocket: { power: number; tank: number },
  ) {
    const M = scene.matter;
    const group = M.world.nextGroup(true);
    const hull = M.vertices.hull(carHullPoints(def).map((p) => ({ x: p.x, y: p.y })) as unknown as MatterJS.Vector[]);
    this.c = M.vertices.centre(hull) as { x: number; y: number };

    this.chassis = M.add.fromVertices(x + this.c.x, y + this.c.y, hull as unknown as object[], {
      label: 'chassis',
      friction: 0.25,
      frictionAir: 0.0005,
      restitution: 0,
      collisionFilter: { group, category: 0x0001, mask: 0xffffffff },
    });
    M.body.setMass(this.chassis, def.mass);

    this.wheels = def.axles.map((ax) => {
      const w = M.add.circle(x + ax, y + def.axleY, def.wheelR, {
        label: 'wheel',
        friction: def.grip,
        frictionStatic: 1.2,
        frictionAir: 0.0005,
        restitution: 0,
        collisionFilter: { group, category: 0x0001, mask: 0xffffffff },
      });
      M.body.setMass(w, def.wheelMass);
      M.add.constraint(this.chassis, w, 0, def.stiffness, {
        pointA: { x: ax - this.c.x, y: def.axleY - this.c.y },
        damping: 0.12,
      });
      return w;
    });
    this.parts = [this.chassis, ...this.wheels];

    // Grafik
    const k = this.scaleK;
    this.rocketLocal =
      def.style === 'pickup'
        ? { x: -def.bodyW / 2 + 34, y: -def.bodyH / 2 - 10 }
        : { x: def.cabBack + (def.cabFront - def.cabBack) * 0.35, y: -def.bodyH / 2 - def.cabH - 8 };
    this.rocketImg = scene.add.image(0, 0, 'rocket').setScale(k).setDepth(29);
    this.bodyImg = scene.add
      .image(0, 0, `car-${def.id}`)
      .setOrigin(0.5, (CAR_TEX.h / 2 + 10) / CAR_TEX.h)
      .setScale(k)
      .setDepth(30);
    this.wheelImgs = this.wheels.map(() => scene.add.image(0, 0, `wheel-${def.id}`).setScale(k).setDepth(31));

    this.fuelMax = rocketTank(rocket.tank);
    this.fuel = this.fuelMax;
    this.thrust = rocketThrust(rocket.power);
    this.sync();
  }

  /** lokaler Punkt (relativ zum Auto-Ursprung) → Welt */
  toWorld(lx: number, ly: number): { x: number; y: number } {
    const a = this.chassis.angle;
    const dx = lx - this.c.x;
    const dy = ly - this.c.y;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return { x: this.chassis.position.x + dx * cos - dy * sin, y: this.chassis.position.y + dx * sin + dy * cos };
  }

  get grounded(): boolean {
    return this.wheelContact[0] || this.wheelContact[1];
  }

  get angle(): number {
    return this.chassis.angle;
  }

  get position(): { x: number; y: number } {
    return this.chassis.position;
  }

  get velocity(): { x: number; y: number } {
    return this.chassis.velocity;
  }

  /** Vorwärtsgeschwindigkeit entlang der Fahrzeugachse */
  get forwardSpeed(): number {
    const v = this.chassis.velocity;
    return v.x * Math.cos(this.chassis.angle) + v.y * Math.sin(this.chassis.angle);
  }

  beginStep(): void {
    this.wheelContact[0] = false;
    this.wheelContact[1] = false;
    this.chassisContact = false;
  }

  /** Kollisionspaar auswerten (aus collisionstart/collisionactive) */
  contact(a: Body, b: Body): void {
    const other = (x: Body, y: Body) => (y.isStatic ? x : null);
    for (const [me, them] of [
      [a, b],
      [b, a],
    ] as const) {
      if (!other(me, them)) continue;
      if (me === this.chassis) this.chassisContact = true;
      else if (me === this.wheels[0]) this.wheelContact[0] = true;
      else if (me === this.wheels[1]) this.wheelContact[1] = true;
    }
  }

  /** Ein Physik-Schritt Steuerung */
  drive(input: CarInput): void {
    const M = this.scene.matter;
    const d = this.def;
    const grounded = this.grounded;
    const fwd = this.forwardSpeed;

    for (const w of this.wheels) {
      let av = w.angularVelocity;
      if (input.gas) {
        if (av < d.maxSpin) av = Math.min(d.maxSpin, av + d.accel);
      } else if (input.brake) {
        if (fwd > 0.8 && av > 0) av *= 0.8;
        else av = Math.max(-d.maxSpin * 0.55, av - d.accel);
      } else {
        av *= grounded ? 0.985 : 0.995;
      }
      M.body.setAngularVelocity(w, av);
    }

    // Luftsteuerung (kinderfreundlich): Das Auto richtet sich selbst aus und folgt grob der Flugbahn.
    // Gas = Nase etwas hoch, Bremse = Nase etwas runter – Saltos aufs Dach passieren so kaum.
    if (!grounded) {
      const v = this.chassis.velocity;
      const travel = Math.atan2(v.y, Math.max(Math.abs(v.x), 3));
      let target = Phaser.Math.Clamp(travel * 0.6, -0.55, 0.6);
      if (input.gas) target -= AIR_TILT;
      if (input.brake) target += AIR_TILT;
      const err = Phaser.Math.Angle.Wrap(target - this.chassis.angle);
      let av = this.chassis.angularVelocity;
      av += err * AIR_SPRING - av * AIR_DAMP;
      av = Phaser.Math.Clamp(av, -AIR_SPIN_MAX, AIR_SPIN_MAX);
      M.body.setAngularVelocity(this.chassis, av);
      this.airSteps++;
    } else {
      this.airSteps = 0;
    }

    // Rakete
    this.rocketOn = input.rocket && this.fuel > 0;
    if (this.rocketOn) {
      this.fuel = Math.max(0, this.fuel - 1);
      const dx = Math.cos(this.chassis.angle) * this.thrust;
      const dy = Math.sin(this.chassis.angle) * this.thrust;
      this.addVelocity(dx, dy);
    } else if (grounded) {
      this.fuel = Math.min(this.fuelMax, this.fuel + 0.45);
    }

    // Tempolimit
    const v = this.chassis.velocity;
    const sp = Math.hypot(v.x, v.y);
    if (sp > MAX_SPEED) {
      const f = MAX_SPEED / sp;
      for (const p of this.parts) M.body.setVelocity(p, { x: p.velocity.x * f, y: p.velocity.y * f });
    }
  }

  addVelocity(dx: number, dy: number): void {
    for (const p of this.parts) this.scene.matter.body.setVelocity(p, { x: p.velocity.x + dx, y: p.velocity.y + dy });
  }

  /** Geschwindigkeit des Chassis auf (vx, vy) setzen; Räder bekommen dieselbe Änderung */
  setVelocity(vx: number, vy: number): void {
    const v = this.chassis.velocity;
    this.addVelocity(vx - v.x, vy - v.y);
  }

  refuel(amount: number): void {
    this.fuel = Math.min(this.fuelMax, this.fuel + amount);
  }

  /** Auto an Position (Ursprung) zurücksetzen, aufrecht und ruhig */
  reset(x: number, y: number): void {
    const M = this.scene.matter;
    M.body.setAngle(this.chassis, 0);
    M.body.setPosition(this.chassis, { x: x + this.c.x, y: y + this.c.y });
    this.def.axles.forEach((ax, i) => {
      const w = this.wheels[i];
      M.body.setPosition(w, { x: x + ax, y: y + this.def.axleY });
      M.body.setAngle(w, 0);
    });
    for (const p of this.parts) {
      M.body.setVelocity(p, { x: 0, y: 0 });
      M.body.setAngularVelocity(p, 0);
    }
    this.fuel = Math.max(this.fuel, this.fuelMax * 0.5);
    this.sync();
  }

  nozzle(): { x: number; y: number } {
    return this.toWorld(this.rocketLocal.x - 31, this.rocketLocal.y);
  }

  sync(): void {
    const o = this.toWorld(0, 0);
    this.bodyImg.setPosition(o.x, o.y).setRotation(this.chassis.angle);
    const r = this.toWorld(this.rocketLocal.x, this.rocketLocal.y);
    this.rocketImg.setPosition(r.x, r.y).setRotation(this.chassis.angle);
    this.wheels.forEach((w, i) => this.wheelImgs[i].setPosition(w.position.x, w.position.y).setRotation(w.angle));
  }

  destroy(): void {
    this.bodyImg.destroy();
    this.rocketImg.destroy();
    this.wheelImgs.forEach((w) => w.destroy());
  }
}
