// src/engine/ScenarioEngine.ts
// Millie the Mentor — Interactive ScenarioEngine
// Bridges useSimStore (physiology) and useAIStore (mentor chat)

import useSimStore from '../store/useSimStore';
import useAIStore from '../store/useAIStore';
import { generateDebrief } from '../ai/mentor';
import { AirwayDevice, InterventionType } from '../types';
import { vitalCoherenceMonitor } from './VitalCoherenceMonitor';
import type { SedSimScenario, ScenarioScore, ChecklistItemResult } from './SedSimCase.types';
import { scoreScenario, defaultRubric, type ScoringRubric, type ScoringSummary } from './scoringEngine';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface InteractiveScenarioStep {
  id: string;
  phase: 'pre_induction' | 'induction' | 'maintenance' | 'complication' | 'recovery' | 'debrief';
  triggerType: 'on_start' | 'on_time' | 'on_physiology' | 'on_step_complete';
  triggerCondition?: {
    parameter: 'spo2' | 'hr' | 'rr' | 'sbp' | 'moass' | 'etco2';
    operator: '<' | '>' | '<=' | '>=' | '==';
    threshold: number;
    durationSeconds?: number;
  };
  triggerTimeSeconds?: number;
  afterStepId?: string;
  millieDialogue: string[];
  voiceText?: string;
  question?: ScenarioQuestion;
  simActions?: SimAction[];
  teachingPoints?: string[];
  highlight?: string[];
}

export interface ScenarioQuestion {
  type: 'single_choice' | 'numeric_range' | 'multi_select';
  prompt: string;
  options?: string[];
  correctAnswer: string | number;
  idealRange?: [number, number];
  feedback: Record<string, string>;
}

export type SimAction =
  | { type: 'administer_drug'; drug: string; dose: number }
  | { type: 'set_fio2'; fio2: number }
  | { type: 'set_airway_device'; device: string }
  | { type: 'apply_intervention'; intervention: string }
  | { type: 'select_patient'; archetypeKey: string }
  | { type: 'advance_time'; seconds: number }
  | { type: 'set_speed'; speed: number }
  | { type: 'set_vital'; parameter: string; value: number }
  | { type: 'start_desaturation'; rate: number };

export interface InteractiveScenario {
  id: string;
  title: string;
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert';
  patientArchetype: string;
  procedure: string;
  description: string;
  learningObjectives: string[];
  clinicalPearls: string[];
  preopVignette: {
    indication: string;
    setting: string;
    history: string[];
    exam: string[];
    labs?: string[];
    baselineMonitors: string[];
    targetSedationGoal: string;
  };
  drugProtocols: {
    name: string;
    route: string;
    typicalBolusRange: [number, number];
    maxTotalDose: number;
    unit: string;
  }[];
  steps: InteractiveScenarioStep[];
  debrief: {
    discussionQuestions: string[];
    keyTakeaways: string[];
  };
  /** Original JSON scenario source (present only for JSON-driven scenarios). */
  jsonSource?: SedSimScenario;
  // Optional enrichment fields
  shortObjective?: string;
  tags?: string[];
  teachingPoints?: string[];
  patientDetail?: {
    age: number;
    sex: 'M' | 'F' | 'Other';
    heightCm: number;
    weightKg: number;
    asa: 1 | 2 | 3 | 4;
    comorbidities: string[];
    airway?: {
      mallampati: 1 | 2 | 3 | 4;
      bmi: number;
      neckCircumferenceCm?: number;
      notes?: string;
    };
    baselineMeds?: string[];
  };
  successCriteria?: {
    description: string;
    maxSpo2Drop?: number;
    noMoassBelow?: number;
    maxTotalDoses?: Record<string, number>;
    timeInTargetMoassRange?: { low: number; high: number; minSeconds: number };
  };
  failureCriteria?: {
    description: string;
    spo2BelowForS?: { threshold: number; duration: number };
    sbpBelowForS?: { threshold: number; duration: number };
    moass0ForS?: { duration: number };
    hardStopEvents?: string[];
  };
  debriefEnhanced?: {
    keyQuestions: string[];
    graphsToHighlight: string[];
    scoringWeights?: {
      titration: number;
      airwayManagement: number;
      hemodynamicControl: number;
      complicationResponse: number;
    };
  };
  /** Four-dimension scoring rubric for this scenario. Falls back to defaultRubric(difficulty). */
  scoringRubric?: ScoringRubric;
}

// ─── ScenarioEngine ─────────────────────────────────────────────────────────

/** Seconds before an on_time trigger to fast-forward to, so it fires on the next tick. */
const TRIGGER_PRE_FIRE_BUFFER_SECONDS = 1;

// ─── JSON → InteractiveScenario adapter ─────────────────────────────────────

/** Maps JSON PhaseId ("pre") to the engine's phase union ("pre_induction"). */
function mapPhaseId(phaseId: string): InteractiveScenarioStep['phase'] {
  const map: Record<string, InteractiveScenarioStep['phase']> = {
    pre: 'pre_induction',
    induction: 'induction',
    maintenance: 'maintenance',
    complication: 'complication',
    recovery: 'recovery',
    debrief: 'debrief',
  };
  return map[phaseId] ?? 'pre_induction';
}

/**
 * Convert a SedSimScenario (JSON format) into the existing InteractiveScenario
 * format that ScenarioEngine already knows how to run.
 */
