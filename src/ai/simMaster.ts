/**
 * src/ai/simMaster.ts
 * SimMaster v2 - Proactive AI clinical observer with built-in
 * normal/abnormal/critical range intelligence.
 * Monitors simulator state and produces on-screen annotations
 * pointing to specific UI regions with severity-graded alerts.
 */

import { Vitals, MOASSLevel } from '../types';
import { EEGState } from '../engine/eegModel';

// ---------------------------------------------------------------------------
// Clinical Range Definitions
// ---------------------------------------------------------------------------

export type ClinicalStatus = 'normal' | 'warning' | 'danger' | 'critical';

interface ClinicalRange {
  label: string;
  unit: string;
  normal: [number, number];
  warning_low?: number;
  warning_high?: number;
  danger_low?: number;
  danger_high?: number;
  critical_low?: number;
  critical_high?: number;
}

export const CLINICAL_RANGES: Record<string, ClinicalRange> = {
  hr: {
    label: 'Heart Rate', unit: 'bpm',
    normal: [60, 100],
    warning_low: 50, warning_high: 110,
    danger_low: 40, danger_high: 130,
    critical_low: 30, critical_high: 150,
  },
  spo2: {
    label: 'SpO2', unit: '%',
    normal: [95, 100],
    warning_low: 92,
    danger_low: 88,
    critical_low: 80,
  },
  sbp: {
    label: 'Systolic BP', unit: 'mmHg',
    normal: [90, 140],
    warning_low: 85, warning_high: 160,
    danger_low: 75, danger_high: 180,
    critical_low: 60, critical_high: 200,
  },
  rr: {
    label: 'Resp Rate', unit: '/min',
    normal: [10, 20],
    warning_low: 8, warning_high: 24,
    danger_low: 5, danger_high: 30,
    critical_low: 0, critical_high: 40,
  },
  etco2: {
    label: 'EtCO2', unit: 'mmHg',
    normal: [35, 45],
    warning_low: 30, warning_high: 50,
    danger_low: 20, danger_high: 60,
    critical_low: 10, critical_high: 80,
  },
  moass: {
    label: 'MOASS', unit: '/5',
    normal: [2, 4],
    warning_low: 1, warning_high: 5,
    danger_low: 0,
    critical_low: 0,
  },
  bis: {
    label: 'BIS Index', unit: '',
    normal: [40, 60],
    warning_low: 30, warning_high: 70,
    danger_low: 20, danger_high: 80,
    critical_low: 10,
  },
};

export function assessParam(key: string, value: number): ClinicalStatus {
  const r = CLINICAL_RANGES[key];
  if (!r) return 'normal';
  if (r.critical_low !== undefined && value <= r.critical_low) return 'critical';
  if (r.critical_high !== undefined && value >= r.critical_high) return 'critical';
  if (r.danger_low !== undefined && value <= r.danger_low) return 'danger';
  if (r.danger_high !== undefined && value >= r.danger_high) return 'danger';
  if (r.warning_low !== undefined && value <= r.warning_low) return 'warning';
  if (r.warning_high !== undefined && value >= r.warning_high) return 'warning';
  if (value >= r.normal[0] && value <= r.normal[1]) return 'normal';
  return 'warning';
}

// ---------------------------------------------------------------------------
// Screen region map
// ---------------------------------------------------------------------------

export interface ScreenRegion {
  id: string;
  label: string;
  selector: string;
  description: string;
}

