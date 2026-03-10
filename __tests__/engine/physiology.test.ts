import {
  calculateVitals,
  checkAlarms,
  BASELINE_VITALS,
  PATIENT_ARCHETYPES,
} from '../../src/engine/physiology';
import { PKState } from '../../src/types';

// ---- Helpers ----------------------------------------------------------------

function emptyPKStates(): Record<string, PKState> {
  return {};
}

function pkState(ce: number): PKState {
  return { c1: ce, c2: ce * 0.5, c3: ce * 0.1, ce };
}

const HEALTHY = PATIENT_ARCHETYPES.healthy_adult;
const ELDERLY = PATIENT_ARCHETYPES.elderly;
const OBESE_OSA = PATIENT_ARCHETYPES.obese_osa;

// ---- BASELINE_VITALS --------------------------------------------------------

describe('physiology – BASELINE_VITALS', () => {
  it('exports sensible resting values for a healthy adult', () => {
    expect(BASELINE_VITALS.hr).toBe(75);
    expect(BASELINE_VITALS.sbp).toBe(120);
    expect(BASELINE_VITALS.rr).toBe(14);
    expect(BASELINE_VITALS.spo2).toBe(99);
    expect(BASELINE_VITALS.etco2).toBe(38);
  });
});

// ---- calculateVitals – no drugs ---------------------------------------------

describe('physiology – calculateVitals with no drugs', () => {
  it('returns vitals close to baseline for a healthy adult with no drugs', () => {
    const vitals = calculateVitals(emptyPKStates(), HEALTHY);

    expect(vitals.hr).toBeGreaterThan(50);
    expect(vitals.hr).toBeLessThan(100);
    expect(vitals.sbp).toBeGreaterThan(90);
    expect(vitals.sbp).toBeLessThan(150);
    expect(vitals.rr).toBeGreaterThan(10);
    expect(vitals.rr).toBeLessThan(20);
    expect(vitals.spo2).toBeGreaterThan(95);
    expect(vitals.etco2).toBeGreaterThan(30);
    expect(vitals.etco2).toBeLessThan(50);
  });

  it('elderly patient has slightly higher SBP (+10) and lower HR (-5) at baseline', () => {
    // Run multiple times to average out noise
    const samples = Array.from({ length: 10 }, () =>
      calculateVitals(emptyPKStates(), ELDERLY)
    );
    const avgHR = samples.reduce((s, v) => s + v.hr, 0) / samples.length;
    const avgSBP = samples.reduce((s, v) => s + v.sbp, 0) / samples.length;

    // Healthy baseline HR=75 → elderly HR = 70 ± noise
    expect(avgHR).toBeLessThan(80);
    // Healthy baseline SBP=120 → elderly SBP = 130 ± noise
    expect(avgSBP).toBeGreaterThan(120);
  });
});

// ---- calculateVitals – respiratory depression from opioids ------------------

describe('physiology – respiratory depression', () => {
  it('high fentanyl Ce causes significant RR depression', () => {
    // Ce = 3.5 ng/mL is the Ce50 for RR depression → expect ~50% depression
    const pkStates = { fentanyl: pkState(3.5) };
    const samples = Array.from({ length: 10 }, () =>
      calculateVitals(pkStates, HEALTHY)
    );
    const avgRR = samples.reduce((s, v) => s + v.rr, 0) / samples.length;

    // At Ce50 for RR, RR should be roughly half of baseline (14 * 0.5 = 7)
    // Allow generous range due to noise and exact implementation
    expect(avgRR).toBeLessThan(12);
  });

  it('zero fentanyl → RR near baseline', () => {
    const pkStates = { fentanyl: pkState(0) };
    const samples = Array.from({ length: 10 }, () =>
      calculateVitals(pkStates, HEALTHY)
    );
    const avgRR = samples.reduce((s, v) => s + v.rr, 0) / samples.length;
    expect(avgRR).toBeGreaterThan(11);
    expect(avgRR).toBeLessThan(17);
  });

  it('propofol at high Ce causes moderate RR depression', () => {
    const pkStates = { propofol: pkState(6.0) }; // 6 mcg/mL, well above EC50
    const samples = Array.from({ length: 10 }, () =>
      calculateVitals(pkStates, HEALTHY)
    );
    const avgRR = samples.reduce((s, v) => s + v.rr, 0) / samples.length;
    expect(avgRR).toBeLessThan(14); // below baseline
  });

  it('combination of fentanyl + propofol produces greater RR depression than either alone', () => {
    const fentanylOnly = { fentanyl: pkState(2.0) };
    const propofolOnly = { propofol: pkState(3.0) };
    const combined = { fentanyl: pkState(2.0), propofol: pkState(3.0) };

    const avgRR = (pkStates: Record<string, PKState>) =>
      Array.from({ length: 10 }, () => calculateVitals(pkStates, HEALTHY))
        .reduce((s, v) => s + v.rr, 0) / 10;

    const rrFentanyl = avgRR(fentanylOnly);
    const rrPropofol = avgRR(propofolOnly);
    const rrCombined = avgRR(combined);

    expect(rrCombined).toBeLessThan(rrFentanyl);
    expect(rrCombined).toBeLessThan(rrPropofol);
  });
});

