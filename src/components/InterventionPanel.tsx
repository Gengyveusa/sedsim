import { useState } from 'react';
import useSimStore from '../store/useSimStore';
import type { AirwayDevice, InterventionType } from '../types';

interface AirwayDeviceInfo {
  key: AirwayDevice;
  label: string;
  defaultFio2: number;
  maxFio2: number;
  fio2Range: string;
  notes: string;
}

const AIRWAY_DEVICES: AirwayDeviceInfo[] = [
  { key: 'room_air',         label: 'Room Air',          defaultFio2: 0.21, maxFio2: 0.21, fio2Range: '21%',      notes: 'Baseline, no supplementation' },
  { key: 'nasal_cannula',    label: 'Nasal Cannula',     defaultFio2: 0.32, maxFio2: 0.44, fio2Range: '28-44%',   notes: '+4% per L/min above room air' },
  { key: 'nasal_hood',       label: 'Nasal Hood',        defaultFio2: 0.40, maxFio2: 0.50, fio2Range: '30-50%',   notes: 'Dental/oral surgery sedation' },
  { key: 'oral_airway',      label: 'OPA',               defaultFio2: 0.21, maxFio2: 0.21, fio2Range: '21%',      notes: 'Airway patency only' },
  { key: 'nasal_airway',     label: 'NPA',               defaultFio2: 0.21, maxFio2: 0.21, fio2Range: '21%',      notes: 'Airway patency only' },
  { key: 'lma',              label: 'LMA',               defaultFio2: 0.60, maxFio2: 1.00, fio2Range: '60-100%',  notes: 'Supraglottic, good seal' },
  { key: 'ett',              label: 'ETT',               defaultFio2: 1.00, maxFio2: 1.00, fio2Range: '100%',     notes: 'Definitive airway, full control' },
  { key: 'cricothyroidotomy',label: 'Cricothyroidotomy', defaultFio2: 1.00, maxFio2: 1.00, fio2Range: '100%',     notes: 'Surgical emergency airway' },
  { key: 'tracheostomy',     label: 'Tracheostomy',      defaultFio2: 1.00, maxFio2: 1.00, fio2Range: '100%',     notes: 'Surgical airway, stable' },
];

const SUPPLEMENTARY: { value: InterventionType; label: string }[] = [
  { value: 'jaw_thrust', label: 'Jaw Thrust' },
  { value: 'chin_lift',  label: 'Chin Lift' },
  { value: 'bag_mask',   label: 'Bag-Mask Ventilation' },
  { value: 'suction',    label: 'Suction' },
];

