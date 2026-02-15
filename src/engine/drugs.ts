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
  EC50: 0.15,  // mcg/mL
  gamma: 3.0,
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
  EC50: 0.003,  // mcg/mL (3 ng/mL)
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

export const DRUG_DATABASE: Record<string, DrugParams> = {
  propofol,
  midazolam,
  fentanyl,
  ketamine,
};

export const DRUG_LIST = Object.values(DRUG_DATABASE);