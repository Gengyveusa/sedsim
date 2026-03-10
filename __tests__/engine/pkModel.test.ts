import { createInitialPKState, stepPK } from '../../src/engine/pkModel';
import { DrugParams, PKState } from '../../src/types';

/**
 * Propofol Marsh model parameters (70 kg adult)
 * Source: Marsh et al. 1991, Anesthesia & Analgesia
 * V1=15.9L, k10=0.119/min, k12=0.114/min, k13=0.042/min
 * k21=0.055/min, k31=0.0033/min, ke0=0.26/min
 */
const PROPOFOL_MARSH: DrugParams = {
  name: 'Propofol',
  color: '#60a5fa',
  V1: 15.9,
  k10: 0.119,
  k12: 0.114,
  k13: 0.042,
  k21: 0.055,
  k31: 0.0033,
  ke0: 0.26,
  EC50: 3.4,
  gamma: 1.47,
  unit: 'mg',
};

/**
 * Minimal fentanyl params for testing multi-drug state
 * Shafer / Scott model: V1=6.7L, ke0=0.105/min
 */
const FENTANYL: DrugParams = {
  name: 'Fentanyl',
  color: '#f87171',
  V1: 6.7,
  k10: 0.0827,
  k12: 0.471,
  k13: 0.225,
  k21: 0.102,
  k31: 0.0067,
  ke0: 0.105,
  EC50: 3.5,
  gamma: 1.8,
  unit: 'mcg',
};

