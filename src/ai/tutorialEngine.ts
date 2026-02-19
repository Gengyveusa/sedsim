/**
 * src/ai/tutorialEngine.ts
 * Step-by-step tutorial state machine for SedSim.
 * Two tracks: "Quick Start" (5 steps) and "Deep Dive" (12 steps).
 * Tutorial state is persisted to localStorage so users can resume.
 */

import { TutorialState, TutorialStep } from '../types';

// ---------------------------------------------------------------------------
// Tutorial step definitions
// ---------------------------------------------------------------------------

const QUICK_START_STEPS: TutorialStep[] = [
  {
    id: 'qs_welcome',
    title: 'Welcome to SedSim',
    content: 'SedSim is a real-time IV procedural sedation simulator. You will manage drug administration, monitor vital signs, and interpret EEG data for a virtual patient. This Quick Start takes ~5 minutes.',
    action: 'observe',
    completionHint: 'Click "Next" to continue.',
  },
  {
    id: 'qs_patient',
    title: 'Step 1 — Select Your Patient',
    content: 'The Patient panel (top-left) shows your patient\'s demographics. You can change the patient archetype using the selector. Patient characteristics (age, weight, comorbidities) directly affect drug sensitivity and PK parameters.',
    targetElement: '#patient-selector',
    action: 'observe',
    completionHint: 'Review the patient banner at the top of the screen.',
  },
  {
    id: 'qs_drug',
    title: 'Step 2 — Administer a Drug',
    content: 'Use the Drug Panel (left column) to administer a bolus or start an infusion. Try giving Propofol 50mg bolus. The PK engine will compute plasma and effect-site concentrations in real time.',
    targetElement: '#drug-panel',
    action: 'administer',
    completionHint: 'Administer a propofol bolus to proceed.',
  },
  {
    id: 'qs_vitals',
    title: 'Step 3 — Monitor Vital Signs',
    content: 'The Vitals Monitor (centre-top) shows HR, BP, SpO2, RR, and EtCO2. Watch for propofol-induced hypotension (BP drop) and respiratory depression (RR ↓). The Sedation Gauge (large dial) shows MOASS level 0–5.',
    targetElement: '#monitor-panel',
    action: 'observe',
    completionHint: 'Observe how vitals change after drug administration.',
  },
  {
    id: 'qs_eeg',
    title: 'Step 4 — Read the EEG',
    content: 'Open the AI Dashboard (bottom-right) → EEG Monitor tab. BIS 40–60 is the target range for procedural sedation. High-amplitude delta waves with burst suppression (BIS < 20) means the patient is excessively deep.',
    targetElement: '#ai-dashboard',
    action: 'read',
    completionHint: 'Check the BIS value in the AI Dashboard.',
  },
  {
    id: 'qs_mentor',
    title: 'Step 5 — Ask the AI Mentor',
    content: 'Open the AI Mentor tab in the dashboard. You can ask clinical questions like "Why is BP dropping?" or "What does this EEG pattern mean?". The mentor uses the live simulation state to give contextual answers.',
    targetElement: '#ai-dashboard',
    action: 'observe',
    completionHint: 'Ask the mentor a question to complete Quick Start.',
  },
];

const DEEP_DIVE_STEPS: TutorialStep[] = [
  ...QUICK_START_STEPS,
  {
    id: 'dd_pkpd',
    title: 'Step 6 — PK/PD Pharmacology',
    content: 'The Trend Graph (right panel) shows plasma concentration (Cp) and effect-site concentration (Ce) over time. Ce lags behind Cp due to the ke0 equilibration constant. The effect is driven by Ce, not Cp.',
    targetElement: '#trend-panel',
    action: 'observe',
    completionHint: 'Open the Trend Graph and observe Cp vs Ce.',
  },
  {
    id: 'dd_infusion',
    title: 'Step 7 — Run an Infusion',
    content: 'Start a propofol infusion at 50 mcg/kg/min using the Infusion controls in the Drug Panel. Steady-state Ce is reached after ~3–5 half-lives. You can titrate infusion rate in real time.',
    targetElement: '#drug-panel',
    action: 'administer',
    completionHint: 'Start a propofol infusion.',
  },
  {
    id: 'dd_airway',
    title: 'Step 8 — Airway Management',
    content: 'If SpO2 drops below 94%, use the Interventions panel (left column) to apply jaw thrust, chin lift, oral airway, or bag-mask ventilation. FiO2 can be increased to provide supplemental oxygen.',
    targetElement: '#intervention-panel',
    action: 'observe',
    completionHint: 'Review the airway management options.',
  },
  {
    id: 'dd_emergency',
    title: 'Step 9 — Emergency Drugs',
    content: 'The Emergency Drugs panel contains reversal agents (naloxone for opioids, flumazenil for benzodiazepines) and vasopressors. Use naloxone 0.04mg increments to reverse opioid respiratory depression.',
    targetElement: '#emergency-panel',
    action: 'observe',
    completionHint: 'Review the emergency drug options.',
  },
  {
    id: 'dd_ghost',
    title: 'Step 10 — Ghost Dose Preview',
    content: 'The Ghost Dose panel (in the AI Dashboard → Mentor tab) lets you preview a hypothetical drug dose WITHOUT actually giving it. It shows predicted Ce, MOASS, SpO2, and RR at T+1, T+3, and T+5 minutes.',
    targetElement: '#ghost-dose-panel',
    action: 'observe',
    completionHint: 'Try a ghost dose preview in the Mentor tab.',
  },
  {
    id: 'dd_scenario',
    title: 'Step 11 — Load a Clinical Scenario',
    content: 'Open AI Dashboard → Scenarios tab. Scenarios include complications that trigger automatically (laryngospasm, hypotension, paradoxical agitation). Each scenario has learning objectives and teaching points.',
    targetElement: '#ai-dashboard',
    action: 'observe',
    completionHint: 'Browse the Scenarios tab.',
  },
  {
    id: 'dd_debrief',
    title: 'Step 12 — Session Debrief',
    content: 'After completing a scenario, the AI Mentor generates a session debrief with your titration accuracy, complication response score, and personalised improvement tips. Use the Debrief button in the control bar.',
    action: 'observe',
    completionHint: 'You have completed the Deep Dive tutorial!',
  },
];

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'sedsim_tutorial_state';

