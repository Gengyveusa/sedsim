import { useState, useEffect } from 'react';
import useSimStore from '../store/useSimStore';
import { DRUG_DATABASE } from '../engine/drugs';
import { hillEffect } from '../engine/pdModel';
import { MOASSLevel } from '../types';
import PhysiologyAvatar from './PhysiologyAvatar';

const DRUG_CLASSES: Record<string, string[]> = {
  opioid: ['fentanyl', 'remifentanil'],
  benzodiazepine: ['midazolam'],
  hypnotic: ['propofol', 'etomidate'],
  dissociative: ['ketamine'],
  alpha2: ['dexmedetomidine'],
};

const SYNERGY_PAIRS: [string, string][] = [
  ['opioid', 'benzodiazepine'],
  ['opioid', 'hypnotic'],
  ['benzodiazepine', 'hypnotic'],
  ['opioid', 'alpha2'],
];

const MOASS_COLORS: Record<MOASSLevel, string> = {
  5: '#22c55e', 4: '#84cc16', 3: '#eab308', 2: '#f97316', 1: '#ef4444', 0: '#dc2626',
};

const MOASS_LABELS = ['Unresponsive', 'Deep', 'Moderate', 'Light', 'Drowsy', 'Awake'];

// Mode types: C=Avatar, D=Radar, E=Petals (Rings and Layers removed)
type GaugeMode = 'avatar' | 'risk' | 'petals';
const MODE_LABELS: Record<GaugeMode, string> = {
  avatar: 'C: AVATAR', risk: 'D: RADAR', petals: 'E: PETALS'};

