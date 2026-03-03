/**
 * src/hooks/useConductor.ts
 * React hook that wraps the module-level Conductor singleton.
 *
 * Exposes loadScenario(), loadLegacyScenario(), start(), stop(),
 * answerQuestion(), and continuePendingStep() to components.
 *
 * NOTE: The Conductor is an application-level singleton. It should NOT be
 * stopped on component unmount — doing so would kill the scenario if the
 * consuming component (e.g. ScenarioPanel) is conditionally hidden while
 * a scenario is running. Stop the conductor explicitly via stop().
 */

import { useCallback } from 'react';
import { conductorInstance } from '../engine/conductor/conductorInstance';
import type { ConductorScenario } from '../engine/conductor/types';
import type { InteractiveScenario } from '../engine/ScenarioEngine';

export function useConductor() {
  const loadScenario = useCallback(
    (scenario: ConductorScenario) => {
      conductorInstance.loadScenario(scenario);
    },
    []
  );

  const loadLegacyScenario = useCallback(
    (scenario: InteractiveScenario) => {
      conductorInstance.loadLegacyScenario(scenario);
    },
    []
  );

  const start = useCallback(() => {
    conductorInstance.start();
  }, []);

  const stop = useCallback(() => {
    conductorInstance.stop();
  }, []);

  return { loadScenario, loadLegacyScenario, start, stop };
}
