/**
 * ECG Waveform Engine
 *
 * Gaussian component synthesis inspired by ECGSYN (McSharry & Clifford, MIT/PhysioNet).
 * Models each cardiac beat as a sum of Gaussian attractors for P, Q, R, S, T waves.
 *
 * ECG(θ) = Σᵢ aᵢ · exp(-(θ - θᵢ)² / (2·bᵢ²))
 * where θ ∈ [-π, π] per beat cycle, R-peak at θ=0.
 *
 * Amplitudes are normalised so the R-wave peak ≈ 1.0.
 * The MonitorPanel multiplies by a pixel-scale factor when rendering.
 */

import { CardiacRhythm } from '../types';

// ─── Core types ──────────────────────────────────────────────────────────────

export interface GaussianComponent {
  theta: number;     // angular position (rad, R-peak at 0, range −π..π)
  amplitude: number; // peak amplitude (R-peak normalised to 1.0)
  width: number;     // Gaussian sigma (rad)
}

// ─── Helper: evaluate one Gaussian ───────────────────────────────────────────

function gaussian(theta: number, c: GaussianComponent): number {
  const d = theta - c.theta;
  return c.amplitude * Math.exp(-(d * d) / (2 * c.width * c.width));
}

/** Sum all Gaussian components at angle theta. */
export function evaluateGaussians(
  components: GaussianComponent[],
  theta: number,
): number {
  let val = 0;
  for (const c of components) val += gaussian(theta, c);
  return val;
}

// ─── Bazett HR-responsive morphology ─────────────────────────────────────────

/**
 * Apply Bazett's correction so T-wave angular position and width shorten at
 * higher heart rates:  QT_measured = QTc · √RR
 *
 * Components with theta > 0.25 rad (i.e. T-wave region) are scaled.
 * Reference rate: 75 bpm (RR = 0.8 s).
 */
export function applyHRMorphology(
  components: GaussianComponent[],
  hr: number,
): GaussianComponent[] {
  if (hr <= 0) return components;
  const RR = 60 / hr;
  const RR_ref = 60 / 75;                    // 0.8 s at 75 bpm
  const qtScale = Math.sqrt(RR / RR_ref);    // >1 at slow HR, <1 at fast HR

  return components.map(comp => {
    if (comp.theta > 0.25) {
      return {
        theta: comp.theta * qtScale,
        amplitude: comp.amplitude * (0.65 + 0.35 * qtScale),
        width: comp.width * Math.sqrt(qtScale),
      };
    }
    return comp;
  });
}

// ─── Waveform Templates ───────────────────────────────────────────────────────

/** Normal sinus rhythm – calibrated at 75 bpm */
const NORMAL_SINUS: GaussianComponent[] = [
  { theta: -1.20, amplitude:  0.15, width: 0.09 }, // P wave
  { theta: -0.20, amplitude: -0.10, width: 0.04 }, // Q wave
  { theta:  0.00, amplitude:  1.00, width: 0.05 }, // R wave
  { theta:  0.18, amplitude: -0.25, width: 0.04 }, // S wave
  { theta:  0.75, amplitude:  0.25, width: 0.18 }, // T wave
];

/** Sinus bradycardia – taller T, wider TQ segment */
const SINUS_BRADY: GaussianComponent[] = [
  { theta: -1.20, amplitude:  0.18, width: 0.10 },
  { theta: -0.20, amplitude: -0.10, width: 0.04 },
  { theta:  0.00, amplitude:  1.00, width: 0.05 },
  { theta:  0.18, amplitude: -0.25, width: 0.04 },
  { theta:  0.90, amplitude:  0.32, width: 0.22 }, // taller, further-out T
];

/** Sinus tachycardia – short QT, flattened T (HR correction applied on top) */
const SINUS_TACHY: GaussianComponent[] = [
  { theta: -1.10, amplitude:  0.12, width: 0.08 },
  { theta: -0.18, amplitude: -0.08, width: 0.04 },
  { theta:  0.00, amplitude:  1.00, width: 0.05 },
  { theta:  0.16, amplitude: -0.22, width: 0.04 },
  { theta:  0.58, amplitude:  0.18, width: 0.13 }, // shorter / flatter T
];

/** SVT / Junctional – no P wave, narrow QRS */
const SVT_NARROW: GaussianComponent[] = [
  { theta: -0.20, amplitude: -0.08, width: 0.04 },
  { theta:  0.00, amplitude:  1.00, width: 0.05 },
  { theta:  0.16, amplitude: -0.22, width: 0.04 },
  { theta:  0.55, amplitude:  0.20, width: 0.14 },
];

