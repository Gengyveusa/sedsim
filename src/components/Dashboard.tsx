import React, { useState } from 'react';
import { EEGPanel } from './EEGPanel';
import { MentorChat } from './MentorChat';
import { ScenarioPanel } from './ScenarioPanel';

type AITab = 'eeg' | 'mentor' | 'scenarios';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AITab>('eeg');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const tabs: { id: AITab; label: string; icon: string }[] = [
    { id: 'eeg', label: 'EEG Monitor', icon: '🧠' },
    { id: 'mentor', label: 'AI Mentor', icon: '🎓' },
    { id: 'scenarios', label: 'Scenarios', icon: '🎯' },
  ];

  if (isCollapsed) {
    return (
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50">
        <button
          onClick={() => setIsCollapsed(false)}
          className="bg-gray-800 border border-gray-600 rounded-l-lg px-2 py-4 text-white hover:bg-gray-700 transition-colors shadow-lg"
          title="Open AI Dashboard"
        >
          <span className="text-lg">🤖</span>
          <div className="text-xs mt-1 writing-vertical">AI</div>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <span>🤖</span> AI Dashboard
        </h2>
        <button
          onClick={() => setIsCollapsed(true)}
          className="text-gray-400 hover:text-white text-sm px-1"
          title="Collapse"
        >
          ✕
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-3 max-h-[600px] overflow-y-auto">
        {activeTab === 'eeg' && <EEGPanel />}
        {activeTab === 'mentor' && <MentorChat />}
        {activeTab === 'scenarios' && <ScenarioPanel />}
      </div>
    </div>
  );
};
