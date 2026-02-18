import { DrugParams } from '../types';

// Propofol - Marsh model parameters (70kg adult)
export const propofol: DrugParams = {
  name: 'Propofol',
  color: '#3b82f6',  // blue
  k10: 0.119,
  k12: 0.112,
  k13: 0.042,
  k21: 0.055,
  k31: 0.0033,
  ke0: 0.26,
  V1: 15.9,    // L for 70kg
  EC50: 3.4,   // mcg/mL for MOASS 2-3
  gamma: 2.8,
  unit: 'mg',
};

// Midazolam - Simplified 3-compartment
export const midazolam: DrugParams = {
  name: 'Midazolam',
  color: '#22c55e',  // green
  k10: 0.032,
  k12: 0.077,
  k13: 0.017,
  k21: 0.025,
  k31: 0.004,
  ke0: 0.13,
  V1: 8.6,
      EC50: 0.20,  // mcg/mL for MOASS scoring (2mg->drowsy, 5mg->moderate sedation)
    gamma: 2.5,  // Hill coefficient for gradual sedation-dose response
  unit: 'mg',
};

// Fentanyl - 3-compartment
export const fentanyl: DrugParams = {
  name: 'Fentanyl',
  color: '#f59e0b',  // amber
  k10: 0.094,
  k12: 0.471,
  k13: 0.225,
  k21: 0.066,
  k31: 0.013,
  ke0: 0.147,
  V1: 12.7,
    EC50: 0.005,  // mcg/mL (5 ng/mL) - Bouillon/AReS: opioid sedation EC50 is HIGH
  gamma: 2.0,
  unit: 'mcg',
};

// Ketamine - Simplified 3-compartment
export const ketamine: DrugParams = {
  name: 'Ketamine',
  color: '#a855f7',  // purple
  k10: 0.064,
  k12: 0.231,
  k13: 0.062,
  k21: 0.069,
  k31: 0.007,
  ke0: 0.2,
  V1: 14.4,
  EC50: 1.5,  // mcg/mL
  gamma: 1.8,
  unit: 'mg',
};

// Dexmedetomidine - Hannivoort 2015 model (alpha-2 agonist)
// "Cooperative sedation" - sedation WITHOUT respiratory depression
// Very slow equilibration (15+ min to peak effect)
export const dexmedetomidine: DrugParams = {
  name: 'Dexmedetomidine',
  color: '#06b6d4',  // cyan
  k10: 0.022,  // slow elimination, t1/2 ~2hr
  k12: 0.105,
  k13: 0.032,
  k21: 0.047,
  k31: 0.009,
  ke0: 0.0066,  // VERY slow effect-site equilibration (15+ min)
  V1: 28.0,
  EC50: 0.6,  // ng/mL for sedation
  gamma: 3.5,
  unit: 'mcg',
};

// Remifentanil - Minto 1997 model (ultra-short acting opioid)
// Fast ke0: rapid onset and offset. Mistakes self-correct quickly but stacking is lethal
export const remifentanil: DrugParams = {
  name: 'Remifentanil',
  color: '#fb923c',  // orange
  k10: 0.23,  // very fast elimination (context-insensitive)
  k12: 0.64,
  k13: 0.15,
  k21: 0.11,
  k31: 0.017,
  ke0: 0.595,  // FAST effect-site equilibration (~1 min)
  V1: 5.1,
    EC50: 0.005,  // mcg/mL (5 ng/mL) - Minto/Eleveld: high opioid sedation EC50
  gamma: 2.0,
  unit: 'mcg',
};

// Naloxone - Opioid reversal agent (mu-receptor competitive antagonist)
// Shorter duration than fentanyl -> renarcotization risk
export const naloxone: DrugParams = {
  name: 'Naloxone',
  color: '#10b981',  // emerald
  k10: 0.173,  // t1/2 elimination ~64 min
  k12: 0.25,
  k13: 0,  // simplified 2-compartment
  k21: 0.08,
  k31: 0,
  ke0: 0.18,  // moderate effect-site equilibration
  V1: 5.8,
  EC50: 0.001,  // ng/mL (competitive antagonism)
  gamma: 1.0,  // linear competitive inhibition
  unit: 'mg',
};

// Flumazenil - Benzodiazepine reversal agent (competitive antagonist)
// t1/2 ~40-80 min, shorter than midazolam -> renarcotization risk
export const flumazenil: DrugParams = {
  name: 'Flumazenil',
  color: '#14b8a6',  // teal
  k10: 0.138,  // t1/2 ~60 min
  k12: 0.18,
  k13: 0,  // simplified 2-compartment
  k21: 0.06,
  k31: 0,
  ke0: 0.15,
  V1: 6.5,
  EC50: 0.02,  // mcg/mL (competitive antagonism)
  gamma: 1.0,
  unit: 'mg',
};


// Etomidate - Induction agent for RSI scenarios
// Preserves hemodynamics, causes myoclonus, simple Arden model
export const etomidate: DrugParams = {
  name: 'Etomidate',
  color: '#8b5cf6',  // violet
  k10: 0.071,
  k12: 0.28,
  k13: 0.12,
  k21: 0.042,
  k31: 0.017,
  ke0: 0.26,
  V1: 13.5,
  EC50: 0.3,  // mcg/mL for sedation
  gamma: 2.2,
  unit: 'mg',
};

