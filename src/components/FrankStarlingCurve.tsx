import { Vitals, Patient, MOASSLevel } from '../types';

interface FrankStarlingProps {
  vitals: Vitals;
  patient: Patient;
  moass: MOASSLevel;
  combinedEff: number;
  pkStates: Record<string, { ce: number }>;
}

// PV loop engine: models the 4 phases of the cardiac cycle
// 1. Filling (diastole) - volume increases along EDPVR
// 2. Isovolumic contraction - pressure rises at constant volume
// 3. Ejection - volume decreases along ESPVR
// 4. Isovolumic relaxation - pressure drops at constant volume

function computeLoop(
  ees: number,    // end-systolic elastance (ESPVR slope) - contractility
  edpScale: number, // EDPVR compliance factor
  vedv: number,   // end-diastolic volume (mL)
  vesv: number,   // end-systolic volume (mL)
  peakSys: number // peak systolic pressure (mmHg)
): [number, number][] {
  const pts: [number, number][] = [];
  const N = 20;

  // EDPVR: P = edpScale * (V - 10)^2 / 1000  (exponential compliance)
  const edpvr = (v: number) => edpScale * Math.pow(Math.max(0, v - 10), 2) / 1000;
  // ESPVR: P = ees * (V - V0), V0 ~ 5 mL
  const espvr = (v: number) => Math.max(0, ees * (v - 5));

  // Phase 1: Filling (along EDPVR from ESV to EDV)
  for (let i = 0; i <= N; i++) {
    const v = vesv + (vedv - vesv) * (i / N);
    pts.push([v, edpvr(v)]);
  }

  // Phase 2: Isovolumic contraction (at EDV, pressure rises)
  const pEdp = edpvr(vedv);
  const pEsp = Math.min(peakSys, espvr(vedv));
  for (let i = 1; i <= N; i++) {
    const p = pEdp + (pEsp - pEdp) * (i / N);
    pts.push([vedv, p]);
  }

  // Phase 3: Ejection (volume decreases, pressure follows arc)
  for (let i = 1; i <= N; i++) {
    const frac = i / N;
    const v = vedv - (vedv - vesv) * frac;
    // Pressure follows a curve peaking mid-ejection
    const pStart = pEsp;
    const pEnd = espvr(vesv);
    const pMid = peakSys;
    const t = frac;
    const p = pStart * (1 - t) * (1 - t) + 2 * pMid * t * (1 - t) + pEnd * t * t;
    pts.push([v, p]);
  }

  // Phase 4: Isovolumic relaxation (at ESV, pressure drops)
  const pEsvTop = espvr(vesv);
  const pEsvBot = edpvr(vesv);
  for (let i = 1; i <= N; i++) {
    const p = pEsvTop - (pEsvTop - pEsvBot) * (i / N);
    pts.push([vesv, p]);
  }

  return pts;
}

