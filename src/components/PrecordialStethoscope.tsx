import { useState, useEffect, useRef, useCallback } from 'react';
import useSimStore from '../store/useSimStore';
import { audioManager } from '../utils/audio';
import type { CardiacRhythm } from '../types';

// ─── Breath sound descriptor logic ────────────────────────────────────────────

interface BreathSoundInfo {
  label: string;
  color: string;
  pulse: boolean;
}

function getBreathSoundType(
  rr: number,
  moass: number,
  airwayPatency: number,
): BreathSoundInfo {
  if (rr <= 0) return { label: 'Silent — apnea', color: 'text-red-400', pulse: true };
  if (airwayPatency < 0.3) return { label: 'Stridor — laryngospasm', color: 'text-red-400', pulse: true };
  if (airwayPatency < 0.6 && moass <= 2) return { label: 'Wheeze — bronchospasm', color: 'text-amber-400', pulse: false };
  if (moass <= 3 && airwayPatency < 0.8) return { label: 'Snoring — partial obstruction', color: 'text-amber-400', pulse: false };
  return { label: 'Vesicular — normal', color: 'text-green-400', pulse: false };
}

// ─── Heart sound descriptor logic ─────────────────────────────────────────────

function getHeartSoundDescriptor(
  _hr: number,
  sbp: number,
  rhythm?: CardiacRhythm,
): { label: string; color: string } {
  if (sbp < 60) return { label: 'S1 S2 — muffled', color: 'text-gray-500' };

  const irregularRhythms: CardiacRhythm[] = [
    'atrial_fibrillation',
    'polymorphic_vt',
    'ventricular_fibrillation',
  ];

  if (rhythm && irregularRhythms.includes(rhythm)) {
    return { label: 'S1 S2 — irregular', color: 'text-amber-400' };
  }

  return { label: 'S1 S2 — regular', color: 'text-green-400' };
}

// ─── TcCO2 trend tracking ─────────────────────────────────────────────────────

type TrendDirection = '↑' | '↓' | '→';

