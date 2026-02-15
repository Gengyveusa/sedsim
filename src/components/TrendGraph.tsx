import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import useSimStore from '../store/useSimStore';
import { DRUG_DATABASE } from '../engine/drugs';

export default function TrendGraph() {
  const { trendData } = useSimStore();

  // Show last 120 data points (10 minutes at 5s intervals)
  const displayData = trendData.slice(-120).map(point => ({
    time: Math.floor(point.time / 60) + ':' + (point.time % 60).toString().padStart(2, '0'),
    hr: point.vitals.hr,
    sbp: point.vitals.sbp,
    spo2: point.vitals.spo2,
    rr: point.vitals.rr,
    ...Object.fromEntries(
      Object.entries(point.ce).map(([k, v]) => [`ce_${k}`, v])
    ),
  }));

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
    <div className="flex-1 bg-sim-panel p-4 overflow-hidden">
      <h3 className="text-xs text-gray-400 uppercase mb-2">Vital Signs Trend</h3>
      <div className="h-1/2">
        <ResponsiveContainer width="100%" height="100%">
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

      <h3 className="text-xs text-gray-400 uppercase mb-2 mt-2">Effect-Site Concentrations</h3>
      <div className="h-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 10 }} />
            <YAxis stroke="#9ca3af" tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #374151' }} />
            {Object.entries(DRUG_DATABASE).map(([key, drug]) => (
              <Line key={key} type="monotone" dataKey={`ce_${key}`}
                stroke={drug.color} dot={false} strokeWidth={2} name={`${drug.name} Ce`} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}