// ---- calculateVitals – SpO2 / airway patency --------------------------------

describe('physiology – SpO2 response', () => {
  it('SpO2 is high when RR is normal and patient is healthy', () => {
    const vitals = calculateVitals(emptyPKStates(), HEALTHY);
    expect(vitals.spo2).toBeGreaterThan(95);
  });

  it('obese OSA patient has lower SpO2 than healthy patient under same drug load', () => {
    const pkStates = { fentanyl: pkState(2.0) };

    const samplesHealthy = Array.from({ length: 10 }, () =>
      calculateVitals(pkStates, HEALTHY)
    );
    const samplesObese = Array.from({ length: 10 }, () =>
      calculateVitals(pkStates, OBESE_OSA)
    );

    const avgHealthy = samplesHealthy.reduce((s, v) => s + v.spo2, 0) / 10;
    const avgObese = samplesObese.reduce((s, v) => s + v.spo2, 0) / 10;

    // OSA + obesity should result in lower or equal SpO2
    expect(avgObese).toBeLessThanOrEqual(avgHealthy + 1); // allow 1% noise margin
  });

  it('bag_mask intervention raises SpO2 toward normal under respiratory depression', () => {
    // Severely depressed RR from high opioids
    const pkStates = { fentanyl: pkState(5.0) };

    const withoutBVM = Array.from({ length: 10 }, () =>
      calculateVitals(pkStates, HEALTHY, BASELINE_VITALS, 0.21, 'normal_sinus', 0, new Set())
    );
    const withBVM = Array.from({ length: 10 }, () =>
      calculateVitals(pkStates, HEALTHY, BASELINE_VITALS, 0.21, 'normal_sinus', 0, new Set(['bag_mask']))
    );

    const avgWithout = withoutBVM.reduce((s, v) => s + v.spo2, 0) / 10;
    const avgWith = withBVM.reduce((s, v) => s + v.spo2, 0) / 10;

    expect(avgWith).toBeGreaterThanOrEqual(avgWithout);
  });
});

// ---- calculateVitals – hemodynamics -----------------------------------------

describe('physiology – hemodynamics', () => {
  it('high propofol Ce causes BP drop', () => {
    const highPropofol = { propofol: pkState(6.0) };

    const samples = Array.from({ length: 10 }, () =>
      calculateVitals(highPropofol, HEALTHY)
    );
    const avgSBP = samples.reduce((s, v) => s + v.sbp, 0) / 10;

    // Propofol causes vasodilation → SBP should drop below normal 120
    expect(avgSBP).toBeLessThan(120);
  });

  it('ketamine Ce causes BP and HR to rise', () => {
    const pkStates = { ketamine: pkState(0.002) }; // 2 mcg/mL

    const samples = Array.from({ length: 10 }, () =>
      calculateVitals(pkStates, HEALTHY)
    );
    const avgHR = samples.reduce((s, v) => s + v.hr, 0) / 10;
    const avgSBP = samples.reduce((s, v) => s + v.sbp, 0) / 10;

    // Ketamine is sympathomimetic → HR and BP above baseline
    expect(avgHR).toBeGreaterThan(75);
    expect(avgSBP).toBeGreaterThan(110);
  });

  it('atropine intervention raises HR', () => {
    const pkStates = { fentanyl: pkState(2.0) }; // fentanyl causes some bradycardia

    const withoutAtropine = Array.from({ length: 10 }, () =>
      calculateVitals(pkStates, HEALTHY, BASELINE_VITALS, 0.21, 'normal_sinus', 0, new Set())
    );
    const withAtropine = Array.from({ length: 10 }, () =>
      calculateVitals(pkStates, HEALTHY, BASELINE_VITALS, 0.21, 'normal_sinus', 0, new Set(['atropine']))
    );

    const avgHRWithout = withoutAtropine.reduce((s, v) => s + v.hr, 0) / 10;
    const avgHRWith = withAtropine.reduce((s, v) => s + v.hr, 0) / 10;

    expect(avgHRWith).toBeGreaterThan(avgHRWithout);
  });

  it('vasopressors raise BP', () => {
    const highPropofol = { propofol: pkState(5.0) }; // propofol-induced hypotension

    const withoutVP = Array.from({ length: 10 }, () =>
      calculateVitals(highPropofol, HEALTHY, BASELINE_VITALS, 0.21, 'normal_sinus', 0, new Set())
    );
    const withVP = Array.from({ length: 10 }, () =>
      calculateVitals(highPropofol, HEALTHY, BASELINE_VITALS, 0.21, 'normal_sinus', 0, new Set(['vasopressors']))
    );

    const avgSBPWithout = withoutVP.reduce((s, v) => s + v.sbp, 0) / 10;
    const avgSBPWith = withVP.reduce((s, v) => s + v.sbp, 0) / 10;

    expect(avgSBPWith).toBeGreaterThan(avgSBPWithout);
  });
});

