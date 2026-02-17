import { useEffect, useRef, useState, useCallback } from 'react';
import { Vitals } from '../types';

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
  sweepLine: 'rgba(0,255,100,0.6)',
  dimText: 'rgba(255,255,255,0.3)',
};

// Clean ECG template: [phase, amplitude] pairs for one cardiac cycle
const ECG_TEMPLATE: [number, number][] = [
  [0, 0], [0.08, 0], [0.10, -3], [0.14, 0], [0.16, 0],
  [0.22, 0], [0.24, 2], [0.25, 5],
  [0.27, -35], [0.30, -38],
  [0.32, 8], [0.34, 3], [0.36, 0],
  [0.42, 0], [0.48, -8], [0.55, -10], [0.62, -6], [0.66, 0],
  [0.70, 0], [1.0, 0],
];

function interpolateECG(phase: number): number {
  for (let i = 0; i < ECG_TEMPLATE.length - 1; i++) {
    const [p0, a0] = ECG_TEMPLATE[i];
    const [p1, a1] = ECG_TEMPLATE[i + 1];
    if (phase >= p0 && phase < p1) {
      const t = (phase - p0) / (p1 - p0);
      const tSmooth = t * t * (3 - 2 * t);
      return a0 + (a1 - a0) * tSmooth;
    }
  }
  return 0;
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

// Sweep-style waveform renderer
function drawSweepWaveform(
  canvas: HTMLCanvasElement,
  color: string,
  waveformFn: (phase: number) => number,
  sweepX: number,
  cyclePixels: number,
  baselineY: number,
  amplitude: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  // Draw subtle grid
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 0.5;
  for (let gy = 0; gy < height; gy += 20) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(width, gy);
    ctx.stroke();
  }
  for (let gx = 0; gx < width; gx += 20) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, height);
    ctx.stroke();
  }

  // Draw waveform trace
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  const gapWidth = Math.max(20, width * 0.04);

  for (let x = 0; x < width; x++) {
    const dist = (sweepX - x + width) % width;
    if (dist < gapWidth) continue;

    const phase = (x % cyclePixels) / cyclePixels;
    const val = waveformFn(phase);
    const y = baselineY + val * amplitude;

    if (dist === gapWidth) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Draw sweep line
  const grad = ctx.createLinearGradient(sweepX - 8, 0, sweepX + 2, 0);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(1, color);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sweepX, 0);
  ctx.lineTo(sweepX, height);
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

