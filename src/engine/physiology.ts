import { Vitals, Patient, PKState, CardiacRhythm } from '../types';
import { determineRhythm } from './cardiacRhythm';

/**
 * Comprehensive Physiology Engine
 * Simulates vital sign responses based on PK/PD state
 * Implements respiratory cascade, SpO2 model, cardiovascular reflexes
 *
 * Calibrated to clinical reality:
 *   - 25 mcg fentanyl IV in 75kg adult -> ~0.3-0.5 ng/mL Ce -> mild RR reduction
 *   - 50 mcg fentanyl -> ~0.8-1.0 ng/mL Ce -> moderate RR depression
 *   - 100 mcg fentanyl -> ~1.5-2.0 ng/mL Ce -> significant RR depression
 *   - 200+ mcg fentanyl -> apnea risk
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

// Patient archetype presets
export const PATIENT_ARCHETYPES: Record<string, Patient> = {
  healthy_adult: {
    age: 35, weight: 75, height: 178, sex: 'M', asa: 1,
    mallampati: 1, osa: false, drugSensitivity: 1.0,
  },
  elderly: {
    age: 78, weight: 58, height: 160, sex: 'F', asa: 2,
    mallampati: 2, osa: false, drugSensitivity: 1.4,
  },
  obese_osa: {
    age: 52, weight: 130, height: 175, sex: 'M', asa: 3,
    mallampati: 3, osa: true, drugSensitivity: 1.2,
  },
  anxious_young: {
    age: 28, weight: 62, height: 165, sex: 'F', asa: 1,
    mallampati: 1, osa: false, drugSensitivity: 0.8,
  },
  hepatic: {
    age: 61, weight: 82, height: 172, sex: 'M', asa: 3,
    mallampati: 2, osa: false, drugSensitivity: 1.5,
  },
  pediatric: {
    age: 17, weight: 65, height: 170, sex: 'M', asa: 1,
    mallampati: 1, osa: false, drugSensitivity: 0.9,
  },
  // Cardiomyopathy archetypes
  hcm_young: {
    age: 28, weight: 72, height: 175, sex: 'M', asa: 3,
    mallampati: 1, osa: false, drugSensitivity: 1.6,
  },
  hcm_old: {
    age: 68, weight: 78, height: 170, sex: 'M', asa: 3,
    mallampati: 2, osa: false, drugSensitivity: 1.8,
  },
  dcm_young: {
    age: 32, weight: 80, height: 178, sex: 'M', asa: 3,
    mallampati: 1, osa: false, drugSensitivity: 1.55,
  },
  dcm_old: {
    age: 72, weight: 74, height: 168, sex: 'M', asa: 4,
    mallampati: 2, osa: false, drugSensitivity: 1.9,
  },
};

function noise(base: number, amplitude: number): number {
  return base + (Math.random() - 0.5) * 2 * amplitude;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sigmoidEffect(ce: number, ce50: number, gamma: number): number {
  if (ce <= 0 || ce50 <= 0) return 0;
  const ratio = Math.pow(ce / ce50, gamma);
  return ratio / (1 + ratio);
}

/**
 * Calculate respiratory rate based on drug effects
 * Clinically calibrated:
 *   - Fentanyl Ce50 for RR depression ~3.5 ng/mL (literature: 2-5 ng/mL)
 *   - 25mcg bolus in 75kg -> peak Ce ~0.4 ng/mL -> ~5% RR depression
 *   - 100mcg bolus -> peak Ce ~1.5 ng/mL -> ~15% RR depression
 *   - 200mcg+ -> Ce >3 ng/mL -> significant depression
 */
