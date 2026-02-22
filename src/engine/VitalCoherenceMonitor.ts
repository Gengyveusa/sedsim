// src/engine/VitalCoherenceMonitor.ts
// Real-time vital sign watcher that fires mentor alerts for critical thresholds
// independent of scripted scenario steps.

import useSimStore from '../store/useSimStore';
import useAIStore from '../store/useAIStore';

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

export class VitalCoherenceMonitor {
  private timerId: ReturnType<typeof setInterval> | null = null;
  private cooldowns: Record<string, AlertCooldown> = {};
  private onCriticalAlert: (() => void) | null = null;

  start(onCriticalAlert?: () => void) {
    if (this.timerId) return;
    this.cooldowns = {};
    // Callback invoked when a critical alert fires while a scenario question is pending.
    // ScenarioEngine passes a function that clears its `awaitingAnswer` state so scenario
    // progression can resume after the critical event overrides the stale question.
    this.onCriticalAlert = onCriticalAlert ?? null;
    this.timerId = setInterval(() => this.tick(), 2000);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
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

  private tick() {
    const { vitals, moass } = useSimStore.getState();

    // SpO2 checks
    if (vitals.spo2 < 85 && !isCoveredByScenario('spo2', vitals.spo2, '<')) {
      if (this.canAlert('spo2', 'critical')) {
        this.recordAlert('spo2', 'critical');
        this.alert(
          `CRITICAL: SpO2 has dropped to ${vitals.spo2}%! Patient is severely hypoxic. Immediate intervention required: increase FiO2, jaw thrust, consider BVM ventilation.`,
          'critical', 'spo2'
        );
      }
    } else if (vitals.spo2 < 90 && !isCoveredByScenario('spo2', vitals.spo2, '<')) {
      if (this.canAlert('spo2', 'warning')) {
        this.recordAlert('spo2', 'warning');
        this.alert(
          `WARNING: SpO2 is ${vitals.spo2}%. Airway management needed.`,
          'warning', 'spo2'
        );
      }
    }

    // HR checks
    if (vitals.hr < 40 && !isCoveredByScenario('hr', vitals.hr, '<')) {
      if (this.canAlert('hr_low', 'critical')) {
        this.recordAlert('hr_low', 'critical');
        this.alert(
          `CRITICAL: Severe bradycardia HR ${vitals.hr}. Consider atropine.`,
          'critical', 'hr'
        );
      }
    }

    if (vitals.hr > 150 && !isCoveredByScenario('hr', vitals.hr, '>')) {
      if (this.canAlert('hr_high', 'critical')) {
        this.recordAlert('hr_high', 'critical');
        this.alert(
          `CRITICAL: Tachycardia HR ${vitals.hr}. Assess for cause.`,
          'critical', 'hr'
        );
      }
    }

    // SBP check
    if (vitals.sbp < 70 && !isCoveredByScenario('sbp', vitals.sbp, '<')) {
      if (this.canAlert('sbp', 'critical')) {
        this.recordAlert('sbp', 'critical');
        this.alert(
          `CRITICAL: Severe hypotension. Fluid resuscitation and vasopressors needed.`,
          'critical', 'sbp'
        );
      }
    }

    // RR checks
    if (vitals.rr === 0 && !isCoveredByScenario('rr', vitals.rr, '<')) {
      if (this.canAlert('rr', 'critical')) {
        this.recordAlert('rr', 'critical');
        this.alert(
          `CRITICAL: APNEA detected. Bag-mask ventilate NOW.`,
          'critical', 'rr'
        );
      }
    } else if (vitals.rr < 4 && !isCoveredByScenario('rr', vitals.rr, '<')) {
      if (this.canAlert('rr', 'critical')) {
        this.recordAlert('rr', 'critical');
        this.alert(
          `CRITICAL: Near-apnea. RR ${vitals.rr}. Assist ventilation immediately.`,
          'critical', 'rr'
        );
      }
    }

    // EtCO2 checks
    if (vitals.etco2 > 80 && !isCoveredByScenario('etco2', vitals.etco2, '>')) {
      if (this.canAlert('etco2', 'critical')) {
        this.recordAlert('etco2', 'critical');
        this.alert(
          `CRITICAL: Severe hypercarbia EtCO2 ${vitals.etco2}. Patient in respiratory failure.`,
          'critical', 'etco2'
        );
      }
    } else if (vitals.etco2 > 60 && !isCoveredByScenario('etco2', vitals.etco2, '>')) {
      if (this.canAlert('etco2', 'warning')) {
        this.recordAlert('etco2', 'warning');
        this.alert(
          `WARNING: Hypercarbia EtCO2 ${vitals.etco2}. Ventilation inadequate.`,
          'warning', 'etco2'
        );
      }
    }

    // MOASS check
    if (moass === 0 && !isCoveredByScenario('moass', moass, '<')) {
      if (this.canAlert('moass', 'critical')) {
        this.recordAlert('moass', 'critical');
        this.alert(
          `CRITICAL: Patient is unresponsive (MOASS 0). Check airway, breathing, circulation.`,
          'critical', 'moass'
        );
      }
    }

    // Emergency phase override for extreme values not covered by individual alert conditions
    // (e.g. HR == 0 has no dedicated alert above but is still a catastrophic emergency)
    if (vitals.hr === 0) {
      useAIStore.getState().setCurrentScenarioPhase('complication');
    }
  }
}

export const vitalCoherenceMonitor = new VitalCoherenceMonitor();

