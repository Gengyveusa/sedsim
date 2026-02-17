import { useState, useEffect } from 'react';
import useSimStore from '../store/useSimStore';
import { DRUG_DATABASE } from '../engine/drugs';
import { hillEffect } from '../engine/pdModel';
import { MOASSLevel } from '../types';

// Drug class definitions for synergy detection
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
  5: '#22c55e',
  4: '#84cc16',
  3: '#eab308',
  2: '#f97316',
  1: '#ef4444',
  0: '#dc2626',
};

const MOASS_LABELS = ['Unresponsive', 'Deep', 'Moderate', 'Light', 'Drowsy', 'Awake'];

type GaugeMode = 'avatar' | 'risk';

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  if (endAngle - startAngle >= 360) {
    return [
      `M ${cx - r} ${cy}`,
      `A ${r} ${r} 0 1 1 ${cx + r} ${cy}`,
      `A ${r} ${r} 0 1 1 ${cx - r} ${cy}`,
    ].join(' ');
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

  // Crisis detection - auto-switch to risk view
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

  // Calculate body colors based on state
  const brainColor = gaugeColor;
  const chestColor = vitals.spo2 < 92 ? '#3b82f6' : gaugeColor;
  const bodyOpacity = 1 - (combinedEff * 0.6);
  const breatheRate = vitals.rr > 0 ? (60 / vitals.rr) : 0;

  // Radar chart calculations
  const radarAxes = ['Sedation', 'HR', 'SpO2', 'EtCO2', 'RR', 'MAP', 'Drugs', 'Risk'];
  const normalizeValue = (val: number, min: number, max: number, invert = false) => {
    const norm = Math.max(0, Math.min(1, (val - min) / (max - min)));
    return invert ? 1 - norm : norm;
  };

  const radarValues = [
    normalizeValue(moass, 0, 5),
    normalizeValue(vitals.hr, 40, 120, false) * 0.5 + 0.25,
    normalizeValue(vitals.spo2, 70, 100),
    1 - normalizeValue(vitals.etco2, 20, 60),
    normalizeValue(vitals.rr, 0, 25) * 0.7 + 0.15,
    normalizeValue(vitals.map, 50, 110) * 0.6 + 0.2,
    combinedEff,
    Math.min(1, (combinedEff * 0.5) + (activeSynergies.length * 0.2) + (isCrisis ? 0.5 : 0)),
  ];

  const radarFillColor = isCrisis ? 'rgba(220,38,38,0.35)'
    : moass <= 2 ? 'rgba(249,115,22,0.3)'
    : moass <= 3 ? 'rgba(234,179,8,0.25)'
    : 'rgba(34,197,94,0.25)';
  const radarStrokeColor = gaugeColor;

  const axisCount = radarAxes.length;
  const radarPoints = radarValues.map((v, i) => {
    const p = polarToCartesian(cx, cy, v * 130 + 20, (i * 360 / axisCount));
    return `${p.x},${p.y}`;
  }).join(' ');

  return (
    <div className="flex flex-col items-center">
      {/* MODE TOGGLE BUTTONS - Prominently visible */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setMode('avatar')}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
            mode === 'avatar'
              ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/50'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          PATIENT
        </button>
        <button
          onClick={() => setMode('risk')}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
            mode === 'risk'
              ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/50'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          RISK RADAR
        </button>
      </div>

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#334155" strokeWidth="3" />

        {/* Drug effect arc */}
        {combinedEff > 0.01 && (
          <path
            d={describeArc(cx, cy, outerR, 0, combinedEff * 360)}
            fill="none"
            stroke={gaugeColor}
            strokeWidth="6"
            strokeLinecap="round"
            opacity={0.8}
          />
        )}

        {/* ===== MODE: AVATAR ===== */}
        {mode === 'avatar' && (
          <g transform={`translate(${cx - 60}, ${cy - 90})`} opacity={bodyOpacity}>
            {/* Head/Brain */}
            <ellipse cx="60" cy="25" rx="28" ry="30" fill={brainColor} opacity={0.7} />
            {/* Neck */}
            <rect x="50" y="50" width="20" height="15" fill={gaugeColor} opacity={0.5} />
            {/* Torso */}
            <path d="M30 65 L90 65 L85 140 L35 140 Z" fill={chestColor} opacity={0.6} />
            {/* Heart - pulsing */}
            <g transform="translate(50, 80)">
              <path
                d="M10 6 C10 2, 15 0, 18 3 C21 0, 26 2, 26 6 C26 12, 18 18, 18 18 C18 18, 10 12, 10 6"
                fill="#ef4444"
                style={{ animation: vitals.hr > 0 ? `heartbeat ${60/vitals.hr}s infinite` : 'none' }}
              />
            </g>
            {/* Lungs - breathing */}
            <g style={{
              animation: vitals.rr > 0 ? `breathe ${breatheRate}s infinite` : 'none',
              transformOrigin: 'center'
            }} transform="translate(42, 65)">
              <ellipse cx="-5" cy="25" rx="18" ry="28" fill="#60a5fa" opacity={0.5} />
              <ellipse cx="41" cy="25" rx="18" ry="28" fill="#60a5fa" opacity={0.5} />
            </g>
            {/* Abdomen */}
            <ellipse cx="60" cy="155" rx="25" ry="18" fill={gaugeColor} opacity={0.4} />
          </g>
        )}

        {/* ===== MODE: RISK RADAR ===== */}
        {mode === 'risk' && (
          <g>
            {/* Grid circles */}
            {[40, 80, 120, 160].map(r => (
              <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
            ))}

            {/* Axis lines and labels */}
            {radarAxes.map((label, i) => {
              const angle = (i * 360) / axisCount;
              const p = polarToCartesian(cx, cy, 160, angle);
              const lp = polarToCartesian(cx, cy, 175, angle);
              const isWarning = radarValues[i] < 0.3 || radarValues[i] > 0.75;
              return (
                <g key={label}>
                  <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#475569" strokeWidth="1" />
                  <text x={lp.x} y={lp.y} fill={isWarning ? '#f97316' : '#94a3b8'} fontSize="10" textAnchor="middle" dominantBaseline="middle">{label}</text>
                </g>
              );
            })}

            {/* Radar polygon */}
            <polygon points={radarPoints} fill={radarFillColor} stroke={radarStrokeColor} strokeWidth="2" />

            {/* Vertex dots */}
            {radarValues.map((v, i) => {
              const p = polarToCartesian(cx, cy, v * 130 + 20, (i * 360 / axisCount));
              const isWarn = v < 0.3 || v > 0.75;
              return (
                <circle key={i} cx={p.x} cy={p.y} r="5" fill={isWarn ? '#f97316' : gaugeColor} />
              );
            })}
          </g>
        )}

        {/* Center MOASS display - always visible */}
        <circle cx={cx} cy={cy} r="70" fill="#0f172a" stroke={gaugeColor} strokeWidth="3" />
        <text x={cx} y={cy - 10} fill={gaugeColor} fontSize="48" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">{moass}</text>
        <text x={cx} y={cy + 30} fill="#94a3b8" fontSize="14" textAnchor="middle">{MOASS_LABELS[moass]}</text>

        {/* Crisis alert */}
        {isCrisis && (
          <text x={cx} y={cy + 100} fill="#ef4444" fontSize="14" fontWeight="bold" textAnchor="middle" className="animate-pulse">
            {vitals.spo2 < 90 ? '⚠ DESATURATION' : vitals.rr < 6 ? '⚠ APNEA RISK' : '⚠ CRITICAL'}
          </text>
        )}

        {/* 12 o'clock marker */}
        <circle cx={cx} cy={cy - outerR + 8} r="4" fill="#94a3b8" />
      </svg>

      {/* Vitals display below gauge */}
      <div className="flex gap-4 mt-3 text-sm">
        <span><span className="text-slate-400">HR</span> <span className="text-green-400 font-bold">{vitals.hr}</span></span>
        <span><span className="text-slate-400">SpO2</span> <span className="text-cyan-400 font-bold">{vitals.spo2}%</span></span>
        <span><span className="text-slate-400">RR</span> <span className="text-yellow-400 font-bold">{vitals.rr}</span></span>
        <span><span className="text-slate-400">BP</span> <span className="text-pink-400 font-bold">{vitals.sbp}/{vitals.dbp}</span></span>
      </div>

      {/* Drug legend */}
      {activeDrugs.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 justify-center max-w-md">
          {activeDrugs.slice(0, 4).map(d => (
            <span key={d.key} className="text-xs px-2 py-1 rounded bg-slate-800">
              <span style={{ color: d.color }}>{d.name}</span>
              <span className="text-slate-500 ml-1">Ce {d.ce.toFixed(2)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Synergy warning */}
      {activeSynergies.length > 0 && (
        <div className="mt-2 text-xs text-orange-400 font-medium">
          ⚡ Synergy: {activeSynergies.map(([c1, c2]) => `${c1}+${c2}`).join(', ')}
        </div>
      )}
    </div>
  );
}
