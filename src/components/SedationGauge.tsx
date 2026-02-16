import useSimStore from '../store/useSimStore';
import { DRUG_DATABASE } from '../engine/drugs';
import { moassLabel } from '../engine/pdModel';
import { MOASSLevel } from '../types';

const MOASS_COLORS: Record<MOASSLevel, string> = {
  5: '#22c55e', // green - awake
  4: '#84cc16', // lime - drowsy
  3: '#eab308', // yellow - moderate
  2: '#f97316', // orange - deep
  1: '#ef4444', // red - general
  0: '#dc2626', // dark red - unresponsive
};

const MOASS_THRESHOLDS = [
  { effect: 0.0, moass: 5 as MOASSLevel },
  { effect: 0.1, moass: 4 as MOASSLevel },
  { effect: 0.25, moass: 3 as MOASSLevel },
  { effect: 0.45, moass: 2 as MOASSLevel },
  { effect: 0.65, moass: 1 as MOASSLevel },
  { effect: 0.85, moass: 0 as MOASSLevel },
];

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

export default function SedationGauge() {
  const { combinedEff, moass, pkStates } = useSimStore();

  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 95;
  const innerR = 70;
  const strokeW = 22;
  const arcR = (outerR + innerR) / 2;

  // Sweep angle: 0 effect = 0 degrees, 1.0 effect = 360 degrees
  const sweepAngle = Math.min(combinedEff, 1) * 360;
  const gaugeColor = getGaugeColor(combinedEff);

  // Collect active drugs (Ce > 0.001)
  const activeDrugs = Object.entries(pkStates)
    .filter(([, s]) => s.ce > 0.001)
    .map(([name, s]) => ({
      name: DRUG_DATABASE[name]?.name || name,
      ce: s.ce,
      color: DRUG_DATABASE[name]?.color || '#888',
    }))
    .sort((a, b) => b.ce - a.ce)
    .slice(0, 3);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          cx={cx} cy={cy} r={arcR}
          fill="none" stroke="#1e293b" strokeWidth={strokeW}
        />

        {/* MOASS zone tick marks at 12 o'clock positions */}
        {MOASS_THRESHOLDS.slice(1).map((t, i) => {
          const angle = t.effect * 360;
          const p1 = polarToCartesian(cx, cy, innerR - 2, angle);
          const p2 = polarToCartesian(cx, cy, outerR + 2, angle);
          return (
            <line
              key={i}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="#475569" strokeWidth={1.5}
            />
          );
        })}

        {/* Colored arc - the main gauge sweep */}
        {sweepAngle > 0.5 && (
          <path
            d={describeArc(cx, cy, arcR, 0, sweepAngle)}
            fill="none"
            stroke={gaugeColor}
            strokeWidth={strokeW}
            strokeLinecap="round"
            style={{ transition: 'stroke 0.3s ease' }}
          />
        )}

        {/* Needle / indicator line at the sweep tip */}
        {sweepAngle > 0.5 && (() => {
          const tip = polarToCartesian(cx, cy, outerR + 6, sweepAngle);
          const base = polarToCartesian(cx, cy, innerR - 6, sweepAngle);
          return (
            <line
              x1={base.x} y1={base.y} x2={tip.x} y2={tip.y}
              stroke="#fff" strokeWidth={2.5} strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.5))' }}
            />
          );
        })()}

        {/* 12 o'clock start marker */}
        <line
          x1={cx} y1={cy - innerR + 4} x2={cx} y2={cy - outerR - 4}
          stroke="#94a3b8" strokeWidth={2} strokeLinecap="round"
        />

        {/* Center text - MOASS level */}
        <text
          x={cx} y={cy - 12}
          textAnchor="middle" dominantBaseline="middle"
          fill={gaugeColor}
          fontSize="42" fontWeight="bold"
          style={{ transition: 'fill 0.3s ease' }}
        >
          {moass}
        </text>
        <text
          x={cx} y={cy + 16}
          textAnchor="middle" dominantBaseline="middle"
          fill="#94a3b8" fontSize="11"
        >
          {moassLabel(moass)}
        </text>
        <text
          x={cx} y={cy + 32}
          textAnchor="middle" dominantBaseline="middle"
          fill="#64748b" fontSize="9"
        >
          Effect: {(combinedEff * 100).toFixed(0)}%
        </text>

        {/* Zone labels around the outside */}
        {[
          { angle: 0, label: '5' },
          { angle: 36, label: '4' },
          { angle: 90, label: '3' },
          { angle: 162, label: '2' },
          { angle: 234, label: '1' },
          { angle: 306, label: '0' },
        ].map((z, i) => {
          const p = polarToCartesian(cx, cy, outerR + 14, z.angle);
          return (
            <text
              key={i}
              x={p.x} y={p.y}
              textAnchor="middle" dominantBaseline="middle"
              fill="#64748b" fontSize="9" fontWeight="500"
            >
              {z.label}
            </text>
          );
        })}
      </svg>

      {/* Active drug concentrations below gauge */}
      {activeDrugs.length > 0 && (
        <div className="mt-1 space-y-0.5 w-full max-w-[200px]">
          {activeDrugs.map((d) => (
            <div key={d.name} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: d.color }}
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
    </div>
  );
}