export function jsonScenarioToInteractive(json: SedSimScenario): InteractiveScenario {
  // Build a reverse-transition map: toStateId → fromStateId[]
  const predecessorMap = new Map<string, string[]>();
  for (const state of json.states) {
    for (const t of state.transitions) {
      const existing = predecessorMap.get(t.toStateId) ?? [];
      predecessorMap.set(t.toStateId, [...existing, state.id]);
    }
  }

  const steps: InteractiveScenarioStep[] = json.states.map((state, idx) => {
    const isFirst = idx === 0;
    const predecessors = predecessorMap.get(state.id) ?? [];

    // Determine trigger type
    let triggerType: InteractiveScenarioStep['triggerType'];
    let afterStepId: string | undefined;
    let triggerTimeSeconds: number | undefined;
    let triggerCondition: InteractiveScenarioStep['triggerCondition'];

    if (isFirst) {
      triggerType = 'on_start';
    } else {
      const ec = state.exitConditions[0];
      if (ec?.type === 'on_time' && ec.minTimeSec !== undefined) {
        triggerType = 'on_time';
        triggerTimeSeconds = ec.minTimeSec;
      } else if (ec?.type === 'on_physiology' && ec.physiologyPredicate) {
        triggerType = 'on_physiology';
        const pred = ec.physiologyPredicate;
        if (pred.spo2LessThan !== undefined) {
          triggerCondition = {
            parameter: 'spo2',
            operator: '<',
            threshold: pred.spo2LessThan,
            durationSeconds: pred.spo2DurationSec,
          };
        } else if (pred.mapLessThan !== undefined) {
          triggerCondition = {
            parameter: 'sbp',
            operator: '<',
            threshold: pred.mapLessThan,
          };
        }
      } else {
        triggerType = 'on_step_complete';
        afterStepId = predecessors[0] ?? json.states[idx - 1]?.id;
      }
    }

    // Build question from options array if this is a "question" state
    let question: ScenarioQuestion | undefined;
    if (state.type === 'question' && state.options && state.options.length > 0) {
      const correctOption = state.options.find(o => o.isCorrect);
      const feedback: Record<string, string> = {};
      state.options.forEach((o, i) => {
        feedback[o.label] = state.explanations?.[i] ?? '';
      });
      question = {
        type: 'single_choice',
        prompt: state.prompt ?? '',
        options: state.options.map(o => o.label),
        correctAnswer: correctOption?.label ?? '',
        feedback,
      };
    }

    // Map simActions
    const simActions: SimAction[] = [];
    for (const sa of state.simActions ?? []) {
      if (sa.type === 'give_drug') {
        const payload = sa.payload as { drug: string; doseMg: number };
        simActions.push({ type: 'administer_drug', drug: payload.drug, dose: payload.doseMg });
      } else if (sa.type === 'change_oxygen') {
        const payload = sa.payload as { device?: string; fio2?: number };
        if (payload.device) {
          simActions.push({ type: 'set_airway_device', device: payload.device });
        }
        if (payload.fio2 !== undefined) {
          simActions.push({ type: 'set_fio2', fio2: payload.fio2 });
        }
      } else if (sa.type === 'apply_stimulus') {
        const payload = sa.payload as { stimulusType: string };
        simActions.push({ type: 'apply_intervention', intervention: payload.stimulusType });
      }
    }

    const millieDialogue: string[] = [];
    if (state.prompt) millieDialogue.push(state.prompt);

    return {
      id: state.id,
      phase: mapPhaseId(state.phaseId),
      triggerType,
      triggerTimeSeconds,
      afterStepId,
      triggerCondition,
      millieDialogue,
      question,
      simActions: simActions.length > 0 ? simActions : undefined,
    };
  });

  // Build a display label for the "procedure" field from tags or title
  const procedure = json.tags.includes('colonoscopy') ? 'Colonoscopy' : json.title;

  // Determine difficulty from tags
  const difficultyMap: Record<string, InteractiveScenario['difficulty']> = {
    easy: 'easy', moderate: 'moderate', hard: 'hard', expert: 'expert',
  };
  let difficulty: InteractiveScenario['difficulty'] = 'moderate';
  for (const tag of json.tags) {
    if (tag in difficultyMap) { difficulty = difficultyMap[tag]; break; }
  }

  return {
    id: json.id,
    title: json.title,
    difficulty,
    patientArchetype: json.patient.archetypeId,
    procedure,
    description: json.description,
    learningObjectives: json.learningObjectives,
    clinicalPearls: [],
    preopVignette: {
      indication: procedure,
      setting: 'Endoscopy suite',
      history: [],
      exam: [],
      baselineMonitors: ['NIBP', 'SpO2', 'ECG', 'Capnography'],
      targetSedationGoal: 'MOASS 2-3',
    },
    drugProtocols: [],
    steps,
    debrief: {
      discussionQuestions: [],
      keyTakeaways: json.learningObjectives,
    },
  };
}

// ─── Scoring helpers ─────────────────────────────────────────────────────────

