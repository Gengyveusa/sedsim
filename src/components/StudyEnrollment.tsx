/**
 * src/components/StudyEnrollment.tsx
 * Enrollment UI for the A/B crossover study.
 * Handles: anonymized ID generation, informed consent, arm assignment display.
 */

import { useState } from 'react';
import useStudyStore from '../store/useStudyStore';
import { STUDY_ARMS } from '../ai/studyArms';
import type { StudyArmId } from '../ai/studyArms';

function generateSuggestedId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'P-';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export default function StudyEnrollment() {
  const {
    isEnrolled,
    consentGiven,
    learnerId,
    armSequence,
    currentArmIndex,
    enroll,
    giveConsent,
    assignArms,
    studyPhase,
  } = useStudyStore();

  const [inputId, setInputId] = useState(() => generateSuggestedId());
  const [consentChecked, setConsentChecked] = useState(false);

  // Step 1: ID entry
  if (!isEnrolled) {
    return (
      <div className="max-w-md mx-auto p-6 bg-gray-900 rounded-xl border border-gray-700">
        <h2 className="text-lg font-bold text-white mb-1">SedSim Research Study</h2>
        <p className="text-xs text-gray-400 mb-4">
          Prospective, randomized, within-subjects crossover trial comparing three AI
          teaching approaches for procedural sedation education.
        </p>

        <label htmlFor="learner-id" className="block text-sm text-gray-300 mb-1 font-medium">
          Participant ID (anonymized)
        </label>
        <div className="flex gap-2 mb-2">
          <input
            id="learner-id"
            type="text"
            value={inputId}
            onChange={(e) => setInputId(e.target.value.toUpperCase())}
            placeholder="P-XXXXXX"
            className="flex-1 bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
            maxLength={12}
          />
          <button
            onClick={() => setInputId(generateSuggestedId())}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs"
            title="Generate new random ID"
          >
            Randomize
          </button>
        </div>
        <p className="text-[10px] text-gray-500 mb-4">
          No personal information is collected. This ID links your sessions anonymously.
        </p>

        <button
          onClick={() => enroll(inputId)}
          disabled={!inputId.trim()}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-semibold text-sm transition-colors"
        >
          Continue to Consent
        </button>
      </div>
    );
  }

  // Step 2: Informed consent
  if (!consentGiven) {
    return (
      <div className="max-w-md mx-auto p-6 bg-gray-900 rounded-xl border border-gray-700">
        <h2 className="text-lg font-bold text-white mb-1">Informed Consent</h2>
        <p className="text-xs text-gray-400 mb-1">Participant: <span className="font-mono text-gray-300">{learnerId}</span></p>

        <div className="bg-gray-800 rounded p-3 text-xs text-gray-300 mb-4 max-h-48 overflow-y-auto space-y-2 border border-gray-700">
          <p><strong>Purpose:</strong> This educational study compares three AI-assisted teaching methods for procedural sedation. You will complete three simulation sessions, each with a different AI teaching approach.</p>
          <p><strong>Procedure:</strong> For each of the three arms, you will: (1) complete a 5-question pre-test, (2) participate in a simulation session with a specific AI teaching mode, and (3) complete a 5-question post-test.</p>
          <p><strong>Data collected:</strong> All data is anonymized and stored locally in your browser. We record: simulation interactions (drug doses, interventions, vital sign responses), AI conversation content, test answers, and timing data. No personally identifiable information is collected.</p>
          <p><strong>Privacy:</strong> Data never leaves your device unless you explicitly export it. Your participant ID cannot be linked to your identity.</p>
          <p><strong>Voluntary:</strong> Participation is voluntary. You may withdraw at any time by closing the browser or disabling Research Mode.</p>
          <p><strong>Benefit:</strong> You will experience three distinct AI teaching methodologies and receive feedback on your procedural sedation knowledge.</p>
        </div>

        <label className="flex items-start gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-0.5 accent-blue-500"
          />
          <span className="text-xs text-gray-300">
            I understand the above and consent to participate in this educational study.
          </span>
        </label>

        <button
          onClick={() => {
            giveConsent();
            assignArms();
          }}
          disabled={!consentChecked}
          className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-semibold text-sm transition-colors"
        >
          I Consent — Begin Study
        </button>
      </div>
    );
  }

  // Step 3: Show arm assignment and progress (visible during study)
  if (studyPhase === 'study_complete') {
    return (
      <div className="max-w-md mx-auto p-6 bg-gray-900 rounded-xl border border-green-700">
        <h2 className="text-lg font-bold text-green-400 mb-2">Study Complete</h2>
        <p className="text-xs text-gray-300 mb-4">
          Thank you for participating! You have completed all three study arms.
          Visit the Study Dashboard to review your results and export data.
        </p>
        <ArmProgressDisplay sequence={armSequence} currentIndex={armSequence.length} />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 bg-gray-900 rounded-xl border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-white">Research Study Active</h3>
          <p className="text-[10px] text-gray-500 font-mono">{learnerId}</p>
        </div>
        <span className="text-xs bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded border border-blue-600/50">
          Arm {currentArmIndex + 1}/3
        </span>
      </div>
      <ArmProgressDisplay sequence={armSequence} currentIndex={currentArmIndex} />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ArmProgressDisplay({ sequence, currentIndex }: { sequence: StudyArmId[]; currentIndex: number }) {
  return (
    <div className="space-y-1.5">
      {sequence.map((arm, idx) => {
        const def = STUDY_ARMS[arm];
        const isComplete = idx < currentIndex;
        const isCurrent = idx === currentIndex;
        return (
          <div
            key={idx}
            className={`flex items-center gap-2 px-3 py-2 rounded text-xs border ${
              isComplete
                ? 'bg-green-900/30 border-green-700/50 text-green-300'
                : isCurrent
                ? 'bg-blue-900/30 border-blue-700/50 text-blue-300'
                : 'bg-gray-800/50 border-gray-700/50 text-gray-500'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              isComplete ? 'bg-green-600 text-white' : isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-500'
            }`}>
              {isComplete ? '\u2713' : idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-semibold">Arm {arm}: </span>
              <span className="text-gray-400">{def.shortDescription}</span>
            </div>
            {isCurrent && (
              <span className="text-[9px] bg-blue-600/40 text-blue-300 px-1.5 py-0.5 rounded animate-pulse">
                ACTIVE
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
