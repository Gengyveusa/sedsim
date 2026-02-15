import { Vitals, Patient, PKState } from '../types';
import { DRUG_DATABASE } from './drugs';

/**
 * Comprehensive Physiology Engine
 * Simulates vital sign responses based on PK/PD state
 * Implements respiratory cascade, SpO2 model, cardiovascular reflexes
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
 * Opioids and hypnotics both depress respiration with synergy
 */
function computeRespiratoryRate(
  baseline: number,
  pkStates: Record<string, PKState>,
  patient: Patient
): number {
  // Fentanyl respiratory depression (Ce50 = 1.5 ng/mL, gamma = 2.5)
  const fentanylCe = pkStates.fentanyl?.ce || 0;
  const opioidEffect = sigmoidEffect(fentanylCe * 1000, 1.5, 2.5); // convert to ng/mL
  
  // Propofol has milder RR depression
  const propofolCe = pkStates.propofol?.ce || 0;
  const propofolFrac = propofolCe / 3.4; // propofol Ce50 for sedation
  const hypnoticEffect = 0.3 * propofolFrac;
  
  // Synergy factor: combined depression greater than sum
  const synergyFactor = 1 + 0.5 * opioidEffect * propofolFrac;
  
  // Total depression
  const totalDepression = (opioidEffect * baseline * 0.8 + hypnoticEffect * baseline) * synergyFactor;
  
  // Apply patient sensitivity
  const sensitivityMod = patient.drugSensitivity;
  
  let rr = baseline - totalDepression * sensitivityMod;
  
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
  baseline: number,
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
  
  const effectivePaO2 = pao2 * obesityFactor * sedationFactor * osaFactor;
  
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
 */
function computeHemodynamics(
  baseline: Vitals,
  pkStates: Record<string, PKState>,
  currentSpO2: number,
  patient: Patient
): { hr: number; sbp: number; dbp: number; map: number } {
  const propofolCe = pkStates.propofol?.ce || 0;
  const fentanylCe = pkStates.fentanyl?.ce || 0;
  const midazolamCe = pkStates.midazolam?.ce || 0;
  
  // Propofol: vasodilation + myocardial depression
  const propofolFrac = propofolCe / 3.4;
  const propofolHREffect = -0.15 * propofolFrac * baseline.hr;
  const propofolBPEffect = -0.25 * propofolFrac;
  
  // Fentanyl: bradycardia via vagal tone
  const fentanylFrac = (fentanylCe * 1000) / 1.5; // convert to ng/mL, Ce50=1.5
  const fentanylHREffect = -0.10 * Math.min(fentanylFrac, 1) * baseline.hr;
  
  // Calculate BP first (for baroreflex)
  let sbp = baseline.sbp * (1 + propofolBPEffect * patient.drugSensitivity);
  let dbp = baseline.dbp * (1 + propofolBPEffect * 0.7 * patient.drugSensitivity);
  let map = (sbp + 2 * dbp) / 3;
  
  // Baroreceptor reflex: hypotension -> compensatory tachycardia
  const mapBaseline = baseline.map;
  const mapDrop = mapBaseline - map;
  const baroreflexDrive = mapDrop > 0 ? mapDrop * 0.5 : 0; // +0.5 bpm per mmHg drop
  
  // Hypoxia response (SpO2 < 90 -> tachycardia)
  const hypoxiaDrive = currentSpO2 < 90 ? (90 - currentSpO2) * 1.5 : 0;
  
  // Combine HR effects
  let hr = baseline.hr + propofolHREffect + fentanylHREffect + baroreflexDrive + hypoxiaDrive;
  hr *= patient.drugSensitivity;
  
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
  fio2: number = 0.21
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
  
  // SpO2 depends on respiratory status
  const spo2 = computeSpO2(rr, baseline.spo2, patient, fio2, prevVitals.spo2);
  
  // Hemodynamics
  const hemodynamics = computeHemodynamics(baseline, pkStates, spo2, patient);
  
  // EtCO2
  const etco2 = computeEtCO2(rr, baseline.etco2);
  
  return {
    hr: hemodynamics.hr,
    sbp: hemodynamics.sbp,
    dbp: hemodynamics.dbp,
    map: hemodynamics.map,
    rr,
    spo2,
    etco2,
  };
}
