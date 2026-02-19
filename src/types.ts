// Drug parameter types based on 3-compartment Marsh/Schnider models
export interface DrugParams {
  name: string;
  color: string;
  k10: number;  // elimination rate constant
  k12: number;  // central->peripheral1
  k13: number;  // central->peripheral2
  k21: number;  // peripheral1->central
  k31: number;  // peripheral2->central
  ke0: number;  // effect-site equilibration
  V1: number;   // central compartment volume (L)
  EC50: number; // half-maximal effect concentration
  gamma: number; // Hill coefficient
  unit: string;
  bolusOptions?: number[];
  infusionOptions?: number[];
}

// 3-compartment PK state
export interface PKState {
  c1: number;  // central concentration (mcg/mL)
  c2: number;  // peripheral 1
  c3: number;  // peripheral 2
  ce: number;  // effect-site concentration
}

// Cardiac rhythm types
export type CardiacRhythm =
  // Normal / Sinus rhythms
  | 'normal_sinus'
  | 'sinus_bradycardia'          // HR < 60
  | 'sinus_tachycardia'          // HR > 100
  // Narrow complex tachycardias (QRS < 120ms)
  | 'svt'                        // Supraventricular tachycardia
  | 'atrial_fibrillation'        // Irregularly irregular, no P waves
  | 'atrial_flutter'             // Sawtooth pattern, ~300 atrial rate
  | 'junctional'                 // No P waves, narrow QRS, regular
  // Wide complex tachycardias (QRS > 120ms)
  | 'ventricular_tachycardia'    // Monomorphic VT
  | 'polymorphic_vt'             // Torsades de Pointes
  | 'wide_complex_unknown'       // Wide complex, unclear origin
  // Bradyarrhythmias
  | 'first_degree_av_block'      // Prolonged PR interval
  | 'second_degree_type1'        // Wenckebach
  | 'second_degree_type2'        // Dropped QRS without PR change
  | 'third_degree_av_block'      // Complete heart block
  // Arrest rhythms
  | 'ventricular_fibrillation'   // Chaotic, no organized QRS
  | 'asystole'                   // Flatline
  | 'pea';                       // Pulseless electrical activity

// Vital signs
export interface Vitals {
  hr: number;    // heart rate (bpm)
  sbp: number;   // systolic BP
  dbp: number;   // diastolic BP
  map: number;   // mean arterial pressure
  rr: number;    // respiratory rate
  spo2: number;  // oxygen saturation %
  etco2: number; // end-tidal CO2
  rhythm?: CardiacRhythm;
  qrsWidth?: number;   // ms, normal < 120
  prInterval?: number; // ms, normal 120-200
  qtInterval?: number; // ms
}

// Sedation depth (Modified Observer Assessment)
export type MOASSLevel = 0 | 1 | 2 | 3 | 4 | 5;

// Drug bolus event
export interface BolusEvent {
  drugName: string;
  dose: number;
  unit: string;
  time: number;
}

// Infusion state
export interface InfusionState {
  drugName: string;
  rate: number;  // mcg/kg/min or mg/kg/hr
  unit: string;
  isRunning: boolean;
}

// Event log entry
export interface LogEntry {
  time: number;
  type: 'bolus' | 'infusion_start' | 'infusion_stop' | 'infusion_change' | 'alert' | 'vitals' | 'intervention';
  message: string;
  severity?: 'info' | 'warning' | 'danger';
}

// Patient demographics with expanded risk factors
export interface Patient {
  age: number;
  weight: number;  // kg
  height: number;  // cm
  sex: 'M' | 'F';
  asa: 1 | 2 | 3 | 4;
  // Risk factors (optional, defaults provided)
  mallampati?: 1 | 2 | 3 | 4;
  osa?: boolean;  // obstructive sleep apnea
  copd?: boolean;
  hepaticImpairment?: boolean;
  renalImpairment?: boolean;
  // Sensitivity modifier (0.6-1.8, mean 1.0)
  drugSensitivity?: number;
}

// Time-stamped data point for trend graphs
export interface TrendPoint {
  time: number;
    cp: Record<string, number>;  // plasma concentration by drug name
  vitals: Vitals;
  ce: Record<string, number>;  // effect-site by drug name
  moass: MOASSLevel;
}

// Airway state
export interface AirwayState {
  patency: number;  // 0-1, where 1 is fully patent
  obstructionType: 'none' | 'partial' | 'complete';
  intervention: 'none' | 'jaw_thrust' | 'oral_airway' | 'nasal_airway' | 'bag_mask';
}

// Airway device (mutually exclusive - one at a time)
export type AirwayDevice =
  | 'room_air'
  | 'nasal_cannula'
  | 'nasal_hood'
  | 'oral_airway'
  | 'nasal_airway'
  | 'lma'
  | 'ett'
  | 'cricothyroidotomy'
  | 'tracheostomy';

// Intervention types (supplementary, non-mutually-exclusive)
export type InterventionType = 
  | 'jaw_thrust'
  | 'chin_lift'
  | 'bag_mask'
  | 'suction'
  | 'increase_fio2'
  // legacy device types kept for backward compatibility
  | 'oral_airway'
  | 'nasal_airway';

// Alarm configuration
export interface AlarmConfig {
  spo2Low: number;
  spo2Critical: number;
  hrLow: number;
  hrHigh: number;
  bpLow: number;
  rrLow: number;
  etco2High: number;
}

export const DEFAULT_ALARM_CONFIG: AlarmConfig = {
  spo2Low: 90,
  spo2Critical: 85,
  hrLow: 50,
  hrHigh: 120,
  bpLow: 90,
  rrLow: 8,
  etco2High: 55,
};

// Ghost dose — hypothetical drug administration preview
export interface GhostDose {
  drugName: string;
  dose: number;
  isActive: boolean;
}

// Prediction result for ghost dose / forward simulation
export interface PredictionResult {
  secondsAhead: number;
  predictedCe: Record<string, number>;
  predictedMoass: MOASSLevel;
  predictedSpo2: number;
  predictedRr: number;
  predictedSbp?: number;
  aiExplanation?: string;
}

// Tutorial step definition
export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  targetElement?: string;   // CSS selector or element ID to highlight
  action?: 'click' | 'observe' | 'administer' | 'read';
  completionHint?: string;
}

// Tutorial state persisted across sessions
export interface TutorialState {
  isActive: boolean;
  track: 'quick_start' | 'deep_dive';
  currentStepIndex: number;
  completedSteps: string[];
  learnerLevel: 'novice' | 'intermediate' | 'advanced';
  lastSaved: number;
}
