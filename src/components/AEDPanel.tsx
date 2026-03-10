import { useState, useEffect, useRef, useCallback } from 'react';
import useSimStore from '../store/useSimStore';
import type { CardiacRhythm } from '../types';
import { audioManager } from '../utils/audio';

/* ─────────────────────────────────────────────────────────
   Types & Constants
   ───────────────────────────────────────────────────────── */

type AEDState =
  | 'OFF'
  | 'POWERED_ON'
  | 'PADS_ATTACHING'
  | 'PADS_ATTACHED'
  | 'ANALYZING'
  | 'SHOCK_ADVISED'
  | 'NO_SHOCK_ADVISED'
  | 'SHOCKING'
  | 'POST_SHOCK';

const SHOCKABLE_RHYTHMS: CardiacRhythm[] = [
  'ventricular_fibrillation',
  'ventricular_tachycardia',
  'polymorphic_vt',
];

const ARREST_RHYTHMS: CardiacRhythm[] = [
  'ventricular_fibrillation',
  'ventricular_tachycardia',
  'polymorphic_vt',
  'asystole',
  'pea',
];

/** Energy escalation per AHA ACLS: 120 → 150 → 200 J */
function getEnergy(shockNumber: number): number {
  if (shockNumber <= 1) return 120;
  if (shockNumber === 2) return 150;
  return 200;
}

/** Probability of rhythm conversion by rhythm type and shock number */
function getConversionProbability(
  rhythm: CardiacRhythm,
  shockNumber: number,
): number {
  const tables: Partial<Record<CardiacRhythm, [number, number, number]>> = {
    ventricular_fibrillation: [0.30, 0.50, 0.65],
    ventricular_tachycardia: [0.40, 0.60, 0.75],
    polymorphic_vt: [0.25, 0.40, 0.55],
  };
  const row = tables[rhythm];
  if (!row) return 0;
  const idx = Math.min(shockNumber, 3) - 1;
  return row[idx];
}

const VOICE_PROMPTS: Record<string, string> = {
  OFF: 'Turn on the AED.',
  POWERED_ON: 'Attach pads to patient\'s bare chest.',
  PADS_ATTACHING: 'Place both pads on patient.',
  PADS_ATTACHED: 'Pads attached. Press Analyze.',
  ANALYZING: 'Analyzing… do not touch the patient.',
  SHOCK_ADVISED: 'Shock advised. Clear the patient. Press the shock button.',
  NO_SHOCK_ADVISED: 'No shock advised. Begin CPR.',
  SHOCKING: 'Stand clear. Delivering shock…',
  POST_SHOCK: 'Resume CPR. Push hard and fast.',
};

const CPR_PROMPTS = [
  'Push hard, push fast.',
  'Minimize interruptions.',
  'Allow full chest recoil.',
  'Switch compressors if needed.',
  '100-120 compressions per minute.',
  'Depth: at least 2 inches.',
];

const CPR_CYCLE_SECONDS = 120; // 2-minute CPR cycle

/** Format seconds as M:SS */
function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Human-readable rhythm label */
function rhythmLabel(r?: CardiacRhythm): string {
  if (!r) return '—';
  const map: Partial<Record<CardiacRhythm, string>> = {
    normal_sinus: 'Normal Sinus',
    sinus_bradycardia: 'Sinus Bradycardia',
    sinus_tachycardia: 'Sinus Tachycardia',
    svt: 'SVT',
    atrial_fibrillation: 'A-Fib',
    atrial_flutter: 'A-Flutter',
    junctional: 'Junctional',
    ventricular_tachycardia: 'V-Tach',
    ventricular_fibrillation: 'V-Fib',
    polymorphic_vt: 'Polymorphic VT',
    wide_complex_unknown: 'Wide Complex',
    first_degree_av_block: '1° AV Block',
    second_degree_type1: '2° Type I',
    second_degree_type2: '2° Type II',
    third_degree_av_block: '3° AV Block',
    asystole: 'Asystole',
    pea: 'PEA',
  };
  return map[r] ?? r;
}

/* ─────────────────────────────────────────────────────────
   Inline keyframe styles (injected once)
   ───────────────────────────────────────────────────────── */