export default function MonitorPanel({ vitals, history: _history }: MonitorPanelProps) {
  const ecgCanvasRef = useRef<HTMLCanvasElement>(null);
  const plethCanvasRef = useRef<HTMLCanvasElement>(null);
  const capnoCanvasRef = useRef<HTMLCanvasElement>(null);
  const sweepRef = useRef(0);
  const animRef = useRef<number>(0);

  const [showPleth, setShowPleth] = useState(true);
  const [showCapno, setShowCapno] = useState(true);
  const [alarmFlash, setAlarmFlash] = useState(false);

  // Alarm flash toggle
  useEffect(() => {
    const hasAlarm = vitals.spo2 < 90 || vitals.hr < 50 || vitals.hr > 120 ||
      vitals.sbp < 80 || vitals.rr < 6;
    if (!hasAlarm) { setAlarmFlash(false); return; }
    const iv = setInterval(() => setAlarmFlash(f => !f), 500);
    return () => clearInterval(iv);
  }, [vitals.spo2, vitals.hr, vitals.sbp, vitals.rr]);

  // Animation loop for sweep waveforms
  const drawAll = useCallback(() => {
    const hr = vitals.hr || 75;
    const rr = vitals.rr || 14;
    const etco2 = vitals.etco2 || 38;

    // ECG
    const ecgCanvas = ecgCanvasRef.current;
    if (ecgCanvas) {
      const cycleLen = (60 / hr) * (ecgCanvas.width / 8);
      drawSweepWaveform(
        ecgCanvas, COLORS.ecg, interpolateECG,
        sweepRef.current % ecgCanvas.width, cycleLen,
        ecgCanvas.height / 2, 0.9
      );
    }

    // Pleth
    if (showPleth) {
      const plethCanvas = plethCanvasRef.current;
      if (plethCanvas) {
        const cycleLen = (60 / hr) * (plethCanvas.width / 8);
        drawSweepWaveform(
          plethCanvas, COLORS.spo2, plethWaveform,
          sweepRef.current % plethCanvas.width, cycleLen,
          plethCanvas.height * 0.6, 0.7
        );
      }
    }

    // Capno
    if (showCapno) {
      const capnoCanvas = capnoCanvasRef.current;
      if (capnoCanvas) {
        const cycleLen = (60 / rr) * (capnoCanvas.width / 8);
        const etco2H = (etco2 / 60) * (capnoCanvas.height - 10);
        drawSweepWaveform(
          capnoCanvas, COLORS.capno,
          (phase) => capnoWaveform(phase, etco2H),
          sweepRef.current % capnoCanvas.width, cycleLen,
          capnoCanvas.height - 5, 1
        );
      }
    }

    sweepRef.current += 1.5;
    animRef.current = requestAnimationFrame(drawAll);
  }, [vitals.hr, vitals.rr, vitals.etco2, showPleth, showCapno]);

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

  const isAlarmActive = vitals.spo2 < 90 || vitals.hr < 50 || vitals.hr > 120 ||
    vitals.sbp < 80 || vitals.rr < 6;

  return (
    <div
      className="relative w-full select-none"
      style={{
        background: COLORS.background,
        borderRadius: '6px',
        border: isAlarmActive && alarmFlash ? '1px solid #ff4444' : '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}
    >
      {/* === ROW 1: ECG + HR/SpO2 numerics === */}
      <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {/* ECG Waveform */}
        <div className="relative flex-1" style={{ minHeight: '64px' }}>
          <span
            className="absolute top-1 left-2 text-xs font-bold z-10"
            style={{ color: COLORS.ecg, opacity: 0.7, fontSize: '10px' }}
          >
            II
          </span>
          <canvas
            ref={ecgCanvasRef}
            width={520}
            height={64}
            className="w-full h-full"
            style={{ display: 'block' }}
          />
        </div>
        {/* HR Numeric */}
        <div
          className="flex flex-col items-end justify-center px-3"
          style={{ minWidth: '90px', borderLeft: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span style={{ color: getHRColor(hrVal), fontSize: '10px', fontWeight: 600, opacity: 0.7 }}>HR bpm</span>
          <span
            style={{
              color: getHRColor(hrVal),
              fontSize: '32px',
              fontWeight: 700,
              lineHeight: 1,
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {hrVal}
          </span>
        </div>
        {/* SpO2 Numeric */}
        <div
          className="flex flex-col items-end justify-center px-3"
          style={{ minWidth: '80px', borderLeft: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span style={{ color: getSpO2Color(spo2Val), fontSize: '10px', fontWeight: 600, opacity: 0.7 }}>SpO&#8322; %</span>
          <span
            style={{
              color: getSpO2Color(spo2Val),
              fontSize: '32px',
              fontWeight: 700,
              lineHeight: 1,
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {spo2Val}
          </span>
        </div>
      </div>

      {/* === ROW 2: Pleth waveform (collapsible) + BP === */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => setShowPleth(!showPleth)}
          className="flex items-center gap-1 px-2 py-0.5 hover:opacity-80"
          style={{ color: COLORS.spo2, fontSize: '10px', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <span style={{ fontSize: '8px' }}>{showPleth ? '\u25BC' : '\u25B6'}</span> Pleth
        </button>
        {showPleth && (
          <div className="flex">
            <div className="relative flex-1" style={{ height: '48px' }}>
              <canvas
                ref={plethCanvasRef}
                width={520}
                height={48}
                className="w-full h-full"
                style={{ display: 'block' }}
              />
            </div>
            <div
              className="flex flex-col items-end justify-center px-3"
              style={{ minWidth: '170px', borderLeft: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span style={{ color: getBPColor(sbpVal), fontSize: '10px', fontWeight: 600, opacity: 0.7 }}>BP mmHg</span>
              <span
                style={{
                  color: getBPColor(sbpVal),
                  fontSize: '24px',
                  fontWeight: 700,
                  lineHeight: 1,
                  fontFamily: 'ui-monospace, monospace',
                }}
              >
                {sbpVal}/{dbpVal}
              </span>
              <span
                style={{ color: getBPColor(sbpVal), fontSize: '11px', opacity: 0.6, fontFamily: 'ui-monospace, monospace' }}
              >
                MAP {mapVal}
              </span>
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
          <span style={{ fontSize: '8px' }}>{showCapno ? '\u25BC' : '\u25B6'}</span> CO&#8322;
        </button>
        {showCapno && (
          <div className="flex">
            <div className="relative flex-1" style={{ height: '48px' }}>
              <canvas
                ref={capnoCanvasRef}
                width={520}
                height={48}
                className="w-full h-full"
                style={{ display: 'block' }}
              />
            </div>
            <div
              className="flex items-center gap-4 px-3"
              style={{ minWidth: '170px', borderLeft: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex flex-col items-end">
                <span style={{ color: getRRColor(rrVal), fontSize: '10px', fontWeight: 600, opacity: 0.7 }}>RR /min</span>
                <span
                  style={{
                    color: getRRColor(rrVal),
                    fontSize: '24px',
                    fontWeight: 700,
                    lineHeight: 1,
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {rrVal}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span style={{ color: getEtCO2Color(etco2Val), fontSize: '10px', fontWeight: 600, opacity: 0.7 }}>EtCO&#8322;</span>
                <span
                  style={{
                    color: getEtCO2Color(etco2Val),
                    fontSize: '24px',
                    fontWeight: 700,
                    lineHeight: 1,
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {etco2Val}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
