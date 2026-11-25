import Phaser from 'phaser';
import { sfx } from '../../../core/audio';
import { loadSave, updateSave } from '../../../core/save';
import { getView } from '../../../core/view';
import { Car, type CarInput } from '../Car';
import { carById } from '../cars';
import { Fx } from '../Fx';
import { LevelBuilder, type BuiltLevel } from '../LevelBuilder';
import { levelById } from '../levels';
import type { LevelDef } from '../levels/types';
import { GRAVITY_Y, STEP_MS } from '../physics';
import type { HudScene } from './HudScene';

export interface RaceResult {
  coins: number;
  total: number;
  time: number;
  bonus: number;
  firstClear: boolean;
  newBestTime: boolean;
}

type State = 'countdown' | 'run' | 'finish';

const RING_KICK = { vx: 15, vy: -6 };
/** etwas näher ran als die 720er-Basis, damit das Matchbox-Auto auf dem Handy gut sichtbar ist */
const CAM_ZOOM = 1.12;

export class RaceScene extends Phaser.Scene {
  level!: LevelDef;
  car!: Car;
  private built!: BuiltLevel;
  private fx!: Fx;

  /** Touch-Steuerung (vom HUD gesetzt) */
  touch: CarInput = { gas: false, brake: false, rocket: false };
  /** Für Tests/Autopilot */
  forced: Partial<CarInput> | null = null;
  input2: CarInput = { gas: false, brake: false, rocket: false };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  state: State = 'countdown';
  paused = false;
  private acc = 0;
  steps = 0;
  coins = 0;
  private flipTimer = 0;
  private checkpoint = { x: 0, y: 0 };
  private camX = 0;
  private camY = 0;
  private zoom = 1;
  private countdown = 0;
  private wasGrounded = true;

  constructor() {
    super({
      key: 'race',
      physics: {
        default: 'matter',
        matter: {
          gravity: { x: 0, y: GRAVITY_Y },
          autoUpdate: false,
          positionIterations: 10,
          velocityIterations: 8,
          constraintIterations: 4,
          enableSleeping: false,
          debug: false,
        },
      },
    });
  }

  init(data: { levelId?: string }): void {
    this.level = levelById(data.levelId ?? 'kids-1');
    this.state = 'countdown';
    this.paused = false;
    this.acc = 0;
    this.steps = 0;
    this.coins = 0;
    this.flipTimer = 0;
    this.countdown = 0;
    this.touch = { gas: false, brake: false, rocket: false };
  }

  create(): void {
    const L = this.level;
    const save = loadSave();
    this.cameras.main.setBackgroundColor('#a9dcf5');
    this.built = new LevelBuilder(this, L).build();
    this.fx = new Fx(this, 28);

    const def = carById(save.racer.car);
    const startY = L.floorY - def.axleY - def.wheelR - 2;
    this.car = new Car(this, def, L.startX, startY, { power: save.racer.rocketPower, tank: save.racer.rocketTank });
    this.checkpoint = { x: L.startX, y: startY };

    // Kollisionen → Bodenkontakt
    const onPairs = (e: { pairs: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[] }) => {
      for (const p of e.pairs) this.car.contact(p.bodyA, p.bodyB);
    };
    this.matter.world.on('collisionstart', onPairs);
    this.matter.world.on('collisionactive', onPairs);

    // Kamera
    const v = getView(this);
    this.zoom = v.s * CAM_ZOOM;
    this.camX = L.startX + 300;
    this.camY = L.floorY - 250;
    this.updateCamera(1, true);

    // Tastatur (Desktop)
    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys('RIGHT,LEFT,UP,DOWN,SPACE,D,A,W,S,R,ESC,P') as Record<string, Phaser.Input.Keyboard.Key>;
      this.input.keyboard.on('keydown-R', () => this.respawn(false));
      this.input.keyboard.on('keydown-ESC', () => this.togglePause());
      this.input.keyboard.on('keydown-P', () => this.togglePause());
    }

