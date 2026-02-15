import { useState } from 'react';
import { useSimStore } from '../store/useSimStore';
import { DRUG_LIST } from '../engine/drugs';
import { DrugParams } from '../types';

function DrugCard({ drug }: { drug: DrugParams }) {
  const { administerBolus, startInfusion, stopInfusion, infusions, pkStates } = useSimStore();
  const [bolusDose, setBolusDose] = useState('');
  const [infRate, setInfRate] = useState('');
  const drugKey = drug.name.toLowerCase();
  const infusion = infusions[drugKey];
  const ce = pkStates[drugKey]?.ce || 0;

  const presetDoses: Record<string, number[]> = {
    propofol: [20, 50, 100, 200],
    midazolam: [0.5, 1, 2, 5],
    fentanyl: [25, 50, 75, 100],
    ketamine: [10, 25, 50, 100],
  };

  return (
    <div className="border border-gray-700 rounded-lg p-3 mb-3" style={{ borderLeftColor: drug.color, borderLeftWidth: 4 }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm" style={{ color: drug.color }}>{drug.name}</h3>
        {ce > 0.001 && (
          <span className="text-xs font-mono text-gray-400">Ce: {ce.toFixed(3)}</span>
        )}
      </div>

      {/* Bolus Controls */}
      <div className="mb-2">
        <div className="text-xs text-gray-400 mb-1">Bolus ({drug.unit})</div>
        <div className="flex gap-1 mb-1 flex-wrap">
          {(presetDoses[drugKey] || []).map(dose => (
            <button key={dose}
              onClick={() => administerBolus(drugKey, dose)}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-mono"
            >
              {dose}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <input type="number" value={bolusDose}
            onChange={(e) => setBolusDose(e.target.value)}
            placeholder="Custom"
            className="w-20 px-2 py-1 bg-gray-800 rounded text-xs border border-gray-600"
          />
          <button onClick={() => { if (bolusDose) { administerBolus(drugKey, Number(bolusDose)); setBolusDose(''); } }}
            className="px-2 py-1 bg-sim-accent hover:bg-blue-600 rounded text-xs"
          >Push</button>
        </div>
      </div>

      {/* Infusion Controls */}
      <div>
        <div className="text-xs text-gray-400 mb-1">Infusion ({drug.unit}/min)</div>
        <div className="flex gap-1">
          <input type="number" value={infRate}
            onChange={(e) => setInfRate(e.target.value)}
            placeholder="Rate"
            className="w-20 px-2 py-1 bg-gray-800 rounded text-xs border border-gray-600"
          />
          {!infusion?.isRunning ? (
            <button onClick={() => { if (infRate) startInfusion(drugKey, Number(infRate)); }}
              className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs"
            >Start</button>
          ) : (
            <button onClick={() => stopInfusion(drugKey)}
              className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-xs"
            >Stop</button>
          )}
        </div>
        {infusion?.isRunning && (
          <div className="text-xs text-green-400 mt-1 animate-pulse">
            Running: {infusion.rate} {infusion.unit}
          </div>
        )}
      </div>
    </div>
  );
}

export default  function DrugPanel() {
  return (
    <div className="p-3">
      <h2 className="text-sm font-bold text-gray-400 uppercase mb-3">Drug Administration</h2>
      {DRUG_LIST.map(drug => (
        <DrugCard key={drug.name} drug={drug} />
      ))}
    </div>
  );
}