function evaluateJsonScore(
  json: SedSimScenario,
  answers: Map<string, string>
): ScenarioScore {
  const allItems: ChecklistItemResult[] = [];
  let totalMax = 0;

  for (const state of json.states) {
    if (!state.scoring) continue;
    const selectedLabel = answers.get(state.id);
    const selectedOption = state.options?.find(o => o.label === selectedLabel);
    const passed = selectedOption?.isCorrect === true;

    for (const item of state.scoring.checklistItems) {
      const earned = passed ? item.weight : 0;
      allItems.push({ id: item.id, description: item.description, weight: item.weight, earned, passed });
    }
    totalMax += state.scoring.maxScore;
  }

  const totalScore = allItems.reduce((acc, i) => acc + i.earned, 0);
  return {
    totalScore,
    maxScore: totalMax,
    percentScore: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0,
    items: allItems,
  };
}

export class ScenarioEngine {
  private scenario: InteractiveScenario | null = null;
  private scenarioTimeSeconds = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private firedStepIds = new Set<string>();
  private physiologyDurationCounters: Record<string, number> = {};
    private physioStepEligibleSince: Record<string, number> = {};
  awaitingAnswer: { stepId: string; question: ScenarioQuestion } | null = null;
  awaitingContinue: { stepId: string } | null = null;
  private started = false;
  // JSON scenario support
  private jsonScenario: SedSimScenario | null = null;
  private jsonAnswers = new Map<string, string>(); // stateId → selected option label
  private lastStepFiredAt = 0;
  private autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;

  loadScenario(scenario: InteractiveScenario) {
    this.jsonScenario = scenario.jsonSource ?? null;
    this.jsonAnswers.clear();
    this.scenario = scenario;
    this.scenarioTimeSeconds = 0;
    this.firedStepIds.clear();
    this.physiologyDurationCounters = {};
        this.physioStepEligibleSince = {};
    this.awaitingAnswer = null;
    this.awaitingContinue = null;
    this.lastStepFiredAt = -10;
    this.started = false;
    if (this.autoAdvanceTimer) { clearTimeout(this.autoAdvanceTimer); this.autoAdvanceTimer = null; }
    // Reset sim and select patient archetype
    const sim = useSimStore.getState();
    sim.reset();
    sim.selectPatient(scenario.patientArchetype);
    // Lock patient via trueNorth and set scenario state
    sim.setTrueNorthLocked(true);
    sim.setScenarioDrugProtocols(scenario.drugProtocols);
    // Set active scenario in AI store (cast to satisfy Scenario interface)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAIStore.getState().setActiveScenario(scenario as any);
    // Clear mentor messages
    useAIStore.getState().addMentorMessage('mentor',
      `🎓 Scenario loaded: **${scenario.title}** (${scenario.difficulty.toUpperCase()})\n\n${scenario.description}`
    );
    useAIStore.getState().setScenarioRunning(false);
    useAIStore.getState().setCurrentQuestion(null);
  }

  /** Load a JSON-driven SedSimScenario (converts to InteractiveScenario internally). */
  loadJsonScenario(json: SedSimScenario) {
    const interactive = jsonScenarioToInteractive(json);
    interactive.jsonSource = json;
    this.loadScenario(interactive);
  }

  start() {
    if (!this.scenario || this.started) return;
    this.started = true;
    useAIStore.getState().setScenarioRunning(true);
    useSimStore.getState().setScenarioActive(true);
    // Show preop vignette via mentor messages
    this.speakAsMillie(this.buildPreopPresentation());
    // Start the sim clock
    const sim = useSimStore.getState();
    if (!sim.isRunning) sim.toggleRunning();
    // Start vital coherence monitor; callback clears awaitingAnswer and awaitingContinue when a critical alert fires
    vitalCoherenceMonitor.start(() => {
      this.awaitingAnswer = null;
      if (this.awaitingContinue) {
                this.firedStepIds.add(this.awaitingContinue.stepId);
        this.awaitingContinue = null;
        useAIStore.getState().setPendingContinue(null);
      }
    });
    // Start internal clock (1 sim-second per real second)
    this.timerId = setInterval(() => {
      this.scenarioTimeSeconds += 1;
      useAIStore.getState().setScenarioElapsedSeconds(this.scenarioTimeSeconds);
      this.evaluateTriggers();
    }, 1000);
  }

  answerQuestion(answer: string | number) {
    if (!this.awaitingAnswer) return;
    const { stepId, question } = this.awaitingAnswer;
    // Record answer for JSON scoring
    if (this.jsonScenario) {
      this.jsonAnswers.set(stepId, String(answer));
    }
    const isOptimal = this.isOptimalAnswer(question, answer);
    const feedbackKey = String(answer);
    let feedback: string;
    if (question.type === 'numeric_range' && question.idealRange) {
      const num = Number(answer);
      if (num < question.idealRange[0]) {
        feedback = question.feedback['low'] || 'That dose is below the recommended range.';
      } else if (num > question.idealRange[1]) {
        feedback = question.feedback['high'] || 'That dose is above the recommended range.';
      } else {
        feedback = question.feedback['ideal'] || 'Good choice — within the ideal range!';
      }
    } else {
      feedback = question.feedback[feedbackKey] || (isOptimal ? 'Correct!' : 'Not quite. Review the teaching points.');
    }
    this.speakAsMillie([feedback]);
    // Find the step
    const step = this.scenario?.steps.find(s => s.id === stepId);
    // Part 4: Auto-administer bolus for numeric_range dosing questions
    if (question.type === 'numeric_range' && step?.simActions) {
      const drugAction = step.simActions.find(a => a.type === 'administer_drug');
      if (drugAction && drugAction.type === 'administer_drug') {
        const dose = Number(answer);
        if (dose > 0) {
          useSimStore.getState().administerBolus(drugAction.drug, dose);
          // Skip re-applying the administer_drug action below to avoid double-dosing
          const remainingActions = step.simActions.filter(a => a.type !== 'administer_drug');
          remainingActions.forEach(a => this.applySimAction(a));
        } else {
          step.simActions.forEach(a => this.applySimAction(a));
        }
      } else {
        step.simActions.forEach(a => this.applySimAction(a));
      }
    } else if (step?.simActions) {
      step.simActions.forEach(a => this.applySimAction(a));
    }
    if (step?.teachingPoints?.length) {
      this.speakAsMillie(['📚 **Teaching Points:**\n' + step.teachingPoints.map(tp => `• ${tp}`).join('\n')]);
    }
    this.awaitingAnswer = null;
    useAIStore.getState().setCurrentQuestion(null);
    useAIStore.getState().setActiveHighlights(null);
    useAIStore.getState().setUnlockedDrug(null);
    // Gate next step behind the Continue / Next Step button
    this.awaitingContinue = { stepId };
    useAIStore.getState().setPendingContinue({ stepId, stepLabel: stepId });
  }

