/** Áudio 100% sintetizado com WebAudio — zero arquivos, zero download. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let engineOsc: OscillatorNode | null = null;
let engineGain: GainNode | null = null;
let boostNoise: AudioBufferSourceNode | null = null;
let boostGain: GainNode | null = null;
let enabled = true;

export function initAudio(): void {
  if (ctx) return;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.32;
  master.connect(ctx.destination);

  // motor: onda serrilhada filtrada
  engineOsc = ctx.createOscillator();
  engineOsc.type = "sawtooth";
  engineOsc.frequency.value = 60;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(lp).connect(engineGain).connect(master);
  engineOsc.start();

  // boost: ruído branco filtrado
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  boostNoise = ctx.createBufferSource();
  boostNoise.buffer = buf;
  boostNoise.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 900;
  bp.Q.value = 0.8;
  boostGain = ctx.createGain();
  boostGain.gain.value = 0;
  boostNoise.connect(bp).connect(boostGain).connect(master);
  boostNoise.start();
}

export function resumeAudio(): void {
  ctx?.resume();
}

export function setMuted(m: boolean): void {
  enabled = !m;
  if (master) master.gain.value = m ? 0 : 0.32;
}

export function isMuted(): boolean {
  return !enabled;
}

/** Motor contínuo em função da velocidade e do throttle. */
export function updateEngine(speed: number, throttle: number, boosting: boolean): void {
  if (!ctx || !engineGain || !engineOsc || !boostGain) return;
  const t = ctx.currentTime;
  const rpm = 55 + (speed / 2300) * 150;
  engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
  engineGain.gain.setTargetAtTime(0.05 + Math.abs(throttle) * 0.09, t, 0.1);
  boostGain.gain.setTargetAtTime(boosting ? 0.13 : 0, t, 0.05);
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  vol: number,
  slideTo?: number,
): void {
  if (!ctx || !master || !enabled) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g).connect(master);
  o.start();
  o.stop(ctx.currentTime + dur + 0.02);
}

function noiseBurst(dur: number, vol: number, freq = 1200): void {
  if (!ctx || !master || !enabled) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  s.connect(f).connect(g).connect(master);
  s.start();
}

export const sfx = {
  ballHit(speed: number) {
    const v = Math.min(1, speed / 3000);
    tone(180 + v * 260, 0.12, "square", 0.05 + v * 0.14, 90);
    noiseBurst(0.1, 0.05 + v * 0.1, 900 + v * 2200);
  },
  bounce(speed: number) {
    const v = Math.min(1, speed / 2500);
    tone(120 + v * 90, 0.1, "sine", 0.03 + v * 0.07, 70);
  },
  jump() {
    tone(320, 0.08, "triangle", 0.05, 520);
  },
  flip() {
    tone(240, 0.14, "triangle", 0.06, 420);
    noiseBurst(0.08, 0.04, 1600);
  },
  pad(big: boolean) {
    tone(big ? 520 : 700, big ? 0.16 : 0.07, "sine", big ? 0.09 : 0.05, big ? 900 : 1000);
  },
  landing(speed: number) {
    noiseBurst(0.09, Math.min(0.12, speed / 6000), 700);
  },
  goal() {
    if (!ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      setTimeout(() => tone(f, 0.4, "sawtooth", 0.1), i * 110);
    });
    noiseBurst(0.6, 0.16, 500);
  },
  demo() {
    noiseBurst(0.35, 0.2, 500);
    tone(90, 0.4, "sawtooth", 0.12, 40);
  },
  countdown(n: number) {
    tone(n === 0 ? 880 : 440, n === 0 ? 0.3 : 0.12, "square", 0.07);
  },
  whistle() {
    tone(1400, 0.25, "square", 0.06, 1200);
  },
};
