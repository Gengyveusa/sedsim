import { DrugParams, PKState } from '../types';

/**
 * 3-Compartment Pharmacokinetic Model
 * Uses Euler method integration with dt=1s steps
 * Based on Marsh (propofol) / standard 3-compartment models
 */

export function createInitialPKState(): PKState {
  return { c1: 0, c2: 0, c3: 0, ce: 0 };
}

/**
 * Advance PK state by dt seconds using Euler method
 * @param state Current concentrations
 * @param drug Drug parameters (rate constants)
 * @param bolusAmount Amount added this tick (mg or mcg in V1)
 * @param infusionRate Continuous infusion rate (mg/min or mcg/min into V1)
 * @param dt Time step in seconds
 */
export function stepPK(
  state: PKState,
  drug: DrugParams,
  bolusAmount: number,
  infusionRate: number,
  dt: number
): PKState {
  const { k10, k12, k13, k21, k31, ke0, V1 } = drug;
  const { c1, c2, c3, ce } = state;
  const dtMin = dt / 60; // convert to minutes for rate constants

  // Bolus: instantaneous addition to central compartment
  const bolusConc = bolusAmount / V1;

  // Infusion: continuous addition (rate is per minute)
  const infusionConc = (infusionRate * dtMin) / V1;

  // 3-compartment differential equations (per minute rate constants)
  const dc1 = (-k10 * c1 - k12 * c1 + k21 * c2 - k13 * c1 + k31 * c3) * dtMin;
  const dc2 = (k12 * c1 - k21 * c2) * dtMin;
  const dc3 = (k13 * c1 - k31 * c3) * dtMin;

  // Effect-site equilibration
  const dce = ke0 * (c1 - ce) * dtMin;

  return {
    c1: Math.max(0, c1 + dc1 + bolusConc + infusionConc),
    c2: Math.max(0, c2 + dc2),
    c3: Math.max(0, c3 + dc3),
    ce: Math.max(0, ce + dce),
  };
}