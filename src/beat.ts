// A small Amapiano-style groove made live with Web Audio (no audio files): kick, shaker, log drum and chord stabs.
// Everything runs through a low-pass filter and a volume control, which is what your hand moves.

export type Pattern = { name: string; bpm: number; kick: string; shaker: string; log: (number | null)[]; chords: number[][] };

// 16 steps per bar. "x" plays. Log drum notes are semitones from A1.
export const PATTERNS: Pattern[] = [
  {
    name: "Late night",
    bpm: 112,
    kick: "x...x...x...x...",
    shaker: "..x...x...x...xx",
    log: [0, null, null, 0, null, null, 7, null, null, null, 5, null, 3, null, null, null],
    chords: [
      [57, 60, 64],
      [55, 59, 62],
    ],
  },
  {
    name: "Rooftop",
    bpm: 114,
    kick: "x...x...x...x..x",
    shaker: "x.xxx.xxx.xxx.xx",
    log: [0, null, 0, null, null, 3, null, null, 5, null, null, 7, null, 5, null, 3],
    chords: [
      [53, 57, 60],
      [55, 58, 62],
    ],
  },
  {
    name: "Slow whine",
    bpm: 108,
    kick: "x.......x.......",
    shaker: "....x.......x...",
    log: [0, null, null, null, null, null, 0, null, 10, null, null, 7, null, null, null, null],
    chords: [
      [52, 55, 59],
      [50, 53, 57],
    ],
  },
];

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** Filter cutoff from a 0-1 position, on a log scale so the sweep sounds even. */
export const cutoffFor = (v: number) => 180 * Math.pow(18000 / 180, Math.max(0, Math.min(1, v)));

export class Beat {
  ctx: AudioContext;
  filter: BiquadFilterNode;
  gain: GainNode;
  analyser: AnalyserNode;
  pattern = 0;
  playing = false;
  private step = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private noise: AudioBuffer;
  private song: { el: HTMLAudioElement; node: MediaElementAudioSourceNode } | null = null;

  constructor() {
    this.ctx = new AudioContext();
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 18000;
    this.filter.Q.value = 6;
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.7;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.filter.connect(this.gain).connect(this.analyser).connect(this.ctx.destination);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.2, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v: number) {
    this.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.04);
  }

  setFilter(v: number) {
    this.filter.frequency.setTargetAtTime(cutoffFor(v), this.ctx.currentTime, 0.05);
  }

  /** Plays your own song through the same filter and volume, instead of the built-in beat. */
  useSong(file: File) {
    this.pause();
    if (this.song) {
      this.song.el.pause();
      this.song.node.disconnect();
    }
    const el = new Audio(URL.createObjectURL(file));
    el.loop = true;
    const node = this.ctx.createMediaElementSource(el);
    node.connect(this.filter);
    this.song = { el, node };
  }

  get usingSong() {
    return this.song !== null;
  }

  async play() {
    await this.ctx.resume();
    if (this.playing) return;
    this.playing = true;
    if (this.song) return void this.song.el.play();
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  pause() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.song?.el.pause();
  }

  next(by = 1) {
    this.pattern = (this.pattern + by + PATTERNS.length) % PATTERNS.length;
  }

  close() {
    this.pause();
    this.ctx.close().catch(() => {});
  }

  private schedule() {
    const p = PATTERNS[this.pattern];
    const stepLen = 60 / p.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const s = this.step % 16;
      const t = this.nextTime;
      if (p.kick[s] === "x") this.kick(t);
      if (p.shaker[s] === "x") this.shaker(t, s % 4 === 2 ? 0.35 : 0.18);
      if (p.log[s] !== null) this.logDrum(t, midi(33 + (p.log[s] as number)), stepLen * 2.2);
      if (s === 0 || s === 8) this.chord(t, p.chords[Math.floor(this.step / 16) % p.chords.length], stepLen * 3);
      this.nextTime += stepLen;
      this.step++;
    }
  }

  private kick(t: number) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.filter);
    o.start(t);
    o.stop(t + 0.32);
  }

  private shaker(t: number, level: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    s.connect(hp).connect(g).connect(this.filter);
    s.start(t);
    s.stop(t + 0.07);
  }

  // The log drum: a sine with a pitch dip and a little drive, the sound Amapiano is known for
  private logDrum(t: number, freq: number, len: number) {
    const o = this.ctx.createOscillator();
    const shaper = this.ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(2.2 * x);
    }
    shaper.curve = curve;
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(freq * 1.9, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.04);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(shaper).connect(g).connect(this.filter);
    o.start(t);
    o.stop(t + len + 0.02);
  }

  private chord(t: number, notes: number[], len: number) {
    for (const n of notes) {
      const o = this.ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = midi(n);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + len);
      o.connect(g).connect(this.filter);
      o.start(t);
      o.stop(t + len + 0.02);
    }
  }
}
