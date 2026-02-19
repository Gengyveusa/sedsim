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

// Sweep-style waveform renderer - NO vertical tracer line
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

  // Draw waveform trace with erase-ahead gap (no vertical line)
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
  // No vertical sweep/tracer line drawn
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
  const animRef = useRef(0);
  const [showPleth, setShowPleth] = useState(true);
  const [showCapno, setShowCapno] = useState(true);
  const [alarmFlash, setAlarmFlash] = useState(false);

  // Alarm flash toggle
  useEffect(() => {
    const hasAlarm = vitals.spo2 < 90 || vitals.hr < 50 || vitals.hr > 120 || vitals.sbp < 80 || vitals.rr < 6;
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

  const isAlarmActive = vitals.spo2 < 90 || vitals.hr < 50 || vitals.hr > 120 || vitals.sbp < 80 || vitals.rr < 6;

  return (
    <div style={{ background: COLORS.background, borderRadius: 8, overflow: 'hidden', border: '1px solid #222' }}>

      {/* === ROW 1: ECG + HR/SpO2 numerics === */}
      <div className="flex" style={{ borderBottom: '1px solid #1a1a2e' }}>
        {/* ECG Waveform */}
        <div className="flex-1 relative">
          <span style={{ position: 'absolute', top: 4, left: 8, color: COLORS.ecg, fontSize: 10, fontWeight: 700, zIndex: 1 }}>
            II
          </span>
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
