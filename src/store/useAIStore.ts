import { create } from 'zustand';
import { MultiAgentOrchestrator, AgentMessage } from '../ai/multiAgent';
import { EEGSnapshot } from '../ai/eegModel';
import { TwinState } from '../ai/digitalTwin';
import { Scenario } from '../ai/scenarioGenerator';

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
  activeAITab: 'eeg' | 'mentor' | 'scenarios';

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
  setActiveAITab: (tab: 'eeg' | 'mentor' | 'scenarios') => void;
  destroyAI: () => void;
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
}));

export default useAIStore;
