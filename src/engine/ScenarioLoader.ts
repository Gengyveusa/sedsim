// src/engine/ScenarioLoader.ts
// Loads and validates a SedSimScenario JSON object, producing an in-memory
// representation with states keyed by ID, a transition map, and phase metadata.

import {
  SedSimScenario,
  ScenarioState,
  ScenarioPhase,
  PhaseId,
} from './SedSimCase.types';
import { SedSimScenarioSchema } from './scenarios/schema';

export interface LoadedScenario {
  raw: SedSimScenario;
  statesById: Map<string, ScenarioState>;
  transitionMap: Map<string, string[]>; // fromStateId → toStateId[]
  phasesById: Map<PhaseId, ScenarioPhase>;
  orderedPhases: ScenarioPhase[];
  firstStateId: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateScenario(data: unknown): asserts data is SedSimScenario {
  const result = SedSimScenarioSchema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')} — ${issue.message}`)
      .join('\n');
    throw new Error(
      `ScenarioLoader: scenario failed validation:\n${messages}`
    );
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