export const SCREEN_REGIONS: Record<string, ScreenRegion> = {
  hr_display:   { id: 'hr_display',   label: 'Heart Rate',   selector: '[data-region="hr"]',   description: 'Heart rate display' },
  bp_display:   { id: 'bp_display',   label: 'Blood Pressure', selector: '[data-region="bp"]', description: 'Blood pressure display' },
  spo2_display: { id: 'spo2_display', label: 'SpO2',         selector: '[data-region="spo2"]', description: 'Oxygen saturation' },
  rr_display:   { id: 'rr_display',   label: 'Resp Rate',    selector: '[data-region="rr"]',   description: 'Respiratory rate' },
  etco2_display:{ id: 'etco2_display',label: 'EtCO2',        selector: '[data-region="etco2"]', description: 'End-tidal CO2' },
  moass_gauge:  { id: 'moass_gauge',  label: 'MOASS',        selector: '[data-region="moass"]', description: 'Sedation depth gauge' },
  radar_chart:  { id: 'radar_chart',  label: 'Radar',        selector: '[data-region="radar"]', description: 'Drug concentration radar' },
  ecg_trace:    { id: 'ecg_trace',    label: 'ECG',          selector: '[data-region="ecg"]',   description: 'ECG waveform' },
  drug_panel:   { id: 'drug_panel',   label: 'Drug Panel',   selector: '[data-region="drugs"]', description: 'Drug bolus controls' },
};

// ---------------------------------------------------------------------------
// Annotation types
// ---------------------------------------------------------------------------

