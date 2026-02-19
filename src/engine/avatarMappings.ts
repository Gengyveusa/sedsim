/**
 * avatarMappings.ts
 * 
 * Patient-phenotype-aware visual state mappings for PhysiologyAvatar.
 * Derives avatar visual parameters from:
 *   1. The Patient archetype (phenotype-specific baseline modifiers)
 *   2. Real-time cardio/respiratory state computed in computeCardioState()
 * 
 * The avatar reads these to render phenotype-specific visual cues such as:
 *   - Obese/OSA: narrower airway, thicker chest wall
 *   - COPD: hyperinflated lungs, CO2 retention indicator
 *   - Elderly: stiffer LV, reduced contractility
 *   - HCM: thickened septum/walls, small LV cavity
 *   - DCM: dilated chambers, thin walls, reduced EF
 *   - Hepatic/Renal: clearance badges
 */

import { Patient } from '../types';

// ─── Phenotype classification ────────────────────────────────────────────────

export type Phenotype =
  | 'healthy'
  | 'elderly'
  | 'obese_osa'
  | 'copd'
  | 'hepatic'
  | 'renal'
  | 'anxious'
  | 'pediatric'
  | 'hcm'
  | 'dcm';

/**
 * Derive a phenotype tag from Patient demographics.
 * Uses the archetype key when available; falls back to heuristics.
 */
export function classifyPhenotype(patient: Patient, archetypeKey?: string): Phenotype {
  if (archetypeKey) {
    if (archetypeKey.startsWith('hcm')) return 'hcm';
    if (archetypeKey.startsWith('dcm')) return 'dcm';
    if (archetypeKey === 'obese_osa') return 'obese_osa';
    if (archetypeKey === 'elderly') return 'elderly';
    if (archetypeKey === 'hepatic') return 'hepatic';
    if (archetypeKey === 'anxious_young') return 'anxious';
    if (archetypeKey === 'pediatric') return 'pediatric';
    if (archetypeKey === 'healthy_adult') return 'healthy';
  }
  // Heuristic fallback
  if (patient.osa) return 'obese_osa';
  if (patient.copd) return 'copd';
  if (patient.hepaticImpairment) return 'hepatic';
  if (patient.renalImpairment) return 'renal';
  if (patient.age >= 70) return 'elderly';
  if (patient.age <= 18) return 'pediatric';
  return 'healthy';
}

// ─── Phenotype-specific baseline modifiers ───────────────────────────────────

export interface PhenotypeModifiers {
  // Heart
  baselineContractilityMod: number;   // multiplier on contractility (1 = normal)
  wallThicknessMod: number;           // multiplier on LV wall thickness
  chamberDilationMod: number;         // multiplier on LV/RV radius
  septumThicknessMod: number;         // multiplier on septum width

  // Lungs
  lungInflationMod: number;           // 1 = normal, >1 = hyperinflated (COPD)
  baselineCO2RetentionMod: number;    // additive mmHg shift on EtCO2 baseline

  // Airway
  airwayNarrowingFactor: number;      // 0 = fully patent, 1 = maximally narrowed
  chestWallThicknessMod: number;      // multiplier on chest wall visual

  // Clearance badges (for annotation display)
  showHepaticBadge: boolean;
  showRenalBadge: boolean;
  showOSABadge: boolean;
  showCOPDBadge: boolean;

  // Label
  phenotypeLabel: string;
  phenotypeColor: string;             // accent color for phenotype badge
}

const DEFAULT_MODS: PhenotypeModifiers = {
  baselineContractilityMod: 1.0,
  wallThicknessMod: 1.0,
  chamberDilationMod: 1.0,
  septumThicknessMod: 1.0,
  lungInflationMod: 1.0,
  baselineCO2RetentionMod: 0,
  airwayNarrowingFactor: 0,
  chestWallThicknessMod: 1.0,
  showHepaticBadge: false,
  showRenalBadge: false,
  showOSABadge: false,
  showCOPDBadge: false,
  phenotypeLabel: 'Healthy Adult',
  phenotypeColor: '#22c55e',
};

