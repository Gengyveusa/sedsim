// =================================================================
// src/engine/petalsDerivation.ts
// Pure function: PD + physiology + vitals -> PETALS gauge values
// PETALS = Pain, Emesis/sedation, Tone, Autonomics, Level, SpO2
// Each gauge: 0 = optimal, 1 = maximally abnormal
// Called once per tick inside simulationTick.ts
// =================================================================

import type {
  PetalsGauges, PharmacodynamicState, PhysiologyState, VitalsDisplay
} from '../types/SimulationState';

// --- Helper: normalise a vital toward a "good" range ---
function vitalDeviation(
  value: number, idealLow: number, idealHigh: number,
  dangerLow: number, dangerHigh: number
): number {
  if (value >= idealLow && value <= idealHigh) return 0;
  if (value < idealLow) {
    return Math.min(1, (idealLow - value) / Math.max(1, idealLow - dangerLow));
  }
  return Math.min(1, (value - idealHigh) / Math.max(1, dangerHigh - idealHigh));
}

export function derivePetalsGauges(
  pd: PharmacodynamicState,
  physiology: PhysiologyState,
  vitals: VitalsDisplay
): PetalsGauges {
  const cv = physiology.cardiovascular;
  const resp = physiology.respiratory;

  // ---- Pain (0 = no pain, 1 = severe uncontrolled pain) ----
  // Inverse of analgesia: if analgesia is high, pain gauge is low
  const pain = Math.max(0, Math.min(1, 1 - pd.analgesiaLevel));

  // ---- Sedation (0 = appropriate, 1 = dangerously over-sedated) ----
  // Directly maps to sedation depth
  const sedation = Math.min(1, pd.sedationDepth);

  // ---- Respiration (0 = normal, 1 = critical depression) ----
  const rrDev = vitalDeviation(vitals.rr, 10, 20, 4, 35);
  const etco2Dev = vitalDeviation(vitals.etco2, 30, 45, 15, 70);
  const respDep = resp.respiratoryDriveDepression;
  const respiration = Math.min(1, Math.max(rrDev, etco2Dev, respDep * 0.8));

  // ---- Hemodynamics (0 = stable, 1 = shock) ----
  const mapDev = vitalDeviation(vitals.map, 65, 105, 40, 140);
  const hrDev = vitalDeviation(vitals.hr, 55, 100, 35, 160);
  const hemodynamics = Math.min(1, Math.max(mapDev, hrDev * 0.7));

  // ---- Oxygenation (0 = normal, 1 = critical hypoxemia) ----
  const spo2Dev = vitalDeviation(vitals.spo2, 94, 100, 80, 100);
  const oxygenation = Math.min(1, spo2Dev);

  // ---- Consciousness / Level of sedation (0 = awake, 1 = unresponsive) ----
  // Composite of sedation depth + BIS proxy
  const bisNorm = Math.max(0, (100 - pd.bisProxy) / 60); // BIS 100->0, BIS 40->1
  const consciousness = Math.min(1, (pd.sedationDepth * 0.6 + bisNorm * 0.4));

  return {
    pain,
    sedation,
    respiration,
    hemodynamics,
    oxygenation,
    consciousness,
  };
}
