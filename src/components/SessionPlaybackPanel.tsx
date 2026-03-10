/**
 * SessionPlaybackPanel.tsx
 *
 * UI panel for session recording and playback.
 * - Shows REC indicator and download button while recording.
 * - Loads the recorded session into a scrubber for post-session review.
 * - Applies playback frames to a local state for display (does NOT
 *   overwrite the live sim store).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import useSessionStore, { PLAYBACK_SPEEDS } from '../store/useSessionStore';
import useSimStore from '../store/useSimStore';
import { sessionRecorderInstance } from '../engine/sessionRecorderInstance';
import { PlaybackFrame } from '../engine/sessionRecorder';

// ─── Format helpers ────────────────────────────────────────────────────────────

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// ─── Sub-component: RecordingBadge ─────────────────────────────────────────────

const RecordingBadge: React.FC = () => {
  const isRecording = useSessionStore(s => s.isRecording);
  const frameCount = useSessionStore(s => s.frameCount);
  const { stopRecording, downloadRecording, startRecording, refreshStats } = useSessionStore();
  const patient = useSimStore(s => s.patient);
  const archetypeKey = useSimStore(s => s.archetypeKey);
  const [sizeLabel, setSizeLabel] = useState('0 B');

  // Poll frame count + size every second while recording
  useEffect(() => {
    if (!isRecording) return;
    const iv = setInterval(() => {
      refreshStats();
      setSizeLabel(fmtBytes(sessionRecorderInstance.estimatedSizeBytes()));
    }, 1000);
    return () => clearInterval(iv);
  }, [isRecording, refreshStats]);

  const handleStartRecording = useCallback(() => {
    startRecording({
      archetypeKey,
      age: patient.age,
      weight: patient.weight,
      sex: patient.sex,
      asa: patient.asa,
    });
  }, [startRecording, archetypeKey, patient]);

  if (isRecording) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-red-400 text-xs font-semibold animate-pulse">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          REC {frameCount > 0 && <span className="text-gray-400 font-normal">({sizeLabel})</span>}
        </span>
        <button
          onClick={stopRecording}
          title="Stop recording"
          className="px-2 py-1 rounded text-xs bg-red-800 hover:bg-red-700 text-white font-medium"
        >
          ■ Stop
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleStartRecording}
        title="Start recording session"
        className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium"
      >
        ● Record
      </button>
      {sessionRecorderInstance.hasData && (
        <button
          onClick={downloadRecording}
          title="Download session JSON"
          className="px-2 py-1 rounded text-xs bg-blue-800 hover:bg-blue-700 text-white font-medium"
        >
          ↓ Export
        </button>
      )}
    </div>
  );
};

// ─── Sub-component: PlaybackControls ─────────────────────────────────────────

interface PlaybackControlsProps {
  onClose: () => void;
  /** Called when playback frame changes so parent can use the frame data. */
  onFrameChange?: (frame: PlaybackFrame | null) => void;
}

