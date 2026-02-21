// src/components/MentorChat.tsx
// AI Mentor Sidebar Chat Component — Claude API with streaming + offline fallback
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MentorMessage, generateMentorResponse, getSuggestedQuestions, autoObserve } from '../ai/mentor';
import { Vitals, MOASSLevel, LogEntry } from '../types';
import { EEGState } from '../engine/eegModel';
import { DigitalTwin } from '../engine/digitalTwin';
import useSimStore from '../store/useSimStore';
import useAIStore from '../store/useAIStore';
import { scenarioEngine } from '../engine/ScenarioEngine';
import GhostDosePreview from './GhostDosePreview';

interface MentorChatProps {
  vitals: Vitals;
  moass: MOASSLevel;
  eegState: EEGState | null;
  digitalTwin: DigitalTwin | null;
  eventLog: LogEntry[];
  pkStates: Record<string, { ce: number }>;
  isOpen: boolean;
  onToggle: () => void;
}

const WELCOME_MSG: MentorMessage = {
  role: 'mentor',
  content: 'Welcome to SedSim AI Mentor — your virtual attending anesthesiologist. Start the simulation, administer drugs, and I\'ll provide real-time clinical guidance. Ask me anything below, or use the Ghost Dose panel to preview drug effects before committing.',
  timestamp: Date.now(),
  confidence: 1.0,
};

