/**
 * src/engine/conductor/conductorInstance.ts
 * Module-level Conductor singleton — accessible from both React and non-React code.
 *
 * Uses the same Zustand accessor pattern as useConductor.ts but lives at module
 * scope so that ControlBar, MentorChat, and MillieChat can call answerQuestion()
 * and continuePendingStep() without prop-drilling or extra React context.
 */

import { Conductor } from './Conductor';
import type { SimStoreAccessor, AIStoreAccessor } from './Conductor';
import useSimStore from '../../store/useSimStore';
import useAIStore from '../../store/useAIStore';
import type { VitalAnnotation } from './types';
import type { ConductorStep } from './types';
import type { ScenarioQuestion } from '../ScenarioEngine';
import type { ScoringSummary } from '../scoringEngine';

const simAccessor: SimStoreAccessor = {
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
  administerBolus: (drug: string, dose: number) => {
    const store = useSimStore.getState();
    if (typeof store.administerBolus === 'function') {
      store.administerBolus(drug, dose);
    }
  },
  getEventLog: () => useSimStore.getState().eventLog,
  getTrendData: () => useSimStore.getState().trendData,
};

const aiAccessor: AIStoreAccessor = {
  addMentorMessage: (role: 'user' | 'mentor', content: string) => {
    useAIStore.getState().addMentorMessage(role, content);
  },
  addVitalAnnotation: (ann: VitalAnnotation) => {
    useAIStore.getState().addVitalAnnotation(ann);
  },
  setActiveHighlights: (
    highlights: { targetId: string; text: string; vitalLabel?: string; vitalValue?: number; severity?: 'normal' | 'warning' | 'danger' }[] | null
  ) => {
    useAIStore.getState().setActiveHighlights(highlights);
  },
  setCurrentQuestion: (
    q: { stepId: string; question: ScenarioQuestion } | null
  ) => {
    useAIStore.getState().setCurrentQuestion(q);
  },
  setCurrentScenarioPhase: (
    phase: ConductorStep['phase'] | null
  ) => {
    useAIStore.getState().setCurrentScenarioPhase(phase);
  },
  setScenarioRunning: (running: boolean) => {
    useAIStore.getState().setScenarioRunning(running);
  },
  setPendingContinue: (pending: { stepId: string; stepLabel: string } | null) => {
    useAIStore.getState().setPendingContinue(pending);
  },
  setLastScenarioScore: (score: ScoringSummary | null) => {
    useAIStore.getState().setLastScenarioScore(score);
  },
};

export const conductorInstance = new Conductor(simAccessor, aiAccessor);