export default function FrankStarlingCurve({ vitals, patient, moass, combinedEff, pkStates }: FrankStarlingProps) {
  // === Contractility (Ees) and compliance modifiers ===
  let ees = 2.5;        // baseline end-systolic elastance
  let edpScale = 1.0;   // EDPVR stiffness (higher = stiffer ventricle)
  let vedv = 120;       // end-diastolic volume
  let peakSys = vitals.sbp || 120; // peak systolic from vitals

  // Age
  if (patient.age > 65) { ees -= 0.4; edpScale += 0.3; }
  else if (patient.age > 50) { ees -= 0.2; edpScale += 0.15; }

  // ASA class
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
    if (drug === 'ketamine' && ce > 0) { ees += ce * 0.1; peakSys += ce * 4; } // sympathomimetic
  }

  // MOASS level
  if (moass >= 4) { ees -= 0.3; peakSys -= 15; }
  else if (moass >= 2) { ees -= 0.15; peakSys -= 8; }

  // Combined effect
  ees -= combinedEff * 0.08;

  // Clamp
  ees = Math.max(0.8, Math.min(4.0, ees));
  edpScale = Math.max(0.5, Math.min(3.0, edpScale));
  vedv = Math.max(80, Math.min(160, vedv));
  peakSys = Math.max(60, Math.min(200, peakSys));

  // Compute ESV from Ees and peakSys: ESV = peakSys/Ees + V0
  let vesv = Math.max(30, Math.min(vedv - 15, peakSys / ees + 5));
  const sv = vedv - vesv;
  const ef = ((sv / vedv) * 100);

  const loopPts = computeLoop(ees, edpScale, vedv, vesv, peakSys);

  // ESPVR and EDPVR boundary lines
  const espvrLine: [number, number][] = [];
  const edpvrLine: [number, number][] = [];
  for (let v = 5; v <= 160; v += 5) {
    espvrLine.push([v, Math.max(0, ees * (v - 5))]);
    edpvrLine.push([v, edpScale * Math.pow(Math.max(0, v - 10), 2) / 1000]);
  }

  // SVG dimensions
  const W = 280, H = 200, pad = 32;
  const xMin = 0, xMax = 170, yMin = 0, yMax = 180;
  const xS = (v: number) => pad + ((v - xMin) / (xMax - xMin)) * (W - pad * 2);
  const yS = (p: number) => H - pad - ((p - yMin) / (yMax - yMin)) * (H - pad * 2);

  const loopPath = loopPts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${xS(p[0]).toFixed(1)},${yS(p[1]).toFixed(1)}`
  ).join(' ') + 'Z';

  const espvrPath = espvrLine.filter(p => p[1] <= yMax).map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${xS(p[0]).toFixed(1)},${yS(p[1]).toFixed(1)}`
  ).join(' ');

  const edpvrPath = edpvrLine.filter(p => p[1] <= yMax).map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${xS(p[0]).toFixed(1)},${yS(p[1]).toFixed(1)}`
  ).join(' ');

  // Health color
  const loopColor = ef > 55 ? '#4ade80' : ef > 40 ? '#facc15' : '#ef4444';

  return (
    <div style={{ padding: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#93c5fd', marginBottom: '4px' }}>
        Frank-Starling PV Loop
      </div>
      <svg width={W} height={H} style={{ background: '#1e293b', borderRadius: '6px' }}>
        {/* Grid */}
        {[0, 50, 100, 150].map(v => (
          <line key={`gx${v}`} x1={xS(v)} y1={pad} x2={xS(v)} y2={H - pad}
            stroke="#334155" strokeWidth={0.5} />
        ))}
        {[0, 50, 100, 150].map(p => (
          <line key={`gy${p}`} x1={pad} y1={yS(p)} x2={W - pad} y2={yS(p)}
            stroke="#334155" strokeWidth={0.5} />
        ))}
        {/* ESPVR line */}
        <path d={espvrPath} fill="none" stroke="#f87171" strokeWidth={1}
          strokeDasharray="4,3" opacity={0.6} />
        <text x={xS(60)} y={yS(ees * 55) - 4} fill="#f87171" fontSize={7} opacity={0.7}>ESPVR</text>
        {/* EDPVR line */}
        <path d={edpvrPath} fill="none" stroke="#60a5fa" strokeWidth={1}
          strokeDasharray="4,3" opacity={0.6} />
        <text x={xS(140)} y={yS(edpScale * Math.pow(130, 2) / 1000) - 4} fill="#60a5fa" fontSize={7} opacity={0.7}>EDPVR</text>
        {/* PV Loop */}
        <path d={loopPath} fill={loopColor} fillOpacity={0.15} stroke={loopColor} strokeWidth={2} />
        {/* Phase arrows */}
        <circle cx={xS(vedv)} cy={yS(loopPts[0][1])} r={3} fill="#60a5fa" />
        <text x={xS(vedv) + 4} y={yS(loopPts[0][1]) + 3} fill="#60a5fa" fontSize={7}>EDV</text>
        <circle cx={xS(vesv)} cy={yS(loopPts[loopPts.length - 1][1])} r={3} fill="#f87171" />
        <text x={xS(vesv) - 18} y={yS(loopPts[loopPts.length - 1][1]) + 3} fill="#f87171" fontSize={7}>ESV</text>
        {/* Axes */}
        <text x={W / 2} y={H - 4} textAnchor="middle" fill="#94a3b8" fontSize={9}>Volume (mL)</text>
        <text x={10} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize={9}
          transform={`rotate(-90,10,${H / 2})`}>Pressure (mmHg)</text>
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
      <div style={{ fontSize: '8px', color: '#64748b', marginTop: '2px', textAlign: 'center' }}>
        EDV {vedv.toFixed(0)} mL | ESV {vesv.toFixed(0)} mL | Peak {peakSys.toFixed(0)} mmHg
      </div>
    </div>
  );
}