const PlaybackControls: React.FC<PlaybackControlsProps> = ({ onClose, onFrameChange }) => {
  const {
    playback,
    startPlayback,
    stopPlayback,
    seekToFrame,
    advancePlayback,
    setPlaybackSpeed,
    currentPlaybackFrame,
    downloadRecording,
  } = useSessionStore();

  const { isActive, isPlaying, currentIndex, totalFrames, frames, speed } = playback;

  // Internal interval for playback
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Computed elapsed time from the current frame
  const currentFrame = frames[currentIndex] ?? null;
  const currentTime = currentFrame?.t ?? 0;
  const totalTime = frames[totalFrames - 1]?.t ?? 0;

  // Advance playback at the chosen speed
  useEffect(() => {
    if (!isActive || !isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    // Each real-world tick = 1 sim-second; at speed N we advance N frames/tick
    const intervalMs = 1000 / speed;
    intervalRef.current = setInterval(() => {
      advancePlayback();
    }, intervalMs);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isActive, isPlaying, speed, advancePlayback]);

  // Notify parent on frame change
  useEffect(() => {
    if (!isActive) {
      onFrameChange?.(null);
      return;
    }
    onFrameChange?.(currentPlaybackFrame());
  }, [isActive, currentIndex, currentPlaybackFrame, onFrameChange]);

  const handleTogglePlay = () => {
    if (!isActive) {
      startPlayback();
    } else if (isPlaying) {
      useSessionStore.setState(s => ({ playback: { ...s.playback, isPlaying: false } }));
    } else {
      useSessionStore.setState(s => ({ playback: { ...s.playback, isPlaying: true } }));
    }
  };

  if (!sessionRecorderInstance.hasData) {
    return (
      <div className="text-gray-500 text-xs px-2">No recording available. Press ● Record to start.</div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-gray-900 rounded-lg border border-gray-700 text-xs w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-gray-300 font-semibold">Session Playback</span>
        <div className="flex gap-2">
          <button
            onClick={downloadRecording}
            title="Download session JSON"
            className="px-2 py-0.5 rounded bg-blue-800 hover:bg-blue-700 text-white text-xs"
          >
            ↓ Export JSON
          </button>
          <button
            onClick={() => { stopPlayback(); onClose(); }}
            className="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Timeline scrubber */}
      <div className="flex items-center gap-2">
        <span className="text-gray-400 w-10 text-right font-mono">{fmtTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(0, totalFrames - 1)}
          value={currentIndex}
          onChange={e => seekToFrame(Number(e.target.value))}
          className="flex-1 h-1.5 accent-blue-500 cursor-pointer"
          aria-label="Playback position"
        />
        <span className="text-gray-400 w-10 font-mono">{fmtTime(totalTime)}</span>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-3">
        {/* Rewind to start */}
        <button
          onClick={() => seekToFrame(0)}
          title="Go to start"
          className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white"
        >
          ⏮
        </button>

        {/* Play / Pause */}
        <button
          onClick={handleTogglePlay}
          className={`px-3 py-1 rounded font-medium ${
            isPlaying ? 'bg-yellow-700 hover:bg-yellow-600' : 'bg-green-700 hover:bg-green-600'
          } text-white`}
        >
          {isPlaying ? '⏸ Pause' : isActive ? '▶ Resume' : '▶ Play'}
        </button>

        {/* Go to end */}
        <button
          onClick={() => seekToFrame(totalFrames - 1)}
          title="Go to end"
          className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white"
        >
          ⏭
        </button>

        {/* Speed selector */}
        <div className="flex items-center gap-1 ml-2">
          <span className="text-gray-400">Speed:</span>
          {PLAYBACK_SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => setPlaybackSpeed(s)}
              className={`px-1.5 py-0.5 rounded text-xs ${
                speed === s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Current frame info */}
      {isActive && currentFrame && (
        <div className="text-gray-500 text-xs">
          Frame {currentIndex + 1} / {totalFrames} ·
          HR <span className="text-green-400">{currentFrame.vitals.hr.toFixed(0)}</span> ·
          SpO₂ <span className="text-cyan-400">{currentFrame.vitals.spo2.toFixed(0)}%</span> ·
          MOASS <span className="text-yellow-400">{currentFrame.moass}</span>
        </div>
      )}
    </div>
  );
};

// ─── Main export: SessionPlaybackPanel ────────────────────────────────────────

interface SessionPlaybackPanelProps {
  /** If provided, called whenever the active playback frame changes. */
  onFrameChange?: (frame: PlaybackFrame | null) => void;
}

const SessionPlaybackPanel: React.FC<SessionPlaybackPanelProps> = ({ onFrameChange }) => {
  const [showPlayback, setShowPlayback] = useState(false);
  const hasData = sessionRecorderInstance.hasData;

  return (
    <div className="flex flex-col gap-2">
      {/* Recording badge always shown in the control bar */}
      <div className="flex items-center gap-2">
        <RecordingBadge />
        {hasData && (
          <button
            onClick={() => setShowPlayback(v => !v)}
            title="Open playback panel"
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              showPlayback
                ? 'bg-blue-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            ▶ Review
          </button>
        )}
      </div>

      {/* Playback controls overlay */}
      {showPlayback && (
        <div className="absolute left-0 top-full mt-1 z-50 w-[420px] shadow-xl">
          <PlaybackControls
            onClose={() => setShowPlayback(false)}
            onFrameChange={onFrameChange}
          />
        </div>
      )}
    </div>
  );
};

export default SessionPlaybackPanel;
export { RecordingBadge, PlaybackControls };
