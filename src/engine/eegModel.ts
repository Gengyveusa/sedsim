// src/engine/eegModel.ts
// Dynamic EEG Response Engine
// Generates realistic 4-channel EEG waveforms driven by effect-site concentrations
// Parametric model: propofol Ce -> alpha/delta/burst suppression transitions

export interface EEGChannel {
  raw: number[];        // Rolling buffer of raw EEG samples
  dsa: number[];        // Density Spectral Array data
  index: number;        // Processed sedation index (0-100, BIS-like)
  suppressionRatio: number;  // 0-100%
  sef: number;          // Spectral Edge Frequency 95%
  dominantFreq: number; // Peak frequency Hz
}

export interface EEGState {
  channels: Record<string, EEGChannel>;
  bisIndex: number;         // Composite BIS-like index 0-100
  sedationState: 'awake' | 'light' | 'moderate' | 'deep' | 'burst_suppression' | 'isoelectric';
  timestamp: number;
}

const CHANNEL_NAMES = ['Fp1', 'Fp2', 'F7', 'F8'];
const BUFFER_SIZE = 512; // ~2 seconds at 256 Hz display rate
const DSA_BINS = 30;     // Frequency bins for DSA spectrogram

// Noise generator for realistic EEG signal
const gaussianNoise = (mean: number = 0, std: number = 1): number => {
  const u1 = Math.random();
  const u2 = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

// Generate EMG artifact noise
const emgArtifact = (amplitude: number): number => {
  return amplitude * (Math.random() - 0.5) * 2 * (20 + Math.random() * 30);
};

// Parametric EEG signal generation based on drug concentrations
const generateRawSample = (
  propCe: number,
  dexCe: number,
  ketCe: number,
  midazCe: number,
  age: number,
  t: number,
  channelOffset: number
): number => {
  // Age adjustment: elderly show more sensitivity
  const ageSensitivity = age > 65 ? 1.2 : age < 18 ? 0.85 : 1.0;
  const effectivePropCe = propCe * ageSensitivity;

  // Awake state: dominant alpha (8-13 Hz) + beta (13-30 Hz)
  const alphaAmp = Math.max(0, 30 * (1 - effectivePropCe * 0.3));
  const alphaFreq = 10 - effectivePropCe * 1.5; // Alpha slows with sedation
  const betaAmp = Math.max(0, 15 * (1 - effectivePropCe * 0.5));
  const betaFreq = 20 + Math.random() * 5;

  // Sedation: theta (4-8 Hz) and delta (0.5-4 Hz) emergence
  const thetaAmp = effectivePropCe > 1 ? Math.min(40, (effectivePropCe - 1) * 25) : 0;
  const thetaFreq = 6 - effectivePropCe * 0.5;
  const deltaAmp = effectivePropCe > 2 ? Math.min(60, (effectivePropCe - 2) * 30) : 0;
  const deltaFreq = 2 - effectivePropCe * 0.2;

  // Burst suppression pattern (Ce > 4)
  const burstProb = effectivePropCe > 4 ? Math.min(0.8, (effectivePropCe - 4) * 0.3) : 0;
  const isBurst = Math.random() > burstProb;
  const burstMultiplier = effectivePropCe > 4 ? (isBurst ? 2.0 : 0.05) : 1.0;

  // Ketamine effect: increases high-frequency gamma
  const gammaAmp = ketCe > 0.5 ? Math.min(20, ketCe * 15) : 0;
  const gammaFreq = 35 + Math.random() * 10;

  // Dexmedetomidine: enhances spindle activity (12-14 Hz)
  const spindleAmp = dexCe > 0.3 ? Math.min(25, dexCe * 30) : 0;
  const spindleFreq = 13;

  // Midazolam: beta boost (paradoxical beta in light sedation)
  const midazBetaBoost = midazCe > 0.05 ? Math.min(20, midazCe * 100) : 0;

  // Composite signal with phase offsets per channel
  const phase = channelOffset * 0.3;
  const signal =
    alphaAmp * Math.sin(2 * Math.PI * alphaFreq * t + phase) +
    betaAmp * Math.sin(2 * Math.PI * betaFreq * t + phase * 1.5) +
    thetaAmp * Math.sin(2 * Math.PI * thetaFreq * t + phase * 0.8) +
    deltaAmp * Math.sin(2 * Math.PI * deltaFreq * t + phase * 0.5) +
    gammaAmp * Math.sin(2 * Math.PI * gammaFreq * t + phase * 2.0) +
    spindleAmp * Math.sin(2 * Math.PI * spindleFreq * t + phase * 1.2) +
    (betaAmp + midazBetaBoost) * Math.sin(2 * Math.PI * 18 * t + phase) * 0.3;

  // Add noise and apply burst suppression
  const noise = gaussianNoise(0, 3 + effectivePropCe * 2);
  const emg = effectivePropCe < 1.5 ? emgArtifact(0.3) : 0; // EMG decreases with sedation

  return (signal + noise + emg) * burstMultiplier;
};

// Compute BIS-like index from effect-site concentrations
const computeBISIndex = (
  propCe: number,
  dexCe: number,
  ketCe: number,
  midazCe: number,
  fentCe: number
): number => {
  // Sigmoid Emax model for BIS
  const totalEffect = propCe * 1.0 + midazCe * 15 + dexCe * 1.5 + fentCe * 200;
  const ec50 = 3.5; // BIS EC50 for propofol-equivalent
  const gamma = 2.5;
  const emax = 100;

  // Ketamine paradoxically increases BIS
  const ketEffect = ketCe > 0.5 ? Math.min(15, ketCe * 8) : 0;

  const fractionalEffect = Math.pow(totalEffect, gamma) /
    (Math.pow(ec50, gamma) + Math.pow(totalEffect, gamma));

  return Math.round(Math.max(0, Math.min(100, emax * (1 - fractionalEffect) + ketEffect)));
};

// Determine sedation state from BIS index
const getSedationState = (bisIndex: number): EEGState['sedationState'] => {
  if (bisIndex > 80) return 'awake';
  if (bisIndex > 60) return 'light';
  if (bisIndex > 40) return 'moderate';
  if (bisIndex > 20) return 'deep';
  if (bisIndex > 5) return 'burst_suppression';
  return 'isoelectric';
};

// Compute suppression ratio
const computeSuppressionRatio = (propCe: number): number => {
  if (propCe < 4) return 0;
  return Math.min(100, Math.round((propCe - 4) * 25));
};

// Compute spectral edge frequency
const computeSEF = (propCe: number, dexCe: number): number => {
  const baseSEF = 25; // Awake SEF95
  const reduction = propCe * 3 + dexCe * 2;
  return Math.max(2, Math.round((baseSEF - reduction) * 10) / 10);
};

// Simple DSA bin computation (frequency power distribution)
const computeDSA = (propCe: number, dexCe: number, ketCe: number): number[] => {
  const bins = new Array(DSA_BINS).fill(0);
  for (let i = 0; i < DSA_BINS; i++) {
    const freq = (i / DSA_BINS) * 30; // 0-30 Hz
    // Delta power increases with sedation
    if (freq < 4) bins[i] = 10 + propCe * 15 + dexCe * 10;
    // Theta
    else if (freq < 8) bins[i] = 8 + propCe * 10;
    // Alpha
    else if (freq < 13) bins[i] = Math.max(5, 25 - propCe * 5);
    // Beta
    else if (freq < 30) bins[i] = Math.max(3, 15 - propCe * 3 + ketCe * 5);
    // Add noise
    bins[i] += Math.random() * 3;
    bins[i] = Math.max(0, bins[i]);
  }
  return bins;
};

// Main EEG generation function - called every tick
export const generateEEG = (
  propCe: number,
  dexCe: number,
  ketCe: number,
  midazCe: number,
  fentCe: number,
  age: number,
  simTime: number,
  previousState?: EEGState
): EEGState => {
  const bisIndex = computeBISIndex(propCe, dexCe, ketCe, midazCe, fentCe);
  const sedationState = getSedationState(bisIndex);
  const suppressionRatio = computeSuppressionRatio(propCe);
  const sef = computeSEF(propCe, dexCe);
  const dsa = computeDSA(propCe, dexCe, ketCe);

  const channels: Record<string, EEGChannel> = {};

  CHANNEL_NAMES.forEach((name, idx) => {
    // Get previous buffer or create new
    const prevRaw = previousState?.channels[name]?.raw || [];

    // Generate new samples (batch of 8 per tick for smooth display)
    const newSamples: number[] = [];
    for (let s = 0; s < 8; s++) {
      const t = simTime + s * 0.004; // ~256 Hz sample rate
      newSamples.push(
        generateRawSample(propCe, dexCe, ketCe, midazCe, age, t, idx)
      );
    }

    // Append and trim to buffer size
    const raw = [...prevRaw, ...newSamples].slice(-BUFFER_SIZE);

    // Compute dominant frequency (simplified peak detection)
    const dominantFreq = propCe < 1 ? 10 : propCe < 3 ? 6 - propCe : 2;

    channels[name] = {
      raw,
      dsa,
      index: bisIndex,
      suppressionRatio,
      sef,
      dominantFreq: Math.round(dominantFreq * 10) / 10,
    };
  });

  return {
    channels,
    bisIndex,
    sedationState,
    timestamp: simTime,
  };
};

export default { generateEEG };