    this.scale.on('resize', this.onResize, this);
    const onHidden = () => {
      if (this.state !== 'finish') this.setPaused(true);
    };
    this.game.events.on('hidden', onHidden);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      this.game.events.off('hidden', onHidden);
      sfx.engineStop();
    });

    sfx.engineStart();
    this.scene.launch('hud');
    this.scene.bringToTop('hud');

    if (new URLSearchParams(location.search).has('debug')) {
      (window as unknown as { __race: RaceScene }).__race = this;
    }
  }

  get hud(): HudScene {
    return this.scene.get('hud') as HudScene;
  }

  private onResize(): void {
    this.cameras.main.setSize(this.scale.width, this.scale.height);
    this.zoom = getView(this).s * CAM_ZOOM;
  }

  togglePause(): void {
    if (this.state === 'finish') return;
    this.setPaused(!this.paused);
  }

  setPaused(p: boolean): void {
    this.paused = p;
    sfx.engineUpdate(0, false, false);
    this.hud.showPause(p);
  }

  private readInput(): CarInput {
    const k = this.keys;
    const kb = {
      gas: !!k && (k.RIGHT.isDown || k.D.isDown),
      brake: !!k && (k.LEFT.isDown || k.A.isDown || k.DOWN.isDown || k.S.isDown),
      rocket: !!k && (k.SPACE.isDown || k.UP.isDown || k.W.isDown),
    };
    const i: CarInput = {
      gas: kb.gas || this.touch.gas,
      brake: kb.brake || this.touch.brake,
      rocket: kb.rocket || this.touch.rocket,
    };
    if (this.forced) Object.assign(i, this.forced);
    if (this.state !== 'run') return { gas: false, brake: this.state === 'finish', rocket: false };
    return i;
  }

  update(_time: number, delta: number): void {
    if (this.paused) return;
    this.acc += Math.min(delta, 100);
    let n = 0;
    while (this.acc >= STEP_MS && n < 5) {
      this.fixedStep();
      this.acc -= STEP_MS;
      n++;
    }
    if (n === 5) this.acc = 0;
    const dt = delta / STEP_MS;
    this.car.sync();
    this.fx.update(dt);
    this.updateCamera(dt);
    this.animate(_time);
    const sp = Math.min(1, Math.abs(this.car.forwardSpeed) / 14);
    sfx.engineUpdate(sp, this.input2.gas, this.car.rocketOn);
  }

  private fixedStep(): void {
    const car = this.car;
    if (this.state === 'countdown') {
      this.countdown++;
      const c = this.countdown;
      if (c === 1) this.hud.countdown('3');
      if (c === 36) this.hud.countdown('2');
      if (c === 72) this.hud.countdown('1');
      if (c === 108) {
        this.hud.countdown('LOS!');
        this.state = 'run';
      }
    }
    const input = this.readInput();
    this.input2 = input;
    car.drive(input);
    car.beginStep();
    this.matter.world.step(STEP_MS);
    if (this.state === 'run') this.steps++;

    // Landung
    if (car.grounded && !this.wasGrounded && car.airSteps > 15) {
      sfx.land();
      const p = car.position;
      this.fx.burst(p.x, p.y + 30, 8, { tint: 0xe8d5b5, s0: 0.9, s1: 1.6, life: 26, speed: 2.5, alpha: 0.7, vy: -0.5 });
    }
    this.wasGrounded = car.grounded;

    this.checkCoins();
    this.checkBoosts();
    this.checkRings();
    this.checkFlip();
    this.rocketFx();

    if (this.state === 'run' && car.position.x >= this.level.finishX) this.finish();
  }

  private checkCoins(): void {
    if (this.state === 'finish') return;
    const parts = this.car.parts;
    const px = this.car.position.x;
    for (const c of this.built.coins) {
      if (c.taken || Math.abs(c.x - px) > 160) continue;
      for (const p of parts) {
        const dx = p.position.x - c.x;
        const dy = p.position.y - c.y;
        if (dx * dx + dy * dy < 42 * 42) {
          c.taken = true;
          this.coins++;
          sfx.coin();
          this.fx.burst(c.x, c.y, 6, { tex: 'star', tint: 0xffe066, s0: 1.4, s1: 0.2, life: 22, speed: 3, add: true });
          this.tweens.add({ targets: c.img, y: c.y - 40, alpha: 0, scale: c.img.scale * 1.6, duration: 260, onComplete: () => c.img.setVisible(false) });
          break;
        }
      }
    }
  }

  private checkBoosts(): void {
    const p = this.car.position;
    const v = this.car.velocity;
    for (const b of this.built.boosts) {
      if (b.cd > 0) {
        b.cd--;
        continue;
      }
      const dir = b.ramp.dir;
      const inX = dir === 1 ? p.x > b.lipX - 55 && p.x < b.lipX + 25 : p.x < b.lipX + 55 && p.x > b.lipX - 25;
      const inY = p.y > b.lipY - 120 && p.y < b.lipY + 10;
      if (inX && inY && v.x * dir > 0.3) {
        const a = b.ramp.angle ?? 0.62;
        const speed = Math.max(b.ramp.boost, Math.hypot(v.x, v.y));
        this.car.setVelocity(Math.cos(a) * speed * dir, -Math.sin(a) * speed);
        this.car.refuel(this.car.fuelMax * 0.25);
        b.cd = 60;
        sfx.boost();
        this.cameras.main.shake(160, 0.004);
        this.fx.burst(b.lipX, b.lipY, 18, { tex: 'star', tint: 0xfff36b, s0: 1.6, s1: 0.2, life: 30, speed: 6, add: true });
        this.hud.toast('BOOST!', '#fff36b');
      }
    }
  }

  private checkRings(): void {
    const p = this.car.position;
    const v = this.car.velocity;
    for (const r of this.built.rings) {
      if (r.cd > 0) {
        r.cd--;
        continue;
      }
      const dx = p.x - r.x;
      const dy = p.y - r.y;
      if (dx * dx + dy * dy < 75 * 75) {
        this.car.setVelocity(Math.max(v.x, RING_KICK.vx), Math.min(v.y, RING_KICK.vy));
        this.car.refuel(this.car.fuelMax * 0.5);
        r.cd = 90;
        sfx.ring();
        this.fx.burst(r.x, r.y, 24, { tex: 'star', tint: 0x9be7ff, s0: 1.5, s1: 0.2, life: 34, speed: 7, add: true });
        this.tweens.add({ targets: r.img, scale: r.img.scale * 1.35, duration: 140, yoyo: true });
        this.hud.toast('SUPER!', '#9be7ff');
      }
    }
  }

  private checkFlip(): void {
    const car = this.car;
    if (this.state !== 'run') return;
    const up = Math.cos(car.angle);
    const p = car.position;
    // Kontrollpunkt merken, wenn das Auto sauber auf allen Rädern steht
    if (this.steps % 30 === 0 && car.wheelContact[0] && car.wheelContact[1] && up > 0.9) {
      this.checkpoint = { x: p.x - (car.def.axles[0] + car.def.axles[1]) / 2, y: p.y - 6 };
    }
    const stuck = up < -0.1 && (car.chassisContact || Math.hypot(car.velocity.x, car.velocity.y) < 1.5);
    this.flipTimer = stuck ? this.flipTimer + 1 : 0;
    if (this.flipTimer > 100 || p.y > this.level.floorY + 400) this.respawn(true);
  }

  respawn(oops: boolean): void {
    if (this.state === 'finish') return;
    this.flipTimer = 0;
    const cp = this.checkpoint;
    this.car.reset(cp.x, cp.y - 20);
    if (oops) {
      sfx.oops();
      this.hud.toast('Hoppla!', '#ffffff');
    }
  }

  private rocketFx(): void {
    const car = this.car;
    if (!car.rocketOn) return;
    const n = car.nozzle();
    const a = car.angle + Math.PI;
    for (let i = 0; i < 2; i++) {
      const spread = (Math.random() - 0.5) * 0.5;
      const sp = 5 + Math.random() * 3;
      this.fx.spawn(n.x, n.y, {
        vx: Math.cos(a + spread) * sp + car.velocity.x * 0.6,
        vy: Math.sin(a + spread) * sp + car.velocity.y * 0.6,
        life: 16 + Math.random() * 8,
        s0: 1.3,
        s1: 0.2,
        tint: i ? 0xffd23f : 0xff6a00,
        add: true,
        drag: 0.9,
      });
    }
    if (Math.random() < 0.4)
      this.fx.spawn(n.x, n.y, { vx: Math.cos(a) * 2 + car.velocity.x * 0.3, vy: Math.sin(a) * 2 - 0.4, life: 40, s0: 1, s1: 2.6, tint: 0xbfbfbf, alpha: 0.45, drag: 0.95 });
  }

  private finish(): void {
    this.state = 'finish';
    const L = this.level;
    const time = this.steps / 60;
    let firstClear = false;
    let newBestTime = false;
    let bonus = 0;
    updateSave((s) => {
      const rec = s.racer.levels[L.id] ?? { done: false, bestCoins: 0, bestTime: null };
      firstClear = !rec.done;
      bonus = firstClear ? 25 : 10;
      newBestTime = rec.bestTime === null || time < rec.bestTime;
      s.racer.levels[L.id] = {
        done: true,
        bestCoins: Math.max(rec.bestCoins, this.coins),
        bestTime: newBestTime ? time : rec.bestTime,
      };
      s.coins += this.coins + bonus;
    });
    sfx.finish();
    const p = this.car.position;
    for (let i = 0; i < 70; i++) {
      this.fx.spawn(p.x + (Math.random() - 0.5) * 500, p.y - 380 - Math.random() * 120, {
        tex: 'confetti',
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 2,
        gravity: 0.08,
        drag: 0.99,
        life: 120 + Math.random() * 60,
        s0: 3,
        s1: 3,
        spin: (Math.random() - 0.5) * 0.3,
        tint: [0xff4d5e, 0xffc928, 0x3ddc84, 0x38b6ff, 0xff6ec7][i % 5],
      });
    }
    const result: RaceResult = { coins: this.coins, total: L.coins.length, time, bonus, firstClear, newBestTime };
    this.time.delayedCall(1300, () => this.hud.showResult(result));
  }

  private animate(time: number): void {
    const t = time * 0.004;
    const k = this.built.coins[0]?.img.scaleY ?? 1;
    for (const c of this.built.coins) {
      if (!c.taken) c.img.scaleX = k * (0.25 + 0.75 * Math.abs(Math.cos(t + c.x * 0.01)));
    }
    for (const r of this.built.rings) {
      r.glow.setAlpha(0.25 + 0.15 * Math.sin(time * 0.006));
      r.img.rotation = Math.sin(time * 0.003) * 0.1;
    }
  }

  private updateCamera(dt: number, snap = false): void {
    const cam = this.cameras.main;
    const L = this.level;
    const p = this.car.position;
    const v = this.car.velocity;
    const base = getView(this).s * CAM_ZOOM;
    // Hoch in der Luft → etwas rauszoomen, damit man die Landung sieht
    const height = Phaser.Math.Clamp((L.floorY - p.y - 260) / 600, 0, 1);
    const targetZoom = base * (1 - 0.24 * height);
    const lerp = (a: number, b: number, f: number) => a + (b - a) * (snap ? 1 : 1 - Math.pow(1 - f, dt));
    this.zoom = lerp(this.zoom, targetZoom, 0.04);
    cam.setZoom(this.zoom);
    const viewW = cam.width / this.zoom;
    const viewH = cam.height / this.zoom;
    const tx = p.x + viewW * 0.14 + Phaser.Math.Clamp(v.x * 12, -120, 220);
    const ty = p.y - 60 + Phaser.Math.Clamp(v.y * 6, -60, 120);
    this.camX = lerp(this.camX, tx, 0.1);
    this.camY = lerp(this.camY, ty, 0.12);
    this.camX = Phaser.Math.Clamp(this.camX, viewW / 2 - 260, L.endX + 500 - viewW / 2);
    this.camY = Phaser.Math.Clamp(this.camY, -1400 + viewH / 2, L.floorY + 110 - viewH / 2);
    cam.centerOn(this.camX, this.camY);

    // Hintergrund mitführen (Parallax)
    const left = this.camX - viewW / 2;
    const top = this.camY - viewH / 2;
    const b = this.built;
    b.wall.setPosition(left - 2, top - 2);
    if (b.wall.width < viewW + 4 || b.wall.height < viewH + 4) b.wall.setSize(viewW + 200, viewH + 200);
    b.wall.tilePositionX = left * 0.6;
    b.wall.tilePositionY = top;
    b.skirting.setX(left - 2);
    if (b.skirting.width < viewW + 4) b.skirting.setSize(viewW + 200, 48);
    b.skirting.tilePositionX = left * 0.6;
    b.decor.x = left * 0.4;
    // Culling der Level-Grafik
    const margin = 700;
    for (const c of b.chunks) c.g.setVisible(c.x1 + margin > left && c.x0 - margin < left + viewW);
  }
}
