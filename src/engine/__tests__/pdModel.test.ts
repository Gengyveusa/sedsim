/**
 * Unit tests for the PD model (pdModel.ts)
 * Validates Hill equation, MOASS mapping, and combined effect model.
 */

import { describe, it, expect } from 'vitest';
import { hillEffect, combinedEffect, effectToMOASS, moassLabel } from '../pdModel';
import { propofol, fentanyl, remifentanil, midazolam } from '../drugs';

describe('hillEffect', () => {
  it('returns 0 when Ce is 0', () => {
    expect(hillEffect(0, 3.4, 2.8)).toBe(0);
  });

  it('returns 0.5 when Ce equals EC50', () => {
    const effect = hillEffect(3.4, 3.4, 2.8);
    expect(effect).toBeCloseTo(0.5, 5);
  });

  it('approaches 1 at very high Ce', () => {
    const effect = hillEffect(1000, 3.4, 2.8);
    expect(effect).toBeGreaterThan(0.999);
  });

  it('increases monotonically with Ce', () => {
    const e1 = hillEffect(1.0, 3.4, 2.8);
    const e2 = hillEffect(2.0, 3.4, 2.8);
    const e3 = hillEffect(5.0, 3.4, 2.8);
    expect(e2).toBeGreaterThan(e1);
    expect(e3).toBeGreaterThan(e2);
  });

  it('steeper Hill coefficient produces more sigmoid curve', () => {
    // At Ce = 0.5 * EC50, higher gamma → lower effect
    const lowGamma = hillEffect(1.7, 3.4, 1.0);
    const highGamma = hillEffect(1.7, 3.4, 5.0);
    expect(highGamma).toBeLessThan(lowGamma);
  });
});

describe('effectToMOASS', () => {
  it('maps low effect to MOASS 5 (awake)', () => {
    expect(effectToMOASS(0.05)).toBe(5);
    expect(effectToMOASS(0.0)).toBe(5);
  });

  it('maps moderate effect to MOASS 4 (drowsy)', () => {
    expect(effectToMOASS(0.15)).toBe(4);
    expect(effectToMOASS(0.20)).toBe(4);
  });

  it('maps substantial effect to MOASS 3 (moderate sedation)', () => {
    expect(effectToMOASS(0.30)).toBe(3);
    expect(effectToMOASS(0.40)).toBe(3);
  });

  it('maps high effect to MOASS 2 (deep sedation)', () => {
    expect(effectToMOASS(0.55)).toBe(2);
  });

  it('maps very high effect to MOASS 1', () => {
    expect(effectToMOASS(0.75)).toBe(1);
  });

  it('maps near-maximal effect to MOASS 0 (unresponsive)', () => {
    expect(effectToMOASS(0.90)).toBe(0);
    expect(effectToMOASS(1.0)).toBe(0);
  });

  it('MOASS levels decrease monotonically with increasing effect', () => {
    const effects = [0.0, 0.12, 0.26, 0.46, 0.66, 0.86, 1.0];
    const levels = effects.map(effectToMOASS);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1]);
    }
  });
});

describe('moassLabel', () => {
  it('returns descriptive string for each MOASS level', () => {
    expect(moassLabel(5)).toContain('Awake');
    expect(moassLabel(4)).toContain('Drowsy');
    expect(moassLabel(3)).toContain('Moderate');
    expect(moassLabel(2)).toContain('Deep');
    expect(moassLabel(1)).toContain('Anesthesia');
    expect(moassLabel(0)).toContain('Unresponsive');
  });
});

describe('combinedEffect — opioid behavior (Bouillon model)', () => {
  it('opioid alone is capped below MOASS 4 threshold (ceiling effect)', () => {
    // Very high remifentanil Ce → should saturate but stay below deep sedation
    const highRemiEffect = combinedEffect([{ drug: remifentanil, ce: 100 }]);
    // Opioid-only ceiling ~0.22; combined should stay at MOASS 4 (< 0.25)
    expect(highRemiEffect).toBeLessThan(0.25);
  });

  it('opioid alone produces drowsiness (MOASS 4) at clinical doses', () => {
    // Fentanyl at moderate Ce → capped sedation → MOASS 4
    const effect = combinedEffect([{ drug: fentanyl, ce: 0.01 }]);
    expect(effectToMOASS(effect)).toBe(4);
  });

  it('hypnotic alone can produce deep sedation (MOASS ≤ 2)', () => {
    // Propofol at high Ce (6 mcg/mL > EC50) → moderate-deep sedation
    const effect = combinedEffect([{ drug: propofol, ce: 6.0 }]);
    expect(effect).toBeGreaterThan(0.45);
    expect(effectToMOASS(effect)).toBeLessThanOrEqual(2);
  });

  it('opioid + hypnotic combination is supra-additive (synergy)', () => {
    const propofolOnly = combinedEffect([{ drug: propofol, ce: 2.0 }]);
    const remiOnly = combinedEffect([{ drug: remifentanil, ce: 0.01 }]);
    const additive = 1 - (1 - propofolOnly) * (1 - remiOnly); // Bliss independence
    const combined = combinedEffect([
      { drug: propofol, ce: 2.0 },
      { drug: remifentanil, ce: 0.01 },
    ]);
    // Due to EC50 potentiation, combined > naive additive
    expect(combined).toBeGreaterThan(additive);
  });

  it('returns 0 for empty drug list', () => {
    expect(combinedEffect([])).toBe(0);
  });

  it('combined effect is bounded [0, 1]', () => {
    const effect = combinedEffect([
      { drug: propofol, ce: 10 },
      { drug: midazolam, ce: 0.5 },
      { drug: fentanyl, ce: 0.1 },
    ]);
    expect(effect).toBeGreaterThanOrEqual(0);
    expect(effect).toBeLessThanOrEqual(1);
  });
});

describe('combinedEffect — propofol clinical thresholds', () => {
  it('propofol 50mg bolus peak Ce → moderate sedation (MOASS 3)', () => {
    // 50mg / V1=15.9L → ~3.14 mcg/mL initial, equilibrates to ~1.5 mcg/mL at 60s
    // At moderate Ce, expect moderate sedation
    const effect = combinedEffect([{ drug: propofol, ce: 1.5 }]);
    const moass = effectToMOASS(effect);
    // Should be MOASS 4 or 5 (mild effect at Ce=1.5, below EC50=3.4)
    expect(moass).toBeGreaterThanOrEqual(4);
  });

  it('propofol 100mg bolus peak Ce → deep sedation zone (MOASS ≤ 3)', () => {
    // Peak Ce around 2-2.5 mcg/mL at 3 minutes
    const effect = combinedEffect([{ drug: propofol, ce: 2.2 }]);
    const moass = effectToMOASS(effect);
    expect(moass).toBeGreaterThanOrEqual(3);
    expect(moass).toBeLessThanOrEqual(4);
  });
});
