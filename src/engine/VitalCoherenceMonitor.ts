// src/engine/VitalCoherenceMonitor.ts
// Real-time vital sign watcher that fires mentor alerts for critical thresholds
// independent of scripted scenario steps.

import useSimStore from '../store/useSimStore';
import useAIStore from '../store/useAIStore';
import { Vitals, CardiacRhythm } from '../types';

const COOLDOWN_MS = 15000; // 15 seconds per parameter

interface AlertCooldown {
  lastAlertedAt: number;
  lastLevel: string; // e.g. 'critical' | 'warning' to avoid re-firing same level
}

// Minimal interface to type-safely access scenario steps without circular imports
interface ScenarioStepWithTrigger {
  triggerCondition?: {
    parameter: string;
    threshold: number;
  };
}
interface ActiveScenarioSteps {
  steps: ScenarioStepWithTrigger[];
}

// Returns true if the scenario already covers this parameter/threshold
// and the current value does NOT exceed the scenario's worst threshold.
// When the value goes beyond what the scenario covers, allow the monitor to fire.
function isCoveredByScenario(
  paramKey: 'spo2' | 'hr' | 'rr' | 'sbp' | 'moass' | 'etco2',
  value: number,
  operator: '<' | '>'
): boolean {
  const aiState = useAIStore.getState();
  if (!aiState.isScenarioRunning) return false;

  const simState = useSimStore.getState();
  const drugProtocols = simState.scenarioDrugProtocols; // quick check: if no protocols, scenario not loaded
  if (!drugProtocols) return false;

  // Access the active scenario via AI store
  const activeScenario = aiState.activeScenario as unknown as ActiveScenarioSteps | null;
  if (!activeScenario?.steps) return false;

  // Collect all scenario thresholds for this parameter
  const thresholds: number[] = [];
  for (const step of activeScenario.steps) {
    const tc = step.triggerCondition;
    if (tc && tc.parameter === paramKey) {
      thresholds.push(tc.threshold);
    }
  }

  if (thresholds.length === 0) return false;

  // For '<' operator (low alerts), find the minimum scenario threshold
  // If value > min scenario threshold, scenario covers it; only fire if value is even lower
  if (operator === '<') {
    const minThreshold = Math.min(...thresholds);
    // Value is covered (scenario handles it) if it's above the monitor's concern
    // Only fire if the value goes BELOW the most extreme scenario threshold
    return value >= minThreshold;
  }
  // For '>' operator (high alerts), find the maximum scenario threshold
  if (operator === '>') {
    const maxThreshold = Math.max(...thresholds);
    return value <= maxThreshold;
  }
  return false;
}

// Alarm entry type matching useSimStore activeAlarms shape
interface AlarmEntry { type: string; message: string; severity: 'warning' | 'danger'; }

/**
 * Describes a detected cross-vital coherence violation, with an optional
 * set of vital-sign corrections that should be applied to restore coherence.
 */
export interface CoherenceViolation {
  /** Unique rule identifier used for cooldown tracking */
  rule: string;
  /** Human-readable description of the violation */
  message: string;
  severity: 'warning' | 'critical';
  /** Vital-sign overrides that auto-correct the incoherent state */
  corrections?: Partial<Vitals>;
}

// Cardiac arrest rhythms where BP must be zero and HR must reflect pulselessness
const ARREST_RHYTHMS: ReadonlyArray<CardiacRhythm> = [
  'ventricular_fibrillation',
  'asystole',
  'pea',
];

/**
 * Pure function — detects physiologically impossible cross-vital combinations.
 *
 * Rules implemented:
 *  1. SpO2 < 85 requires RR depression (RR < 8) or the combination is incoherent.
 *  2. EtCO2/RR inverse: when RR < 8 EtCO2 must be elevated (≥ 45 mmHg).
 *  3. MAP bounds: MAP must equal DBP + ⅓ × (SBP − DBP) within 10 mmHg.
 *  4. Asystole → HR must be 0.
 *  5. Cardiac arrest rhythms (VF / asystole / PEA) → SBP, DBP, MAP must be 0.
 */
