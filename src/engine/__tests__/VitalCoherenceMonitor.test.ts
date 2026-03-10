// src/engine/__tests__/VitalCoherenceMonitor.test.ts
// Unit tests for the detectCoherenceViolations pure function.
// Each test corresponds to one of the five cross-vital coherence rules.

import { describe, it, expect } from 'vitest';
import { detectCoherenceViolations } from '../VitalCoherenceMonitor';
import type { Vitals } from '../../types';

/** Helper that produces a physiologically normal set of vitals */
function normalVitals(overrides: Partial<Vitals> = {}): Vitals {
  return {
    hr: 75,
    sbp: 120,
    dbp: 80,
    map: 93,   // 80 + (120-80)/3 = 93.3 → 93 after rounding
    rr: 14,
    spo2: 99,
    etco2: 38,
    rhythm: 'normal_sinus',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rule 1 — SpO2 < 85 must correlate with RR depression (RR < 8)
// ---------------------------------------------------------------------------
describe('Rule 1 — SpO2/RR coherence', () => {
  it('detects violation when SpO2 < 85 and RR is normal (≥ 8)', () => {
    const vitals = normalVitals({ spo2: 82, rr: 14 });
    const violations = detectCoherenceViolations(vitals);
    const v = violations.find(v => v.rule === 'spo2_rr_coherence');
    expect(v).toBeDefined();
    expect(v!.severity).toBe('warning');
    expect(v!.message).toMatch(/SpO2 82%/);
    expect(v!.message).toMatch(/RR 14/);
  });

  it('fires at the boundary: SpO2 = 84, RR = 8 (still a violation)', () => {
    const vitals = normalVitals({ spo2: 84, rr: 8 });
    const violations = detectCoherenceViolations(vitals);
    expect(violations.find(v => v.rule === 'spo2_rr_coherence')).toBeDefined();
  });

  it('no violation when SpO2 < 85 and RR is also depressed (< 8)', () => {
    const vitals = normalVitals({ spo2: 82, rr: 5 });
    const violations = detectCoherenceViolations(vitals);
    expect(violations.find(v => v.rule === 'spo2_rr_coherence')).toBeUndefined();
  });

  it('no violation when SpO2 is in the normal range (≥ 85)', () => {
    const vitals = normalVitals({ spo2: 90, rr: 14 });
    const violations = detectCoherenceViolations(vitals);
    expect(violations.find(v => v.rule === 'spo2_rr_coherence')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rule 2 — EtCO2 must rise when RR falls (inverse relationship)
// ---------------------------------------------------------------------------
describe('Rule 2 — EtCO2/RR inverse relationship', () => {
  it('detects violation when RR < 8 and EtCO2 is not elevated (< 45)', () => {
    const vitals = normalVitals({ rr: 5, etco2: 38 });
    const violations = detectCoherenceViolations(vitals);
    const v = violations.find(v => v.rule === 'etco2_rr_coherence');
    expect(v).toBeDefined();
    expect(v!.severity).toBe('warning');
    expect(v!.message).toMatch(/RR 5/);
    expect(v!.message).toMatch(/EtCO2 38/);
  });

  it('no violation when RR < 8 and EtCO2 is appropriately elevated (≥ 45)', () => {
    const vitals = normalVitals({ rr: 5, etco2: 55 });
    const violations = detectCoherenceViolations(vitals);
    expect(violations.find(v => v.rule === 'etco2_rr_coherence')).toBeUndefined();
  });

  it('no violation when RR is normal (≥ 8)', () => {
    const vitals = normalVitals({ rr: 12, etco2: 38 });
    const violations = detectCoherenceViolations(vitals);
    expect(violations.find(v => v.rule === 'etco2_rr_coherence')).toBeUndefined();
  });

  it('no violation when patient is apneic (RR = 0) — capnograph flatlines', () => {
    // When RR = 0 there is no exhaled gas so EtCO2 drops; rule does not apply.
    const vitals = normalVitals({ rr: 0, etco2: 0 });
    const violations = detectCoherenceViolations(vitals);
    expect(violations.find(v => v.rule === 'etco2_rr_coherence')).toBeUndefined();
  });

  it('fires at boundary: RR = 7, EtCO2 = 44', () => {
    const vitals = normalVitals({ rr: 7, etco2: 44 });
    const violations = detectCoherenceViolations(vitals);
    expect(violations.find(v => v.rule === 'etco2_rr_coherence')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Rule 3 — MAP must stay within SBP/DBP bounds (MAP = DBP + ⅓ pulse pressure)
// ---------------------------------------------------------------------------
describe('Rule 3 — MAP bounds', () => {
  it('detects violation when MAP is too high relative to SBP/DBP', () => {
    // SBP=120, DBP=80 → expected MAP = 80 + 40/3 = 93; reported MAP = 110 (deviation +17)
    const vitals = normalVitals({ sbp: 120, dbp: 80, map: 110 });
    const violations = detectCoherenceViolations(vitals);
    const v = violations.find(v => v.rule === 'map_bounds');
    expect(v).toBeDefined();
    expect(v!.severity).toBe('warning');
    expect(v!.corrections?.map).toBe(93);
  });

  it('detects violation when MAP is too low relative to SBP/DBP', () => {
    // SBP=120, DBP=80 → expected MAP = 93; reported MAP = 70 (deviation -23)
    const vitals = normalVitals({ sbp: 120, dbp: 80, map: 70 });
    const violations = detectCoherenceViolations(vitals);
    const v = violations.find(v => v.rule === 'map_bounds');
    expect(v).toBeDefined();
    expect(v!.corrections?.map).toBe(93);
  });

  it('no violation when MAP is within tolerance (≤ 10 mmHg deviation)', () => {
    // SBP=120, DBP=80 → expected = 93; reported = 96 (deviation +3) — OK
    const vitals = normalVitals({ sbp: 120, dbp: 80, map: 96 });
    const violations = detectCoherenceViolations(vitals);
    expect(violations.find(v => v.rule === 'map_bounds')).toBeUndefined();
  });

  it('corrects MAP to the formula value', () => {
    // SBP=150, DBP=90 → pulse pressure = 60, expected MAP = 90 + 20 = 110
    const vitals = normalVitals({ sbp: 150, dbp: 90, map: 130 });
    const violations = detectCoherenceViolations(vitals);
    const v = violations.find(v => v.rule === 'map_bounds');
    expect(v?.corrections?.map).toBe(110);
  });

  it('reports the correct formula-derived MAP in the message', () => {
    const vitals = normalVitals({ sbp: 120, dbp: 80, map: 110 });
    const violations = detectCoherenceViolations(vitals);
    const v = violations.find(v => v.rule === 'map_bounds');
    expect(v?.message).toMatch(/93/);
  });
});

// ---------------------------------------------------------------------------
// Rule 4 — Asystole must have HR = 0
// ---------------------------------------------------------------------------
describe('Rule 4 — HR/rhythm consistency', () => {
  it('detects violation when rhythm is asystole but HR > 0', () => {
    const vitals = normalVitals({ rhythm: 'asystole', hr: 30 });
    const violations = detectCoherenceViolations(vitals);
    const v = violations.find(v => v.rule === 'asystole_hr');
    expect(v).toBeDefined();
    expect(v!.severity).toBe('critical');
    expect(v!.message).toMatch(/asystole/);
    expect(v!.message).toMatch(/HR is 30/);
    expect(v!.corrections?.hr).toBe(0);
  });

  it('no violation when rhythm is asystole and HR is already 0', () => {
    const vitals = normalVitals({ rhythm: 'asystole', hr: 0 });
    const violations = detectCoherenceViolations(vitals);
    expect(violations.find(v => v.rule === 'asystole_hr')).toBeUndefined();
  });

  it('no violation when rhythm is normal sinus (HR need not be 0)', () => {
    const vitals = normalVitals({ rhythm: 'normal_sinus', hr: 75 });
    const violations = detectCoherenceViolations(vitals);
    expect(violations.find(v => v.rule === 'asystole_hr')).toBeUndefined();
  });

  it('auto-corrects HR to 0 for asystole', () => {
    const vitals = normalVitals({ rhythm: 'asystole', hr: 50 });
    const [v] = detectCoherenceViolations(vitals).filter(v => v.rule === 'asystole_hr');
    expect(v.corrections).toEqual({ hr: 0 });
  });
});

// ---------------------------------------------------------------------------
// Rule 5 — Cardiac arrest rhythms → BP must be 0 (pulseless)
// ---------------------------------------------------------------------------
describe('Rule 5 — Cardiac arrest rhythms imply BP = 0', () => {
  const arrestRhythms: Array<Vitals['rhythm']> = [
    'ventricular_fibrillation',
    'asystole',
    'pea',
  ];

  for (const rhythm of arrestRhythms) {
    it(`detects violation for rhythm=${rhythm} with non-zero BP`, () => {
      const vitals = normalVitals({ rhythm, hr: 0 }); // HR already 0
      const violations = detectCoherenceViolations(vitals);
      const v = violations.find(v => v.rule === 'arrest_bp');
      expect(v).toBeDefined();
      expect(v!.severity).toBe('critical');
      expect(v!.message).toMatch(new RegExp(rhythm!));
      expect(v!.corrections).toEqual({ sbp: 0, dbp: 0, map: 0 });
    });
  }

  it('no violation when arrest rhythm already has BP = 0', () => {
    const vitals = normalVitals({ rhythm: 'ventricular_fibrillation', sbp: 0, dbp: 0, map: 0, hr: 0 });
    const violations = detectCoherenceViolations(vitals);
    expect(violations.find(v => v.rule === 'arrest_bp')).toBeUndefined();
  });

  it('no violation for non-arrest rhythms (e.g. ventricular_tachycardia with BP)', () => {
    // VT is not in the pulseless arrest list used by this rule
    const vitals = normalVitals({ rhythm: 'ventricular_tachycardia' });
    const violations = detectCoherenceViolations(vitals);
    expect(violations.find(v => v.rule === 'arrest_bp')).toBeUndefined();
  });

  it('auto-corrects all BP components to 0 for arrest rhythms', () => {
    const vitals = normalVitals({ rhythm: 'pea', sbp: 80, dbp: 50, map: 60, hr: 60 });
    const v = detectCoherenceViolations(vitals).find(v => v.rule === 'arrest_bp');
    expect(v?.corrections?.sbp).toBe(0);
    expect(v?.corrections?.dbp).toBe(0);
    expect(v?.corrections?.map).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Combined / edge-case scenarios
// ---------------------------------------------------------------------------
describe('Combined scenarios', () => {
  it('returns no violations for fully coherent normal vitals', () => {
    const vitals = normalVitals();
    expect(detectCoherenceViolations(vitals)).toHaveLength(0);
  });

  it('returns multiple violations for a deeply incoherent state', () => {
    // Asystole with HR > 0, BP > 0, and MAP wildly off formula
    const vitals = normalVitals({
      rhythm: 'asystole',
      hr: 60,
      sbp: 120,
      dbp: 80,
      map: 50, // off formula (expected 93) AND arrest
    });
    const violations = detectCoherenceViolations(vitals);
    const rules = violations.map(v => v.rule);
    expect(rules).toContain('asystole_hr');
    expect(rules).toContain('arrest_bp');
    // map_bounds violation: |50-93| = 43 > 10
    expect(rules).toContain('map_bounds');
  });
});
