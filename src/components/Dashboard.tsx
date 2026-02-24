import React, { useState, useEffect } from 'react';
import EEGPanel from './EEGPanel';
import MentorChat from './MentorChat';
import OxyHbCurve from './OxyHbCurve';
import FrankStarlingCurve from './FrankStarlingCurve';
import EchoSim from './EchoSim';
import ScenarioCallout from './ScenarioCallout';
import { LearningPanelContent } from './LearningPanel';
import useSimStore from '../store/useSimStore';
import useAIStore from '../store/useAIStore';

type AITab = 'eeg' | 'mentor' | 'simmaster' | 'oxyhb' | 'frankstarling' | 'echosim' | 'learn';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AITab | null>(null);
  const [mentorOpen, setMentorOpen] = useState(true);

  // Respond to external requests to switch tab (e.g., from ScenarioEngine)
  const storeActiveAITab = useAIStore(s => s.activeAITab);
  useEffect(() => {
    if (storeActiveAITab === 'mentor' || storeActiveAITab === 'eeg' || storeActiveAITab === 'simmaster') {
      setActiveTab(storeActiveAITab as AITab);
    }
  }, [storeActiveAITab]);

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
    combinedEff: s.combinedEff,
  }));

  const simMasterEnabled = useAIStore(s => s.simMasterEnabled);

  const tabs: { id: AITab; label: string; icon: string }[] = [
    { id: 'eeg', label: 'EEG', icon: '\ud83e\udde0' },
    { id: 'mentor', label: 'Millie', icon: '\ud83c\udf93' },
    { id: 'simmaster', label: 'SimMaster', icon: '\ud83c\udfaf' },
    { id: 'oxyhb', label: 'O\u2082-Hb', icon: '\ud83e\ude78' },
    { id: 'frankstarling', label: 'F-S', icon: '\u2764' },
    { id: 'echosim', label: 'Echo', icon: '\ud83d\udc93' },
    { id: 'learn', label: 'Learn', icon: '\ud83d\udcda' },
  ];

  const handleTabClick = (id: AITab) => {
    setActiveTab(activeTab === id ? null : id);
  };

  return (
    <>
      <div className="fixed right-0 top-0 bottom-12 z-50 flex pointer-events-none">
        {/* Expanded panel */}
        {activeTab && (
          <div className="pointer-events-auto w-80 bg-gray-900 border-1 border-gray-700 shadow-xl flex flex-col overflow-hidden">
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
                &#x00d7;
              </button>
            </div>
            {/* Panel content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'eeg' && (
                <>
                  <EEGPanel eegState={simState.eegState} isRunning={simState.isRunning} />
                  {simState.digitalTwin && (
                    <div className="p-3 border-t border-gray-700 text-[10px]">
                      <h3 className="text-xs font-bold text-white mb-2">Digital Twin &ndash; Risk Metrics</h3>
                      <div className="space-y-1">
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
                          <span className="text-white">
                            {simState.digitalTwin.predictedOutcome.predictedRhythm.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Est. Time to Emergence</span>
                          <span className="text-white">
                            {simState.digitalTwin.predictedOutcome.timeToEmergence} min
                          </span>
                        </div>
                        {simState.digitalTwin.comorbidities.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Comorbidities</span>
                            <span className="text-white">
                              {simState.digitalTwin.comorbidities.join(', ')}
                            </span>
                          </div>
                        )}
                        {simState.digitalTwin.predictedOutcome.aclsGuidance.length > 0 && (
                          <div className="mt-2">
                            <span className="text-yellow-400 font-bold">&#x26a0; ACLS Guidance</span>
                            {simState.digitalTwin.predictedOutcome.aclsGuidance.map((g: string, i: number) => (
                              <div key={i} className="text-yellow-200 ml-2">
                                &#x2022; {g}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
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
              {activeTab === 'simmaster' && (
                <div className="p-4 space-y-4">
                  <p className="text-xs text-gray-400">
                    Proactive AI observer that highlights critical events on screen in real-time.
                  </p>
                  <button
                    onClick={() => {
                      const store = useAIStore.getState();
                      store.setSimMasterEnabled(!store.simMasterEnabled);
                    }}
                    className={`px-4 py-2 rounded text-white text-sm font-bold transition-colors w-full ${
                      simMasterEnabled
                        ? 'bg-red-600 hover:bg-red-500'
                        : 'bg-purple-600 hover:bg-purple-500'
                    }`}
                  >
                    {simMasterEnabled ? 'Disable SimMaster' : 'Enable SimMaster'}
                  </button>
                  {simMasterEnabled && (
                    <p className="text-[10px] text-green-400 animate-pulse">
                      SimMaster is actively observing the simulation...
                    </p>
                  )}
                </div>
              )}
              {activeTab === 'oxyhb' && (
                <div className="p-2">
                  <OxyHbCurve
                    vitals={simState.vitals}
                    fio2={simState.fio2}
                    patient={simState.patient}
                    airwayDevice={simState.airwayDevice}
                  />
                </div>
              )}
              {activeTab === 'frankstarling' && (
                <div className="p-2">
                  <FrankStarlingCurve
                    vitals={simState.vitals}
                    patient={simState.patient}
                    moass={simState.moass}
                    combinedEff={simState.combinedEff}
                    pkStates={simState.pkStates}
                  />
                </div>
              )}
              {activeTab === 'echosim' && (
                <div className="p-2">
                  <EchoSim
                    vitals={simState.vitals}
                    patient={simState.patient}
                    moass={simState.moass}
                    combinedEff={simState.combinedEff}
                    pkStates={simState.pkStates}
                  />
                </div>
              )}
              {activeTab === 'learn' && (
                <LearningPanelContent />
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
      <ScenarioCallout />
    </>
  );
};
