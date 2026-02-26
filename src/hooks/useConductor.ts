/**
 * src/hooks/useConductor.ts
 * React hook that instantiates and manages the Conductor lifecycle.
 *
 * Creates SimAccessor from useSimStore and AIAccessor from useAIStore.
 * Exposes loadScenario(), loadLegacyScenario(), start(), stop() to components.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Conductor } from '../engine/conductor/Conductor';
import type { ConductorScenario } from '../engine/conductor/types';
import type { InteractiveScenario } from '../engine/ScenarioEngine';
import useSimStore from '../store/useSimStore';
import useAIStore from '../store/useAIStore';

export function useConductor() {
  const conductorRef = useRef<Conductor | null>(null);

  /** Lazily create (and reuse) the Conductor instance. */
  const getConductor = useCallback((): Conductor => {
    if (!conductorRef.current) {
      const simAccessor = {
        getVitals: () => {
          const v = useSimStore.getState().vitals;
          return {
            spo2: v.spo2,
            hr: v.hr,
            sbp: v.sbp,
            rr: v.rr,
            etco2: v.etco2,
            map: v.map,
            rhythm: v.rhythm,
          };
        },
        getMoass: () => useSimStore.getState().moass,
        getPkStates: () => {
          const pk = useSimStore.getState().pkStates as Record<string, { ce: number }>;
          return Object.fromEntries(
            Object.entries(pk).map(([name, state]) => [name, { ce: state?.ce ?? 0 }])
          );
        },
        getElapsedSeconds: () => useSimStore.getState().elapsedSeconds,
        getPkPdSensitivity: () => 1.0,
        overrideVital: (parameter: string, value: number) => {
          const store = useSimStore.getState();
          if (typeof store.overrideVital === 'function') {
            store.overrideVital(parameter, value);
          }
        },
      };

      const aiAccessor = {
        addMentorMessage: (role: 'user' | 'mentor', content: string) => {
          useAIStore.getState().addMentorMessage(role, content);
        },
        addVitalAnnotation: (ann: import('../engine/conductor/types').VitalAnnotation) => {
          useAIStore.getState().addVitalAnnotation(ann);
        },
        setActiveHighlights: (
          highlights:
            | { targetId: string; text: string; vitalLabel?: string; vitalValue?: number; severity?: 'normal' | 'warning' | 'danger' }[]
            | null
        ) => {
          useAIStore.getState().setActiveHighlights(highlights);
        },
        setCurrentQuestion: (
          q: { stepId: string; question: import('../engine/ScenarioEngine').ScenarioQuestion } | null
        ) => {
          useAIStore.getState().setCurrentQuestion(q);
        },
        setCurrentScenarioPhase: (
          phase: import('../engine/conductor/types').ConductorStep['phase'] | null
        ) => {
          useAIStore.getState().setCurrentScenarioPhase(phase);
        },
        setScenarioRunning: (running: boolean) => {
          useAIStore.getState().setScenarioRunning(running);
        },
      };

      conductorRef.current = new Conductor(simAccessor, aiAccessor);
    }
    return conductorRef.current;
  }, []);

  // Cleanup: stop the conductor when the component unmounts.
  useEffect(() => {
    return () => {
      conductorRef.current?.stop();
    };
  }, []);

  const loadScenario = useCallback(
    (scenario: ConductorScenario) => {
      getConductor().loadScenario(scenario);
    },
    [getConductor]
  );

  const loadLegacyScenario = useCallback(
    (scenario: InteractiveScenario) => {
      getConductor().loadLegacyScenario(scenario);
    },
    [getConductor]
  );

  const start = useCallback(() => {
    getConductor().start();
  }, [getConductor]);

  const stop = useCallback(() => {
    getConductor().stop();
  }, [getConductor]);

  return { loadScenario, loadLegacyScenario, start, stop };
}
