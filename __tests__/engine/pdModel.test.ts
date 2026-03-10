import { hillEffect, combinedEffect, effectToMOASS, moassLabel } from '../../src/engine/pdModel';
import { DrugParams } from '../../src/types';

// ---- Drug fixtures --------------------------------------------------------

const PROPOFOL: DrugParams = {
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

const REMIFENTANIL: DrugParams = {
  name: 'Remifentanil',
  color: '#fb923c',
  V1: 5.1,
  k10: 0.595,
  k12: 0.346,
  k13: 0.128,
  k21: 0.200,
  k31: 0.017,
  ke0: 0.595,
  EC50: 13.1, // ng/mL (Minto 1997)
  gamma: 1.43,
  unit: 'mcg',
};

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

const NALOXONE: DrugParams = {
  name: 'Naloxone',
  color: '#a3e635',
  V1: 2.0,
  k10: 0.30,
  k12: 0.25,
  k13: 0.05,
  k21: 0.15,
  k31: 0.01,
  ke0: 0.30,
  EC50: 0.5,
  gamma: 1.5,
  unit: 'mg',
};

const FLUMAZENIL: DrugParams = {
  name: 'Flumazenil',
  color: '#c4b5fd',
  V1: 1.0,
  k10: 0.40,
  k12: 0.20,
  k13: 0.04,
  k21: 0.10,
  k31: 0.01,
  ke0: 0.40,
  EC50: 0.3,
  gamma: 1.5,
  unit: 'mg',
};

describe('pdModel – hillEffect', () => {
  it('returns 0 when ce <= 0', () => {
    expect(hillEffect(0, 3.4, 1.47)).toBe(0);
    expect(hillEffect(-1, 3.4, 1.47)).toBe(0);
  });

  it('returns 0.5 when ce === EC50 (definition of EC50)', () => {
    expect(hillEffect(3.4, 3.4, 1.47)).toBeCloseTo(0.5, 5);
    expect(hillEffect(1.0, 1.0, 2.0)).toBeCloseTo(0.5, 5);
  });

  it('returns < 0.5 when ce < EC50', () => {
    expect(hillEffect(1.0, 3.4, 1.47)).toBeLessThan(0.5);
  });

  it('returns > 0.5 when ce > EC50', () => {
    expect(hillEffect(10.0, 3.4, 1.47)).toBeGreaterThan(0.5);
  });

  it('approaches 1 at very high concentrations', () => {
    expect(hillEffect(1000, 3.4, 1.47)).toBeGreaterThan(0.99);
  });

  it('is monotonically increasing', () => {
    const concentrations = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 50.0];
    for (let i = 1; i < concentrations.length; i++) {
      expect(hillEffect(concentrations[i], 3.4, 1.47))
        .toBeGreaterThan(hillEffect(concentrations[i - 1], 3.4, 1.47));
    }
  });

  it('gamma steepness: higher gamma produces sharper transition near EC50', () => {
    // Both at ce = 2 * EC50; high gamma → higher effect
    const lowGamma = hillEffect(2.0, 1.0, 1.0);   // gamma=1 → 0.667
    const highGamma = hillEffect(2.0, 1.0, 4.0);  // gamma=4 → 0.941
    expect(highGamma).toBeGreaterThan(lowGamma);
  });
});

