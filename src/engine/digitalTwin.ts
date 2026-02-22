// src/engine/digitalTwin.ts
// Patient-Specific Digital Twin Engine
// Extends patient archetypes into full digital twins with predictive capabilities

import { Patient, PKState, CardiacRhythm } from '../types';
import { getAclsGuidance } from './cardiacRhythm';

export interface DigitalTwin extends Patient {
  sensitivityMultiplier: number;
  comorbidities: string[];
  currentCe: Record<string, number>;
  predictedOutcome: {
    timeToEmergence: number;
    hypotensionRisk: number;
    desaturationRisk: number;
    awarenessRisk: number;
    arrhythmiaRisk: number;
    predictedRhythm: CardiacRhythm;
    aclsGuidance: string[];
  };
  physiologyModifiers: {
    cardiacOutput: number;      // 0.5-1.5 multiplier
    hepaticClearance: number;   // 0.3-1.2 multiplier
    renalClearance: number;     // 0.3-1.2 multiplier
    brainSensitivity: number;   // 0.6-1.8 multiplier
    respiratoryDrive: number;   // 0.4-1.2 multiplier
  };
}

export const createDigitalTwin = (basePatient: Patient): DigitalTwin => {
  // Compute physiology modifiers from patient characteristics
  const ageFactor = basePatient.age > 65 ? 0.8 : basePatient.age < 18 ? 1.2 : 1.0;
  const bmi = basePatient.weight / Math.pow(basePatient.height / 100, 2);
  const obesityFactor = bmi > 35 ? 0.85 : bmi > 30 ? 0.9 : 1.0;

  return {
    ...basePatient,
    sensitivityMultiplier: basePatient.drugSensitivity || 1.0,
    comorbidities: [
      ...(basePatient.osa ? ['OSA'] : []),
      ...(basePatient.copd ? ['COPD'] : []),
      ...(basePatient.hepaticImpairment ? ['Hepatic Impairment'] : []),
      ...(basePatient.renalImpairment ? ['Renal Impairment'] : []),
    ],
    currentCe: {},
    predictedOutcome: {
      timeToEmergence: 0,
      hypotensionRisk: 0,
      desaturationRisk: 0,
      awarenessRisk: 0,
      arrhythmiaRisk: 0,
      predictedRhythm: 'normal_sinus',
      aclsGuidance: [],
    },
    physiologyModifiers: {
      cardiacOutput: ageFactor * obesityFactor,
      hepaticClearance: basePatient.hepaticImpairment ? 0.5 : ageFactor,
      renalClearance: basePatient.renalImpairment ? 0.4 : ageFactor,
      brainSensitivity: (basePatient.drugSensitivity || 1.0) * (basePatient.age > 70 ? 1.3 : 1.0),
      respiratoryDrive: basePatient.osa ? 0.7 : basePatient.copd ? 0.75 : 1.0,
    },
  };
};

export const updateTwin = (
  twin: DigitalTwin,
  pkStates: Record<string, PKState>,
  _vitalsHr: number,
  vitalsSpo2: number,
  _dt: number,
  currentRhythm: CardiacRhythm = 'normal_sinus',
  vitalsSbp: number = 120
): DigitalTwin => {
  // Extract effect-site concentrations from PK states
  const newCe: Record<string, number> = {};
  Object.entries(pkStates).forEach(([drug, state]) => {
    newCe[drug] = state.ce || 0;
  });

  const propCe = newCe['propofol'] || 0;
  const midazCe = newCe['midazolam'] || 0;
  const ketCe = newCe['ketamine'] || 0;
  const dexCe = newCe['dexmedetomidine'] || 0;
  const fentCe = newCe['fentanyl'] || 0;

  // Combined sedation depth estimation
  const totalSedationPressure = propCe * 1.0 + midazCe * 0.8 + ketCe * 0.6 + dexCe * 0.7;

  // Predictive forward simulation
  const timeToEmergence = totalSedationPressure > 0.5
    ? (totalSedationPressure * 12) / twin.physiologyModifiers.hepaticClearance
    : 0;

  // Ce-based hypotension risk: meaningful thresholds matching clinical ranges
  const ceHypotensionRisk = Math.max(0,
    (propCe > 2.0 ? (propCe - 2.0) * 15 : 0) +
    (dexCe > 0.5 ? (dexCe - 0.5) * 20 : 0) +
    (fentCe > 1.0 ? (fentCe - 1.0) * 15 : 0)
  ) * (2 - twin.physiologyModifiers.cardiacOutput);
  // Vital-based hypotension: actual SBP < 90 is definitive hypotension
  const vitalHypotensionRisk = vitalsSbp < 90 ? (90 - vitalsSbp) * 3 : 0;
  const hypotensionRisk = Math.min(100, ceHypotensionRisk * 0.6 + vitalHypotensionRisk * 0.4);

  // Ce-based desaturation risk: meaningful threshold at fentCe > 0.8 ng/mL
  const ceDesatRisk = Math.max(0,
    (1 - twin.physiologyModifiers.respiratoryDrive) * 40 +
    (propCe > 3 ? (propCe - 3) * 20 : 0) +
    (fentCe > 0.8 ? (fentCe - 0.8) * 20 : 0)
  );
  // Vital-based desaturation: actual SpO2 is ground truth
  const vitalDesatRisk = vitalsSpo2 < 94 ? (94 - vitalsSpo2) * 5 : 0;
  const desaturationRisk = Math.min(100, Math.max(0, ceDesatRisk * 0.6 + vitalDesatRisk * 0.4));

  const awarenessRisk = Math.min(100, Math.max(0,
    totalSedationPressure < 1.5 ? (1.5 - totalSedationPressure) * 40 : 0
  ));

  // Arrhythmia risk based on hypoxia, drug effects, and haemodynamics
  const arrhythmiaRisk = Math.min(100, Math.max(0,
    (vitalsSpo2 < 90 ? (90 - vitalsSpo2) * 3 : 0) +
    (propCe > 5 ? (propCe - 5) * 8 : 0) +
    (fentCe > 3 ? (fentCe - 3) * 5 : 0)
  ));

  const aclsGuidance = getAclsGuidance(currentRhythm);

  return {
    ...twin,
    currentCe: newCe,
    predictedOutcome: {
      timeToEmergence: Math.round(timeToEmergence * 10) / 10,
      hypotensionRisk: Math.round(hypotensionRisk),
      desaturationRisk: Math.round(desaturationRisk),
      awarenessRisk: Math.round(awarenessRisk),
      arrhythmiaRisk: Math.round(arrhythmiaRisk),
      predictedRhythm: currentRhythm,
      aclsGuidance,
    },
  };
};

export default { createDigitalTwin, updateTwin };
