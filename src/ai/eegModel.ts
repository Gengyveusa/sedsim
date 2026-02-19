/**
 * EEG Signal Model
 * Generates synthetic 4-channel EEG waveforms correlated
 * with sedation depth (BIS) and drug effect-site concentrations.
 * Channels: Fp1, Fp2, F3, F4 (frontal montage)
 */

export interface EEGChannelData {
  channel: string;
  data: number[];
  frequency: number; // Hz
}

export interface EEGSnapshot {
  timestamp: number;
  channels: EEGChannelData[];
  bis: number;
  suppressionRatio: number;
  spectralEdge: number;
  dominantFrequency: number;
  emgPower: number;
}

export interface EEGBandPowers {
  delta: number;  // 0.5-4 Hz
  theta: number;  // 4-8 Hz
  alpha: number;  // 8-13 Hz
  beta: number;   // 13-30 Hz
  gamma: number;  // 30-100 Hz
}

const CHANNEL_NAMES = ['Fp1', 'Fp2', 'F3', 'F4'];
const SAMPLE_RATE = 256; // Hz
const BUFFER_SECONDS = 10;

export class EEGModel {
  private bis: number = 97;
  private buffers: Map<string, number[]> = new Map();
  private time: number = 0;
  private noiseLevel: number = 0.05;

  constructor() {
    for (const ch of CHANNEL_NAMES) {
      this.buffers.set(ch, new Array(SAMPLE_RATE * BUFFER_SECONDS).fill(0));
    }
  }

  setBIS(bis: number): void {
    this.bis = Math.max(0, Math.min(100, bis));
  }

  generateSamples(numSamples: number): EEGSnapshot {
    const bandPowers = this.bisToFrequencyMix(this.bis);
    const channels: EEGChannelData[] = [];

    for (const ch of CHANNEL_NAMES) {
      const data: number[] = [];
      const buffer = this.buffers.get(ch)!;
      const phaseOffset = CHANNEL_NAMES.indexOf(ch) * 0.3;

      for (let i = 0; i < numSamples; i++) {
        const t = (this.time + i) / SAMPLE_RATE;
        let sample = 0;

        // Delta waves (0.5-4 Hz)
        sample +=
          bandPowers.delta *
          Math.sin(2 * Math.PI * 2 * t + phaseOffset) *
          50;

        // Theta waves (4-8 Hz)
        sample +=
          bandPowers.theta *
          Math.sin(2 * Math.PI * 6 * t + phaseOffset * 1.5) *
          30;

        // Alpha waves (8-13 Hz)
        sample +=
          bandPowers.alpha *
          Math.sin(2 * Math.PI * 10 * t + phaseOffset * 2) *
          25;

        // Beta waves (13-30 Hz)
        sample +=
          bandPowers.beta *
          Math.sin(2 * Math.PI * 20 * t + phaseOffset * 3) *
          15;

        // Gamma waves (30-100 Hz)
        sample +=
          bandPowers.gamma *
          Math.sin(2 * Math.PI * 40 * t + phaseOffset * 4) *
          5;

        // Add noise
        sample += (Math.random() - 0.5) * this.noiseLevel * 100;

        // Burst suppression at deep sedation
        if (this.bis < 30) {
          const suppressionProb = (30 - this.bis) / 30;
          if (Math.random() < suppressionProb) {
            sample *= 0.1;
          }
        }

        data.push(sample);
        buffer.push(sample);
        if (buffer.length > SAMPLE_RATE * BUFFER_SECONDS) {
          buffer.shift();
        }
      }

      channels.push({
        channel: ch,
        data,
        frequency: SAMPLE_RATE,
      });
    }

    this.time += numSamples;

    return {
      timestamp: Date.now(),
      channels,
      bis: this.bis,
      suppressionRatio: this.calculateSuppressionRatio(),
      spectralEdge: this.calculateSpectralEdge(bandPowers),
      dominantFrequency: this.calculateDominantFreq(bandPowers),
      emgPower: bandPowers.gamma * 100,
    };
  }

  private bisToFrequencyMix(bis: number): EEGBandPowers {
    // Map BIS to relative band powers
    if (bis > 80) {
      // Awake: dominant alpha/beta
      return { delta: 0.1, theta: 0.15, alpha: 0.4, beta: 0.25, gamma: 0.1 };
    } else if (bis > 60) {
      // Light sedation: increasing theta/delta
      return { delta: 0.2, theta: 0.3, alpha: 0.25, beta: 0.15, gamma: 0.1 };
    } else if (bis > 40) {
      // Moderate sedation: dominant delta/theta
      return { delta: 0.4, theta: 0.3, alpha: 0.15, beta: 0.1, gamma: 0.05 };
    } else if (bis > 20) {
      // Deep sedation: dominant delta with suppression
      return { delta: 0.6, theta: 0.2, alpha: 0.1, beta: 0.05, gamma: 0.05 };
    } else {
      // Burst suppression
      return { delta: 0.8, theta: 0.1, alpha: 0.05, beta: 0.03, gamma: 0.02 };
    }
  }

  private calculateSuppressionRatio(): number {
    if (this.bis >= 30) return 0;
    return Math.min(100, Math.round((30 - this.bis) * 3.33));
  }

  private calculateSpectralEdge(powers: EEGBandPowers): number {
    // Approximate SEF95
    const total =
      powers.delta + powers.theta + powers.alpha + powers.beta + powers.gamma;
    let cumulative = 0;
    const bands = [
      { power: powers.delta, freq: 2 },
      { power: powers.theta, freq: 6 },
      { power: powers.alpha, freq: 10 },
      { power: powers.beta, freq: 20 },
      { power: powers.gamma, freq: 40 },
    ];
    for (const band of bands) {
      cumulative += band.power / total;
      if (cumulative >= 0.95) return band.freq;
    }
    return 40;
  }

  private calculateDominantFreq(powers: EEGBandPowers): number {
    const bands = [
      { power: powers.delta, freq: 2 },
      { power: powers.theta, freq: 6 },
      { power: powers.alpha, freq: 10 },
      { power: powers.beta, freq: 20 },
      { power: powers.gamma, freq: 40 },
    ];
    let maxPower = 0;
    let dominantFreq = 10;
    for (const band of bands) {
      if (band.power > maxPower) {
        maxPower = band.power;
        dominantFreq = band.freq;
      }
    }
    return dominantFreq;
  }

  getChannelNames(): string[] {
    return [...CHANNEL_NAMES];
  }

  getSampleRate(): number {
    return SAMPLE_RATE;
  }

  getBuffer(channel: string): number[] {
    return [...(this.buffers.get(channel) || [])];
  }
}
