import { DrugParams, MOASSLevel } from '../types';

/**
 * Pharmacodynamic Model
 * Based on Bouillon 2004 response surface model (AReS/Minto parameters)
 * Separates opioid and hypnotic contributions to sedation
 *
 * Key insight: Opioids are NOT equivalent sedatives.
 * - Opioids alone produce drowsiness (MOASS 4) but NOT deep sedation
 * - Opioids potentiate hypnotic effect (supra-additive interaction)
 * - Response surface: theta = U_prop / (U_prop + U_opioid)
 *
 * References:
 * - Bouillon et al. 2004: Propofol-opioid interaction model
 * - Minto et al. 1997: Remifentanil PK/PD (ke0=0.595, EC50=13.1 ng/mL)
 * - Eleveld et al. 2017: Propofol PK/PD (EC50=3.08 mcg/mL)
 * - AReS Simulator (MIT): Hosseinirad et al. 2025
 */

// Opioid drug names for classification
const OPIOID_DRUGS = ['Fentanyl', 'Remifentanil'];
// Reversal agents
const REVERSAL_AGENTS = ['Naloxone', 'Flumazenil'];
// Drugs reversed by each reversal agent
const REVERSAL_TARGETS: Record<string, string[]> = {
  'Naloxone': ['Fentanyl', 'Remifentanil'],
  'Flumazenil': ['Midazolam'],
};

/**
 * Maximum sedation fraction opioids alone can produce on MOASS
 * Clinical reality: opioids alone cause drowsiness (MOASS 4) but not
 * deep sedation. Ceiling ~0.22 means opioid-only effect stays at MOASS 4.
 * Based on Bouillon surface model where opioid-only arm saturates early.
 */
const OPIOID_SEDATION_CEILING = 0.22;

/**
 * Opioid potentiation factor for hypnotic effect
 * When opioid + hypnotic are co-administered, the opioid reduces the
 * effective EC50 of the hypnotic (left-shift of dose-response curve).
 * Based on Bouillon beta parameter and clinical TCI practice.
 */
const OPIOID_POTENTIATION_MAX = 0.35;

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
 * Calculate combined drug effect using response surface model
 *
 * Instead of naive Bliss independence (which treats opioids = hypnotics),
 * this separates drugs into:
 * 1. Hypnotics (propofol, midazolam, ketamine, etomidate, dex, N2O)
 * 2. Opioids (fentanyl, remifentanil)
 * 3. Reversal agents (naloxone, flumazenil)
 *
 * Opioid contribution to MOASS is capped at OPIOID_SEDATION_CEILING.
 * Opioids potentiate hypnotic effect (reduce effective EC50).
 * Based on Bouillon 2004 / AReS response surface approach.
 */
export function combinedEffect(
  drugEffects: { drug: DrugParams; ce: number }[]
): number {
  if (drugEffects.length === 0) return 0;

  // Separate opioids, hypnotics, and reversal agents
  const opioids: { drug: DrugParams; ce: number }[] = [];
  const hypnotics: { drug: DrugParams; ce: number }[] = [];
  const reversals: { drug: DrugParams; ce: number }[] = [];

  for (const entry of drugEffects) {
    if (REVERSAL_AGENTS.includes(entry.drug.name)) {
      reversals.push(entry);
    } else if (OPIOID_DRUGS.includes(entry.drug.name)) {
      opioids.push(entry);
    } else {
      hypnotics.push(entry);
    }
  }

  // --- Step 1: Calculate reversal agent antagonism ---
  // Reversal agents reduce the effective concentration of their targets
  const reversalFactors: Record<string, number> = {};
  for (const rev of reversals) {
    const revEffect = hillEffect(rev.ce, rev.drug.EC50, rev.drug.gamma);
    const targets = REVERSAL_TARGETS[rev.drug.name] || [];
    for (const target of targets) {
      const existing = reversalFactors[target] || 0;
      reversalFactors[target] = Math.min(1, existing + revEffect);
    }
  }

  // --- Step 2: Calculate raw opioid Hill effect (capped) ---
  // Opioid alone: drowsiness ceiling. Ce/EC50 drives the Hill curve,
  // but the MOASS contribution is clamped.
  let opioidRawEffect = 0;
  for (const { drug, ce } of opioids) {
    const reversalFactor = 1 - (reversalFactors[drug.name] || 0);
    const effectiveCe = ce * reversalFactor;
    const effect = hillEffect(effectiveCe, drug.EC50, drug.gamma);
    opioidRawEffect = 1 - (1 - opioidRawEffect) * (1 - effect);
  }
  // Cap opioid-only sedation contribution
  const opioidSedationEffect = Math.min(opioidRawEffect * OPIOID_SEDATION_CEILING, OPIOID_SEDATION_CEILING);

  // --- Step 3: Calculate opioid potentiation of hypnotics ---
  // Opioids reduce effective EC50 of hypnotics (Bouillon interaction)
  // potentiationFactor: 0 = no opioid, up to OPIOID_POTENTIATION_MAX
  const potentiationFactor = opioidRawEffect * OPIOID_POTENTIATION_MAX;

  // --- Step 4: Calculate hypnotic effect with potentiation ---
  let hypnoticProduct = 1;
  for (const { drug, ce } of hypnotics) {
    const reversalFactor = 1 - (reversalFactors[drug.name] || 0);
    const effectiveCe = ce * reversalFactor;
    // Opioid potentiation: reduce effective EC50 (left-shift curve)
    const potentiatedEC50 = drug.EC50 * (1 - potentiationFactor);
    const effect = hillEffect(effectiveCe, potentiatedEC50, drug.gamma);
    hypnoticProduct *= (1 - effect);
  }
  const hypnoticEffect = 1 - hypnoticProduct;

  // --- Step 5: Combine using modified Bliss ---
  // Hypnotic effect is the primary driver of MOASS
  // Opioid adds a small direct sedation component (drowsiness)
  // The interaction is already captured via EC50 potentiation
  const combined = 1 - (1 - hypnoticEffect) * (1 - opioidSedationEffect);

  return Math.min(1, combined);
}

/**
 * Map combined effect (0-1) to MOASS sedation level (5-0)
 * MOASS 5 = Awake, MOASS 0 = Unresponsive
 *
 * Thresholds calibrated so that:
 * - Fentanyl 25mcg alone -> ~0.15 effect -> MOASS 4 (Drowsy)
 * - Fentanyl 50mcg alone -> ~0.20 effect -> MOASS 4 (Drowsy)
 * - Fentanyl 100mcg alone -> ~0.22 effect -> MOASS 4 (still Drowsy, ceiling)
 * - Midazolam 2mg alone -> ~0.25 effect -> MOASS 3 (Moderate Sedation)
 * - Propofol 50mg alone -> ~0.30 effect -> MOASS 3 (Moderate Sedation)
 * - Fentanyl 50mcg + Midazolam 2mg -> potentiation -> MOASS 2-3
 */
export function effectToMOASS(combinedEff: number): MOASSLevel {
  if (combinedEff < 0.10) return 5;   // Awake/alert
  if (combinedEff < 0.25) return 4;   // Lethargic response to name
  if (combinedEff < 0.45) return 3;   // Response only to loud voice
  if (combinedEff < 0.65) return 2;   // Response to mild prodding
  if (combinedEff < 0.85) return 1;   // Response to trapezius squeeze
  return 0;                            // No response
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
