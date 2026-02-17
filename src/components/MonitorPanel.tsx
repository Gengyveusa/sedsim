import { useEffect, useRef, useState } from 'react';
import { Vitals } from '../types';

interface MonitorPanelProps {
  vitals: Vitals;
  history: Vitals[];
}

// Colors from spec
const COLORS = {
  ecg: '#00cc66',
  spo2: '#00ff88',
  capno: '#ffcc00',
  hr: '#00ff88',
  bp: '#ff4444',
  rr: '#ffcc00',
  background: '#111118',
};

export default function MonitorPanel({ vitals, history: _history }: MonitorPanelProps) {
  const ecgCanvasRef = useRef<HTMLCanvasElement>(null);
  const plethCanvasRef = useRef<HTMLCanvasElement>(null);
  const capnoCanvasRef = useRef<HTMLCanvasElement>(null);

  // Collapsible state for Pleth and CO2
  const [showPleth, setShowPleth] = useState(true);
  const [showCapno, setShowCapno] = useState(true);

  // Draw ECG waveform
  useEffect(() => {
    const canvas = ecgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = COLORS.ecg;
    ctx.lineWidth = 2;
    ctx.beginPath();

    // Generate ECG-like waveform based on HR
    const hr = vitals.hr || 75;
    const cycleLength = 60 / hr; // seconds per beat
    const pixelsPerSecond = width / 30; // 30 seconds visible
    const cyclePixels = cycleLength * pixelsPerSecond;

    for (let x = 0; x < width; x++) {
      const phase = (x % cyclePixels) / cyclePixels;
      let y = midY;

      // P wave (small bump)
      if (phase > 0.1 && phase < 0.2) {
        y = midY - 5 * Math.sin((phase - 0.1) / 0.1 * Math.PI);
      }
      // QRS complex (sharp spike)
      else if (phase > 0.25 && phase < 0.35) {
        const qrsPhase = (phase - 0.25) / 0.1;
        if (qrsPhase < 0.3) {
          y = midY + 10 * qrsPhase / 0.3;
        } else if (qrsPhase < 0.5) {
          y = midY + 10 - 50 * (qrsPhase - 0.3) / 0.2;
        } else if (qrsPhase < 0.7) {
          y = midY - 40 + 50 * (qrsPhase - 0.5) / 0.2;
        } else {
          y = midY + 10 - 10 * (qrsPhase - 0.7) / 0.3;
        }
      }
      // T wave (rounded bump)
      else if (phase > 0.45 && phase < 0.65) {
        y = midY - 10 * Math.sin((phase - 0.45) / 0.2 * Math.PI);
      }

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }, [vitals.hr]);

  // Draw SpO2 plethysmograph
  useEffect(() => {
    if (!showPleth) return;
    const canvas = plethCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = COLORS.spo2;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const hr = vitals.hr || 75;
    const cycleLength = 60 / hr;
    const pixelsPerSecond = width / 30; // 30 seconds visible
    const cyclePixels = cycleLength * pixelsPerSecond;

    for (let x = 0; x < width; x++) {
      const phase = (x % cyclePixels) / cyclePixels;
      let y = midY;

      // Pleth waveform: systolic upstroke, dicrotic notch, diastolic decay
      if (phase < 0.15) {
        // Systolic upstroke
        y = midY + 15 - 30 * (phase / 0.15);
      } else if (phase < 0.25) {
        // Peak and start of descent
        y = midY - 15 + 10 * ((phase - 0.15) / 0.1);
      } else if (phase < 0.35) {
        // Dicrotic notch
        const notchPhase = (phase - 0.25) / 0.1;
        y = midY - 5 + 3 * Math.sin(notchPhase * Math.PI);
      } else {
        // Diastolic decay
        const decayPhase = (phase - 0.35) / 0.65;
        y = midY - 5 + 20 * decayPhase;
      }

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }, [vitals.hr, showPleth]);

  // Draw capnography
  useEffect(() => {
    if (!showCapno) return;
    const canvas = capnoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = COLORS.capno;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const rr = vitals.rr || 14;
    const etco2 = vitals.etco2 || 38;
    const cycleLength = 60 / rr;
    const pixelsPerSecond = width / 30; // 30 seconds visible
    const cyclePixels = cycleLength * pixelsPerSecond;
    const etco2Height = (etco2 / 60) * (height - 10);

    for (let x = 0; x < width; x++) {
      const phase = (x % cyclePixels) / cyclePixels;
      let y = height - 5; // Baseline at bottom

      // Capnography: Phase I (baseline), II (upstroke), III (plateau), IV (downstroke)
      if (phase < 0.1) {
        // Phase I: inspiratory baseline
        y = height - 5;
      } else if (phase < 0.2) {
        // Phase II: sharp upstroke
        const upPhase = (phase - 0.1) / 0.1;
        y = height - 5 - etco2Height * upPhase;
      } else if (phase < 0.6) {
        // Phase III: alveolar plateau with slight upslope
        const plateauPhase = (phase - 0.2) / 0.4;
        y = height - 5 - etco2Height - 3 * plateauPhase;
      } else if (phase < 0.7) {
        // Phase IV: sharp downstroke (inspiration)
        const downPhase = (phase - 0.6) / 0.1;
        y = height - 5 - etco2Height - 3 + (etco2Height + 3) * downPhase;
      } else {
        // Inspiratory phase
        y = height - 5;
      }

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }, [vitals.rr, vitals.etco2, showCapno]);

  return (
    <div className="flex gap-4">
      {/* Waveforms */}
      <div className="flex-1 space-y-1">
        {/* ECG */}
        <div className="relative">
          <span className="absolute top-1 left-2 text-xs font-bold" style={{ color: COLORS.ecg }}>II</span>
          <canvas ref={ecgCanvasRef} width={480} height={60} className="w-full rounded" style={{ background: COLORS.background }} />
        </div>

        {/* SpO2 Pleth - Collapsible */}
        <div className="relative">
          <button
            onClick={() => setShowPleth(!showPleth)}
            className="absolute top-1 left-2 text-xs font-bold z-10 hover:opacity-80 flex items-center gap-1"
            style={{ color: COLORS.spo2 }}
          >
            <span className="text-[10px]">{showPleth ? '▼' : '▶'}</span>
            Pleth
          </button>
          {showPleth && (
            <canvas ref={plethCanvasRef} width={480} height={60} className="w-full rounded" style={{ background: COLORS.background }} />
          )}
          {!showPleth && (
            <div className="w-full h-4 rounded" style={{ background: COLORS.background }} />
          )}
        </div>

        {/* Capnography - Collapsible */}
        <div className="relative">
          <button
            onClick={() => setShowCapno(!showCapno)}
            className="absolute top-1 left-2 text-xs font-bold z-10 hover:opacity-80 flex items-center gap-1"
            style={{ color: COLORS.capno }}
          >
            <span className="text-[10px]">{showCapno ? '▼' : '▶'}</span>
            CO₂
          </button>
          {showCapno && (
            <canvas ref={capnoCanvasRef} width={480} height={60} className="w-full rounded" style={{ background: COLORS.background }} />
          )}
          {!showCapno && (
            <div className="w-full h-4 rounded" style={{ background: COLORS.background }} />
          )}
        </div>
      </div>

      {/* Numeric Values */}
      <div className="flex flex-col justify-center text-right space-y-1 min-w-[80px]">
        <div>
          <span className="text-3xl font-bold" style={{ color: COLORS.hr }}>{Math.round(vitals.hr)}</span>
          <div className="text-xs text-gray-400">HR bpm</div>
        </div>
        <div>
          <span className="text-3xl font-bold" style={{ color: COLORS.spo2 }}>{Math.round(vitals.spo2)}</span>
          <div className="text-xs text-gray-400">SpO₂ %</div>
        </div>
        <div>
          <span className="text-2xl font-bold" style={{ color: COLORS.bp }}>{Math.round(vitals.sbp)}/{Math.round(vitals.dbp)}</span>
          <div className="text-xs text-gray-400">BP mmHg</div>
        </div>
        <div>
          <span className="text-2xl font-bold" style={{ color: COLORS.rr }}>{Math.round(vitals.rr)}</span>
          <div className="text-xs text-gray-400">RR /min</div>
        </div>
        <div>
          <span className="text-2xl font-bold" style={{ color: COLORS.capno }}>{Math.round(vitals.etco2)}</span>
          <div className="text-xs text-gray-400">EtCO₂</div>
        </div>
      </div>
    </div>
  );
}
