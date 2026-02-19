/**
 * src/components/TutorialOverlay.tsx
 * Step-by-step tutorial overlay with progress tracking.
 * Uses the TutorialEngine state machine from src/ai/tutorialEngine.ts.
 * Tutorial state is persisted to localStorage so users can resume.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { tutorialEngine } from '../ai/tutorialEngine';
import { TutorialState } from '../types';

interface TutorialOverlayProps {
  onClose: () => void;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onClose }) => {
  const [engineState, setEngineState] = useState<TutorialState>(tutorialEngine.getState());
  const [showTrackPicker, setShowTrackPicker] = useState(!tutorialEngine.getState().isActive);

  const refresh = useCallback(() => {
    setEngineState(tutorialEngine.getState());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleStart = (track: TutorialState['track'], level: TutorialState['learnerLevel']) => {
    tutorialEngine.start(track, level);
    setShowTrackPicker(false);
    refresh();
  };

  const handleNext = () => {
    tutorialEngine.nextStep();
    refresh();
    if (tutorialEngine.isComplete()) {
      setTimeout(onClose, 800);
    }
  };

  const handlePrev = () => {
    tutorialEngine.prevStep();
    refresh();
  };

  const handleClose = () => {
    tutorialEngine.end();
    onClose();
  };

  const handleResume = () => {
    tutorialEngine.resume();
    setShowTrackPicker(false);
    refresh();
  };

  const currentStep = tutorialEngine.getCurrentStep();
  const totalSteps = tutorialEngine.getTotalSteps();
  const progress = tutorialEngine.getProgress();
  const isComplete = tutorialEngine.isComplete();

  // Track picker (initial screen)
  if (showTrackPicker) {
    const persisted = tutorialEngine.getState();
    const hasProgress = persisted.completedSteps.length > 0;

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-white text-lg font-bold flex items-center gap-2">
              <span>🎓</span> SedSim Tutorial
            </h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
          </div>

          <p className="text-gray-400 text-sm">
            Choose your learning path. Tutorial progress is saved automatically.
          </p>

          {/* Resume option */}
          {hasProgress && (
            <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3">
              <div className="text-blue-300 text-sm font-semibold mb-1">Resume Previous Session</div>
              <div className="text-gray-400 text-xs mb-2">
                Track: <span className="text-white capitalize">{persisted.track.replace('_', ' ')}</span> —{' '}
                Step {persisted.currentStepIndex + 1} / {tutorialEngine.getTotalSteps()}
              </div>
              <button
                onClick={handleResume}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Resume Tutorial
              </button>
            </div>
          )}

          {/* Learner level */}
          <div>
            <div className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Your experience level</div>
            <div className="grid grid-cols-3 gap-2">
              {(['novice', 'intermediate', 'advanced'] as TutorialState['learnerLevel'][]).map((level) => (
                <button
                  key={level}
                  onClick={() => handleStart('quick_start', level)}
                  className="py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-blue-500 text-gray-300 rounded-lg text-xs capitalize transition-colors"
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Track selection */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="border border-gray-700 hover:border-cyan-500 rounded-lg p-4 cursor-pointer transition-all group"
              onClick={() => handleStart('quick_start', persisted.learnerLevel)}
            >
              <div className="text-cyan-400 font-bold mb-1 group-hover:text-cyan-300">⚡ Quick Start</div>
              <div className="text-gray-400 text-xs">5 steps · ~5 minutes</div>
              <div className="text-gray-500 text-[10px] mt-2">Patient setup, drug administration, vital signs, EEG, and the AI Mentor.</div>
            </div>
            <div
              className="border border-gray-700 hover:border-purple-500 rounded-lg p-4 cursor-pointer transition-all group"
              onClick={() => handleStart('deep_dive', persisted.learnerLevel)}
            >
              <div className="text-purple-400 font-bold mb-1 group-hover:text-purple-300">🔬 Deep Dive</div>
              <div className="text-gray-400 text-xs">12 steps · ~15 minutes</div>
              <div className="text-gray-500 text-[10px] mt-2">Full PK/PD pharmacology, infusions, airway management, ghost dose, scenarios, and debrief.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Completion screen
  if (isComplete) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
        <div className="bg-gray-900 border border-green-700/50 rounded-xl shadow-2xl max-w-md w-full p-6 text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h2 className="text-white text-xl font-bold">Tutorial Complete!</h2>
          <p className="text-gray-400 text-sm">
            You've completed the {engineState.track === 'quick_start' ? 'Quick Start' : 'Deep Dive'} tutorial.
            You're ready to manage procedural sedation in SedSim.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setShowTrackPicker(true); }}
              className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              Choose Another Track
            </button>
            <button
              onClick={handleClose}
              className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Start Simulating
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentStep) return null;

  const adaptedContent = tutorialEngine.getAdaptedContent(currentStep);
  const trackColor = engineState.track === 'quick_start' ? 'cyan' : 'purple';
  const borderClass = trackColor === 'cyan' ? 'border-cyan-700/60' : 'border-purple-700/60';
  const innerBorderClass = trackColor === 'cyan' ? 'border-cyan-800/40' : 'border-purple-800/40';
  const btnClass = trackColor === 'cyan'
    ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
    : 'bg-purple-600 hover:bg-purple-500 text-white';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60] p-4">
      <div className={`bg-gray-900 border ${borderClass} rounded-xl shadow-2xl max-w-lg w-full`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${innerBorderClass}`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{engineState.track === 'quick_start' ? '⚡' : '🔬'}</span>
            <div>
              <div className="text-white text-sm font-bold">{currentStep.title}</div>
              <div className="text-gray-500 text-[10px]">
                Step {engineState.currentStepIndex + 1} of {totalSteps}
              </div>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-800">
          <div
            className={`h-full transition-all duration-300 ${trackColor === 'cyan' ? 'bg-cyan-500' : 'bg-purple-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <p className="text-gray-300 text-sm leading-relaxed">{adaptedContent}</p>

          {currentStep.completionHint && (
            <div className="bg-gray-800/60 rounded-lg px-3 py-2 text-[11px] text-gray-400 flex items-start gap-2">
              <span className="text-yellow-400 mt-0.5">💡</span>
              <span>{currentStep.completionHint}</span>
            </div>
          )}

          {/* Target element indicator */}
          {currentStep.targetElement && (
            <div className="text-[10px] text-gray-500 flex items-center gap-1">
              <span>🎯</span>
              <span>Look for: <code className="text-gray-400">{currentStep.targetElement}</code></span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={() => { setShowTrackPicker(true); }}
            className="text-gray-500 hover:text-gray-300 text-xs px-2 py-1 rounded transition-colors"
          >
            ‹ Tracks
          </button>
          <div className="flex-1" />
          {engineState.currentStepIndex > 0 && (
            <button
              onClick={handlePrev}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-colors"
            >
              ← Prev
            </button>
          )}
          <button
            onClick={handleNext}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${btnClass}`}
          >
            {engineState.currentStepIndex >= totalSteps - 1 ? 'Finish ✓' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
