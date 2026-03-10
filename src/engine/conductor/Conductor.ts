/**
 * src/engine/conductor/Conductor.ts
 * Conductor Core — Main Orchestrator
 *
 * The Conductor is the single clock that owns the scenario timeline. It:
 *   1. Loads a ConductorScenario (or converts a legacy InteractiveScenario).
 *   2. Runs a 1-second tick() interval.
 *   3. On every tick it:
 *        a. evaluateStepTriggers() — fires scenario steps when conditions are met.
 *        b. detectPhysioEvents()   — runs physioDetector and injects ad-hoc beats.
 *        c. checkVitalCoherence()  — applies vitalTargets interpolation.
 *   4. Delegates all beat playback to BeatPlayer.
 *   5. Dispatches all store side-effects through BeatDispatcher callbacks.
 *   6. Emits all state-change events through EventBus.
 */

import type {
  ConductorScenario,
  ConductorStep,
  StepVitalTargets,
} from './types';
import { EventBus } from './eventBus';
import { BeatPlayer, BeatDispatcher } from './beatPlayer';
import { detectPhysioEvents, resetPhysioDetector } from './physioDetector';
import {
  computeVitalOverrides,
  applyVitalOverrides,
} from './vitalTargets';
import { convertLegacySteps } from './legacyAdapter';
import type { InteractiveScenario } from '../ScenarioEngine';
import { scoreScenario, defaultRubric } from '../scoringEngine';
import type { ScoringSummary, ScoringSession } from '../scoringEngine';
import type { LogEntry, TrendPoint } from '../../types';

// ─── Store accessor types (lightweight interface so we don't import the full
//     Zustand stores directly — avoids circular deps and keeps Conductor testable) ─

export interface SimStoreAccessor {
  getVitals: () => {
    spo2: number;
    hr: number;
    sbp: number;
    rr: number;
    etco2: number;
    map?: number;
    rhythm?: string;
  };
  getMoass: () => number;
  getPkStates: () => Record<string, { ce: number }>;
  getElapsedSeconds: () => number;
  getPkPdSensitivity: () => number;
  overrideVital: (parameter: string, value: number) => void;
  administerBolus: (drug: string, dose: number) => void;
  getEventLog: () => LogEntry[];
  getTrendData: () => TrendPoint[];
}

export interface AIStoreAccessor {
  addMentorMessage: (role: 'user' | 'mentor', content: string) => void;
  addVitalAnnotation: (ann: import('./types').VitalAnnotation) => void;
  setActiveHighlights: (
    highlights:
      | { targetId: string; text: string; vitalLabel?: string; vitalValue?: number; severity?: 'normal' | 'warning' | 'danger' }[]
      | null
  ) => void;
  setCurrentQuestion: (
    q: { stepId: string; question: import('../ScenarioEngine').ScenarioQuestion } | null
  ) => void;
  setCurrentScenarioPhase: (
    phase: ConductorStep['phase'] | null
  ) => void;
  setScenarioRunning: (running: boolean) => void;
  setPendingContinue: (pending: { stepId: string; stepLabel: string } | null) => void;
  setLastScenarioScore: (score: ScoringSummary | null) => void;
}

// ─── Conductor Config ─────────────────────────────────────────────────────────

export interface ConductorConfig {
  /** Interval between Conductor ticks in milliseconds (default: 1000). */
  tickIntervalMs?: number;
}

// ─── Condition evaluation helper ──────────────────────────────────────────────

function evaluateCondition(
  condition: NonNullable<ConductorStep['triggerCondition']>,
  vitals: ReturnType<SimStoreAccessor['getVitals']>,
  moass: number
): boolean {
  const paramMap: Record<string, number> = {
    spo2: vitals.spo2,
    hr: vitals.hr,
    rr: vitals.rr,
    sbp: vitals.sbp,
    etco2: vitals.etco2,
    moass,
  };
  const value = paramMap[condition.parameter];
  if (value === undefined) return false;

  switch (condition.operator) {
    case '<':  return value < condition.threshold;
    case '>':  return value > condition.threshold;
    case '<=': return value <= condition.threshold;
    case '>=': return value >= condition.threshold;
    case '==': return value === condition.threshold;
    default:   return false;
  }
}

