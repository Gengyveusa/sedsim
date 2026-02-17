import { useState, useEffect } from 'react';
import useSimStore from '../store/useSimStore';
import { DRUG_DATABASE } from '../engine/drugs';
import { hillEffect } from '../engine/pdModel';
import { MOASSLevel } from '../types';

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

// Mode types: A=Rings, B=Layers, C=Avatar, D=Radar, E=Petals
type GaugeMode = 'rings' | 'layers' | 'avatar' | 'risk' | 'petals';
const MODE_LABELS: Record<GaugeMode, string> = {
  rings: 'RINGS', layers: 'B: LAYERS', avatar: 'C: AVATAR', risk: 'D: RADAR', petals: 'E: PETALS'};

// Drug petal colors matching mockup
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
  const { combinedEff, moass, pkStates, vitals } = useSimStore();
  const [mode, setMode] = useState<GaugeMode>('petals');
  const [ringTab, setRingTab] = useState<'sed' | 'hemo' | 'resp' | 'pk'>('sed');
  const [autoSwitched, setAutoSwitched] = useState(false);

  const size = 420;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 185;

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
  const radarPoints = radarValues.map((v, i) => {
    const p = polarToCartesian(cx, cy, v * 130 + 20, (i * 360 / axisCount));
    return `${p.x},${p.y}`;
  }).join(' ');

  const radarFill = isCrisis ? 'rgba(220,38,38,0.35)' : moass <= 2 ? 'rgba(249,115,22,0.3)' : 'rgba(34,197,94,0.25)';

  // ===== PETALS MODE HELPERS =====
  // Drug positions in petals (4 cardinal quadrants)
  const PETAL_ANGLES = [315, 45, 135, 225]; // top-left, top-right, bottom-right, bottom-left
  const petalDrugs = ['propofol', 'midazolam', 'fentanyl', 'ketamine'];

  // Safety halo segments (5 segments around outer ring)
  const safetySegments = [
    { label: 'Airway', angle: -36, color: isCrisis ? '#ef4444' : vitals.spo2 < 94 ? '#f59e0b' : '#22c55e' },
    { label: 'BP', angle: 36, color: vitals.map < 60 || vitals.map > 110 ? '#ef4444' : vitals.map < 70 ? '#f59e0b' : '#22c55e' },
    { label: 'O2', angle: 108, color: vitals.spo2 < 90 ? '#ef4444' : vitals.spo2 < 94 ? '#f59e0b' : '#22c55e' },
    { label: 'Sed', angle: 180, color: moass <= 1 ? '#ef4444' : moass <= 2 ? '#f59e0b' : '#22c55e' },
    { label: 'Recov', angle: 252, color: combinedEff > 0.7 ? '#f59e0b' : '#22c55e' },
  ];

  return (
    <div className="flex flex-col items-center">
      {/* Mode selector at top */}
      <div className="flex gap-1 mb-2">
        {(['rings', 'layers', 'avatar', 'risk', 'petals'] as GaugeMode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-2 py-1 text-xs rounded font-bold transition-all ${
              mode === m
                ? m === 'rings' ? 'bg-purple-500 text-white'
                : m === 'layers' ? 'bg-blue-500 text-white'
                : m === 'avatar' ? 'bg-cyan-500 text-black'
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
        {/* SVG Defs for gradients, glows, filters */}
        <defs>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="petalGlowBlue" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(59,130,246,0.6)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0.1)" />
          </radialGradient>
          <radialGradient id="petalGlowPurple" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(168,85,247,0.6)" />
            <stop offset="100%" stopColor="rgba(168,85,247,0.1)" />
          </radialGradient>
          <radialGradient id="petalGlowAmber" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(245,158,11,0.6)" />
            <stop offset="100%" stopColor="rgba(245,158,11,0.1)" />
          </radialGradient>
          <radialGradient id="petalGlowTeal" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(20,184,166,0.6)" />
            <stop offset="100%" stopColor="rgba(20,184,166,0.1)" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <clipPath id="circleClip">
            <circle cx={cx} cy={cy} r={outerR} />
          </clipPath>
        </defs>

        {/* Outer ring always visible */}
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#334155" strokeWidth="3" />

        {/* Drug effect arc */}
        {combinedEff > 0.01 && (
          <path d={describeArc(cx, cy, outerR, 0, combinedEff * 360)} fill="none" stroke={gaugeColor} strokeWidth="6" strokeLinecap="round" opacity="0.8" />
        )}

        {/* ===== MODE A: TABBED RINGS ===== */}
        {mode === 'rings' && (
          <g>
            {['sed', 'hemo', 'resp', 'pk'].map((tab, i) => {
              const startAngle = -60 + i * 30;
              const endAngle = startAngle + 28;
              const isActive = ringTab === tab;
              const midAngle = (startAngle + endAngle) / 2;
              const lp = polarToCartesian(cx, cy, outerR + 15, midAngle);
              return (
                <g key={tab} onClick={() => setRingTab(tab as typeof ringTab)} className="cursor-pointer">
                  <path d={describeArc(cx, cy, outerR + 8, startAngle, endAngle)} fill="none" stroke={isActive ? gaugeColor : '#475569'} strokeWidth="4" strokeLinecap="round" />
                  <text x={lp.x} y={lp.y} fill={isActive ? '#fff' : '#94a3b8'} fontSize="8" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{tab.toUpperCase()}</text>
                </g>
              );
            })}
            {ringTab === 'sed' && (<>
              <text x={cx} y={cy - 70} fill="#94a3b8" fontSize="10" textAnchor="middle">Sedation Depth</text>
              <path d={describeArc(cx, cy, 120, -90, -90 + moass * 60)} fill="none" stroke={gaugeColor} strokeWidth="10" strokeLinecap="round" />
            </>)}
            {ringTab === 'hemo' && (<>
              <text x={cx} y={cy - 70} fill="#94a3b8" fontSize="10" textAnchor="middle">Hemodynamics</text>
              <path d={describeArc(cx, cy, 120, -90, -90 + normalize(vitals.hr, 40, 120) * 180)} fill="none" stroke="#22c55e" strokeWidth="8" strokeLinecap="round" />
              <path d={describeArc(cx, cy, 105, -90, -90 + normalize(vitals.map, 50, 110) * 180)} fill="none" stroke="#f97316" strokeWidth="8" strokeLinecap="round" />
            </>)}
            {ringTab === 'resp' && (<>
              <text x={cx} y={cy - 70} fill="#94a3b8" fontSize="10" textAnchor="middle">Respiratory</text>
              <path d={describeArc(cx, cy, 120, -90, -90 + normalize(vitals.spo2, 70, 100) * 270)} fill="none" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round" />
              <path d={describeArc(cx, cy, 105, -90, -90 + normalize(vitals.rr, 0, 25) * 180)} fill="none" stroke="#22c55e" strokeWidth="8" strokeLinecap="round" />
            </>)}
            {ringTab === 'pk' && activeDrugs.length > 0 && (<>
              {activeDrugs.slice(0, 3).map((d, i) => (
                <path key={d.key} d={describeArc(cx, cy, 120 - i * 18, -90, -90 + d.effect * 300)} fill="none" stroke={d.color} strokeWidth="10" strokeLinecap="round" />
              ))}
            </>)}
          </g>
        )}

        {/* ===== MODE B: CONCENTRIC LAYERS ===== */}
        {mode === 'layers' && (
          <g>
            <path d={describeArc(cx, cy, 170, 0, normalize(vitals.spo2, 70, 100) * 360)} fill="none" stroke="#3b82f6" strokeWidth="12" strokeLinecap="round" opacity="0.7" />
            <text x={cx + 175} y={cy - 5} fill="#3b82f6" fontSize="8" fontWeight="bold">SpO2</text>
            <path d={describeArc(cx, cy, 150, 0, normalize(vitals.hr, 40, 140) * 360)} fill="none" stroke="#22c55e" strokeWidth="12" strokeLinecap="round" opacity="0.7" />
            <text x={cx + 155} y={cy - 5} fill="#22c55e" fontSize="8" fontWeight="bold">HR</text>
            <path d={describeArc(cx, cy, 130, 0, normalize(vitals.rr, 0, 30) * 360)} fill="none" stroke="#a855f7" strokeWidth="12" strokeLinecap="round" opacity="0.7" />
            <text x={cx + 135} y={cy - 5} fill="#a855f7" fontSize="8" fontWeight="bold">RR</text>
            <path d={describeArc(cx, cy, 110, 0, combinedEff * 360)} fill="none" stroke={gaugeColor} strokeWidth="12" strokeLinecap="round" opacity="0.7" />
          </g>
        )}

        {/* ===== MODE C: AVATAR ===== */}
        {mode === 'avatar' && (
          <g clipPath="url(#circleClip)">
            <circle cx={cx} cy={cy} r={80} fill="rgba(30,41,59,0.8)" stroke={gaugeColor} strokeWidth="2" style={{ animation: vitals.hr > 0 ? `heartbeat ${60/vitals.hr}s infinite` : 'none' }} />
            <g style={{ animation: vitals.rr > 0 ? `breathe ${breatheRate}s infinite` : 'none', transformOrigin: 'center' }} transform="translate(42, 65)">
              <ellipse cx={cx - 42} cy={cy - 65 - 25} rx="12" ry="14" fill="rgba(100,116,139,0.5)" />
              <ellipse cx={cx - 42} cy={cy - 65 + 5} rx="16" ry="22" fill="rgba(100,116,139,0.4)" />
              <ellipse cx={cx - 42} cy={cy - 65 + 30} rx="10" ry="15" fill="rgba(100,116,139,0.3)" />
            </g>
          </g>
        )}

        {/* ===== MODE D: RISK RADAR ===== */}
        {mode === 'risk' && (
          <g>
            {[40, 80, 120, 160].map(r => <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth="1" />)}
            {radarAxes.map((label, i) => {
              const angle = (i * 360) / axisCount;
              const p = polarToCartesian(cx, cy, 160, angle);
              const lp = polarToCartesian(cx, cy, 175, angle);
              return (
                <g key={label}>
                  <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#334155" strokeWidth="1" />
                  <text x={lp.x} y={lp.y} fill={radarValues[i] > 0.75 ? '#f97316' : '#94a3b8'} fontSize="9" textAnchor="middle" dominantBaseline="middle">{label}</text>
                </g>
              );
            })}
            <polygon points={radarPoints} fill={radarFill} stroke={gaugeColor} strokeWidth="2" />
            {radarValues.map((v, i) => {
              const p = polarToCartesian(cx, cy, v * 130 + 20, (i * 360 / axisCount));
              return <circle key={i} cx={p.x} cy={p.y} r="4" fill={radarValues[i] > 0.75 ? '#f97316' : gaugeColor} />;
            })}
          </g>
        )}

        {/* ===== MODE E: PETALS (Advanced Mockup) ===== */}
        {mode === 'petals' && (
          <g>
            {/* Horizon line - aviation style blue/brown */}
            <line x1={cx - outerR} y1={cy} x2={cx + outerR} y2={cy} stroke="rgba(59,130,246,0.15)" strokeWidth="1" />
            <rect x={cx - outerR} y={cy} width={outerR * 2} height={outerR} fill="rgba(120,80,40,0.04)" clipPath="url(#circleClip)" />
            <rect x={cx - outerR} y={cy - outerR} width={outerR * 2} height={outerR} fill="rgba(59,130,246,0.04)" clipPath="url(#circleClip)" />

            {/* Safety halo ring - 5 color-coded segments */}
            {safetySegments.map((seg) => {
              const startA = seg.angle - 30;
              const endA = seg.angle + 30;
              return (
                <g key={seg.label}>
                  <path d={describeArc(cx, cy, outerR - 2, startA, endA)} fill="none" stroke={seg.color} strokeWidth="4" opacity="0.6" />
                  {/* Tiny label on halo */}
                  {(() => { const lp = polarToCartesian(cx, cy, outerR + 12, seg.angle); return (
                    <text x={lp.x} y={lp.y} fill={seg.color} fontSize="7" textAnchor="middle" dominantBaseline="middle" opacity="0.8">{seg.label}</text>
                  ); })()}
                </g>
              );
            })}

            {/* Inner dark circle background for center */}
            <circle cx={cx} cy={cy} r={65} fill="rgba(0,0,0,0.7)" />
            <circle cx={cx} cy={cy} r={65} fill="url(#centerGlow)" />

            {/* Drug Petals - 4 quadrant leaf shapes */}
            {petalDrugs.map((drugName, i) => {
              const pkState = pkStates[drugName];
              const ce = pkState ? pkState.ce : 0;
              const drug = DRUG_DATABASE[drugName];
              const maxCe = drug ? drug.EC50 * 3 : 5;
              const fillAmount = Math.min(1, ce / maxCe);
              const angle = PETAL_ANGLES[i];
              const color = PETAL_COLORS[drugName] || '#64748b';
              const isActive = ce > 0.001;
              const innerR = 55;
              const outerPetalR = innerR + 60 * (isActive ? Math.max(0.3, fillAmount) : 0.15);
              const lp = polarToCartesian(cx, cy, innerR + 35, angle);
              const ceLp = polarToCartesian(cx, cy, innerR + 20, angle);

              return (
                <g key={drugName} opacity={isActive ? 1 : 0.3}>
                  {/* Petal shape */}
                  <path
                    d={petalPath(cx, cy, angle, innerR, outerPetalR, 25)}
                    fill={color}
                    opacity={isActive ? 0.35 : 0.1}
                    stroke={color}
                    strokeWidth={isActive ? 1.5 : 0.5}
                    style={isActive ? { animation: `petalPulse ${2 + i * 0.3}s infinite` } : {}}
                  />
                  {/* Drug name */}
                  <text x={lp.x} y={lp.y} fill={color} fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" style={{ textShadow: `0 0 6px ${color}` }}>
                    {drug ? drug.name : drugName}
                  </text>
                  {/* Ce value */}
                  {isActive && (
                    <text x={ceLp.x} y={ceLp.y + 12} fill="#e2e8f0" fontSize="8" textAnchor="middle" dominantBaseline="middle">
                      Ce {ce.toFixed(3)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Avatar silhouette in center with breathing */}
            <g style={{ animation: vitals.rr > 0 ? `breathe ${breatheRate}s ease-in-out infinite` : 'none', transformOrigin: `${cx}px ${cy}px` }}>
              {/* Head */}
              <ellipse cx={cx} cy={cy - 30} rx="10" ry="12" fill="rgba(148,163,184,0.3)" stroke="rgba(148,163,184,0.2)" strokeWidth="0.5" />
              {/* Neck */}
              <rect x={cx - 3} y={cy - 19} width="6" height="8" fill="rgba(148,163,184,0.2)" rx="2" />
              {/* Torso */}
              <ellipse cx={cx} cy={cy + 2} rx="18" ry="20" fill="rgba(148,163,184,0.15)" stroke="rgba(148,163,184,0.15)" strokeWidth="0.5" />
              {/* Heartbeat glow */}
              <circle cx={cx - 3} cy={cy - 2} r="5" fill="rgba(239,68,68,0.15)" style={{ animation: vitals.hr > 0 ? `heartbeat ${60/vitals.hr}s infinite` : 'none' }}>
              </circle>
              {/* ECG line across chest */}
              <polyline points={`${cx-15},${cy-2} ${cx-8},${cy-2} ${cx-5},${cy-10} ${cx-2},${cy+6} ${cx+2},${cy-2} ${cx+15},${cy-2}`} fill="none" stroke="rgba(239,68,68,0.4)" strokeWidth="1" />
            </g>

            {/* Outer vital readouts ring */}
            {/* HR at 12 o'clock */}
            {(() => { const p = polarToCartesian(cx, cy, outerR - 25, 0); return (
              <g>
                <text x={p.x} y={p.y - 8} fill="#94a3b8" fontSize="8" textAnchor="middle">HR</text>
                <text x={p.x} y={p.y + 4} fill="#22c55e" fontSize="16" fontWeight="bold" textAnchor="middle" filter="url(#glow)">{vitals.hr.toFixed(0)}</text>
                <text x={p.x} y={p.y + 13} fill="#64748b" fontSize="7" textAnchor="middle">bpm</text>
              </g>
            ); })()}

            {/* BP at ~2 o'clock */}
            {(() => { const p = polarToCartesian(cx, cy, outerR - 25, 60); return (
              <g>
                <text x={p.x} y={p.y - 12} fill="#94a3b8" fontSize="7" textAnchor="middle">BP</text>
                <text x={p.x} y={p.y + 1} fill="#ef4444" fontSize="13" fontWeight="bold" textAnchor="middle" filter="url(#glow)">{vitals.sbp.toFixed(0)}/{vitals.dbp.toFixed(0)}</text>
                <text x={p.x} y={p.y + 12} fill="#f97316" fontSize="8" textAnchor="middle">MAP {vitals.map.toFixed(0)}</text>
              </g>
            ); })()}

            {/* SpO2 at 3 o'clock with mini arc */}
            {(() => { const p = polarToCartesian(cx, cy, outerR - 25, 120); return (
              <g>
                <text x={p.x} y={p.y - 10} fill="#94a3b8" fontSize="7" textAnchor="middle">SpO{String.fromCharCode(8322)}</text>
                <text x={p.x} y={p.y + 4} fill="#3b82f6" fontSize="16" fontWeight="bold" textAnchor="middle" filter="url(#glow)">{vitals.spo2.toFixed(0)}%</text>
                {/* Mini pleth wave */}
                <polyline points={`${p.x-12},${p.y+14} ${p.x-8},${p.y+12} ${p.x-4},${p.y+8} ${p.x},${p.y+14} ${p.x+4},${p.y+12} ${p.x+8},${p.y+8} ${p.x+12},${p.y+14}`} fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.6" />
              </g>
            ); })()}

            {/* EtCO2 at ~5 o'clock */}
            {(() => { const p = polarToCartesian(cx, cy, outerR - 25, 180); return (
              <g>
                <text x={p.x} y={p.y - 10} fill="#94a3b8" fontSize="7" textAnchor="middle">EtCO{String.fromCharCode(8322)}</text>
                <text x={p.x} y={p.y + 4} fill="#eab308" fontSize="15" fontWeight="bold" textAnchor="middle" filter="url(#glow)">{vitals.etco2.toFixed(0)}</text>
                <text x={p.x} y={p.y + 13} fill="#64748b" fontSize="7" textAnchor="middle">mmHg</text>
                {/* Mini capno wave */}
                <polyline points={`${p.x-12},${p.y+20} ${p.x-10},${p.y+16} ${p.x-6},${p.y+16} ${p.x-4},${p.y+20} ${p.x},${p.y+20} ${p.x+2},${p.y+16} ${p.x+6},${p.y+16} ${p.x+8},${p.y+20}`} fill="none" stroke="#eab308" strokeWidth="1" opacity="0.5" />
              </g>
            ); })()}

            {/* RR at 6 o'clock */}
            {(() => { const p = polarToCartesian(cx, cy, outerR - 25, 240); return (
              <g>
                <text x={p.x} y={p.y - 8} fill="#94a3b8" fontSize="8" textAnchor="middle">RR</text>
                <text x={p.x} y={p.y + 5} fill="#22c55e" fontSize="15" fontWeight="bold" textAnchor="middle" filter="url(#glow)">{vitals.rr.toFixed(0)}</text>
              </g>
            ); })()}

            {/* Forward projection arrows at 9 o'clock */}
            {(() => { const p = polarToCartesian(cx, cy, outerR - 30, 300); return (
              <g opacity="0.4">
                <text x={p.x} y={p.y - 10} fill="#94a3b8" fontSize="7" textAnchor="middle">2-min Ce</text>
                <polygon points={`${p.x-15},${p.y+2} ${p.x-5},${p.y-3} ${p.x-5},${p.y+7}`} fill="#94a3b8" />
                <polygon points={`${p.x-8},${p.y+2} ${p.x+2},${p.y-3} ${p.x+2},${p.y+7}`} fill="#64748b" />
              </g>
            ); })()}

            {/* Synergy badge - yellow pill */}
            {activeSynergies.length > 0 && (
              <g>
                <rect x={cx - 55} y={cy + 38} width="110" height="18" rx="9" fill="rgba(234,179,8,0.2)" stroke="#eab308" strokeWidth="1" />
                <text x={cx} y={cy + 49} fill="#eab308" fontSize="7" textAnchor="middle" fontWeight="bold">
                  {activeSynergies.length > 0 ? 'Benzo-Hypnotic Synergy' : ''}
                </text>
              </g>
            )}

            {/* Effect % arc at bottom of center */}
            {combinedEff > 0.01 && (
              <g>
                <path d={describeArc(cx, cy, 58, 120, 120 + combinedEff * 120)} fill="none" stroke={gaugeColor} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
                <text x={cx} y={cy + 55} fill="#94a3b8" fontSize="8" textAnchor="middle">
                  Effect: {(combinedEff * 100).toFixed(0)}%
                </text>
              </g>
            )}

            {/* Mini spider/radar in bottom-right corner */}
            {(() => {
              const rCx = cx + 120;
              const rCy = cy + 120;
              const rR = 28;
              const riskAxes = ['Air', 'BP', 'O2', 'Sed', 'Rec'];
              const riskVals = [
                isCrisis ? 0.9 : vitals.spo2 < 94 ? 0.6 : 0.2,
                vitals.map < 60 || vitals.map > 110 ? 0.8 : 0.3,
                vitals.spo2 < 90 ? 0.9 : 0.2,
                moass <= 1 ? 0.9 : moass <= 3 ? 0.5 : 0.2,
                combinedEff > 0.5 ? 0.6 : 0.2,
              ];
              const rPts = riskVals.map((v, i) => {
                const a = (i * 360) / 5;
                const p = polarToCartesian(rCx, rCy, v * rR, a);
                return `${p.x},${p.y}`;
              }).join(' ');
              return (
                <g opacity="0.7">
                  <circle cx={rCx} cy={rCy} r={rR} fill="none" stroke="#334155" strokeWidth="0.5" />
                  <circle cx={rCx} cy={rCy} r={rR * 0.5} fill="none" stroke="#1e293b" strokeWidth="0.5" />
                  <polygon points={rPts} fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1" />
                  {riskAxes.map((label, i) => {
                    const a = (i * 360) / 5;
                    const lp = polarToCartesian(rCx, rCy, rR + 10, a);
                    return <text key={label} x={lp.x} y={lp.y} fill="#64748b" fontSize="6" textAnchor="middle" dominantBaseline="middle">{label}</text>;
                  })}
                </g>
              );
            })()}

            {/* Mode icons at rim */}
            {['Sedation', 'Resp', 'Hemo', 'PK'].map((label, i) => {
              const angle = i * 90;
              const p = polarToCartesian(cx, cy, outerR + 2, angle);
              return <text key={label} x={p.x} y={p.y} fill="#475569" fontSize="6" textAnchor="middle" dominantBaseline="middle">{label}</text>;
            })}
          </g>
        )}

        {/* Center MOASS display - always visible */}
        <text x={cx} y={cy - 5} fill="white" fontSize="42" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" filter="url(#glow)">
          {moass}
        </text>
        <text x={cx} y={cy + 20} fill={gaugeColor} fontSize="12" textAnchor="middle" fontWeight="bold">
          {MOASS_LABELS[moass]}
        </text>

        {isCrisis && (
          <text x={cx} y={cy + 35} fill="#ef4444" fontSize="11" textAnchor="middle" fontWeight="bold" style={{ animation: 'blink 1s infinite' }}>
            {vitals.spo2 < 90 ? '\u26A0 DESAT' : vitals.rr < 6 ? '\u26A0 APNEA' : '\u26A0 CRITICAL'}
          </text>
        )}
      </svg>

      {/* Vitals row */}
      <div className="flex gap-3 mt-2 text-xs">
        <span>HR <span className="text-green-400 font-bold">{vitals.hr.toFixed(0)}</span></span>
        <span>SpO2 <span className="text-blue-400 font-bold">{vitals.spo2.toFixed(0)}%</span></span>
        <span>RR <span className="text-green-400 font-bold">{vitals.rr.toFixed(0)}</span></span>
        <span>BP <span className="text-red-400 font-bold">{vitals.sbp.toFixed(0)}/{vitals.dbp.toFixed(0)}</span></span>
      </div>

      {activeDrugs.length > 0 && (
        <div className="flex gap-2 mt-1 flex-wrap justify-center">
          {activeDrugs.slice(0, 3).map(d => (
            <span key={d.key} className="text-xs px-1" style={{ color: d.color }}>
              {d.name} <span className="opacity-70">Ce {d.ce.toFixed(2)}</span>
            </span>
          ))}
        </div>
      )}

      {activeSynergies.length > 0 && (
        <div className="text-xs text-yellow-400 mt-1 font-bold">
          \u26A1 Synergy
        </div>
      )}
    </div>
  );
}