/** Monomorphic VTach – wide QRS with discordant (negative) T wave */
const VTACH_WIDE: GaussianComponent[] = [
  { theta: -0.35, amplitude: -0.18, width: 0.12 }, // initial slur / notch
  { theta:  0.00, amplitude:  0.90, width: 0.14 }, // broad R wave
  { theta:  0.30, amplitude: -0.55, width: 0.10 }, // deep S
  { theta:  0.85, amplitude: -0.40, width: 0.22 }, // discordant T (negative)
];

/** AFib narrow QRS (fibrillatory baseline added separately) */
const AFIB_QRS: GaussianComponent[] = [
  { theta: -0.18, amplitude: -0.07, width: 0.04 },
  { theta:  0.00, amplitude:  0.85, width: 0.06 },
  { theta:  0.16, amplitude: -0.20, width: 0.04 },
  { theta:  0.55, amplitude:  0.18, width: 0.15 },
];

/** First-degree AV block – P wave shifted earlier (longer PR) */
const FIRST_DEGREE: GaussianComponent[] = [
  { theta: -1.60, amplitude:  0.15, width: 0.09 }, // P earlier → big PR gap
  { theta: -0.20, amplitude: -0.10, width: 0.04 },
  { theta:  0.00, amplitude:  1.00, width: 0.05 },
  { theta:  0.18, amplitude: -0.25, width: 0.04 },
  { theta:  0.75, amplitude:  0.25, width: 0.18 },
];

/** Wide complex unknown / Bundle-branch-block morphology */
const WIDE_COMPLEX: GaussianComponent[] = [
  { theta: -0.28, amplitude: -0.18, width: 0.10 },
  { theta:  0.00, amplitude:  0.85, width: 0.11 },
  { theta:  0.28, amplitude: -0.50, width: 0.09 },
  { theta:  0.80, amplitude: -0.28, width: 0.22 },
];

/** PEA – organised narrow complex with reduced amplitude */
const PEA_TEMPLATE: GaussianComponent[] = [
  { theta: -0.18, amplitude: -0.06, width: 0.04 },
  { theta:  0.00, amplitude:  0.70, width: 0.06 },
  { theta:  0.16, amplitude: -0.18, width: 0.04 },
  { theta:  0.55, amplitude:  0.15, width: 0.15 },
];

// ─── Non-Gaussian waveform generators ────────────────────────────────────────

/** VFib: sum of sinusoids with randomish frequencies (coarse pattern). */
const VFIB_FREQS = [2.1, 3.7, 5.3, 7.1, 4.8];
const VFIB_AMPS  = [0.32, 0.21, 0.14, 0.10, 0.16];

export function vfibWaveform(phase: number, offset: number): number {
  let val = 0;
  for (let i = 0; i < VFIB_FREQS.length; i++) {
    val += VFIB_AMPS[i] * Math.sin(
      2 * Math.PI * (phase * VFIB_FREQS[i] + offset + i * 0.37),
    );
  }
  return val;
}

/** Atrial flutter sawtooth baseline (~4 F-waves per QRS cycle ≈ 300/min). */
export function flutterBaseline(phase: number): number {
  const fp = (phase * 4) % 1;
  return fp < 0.6
    ? -(fp / 0.6) * 0.22
    : ((fp - 0.6) / 0.4) * 0.22 - 0.22;
}

/** AFib fibrillatory baseline: sum of high-frequency sinusoids (350–600/min). */
export function afibBaseline(phase: number, vfibOffset: number): number {
  return (
    Math.sin(2 * Math.PI * (phase * 7.8  + vfibOffset        )) * 0.040 +
    Math.sin(2 * Math.PI * (phase * 11.3 + vfibOffset * 1.3  )) * 0.030 +
    Math.sin(2 * Math.PI * (phase * 9.1  + vfibOffset * 0.7  )) * 0.025
  );
}

/**
 * Torsades de Pointes amplitude envelope: waxing-waning over ~8 beats.
 * Returns a scale factor [0.2 .. 1.0].
 */
export function torsadesEnvelope(cycleIndex: number): number {
  return 0.2 + 0.8 * Math.abs(Math.sin(cycleIndex * 0.35));
}

// Named reference to the P-wave component in NORMAL_SINUS template
const NORMAL_SINUS_P_WAVE: GaussianComponent = { theta: -1.20, amplitude: 0.15, width: 0.09 };

/**
 * Complete Heart Block: independent P-wave generator (atrial ~75/min) and
 * wide ventricular escape QRS (~35/min), evaluated independently then summed.
 *
 * @param qrsPhase  Ventricular beat phase [0, 1] at the escape rate
 * @param pPhase    Atrial P-wave phase [0, 1] at the sinus rate
 */
