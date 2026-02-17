import { useState } from 'react';
import useSimStore from '../store/useSimStore';
import { DRUG_LIST } from '../engine/drugs';
import { DrugParams } from '../types';

// Drug-specific colors for visual identification
const DRUG_COLORS: Record<string, string> = {
  propofol: '#3b82f6',
  midazolam: '#8b5cf6',
  fentanyl: '#ef4444',
  ketamine: '#22c55e',
};

function CompactDrugCard({ drug }: { drug: DrugParams }) {
  const { administerBolus, startInfusion, stopInfusion, infusions, pkStates } = useSimStore();
  const [showCustom, setShowCustom] = useState(false);
  const [customDose, setCustomDose] = useState('');
  const [infRate, setInfRate] = useState('');
  const drugKey = drug.name.toLowerCase();
  const infusion = infusions[drugKey];
  const ce = pkStates[drugKey]?.ce || 0;
  const color = DRUG_COLORS[drugKey] || '#888';

  const presetDoses: Record<string, number[]> = {
    propofol: [20, 50, 100, 200],
    midazolam: [0.5, 1, 2, 5],
    fentanyl: [25, 50, 75, 100],
    ketamine: [10, 25, 50, 100],
  };

  return (
    <div className="mb-1" style={{ borderLeft: `3px solid ${color}`, background: 'rgba(255,255,255,0.02)' }}>
      {/* Header: Drug name + Ce + expand toggle */}
      <div className="flex items-center px-2 py-1">
        <span className="font-bold text-xs" style={{ color, minWidth: 70 }}>{drug.name}</span>
        {ce > 0.001 && (
          <span className="text-xs font-mono text-gray-500 ml-1">Ce:{ce.toFixed(2)}</span>
        )}
        {infusion?.isRunning && (
          <span className="text-xs ml-1 animate-pulse" style={{ color: '#22c55e' }}>
            \u25CF {infusion.rate}{drug.unit}/min
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="text-gray-500 hover:text-white text-xs px-1"
          title="Custom dose / Infusion"
        >
          {showCustom ? '\u25B2' : '\u2699'}
        </button>
      </div>

      {/* Preset bolus buttons - always visible, single compact row */}
      <div className="flex gap-1 px-2 pb-1">
        {(presetDoses[drugKey] || []).map(dose => (
          <button
            key={dose}
            onClick={() => administerBolus(drugKey, dose)}
            className="flex-1 py-0.5 rounded text-xs font-mono hover:brightness-125 transition-all"
            style={{ background: `${color}22`, color, border: `1px solid ${color}44`, fontSize: 11 }}
          >
            {dose}
          </button>
        ))}
      </div>

      {/* Expandable: Custom dose + Infusion controls */}
      {showCustom && (
        <div className="px-2 pb-1.5 space-y-1" style={{ background: 'rgba(0,0,0,0.2)' }}>
          {/* Custom bolus */}
          <div className="flex gap-1 items-center">
            <span className="text-xs text-gray-500 w-12">Bolus</span>
            <input
              type="number"
              value={customDose}
              onChange={(e) => setCustomDose(e.target.value)}
              placeholder={drug.unit}
              className="flex-1 px-1.5 py-0.5 bg-gray-800 rounded text-xs border border-gray-700 font-mono"
              style={{ maxWidth: 70 }}
            />
            <button
              onClick={() => { if (customDose) { administerBolus(drugKey, Number(customDose)); setCustomDose(''); } }}
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ background: `${color}33`, color, border: `1px solid ${color}` }}
            >Push</button>
          </div>
          {/* Infusion */}
          <div className="flex gap-1 items-center">
            <span className="text-xs text-gray-500 w-12">Infuse</span>
            <input
              type="number"
              value={infRate}
              onChange={(e) => setInfRate(e.target.value)}
              placeholder={`${drug.unit}/min`}
              className="flex-1 px-1.5 py-0.5 bg-gray-800 rounded text-xs border border-gray-700 font-mono"
              style={{ maxWidth: 70 }}
            />
            {!infusion?.isRunning ? (
              <button
                onClick={() => { if (infRate) startInfusion(drugKey, Number(infRate)); }}
                className="px-2 py-0.5 bg-green-800 hover:bg-green-700 rounded text-xs"
              >Start</button>
            ) : (
              <button
                onClick={() => stopInfusion(drugKey)}
                className="px-2 py-0.5 bg-red-800 hover:bg-red-700 rounded text-xs"
              >Stop</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DrugPanel() {
  return (
    <div>
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">
        Drugs
      </div>
      {DRUG_LIST.map(drug => (
        <CompactDrugCard key={drug.name} drug={drug} />
      ))}
    </div>
  );
}