export interface SimMasterAnnotation {
  message: string;
  target: string;
  severity: 'info' | 'warning' | 'danger';
  action: 'highlight' | 'point' | 'pulse';
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Full clinical assessment
// ---------------------------------------------------------------------------

export interface VitalAssessment {
  param: string;
  value: number;
  status: ClinicalStatus;
  label: string;
  unit: string;
}

export function assessAllVitals(
  vitals: Vitals,
  moass: MOASSLevel,
  eeg?: EEGState,
  _pkStates?: Record<string, { ce: number }>
): VitalAssessment[] {
  const results: VitalAssessment[] = [
    { param: 'hr',   value: vitals.hr,   status: assessParam('hr', vitals.hr),     label: 'HR',   unit: 'bpm' },
    { param: 'spo2', value: vitals.spo2, status: assessParam('spo2', vitals.spo2), label: 'SpO2', unit: '%' },
    { param: 'sbp',  value: vitals.sbp,  status: assessParam('sbp', vitals.sbp),   label: 'SBP',  unit: 'mmHg' },
    { param: 'rr',   value: vitals.rr,   status: assessParam('rr', vitals.rr),     label: 'RR',   unit: '/min' },
    { param: 'etco2',value: vitals.etco2,status: assessParam('etco2', vitals.etco2),label: 'EtCO2',unit: 'mmHg' },
    { param: 'moass',value: moass,       status: assessParam('moass', moass),       label: 'MOASS',unit: '/5' },
  ];
  if (eeg) {
    results.push({ param: 'bis', value: eeg.bisIndex, status: assessParam('bis', eeg.bisIndex), label: 'BIS', unit: '' });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Clinical message templates
// ---------------------------------------------------------------------------

const PARAM_TO_TARGET: Record<string, string> = {
  hr: 'hr_display', spo2: 'spo2_display', sbp: 'bp_display',
  rr: 'rr_display', etco2: 'etco2_display', moass: 'moass_gauge', bis: 'ecg_trace',
};

interface ClinicalMessage {
  param: string;
  status: ClinicalStatus;
  condition: (v: number) => boolean;
  message: (v: number) => string;
  target: string;
  priority: number;
}

const CLINICAL_MESSAGES: ClinicalMessage[] = [
  // CRITICAL - immediate life threats
  { param: 'rr', status: 'critical', condition: v => v === 0, priority: 100,
    message: () => 'APNEA! No respiratory effort detected. Bag-mask ventilate immediately!',
    target: 'rr_display' },
  { param: 'spo2', status: 'critical', condition: v => v <= 80, priority: 99,
    message: v => `CRITICAL HYPOXIA: SpO2 ${v}%! Immediate airway intervention required.`,
    target: 'spo2_display' },
  { param: 'hr', status: 'critical', condition: v => v <= 30 || v >= 150, priority: 98,
    message: v => v <= 30 ? `CRITICAL BRADYCARDIA: HR ${v}. Push atropine 1mg IV NOW.` : `CRITICAL TACHYCARDIA: HR ${v}. Assess for V-tach, consider amiodarone.`,
    target: 'hr_display' },
  { param: 'sbp', status: 'critical', condition: v => v <= 60, priority: 97,
    message: v => `CARDIOVASCULAR COLLAPSE: SBP ${v}mmHg. Vasopressors + fluid resuscitation NOW.`,
    target: 'bp_display' },
  { param: 'etco2', status: 'critical', condition: v => v >= 80, priority: 96,
    message: v => `SEVERE HYPERCARBIA: EtCO2 ${v}mmHg. Respiratory failure - assist ventilation!`,
    target: 'etco2_display' },
  // DANGER - requires immediate attention
  { param: 'spo2', status: 'danger', condition: v => v <= 88, priority: 90,
    message: v => `DESATURATION: SpO2 ${v}%. Increase FiO2, jaw thrust, consider airway adjunct.`,
    target: 'spo2_display' },
  { param: 'rr', status: 'danger', condition: v => v <= 5 && v > 0, priority: 89,
    message: v => `Severe respiratory depression: RR ${v}/min. Assess for opioid overdose.`,
    target: 'rr_display' },
  { param: 'sbp', status: 'danger', condition: v => v <= 75, priority: 88,
    message: v => `Significant hypotension: SBP ${v}mmHg. Fluid bolus 250-500mL, reduce propofol.`,
    target: 'bp_display' },
  { param: 'hr', status: 'danger', condition: v => v <= 40, priority: 87,
    message: v => `Bradycardia: HR ${v}bpm. Atropine 0.5mg IV if symptomatic.`,
    target: 'hr_display' },
  { param: 'etco2', status: 'danger', condition: v => v >= 60, priority: 86,
    message: v => `Hypercarbia: EtCO2 ${v}mmHg. Inadequate ventilation - stimulate breathing.`,
    target: 'etco2_display' },
  { param: 'moass', status: 'danger', condition: v => v === 0, priority: 85,
    message: () => 'Patient is UNRESPONSIVE (MOASS 0). Verify airway, check drug levels.',
    target: 'moass_gauge' },
  // WARNING - trending abnormal
  { param: 'spo2', status: 'warning', condition: v => v <= 92, priority: 70,
    message: v => `SpO2 trending down to ${v}%. Monitor airway patency, increase O2.`,
    target: 'spo2_display' },
  { param: 'rr', status: 'warning', condition: v => v <= 8, priority: 69,
    message: v => `Respiratory rate low at ${v}/min. Watch for further depression.`,
    target: 'rr_display' },
  { param: 'sbp', status: 'warning', condition: v => v <= 85, priority: 68,
    message: v => `BP trending low: ${v}mmHg. Consider reducing sedative infusion rate.`,
    target: 'bp_display' },
  { param: 'hr', status: 'warning', condition: v => v <= 50, priority: 67,
    message: v => `Heart rate trending low: ${v}bpm. May be drug-related.`,
    target: 'hr_display' },
  { param: 'etco2', status: 'warning', condition: v => v >= 50, priority: 66,
    message: v => `EtCO2 elevated: ${v}mmHg. Hypoventilation developing.`,
    target: 'etco2_display' },
];

// ---------------------------------------------------------------------------
// Significant change detection
// ---------------------------------------------------------------------------

interface SimSnapshot {
  vitals: Vitals;
  moass: MOASSLevel;
  eeg?: EEGState;
  pkStates: Record<string, { ce: number }>;
}

let lastSnapshot: SimSnapshot | null = null;

export function hasSignificantChange(current: SimSnapshot): boolean {
  if (!lastSnapshot) { lastSnapshot = current; return true; }
  const prev = lastSnapshot;
  const changed =
    Math.abs(current.vitals.hr - prev.vitals.hr) > 8 ||
    Math.abs(current.vitals.spo2 - prev.vitals.spo2) > 2 ||
    Math.abs(current.vitals.sbp - prev.vitals.sbp) > 10 ||
    Math.abs(current.vitals.rr - prev.vitals.rr) > 3 ||
    Math.abs(current.vitals.etco2 - prev.vitals.etco2) > 5 ||
    current.moass !== prev.moass ||
    current.vitals.spo2 < 93 ||
    current.vitals.hr < 50 || current.vitals.hr > 120 ||
    current.vitals.sbp < 85 ||
    current.vitals.rr <= 6 ||
    current.vitals.etco2 > 55;
  lastSnapshot = current;
  return changed;
}

// ---------------------------------------------------------------------------
// Generate the most important observation (offline - no API needed)
// ---------------------------------------------------------------------------

export function generateObservation(
  vitals: Vitals,
  moass: MOASSLevel,
  eeg?: EEGState,
  pkStates?: Record<string, { ce: number }>
): SimMasterAnnotation {
  // Assess all parameters
  const assessments = assessAllVitals(vitals, moass, eeg, pkStates);
  const abnormal = assessments.filter(a => a.status !== 'normal');

  // Find highest priority matching clinical message
  for (const cm of CLINICAL_MESSAGES) {
    const assessment = assessments.find(a => a.param === cm.param);
    if (assessment && cm.condition(assessment.value)) {
      const sev = cm.status === 'critical' ? 'danger' : cm.status === 'danger' ? 'danger' : 'warning';
      return {
        message: cm.message(assessment.value),
        target: cm.target,
        severity: sev as 'info' | 'warning' | 'danger',
        action: cm.status === 'critical' ? 'pulse' : cm.status === 'danger' ? 'point' : 'highlight',
        timestamp: Date.now(),
      };
    }
  }

  // Drug-specific observations if no vital sign alerts
  if (pkStates) {
    const propCe = pkStates['propofol']?.ce || 0;
    const fentCe = pkStates['fentanyl']?.ce || 0;
    if (propCe > 5) {
      return {
        message: `Propofol Ce ${propCe.toFixed(1)} mcg/mL - very high. Risk of burst suppression and hemodynamic compromise.`,
        target: 'drug_panel', severity: 'warning', action: 'point', timestamp: Date.now(),
      };
    }
    if (fentCe > 0.003 && vitals.rr < 10) {
      return {
        message: `Opioid-hypnotic synergy: Fentanyl Ce ${(fentCe * 1000).toFixed(1)}ng/mL with RR ${vitals.rr}. Monitor closely.`,
        target: 'rr_display', severity: 'warning', action: 'highlight', timestamp: Date.now(),
      };
    }
  }

  // Positive reinforcement when stable
  if (abnormal.length === 0) {
    const msgs = [
      `All vitals in normal range. MOASS ${moass}/5. Good sedation management.`,
      `Patient stable. HR ${vitals.hr}, SpO2 ${vitals.spo2}%, BP ${vitals.sbp}. Continue monitoring.`,
      `Sedation depth appropriate (MOASS ${moass}/5). Vitals within target ranges.`,
    ];
    return {
      message: msgs[Math.floor(Date.now() / 10000) % msgs.length],
      target: 'moass_gauge', severity: 'info', action: 'highlight', timestamp: Date.now(),
    };
  }

  // Fallback: report the first abnormal parameter found
  const worst = abnormal[0];
  return {
    message: `${worst.label} is ${worst.value}${worst.unit} (${worst.status}). Monitor closely.`,
    target: PARAM_TO_TARGET[worst.param] || 'moass_gauge',
    severity: worst.status === 'normal' ? 'info' : worst.status === 'warning' ? 'warning' : 'danger',
    action: worst.status === 'critical' || worst.status === 'danger' ? 'pulse' : 'highlight',
    timestamp: Date.now(),
  };
}

// Alias for backward compat
export async function querySimMaster(): Promise<SimMasterAnnotation | null> {
  return null;
}

export function fallbackAnnotation(): SimMasterAnnotation {
  return { message: 'Observing...', target: 'moass_gauge', severity: 'info', action: 'highlight', timestamp: Date.now() };
}

export default { generateObservation, assessAllVitals, assessParam, hasSignificantChange, SCREEN_REGIONS, CLINICAL_RANGES };
