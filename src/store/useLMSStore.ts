/**
 * useLMSStore – Zustand store for LMS / xAPI / SCORM configuration and state.
 *
 * Provides:
 *  - LRS (Learning Record Store) endpoint configuration
 *  - Actor identity (name + mbox for xAPI statements)
 *  - SCORM session status
 *  - Helper actions to emit xAPI statements and update SCORM fields
 */

import { create } from 'zustand';
import type { LRSConfig, XApiActor, XApiStatement } from '../lms/xapiClient';
import {
  buildAttemptedStatement,
  buildCompletedStatement,
  buildScoredStatement,
  buildDrugAdministeredStatement,
  buildInterventionStatement,
  sendStatements,
  testLRSConnection,
} from '../lms/xapiClient';
import { scorm } from '../lms/scorm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LMSConfig {
  enabled: boolean;
  lrsConfig: LRSConfig;
  actor: XApiActor;
  /** Whether to also try SCORM communication (auto-detected at runtime). */
  scormEnabled: boolean;
  /** Current SCORM version detected by the wrapper (or 'none'). */
  scormVersion: 'none' | '1.2' | '2004';
}

interface LMSState {
  config: LMSConfig;
  connectionStatus: 'idle' | 'testing' | 'ok' | 'error';
  connectionError: string | null;
  /** Statements queued when LRS is temporarily unavailable. */
  pendingStatements: XApiStatement[];
  /** Total statements successfully sent this session. */
  sentCount: number;

  // ── Config actions ──────────────────────────────────────────────────────────
  setEnabled: (enabled: boolean) => void;
  setLRSConfig: (config: Partial<LRSConfig>) => void;
  setActor: (actor: Partial<XApiActor>) => void;
  setScormEnabled: (enabled: boolean) => void;

  // ── Connection test ─────────────────────────────────────────────────────────
  testConnection: () => Promise<void>;

  // ── xAPI event emission helpers ─────────────────────────────────────────────
  emitAttempted: (scenarioId?: string) => void;
  emitCompleted: (scenarioId: string | undefined, elapsedSeconds: number, success?: boolean) => void;
  emitScored: (scenarioId: string | undefined, rawScore: number, maxScore: number, elapsedSeconds: number) => void;
  emitDrugAdministered: (drugName: string, dose: number, unit: string, elapsedSeconds: number, scenarioId?: string) => void;
  emitIntervention: (intervention: string, elapsedSeconds: number, scenarioId?: string) => void;

  // ── SCORM helpers ───────────────────────────────────────────────────────────
  initScorm: () => void;
  terminateScorm: () => void;
  reportScormScore: (raw: number, min?: number, max?: number) => void;
  reportScormComplete: (passed: boolean, elapsedSeconds?: number) => void;
}

// ─── Default config ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: LMSConfig = {
  enabled: false,
  lrsConfig: {
    endpoint: '',
    authType: 'none',
    username: '',
    password: '',
    token: '',
  },
  actor: {
    name: 'SedSim Learner',
    mbox: 'mailto:learner@sedsim.app',
    objectType: 'Agent',
  },
  scormEnabled: true,
  scormVersion: 'none',
};

// ─── Store ────────────────────────────────────────────────────────────────────