export function getPhenotypeModifiers(phenotype: Phenotype): PhenotypeModifiers {
  switch (phenotype) {
    case 'healthy':
      return { ...DEFAULT_MODS };

    case 'elderly':
      return {
        ...DEFAULT_MODS,
        baselineContractilityMod: 0.80,   // reduced reserve
        wallThicknessMod: 1.25,           // age-related LVH
        chamberDilationMod: 1.05,
        septumThicknessMod: 1.15,
        lungInflationMod: 0.92,           // slightly reduced compliance
        airwayNarrowingFactor: 0.10,
        phenotypeLabel: 'Elderly \u2013 Reduced Reserve',
        phenotypeColor: '#f59e0b',
      };

    case 'obese_osa':
      return {
        ...DEFAULT_MODS,
        baselineContractilityMod: 0.90,
        wallThicknessMod: 1.10,
        chamberDilationMod: 1.08,
        lungInflationMod: 0.85,           // reduced FRC from weight
        airwayNarrowingFactor: 0.45,      // significant upper airway narrowing
        chestWallThicknessMod: 1.5,       // thick chest wall overlay
        showOSABadge: true,
        phenotypeLabel: 'Obese + OSA',
        phenotypeColor: '#f97316',
      };

    case 'copd':
      return {
        ...DEFAULT_MODS,
        lungInflationMod: 1.35,           // hyperinflated lungs
        baselineCO2RetentionMod: 6,       // baseline CO2 retention (+6 mmHg)
        airwayNarrowingFactor: 0.25,
        showCOPDBadge: true,
        phenotypeLabel: 'COPD \u2013 Hyperinflation',
        phenotypeColor: '#3b82f6',
      };

    case 'hepatic':
      return {
        ...DEFAULT_MODS,
        baselineContractilityMod: 0.85,   // hepatic cardiomyopathy
        showHepaticBadge: true,
        phenotypeLabel: 'Hepatic Impairment',
        phenotypeColor: '#a855f7',
      };

    case 'renal':
      return {
        ...DEFAULT_MODS,
        chamberDilationMod: 1.10,         // fluid overload tendency
        showRenalBadge: true,
        phenotypeLabel: 'Renal Impairment',
        phenotypeColor: '#ec4899',
      };

    case 'anxious':
      return {
        ...DEFAULT_MODS,
        baselineContractilityMod: 1.10,   // catecholamine-driven
        phenotypeLabel: 'Anxious \u2013 Catecholamine State',
        phenotypeColor: '#eab308',
      };

    case 'pediatric':
      return {
        ...DEFAULT_MODS,
        baselineContractilityMod: 1.05,
        chamberDilationMod: 0.85,         // smaller heart
        lungInflationMod: 0.90,
        phenotypeLabel: 'Pediatric',
        phenotypeColor: '#06b6d4',
      };

    case 'hcm':
      return {
        ...DEFAULT_MODS,
        baselineContractilityMod: 1.20,   // hyperdynamic but stiff
        wallThicknessMod: 1.60,           // marked LVH
        chamberDilationMod: 0.80,         // small cavity
        septumThicknessMod: 1.80,         // asymmetric septal hypertrophy
        airwayNarrowingFactor: 0.05,
        phenotypeLabel: 'HCM \u2013 Hypertrophic',
        phenotypeColor: '#ef4444',
      };

    case 'dcm':
      return {
        ...DEFAULT_MODS,
        baselineContractilityMod: 0.55,   // severely reduced
        wallThicknessMod: 0.70,           // thin walls
        chamberDilationMod: 1.45,         // markedly dilated
        septumThicknessMod: 0.75,
        lungInflationMod: 0.95,
        phenotypeLabel: 'DCM \u2013 Dilated',
        phenotypeColor: '#dc2626',
      };

    default:
      return { ...DEFAULT_MODS };
  }
}

// ─── Runtime visual state (applied on top of cardioState) ────────────────────

export interface AvatarPhenotypeVisuals {
  // Computed heart visuals (modifiers applied to cardioState values)
  lvWallScale: number;
  lvChamberScale: number;
  rvChamberScale: number;
  septumWidthScale: number;
  contractilityScale: number;

  // Computed lung visuals
  lungInflationScale: number;
  co2RetentionShift: number;

  // Airway
  airwayWidthScale: number;    // 1 = fully open, 0 = closed
  chestWallScale: number;

  // Badge flags
  badges: string[];            // e.g. ['OSA', 'Hepatic']

  // Phenotype label + color
  label: string;
  color: string;
}

/**
 * Compute the final avatar phenotype visuals.
 * Called in PhysiologyAvatar whenever patient or cardioState changes.
 */
export function computePhenotypeVisuals(
  phenotype: Phenotype,
  combinedEff: number
): AvatarPhenotypeVisuals {
  const mods = getPhenotypeModifiers(phenotype);

  // Sedation worsens airway narrowing in OSA/obese patients
  const sedationAirwayEffect = phenotype === 'obese_osa'
    ? combinedEff * 0.35   // OSA patients lose airway tone faster
    : combinedEff * 0.15;

  const totalAirwayNarrowing = Math.min(1, mods.airwayNarrowingFactor + sedationAirwayEffect);

  // Collect badges
  const badges: string[] = [];
  if (mods.showOSABadge) badges.push('OSA');
  if (mods.showCOPDBadge) badges.push('COPD');
  if (mods.showHepaticBadge) badges.push('Hepatic');
  if (mods.showRenalBadge) badges.push('Renal');

  return {
    lvWallScale: mods.wallThicknessMod,
    lvChamberScale: mods.chamberDilationMod,
    rvChamberScale: mods.chamberDilationMod * 0.95,  // RV tracks LV loosely
    septumWidthScale: mods.septumThicknessMod,
    contractilityScale: mods.baselineContractilityMod,

    lungInflationScale: mods.lungInflationMod,
    co2RetentionShift: mods.baselineCO2RetentionMod,

    airwayWidthScale: 1 - totalAirwayNarrowing,
    chestWallScale: mods.chestWallThicknessMod,

    badges,
    label: mods.phenotypeLabel,
    color: mods.phenotypeColor,
  };
}
