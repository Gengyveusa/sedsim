import { useEffect, useRef, useState, useCallback } from 'react';
import { Vitals, CardiacRhythm } from '../types';
import { isPulselessRhythm, isLethalRhythm } from '../engine/cardiacRhythm';

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

// ── ECG Waveform Templates ────────────────────────────────────────────────────
// Each template is an array of [phase(0-1), amplitude] control points.
// Negative amplitude = downward deflection on monitor.

type WaveformPoint = [number, number];

// Normal sinus rhythm – classic P-QRS-T
const TEMPLATE_NORMAL: WaveformPoint[] = [
  [0, 0], [0.08, 0], [0.10, -3], [0.14, 0], [0.16, 0],
  [0.22, 0], [0.24, 2], [0.25, 5],
  [0.27, -35], [0.30, -38],
  [0.32, 8], [0.34, 3], [0.36, 0],
  [0.42, 0], [0.48, -8], [0.55, -10], [0.62, -6], [0.66, 0],
  [0.70, 0], [1.0, 0],
];

// No P wave – narrow QRS (junctional / SVT baseline beat)
const TEMPLATE_NARROW_NO_P: WaveformPoint[] = [
  [0, 0], [0.20, 0],
  [0.24, 2], [0.25, 5],
  [0.27, -35], [0.30, -38],
  [0.32, 8], [0.34, 3], [0.36, 0],
  [0.42, 0], [0.50, -8], [0.58, -10], [0.64, -6], [0.68, 0],
  [1.0, 0],
];

// Wide QRS (VTach / LBBB-style)
const TEMPLATE_WIDE_QRS: WaveformPoint[] = [
  [0, 0], [0.18, 0],
  [0.22, -5], [0.28, -20],
  [0.33, 30], [0.40, -8],
  [0.46, 0], [0.55, -6], [0.60, -4], [0.65, 0],
  [1.0, 0],
];

// First-degree AV block – normal PQRS but P is earlier (wider gap)
const TEMPLATE_1ST_DEGREE: WaveformPoint[] = [
  [0, 0], [0.05, 0], [0.07, -3], [0.12, 0], [0.14, 0],   // P wave
  [0.30, 0], [0.32, 2], [0.33, 5],                         // long PR gap then QRS
  [0.35, -35], [0.38, -38],
  [0.40, 8], [0.42, 3], [0.44, 0],
  [0.50, 0], [0.56, -8], [0.63, -10], [0.70, -6], [0.74, 0],
  [1.0, 0],
];

function interpolateTemplate(template: WaveformPoint[], phase: number): number {
  for (let i = 0; i < template.length - 1; i++) {
    const [p0, a0] = template[i];
    const [p1, a1] = template[i + 1];
    if (phase >= p0 && phase < p1) {
      const t = (phase - p0) / (p1 - p0);
      const tSmooth = t * t * (3 - 2 * t);
      return a0 + (a1 - a0) * tSmooth;
    }
  }
  return 0;
}

// Sawtooth flutter-wave baseline (atrial flutter F-waves)
function flutterBaseline(phase: number): number {
  // ~4 F-waves per QRS cycle → sawtooth
  const fPhase = (phase * 4) % 1;
  return fPhase < 0.6 ? -(fPhase / 0.6) * 8 : ((fPhase - 0.6) / 0.4) * 8 - 8;
}

// VFib: sum of sinusoids at randomish frequencies – seeded by time for smooth animation
const VFIB_FREQS = [2.1, 3.7, 5.3, 7.1, 4.8]; // Hz (relative)
const VFIB_AMPS  = [12,  8,   5,   4,   6];

function vfibWaveform(phase: number, coarseVsFine: number, phaseOffset: number): number {
  // coarseVsFine: 1 = coarse (early), 0 = fine (late)
  const scale = 0.4 + 0.6 * coarseVsFine;
  let val = 0;
  for (let i = 0; i < VFIB_FREQS.length; i++) {
    val += VFIB_AMPS[i] * Math.sin(2 * Math.PI * (phase * VFIB_FREQS[i] + phaseOffset + i * 0.37));
  }
  return val * scale;
}

// Polymorphic VT / Torsades: waxing-waning sinusoidal envelope on wide QRS
function torsadesWaveform(phase: number, cycleIndex: number): number {
  const envelope = Math.abs(Math.sin(cycleIndex * 0.3));
  const base = interpolateTemplate(TEMPLATE_WIDE_QRS, phase);
  return base * (0.3 + envelope * 1.4);
}