function computeRespiratoryRate(
  baseline: number,
  pkStates: Record<string, PKState>,
  patient: Patient
): number {
  // Fentanyl respiratory depression
  // Ce50 = 3.5 ng/mL for 50% RR depression (clinical range 2-5 ng/mL)
  // gamma = 1.8 (gradual onset curve)
  const fentanylCe = pkStates.fentanyl?.ce || 0;
    const fentanylCeNg = fentanylCe; // already in ng/mL from PK model
  const opioidEffect = sigmoidEffect(fentanylCeNg, 3.5, 1.8);

  // Propofol has milder RR depression
  // Ce50 for RR depression ~4 mcg/mL (higher than sedation Ce50 of 3.4)
  const propofolCe = pkStates.propofol?.ce || 0;
  const propofolRREffect = sigmoidEffect(propofolCe, 4.0, 2.0);

  // Midazolam RR depression (mild)
  const midazolamCe = pkStates.midazolam?.ce || 0;
  const midazolamCeNg = midazolamCe * 1000;
  const benzoEffect = sigmoidEffect(midazolamCeNg, 200, 1.5) * 0.3;

  // Ketamine: minimal RR depression (may even stimulate)
  const ketamineCe = pkStates.ketamine?.ce || 0;
  const ketamineProtection = ketamineCe > 0.0005 ? 0.05 : 0;

  // Maximum RR depression fractions (how much each drug can reduce RR)
  // Opioid alone can reduce RR by up to 60% at very high doses
  // Propofol alone can reduce by up to 40%
  // Benzodiazepines alone by up to 25%
  const opioidDepression = opioidEffect * 0.6 * baseline;
  const propofolDepression = propofolRREffect * 0.4 * baseline;
  const benzoDepression = benzoEffect * baseline;

  // Synergy: opioid + hypnotic combination is supra-additive
  // But only moderate synergy factor (1.15-1.3 range)
  const hasSynergy = opioidEffect > 0.05 && (propofolRREffect > 0.05 || benzoEffect > 0.02);
  const synergyFactor = hasSynergy ? 1.0 + 0.25 * Math.min(opioidEffect, 0.5) * Math.min(propofolRREffect + benzoEffect, 0.5) : 1.0;

  // Total depression (additive with synergy multiplier)
  const totalDepression = (opioidDepression + propofolDepression + benzoDepression) * synergyFactor;

  // Apply patient sensitivity
  const sensitivityMod = patient.drugSensitivity ?? 1.0;
  let rr = baseline - totalDepression * sensitivityMod + ketamineProtection * baseline;

  // Cannot go below 0
  rr = Math.max(0, rr);

  return noise(rr, 0.5);
}

/**
 * Compute SpO2 based on respiratory status and FiO2
 * Models oxygen cascade with V/Q mismatch
 */
function computeSpO2(
  rr: number,
  _baseline: number,
  patient: Patient,
  fio2: number = 0.21,
  prevSpO2: number = 99
): number {
  // Minute ventilation proxy (simplified)
  const normalRR = 14;
  const ventilationRatio = rr / normalRR;

  // Alveolar oxygen tension (simplified gas equation)
  const pAtm = 760;
  const pH2O = 47;
  const paco2 = 40 / Math.max(ventilationRatio, 0.1); // CO2 rises as ventilation falls
  const pao2 = fio2 * (pAtm - pH2O) - (paco2 / 0.8);

  // V/Q mismatch factor (worse with obesity, sedation)
  const bmi = patient.weight / Math.pow(patient.height / 100, 2);
  const obesityFactor = bmi > 30 ? 0.95 : 1.0;
  const sedationFactor = Math.max(0.9, ventilationRatio);
  const osaFactor = patient.osa ? 0.95 : 1.0;

  const effectivePaO2 = Math.max(0, pao2 * obesityFactor * sedationFactor * osaFactor);

  // Oxygen-hemoglobin dissociation curve (Hill equation)
  const p50 = 26.6;
  const hillCoeff = 2.7;
  const spo2True = 100 * Math.pow(effectivePaO2, hillCoeff) /
    (Math.pow(effectivePaO2, hillCoeff) + Math.pow(p50, hillCoeff));

  // Pulse ox delay: exponential smoothing (tau ~ 30 sec)
  const tau = 30;
  const dt = 1; // 1 second tick
  const alpha = dt / tau;
  const spo2Displayed = prevSpO2 + (spo2True - prevSpO2) * alpha;

  return clamp(noise(spo2Displayed, 0.3), 0, 100);
}

/**
 * Compute hemodynamics (HR, BP) with baroreceptor reflex
 * Fentanyl bradycardia is dose-dependent but modest at sedation doses
 */
