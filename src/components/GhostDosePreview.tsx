/**
 * src/components/GhostDosePreview.tsx
 * Ghost Dose Preview Panel
 *
 * Allows users to preview a hypothetical IV drug dose WITHOUT actually
 * administering it.  Uses predictForward() from engine/predict.ts to
 * compute Ce, MOASS, SpO2, and RR at T+1, T+3, T+5 minutes.
 * The AI Mentor then explains the predicted outcome.
 */

import React, { useState, useCallback } from 'react';
import useSimStore from '../store/useSimStore';
import { predictForward } from '../engine/predict';
import { DRUG_DATABASE } from '../engine/drugs';
import { PredictionResult, MOASSLevel } from '../types';

const GHOST_DRUGS = ['propofol', 'midazolam', 'fentanyl', 'ketamine', 'dexmedetomidine'];

const DOSE_PRESETS: Record<string, number[]> = {
  propofol: [20, 50, 100, 150],
  midazolam: [1, 2, 3, 5],
  fentanyl: [25, 50, 75, 100],
  ketamine: [10, 25, 50],
  dexmedetomidine: [10, 20, 40],
};

const MOASS_LABEL: Record<number, string> = {
  0: 'Unresponsive',
  1: 'Deep sedation',
  2: 'Moderate sedation',
  3: 'Mild sedation',
  4: 'Drowsy',
  5: 'Awake',
};