// Nitrous Oxide - Inhaled sedation for dental procedures
// Different PK: wash-in/wash-out via alveolar ventilation
// Simplified model using wash-in/wash-out kinetics
export const nitrousOxide: DrugParams = {
  name: 'Nitrous Oxide',
  color: '#60a5fa',  // light blue
  k10: 0.4,  // fast wash-out via ventilation
  k12: 0,  // minimal tissue distribution (low blood/gas solubility)
  k13: 0,
  k21: 0,
  k31: 0,
  ke0: 0.8,  // very fast equilibration (low blood/gas partition coefficient)
  V1: 70.0,  // large "volume" (FRC)
  EC50: 40.0,  // % concentration for sedation (MAC-awake ~60%)
  gamma: 1.5,
  unit: '%',  // percentage concentration
};

// ============================================
// LOCAL ANESTHETICS
// Local injection -> systemic absorption via 3-compartment PK
// k12 models distribution to peripheral compartments
// k10 models systemic elimination
// Epinephrine slows systemic absorption (lower k12)

// 2% Lidocaine with 1:100,000 Epinephrine
// 20mg/mL, 1.8mL cartridge = 36mg per cartridge
// Max dose: 7mg/kg with epi (4.5mg/kg without)
// Toxic plasma level: >5 mcg/mL
export const lidocaine_epi: DrugParams = {
  name: 'Lidocaine 2% + Epi',
  color: '#ef4444',  // red
  k10: 0.012,   // hepatic elimination t1/2 ~96 min
  k12: 0.008,   // slow absorption from local tissue depot (epi vasoconstriction)
  k13: 0.001,   // minimal deep peripheral
  k21: 0.025,   // tissue->central redistribution
  k31: 0.001,
  ke0: 0.05,    // slow equilibration to effect site (tissue block)
  V1: 90.0,     // large Vd for local tissue depot (apparent volume)
  EC50: 5.0,    // mcg/mL (toxic threshold used as reference)
  gamma: 2.0,
  unit: 'mg',
};

// 4% Articaine with 1:100,000 Epinephrine
// 40mg/mL, 1.8mL cartridge = 72mg per cartridge
// Max dose: 7mg/kg
// Toxic plasma level: >5 mcg/mL
// Faster onset, shorter duration than lidocaine
// Unique: ester linkage allows tissue hydrolysis
export const articaine_epi: DrugParams = {
  name: 'Articaine 4% + Epi',
  color: '#f97316',  // orange
  k10: 0.025,   // faster elimination than lidocaine (ester hydrolysis) t1/2 ~27 min
  k12: 0.010,   // slightly faster absorption (better tissue penetration)
  k13: 0.001,
  k21: 0.030,   // faster redistribution
  k31: 0.001,
  ke0: 0.08,    // faster onset than lidocaine
  V1: 85.0,     // large Vd for local tissue depot
  EC50: 5.0,    // mcg/mL toxic threshold
  gamma: 2.0,
  unit: 'mg',
};

// 0.5% Bupivacaine (plain, no epinephrine)
// 5mg/mL, 1.8mL cartridge = 9mg per cartridge
// Max dose: 2mg/kg (1.3mg/kg for dental blocks)
// Toxic plasma level: >1.5 mcg/mL (more cardiotoxic)
// Long duration, slow onset
export const bupivacaine: DrugParams = {
  name: 'Bupivacaine 0.5%',
  color: '#ec4899',  // pink
  k10: 0.006,   // very slow elimination t1/2 ~210 min
  k12: 0.015,   // faster absorption (no epi)
  k13: 0.002,   // more peripheral distribution
  k21: 0.018,   // slow redistribution (high protein binding)
  k31: 0.001,
  ke0: 0.03,    // slow onset
  V1: 70.0,     // large Vd (lipophilic)
  EC50: 1.5,    // mcg/mL (lower toxic threshold - cardiotoxic)
  gamma: 3.0,   // steep dose-response for toxicity
  unit: 'mg',
};

// Local anesthetic metadata for UI and safety calculations
export interface LAMeta {
  mgPerMl: number;         // concentration in mg/mL
  mlPerCartridge: number;  // standard dental cartridge volume
  mgPerCartridge: number;  // mg per cartridge
  maxDosePerKg: number;    // mg/kg max recommended dose
  toxicPlasmaLevel: number; // mcg/mL plasma level for systemic toxicity
  hasEpi: boolean;          // contains epinephrine
  epiConcentration: string; // e.g. '1:100,000'
  onsetMinutes: number;     // typical onset time
  durationMinutes: number;  // typical duration
}

export const LA_META: Record<string, LAMeta> = {
  lidocaine_epi: {
    mgPerMl: 20,
    mlPerCartridge: 1.8,
    mgPerCartridge: 36,
    maxDosePerKg: 7.0,
    toxicPlasmaLevel: 5.0,
    hasEpi: true,
    epiConcentration: '1:100,000',
    onsetMinutes: 3,
    durationMinutes: 60,
  },
  articaine_epi: {
    mgPerMl: 40,
    mlPerCartridge: 1.8,
    mgPerCartridge: 72,
    maxDosePerKg: 7.0,
    toxicPlasmaLevel: 5.0,
    hasEpi: true,
    epiConcentration: '1:100,000',
    onsetMinutes: 2,
    durationMinutes: 45,
  },
  bupivacaine: {
    mgPerMl: 5,
    mlPerCartridge: 1.8,
    mgPerCartridge: 9,
    maxDosePerKg: 1.3,
    toxicPlasmaLevel: 1.5,
    hasEpi: false,
    epiConcentration: 'none',
    onsetMinutes: 6,
    durationMinutes: 240,
  },
};

export const LA_DRUG_KEYS = Object.keys(LA_META);

export const DRUG_DATABASE: Record<string, DrugParams> = {
  propofol,
  midazolam,
  fentanyl,
  ketamine,
    dexmedetomidine,
  lidocaine_epi,
  articaine_epi,
  bupivacaine,
};

export const DRUG_LIST = Object.values(DRUG_DATABASE);
