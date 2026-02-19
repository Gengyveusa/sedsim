import { useEffect, useRef } from 'react';
import type { Vitals, Patient, AirwayDevice } from '../types';

interface Props {
  vitals: Vitals;
  fio2: number;
  patient: Patient;
  airwayDevice: AirwayDevice;
}

const AIRWAY_LABELS: Record<AirwayDevice, string> = {
  room_air: 'Room Air',
  nasal_cannula: 'Nasal Cannula',
  nasal_hood: 'Nasal Hood',
  oral_airway: 'OPA',
  nasal_airway: 'NPA',
  lma: 'LMA',
  ett: 'ETT',
  cricothyroidotomy: 'Cricothyroidotomy',
  tracheostomy: 'Tracheostomy',
};

/** Hill equation: SpO2 (0-100) given PaO2 and P50 */
function hillSpO2(pao2: number, p50: number, n = 2.7): number {
  if (pao2 <= 0) return 0;
  const pn = Math.pow(pao2, n);
  const p50n = Math.pow(p50, n);
  return (pn / (pn + p50n)) * 100;
}

/** Adjust P50 for pH, temperature, and PaCO2 */
function adjustedP50(pH: number, tempC: number, paco2: number): number {
  let p50 = 26.6;
  p50 *= Math.pow(10, 0.48 * (7.4 - pH));
  p50 *= Math.pow(10, 0.024 * (tempC - 37));
  // PaCO2 Bohr effect: simplified linear contribution already partially covered by pH
  const co2Shift = (paco2 - 40) * 0.02;
  p50 += co2Shift;
  return Math.max(10, p50);
}

