/**
 * PV Loop Hemodynamic Validation Tests
 *
 * Validates EchoSim / FrankStarling PV-loop values against published
 * hemodynamic reference data and expected drug/intervention effects.
 *
 * Published reference ranges (Lang et al. JASE 2015; Rudski et al. JASE 2010):
 *   EDV  100–140 mL   ESV  30–65 mL   SV  60–80 mL   EF  55–75 %
 *
 * Drug effects:
 *   Propofol → vasodilation (dominant) → PV loop LEFT shift
 *   Fluid bolus → preload ↑ → PV loop RIGHT shift
 *   Cardiac arrest → minimal ejection → loop collapses
 */
import { describe, it, expect } from 'vitest';
import { computeVisualizationState } from '../store/useSimStore';
import type { Vitals, Patient, MOASSLevel } from '../types';

const NORMAL_VITALS: Vitals = {
  hr: 75,
  sbp: 120,
  dbp: 80,
  map: 93,
  rr: 14,
  spo2: 98,
  etco2: 38,
  rhythm: 'normal_sinus',
};

const HEALTHY_ADULT: Patient = {
  age: 35,
  weight: 75,
  height: 178,
  sex: 'M',
  asa: 1,
  drugSensitivity: 1.0,
};

const EMPTY_PK_STATES: Record<string, { ce: number; c1: number; c2: number; c3: number }> = {};
const MOASS_AWAKE = 5 as MOASSLevel;

// ── 1. Baseline normal hemodynamics ──────────────────────────────────────────

describe('Baseline hemodynamic values within published normal ranges', () => {
  const result = computeVisualizationState(
    NORMAL_VITALS,
    EMPTY_PK_STATES,
    HEALTHY_ADULT,
    MOASS_AWAKE,
    0,
    0.21,
    0,
  );
  const { vedv, vesv, sv, ef, peakSys } = result.frankStarlingPoint;

  it('EDV is within published normal range (100–140 mL)', () => {
    expect(vedv).toBeGreaterThanOrEqual(100);
    expect(vedv).toBeLessThanOrEqual(140);
  });

  it('ESV is within published normal range (30–65 mL)', () => {
    expect(vesv).toBeGreaterThanOrEqual(30);
    expect(vesv).toBeLessThanOrEqual(65);
  });

  it('SV is within published normal range (60–80 mL)', () => {
    expect(sv).toBeGreaterThanOrEqual(60);
    expect(sv).toBeLessThanOrEqual(80);
  });

  it('EF is within published normal range (55–75 %)', () => {
    expect(ef).toBeGreaterThanOrEqual(55);
    expect(ef).toBeLessThanOrEqual(75);
  });

  it('Peak systolic pressure is close to input SBP (within 10 %)', () => {
    expect(peakSys).toBeGreaterThanOrEqual(NORMAL_VITALS.sbp * 0.9);
    expect(peakSys).toBeLessThanOrEqual(NORMAL_VITALS.sbp * 1.1);
  });
});

// ── 2. Propofol → left shift ──────────────────────────────────────────────────

describe('Propofol reduces afterload → PV loop shifts left', () => {
  const baseline = computeVisualizationState(
    NORMAL_VITALS, EMPTY_PK_STATES, HEALTHY_ADULT, MOASS_AWAKE, 0, 0.21, 0,
  ).frankStarlingPoint;

  // Clinical propofol: Ce ≈ 3 mcg/mL (moderate induction dose)
  const withPropofol = computeVisualizationState(
    NORMAL_VITALS,
    { propofol: { ce: 3, c1: 3, c2: 1, c3: 0.5 } },
    HEALTHY_ADULT,
    MOASS_AWAKE,
    0,
    0.21,
    0,
  ).frankStarlingPoint;

  it('ESV decreases (left shift of ESV) with propofol', () => {
    expect(withPropofol.vesv).toBeLessThan(baseline.vesv);
  });

  it('EDV decreases (venodilation reduces preload) with propofol', () => {
    expect(withPropofol.vedv).toBeLessThan(baseline.vedv);
  });

  it('SV is maintained or improved (vasodilation benefits ejection)', () => {
    // SV should not fall >20 % from baseline (net vasodilation effect)
    expect(withPropofol.sv).toBeGreaterThan(baseline.sv * 0.8);
  });
});

