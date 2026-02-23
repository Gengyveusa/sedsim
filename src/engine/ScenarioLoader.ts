// src/engine/ScenarioLoader.ts
// Loads and validates a SedSimScenario JSON object, producing an in-memory
// representation with states keyed by ID, a transition map, and phase metadata.

import {
  SedSimScenario,
  ScenarioState,
  ScenarioPhase,
  PhaseId,
} from './SedSimCase.types';

export interface LoadedScenario {
  raw: SedSimScenario;
  statesById: Map<string, ScenarioState>;
  transitionMap: Map<string, string[]>; // fromStateId → toStateId[]
  phasesById: Map<PhaseId, ScenarioPhase>;
  orderedPhases: ScenarioPhase[];
  firstStateId: string;
}

// ─── Validation helpers ──────────────────────────────────────────────────────

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`ScenarioLoader: "${path}" must be a non-empty string`);
  }
}

function assertArray(value: unknown, path: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`ScenarioLoader: "${path}" must be an array`);
  }
}

function validateScenario(data: unknown): asserts data is SedSimScenario {
  if (typeof data !== 'object' || data === null) {
    throw new Error('ScenarioLoader: scenario must be a non-null object');
  }
  const s = data as Record<string, unknown>;
  assertString(s['id'], 'id');
  assertString(s['title'], 'title');
  assertString(s['description'], 'description');
  assertArray(s['phases'], 'phases');
  assertArray(s['states'], 'states');

  if (typeof s['patient'] !== 'object' || s['patient'] === null) {
    throw new Error('ScenarioLoader: "patient" must be an object');
  }
  const patient = s['patient'] as Record<string, unknown>;
  assertString(patient['archetypeId'], 'patient.archetypeId');

  // Validate each phase
  for (const phase of s['phases'] as Record<string, unknown>[]) {
    assertString(phase['id'], 'phase.id');
    assertString(phase['label'], 'phase.label');
    if (typeof phase['order'] !== 'number') {
      throw new Error(`ScenarioLoader: phase "${phase['id']}" must have a numeric "order"`);
    }
  }

  // Validate each state
  for (const state of s['states'] as Record<string, unknown>[]) {
    assertString(state['id'], 'state.id');
    assertString(state['phaseId'], 'state.phaseId');
    assertString(state['type'], 'state.type');
    if (!Array.isArray(state['exitConditions'])) {
      throw new Error(`ScenarioLoader: state "${state['id']}" must have an "exitConditions" array`);
    }
    if (!Array.isArray(state['transitions'])) {
      throw new Error(`ScenarioLoader: state "${state['id']}" must have a "transitions" array`);
    }
  }
}

// ─── Loader ──────────────────────────────────────────────────────────────────

export function loadScenario(data: unknown): LoadedScenario {
  validateScenario(data);
  const scenario = data as SedSimScenario;

  // Build states map
  const statesById = new Map<string, ScenarioState>();
  for (const state of scenario.states) {
    if (statesById.has(state.id)) {
      throw new Error(`ScenarioLoader: duplicate state id "${state.id}"`);
    }
    statesById.set(state.id, state);
  }

  // Build transition map: fromStateId → [toStateId, ...]
  const transitionMap = new Map<string, string[]>();
  for (const state of scenario.states) {
    const targets: string[] = [];
    for (const t of state.transitions) {
      if (!statesById.has(t.toStateId)) {
        throw new Error(
          `ScenarioLoader: transition in state "${state.id}" references unknown toStateId "${t.toStateId}"`
        );
      }
      targets.push(t.toStateId);
    }
    transitionMap.set(state.id, targets);
  }

  // Build phases map
  const phasesById = new Map<PhaseId, ScenarioPhase>();
  const orderedPhases = [...scenario.phases].sort((a, b) => a.order - b.order);
  for (const phase of orderedPhases) {
    phasesById.set(phase.id, phase);
  }

  const firstStateId = scenario.states[0]?.id ?? '';

  return { raw: scenario, statesById, transitionMap, phasesById, orderedPhases, firstStateId };
}
