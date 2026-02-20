import { useState, useEffect, useRef } from 'react';
import { Vitals, Patient, MOASSLevel } from '../types';

interface FrankStarlingProps {
  vitals: Vitals;
  patient: Patient;
  moass: MOASSLevel;
  combinedEff: number;
  pkStates: Record<string, { ce: number }>;
}

// Attempt to use a parametric smooth loop (like a real PV diagram)
// Uses a parametric approach: t in [0,1] traces the entire cycle
// The shape is an organic rounded loop, not a rectangle
function pvPoint(
  t: number,
  vedv: number, vesv: number,
  pEdp: number, peakSys: number, pEsv: number
): [number, number] {
  // t=0: start at bottom-left (ESV, low P) -> filling -> contraction -> ejection -> relaxation
  const tau = t * 2 * Math.PI;
  // Parametric ellipse-ish but with asymmetry
  const vMid = (vedv + vesv) / 2;
  const vAmp = (vedv - vesv) / 2;
  const pMid = (peakSys + pEdp) / 2;
  const pAmp = (peakSys - pEdp) / 2;

  // Phase-shifted cos/sin to create the loop shape
  // Add harmonics for the characteristic PV loop shape
  const v = vMid + vAmp * Math.cos(tau)
    + vAmp * 0.15 * Math.cos(2 * tau - 0.3)
    - vAmp * 0.08 * Math.cos(3 * tau);
  const p = pMid - pAmp * Math.sin(tau)
    + pAmp * 0.2 * Math.sin(2 * tau + 0.5)
    + pAmp * 0.08 * Math.sin(3 * tau - 0.2);
  return [v, Math.max(0, p)];
}

