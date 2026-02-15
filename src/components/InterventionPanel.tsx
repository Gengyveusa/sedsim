import { useState } from 'react';
import useSimStore from '../store/useSimStore';
import type { InterventionType } from '../types';

export default function InterventionPanel() {
  const { interventions, fio2, applyIntervention, removeIntervention, setFiO2 } = useSimStore();
  const [fio2Input, setFio2Input] = useState((fio2 * 100).toString());

  const interventionOptions: { value: InterventionType; label: string }[] = [
    { value: 'jaw_thrust', label: 'Jaw Thrust' },
    { value: 'chin_lift', label: 'Chin Lift' },
    { value: 'oral_airway', label: 'Oral Airway' },
    { value: 'nasal_airway', label: 'Nasal Airway' },
    { value: 'bag_mask', label: 'Bag-Mask Ventilation' },
    { value: 'suction', label: 'Suction' },
    { value: 'increase_fio2', label: 'Supplemental O₂' },
  ];

  const handleToggleIntervention = (intervention: InterventionType) => {
    if (interventions.has(intervention)) {
      removeIntervention(intervention);
    } else {
      applyIntervention(intervention);
    }
  };

  const handleFio2Change = () => {
    const value = parseFloat(fio2Input);
    if (!isNaN(value) && value >= 21 && value <= 100) {
      setFiO2(value / 100);
    }
  };

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
      <h3 className="text-sm font-bold text-gray-300 mb-3">INTERVENTIONS</h3>

      {/* FiO2 Control */}
      <div className="mb-3 pb-3 border-b border-gray-700">
        <label className="block text-xs text-gray-400 mb-1">FiO₂ (%)</label>
        <div className="flex gap-2">
          <input
            type="number"
            min="21"
            max="100"
            value={fio2Input}
            onChange={(e) => setFio2Input(e.target.value)}
            onBlur={handleFio2Change}
            onKeyDown={(e) => e.key === 'Enter' && handleFio2Change()}
            className="flex-1 px-2 py-1 bg-gray-800 text-gray-100 rounded border border-gray-600 text-sm"
          />
          <div className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded text-sm font-mono border border-blue-600/50">
            {Math.round(fio2 * 100)}%
          </div>
        </div>
      </div>

      {/* Airway Interventions */}
      <div className="space-y-2">
        <div className="text-xs text-gray-400 mb-2">Airway Management:</div>
        {interventionOptions.map(({ value, label }) => {
          const isActive = interventions.has(value);
          return (
            <button
              key={value}
              onClick={() => handleToggleIntervention(value)}
              className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors text-left ${
                isActive
                  ? 'bg-green-600 text-white border-2 border-green-400'
                  : 'bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{label}</span>
                {isActive && (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Interventions Summary */}
      {interventions.size > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-xs text-green-400 font-medium mb-1">
            Active ({interventions.size}):
          </div>
          <div className="text-xs text-gray-300 space-y-1">
            {Array.from(interventions).map((int) => (
              <div key={int} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                <span>
                  {interventionOptions.find((opt) => opt.value === int)?.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
