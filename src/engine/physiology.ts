import { Vitals } from '../types';

/**
 * Physiology Engine
 * Simulates vital sign responses to sedation depth
 * Adds realistic variability and drug-specific effects
 */

// Baseline vitals for healthy adult
export const BASELINE_VITALS: Vitals = {
  hr: 75,
  sbp: 120,
  dbp: 80,
  map: 93,
  rr: 14,
  spo2: 99,
  etco2: 38,
};

/**
 * Add physiological noise to a value
 */
function noise(base: number, amplitude: number): number {
  return base + (Math.random() - 0.5) * 2 * amplitude;
}

/**
 * Calculate vitals based on combined sedation effect (0-1)
 * Higher effect = deeper sedation = more depression
 */
export function calculateVitals(
  effect: number,
  baseline: Vitals = BASELINE_VITALS
): Vitals {
  // Sedation depresses vitals proportionally
  const hrDepression = effect * 25;  // up to -25 bpm
  const bpDepression = effect * 35;  // up to -35 mmHg systolic
  const rrDepression = effect * 10;  // up to -10 breaths/min
  const spo2Depression = effect > 0.7 ? (effect - 0.7) * 30 : 0; // drops > deep sedation
  const etco2Rise = effect * 15;     // rises with respiratory depression

  const hr = Math.max(35, noise(baseline.hr - hrDepression, 2));
  const sbp = Math.max(60, noise(baseline.sbp - bpDepression, 3));
  const dbp = Math.max(35, noise(baseline.dbp - bpDepression * 0.6, 2));
  const map = Math.round((sbp + 2 * dbp) / 3);
  const rr = Math.max(2, noise(baseline.rr - rrDepression, 1));
  const spo2 = Math.min(100, Math.max(70, noise(baseline.spo2 - spo2Depression, 0.5)));
  const etco2 = Math.max(15, noise(baseline.etco2 + etco2Rise, 1));

  return {
    hr: Math.round(hr),
    sbp: Math.round(sbp),
    dbp: Math.round(dbp),
    map,
    rr: Math.round(rr),
    spo2: Math.round(spo2 * 10) / 10,
    etco2: Math.round(etco2),
  };
}

/**
 * Check for alarm conditions
 */
export function checkAlarms(vitals: Vitals): string[] {
  const alarms: string[] = [];
  if (vitals.hr < 50) alarms.push('Bradycardia');
  if (vitals.hr > 120) alarms.push('Tachycardia');
  if (vitals.sbp < 80) alarms.push('Hypotension');
  if (vitals.spo2 < 90) alarms.push('Desaturation');
  if (vitals.rr < 6) alarms.push('Respiratory Depression');
  if (vitals.etco2 > 55) alarms.push('Hypercapnia');
  return alarms;
}