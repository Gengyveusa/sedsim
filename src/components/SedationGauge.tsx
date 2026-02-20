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
  const [mode, setMode] = useState<GaugeMode>('petals');
  const [autoSwitched, setAutoSwitched] = useState(false);

      const { combinedEff, moass, pkStates, vitals, patient } = useSimStore();
  const size = 720;
  const cy = size / 2;
  const cx = size / 2;  
  const outerR = 278;
  const avatarSize = 1050;

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
    <div className="flex flex-col items-center gap-4">
      {/* Mode selector - aviation style tab bar */}
      <div className="flex gap-2">
        {(['avatar', 'risk', 'petals'] as GaugeMode[]).map(m => (
          <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 text-sm rounded font-bold tracking-wide transition-all ${
            mode === m
              ? m === 'avatar' ? 'bg-cyan-500 text-black'
              : m === 'petals' ? 'bg-emerald-500 text-black'
              : 'bg-orange-500 text-black'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}>
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* ===== MODE C: AVATAR (standalone rendering) ===== */}
      {mode === 'avatar' && (
        <>
          <div style={{ overflowX: 'auto', overflowY: 'visible', width: '100%' }}>
            <div style={{ minWidth: '800px' }}>
              <PhysiologyAvatar vitals={vitals} moass={moass} combinedEff={combinedEff} patient={patient} rhythm={vitals.rhythm} size={avatarSize} />
            </div>
          </div>
        </>
      )}

      {/* ===== MODES D & E: Radar and Petals use the gauge SVG ===== */}
      {mode !== 'avatar' && (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-2xl">
          {/* SVG Defs */}
          <defs>
            <style>{`
              @keyframes breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.03); } }
              @keyframes heartbeat { 0%,100% { r: 8; } 50% { r: 11; } }
              @keyframes pulse-ring { 0% { opacity: 0.6; r: 20; } 100% { opacity: 0; r: 45; } }
            `}</style>
          </defs>

          {/* Outer ring always visible */}
          <circle cx={cx} cy={cy} r={outerR} fill="none" stroke={gaugeColor} strokeWidth={4} opacity={0.6} />

          {/* Drug effect arc */}
          {combinedEff > 0.01 && (
            <path d={describeArc(cx, cy, outerR + 8, 0, combinedEff * 360)}
              fill="none" stroke={gaugeColor} strokeWidth={6} strokeLinecap="round" opacity={0.8} />
          )}

          {/* ===== MODE D: RISK RADAR ===== */}
          {mode === 'risk' && (
            <g>
              {[60, 120, 180, 240].map(r => <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="#334155" strokeWidth={0.5} />)}
              <polygon points={radarPoints} fill={radarFill} stroke={gaugeColor} strokeWidth={2} />
              {radarAxes.map((label, i) => {
                const angle = (i * 360) / axisCount;
                const p = polarToCartesian(cx, cy, 240, angle);
                const lp = polarToCartesian(cx, cy, 260, angle);
                // Intermediate tick labels per axis
                const spokeTickDefs: { norm: number; text: string }[][] = [
                  // Sed: MOASS 1,3,5
                  [{ norm: normalize(1, 0, 5), text: '1' }, { norm: normalize(3, 0, 5), text: '3' }, { norm: normalize(5, 0, 5), text: '5' }],
                  // HR: 40, 80, 120
                  [{ norm: normalize(40, 40, 120) * 0.5 + 0.25, text: '40' }, { norm: normalize(80, 40, 120) * 0.5 + 0.25, text: '80' }, { norm: normalize(120, 40, 120) * 0.5 + 0.25, text: '120' }],
                  // SpO2: 80, 90, 100
                  [{ norm: normalize(80, 70, 100), text: '80' }, { norm: normalize(90, 70, 100), text: '90' }, { norm: normalize(100, 70, 100), text: '100' }],
                  // CO2: low=good, show etco2 20,40,60 (inverted)
                  [{ norm: 1 - normalize(20, 20, 60), text: '20' }, { norm: 1 - normalize(40, 20, 60), text: '40' }, { norm: 1 - normalize(60, 20, 60), text: '60' }],
                  // RR: 5, 15, 25
                  [{ norm: normalize(5, 0, 25) * 0.7 + 0.15, text: '5' }, { norm: normalize(15, 0, 25) * 0.7 + 0.15, text: '15' }, { norm: normalize(25, 0, 25) * 0.7 + 0.15, text: '25' }],
                  // MAP: 60, 80, 100
                  [{ norm: normalize(60, 50, 110) * 0.6 + 0.2, text: '60' }, { norm: normalize(80, 50, 110) * 0.6 + 0.2, text: '80' }, { norm: normalize(100, 50, 110) * 0.6 + 0.2, text: '100' }],
                  // Drug effect %
                  [{ norm: 0.25, text: '25%' }, { norm: 0.5, text: '50%' }, { norm: 0.75, text: '75%' }],
                  // Risk
                  [{ norm: 0.33, text: 'Low' }, { norm: 0.66, text: 'Med' }, { norm: 1.0, text: 'High' }],
                ];
                const ticks = spokeTickDefs[i] || [];
                return (
                  <g key={label}>
                    <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#475569" strokeWidth={0.5} />
                    <text x={lp.x} y={lp.y} fill={radarValues[i] > 0.75 ? '#f97316' : '#94a3b8'} fontSize="20" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" letterSpacing="0.05em">{label}</text>
                    {ticks.map(tick => {
                      const tp = polarToCartesian(cx, cy, tick.norm * radarR + 30, angle);
                      return (
                        <text key={tick.text} x={tp.x} y={tp.y} fill="#475569" fontSize="12" textAnchor="middle" dominantBaseline="middle">{tick.text}</text>
                      );
                    })}
                  </g>
                );
              })}
              {radarValues.map((v, i) => {
                const p = polarToCartesian(cx, cy, v * radarR + 30, (i * 360 / axisCount));
                return <circle key={i} cx={p.x} cy={p.y} r={5} fill={radarValues[i] > 0.75 ? '#f97316' : gaugeColor} />;
              })}
            </g>
          )}

          {/* ===== MODE E: PETALS (Aviation Glass Cockpit Style) ===== */}
          {mode === 'petals' && (
            <g>
              {/* Horizon line - aviation style */}
              <line x1={cx - outerR} y1={cy} x2={cx + outerR} y2={cy} stroke="#334155" strokeWidth={0.5} />

              {/* Safety halo ring - color-coded segments */}
              {safetySegments.map((seg) => {
                const startA = seg.angle - 30;
                const endA = seg.angle + 30;
                return (
                  <g key={seg.label}>
                    <path d={describeArc(cx, cy, outerR + 4, startA, endA)} fill="none" stroke={seg.color} strokeWidth={8} strokeLinecap="round" opacity={0.7} />
                    {(() => {
                      const lp = polarToCartesian(cx, cy, outerR + 35, seg.angle);
                      return (
                        <text x={lp.x} y={lp.y} fill={seg.color} fontSize="13" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">{seg.label}</text>
                      );
                    })()}
                  </g>
                );
              })}

              {/* Inner dark circle background for center */}
              <circle cx={cx} cy={cy} r={78} fill="#0f172a" opacity={0.8} />

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
                const innerR = 82;
                const outerPetalR = innerR + 90 * (isActive ? Math.max(0.3, fillAmount) : 0.15);
                const lp = polarToCartesian(cx, cy, innerR + 65, angle);
                const ceLp = polarToCartesian(cx, cy, innerR + 42, angle);
                return (
                  <g key={drugName}>
                    <path d={petalPath(cx, cy, angle, innerR, outerPetalR, 28)} fill={color} opacity={isActive ? 0.6 : 0.15} stroke={color} strokeWidth={isActive ? 1.5 : 0.5} />
                    {/* Drug name */}
                    <text x={lp.x} y={lp.y} fill={isActive ? color : '#64748b'} fontSize="16" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">{drug ? drug.name : drugName}</text>
                    {/* Ce value */}
                    {isActive && (
                      <text x={ceLp.x} y={ceLp.y} fill={color} fontSize="14" textAnchor="middle" dominantBaseline="middle">Ce {ce.toFixed(3)}</text>
                    )}
                  </g>
                );
              })}

              {/* Avatar silhouette in center with breathing */}
              <g style={{ animation: breatheRate > 0 ? `breathe ${breatheRate}s ease-in-out infinite` : 'none', transformOrigin: `${cx}px ${cy}px` }}>
                <ellipse cx={cx} cy={cy - 18} rx={18} ry={22} fill="#1e293b" stroke="#475569" strokeWidth={1.5} />
                <ellipse cx={cx} cy={cy + 25} rx={28} ry={35} fill="#1e293b" stroke="#475569" strokeWidth={1.5} />
                <circle cx={cx} cy={cy + 5} r={8} fill="#ef4444" opacity={0.7} style={{ animation: vitals.hr > 0 ? `heartbeat ${60/vitals.hr}s infinite` : 'none' }} />
              </g>

              {/* === VITAL READOUTS - Aviation Glass Cockpit Style === */}
              {/* HR at 12 o'clock */}
              {(() => {
                const p = polarToCartesian(cx, cy, outerR + 75, 0);
                return (
                  <g>
                    <text x={p.x} y={p.y - 12} fill="#94a3b8" fontSize="15" fontWeight="bold" textAnchor="middle">HR</text>
                    <text x={p.x} y={p.y + 8} fill={vitals.hr < 50 || vitals.hr > 120 ? '#ef4444' : '#22c55e'} fontSize="24" fontWeight="bold" textAnchor="middle">{vitals.hr.toFixed(0)}</text>
                    <text x={p.x} y={p.y + 16} fill="#64748b" fontSize="14" textAnchor="middle">bpm</text>
                  </g>
                );
              })()}

              {/* BP at ~2 o'clock */}
              {(() => {
                const p = polarToCartesian(cx, cy, outerR + 75, 60);
                return (
                  <g>
                    <text x={p.x} y={p.y - 12} fill="#94a3b8" fontSize="15" fontWeight="bold" textAnchor="middle">BP</text>
                    <text x={p.x} y={p.y + 8} fill={vitals.map < 60 ? '#ef4444' : '#22c55e'} fontSize="22" fontWeight="bold" textAnchor="middle">{vitals.sbp.toFixed(0)}/{vitals.dbp.toFixed(0)}</text>
                    <text x={p.x} y={p.y + 18} fill="#64748b" fontSize="14" textAnchor="middle">MAP {vitals.map.toFixed(0)}</text>
                  </g>
                );
              })()}

              {/* SpO2 at ~4 o'clock */}
              {(() => {
                const p = polarToCartesian(cx, cy, outerR + 75, 120);
                return (
                  <g>
                    <text x={p.x} y={p.y - 12} fill="#94a3b8" fontSize="15" fontWeight="bold" textAnchor="middle">SpO2</text>
                    <text x={p.x} y={p.y + 8} fill={vitals.spo2 < 90 ? '#ef4444' : vitals.spo2 < 94 ? '#f59e0b' : '#22c55e'} fontSize="24" fontWeight="bold" textAnchor="middle">{vitals.spo2.toFixed(0)}%</text>
                  </g>
                );
              })()}

              {/* EtCO2 at ~6 o'clock */}
              {(() => {
                const p = polarToCartesian(cx, cy, outerR + 75, 180);
                return (
                  <g>
                    <text x={p.x} y={p.y - 12} fill="#94a3b8" fontSize="15" fontWeight="bold" textAnchor="middle">EtCO2</text>
                    <text x={p.x} y={p.y + 8} fill={vitals.etco2 > 50 ? '#ef4444' : '#22c55e'} fontSize="24" fontWeight="bold" textAnchor="middle">{vitals.etco2.toFixed(0)}</text>
                    <text x={p.x} y={p.y + 16} fill="#64748b" fontSize="14" textAnchor="middle">mmHg</text>
                  </g>
                );
              })()}

              {/* RR at ~8 o'clock */}
              {(() => {
                const p = polarToCartesian(cx, cy, outerR + 75, 240);
                return (
                  <g>
                    <text x={p.x} y={p.y - 12} fill="#94a3b8" fontSize="15" fontWeight="bold" textAnchor="middle">RR</text>
                    <text x={p.x} y={p.y + 8} fill={vitals.rr < 8 ? '#ef4444' : '#22c55e'} fontSize="24" fontWeight="bold" textAnchor="middle">{vitals.rr.toFixed(0)}</text>
                  </g>
                );
              })()}

              {/* Forward projection at ~10 o'clock */}
              {(() => {
                const p = polarToCartesian(cx, cy, outerR + 75, 300);
                return (
                  <text x={p.x} y={p.y} fill="#64748b" fontSize="13" fontWeight="bold" textAnchor="middle">2-min Ce</text>
                );
              })()}

              {/* Synergy badge */}
              {activeSynergies.length > 0 && (
                <text x={cx} y={cy + 68} fill="#f59e0b" fontSize="13" fontWeight="bold" textAnchor="middle">
                  {activeSynergies.length > 0 ? 'Benzo-Hypnotic Synergy' : ''}
                </text>
              )}

              {/* Effect % arc */}
              {combinedEff > 0.01 && (
                <text x={cx} y={cy - 68} fill={gaugeColor} fontSize="15" fontWeight="bold" textAnchor="middle">
                  Effect: {(combinedEff * 100).toFixed(0)}%
                </text>
              )}

              
                    )}
          {/* Center MOASS display – always visible in non-avatar modes */}
          <g>
            <text x={cx} y={cy - 6} fill={gaugeColor} fontSize="48" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">{moass}</text>
            <text x={cx} y={cy + 22} fill={gaugeColor} fontSize="16" fontWeight="bold" textAnchor="middle" letterSpacing="0.1em">{MOASS_LABELS[moass]}</text>
            {isCrisis && (
              <text x={cx} y={cy + 40} fill="#ef4444" fontSize="17" fontWeight="bold" textAnchor="middle">
                {vitals.spo2 < 90 ? '\u26A0 DESAT' : vitals.rr < 6 ? '\u26A0 APNEA' : '\u26A0 CRITICAL'}
              </text>
            )}
          </g>
        </svg>
      )}

      {/* Vitals row - larger text */}
      <div className="flex gap-4 text-sm font-mono">
        <span><span className="text-slate-400">HR</span> <span className="text-green-400 font-bold">{vitals.hr.toFixed(0)}</span></span>
        <span><span className="text-slate-400">SpO2</span> <span className="text-blue-400 font-bold">{vitals.spo2.toFixed(0)}%</span></span>
        <span><span className="text-slate-400">RR</span> <span className="text-cyan-400 font-bold">{vitals.rr.toFixed(0)}</span></span>
        <span><span className="text-slate-400">BP</span> <span className="text-yellow-400 font-bold">{vitals.sbp.toFixed(0)}/{vitals.dbp.toFixed(0)}</span></span>
      </div>

      {activeDrugs.length > 0 && (
        <div className="flex gap-3 text-xs font-mono">
          {activeDrugs.slice(0, 3).map(d => (
            <span key={d.key} style={{ color: d.color }}>
              <span className="font-bold">{d.name}</span>
              <span className="text-slate-500"> Ce {d.ce.toFixed(2)} </span>
            </span>
          ))}
        </div>
      )}
      {activeSynergies.length > 0 && (
        <div className="text-yellow-500 text-xs font-bold">
          {'\u26A1'} Synergy
        </div>
      )}
    </div>
  );
}
