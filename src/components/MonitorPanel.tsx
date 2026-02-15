import { useEffect, useRef } from 'react';
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

export function MonitorPanel({ vitals, history }: MonitorPanelProps) {
  const ecgCanvasRef = useRef<HTMLCanvasElement>(null);
  const plethCanvasRef = useRef<HTMLCanvasElement>(null);
  const capnoCanvasRef = useRef<HTMLCanvasElement>(null);

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
    const pixelsPerSecond = width / 4; // 4 seconds visible
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
    const pixelsPerSecond = width / 4;
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
  }, [vitals.hr]);

  // Draw capnography
  useEffect(() => {
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
    const pixelsPerSecond = width / 10;
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
  }, [vitals.rr, vitals.etco2]);

  return (
    <div className="bg-sim-panel rounded-lg p-4">
      <div className="grid grid-cols-[1fr_200px] gap-4">
        {/* Waveforms */}
        <div className="space-y-2">
          {/* ECG */}
          <div className="relative">
            <span className="absolute top-1 left-2 text-sim-ecg text-xs font-mono">II</span>
            <canvas
              ref={ecgCanvasRef}
              width={400}
              height={60}
              className="w-full bg-sim-panel rounded"
            />
          </div>
          {/* SpO2 Pleth */}
          <div className="relative">
            <span className="absolute top-1 left-2 text-sim-spo2 text-xs font-mono">Pleth</span>
            <canvas
              ref={plethCanvasRef}
              width={400}
              height={50}
              className="w-full bg-sim-panel rounded"
            />
          </div>
          {/* Capnography */}
          <div className="relative">
            <span className="absolute top-1 left-2 text-sim-capno text-xs font-mono">CO₂</span>
            <canvas
              ref={capnoCanvasRef}
              width={400}
              height={50}
              className="w-full bg-sim-panel rounded"
            />
          </div>
        </div>

        {/* Numeric Values */}
        <div className="space-y-3 font-mono text-right">
          <div>
            <div className="text-sim-hr text-3xl font-bold">{Math.round(vitals.hr)}</div>
            <div className="text-sim-text-secondary text-xs">HR bpm</div>
          </div>
          <div>
            <div className="text-sim-spo2 text-3xl font-bold">{Math.round(vitals.spo2)}</div>
            <div className="text-sim-text-secondary text-xs">SpO₂ %</div>
          </div>
          <div>
            <div className="text-sim-bp text-2xl font-bold">
              {Math.round(vitals.sbp)}/{Math.round(vitals.dbp)}
            </div>
            <div className="text-sim-text-secondary text-xs">BP mmHg</div>
          </div>
          <div>
            <div className="text-sim-rr text-2xl font-bold">{Math.round(vitals.rr)}</div>
            <div className="text-sim-text-secondary text-xs">RR /min</div>
          </div>
          <div>
            <div className="text-sim-capno text-2xl font-bold">{Math.round(vitals.etco2)}</div>
            <div className="text-sim-text-secondary text-xs">EtCO₂</div>
          </div>
        </div>
      </div>
    </div>
  );
}
