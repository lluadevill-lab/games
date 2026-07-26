/**
 * SoundManager — procedural WebAudio synthesis.
 * No audio assets required: every sound is generated at runtime, which keeps the
 * single-file build small and avoids network/asset loading on mobile.
 */

type OscType = OscillatorType;

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private soundEnabled = true;
  private musicEnabled = true;

  // Continuous "stretch" sound used while aiming the slingshot
  private stretchOsc: OscillatorNode | null = null;
  private stretchGain: GainNode | null = null;

  // Background music sequencer
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicRunning = false;

  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.9;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.masterGain);
    }
    // Browsers suspend the context until a user gesture occurs.
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    if (!enabled) this.stopStretchSound();
  }

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (enabled) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
  }

  /** Core helper: a single enveloped oscillator blip. */
  private blip(
    freq: number,
    duration: number,
    type: OscType = 'sine',
    volume = 0.3,
    freqEnd?: number,
    delay = 0
  ) {
    if (!this.soundEnabled) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.sfxGain) return;

    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
    }

    // Fast attack, exponential decay — punchy arcade feel.
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** Filtered white-noise burst, used for impacts and explosions. */
  private noise(duration: number, volume = 0.3, filterFreq = 1200, delay = 0) {
    if (!this.soundEnabled) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.sfxGain) return;

    const t0 = ctx.currentTime + delay;
    const frameCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t0);
  }

  // =================== SFX ===================

  public playClick() {
    this.blip(660, 0.06, 'square', 0.12);
  }

  public playHook() {
    // Rising "thwip" — the rope catching an anchor.
    this.blip(320, 0.14, 'triangle', 0.28, 880);
    this.noise(0.05, 0.1, 2400);
  }

  public playRelease() {
    this.blip(520, 0.1, 'triangle', 0.16, 220);
  }

  public playLaunch(power = 1) {
    const p = Math.max(0.15, Math.min(1, power));
    this.blip(180 + p * 120, 0.22, 'sawtooth', 0.18 + p * 0.18, 900 + p * 700);
    this.noise(0.12, 0.12 * p, 1800);
  }

  public playBounce() {
    this.blip(220, 0.09, 'square', 0.16, 130);
    this.noise(0.04, 0.08, 900);
  }

  public playCoin() {
    // Classic two-note pickup arpeggio.
    this.blip(988, 0.07, 'square', 0.16);
    this.blip(1319, 0.14, 'square', 0.16, undefined, 0.06);
  }

  public playPortal() {
    this.blip(220, 0.35, 'sine', 0.22, 1400);
    this.blip(330, 0.35, 'sine', 0.14, 1800, 0.04);
  }

  public playDeath() {
    this.blip(300, 0.5, 'sawtooth', 0.3, 60);
    this.noise(0.4, 0.28, 700);
  }

  public playWin() {
    // Ascending major arpeggio.
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => this.blip(n, 0.28, 'triangle', 0.26, undefined, i * 0.1));
  }

  /** Warning pulse — used when a resource runs low or plasma closes in. */
  public playWarning() {
    this.blip(440, 0.12, 'square', 0.2, 330);
  }

  /** Negative feedback for a wasted/blocked action (no hooks left, etc). */
  public playFail() {
    this.blip(200, 0.18, 'square', 0.22, 110);
  }

  /** Reward flourish for a perfect / no-damage clear. */
  public playPerfect() {
    const notes = [659.25, 830.61, 987.77, 1318.51];
    notes.forEach((n, i) => this.blip(n, 0.3, 'triangle', 0.24, undefined, i * 0.08));
  }

  /** Rank-up / milestone sting. */
  public playRankUp() {
    const notes = [392, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => this.blip(n, 0.35, 'square', 0.18, undefined, i * 0.07));
  }

  // =================== STRETCH (continuous) ===================

  public startStretchSound() {
    if (!this.soundEnabled) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.sfxGain || this.stretchOsc) return;

    this.stretchOsc = ctx.createOscillator();
    this.stretchGain = ctx.createGain();

    this.stretchOsc.type = 'sawtooth';
    this.stretchOsc.frequency.value = 120;
    this.stretchGain.gain.value = 0.0001;

    this.stretchOsc.connect(this.stretchGain);
    this.stretchGain.connect(this.sfxGain);
    this.stretchOsc.start();
  }

  /** ratio: 0..1 — how far the slingshot is pulled back. */
  public updateStretchSound(ratio: number) {
    if (!this.ctx || !this.stretchOsc || !this.stretchGain) return;
    const r = Math.max(0, Math.min(1, ratio));
    const now = this.ctx.currentTime;
    this.stretchOsc.frequency.setTargetAtTime(110 + r * 340, now, 0.02);
    this.stretchGain.gain.setTargetAtTime(0.02 + r * 0.1, now, 0.02);
  }

  public stopStretchSound() {
    if (!this.ctx || !this.stretchOsc || !this.stretchGain) return;
    const now = this.ctx.currentTime;
    this.stretchGain.gain.setTargetAtTime(0.0001, now, 0.03);
    const osc = this.stretchOsc;
    try {
      osc.stop(now + 0.15);
    } catch {
      /* already stopped */
    }
    this.stretchOsc = null;
    this.stretchGain = null;
  }

  // =================== MUSIC ===================

  public startMusic() {
    if (!this.musicEnabled || this.musicRunning) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.musicGain) return;

    this.musicRunning = true;
    this.musicStep = 0;

    // Dark synthwave-ish minor loop (A minor pentatonic bass).
    const bass = [110, 110, 164.81, 130.81, 110, 110, 146.83, 130.81];
    const lead = [440, 523.25, 659.25, 523.25, 493.88, 587.33, 659.25, 587.33];

    const tick = () => {
      if (!this.musicRunning || !this.ctx || !this.musicGain) return;
      const t = this.ctx.currentTime;
      const step = this.musicStep % 8;

      // Bass pulse
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      bOsc.type = 'triangle';
      bOsc.frequency.value = bass[step];
      bGain.gain.setValueAtTime(0.0001, t);
      bGain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      bGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      bOsc.connect(bGain);
      bGain.connect(this.musicGain);
      bOsc.start(t);
      bOsc.stop(t + 0.4);

      // Lead arpeggio on alternating steps
      if (step % 2 === 0) {
        const lOsc = this.ctx.createOscillator();
        const lGain = this.ctx.createGain();
        lOsc.type = 'square';
        lOsc.frequency.value = lead[step];
        lGain.gain.setValueAtTime(0.0001, t);
        lGain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
        lGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
        lOsc.connect(lGain);
        lGain.connect(this.musicGain);
        lOsc.start(t);
        lOsc.stop(t + 0.3);
      }

      this.musicStep++;
    };

    tick();
    this.musicTimer = window.setInterval(tick, 360);
  }

  public stopMusic() {
    this.musicRunning = false;
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const soundManager = new SoundManager();