export function detectCoherenceViolations(vitals: Vitals): CoherenceViolation[] {
  const violations: CoherenceViolation[] = [];

  // Rule 1 — SpO2 critically low without respiratory depression
  if (vitals.spo2 < 85 && vitals.rr >= 8) {
    violations.push({
      rule: 'spo2_rr_coherence',
      message:
        `SpO2 ${vitals.spo2}% is critically low but RR ${vitals.rr} is not depressed. ` +
        `Physiologically this indicates airway obstruction rather than respiratory depression.`,
      severity: 'warning',
    });
  }

  // Rule 2 — EtCO2 must rise when RR falls (inverse relationship)
  // Only meaningful when patient is still breathing (RR > 0)
  if (vitals.rr > 0 && vitals.rr < 8 && vitals.etco2 < 45) {
    violations.push({
      rule: 'etco2_rr_coherence',
      message:
        `RR ${vitals.rr} is depressed but EtCO2 ${vitals.etco2} is not elevated (expected ≥ 45). ` +
        `Hypoventilation must raise EtCO2.`,
      severity: 'warning',
    });
  }

  // Rule 3 — MAP must equal DBP + ⅓ × pulse pressure
  const pulsePressure = vitals.sbp - vitals.dbp;
  const expectedMAP = Math.round(vitals.dbp + pulsePressure / 3);
  if (Math.abs(vitals.map - expectedMAP) > 10) {
    violations.push({
      rule: 'map_bounds',
      message:
        `MAP ${vitals.map} mmHg does not match SBP ${vitals.sbp}/DBP ${vitals.dbp} ` +
        `(formula gives ${expectedMAP} mmHg). Auto-correcting MAP.`,
      severity: 'warning',
      corrections: { map: expectedMAP },
    });
  }

  // Rule 4 — Asystole implies HR = 0
  if (vitals.rhythm === 'asystole' && vitals.hr !== 0) {
    violations.push({
      rule: 'asystole_hr',
      message:
        `Rhythm is asystole but HR is ${vitals.hr} bpm. ` +
        `Asystole must have HR = 0. Auto-correcting.`,
      severity: 'critical',
      corrections: { hr: 0 },
    });
  }

  // Rule 5 — Cardiac arrest rhythms require BP = 0 (pulseless)
  if (vitals.rhythm && ARREST_RHYTHMS.includes(vitals.rhythm)) {
    const hasPulse = vitals.sbp > 0 || vitals.dbp > 0 || vitals.map > 0;
    if (hasPulse) {
      violations.push({
        rule: 'arrest_bp',
        message:
          `Cardiac arrest (${vitals.rhythm}) but BP is not zero ` +
          `(SBP=${vitals.sbp}, DBP=${vitals.dbp}, MAP=${vitals.map}). Auto-correcting.`,
        severity: 'critical',
        corrections: { sbp: 0, dbp: 0, map: 0 },
      });
    }
  }

  return violations;
}

export class VitalCoherenceMonitor {
  // Use Zustand store subscription instead of setInterval for unified alarm source
  private unsubscribe: (() => void) | null = null;
  private cooldowns: Record<string, AlertCooldown> = {};
  private onCriticalAlert: (() => void) | null = null;

  start(onCriticalAlert?: () => void) {
    if (this.unsubscribe) return;
    this.cooldowns = {};
    // Callback invoked when a critical alert fires while a scenario question is pending.
    this.onCriticalAlert = onCriticalAlert ?? null;
    // Subscribe to store changes — fires on every tick so alarms are processed
    // in lock-step with the simulation (no separate 2-second polling timer)
    this.unsubscribe = useSimStore.subscribe((state: { activeAlarms: AlarmEntry[]; vitals: Vitals; moass: number }) => this.tick(state.activeAlarms, state.vitals, state.moass));
  }

  stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.cooldowns = {};
    this.onCriticalAlert = null;
  }

  private canAlert(key: string, level: string): boolean {
    const cd = this.cooldowns[key];
    if (!cd) return true;
    const elapsed = Date.now() - cd.lastAlertedAt;
    if (elapsed >= COOLDOWN_MS) return true;
    // Allow escalation from warning → critical even within cooldown
    if (cd.lastLevel === 'warning' && level === 'critical') return true;
    return false;
  }

  private recordAlert(key: string, level: string) {
    this.cooldowns[key] = { lastAlertedAt: Date.now(), lastLevel: level };
  }

  private dismissStaleQuestion() {
    const aiState = useAIStore.getState();
    if (aiState.currentQuestion) {
      aiState.setCurrentQuestion(null);
      this.onCriticalAlert?.();
    }
  }

  private alert(text: string, level: 'warning' | 'critical', highlightTargetId?: string) {
    const aiStore = useAIStore.getState();
    const prefix = level === 'critical' ? '🚨 ' : '⚠️ ';
    aiStore.addMentorMessage('mentor', prefix + text);

    if (highlightTargetId) {
      aiStore.setActiveHighlights([{
        targetId: highlightTargetId,
        text,
        severity: level === 'critical' ? 'danger' : 'warning',
      }]);
    }

    // Force complication phase
    aiStore.setCurrentScenarioPhase('complication');

    // Dismiss stale question on critical alerts
    if (level === 'critical') {
      this.dismissStaleQuestion();
    }
  }

  private tick(activeAlarms: AlarmEntry[], vitals: Vitals, moass: number) {
    // Use canonical activeAlarms from the store (computed by checkAlarms() in tick())
    // instead of re-evaluating individual vital thresholds here.
    // This ensures the VitalCoherenceMonitor and the main alarm system agree.

    // SpO2 alarms
    const spo2DangerAlarm = activeAlarms.find((a: AlarmEntry) => a.type === 'spo2' && a.severity === 'danger');
    const spo2WarnAlarm = activeAlarms.find((a: AlarmEntry) => a.type === 'spo2' && a.severity === 'warning');
    if (spo2DangerAlarm && !isCoveredByScenario('spo2', vitals.spo2, '<')) {
      if (this.canAlert('spo2', 'critical')) {
        this.recordAlert('spo2', 'critical');
        this.alert(
          `CRITICAL: SpO2 has dropped to ${vitals.spo2}%! Patient is severely hypoxic. Immediate intervention required: increase FiO2, jaw thrust, consider BVM ventilation.`,
          'critical', 'spo2'
        );
      }
    } else if (spo2WarnAlarm && !isCoveredByScenario('spo2', vitals.spo2, '<')) {
      if (this.canAlert('spo2', 'warning')) {
        this.recordAlert('spo2', 'warning');
        this.alert(
          `WARNING: SpO2 is ${vitals.spo2}%. Airway management needed.`,
          'warning', 'spo2'
        );
      }
    }

    // HR alarms
    const hrAlarm = activeAlarms.find((a: AlarmEntry) => a.type === 'hr');
    if (hrAlarm) {
      if (vitals.hr < 40 && !isCoveredByScenario('hr', vitals.hr, '<')) {
        if (this.canAlert('hr_low', 'critical')) {
          this.recordAlert('hr_low', 'critical');
          this.alert(
            `CRITICAL: Severe bradycardia HR ${vitals.hr}. Consider atropine.`,
            'critical', 'hr'
          );
        }
      } else if (vitals.hr > 150 && !isCoveredByScenario('hr', vitals.hr, '>')) {
        if (this.canAlert('hr_high', 'critical')) {
          this.recordAlert('hr_high', 'critical');
          this.alert(
            `CRITICAL: Tachycardia HR ${vitals.hr}. Assess for cause.`,
            'critical', 'hr'
          );
        }
      }
    }

    // BP alarm
    const bpDangerAlarm = activeAlarms.find((a: AlarmEntry) => a.type === 'bp' && a.severity === 'danger');
    if (bpDangerAlarm && vitals.sbp < 70 && !isCoveredByScenario('sbp', vitals.sbp, '<')) {
      if (this.canAlert('sbp', 'critical')) {
        this.recordAlert('sbp', 'critical');
        this.alert(
          `CRITICAL: Severe hypotension. Fluid resuscitation and vasopressors needed.`,
          'critical', 'sbp'
        );
      }
    }

    // RR alarms
    const rrAlarm = activeAlarms.find((a: AlarmEntry) => a.type === 'rr');
    if (rrAlarm && !isCoveredByScenario('rr', vitals.rr, '<')) {
      if (vitals.rr === 0) {
        if (this.canAlert('rr', 'critical')) {
          this.recordAlert('rr', 'critical');
          this.alert(
            `CRITICAL: APNEA detected. Bag-mask ventilate NOW.`,
            'critical', 'rr'
          );
        }
      } else if (vitals.rr < 4) {
        if (this.canAlert('rr', 'critical')) {
          this.recordAlert('rr', 'critical');
          this.alert(
            `CRITICAL: Near-apnea. RR ${vitals.rr}. Assist ventilation immediately.`,
            'critical', 'rr'
          );
        }
      }
    }

    // EtCO2 alarms
    const etco2Alarm = activeAlarms.find((a: AlarmEntry) => a.type === 'etco2');
    if (etco2Alarm && !isCoveredByScenario('etco2', vitals.etco2, '>')) {
      if (vitals.etco2 > 80) {
        if (this.canAlert('etco2', 'critical')) {
          this.recordAlert('etco2', 'critical');
          this.alert(
            `CRITICAL: Severe hypercarbia EtCO2 ${vitals.etco2}. Patient in respiratory failure.`,
            'critical', 'etco2'
          );
        }
      } else if (vitals.etco2 > 60) {
        if (this.canAlert('etco2', 'warning')) {
          this.recordAlert('etco2', 'warning');
          this.alert(
            `WARNING: Hypercarbia EtCO2 ${vitals.etco2}. Ventilation inadequate.`,
            'warning', 'etco2'
          );
        }
      }
    }

    // MOASS check (not in activeAlarms — still evaluated independently)
    if (moass === 0 && !isCoveredByScenario('moass', moass, '<')) {
      if (this.canAlert('moass', 'critical')) {
        this.recordAlert('moass', 'critical');
        this.alert(
          `CRITICAL: Patient is unresponsive (MOASS 0). Check airway, breathing, circulation.`,
          'critical', 'moass'
        );
      }
    }

    // Cross-vital coherence checks
    const violations = detectCoherenceViolations(vitals);
    for (const v of violations) {
      const alertLevel = v.severity === 'critical' ? 'critical' : 'warning';
      if (this.canAlert(v.rule, alertLevel)) {
        this.recordAlert(v.rule, alertLevel);
        // Log to console so violations are visible in engine logs
        console.warn(`[VCM] Coherence violation (${v.rule}): ${v.message}`);
        // Auto-correct incoherent vital values
        if (v.corrections) {
          const simStore = useSimStore.getState();
          for (const [param, value] of Object.entries(v.corrections)) {
            simStore.overrideVital(param, value as number);
          }
        }
        // Notify the mentor
        this.alert(v.message, alertLevel);
      }
    }

    // Emergency phase override for extreme values
    if (vitals.hr === 0) {
      useAIStore.getState().setCurrentScenarioPhase('complication');
    }
  }
}

export const vitalCoherenceMonitor = new VitalCoherenceMonitor();

