// src/components/SimMasterOverlay.tsx
// SimMaster v3 — Active AI Teaching Companion overlay
// Commentary, panel pointers, Socratic Q&A, mini vitals row

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  assessAllVitals, VitalAssessment, ClinicalStatus, SimMasterAction,
  SimMasterContext, detectEvents, generateActions, shouldAskQuestion,
} from '../ai/simMaster';
import { streamClaude } from '../ai/claudeClient';
import { buildSimMasterSystemPrompt, getQuestionForEvent, SocraticQuestion } from '../ai/simMasterPrompt';
import useSimStore from '../store/useSimStore';
import useAIStore from '../store/useAIStore';

interface SimMasterOverlayProps { enabled: boolean; }

const STATUS_CONFIG: Record<ClinicalStatus, { bg: string; border: string; text: string; dot: string; glow: string; icon: string; }> = {
  normal:   { bg: 'bg-emerald-950/80', border: 'border-emerald-500/60', text: 'text-emerald-300', dot: 'bg-emerald-400', glow: '', icon: '\u2713' },
  warning:  { bg: 'bg-amber-950/80',   border: 'border-amber-500/60',   text: 'text-amber-300',   dot: 'bg-amber-400',   glow: '', icon: '\u26A0' },
  danger:   { bg: 'bg-red-950/80',     border: 'border-red-500/60',     text: 'text-red-300',     dot: 'bg-red-500',     glow: '', icon: '\u2716' },
  critical: { bg: 'bg-red-950/90',     border: 'border-red-400',        text: 'text-red-200',     dot: 'bg-red-400',     glow: '', icon: '\u203C' },
};

const PANEL_LABELS: Record<string, string> = {
  monitor: 'Monitor', avatar: 'Avatar', radar: 'Radar', petals: 'Petals',
  eeg: 'EEG', echo: 'Echo', frank_starling: 'F-S', oxyhb: 'O\u2082-Hb',
  drug_panel: 'Drugs', trends: 'Trends', ghost_dose: 'Ghost Dose',
  sedation_gauge: 'Gauge', risk_metrics: 'Risks', emergency_drugs: 'Emergency',
  iv_fluids: 'IV Fluids', airway: 'Airway', learning_panel: 'Learn',
};

const PANEL_TO_TAB: Record<string, string> = {
  eeg: 'eeg', echo: 'echosim', frank_starling: 'frankstarling',
  oxyhb: 'oxyhb', learning_panel: 'learn', risk_metrics: 'eeg',
};

const PANEL_TO_GAUGE: Record<string, string> = {
  avatar: 'avatar', radar: 'risk', petals: 'petals',
};

