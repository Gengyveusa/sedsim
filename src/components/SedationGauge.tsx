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

// Mode types: A=Tabbed Rings, B=Concentric Layers, C=Avatar, D=Risk Radar
type GaugeMode = 'rings' | 'layers' | 'avatar' | 'risk';
const MODE_LABELS: Record<GaugeMode, string> = {
  rings: 'RINGS', layers: 'B: LAYERS', avatar: 'C: AVATAR', risk: 'D: RADAR'};

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

export default function SedationGauge() {
  const { combinedEff, moass, pkStates, vitals } = useSimStore();
  const [mode, setMode] = useState<GaugeMode>('avatar');
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


  return (
    <div className="flex flex-col items-center">
      {/* Mode selector at top */}
      <div className="flex gap-1 mb-2">
        {(['rings', 'layers', 'avatar', 'risk'] as GaugeMode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-2 py-1 text-xs rounded font-bold transition-all ${
              mode === m
                ? m === 'rings' ? 'bg-purple-500 text-white' 
                : m === 'layers' ? 'bg-blue-500 text-white'
                : m === 'avatar' ? 'bg-cyan-500 text-black'
                : 'bg-orange-500 text-black'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer ring always visible */}
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#334155" strokeWidth="3" />
        
        {/* Drug effect arc */}
        {combinedEff > 0.01 && (
          <path d={describeArc(cx, cy, outerR, 0, combinedEff * 360)} fill="none" stroke={gaugeColor} strokeWidth="6" strokeLinecap="round" opacity={0.8} />
        )}

        {/* ===== MODE A: TABBED RINGS ===== */}
        {mode === 'rings' && (
          <g>
            {/* Tab selector arcs at top */}
            {['sed', 'hemo', 'resp', 'pk'].map((tab, i) => {
              const startAngle = -60 + i * 30;
              const endAngle = startAngle + 28;
              const isActive = ringTab === tab;
              const midAngle = (startAngle + endAngle) / 2;
              const lp = polarToCartesian(cx, cy, outerR + 15, midAngle);
              return (
                <g key={tab} onClick={() => setRingTab(tab as typeof ringTab)} className="cursor-pointer">
                  <path
                    d={describeArc(cx, cy, outerR + 5, startAngle, endAngle)}
                    fill="none"
                    stroke={isActive ? '#a855f7' : '#475569'}
                    strokeWidth={isActive ? 8 : 4}
                    strokeLinecap="round"
                  />
                  <text x={lp.x} y={lp.y} fill={isActive ? '#a855f7' : '#94a3b8'} fontSize="9" textAnchor="middle" dominantBaseline="middle" fontWeight={isActive ? 'bold' : 'normal'}>
                    {tab.toUpperCase()}
                  </text>
                </g>
              );
            })}
            {/* Inner ring content based on selected tab */}
            {ringTab === 'sed' && (
              <>
                <circle cx={cx} cy={cy} r="140" fill="none" stroke={gaugeColor} strokeWidth="12" opacity={0.3} />
                <path d={describeArc(cx, cy, 140, 0, (5 - moass) * 72)} fill="none" stroke={gaugeColor} strokeWidth="12" strokeLinecap="round" />
              </>
            )}
            {ringTab === 'hemo' && (
              <>
                <circle cx={cx} cy={cy} r="150" fill="none" stroke="#ef4444" strokeWidth="8" opacity={0.2} />
                <path d={describeArc(cx, cy, 150, 0, (vitals.hr / 150) * 360)} fill="none" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" />
                <circle cx={cx} cy={cy} r="120" fill="none" stroke="#f97316" strokeWidth="8" opacity={0.2} />
                <path d={describeArc(cx, cy, 120, 0, (vitals.map / 150) * 360)} fill="none" stroke="#f97316" strokeWidth="8" strokeLinecap="round" />
              </>
            )}
            {ringTab === 'resp' && (
              <>
                <circle cx={cx} cy={cy} r="150" fill="none" stroke="#22d3ee" strokeWidth="8" opacity={0.2} />
                <path d={describeArc(cx, cy, 150, 0, (vitals.spo2 / 100) * 360)} fill="none" stroke="#22d3ee" strokeWidth="8" strokeLinecap="round" />
                <circle cx={cx} cy={cy} r="120" fill="none" stroke="#84cc16" strokeWidth="8" opacity={0.2} />
                <path d={describeArc(cx, cy, 120, 0, (vitals.rr / 30) * 360)} fill="none" stroke="#84cc16" strokeWidth="8" strokeLinecap="round" />
              </>
            )}
            {ringTab === 'pk' && activeDrugs.length > 0 && (
              <>
                {activeDrugs.slice(0, 3).map((d, i) => (
                  <g key={d.key}>
                    <circle cx={cx} cy={cy} r={150 - i * 25} fill="none" stroke={d.color} strokeWidth="6" opacity={0.2} />
                    <path d={describeArc(cx, cy, 150 - i * 25, 0, d.effect * 360)} fill="none" stroke={d.color} strokeWidth="6" strokeLinecap="round" />
                  </g>
                ))}
              </>
            )}
          </g>
        )}

        {/* ===== MODE B: CONCENTRIC LAYERS ===== */}
        {mode === 'layers' && (
          <g>
            {/* Layer 1: Outermost - SpO2 */}
            <circle cx={cx} cy={cy} r="170" fill="none" stroke="#22d3ee" strokeWidth="10" opacity={0.2} />
            <path d={describeArc(cx, cy, 170, 0, (vitals.spo2 / 100) * 360)} fill="none" stroke="#22d3ee" strokeWidth="10" strokeLinecap="round" />
            <text x={cx + 175} y={cy - 10} fill="#22d3ee" fontSize="10" textAnchor="start">SpO2</text>
            
            {/* Layer 2: Heart Rate */}
            <circle cx={cx} cy={cy} r="145" fill="none" stroke="#ef4444" strokeWidth="10" opacity={0.2} />
            <path d={describeArc(cx, cy, 145, 0, Math.min((vitals.hr / 150) * 360, 360))} fill="none" stroke="#ef4444" strokeWidth="10" strokeLinecap="round" />
            <text x={cx + 150} y={cy + 5} fill="#ef4444" fontSize="10" textAnchor="start">HR</text>
            
            {/* Layer 3: Respiratory Rate */}
            <circle cx={cx} cy={cy} r="120" fill="none" stroke="#84cc16" strokeWidth="10" opacity={0.2} />
            <path d={describeArc(cx, cy, 120, 0, (vitals.rr / 30) * 360)} fill="none" stroke="#84cc16" strokeWidth="10" strokeLinecap="round" />
            <text x={cx + 125} y={cy + 20} fill="#84cc16" fontSize="10" textAnchor="start">RR</text>
            
            {/* Layer 4: Drug Effect (innermost colored ring) */}
            <circle cx={cx} cy={cy} r="95" fill="none" stroke={gaugeColor} strokeWidth="12" opacity={0.2} />
            <path d={describeArc(cx, cy, 95, 0, combinedEff * 360)} fill="none" stroke={gaugeColor} strokeWidth="12" strokeLinecap="round" />
          </g>
        )}

        {/* ===== MODE C: AVATAR ===== */}
        {mode === 'avatar' && (
          <g transform={`translate(${cx - 60}, ${cy - 90})`} opacity={1 - combinedEff * 0.6}>
            <ellipse cx="60" cy="25" rx="28" ry="30" fill={gaugeColor} opacity={0.7} />
            <rect x="50" y="50" width="20" height="15" fill={gaugeColor} opacity={0.5} />
            <path d="M30 65 L90 65 L85 140 L35 140 Z" fill={vitals.spo2 < 92 ? '#3b82f6' : gaugeColor} opacity={0.6} />
            <g transform="translate(50, 80)">
              <path d="M10 6 C10 2, 15 0, 18 3 C21 0, 26 2, 26 6 C26 12, 18 18, 18 18 C18 18, 10 12, 10 6" fill="#ef4444" style={{ animation: vitals.hr > 0 ? `heartbeat ${60/vitals.hr}s infinite` : 'none' }} />
            </g>
            <g style={{ animation: vitals.rr > 0 ? `breathe ${breatheRate}s infinite` : 'none', transformOrigin: 'center' }} transform="translate(42, 65)">
              <ellipse cx="-5" cy="25" rx="18" ry="28" fill="#60a5fa" opacity={0.5} />
              <ellipse cx="41" cy="25" rx="18" ry="28" fill="#60a5fa" opacity={0.5} />
            </g>
            <ellipse cx="60" cy="155" rx="25" ry="18" fill={gaugeColor} opacity={0.4} />
          </g>
        )}

        {/* ===== MODE D: RISK RADAR ===== */}
        {mode === 'risk' && (
          <g>
            {[40, 80, 120, 160].map(r => <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />)}
            {radarAxes.map((label, i) => {
              const angle = (i * 360) / axisCount;
              const p = polarToCartesian(cx, cy, 160, angle);
              const lp = polarToCartesian(cx, cy, 175, angle);
              return (
                <g key={label}>
                  <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#475569" strokeWidth="1" />
                  <text x={lp.x} y={lp.y} fill={radarValues[i] < 0.3 || radarValues[i] > 0.75 ? '#f97316' : '#94a3b8'} fontSize="9" textAnchor="middle" dominantBaseline="middle">{label}</text>
                </g>
              );
            })}
            <polygon points={radarPoints} fill={radarFill} stroke={gaugeColor} strokeWidth="2" />
            {radarValues.map((v, i) => {
              const p = polarToCartesian(cx, cy, v * 130 + 20, (i * 360 / axisCount));
              return <circle key={i} cx={p.x} cy={p.y} r="5" fill={v < 0.3 || v > 0.75 ? '#f97316' : gaugeColor} />;
            })}
          </g>
        )}

        {/* Center MOASS display - always visible */}
        <circle cx={cx} cy={cy} r="70" fill="#0f172a" stroke={gaugeColor} strokeWidth="3" />
        <text x={cx} y={cy - 10} fill={gaugeColor} fontSize="48" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">{moass}</text>
        <text x={cx} y={cy + 30} fill="#94a3b8" fontSize="14" textAnchor="middle">{MOASS_LABELS[moass]}</text>

        {isCrisis && (
          <text x={cx} y={cy + 100} fill="#ef4444" fontSize="14" fontWeight="bold" textAnchor="middle" className="animate-pulse">
            {vitals.spo2 < 90 ? '⚠ DESAT' : vitals.rr < 6 ? '⚠ APNEA' : '⚠ CRITICAL'}
          </text>
        )}

        <circle cx={cx} cy={cy - outerR + 8} r="4" fill="#94a3b8" />
      </svg>

      {/* Vitals row */}
      <div className="flex gap-3 mt-2 text-xs">
        <span><span className="text-slate-500">HR</span> <span className="text-green-400 font-bold">{vitals.hr.toFixed(0)}</span></span>
        <span><span className="text-slate-500">SpO2</span> <span className="text-cyan-400 font-bold">{vitals.spo2.toFixed(0)}%</span></span>
        <span><span className="text-slate-500">RR</span> <span className="text-yellow-400 font-bold">{vitals.rr.toFixed(0)}</span></span>
        <span><span className="text-slate-500">BP</span> <span className="text-pink-400 font-bold">{vitals.sbp.toFixed(0)}/{vitals.dbp.toFixed(0)}</span></span>
      </div>

      {activeDrugs.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 justify-center max-w-sm">
          {activeDrugs.slice(0, 3).map(d => (
            <span key={d.key} className="text-xs px-1.5 py-0.5 rounded bg-slate-800">
              <span style={{ color: d.color }}>{d.name}</span>
              <span className="text-slate-500 ml-1">Ce {d.ce.toFixed(2)}</span>
            </span>
          ))}
        </div>
      )}

      {activeSynergies.length > 0 && (
        <div className="mt-1 text-xs text-orange-400">⚡ Synergy</div>
      )}
    </div>
  );
}
