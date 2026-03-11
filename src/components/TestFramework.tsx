/**
 * src/components/TestFramework.tsx
 * Pre/post test UI for the A/B study protocol.
 * Renders MCQs from the question bank, records answers via analytics engine.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getTestSet } from '../engine/questionBank';
import type { StudyQuestion } from '../engine/questionBank';
import { analyticsEngine } from '../engine/analytics';
import useStudyStore from '../store/useStudyStore';
import type { TelemetryEventType } from '../engine/analytics';

interface TestFrameworkProps {
  /** Which test set to use (0, 1, or 2 — maps to arm rotation index). */
  testSetIndex: number;
  /** 'pretest' or 'posttest' — determines event type and completion behavior. */
  mode: 'pretest' | 'posttest';
  /** Called when all questions are answered. Receives score (0-5). */
  onComplete: (score: number) => void;
}

interface AnswerRecord {
  questionId: string;
  selectedIndex: number;
  correct: boolean;
  timeMs: number;
}

export default function TestFramework({ testSetIndex, mode, onComplete }: TestFrameworkProps) {
  const [questions] = useState<StudyQuestion[]>(() => getTestSet(testSetIndex));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const questionStartRef = useRef(0);

  const learnerId = useStudyStore(s => s.learnerId);
  const currentArm = useStudyStore(s => s.currentArm);

  const question = questions[currentIdx];
  const totalQuestions = questions.length;
  const score = answers.filter(a => a.correct).length;

  // Reset timer when question changes
  useEffect(() => {
    questionStartRef.current = Date.now();
    setSelectedOption(null);
    setShowFeedback(false);
  }, [currentIdx]);

  const handleSubmit = useCallback(() => {
    if (selectedOption === null || !question) return;

    const timeMs = Date.now() - questionStartRef.current;
    const correct = selectedOption === question.correctIndex;

    const record: AnswerRecord = {
      questionId: question.id,
      selectedIndex: selectedOption,
      correct,
      timeMs,
    };
    const newAnswers = [...answers, record];
    setAnswers(newAnswers);

    // Log to analytics
    const eventType: TelemetryEventType = mode === 'pretest' ? 'pretest_answer' : 'posttest_answer';
    if (analyticsEngine.active) {
      analyticsEngine.log({
        timestamp: analyticsEngine.elapsedMs,
        wallClock: new Date().toISOString(),
        eventType,
        scenarioId: `arm_${currentArm ?? 'unknown'}`,
        payload: {
          questionId: question.id,
          answer: selectedOption,
          correct,
          latency_ms: timeMs,
          difficulty: question.difficulty,
          topic: question.topic,
        },
      });
    }

    setShowFeedback(true);

    // Auto-advance after feedback display
    setTimeout(() => {
      if (currentIdx + 1 < totalQuestions) {
        setCurrentIdx(currentIdx + 1);
      } else {
        const finalScore = newAnswers.filter(a => a.correct).length;
        setIsComplete(true);
        onComplete(finalScore);
      }
    }, 2000);
  }, [selectedOption, question, answers, currentIdx, totalQuestions, mode, currentArm, onComplete]);

  if (!question) return null;

  if (isComplete) {
    return (
      <div className="max-w-lg mx-auto p-6 bg-gray-900 rounded-xl border border-gray-700 text-center">
        <h2 className="text-lg font-bold text-white mb-2">
          {mode === 'pretest' ? 'Pre-Test' : 'Post-Test'} Complete
        </h2>
        <div className="text-3xl font-bold mb-2">
          <span className={score >= 4 ? 'text-green-400' : score >= 3 ? 'text-yellow-400' : 'text-red-400'}>
            {score}
          </span>
          <span className="text-gray-500">/{totalQuestions}</span>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          {mode === 'pretest'
            ? 'Starting simulation session...'
            : 'Review your results in the Study Dashboard.'}
        </p>
        <div className="flex gap-1 justify-center">
          {answers.map((a, i) => (
            <span
              key={i}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                a.correct ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
              }`}
            >
              {a.correct ? '\u2713' : '\u2717'}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6 bg-gray-900 rounded-xl border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-white">
          {mode === 'pretest' ? 'Pre-Test' : 'Post-Test'}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-mono">{learnerId}</span>
          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
            {currentIdx + 1}/{totalQuestions}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-700 rounded-full mb-4">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${((currentIdx + (showFeedback ? 1 : 0)) / totalQuestions) * 100}%` }}
        />
      </div>

      {/* Difficulty badge */}
      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded mb-2 ${
        question.difficulty === 'basic'
          ? 'bg-green-900/40 text-green-400 border border-green-700/50'
          : question.difficulty === 'intermediate'
          ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-700/50'
          : 'bg-red-900/40 text-red-400 border border-red-700/50'
      }`}>
        {question.difficulty.toUpperCase()}
      </span>

      {/* Question stem */}
      <p className="text-sm text-white mb-4 leading-relaxed">{question.stem}</p>

      {/* Options */}
      <div className="space-y-2 mb-4">
        {question.options.map((opt, idx) => {
          const isSelected = selectedOption === idx;
          const isCorrect = idx === question.correctIndex;

          let borderClass = 'border-gray-700';
          let bgClass = 'bg-gray-800';
          let textClass = 'text-gray-300';

          if (showFeedback) {
            if (isCorrect) {
              borderClass = 'border-green-500';
              bgClass = 'bg-green-900/30';
              textClass = 'text-green-300';
            } else if (isSelected && !isCorrect) {
              borderClass = 'border-red-500';
              bgClass = 'bg-red-900/30';
              textClass = 'text-red-300';
            }
          } else if (isSelected) {
            borderClass = 'border-blue-500';
            bgClass = 'bg-blue-900/30';
            textClass = 'text-blue-300';
          }

          return (
            <button
              key={idx}
              onClick={() => !showFeedback && setSelectedOption(idx)}
              disabled={showFeedback}
              className={`w-full text-left px-3 py-2.5 rounded border ${borderClass} ${bgClass} ${textClass} text-xs transition-all hover:border-blue-500/50 disabled:hover:border-current`}
            >
              <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span>
              {opt}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {showFeedback && (
        <div className={`p-3 rounded border text-xs mb-3 ${
          selectedOption === question.correctIndex
            ? 'bg-green-900/20 border-green-700/50 text-green-300'
            : 'bg-red-900/20 border-red-700/50 text-red-300'
        }`}>
          <p className="font-semibold mb-1">
            {selectedOption === question.correctIndex ? 'Correct!' : 'Incorrect'}
          </p>
          <p className="text-gray-400">{question.explanation}</p>
        </div>
      )}

      {/* Submit button */}
      {!showFeedback && (
        <button
          onClick={handleSubmit}
          disabled={selectedOption === null}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-semibold text-sm transition-colors"
        >
          Submit Answer
        </button>
      )}
    </div>
  );
}