  jumpToPhase(phase: InteractiveScenarioStep['phase']) {
    if (!this.scenario) return;
    const PHASE_ORDER: InteractiveScenarioStep['phase'][] = [
      'pre_induction', 'induction', 'maintenance', 'complication', 'recovery', 'debrief',
    ];
    const targetIdx = PHASE_ORDER.indexOf(phase);
    // Clear firedStepIds for target phase and all later phases
    for (const step of this.scenario.steps) {
      const stepPhaseIdx = PHASE_ORDER.indexOf(step.phase);
      if (stepPhaseIdx >= targetIdx) {
        this.firedStepIds.delete(step.id);
        // Clear physiology duration counters so stale counters don't cause immediate re-fires
        delete this.physiologyDurationCounters[step.id];
      }
    }
    // Reset scenarioTimeSeconds so on_time triggers don't immediately re-fire on next tick
    const targetSteps = this.scenario.steps.filter(s => s.phase === phase);
    const targetTimes = targetSteps
      .filter(s => s.triggerTimeSeconds !== undefined)
      .map(s => s.triggerTimeSeconds!);
    const earliestTime = targetTimes.length > 0 ? Math.min(...targetTimes) : undefined;
    let newTime: number;
    if (phase === 'pre_induction') {
      newTime = 0;
    } else if (earliestTime !== undefined) {
      newTime = Math.max(0, earliestTime - 1);
    } else {
      // Fallback: use the latest triggerTimeSeconds from phases before the target
      const priorSteps = this.scenario.steps.filter(s => {
        const idx = PHASE_ORDER.indexOf(s.phase);
        return idx < targetIdx;
      });
      const priorTimes = priorSteps
        .filter(s => s.triggerTimeSeconds !== undefined)
        .map(s => s.triggerTimeSeconds!);
      const latestPriorTime = priorTimes.length > 0 ? Math.max(...priorTimes) : undefined;
      newTime = latestPriorTime !== undefined ? latestPriorTime : 0;
    }
    this.scenarioTimeSeconds = newTime;
    useAIStore.getState().setScenarioElapsedSeconds(newTime);
    // Reset awaiting state
    this.awaitingAnswer = null;
    this.awaitingContinue = null;
    useAIStore.getState().setPendingContinue(null);
    useAIStore.getState().setCurrentQuestion(null);
    useAIStore.getState().setCurrentScenarioPhase(phase);
    // Announce the jump
    const phaseLabels: Record<InteractiveScenarioStep['phase'], string> = {
      pre_induction: 'Pre-Induction',
      induction: 'Induction',
      maintenance: 'Maintenance',
      complication: 'Complication',
      recovery: 'Recovery',
      debrief: 'Debrief',
    };
    this.speakAsMillie([`↩️ Returning to **${phaseLabels[phase]}**...`]);
    // Fire the first step of the target phase
    const firstStep = this.scenario.steps.find(s => s.phase === phase);
    if (firstStep) {
      this.fireStep(firstStep);
    }
  }

  continuePendingStep() {
    if (this.autoAdvanceTimer) { clearTimeout(this.autoAdvanceTimer); this.autoAdvanceTimer = null; }
    if (!this.awaitingContinue) return;
    const stepId = this.awaitingContinue.stepId;
    this.firedStepIds.add(stepId);
    this.awaitingContinue = null;
    useAIStore.getState().setPendingContinue(null);
  }

  stop() {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = null;
    if (this.autoAdvanceTimer) { clearTimeout(this.autoAdvanceTimer); this.autoAdvanceTimer = null; }
    if (this.desaturationTimer) {
      clearInterval(this.desaturationTimer);
      this.desaturationTimer = null;
    }
    this.started = false;
    useAIStore.getState().setScenarioRunning(false);
    useAIStore.getState().setCurrentQuestion(null);
    useAIStore.getState().setActiveHighlights(null);
    useAIStore.getState().setCurrentScenarioPhase(null);
    useAIStore.getState().setScenarioElapsedSeconds(0);
    useAIStore.getState().setUnlockedDrug(null);
    this.awaitingAnswer = null;
    this.awaitingContinue = null;
    useAIStore.getState().setPendingContinue(null);
    // Unlock patient and clear scenario state
    useSimStore.getState().setTrueNorthLocked(false);
    useSimStore.getState().setScenarioActive(false);
    useSimStore.getState().setScenarioDrugProtocols(null);
    // Stop vital coherence monitor
    vitalCoherenceMonitor.stop();
    // Stop the sim
    const sim = useSimStore.getState();
    if (sim.isRunning) sim.toggleRunning();
    // Run debrief
    if (this.scenario) this.runDebrief();
    // Clear JSON state after debrief (debrief reads it)
    this.jsonScenario = null;
    this.jsonAnswers.clear();
  }