function computeHemodynamics(
  baseline: Vitals,
  pkStates: Record<string, PKState>,
  currentSpO2: number,
  patient: Patient
): { hr: number; sbp: number; dbp: number; map: number } {
  const propofolCe = pkStates.propofol?.ce || 0;
  const fentanylCe = pkStates.fentanyl?.ce || 0;
  const ketamineCe = pkStates.ketamine?.ce || 0;

  // Propofol: vasodilation + myocardial depression
  const propofolFrac = sigmoidEffect(propofolCe, 3.4, 2.0);
  const propofolHREffect = -0.15 * propofolFrac * baseline.hr;
  const propofolBPEffect = -0.25 * propofolFrac;

  // Fentanyl: bradycardia via vagal tone
  // Ce50 for bradycardia ~4 ng/mL - modest effect at sedation doses
    const fentanylCeNg = fentanylCe; // already in ng/mL from PK model
  const fentanylFrac = sigmoidEffect(fentanylCeNg, 4.0, 1.5);
  const fentanylHREffect = -0.12 * fentanylFrac * baseline.hr;

  // Ketamine: sympathomimetic (increases HR and BP)
  const ketamineFrac = sigmoidEffect(ketamineCe, 0.001, 1.5);
  const ketamineHREffect = 0.15 * ketamineFrac * baseline.hr;
  const ketamineBPEffect = 0.10 * ketamineFrac;

  // Calculate BP first (for baroreflex)
  const sensitivity = patient.drugSensitivity ?? 1.0;
  let sbp = baseline.sbp * (1 + (propofolBPEffect + ketamineBPEffect) * sensitivity);
  let dbp = baseline.dbp * (1 + (propofolBPEffect * 0.7 + ketamineBPEffect * 0.7) * sensitivity);
  let map = (sbp + 2 * dbp) / 3;

  // Baroreceptor reflex: hypotension -> compensatory tachycardia
  const mapBaseline = baseline.map;
  const mapDrop = mapBaseline - map;
  const baroreflexDrive = mapDrop > 0 ? mapDrop * 0.5 : 0;

  // Hypoxia response (SpO2 < 90 -> tachycardia)
  const hypoxiaDrive = currentSpO2 < 90 ? (90 - currentSpO2) * 1.5 : 0;

  // Combine HR effects
  const drugHRDelta = (propofolHREffect + fentanylHREffect + ketamineHREffect) * sensitivity;
  let hr = baseline.hr + drugHRDelta + baroreflexDrive + hypoxiaDrive;

  // Severe hypoxia -> bradycardia (late sign)
  if (currentSpO2 < 75) {
    hr *= 0.7;
  }

  return {
    hr: clamp(noise(hr, 2), 20, 180),
    sbp: clamp(noise(sbp, 3), 40, 220),
    dbp: clamp(noise(dbp, 2), 20, 140),
    map: clamp(noise(map, 2), 30, 160),
  };
}

/**
 * Compute EtCO2 based on ventilation
 */
function computeEtCO2(rr: number, baseline: number = 38): number {
  const normalRR = 14;
  const ventilationRatio = Math.max(rr / normalRR, 0.1);

  // EtCO2 inversely proportional to ventilation
  const targetEtCO2 = baseline / ventilationRatio;

  // Clamp to physiological range
  return clamp(noise(targetEtCO2, 1), 0, 100);
}

/**
 * Check for alarm conditions
 */
