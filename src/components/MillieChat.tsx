// src/components/MillieChat.tsx
// Structured Millie chat — replaces flat-text MentorChat.
// Renders StructuredMessage objects from useAIStore with type-specific visual treatments.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { generateMentorResponse, getSuggestedQuestions, autoObserve } from '../ai/mentor';
import { MILLIE_NAME } from '../ai/milliePrompt';
import { Vitals, MOASSLevel, LogEntry } from '../types';
import { EEGState } from '../engine/eegModel';
import { DigitalTwin } from '../engine/digitalTwin';
import useSimStore from '../store/useSimStore';
import useAIStore from '../store/useAIStore';
import { conductorInstance } from '../engine/conductor/conductorInstance';
import GhostDosePreview from './GhostDosePreview';
import { ScenarioPanel } from './ScenarioPanel';
import ScenarioTimeline from './ScenarioTimeline';
import MillieAvatar from './MillieAvatar';
import ScoreBreakdown from './ScoreBreakdown';
import type { StructuredMessage, MillieEmotion } from '../engine/conductor/types';

interface MillieChatProps {
  vitals: Vitals;
  moass: MOASSLevel;
  eegState: EEGState | null;
  digitalTwin: DigitalTwin | null;
  eventLog: LogEntry[];
  pkStates: Record<string, { ce: number }>;
  isOpen: boolean;
  onToggle: () => void;
}

// ─── Emotion left-border colours ─────────────────────────────────────────────
const EMOTION_BORDER: Record<MillieEmotion, string> = {
  neutral:     'border-l-blue-500',
  concerned:   'border-l-amber-500',
  urgent:      'border-l-red-500',
  encouraging: 'border-l-emerald-500',
  thinking:    'border-l-purple-500',
};