describe('pdModel – combinedEffect', () => {
  it('returns 0 for empty drug list', () => {
    expect(combinedEffect([])).toBe(0);
  });

  it('returns 0 for zero concentrations', () => {
    const effect = combinedEffect([
      { drug: PROPOFOL, ce: 0 },
      { drug: FENTANYL, ce: 0 },
    ]);
    expect(effect).toBe(0);
  });

  it('single hypnotic at EC50 produces effect between 0.2 and 0.6', () => {
    // Propofol at EC50 (3.4 mcg/mL) → Hill = 0.5 hypnotic → combined < 0.5
    const effect = combinedEffect([{ drug: PROPOFOL, ce: PROPOFOL.EC50 }]);
    expect(effect).toBeGreaterThan(0.2);
    expect(effect).toBeLessThanOrEqual(0.5);
  });

  it('opioid alone is capped below OPIOID_SEDATION_CEILING (0.22)', () => {
    // High fentanyl dose → effect capped at 0.22
    const highFentanyl = combinedEffect([{ drug: FENTANYL, ce: 100 }]);
    expect(highFentanyl).toBeLessThanOrEqual(0.22 + 1e-9);
  });

  it('opioid + hypnotic produces more effect than hypnotic alone (potentiation)', () => {
    const propofolOnly = combinedEffect([{ drug: PROPOFOL, ce: 2.0 }]);
    const propofolPlusFentanyl = combinedEffect([
      { drug: PROPOFOL, ce: 2.0 },
      { drug: FENTANYL, ce: 5.0 },
    ]);
    expect(propofolPlusFentanyl).toBeGreaterThan(propofolOnly);
  });

  it('propofol + remifentanil interaction: higher combined effect than propofol alone', () => {
    const propofolOnly = combinedEffect([{ drug: PROPOFOL, ce: 3.0 }]);
    const combined = combinedEffect([
      { drug: PROPOFOL, ce: 3.0 },
      { drug: REMIFENTANIL, ce: 15.0 },
    ]);
    expect(combined).toBeGreaterThan(propofolOnly);
  });

  it('combined effect is bounded between 0 and 1', () => {
    const highDose = combinedEffect([
      { drug: PROPOFOL, ce: 100 },
      { drug: FENTANYL, ce: 100 },
    ]);
    expect(highDose).toBeGreaterThanOrEqual(0);
    expect(highDose).toBeLessThanOrEqual(1);
  });

  it('naloxone reduces opioid contribution (reversal)', () => {
    // Fentanyl alone at moderate dose
    const fentanylOnly = combinedEffect([{ drug: FENTANYL, ce: 5.0 }]);
    // Fentanyl + naloxone at high reversal dose
    const reversed = combinedEffect([
      { drug: FENTANYL, ce: 5.0 },
      { drug: NALOXONE, ce: 1.0 },
    ]);
    expect(reversed).toBeLessThan(fentanylOnly);
  });

  it('flumazenil does not affect non-benzodiazepine drugs', () => {
    // Propofol (not reversed by flumazenil) — effect unchanged
    const propofolOnly = combinedEffect([{ drug: PROPOFOL, ce: 3.0 }]);
    const withFlumazenil = combinedEffect([
      { drug: PROPOFOL, ce: 3.0 },
      { drug: FLUMAZENIL, ce: 0.5 },
    ]);
    // Flumazenil has no target for propofol, effect should be same
    expect(withFlumazenil).toBeCloseTo(propofolOnly, 5);
  });
});

describe('pdModel – effectToMOASS', () => {
  it('0 effect → MOASS 5 (awake)', () => {
    expect(effectToMOASS(0)).toBe(5);
    expect(effectToMOASS(0.05)).toBe(5);
  });

  it('0.10 ≤ effect < 0.25 → MOASS 4 (drowsy)', () => {
    expect(effectToMOASS(0.10)).toBe(4);
    expect(effectToMOASS(0.20)).toBe(4);
  });

  it('0.25 ≤ effect < 0.45 → MOASS 3 (moderate sedation)', () => {
    expect(effectToMOASS(0.25)).toBe(3);
    expect(effectToMOASS(0.40)).toBe(3);
  });

  it('0.45 ≤ effect < 0.65 → MOASS 2 (deep sedation)', () => {
    expect(effectToMOASS(0.45)).toBe(2);
    expect(effectToMOASS(0.60)).toBe(2);
  });

  it('0.65 ≤ effect < 0.85 → MOASS 1 (general anesthesia)', () => {
    expect(effectToMOASS(0.65)).toBe(1);
    expect(effectToMOASS(0.80)).toBe(1);
  });

  it('effect ≥ 0.85 → MOASS 0 (unresponsive)', () => {
    expect(effectToMOASS(0.85)).toBe(0);
    expect(effectToMOASS(1.0)).toBe(0);
  });
});

describe('pdModel – moassLabel', () => {
  it('returns the correct label for each MOASS level', () => {
    expect(moassLabel(5)).toBe('Awake / Alert');
    expect(moassLabel(4)).toBe('Drowsy');
    expect(moassLabel(3)).toBe('Moderate Sedation');
    expect(moassLabel(2)).toBe('Deep Sedation');
    expect(moassLabel(1)).toBe('General Anesthesia');
    expect(moassLabel(0)).toBe('Unresponsive');
  });
});