  private evaluateTriggers() {
    if (!this.scenario) return;

    // Cooldown: skip non-physiology triggers within a scenario-second window of the last
    // fired step to prevent rapid progression. on_physiology safety triggers are exempt.
    // on_step_complete uses a shorter 2s cooldown for natural sequential flow.
    const cooldownSeconds = 5;
    void (this.scenarioTimeSeconds - this.lastStepFiredAt < cooldownSeconds); // cooldown reserved for future use

    const sim = useSimStore.getState();
    const vitals = sim.vitals;
    const moass = sim.moass;

    for (const step of this.scenario.steps) {
      if (this.firedStepIds.has(step.id)) continue;

      // When awaiting an answer, skip on_step_complete steps (sequential flow) but still
      // evaluate on_physiology and on_time triggers so patient deterioration is not ignored
      if (this.awaitingAnswer && step.triggerType === 'on_step_complete') continue;
      // Also skip the specific step currently being answered (prevents re-fire for non-sequential triggers)
      if (this.awaitingAnswer?.stepId === step.id) continue;

      // When awaiting continue, block all trigger types except on_physiology
      // (patient safety events must still fire immediately)
      if (this.awaitingContinue && step.triggerType !== 'on_physiology') continue;
      // Also skip the specific step awaiting continue so it cannot re-fire
      if (this.awaitingContinue?.stepId === step.id) continue;

      let shouldFire = false;

      switch (step.triggerType) {
        case 'on_start':
          // Fire exactly once when scenario just started (scenarioTimeSeconds <= 2)
          if (this.scenarioTimeSeconds <= 2 && !this.firedStepIds.has(step.id)) {
            shouldFire = true;
          }
          break;

        case 'on_time':
          if (
            step.triggerTimeSeconds !== undefined &&
            this.scenarioTimeSeconds >= step.triggerTimeSeconds
          ) {
            shouldFire = true;
          }
          break;

        case 'on_physiology':
          if (step.triggerCondition) {
            const tc = step.triggerCondition;
            const paramValue = this.getPhysioParam(tc.parameter, vitals, moass);
            const met = this.evaluateCondition(paramValue, tc.operator, tc.threshold);
            if (met) {
              const key = step.id;
              this.physiologyDurationCounters[key] = (this.physiologyDurationCounters[key] || 0) + 1;
              const required = tc.durationSeconds ?? 1;
              if (this.physiologyDurationCounters[key] >= required) {
                shouldFire = true;
              }
            } else {
              this.physiologyDurationCounters[step.id] = 0;
            }
          }
          break;

        case 'on_step_complete':
          if (step.afterStepId && this.firedStepIds.has(step.afterStepId)) {
            shouldFire = true;
          }
          break;
      }

      if (shouldFire) {
        // Enforce cooldown for non-physiology triggers; on_step_complete uses 2s cooldown
        const stepCooldown = step.triggerType === 'on_step_complete' ? 2 : cooldownSeconds;
        if (this.scenarioTimeSeconds - this.lastStepFiredAt < stepCooldown && step.triggerType !== 'on_physiology' && step.triggerType !== 'on_start') continue;
        // If a physiology trigger fires while awaiting continue, auto-clear the pending continue
        if (this.awaitingContinue && step.triggerType === 'on_physiology') {
          this.awaitingContinue = null;
          useAIStore.getState().setPendingContinue(null);
        }
        // If a physiology or time trigger fires while awaiting an answer, auto-clear the stale question
        if (this.awaitingAnswer && (step.triggerType === 'on_physiology' || step.triggerType === 'on_time')) {
          this.awaitingAnswer = null;
          useAIStore.getState().setCurrentQuestion(null);
        }
        this.fireStep(step);
        // Only fire one step per tick to avoid flooding
        return;
      }
    }

    // After the for-loop: detect stall and auto-advance to next timed step.
    // Only act when the engine is not waiting on the student and is not already
    // paused for a vital-coherence alert.
    if (!this.awaitingAnswer && !this.awaitingContinue) {
      const unfiredSteps = this.scenario.steps.filter(s => !this.firedStepIds.has(s.id));
      const hasActionableStep = unfiredSteps.some(s => {
        if (s.triggerType === 'on_step_complete' && s.afterStepId && this.firedStepIds.has(s.afterStepId)) return true;
        if (s.triggerType === 'on_start' && this.scenarioTimeSeconds <= 2) return true;
        return false;
      });

      if (!hasActionableStep) {
        // Find the nearest on_time step that has not yet fired
        const nextTimedStep = unfiredSteps
          .filter(s => s.triggerType === 'on_time' && s.triggerTimeSeconds !== undefined)
          .sort((a, b) => (a.triggerTimeSeconds ?? 0) - (b.triggerTimeSeconds ?? 0))[0];

        if (
          nextTimedStep &&
          nextTimedStep.triggerTimeSeconds !== undefined &&
          this.scenarioTimeSeconds < nextTimedStep.triggerTimeSeconds &&
          this.scenarioTimeSeconds - this.lastStepFiredAt >= 10
        ) {
          // Fast-forward to just before the trigger so it fires on the very next tick
          this.scenarioTimeSeconds = nextTimedStep.triggerTimeSeconds - TRIGGER_PRE_FIRE_BUFFER_SECONDS;
          useAIStore.getState().setScenarioElapsedSeconds(this.scenarioTimeSeconds);
        }
      }

              // Physiology timeout: auto-fire on_physiology steps that have been
        // eligible (all prior steps fired) for over 60 scenario-seconds.
        // This prevents stalls when sim vitals never reach the trigger threshold.
        const PHYSIO_TIMEOUT_SECONDS = 60;
        const physioSteps = unfiredSteps.filter(s => s.triggerType === 'on_physiology');
        for (const ps of physioSteps) {
          // Track when this step first became eligible
          if (!(ps.id in this.physioStepEligibleSince)) {
            this.physioStepEligibleSince[ps.id] = this.scenarioTimeSeconds;
          }
          const elapsed = this.scenarioTimeSeconds - this.physioStepEligibleSince[ps.id];
          if (elapsed >= PHYSIO_TIMEOUT_SECONDS) {
            // Auto-fire with a note that the condition was simulated
            this.speakAsMillie([
              '\u26A0\uFE0F The expected physiological change has been simulated to advance the scenario.'
            ]);
            this.fireStep(ps);
            return;
          }
        }

            // Auto-debrief: when every scenario step has been completed,
      // automatically stop the engine and display the debrief summary.
      if (unfiredSteps.length === 0) {
        this.stop();
        return;
      }
    }
  }

