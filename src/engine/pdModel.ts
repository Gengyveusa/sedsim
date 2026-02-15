import { DrugParams, MOASSLevel } from '../types';

/**
 * Pharmacodynamic Model
 * Sigmoidal Emax (Hill equation) for drug effect
 * Maps effect-site concentration to clinical effect
 */

/**
 * Calculate fractional drug effect using Hill equation
 * E = Ce^gamma / (EC50^gamma + Ce^gamma)
 * Returns 0-1 representing no effect to maximum effect
 */
export function hillEffect(ce: number, EC50: number, gamma: number): number {
  if (ce <= 0) return 0;
  const ceG = Math.pow(ce, gamma);
  const ec50G = Math.pow(EC50, gamma);
  return ceG / (ec50G + ceG);
}

/**
 * Calculate combined drug effect from multiple drugs
 * Uses Bliss independence model for interaction
 * P(combined) = 1 - product(1 - P(individual))
 */
export function combinedEffect(
  drugEffects: { drug: DrugParams; ce: number }[]
): number {
  if (drugEffects.length === 0) return 0;

  let independentProduct = 1;
  for (const { drug, ce } of drugEffects) {
    const effect = hillEffect(ce, drug.EC50, drug.gamma);
    independentProduct *= (1 - effect);
  }
  return Math.min(1, 1 - independentProduct);
}

/**
 * Map combined effect (0-1) to MOASS sedation level (5-0)
 * MOASS 5 = Awake, MOASS 0 = Unresponsive
 */
export function effectToMOASS(combinedEff: number): MOASSLevel {
  if (combinedEff < 0.1) return 5;   // Awake/alert
  if (combinedEff < 0.25) return 4;  // Lethargic response to name
  if (combinedEff < 0.45) return 3;  // Response only to loud voice
  if (combinedEff < 0.65) return 2;  // Response to mild prodding
  if (combinedEff < 0.85) return 1;  // Response to trapezius squeeze
  return 0;                           // No response
}

/**
 * Get descriptive label for MOASS level
 */
export function moassLabel(level: MOASSLevel): string {
  const labels: Record<MOASSLevel, string> = {
    5: 'Awake / Alert',
    4: 'Drowsy',
    3: 'Moderate Sedation',
    2: 'Deep Sedation',
    1: 'General Anesthesia',
    0: 'Unresponsive',
  };
  return labels[level];
}