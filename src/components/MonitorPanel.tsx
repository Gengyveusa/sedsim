import { useEffect, useRef, useState, useCallback } from 'react';
import { Vitals, CardiacRhythm } from '../types';
import { isPulselessRhythm, isLethalRhythm } from '../engine/cardiacRhythm';
import {
  evaluateECG,
  getRRVariation,
} from '../engine/ecgWaveformEngine';

interface MonitorPanelProps {
  vitals: Vitals;
  history: Vitals[];
}

// Professional medical monitor color palette
const COLORS = {
  ecg: '#00cc66',
  spo2: '#00ffff',
  capno: '#ffcc00',
  hr: '#00cc66',
  spo2Text: '#00ffff',
  bp: '#ff4444',
  rr: '#ffcc00',
  etco2: '#ffcc00',
  background: '#0a0a12',
  gridLine: 'rgba(255,255,255,0.04)',
  scaleText: 'rgba(255,255,255,0.35)',
  dashLine: 'rgba(255,255,255,0.07)',
};

// Scale configuration for each channel
interface ScaleConfig {
  ticks: number[];
  min: number;
  max: number;
}

const DEFAULT_SCALES = {
  hr:    { ticks: [40, 60, 80, 100, 120, 140, 160], min: 40, max: 160 },
  spo2:  { ticks: [80, 85, 90, 95, 100], min: 80, max: 100 },
  bp:    { ticks: [60, 80, 100, 120, 140, 160, 180], min: 60, max: 180 },
  rr:    { ticks: [0, 5, 10, 15, 20, 25], min: 0, max: 25 },
  etco2: { ticks: [20, 30, 40, 50, 60], min: 20, max: 60 },
};

// ─── Pleth / Capno waveform generators ───────────────────────────────────────

function plethWaveform(phase: number): number {
  if (phase < 0.12) {
    const t = phase / 0.12;
    return -30 * t * t * (3 - 2 * t);
  } else if (phase < 0.22) {
    const t = (phase - 0.12) / 0.10;
    return -30 + 18 * t * t * (3 - 2 * t);
  } else if (phase < 0.35) {
    const t = (phase - 0.22) / 0.13;
    return -12 + 5 * Math.sin(t * Math.PI);
  } else {
    const t = (phase - 0.35) / 0.65;
    return -7 + 7 * t;
  }
}

function capnoWaveform(phase: number, etco2Height: number): number {
  if (phase < 0.10) return 0;
  if (phase < 0.20) {
    const t = (phase - 0.10) / 0.10;
    return -etco2Height * t * t * (3 - 2 * t);
  }
  if (phase < 0.60) {
    const t = (phase - 0.20) / 0.40;
    return -etco2Height - 3 * t;
  }
  if (phase < 0.70) {
    const t = (phase - 0.60) / 0.10;
    return (-etco2Height - 3) * (1 - t * t * (3 - 2 * t));
  }
  return 0;
}

// ─── Sweep Renderer Helpers ───────────────────────────────────────────────────

/** Grid spacing in pixels */
const GRID_STEP = 20;

/**
 * Draw grid lines within the horizontal range [x1, x2) on a canvas context.
 * Called to restore the grid after the erase zone overwrites it.
 */
function drawGridInRange(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  height: number,
) {
  ctx.save();
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([]);

  // Horizontal lines (span x1→x2)
  for (let gy = 0; gy <= height; gy += GRID_STEP) {
    ctx.beginPath();
    ctx.moveTo(x1, gy);
    ctx.lineTo(x2, gy);
    ctx.stroke();
  }
  // Vertical lines that fall within [x1, x2)
  const first = Math.ceil(x1 / GRID_STEP) * GRID_STEP;
  for (let gx = first; gx <= x2; gx += GRID_STEP) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, height);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Initialise a canvas with the dark background + full grid.
 * Called once per canvas when the component mounts.
 */
function initCanvasBg(
  canvas: HTMLCanvasElement,
  marginLeft: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);
  // Full grid
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 0.5;
  for (let gy = 0; gy <= height; gy += GRID_STEP) {
    ctx.beginPath();
    ctx.moveTo(marginLeft, gy);
    ctx.lineTo(width, gy);
    ctx.stroke();
  }
  for (let gx = marginLeft; gx < width; gx += GRID_STEP) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, height);
    ctx.stroke();
  }
}

