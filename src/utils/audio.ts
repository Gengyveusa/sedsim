/**
 * AudioManager — Web Audio API sound system for SedSim.
 *
 * Features:
 *  • SpO2 pitch-mapped pulse tone (one beep per heartbeat, pitch drops with saturation)
 *  • Warning alarm: two-tone beep (440 Hz → 880 Hz), every 3 seconds
 *  • Critical alarm: fast 880 Hz beep, every 200 ms (100 ms on / 100 ms off)
 *  • Breath sounds: clinically realistic two-phase vesicular breathing with
 *    pink-noise spectrum; snoring with amplitude-modulated vibration;
 *    stridor with tonal harmonics; wheeze for bronchospasm
 *  • Heart sounds: S1/S2 click pair at HR interval
 *  • Precordial stethoscope mode: full volume when placed, ambient (0.02) when removed
 *  • Master mute / volume
 *  • 60-second alarm silence (like real monitors)
 */

/** Map SpO2 percentage to oscillator frequency (Hz). */
function spo2ToFrequency(spo2: number): number {
  if (spo2 >= 100) return 880;
  if (spo2 >= 90) return 660 + ((spo2 - 90) / 10) * 220; // 660–880 Hz
  if (spo2 >= 80) return 440 + ((spo2 - 80) / 10) * 220; // 440–660 Hz
  if (spo2 >= 70) return 330 + ((spo2 - 70) / 10) * 110; // 330–440 Hz
  return 250; // below 70 % stays low
}

/**
 * Play a single sine-wave beep with a 5 ms attack/release envelope
 * to prevent audible clicks.
 */
function scheduleBeep(
  ctx: AudioContext,
  masterGain: GainNode,
  frequency: number,
  durationSec: number,
  startTime: number,
): void {
  const osc = ctx.createOscillator();
  const envGain = ctx.createGain();
  const RAMP = 0.005; // 5 ms ramp

  osc.type = 'sine';
  osc.frequency.value = frequency;

  envGain.gain.setValueAtTime(0, startTime);
  envGain.gain.linearRampToValueAtTime(1, startTime + RAMP);
  envGain.gain.setValueAtTime(1, startTime + durationSec - RAMP);
  envGain.gain.linearRampToValueAtTime(0, startTime + durationSec);

  osc.connect(envGain);
  envGain.connect(masterGain);

  osc.start(startTime);
  osc.stop(startTime + durationSec);
}

/**
 * Generate a pink noise buffer (−3 dB/octave roll-off) using the
 * Voss-McCartney approximation with 16 octave rows. Much more natural
 * than white noise for respiratory sounds.
 */
function createPinkNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  // Voss-McCartney pink noise: 16 rows of random values
  const numRows = 16;
  const rows = new Float32Array(numRows);
  let runningSum = 0;

  // Initialise rows
  for (let r = 0; r < numRows; r++) {
    rows[r] = (Math.random() * 2 - 1);
    runningSum += rows[r];
  }

  for (let i = 0; i < length; i++) {
    // Determine which row to replace based on trailing zeros of index
    const idx = i === 0 ? 0 : Math.min(numRows - 1, ctz(i));
    runningSum -= rows[idx];
    rows[idx] = (Math.random() * 2 - 1);
    runningSum += rows[idx];
    // Normalise by numRows and add a small white noise component for high-freq detail
    data[i] = (runningSum / numRows) * 0.7 + (Math.random() * 2 - 1) * 0.3;
  }

  return buffer;
}