  private fireStep(step: InteractiveScenarioStep) {
    this.lastStepFiredAt = this.scenarioTimeSeconds;
    // Clear previous highlights and set new ones if this step has highlights
    const text = step.millieDialogue.join(' ');

    // When triggered by physiology, read the current vital value for the highlight
    let vitalLabel: string | undefined;
    let vitalValue: number | undefined;
    let severity: 'normal' | 'warning' | 'danger' | undefined;
    if (step.triggerType === 'on_physiology' && step.triggerCondition) {
      const sim = useSimStore.getState();
      const tc = step.triggerCondition;
      vitalValue = this.getPhysioParam(tc.parameter, sim.vitals, sim.moass);
      const labelMap: Record<string, string> = {
        spo2: 'SpO2', hr: 'HR', rr: 'RR', sbp: 'SBP', moass: 'MOASS', etco2: 'EtCO₂',
      };
      vitalLabel = labelMap[tc.parameter] ?? tc.parameter.toUpperCase();
      // Determine severity relative to threshold
      const metByHowMuch = tc.operator === '<' || tc.operator === '<='
        ? tc.threshold - vitalValue
        : vitalValue - tc.threshold;
      // Severity thresholds are approximate and parameter-agnostic for simplicity;
      // e.g., SpO2 5 points below threshold is already clinically dangerous.
      severity = metByHowMuch > 10 ? 'danger' : metByHowMuch > 3 ? 'warning' : 'normal';
    }

    useAIStore.getState().setActiveHighlights(
      step.highlight && step.highlight.length > 0
        ? step.highlight.map(h => ({ targetId: h, text, vitalLabel, vitalValue, severity }))
        : null
    );

    // Update current phase
    useAIStore.getState().setCurrentScenarioPhase(step.phase);

    // If no question, fire immediately (including sim actions + teaching points)
    if (!step.question) {
      this.speakAsMillie(step.millieDialogue);
      if (step.simActions) step.simActions.forEach(a => this.applySimAction(a));
      if (step.teachingPoints?.length) {
        this.speakAsMillie(['📚 **Teaching Points:**\n' + step.teachingPoints.map(tp => `• ${tp}`).join('\n')]);
      }
      // Gate next step behind Continue / Next Step button, but also auto-advance after a delay.
      // User can click "Next Step" early to skip the wait.
      this.awaitingContinue = { stepId: step.id };
      useAIStore.getState().setPendingContinue({ stepId: step.id, stepLabel: step.id });
      const AUTO_ADVANCE_MS = step.millieDialogue.length > 0 ? 8000 : 3000;
      if (this.autoAdvanceTimer) clearTimeout(this.autoAdvanceTimer);
      this.autoAdvanceTimer = setTimeout(() => {
        this.autoAdvanceTimer = null;
        this.continuePendingStep();
        this.evaluateTriggers();
      }, AUTO_ADVANCE_MS);
    } else {
      // Present question — pause until answered
      this.speakAsMillie(step.millieDialogue);
      this.awaitingAnswer = { stepId: step.id, question: step.question };
      this.firedStepIds.add(step.id);
      useAIStore.getState().setCurrentQuestion({ stepId: step.id, question: step.question });
      // Part 3: If this is a numeric_range dosing question, unlock the relevant drug
      if (step.question.type === 'numeric_range' && step.simActions) {
        const drugAction = step.simActions.find(a => a.type === 'administer_drug');
        if (drugAction && drugAction.type === 'administer_drug') {
          useAIStore.getState().setUnlockedDrug(drugAction.drug);
        }
      }
      // Note: firedStepIds gets the id added in continuePendingStep() after the student
      // clicks the Continue / Next Step button. awaitingAnswer + evaluateTriggers guards
      // prevent this step from re-firing while the answer is pending.
    }
  }

