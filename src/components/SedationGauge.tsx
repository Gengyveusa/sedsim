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
    normalizeValue(moass, 0, 5),  // Sedation
    normalizeValue(vitals.hr, 40, 120, false) * 0.5 + 0.25, // HR centered
    normalizeValue(vitals.spo2, 70, 100), // SpO2
    1 - normalizeValue(vitals.etco2, 20, 60), // EtCO2 (high is bad)
    normalizeValue(vitals.rr, 0, 25) * 0.7 + 0.15, // RR
    normalizeValue(vitals.map, 50, 110) * 0.6 + 0.2, // MAP
    combinedEff, // Drug load
    Math.min(1, (combinedEff * 0.5) + (activeSynergies.length * 0.2) + (isCrisis ? 0.5 : 0)), // Risk
  ];

  const radarFillColor = isCrisis ? 'rgba(220,38,38,0.35)' 
    : moass <= 2 ? 'rgba(249,115,22,0.3)' 
    : moass <= 3 ? 'rgba(234,179,8,0.25)' 
    : 'rgba(34,197,94,0.25)';
  const radarStrokeColor = gaugeColor;

  // Generate radar polygon points
  const axisCount = radarAxes.length;
  const radarPoints = radarValues.map((v, i) => {
    const p = polarToCartesian(cx, cy, v * 130 + 20, (i * 360 / axisCount));
    return `${p.x},${p.y}`;
  }).join(' ');

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="brainGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={brainColor} stopOpacity="0.6" />
            <stop offset="100%" stopColor={brainColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#1e293b" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={outerR - 8} fill="none" stroke={gaugeColor} strokeWidth="3" opacity="0.3" />

        {/* Mode tabs on outer rim */}
        <g className="cursor-pointer">
          {/* Avatar tab - top left arc */}
          <path
            d={describeArc(cx, cy, outerR + 12, 200, 250)}
            fill="none"
            stroke={mode === 'avatar' ? '#3b82f6' : '#334155'}
            strokeWidth={mode === 'avatar' ? 4 : 2}
            onClick={() => setMode('avatar')}
            className="cursor-pointer hover:stroke-blue-400 transition-colors"
          />
          <text
            x={polarToCartesian(cx, cy, outerR + 28, 225).x}
            y={polarToCartesian(cx, cy, outerR + 28, 225).y}
            textAnchor="middle"
            fill={mode === 'avatar' ? '#3b82f6' : '#64748b'}
            fontSize="9"
            fontWeight={mode === 'avatar' ? 'bold' : 'normal'}
            className="cursor-pointer select-none"
            onClick={() => setMode('avatar')}
          >PATIENT</text>

          {/* Risk tab - top right arc */}
          <path
            d={describeArc(cx, cy, outerR + 12, 290, 340)}
            fill="none"
            stroke={mode === 'risk' ? '#f97316' : '#334155'}
            strokeWidth={mode === 'risk' ? 4 : 2}
            onClick={() => setMode('risk')}
            className="cursor-pointer hover:stroke-orange-400 transition-colors"
          />
          <text
            x={polarToCartesian(cx, cy, outerR + 28, 315).x}
            y={polarToCartesian(cx, cy, outerR + 28, 315).y}
            textAnchor="middle"
            fill={mode === 'risk' ? '#f97316' : '#64748b'}
            fontSize="9"
            fontWeight={mode === 'risk' ? 'bold' : 'normal'}
            className="cursor-pointer select-none"
            onClick={() => setMode('risk')}
          >RISK</text>
        </g>

                {/* Drug effect arc */}
        {combinedEff > 0.01 && (
          <path
            d={describeArc(cx, cy, outerR - 4, 0, combinedEff * 270)}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="6"
            strokeLinecap="round"
            opacity="0.8"
          />
        )}

        {/* ===== MODE: AVATAR ===== */}
        {mode === 'avatar' && (
          <g style={{ opacity: bodyOpacity, transition: 'opacity 0.5s' }} transform={`translate(${cx - 45}, ${cy - 95})`}>
            {/* Head/Brain */}
            <ellipse cx="45" cy="22" rx="28" ry="24" fill="url(#brainGlow)" className={isCrisis ? 'animate-pulse' : ''} />
            <ellipse cx="45" cy="22" rx="22" ry="18" fill={brainColor} opacity="0.4" filter="url(#glow)" />
            
            {/* Neck */}
            <rect x="36" y="42" width="18" height="14" fill="#e2e8f0" opacity="0.3" rx="4" />
            
            {/* Torso */}
            <path d="M15,56 Q3,75 8,120 L82,120 Q87,75 75,56 Z" fill="#e2e8f0" opacity="0.2" />
            
            {/* Heart - pulsing */}
            <g transform="translate(28, 68)" style={{ animation: `heartbeat ${60 / Math.max(vitals.hr, 30)}s infinite` }}>
              <path d="M10,5 C10,0 15,0 15,5 C15,0 20,0 20,5 C20,12 10,20 10,20 C10,20 0,12 0,5 C0,0 5,0 5,5 C5,0 10,0 10,5" fill={chestColor} opacity="0.8" />
            </g>
            
            {/* Lungs - breathing */}
            <g style={{ animation: breatheRate > 0 ? `breathe ${breatheRate}s infinite` : 'none', transformOrigin: 'center' }} transform="translate(42, 65)">
              <ellipse cx="16" cy="22" rx="14" ry="20" fill={vitals.spo2 < 90 ? '#3b82f6' : chestColor} opacity="0.5" />
              <ellipse cx="-10" cy="22" rx="14" ry="20" fill={vitals.spo2 < 90 ? '#3b82f6' : chestColor} opacity="0.5" />
            </g>
            
            {/* Abdomen */}
            <ellipse cx="45" cy="135" rx="30" ry="14" fill={chestColor} opacity="0.2" />
          </g>
        )}

                {/* ===== MODE: RISK RADAR ===== */}
        {mode === 'risk' && (
          <g>
            {/* Grid circles */}
            {[40, 80, 120, 160].map(r => (
              <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,4" />
            ))}
            
            {/* Axis lines and labels */}
            {radarAxes.map((label, i) => {
              const angle = (i * 360) / axisCount;
              const p = polarToCartesian(cx, cy, 160, angle);
              const lp = polarToCartesian(cx, cy, 175, angle);
              const isWarning = radarValues[i] < 0.3 || radarValues[i] > 0.75;
              return (
                <g key={label}>
                  <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#334155" strokeWidth="1" />
                  <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fill={isWarning ? '#f97316' : '#64748b'} fontSize="9" fontWeight={isWarning ? 'bold' : 'normal'}>{label}</text>
                </g>
              );
            })}
            
            {/* Radar polygon */}
            <polygon
              points={radarPoints}
              fill={radarFillColor}
              stroke={radarStrokeColor}
              strokeWidth="2"
              style={{ transition: 'all 0.5s' }}
              className={isCrisis ? 'animate-pulse' : ''}
              filter="url(#glow)"
            />
            
            {/* Vertex dots */}
            {radarValues.map((v, i) => {
              const p = polarToCartesian(cx, cy, v * 130 + 20, (i * 360 / axisCount));
              const isWarn = v < 0.3 || v > 0.75;
              return (
                <circle key={i} cx={p.x} cy={p.y} r={isWarn ? 6 : 4} fill={isWarn ? '#f97316' : radarStrokeColor} className={isWarn ? 'animate-pulse' : ''} />
              );
            })}
          </g>
        )}

                {/* Center MOASS display - always visible */}
        <circle cx={cx} cy={cy} r={50} fill="#0a0a14" stroke={gaugeColor} strokeWidth="2" />
        <text x={cx} y={cy + 15} textAnchor="middle" fill={gaugeColor} fontSize="56" fontWeight="bold" filter="url(#glow)">{moass}</text>
        <text x={cx} y={cy + 35} textAnchor="middle" fill="#94a3b8" fontSize="10">{MOASS_LABELS[moass]}</text>

        {/* Crisis alert */}
        {isCrisis && (
          <text x={cx} y={cy - 120} textAnchor="middle" fill="#dc2626" fontSize="12" fontWeight="bold" className="animate-pulse">
            {vitals.spo2 < 90 ? '⚠ DESATURATION' : vitals.rr < 6 ? '⚠ APNEA RISK' : '⚠ CRITICAL'}
          </text>
        )}

        {/* 12 o'clock marker */}
        <line x1={cx} y1={cy - outerR + 15} x2={cx} y2={cy - outerR + 5} stroke="#64748b" strokeWidth="2" />
      </svg>

      {/* Vitals display below gauge */}
      <div className="flex gap-4 mt-2 text-xs">
        <span><span className="text-green-400">HR</span> {vitals.hr}</span>
        <span><span className="text-cyan-400">SpO2</span> {vitals.spo2}%</span>
        <span><span className="text-yellow-400">RR</span> {vitals.rr}</span>
        <span><span className="text-red-400">BP</span> {vitals.sbp}/{vitals.dbp}</span>
      </div>

      {/* Drug legend */}
      {activeDrugs.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 justify-center text-xs">
          {activeDrugs.slice(0, 4).map(d => (
            <span key={d.key} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-gray-400">{d.name}</span>
              <span className="text-gray-500">Ce {d.ce.toFixed(2)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Synergy warning */}
      {activeSynergies.length > 0 && (
        <div className="text-xs text-amber-400 mt-1 animate-pulse">
          ⚡ Synergy: {activeSynergies.map(([c1, c2]) => `${c1}+${c2}`).join(', ')}
        </div>
      )}
    </div>
  );
}