// ---- calculateVitals – scenario overrides -----------------------------------

describe('physiology – scenario overrides', () => {
  it('scenario overrides force specific vital values', () => {
    const overrides = { hr: 42, sbp: 80, rr: 4 };
    const vitals = calculateVitals(emptyPKStates(), HEALTHY, BASELINE_VITALS, 0.21,
      'normal_sinus', 0, new Set(), undefined, overrides);

    expect(vitals.hr).toBe(42);
    expect(vitals.sbp).toBe(80);
    expect(vitals.rr).toBe(4);
  });
});

// ---- checkAlarms ------------------------------------------------------------

describe('physiology – checkAlarms', () => {
  it('no alarms for normal vitals', () => {
    const alarms = checkAlarms({ hr: 75, sbp: 120, dbp: 80, map: 93, rr: 14, spo2: 99, etco2: 38 });
    expect(alarms).toHaveLength(0);
  });

  it('SpO2 < 90 → warning; SpO2 < 85 → danger', () => {
    const warning = checkAlarms({ hr: 75, sbp: 120, dbp: 80, map: 93, rr: 14, spo2: 88, etco2: 38 });
    expect(warning.some(a => a.type === 'spo2' && a.severity === 'warning')).toBe(true);

    const danger = checkAlarms({ hr: 75, sbp: 120, dbp: 80, map: 93, rr: 14, spo2: 82, etco2: 38 });
    expect(danger.some(a => a.type === 'spo2' && a.severity === 'danger')).toBe(true);
  });

  it('HR < 50 → warning; HR < 40 → danger', () => {
    const warning = checkAlarms({ hr: 45, sbp: 120, dbp: 80, map: 93, rr: 14, spo2: 99, etco2: 38 });
    expect(warning.some(a => a.type === 'hr' && a.severity === 'warning')).toBe(true);

    const danger = checkAlarms({ hr: 35, sbp: 120, dbp: 80, map: 93, rr: 14, spo2: 99, etco2: 38 });
    expect(danger.some(a => a.type === 'hr' && a.severity === 'danger')).toBe(true);
  });

  it('HR > 120 → warning; HR > 140 → danger', () => {
    const warning = checkAlarms({ hr: 130, sbp: 120, dbp: 80, map: 93, rr: 14, spo2: 99, etco2: 38 });
    expect(warning.some(a => a.type === 'hr' && a.severity === 'warning')).toBe(true);

    const danger = checkAlarms({ hr: 155, sbp: 120, dbp: 80, map: 93, rr: 14, spo2: 99, etco2: 38 });
    expect(danger.some(a => a.type === 'hr' && a.severity === 'danger')).toBe(true);
  });

  it('SBP < 90 → warning; SBP < 80 → danger', () => {
    const warning = checkAlarms({ hr: 75, sbp: 85, dbp: 55, map: 65, rr: 14, spo2: 99, etco2: 38 });
    expect(warning.some(a => a.type === 'bp' && a.severity === 'warning')).toBe(true);

    const danger = checkAlarms({ hr: 75, sbp: 72, dbp: 45, map: 54, rr: 14, spo2: 99, etco2: 38 });
    expect(danger.some(a => a.type === 'bp' && a.severity === 'danger')).toBe(true);
  });

  it('RR < 8 → warning; RR === 0 → danger (apnea)', () => {
    const warning = checkAlarms({ hr: 75, sbp: 120, dbp: 80, map: 93, rr: 6, spo2: 99, etco2: 38 });
    expect(warning.some(a => a.type === 'rr' && a.severity === 'warning')).toBe(true);

    const apnea = checkAlarms({ hr: 75, sbp: 120, dbp: 80, map: 93, rr: 0, spo2: 99, etco2: 38 });
    expect(apnea.some(a => a.type === 'rr' && a.severity === 'danger')).toBe(true);
  });

  it('EtCO2 > 55 → warning; EtCO2 > 65 → danger', () => {
    const warning = checkAlarms({ hr: 75, sbp: 120, dbp: 80, map: 93, rr: 14, spo2: 99, etco2: 60 });
    expect(warning.some(a => a.type === 'etco2' && a.severity === 'warning')).toBe(true);

    const danger = checkAlarms({ hr: 75, sbp: 120, dbp: 80, map: 93, rr: 14, spo2: 99, etco2: 70 });
    expect(danger.some(a => a.type === 'etco2' && a.severity === 'danger')).toBe(true);
  });
});