  private desaturationTimer: ReturnType<typeof setInterval> | null = null;

  private applySimAction(action: SimAction) {
    const sim = useSimStore.getState();
    switch (action.type) {
      case 'administer_drug':
        sim.administerBolus(action.drug, action.dose);
        break;
      case 'set_fio2':
        sim.setFiO2(action.fio2);
        break;
      case 'set_airway_device':
        sim.setAirwayDevice(action.device as AirwayDevice);
        break;
      case 'apply_intervention':
        sim.applyIntervention(action.intervention as InterventionType);
        break;
      case 'select_patient':
        sim.selectPatient(action.archetypeKey);
        break;
      case 'advance_time':
        // Advance scenario time without advancing real time
        this.scenarioTimeSeconds += action.seconds;
        break;
      case 'set_speed':
        sim.setSpeed(action.speed);
        break;
      case 'set_vital':
        // Override a vital sign directly in the store
        sim.overrideVital(action.parameter, action.value);
        break;
      case 'start_desaturation': {
        // Gradually decrease SpO2 at the specified rate (% per minute) using elapsed time
        if (this.desaturationTimer) clearInterval(this.desaturationTimer);
        const startSpo2 = useSimStore.getState().vitals.spo2;
        const startMs = Date.now();
        this.desaturationTimer = setInterval(() => {
          const elapsedMin = (Date.now() - startMs) / 60000;
          const targetSpo2 = Math.max(60, startSpo2 - action.rate * elapsedMin);
          const current = useSimStore.getState().vitals.spo2;
          if (current > 60) {
            useSimStore.getState().overrideVital('spo2', Math.min(current, targetSpo2));
          } else {
            if (this.desaturationTimer) clearInterval(this.desaturationTimer);
            this.desaturationTimer = null;
          }
        }, 1000);
        break;
      }
    }
  }

  private speakAsMillie(lines: string[]) {
    if (!lines.length) return;
    useAIStore.getState().addMentorMessage('mentor', lines.join('\n\n'));
  }

  private buildPreopPresentation(): string[] {
    if (!this.scenario) return [];
    const v = this.scenario.preopVignette;
    const lines: string[] = [
      `👩‍⚕️ **Millie the Mentor** — Let's begin your scenario!\n`,
      `**📋 Pre-op Vignette: ${this.scenario.title}**\n`,
      `**Indication:** ${v.indication}\n**Setting:** ${v.setting}`,
      `**History:**\n${v.history.map(h => `• ${h}`).join('\n')}`,
      `**Exam:**\n${v.exam.map(e => `• ${e}`).join('\n')}`,
    ];
    if (v.labs?.length) {
      lines.push(`**Labs:**\n${v.labs.map(l => `• ${l}`).join('\n')}`);
    }
    lines.push(
      `**Baseline Monitors:** ${v.baselineMonitors.join(', ')}`,
      `**Target Sedation Goal:** ${v.targetSedationGoal}`,
      `\n**Learning Objectives:**\n${this.scenario.learningObjectives.map(o => `• ${o}`).join('\n')}`,
    );
    return lines;
  }