const KEYFRAMES = `
@keyframes aed-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@keyframes aed-shock-flash {
  0% { background-color: rgba(239, 68, 68, 0); }
  15% { background-color: rgba(239, 68, 68, 0.6); }
  40% { background-color: rgba(255, 255, 255, 0.9); }
  60% { background-color: rgba(239, 68, 68, 0.3); }
  100% { background-color: rgba(239, 68, 68, 0); }
}
@keyframes aed-analyzing-bar {
  0% { width: 0%; }
  100% { width: 100%; }
}
@keyframes aed-shock-btn {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  50% { transform: scale(1.04); box-shadow: 0 0 16px 4px rgba(239, 68, 68, 0.5); }
}
`;

/* ─────────────────────────────────────────────────────────
   Body Avatar Sub-component (pad placement)
   ───────────────────────────────────────────────────────── */

function BodyAvatar({
  rightPadPlaced,
  leftPadPlaced,
  onPlaceRight,
  onPlaceLeft,
}: {
  rightPadPlaced: boolean;
  leftPadPlaced: boolean;
  onPlaceRight: () => void;
  onPlaceLeft: () => void;
}) {
  return (
    <div className="relative w-32 mx-auto select-none" style={{ height: 140 }} role="group" aria-label="AED pad placement diagram">
      {/* Torso outline */}
      <svg
        viewBox="0 0 120 130"
        className="w-full h-full"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        {/* Head */}
        <circle cx="60" cy="14" r="12" className="text-gray-500" />
        {/* Neck */}
        <line x1="60" y1="26" x2="60" y2="34" className="text-gray-500" />
        {/* Shoulders */}
        <line x1="24" y1="40" x2="96" y2="40" className="text-gray-500" />
        {/* Left arm */}
        <line x1="24" y1="40" x2="12" y2="80" className="text-gray-500" />
        {/* Right arm */}
        <line x1="96" y1="40" x2="108" y2="80" className="text-gray-500" />
        {/* Torso */}
        <path d="M 32 40 L 28 120 L 92 120 L 88 40" className="text-gray-500" />
        {/* Center line */}
        <line x1="60" y1="40" x2="60" y2="120" className="text-gray-600" strokeDasharray="3 3" />
      </svg>

      {/* Right clavicle pad zone */}
      <button
        onClick={onPlaceRight}
        disabled={rightPadPlaced}
        className={`absolute rounded transition-all duration-200 flex items-center justify-center text-[9px] font-bold leading-tight
          ${rightPadPlaced
            ? 'bg-green-600/80 text-white border border-green-400 cursor-default'
            : 'bg-yellow-500/30 border-2 border-dashed border-yellow-400 text-yellow-300 hover:bg-yellow-500/50 cursor-pointer'
          }`}
        style={{ top: 28, right: 18, width: 32, height: 22 }}
        title="Right infraclavicular"
        aria-label={rightPadPlaced ? 'Right AED pad placed at right infraclavicular position' : 'Place right AED pad at right infraclavicular position'}
        aria-pressed={rightPadPlaced}
      >
        {rightPadPlaced ? '✓' : 'R'}
      </button>

      {/* Left axillary pad zone */}
      <button
        onClick={onPlaceLeft}
        disabled={leftPadPlaced}
        className={`absolute rounded transition-all duration-200 flex items-center justify-center text-[9px] font-bold leading-tight
          ${leftPadPlaced
            ? 'bg-green-600/80 text-white border border-green-400 cursor-default'
            : 'bg-yellow-500/30 border-2 border-dashed border-yellow-400 text-yellow-300 hover:bg-yellow-500/50 cursor-pointer'
          }`}
        style={{ top: 60, left: 10, width: 22, height: 32 }}
        title="Left mid-axillary"
        aria-label={leftPadPlaced ? 'Left AED pad placed at left mid-axillary position' : 'Place left AED pad at left mid-axillary position'}
        aria-pressed={leftPadPlaced}
      >
        {leftPadPlaced ? '✓' : 'L'}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main AEDPanel Component
   ───────────────────────────────────────────────────────── */

export default function AEDPanel() {
  /* ── Sim store ── */
  const rhythm = useSimStore((s) => s.vitals.rhythm);
  const hr = useSimStore((s) => s.vitals.hr);
  const isArrest = useSimStore((s) => s.emergencyState.isArrest);

  /* ── AED internal state ── */
  const [aedState, setAedState] = useState<AEDState>('OFF');
  const [rightPad, setRightPad] = useState(false);
  const [leftPad, setLeftPad] = useState(false);
  const [shockCount, setShockCount] = useState(0);
  const [totalCprSeconds, setTotalCprSeconds] = useState(0);
  const [cprCountdown, setCprCountdown] = useState(CPR_CYCLE_SECONDS);
  const [cprPromptIdx, setCprPromptIdx] = useState(0);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [showShockFlash, setShowShockFlash] = useState(false);
  const [lastAnalyzedRhythm, setLastAnalyzedRhythm] = useState<CardiacRhythm | undefined>();

  /* ── Refs for intervals ── */
  const analyzeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cprIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cprPromptIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stylesInjectedRef = useRef(false);

  /* ── Inject keyframes once ── */
  useEffect(() => {
    if (stylesInjectedRef.current) return;
    const style = document.createElement('style');
    style.textContent = KEYFRAMES;
    document.head.appendChild(style);
    stylesInjectedRef.current = true;
    return () => {
      document.head.removeChild(style);
      stylesInjectedRef.current = false;
    };
  }, []);

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      if (analyzeTimerRef.current) clearTimeout(analyzeTimerRef.current);
      if (cprIntervalRef.current) clearInterval(cprIntervalRef.current);
      if (cprPromptIntervalRef.current) clearInterval(cprPromptIntervalRef.current);
      audioManager.stopCprMetronome();
      audioManager.stopAedChargeTone();
    };
  }, []);

  /* ── CPR timer management ── */
  const startCprTimer = useCallback(() => {
    // Clear existing
    if (cprIntervalRef.current) clearInterval(cprIntervalRef.current);
    if (cprPromptIntervalRef.current) clearInterval(cprPromptIntervalRef.current);

    setCprCountdown(CPR_CYCLE_SECONDS);
    setCprPromptIdx(0);

    cprIntervalRef.current = setInterval(() => {
      setCprCountdown((prev) => {
        if (prev <= 1) {
          // Timer expired — prompt re-analysis
          if (cprIntervalRef.current) clearInterval(cprIntervalRef.current);
          if (cprPromptIntervalRef.current) clearInterval(cprPromptIntervalRef.current);
          audioManager.stopCprMetronome();
          audioManager.playAedPromptTone();
          setAedState('PADS_ATTACHED');
          useSimStore.getState().logEvent('AED: CPR cycle complete. Analyze rhythm.', 'intervention', 'info');
          return 0;
        }
        // Play warning beeps at 10 seconds remaining
        if (prev === 11) {
          audioManager.playAedTimerWarning();
        }
        return prev - 1;
      });
      setTotalCprSeconds((t) => t + 1);
    }, 1000);

    // Rotate CPR coaching prompts every 15s
    cprPromptIntervalRef.current = setInterval(() => {
      setCprPromptIdx((i) => (i + 1) % CPR_PROMPTS.length);
    }, 15000);
  }, []);

  const stopCprTimer = useCallback(() => {
    if (cprIntervalRef.current) clearInterval(cprIntervalRef.current);
    if (cprPromptIntervalRef.current) clearInterval(cprPromptIntervalRef.current);
    cprIntervalRef.current = null;
    cprPromptIntervalRef.current = null;
  }, []);

  /* ── Auto-transition: pads attaching → pads attached ── */
  useEffect(() => {
    if (aedState === 'PADS_ATTACHING' && rightPad && leftPad) {
      audioManager.playAedPromptTone();
      useSimStore.getState().logEvent('AED: Pads attached.', 'intervention', 'info');
      setAedState('PADS_ATTACHED');
    }
  }, [aedState, rightPad, leftPad]);

  /* ── Handlers ── */

  const handlePowerOn = () => {
    audioManager.init(); // Must be called from user gesture (browser autoplay policy)
    setAedState('POWERED_ON');
    audioManager.playAedPowerOn();
    useSimStore.getState().logEvent('AED: Powered on.', 'intervention', 'info');
  };

  const handleAttachPads = () => {
    audioManager.playAedPromptTone();
    setAedState('PADS_ATTACHING');
  };

  const handleAnalyze = () => {
    setAedState('ANALYZING');
    setAnalyzeProgress(0);
    stopCprTimer();
    audioManager.stopCprMetronome();
    audioManager.playAedAnalyzing();

    useSimStore.getState().logEvent('AED: Analyzing rhythm…', 'intervention', 'info');

    // 3-second analysis
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / 3000) * 100);
      setAnalyzeProgress(pct);
      if (pct >= 100) clearInterval(interval);
    }, 50);

    analyzeTimerRef.current = setTimeout(() => {
      clearInterval(interval);
      setAnalyzeProgress(100);

      const currentRhythm = useSimStore.getState().vitals.rhythm;
      setLastAnalyzedRhythm(currentRhythm);

      if (currentRhythm && SHOCKABLE_RHYTHMS.includes(currentRhythm)) {
        setAedState('SHOCK_ADVISED');
        audioManager.playAedShockAdvised();
        // Start the charging whine after the alarm beeps finish (~1.8s)
        setTimeout(() => audioManager.playAedChargeTone(), 1800);
        useSimStore.getState().logEvent(
          `AED: Shockable rhythm detected — ${rhythmLabel(currentRhythm)}. Shock advised.`,
          'alert',
          'danger',
        );
      } else {
        setAedState('NO_SHOCK_ADVISED');
        audioManager.playAedNoShock();
        useSimStore.getState().logEvent(
          `AED: Non-shockable rhythm — ${rhythmLabel(currentRhythm)}. No shock advised.`,
          'alert',
          'warning',
        );
        startCprTimer();
        audioManager.startCprMetronome();
      }
    }, 3000);
  };

  const handleShock = () => {
    const currentRhythm = useSimStore.getState().vitals.rhythm;
    const nextShock = shockCount + 1;
    const energy = getEnergy(nextShock);

    setAedState('SHOCKING');
    setShowShockFlash(true);
    setShockCount(nextShock);
    audioManager.stopAedChargeTone();
    audioManager.playAedShockDischarge();

    useSimStore.getState().logEvent(
      `AED: Shock #${nextShock} delivered at ${energy}J`,
      'intervention',
      'danger',
    );

    // Determine outcome
    const prob = currentRhythm ? getConversionProbability(currentRhythm, nextShock) : 0;
    const converted = Math.random() < prob;

    // Flash lasts 800ms then transition to POST_SHOCK
    setTimeout(() => {
      setShowShockFlash(false);

      if (converted) {
        // Successful defibrillation — restore vitals
        const targetHr = 60 + Math.floor(Math.random() * 21); // 60-80
        const targetSbp = 90 + Math.floor(Math.random() * 21); // 90-110
        const targetDbp = 60 + Math.floor(Math.random() * 11); // 60-70

        // Set rhythm via setState (rhythm is a string, overrideVital expects number)
        useSimStore.setState((state) => ({
          vitals: {
            ...state.vitals,
            rhythm: 'normal_sinus' as CardiacRhythm,
            hr: targetHr,
            sbp: targetSbp,
            dbp: targetDbp,
            map: Math.round(targetDbp + (targetSbp - targetDbp) / 3),
          },
        }));

        audioManager.playAedRosc();
        useSimStore.getState().logEvent(
          `AED: Rhythm converted to Normal Sinus after shock #${nextShock}!`,
          'alert',
          'info',
        );
      }

      setAedState('POST_SHOCK');
      startCprTimer();
      audioManager.startCprMetronome();
    }, 800);
  };

  const handleReset = () => {
    stopCprTimer();
    audioManager.stopCprMetronome();
    audioManager.stopAedChargeTone();
    if (analyzeTimerRef.current) clearTimeout(analyzeTimerRef.current);
    setAedState('OFF');
    setRightPad(false);
    setLeftPad(false);
    setShockCount(0);
    setTotalCprSeconds(0);
    setCprCountdown(CPR_CYCLE_SECONDS);
    setCprPromptIdx(0);
    setAnalyzeProgress(0);
    setShowShockFlash(false);
    setLastAnalyzedRhythm(undefined);
    useSimStore.getState().logEvent('AED: Powered off / reset.', 'intervention', 'info');
  };

  /* ── Derived values ── */
  const currentEnergy = getEnergy(shockCount + 1);
  const isShockable = rhythm ? SHOCKABLE_RHYTHMS.includes(rhythm) : false;
  const isArrestRhythm = rhythm ? ARREST_RHYTHMS.includes(rhythm) : false;
  const voicePrompt = VOICE_PROMPTS[aedState] || '';
  const cprProgress = ((CPR_CYCLE_SECONDS - cprCountdown) / CPR_CYCLE_SECONDS) * 100;

  /* ─────────────────────────────────────────────────────────
     Render
     ───────────────────────────────────────────────────────── */

  return (
    <div className="relative flex flex-col bg-gray-900 border border-gray-700 rounded-lg overflow-hidden select-none"
      style={{ width: 280 }}
    >
      {/* Shock flash overlay */}
      {showShockFlash && (
        <div
          className="absolute inset-0 z-50 pointer-events-none rounded-lg"
          style={{ animation: 'aed-shock-flash 0.8s ease-out forwards' }}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          {/* AED icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span className="text-sm font-semibold text-cyan-400 tracking-wide">AED</span>
          {/* Status dot */}
          <span className={`inline-block w-2 h-2 rounded-full ${
            aedState === 'OFF' ? 'bg-gray-600' :
            aedState === 'SHOCK_ADVISED' || aedState === 'SHOCKING' ? 'bg-red-500' :
            aedState === 'ANALYZING' ? 'bg-yellow-500' :
            'bg-green-500'
          }`}
            style={aedState !== 'OFF' ? { animation: 'aed-pulse 1.5s ease-in-out infinite' } : {}}
          />
        </div>
        {aedState !== 'OFF' && (
          <button
            onClick={handleReset}
            className="text-[10px] text-gray-400 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-700"
            title="Power off / Reset"
            aria-label="Power off and reset AED"
          >
            RESET
          </button>
        )}
      </div>

      {/* ── Voice prompt bar ── */}
      {aedState !== 'OFF' && (
        <div className="px-3 py-1.5 bg-cyan-950/40 border-b border-cyan-900/50">
          <p
            className="text-[11px] text-cyan-300 font-medium tracking-wide leading-tight"
            role="status"
            aria-live="assertive"
            aria-atomic="true"
            style={
              (aedState === 'SHOCK_ADVISED')
                ? { animation: 'aed-pulse 0.8s ease-in-out infinite' }
                : {}
            }
          >
            ▸ {voicePrompt}
          </p>
        </div>
      )}

      {/* ── Status bar (rhythm + stats) ── */}
      {aedState !== 'OFF' && (
        <div className="grid grid-cols-3 gap-0 text-center border-b border-gray-700" role="status" aria-live="polite" aria-label={`AED status: rhythm ${rhythmLabel(rhythm)}, shocks delivered ${shockCount}, total CPR time ${fmt(totalCprSeconds)}`}>
          <div className="px-1 py-1.5 border-r border-gray-700" aria-hidden="true">
            <div className="text-[9px] text-gray-400 uppercase tracking-wider">Rhythm</div>
            <div className={`text-[11px] font-semibold truncate ${
              isShockable ? 'text-red-400' :
              isArrestRhythm ? 'text-yellow-400' :
              'text-green-400'
            }`}>
              {rhythmLabel(rhythm)}
            </div>
          </div>
          <div className="px-1 py-1.5 border-r border-gray-700" aria-hidden="true">
            <div className="text-[9px] text-gray-400 uppercase tracking-wider">Shocks</div>
            <div className="text-[11px] font-semibold text-orange-400">{shockCount}</div>
          </div>
          <div className="px-1 py-1.5" aria-hidden="true">
            <div className="text-[9px] text-gray-400 uppercase tracking-wider">CPR</div>
            <div className="text-[11px] font-semibold text-blue-400">{fmt(totalCprSeconds)}</div>
          </div>
        </div>
      )}

      {/* ── Main content area ── */}
      <div className="p-3 flex flex-col gap-3">

        {/* ═══ OFF ═══ */}
        {aedState === 'OFF' && (
          <div className="flex flex-col items-center gap-3 py-4">
            {isArrest && (
              <p className="text-[11px] text-red-400 font-semibold tracking-wide"
                style={{ animation: 'aed-pulse 0.8s ease-in-out infinite' }}
              >
                CARDIAC ARREST DETECTED
              </p>
            )}
            <button
              onClick={handlePowerOn}
              className={`w-16 h-16 rounded-full bg-gray-800 border-2 transition-all duration-200 flex items-center justify-center group ${
                isArrest
                  ? 'border-red-500 hover:border-red-400 hover:bg-gray-700'
                  : 'border-gray-600 hover:border-green-500 hover:bg-gray-700'
              }`}
              title="Power On"
              aria-label="Power on AED"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                className={`transition-colors ${
                  isArrest
                    ? 'text-red-400 group-hover:text-red-300'
                    : 'text-gray-500 group-hover:text-green-400'
                }`}
              >
                <line x1="12" y1="2" x2="12" y2="12" />
                <path d="M16.24 7.76a6 6 0 1 1-8.49 0" />
              </svg>
            </button>
            <span className={`text-xs ${isArrest ? 'text-red-400 font-medium' : 'text-gray-500'}`}>Power On</span>
          </div>
        )}

        {/* ═══ POWERED ON — Attach pads prompt ═══ */}
        {aedState === 'POWERED_ON' && (
          <div className="flex flex-col items-center gap-3">
            <div className="text-center">
              <p className="text-sm text-gray-300 font-medium">Attach Defibrillator Pads</p>
              <p className="text-[11px] text-gray-500 mt-1">Expose patient's chest. Apply pads firmly.</p>
            </div>
            <button
              onClick={handleAttachPads}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors"
              style={{ animation: 'aed-pulse 2s ease-in-out infinite' }}
              aria-label="Attach defibrillator pads to patient"
            >
              Attach Pads
            </button>
          </div>
        )}

        {/* ═══ PADS ATTACHING — Avatar with clickable zones ═══ */}
        {aedState === 'PADS_ATTACHING' && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-gray-400 text-center">Click each pad location to place</p>
            <BodyAvatar
              rightPadPlaced={rightPad}
              leftPadPlaced={leftPad}
              onPlaceRight={() => setRightPad(true)}
              onPlaceLeft={() => setLeftPad(true)}
            />
            {/* Pad status indicators */}
            <div className="flex gap-4 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${rightPad ? 'bg-green-500' : 'bg-gray-600'}`} />
                <span className={rightPad ? 'text-green-400' : 'text-gray-500'}>
                  R Clavicle {rightPad ? '✓' : '…'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${leftPad ? 'bg-green-500' : 'bg-gray-600'}`} />
                <span className={leftPad ? 'text-green-400' : 'text-gray-500'}>
                  L Axillary {leftPad ? '✓' : '…'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PADS ATTACHED — Ready to analyze ═══ */}
        {aedState === 'PADS_ATTACHED' && (
          <div className="flex flex-col items-center gap-3">
            {/* Pad status */}
            <div className="flex gap-3 text-[10px]">
              <span className="text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> R Pad ✓
              </span>
              <span className="text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> L Pad ✓
              </span>
            </div>
            <button
              onClick={handleAnalyze}
              className="w-full px-4 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-bold rounded transition-colors tracking-wide"
              aria-label="Analyze cardiac rhythm with AED"
            >
              ⚡ ANALYZE RHYTHM
            </button>
            <div className="text-center">
              <p className="text-[10px] text-gray-500">Energy: {currentEnergy}J</p>
              <p className="text-[10px] text-gray-500">HR: {hr ?? '—'} bpm</p>
            </div>
          </div>
        )}

        {/* ═══ ANALYZING — Progress bar ═══ */}
        {aedState === 'ANALYZING' && (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-full">
              <div className="flex justify-between text-[10px] text-yellow-400 mb-1.5">
                <span>Analyzing Rhythm…</span>
                <span>{Math.round(analyzeProgress)}%</span>
              </div>
              <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full transition-all"
                  style={{ width: `${analyzeProgress}%` }}
                />
              </div>
            </div>
            <p className="text-[11px] text-yellow-300 font-medium"
              style={{ animation: 'aed-pulse 1s ease-in-out infinite' }}
            >
              DO NOT TOUCH THE PATIENT
            </p>
          </div>
        )}

        {/* ═══ SHOCK ADVISED ═══ */}
        {aedState === 'SHOCK_ADVISED' && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-full bg-red-950/50 border border-red-800 rounded px-3 py-2 text-center">
              <p className="text-xs text-red-300 font-semibold">SHOCKABLE RHYTHM DETECTED</p>
              <p className="text-[11px] text-red-400 mt-0.5">{rhythmLabel(lastAnalyzedRhythm)}</p>
            </div>

            <button
              onClick={handleShock}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-base tracking-wider transition-colors"
              style={{ animation: 'aed-shock-btn 1s ease-in-out infinite' }}
              aria-label={`Deliver ${currentEnergy} joule shock, shock number ${shockCount + 1}`}
            >
              ⚡ SHOCK — {currentEnergy}J
            </button>

            <div className="flex gap-4 text-[10px] text-gray-400">
              <span>Shock #{shockCount + 1}</span>
              <span>Energy: {currentEnergy}J</span>
            </div>
          </div>
        )}

        {/* ═══ NO SHOCK ADVISED ═══ */}
        {aedState === 'NO_SHOCK_ADVISED' && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-full bg-yellow-950/40 border border-yellow-800 rounded px-3 py-2 text-center">
              <p className="text-xs text-yellow-300 font-semibold">NO SHOCK ADVISED</p>
              <p className="text-[11px] text-yellow-400/80 mt-0.5">{rhythmLabel(lastAnalyzedRhythm)}</p>
            </div>
            {/* CPR timer section */}
            <CprTimerDisplay
              countdown={cprCountdown}
              progress={cprProgress}
              promptIdx={cprPromptIdx}
            />
          </div>
        )}

        {/* ═══ SHOCKING — brief flash state ═══ */}
        {aedState === 'SHOCKING' && (
          <div className="flex flex-col items-center gap-2 py-4">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: 'aed-pulse 0.3s ease-in-out infinite' }}
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <p className="text-red-400 font-bold text-sm tracking-wider">DELIVERING SHOCK</p>
            <p className="text-[11px] text-red-300">{getEnergy(shockCount)}J</p>
          </div>
        )}

        {/* ═══ POST SHOCK — Resume CPR ═══ */}
        {aedState === 'POST_SHOCK' && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-full bg-blue-950/40 border border-blue-800 rounded px-3 py-2 text-center">
              <p className="text-xs text-blue-300 font-semibold">SHOCK #{shockCount} DELIVERED</p>
              <p className="text-[11px] text-blue-400/80 mt-0.5">Resume CPR immediately</p>
            </div>
            <CprTimerDisplay
              countdown={cprCountdown}
              progress={cprProgress}
              promptIdx={cprPromptIdx}
            />
          </div>
        )}
      </div>

      {/* ── Bottom bar: energy + pad status ── */}
      {aedState !== 'OFF' && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800/60 border-t border-gray-700 text-[9px] text-gray-500">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${rightPad ? 'bg-green-600' : 'bg-gray-600'}`} />
            <span className={`w-1.5 h-1.5 rounded-full ${leftPad ? 'bg-green-600' : 'bg-gray-600'}`} />
            <span>{rightPad && leftPad ? 'Pads OK' : 'Pads…'}</span>
          </div>
          <span>Next: {getEnergy(shockCount + 1)}J</span>
          <span>Total CPR: {fmt(totalCprSeconds)}</span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   CPR Timer Sub-component
   ───────────────────────────────────────────────────────── */

function CprTimerDisplay({
  countdown,
  progress,
  promptIdx,
}: {
  countdown: number;
  progress: number;
  promptIdx: number;
}) {
  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex justify-between items-center text-[10px]">
        <span className="text-blue-400 font-medium">CPR Timer</span>
        <span className="text-blue-300 font-mono">{fmt(countdown)}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-linear"
          style={{
            width: `${progress}%`,
            backgroundColor: progress > 85 ? '#eab308' : '#3b82f6',
          }}
        />
      </div>

      {/* CPR coaching prompt */}
      <div className="bg-gray-800 rounded px-2 py-1.5 text-center">
        <p className="text-[11px] text-cyan-300 font-medium">
          {CPR_PROMPTS[promptIdx]}
        </p>
      </div>

      {/* Re-analyze hint when timer is close */}
      {countdown <= 10 && countdown > 0 && (
        <p className="text-[10px] text-yellow-400 text-center"
          style={{ animation: 'aed-pulse 0.8s ease-in-out infinite' }}
        >
          Stop CPR. Analyzing rhythm…
        </p>
      )}
    </div>
  );
}
