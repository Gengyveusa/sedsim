import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import useSimStore from '../store/useSimStore';
import { DRUG_DATABASE } from '../engine/drugs';

// Drug half-life data (approximate distribution/elimination)
const DRUG_HALF_LIVES: Record<string, { dist: number; elim: number; unit: string }> = {
  propofol: { dist: 2, elim: 40, unit: 'min' },
  midazolam: { dist: 7, elim: 120, unit: 'min' },
  fentanyl: { dist: 13, elim: 219, unit: 'min' },
  ketamine: { dist: 11, elim: 150, unit: 'min' },
};

// Vital trend configurations
const VITAL_CONFIGS = [
  { key: 'hr',    label: 'HR',     unit: 'bpm',  color: '#22c55e', dataKey: 'hr',   yMin: 0,  yMax: 200 },
  { key: 'spo2',  label: 'SpO\u2082', unit: '%', color: '#06b6d4', dataKey: 'spo2', yMin: 70, yMax: 100 },
  { key: 'sbp',   label: 'BP',     unit: 'mmHg', color: '#ef4444', dataKey: 'sbp',  yMin: 40, yMax: 200 },
  { key: 'rr',    label: 'RR',     unit: '/min', color: '#eab308', dataKey: 'rr',   yMin: 0,  yMax: 40  },
  { key: 'etco2', label: 'EtCO\u2082', unit: 'mmHg', color: '#a855f7', dataKey: 'etco2', yMin: 0, yMax: 80 },
] as const;

type VitalKey = typeof VITAL_CONFIGS[number]['key'];

interface CollapsibleTrendProps {
  label: string;
  unit: string;
  color: string;
  currentValue: number;
  data: { time: string; value: number }[];
  yMin: number;
  yMax: number;
  isAlarm?: boolean;
}

