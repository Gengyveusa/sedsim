/**
 * src/store/slices/studySlice.ts
 * Zustand slice for the A/B study protocol state.
 * Manages enrollment, arm assignment, test scores, and research mode toggle.
 */

import { StateCreator } from 'zustand';
import type { StudyArmId } from '../../ai/studyArms';

// ─── Latin square for 3-arm counterbalancing ─────────────────────────────────

/** All 6 permutations of [A, B, C] for balanced Latin square assignment. */
const LATIN_SQUARE: StudyArmId[][] = [
  ['A', 'B', 'C'],
  ['A', 'C', 'B'],
  ['B', 'A', 'C'],
  ['B', 'C', 'A'],
  ['C', 'A', 'B'],
  ['C', 'B', 'A'],
];

// ─── Types ───────────────────────────────────────────────────────────────────

export type StudyPhase =
  | 'enrollment'
  | 'pretest'
  | 'simulation'
  | 'posttest'
  | 'arm_complete'
  | 'study_complete';

export interface ArmResult {
  arm: StudyArmId;
  pretestScore: number;
  posttestScore: number;
  scenarioScore: number;
  duration_s: number;
  sessionId: string;
}

export interface StudySlice {
  // Research mode
  researchMode: boolean;
  setResearchMode: (on: boolean) => void;

  // Enrollment
  learnerId: string;
  isEnrolled: boolean;
  consentGiven: boolean;
  enroll: (learnerId: string) => void;
  giveConsent: () => void;

  // Arm assignment & rotation
  armSequence: StudyArmId[];
  currentArmIndex: number;
  currentArm: StudyArmId | null;
  studyPhase: StudyPhase;

  // Per-arm results
  armResults: ArmResult[];

  // Test scores for current arm
  currentPretestScore: number;
  currentPosttestScore: number;

  // Actions
  assignArms: () => void;
  setStudyPhase: (phase: StudyPhase) => void;
  setPretestScore: (score: number) => void;
  setPosttestScore: (score: number) => void;
  completeArm: (result: Omit<ArmResult, 'arm'>) => void;
  advanceToNextArm: () => void;
  resetStudy: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateLearnerId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'P-';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ─── Slice creator ───────────────────────────────────────────────────────────

export const createStudySlice: StateCreator<StudySlice, [], [], StudySlice> = (set, get) => ({
  researchMode: false,
  learnerId: '',
  isEnrolled: false,
  consentGiven: false,
  armSequence: [],
  currentArmIndex: 0,
  currentArm: null,
  studyPhase: 'enrollment',
  armResults: [],
  currentPretestScore: -1,
  currentPosttestScore: -1,

  setResearchMode: (on) => {
    set({ researchMode: on });
  },

  enroll: (learnerId) => {
    const id = learnerId.trim() || generateLearnerId();
    set({
      learnerId: id,
      isEnrolled: true,
      studyPhase: 'enrollment',
    });
  },

  giveConsent: () => {
    set({ consentGiven: true });
  },

  assignArms: () => {
    // Deterministic counterbalancing based on learner ID hash
    const state = get();
    let hash = 0;
    for (let i = 0; i < state.learnerId.length; i++) {
      hash = ((hash << 5) - hash + state.learnerId.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % LATIN_SQUARE.length;
    const sequence = LATIN_SQUARE[idx];
    set({
      armSequence: sequence,
      currentArmIndex: 0,
      currentArm: sequence[0],
      studyPhase: 'pretest',
    });
  },

  setStudyPhase: (phase) => {
    set({ studyPhase: phase });
  },

  setPretestScore: (score) => {
    set({ currentPretestScore: score });
  },

  setPosttestScore: (score) => {
    set({ currentPosttestScore: score });
  },

  completeArm: (result) => {
    const state = get();
    const arm = state.currentArm;
    if (!arm) return;

    const armResult: ArmResult = {
      arm,
      ...result,
    };
    set({
      armResults: [...state.armResults, armResult],
      studyPhase: 'arm_complete',
    });
  },

  advanceToNextArm: () => {
    const state = get();
    const nextIdx = state.currentArmIndex + 1;
    if (nextIdx >= state.armSequence.length) {
      set({ studyPhase: 'study_complete' });
      return;
    }
    set({
      currentArmIndex: nextIdx,
      currentArm: state.armSequence[nextIdx],
      studyPhase: 'pretest',
      currentPretestScore: -1,
      currentPosttestScore: -1,
    });
  },

  resetStudy: () => {
    set({
      learnerId: '',
      isEnrolled: false,
      consentGiven: false,
      armSequence: [],
      currentArmIndex: 0,
      currentArm: null,
      studyPhase: 'enrollment',
      armResults: [],
      currentPretestScore: -1,
      currentPosttestScore: -1,
    });
  },
});
