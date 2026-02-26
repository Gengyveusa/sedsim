/**
 * src/engine/conductor/types.ts
 * Conductor Core — shared type definitions
 *
 * Defines the Beat system that replaces flat dialogue dumps with timed
 * micro-events, plus the ConductorStep / ConductorScenario wrappers that
 * sit on top of the existing InteractiveScenarioStep format.
 */

import type { SimAction } from '../ScenarioEngine';
import type { ScenarioQuestion } from '../ScenarioEngine';

// ─── Beat System ─────────────────────────────────────────────────────────────

/** All the ways a single Beat can manifest on screen / in the simulation. */
export type BeatType =
  | 'millie'        // Millie says something in chat
  | 'callout'       // Contextual callout overlay on a UI element
  | 'vitalBadge'    // Annotate a vital sign display
  | 'simAction'     // Drive a simulation action (administer_drug, set_fio2, …)
  | 'question'      // Present an interactive question to the learner
  | 'phase'         // Announce a scenario phase transition
  | 'pause';        // Insert a deliberate timing gap (no visible output)

/** A single timed event within a scenario step. */
export interface Beat {
  /** Unique identifier within the parent ConductorStep. */
  id: string;
  /** Type of output this beat produces. */
  type: BeatType;
  /** Delay in milliseconds from the start of the parent ConductorStep. */
  delayMs: number;

  // ── Type-specific payloads (only the relevant field is set) ──────────────

  /** Text shown in the Millie chat bubble (type: 'millie'). */
  millieText?: string;
  /** Callout shown as an overlay on a highlighted UI region (type: 'callout'). */
  callout?: {
    targetId: string;
    text: string;
    vitalLabel?: string;
    vitalValue?: number;
    severity?: 'normal' | 'warning' | 'danger';
  };
  /** Vital badge annotation (type: 'vitalBadge'). */
  vitalBadge?: VitalAnnotation;
  /** Simulation action to dispatch to useSimStore (type: 'simAction'). */
  simAction?: SimAction;
  /** Question to present to the learner (type: 'question'). */
  question?: ScenarioQuestion;
  /** Step id associated with the question (used by useAIStore). */
  questionStepId?: string;
  /** Phase label text (type: 'phase'). */
  phaseLabel?: string;
}

// ─── Vital Annotation ────────────────────────────────────────────────────────

export interface VitalAnnotation {
  /** Which vital parameter this annotates (e.g. 'spo2', 'hr'). */
  parameter: string;
  label: string;
  value: number;
  severity: 'normal' | 'warning' | 'danger' | 'critical';
  /** ISO timestamp when the annotation was generated. */
  timestamp: number;
}

// ─── Step Vital Targets ──────────────────────────────────────────────────────

/**
 * Scenario-defined target ranges for vitals during a step.
 * Used by vitalTargets.ts to nudge the physiology model toward clinical goals.
 */
export interface StepVitalTargets {
  spo2?: number;
  hr?: number;
  sbp?: number;
  rr?: number;
  etco2?: number;
  moass?: number;
  /** Sensitivity multiplier applied to PK/PD model (0.5 = less sensitive, 2.0 = more sensitive). */
  pkPdSensitivity?: number;
}

// ─── Conductor Step ──────────────────────────────────────────────────────────

/** A scenario step expressed in Beat format, understood by the Conductor. */
export interface ConductorStep {
  /** Matches the id in the originating InteractiveScenarioStep. */
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

  /** Ordered list of timed micro-events for this step. */
  beats: Beat[];
  /** Optional vital targets to interpolate toward during this step. */
  vitalTargets?: StepVitalTargets;
  /** Teaching points surfaced at debrief. */
  teachingPoints?: string[];
}

// ─── Conductor Scenario ──────────────────────────────────────────────────────

/** A fully expanded scenario in Conductor-native format. */
export interface ConductorScenario {
  id: string;
  title: string;
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert';
  patientArchetype: string;
  steps: ConductorStep[];
  debrief: {
    discussionQuestions: string[];
    keyTakeaways: string[];
  };
}

// ─── Structured Message (Millie Chat) ────────────────────────────────────────

/** Visual rendering type for a Millie chat message. */
export type MillieMessageType =
  | 'narration'       // Millie avatar + text bubble with emotion indicator
  | 'callout_link'    // Clickable message that highlights a UI element when clicked
  | 'vital_badge'     // Inline vital sign display with value and annotation
  | 'question'        // Embedded Q&A card with input field and submit button
  | 'feedback'        // Green (correct) or red (incorrect) feedback card
  | 'teaching_point'  // Distinct card with book icon and blue-ish accent
  | 'phase_change'    // Horizontal divider with phase name
  | 'debrief';        // Score summary card

/** Emotion state for Millie avatar. */
export type MillieEmotion = 'neutral' | 'concerned' | 'urgent' | 'encouraging' | 'thinking';

/** A single message in the Millie chat feed. */
export interface StructuredMessage {
  id: string;
  role: 'millie' | 'user' | 'system';
  /** Visual rendering type; defaults to 'narration' for millie messages. */
  messageType?: MillieMessageType;
  content: string;
  /** Emotion state for the Millie avatar shown with this message. */
  emotion?: MillieEmotion;
  /** Whether this message is currently being typed (show typing indicator). */
  typing?: boolean;
  /** For 'feedback' messages: whether the answer was correct. */
  isCorrect?: boolean;
  /** For 'phase_change' messages: the phase label. */
  phaseLabel?: string;
  /** For 'debrief' messages: score out of 100. */
  score?: number;
  /** Optional callout data to attach to this message. */
  callout?: {
    targetId: string;
    text: string;
    severity?: 'normal' | 'warning' | 'danger';
  };
  /** Optional vital annotation attached to this message. */
  vitalAnnotation?: VitalAnnotation;
  /** Timestamp (ms since epoch). */
  timestamp: number;
  /** Which beat triggered this message, for debugging. */
  beatId?: string;
}

// ─── Conductor Events ────────────────────────────────────────────────────────

/** Union of all typed events the Conductor can emit via its EventBus. */
export type ConductorEvent =
  | { type: 'beat'; beat: Beat; stepId: string }
  | { type: 'step_started'; stepId: string; phase: ConductorStep['phase'] }
  | { type: 'step_completed'; stepId: string }
  | { type: 'scenario_started'; scenarioId: string }
  | { type: 'scenario_completed'; scenarioId: string }
  | { type: 'physio_event'; eventName: string; data: Record<string, unknown> }
  | { type: 'vital_target_updated'; targets: StepVitalTargets }
  | { type: 'question_ready'; stepId: string; question: ScenarioQuestion }
  | { type: 'phase_changed'; phase: ConductorStep['phase'] };