export function loadTutorialState(): TutorialState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TutorialState) : null;
  } catch {
    return null;
  }
}

export function saveTutorialState(state: TutorialState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, lastSaved: Date.now() }));
  } catch {
    // ignore quota errors
  }
}

export function clearTutorialState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Tutorial engine
// ---------------------------------------------------------------------------

export class TutorialEngine {
  private state: TutorialState;

  constructor(initialState?: Partial<TutorialState>) {
    const persisted = loadTutorialState();
    this.state = {
      isActive: false,
      track: 'quick_start',
      currentStepIndex: 0,
      completedSteps: [],
      learnerLevel: 'novice',
      lastSaved: Date.now(),
      ...persisted,
      ...initialState,
    };
  }

  // --------------------------------------------------------------------------
  // Accessors
  // --------------------------------------------------------------------------

  getState(): TutorialState {
    return { ...this.state };
  }

  getSteps(): TutorialStep[] {
    return this.state.track === 'quick_start' ? QUICK_START_STEPS : DEEP_DIVE_STEPS;
  }

  getCurrentStep(): TutorialStep | null {
    const steps = this.getSteps();
    return steps[this.state.currentStepIndex] ?? null;
  }

  getTotalSteps(): number {
    return this.getSteps().length;
  }

  isComplete(): boolean {
    return this.state.currentStepIndex >= this.getTotalSteps();
  }

  getProgress(): number {
    return Math.round((this.state.currentStepIndex / this.getTotalSteps()) * 100);
  }

  // --------------------------------------------------------------------------
  // Mutators
  // --------------------------------------------------------------------------

  start(track: TutorialState['track'], learnerLevel: TutorialState['learnerLevel']): void {
    this.state = {
      ...this.state,
      isActive: true,
      track,
      learnerLevel,
      currentStepIndex: 0,
      completedSteps: [],
    };
    this.persist();
  }

  nextStep(): TutorialStep | null {
    const current = this.getCurrentStep();
    if (current) {
      this.state.completedSteps = [...this.state.completedSteps, current.id];
    }
    this.state.currentStepIndex = Math.min(
      this.state.currentStepIndex + 1,
      this.getTotalSteps()
    );
    this.persist();
    return this.getCurrentStep();
  }

  prevStep(): TutorialStep | null {
    this.state.currentStepIndex = Math.max(0, this.state.currentStepIndex - 1);
    this.persist();
    return this.getCurrentStep();
  }

  skipToStep(index: number): void {
    this.state.currentStepIndex = Math.max(0, Math.min(index, this.getTotalSteps() - 1));
    this.persist();
  }

  end(): void {
    this.state.isActive = false;
    this.persist();
  }

  resume(): void {
    this.state.isActive = true;
    this.persist();
  }

  setLearnerLevel(level: TutorialState['learnerLevel']): void {
    this.state.learnerLevel = level;
    this.persist();
  }

  // --------------------------------------------------------------------------
  // Contextual hints based on learner level
  // --------------------------------------------------------------------------

  getAdaptedContent(step: TutorialStep): string {
    if (this.state.learnerLevel === 'advanced') {
      // Advanced learners get briefer, more technical content
      return step.content.replace('~5 minutes', '~3 minutes');
    }
    return step.content;
  }

  private persist(): void {
    saveTutorialState(this.state);
  }
}

// Singleton instance
export const tutorialEngine = new TutorialEngine();