export function completeHeartBlockWaveform(
  qrsPhase: number,
  pPhase: number,
): number {
  // Atrial P-wave only (narrow, small)
  const pTheta = (pPhase * 2 * Math.PI) - Math.PI;
  const pComp = NORMAL_SINUS_P_WAVE;
  const pVal = gaussian(pTheta, { ...pComp, amplitude: pComp.amplitude * 0.5 });

  // Wide ventricular escape QRS
  const qrsTheta = (qrsPhase * 2 * Math.PI) - Math.PI;
  const qrsVal = evaluateGaussians(VTACH_WIDE, qrsTheta);

  return pVal + qrsVal * 0.85;
}

// ─── Per-beat RR variability ──────────────────────────────────────────────────

/**
 * Returns a (randomly varied) RR interval length in pixels for the given rhythm.
 * AFib is irregularly irregular; all others have only minor variation.
 */
export function getRRVariation(rhythm: CardiacRhythm, baseRR: number): number {
  switch (rhythm) {
    case 'atrial_fibrillation':
      return baseRR * (0.60 + Math.random() * 0.80);
    case 'second_degree_type1':
    case 'second_degree_type2':
      return baseRR * (0.90 + Math.random() * 0.20);
    default:
      return baseRR;
  }
}

// ─── Main ECG evaluator ───────────────────────────────────────────────────────

/**
 * Returns the ECG amplitude (normalised, R-peak = 1.0) for the given state.
 *
 * @param rhythm      Current cardiac rhythm
 * @param phase       Beat phase [0, 1]
 * @param hr          Heart rate (bpm) — used for QT correction
 * @param cycleIndex  Beat count since simulation start (for Wenckebach, Torsades)
 * @param vfibOffset  Continuously incrementing phase offset for VFib animation
 * @param pPhase      Atrial phase for complete heart block [0, 1], optional
 */
export function evaluateECG(
  rhythm: CardiacRhythm,
  phase: number,
  hr: number,
  cycleIndex: number,
  vfibOffset: number,
  pPhase?: number,
): number {
  const theta = (phase * 2 * Math.PI) - Math.PI;

  switch (rhythm) {
    case 'normal_sinus':
      return evaluateGaussians(applyHRMorphology(NORMAL_SINUS, hr), theta);

    case 'sinus_bradycardia':
      return evaluateGaussians(applyHRMorphology(SINUS_BRADY, hr), theta);

    case 'sinus_tachycardia':
      return evaluateGaussians(applyHRMorphology(SINUS_TACHY, hr), theta);

    case 'first_degree_av_block':
      return evaluateGaussians(applyHRMorphology(FIRST_DEGREE, hr), theta);

    case 'second_degree_type1': {
      const beatInGroup = cycleIndex % 4;
      if (beatInGroup === 3) return 0; // dropped beat
      // Progressively shift P-wave further negative (extends PR interval)
      const extraShift = beatInGroup * 0.28;
      const comps = NORMAL_SINUS.map((c, i) =>
        i === 0 ? { ...c, theta: c.theta - extraShift } : c,
      );
      return evaluateGaussians(applyHRMorphology(comps, hr), theta);
    }

    case 'second_degree_type2':
      if (cycleIndex % 3 === 2) return 0; // dropped QRS every 3rd beat
      return evaluateGaussians(applyHRMorphology(NORMAL_SINUS, hr), theta);

    case 'third_degree_av_block':
      return completeHeartBlockWaveform(phase, pPhase ?? (phase * 75 / 35) % 1);

    case 'svt':
    case 'junctional':
      return evaluateGaussians(SVT_NARROW, theta);

    case 'atrial_fibrillation':
      return evaluateGaussians(AFIB_QRS, theta) + afibBaseline(phase, vfibOffset);

    case 'atrial_flutter':
      return evaluateGaussians(SVT_NARROW, theta) * 0.85 + flutterBaseline(phase);

    case 'ventricular_tachycardia':
      return evaluateGaussians(VTACH_WIDE, theta);

    case 'wide_complex_unknown':
      return evaluateGaussians(WIDE_COMPLEX, theta);

    case 'polymorphic_vt':
      return evaluateGaussians(VTACH_WIDE, theta) * torsadesEnvelope(cycleIndex);

    case 'ventricular_fibrillation':
      return vfibWaveform(phase, vfibOffset);

    case 'pea':
      return evaluateGaussians(PEA_TEMPLATE, theta) * 0.75;

    case 'asystole':
      // Near-flat line with tiny high-frequency noise
      return (Math.random() - 0.5) * 0.03;

    default:
      return evaluateGaussians(applyHRMorphology(NORMAL_SINUS, hr), theta);
  }
}