  private runDebrief() {
    if (!this.scenario) return;
    const sim = useSimStore.getState();
    const score = generateDebrief(sim.eventLog, sim.trendData);
    const { discussionQuestions, keyTakeaways } = this.scenario.debrief;
    const enhanced = this.scenario.debriefEnhanced;

    // ── Four-dimension scoring engine ───────────────────────────────────────
    const rubric =
      this.scenario.scoringRubric ??
      (this.jsonScenario?.rubric) ??
      defaultRubric(this.scenario.difficulty);

    const summary: ScoringSummary = scoreScenario(rubric, {
      elapsedSeconds: this.scenarioTimeSeconds,
      eventLog: sim.eventLog,
      trendData: sim.trendData,
      completedStepIds: Array.from(this.firedStepIds),
      totalStepCount: this.scenario.steps.length,
    });

    // Store for UI review
    useAIStore.getState().setLastScenarioScore(summary);
    // Persist to localStorage for cross-session review
    try {
      const key = `sedsim_score_${this.scenario.id}`;
      localStorage.setItem(key, JSON.stringify({ ...summary, scenarioId: this.scenario.id, scenarioTitle: this.scenario.title, completedAt: Date.now() }));
    } catch { /* ignore storage errors */ }

    const passBadge = summary.passed ? '✅ PASS' : '❌ FAIL';
    const debriefLines = [
      `🎓 **Scenario Debrief — ${this.scenario.title}**\n`,
      `**Overall Grade: ${score.overallGrade}**\n` +
        `• Titration Accuracy: ${score.titrationAccuracy}%\n` +
        `• EEG Interpretation: ${score.eegInterpretation}%\n` +
        `• Complication Response: ${score.complicationResponse}%`,
      `📊 **${passBadge} — Score: ${summary.percentScore}% (${summary.grade}) — Pass ≥ ${summary.passThreshold}%**\n` +
        `• ⏱ Timing:           ${summary.dimensions.timing.score}/${summary.dimensions.timing.maxScore} pts (${summary.dimensions.timing.percent}%)\n` +
        `• 💊 Appropriateness:  ${summary.dimensions.appropriateness.score}/${summary.dimensions.appropriateness.maxScore} pts (${summary.dimensions.appropriateness.percent}%)\n` +
        `• 🛡 Safety:           ${summary.dimensions.safety.score}/${summary.dimensions.safety.maxScore} pts (${summary.dimensions.safety.percent}%)\n` +
        `• ✔ Completeness:     ${summary.dimensions.completeness.score}/${summary.dimensions.completeness.maxScore} pts (${summary.dimensions.completeness.percent}%)`,
    ];

    if (enhanced?.scoringWeights) {
      const w = enhanced.scoringWeights;
      debriefLines.push(
        `📊 **Scoring Breakdown:**\n` +
          `• Titration (${Math.round(w.titration * 100)}%)\n` +
          `• Airway Management (${Math.round(w.airwayManagement * 100)}%)\n` +
          `• Hemodynamic Control (${Math.round(w.hemodynamicControl * 100)}%)\n` +
          `• Complication Response (${Math.round(w.complicationResponse * 100)}%)`
      );
    }

    if (score.strengths.length) {
      debriefLines.push(`✅ **Strengths:**\n${score.strengths.map(s => `• ${s}`).join('\n')}`);
    }
    if (score.improvements.length) {
      debriefLines.push(`🔧 **Areas for Improvement:**\n${score.improvements.map(i => `• ${i}`).join('\n')}`);
    }
    if (discussionQuestions.length) {
      debriefLines.push(
        `💬 **Discussion Questions:**\n${discussionQuestions.map(q => `• ${q}`).join('\n')}`
      );
    }
    if (keyTakeaways.length) {
      debriefLines.push(
        `🔑 **Key Takeaways:**\n${keyTakeaways.map(t => `• ${t}`).join('\n')}`
      );
    }

    // JSON scenario checklist scoring summary
    let percentScore = 0;
    let rawScore = 0;
    let maxScore = 100;
    if (this.jsonScenario) {
      const jsonScore = evaluateJsonScore(this.jsonScenario, this.jsonAnswers);
      percentScore = jsonScore.percentScore;
      rawScore = jsonScore.totalScore;
      maxScore = jsonScore.maxScore > 0 ? jsonScore.maxScore : 100;
      debriefLines.push(
        `\n📋 **Checklist Score — ${this.jsonScenario.title}**\n` +
          `**Total: ${jsonScore.totalScore} / ${jsonScore.maxScore} (${jsonScore.percentScore}%)**`
      );
      const itemLines = jsonScore.items.map(item =>
        `${item.passed ? '✅' : '❌'} ${item.description} — ${item.earned}/${item.weight} pts`
      );
      if (itemLines.length > 0) {
        debriefLines.push(`**Checklist:**\n${itemLines.join('\n')}`);
      }
    } else {
      // Derive a composite score from the debrief grades
      const avg = Math.round(
        (score.titrationAccuracy + score.eegInterpretation + score.complicationResponse) / 3
      );
      percentScore = avg;
      rawScore = avg;
      maxScore = 100;
    }

    if (enhanced?.keyQuestions?.length) {
      debriefLines.push(`💬 **Key Questions:**\n${enhanced.keyQuestions.map(q => `• ${q}`).join('\n')}`);
    } else {
      debriefLines.push(`💬 **Discussion Questions:**\n${discussionQuestions.map(q => `• ${q}`).join('\n')}`);
    }

    if (enhanced?.graphsToHighlight?.length) {
      debriefLines.push(`📈 **Review These Graphs:** ${enhanced.graphsToHighlight.join(', ')}`);
    }

    debriefLines.push(
      `🔑 **Key Takeaways:**\n${keyTakeaways.map(t => `• ${t}`).join('\n')}`,
    );

    this.speakAsMillie(debriefLines);

    // ── Report to LMS (xAPI + SCORM) ─────────────────────────────────────────
    const scenarioId = this.scenario.id;
    const elapsed = this.scenarioTimeSeconds;
    const passed = percentScore >= 70;
    import('../store/useLMSStore').then(m => {
      const lms = m.default.getState();
      lms.emitCompleted(scenarioId, elapsed, passed);
      lms.emitScored(scenarioId, rawScore, maxScore, elapsed);
      lms.reportScormScore(rawScore, 0, maxScore);
      lms.reportScormComplete(passed, elapsed);
    });
  }

  private isOptimalAnswer(q: ScenarioQuestion, a: string | number): boolean {
    if (q.type === 'numeric_range' && q.idealRange) {
      const num = Number(a);
      return num >= q.idealRange[0] && num <= q.idealRange[1];
    }
    return String(a) === String(q.correctAnswer);
  }

  private getPhysioParam(
    param: 'spo2' | 'hr' | 'rr' | 'sbp' | 'moass' | 'etco2',
    vitals: { spo2: number; hr: number; rr: number; sbp: number; etco2: number },
    moass: number
  ): number {
    switch (param) {
      case 'spo2': return vitals.spo2;
      case 'hr': return vitals.hr;
      case 'rr': return vitals.rr;
      case 'sbp': return vitals.sbp;
      case 'etco2': return vitals.etco2;
      case 'moass': return moass;
    }
  }

  private evaluateCondition(
    value: number,
    operator: '<' | '>' | '<=' | '>=' | '==',
    threshold: number
  ): boolean {
    switch (operator) {
      case '<': return value < threshold;
      case '>': return value > threshold;
      case '<=': return value <= threshold;
      case '>=': return value >= threshold;
      case '==': return value === threshold;
    }
  }
}

// Singleton export
export const scenarioEngine = new ScenarioEngine();