// ─── Typing indicator ─────────────────────────────────────────────────────────
const TypingDots: React.FC = () => (
  <div className="flex items-center gap-1 px-3 py-2">
    {[0, 1, 2].map(i => (
      <span
        key={i}
        className="w-1.5 h-1.5 rounded-full bg-blue-400"
        style={{ animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
      />
    ))}
    <style>{`
      @keyframes typing-dot {
        0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
        40% { opacity: 1; transform: scale(1); }
      }
    `}</style>
  </div>
);

// ─── Message renderers ────────────────────────────────────────────────────────

interface MsgProps {
  msg: StructuredMessage;
  onCalloutClick?: (targetId: string) => void;
}

const NarrationMessage: React.FC<MsgProps> = ({ msg }) => {
  const emotion = msg.emotion ?? 'neutral';
  const borderColor = EMOTION_BORDER[emotion];
  return (
    <div className="flex items-start gap-2">
      <MillieAvatar emotion={emotion} size={36} />
      <div className={`flex-1 bg-gray-800/80 border-l-2 ${borderColor} rounded-r-lg px-3 py-2 text-xs text-gray-200`}>
        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
      </div>
    </div>
  );
};

const CalloutLinkMessage: React.FC<MsgProps> = ({ msg, onCalloutClick }) => {
  const targetId = msg.callout?.targetId;
  return (
    <div className="flex items-start gap-2">
      <MillieAvatar emotion={msg.emotion ?? 'concerned'} size={36} />
      <button
        className="flex-1 bg-amber-900/40 border border-amber-600/50 hover:bg-amber-900/60 rounded-lg px-3 py-2 text-xs text-amber-200 text-left transition-colors"
        onClick={() => targetId && onCalloutClick?.(targetId)}
        title={targetId ? `Highlight: ${targetId}` : undefined}
      >
        <span className="mr-1">🔍</span>
        <span className="whitespace-pre-wrap leading-relaxed">{msg.content}</span>
        {targetId && (
          <span className="ml-1 text-amber-400 text-[10px] underline">→ view</span>
        )}
      </button>
    </div>
  );
};

const VitalBadgeMessage: React.FC<MsgProps> = ({ msg }) => {
  const ann = msg.vitalAnnotation;
  if (!ann) return <NarrationMessage msg={msg} />;

  const severityColors = {
    normal:   'bg-emerald-900/60 text-emerald-200 border-emerald-600/50',
    warning:  'bg-amber-900/60 text-amber-200 border-amber-600/50',
    danger:   'bg-red-900/60 text-red-200 border-red-600/50',
    critical: 'bg-red-950/80 text-red-100 border-red-400/80',
  };

  return (
    <div className="flex items-start gap-2">
      <MillieAvatar emotion={msg.emotion ?? 'concerned'} size={36} />
      <div className="flex-1 bg-gray-800/80 border-l-2 border-l-amber-500 rounded-r-lg px-3 py-2 text-xs text-gray-200 space-y-1">
        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${severityColors[ann.severity]}`}>
          <span className="font-mono font-bold">{ann.value}</span>
          <span>{ann.label}</span>
        </div>
      </div>
    </div>
  );
};

const TeachingPointMessage: React.FC<MsgProps> = ({ msg }) => (
  <div className="bg-blue-950/60 border border-blue-700/60 rounded-lg px-3 py-2 text-xs text-blue-100 space-y-1">
    <div className="flex items-center gap-1.5 text-blue-300 font-semibold text-[10px]">
      <span>📖</span>
      <span>Teaching Point</span>
    </div>
    <p className="whitespace-pre-wrap leading-relaxed text-blue-100">{msg.content}</p>
  </div>
);

const PhaseChangeMessage: React.FC<MsgProps> = ({ msg }) => (
  <div className="flex items-center gap-2 py-1">
    <div className="flex-1 h-px bg-cyan-800/60" />
    <span className="text-[10px] font-semibold text-cyan-400 whitespace-nowrap px-2">
      {msg.phaseLabel ?? msg.content}
    </span>
    <div className="flex-1 h-px bg-cyan-800/60" />
  </div>
);

const FeedbackMessage: React.FC<MsgProps> = ({ msg }) => {
  const isCorrect = msg.isCorrect !== false; // default to correct if unset
  return (
    <div className={`rounded-lg px-3 py-2 text-xs space-y-1 ${
      isCorrect
        ? 'bg-emerald-900/50 border border-emerald-600/50 text-emerald-100'
        : 'bg-red-900/50 border border-red-600/50 text-red-100'
    }`}>
      <div className="flex items-center gap-1.5 font-semibold text-[10px]">
        {isCorrect ? <span>✅</span> : <span>❌</span>}
        <span>{isCorrect ? 'Correct!' : 'Not quite…'}</span>
      </div>
      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
    </div>
  );
};

const DebriefMessage: React.FC<MsgProps> = ({ msg }) => (
  <div className="bg-gray-800/90 border border-gray-600 rounded-lg px-3 py-3 text-xs space-y-2">
    <div className="flex items-center gap-2 text-white font-semibold">
      <span>🏁</span>
      <span>Scenario Complete</span>
      {msg.score !== undefined && (
        <span className="ml-auto text-cyan-400 font-mono text-sm">{msg.score}/100</span>
      )}
    </div>
    <p className="whitespace-pre-wrap leading-relaxed text-gray-200">{msg.content}</p>
  </div>
);

const UserMessage: React.FC<{ msg: StructuredMessage }> = ({ msg }) => (
  <div className="flex justify-end">
    <div className="max-w-[85%] bg-blue-600/30 text-blue-100 rounded-lg px-3 py-2 text-xs">
      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
    </div>
  </div>
);

// ─── Dispatcher ───────────────────────────────────────────────────────────────
const MessageRenderer: React.FC<{ msg: StructuredMessage; onCalloutClick?: (id: string) => void }> = ({
  msg,
  onCalloutClick,
}) => {
  if (msg.role === 'user') return <UserMessage msg={msg} />;

  if (msg.typing) {
    return (
      <div className="flex items-start gap-2">
        <MillieAvatar emotion={msg.emotion ?? 'thinking'} size={36} />
        <div className="bg-gray-800/80 border-l-2 border-l-purple-500 rounded-r-lg">
          <TypingDots />
        </div>
      </div>
    );
  }

  switch (msg.messageType) {
    case 'callout_link':    return <CalloutLinkMessage msg={msg} onCalloutClick={onCalloutClick} />;
    case 'vital_badge':     return <VitalBadgeMessage msg={msg} />;
    case 'teaching_point':  return <TeachingPointMessage msg={msg} />;
    case 'phase_change':    return <PhaseChangeMessage msg={msg} />;
    case 'feedback':        return <FeedbackMessage msg={msg} />;
    case 'debrief':         return <DebriefMessage msg={msg} />;
    case 'narration':
    default:                return <NarrationMessage msg={msg} />;
  }
};

// ─── Main MillieChat component ────────────────────────────────────────────────

const DEDUPLICATION_WINDOW_MS = 60000;
const normalize = (s: string) => s.replace(/\d+/g, '#');

const WELCOME_MSG: StructuredMessage = {
  id: 'welcome',
  role: 'millie',
  messageType: 'narration',
  emotion: 'encouraging',
  content: `Hi! I'm ${MILLIE_NAME}, your AI sedation mentor — your virtual attending anesthesiologist. Start the simulation, administer drugs, and I'll provide real-time clinical guidance. Ask me anything below, or use the Ghost Dose panel to preview drug effects before committing.`,
  timestamp: Date.now(),
};

const MillieChat: React.FC<MillieChatProps> = ({
  vitals, moass, eegState, digitalTwin, eventLog, pkStates, isOpen, onToggle,
}) => {
  // Legacy messages (free-text Q&A) - kept for potential future use, not currently displayed
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showGhost, setShowGhost] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string>('');
  const [numericAnswer, setNumericAnswer] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastObservationTimeRef = useRef<number>(0);
  const lastAutoObsRef = useRef<{ content: string; time: number }>({ content: '', time: 0 });

  // Structured messages from store
  const structuredMessages = useAIStore(s => s.structuredMessages);
  const addStructuredMessage = useAIStore(s => s.addStructuredMessage);
  const setActiveHighlights = useAIStore(s => s.setActiveHighlights);

  // Scenario state
  const currentQuestion = useAIStore(s => s.currentQuestion);
  const isScenarioRunning = useAIStore(s => s.isScenarioRunning);
  const mentorMessages = useAIStore(s => s.mentorMessages);
  const pendingContinue = useAIStore(s => s.pendingContinue);

  // Auto-advance countdown
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pendingContinue && !currentQuestion) {
      setAutoAdvanceCountdown(8);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        setAutoAdvanceCountdown(prev => {
          if (prev === null || prev <= 1) {
            if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
      setAutoAdvanceCountdown(null);
    }
    return () => {
      if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    };
  }, [pendingContinue, currentQuestion]);

  // Sync legacy mentor messages from store into structured messages
  const lastSyncedIdxRef = useRef<number>(0);
  useEffect(() => {
    if (mentorMessages.length > lastSyncedIdxRef.current) {
      const newMsgs = mentorMessages.slice(lastSyncedIdxRef.current);
      lastSyncedIdxRef.current = mentorMessages.length;
      newMsgs.forEach(m => {
        addStructuredMessage({
          id: `mentor-${Date.now()}-${Math.random()}`,
          role: m.role === 'user' ? 'user' : 'millie',
          messageType: 'narration',
          content: m.content,
          timestamp: Date.now(),
        });
      });
    }
  }, [mentorMessages, addStructuredMessage]);

  useEffect(() => {
    if (!isScenarioRunning) {
      lastSyncedIdxRef.current = mentorMessages.length;
    }
  }, [isScenarioRunning, mentorMessages.length]);

  useEffect(() => {
    if (isScenarioRunning) setShowScenarios(false);
  }, [isScenarioRunning]);

  const elapsedSeconds = useSimStore(s => s.elapsedSeconds);
  const isRunning = useSimStore(s => s.isRunning);

  // Auto-generate observations (legacy pathway)
  useEffect(() => {
    if (!isRunning) return;
    if (elapsedSeconds - lastObservationTimeRef.current < 30) return;
    lastObservationTimeRef.current = elapsedSeconds;
    const obs = autoObserve({ vitals, moass, eeg: eegState ?? undefined, pkStates, elapsedSeconds });
    if (obs) {
      const last = lastAutoObsRef.current;
      if (normalize(obs.content) === normalize(last.content) && (Date.now() - last.time) < DEDUPLICATION_WINDOW_MS) return;
      lastAutoObsRef.current = { content: obs.content, time: Date.now() };
      addStructuredMessage({
        id: `obs-${Date.now()}`,
        role: 'millie',
        messageType: 'narration',
        emotion: 'concerned',
        content: obs.content,
        timestamp: Date.now(),
      });
    }
  }, [elapsedSeconds, isRunning, vitals, moass, eegState, pkStates, addStructuredMessage]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [structuredMessages]);

  // Callout click handler
  const handleCalloutClick = useCallback((targetId: string) => {
    setActiveHighlights([{ targetId, text: '' }]);
  }, [setActiveHighlights]);

  // Send free-text question to Millie
  const handleSend = useCallback(async (query?: string) => {
    const text = query || input.trim();
    if (!text || isThinking) return;

    addStructuredMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    });
    setInput('');
    setIsThinking(true);

    // Show typing indicator
    const placeholderId = `stream-${Date.now()}`;
    addStructuredMessage({
      id: placeholderId,
      role: 'millie',
      messageType: 'narration',
      emotion: 'thinking',
      typing: true,
      content: '',
      timestamp: Date.now(),
    });

    try {
      const response = await generateMentorResponse(
        text,
        {
          twin: digitalTwin || undefined,
          vitals, moass,
          eeg: eegState || undefined,
          eventLog, pkStates,
          learnerLevel: 'intermediate',
        },
        (_chunk) => {
          // chunks arrive but we'll update via final response
        },
      );

      // Add the real response
      addStructuredMessage({
        id: `millie-${Date.now()}`,
        role: 'millie',
        messageType: 'narration',
        emotion: 'neutral',
        content: response.content,
        timestamp: Date.now(),
      });
    } catch {
      addStructuredMessage({
        id: `millie-err-${Date.now()}`,
        role: 'millie',
        messageType: 'narration',
        emotion: 'concerned',
        content: 'I encountered an error processing your question. Please try again.',
        timestamp: Date.now(),
      });
    }

    setIsThinking(false);
  }, [input, isThinking, digitalTwin, vitals, moass, eegState, eventLog, pkStates, addStructuredMessage]);

  const suggestedQuestions = getSuggestedQuestions(vitals, moass, eegState || undefined);

  // Scenario answer handler
  const handleAnswerSubmit = useCallback(() => {
    if (!currentQuestion) return;
    const q = currentQuestion.question;
    let answer: string | number;
    if (q.type === 'numeric_range') {
      answer = parseFloat(numericAnswer);
      if (isNaN(answer)) return;
    } else {
      answer = selectedChoice;
      if (!answer) return;
    }
    conductorInstance.answerQuestion(answer);
    setSelectedChoice('');
    setNumericAnswer('');
  }, [currentQuestion, selectedChoice, numericAnswer]);

  // All messages to display: structured messages + typing indicator for active send
  const allMessages = structuredMessages.length > 0
    ? structuredMessages
    : [WELCOME_MSG];

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-4 bottom-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg z-50 transition-all"
        title={`Open ${MILLIE_NAME}`}
      >
        <span className="text-lg" aria-label={MILLIE_NAME}>🎓</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Clinical Scenarios collapsible section */}
      <div className="border-b border-gray-800">
        <button
          onClick={() => setShowScenarios(v => !v)}
          className="w-full text-left text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 px-3 py-2 transition-colors"
        >
          <span>{showScenarios ? '▼' : '▶'}</span>
          <span>🎯 Clinical Scenarios</span>
        </button>
        {showScenarios && (
          <div className="px-3 pb-3 border border-gray-700 rounded-lg mx-3 mb-2">
            <ScenarioPanel />
          </div>
        )}
      </div>

      {/* Scenario Timeline (shown while scenario is running) */}
      {isScenarioRunning && <ScenarioTimeline />}

      {/* Score Breakdown (shown after scenario completes) */}
      {!isScenarioRunning && <ScoreBreakdown />}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {allMessages.map((msg) => (
          <MessageRenderer
            key={msg.id}
            msg={msg}
            onCalloutClick={handleCalloutClick}
          />
        ))}

        {/* Streaming typing indicator */}
        {isThinking && (
          <div className="flex items-start gap-2">
            <MillieAvatar emotion="thinking" size={36} />
            <div className="bg-gray-800/80 border-l-2 border-l-purple-500 rounded-r-lg">
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scenario Q&A Widget */}
      {currentQuestion && (
        <div className="mx-3 mb-2 bg-blue-950/70 border border-blue-700 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-blue-300">🎓 Millie's Question</p>
          <p className="text-xs text-white">{currentQuestion.question.prompt}</p>

          {currentQuestion.question.type === 'single_choice' && currentQuestion.question.options && (
            <div className="space-y-1">
              {currentQuestion.question.options.map(opt => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="scenario_choice"
                    value={opt}
                    checked={selectedChoice === opt}
                    onChange={() => setSelectedChoice(opt)}
                    className="accent-blue-400"
                  />
                  <span className={`text-xs ${selectedChoice === opt ? 'text-blue-300' : 'text-gray-300'} group-hover:text-white transition-colors`}>
                    {opt}
                  </span>
                </label>
              ))}
            </div>
          )}

          {currentQuestion.question.type === 'numeric_range' && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={numericAnswer}
                onChange={e => setNumericAnswer(e.target.value)}
                placeholder="Enter value…"
                className="w-32 bg-gray-800 border border-gray-600 focus:border-blue-500 text-white text-xs rounded px-2 py-1 focus:outline-none"
              />
              {currentQuestion.question.idealRange && (
                <span className="text-gray-500 text-[10px]">
                  (ideal: {currentQuestion.question.idealRange[0]}–{currentQuestion.question.idealRange[1]})
                </span>
              )}
            </div>
          )}

          <button
            onClick={handleAnswerSubmit}
            disabled={currentQuestion.question.type === 'numeric_range' ? !numericAnswer : !selectedChoice}
            className="w-full text-xs py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors font-semibold"
          >
            Submit Answer
          </button>
        </div>
      )}

      {/* Continue Button */}
      {pendingContinue && !currentQuestion && (
        <div className="mx-3 mb-2">
          <button
            onClick={() => { conductorInstance.continuePendingStep(); setAutoAdvanceCountdown(null); }}
            className="w-full text-sm py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
            style={{ animation: 'continue-pulse 1.5s ease-in-out infinite' }}
          >
            ▶ Next Step{autoAdvanceCountdown !== null ? ` (${autoAdvanceCountdown}s)` : ''}
          </button>
          <style>{`
            @keyframes continue-pulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(6,182,212,0.4); }
              50% { box-shadow: 0 0 0 8px rgba(6,182,212,0); }
            }
          `}</style>
        </div>
      )}

      {/* Ghost Dose Toggle */}
      <div className="px-3 py-1 border-t border-gray-800">
        <button
          onClick={() => setShowGhost(v => !v)}
          className="w-full text-left text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 py-1 transition-colors"
        >
          <span>{showGhost ? '▼' : '▶'}</span>
          <span>👻 Ghost Dose Preview</span>
        </button>
        {showGhost && <GhostDosePreview />}
      </div>

      {/* Suggested Questions */}
      <div className="px-3 py-2 border-t border-gray-800">
        <div className="flex flex-wrap gap-1">
          {suggestedQuestions.slice(0, 3).map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              disabled={isThinking}
              className="text-[9px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Millie..."
            className="flex-1 bg-gray-800 text-white text-xs rounded px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
            disabled={isThinking}
          />
          <button
            onClick={() => handleSend()}
            disabled={isThinking || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-xs px-3 py-2 rounded transition-colors"
          >
            {isThinking ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MillieChat;
