import useSimStore from '../store/useSimStore';
import { DRUG_DATABASE } from '../engine/drugs';
import { moassLabel, hillEffect } from '../engine/pdModel';
import { MOASSLevel } from '../types';

// Drug class definitions for synergy detection
const DRUG_CLASSES: Record<string, string[]> = {
  opioid: ['fentanyl', 'remifentanil'],
  benzodiazepine: ['midazolam'],
  hypnotic: ['propofol', 'etomidate'],
  dissociative: ['ketamine'],
  alpha2: ['dexmedetomidine'],
};

// Synergy pairs that potentiate effects (especially respiratory depression)
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

function getGaugeColor(effect: number): string {
  if (effect < 0.1) return MOASS_COLORS[5];
  if (effect < 0.25) return MOASS_COLORS[4];
  if (effect < 0.45) return MOASS_COLORS[3];
  if (effect < 0.65) return MOASS_COLORS[2];
  if (effect < 0.85) return MOASS_COLORS[1];
  return MOASS_COLORS[0];
}

function getDrugClass(drugKey: string): string | null {
  for (const [cls, drugs] of Object.entries(DRUG_CLASSES)) {
    if (drugs.includes(drugKey)) return cls;
  }
  return null;
}

export default function SedationGauge() {
  const { combinedEff, moass, pkStates } = useSimStore();

  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const baseR = 60;
  const ringSpacing = 12;
  const strokeW = 8;

  // Get active sedation drugs (Ce > 0.001, exclude local anesthetics)
  const localAnesthetics = ['lidocaine_epi', 'articaine_epi', 'bupivacaine'];
  const activeDrugs = Object.entries(pkStates)
    .filter(([name, s]) => s.ce > 0.001 && !localAnesthetics.includes(name))
    .map(([name, s]) => {
      const drug = DRUG_DATABASE[name];
      if (!drug) return null;
      const effect = hillEffect(s.ce, drug.EC50, drug.gamma);
      const maxCe = drug.EC50 * 3;
      const intensity = Math.min(1, s.ce / maxCe);
      return {
        key: name,
        name: drug.name,
        ce: s.ce,
        effect,
        color: drug.color,
        intensity,
        drugClass: getDrugClass(name),
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .sort((a, b) => b.effect - a.effect);

  // Detect active synergies
  const activeClasses = new Set(activeDrugs.map(d => d.drugClass).filter(Boolean));
  const activeSynergies = SYNERGY_PAIRS.filter(
    ([c1, c2]) => activeClasses.has(c1) && activeClasses.has(c2)
  );

  const gaugeColor = getGaugeColor(combinedEff);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <circle cx={cx} cy={cy} r={baseR + 30} fill="none" stroke="#1e293b" strokeWidth={strokeW * 6} opacity={0.3} />

        {/* Per-drug rings */}
        {activeDrugs.slice(0, 4).map((drug, i) => {
          const r = baseR + i * ringSpacing;
          const sweepAngle = Math.min(drug.effect, 1) * 360;
          const opacity = 0.4 + drug.intensity * 0.6;
          if (sweepAngle < 1) return null;
          return (
            <g key={drug.key}>
              {/* Track */}
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="#334155" strokeWidth={strokeW} opacity={0.3} />
              {/* Colored arc */}
              <path
                d={describeArc(cx, cy, r, 0, sweepAngle)}
                fill="none"
                stroke={drug.color}
                strokeWidth={strokeW}
                strokeLinecap="round"
                opacity={opacity}
                filter={drug.intensity > 0.5 ? 'url(#glow)' : undefined}
                style={{ transition: 'opacity 0.3s, stroke 0.3s' }}
              />
              {/* Needle at tip */}
              {(() => {
                const tip = polarToCartesian(cx, cy, r + 5, sweepAngle);
                const base = polarToCartesian(cx, cy, r - 5, sweepAngle);
                return (
                  <line
                    x1={base.x} y1={base.y} x2={tip.x} y2={tip.y}
                    stroke={drug.color} strokeWidth={2} strokeLinecap="round"
                    opacity={opacity}
                  />
                );
              })()}
            </g>
          );
        })}

        {/* Synergy dots - pulsing indicators where drug classes overlap */}
        {activeSynergies.length > 0 && (() => {
          const angles = [45, 90, 135, 180];
          return activeSynergies.slice(0, 4).map((_pair, i) => {
            const angle = angles[i % angles.length];
            const r = baseR + (activeDrugs.length * ringSpacing) / 2;
            const pos = polarToCartesian(cx, cy, r, angle);
            return (
              <g key={`synergy-${i}`}>
                <circle
                  cx={pos.x} cy={pos.y} r={6}
                  fill="#fbbf24" opacity={0.8}
                  style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
                />
                <circle
                  cx={pos.x} cy={pos.y} r={3}
                  fill="#fff"
                />
              </g>
            );
          });
        })()}

        {/* 12 o'clock marker */}
        <line
          x1={cx} y1={cy - baseR + 10} x2={cx} y2={cy - baseR - 35}
          stroke="#94a3b8" strokeWidth={2} strokeLinecap="round"
        />

        {/* Center - MOASS display */}
        <text
          x={cx} y={cy - 8}
          textAnchor="middle" dominantBaseline="middle"
          fill={gaugeColor} fontSize="36" fontWeight="bold"
        >
          {moass}
        </text>
        <text
          x={cx} y={cy + 14}
          textAnchor="middle" dominantBaseline="middle"
          fill="#94a3b8" fontSize="10"
        >
          {moassLabel(moass)}
        </text>
        <text
          x={cx} y={cy + 28}
          textAnchor="middle" dominantBaseline="middle"
          fill="#64748b" fontSize="8"
        >
          Effect: {(combinedEff * 100).toFixed(0)}%
        </text>
      </svg>

      {/* Legend - active drugs with Ce values */}
      {activeDrugs.length > 0 && (
        <div className="mt-1 space-y-0.5 w-full max-w-[220px]">
          {activeDrugs.slice(0, 4).map((d) => (
            <div key={d.key} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <span
                  className="w-3 h-1 rounded-sm"
                  style={{ backgroundColor: d.color, opacity: 0.4 + d.intensity * 0.6 }}
                />
                <span className="text-gray-400">{d.name}</span>
              </span>
              <span className="font-mono text-gray-300">
                Ce {d.ce.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Synergy warning */}
      {activeSynergies.length > 0 && (
        <div className="mt-2 px-2 py-1 bg-amber-500/20 border border-amber-500/50 rounded text-xs text-amber-300 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Synergy: {activeSynergies.map(([c1, c2]) => `${c1}+${c2}`).join(', ')}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.3); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