export default function FrankStarlingCurve({ vitals, patient, moass, combinedEff, pkStates }: FrankStarlingProps) {
  const [phase, setPhase] = useState(0);
  const animRef = useRef<number>(0);
  const lastTime = useRef<number>(0);

  // === Contractility modifiers ===
  let ees = 2.5;
  let edpScale = 1.0;
  let vedv = 130;
  let peakSys = vitals.sbp || 120;
  const hr = vitals.hr || 75;

  // Age
  if (patient.age > 65) { ees -= 0.4; edpScale += 0.3; }
  else if (patient.age > 50) { ees -= 0.2; edpScale += 0.15; }
  // ASA
  if (patient.asa >= 3) { ees -= 0.3; edpScale += 0.2; }
  else if (patient.asa >= 2) { ees -= 0.1; }
  // Comorbidities
  if (patient.copd) { vedv -= 5; }
  if (patient.hepaticImpairment) { ees -= 0.2; }
  if (patient.renalImpairment) { edpScale += 0.2; vedv += 10; }
  // Drug effects
  for (const [drug, state] of Object.entries(pkStates)) {
    const ce = state.ce;
    if (drug === 'propofol' && ce > 0) { ees -= ce * 0.15; peakSys -= ce * 5; }
    if (drug === 'midazolam' && ce > 0) { ees -= ce * 0.05; }
    if (drug === 'fentanyl' && ce > 0) { ees -= ce * 0.2; peakSys -= ce * 3; }
    if (drug === 'ketamine' && ce > 0) { ees += ce * 0.1; peakSys += ce * 4; }
  }
  // MOASS
  if (moass >= 4) { ees -= 0.3; peakSys -= 15; }
  else if (moass >= 2) { ees -= 0.15; peakSys -= 8; }
  ees -= combinedEff * 0.08;

  // Clamp
  ees = Math.max(0.8, Math.min(4.0, ees));
  edpScale = Math.max(0.5, Math.min(3.0, edpScale));
  vedv = Math.max(90, Math.min(160, vedv));
  peakSys = Math.max(60, Math.min(200, peakSys));

  const vesv = Math.max(30, Math.min(vedv - 20, peakSys / ees + 5));
  const sv = vedv - vesv;
  const ef = (sv / vedv) * 100;
  const pEdp = edpScale * Math.pow(Math.max(0, vedv - 10), 2) / 1000;
  const pEsv = Math.max(0, ees * (vesv - 5));

  // Animation: dot traces the loop at heart rate
  useEffect(() => {
    const cycleDuration = 60000 / Math.max(30, hr); // ms per beat
    const animate = (time: number) => {
      if (lastTime.current === 0) lastTime.current = time;
      const dt = time - lastTime.current;
      lastTime.current = time;
      setPhase(prev => {
        const next = prev + dt / cycleDuration;
        return next >= 1 ? next - 1 : next;
      });
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [hr]);

  // Generate full loop points (N=80 for smoothness)
  const N = 80;
  const loopPts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    loopPts.push(pvPoint(i / N, vedv, vesv, pEdp, peakSys, pEsv));
  }

  // Trail: draw loop up to current phase
  const trailEnd = Math.floor(phase * N);

  // ESPVR / EDPVR boundary lines
  const espvrPts: [number, number][] = [];
  const edpvrPts: [number, number][] = [];
  for (let v = 5; v <= 170; v += 5) {
    espvrPts.push([v, Math.max(0, ees * (v - 5))]);
    edpvrPts.push([v, edpScale * Math.pow(Math.max(0, v - 10), 2) / 1000]);
  }

  // SVG scaling
  const W = 280, H = 210, pad = 32;
  const xMax = 170, yMax = 180;
  const xS = (v: number) => pad + (Math.max(0, v) / xMax) * (W - pad * 2);
  const yS = (p: number) => H - pad - (Math.max(0, Math.min(p, yMax)) / yMax) * (H - pad * 2);

  // Full loop path (faded)
  const fullPath = loopPts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${xS(p[0]).toFixed(1)},${yS(p[1]).toFixed(1)}`
  ).join(' ') + 'Z';

  // Trail path (bright, drawn by the dot)
  const trailPts = loopPts.slice(0, trailEnd + 1);
  const trailPath = trailPts.length > 1
    ? trailPts.map((p, i) =>
        `${i === 0 ? 'M' : 'L'}${xS(p[0]).toFixed(1)},${yS(p[1]).toFixed(1)}`
      ).join(' ')
    : '';

  // Current dot position
  const dotPos = pvPoint(phase, vedv, vesv, pEdp, peakSys, pEsv);

  // ESPVR path
  const espvrPath = espvrPts.filter(p => p[1] <= yMax).map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${xS(p[0]).toFixed(1)},${yS(p[1]).toFixed(1)}`
  ).join(' ');
  // EDPVR path
  const edpvrPath = edpvrPts.filter(p => p[1] <= yMax && p[1] < 40).map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${xS(p[0]).toFixed(1)},${yS(p[1]).toFixed(1)}`
  ).join(' ');

  const loopColor = ef > 55 ? '#4ade80' : ef > 40 ? '#facc15' : '#ef4444';

  // Phase label
  let phaseLabel = 'Filling';
  if (phase > 0.2 && phase <= 0.4) phaseLabel = 'Isovol. Contraction';
  else if (phase > 0.4 && phase <= 0.7) phaseLabel = 'Ejection';
  else if (phase > 0.7) phaseLabel = 'Isovol. Relaxation';

  return (
    <div style={{ padding: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#93c5fd', marginBottom: '4px' }}>
        Frank-Starling PV Loop
      </div>
      <svg width={W} height={H} style={{ background: '#1e293b', borderRadius: '6px' }}>
        {/* Grid */}
        {[0, 50, 100, 150].map(v => (
          <line key={`gx${v}`} x1={xS(v)} y1={pad - 5} x2={xS(v)} y2={H - pad}
            stroke="#334155" strokeWidth={0.5} />
        ))}
        {[0, 50, 100, 150].map(p => (
          <line key={`gy${p}`} x1={pad} y1={yS(p)} x2={W - pad} y2={yS(p)}
            stroke="#334155" strokeWidth={0.5} />
        ))}
        {/* ESPVR */}
        <path d={espvrPath} fill="none" stroke="#f87171" strokeWidth={1}
          strokeDasharray="4,3" opacity={0.4} />
        <text x={xS(55)} y={yS(ees * 50) - 3} fill="#f87171" fontSize={7} opacity={0.5}>ESPVR</text>
        {/* EDPVR */}
        <path d={edpvrPath} fill="none" stroke="#60a5fa" strokeWidth={1}
          strokeDasharray="4,3" opacity={0.4} />
        <text x={xS(150)} y={yS(edpvrPts[edpvrPts.length - 3]?.[1] ?? 0) - 3} fill="#60a5fa" fontSize={7} opacity={0.5}>EDPVR</text>
        {/* Ghost loop (faded) */}
        <path d={fullPath} fill="none" stroke={loopColor} strokeWidth={1} opacity={0.2} />
        {/* Bright trail being drawn */}
        {trailPath && (
          <path d={trailPath} fill="none" stroke={loopColor} strokeWidth={2.5} opacity={0.9}
            strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* Animated dot */}
        <circle cx={xS(dotPos[0])} cy={yS(dotPos[1])} r={5}
          fill={loopColor} stroke="#fff" strokeWidth={1.5}>
          <animate attributeName="r" values="4;6;4" dur="0.3s" repeatCount="indefinite" />
        </circle>
        {/* Axes */}
        <text x={W / 2} y={H - 4} textAnchor="middle" fill="#94a3b8" fontSize={9}>Volume (mL)</text>
        <text x={8} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize={9}
          transform={`rotate(-90,8,${H / 2})`}>P (mmHg)</text>
        {/* Tick labels */}
        {[0, 50, 100, 150].map(v => (
          <text key={`tx${v}`} x={xS(v)} y={H - pad + 12} textAnchor="middle" fill="#64748b" fontSize={7}>{v}</text>
        ))}
        {[0, 50, 100, 150].map(p => (
          <text key={`ty${p}`} x={pad - 4} y={yS(p) + 3} textAnchor="end" fill="#64748b" fontSize={7}>{p}</text>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>
        <span>SV: <b style={{ color: loopColor }}>{sv.toFixed(0)}</b> mL</span>
        <span>EF: <b style={{ color: loopColor }}>{ef.toFixed(0)}%</b></span>
        <span>Ees: {ees.toFixed(2)}</span>
      </div>
      <div style={{ fontSize: '9px', color: '#93c5fd', marginTop: '2px', textAlign: 'center' }}>
        {phaseLabel}
      </div>
    </div>
  );
}