/**
 * Select the ECG waveform value for a given rhythm, phase, and cycle index.
 * Returns amplitude in the same units as ECG_TEMPLATE (peak ~38 units).
 */
function interpolateECGForRhythm(
  rhythm: CardiacRhythm,
  phase: number,
  cycleIndex: number,
  _hr: number,
  vfibOffset: number
): number {
  switch (rhythm) {
    case 'normal_sinus':
    case 'sinus_bradycardia':
    case 'sinus_tachycardia':
      return interpolateTemplate(TEMPLATE_NORMAL, phase);

    case 'first_degree_av_block':
      return interpolateTemplate(TEMPLATE_1ST_DEGREE, phase);

    case 'second_degree_type1': {
      // Wenckebach: PR lengthens over 3 beats then dropped QRS
      const beatInCycle = cycleIndex % 4;
      if (beatInCycle === 3) return 0; // dropped beat
      const extraPR = beatInCycle * 0.06; // 0, 0.06, 0.12
      const shifted = Math.max(0, phase - extraPR);
      return interpolateTemplate(TEMPLATE_NORMAL, shifted > 0.14 && phase < extraPR ? 0 : shifted);
    }

    case 'second_degree_type2': {
      // Fixed PR, every 3rd QRS dropped
      const beatMod = cycleIndex % 3;
      if (beatMod === 2) return 0;
      return interpolateTemplate(TEMPLATE_NORMAL, phase);
    }

    case 'third_degree_av_block': {
      // Independent P-wave at ~75 bpm, wide QRS at ~40 bpm
      const pPhase = (phase * 1.875) % 1; // P waves at higher rate
      const pVal = pPhase < 0.15 ? interpolateTemplate(TEMPLATE_NORMAL, pPhase * 4) * 0.3 : 0;
      return pVal + interpolateTemplate(TEMPLATE_WIDE_QRS, phase) * 0.7;
    }

    case 'svt':
    case 'junctional':
      return interpolateTemplate(TEMPLATE_NARROW_NO_P, phase);

    case 'atrial_fibrillation': {
      // Fibrillatory baseline + narrow QRS (no P wave)
      const fibNoise = Math.sin(phase * 47) * 1.5 + Math.sin(phase * 73) * 1.0;
      return fibNoise + interpolateTemplate(TEMPLATE_NARROW_NO_P, phase) * 0.9;
    }

    case 'atrial_flutter': {
      const flutter = flutterBaseline(phase);
      // QRS every 4th F-wave (2:1 or 3:1 – show 2:1 for clarity)
      return flutter + interpolateTemplate(TEMPLATE_NARROW_NO_P, phase) * 0.85;
    }

    case 'ventricular_tachycardia':
    case 'wide_complex_unknown':
      return interpolateTemplate(TEMPLATE_WIDE_QRS, phase);

    case 'polymorphic_vt':
      return torsadesWaveform(phase, cycleIndex);

    case 'ventricular_fibrillation':
      return vfibWaveform(phase, 1.0, vfibOffset);

    case 'pea':
      // Organised-looking narrow rhythm but haemodynamics show no output
      return interpolateTemplate(TEMPLATE_NARROW_NO_P, phase) * 0.7;

    case 'asystole':
      // Near-flat line with very slight noise
      return (Math.random() - 0.5) * 1.2;

    default:
      return interpolateTemplate(TEMPLATE_NORMAL, phase);
  }
}

// Compute per-beat RR interval variation for irregular rhythms
function getRRVariation(rhythm: CardiacRhythm, baseRR: number): number {
  switch (rhythm) {
    case 'atrial_fibrillation':
      // Irregularly irregular: vary ±40% around mean
      return baseRR * (0.6 + Math.random() * 0.8);
    case 'second_degree_type1':
    case 'second_degree_type2':
      return baseRR * (0.9 + Math.random() * 0.2);
    default:
      return baseRR;
  }
}

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