/** Count trailing zeros (for pink noise generator). */
function ctz(n: number): number {
  if (n === 0) return 32;
  let count = 0;
  while ((n & 1) === 0) {
    count++;
    n >>= 1;
  }
  return count;
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.5;

  // Stethoscope state — controls breath/heart volume
  private stethoscopeActive: boolean = false;
  private stethoscopeGain: GainNode | null = null;

  // SpO2 pulse-tone state
  private spo2Timer: ReturnType<typeof setTimeout> | null = null;
  private spo2Active: boolean = false;
  private _spo2: number = 98;
  private _hr: number = 75;

  // Alarm state
  private alarmTimer: ReturnType<typeof setTimeout> | null = null;
  private alarmType: 'none' | 'warning' | 'critical' = 'none';
  private silencedUntil: number = 0;

  // Breath sound state
  private breathEnabled: boolean = false;
  private breathTimer: ReturnType<typeof setTimeout> | null = null;
  private breathActive: boolean = false;
  private _rr: number = 14;
  private _moass: number = 3;
  private _airwayPatency: number = 1.0; // 0 = occluded, 1 = patent

  // Heart sound state
  private heartEnabled: boolean = false;
  private heartTimer: ReturnType<typeof setTimeout> | null = null;
  private heartActive: boolean = false;
  private _hrForHeart: number = 75;
  private _sbp: number = 120;

  /**
   * Lazy-initialise the AudioContext on the first user gesture.
   * Must be called from a click/keydown handler (browser autoplay policy).
   */
  init(): void {
    if (this.ctx) {
      // Resume if the context was suspended by the browser
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {/* ignore */});
      }
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);

      // Stethoscope gain node: sits between breath/heart sources and master
      this.stethoscopeGain = this.ctx.createGain();
      this.stethoscopeGain.gain.value = this.stethoscopeActive ? 1.0 : 0.02;
      this.stethoscopeGain.connect(this.masterGain);
    } catch (e) {
      console.warn('[AudioManager] AudioContext init failed', e);
    }
  }

  // ─── Stethoscope ────────────────────────────────────────────────────────────

  /**
   * Toggle the precordial stethoscope. When active, breath and heart sounds
   * play at full volume through the stethoscope gain node. When inactive,
   * they play at ambient level (0.02).
   */
  setStethoscopeActive(active: boolean): void {
    this.stethoscopeActive = active;
    if (this.stethoscopeGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.stethoscopeGain.gain.cancelScheduledValues(now);
      this.stethoscopeGain.gain.setValueAtTime(
        this.stethoscopeGain.gain.value,
        now,
      );
      this.stethoscopeGain.gain.linearRampToValueAtTime(
        active ? 1.0 : 0.02,
        now + 0.1, // 100 ms crossfade
      );
    }
  }

  getStethoscopeActive(): boolean {
    return this.stethoscopeActive;
  }

  // ─── SpO2 pulse tone ──────────────────────────────────────────────────────

  /**
   * Update the SpO2 / HR values used for the pulse tone and start the loop
   * if it is not already running.  Call this on every vitals update while
   * the simulation is running.
   */
  updateSpO2Tone(spo2: number, hr: number): void {
    this._spo2 = spo2;
    this._hr = Math.max(10, hr); // guard against 0-division
    if (!this.spo2Active) {
      this.spo2Active = true;
      this._tickSpO2();
    }
  }

  private _tickSpO2(): void {
    if (!this.spo2Active || !this.ctx || !this.masterGain) return;

    if (!this.isMuted && this.ctx.state === 'running') {
      scheduleBeep(
        this.ctx,
        this.masterGain,
        spo2ToFrequency(this._spo2),
        0.065, // 65 ms beep
        this.ctx.currentTime,
      );
    }

    const intervalMs = 60000 / this._hr; // one beep per heartbeat
    this.spo2Timer = setTimeout(() => this._tickSpO2(), intervalMs);
  }

  // ─── Alarms ─────────────────────────────────────────────────────────────────

  /** Start the warning alarm loop (two-tone, every 3 s). No-op if already active. */
  playWarningAlarm(): void {
    if (this.alarmType === 'warning') return;
    this._clearAlarmTimer();
    this.alarmType = 'warning';
    this._tickWarning();
  }

  private _tickWarning(): void {
    if (this.alarmType !== 'warning' || !this.ctx || !this.masterGain) return;

    if (!this.isMuted && Date.now() > this.silencedUntil && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      scheduleBeep(this.ctx, this.masterGain, 440, 0.2, now);
      scheduleBeep(this.ctx, this.masterGain, 880, 0.2, now + 0.25);
    }

    this.alarmTimer = setTimeout(() => this._tickWarning(), 3000);
  }

  /** Start the critical alarm loop (fast 880 Hz beeps). No-op if already active. */
  playCriticalAlarm(): void {
    if (this.alarmType === 'critical') return;
    this._clearAlarmTimer();
    this.alarmType = 'critical';
    this._tickCritical();
  }

  private _tickCritical(): void {
    if (this.alarmType !== 'critical' || !this.ctx || !this.masterGain) return;

    if (!this.isMuted && Date.now() > this.silencedUntil && this.ctx.state === 'running') {
      scheduleBeep(this.ctx, this.masterGain, 880, 0.1, this.ctx.currentTime);
    }

    this.alarmTimer = setTimeout(() => this._tickCritical(), 200); // 100 ms on + 100 ms off
  }

  /** Stop all alarm loops. */
  stopAlarms(): void {
    this.alarmType = 'none';
    this._clearAlarmTimer();
  }

  /**
   * Silence alarm audio for the given duration (SpO2 pulse tone continues).
   * Mirrors the 60-second silence feature on real monitors.
   */
  silenceAlarms(durationMs: number): void {
    this.silencedUntil = Date.now() + durationMs;
  }

  /** Milliseconds remaining on current alarm silence (0 if not silenced). */
  getSilenceRemaining(): number {
    return Math.max(0, this.silencedUntil - Date.now());
  }

  /** Stop the SpO2 pulse tone and all alarms (call on Pause / Reset). */
  stopAll(): void {
    this.spo2Active = false;
    if (this.spo2Timer !== null) {
      clearTimeout(this.spo2Timer);
      this.spo2Timer = null;
    }
    this.stopAlarms();
    // Stop breath and heart sounds
    this.breathActive = false;
    if (this.breathTimer !== null) { clearTimeout(this.breathTimer); this.breathTimer = null; }
    this.heartActive = false;
    if (this.heartTimer !== null) { clearTimeout(this.heartTimer); this.heartTimer = null; }
  }

  // ─── Breath sounds ──────────────────────────────────────────────────────────

  /**
   * Update breath-sound parameters. Starts the loop if breath sounds are enabled
   * and not already running.
   * @param rr  Respiratory rate (breaths/min)
   * @param moass  MOASS level (0–5); ≤3 may trigger snoring
   * @param airwayPatency  0 = occluded (laryngospasm), 1 = patent
   */
  updateBreathSounds(rr: number, moass: number, airwayPatency: number): void {
    this._rr = Math.max(0, rr);
    this._moass = moass;
    this._airwayPatency = Math.max(0, Math.min(1, airwayPatency));
    if (this.breathEnabled && !this.breathActive) {
      this.breathActive = true;
      this._tickBreath();
    }
  }

  setBreathSoundsEnabled(enabled: boolean): void {
    this.breathEnabled = enabled;
    if (!enabled) {
      this.breathActive = false;
      if (this.breathTimer !== null) { clearTimeout(this.breathTimer); this.breathTimer = null; }
    } else if (!this.breathActive) {
      this.breathActive = true;
      this._tickBreath();
    }
  }

  private _tickBreath(): void {
    if (!this.breathActive || !this.breathEnabled || !this.ctx || !this.stethoscopeGain) return;

    const rr = this._rr;
    // Apnea — no sound
    if (rr <= 0) {
      const nextMs = 2000;
      this.breathTimer = setTimeout(() => this._tickBreath(), nextMs);
      return;
    }

    const breathPeriodMs = 60000 / rr;

    if (!this.isMuted && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      const cycleDuration = breathPeriodMs / 1000;

      if (this._airwayPatency < 0.3) {
        // Laryngospasm / severe obstruction — stridor
        const inspirDur = Math.min(1.5, cycleDuration * 0.4);
        this._scheduleStridor(now, inspirDur);
      } else if (this._airwayPatency < 0.6 && this._moass <= 2) {
        // Bronchospasm / partial obstruction — wheeze
        const expirDur = Math.min(2.0, cycleDuration * 0.6);
        const inspirDur = Math.min(1.2, cycleDuration * 0.35);
        // Play a soft vesicular inspiration then wheeze on expiration
        this._scheduleVesicularPhase(now, inspirDur, 'inspiration', 0.06);
        this._scheduleWheeze(now + inspirDur + 0.05, expirDur);
      } else if (this._moass <= 3 && this._airwayPatency < 0.8) {
        // Partial upper airway obstruction — snoring
        const snoringDur = Math.min(2.0, cycleDuration * 0.7);
        this._scheduleSnoring(now, snoringDur);
      } else {
        // Normal vesicular breath sounds — two-phase
        const inspirDur = Math.min(1.5, cycleDuration * 0.4);
        const expirDur = Math.min(2.2, cycleDuration * 0.55);
        const pause = Math.min(0.15, cycleDuration * 0.05);
        this._scheduleVesicularPhase(now, inspirDur, 'inspiration', 0.14);
        this._scheduleVesicularPhase(now + inspirDur + pause, expirDur, 'expiration', 0.14);
      }
    }

    this.breathTimer = setTimeout(() => this._tickBreath(), breathPeriodMs);
  }

  /**
   * Clinically realistic vesicular breath sound for one phase.
   *
   * Uses pink noise filtered through two parallel paths:
   *  - Vesicular: lowpass 500 Hz (main "whooshing" component)
   *  - Bronchial: bandpass 500-1500 Hz (larger airway component)
   *
   * Inspiration: louder vesicular, crescendo-decrescendo envelope
   * Expiration: softer vesicular, gentle decay envelope, longer duration
   */
  private _scheduleVesicularPhase(
    startTime: number,
    duration: number,
    phase: 'inspiration' | 'expiration',
    peakGain: number,
  ): void {
    if (!this.ctx || !this.stethoscopeGain) return;

    const dur = Math.max(0.1, duration);
    const noiseBuffer = createPinkNoiseBuffer(this.ctx, dur);

    // ── Vesicular path (low-frequency, 100-500 Hz) ──
    const vesicularSrc = this.ctx.createBufferSource();
    vesicularSrc.buffer = noiseBuffer;

    const vesicularLow = this.ctx.createBiquadFilter();
    vesicularLow.type = 'lowpass';
    vesicularLow.frequency.value = 500;
    vesicularLow.Q.value = 0.7;

    const vesicularHigh = this.ctx.createBiquadFilter();
    vesicularHigh.type = 'highpass';
    vesicularHigh.frequency.value = 100;
    vesicularHigh.Q.value = 0.5;

    const vesicularGain = this.ctx.createGain();

    // Vesicular volume differs by phase: louder in inspiration
    const vesicularPeak = phase === 'inspiration' ? peakGain : peakGain * 0.5;

    if (phase === 'inspiration') {
      // Crescendo-decrescendo: ramp up to 40%, peak at 40%, ramp down
      vesicularGain.gain.setValueAtTime(0, startTime);
      vesicularGain.gain.linearRampToValueAtTime(vesicularPeak, startTime + dur * 0.4);
      vesicularGain.gain.linearRampToValueAtTime(vesicularPeak * 0.85, startTime + dur * 0.7);
      vesicularGain.gain.linearRampToValueAtTime(0, startTime + dur);
    } else {
      // Gentle onset then long decay
      vesicularGain.gain.setValueAtTime(0, startTime);
      vesicularGain.gain.linearRampToValueAtTime(vesicularPeak, startTime + dur * 0.15);
      vesicularGain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    }

    vesicularSrc.connect(vesicularHigh);
    vesicularHigh.connect(vesicularLow);
    vesicularLow.connect(vesicularGain);
    vesicularGain.connect(this.stethoscopeGain);

    vesicularSrc.start(startTime);
    vesicularSrc.stop(startTime + dur);

    // ── Bronchial path (mid-frequency, 500-1500 Hz) ──
    const bronchialSrc = this.ctx.createBufferSource();
    bronchialSrc.buffer = noiseBuffer;

    const bronchialBP = this.ctx.createBiquadFilter();
    bronchialBP.type = 'bandpass';
    bronchialBP.frequency.value = 900;
    bronchialBP.Q.value = 0.8;

    const bronchialGain = this.ctx.createGain();
    const bronchialPeak = peakGain * 0.25; // Bronchial much softer than vesicular

    // Equal during both phases — smooth envelope
    bronchialGain.gain.setValueAtTime(0, startTime);
    bronchialGain.gain.linearRampToValueAtTime(bronchialPeak, startTime + dur * 0.1);
    bronchialGain.gain.setValueAtTime(bronchialPeak, startTime + dur * 0.85);
    bronchialGain.gain.linearRampToValueAtTime(0, startTime + dur);

    bronchialSrc.connect(bronchialBP);
    bronchialBP.connect(bronchialGain);
    bronchialGain.connect(this.stethoscopeGain);

    bronchialSrc.start(startTime);
    bronchialSrc.stop(startTime + dur);

    // ── Top-end rolloff (−3 dB/octave above 2 kHz) ──
    // Already handled by using pink noise + lowpass filters
  }

  /**
   * Upgraded snoring: fundamental oscillation at 60-120 Hz with amplitude
   * modulation and slight frequency wobble to simulate vibrating soft palate.
   * A noise component is layered on top for tissue realism.
   */
  private _scheduleSnoring(startTime: number, duration: number): void {
    if (!this.ctx || !this.stethoscopeGain) return;

    const dur = Math.max(0.1, duration);
    const sampleRate = this.ctx.sampleRate;

    // ── Primary oscillation: frequency-modulated sawtooth ──
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    const baseFreq = 80 + Math.random() * 40; // 80-120 Hz, varies per breath
    osc.frequency.value = baseFreq;

    // Slight frequency wobble via LFO (1-3 Hz, ±15 Hz)
    const freqLFO = this.ctx.createOscillator();
    freqLFO.type = 'sine';
    freqLFO.frequency.value = 1.5 + Math.random() * 1.5;
    const freqLFOGain = this.ctx.createGain();
    freqLFOGain.gain.value = 15; // ±15 Hz deviation
    freqLFO.connect(freqLFOGain);
    freqLFOGain.connect(osc.frequency);

    // Low-pass to soften harmonics
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 500;
    lpf.Q.value = 0.5;

    // Amplitude modulation (3-6 Hz tremor — soft palate flutter)
    const ampLFO = this.ctx.createOscillator();
    ampLFO.type = 'sine';
    ampLFO.frequency.value = 3 + Math.random() * 3;
    const ampLFOGain = this.ctx.createGain();
    ampLFOGain.gain.value = 0.04; // modulation depth

    const oscGain = this.ctx.createGain();
    oscGain.gain.value = 0.10; // base volume

    // Envelope: crescendo then sustain then release
    const envGain = this.ctx.createGain();
    envGain.gain.setValueAtTime(0, startTime);
    envGain.gain.linearRampToValueAtTime(1.0, startTime + dur * 0.15);
    envGain.gain.setValueAtTime(1.0, startTime + dur * 0.8);
    envGain.gain.linearRampToValueAtTime(0, startTime + dur);

    osc.connect(lpf);
    lpf.connect(oscGain);
    ampLFO.connect(ampLFOGain);
    ampLFOGain.connect(oscGain.gain);
    oscGain.connect(envGain);
    envGain.connect(this.stethoscopeGain);

    osc.start(startTime);
    osc.stop(startTime + dur);
    freqLFO.start(startTime);
    freqLFO.stop(startTime + dur);
    ampLFO.start(startTime);
    ampLFO.stop(startTime + dur);

    // ── Noise overlay: tissue turbulence ──
    const noiseBufLength = Math.floor(sampleRate * dur);
    const noiseBuf = this.ctx.createBuffer(1, noiseBufLength, sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseBufLength; i++) noiseData[i] = (Math.random() * 2 - 1);

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;

    const noiseBP = this.ctx.createBiquadFilter();
    noiseBP.type = 'bandpass';
    noiseBP.frequency.value = 200;
    noiseBP.Q.value = 1.0;

    const noiseEnvGain = this.ctx.createGain();
    noiseEnvGain.gain.setValueAtTime(0, startTime);
    noiseEnvGain.gain.linearRampToValueAtTime(0.04, startTime + dur * 0.15);
    noiseEnvGain.gain.setValueAtTime(0.04, startTime + dur * 0.8);
    noiseEnvGain.gain.linearRampToValueAtTime(0, startTime + dur);

    noiseSrc.connect(noiseBP);
    noiseBP.connect(noiseEnvGain);
    noiseEnvGain.connect(this.stethoscopeGain);

    noiseSrc.start(startTime);
    noiseSrc.stop(startTime + dur);
  }

  /**
   * Upgraded stridor: narrowband noise at ~1000 Hz plus tonal harmonic
   * components (pitched whistle at ~800 Hz with harmonics at 1600 and
   * 2400 Hz) that modulate during inspiration. This creates the
   * high-pitched inspiratory sound of laryngospasm.
   */
  private _scheduleStridor(startTime: number, duration: number): void {
    if (!this.ctx || !this.stethoscopeGain) return;

    const dur = Math.max(0.05, duration);
    const sampleRate = this.ctx.sampleRate;

    // ── Noise component (narrowband turbulence) ──
    const noiseLength = Math.floor(sampleRate * dur);
    const noiseBuf = this.ctx.createBuffer(1, noiseLength, sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLength; i++) noiseData[i] = (Math.random() * 2 - 1);

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1000;
    bandpass.Q.value = 3.0;

    const noiseGain = this.ctx.createGain();
    // Inspiratory crescendo-decrescendo
    noiseGain.gain.setValueAtTime(0, startTime);
    noiseGain.gain.linearRampToValueAtTime(0.10, startTime + dur * 0.35);
    noiseGain.gain.linearRampToValueAtTime(0.08, startTime + dur * 0.7);
    noiseGain.gain.linearRampToValueAtTime(0, startTime + dur);

    noiseSrc.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(this.stethoscopeGain);

    noiseSrc.start(startTime);
    noiseSrc.stop(startTime + dur);

    // ── Tonal harmonic components (pitched whistle) ──
    const harmonicFreqs = [800, 1600, 2400];
    const harmonicGains = [0.08, 0.04, 0.02];

    harmonicFreqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      // Slight pitch rise during inspiration (stridor characteristic)
      osc.frequency.setValueAtTime(freq * 0.95, startTime);
      osc.frequency.linearRampToValueAtTime(freq * 1.05, startTime + dur * 0.5);
      osc.frequency.linearRampToValueAtTime(freq, startTime + dur);

      const hGain = this.ctx!.createGain();
      const peakG = harmonicGains[idx];
      hGain.gain.setValueAtTime(0, startTime);
      hGain.gain.linearRampToValueAtTime(peakG, startTime + dur * 0.3);
      hGain.gain.linearRampToValueAtTime(peakG * 0.6, startTime + dur * 0.75);
      hGain.gain.linearRampToValueAtTime(0, startTime + dur);

      osc.connect(hGain);
      hGain.connect(this.stethoscopeGain!);

      osc.start(startTime);
      osc.stop(startTime + dur);
    });
  }

  /**
   * Wheeze: continuous musical tone (~400-600 Hz) during expiration.
   * Characteristic of bronchospasm in reactive airway conditions.
   * Multiple slightly detuned oscillators create the "polyphonic" quality
   * heard in real wheezes.
   */
  private _scheduleWheeze(startTime: number, duration: number): void {
    if (!this.ctx || !this.stethoscopeGain) return;

    const dur = Math.max(0.1, duration);

    // Multiple detuned sine tones for polyphonic wheeze character
    const baseFreq = 420 + Math.random() * 160; // 420-580 Hz base
    const tones = [baseFreq, baseFreq * 1.07, baseFreq * 1.15]; // slightly detuned
    const toneGains = [0.06, 0.04, 0.03];

    tones.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      // Slight downward pitch drift during expiration (realistic)
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.linearRampToValueAtTime(freq * 0.95, startTime + dur);

      const tGain = this.ctx!.createGain();
      const peak = toneGains[idx];

      // Smooth onset, sustained, gentle release
      tGain.gain.setValueAtTime(0, startTime);
      tGain.gain.linearRampToValueAtTime(peak, startTime + dur * 0.12);
      tGain.gain.setValueAtTime(peak, startTime + dur * 0.75);
      tGain.gain.linearRampToValueAtTime(0, startTime + dur);

      osc.connect(tGain);
      tGain.connect(this.stethoscopeGain!);

      osc.start(startTime);
      osc.stop(startTime + dur);
    });

    // ── Add a narrow noise band for turbulent airflow component ──
    const sampleRate = this.ctx.sampleRate;
    const noiseLen = Math.floor(sampleRate * dur);
    const noiseBuf = this.ctx.createBuffer(1, noiseLen, sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) noiseData[i] = (Math.random() * 2 - 1);

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = baseFreq;
    bp.Q.value = 6.0; // narrow

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0, startTime);
    nGain.gain.linearRampToValueAtTime(0.03, startTime + dur * 0.1);
    nGain.gain.setValueAtTime(0.03, startTime + dur * 0.8);
    nGain.gain.linearRampToValueAtTime(0, startTime + dur);

    noiseSrc.connect(bp);
    bp.connect(nGain);
    nGain.connect(this.stethoscopeGain);

    noiseSrc.start(startTime);
    noiseSrc.stop(startTime + dur);
  }

  // ─── Heart sounds ────────────────────────────────────────────────────────────

  /**
   * Update heart-sound parameters. Starts the loop if heart sounds are enabled.
   * @param hr  Heart rate (bpm)
   * @param sbp  Systolic blood pressure (mmHg); lower → more muffled
   */
  updateHeartSounds(hr: number, sbp: number): void {
    this._hrForHeart = Math.max(10, hr);
    this._sbp = sbp;
    if (this.heartEnabled && !this.heartActive) {
      this.heartActive = true;
      this._tickHeart();
    }
  }

  setHeartSoundsEnabled(enabled: boolean): void {
    this.heartEnabled = enabled;
    if (!enabled) {
      this.heartActive = false;
      if (this.heartTimer !== null) { clearTimeout(this.heartTimer); this.heartTimer = null; }
    } else if (!this.heartActive) {
      this.heartActive = true;
      this._tickHeart();
    }
  }

  private _tickHeart(): void {
    if (!this.heartActive || !this.heartEnabled || !this.ctx || !this.stethoscopeGain) return;

    const intervalMs = 60000 / this._hrForHeart;

    if (!this.isMuted && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      // Volume scales with SBP — muffled below 80 mmHg
      const vol = Math.min(1, Math.max(0.2, (this._sbp - 40) / 80));
      this._scheduleS1S2(now, vol);
    }

    this.heartTimer = setTimeout(() => this._tickHeart(), intervalMs);
  }

  private _scheduleS1S2(startTime: number, volumeScale: number): void {
    if (!this.ctx || !this.stethoscopeGain) return;
    // S1 — low-frequency thump ~60 Hz, 40 ms
    this._scheduleHeartClick(startTime,        60, 0.04, volumeScale * 0.15);
    // S2 — slightly higher ~80 Hz, 25 ms, 120 ms after S1
    this._scheduleHeartClick(startTime + 0.12, 80, 0.025, volumeScale * 0.10);
  }

  private _scheduleHeartClick(startTime: number, freq: number, dur: number, gain: number): void {
    if (!this.ctx || !this.stethoscopeGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 200;

    const envGain = this.ctx.createGain();
    const RAMP = 0.004;
    envGain.gain.setValueAtTime(0, startTime);
    envGain.gain.linearRampToValueAtTime(gain, startTime + RAMP);
    envGain.gain.setValueAtTime(gain, startTime + dur - RAMP);
    envGain.gain.linearRampToValueAtTime(0, startTime + dur);

    osc.connect(lpf);
    lpf.connect(envGain);
    envGain.connect(this.stethoscopeGain);
    osc.start(startTime);
    osc.stop(startTime + dur);
  }

  // ─── Volume / Mute ──────────────────────────────────────────────────────────

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        muted ? 0 : this.volume,
        this.ctx.currentTime,
      );
    }
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  dispose(): void {
    this.stopAll();
    if (this.ctx) {
      this.ctx.close().catch(() => {/* ignore */});
      this.ctx = null;
      this.masterGain = null;
      this.stethoscopeGain = null;
    }
  }

  private _clearAlarmTimer(): void {
    if (this.alarmTimer !== null) {
      clearTimeout(this.alarmTimer);
      this.alarmTimer = null;
    }
  }
}

export const audioManager = new AudioManager();
