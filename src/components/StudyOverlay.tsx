/**
 * src/components/StudyOverlay.tsx
 * Main study flow orchestrator that overlays on the sim when in research mode.
 * Manages the enrollment -> pretest -> simulation -> posttest -> next arm cycle.
 */

import { useCallback } from 'react';
import useStudyStore from '../store/useStudyStore';
import { analyticsEngine } from '../engine/analytics';
import StudyEnrollment from './StudyEnrollment';
import TestFramework from './TestFramework';
import StudyDashboard from './StudyDashboard';

export default function StudyOverlay() {
  const {
    researchMode,
    studyPhase,
    isEnrolled,
    consentGiven,
    learnerId,
    currentArm,
    currentArmIndex,
    currentPretestScore,
    currentPosttestScore,
    setPretestScore,
    setPosttestScore,
    setStudyPhase,
    completeArm,
    advanceToNextArm,
  } = useStudyStore();

  if (!researchMode) return null;

  // Enrollment phase
  if (!isEnrolled || !consentGiven || studyPhase === 'enrollment') {
    return (
      <StudyModal>
        <StudyEnrollment />
      </StudyModal>
    );
  }

  // Pre-test phase
  if (studyPhase === 'pretest') {
    return (
      <StudyModal>
        <TestFramework
          testSetIndex={currentArmIndex}
          mode="pretest"
          onComplete={(score) => {
            setPretestScore(score);
            // Start analytics session for this arm
            if (currentArm) {
              analyticsEngine.startSession(learnerId, currentArm, `arm_${currentArm}`);
              analyticsEngine.setPretestScore(score);
            }
            setStudyPhase('simulation');
          }}
        />
      </StudyModal>
    );
  }

  // Post-test phase
  if (studyPhase === 'posttest') {
    return (
      <StudyModal>
        <TestFramework
          testSetIndex={currentArmIndex}
          mode="posttest"
          onComplete={(score) => {
            setPosttestScore(score);
            analyticsEngine.setPosttestScore(score);
            const summary = analyticsEngine.endSession();
            completeArm({
              pretestScore: currentPretestScore,
              posttestScore: score,
              scenarioScore: summary.scenarioScore,
              duration_s: summary.duration_s,
              sessionId: summary.sessionId,
            });
          }}
        />
      </StudyModal>
    );
  }

  // Arm complete — show results and advance
  if (studyPhase === 'arm_complete') {
    return (
      <StudyModal>
        <ArmCompleteView
          arm={currentArm ?? 'A'}
          pretestScore={currentPretestScore}
          posttestScore={currentPosttestScore}
          onAdvance={advanceToNextArm}
        />
      </StudyModal>
    );
  }

  // Study complete
  if (studyPhase === 'study_complete') {
    return (
      <StudyModal>
        <StudyDashboard />
      </StudyModal>
    );
  }

  // Simulation phase — show a minimal floating indicator, don't overlay the sim
  if (studyPhase === 'simulation') {
    return <SimulationStudyBar />;
  }

  return null;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StudyModal({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function SimulationStudyBar() {
  const currentArm = useStudyStore(s => s.currentArm);
  const currentArmIndex = useStudyStore(s => s.currentArmIndex);
  const setStudyPhase = useStudyStore(s => s.setStudyPhase);

  const handleEndSession = useCallback(() => {
    setStudyPhase('posttest');
  }, [setStudyPhase]);

  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 z-50 bg-indigo-900/90 border border-indigo-600/50 rounded-b-lg px-4 py-1.5 flex items-center gap-3 backdrop-blur-sm shadow-lg">
      <span className="text-[10px] text-indigo-300 uppercase tracking-wider font-bold">
        Research Mode
      </span>
      <span className="text-xs text-white font-mono">
        Arm {currentArm} ({currentArmIndex + 1}/3)
      </span>
      <button
        onClick={handleEndSession}
        className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-0.5 rounded transition-colors"
      >
        End Session
      </button>
    </div>
  );
}

function ArmCompleteView({
  arm,
  pretestScore,
  posttestScore,
  onAdvance,
}: {
  arm: string;
  pretestScore: number;
  posttestScore: number;
  onAdvance: () => void;
}) {
  const change = posttestScore - pretestScore;
  return (
    <div className="max-w-md mx-auto p-6 bg-gray-900 rounded-xl border border-gray-700 text-center">
      <h2 className="text-lg font-bold text-white mb-2">Arm {arm} Complete</h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-800 rounded p-3 border border-gray-700">
          <p className="text-[10px] text-gray-500 uppercase">Pre-test</p>
          <p className="text-2xl font-bold text-white">{pretestScore}/5</p>
        </div>
        <div className="bg-gray-800 rounded p-3 border border-gray-700">
          <p className="text-[10px] text-gray-500 uppercase">Post-test</p>
          <p className="text-2xl font-bold text-white">{posttestScore}/5</p>
        </div>
      </div>

      <p className={`text-sm font-semibold mb-4 ${
        change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-400'
      }`}>
        {change > 0 ? `+${change} improvement` : change < 0 ? `${change} decline` : 'No change'}
      </p>

      <button
        onClick={onAdvance}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold text-sm transition-colors"
      >
        Continue to Next Arm
      </button>
    </div>
  );
}
