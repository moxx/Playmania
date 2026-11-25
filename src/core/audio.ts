import { loadSave } from './save';

/**
 * Kleiner WebAudio-Synth – keine Audio-Dateien nötig.
 * iOS erlaubt Audio erst nach einer Berührung → unlock() hängt an pointerdown.
 */
class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private rocketGain: GainNode | null = null;
  private rocketSrc: AudioBufferSourceNode | null = null;

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = loadSave().muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get muted(): boolean {
    return loadSave().muted;
  }

  setMuted(m: boolean): void {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.02);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  coin(): void {
    this.tone(988, 0.08, 'square', 0.08);
    this.tone(1319, 0.18, 'square', 0.08, 0.07);
  }
  click(): void {
    this.tone(660, 0.06, 'triangle', 0.15);
  }
  boost(): void {
    this.tone(220, 0.45, 'sawtooth', 0.12, 0, 880);
    this.tone(330, 0.4, 'triangle', 0.1, 0.05, 1320);
  }
  ring(): void {
    this.tone(523, 0.12, 'triangle', 0.14);
    this.tone(784, 0.12, 'triangle', 0.14, 0.08);
    this.tone(1046, 0.25, 'triangle', 0.14, 0.16);
  }
  land(): void {
    this.tone(120, 0.12, 'sine', 0.2, 0, 60);
  }
  buy(): void {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.15, 'square', 0.07, i * 0.07));
  }
  error(): void {
    this.tone(200, 0.2, 'square', 0.08, 0, 140);
  }
  finish(): void {
    [523, 659, 784, 1046, 784, 1046, 1319].forEach((f, i) => this.tone(f, 0.22, 'square', 0.07, i * 0.11));
  }
  oops(): void {
    this.tone(440, 0.35, 'triangle', 0.12, 0, 150);
  }

  /** Motor-Brummen + Raketen-Rauschen starten */
  engineStart(): void {
    if (!this.ctx || !this.master || this.engineOsc) return;
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 400;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();

    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.rocketSrc = ctx.createBufferSource();
    this.rocketSrc.buffer = buf;
    this.rocketSrc.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    this.rocketGain = ctx.createGain();
    this.rocketGain.gain.value = 0;
    this.rocketSrc.connect(bp).connect(this.rocketGain).connect(this.master);
    this.rocketSrc.start();
  }

  /** speed: 0..1, rocket an/aus */
  engineUpdate(speed: number, throttle: boolean, rocket: boolean): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.rocketGain || !this.engineFilter) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(50 + speed * 110 + (throttle ? 15 : 0), t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(300 + speed * 900, t, 0.1);
    this.engineGain.gain.setTargetAtTime(throttle ? 0.09 : 0.04, t, 0.1);
    this.rocketGain.gain.setTargetAtTime(rocket ? 0.22 : 0, t, 0.05);
  }

  engineStop(): void {
    try {
      this.engineOsc?.stop();
      this.rocketSrc?.stop();
    } catch {
      /* schon gestoppt */
    }
    this.engineOsc = null;
    this.rocketSrc = null;
    this.engineGain = null;
    this.rocketGain = null;
    this.engineFilter = null;
  }
}

export const sfx = new Synth();