export default function InterventionPanel() {
  const {
    interventions, fio2, airwayDevice, o2FlowRate,
    applyIntervention, removeIntervention, setFiO2, setAirwayDevice, setO2FlowRate,
    isScenarioActive,
  } = useSimStore();

  const currentDeviceInfo = AIRWAY_DEVICES.find(d => d.key === airwayDevice) ?? AIRWAY_DEVICES[0];
  const [fio2Input, setFio2Input] = useState((fio2 * 100).toFixed(0));

  const handleDeviceSelect = (device: AirwayDevice) => {
    setAirwayDevice(device);
    const info = AIRWAY_DEVICES.find(d => d.key === device);
    if (info) setFio2Input((info.defaultFio2 * 100).toFixed(0));
  };

  const handleFio2Change = () => {
    const value = parseFloat(fio2Input);
    const maxPct = currentDeviceInfo.maxFio2 * 100;
    if (!isNaN(value) && value >= 21 && value <= maxPct) {
      setFiO2(value / 100);
    } else if (!isNaN(value)) {
      const clamped = Math.max(21, Math.min(maxPct, value));
      setFio2Input(clamped.toFixed(0));
      setFiO2(clamped / 100);
    }
  };

  const handleToggle = (intervention: InterventionType) => {
    if (interventions.has(intervention)) removeIntervention(intervention);
    else applyIntervention(intervention);
  };

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
      <h3 className="text-sm font-bold text-gray-300 mb-3 tracking-wider uppercase">Airway &amp; O₂</h3>
      {isScenarioActive && (
        <div className="mb-2 px-2 py-1 rounded text-xs text-cyan-300 bg-cyan-900/40 border border-cyan-700/50">
          Scenario Mode — airway controlled by Millie
        </div>
      )}

      {/* Airway Device Ladder */}
      <div className="mb-3">
        <div className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Airway Device</div>
        <div className="space-y-1">
          {AIRWAY_DEVICES.map(({ key, label, fio2Range }) => {
            const isActive = airwayDevice === key;
            return (
              <button
                key={key}
                data-sim-id={`airway-${key}`}
                onClick={() => handleDeviceSelect(key)}
                disabled={isScenarioActive}
                className={`w-full px-2 py-1.5 rounded text-xs font-medium transition-colors text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed ${
                  isActive
                    ? 'bg-cyan-700/70 text-cyan-100 border border-cyan-500'
                    : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 hover:text-gray-200'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-cyan-400' : 'bg-gray-600'}`} />
                  <span className="font-semibold">{label}</span>
                </span>
                <span className={`text-xs ${isActive ? 'text-cyan-300' : 'text-gray-600'}`}>{fio2Range}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-1 text-xs text-gray-500 italic">{currentDeviceInfo.notes}</div>
      </div>

      {/* Nasal Cannula Flow Rate Slider */}
      {airwayDevice === 'nasal_cannula' && (
        <div className="mb-3 pb-3 border-b border-gray-700">
          <label className="block text-xs text-gray-400 mb-1">
            O₂ Flow: <span className="text-cyan-400 font-bold">{o2FlowRate} L/min</span>
          </label>
          <input
            type="range"
            min={1}
            max={6}
            step={1}
            value={o2FlowRate}
            disabled={isScenarioActive}
            onChange={e => {
              const rate = Number(e.target.value);
              setO2FlowRate(rate);
              setFio2Input(Math.min(44, Math.round((0.21 + 0.04 * rate) * 100)).toFixed(0));
            }}
            className="w-full accent-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-0.5">
            <span>1 L</span><span>6 L</span>
          </div>
        </div>
      )}

      {/* FiO2 Manual Input */}
      <div className="mb-3 pb-3 border-b border-gray-700">
        <label className="block text-xs text-gray-400 mb-1">
          FiO₂ (%) <span className="text-gray-600">max {Math.round(currentDeviceInfo.maxFio2 * 100)}%</span>
        </label>
        <div className="flex gap-2">
          <input
            data-sim-id="fio2-slider"
            type="number"
            min="21"
            max={Math.round(currentDeviceInfo.maxFio2 * 100)}
            value={fio2Input}
            disabled={isScenarioActive}
            onChange={e => setFio2Input(e.target.value)}
            onBlur={handleFio2Change}
            onKeyDown={e => e.key === 'Enter' && handleFio2Change()}
            className="flex-1 px-2 py-1 bg-gray-800 text-gray-100 rounded border border-gray-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-sm font-mono border border-blue-600/50">
            {Math.round(fio2 * 100)}%
          </div>
        </div>
      </div>

      {/* Supplementary Interventions */}
      <div>
        <div className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Supplementary</div>
        <div className="space-y-1.5">
          {SUPPLEMENTARY.map(({ value, label }) => {
            const isActive = interventions.has(value);
            return (
              <button
                key={value}
                onClick={() => handleToggle(value)}
                disabled={isScenarioActive}
                className={`w-full px-3 py-1.5 rounded text-xs font-medium transition-colors text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed ${
                  isActive
                    ? 'bg-green-700/60 text-green-100 border border-green-500'
                    : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 hover:text-gray-200'
                }`}
              >
                <span>{label}</span>
                {isActive && (
                  <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active interventions summary */}
      {interventions.size > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-700">
          <div className="text-xs text-green-400 font-medium mb-1">Active ({interventions.size}):</div>
          <div className="flex flex-wrap gap-1">
            {Array.from(interventions).map(int => (
              <span key={int} className="px-1.5 py-0.5 bg-green-900/40 text-green-300 text-xs rounded border border-green-700">
                {SUPPLEMENTARY.find(o => o.value === int)?.label ?? int.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
