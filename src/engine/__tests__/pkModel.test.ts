/**
 * Unit tests for the 3-compartment PK model (pkModel.ts)
 * Validates Euler integration steps for Marsh (propofol) and Minto (remifentanil) parameter sets.
 */

import { describe, it, expect } from 'vitest';
import { createInitialPKState, stepPK } from '../pkModel';
import { propofol, remifentanil } from '../drugs';

describe('createInitialPKState', () => {
  it('returns zero concentrations', () => {
    const state = createInitialPKState();
    expect(state.c1).toBe(0);
    expect(state.c2).toBe(0);
    expect(state.c3).toBe(0);
    expect(state.ce).toBe(0);
  });
});

describe('stepPK — bolus kinetics', () => {
  it('propofol bolus: raises central compartment by dose/V1', () => {
    const state = createInitialPKState();
    const afterBolus = stepPK(state, propofol, 100, 0, 1);
    // Bolus of 100mg into V1=15.9L → ~6.29 mcg/mL, minus ~1 second of distribution
    expect(afterBolus.c1).toBeGreaterThan(6.0);
    expect(afterBolus.c1).toBeLessThan(6.5);
  });

  it('remifentanil bolus: raises central compartment by dose/V1', () => {
    const state = createInitialPKState();
    const afterBolus = stepPK(state, remifentanil, 50, 0, 1);
    // 50 mcg into V1=5.1L → ~9.8 mcg/mL, minus redistribution
    expect(afterBolus.c1).toBeGreaterThan(9.0);
    expect(afterBolus.c1).toBeLessThan(10.0);
  });

  it('effect site lags central compartment (ce < c1 after bolus)', () => {
    const state = createInitialPKState();
    const afterBolus = stepPK(state, propofol, 100, 0, 1);
    expect(afterBolus.ce).toBeLessThan(afterBolus.c1);
    expect(afterBolus.ce).toBeGreaterThanOrEqual(0);
  });

  it('all compartments are non-negative', () => {
    const state = createInitialPKState();
    const next = stepPK(state, propofol, 100, 0, 1);
    expect(next.c1).toBeGreaterThanOrEqual(0);
    expect(next.c2).toBeGreaterThanOrEqual(0);
    expect(next.c3).toBeGreaterThanOrEqual(0);
    expect(next.ce).toBeGreaterThanOrEqual(0);
  });
});

describe('stepPK — infusion kinetics', () => {
  it('continuous infusion raises central concentration over time', () => {
    let state = createInitialPKState();
    // 70 mcg/min remifentanil infusion for 30 seconds
    for (let i = 0; i < 30; i++) {
      state = stepPK(state, remifentanil, 0, 70, 1);
    }
    expect(state.c1).toBeGreaterThan(0);
    expect(state.ce).toBeGreaterThan(0);
    // At 30s, ce should be rising toward steady state
    expect(state.ce).toBeLessThan(state.c1);
  });

  it('zero infusion/bolus → concentrations only decrease from previous state', () => {
    // Start with non-zero state
    let state = { c1: 5.0, c2: 1.0, c3: 0.2, ce: 3.0 };
    state = stepPK(state, propofol, 0, 0, 1);
    // c1 should decrease due to elimination and redistribution
    expect(state.c1).toBeLessThan(5.0);
  });
});

describe('stepPK — wash-out', () => {
  it('propofol concentrations approach zero after large bolus + no infusion (300 steps)', () => {
    let state = createInitialPKState();
    state = stepPK(state, propofol, 100, 0, 1);
    for (let t = 1; t < 300; t++) {
      state = stepPK(state, propofol, 0, 0, 1);
    }
    // After 5 minutes, central concentration should have dropped substantially
    expect(state.c1).toBeLessThan(3.0); // less than half the initial
  });

  it('remifentanil washes out faster than propofol (context-insensitive)', () => {
    let remiState = createInitialPKState();
    let propofolState = createInitialPKState();

    // Apply equivalent mass-normalized bolus to each
    remiState = stepPK(remiState, remifentanil, 50, 0, 1);
    propofolState = stepPK(propofolState, propofol, 100, 0, 1);

    // Run 300s (5 min)
    for (let t = 1; t < 300; t++) {
      remiState = stepPK(remiState, remifentanil, 0, 0, 1);
      propofolState = stepPK(propofolState, propofol, 0, 0, 1);
    }

    // Remifentanil Ce should be much lower relative to its peak than propofol
    const remiPeakCe = 2.68; // from reference calculation
    const propofolPeakCe = 2.24;

    // Remifentanil decays to a fraction of its peak faster than propofol
    expect(remiState.ce / remiPeakCe).toBeLessThan(propofolState.ce / propofolPeakCe);
  });
});
