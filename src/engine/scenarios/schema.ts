// src/engine/scenarios/schema.ts
// Zod schemas for runtime validation of SedSimScenario JSON files.
// Mirrors the types defined in src/engine/SedSimCase.types.ts.

import { z } from 'zod';

// ─── Primitive enums ─────────────────────────────────────────────────────────

export const PhaseIdSchema = z.enum([
  'pre',
  'induction',
  'maintenance',
  'complication',
  'recovery',
  'debrief',
]);

export const ScenarioStateTypeSchema = z.enum([
  'info',
  'question',
  'event',
  'checkpoint',
  'terminal',
]);

export const SimActionTypeSchema = z.enum([
  'give_drug',
  'change_oxygen',
  'change_position',
  'apply_stimulus',
]);

export const ExitConditionTypeSchema = z.enum([
  'on_continue',
  'on_time',
  'on_physiology',
]);

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

export const ScenarioPhaseSchema = z.object({
  id: PhaseIdSchema,
  label: z.string().min(1, 'Phase label must be a non-empty string'),
  order: z.number().int('Phase order must be an integer'),
});

export const ScenarioOptionSchema = z.object({
  id: z.string().min(1, 'Option id must be a non-empty string'),
  label: z.string().min(1, 'Option label must be a non-empty string'),
  isCorrect: z.boolean().optional(),
});

export const SimActionSchema = z.object({
  type: SimActionTypeSchema,
  atOffsetSec: z.number().optional(),
  payload: z.record(z.string(), z.unknown()),
});

export const PhysiologyPredicateSchema = z.object({
  spo2LessThan: z.number().optional(),
  spo2DurationSec: z.number().optional(),
  mapLessThan: z.number().optional(),
  bisRange: z.tuple([z.number(), z.number()]).optional(),
  moassAtMost: z.number().optional(),
});

export const ExitConditionSchema = z.object({
  id: z.string().min(1, 'ExitCondition id must be a non-empty string'),
  type: ExitConditionTypeSchema,
  minTimeSec: z.number().optional(),
  physiologyPredicate: PhysiologyPredicateSchema.optional(),
});

export const TransitionSchema = z.object({
  fromStateId: z.string().min(1, 'Transition fromStateId must be a non-empty string'),
  toStateId: z.string().min(1, 'Transition toStateId must be a non-empty string'),
  viaConditions: z.array(z.string()),
});

export const ChecklistItemSchema = z.object({
  id: z.string().min(1, 'ChecklistItem id must be a non-empty string'),
  description: z.string().min(1, 'ChecklistItem description must be a non-empty string'),
  weight: z.number(),
  evaluationHint: z.string().optional(),
});

export const ScoringHookSchema = z.object({
  checklistItems: z.array(ChecklistItemSchema),
  maxScore: z.number(),
});

export const ScenarioStateSchema = z.object({
  id: z.string().min(1, 'State id must be a non-empty string'),
  phaseId: PhaseIdSchema,
  type: ScenarioStateTypeSchema,
  prompt: z.string().optional(),
  options: z.array(ScenarioOptionSchema).optional(),
  explanations: z.array(z.string()).optional(),
  simActions: z.array(SimActionSchema).optional(),
  exitConditions: z.array(ExitConditionSchema),
  transitions: z.array(TransitionSchema),
  scoring: ScoringHookSchema.nullable().optional(),
});

// ─── Top-level scenario schema ────────────────────────────────────────────────

export const SedSimScenarioSchema = z.object({
  id: z.string().min(1, 'Scenario id must be a non-empty string'),
  title: z.string().min(1, 'Scenario title must be a non-empty string'),
  description: z.string().min(1, 'Scenario description must be a non-empty string'),
  tags: z.array(z.string()),
  patient: z.object({
    archetypeId: z.string().min(1, 'patient.archetypeId must be a non-empty string'),
  }),
  learningObjectives: z.array(z.string()),
  estimatedDurationSec: z.number().positive('estimatedDurationSec must be a positive number'),
  phases: z.array(ScenarioPhaseSchema).min(1, 'Scenario must have at least one phase'),
  states: z.array(ScenarioStateSchema).min(1, 'Scenario must have at least one state'),
});

// ─── Inferred TypeScript types ────────────────────────────────────────────────

export type SedSimScenarioInput = z.input<typeof SedSimScenarioSchema>;
export type SedSimScenarioOutput = z.output<typeof SedSimScenarioSchema>;
