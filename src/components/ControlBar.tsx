import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import useSimStore from '../store/useSimStore';
import { conductorInstance } from '../engine/conductor/conductorInstance';
import { audioManager } from '../utils/audio';
import SessionPlaybackPanel from './SessionPlaybackPanel';
const SPEED_OPTIONS = [0.5, 1, 2, 5, 10];

export default  function ControlBar() {
  const { t } = useTranslation();
  const { isRunning, speedMultiplier, elapsedSeconds, toggleRunning, reset, setSpeed, isScenarioActive } = useSimStore(
    useShallow(s => ({
      isRunning: s.isRunning,
      speedMultiplier: s.speedMultiplier,
      elapsedSeconds: s.elapsedSeconds,
      toggleRunning: s.toggleRunning,
      reset: s.reset,
      setSpeed: s.setSpeed,
      isScenarioActive: s.isScenarioActive,
    }))
  );
  const [isMuted, setIsMuted] = useState(false);
  const [silenceRemaining, setSilenceRemaining] = useState(0);
  const [breathEnabled, setBreathEnabled] = useState(false);
  const [heartEnabled, setHeartEnabled] = useState(false);

  // Tick down the silence countdown display every second
  useEffect(() => {
    if (silenceRemaining <= 0) return;
    const iv = setInterval(() => {
      const remaining = Math.ceil(audioManager.getSilenceRemaining() / 1000);
      setSilenceRemaining(remaining);
      if (remaining <= 0) clearInterval(iv);
    }, 500);
    return () => clearInterval(iv);
  }, [silenceRemaining]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (!isRunning) {
      // Starting — resume AudioContext on this user gesture (browser autoplay policy).
      audioManager.resume();
    } else {
      // Pausing — suspend AudioContext to free resources while the sim is idle.
      audioManager.suspend();
    }
    toggleRunning();
  };

  const handleReset = () => {
    audioManager.suspend();
    if (isScenarioActive) {
      conductorInstance.stop();
    }
    reset();
  };

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audioManager.setMuted(newMuted);
  };

  const handleSilenceAlarms = () => {
    audioManager.silenceAlarms(60000);
    setSilenceRemaining(60);
  };

  const handleBreathToggle = () => {
    const next = !breathEnabled;
    setBreathEnabled(next);
    audioManager.setBreathSoundsEnabled(next);
  };

  const handleHeartToggle = () => {
    const next = !heartEnabled;
    setHeartEnabled(next);
    audioManager.setHeartSoundsEnabled(next);
  };

  return (
    <div className="bg-sim-panel border-b border-gray-700 px-4 py-2 flex items-center gap-4">
      <div className="flex items-center gap-2">
        <button
          data-sim-id="play-button"
          onClick={handlePlayPause}
          aria-label={isRunning ? 'Pause simulation' : 'Play simulation'}
          aria-pressed={isRunning}
          className={`px-4 py-1.5 rounded font-medium text-sm ${
            isRunning
              ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isRunning ? t('controlBar.pause') : t('controlBar.play')}
        </button>
        <button
          data-sim-id="reset-button"
          onClick={handleReset}
          aria-label="Reset simulation"
          className="px-4 py-1.5 rounded font-medium text-sm bg-red-600 hover:bg-red-700 text-white"
        >
          Reset
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-400" id="speed-label">{t('common.speed')}</span>
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            data-sim-id={`speed-${s}x`}
            onClick={() => setSpeed(s)}
            aria-label={`Set simulation speed to ${s}x`}
            aria-pressed={speedMultiplier === s}
            className={`px-2 py-1 rounded text-xs ${
              speedMultiplier === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Audio controls */}
      <div className="flex items-center gap-2">
        <button
          data-sim-id="mute-button"
          onClick={handleMuteToggle}
          title={isMuted ? t('controlBar.unmuteAudio') : t('controlBar.muteAudio')}
          aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          aria-pressed={isMuted}
          className={`px-2 py-1.5 rounded text-sm font-medium transition-colors ${
            isMuted
              ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
        >
          <span aria-hidden="true">{isMuted ? '🔇' : '🔊'}</span>
        </button>
        <button
          data-sim-id="silence-alarms-button"
          onClick={handleSilenceAlarms}
          title={t('controlBar.silenceAlarms')}
          aria-label={silenceRemaining > 0 ? `Alarms silenced, ${silenceRemaining} seconds remaining` : 'Silence alarms for 60 seconds'}
          aria-pressed={silenceRemaining > 0}
          className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
            silenceRemaining > 0
              ? 'bg-amber-700 text-amber-200'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <span aria-hidden="true">{silenceRemaining > 0 ? `🔕 ${silenceRemaining}s` : '🔕'}</span>
        </button>
        <button
          data-sim-id="breath-sounds-button"
          onClick={handleBreathToggle}
          title={breathEnabled ? t('controlBar.disableBreath') : t('controlBar.enableBreath')}
          aria-label={breathEnabled ? 'Disable breath sounds' : 'Enable breath sounds'}
          aria-pressed={breathEnabled}
          className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
            breathEnabled
              ? 'bg-teal-700 text-teal-200 hover:bg-teal-600'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >
          <span aria-hidden="true">🫁</span>
        </button>
        <button
          data-sim-id="heart-sounds-button"
          onClick={handleHeartToggle}
          title={heartEnabled ? t('controlBar.disableHeart') : t('controlBar.enableHeart')}
          aria-label={heartEnabled ? 'Disable heart sounds' : 'Enable heart sounds'}
          aria-pressed={heartEnabled}
          className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
            heartEnabled
              ? 'bg-rose-700 text-rose-200 hover:bg-rose-600'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >
          <span aria-hidden="true">❤️</span>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-4 text-sm">
        {/* Session recording/playback controls */}
        <div className="relative flex items-center">
          <SessionPlaybackPanel />
        </div>
        <div className="text-gray-300">
          <span className="text-gray-500">{t('common.elapsed')} </span>
          <span className="font-mono text-lg" aria-live="off">{formatTime(elapsedSeconds)}</span>
        </div>
        <div
          className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}
          role="status"
          aria-label={isRunning ? 'Simulation running' : 'Simulation paused'}
        />
      </div>
    </div>
  );
}