// ── 3. Fluid bolus → right shift ─────────────────────────────────────────────

describe('IV fluid bolus increases preload → PV loop shifts right', () => {
  const baseline = computeVisualizationState(
    NORMAL_VITALS, EMPTY_PK_STATES, HEALTHY_ADULT, MOASS_AWAKE, 0, 0.21, 0,
  ).frankStarlingPoint;

  // 500 mL fluid bolus
  const afterFluid = computeVisualizationState(
    NORMAL_VITALS, EMPTY_PK_STATES, HEALTHY_ADULT, MOASS_AWAKE, 0, 0.21, 500,
  ).frankStarlingPoint;

  it('EDV increases with fluid loading (right shift)', () => {
    expect(afterFluid.vedv).toBeGreaterThan(baseline.vedv);
  });

  it('SV increases with fluid loading (Starling law)', () => {
    expect(afterFluid.sv).toBeGreaterThan(baseline.sv);
  });
});

// ── 4. Cardiac arrest → loop collapses ───────────────────────────────────────

describe('Cardiac arrest causes PV loop collapse', () => {
  const baseline = computeVisualizationState(
    NORMAL_VITALS, EMPTY_PK_STATES, HEALTHY_ADULT, MOASS_AWAKE, 0, 0.21, 0,
  ).frankStarlingPoint;

  const vfibVitals: Vitals = { ...NORMAL_VITALS, rhythm: 'ventricular_fibrillation', sbp: 0, hr: 0 };
  const asystoleVitals: Vitals = { ...NORMAL_VITALS, rhythm: 'asystole', sbp: 0, hr: 0 };
  const peaVitals: Vitals = { ...NORMAL_VITALS, rhythm: 'pea', sbp: 40, hr: 50 };

  it('VFib: SV collapses to near-zero (< 10 mL)', () => {
    const result = computeVisualizationState(
      vfibVitals, EMPTY_PK_STATES, HEALTHY_ADULT, MOASS_AWAKE, 0, 0.21, 0,
    ).frankStarlingPoint;
    expect(result.sv).toBeLessThan(10);
    expect(result.sv).toBeLessThan(baseline.sv * 0.15);
  });

  it('Asystole: SV collapses to near-zero (< 10 mL)', () => {
    const result = computeVisualizationState(
      asystoleVitals, EMPTY_PK_STATES, HEALTHY_ADULT, MOASS_AWAKE, 0, 0.21, 0,
    ).frankStarlingPoint;
    expect(result.sv).toBeLessThan(10);
  });

  it('PEA: SV collapses to near-zero (< 10 mL)', () => {
    const result = computeVisualizationState(
      peaVitals, EMPTY_PK_STATES, HEALTHY_ADULT, MOASS_AWAKE, 0, 0.21, 0,
    ).frankStarlingPoint;
    expect(result.sv).toBeLessThan(10);
  });

  it('EF collapses to < 10 % in VFib', () => {
    const result = computeVisualizationState(
      vfibVitals, EMPTY_PK_STATES, HEALTHY_ADULT, MOASS_AWAKE, 0, 0.21, 0,
    ).frankStarlingPoint;
    expect(result.ef).toBeLessThan(10);
  });
});

// ── 5. EchoParams contract test ────────────────────────────────────────────────

describe('EchoParams are within physiological bounds', () => {
  const { echoParams } = computeVisualizationState(
    NORMAL_VITALS, EMPTY_PK_STATES, HEALTHY_ADULT, MOASS_AWAKE, 0, 0.21, 0,
  );

  it('Preload is physiological (40–200 mmHg equivalent)', () => {
    expect(echoParams.preload).toBeGreaterThanOrEqual(40);
    expect(echoParams.preload).toBeLessThanOrEqual(200);
  });

  it('Afterload is physiological (40–200 mmHg equivalent)', () => {
    expect(echoParams.afterload).toBeGreaterThanOrEqual(40);
    expect(echoParams.afterload).toBeLessThanOrEqual(200);
  });

  it('Contractility is normalised (0.3–2.0)', () => {
    expect(echoParams.contractility).toBeGreaterThanOrEqual(0.3);
    expect(echoParams.contractility).toBeLessThanOrEqual(2.0);
  });
});
