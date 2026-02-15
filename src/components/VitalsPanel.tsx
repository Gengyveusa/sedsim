import { useSimStore } from '../store/useSimStore';
import { DRUG_DATABASE } from '../engine/drugs';

function VitalBox({ label, value, unit, color = 'text-green-400', alarm = false }: {
  label: string; value: number | string; unit: string; color?: string; alarm?: boolean;
}) {
  return (
    <div className={`bg-sim-bg rounded-lg p-3 text-center ${alarm ? 'ring-2 ring-red-500 animate-pulse' : ''}`}>
      <div className="text-xs text-gray-400 uppercase">{label}</div>
      <div className={`text-3xl font-mono font-bold ${alarm ? 'text-red-400' : color}`}>
        {typeof value === 'number' ? value.toFixed(0) : value}
      </div>
      <div className="text-xs text-gray-500">{unit}</div>
    </div>
  );
}

export function VitalsPanel() {
  const { vitals, pkStates } = useSimStore();

  return (
    <div className="bg-sim-panel p-4 border-b border-gray-700">
      <div className="grid grid-cols-7 gap-3">
        <VitalBox label="HR" value={vitals.hr} unit="bpm" color="text-green-400"
          alarm={vitals.hr < 50 || vitals.hr > 120} />
        <VitalBox label="SBP/DBP" value={`${vitals.sbp}/${vitals.dbp}`} unit="mmHg" color="text-red-400"
          alarm={vitals.sbp < 80} />
        <VitalBox label="MAP" value={vitals.map} unit="mmHg" color="text-red-300" />
        <VitalBox label="SpO2" value={vitals.spo2} unit="%" color="text-cyan-400"
          alarm={vitals.spo2 < 90} />
        <VitalBox label="RR" value={vitals.rr} unit="br/min" color="text-yellow-400"
          alarm={vitals.rr < 6} />
        <VitalBox label="EtCO2" value={vitals.etco2} unit="mmHg" color="text-purple-400"
          alarm={vitals.etco2 > 55} />
        {/* Drug Ce display */}
        <div className="bg-sim-bg rounded-lg p-3">
          <div className="text-xs text-gray-400 uppercase mb-1">Effect-Site</div>
          {Object.entries(DRUG_DATABASE).map(([key, drug]) => {
            const ce = pkStates[key]?.ce || 0;
            if (ce < 0.001) return null;
            return (
              <div key={key} className="text-xs flex justify-between" style={{ color: drug.color }}>
                <span>{drug.name}</span>
                <span className="font-mono">{ce.toFixed(3)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}