const GhostDosePreview: React.FC = () => {
  const { pkStates, infusions, patient, vitals, fio2 } = useSimStore((s) => ({
    pkStates: s.pkStates,
    infusions: s.infusions,
    patient: s.patient,
    vitals: s.vitals,
    fio2: s.fio2,
  }));

  const [selectedDrug, setSelectedDrug] = useState('propofol');
  const [customDose, setCustomDose] = useState('');
  const [results, setResults] = useState<PredictionResult[] | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [aiNote, setAiNote] = useState('');

  const selectedDrug$ = DRUG_DATABASE[selectedDrug];
  const presets = DOSE_PRESETS[selectedDrug] ?? [10, 20, 50];

  const runGhostDose = useCallback(
    (dose: number) => {
      if (!dose || dose <= 0) return;
      setIsCalculating(true);
      setResults(null);
      setAiNote('');

      // Run in a microtask so React can update UI
      setTimeout(() => {
        try {
          const snapshots = predictForward(
            pkStates,
            infusions,
            patient,
            fio2,
            vitals,
            [60, 180, 300],
            { drugName: selectedDrug, dose }
          );

          const mapped: PredictionResult[] = snapshots.map((s) => ({
            secondsAhead: s.secondsAhead,
            predictedCe: s.ceByDrug,
            predictedMoass: s.moass as MOASSLevel,
            predictedSpo2: s.spo2,
            predictedRr: s.rr,
          }));

          setResults(mapped);

          // Generate simple AI explanation note
          const ghostDrugName = selectedDrug$?.name ?? selectedDrug;
          const t1 = mapped[0];
          const t3 = mapped[1];
          const t5 = mapped[2];
          const ceAtT3 = t3?.predictedCe[selectedDrug]?.toFixed(2) ?? '?';
          const moassLabel = t3 ? MOASS_LABEL[t3.predictedMoass] : '';
          const osaNote = patient.osa ? ' OSA present — increased respiratory depression risk.' : '';
          const ageNote = patient.age > 65 ? ` Elderly patient (${patient.age}yo) — expect more pronounced effect.` : '';

          let note = `${ghostDrugName} ${dose}${selectedDrug$?.unit ?? 'mg'} bolus: predicted Ce ≈ ${ceAtT3} mcg/mL at T+3 min (${moassLabel}).`;
          if (t1) note += ` SpO2: ${Math.round(t1.predictedSpo2)}% → ${Math.round(t5?.predictedSpo2 ?? t1.predictedSpo2)}%, RR: ${Math.round(t1.predictedRr)} → ${Math.round(t5?.predictedRr ?? t1.predictedRr)}/min.`;
          note += osaNote + ageNote;

          // Warn about drug synergy
          const propCe = pkStates['propofol']?.ce ?? 0;
          const fentCe = pkStates['fentanyl']?.ce ?? 0;
          if (selectedDrug !== 'propofol' && propCe > 1.5) note += ' ⚠ Active propofol sedation — expect synergistic effect.';
          if (selectedDrug !== 'fentanyl' && fentCe > 0.002) note += ' ⚠ Active fentanyl — opioid-hypnotic synergy increases respiratory risk.';

          setAiNote(note);
        } finally {
          setIsCalculating(false);
        }
      }, 0);
    },
    [pkStates, infusions, patient, fio2, vitals, selectedDrug, selectedDrug$]
  );

  const handleCustomRun = () => {
    const dose = parseFloat(customDose);
    if (!isNaN(dose) && dose > 0) runGhostDose(dose);
  };

  return (
    <div id="ghost-dose-panel" className="bg-gray-800/60 rounded-lg p-3 space-y-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-purple-400 font-bold text-sm">👻 Ghost Dose</span>
        <span className="text-gray-500 text-[10px]">Preview without administering</span>
      </div>

      {/* Drug selector */}
      <div className="flex gap-2 items-center">
        <label className="text-gray-400 w-12 shrink-0">Drug</label>
        <select
          value={selectedDrug}
          onChange={(e) => { setSelectedDrug(e.target.value); setResults(null); setAiNote(''); }}
          className="flex-1 bg-gray-700 text-white rounded px-2 py-1 text-xs border border-gray-600 focus:border-purple-400 focus:outline-none"
        >
          {GHOST_DRUGS.map((d) => (
            <option key={d} value={d}>
              {DRUG_DATABASE[d]?.name ?? d}
            </option>
          ))}
        </select>
      </div>

      {/* Preset dose buttons */}
      <div>
        <div className="text-gray-500 mb-1">Quick presets ({selectedDrug$?.unit})</div>
        <div className="flex flex-wrap gap-1">
          {presets.map((d) => (
            <button
              key={d}
              onClick={() => runGhostDose(d)}
              disabled={isCalculating}
              className="px-2 py-1 bg-purple-800/50 hover:bg-purple-700/70 text-purple-200 rounded text-[10px] transition-colors disabled:opacity-50"
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Custom dose */}
      <div className="flex gap-2">
        <input
          type="number"
          value={customDose}
          onChange={(e) => setCustomDose(e.target.value)}
          placeholder={`Custom ${selectedDrug$?.unit ?? 'mg'}`}
          className="flex-1 bg-gray-700 text-white rounded px-2 py-1 text-xs border border-gray-600 focus:border-purple-400 focus:outline-none"
        />
        <button
          onClick={handleCustomRun}
          disabled={isCalculating || !customDose}
          className="px-2 py-1 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white rounded text-xs transition-colors"
        >
          Predict
        </button>
      </div>

      {/* Loading */}
      {isCalculating && (
        <div className="text-purple-400 text-[10px] animate-pulse">Computing PK/PD forward simulation…</div>
      )}

      {/* Results table */}
      {results && (
        <div className="space-y-2">
          <div className="text-gray-400 font-semibold text-[10px] uppercase tracking-wider">Predicted Trajectory</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left py-1">Time</th>
                  <th className="text-right py-1">Ce</th>
                  <th className="text-right py-1">MOASS</th>
                  <th className="text-right py-1">SpO2</th>
                  <th className="text-right py-1">RR</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.secondsAhead} className="border-t border-gray-700/50">
                    <td className="py-1 text-gray-400">T+{Math.round(r.secondsAhead / 60)}min</td>
                    <td className={`text-right py-1 font-mono ${
                      (r.predictedCe[selectedDrug] ?? 0) > 4 ? 'text-red-400' :
                      (r.predictedCe[selectedDrug] ?? 0) > 2 ? 'text-yellow-400' : 'text-cyan-400'
                    }`}>
                      {(r.predictedCe[selectedDrug] ?? 0).toFixed(2)}
                    </td>
                    <td className={`text-right py-1 ${
                      r.predictedMoass <= 1 ? 'text-red-400' :
                      r.predictedMoass <= 3 ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      {r.predictedMoass}/5
                    </td>
                    <td className={`text-right py-1 ${r.predictedSpo2 < 92 ? 'text-red-400' : r.predictedSpo2 < 95 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {Math.round(r.predictedSpo2)}%
                    </td>
                    <td className={`text-right py-1 ${r.predictedRr < 8 ? 'text-red-400' : r.predictedRr < 10 ? 'text-yellow-400' : 'text-gray-300'}`}>
                      {Math.round(r.predictedRr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* AI note */}
          {aiNote && (
            <div className="bg-purple-900/30 border border-purple-700/50 rounded p-2 text-purple-200 text-[10px] leading-relaxed">
              <span className="text-purple-400 font-semibold">🤖 Mentor: </span>
              {aiNote}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GhostDosePreview;
