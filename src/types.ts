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
}

// 3-compartment PK state
export interface PKState {
  c1: number;  // central concentration (mcg/mL)
  c2: number;  // peripheral 1
  c3: number;  // peripheral 2
  ce: number;  // effect-site concentration
}

// Vital signs
export interface Vitals {
  hr: number;      // heart rate (bpm)
  sbp: number;     // systolic BP
  dbp: number;     // diastolic BP
  map: number;     // mean arterial pressure
  rr: number;      // respiratory rate
  spo2: number;    // oxygen saturation %
  etco2: number;   // end-tidal CO2
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
  rate: number;   // mcg/kg/min or mg/kg/hr
  unit: string;
  isRunning: boolean;
}

// Event log entry
export interface LogEntry {
  time: number;
  type: 'bolus' | 'infusion_start' | 'infusion_stop' | 'infusion_change' | 'alert' | 'vitals';
  message: string;
  severity?: 'info' | 'warning' | 'danger';
}

// Patient demographics
export interface Patient {
  age: number;
  weight: number;  // kg
  height: number;  // cm
  sex: 'M' | 'F';
  asa: 1 | 2 | 3 | 4;
}

// Time-stamped data point for trend graphs
export interface TrendPoint {
  time: number;
  vitals: Vitals;
  ce: Record<string, number>;  // effect-site by drug name
  moass: MOASSLevel;
}