function computeTrendArrow(history: number[]): TrendDirection {
  if (history.length < 2) return '→';
  const recent = history[history.length - 1];
  // Compare to value ~30 seconds ago (or earliest available)
  const lookback = Math.max(0, history.length - 30);
  const old = history[lookback];
  const delta = recent - old;
  if (delta > 2) return '↑';
  if (delta < -2) return '↓';
  return '→';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrecordialStethoscope() {
  const vitals = useSimStore(s => s.vitals);
  const moass = useSimStore(s => s.moass);
  const isRunning = useSimStore(s => s.isRunning);
  const elapsedSeconds = useSimStore(s => s.elapsedSeconds);

  // Stethoscope state
  const [isPlaced, setIsPlaced] = useState(false);
  const [stethoVolume, setStethoVolume] = useState(0.5);

  // TcCO2 state
  const [tcco2Enabled, setTcco2Enabled] = useState(false);
  const [tcco2WarmupStart, setTcco2WarmupStart] = useState<number | null>(null);
  const [tcco2Offset, setTcco2Offset] = useState(5); // 3-8 mmHg
  const [tcco2OffsetDrift, setTcco2OffsetDrift] = useState(0);
  const driftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tcco2HistoryRef = useRef<number[]>([]);
  const [trendArrow, setTrendArrow] = useState<TrendDirection>('→');

  // Compute airway patency (same as MonitorPanel.tsx line 462)
  const airwayPatency = moass <= 1 ? moass * 0.15 : moass <= 2 ? 0.5 : 1.0;

  // Warm-up progress (120 simulation seconds)
  const WARMUP_DURATION = 120;
  const warmupElapsed = tcco2WarmupStart !== null
    ? Math.min(WARMUP_DURATION, elapsedSeconds - tcco2WarmupStart)
    : 0;
  const isWarmedUp = tcco2WarmupStart !== null && warmupElapsed >= WARMUP_DURATION;
  const warmupProgress = tcco2WarmupStart !== null
    ? Math.min(100, (warmupElapsed / WARMUP_DURATION) * 100)
    : 0;

  // TcCO2 value: EtCO2 + 5 (PaCO2) + offset + drift
  const tcco2Value = vitals.etco2 + 5 + tcco2Offset + tcco2OffsetDrift;

  // Alarm thresholds
  const tcco2Alarm: 'none' | 'warning' | 'critical' =
    tcco2Value > 60 ? 'critical' : tcco2Value > 50 ? 'warning' : 'none';

  // ── Stethoscope toggle ──
  const handleToggleStethoscope = useCallback(() => {
    const next = !isPlaced;
    setIsPlaced(next);
    audioManager.init();
    audioManager.setBreathSoundsEnabled(next);
    audioManager.setHeartSoundsEnabled(next);
  }, [isPlaced]);

  // ── Volume slider ──
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setStethoVolume(v);
    audioManager.setVolume(v);
  }, []);

  // ── TcCO2 enable ──
  const handleToggleTcco2 = useCallback(() => {
    if (!tcco2Enabled) {
      setTcco2Enabled(true);
      setTcco2WarmupStart(elapsedSeconds);
      setTcco2Offset(3 + Math.random() * 5); // 3-8 mmHg random offset
      setTcco2OffsetDrift(0);
      tcco2HistoryRef.current = [];
    } else {
      setTcco2Enabled(false);
      setTcco2WarmupStart(null);
      setTcco2OffsetDrift(0);
      tcco2HistoryRef.current = [];
      if (driftTimerRef.current) {
        clearInterval(driftTimerRef.current);
        driftTimerRef.current = null;
      }
    }
  }, [tcco2Enabled, elapsedSeconds]);

  // ── Offset drift: ±1 mmHg per minute, updated every 10s ──
  useEffect(() => {
    if (!tcco2Enabled || !isWarmedUp) return;

    driftTimerRef.current = setInterval(() => {
      setTcco2OffsetDrift(prev => {
        const delta = (Math.random() - 0.5) * 0.33; // ~±0.17 per 10s → ~±1 per minute
        return Math.max(-3, Math.min(3, prev + delta));
      });
    }, 10000);

    return () => {
      if (driftTimerRef.current) {
        clearInterval(driftTimerRef.current);
        driftTimerRef.current = null;
      }
    };
  }, [tcco2Enabled, isWarmedUp]);

  // ── Track TcCO2 history for trend (every 1s) ──
  useEffect(() => {
    if (!isWarmedUp || !isRunning) return;
    const history = tcco2HistoryRef.current;
    history.push(tcco2Value);
    // Keep last 60 entries (~60 seconds of data)
    if (history.length > 60) history.shift();
    setTrendArrow(computeTrendArrow(history));
  }, [elapsedSeconds, isWarmedUp, isRunning, tcco2Value]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (driftTimerRef.current) clearInterval(driftTimerRef.current);
    };
  }, []);

  // Breath / heart sound descriptors
  const breathInfo = getBreathSoundType(vitals.rr, moass, airwayPatency);
  const heartInfo = getHeartSoundDescriptor(vitals.hr, vitals.sbp, vitals.rhythm);

  return (
    <div className="space-y-3">
      {/* ── Precordial Stethoscope ── */}
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
        <h4 className="text-xs font-bold text-gray-300 mb-2 tracking-wider uppercase">
          Precordial Stethoscope
        </h4>

        {/* Toggle button */}
        <button
          onClick={handleToggleStethoscope}
          className={`w-full px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            isPlaced
              ? 'bg-green-700/60 text-green-100 border border-green-500 hover:bg-green-700/80'
              : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 hover:text-gray-200'
          }`}
        >
          {isPlaced ? 'Remove Stethoscope' : 'Place Stethoscope'}
        </button>

        {/* Active stethoscope display */}
        {isPlaced && (
          <div className="mt-2 space-y-2">
            {/* Pulsing green dot + breath descriptor */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <span className="text-xs text-gray-400">Auscultating</span>
            </div>

            {/* Breath sound descriptor */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Breath:</span>
              <span
                className={`text-xs font-semibold ${breathInfo.color} ${
                  breathInfo.pulse ? 'animate-pulse' : ''
                }`}
              >
                {breathInfo.label}
              </span>
            </div>

            {/* Heart sound descriptor */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Heart:</span>
              <span className={`text-xs font-semibold ${heartInfo.color}`}>
                {heartInfo.label}
              </span>
            </div>

            {/* Volume slider */}
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Volume</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={stethoVolume}
                onChange={handleVolumeChange}
                className="w-full accent-green-500 h-1"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── TcCO₂ Monitor ── */}
      <div
        className={`bg-gray-900/50 border rounded-lg p-3 transition-colors ${
          isWarmedUp && tcco2Alarm === 'critical'
            ? 'border-red-500 animate-pulse'
            : isWarmedUp && tcco2Alarm === 'warning'
            ? 'border-amber-500 animate-pulse'
            : 'border-gray-700'
        }`}
      >
        <h4 className="text-xs font-bold text-gray-300 mb-2 tracking-wider uppercase">
          TcCO₂ Monitor
        </h4>

        {/* Enable/Disable toggle */}
        <button
          onClick={handleToggleTcco2}
          className={`w-full px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            tcco2Enabled
              ? 'bg-yellow-700/50 text-yellow-100 border border-yellow-500/70 hover:bg-yellow-700/70'
              : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 hover:text-gray-200'
          }`}
        >
          {tcco2Enabled ? 'Disable TcCO₂' : 'Enable TcCO₂'}
        </button>

        {/* TcCO2 display */}
        {tcco2Enabled && (
          <div className="mt-2">
            {!isWarmedUp ? (
              /* Warming up state */
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Warming up...</span>
                  <span className="text-lg font-mono text-gray-600">-- mmHg</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-gray-800 rounded-full h-1.5">
                  <div
                    className="bg-yellow-500/70 h-1.5 rounded-full transition-all duration-1000"
                    style={{ width: `${warmupProgress}%` }}
                  />
                </div>
                <div className="text-xs text-gray-600 text-right">
                  {Math.ceil((WARMUP_DURATION - warmupElapsed))}s remaining
                </div>
              </div>
            ) : (
              /* Active readout */
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-2xl font-mono font-bold"
                    style={{ color: '#ffcc00' }}
                  >
                    {Math.round(tcco2Value)}
                  </span>
                  <span className="text-xs text-gray-500">mmHg</span>
                </div>
                <span
                  className={`text-lg font-mono ${
                    trendArrow === '↑'
                      ? 'text-red-400'
                      : trendArrow === '↓'
                      ? 'text-green-400'
                      : 'text-gray-500'
                  }`}
                >
                  {trendArrow}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