export default function OxyHbCurve({ vitals, fio2, patient, airwayDevice }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Estimate PaO2 from alveolar gas equation
  const etco2 = vitals.etco2 ?? 38;
  const estimatedPaCO2 = etco2 + 5;
  // Alveolar gas equation: PAO2 = FiO2 * (Patm - PH2O) - PaCO2/RQ
  // 760 mmHg = atmospheric pressure, 47 mmHg = water vapor at 37°C, 0.8 = respiratory quotient
  const estimatedPaO2 = Math.max(0, fio2 * (760 - 47) - estimatedPaCO2 / 0.8);

  // Estimate physiological context
  const pH = 7.4 - (estimatedPaCO2 - 40) * 0.008; // rough pH from CO2
  const tempC = 37; // assume normothermia (no temp vitals)
  const p50 = adjustedP50(pH, tempC, estimatedPaCO2);

  // Pre-oxygenation / apnea reserve
  const isAdvancedAirway = ['lma', 'ett', 'cricothyroidotomy', 'tracheostomy'].includes(airwayDevice);
  const frcMl = 30 * patient.weight; // FRC ~30 mL/kg
  const vo2MlPerS = (3.5 * patient.weight) / 60; // VO2 ~3.5 mL/kg/min converted to mL/s
  const safeApneaSeconds = (frcMl * fio2) / vo2MlPerS;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const PAD_LEFT = 42;
    const PAD_RIGHT = 16;
    const PAD_TOP = 36;
    const PAD_BOTTOM = 36;
    const plotW = W - PAD_LEFT - PAD_RIGHT;
    const plotH = H - PAD_TOP - PAD_BOTTOM;

    const toX = (pao2: number) => PAD_LEFT + (pao2 / 120) * plotW;
    const toY = (spo2: number) => PAD_TOP + plotH - (spo2 / 100) * plotH;

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= 120; x += 20) {
      ctx.beginPath();
      ctx.moveTo(toX(x), PAD_TOP);
      ctx.lineTo(toX(x), PAD_TOP + plotH);
      ctx.stroke();
    }
    for (let y = 0; y <= 100; y += 20) {
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, toY(y));
      ctx.lineTo(PAD_LEFT + plotW, toY(y));
      ctx.stroke();
    }

    // Danger zone: SpO2 < 90 (horizontal band)
    const y90 = toY(90);
    const gradient = ctx.createLinearGradient(0, y90, 0, toY(0));
    gradient.addColorStop(0, 'rgba(239,68,68,0.08)');
    gradient.addColorStop(1, 'rgba(239,68,68,0.18)');
    ctx.fillStyle = gradient;
    ctx.fillRect(PAD_LEFT, y90, plotW, toY(0) - y90);

    // Draw the O2-Hb curve (standard, shifted, and normal for reference)
    const drawCurve = (p50Val: number, color: string, dashed = false) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = dashed ? 1 : 2;
      if (dashed) ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);
      for (let pao2 = 0; pao2 <= 120; pao2 += 0.5) {
        const spo2 = hillSpO2(pao2, p50Val);
        const x = toX(pao2);
        const y = toY(spo2);
        if (pao2 === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // Normal reference curve (gray dashed)
    drawCurve(26.6, '#334155', true);
    // Current shifted curve
    drawCurve(p50, '#38bdf8');

    // Axes
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, PAD_TOP);
    ctx.lineTo(PAD_LEFT, PAD_TOP + plotH);
    ctx.lineTo(PAD_LEFT + plotW, PAD_TOP + plotH);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#64748b';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    for (let x = 0; x <= 120; x += 20) {
      ctx.fillText(String(x), toX(x), PAD_TOP + plotH + 12);
    }
    ctx.textAlign = 'right';
    for (let y = 0; y <= 100; y += 20) {
      ctx.fillText(String(y), PAD_LEFT - 4, toY(y) + 3);
    }

    // Axis titles
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PaO₂ (mmHg)', PAD_LEFT + plotW / 2, H - 4);
    ctx.save();
    ctx.translate(11, PAD_TOP + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('SpO₂ (%)', 0, 0);
    ctx.restore();

    // P50 vertical line
    ctx.strokeStyle = '#f59e0b44';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(toX(p50), PAD_TOP);
    ctx.lineTo(toX(p50), PAD_TOP + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f59e0b';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`P50=${p50.toFixed(1)}`, toX(p50), PAD_TOP - 4);

    // Current patient dot
    const currentSpO2 = vitals.spo2;
    const dotColor = currentSpO2 >= 95 ? '#22c55e' : currentSpO2 >= 90 ? '#f59e0b' : '#ef4444';

    // Draw a crosshair
    ctx.strokeStyle = dotColor + '66';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(toX(estimatedPaO2), PAD_TOP);
    ctx.lineTo(toX(estimatedPaO2), PAD_TOP + plotH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, toY(currentSpO2));
    ctx.lineTo(PAD_LEFT + plotW, toY(currentSpO2));
    ctx.stroke();
    ctx.setLineDash([]);

    // Pulsing dot (just render solid; pulse handled by requestAnimationFrame if needed)
    const dotX = toX(Math.min(120, Math.max(0, estimatedPaO2)));
    const dotY = toY(Math.min(100, Math.max(0, currentSpO2)));
    ctx.beginPath();
    ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
    ctx.fillStyle = dotColor + '33';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // SpO2 label near dot
    ctx.fillStyle = dotColor;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = dotX > PAD_LEFT + plotW * 0.7 ? 'right' : 'left';
    ctx.fillText(`${currentSpO2.toFixed(0)}%`, dotX + (dotX > PAD_LEFT + plotW * 0.7 ? -8 : 8), dotY - 8);

    // Title / device + FiO2 label
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${AIRWAY_LABELS[airwayDevice]} | FiO₂ ${Math.round(fio2 * 100)}%`, PAD_LEFT + 2, PAD_TOP - 18);

    // P50 shift indicator
    if (Math.abs(p50 - 26.6) > 0.5) {
      const direction = p50 > 26.6 ? '→ Right-shift' : '← Left-shift';
      const shiftColor = p50 > 26.6 ? '#f87171' : '#60a5fa';
      ctx.fillStyle = shiftColor;
      ctx.font = '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(direction, PAD_LEFT + plotW, PAD_TOP - 4);
    }

      if (isAdvancedAirway && fio2 >= 0.9) {
      ctx.fillStyle = '#a78bfa';
      ctx.font = '8px monospace';
      ctx.textAlign = 'left';
      const min = Math.floor(safeApneaSeconds / 60);
      const sec = Math.round(safeApneaSeconds - min * 60);
      ctx.fillText(`Safe apnea: ~${min}m ${sec}s`, PAD_LEFT + 2, PAD_TOP + 12);
    }
  }, [vitals, fio2, airwayDevice, estimatedPaO2, p50, isAdvancedAirway, safeApneaSeconds]);

  return (
    <div className="flex flex-col items-center gap-1">
      <canvas
        ref={canvasRef}
        width={420}
        height={260}
        style={{ background: '#0f172a', borderRadius: '6px' }}
      />
      <div className="flex gap-4 text-xs font-mono text-slate-400">
        <span>PaO₂ est. <span className="text-blue-300">{estimatedPaO2.toFixed(0)} mmHg</span></span>
        <span>pH est. <span className={pH < 7.35 ? 'text-red-400' : pH > 7.45 ? 'text-blue-400' : 'text-green-400'}>{pH.toFixed(2)}</span></span>
        {isAdvancedAirway && fio2 >= 0.9 && (
          <span>Apnea reserve <span className="text-violet-400">{Math.round(safeApneaSeconds)}s</span></span>
        )}
      </div>
    </div>
  );
}
