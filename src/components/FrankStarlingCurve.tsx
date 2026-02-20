// Frank-Starling Curve component
import { Vitals, Patient, MOASSLevel } from '../types';

interface FrankStarlingProps {
  vitals: Vitals;
  patient: Patient;
  moass: MOASSLevel;
  combinedEff: number;
  pkStates: Record<string, { ce: number }>;
}

// Frank-Starling curve: SV = SVmax * (1 - e^(-k * LVEDP))
// Contractility (SVmax, k) shifts curve up/down based on drugs, age, ASA
function generateCurve(svMax: number, k: number, points: number = 50): [number, number][] {
  const result: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const lvedp = (i / points) * 30; // 0-30 mmHg preload range
    const sv = svMax * (1 - Math.exp(-k * lvedp));
    result.push([lvedp, sv]);
  }
  return result;
}

export default function FrankStarlingCurve({ vitals, patient, moass, combinedEff, pkStates }: FrankStarlingProps) {
  // === Contractility modifiers ===
  let svMax = 90; // baseline max stroke volume (mL)
  let k = 0.15;   // baseline curve steepness

  // Age: reduces contractility
  if (patient.age > 65) { svMax -= 15; k -= 0.02; }
  else if (patient.age > 50) { svMax -= 8; k -= 0.01; }

  // ASA class: higher = worse baseline
  if (patient.asa >= 3) { svMax -= 12; k -= 0.02; }
  else if (patient.asa >= 2) { svMax -= 5; }

  // Comorbidities
  if (patient.copd) { svMax -= 5; }
  if (patient.hepaticImpairment) { svMax -= 8; }
  if (patient.renalImpairment) { svMax -= 6; }


  // Drug effects on contractility
  // Propofol/ketamine at higher CE reduce contractility
  for (const [drug, state] of Object.entries(pkStates)) {
    const ce = state.ce;
    if (drug === 'propofol' && ce > 0) { svMax -= ce * 3; k -= ce * 0.005; }
    if (drug === 'midazolam' && ce > 0) { svMax -= ce * 1.5; }
    if (drug === 'fentanyl' && ce > 0) { svMax -= ce * 4; k -= ce * 0.008; }
    if (drug === 'ketamine' && ce > 0) { svMax += ce * 2; k += ce * 0.003; } // ketamine is inotropic
  }

  // MOASS level effect
  if (moass >= 4) { svMax -= 10; k -= 0.02; } // deep sedation
  else if (moass >= 2) { svMax -= 5; k -= 0.01; } // moderate sedation

  // Clamp values
  svMax = Math.max(20, Math.min(120, svMax));
  k = Math.max(0.03, Math.min(0.3, k));

  // Combined effect shifts
  svMax -= combinedEff * 2;
  svMax = Math.max(20, svMax);

  const curveData = generateCurve(svMax, k);

  // Current operating point from vitals
  // Estimate LVEDP from MAP (simplified): preload ~ MAP * 0.3
  const lvedpEst = Math.max(2, Math.min(28, (vitals.map || 70) * 0.3));
  const svEst = svMax * (1 - Math.exp(-k * lvedpEst));

  // SVG dimensions
  const W = 280, H = 180, pad = 30;
  const xScale = (v: number) => pad + (v / 30) * (W - pad * 2);
  const yScale = (v: number) => H - pad - (v / 120) * (H - pad * 2);

  const pathD = curveData.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${xScale(p[0]).toFixed(1)},${yScale(p[1]).toFixed(1)}`
  ).join(' ');

  // Color based on svMax health
  const curveColor = svMax > 65 ? '#4ade80' : svMax > 45 ? '#facc15' : '#ef4444';

  return (
    <div style={{ padding: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#93c5fd', marginBottom: '4px' }}>
        Frank-Starling Curve
      </div>
      <svg width={W} height={H} style={{ background: '#1e293b', borderRadius: '6px' }}>
        {/* Grid lines */}
        {[0, 10, 20, 30].map(v => (
          <line key={`gx${v}`} x1={xScale(v)} y1={pad} x2={xScale(v)} y2={H - pad}
            stroke="#334155" strokeWidth={0.5} />
        ))}
        {[0, 30, 60, 90, 120].map(v => (
          <line key={`gy${v}`} x1={pad} y1={yScale(v)} x2={W - pad} y2={yScale(v)}
            stroke="#334155" strokeWidth={0.5} />
        ))}
        {/* Axes labels */}
        <text x={W / 2} y={H - 4} textAnchor="middle" fill="#94a3b8" fontSize={9}>LVEDP (mmHg)</text>
        <text x={10} y={H / 2} textAnchor="middle" fill="#94a3b8" fontSize={9}
          transform={`rotate(-90,10,${H / 2})`}>SV (mL)</text>
        {/* Curve */}
        <path d={pathD} fill="none" stroke={curveColor} strokeWidth={2} />
        {/* Operating point */}
        <circle cx={xScale(lvedpEst)} cy={yScale(svEst)} r={4} fill="#f472b6" stroke="#fff" strokeWidth={1} />
        {/* Labels */}
        <text x={W - pad} y={pad - 6} textAnchor="end" fill="#64748b" fontSize={8}>
          SVmax: {svMax.toFixed(0)} mL
        </text>
        <text x={W - pad} y={pad + 6} textAnchor="end" fill="#64748b" fontSize={8}>
          k: {k.toFixed(3)}
        </text>
        {/* Tick labels */}
        {[0, 10, 20, 30].map(v => (
          <text key={`tx${v}`} x={xScale(v)} y={H - pad + 12} textAnchor="middle" fill="#64748b" fontSize={8}>{v}</text>
        ))}
        {[0, 30, 60, 90, 120].map(v => (
          <text key={`ty${v}`} x={pad - 4} y={yScale(v) + 3} textAnchor="end" fill="#64748b" fontSize={8}>{v}</text>
        ))}
      </svg>
      <div style={{ fontSize: '9px', color: '#64748b', marginTop: '4px', textAlign: 'center' }}>
        Operating Point: LVEDP {lvedpEst.toFixed(0)} mmHg, SV {svEst.toFixed(0)} mL
      </div>
    </div>
  );
}
