// src/components/MentorChat.tsx
// AI Mentor Sidebar Chat Component
import React, { useState, useRef, useEffect } from 'react';
import { MentorMessage, generateMentorResponse, getSuggestedQuestions } from '../ai/mentor';
import { Vitals, MOASSLevel, LogEntry } from '../types';
import { EEGState } from '../engine/eegModel';
import { DigitalTwin } from '../engine/digitalTwin';

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

const MentorChat: React.FC<MentorChatProps> = ({
  vitals, moass, eegState, digitalTwin, eventLog, pkStates, isOpen, onToggle
}) => {
  const [messages, setMessages] = useState<MentorMessage[]>([
    {
      role: 'mentor',
      content: 'Welcome to SedSim AI Mentor. I can help you with EEG interpretation, drug titration guidance, and clinical decision-making. Ask me anything or click a suggested question below.',
      timestamp: Date.now(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (query?: string) => {
    const text = query || input.trim();
    if (!text) return;

    const userMsg: MentorMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      const response = await generateMentorResponse(text, {
        twin: digitalTwin || undefined,
        vitals,
        moass,
        eeg: eegState || undefined,
        eventLog,
        pkStates,
      });
      setMessages(prev => [...prev, response]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'mentor',
        content: 'I encountered an error processing your question. Please try again.',
        timestamp: Date.now(),
      }]);
    }
    setIsThinking(false);
  };

  const suggestedQuestions = getSuggestedQuestions(vitals, moass, eegState || undefined);

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
    <div className="fixed right-0 top-0 h-full w-80 bg-[#0d0d1a] border-l border-gray-700 flex flex-col z-50 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-[#111128]">
        <div>
          <h3 className="text-white text-sm font-bold">AI Mentor</h3>
          <span className="text-gray-400 text-[10px]">Virtual Attending</span>
        </div>
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-white text-lg"
        >
          &times;
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] rounded-lg px-3 py-2 text-xs ${
                msg.role === 'user'
                  ? 'bg-blue-600/30 text-blue-100'
                  : 'bg-gray-800/80 text-gray-200'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-1 pt-1 border-t border-gray-700">
                  <span className="text-gray-500 text-[9px]">Sources: {msg.citations.join(', ')}</span>
                </div>
              )}
              {msg.confidence !== undefined && (
                <span className="text-gray-500 text-[9px] block mt-1">
                  Confidence: {Math.round(msg.confidence * 100)}%
                </span>
              )}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-gray-800/80 rounded-lg px-3 py-2 text-xs text-gray-400">
              Analyzing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      <div className="px-3 py-2 border-t border-gray-800">
        <div className="flex flex-wrap gap-1">
          {suggestedQuestions.slice(0, 3).map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="text-[9px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded transition-colors"
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
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default MentorChat;
