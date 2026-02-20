import React, { useState } from 'react';
import EEGPanel from './EEGPanel';
import MentorChat from './MentorChat';
import { ScenarioPanel } from './ScenarioPanel';
import OxyHbCurve from './OxyHbCurve';
import useSimStore from '../store/useSimStore';

type AITab = 'eeg' | 'mentor' | 'scenarios' | 'oxyhb';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AITab | null>(null);
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
    { id: 'eeg', label: 'EEG', icon: '\ud83e\udde0' },
    { id: 'mentor', label: 'Mentor', icon: '\ud83c\udf93' },
    { id: 'scenarios', label: 'Scenarios', icon: '\ud83c\udfaf' },
    { id: 'oxyhb', label: 'O\u2082-Hb', icon: '\ud83e\ude78' },
  ];

  const handleTabClick = (id: AITab) => {
    setActiveTab(activeTab === id ? null : id);
  };

  return (
    <div className="fixed right-0 top-0 bottom-12 z-50 flex pointer-events-none">
      {/* Expanded panel */}
      {activeTab && (
        <div className="pointer-events-auto w-80 bg-gray-900 border-l border-gray-700 shadow-xl flex flex-col overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              {tabs.find(t => t.id === activeTab)?.icon} {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            <button
              onClick={() => setActiveTab(null)}
              className="text-gray-400 hover:text-white text-sm px-1"
              title="Close"
            >
              \u00d7
            </button>
          </div>
          {/* Panel content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'eeg' && (
              <>
                <EEGPanel />
                {simState.digitalTwin && (
                  <div className="px-3 py-2 border-t border-gray-700">
                    <h3 className="text-xs font-bold text-blue-400 mb-2">Digital Twin \u2013 Risk Metrics</h3>
                    <div className="space-y-1 text-xs">
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
                        <span className="text-white">{simState.digitalTwin.predictedOutcome.predictedRhythm.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Est. Time to Emergence</span>
                        <span className="text-white">{simState.digitalTwin.predictedOutcome.timeToEmergence} min</span>
                      </div>
                      {simState.digitalTwin.comorbidities.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Comorbidities</span>
                          <span className="text-white">{simState.digitalTwin.comorbidities.join(', ')}</span>
                        </div>
                      )}
                      {simState.digitalTwin.predictedOutcome.aclsGuidance.length > 0 && (
                        <div className="mt-2">
                          <div className="text-yellow-400 font-bold">\u26a0 ACLS Guidance</div>
                          {simState.digitalTwin.predictedOutcome.aclsGuidance.map((g: string, i: number) => (
                            <div key={i} className="text-yellow-200 text-xs">\u2022 {g}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            {activeTab === 'mentor' && (
              <MentorChat isOpen={mentorOpen} onToggle={() => setMentorOpen(!mentorOpen)} />
            )}
            {activeTab === 'scenarios' && (
              <div className="p-2">
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
      )}
      {/* Vertical tab buttons on the right edge */}
      <div className="pointer-events-auto flex flex-col bg-gray-900/90 border-l border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`flex flex-col items-center justify-center px-1.5 py-3 transition-colors border-b border-gray-700 ${
              activeTab === tab.id
                ? 'bg-blue-900/60 text-blue-400 border-l-2 border-l-blue-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            title={tab.label}
          >
            <span className="text-base">{tab.icon}</span>
            <span className="text-[9px] mt-0.5 leading-tight whitespace-nowrap">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