// Drug petal colors - high contrast aviation palette
const PETAL_COLORS: Record<string, string> = {
  propofol: '#3b82f6',
  midazolam: '#a855f7',
  fentanyl: '#f59e0b',
  ketamine: '#14b8a6',
  dexmedetomidine: '#ec4899',
  etomidate: '#6366f1',
  remifentanil: '#f97316',
};
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  if (endAngle - startAngle >= 360) {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`;
  }
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

function getDrugClass(drugKey: string): string | null {
  for (const [cls, drugs] of Object.entries(DRUG_CLASSES)) {
    if (drugs.includes(drugKey)) return cls;
  }
  return null;
}

// Petal path generator - creates a leaf/petal shape
function petalPath(cx: number, cy: number, angleDeg: number, innerR: number, outerR: number, spread: number): string {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const spreadRad = (spread * Math.PI) / 180;
  const tip = { x: cx + outerR * Math.cos(rad), y: cy + outerR * Math.sin(rad) };
  const left = { x: cx + innerR * Math.cos(rad - spreadRad), y: cy + innerR * Math.sin(rad - spreadRad) };
  const right = { x: cx + innerR * Math.cos(rad + spreadRad), y: cy + innerR * Math.sin(rad + spreadRad) };
  const cpDist = (outerR - innerR) * 0.7;
  const cpL = { x: left.x + cpDist * Math.cos(rad - spreadRad * 0.3), y: left.y + cpDist * Math.sin(rad - spreadRad * 0.3) };
  const cpR = { x: right.x + cpDist * Math.cos(rad + spreadRad * 0.3), y: right.y + cpDist * Math.sin(rad + spreadRad * 0.3) };
  return `M ${cx} ${cy} Q ${left.x} ${left.y} ${cpL.x} ${cpL.y} L ${tip.x} ${tip.y} L ${cpR.x} ${cpR.y} Q ${right.x} ${right.y} ${cx} ${cy} Z`;
}
export default function SedationGauge() {
  const { combinedEff, moass, pkStates, vitals, patient } = useSimStore();
  const [mode, setMode] = useState<GaugeMode>('petals');
  const [autoSwitched, setAutoSwitched] = useState(false);

  // 50% larger: 420 -> 630, outerR 185 -> 278
  const size = 630;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 278;

  // Get active sedation drugs
  const localAnesthetics = ['lidocaine_epi', 'articaine_epi', 'bupivacaine'];
  const activeDrugs = Object.entries(pkStates)
    .filter(([name, s]) => s.ce > 0.001 && !localAnesthetics.includes(name))
    .map(([name, s]) => {
      const drug = DRUG_DATABASE[name];
      if (!drug) return null;
      const effect = hillEffect(s.ce, drug.EC50, drug.gamma);
      return { key: name, name: drug.name, ce: s.ce, color: drug.color, effect, drugClass: getDrugClass(name) };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .sort((a, b) => b.effect - a.effect);

  // Detect synergies
  const activeClasses = new Set(activeDrugs.map(d => d.drugClass).filter(Boolean));
  const activeSynergies = SYNERGY_PAIRS.filter(([c1, c2]) => activeClasses.has(c1) && activeClasses.has(c2));

  // Crisis detection
  const isCrisis = vitals.spo2 < 90 || vitals.rr < 6 || vitals.hr < 45 || vitals.hr > 140;

  useEffect(() => {
    if (isCrisis && !autoSwitched) {
      setMode('risk');
      setAutoSwitched(true);
    } else if (!isCrisis && autoSwitched) {
      setAutoSwitched(false);
    }
  }, [isCrisis, autoSwitched]);

  const gaugeColor = MOASS_COLORS[moass];
  const breatheRate = vitals.rr > 0 ? (60 / vitals.rr) : 0;

  // Radar values for mode D
  const radarAxes = ['Sed', 'HR', 'SpO2', 'CO2', 'RR', 'MAP', 'Drug', 'Risk'];
  const normalize = (val: number, min: number, max: number) => Math.max(0, Math.min(1, (val - min) / (max - min)));
  const radarValues = [
    normalize(moass, 0, 5),
    normalize(vitals.hr, 40, 120) * 0.5 + 0.25,
    normalize(vitals.spo2, 70, 100),
    1 - normalize(vitals.etco2, 20, 60),
    normalize(vitals.rr, 0, 25) * 0.7 + 0.15,
    normalize(vitals.map, 50, 110) * 0.6 + 0.2,
    combinedEff,
    Math.min(1, combinedEff * 0.5 + activeSynergies.length * 0.2 + (isCrisis ? 0.5 : 0)),
  ];

  const axisCount = radarAxes.length;
  const radarR = 195;
  const radarPoints = radarValues.map((v, i) => {
    const p = polarToCartesian(cx, cy, v * radarR + 30, (i * 360 / axisCount));
    return `${p.x},${p.y}`;
  }).join(' ');
  const radarFill = isCrisis ? 'rgba(220,38,38,0.35)' : moass <= 2 ? 'rgba(249,115,22,0.3)' : 'rgba(34,197,94,0.25)';

  // ===== PETALS MODE HELPERS =====
  const PETAL_ANGLES = [315, 45, 135, 225];
  const petalDrugs = ['propofol', 'midazolam', 'fentanyl', 'ketamine'];

  // Safety halo segments
  const safetySegments = [
    { label: 'Airway', angle: -36, color: isCrisis ? '#ef4444' : vitals.spo2 < 94 ? '#f59e0b' : '#22c55e' },
    { label: 'BP', angle: 36, color: vitals.map < 60 || vitals.map > 110 ? '#ef4444' : vitals.map < 70 ? '#f59e0b' : '#22c55e' },
    { label: 'O2', angle: 108, color: vitals.spo2 < 90 ? '#ef4444' : vitals.spo2 < 94 ? '#f59e0b' : '#22c55e' },
    { label: 'Sed', angle: 180, color: moass <= 1 ? '#ef4444' : moass <= 2 ? '#f59e0b' : '#22c55e' },
    { label: 'Recov', angle: 252, color: combinedEff > 0.7 ? '#f59e0b' : '#22c55e' },
  ];

  return (
    <div className="flex flex-col items-center">
      {/* Mode selector - aviation style tab bar */}
      <div className="flex gap-1 mb-2">
        {(['avatar', 'risk', 'petals'] as GaugeMode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-sm rounded font-bold tracking-wide transition-all ${
              mode === m
                ? m === 'avatar' ? 'bg-cyan-500 text-black'
                : m === 'petals' ? 'bg-emerald-500 text-black'
                : 'bg-orange-500 text-black'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* SVG Defs */}
        <defs>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="strongGlow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feColorMatrix in="blur" type="saturate" values="2" result="saturated" />
            <feMerge><feMergeNode in="saturated" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <clipPath id="circleClip">
            <circle cx={cx} cy={cy} r={outerR} />
          </clipPath>
        </defs>

        {/* Outer ring always visible */}
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#334155" strokeWidth="4" />

        {/* Drug effect arc */}
        {combinedEff > 0.01 && (
          <path d={describeArc(cx, cy, outerR, 0, combinedEff * 360)} fill="none" stroke={gaugeColor} strokeWidth="8" strokeLinecap="round" opacity="0.8" />
        )}

        {/* ===== MODE C: AVATAR ===== */}
      {mode === 'avatar' && (
        <foreignObject x="0" y="0" width={size} height={size}>
          <PhysiologyAvatar vitals={vitals} moass={moass} combinedEff={combinedEff} patient={patient} size={size} />
        </foreignObject>
      )}

        {/* ===== MODE D: RISK RADAR ===== */}
        {mode === 'risk' && (
          <g>
            {[60, 120, 180, 240].map(r => <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth="1" />)}
            {radarAxes.map((label, i) => {
              const angle = (i * 360) / axisCount;
              const p = polarToCartesian(cx, cy, 240, angle);
              const lp = polarToCartesian(cx, cy, 260, angle);
              return (
                <g key={label}>
                  <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#334155" strokeWidth="1" />
                  <text x={lp.x} y={lp.y} fill={radarValues[i] > 0.75 ? '#f97316' : '#94a3b8'} fontSize="14" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" letterSpacing="0.05em">{label}</text>
                </g>
              );
            })}
            <polygon points={radarPoints} fill={radarFill} stroke={gaugeColor} strokeWidth="3" />
            {radarValues.map((v, i) => {
              const p = polarToCartesian(cx, cy, v * radarR + 30, (i * 360 / axisCount));
              return <circle key={i} cx={p.x} cy={p.y} r="6" fill={radarValues[i] > 0.75 ? '#f97316' : gaugeColor} />;
            })}
          </g>
        )}

        {/* ===== MODE E: PETALS (Aviation Glass Cockpit Style) ===== */}
        {mode === 'petals' && (
          <g>
            {/* Horizon line - aviation style */}
            <line x1={cx - outerR} y1={cy} x2={cx + outerR} y2={cy} stroke="rgba(59,130,246,0.15)" strokeWidth="1" />
            <rect x={cx - outerR} y={cy} width={outerR * 2} height={outerR} fill="rgba(120,80,40,0.04)" clipPath="url(#circleClip)" />
            <rect x={cx - outerR} y={cy - outerR} width={outerR * 2} height={outerR} fill="rgba(59,130,246,0.04)" clipPath="url(#circleClip)" />

            {/* Safety halo ring - color-coded segments */}
            {safetySegments.map((seg) => {
              const startA = seg.angle - 30;
              const endA = seg.angle + 30;
              return (
                <g key={seg.label}>
                  <path d={describeArc(cx, cy, outerR - 3, startA, endA)} fill="none" stroke={seg.color} strokeWidth="6" opacity="0.7" />
                  {(() => { const lp = polarToCartesian(cx, cy, outerR + 18, seg.angle); return (
                    <text x={lp.x} y={lp.y} fill={seg.color} fontSize="11" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" opacity="0.9" letterSpacing="0.05em">{seg.label}</text>
                  ); })()}
                </g>
              );
            })}

            {/* Inner dark circle background for center */}
            <circle cx={cx} cy={cy} r={98} fill="rgba(0,0,0,0.75)" />
            <circle cx={cx} cy={cy} r={98} fill="url(#centerGlow)" />

            {/* Drug Petals - 4 quadrant leaf shapes, larger and more readable */}
            {petalDrugs.map((drugName, i) => {
              const pkState = pkStates[drugName];
              const ce = pkState ? pkState.ce : 0;
              const drug = DRUG_DATABASE[drugName];
              const maxCe = drug ? drug.EC50 * 3 : 5;
              const fillAmount = Math.min(1, ce / maxCe);
              const angle = PETAL_ANGLES[i];
              const color = PETAL_COLORS[drugName] || '#64748b';
              const isActive = ce > 0.001;
              const innerR = 82;
              const outerPetalR = innerR + 90 * (isActive ? Math.max(0.3, fillAmount) : 0.15);
              const lp = polarToCartesian(cx, cy, innerR + 52, angle);
              const ceLp = polarToCartesian(cx, cy, innerR + 30, angle);
              return (
                <g key={drugName} opacity={isActive ? 1 : 0.3}>
                  <path
                    d={petalPath(cx, cy, angle, innerR, outerPetalR, 28)}
                    fill={color}
                    opacity={isActive ? 0.4 : 0.1}
                    stroke={color}
                    strokeWidth={isActive ? 2 : 0.5}
                    filter={isActive ? 'url(#softGlow)' : undefined}
                  />
                  {/* Drug name - larger, bolder for aviation readability */}
                  <text x={lp.x} y={lp.y} fill={color} fontSize="15" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" letterSpacing="0.05em" style={{ textShadow: `0 0 8px ${color}` }}>
                    {drug ? drug.name : drugName}
                  </text>
                  {/* Ce value - larger */}
                  {isActive && (
                    <text x={ceLp.x} y={ceLp.y + 16} fill="#e2e8f0" fontSize="12" fontWeight="600" textAnchor="middle" dominantBaseline="middle">
                      Ce {ce.toFixed(3)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Avatar silhouette in center with breathing */}
            <g style={{ animation: vitals.rr > 0 ? `breathe ${breatheRate}s ease-in-out infinite` : 'none', transformOrigin: `${cx}px ${cy}px` }}>
              <ellipse cx={cx} cy={cy - 45} rx="15" ry="18" fill="rgba(148,163,184,0.3)" stroke="rgba(148,163,184,0.2)" strokeWidth="0.5" />
              <rect x={cx - 5} y={cy - 29} width="10" height="12" fill="rgba(148,163,184,0.2)" rx="3" />
              <ellipse cx={cx} cy={cy + 3} rx="27" ry="30" fill="rgba(148,163,184,0.15)" stroke="rgba(148,163,184,0.15)" strokeWidth="0.5" />
              <circle cx={cx - 5} cy={cy - 3} r="7" fill="rgba(239,68,68,0.15)" style={{ animation: vitals.hr > 0 ? `heartbeat ${60/vitals.hr}s infinite` : 'none' }} />
              <polyline points={`${cx-22},${cy-3} ${cx-12},${cy-3} ${cx-8},${cy-15} ${cx-3},${cy+9} ${cx+3},${cy-3} ${cx+22},${cy-3}`} fill="none" stroke="rgba(239,68,68,0.4)" strokeWidth="1.5" />
            </g>

            {/* === VITAL READOUTS - Aviation Glass Cockpit Style === */}
            {/* HR at 12 o'clock */}
            {(() => { const p = polarToCartesian(cx, cy, outerR - 38, 0); return (
              <g>
                <text x={p.x} y={p.y - 12} fill="#94a3b8" fontSize="12" fontWeight="bold" textAnchor="middle" letterSpacing="0.1em">HR</text>
                <text x={p.x} y={p.y + 8} fill="#22c55e" fontSize="24" fontWeight="bold" textAnchor="middle" filter="url(#glow)">{vitals.hr.toFixed(0)}</text>
                <text x={p.x} y={p.y + 22} fill="#64748b" fontSize="10" textAnchor="middle">bpm</text>
              </g>
            ); })()}

            {/* BP at ~2 o'clock */}
            {(() => { const p = polarToCartesian(cx, cy, outerR - 38, 60); return (
              <g>
                <text x={p.x} y={p.y - 16} fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle" letterSpacing="0.1em">BP</text>
                <text x={p.x} y={p.y + 2} fill="#ef4444" fontSize="19" fontWeight="bold" textAnchor="middle" filter="url(#glow)">{vitals.sbp.toFixed(0)}/{vitals.dbp.toFixed(0)}</text>
                <text x={p.x} y={p.y + 18} fill="#f97316" fontSize="12" fontWeight="600" textAnchor="middle">MAP {vitals.map.toFixed(0)}</text>
              </g>
            ); })()}

            {/* SpO2 at ~4 o'clock */}
            {(() => { const p = polarToCartesian(cx, cy, outerR - 38, 120); return (
              <g>
                <text x={p.x} y={p.y - 14} fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle" letterSpacing="0.1em">SpO2</text>
                <text x={p.x} y={p.y + 8} fill="#3b82f6" fontSize="24" fontWeight="bold" textAnchor="middle" filter="url(#glow)">{vitals.spo2.toFixed(0)}%</text>
                <polyline points={`${p.x-18},${p.y+22} ${p.x-12},${p.y+18} ${p.x-6},${p.y+12} ${p.x},${p.y+22} ${p.x+6},${p.y+18} ${p.x+12},${p.y+12} ${p.x+18},${p.y+22}`} fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.6" />
              </g>
            ); })()}

            {/* EtCO2 at ~6 o'clock */}
            {(() => { const p = polarToCartesian(cx, cy, outerR - 38, 180); return (
              <g>
                <text x={p.x} y={p.y - 14} fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle" letterSpacing="0.1em">EtCO2</text>
                <text x={p.x} y={p.y + 8} fill="#eab308" fontSize="22" fontWeight="bold" textAnchor="middle" filter="url(#glow)">{vitals.etco2.toFixed(0)}</text>
                <text x={p.x} y={p.y + 22} fill="#64748b" fontSize="10" textAnchor="middle">mmHg</text>
              </g>
            ); })()}

            {/* RR at ~8 o'clock */}
            {(() => { const p = polarToCartesian(cx, cy, outerR - 38, 240); return (
              <g>
                <text x={p.x} y={p.y - 12} fill="#94a3b8" fontSize="12" fontWeight="bold" textAnchor="middle" letterSpacing="0.1em">RR</text>
                <text x={p.x} y={p.y + 8} fill="#22c55e" fontSize="22" fontWeight="bold" textAnchor="middle" filter="url(#glow)">{vitals.rr.toFixed(0)}</text>
              </g>
            ); })()}

            {/* Forward projection at ~10 o'clock */}
            {(() => { const p = polarToCartesian(cx, cy, outerR - 45, 300); return (
              <g opacity="0.5">
                <text x={p.x} y={p.y - 14} fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle" letterSpacing="0.05em">2-min Ce</text>
                <polygon points={`${p.x-22},${p.y+3} ${p.x-8},${p.y-5} ${p.x-8},${p.y+11}`} fill="#94a3b8" />
                <polygon points={`${p.x-12},${p.y+3} ${p.x+2},${p.y-5} ${p.x+2},${p.y+11}`} fill="#64748b" />
              </g>
            ); })()}

            {/* Synergy badge */}
            {activeSynergies.length > 0 && (
              <g>
                <rect x={cx - 82} y={cy + 57} width="164" height="26" rx="13" fill="rgba(234,179,8,0.2)" stroke="#eab308" strokeWidth="1.5" />
                <text x={cx} y={cy + 73} fill="#eab308" fontSize="11" textAnchor="middle" fontWeight="bold" letterSpacing="0.05em">
                  {activeSynergies.length > 0 ? 'Benzo-Hypnotic Synergy' : ''}
                </text>
              </g>
            )}

            {/* Effect % arc */}
            {combinedEff > 0.01 && (
              <g>
                <path d={describeArc(cx, cy, 87, 120, 120 + combinedEff * 120)} fill="none" stroke={gaugeColor} strokeWidth="4" strokeLinecap="round" opacity="0.7" />
                <text x={cx} y={cy + 82} fill="#94a3b8" fontSize="12" fontWeight="600" textAnchor="middle">
                  Effect: {(combinedEff * 100).toFixed(0)}%
                </text>
              </g>
            )}

            {/* Mini risk spider in corner */}
            {(() => {
              const rCx = cx + 180;
              const rCy = cy + 180;
              const rR = 42;
              const riskAxes = ['Air', 'BP', 'O2', 'Sed', 'Rec'];
              const riskVals = [
                isCrisis ? 0.9 : vitals.spo2 < 94 ? 0.6 : 0.2,
                vitals.map < 60 || vitals.map > 110 ? 0.8 : 0.3,
                vitals.spo2 < 90 ? 0.9 : 0.2,
                moass <= 1 ? 0.9 : moass <= 3 ? 0.5 : 0.2,
                combinedEff > 0.5 ? 0.6 : 0.2,
              ];
              const rPts = riskVals.map((v, idx) => {
                const a = (idx * 360) / 5;
                const pt = polarToCartesian(rCx, rCy, v * rR, a);
                return `${pt.x},${pt.y}`;
              }).join(' ');
              return (
                <g opacity="0.7">
                  <circle cx={rCx} cy={rCy} r={rR} fill="none" stroke="#334155" strokeWidth="0.5" />
                  <circle cx={rCx} cy={rCy} r={rR * 0.5} fill="none" stroke="#1e293b" strokeWidth="0.5" />
                  <polygon points={rPts} fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1.5" />
                  {riskAxes.map((label, idx) => {
                    const a = (idx * 360) / 5;
                    const lpt = polarToCartesian(rCx, rCy, rR + 14, a);
                    return <text key={label} x={lpt.x} y={lpt.y} fill="#64748b" fontSize="9" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">{label}</text>;
                  })}
                </g>
              );
            })()}
          </g>
        )}

        {/* Center MOASS display - always visible, aviation-style large text */}
        <text x={cx} y={cy - 8} fill="white" fontSize="63" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" filter="url(#glow)" letterSpacing="-0.02em">
          {moass}
        </text>
        <text x={cx} y={cy + 30} fill={gaugeColor} fontSize="18" textAnchor="middle" fontWeight="bold" letterSpacing="0.1em">
          {MOASS_LABELS[moass]}
        </text>

        {isCrisis && (
          <text x={cx} y={cy + 53} fill="#ef4444" fontSize="16" textAnchor="middle" fontWeight="bold" letterSpacing="0.05em" style={{ animation: 'blink 1s infinite' }}>
            {vitals.spo2 < 90 ? '\u26A0 DESAT' : vitals.rr < 6 ? '\u26A0 APNEA' : '\u26A0 CRITICAL'}
          </text>
        )}
      </svg>

      {/* Vitals row - larger text */}
      <div className="flex gap-4 mt-3 text-sm font-semibold">
        <span>HR <span className="text-green-400 font-bold">{vitals.hr.toFixed(0)}</span></span>
        <span>SpO2 <span className="text-blue-400 font-bold">{vitals.spo2.toFixed(0)}%</span></span>
        <span>RR <span className="text-green-400 font-bold">{vitals.rr.toFixed(0)}</span></span>
        <span>BP <span className="text-red-400 font-bold">{vitals.sbp.toFixed(0)}/{vitals.dbp.toFixed(0)}</span></span>
      </div>

      {activeDrugs.length > 0 && (
        <div className="flex gap-2 mt-1 flex-wrap justify-center">
          {activeDrugs.slice(0, 3).map(d => (
            <span key={d.key} className="text-sm px-2 font-semibold" style={{ color: d.color }}>
              {d.name} <span className="opacity-70">Ce {d.ce.toFixed(2)}</span>
            </span>
          ))}
        </div>
      )}

      {activeSynergies.length > 0 && (
        <div className="text-sm text-yellow-400 mt-1 font-bold tracking-wide">
          {"\u26A1"} Synergy
        </div>
      )}
    </div>
  );
}
