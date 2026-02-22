import { create } from 'zustand';
import { MultiAgentOrchestrator, AgentMessage } from '../ai/multiAgent';
import { EEGSnapshot } from '../ai/eegModel';
import { TwinState } from '../ai/digitalTwin';
import { Scenario } from '../ai/scenarioGenerator';
import { GhostDose, TutorialState } from '../types';
import type { ScenarioQuestion } from '../engine/ScenarioEngine';

interface AIState {
  // Orchestrator
  orchestrator: MultiAgentOrchestrator | null;
  isAIRunning: boolean;

  // EEG State
  eegSnapshot: EEGSnapshot | null;
  eegHistory: EEGSnapshot[];

  // Twin State
  twinState: TwinState | null;

  // Alerts
  alerts: AgentMessage[];
  unreadAlertCount: number;

  // Scenario
  activeScenario: Scenario | null;
  scenarioHistory: Scenario[];

  // Mentor
  mentorMessages: { role: 'user' | 'mentor'; content: string }[];
  isMentorThinking: boolean;

  // Dashboard
  isDashboardOpen: boolean;
  activeAITab: 'eeg' | 'mentor';

  // Ghost Dose
  ghostDose: GhostDose | null;

  // Tutorial
  tutorialState: TutorialState | null;

  // Scenario engine state
  isScenarioRunning: boolean;
  currentQuestion: { stepId: string; question: ScenarioQuestion } | null;

  // Callout highlights
  activeHighlights: { targetId: string; text: string; vitalLabel?: string; vitalValue?: number; severity?: 'normal' | 'warning' | 'danger' }[] | null;

  // Scenario phase tracking
  currentScenarioPhase: 'pre_induction' | 'induction' | 'maintenance' | 'complication' | 'recovery' | 'debrief' | null;
  scenarioElapsedSeconds: number;

  // Actions
  initializeAI: () => void;
  startAI: () => void;
  stopAI: () => void;
  updateEEG: (snapshot: EEGSnapshot) => void;
  updateTwin: (state: TwinState) => void;
  addAlert: (alert: AgentMessage) => void;
  clearAlerts: () => void;
  setActiveScenario: (scenario: Scenario | null) => void;
  addMentorMessage: (role: 'user' | 'mentor', content: string) => void;
  setMentorThinking: (thinking: boolean) => void;
  toggleDashboard: () => void;
  setActiveAITab: (tab: 'eeg' | 'mentor') => void;
  destroyAI: () => void;
  setGhostDose: (ghost: GhostDose | null) => void;
  setTutorialState: (state: TutorialState | null) => void;
  setScenarioRunning: (running: boolean) => void;
  setCurrentQuestion: (q: { stepId: string; question: ScenarioQuestion } | null) => void;
  setActiveHighlights: (highlights: { targetId: string; text: string; vitalLabel?: string; vitalValue?: number; severity?: 'normal' | 'warning' | 'danger' }[] | null) => void;
  setCurrentScenarioPhase: (phase: 'pre_induction' | 'induction' | 'maintenance' | 'complication' | 'recovery' | 'debrief' | null) => void;
  setScenarioElapsedSeconds: (seconds: number) => void;
}

const useAIStore = create<AIState>((set, get) => ({
  orchestrator: null,
  isAIRunning: false,
  eegSnapshot: null,
  eegHistory: [],
  twinState: null,
  alerts: [],
  unreadAlertCount: 0,
  activeScenario: null,
  scenarioHistory: [],
  mentorMessages: [],
  isMentorThinking: false,
  isDashboardOpen: false,
  activeAITab: 'eeg',
  ghostDose: null,
  tutorialState: null,
  isScenarioRunning: false,
  currentQuestion: null,
  activeHighlights: null,
  currentScenarioPhase: null,
  scenarioElapsedSeconds: 0,

  initializeAI: () => {
    const orchestrator = new MultiAgentOrchestrator();
    orchestrator.onMessages((messages) => {
      const state = get();
      set({
        alerts: [...state.alerts, ...messages].slice(-50),
        unreadAlertCount: state.unreadAlertCount + messages.length,
      });
    });
    set({ orchestrator });
  },

  startAI: () => {
    const { orchestrator } = get();
    if (orchestrator) {
      orchestrator.start(1000);
      set({ isAIRunning: true });
    }
  },

  stopAI: () => {
    const { orchestrator } = get();
    if (orchestrator) {
      orchestrator.stop();
      set({ isAIRunning: false });
    }
  },

  updateEEG: (snapshot) => {
    const { eegHistory } = get();
    set({
      eegSnapshot: snapshot,
      eegHistory: [...eegHistory, snapshot].slice(-60),
    });
  },

  updateTwin: (state) => {
    set({ twinState: state });
  },

  addAlert: (alert) => {
    const { alerts, unreadAlertCount } = get();
    set({
      alerts: [...alerts, alert].slice(-50),
      unreadAlertCount: unreadAlertCount + 1,
    });
  },

  clearAlerts: () => {
    set({ unreadAlertCount: 0 });
  },

  setActiveScenario: (scenario) => {
    const { scenarioHistory } = get();
    set({
      activeScenario: scenario,
      scenarioHistory: scenario
        ? [...scenarioHistory, scenario].slice(-10)
        : scenarioHistory,
    });
  },

  addMentorMessage: (role, content) => {
    const { mentorMessages } = get();
    set({
      mentorMessages: [...mentorMessages, { role, content }],
    });
  },

  setMentorThinking: (thinking) => {
    set({ isMentorThinking: thinking });
  },

  toggleDashboard: () => {
    const { isDashboardOpen } = get();
    set({ isDashboardOpen: !isDashboardOpen });
  },

  setActiveAITab: (tab) => {
    set({ activeAITab: tab });
  },

  destroyAI: () => {
    const { orchestrator } = get();
    if (orchestrator) {
      orchestrator.destroy();
    }
    set({
      orchestrator: null,
      isAIRunning: false,
      eegSnapshot: null,
      eegHistory: [],
      twinState: null,
      alerts: [],
      unreadAlertCount: 0,
    });
  },

  setGhostDose: (ghost) => {
    set({ ghostDose: ghost });
  },

  setTutorialState: (state) => {
    set({ tutorialState: state });
  },

  setScenarioRunning: (running) => {
    set({ isScenarioRunning: running });
  },

  setCurrentQuestion: (q) => {
    set({ currentQuestion: q });
  },

  setActiveHighlights: (highlights) => {
    set({ activeHighlights: highlights });
  },

  setCurrentScenarioPhase: (phase) => {
    set({ currentScenarioPhase: phase });
  },

  setScenarioElapsedSeconds: (seconds) => {
    set({ scenarioElapsedSeconds: seconds });
  },
}));

export default useAIStore;