function CollapsibleTrend({ label, unit, color, currentValue, data, yMin, yMax, isAlarm = false }: CollapsibleTrendProps) {
  const [expanded, setExpanded] = useState(false);
  const displayColor = isAlarm ? '#f87171' : color;

  return (
    <div className="border-b border-gray-700/50">
      {/* Collapsed header – always visible */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-800/60 transition-colors text-left"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold w-12 shrink-0" style={{ color: displayColor }}>{label}</span>
          <span
            className={`text-xl font-mono font-bold leading-none${isAlarm ? ' animate-pulse' : ''}`}
            style={{ color: displayColor }}
          >
            {Math.round(currentValue)}
          </span>
          <span className="text-xs text-gray-500">{unit}</span>
        </div>
        <span className="text-gray-500 text-xs ml-2">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expandable chart with CSS height transition */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: expanded ? '120px' : '0',
          transition: 'max-height 0.25s ease-in-out',
        }}
      >
        <div className="px-2 pb-2" style={{ height: 110 }}>
          <ResponsiveContainer width="100%" height={106}>
            <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#1f2937" />
              <XAxis dataKey="time" stroke="#4b5563" tick={{ fontSize: 8 }} interval="preserveStartEnd" />
              <YAxis stroke="#4b5563" tick={{ fontSize: 8 }} domain={[yMin, yMax]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #374151', fontSize: 10 }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default function TrendGraph() {
  const { trendData, vitals } = useSimStore();
  const [pkExpanded, setPkExpanded] = useState(false);

  // Show last 120 data points (10 minutes at 5s intervals)
  const displayData = trendData.slice(-120).map(point => ({
    time: Math.floor(point.time / 60) + ':' + (point.time % 60).toString().padStart(2, '0'),
    timeSec: point.time,
    hr: point.vitals.hr,
    sbp: point.vitals.sbp,
    spo2: point.vitals.spo2,
    rr: point.vitals.rr,
    etco2: point.vitals.etco2 ?? 0,
    ...Object.fromEntries(
      Object.entries(point.cp || {}).map(([k, v]) => [`cp_${k}`, v])
    ),
    ...Object.fromEntries(
      Object.entries(point.ce || {}).map(([k, v]) => [`ce_${k}`, v])
    ),
  }));

  // Check if any drug has non-zero concentration
  const hasConcentrations = displayData.some(d =>
    Object.keys(DRUG_DATABASE).some(name =>
      (d[`cp_${name}` as keyof typeof d] as number) > 0.001 ||
      (d[`ce_${name}` as keyof typeof d] as number) > 0.001
    )
  );

  if (displayData.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 bg-sim-panel p-4">
        <div className="text-center text-xs">
          <p>Start the simulation</p>
          <p className="text-gray-600 mt-1">Trends will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-sim-panel overflow-auto">
      {/* Individual vital sign accordion panels */}
      {VITAL_CONFIGS.map(cfg => {
        const data = displayData.map(d => ({
          time: d.time,
          value: d[cfg.dataKey as keyof typeof d] as number,
        }));
        const currentVal = (vitals[cfg.key as VitalKey] as number) ?? 0;
        const isAlarm =
          (cfg.key === 'hr'    && (currentVal < 50 || currentVal > 120)) ||
          (cfg.key === 'spo2'  && currentVal < 90) ||
          (cfg.key === 'sbp'   && currentVal < 80) ||
          (cfg.key === 'rr'    && currentVal < 6)  ||
          (cfg.key === 'etco2' && currentVal > 55);

        return (
          <CollapsibleTrend
            key={cfg.key}
            label={cfg.label}
            unit={cfg.unit}
            color={cfg.color}
            currentValue={currentVal}
            data={data}
            yMin={cfg.yMin}
            yMax={cfg.yMax}
            isAlarm={isAlarm}
          />
        );
      })}

      {/* PK Concentrations – collapsible */}
      <div className="border-b border-gray-700/50">
        <button
          onClick={() => setPkExpanded(prev => !prev)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-800/60 transition-colors text-left"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <span className="text-xs font-semibold text-gray-400">PK Conc.</span>
          <span className="text-gray-500 text-xs ml-2">{pkExpanded ? '▲' : '▼'}</span>
        </button>

        <div
          style={{
            overflow: 'hidden',
            maxHeight: pkExpanded ? '200px' : '0',
            transition: 'max-height 0.25s ease-in-out',
          }}
        >
          <div className="px-2 pb-2">
            {hasConcentrations ? (
              <div style={{ height: 130 }}>
                <ResponsiveContainer width="100%" height={126}>
                  <LineChart data={displayData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1f2937" />
                    <XAxis dataKey="time" stroke="#4b5563" tick={{ fontSize: 8 }} interval="preserveStartEnd" />
                    <YAxis stroke="#4b5563" tick={{ fontSize: 8 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #374151', fontSize: 10 }}
                      formatter={(value: number, name: string) => [value.toFixed(4), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    {Object.entries(DRUG_DATABASE).map(([key, drug]) => (
                      <Line
                        key={`cp_${key}`}
                        type="monotone"
                        dataKey={`cp_${key}`}
                        stroke={drug.color}
                        dot={false}
                        strokeWidth={1.5}
                        name={`${drug.name} Cp`}
                        connectNulls
                        isAnimationActive={false}
                      />
                    ))}
                    {Object.entries(DRUG_DATABASE).map(([key, drug]) => (
                      <Line
                        key={`ce_${key}`}
                        type="monotone"
                        dataKey={`ce_${key}`}
                        stroke={drug.color}
                        dot={false}
                        strokeWidth={1}
                        strokeDasharray="4 2"
                        name={`${drug.name} Ce`}
                        connectNulls
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center text-xs text-gray-500 py-3">
                Administer a drug to see PK curves
              </div>
            )}
            {/* Half-life reference */}
            <div className="flex flex-wrap gap-2 text-xs text-gray-500 px-1 pt-1">
              {Object.entries(DRUG_DATABASE).map(([key, drug]) => {
                const hl = DRUG_HALF_LIVES[key];
                if (!hl) return null;
                return (
                  <span key={key} style={{ color: drug.color }}>
                    {drug.name}: t½={hl.elim}{hl.unit}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
