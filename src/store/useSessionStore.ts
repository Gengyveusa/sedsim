/**
 * useSessionStore.ts
 *
 * Zustand store for session recording and playback UI state.
 * The actual recording data is managed by sessionRecorderInstance.
 */

import { create } from 'zustand';
import { sessionRecorderInstance } from '../engine/sessionRecorderInstance';
import { reconstructTimeline, PlaybackFrame, SessionRecording } from '../engine/sessionRecorder';
import type { Vitals, MOASSLevel, PKState, LogEntry } from '../types';

export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
export type PlaybackSpeed = typeof PLAYBACK_SPEEDS[number];

interface PlaybackState {
  isActive: boolean;
  /** Currently displayed frame index into the `frames` array. */
  currentIndex: number;
  speed: PlaybackSpeed;
  isPlaying: boolean;
  frames: PlaybackFrame[];
  /** Total number of frames available. */
  totalFrames: number;
}

interface SessionStoreState {
  isRecording: boolean;
  /** Snapshot count at the last UI update (used to poll frame count). */
  frameCount: number;
  /** Approximate size in bytes of the current recording. */
  estimatedBytes: number;

  playback: PlaybackState;

  // ── Actions ──────────────────────────────────────────────────────────────
  startRecording: (patientInfo?: SessionRecording['patient']) => void;
  stopRecording: () => void;
  /** Export current recording to JSON and trigger a browser download. */
  downloadRecording: () => void;
  /** Get the raw SessionRecording object (for external use). */
  getRecording: () => SessionRecording;

  startPlayback: () => void;
  stopPlayback: () => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  /** Set the playback position by frame index. */
  seekToFrame: (index: number) => void;
  /** Advance playback by one frame. Called by internal timer. */
  advancePlayback: () => void;
  /** Get the current playback frame (or null). */
  currentPlaybackFrame: () => PlaybackFrame | null;

  /** Refresh frame count / size estimate from the recorder (call periodically). */
  refreshStats: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const useSessionStore = create<SessionStoreState>((set, get) => ({
  isRecording: false,
  frameCount: 0,
  estimatedBytes: 0,

  playback: {
    isActive: false,
    currentIndex: 0,
    speed: 1,
    isPlaying: false,
    frames: [],
    totalFrames: 0,
  },

  // ─── Recording actions ──────────────────────────────────────────────────

  startRecording: (patientInfo) => {
    sessionRecorderInstance.clear();
    if (patientInfo) sessionRecorderInstance.setPatient(patientInfo);
    set({ isRecording: true, frameCount: 0, estimatedBytes: 0 });
  },

  stopRecording: () => {
    set({
      isRecording: false,
      frameCount: sessionRecorderInstance.frameCount,
      estimatedBytes: sessionRecorderInstance.estimatedSizeBytes(),
    });
  },

  downloadRecording: () => {
    if (!sessionRecorderInstance.hasData) return;
    const json = sessionRecorderInstance.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `sedsim-session-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  getRecording: () => sessionRecorderInstance.exportRecording(),

  // ─── Playback actions ──────────────────────────────────────────────────

  startPlayback: () => {
    if (!sessionRecorderInstance.hasData) return;
    const recording = sessionRecorderInstance.exportRecording();
    const frames = reconstructTimeline(recording);
    set({
      playback: {
        isActive: true,
        currentIndex: 0,
        speed: get().playback.speed,
        isPlaying: true,
        frames,
        totalFrames: frames.length,
      },
    });
  },

  stopPlayback: () => {
    set(state => ({
      playback: { ...state.playback, isActive: false, isPlaying: false },
    }));
  },

  setPlaybackSpeed: (speed) => {
    set(state => ({ playback: { ...state.playback, speed } }));
  },

  seekToFrame: (index) => {
    set(state => {
      const clamped = Math.max(0, Math.min(index, state.playback.frames.length - 1));
      return { playback: { ...state.playback, currentIndex: clamped } };
    });
  },

  advancePlayback: () => {
    set(state => {
      const { currentIndex, frames, isPlaying } = state.playback;
      if (!isPlaying || currentIndex >= frames.length - 1) {
        // Reached end — pause
        return { playback: { ...state.playback, isPlaying: false } };
      }
      return { playback: { ...state.playback, currentIndex: currentIndex + 1 } };
    });
  },

  currentPlaybackFrame: () => {
    const { frames, currentIndex } = get().playback;
    return frames[currentIndex] ?? null;
  },

  refreshStats: () => {
    set({
      frameCount: sessionRecorderInstance.frameCount,
    });
  },
}));

// ─── Playback selectors (convenience) ─────────────────────────────────────────

/** Select the vitals from the current playback frame, or null. */
export function selectPlaybackVitals(state: SessionStoreState): Vitals | null {
  const { frames, currentIndex, isActive } = state.playback;
  if (!isActive) return null;
  return frames[currentIndex]?.vitals ?? null;
}

/** Select the pkStates from the current playback frame, or null. */
export function selectPlaybackPK(state: SessionStoreState): Record<string, PKState> | null {
  const { frames, currentIndex, isActive } = state.playback;
  if (!isActive) return null;
  return frames[currentIndex]?.pkStates ?? null;
}

/** Select the MOASS from the current playback frame, or null. */
export function selectPlaybackMoass(state: SessionStoreState): MOASSLevel | null {
  const { frames, currentIndex, isActive } = state.playback;
  if (!isActive) return null;
  return frames[currentIndex]?.moass ?? null;
}

/** Select the event log entries for the current playback frame, or []. */
export function selectPlaybackEvents(state: SessionStoreState): LogEntry[] {
  const { frames, currentIndex, isActive } = state.playback;
  if (!isActive) return [];
  return frames[currentIndex]?.events ?? [];
}

export default useSessionStore;