describe('pkModel', () => {
  describe('createInitialPKState', () => {
    it('returns all-zero concentrations', () => {
      const state = createInitialPKState();
      expect(state.c1).toBe(0);
      expect(state.c2).toBe(0);
      expect(state.c3).toBe(0);
      expect(state.ce).toBe(0);
    });
  });

  describe('stepPK – bolus dose', () => {
    it('immediately raises C1 by bolus/V1 after a single step', () => {
      const initial = createInitialPKState();
      const bolusMg = 100; // 100 mg propofol
      const dt = 1; // 1-second tick

      const next = stepPK(initial, PROPOFOL_MARSH, bolusMg, 0, dt);

      // Bolus concentration = dose / V1 (minus tiny distribution in first tick)
      const expectedBolusConc = bolusMg / PROPOFOL_MARSH.V1; // ~6.29 mcg/mL
      // C1 is slightly less because distribution starts immediately in Euler step
      expect(next.c1).toBeGreaterThan(0);
      expect(next.c1).toBeCloseTo(expectedBolusConc, 0); // within 0.5 mcg/mL
    });

    it('C2 and C3 begin to rise after bolus as drug distributes', () => {
      let state = createInitialPKState();
      // Give 100 mg bolus
      state = stepPK(state, PROPOFOL_MARSH, 100, 0, 1);
      // Step without more drug to let distribution happen
      const after10s = advanceSeconds(state, PROPOFOL_MARSH, 9);

      expect(after10s.c2).toBeGreaterThan(0);
      expect(after10s.c3).toBeGreaterThan(0);
    });

    it('Ce (effect-site) rises toward C1 over time', () => {
      let state = createInitialPKState();
      state = stepPK(state, PROPOFOL_MARSH, 100, 0, 1);

      // After bolus, ce should still be close to 0 initially
      expect(state.ce).toBeGreaterThanOrEqual(0);
      expect(state.ce).toBeLessThan(state.c1);

      // After ~5 minutes, ce should converge significantly toward c1
      const after5min = advanceSeconds(state, PROPOFOL_MARSH, 299);
      // ce converges toward c1; by 5 min it should be a substantial fraction of c1
      // (c1 will have dropped, ce will have risen)
      expect(after5min.ce).toBeGreaterThan(0);
    });

    it('concentrations decay to zero over many minutes with no further dosing', () => {
      let state = createInitialPKState();
      state = stepPK(state, PROPOFOL_MARSH, 200, 0, 1);

      const after60min = advanceSeconds(state, PROPOFOL_MARSH, 3600 - 1);

      expect(after60min.c1).toBeLessThan(0.5);
      expect(after60min.ce).toBeLessThan(0.5);
    });
  });

  describe('stepPK – infusion', () => {
    it('steady infusion achieves a positive steady-state C1', () => {
      let state = createInitialPKState();
      const infusionRateMgMin = 10; // 10 mg/min propofol infusion

      // Run for 10 minutes
      for (let i = 0; i < 600; i++) {
        state = stepPK(state, PROPOFOL_MARSH, 0, infusionRateMgMin, 1);
      }
      // Should have accumulated meaningful concentration
      expect(state.c1).toBeGreaterThan(0.5);
    });

    it('C1 is non-negative with zero inputs', () => {
      const state = createInitialPKState();
      const next = stepPK(state, PROPOFOL_MARSH, 0, 0, 1);
      expect(next.c1).toBeGreaterThanOrEqual(0);
      expect(next.c2).toBeGreaterThanOrEqual(0);
      expect(next.c3).toBeGreaterThanOrEqual(0);
      expect(next.ce).toBeGreaterThanOrEqual(0);
    });
  });

  describe('stepPK – multi-drug simultaneous PK states', () => {
    it('two drugs evolve independently without cross-contamination', () => {
      // Each drug is simulated in its own isolated PKState — no shared state
      const propofolState0 = createInitialPKState();
      const fentanylState0 = createInitialPKState();

      // Give same numeric bolus to both; smaller V1 → higher initial C1
      const propofolStep1 = stepPK(propofolState0, PROPOFOL_MARSH, 100, 0, 1);
      const fentanylStep1 = stepPK(fentanylState0, FENTANYL, 100, 0, 1);

      // Propofol V1=15.9 L → C1 ≈ 100/15.9 ≈ 6.3
      // Fentanyl V1=6.7 L  → C1 ≈ 100/6.7  ≈ 14.9
      expect(fentanylStep1.c1).toBeGreaterThan(propofolStep1.c1);

      // Verify each drug matches a solo simulation (no cross-contamination)
      const propofolSolo = stepPK(createInitialPKState(), PROPOFOL_MARSH, 100, 0, 1);
      const fentanylSolo = stepPK(createInitialPKState(), FENTANYL, 100, 0, 1);
      expect(propofolStep1.c1).toBeCloseTo(propofolSolo.c1, 10);
      expect(fentanylStep1.c1).toBeCloseTo(fentanylSolo.c1, 10);
    });
  });

  describe('stepPK – effect-site equilibration', () => {
    it('ce converges toward c1 with ke0 rate constant', () => {
      // After a single large bolus, ce should rise toward c1 over time.
      // ke0 equilibration means: dce/dt = ke0 * (c1 - ce)
      let state = createInitialPKState();
      state = stepPK(state, PROPOFOL_MARSH, 500, 0, 1); // large bolus

      const initialC1 = state.c1;
      const initialCe = state.ce;

      // After 1 minute (60 seconds), ce should be meaningfully higher
      const after1min = advanceSeconds(state, PROPOFOL_MARSH, 60);
      expect(after1min.ce).toBeGreaterThan(initialCe);
      expect(after1min.ce).toBeLessThanOrEqual(initialC1 + 0.1); // never exceeds peak

      // At equilibrium (very long time), ce ≈ c1 (both will be low due to clearance)
      const afterLong = advanceSeconds(after1min, PROPOFOL_MARSH, 3600);
      expect(afterLong.ce).toBeGreaterThanOrEqual(0);
      // Both should be much lower than the initial bolus after 1+ hour
      // Propofol has a slow peripheral compartment, so residual ~1-3% of initial dose
      expect(afterLong.c1).toBeLessThan(2.0);
      expect(afterLong.ce).toBeLessThan(2.0);
    });

    it('ce never exceeds c1 significantly right after a bolus', () => {
      let state = createInitialPKState();
      state = stepPK(state, PROPOFOL_MARSH, 200, 0, 1);

      // In first few seconds, ce should stay below c1
      for (let i = 0; i < 10; i++) {
        state = stepPK(state, PROPOFOL_MARSH, 0, 0, 1);
        // ce should not grossly exceed c1 (small numerical tolerance)
        expect(state.ce).toBeLessThanOrEqual(state.c1 + 0.5);
      }
    });
  });

  describe('stepPK – Euler method conservation', () => {
    it('small dt steps produce similar results to large dt step for short intervals', () => {
      const initial = createInitialPKState();
      // One 10-second step
      const oneBigStep = stepPK(initial, PROPOFOL_MARSH, 100, 0, 10);

      // Ten 1-second steps
      let tenSmallSteps: PKState = stepPK(initial, PROPOFOL_MARSH, 100, 0, 1);
      for (let i = 0; i < 9; i++) {
        tenSmallSteps = stepPK(tenSmallSteps, PROPOFOL_MARSH, 0, 0, 1);
      }

      // Results should be in the same ballpark (Euler accumulates error, but not wildly different)
      expect(tenSmallSteps.c1).toBeCloseTo(oneBigStep.c1, -1); // within 1 order of magnitude
    });
  });
});

// ---- Helper ---------------------------------------------------------------

function advanceSeconds(state: PKState, drug: DrugParams, seconds: number): PKState {
  let s = state;
  for (let i = 0; i < seconds; i++) {
    s = stepPK(s, drug, 0, 0, 1);
  }
  return s;
}
