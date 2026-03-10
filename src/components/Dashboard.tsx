import React, { useState, useEffect, useCallback, useRef } from 'react';
import EEGPanel from './EEGPanel';
import MillieChat from './MillieChat';
import OxyHbCurve from './OxyHbCurve';
import FrankStarlingCurve from './FrankStarlingCurve';
import EchoSim from './EchoSim';
import ScenarioCallout from './ScenarioCallout';
import VitalAnnotations from './VitalAnnotations';
import { LearningPanelContent } from './LearningPanel';
import useSimStore from '../store/useSimStore';
import useAIStore from '../store/useAIStore';
import {
  assessAllVitals, ClinicalStatus, SimMasterAction, SimMasterContext,
  detectEvents, generateActions, shouldAskQuestion,
} from '../ai/simMaster';
import { getQuestionForEvent, SocraticQuestion } from '../ai/simMasterPrompt';
import { streamClaude } from '../ai/claudeClient';
import { buildSimMasterSystemPrompt } from '../ai/simMasterPrompt';
import { DigitalTwin } from '../engine/digitalTwin';

type AITab = 'eeg' | 'mentor' | 'simmaster' | 'oxyhb' | 'frankstarling' | 'echosim' | 'learn';

// ---------------------------------------------------------------------------
// CompositeRiskBadge — color-coded badge with hover breakdown tooltip
// ---------------------------------------------------------------------------

function compositeRiskColor(score: number): { badge: string; label: string } {
  if (score >= 75) return { badge: 'bg-red-900/70 text-red-300 border-red-500',       label: 'CRITICAL' };
  if (score >= 50) return { badge: 'bg-orange-900/70 text-orange-300 border-orange-500', label: 'HIGH' };
  if (score >= 25) return { badge: 'bg-yellow-900/70 text-yellow-300 border-yellow-500', label: 'MODERATE' };
  return                  { badge: 'bg-green-900/70 text-green-300 border-green-500',  label: 'LOW' };
}

interface CompositeRiskBadgeProps {
  digitalTwin: DigitalTwin;
}

