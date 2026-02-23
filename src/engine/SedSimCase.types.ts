// src/engine/SedSimCase.types.ts
// SedSim-Case: Scenario/Assessment Engine interface definitions

export interface SedSimScenario {
  id: string;
  title: string;
  description: string;
  tags: string[];
  patient: { archetypeId: string };
  learningObjectives: string[];
  estimatedDurationSec: number;
  phases: ScenarioPhase[];
  states: ScenarioState[];
}

export type PhaseId = "pre" | "induction" | "maintenance" | "complication" | "recovery" | "debrief";

export interface ScenarioPhase {
  id: PhaseId;
  label: string;
  order: number;
}

export type ScenarioStateType = "info" | "question" | "event" | "checkpoint" | "terminal";

export interface ScenarioState {
  id: string;
  phaseId: PhaseId;
  type: ScenarioStateType;
  prompt?: string;
  options?: ScenarioOption[];
  explanations?: string[];
  simActions?: SimAction[];
  exitConditions: ExitCondition[];
  transitions: Transition[];
  scoring?: ScoringHook | null;
}

export interface ScenarioOption {
  id: string;
  label: string;
  isCorrect?: boolean;
}

export type SimActionType = "give_drug" | "change_oxygen" | "change_position" | "apply_stimulus";

export interface SimAction {
  type: SimActionType;
  atOffsetSec?: number;
  payload: Record<string, unknown>;
}

export type ExitConditionType = "on_continue" | "on_time" | "on_physiology";

export interface ExitCondition {
  id: string;
  type: ExitConditionType;
  minTimeSec?: number;
  physiologyPredicate?: {
    spo2LessThan?: number;
    spo2DurationSec?: number;
    mapLessThan?: number;
    bisRange?: [number, number];
    moassAtMost?: number;
  };
}

export interface Transition {
  fromStateId: string;
  toStateId: string;
  viaConditions: string[];
}

export interface ScoringHook {
  checklistItems: ChecklistItem[];
  maxScore: number;
}

export interface ChecklistItem {
  id: string;
  description: string;
  weight: number;
  evaluationHint?: string;
}

// ─── Scoring result ──────────────────────────────────────────────────────────

export interface ChecklistItemResult {
  id: string;
  description: string;
  weight: number;
  earned: number;
  passed: boolean;
}

export interface ScenarioScore {
  totalScore: number;
  maxScore: number;
  percentScore: number;
  items: ChecklistItemResult[];
}
