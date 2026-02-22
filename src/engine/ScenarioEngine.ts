// src/engine/ScenarioEngine.ts
// Millie the Mentor — Interactive ScenarioEngine
// Bridges useSimStore (physiology) and useAIStore (mentor chat)

import useSimStore from '../store/useSimStore';
import useAIStore from '../store/useAIStore';
import { generateDebrief } from '../ai/mentor';
import { AirwayDevice, InterventionType } from '../types';
import { vitalCoherenceMonitor } from './VitalCoherenceMonitor';

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
  | { type: 'set_speed'; speed: number };

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
}

// ─── ScenarioEngine ─────────────────────────────────────────────────────────

export class ScenarioEngine {
  private scenario: InteractiveScenario | null = null;
  private scenarioTimeSeconds = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private firedStepIds = new Set<string>();
  private physiologyDurationCounters: Record<string, number> = {};
  awaitingAnswer: { stepId: string; question: ScenarioQuestion } | null = null;
  awaitingContinue: { stepId: string } | null = null;
  private started = false;

  loadScenario(scenario: InteractiveScenario) {
    this.scenario = scenario;
    this.scenarioTimeSeconds = 0;
    this.firedStepIds.clear();
    this.physiologyDurationCounters = {};
    this.awaitingAnswer = null;
    this.awaitingContinue = null;
    this.started = false;
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

  continuePendingStep() {
    if (!this.awaitingContinue) return;
    const stepId = this.awaitingContinue.stepId;
    this.firedStepIds.add(stepId);
    this.awaitingContinue = null;
    useAIStore.getState().setPendingContinue(null);
  }

  stop() {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = null;
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
  }

  private evaluateTriggers() {
    if (!this.scenario) return;
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

      // When awaiting continue, block on_time and on_step_complete steps;
      // on_physiology steps still fire (patient safety takes priority)
      if (this.awaitingContinue && (step.triggerType === 'on_time' || step.triggerType === 'on_step_complete')) continue;
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
        break;
      }
    }
  }

  private fireStep(step: InteractiveScenarioStep) {
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
      // on_time and on_step_complete steps require the student to click Continue before advancing.
      // on_start (preop vignette) and on_physiology (urgent clinical events) auto-complete.
      if (step.triggerType === 'on_time' || step.triggerType === 'on_step_complete') {
        this.awaitingContinue = { stepId: step.id };
        useAIStore.getState().setPendingContinue({ stepId: step.id, stepLabel: step.id });
      } else {
        this.firedStepIds.add(step.id);
      }
    } else {
      // Present question — pause until answered
      this.speakAsMillie(step.millieDialogue);
      this.awaitingAnswer = { stepId: step.id, question: step.question };
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

    const debriefLines = [
      `🎓 **Scenario Debrief — ${this.scenario.title}**\n`,
      `**Overall Grade: ${score.overallGrade}**\n` +
        `• Titration Accuracy: ${score.titrationAccuracy}%\n` +
        `• EEG Interpretation: ${score.eegInterpretation}%\n` +
        `• Complication Response: ${score.complicationResponse}%`,
    ];

    if (score.strengths.length) {
      debriefLines.push(`✅ **Strengths:**\n${score.strengths.map(s => `• ${s}`).join('\n')}`);
    }
    if (score.improvements.length) {
      debriefLines.push(`🔧 **Areas for Improvement:**\n${score.improvements.map(i => `• ${i}`).join('\n')}`);
    }
    debriefLines.push(
      `💬 **Discussion Questions:**\n${discussionQuestions.map(q => `• ${q}`).join('\n')}`,
      `🔑 **Key Takeaways:**\n${keyTakeaways.map(t => `• ${t}`).join('\n')}`,
    );

    this.speakAsMillie(debriefLines);
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