const MentorChat: React.FC<MentorChatProps> = ({
  vitals, moass, eegState, digitalTwin, eventLog, pkStates, isOpen, onToggle
}) => {
  const [messages, setMessages] = useState<MentorMessage[]>([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showGhost, setShowGhost] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string>('');
  const [numericAnswer, setNumericAnswer] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastObservationTimeRef = useRef<number>(0);
  const lastAutoObsRef = useRef<{ content: string; time: number }>({ content: '', time: 0 });
  const streamingIdxRef = useRef<number | null>(null);

  // Scenario Q&A state from store
  const currentQuestion = useAIStore(s => s.currentQuestion);
  const isScenarioRunning = useAIStore(s => s.isScenarioRunning);
  const mentorMessages = useAIStore(s => s.mentorMessages);

  // Sync mentor messages from store into local messages (for scenario dialogues)
  const lastSyncedIdxRef = useRef<number>(0);
  useEffect(() => {
    if (mentorMessages.length > lastSyncedIdxRef.current) {
      const newMsgs = mentorMessages.slice(lastSyncedIdxRef.current);
      lastSyncedIdxRef.current = mentorMessages.length;
      const converted: MentorMessage[] = newMsgs.map(m => ({
        role: (m.role === 'user' ? 'user' : 'mentor') as 'user' | 'mentor',
        content: m.content,
        timestamp: Date.now(),
        confidence: m.role === 'mentor' ? 0.95 : undefined,
      }));
      setMessages(prev => [...prev, ...converted]);
    }
  }, [mentorMessages]);

  // Reset sync index when scenario stops
  useEffect(() => {
    if (!isScenarioRunning) {
      lastSyncedIdxRef.current = mentorMessages.length;
    }
  }, [isScenarioRunning, mentorMessages.length]);

  const elapsedSeconds = useSimStore(s => s.elapsedSeconds);
  const isRunning = useSimStore(s => s.isRunning);
  const learnerLevel = 'intermediate' as const; // TODO: expose from store

  // Auto-generate observations every 15 simulation-seconds when running
  useEffect(() => {
    if (!isRunning) return;
    if (elapsedSeconds - lastObservationTimeRef.current < 15) return;
    lastObservationTimeRef.current = elapsedSeconds;

    const obs = autoObserve({ vitals, moass, eeg: eegState ?? undefined, pkStates, elapsedSeconds });
    if (obs) {
      // Deduplicate: skip if same message within 60 seconds
      const last = lastAutoObsRef.current;
      if (obs.content === last.content && (Date.now() - last.time) < 60000) {
        return;
      }
      lastAutoObsRef.current = { content: obs.content, time: Date.now() };
      setMessages(prev => [...prev, obs]);
    }
  }, [elapsedSeconds, isRunning, vitals, moass, eegState, pkStates]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async (query?: string) => {
    const text = query || input.trim();
    if (!text) return;
    if (isThinking) return;

    const userMsg: MentorMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    // Add a placeholder streaming message
    const placeholderMsg: MentorMessage = {
      role: 'mentor',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };
    setMessages(prev => {
      streamingIdxRef.current = prev.length;
      return [...prev, placeholderMsg];
    });

    try {
      const response = await generateMentorResponse(
        text,
        {
          twin: digitalTwin || undefined,
          vitals,
          moass,
          eeg: eegState || undefined,
          eventLog,
          pkStates,
          learnerLevel,
        },
        // onChunk — update the streaming placeholder in-place
        (chunk) => {
          setMessages(prev => {
            const idx = streamingIdxRef.current;
            if (idx === null) return prev;
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              content: updated[idx].content + chunk,
              isStreaming: true,
            };
            return updated;
          });
        }
      );

      // Replace placeholder with final message
      setMessages(prev => {
        const idx = streamingIdxRef.current;
        if (idx === null) return [...prev.slice(0, -1), response];
        const updated = [...prev];
        updated[idx] = { ...response, isStreaming: false };
        streamingIdxRef.current = null;
        return updated;
      });
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        const idx = streamingIdxRef.current;
        if (idx !== null) {
          updated[idx] = {
            role: 'mentor',
            content: 'I encountered an error processing your question. Please try again.',
            timestamp: Date.now(),
            isStreaming: false,
          };
          streamingIdxRef.current = null;
          return updated;
        }
        return [...prev, {
          role: 'mentor',
          content: 'I encountered an error processing your question. Please try again.',
          timestamp: Date.now(),
        }];
      });
    }
    setIsThinking(false);
  }, [input, isThinking, digitalTwin, vitals, moass, eegState, eventLog, pkStates, learnerLevel]);

  const suggestedQuestions = getSuggestedQuestions(vitals, moass, eegState || undefined);

  // Handle scenario answer submission
  const handleAnswerSubmit = useCallback(() => {
    if (!currentQuestion) return;
    const q = currentQuestion.question;
    let answer: string | number;
    if (q.type === 'numeric_range') {
      answer = parseFloat(numericAnswer);
      if (isNaN(answer as number)) return;
    } else {
      answer = selectedChoice;
      if (!answer) return;
    }
    scenarioEngine.answerQuestion(answer);
    setSelectedChoice('');
    setNumericAnswer('');
  }, [currentQuestion, selectedChoice, numericAnswer]);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-4 bottom-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg z-50 transition-all"
        title="Open AI Mentor"
      >
        <span className="text-lg">AI</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[92%] rounded-lg px-3 py-2 text-xs ${
                msg.role === 'user'
                  ? 'bg-blue-600/30 text-blue-100'
                  : 'bg-gray-800/80 text-gray-200'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}
                {msg.isStreaming && <span className="inline-block w-1 h-3 ml-0.5 bg-blue-400 animate-pulse align-middle" />}
              </p>
              {msg.citations && msg.citations.length > 0 && !msg.isStreaming && (
                <div className="mt-1 pt-1 border-t border-gray-700 flex flex-wrap gap-1">
                  {msg.citations.map((c, ci) => (
                    <span key={ci} className="text-gray-500 text-[9px] bg-gray-700/50 px-1 rounded">{c}</span>
                  ))}
                </div>
              )}
              {msg.confidence !== undefined && !msg.isStreaming && (
                <div className="flex items-center gap-1 mt-1">
                  <div
                    className="h-1 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500"
                    style={{ width: 40 }}
                  >
                    <div
                      className="h-full rounded-full bg-white/30"
                      style={{ width: `${(1 - msg.confidence) * 100}%`, marginLeft: `${msg.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-gray-500 text-[9px]">{Math.round(msg.confidence * 100)}%</span>
                </div>
              )}
            </div>
          </div>
        ))}
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
            placeholder="Ask the mentor..."
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

export default MentorChat;