const useLMSStore = create<LMSState>((set, get) => ({
  config: DEFAULT_CONFIG,
  connectionStatus: 'idle',
  connectionError: null,
  pendingStatements: [],
  sentCount: 0,

  // ── Config ──────────────────────────────────────────────────────────────────

  setEnabled: (enabled) => {
    set(s => ({ config: { ...s.config, enabled } }));
  },

  setLRSConfig: (partial) => {
    set(s => ({
      config: { ...s.config, lrsConfig: { ...s.config.lrsConfig, ...partial } },
      connectionStatus: 'idle',
      connectionError: null,
    }));
  },

  setActor: (partial) => {
    set(s => ({
      config: {
        ...s.config,
        actor: { ...s.config.actor, ...partial } as XApiActor,
      },
    }));
  },

  setScormEnabled: (scormEnabled) => {
    set(s => ({ config: { ...s.config, scormEnabled } }));
  },

  // ── Connection test ─────────────────────────────────────────────────────────

  testConnection: async () => {
    const { config } = get();
    set({ connectionStatus: 'testing', connectionError: null });
    const ok = await testLRSConnection(config.lrsConfig, config.actor);
    set({
      connectionStatus: ok ? 'ok' : 'error',
      connectionError: ok ? null : 'Could not reach LRS. Check endpoint URL and credentials.',
    });
  },

  // ── Internal helper ─────────────────────────────────────────────────────────

  // (send + queue on failure)

  // ── xAPI emitters ───────────────────────────────────────────────────────────

  emitAttempted: (scenarioId) => {
    const { config } = get();
    if (!config.enabled) return;
    const stmt = buildAttemptedStatement(config.actor, scenarioId);
    void _dispatch([stmt], get, set);
  },

  emitCompleted: (scenarioId, elapsedSeconds, success) => {
    const { config } = get();
    if (!config.enabled) return;
    const stmt = buildCompletedStatement(config.actor, scenarioId, elapsedSeconds, success);
    void _dispatch([stmt], get, set);
  },

  emitScored: (scenarioId, rawScore, maxScore, elapsedSeconds) => {
    const { config } = get();
    if (!config.enabled) return;
    const stmt = buildScoredStatement(config.actor, scenarioId, rawScore, maxScore, elapsedSeconds);
    void _dispatch([stmt], get, set);
  },

  emitDrugAdministered: (drugName, dose, unit, elapsedSeconds, scenarioId) => {
    const { config } = get();
    if (!config.enabled) return;
    const stmt = buildDrugAdministeredStatement(config.actor, drugName, dose, unit, elapsedSeconds, scenarioId);
    void _dispatch([stmt], get, set);
  },

  emitIntervention: (intervention, elapsedSeconds, scenarioId) => {
    const { config } = get();
    if (!config.enabled) return;
    const stmt = buildInterventionStatement(config.actor, intervention, elapsedSeconds, scenarioId);
    void _dispatch([stmt], get, set);
  },

  // ── SCORM ───────────────────────────────────────────────────────────────────

  initScorm: () => {
    const { config } = get();
    if (!config.scormEnabled) return;
    const ok = scorm.initialize();
    if (ok) {
      set(s => ({ config: { ...s.config, scormVersion: scorm.getVersion() } }));
      // Pre-fill actor from SCORM if available
      const learnerName = scorm.getLearnerName();
      const learnerId   = scorm.getLearnerId();
      if (learnerName || learnerId) {
        // Only use learnerId as mbox if it looks like an email address
        const isEmail = learnerId && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(learnerId);
        set(s => ({
          config: {
            ...s.config,
            actor: {
              name: learnerName || s.config.actor.name,
              mbox: isEmail ? `mailto:${learnerId}` : s.config.actor.mbox,
              objectType: 'Agent',
            },
          },
        }));
      }
    }
  },

  terminateScorm: () => {
    scorm.terminate();
  },

  reportScormScore: (raw, min = 0, max = 100) => {
    if (!scorm.isActive()) return;
    scorm.setScore(raw, min, max);
  },

  reportScormComplete: (passed, elapsedSeconds) => {
    if (!scorm.isActive()) return;
    scorm.setSessionTime(elapsedSeconds);
    scorm.setStatus(passed ? 'passed' : 'failed');
  },
}));

// ─── Internal dispatch helper (outside store to avoid circular reference) ─────

async function _dispatch(
  statements: XApiStatement[],
  get: () => LMSState,
  set: (partial: Partial<LMSState>) => void,
): Promise<void> {
  const { config, pendingStatements, sentCount } = get();
  // Flush pending + new
  const toSend = [...pendingStatements, ...statements];
  const ok = await sendStatements(toSend, config.lrsConfig);
  if (ok) {
    set({ pendingStatements: [], sentCount: sentCount + toSend.length });
  } else {
    // Queue for retry
    set({ pendingStatements: toSend });
  }
}

export default useLMSStore;