const VitalPill: React.FC<{ a: VitalAssessment }> = ({ a }) => {
  const c = STATUS_CONFIG[a.status];
  const pulse = a.status === 'critical' || a.status === 'danger' ? 'animate-pulse' : '';
  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${c.border} ${c.bg} ${pulse}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} flex-shrink-0`} />
      <span className={`text-[10px] font-bold ${c.text}`}>{a.label}</span>
      <span className="text-[10px] text-gray-400">{a.value}{a.unit}</span>
    </div>
  );
};

const SimMasterOverlay: React.FC<SimMasterOverlayProps> = ({ enabled }) => {
  const [currentAction, setCurrentAction] = useState<SimMasterAction | null>(null);
  const [assessments, setAssessments] = useState<VitalAssessment[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [actionQueue, setActionQueue] = useState<SimMasterAction[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<SocraticQuestion | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [claudeFeedback, setClaudeFeedback] = useState('');
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const [isStreamingFeedback, setIsStreamingFeedback] = useState(false);
  const lastSocraticTimeRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const openSidebarTab = useAIStore((s: { openSidebarTab: (id: string) => void }) => s.openSidebarTab);
  const switchGaugeMode = useAIStore((s: { switchGaugeMode: (m: string) => void }) => s.switchGaugeMode);
  // Use store destructuring — selector left untyped (matches codebase pattern)
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

  const overallStatus = useMemo(() => {
    if (assessments.some(a => a.status === 'critical')) return 'critical' as ClinicalStatus;
    if (assessments.some(a => a.status === 'danger')) return 'danger' as ClinicalStatus;
    if (assessments.some(a => a.status === 'warning')) return 'warning' as ClinicalStatus;
    return 'normal' as ClinicalStatus;
  }, [assessments]);

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

  const executeAction = useCallback((action: SimMasterAction) => {
    setCurrentAction(action);
    if (action.openTab && action.targetPanel) {
      const tabId = PANEL_TO_TAB[action.targetPanel];
      if (tabId) openSidebarTab(tabId);
    }
    const gaugeSwitch = action.switchGauge ?? (action.targetPanel ? PANEL_TO_GAUGE[action.targetPanel] : undefined);
    if (gaugeSwitch) switchGaugeMode(gaugeSwitch);
  }, [openSidebarTab, switchGaugeMode]);

  useEffect(() => {
    if (!enabled || !simState.isRunning) {
      setCurrentAction(null); setAssessments([]); setActionQueue([]); return;
    }
    const evaluate = () => {
      setAssessments(assessAllVitals(simState.vitals, simState.moass, simState.eegState ?? undefined, simState.pkStates));
      const ctx = buildContext();
      const events = detectEvents(ctx);
      if (events.length > 0) {
        const newActions = generateActions(events, ctx);
        if (newActions.length > 0) {
          setActionQueue(prev => [...prev, ...newActions].sort((a, b) => b.priority - a.priority).slice(0, 5));
        }
      }
    };
    evaluate();
    const id = setInterval(evaluate, 3000);
    return () => clearInterval(id);
  }, [enabled, simState, buildContext]);

  useEffect(() => {
    if (!currentAction && actionQueue.length > 0) {
      const [next, ...rest] = actionQueue;
      setActionQueue(rest);
      executeAction(next);
      const t = setTimeout(() => setCurrentAction(null), next.displayDuration);
      return () => clearTimeout(t);
    }
  }, [currentAction, actionQueue, executeAction]);

  useEffect(() => {
    if (!enabled || !simState.isRunning || isAskingQuestion) return;
    const id = setInterval(() => {
      const ctx = buildContext();
      if (shouldAskQuestion(ctx, lastSocraticTimeRef.current)) {
        const q = getQuestionForEvent('nothing_happening', learnerLevel);
        if (q) { setPendingQuestion(q); setIsAskingQuestion(true); setUserAnswer(''); setClaudeFeedback(''); lastSocraticTimeRef.current = Date.now(); }
      }
    }, 15000);
    return () => clearInterval(id);
  }, [enabled, simState.isRunning, isAskingQuestion, buildContext, learnerLevel]);

  const handleSubmitAnswer = useCallback(async () => {
    if (!pendingQuestion || !userAnswer.trim()) return;
    setIsStreamingFeedback(true); setClaudeFeedback('');
    const ctx = buildContext();
    const query = `The learner was asked: "${pendingQuestion.question.replace('{moass}', String(ctx.moass)).replace('{spo2}', String(Math.round(ctx.vitals.spo2))).replace('{combinedEff}', String((ctx.combinedEff * 100).toFixed(0)))}" Their answer: "${userAnswer}" Evaluate in 3-4 sentences. Note what's correct/missing. Be encouraging but clinically accurate.`;
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

  if (!enabled || !simState.isRunning) return null;

  const sc = STATUS_CONFIG[overallStatus];
  const ACTION_COLORS: Record<string, string> = {
    narrate: 'text-cyan-300', direct_attention: 'text-amber-300', ask_question: 'text-purple-300',
    explain: 'text-blue-300', suggest_action: 'text-red-300', quiz: 'text-green-300',
  };
  const actionColor = currentAction ? (ACTION_COLORS[currentAction.type] ?? 'text-gray-300') : 'text-gray-300';
  const targetPanel = currentAction?.targetPanel;
  const tabId = targetPanel ? PANEL_TO_TAB[targetPanel] : null;
  const gaugeId = targetPanel ? PANEL_TO_GAUGE[targetPanel] : null;

  return (
    <div className="fixed bottom-16 left-[330px] z-[9999] pointer-events-auto" style={{ maxWidth: 340 }}>
      {!isExpanded ? (
        <div onClick={() => setIsExpanded(true)} className={`w-12 h-12 rounded-full ${sc.bg} border-2 ${sc.border} flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform`} title="Expand SimMaster">
          <span className="text-lg">{sc.icon}</span>
        </div>
      ) : (
        <div className="bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700">
            <span className="flex items-center gap-2 text-xs font-bold text-white">
              <span className={`w-2 h-2 rounded-full ${sc.dot} ${overallStatus !== 'normal' ? 'animate-pulse' : ''}`} />
              SimMaster
              <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${sc.bg} ${sc.text} border ${sc.border}`}>{overallStatus.toUpperCase()}</span>
            </span>
            <button onClick={() => setIsExpanded(false)} className="text-gray-500 hover:text-white text-sm px-1">&mdash;</button>
          </div>
          {currentAction && (
            <div className="px-3 py-2 border-b border-slate-700/50">
              <p className={`text-[9px] font-bold uppercase mb-0.5 ${actionColor}`}>
                {currentAction.type.replace('_', ' ')}{targetPanel ? ` \u2192 ${PANEL_LABELS[targetPanel] ?? targetPanel}` : ''}
              </p>
              <p className={`text-xs leading-relaxed ${actionColor}`}>{currentAction.message}</p>
              {(tabId || gaugeId) && (
                <div className="mt-1.5 flex gap-1.5">
                  {tabId && <button onClick={() => openSidebarTab(tabId)} className="text-[9px] px-2 py-0.5 rounded bg-blue-900/60 border border-blue-500/50 text-blue-300 hover:bg-blue-800/60 cursor-pointer">Open {PANEL_LABELS[targetPanel!]}</button>}
                  {gaugeId && <button onClick={() => switchGaugeMode(gaugeId)} className="text-[9px] px-2 py-0.5 rounded bg-teal-900/60 border border-teal-500/50 text-teal-300 hover:bg-teal-800/60 cursor-pointer">Switch to {PANEL_LABELS[targetPanel!]}</button>}
                </div>
              )}
            </div>
          )}
          {isAskingQuestion && pendingQuestion && (
            <div className="px-3 py-2 border-b border-slate-700/50 bg-purple-950/30">
              <p className="text-[9px] font-bold uppercase text-purple-400 mb-1">Question</p>
              <p className="text-xs text-purple-200 leading-relaxed mb-2">
                {pendingQuestion.question.replace('{moass}', String(simState.moass)).replace('{spo2}', String(Math.round(simState.vitals.spo2))).replace('{combinedEff}', String((simState.combinedEff * 100).toFixed(0)))}
              </p>
              {!claudeFeedback ? (
                <div className="flex gap-1.5">
                  <input type="text" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmitAnswer()} placeholder="Type your answer..." className="flex-1 text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
                  <button onClick={handleSubmitAnswer} disabled={!userAnswer.trim() || isStreamingFeedback} className="text-[9px] px-2 py-1 rounded bg-purple-700 hover:bg-purple-600 text-white disabled:opacity-50 cursor-pointer">Submit</button>
                </div>
              ) : (
                <div>
                  <p className="text-[10px] text-green-300 leading-relaxed">{claudeFeedback}</p>
                  {!isStreamingFeedback && <button onClick={() => { setIsAskingQuestion(false); setPendingQuestion(null); setClaudeFeedback(''); setUserAnswer(''); }} className="mt-1 text-[9px] text-slate-400 hover:text-white cursor-pointer">Dismiss</button>}
                </div>
              )}
            </div>
          )}
          {assessments.length > 0 && (
            <div className="flex flex-wrap gap-1 px-3 py-1.5">
              {assessments.map(a => <VitalPill key={a.param} a={a} />)}
            </div>
          )}
        </div>
      )}
      <style>{`.simmaster-glow { animation: simmaster-glow-kf 2s ease-in-out infinite; } @keyframes simmaster-glow-kf { 0%,100% { box-shadow: 0 0 4px rgba(245,158,11,0.3); } 50% { box-shadow: 0 0 12px rgba(245,158,11,0.5); } }`}</style>
    </div>
  );
};

export default SimMasterOverlay;