export function checkAlarms(vitals: Vitals): { type: string; message: string; severity: 'warning' | 'danger' }[] {
  const alarms: { type: string; message: string; severity: 'warning' | 'danger' }[] = [];

  if (vitals.spo2 < 90) {
    alarms.push({ type: 'spo2', message: `SpO2 LOW: ${Math.round(vitals.spo2)}%`, severity: vitals.spo2 < 85 ? 'danger' : 'warning' });
  }
  if (vitals.hr < 50) {
    alarms.push({ type: 'hr', message: `HR LOW: ${Math.round(vitals.hr)} bpm`, severity: vitals.hr < 40 ? 'danger' : 'warning' });
  }
  if (vitals.hr > 120) {
    alarms.push({ type: 'hr', message: `HR HIGH: ${Math.round(vitals.hr)} bpm`, severity: vitals.hr > 140 ? 'danger' : 'warning' });
  }
  if (vitals.sbp < 90) {
    alarms.push({ type: 'bp', message: `BP LOW: ${Math.round(vitals.sbp)}/${Math.round(vitals.dbp)}`, severity: vitals.sbp < 80 ? 'danger' : 'warning' });
  }
  if (vitals.rr < 8) {
    alarms.push({ type: 'rr', message: `RR LOW: ${Math.round(vitals.rr)}`, severity: vitals.rr < 6 ? 'danger' : 'warning' });
  }
  if (vitals.rr === 0) {
    alarms.push({ type: 'rr', message: 'APNEA', severity: 'danger' });
  }
  if (vitals.etco2 > 55) {
    alarms.push({ type: 'etco2', message: `EtCO2 HIGH: ${Math.round(vitals.etco2)}`, severity: vitals.etco2 > 65 ? 'danger' : 'warning' });
  }

  return alarms;
}

/**
 * Main function to calculate all vitals based on PK state
 */
export function calculateVitals(
  pkStates: Record<string, PKState>,
  patient: Patient,
  prevVitals: Vitals = BASELINE_VITALS,
  fio2: number = 0.21,
  prevRhythm: CardiacRhythm = 'normal_sinus',
  elapsedSeconds: number = 0
): Vitals {
  // Get patient-adjusted baseline
  const baseline = { ...BASELINE_VITALS };

  // Age adjustments
  if (patient.age > 65) {
    baseline.hr -= 5;
    baseline.sbp += 10;
  }

  // Calculate respiratory rate first (drives SpO2 and EtCO2)
  const rr = computeRespiratoryRate(baseline.rr, pkStates, patient);

  // Cardiomyopathy adjustments
  const isHCM = (patient.drugSensitivity === 1.6 || patient.drugSensitivity === 1.8) &&
    patient.asa === 3 && !patient.osa;
  const isDCM = (patient.drugSensitivity === 1.55 || patient.drugSensitivity === 1.9) &&
    patient.asa >= 3 && !patient.osa && !patient.hepaticImpairment;

  if (isHCM) {
    baseline.hr += 5;
    baseline.sbp -= 5;
    baseline.dbp += 5;
  }

  if (isDCM) {
    baseline.hr += 15;
    baseline.sbp -= 15;
    baseline.dbp -= 5;
    baseline.map = (baseline.sbp + 2 * baseline.dbp) / 3;
  }

  // SpO2 depends on respiratory status
  const spo2 = computeSpO2(rr, baseline.spo2, patient, fio2, prevVitals.spo2);

  // Hemodynamics
  const hemodynamics = computeHemodynamics(baseline, pkStates, spo2, patient);

  // EtCO2
  const etco2 = computeEtCO2(rr, baseline.etco2);

  // Determine cardiac rhythm
  const partialVitals: Vitals = {
    hr: hemodynamics.hr,
    sbp: hemodynamics.sbp,
    dbp: hemodynamics.dbp,
    map: hemodynamics.map,
    rr,
    spo2,
    etco2,
  };
  const prevArrestStart = (prevVitals as Vitals & { _arrestStart?: number | null })._arrestStart ?? null;
  const rhythmResult = determineRhythm(
    partialVitals, pkStates, patient, prevRhythm, elapsedSeconds, prevArrestStart
  );

  const result: Vitals & { _arrestStart?: number | null } = {
    hr: hemodynamics.hr,
    sbp: hemodynamics.sbp,
    dbp: hemodynamics.dbp,
    map: hemodynamics.map,
    rr,
    spo2,
    etco2,
    rhythm: rhythmResult.rhythm,
    qrsWidth: rhythmResult.qrsWidth,
    prInterval: rhythmResult.prInterval,
    qtInterval: rhythmResult.qtInterval,
    _arrestStart: rhythmResult.arrestStartSeconds,
  };
  return result;
}