/** Width of the leading erase zone in pixels. */
const ERASE_WIDTH = 22;

/**
 * Erase the zone [eraseStart, eraseStart + ERASE_WIDTH) on the canvas
 * (with wrapping) and restore the grid + scale-axis background in that area.
 * Uses a short gradient so the scan-line looks like a phosphor sweep bar.
 */
function eraseZone(
  ctx: CanvasRenderingContext2D,
  eraseStart: number,
  marginLeft: number,
) {
  const { width, height } = ctx.canvas;
  // Clamp so we never paint over the Y-axis scale column
  const x1 = Math.max(eraseStart, marginLeft);
  const x2 = x1 + ERASE_WIDTH;

  function clearSegment(a: number, b: number) {
    if (b <= a) return;
    const ca = Math.max(a, marginLeft);
    const cb = Math.min(b, width);
    if (cb <= ca) return;
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(ca, 0, cb - ca, height);
    drawGridInRange(ctx, ca, cb, height);
  }

  if (x2 < width) {
    clearSegment(x1, x2);
  } else {
    // Wraps around right edge
    clearSegment(x1, width);
    clearSegment(marginLeft, x2 - width);
  }
}

/**
 * Draw a single sweep step for one waveform channel.
 * Advances the write cursor from prevX to nextX, draws the new trace segment,
 * and calls eraseZone ahead of the cursor.
 *
 * @param canvas      Target visible canvas
 * @param color       Stroke colour
 * @param prevX       Write-X from previous frame
 * @param nextX       Write-X for this frame (may wrap)
 * @param prevY       Canvas-Y from previous frame
 * @param nextY       Canvas-Y for this frame
 * @param marginLeft  Left margin reserved for Y-axis scale labels
 */
function drawSweepStep(
  canvas: HTMLCanvasElement,
  color: string,
  prevX: number,
  nextX: number,
  prevY: number,
  nextY: number,
  marginLeft: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Draw trace segment (skip across-wrap connections to avoid diagonal artifact)
  if (nextX >= prevX) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(nextX, nextY);
    ctx.stroke();
    ctx.restore();
  }

  // Erase zone ahead of cursor
  eraseZone(ctx, nextX + 1, marginLeft);
}

// Sweep speed: pixels advanced per animation frame (~60 fps → 120 px/s ≈ 25 mm/s at default scale)
const SWEEP_SPEED = 2;

// Pleth delay: ~200 ms pulse-transit time → 200 ms × 120 px/s = 24 pixels
const PLETH_DELAY_PX = 24;

