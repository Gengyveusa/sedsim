// src/store/useInstructorStore.ts
// Instructor Dashboard — persistent session records & auth

import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudentSession {
  id: string;
  studentName: string;
  scenarioId: string;
  scenarioTitle: string;
  difficulty: string;
  completedAt: number; // Unix ms timestamp
  durationSeconds: number;
  drugsAdministeredCount: number;
  interventionsApplied: number;
  alertsTriggered: number;
  minSpo2: number;
  minSbp: number;
  maxMoass: number;
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

const SESSIONS_KEY = 'sedsim_class_sessions';
const LEARNER_KEY = 'sedsim_learner_name';

function loadSessions(): StudentSession[] {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]') as StudentSession[];
  } catch {
    return [];
  }
}

function saveSessions(sessions: StudentSession[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch { /* quota exceeded – ignore */ }
}

export function getLearnerName(): string {
  return localStorage.getItem(LEARNER_KEY) ?? 'Anonymous';
}

export function setLearnerNamePersist(name: string): void {
  try { localStorage.setItem(LEARNER_KEY, name.trim() || 'Anonymous'); } catch { /* ignore */ }
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface InstructorState {
  sessions: StudentSession[];

  /** Add a completed session record and persist to localStorage. */
  addSession: (session: Omit<StudentSession, 'id'>) => void;

  /** Delete a single session by id. */
  deleteSession: (id: string) => void;

  /** Delete all sessions (reset class data). */
  clearSessions: () => void;

  /** Return sessions as a CSV string for download. */
  exportCSV: () => string;
}

const useInstructorStore = create<InstructorState>((set, get) => ({
  sessions: loadSessions(),

  addSession(session) {
    const newSession: StudentSession = {
      ...session,
      id: typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    const updated = [...get().sessions, newSession];
    saveSessions(updated);
    set({ sessions: updated });
  },

  deleteSession(id) {
    const updated = get().sessions.filter(s => s.id !== id);
    saveSessions(updated);
    set({ sessions: updated });
  },

  clearSessions() {
    saveSessions([]);
    set({ sessions: [] });
  },

  exportCSV() {
    const rows = get().sessions;
    const header = [
      'Student Name',
      'Scenario',
      'Difficulty',
      'Completed At',
      'Duration (s)',
      'Drugs Given',
      'Interventions',
      'Alerts',
      'Min SpO₂',
      'Min SBP',
      'Max MOASS',
    ].join(',');

    const escape = (v: string | number) => {
      const s = String(v);
      return s.includes(',') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines = rows.map(r =>
      [
        escape(r.studentName),
        escape(r.scenarioTitle),
        escape(r.difficulty),
        escape(new Date(r.completedAt).toISOString()),
        r.durationSeconds,
        r.drugsAdministeredCount,
        r.interventionsApplied,
        r.alertsTriggered,
        r.minSpo2.toFixed(0),
        r.minSbp.toFixed(0),
        r.maxMoass,
      ].join(',')
    );

    return [header, ...lines].join('\n');
  },
}));

export default useInstructorStore;
