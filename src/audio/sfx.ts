/**
 * Procedural sound effects via the Web Audio API — no audio files needed.
 * Each effect is synthesized from oscillators and noise with a short envelope,
 * giving Townstone a gritty, gothic feedback layer that ships as pure code.
 */

const MUTE_KEY = "townstone.muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** Browsers require a user gesture before audio can play — call this on one. */
export function unlockAudio(): void {
  const c = ensure();
  if (c && c.state === "suspended") void c.resume();
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (master) master.gain.value = value ? 0 : 0.5;
}

interface ToneOpts {
  freq: number;
  type?: OscillatorType;
  dur?: number;
  gain?: number;
  /** Glide to this frequency over the duration. */
  to?: number;
  /** Delay before the tone starts, in seconds. */
  delay?: number;
}

function tone({ freq, type = "sine", dur = 0.2, gain = 0.3, to, delay = 0 }: ToneOpts): void {
  const c = ensure();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.2, gain = 0.3, freq = 1200, delay = 0 }: { dur?: number; gain?: number; freq?: number; delay?: number }): void {
  const c = ensure();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + delay;
  const frames = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export const sfx = {
  attack() {
    noise({ dur: 0.12, gain: 0.25, freq: 2400 });
    tone({ freq: 320, to: 110, type: "square", dur: 0.12, gain: 0.18 });
  },
  hit() {
    noise({ dur: 0.18, gain: 0.3, freq: 800 });
    tone({ freq: 150, to: 60, type: "triangle", dur: 0.18, gain: 0.22 });
  },
  summon() {
    tone({ freq: 90, to: 160, type: "sine", dur: 0.18, gain: 0.3 });
    noise({ dur: 0.06, gain: 0.12, freq: 600 });
  },
  spell() {
    tone({ freq: 420, to: 900, type: "sine", dur: 0.25, gain: 0.22 });
    tone({ freq: 660, to: 1320, type: "triangle", dur: 0.25, gain: 0.12, delay: 0.04 });
  },
  death() {
    tone({ freq: 240, to: 50, type: "sawtooth", dur: 0.3, gain: 0.22 });
    noise({ dur: 0.25, gain: 0.18, freq: 400 });
  },
  draw() {
    tone({ freq: 1200, to: 1700, type: "sine", dur: 0.08, gain: 0.14 });
  },
  power() {
    tone({ freq: 523, type: "triangle", dur: 0.18, gain: 0.16 });
    tone({ freq: 784, type: "triangle", dur: 0.2, gain: 0.14, delay: 0.05 });
  },
  secret() {
    tone({ freq: 300, to: 220, type: "sine", dur: 0.4, gain: 0.2 });
  },
  click() {
    tone({ freq: 880, type: "square", dur: 0.04, gain: 0.08 });
  },
  victory() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.35, gain: 0.2, delay: i * 0.12 }));
  },
  defeat() {
    [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, type: "sawtooth", dur: 0.4, gain: 0.2, delay: i * 0.14 }));
  },
};
