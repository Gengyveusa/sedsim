import { PKState, Vitals, Patient, MOASSLevel, DrugParams } from '../types';
import { stepPK } from './pkModel';
import { combinedEffect, effectToMOASS, hillEffect } from './pdModel';
import { calculateVitals } from './physiology';
import { DRUG_DATABASE } from './drugs';

export interface PredictionSnapshot {
  secondsAhead: number;
  ceByDrug: Record<string, number>;      // effect-site concentrations
  effectByDrug: Record<string, number>;   // Hill effect 0-1 per drug
  combinedEff: number;
  moass: MOASSLevel;
  spo2: number;
  rr: number;
}

/**
 * Run simulation forward from current state. Pure function — no side effects.
 * Returns snapshots at specified time points.
 *
 * @param sampleTimes - seconds ahead to snapshot (e.g. [30, 60, 120, 300, 600])
 * @param ghostBolus - optional hypothetical dose to apply at t=0
 */
export function predictForward(
  currentPK: Record<string, PKState>,
  infusions: Record<string, { rate: number; isRunning: boolean }>,
  patient: Patient,
  fio2: number,
  prevVitals: Vitals,
  sampleTimes: number[] = [30, 60, 120, 300, 600],
  ghostBolus?: { drugName: string; dose: number }
): PredictionSnapshot[] {
  const snapshots: PredictionSnapshot[] = [];
  const sortedTimes = [...sampleTimes].sort((a, b) => a - b);
  const maxTime = sortedTimes[sortedTimes.length - 1];

  // Deep copy current PK states
  let simPK: Record<string, PKState> = {};
  for (const [name, state] of Object.entries(currentPK)) {
    simPK[name] = { c1: state.c1, c2: state.c2, c3: state.c3, ce: state.ce };
  }

  // Apply ghost bolus at t=0
  if (ghostBolus && DRUG_DATABASE[ghostBolus.drugName]) {
    const drug = DRUG_DATABASE[ghostBolus.drugName];
    simPK[ghostBolus.drugName] = stepPK(
      simPK[ghostBolus.drugName], drug, ghostBolus.dose, 0, 1
    );
  }

  let simVitals = { ...prevVitals };
  let nextSampleIdx = 0;

  for (let t = 1; t <= maxTime && nextSampleIdx < sortedTimes.length; t++) {
    // Advance all drugs by 1 second
    const newPK: Record<string, PKState> = {};
    for (const [name, state] of Object.entries(simPK)) {
      const drug = DRUG_DATABASE[name];
      if (!drug) { newPK[name] = state; continue; }
      const infRate = infusions[name]?.isRunning ? infusions[name].rate : 0;
      newPK[name] = stepPK(state, drug, 0, infRate, 1);
    }
    simPK = newPK;

    if (t === sortedTimes[nextSampleIdx]) {
      // Calculate effects at this snapshot
      const ceByDrug: Record<string, number> = {};
      const effectByDrug: Record<string, number> = {};
      const drugEffects: { drug: DrugParams; ce: number }[] = [];

      for (const [name, state] of Object.entries(simPK)) {
        const drug = DRUG_DATABASE[name];
        if (!drug) continue;
        ceByDrug[name] = state.ce;
        const eff = hillEffect(state.ce, drug.EC50, drug.gamma);
        effectByDrug[name] = eff;
        drugEffects.push({ drug, ce: state.ce });
      }

      const comb = combinedEffect(drugEffects);
      // Only compute vitals every ~30s to save CPU (or at each sample point)
      simVitals = calculateVitals(simPK, patient, simVitals, fio2);

      snapshots.push({
        secondsAhead: t,
        ceByDrug,
        effectByDrug,
        combinedEff: comb,
        moass: effectToMOASS(comb),
        spo2: simVitals.spo2,
        rr: simVitals.rr,
      });
      nextSampleIdx++;
    }
  }

  return snapshots;
}