// Draw Y-axis scale ticks on a canvas channel
function drawScaleTicks(
  ctx: CanvasRenderingContext2D,
  ticks: number[],
  scaleMin: number,
  scaleMax: number,
  canvasHeight: number,
  canvasWidth: number,
  marginLeft: number = 28
) {
  const range = scaleMax - scaleMin;
  ctx.font = '9px monospace';
  ctx.fillStyle = COLORS.scaleText;
  ctx.textAlign = 'right';

  ticks.forEach(tick => {
    const yFrac = 1 - (tick - scaleMin) / range;
    const y = yFrac * canvasHeight;
    if (y < 2 || y > canvasHeight - 2) return;

    // Dashed gridline
    ctx.strokeStyle = COLORS.dashLine;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(marginLeft, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.fillText(String(tick), marginLeft - 2, y + 3);
  });
}

// Alarm threshold helpers
function getHRColor(hr: number): string {
  if (hr < 50 || hr > 120) return '#ff4444';
  if (hr < 60 || hr > 100) return '#ffaa00';
  return COLORS.hr;
}

function getSpO2Color(spo2: number): string {
  if (spo2 < 85) return '#ff4444';
  if (spo2 < 90) return '#ffaa00';
  return COLORS.spo2Text;
}

function getBPColor(sbp: number): string {
  if (sbp < 80 || sbp > 180) return '#ff4444';
  if (sbp < 90 || sbp > 160) return '#ffaa00';
  return COLORS.bp;
}

function getRRColor(rr: number): string {
  if (rr < 6 || rr === 0) return '#ff4444';
  if (rr < 8) return '#ffaa00';
  return COLORS.rr;
}

function getEtCO2Color(etco2: number): string {
  if (etco2 > 65 || etco2 < 15) return '#ff4444';
  if (etco2 > 55 || etco2 < 20) return '#ffaa00';
  return COLORS.etco2;
}

// Compute dynamic scale that expands when value exceeds default range
const TARGET_TICK_COUNT = 6;
const TICK_ROUNDING = 5;

function computeScale(value: number, defaultScale: ScaleConfig): ScaleConfig {
  if (value >= defaultScale.min && value <= defaultScale.max) return defaultScale;
  // Expand the range
  const margin = (defaultScale.max - defaultScale.min) * 0.2;
  const newMin = value < defaultScale.min ? Math.floor((value - margin) / 10) * 10 : defaultScale.min;
  const newMax = value > defaultScale.max ? Math.ceil((value + margin) / 10) * 10 : defaultScale.max;
  // Regenerate evenly spaced ticks rounded to TICK_ROUNDING multiples
  const step = Math.ceil((newMax - newMin) / TARGET_TICK_COUNT / TICK_ROUNDING) * TICK_ROUNDING || TICK_ROUNDING;
  const ticks: number[] = [];
  for (let t = Math.ceil(newMin / step) * step; t <= newMax; t += step) {
    ticks.push(t);
  }
  return { ticks, min: newMin, max: newMax };
}

interface ScaleToast {
  channel: string;
  visible: boolean;
}

export default function MonitorPanel({ vitals, history: _history }: MonitorPanelProps) {
  const ecgCanvasRef = useRef<HTMLCanvasElement>(null);
  const plethCanvasRef = useRef<HTMLCanvasElement>(null);
  const capnoCanvasRef = useRef<HTMLCanvasElement>(null);
  const sweepRef = useRef(0);
  const animRef = useRef(0);
  const cycleIndexRef = useRef(0);
  const prevPhaseRef = useRef(0);
  const vfibOffsetRef = useRef(0);

  // Per-channel sweep state: previous canvas-Y value and write-X position
  const ecgPrevYRef   = useRef(40);   // ECG canvas height/2
  const plethPrevYRef = useRef(33);   // pleth canvas height * 0.6
  const capnoPrevYRef = useRef(50);   // capno canvas near bottom

  // Canvas initialisation flags (reset when rhythm / scale changes)
  const ecgInitRef   = useRef(false);
  const plethInitRef = useRef(false);
  const capnoInitRef = useRef(false);
  const [showPleth, setShowPleth] = useState(true);
  const [showCapno, setShowCapno] = useState(true);
  const [alarmFlash, setAlarmFlash] = useState(false);
  const [rhythmFlash, setRhythmFlash] = useState(false);

  // Dynamic scale tracking - use refs to track current scale ranges without them being in deps
  const [hrScale, setHrScale] = useState<ScaleConfig>(DEFAULT_SCALES.hr);
  const [spo2Scale, setSpo2Scale] = useState<ScaleConfig>(DEFAULT_SCALES.spo2);
  const [etco2Scale, setEtco2Scale] = useState<ScaleConfig>(DEFAULT_SCALES.etco2);
  const hrScaleRef = useRef<ScaleConfig>(DEFAULT_SCALES.hr);
  const spo2ScaleRef = useRef<ScaleConfig>(DEFAULT_SCALES.spo2);
  const bpScaleRef = useRef<ScaleConfig>(DEFAULT_SCALES.bp);
  const rrScaleRef = useRef<ScaleConfig>(DEFAULT_SCALES.rr);
  const etco2ScaleRef = useRef<ScaleConfig>(DEFAULT_SCALES.etco2);
  const [scaleToast, setScaleToast] = useState<ScaleToast | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showScaleToast = useCallback((channel: string) => {
    setScaleToast({ channel, visible: true });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setScaleToast(null);
    }, 2500);
  }, []);

  // Update scales when vitals change
  useEffect(() => {
    const newHr = computeScale(vitals.hr, DEFAULT_SCALES.hr);
    if (newHr.max !== hrScaleRef.current.max || newHr.min !== hrScaleRef.current.min) {
      hrScaleRef.current = newHr;
      setHrScale(newHr);
      showScaleToast('HR');
    }
  }, [vitals.hr, showScaleToast]);

  useEffect(() => {
    const newSpo2 = computeScale(vitals.spo2, DEFAULT_SCALES.spo2);
    if (newSpo2.max !== spo2ScaleRef.current.max || newSpo2.min !== spo2ScaleRef.current.min) {
      spo2ScaleRef.current = newSpo2;
      setSpo2Scale(newSpo2);
      showScaleToast('SpO2');
    }
  }, [vitals.spo2, showScaleToast]);

  useEffect(() => {
    const newBp = computeScale(vitals.sbp, DEFAULT_SCALES.bp);
    if (newBp.max !== bpScaleRef.current.max || newBp.min !== bpScaleRef.current.min) {
      bpScaleRef.current = newBp;
      showScaleToast('BP');
    }
  }, [vitals.sbp, showScaleToast]);

  useEffect(() => {
    const newRr = computeScale(vitals.rr, DEFAULT_SCALES.rr);
    if (newRr.max !== rrScaleRef.current.max || newRr.min !== rrScaleRef.current.min) {
      rrScaleRef.current = newRr;
      showScaleToast('RR');
    }
  }, [vitals.rr, showScaleToast]);

  useEffect(() => {
    const newEtco2 = computeScale(vitals.etco2, DEFAULT_SCALES.etco2);
    if (newEtco2.max !== etco2ScaleRef.current.max || newEtco2.min !== etco2ScaleRef.current.min) {
      etco2ScaleRef.current = newEtco2;
      setEtco2Scale(newEtco2);
      showScaleToast('EtCO2');
    }
  }, [vitals.etco2, showScaleToast]);

  // Alarm flash toggle
  useEffect(() => {
    const hasAlarm = vitals.spo2 < 90 || vitals.hr < 50 || vitals.hr > 120 || vitals.sbp < 80 || vitals.rr < 6;
    if (!hasAlarm) { setAlarmFlash(false); return; }
    const iv = setInterval(() => setAlarmFlash((f: boolean) => !f), 500);
    return () => clearInterval(iv);
  }, [vitals.spo2, vitals.hr, vitals.sbp, vitals.rr]);

  // When HR scale changes, redraw scale column on ECG canvas and force re-init
  useEffect(() => {
    ecgInitRef.current = false;
  }, [hrScale]);

  // When SpO2 scale changes, force re-init of pleth canvas
  useEffect(() => {
    plethInitRef.current = false;
  }, [spo2Scale]);

  // When EtCO2 scale changes, force re-init of capno canvas
  useEffect(() => {
    capnoInitRef.current = false;
  }, [etco2Scale]);

  // Lethal rhythm label flash
  const rhythm = vitals.rhythm ?? 'normal_sinus';
  useEffect(() => {
    if (!isLethalRhythm(rhythm)) { setRhythmFlash(false); return; }
    const iv = setInterval(() => setRhythmFlash((f: boolean) => !f), 600);
    return () => clearInterval(iv);
  }, [rhythm]);

  // Animation loop for sweep waveforms
  const drawAll = useCallback(() => {
    const hr = vitals.hr || 75;
    const rr = vitals.rr || 14;
    const etco2 = vitals.etco2 || 38;
    const currentRhythm = vitals.rhythm ?? 'normal_sinus';
    const pulseless = isPulselessRhythm(currentRhythm);

    vfibOffsetRef.current += 0.012;
    const vfibOffset = vfibOffsetRef.current;

    // ── ECG ───────────────────────────────────────────────────────────────────
    const ecgCanvas = ecgCanvasRef.current;
    if (ecgCanvas) {
      const ctx = ecgCanvas.getContext('2d');
      if (ctx) {
        const w = ecgCanvas.width;
        const h = ecgCanvas.height;
        const ML = 28; // margin left (scale column)

        // Initialise background once
        if (!ecgInitRef.current) {
          initCanvasBg(ecgCanvas, ML);
          drawScaleTicks(ctx, hrScale.ticks, hrScale.min, hrScale.max, h, w, ML);
          ecgPrevYRef.current = h / 2;
          ecgInitRef.current = true;
        }

        const drawWidth = w - ML;
        const baseCycleLen = (60 / hr) * (drawWidth / 8);
        const cycleLen = getRRVariation(currentRhythm, baseCycleLen);

        const prevSweep = sweepRef.current;
        const nextSweep = prevSweep + SWEEP_SPEED;

        // Phase within current beat cycle
        const phase = ((nextSweep % cycleLen) + cycleLen) % cycleLen / cycleLen;
        if (phase < prevPhaseRef.current) cycleIndexRef.current += 1;
        prevPhaseRef.current = phase;

        // P-wave phase for complete heart block (independent atrial rate ~75/min)
        const pPhase = hr > 0 ? (nextSweep / (drawWidth / 8) * (75 / 60) % 1 + 1) % 1 : 0;

        const amplitude = evaluateECG(
          currentRhythm, phase, hr,
          cycleIndexRef.current, vfibOffset,
          pPhase,
        );

        // Scale: R-peak (1.0) → 30 px upward from baseline
        const ECG_SCALE = h * 0.38;
        const newY = h / 2 - amplitude * ECG_SCALE;

        const prevX = ML + (prevSweep % drawWidth);
        const nextX = ML + (nextSweep % drawWidth);
        drawSweepStep(ecgCanvas, COLORS.ecg, prevX, nextX, ecgPrevYRef.current, newY, ML);
        ecgPrevYRef.current = newY;
      }
    }

    // ── Pleth ─────────────────────────────────────────────────────────────────
    if (showPleth) {
      const plethCanvas = plethCanvasRef.current;
      if (plethCanvas) {
        const ctx = plethCanvas.getContext('2d');
        if (ctx) {
          const w = plethCanvas.width;
          const h = plethCanvas.height;
          const ML = 28;

          if (!plethInitRef.current) {
            initCanvasBg(plethCanvas, ML);
            drawScaleTicks(ctx, spo2Scale.ticks, spo2Scale.min, spo2Scale.max, h, w, ML);
            plethPrevYRef.current = h * 0.6;
            plethInitRef.current = true;
          }

          const drawWidth = w - ML;
          const prevSweep = sweepRef.current;
          const nextSweep = prevSweep + SWEEP_SPEED;

          let newY: number;
          if (pulseless) {
            newY = h / 2; // flatline
          } else {
            const cycleLen = (60 / hr) * (drawWidth / 8);
            // Pleth delayed by ~200 ms (PLETH_DELAY_PX) relative to ECG
            const plethSweep = nextSweep - PLETH_DELAY_PX;
            const phase = ((plethSweep % cycleLen) + cycleLen) % cycleLen / cycleLen;

            // Scale pleth amplitude by pulse pressure (SBP - DBP) normalised to 40 mmHg
            const pulsePressure = (vitals.sbp - vitals.dbp) || 40;
            const ppScale = Math.min(Math.max(pulsePressure / 40, 0.1), 1.8);

            const pVal = plethWaveform(phase);
            newY = h * 0.6 - pVal * (h * 0.28) * ppScale;
          }

          const prevX = ML + (prevSweep % drawWidth);
          const nextX = ML + (nextSweep % drawWidth);
          drawSweepStep(plethCanvas, COLORS.spo2, prevX, nextX, plethPrevYRef.current, newY, ML);
          plethPrevYRef.current = newY;
        }
      }
    }

    // ── Capno ─────────────────────────────────────────────────────────────────
    if (showCapno) {
      const capnoCanvas = capnoCanvasRef.current;
      if (capnoCanvas) {
        const ctx = capnoCanvas.getContext('2d');
        if (ctx) {
          const w = capnoCanvas.width;
          const h = capnoCanvas.height;
          const ML = 28;

          if (!capnoInitRef.current) {
            initCanvasBg(capnoCanvas, ML);
            drawScaleTicks(ctx, etco2Scale.ticks, etco2Scale.min, etco2Scale.max, h, w, ML);
            capnoPrevYRef.current = h - 5;
            capnoInitRef.current = true;
          }

          const drawWidth = w - ML;
          const prevSweep = sweepRef.current;
          const nextSweep = prevSweep + SWEEP_SPEED;

          let newY: number;
          if (rr === 0) {
            newY = h - 5; // flatline
          } else {
            const cycleLen = (60 / rr) * (drawWidth / 8);
            const phase = ((nextSweep % cycleLen) + cycleLen) % cycleLen / cycleLen;
            const etco2H = (etco2 / 60) * (h - 10);
            const cVal = capnoWaveform(phase, etco2H);
            newY = h - 5 + cVal;
          }

          const prevX = ML + (prevSweep % drawWidth);
          const nextX = ML + (nextSweep % drawWidth);
          drawSweepStep(capnoCanvas, COLORS.capno, prevX, nextX, capnoPrevYRef.current, newY, ML);
          capnoPrevYRef.current = newY;
        }
      }
    }

    sweepRef.current += SWEEP_SPEED;
    animRef.current = requestAnimationFrame(drawAll);
  }, [vitals.hr, vitals.rr, vitals.etco2, vitals.rhythm, vitals.sbp, vitals.dbp,
      showPleth, showCapno, hrScale, spo2Scale, etco2Scale]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(drawAll);
    return () => cancelAnimationFrame(animRef.current);
  }, [drawAll]);

  // Vital sign display helper
  const hrVal = Math.round(vitals.hr);
  const spo2Val = Math.round(vitals.spo2);
  const sbpVal = Math.round(vitals.sbp);
  const dbpVal = Math.round(vitals.dbp);
  const mapVal = Math.round(vitals.map);
  const rrVal = Math.round(vitals.rr);
  const etco2Val = Math.round(vitals.etco2);

  const isAlarmActive = vitals.spo2 < 90 || vitals.hr < 50 || vitals.hr > 120 || vitals.sbp < 80 || vitals.rr < 6;

  return (
    <div style={{ background: COLORS.background, borderRadius: 8, overflow: 'hidden', border: '1px solid #222', position: 'relative' }}>

      {/* Scale change toast notification */}
      {scaleToast && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            background: '#92400e',
            color: '#fde68a',
            padding: '2px 12px',
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            pointerEvents: 'none',
            animation: 'fadeInOut 2.5s ease-in-out',
            whiteSpace: 'nowrap',
          }}
        >
          ⚠ {scaleToast.channel} Scale Changed
        </div>
      )}

      {/* === ROW 1: ECG + HR/SpO2 numerics === */}
      <div className="flex" style={{ borderBottom: '1px solid #1a1a2e' }}>
        {/* ECG Waveform */}
        <div className="flex-1 relative">
          <span style={{ position: 'absolute', top: 4, left: 30, color: COLORS.ecg, fontSize: 10, fontWeight: 700, zIndex: 1 }}>
            II
          </span>
          {/* Rhythm label overlay */}
          {isLethalRhythm(rhythm) && (
            <span style={{
              position: 'absolute', top: 4, right: 8,
              color: '#ff2222', fontSize: 11, fontWeight: 900, zIndex: 2,
              opacity: rhythmFlash ? 1 : 0.15,
              letterSpacing: '0.08em',
              textShadow: '0 0 8px #ff0000',
            }}>
              {rhythm.replace(/_/g, ' ').toUpperCase()}
            </span>
          )}
          {(() => {
            const silentRhythms: CardiacRhythm[] = ['normal_sinus', 'sinus_bradycardia', 'sinus_tachycardia'];
            const showLabel = !isLethalRhythm(rhythm) && !silentRhythms.includes(rhythm);
            return showLabel ? (
              <span style={{
                position: 'absolute', top: 4, right: 8,
                color: '#ffaa00', fontSize: 10, fontWeight: 700, zIndex: 2,
                opacity: 0.85,
                letterSpacing: '0.06em',
              }}>
                {rhythm.replace(/_/g, ' ').toUpperCase()}
              </span>
            ) : null;
          })()}
          <canvas ref={ecgCanvasRef} width={500} height={80} style={{ width: '100%', height: 80 }} />
        </div>

        {/* HR Numeric */}
        <div style={{ width: 100, padding: '4px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '1px solid #1a1a2e' }}>
          <div style={{ fontSize: 10, color: getHRColor(hrVal), fontWeight: 700, opacity: 0.8 }}>HR <span style={{ float: 'right', fontWeight: 400 }}>bpm</span></div>
          <div style={{ fontSize: 32, fontWeight: 700, color: getHRColor(hrVal), fontFamily: 'monospace', lineHeight: 1, opacity: isAlarmActive && alarmFlash && (hrVal < 50 || hrVal > 120) ? 0.3 : 1 }}>
            {hrVal}
          </div>
        </div>

        {/* SpO2 Numeric */}
        <div style={{ width: 100, padding: '4px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '1px solid #1a1a2e' }}>
          <div style={{ fontSize: 10, color: getSpO2Color(spo2Val), fontWeight: 700, opacity: 0.8 }}>{'SpO\u2082'} <span style={{ float: 'right', fontWeight: 400 }}>%</span></div>
          <div style={{ fontSize: 32, fontWeight: 700, color: getSpO2Color(spo2Val), fontFamily: 'monospace', lineHeight: 1, opacity: isAlarmActive && alarmFlash && spo2Val < 90 ? 0.3 : 1 }}>
            {spo2Val}
          </div>
        </div>
      </div>

      {/* === ROW 2: Pleth waveform (collapsible) + BP === */}
      <div style={{ borderBottom: '1px solid #1a1a2e' }}>
        <button
          onClick={() => setShowPleth(!showPleth)}
          className="flex items-center gap-1 px-2 py-0.5 hover:opacity-80"
          style={{ color: COLORS.spo2, fontSize: '10px', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {showPleth ? '\u25BC' : '\u25B6'} Pleth
        </button>
        {showPleth && (
          <div className="flex">
            <div className="flex-1">
              <canvas ref={plethCanvasRef} width={500} height={55} style={{ width: '100%', height: 55 }} />
            </div>
            <div style={{ width: 200, padding: '4px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '1px solid #1a1a2e' }}>
              <div style={{ fontSize: 10, color: getBPColor(sbpVal), fontWeight: 700, opacity: 0.8 }}>BP <span style={{ float: 'right', fontWeight: 400 }}>mmHg</span></div>
              <div style={{ fontSize: 28, fontWeight: 700, color: getBPColor(sbpVal), fontFamily: 'monospace', lineHeight: 1 }}>
                {sbpVal}/{dbpVal}
              </div>
              <div style={{ fontSize: 11, color: getBPColor(sbpVal), fontFamily: 'monospace', opacity: 0.7 }}>MAP {mapVal}</div>
            </div>
          </div>
        )}
      </div>

      {/* === ROW 3: Capno waveform (collapsible) + RR/EtCO2 === */}
      <div>
        <button
          onClick={() => setShowCapno(!showCapno)}
          className="flex items-center gap-1 px-2 py-0.5 hover:opacity-80"
          style={{ color: COLORS.capno, fontSize: '10px', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {showCapno ? '\u25BC' : '\u25B6'} {'CO\u2082'}
        </button>
        {showCapno && (
          <div className="flex">
            <div className="flex-1">
              <canvas ref={capnoCanvasRef} width={500} height={55} style={{ width: '100%', height: 55 }} />
            </div>
            <div style={{ width: 100, padding: '4px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '1px solid #1a1a2e' }}>
              <div style={{ fontSize: 10, color: getRRColor(rrVal), fontWeight: 700, opacity: 0.8 }}>RR <span style={{ float: 'right', fontWeight: 400 }}>/min</span></div>
              <div style={{ fontSize: 28, fontWeight: 700, color: getRRColor(rrVal), fontFamily: 'monospace', lineHeight: 1 }}>
                {rrVal}
              </div>
            </div>
            <div style={{ width: 100, padding: '4px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: '1px solid #1a1a2e' }}>
              <div style={{ fontSize: 10, color: getEtCO2Color(etco2Val), fontWeight: 700, opacity: 0.8 }}>{'EtCO\u2082'}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: getEtCO2Color(etco2Val), fontFamily: 'monospace', lineHeight: 1 }}>
                {etco2Val}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