// Sweep-style waveform renderer with scale ticks
function drawSweepWaveform(
  canvas: HTMLCanvasElement,
  color: string,
  waveformFn: (phase: number) => number,
  _sweepX: number,
  cyclePixels: number,
  baselineY: number,
  amplitude: number,
  scaleTicks?: number[],
  scaleMin?: number,
  scaleMax?: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;
  const marginLeft = scaleTicks ? 28 : 0;

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  // Draw subtle grid
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 0.5;
  for (let gy = 0; gy < height; gy += 20) {
    ctx.beginPath();
    ctx.moveTo(marginLeft, gy);
    ctx.lineTo(width, gy);
    ctx.stroke();
  }
  for (let gx = marginLeft; gx < width; gx += 20) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, height);
    ctx.stroke();
  }

  // Draw scale ticks if provided
  if (scaleTicks && scaleMin !== undefined && scaleMax !== undefined) {
    drawScaleTicks(ctx, scaleTicks, scaleMin, scaleMax, height, width, marginLeft);
  }

  // Draw waveform trace continuously across full canvas width
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  for (let x = marginLeft; x < width; x++) {
    const phase = ((x - marginLeft) % cyclePixels) / cyclePixels;
    const val = waveformFn(phase);
    const y = baselineY + val * amplitude;

    if (x === marginLeft) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
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

    // Advance VFib phase offset for animation (stored in ref, not module-level)
    vfibOffsetRef.current += 0.012;
    const vfibOffset = vfibOffsetRef.current;

    // ECG
    const ecgCanvas = ecgCanvasRef.current;
    if (ecgCanvas) {
      const baseCycleLen = (60 / hr) * (ecgCanvas.width / 8);
      const cycleLen = getRRVariation(currentRhythm, baseCycleLen);

      // Track cycle index for Wenckebach / Torsades envelope
      const phase = (sweepRef.current % cycleLen) / cycleLen;
      if (phase < prevPhaseRef.current) {
        cycleIndexRef.current += 1;
      }
      prevPhaseRef.current = phase;

      const ci = cycleIndexRef.current;
      drawSweepWaveform(
        ecgCanvas, COLORS.ecg,
        (p) => interpolateECGForRhythm(currentRhythm, p, ci, hr, vfibOffset),
        sweepRef.current % ecgCanvas.width, cycleLen,
        ecgCanvas.height / 2, 0.9,
        hrScale.ticks, hrScale.min, hrScale.max
      );
    }

    // Pleth – flatline for pulseless rhythms
    if (showPleth) {
      const plethCanvas = plethCanvasRef.current;
      if (plethCanvas) {
        if (pulseless) {
          // Draw flatline
          drawSweepWaveform(
            plethCanvas, COLORS.spo2,
            () => 0,
            sweepRef.current % plethCanvas.width,
            plethCanvas.width,
            plethCanvas.height / 2, 0.7,
            spo2Scale.ticks, spo2Scale.min, spo2Scale.max
          );
        } else {
          const cycleLen = (60 / hr) * (plethCanvas.width / 8);
          drawSweepWaveform(
            plethCanvas, COLORS.spo2, plethWaveform,
            sweepRef.current % plethCanvas.width, cycleLen,
            plethCanvas.height * 0.6, 0.7,
            spo2Scale.ticks, spo2Scale.min, spo2Scale.max
          );
        }
      }
    }

    // Capno
    if (showCapno) {
      const capnoCanvas = capnoCanvasRef.current;
      if (capnoCanvas) {
        if (rr === 0) {
          // Respiratory arrest → flatline
          drawSweepWaveform(
            capnoCanvas, COLORS.capno,
            () => 0,
            sweepRef.current % capnoCanvas.width,
            capnoCanvas.width,
            capnoCanvas.height - 5, 1,
            etco2Scale.ticks, etco2Scale.min, etco2Scale.max
          );
        } else {
          const cycleLen = (60 / rr) * (capnoCanvas.width / 8);
          const etco2H = (etco2 / 60) * (capnoCanvas.height - 10);
          drawSweepWaveform(
            capnoCanvas, COLORS.capno,
            (phase) => capnoWaveform(phase, etco2H),
            sweepRef.current % capnoCanvas.width, cycleLen,
            capnoCanvas.height - 5, 1,
            etco2Scale.ticks, etco2Scale.min, etco2Scale.max
          );
        }
      }
    }

    sweepRef.current += 1.5;
    animRef.current = requestAnimationFrame(drawAll);
  }, [vitals.hr, vitals.rr, vitals.etco2, vitals.rhythm, showPleth, showCapno, hrScale, spo2Scale, etco2Scale]);

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