const CompositeRiskBadge: React.FC<CompositeRiskBadgeProps> = ({ digitalTwin }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const { compositeRisk, riskBreakdown } = digitalTwin.predictedOutcome;
  const { badge, label } = compositeRiskColor(compositeRisk);

  return (
    <div className="relative">
      <div
        className={`flex items-center justify-between px-2 py-1.5 rounded border cursor-help ${badge}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="text-[10px] font-bold tracking-wide">COMPOSITE RISK</span>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-mono font-bold">{compositeRisk}%</span>
          <span className="text-[9px] font-semibold opacity-80">{label}</span>
        </div>
      </div>

      {showTooltip && (
        <div className="absolute z-50 bottom-full left-0 right-0 mb-1 p-2 bg-gray-900 border border-gray-600 rounded shadow-xl text-[9px] space-y-1">
          <div className="text-gray-300 font-bold mb-1">Risk Breakdown</div>
          <div className="flex justify-between"><span className="text-gray-400">Hypotension</span><span className="text-white">{riskBreakdown.hypotensionComponent}%</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Desaturation</span><span className="text-white">{riskBreakdown.desaturationComponent}%</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Arrhythmia</span><span className="text-white">{riskBreakdown.arrhythmiaComponent}%</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Awareness</span><span className="text-white">{riskBreakdown.awarenessComponent}%</span></div>
          {riskBreakdown.airwayComponent > 0 && (
            <div className="flex justify-between"><span className="text-gray-400">Airway (Mallampati)</span><span className="text-white">{riskBreakdown.airwayComponent}%</span></div>
          )}
          <div className="border-t border-gray-700 pt-1 mt-1">
            <div className="flex justify-between"><span className="text-gray-400">ASA {digitalTwin.asa} modifier</span><span className="text-cyan-300">{riskBreakdown.asaModifier}×</span></div>
            {riskBreakdown.comorbidityAddend > 0 && (
              <div className="flex justify-between"><span className="text-gray-400">Comorbidity addend</span><span className="text-cyan-300">+{riskBreakdown.comorbidityAddend}</span></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// SimMasterFeed — live scrolling commentary for the sidebar panel
// ---------------------------------------------------------------------------

interface CommentaryEntry {
  timestamp: number;
  action: SimMasterAction;
}

const STATUS_COLOR: Record<ClinicalStatus, { dot: string; badge: string; text: string }> = {
  normal:   { dot: 'bg-emerald-400', badge: 'bg-emerald-900/60 text-emerald-300 border-emerald-600/50', text: 'text-emerald-300' },
  warning:  { dot: 'bg-amber-400',   badge: 'bg-amber-900/60 text-amber-300 border-amber-600/50',     text: 'text-amber-300' },
  danger:   { dot: 'bg-red-500',     badge: 'bg-red-900/60 text-red-300 border-red-600/50',           text: 'text-red-300' },
  critical: { dot: 'bg-red-400',     badge: 'bg-red-900/80 text-red-200 border-red-400',              text: 'text-red-200' },
};

const ACTION_TYPE_COLORS: Record<string, string> = {
  narrate:          'bg-cyan-900/60 text-cyan-300 border-cyan-600/50',
  direct_attention: 'bg-amber-900/60 text-amber-300 border-amber-600/50',
  ask_question:     'bg-purple-900/60 text-purple-300 border-purple-600/50',
  explain:          'bg-blue-900/60 text-blue-300 border-blue-600/50',
  suggest_action:   'bg-red-900/60 text-red-300 border-red-600/50',
  quiz:             'bg-green-900/60 text-green-300 border-green-600/50',
};

const PANEL_LABELS: Record<string, string> = {
  monitor: 'Monitor', avatar: 'Avatar', radar: 'Radar', petals: 'Petals',
  eeg: 'EEG', echo: 'Echo', frank_starling: 'F-S', oxyhb: 'O₂-Hb',
  drug_panel: 'Drugs', trends: 'Trends', ghost_dose: 'Ghost Dose',
  sedation_gauge: 'Gauge', risk_metrics: 'Risks', emergency_drugs: 'Emergency',
  iv_fluids: 'IV Fluids', airway: 'Airway', learning_panel: 'Learn',
};

function formatTs(epochMs: number): string {
  const d = new Date(epochMs);
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${mm}:${ss}`;
}

interface SimMasterFeedProps {
  enabled: boolean;
  onToggle: () => void;
}

const SimMasterFeed: React.FC<SimMasterFeedProps> = ({ enabled, onToggle }) => {
  const [commentaryLog, setCommentaryLog] = useState<CommentaryEntry[]>([]);
  const [overallStatus, setOverallStatus] = useState<ClinicalStatus>('normal');
  const [vitalsText, setVitalsText] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState<SocraticQuestion | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [claudeFeedback, setClaudeFeedback] = useState('');
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const [isStreamingFeedback, setIsStreamingFeedback] = useState(false);
  const lastSocraticTimeRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const simState = useSimStore(s => ({
    vitals: s.vitals, moass: s.moass, eegState: s.eegState, pkStates: s.pkStates,
    isRunning: s.isRunning, combinedEff: s.combinedEff, patient: s.patient,
    emergencyState: s.emergencyState, activeAlarms: s.activeAlarms, infusions: s.infusions,
    frankStarlingPoint: s.frankStarlingPoint, oxyHbPoint: s.oxyHbPoint,
    activeTab: s.activeTab, activeGaugeMode: s.activeGaugeMode,
    lastDrugAdministered: s.lastDrugAdministered, lastInterventionApplied: s.lastInterventionApplied,
    elapsedSeconds: s.elapsedSeconds, speedMultiplier: s.speedMultiplier,
    userIdleSeconds: s.userIdleSeconds, drugsAdministeredCount: s.drugsAdministeredCount,
    isScenarioActive: s.isScenarioActive,
  }));
  const learnerLevel = useAIStore(s => s.tutorialState?.learnerLevel ?? 'intermediate') as 'novice' | 'intermediate' | 'advanced';

  const buildContext = useCallback((): SimMasterContext => ({
    patient: simState.patient,
    vitals: simState.vitals, moass: simState.moass, combinedEff: simState.combinedEff,
    emergencyState: simState.emergencyState, activeAlarms: simState.activeAlarms,
    pkStates: simState.pkStates,
    infusions: Object.fromEntries(
      Object.entries(simState.infusions as Record<string, { rate: number; isRunning: boolean }>)
        .map(([k, v]) => [k, { rate: v.rate, isRunning: v.isRunning }])
    ),
    eegState: simState.eegState, frankStarlingPoint: simState.frankStarlingPoint,
    oxyHbPoint: simState.oxyHbPoint, activeTab: simState.activeTab,
    activeGaugeMode: simState.activeGaugeMode,
    lastDrugAdministered: simState.lastDrugAdministered,
    lastInterventionApplied: simState.lastInterventionApplied,
    elapsedSeconds: simState.elapsedSeconds, simSpeed: simState.speedMultiplier,
    userIdleSeconds: simState.userIdleSeconds, drugsAdministeredCount: simState.drugsAdministeredCount,
    scenarioActive: simState.isScenarioActive,
  }), [simState]);

  useEffect(() => {
    if (!enabled || !simState.isRunning) return;
    const evaluate = () => {
      const assessments = assessAllVitals(simState.vitals, simState.moass, simState.eegState ?? undefined, simState.pkStates);
      // Determine overall status
      let status: ClinicalStatus = 'normal';
      if (assessments.some(a => a.status === 'critical')) status = 'critical';
      else if (assessments.some(a => a.status === 'danger')) status = 'danger';
      else if (assessments.some(a => a.status === 'warning')) status = 'warning';
      setOverallStatus(status);
      // Build brief vitals text
      const v = simState.vitals;
      const dbp = Math.round(v.dbp ?? (v.sbp * 0.65));
      setVitalsText(`HR ${Math.round(v.hr)}, SpO₂ ${Math.round(v.spo2)}%, BP ${Math.round(v.sbp)}/${dbp} — ${status}`);
      // Run event detection
      const ctx = buildContext();
      const events = detectEvents(ctx);
      if (events.length > 0) {
        const newActions = generateActions(events, ctx);
        if (newActions.length > 0) {
          const now = Date.now();
          const entries: CommentaryEntry[] = newActions.map(a => ({ timestamp: now, action: a }));
          setCommentaryLog(prev => [...entries, ...prev].slice(0, 50));
        }
      }
    };
    evaluate();
    const id = setInterval(evaluate, 3000);
    return () => clearInterval(id);
  }, [enabled, simState, buildContext]);

  useEffect(() => {
    if (!enabled || !simState.isRunning || isAskingQuestion) return;
    const id = setInterval(() => {
      const ctx = buildContext();
      if (shouldAskQuestion(ctx, lastSocraticTimeRef.current)) {
        const q = getQuestionForEvent('nothing_happening', learnerLevel);
        if (q) {
          setPendingQuestion(q); setIsAskingQuestion(true);
          setUserAnswer(''); setClaudeFeedback('');
          lastSocraticTimeRef.current = Date.now();
        }
      }
    }, 15000);
    return () => clearInterval(id);
  }, [enabled, simState.isRunning, isAskingQuestion, buildContext, learnerLevel]);

  const handleSubmitAnswer = useCallback(async () => {
    if (!pendingQuestion || !userAnswer.trim()) return;
    setIsStreamingFeedback(true); setClaudeFeedback('');
    const ctx = buildContext();
    const query = `The learner was asked: "${pendingQuestion.question.replace('{moass}', String(ctx.moass)).replace('{spo2}', String(Math.round(ctx.vitals.spo2))).replace('{combinedEff}', String((ctx.combinedEff * 100).toFixed(0)))}" Their answer: "${userAnswer}" Evaluate in 3-4 sentences.`;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    try {
      await streamClaude(query, {
        vitals: ctx.vitals, moass: ctx.moass, pkStates: ctx.pkStates,
        eeg: ctx.eegState ?? undefined, learnerLevel,
        _systemOverride: buildSimMasterSystemPrompt({ ...ctx, learnerLevel, recentEvents: [pendingQuestion.trigger] }),
      }, (chunk: string) => setClaudeFeedback(prev => prev + chunk), abortRef.current.signal);
    } catch { setClaudeFeedback('Offline. Key topics: ' + pendingQuestion.expectedTopics.join(', ')); }
    finally { setIsStreamingFeedback(false); }
  }, [pendingQuestion, userAnswer, buildContext, learnerLevel]);

  const sc = STATUS_COLOR[overallStatus];

  return (
    <div className="flex flex-col h-full">
      {/* Header controls */}
      <div className="px-3 py-2 border-b border-gray-700 space-y-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${sc.dot} ${overallStatus !== 'normal' ? 'animate-pulse' : ''}`} />
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${sc.badge}`}>{overallStatus.toUpperCase()}</span>
          {vitalsText && <span className="text-[10px] text-gray-400 flex-1 truncate">{vitalsText}</span>}
        </div>
        <button
          onClick={onToggle}
          className={`w-full px-3 py-1.5 rounded text-white text-xs font-bold transition-colors ${
            enabled ? 'bg-red-700 hover:bg-red-600' : 'bg-purple-700 hover:bg-purple-600'
          }`}
        >
          {enabled ? 'Disable SimMaster' : 'Enable SimMaster'}
        </button>
      </div>

      {/* Socratic Q&A */}
      {enabled && isAskingQuestion && pendingQuestion && (
        <div className="px-3 py-2 border-b border-purple-800/50 bg-purple-950/30 flex-shrink-0">
          <p className="text-[9px] font-bold uppercase text-purple-400 mb-1">Question</p>
          <p className="text-xs text-purple-200 leading-relaxed mb-2">
            {pendingQuestion.question
              .replace('{moass}', String(simState.moass))
              .replace('{spo2}', String(Math.round(simState.vitals.spo2)))
              .replace('{combinedEff}', String((simState.combinedEff * 100).toFixed(0)))}
          </p>
          {!claudeFeedback ? (
            <div className="flex gap-1.5">
              <input
                type="text" value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmitAnswer()}
                placeholder="Type your answer..."
                className="flex-1 text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleSubmitAnswer}
                disabled={!userAnswer.trim() || isStreamingFeedback}
                className="text-[9px] px-2 py-1 rounded bg-purple-700 hover:bg-purple-600 text-white disabled:opacity-50"
              >Submit</button>
            </div>
          ) : (
            <div>
              <p className="text-[10px] text-green-300 leading-relaxed">{claudeFeedback}</p>
              {!isStreamingFeedback && (
                <button
                  onClick={() => { setIsAskingQuestion(false); setPendingQuestion(null); setClaudeFeedback(''); setUserAnswer(''); }}
                  className="mt-1 text-[9px] text-gray-400 hover:text-white"
                >Dismiss</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Commentary feed */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {!enabled && (
          <p className="text-xs text-gray-500 text-center mt-4">Enable SimMaster to start receiving teaching commentary.</p>
        )}
        {enabled && !simState.isRunning && (
          <p className="text-xs text-gray-500 text-center mt-4">Start the simulation to receive commentary.</p>
        )}
        {enabled && simState.isRunning && commentaryLog.length === 0 && (
          <p className="text-[10px] text-gray-500 text-center mt-4 animate-pulse">Observing simulation…</p>
        )}
        {commentaryLog.map((entry, i) => {
          const typeColor = ACTION_TYPE_COLORS[entry.action.type] ?? 'bg-gray-800 text-gray-300 border-gray-600';
          const panel = entry.action.targetPanel;
          return (
            <div key={i} className="bg-gray-800/60 border border-gray-700/50 rounded p-2 space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] text-gray-500 font-mono">[{formatTs(entry.timestamp)}]</span>
                <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${typeColor}`}>
                  {entry.action.type.replace(/_/g, ' ').toUpperCase()}
                </span>
                {panel && (
                  <span className="text-[9px] text-gray-400">→ {PANEL_LABELS[panel] ?? panel}</span>
                )}
              </div>
              <p className="text-[11px] text-gray-200 leading-relaxed">{entry.action.message}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AITab | null>(null);
  const [mentorOpen, setMentorOpen] = useState(true);

  const setStoreActiveTab = useSimStore(s => s.setActiveTab);
  const recordUserInteraction = useSimStore(s => s.recordUserInteraction);

  // Respond to external requests to switch tab (e.g., from ScenarioEngine or SimMaster)
  const storeActiveAITab = useAIStore(s => s.activeAITab);
  const requestOpenTab = useAIStore(s => s.requestOpenTab);
  const clearTabRequest = useAIStore(s => s.clearTabRequest);

  useEffect(() => {
    if (storeActiveAITab === 'mentor' || storeActiveAITab === 'eeg' || storeActiveAITab === 'simmaster') {
      setActiveTab(storeActiveAITab as AITab);
    }
  }, [storeActiveAITab]);

  // React to SimMaster's tab open requests
  useEffect(() => {
    if (requestOpenTab) {
      setActiveTab(requestOpenTab as AITab);
      clearTabRequest();
    }
  }, [requestOpenTab, clearTabRequest]);

  // Sync active tab to store for SimMaster awareness
  useEffect(() => {
    setStoreActiveTab(activeTab ?? '');
  }, [activeTab, setStoreActiveTab]);

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
    const newTab = activeTab === id ? null : id;
    setActiveTab(newTab);
    recordUserInteraction();
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
                aria-label={`Close ${tabs.find(t => t.id === activeTab)?.label ?? ''} panel`}
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
                      {/* Composite risk badge with hover tooltip */}
                      <CompositeRiskBadge digitalTwin={simState.digitalTwin} />
                      <div className="space-y-1 mt-2">
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
                <MillieChat
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
                <SimMasterFeed
                  enabled={simMasterEnabled}
                  onToggle={() => {
                    const store = useAIStore.getState();
                    store.setSimMasterEnabled(!store.simMasterEnabled);
                  }}
                />
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
        <div className="pointer-events-auto flex flex-col bg-gray-900/90 border-l border-gray-700" role="tablist" aria-label="AI tools and analysis panels" aria-orientation="vertical">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              onClick={() => handleTabClick(tab.id)}
              aria-selected={activeTab === tab.id}
              aria-label={`${tab.label} panel${activeTab === tab.id ? ', open' : ''}`}
              aria-expanded={activeTab === tab.id}
              className={`flex flex-col items-center justify-center px-1.5 py-3 transition-colors border-b border-gray-700 ${
                activeTab === tab.id
                  ? 'bg-blue-900/60 text-blue-400 border-l-2 border-l-blue-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title={tab.label}
            >
              <span className="text-base" aria-hidden="true">{tab.icon}</span>
              <span className="text-[9px] mt-0.5 leading-tight whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
      <ScenarioCallout />
      <VitalAnnotations />
    </>
  );
};
