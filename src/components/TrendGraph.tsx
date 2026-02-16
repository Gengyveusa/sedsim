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

export default function TrendGraph() {
  const { trendData } = useSimStore();

  // Show last 120 data points (10 minutes at 5s intervals)
  const displayData = trendData.slice(-120).map(point => ({
    time: Math.floor(point.time / 60) + ':' + (point.time % 60).toString().padStart(2, '0'),
    timeSec: point.time,
    hr: point.vitals.hr,
    sbp: point.vitals.sbp,
    spo2: point.vitals.spo2,
    rr: point.vitals.rr,
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
      <div className="flex-1 flex items-center justify-center text-gray-500 bg-sim-panel">
        <div className="text-center">
          <p className="text-lg">Start the simulation and administer drugs</p>
          <p className="text-sm">Trend graphs will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-sim-panel p-4 overflow-auto">
      {/* Vital Signs Trend */}
      <h3 className="text-xs text-gray-400 uppercase mb-2">Vital Signs Trend</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height={192}>
          <LineChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 10 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #374151' }} />
            <Line type="monotone" dataKey="hr" stroke="#22c55e" dot={false} strokeWidth={2} name="HR" />
            <Line type="monotone" dataKey="sbp" stroke="#ef4444" dot={false} strokeWidth={2} name="SBP" />
            <Line type="monotone" dataKey="spo2" stroke="#06b6d4" dot={false} strokeWidth={2} name="SpO2" />
            <Line type="monotone" dataKey="rr" stroke="#eab308" dot={false} strokeWidth={1} name="RR" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pharmacokinetic Concentrations */}
      <h3 className="text-xs text-gray-400 uppercase mb-2 mt-2">Plasma (solid) & Effect-Site (dashed) Concentrations</h3>
      <div className="h-48">
        {hasConcentrations ? (
          <ResponsiveContainer width="100%" height={192}>
            <LineChart data={displayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 10 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 10 }} label={{ value: 'mcg/mL', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af', fontSize: 10 } }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #374151' }}
                formatter={(value: number, name: string) => {                  
                  return [value.toFixed(4), name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {Object.entries(DRUG_DATABASE).map(([key, drug]) => (
                <Line
                  key={`cp_${key}`}
                  type="monotone"
                  dataKey={`cp_${key}`}
                  stroke={drug.color}
                  dot={false}
                  strokeWidth={2}
                  name={`${drug.name} Cp`}
                  connectNulls
                />
              ))}
              {Object.entries(DRUG_DATABASE).map(([key, drug]) => (
                <Line
                  key={`ce_${key}`}
                  type="monotone"
                  dataKey={`ce_${key}`}
                  stroke={drug.color}
                  dot={false}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  name={`${drug.name} Ce`}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Administer a drug to see PK concentration curves
          </div>
        )}
      </div>

      {/* Half-life Reference */}
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
        {Object.entries(DRUG_DATABASE).map(([key, drug]) => {
          const hl = DRUG_HALF_LIVES[key];
          if (!hl) return null;
          return (
            <span key={key} style={{ color: drug.color }}>
              {drug.name}: t½ dist={hl.dist}{hl.unit} elim={hl.elim}{hl.unit}
            </span>
          );
        })}
      </div>
    </div>
  );
}