// ─── Conductor ────────────────────────────────────────────────────────────────

export class Conductor {
  readonly bus: EventBus = new EventBus();

  private scenario: ConductorScenario | null = null;
  private completedStepIds = new Set<string>();
  private activeStepId: string | null = null;
  private currentVitalTargets: StepVitalTargets | null = null;
  private pendingQuestion: { stepId: string; question: import('../ScenarioEngine').ScenarioQuestion } | null = null;

  /** Timer for auto-advancing non-question steps after beats finish. */
  private autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Seconds a physiology trigger condition has been continuously met, keyed by stepId. */
  private conditionDurationSecs: Map<string, number> = new Map();

  private tickIntervalMs: number;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private readonly beatPlayer: BeatPlayer;

  constructor(
    private readonly sim: SimStoreAccessor,
    private readonly ai: AIStoreAccessor,
    config: ConductorConfig = {}
  ) {
    this.tickIntervalMs = config.tickIntervalMs ?? 1_000;

    const dispatcher: BeatDispatcher = {
      onMillie: (text, _beatId) => {
        this.ai.addMentorMessage('mentor', text);
      },
      onCallout: (callout, _beatId) => {
        this.ai.setActiveHighlights([
          {
            targetId: callout.targetId,
            text: callout.text,
            vitalLabel: callout.vitalLabel,
            vitalValue: callout.vitalValue,
            severity: callout.severity,
          },
        ]);
      },
      onVitalBadge: (badge, _beatId) => {
        this.ai.addVitalAnnotation(badge);
      },
      onSimAction: (action, _beatId) => {
        // SimActions are delegated to the physiology store via the bus so the
        // Conductor itself stays decoupled from useSimStore internals.
        this.bus.emit({
          type: 'beat',
          beat: { id: _beatId, type: 'simAction', delayMs: 0, simAction: action },
          stepId: this.activeStepId ?? '',
        });
      },
      onQuestion: (question, stepId, _beatId) => {
        this.pendingQuestion = { stepId, question };
        this.ai.setCurrentQuestion({ stepId, question });
        this.bus.emit({ type: 'question_ready', stepId, question });
      },
      onPhase: (_label, _beatId) => {
        // The phase label is derived from the step's phase field; emit it.
        const step = this.findStep(this.activeStepId ?? '');
        if (step) {
          this.ai.setCurrentScenarioPhase(step.phase);
          this.bus.emit({ type: 'phase_changed', phase: step.phase });
        }
      },
    };

    this.beatPlayer = new BeatPlayer(dispatcher, this.bus);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Load a ConductorScenario and prepare the Conductor for playback.
   * Call start() to begin ticking.
   */
  loadScenario(scenario: ConductorScenario): void {
    this.stop();
    this.scenario = scenario;
    this.completedStepIds.clear();
    this.activeStepId = null;
    this.currentVitalTargets = null;
    this.conditionDurationSecs.clear();
    resetPhysioDetector();
    this.bus.emit({ type: 'scenario_started', scenarioId: scenario.id });
  }

  /**
   * Convert a legacy InteractiveScenario and load it.
   */
  loadLegacyScenario(legacy: InteractiveScenario): void {
    const conductor: ConductorScenario = {
      id: legacy.id,
      title: legacy.title,
      difficulty: legacy.difficulty,
      patientArchetype: legacy.patientArchetype,
      steps: convertLegacySteps(legacy.steps),
      debrief: legacy.debrief,
      scoringRubric: legacy.scoringRubric,
    };
    this.loadScenario(conductor);
  }

  /** Start the 1-second tick interval. */
  start(): void {
    if (this.tickTimer !== null) return;
    this.ai.setScenarioRunning(true);
    this.tickTimer = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  /** Stop the tick interval and cancel any pending beats. */
  stop(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.autoAdvanceTimer !== null) {
      clearTimeout(this.autoAdvanceTimer);
      this.autoAdvanceTimer = null;
    }
    this.beatPlayer.stop();
    this.pendingQuestion = null;
    this.ai.setCurrentQuestion(null);
    this.ai.setPendingContinue(null);
    this.ai.setScenarioRunning(false);
    this.runDebrief();
  }

  /** Run end-of-scenario debrief: compute and store a ScoringSummary. */
  private runDebrief(): void {
    if (!this.scenario) return;
    const rubric = this.scenario.scoringRubric ?? defaultRubric(this.scenario.difficulty);
    const session: ScoringSession = {
      elapsedSeconds: this.sim.getElapsedSeconds(),
      eventLog: this.sim.getEventLog(),
      trendData: this.sim.getTrendData(),
      completedStepIds: Array.from(this.completedStepIds),
      totalStepCount: this.scenario.steps.length,
    };
    const summary = scoreScenario(rubric, session);
    this.ai.setLastScenarioScore(summary);
    // Persist to localStorage for cross-session review
    try {
      const key = `sedsim_score_${this.scenario.id}`;
      localStorage.setItem(key, JSON.stringify({ ...summary, scenarioId: this.scenario.id, scenarioTitle: this.scenario.title, completedAt: Date.now() }));
    } catch { /* ignore storage errors */ }
    // Post debrief message in Millie chat
    const { discussionQuestions, keyTakeaways } = this.scenario.debrief;
    const passBadge = summary.passed ? '✅ PASS' : '❌ FAIL';
    const lines: string[] = [
      `🎓 **Scenario Debrief — ${this.scenario.title}**\n`,
      `📊 **${passBadge} — Score: ${summary.percentScore}% (${summary.grade}) — Pass ≥ ${summary.passThreshold}%**\n` +
        `• ⏱ Timing:           ${summary.dimensions.timing.score}/${summary.dimensions.timing.maxScore} pts (${summary.dimensions.timing.percent}%)\n` +
        `• 💊 Appropriateness:  ${summary.dimensions.appropriateness.score}/${summary.dimensions.appropriateness.maxScore} pts (${summary.dimensions.appropriateness.percent}%)\n` +
        `• 🛡 Safety:           ${summary.dimensions.safety.score}/${summary.dimensions.safety.maxScore} pts (${summary.dimensions.safety.percent}%)\n` +
        `• ✔ Completeness:     ${summary.dimensions.completeness.score}/${summary.dimensions.completeness.maxScore} pts (${summary.dimensions.completeness.percent}%)`,
    ];
    if (discussionQuestions.length) {
      lines.push(`💬 **Discussion Questions:**\n${discussionQuestions.map(q => `• ${q}`).join('\n')}`);
    }
    if (keyTakeaways.length) {
      lines.push(`🔑 **Key Takeaways:**\n${keyTakeaways.map(t => `• ${t}`).join('\n')}`);
    }
    this.ai.addMentorMessage('mentor', lines.join('\n\n'));
  }

  /**
   * Submit an answer for the currently pending question.
   * Evaluates correctness, shows feedback as a Millie message, and gates
   * advancement behind the Continue / Next Step button.
   */
  answerQuestion(answer: string | number): void {
    const pending = this.pendingQuestion;
    if (!pending) return;
    const { stepId, question } = pending;

    let feedback: string;
    if (question.type === 'numeric_range' && question.idealRange) {
      const num = Number(answer);
      if (num < question.idealRange[0]) {
        feedback = question.feedback['low'] ?? 'That value is below the recommended range.';
      } else if (num > question.idealRange[1]) {
        feedback = question.feedback['high'] ?? 'That value is above the recommended range.';
      } else {
        feedback = question.feedback['ideal'] ?? 'Good choice — within the ideal range!';
      }
      // Administer the user-specified dose for dosing questions
      const step = this.findStep(stepId);
      if (step) {
        const simActionBeat = step.beats.find(
          b => b.type === 'simAction' && b.simAction?.type === 'administer_drug'
        );
        const sa = simActionBeat?.simAction;
        if (sa?.type === 'administer_drug' && 'drug' in sa && Number(answer) > 0) {
          this.sim.administerBolus(sa.drug, Number(answer));
        }
      }
    } else {
      const key = String(answer);
      feedback = question.feedback[key] ?? (answer === question.correctAnswer ? 'Correct!' : 'Not quite. Review the teaching points.');
    }

    this.ai.addMentorMessage('mentor', feedback);
    this.pendingQuestion = null;
    this.ai.setCurrentQuestion(null);
    this.ai.setActiveHighlights(null);
    this.ai.setPendingContinue({ stepId, stepLabel: stepId });
  }

  /**
   * Acknowledge the current step and allow the Conductor to advance.
   * Called when the learner clicks "Next Step".
   */
  continuePendingStep(): void {
    if (this.autoAdvanceTimer !== null) {
      clearTimeout(this.autoAdvanceTimer);
      this.autoAdvanceTimer = null;
    }
    this.ai.setPendingContinue(null);
    this.completeCurrentStep();
  }

  /** Mark the current step as complete and allow the next to trigger. */
  completeCurrentStep(): void {
    if (!this.activeStepId) return;
    const stepId = this.activeStepId;
    this.completedStepIds.add(stepId);
    this.beatPlayer.stop();
    this.activeStepId = null;
    this.bus.emit({ type: 'step_completed', stepId });
  }

  // ── Tick ───────────────────────────────────────────────────────────────────

  /** Called once per second by the internal interval. */
  tick(): void {
    if (!this.scenario) return;

    this.evaluateStepTriggers();
    this.detectPhysioEventsAndInject();
    this.checkVitalCoherence();
  }

  // ── Private: Step Trigger Evaluation ──────────────────────────────────────

  private evaluateStepTriggers(): void {
    if (!this.scenario) return;

    // ── CRITICAL GUARD: never fire a new step while one is already active ─────
    // Steps advance sequentially: fire → complete → evaluate next.
    // Physiology safety events (desaturation, bradycardia, etc.) are handled
    // separately by detectPhysioEventsAndInject() and bypass this gate.
    if (this.activeStepId !== null) return;

    const elapsed = this.sim.getElapsedSeconds();
    const vitals = this.sim.getVitals();
    const moass = this.sim.getMoass();

    for (const step of this.scenario.steps) {
      if (this.completedStepIds.has(step.id)) continue;

      if (this.shouldFireStep(step, elapsed, vitals, moass)) {
        this.fireStep(step);
        // Only fire one new step per tick to avoid flooding.
        break;
      }
    }
  }

  private shouldFireStep(
    step: ConductorStep,
    elapsed: number,
    vitals: ReturnType<SimStoreAccessor['getVitals']>,
    moass: number
  ): boolean {
    switch (step.triggerType) {
      case 'on_start':
        // Fire only at the very beginning — once any step has ever been
        // activated or completed, the on_start window is closed.
        return this.completedStepIds.size === 0 && !this.activeStepId;

      case 'on_time':
        return (
          step.triggerTimeSeconds !== undefined &&
          elapsed >= step.triggerTimeSeconds
        );

      case 'on_physiology': {
        if (!step.triggerCondition) return false;
        const condMet = evaluateCondition(step.triggerCondition, vitals, moass);
        if (!condMet) {
          this.conditionDurationSecs.delete(step.id);
          return false;
        }
        // Increment duration counter.
        const prevDur = this.conditionDurationSecs.get(step.id) ?? 0;
        const newDur = prevDur + 1;
        this.conditionDurationSecs.set(step.id, newDur);
        const required = step.triggerCondition.durationSeconds ?? 1;
        return newDur >= required;
      }

      case 'on_step_complete':
        return (
          step.afterStepId !== undefined &&
          this.completedStepIds.has(step.afterStepId)
        );

      default:
        return false;
    }
  }

  private fireStep(step: ConductorStep): void {
    this.activeStepId = step.id;
    if (step.vitalTargets) {
      this.currentVitalTargets = step.vitalTargets;
    }

    // Update phase in AI store.
    this.ai.setCurrentScenarioPhase(step.phase);
    this.bus.emit({ type: 'step_started', stepId: step.id, phase: step.phase });
    this.bus.emit({ type: 'phase_changed', phase: step.phase });

    // Start beat playback.
    this.beatPlayer.play(step.beats, step.id);

    // Determine whether this step has a question beat.
    const hasQuestion = step.beats.some(b => b.type === 'question');

    if (!hasQuestion) {
      // No question — schedule teaching points + auto-advance after beats finish.
      // Calculate the time when the last beat will have played.
      const maxBeatDelay = step.beats.reduce(
        (max, b) => Math.max(max, b.delayMs),
        0
      );
      // Teaching points appear after beats, then pending-continue + auto-advance.
      const teachingDelay = maxBeatDelay + 1000;
      const continueDelay = teachingDelay + (step.teachingPoints?.length ? 1500 : 0);
      const autoAdvanceDelay = continueDelay + 8000; // 8s auto-advance like legacy engine

      // Inject teaching points after dialogue completes.
      if (step.teachingPoints?.length) {
        setTimeout(() => {
          if (this.activeStepId !== step.id) return;
          this.ai.addMentorMessage(
            'mentor',
            '📚 **Teaching Points:**\n' + step.teachingPoints!.map(tp => `• ${tp}`).join('\n')
          );
        }, teachingDelay);
      }

      // Show the "Next Step" button so learner can advance early.
      setTimeout(() => {
        if (this.activeStepId !== step.id) return;
        this.ai.setPendingContinue({ stepId: step.id, stepLabel: step.id });
      }, continueDelay);

      // Auto-advance after 8 seconds if the learner doesn't click.
      this.autoAdvanceTimer = setTimeout(() => {
        this.autoAdvanceTimer = null;
        if (this.activeStepId !== step.id) return;
        this.ai.setPendingContinue(null);
        this.completeCurrentStep();
      }, autoAdvanceDelay);
    }
    // For steps with questions: the question beat fires the onQuestion callback,
    // which sets pendingQuestion. User answers → answerQuestion() → feedback →
    // setPendingContinue → user clicks Next Step → continuePendingStep().
  }

  // ── Private: Physio Event Injection ───────────────────────────────────────

  private detectPhysioEventsAndInject(): void {
    const vitals = this.sim.getVitals();
    const moass = this.sim.getMoass() as import('../../types').MOASSLevel;

    const physioEvents = detectPhysioEvents(vitals as import('../../types').Vitals, moass);

    for (const event of physioEvents) {
      this.bus.emit({
        type: 'physio_event',
        eventName: event.name,
        data: event.data,
      });

      // Inject ad-hoc beats immediately (bypass normal step sequencing).
      this.beatPlayer.play(event.beats, `__physio_${event.name}`);
    }
  }

  // ── Private: Vital Coherence ───────────────────────────────────────────────

  private checkVitalCoherence(): void {
    if (!this.currentVitalTargets) return;

    const vitals = this.sim.getVitals();
    const overrides = computeVitalOverrides(this.currentVitalTargets, {
      currentVitals: {
        spo2: vitals.spo2,
        hr: vitals.hr,
        sbp: vitals.sbp,
        rr: vitals.rr,
        etco2: vitals.etco2,
      },
      pkPdSensitivity: this.sim.getPkPdSensitivity(),
      elapsedSeconds: this.sim.getElapsedSeconds(),
    });

    if (overrides.length > 0) {
      applyVitalOverrides(overrides, this.sim.overrideVital);
      this.bus.emit({
        type: 'vital_target_updated',
        targets: this.currentVitalTargets,
      });
    }
  }

  // ── Private: Utilities ────────────────────────────────────────────────────

  private findStep(stepId: string): ConductorStep | undefined {
    return this.scenario?.steps.find((s) => s.id === stepId);
  }
}
