import React, { useState } from 'react';
import EEGPanel from './EEGPanel';
import MentorChat from './MentorChat';
import { ScenarioPanel } from './ScenarioPanel';
import OxyHbCurve from './OxyHbCurve';
import useSimStore from '../store/useSimStore';

type AITab = 'eeg' | 'mentor' | 'scenarios' | 'oxyhb';
export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AITab>('eeg');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mentorOpen, setMentorOpen] = useState(true);

  const simState = useSimStore((s) => ({
    vitals: s.vitals,
    moass: s.moass,
    isRunning: s.isRunning,
    eventLog: s.eventLog,
    pkStates: s.pkStates,
    patient: s.patient,
    eegState: s.eegState,
    digitalTwin: s.digitalTwin,
        fio2: s.fio2,
    airwayDevice: s.airwayDevice,
  }));

  const tabs: { id: AITab; label: string; icon: string }[] = [
    { id: 'eeg', label: 'EEG Monitor', icon: '🧠' },
    { id: 'mentor', label: 'AI Mentor', icon: '🎓' },
    { id: 'scenarios', label: 'Scenarios', icon: '🎯' },
        { id: 'oxyhb', label: 'O₂-Hb Curve', icon: '🩸' },
  ];

  if (isCollapsed) {
    return (
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50">
        <button
          onClick={() => setIsCollapsed(false)}
          className="bg-gray-800 border border-gray-600 rounded-l-lg px-2 py-4 text-white hover:bg-gray-700 transition-colors shadow-lg"
          title="Open AI Dashboard"
        >
          <span className="text-lg">🧠</span>
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
          <span>🧠</span> AI Dashboard
        </h2>
        <button
          onClick={() => setIsCollapsed(true)}
          className="text-gray-400 hover:text-white text-sm px-1"
          title="Collapse"
        >
          x
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
      <div className={`${activeTab === 'mentor' ? 'flex flex-col' : 'p-3 overflow-y-auto'} max-h-[600px]`}>
        {activeTab === 'eeg' && (
          <div className="p-3">
            <EEGPanel eegState={simState.eegState} isRunning={simState.isRunning} />
          </div>
        )}
        {activeTab === 'eeg' && simState.digitalTwin && (
          <div className="mx-3 mb-3 p-2 bg-gray-800/60 rounded text-xs space-y-1">
            <div className="text-gray-400 font-semibold mb-1">Digital Twin – Risk Metrics</div>
            <div className="flex justify-between">
              <span className="text-gray-400">Hypotension Risk</span>
              <span className={simState.digitalTwin.predictedOutcome.hypotensionRisk > 50 ? 'text-red-400' : simState.digitalTwin.predictedOutcome.hypotensionRisk > 25 ? 'text-yellow-400' : 'text-green-400'}>
                {simState.digitalTwin.predictedOutcome.hypotensionRisk}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Desaturation Risk</span>
              <span className={simState.digitalTwin.predictedOutcome.desaturationRisk > 50 ? 'text-red-400' : simState.digitalTwin.predictedOutcome.desaturationRisk > 25 ? 'text-yellow-400' : 'text-green-400'}>
                {simState.digitalTwin.predictedOutcome.desaturationRisk}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Awareness Risk</span>
              <span className={simState.digitalTwin.predictedOutcome.awarenessRisk > 30 ? 'text-yellow-400' : 'text-green-400'}>
                {simState.digitalTwin.predictedOutcome.awarenessRisk}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Arrhythmia Risk</span>
              <span className={simState.digitalTwin.predictedOutcome.arrhythmiaRisk > 50 ? 'text-red-400' : simState.digitalTwin.predictedOutcome.arrhythmiaRisk > 25 ? 'text-yellow-400' : 'text-green-400'}>
                {simState.digitalTwin.predictedOutcome.arrhythmiaRisk}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Rhythm</span>
              <span className="text-cyan-400 text-right" style={{ maxWidth: 140, wordBreak: 'break-word' }}>
                {simState.digitalTwin.predictedOutcome.predictedRhythm.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Est. Time to Emergence</span>
              <span className="text-cyan-400">{simState.digitalTwin.predictedOutcome.timeToEmergence} min</span>
            </div>
            {simState.digitalTwin.comorbidities.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Comorbidities</span>
                <span className="text-orange-400">{simState.digitalTwin.comorbidities.join(', ')}</span>
              </div>
            )}
            {simState.digitalTwin.predictedOutcome.aclsGuidance.length > 0 && (
              <div className="mt-2 p-2 bg-red-900/40 border border-red-700 rounded">
                <div className="text-red-400 font-bold text-xs mb-1">⚠ ACLS Guidance</div>
                {simState.digitalTwin.predictedOutcome.aclsGuidance.map((g, i) => (
                  <div key={i} className="text-red-300 text-xs">• {g}</div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'mentor' && (
          <MentorChat
            vitals={simState.vitals}
            moass={simState.moass}
            eegState={simState.eegState}
            digitalTwin={simState.digitalTwin}
            eventLog={simState.eventLog}
            pkStates={simState.pkStates}
            isOpen={mentorOpen}
            onToggle={() => setMentorOpen(!mentorOpen)}
          />
        )}
        {activeTab === 'scenarios' && (
          <div className="p-3 overflow-y-auto max-h-[600px]">
            <ScenarioPanel />
          </div>
        )}
                {activeTab === 'oxyhb' && (
          <div className="p-2 overflow-y-auto max-h-[600px]">
            <OxyHbCurve
              vitals={simState.vitals}
              fio2={simState.fio2}
              patient={simState.patient}
              airwayDevice={simState.airwayDevice}
            />
          </div>
        )}
      </div>
    </div>
  );
};
