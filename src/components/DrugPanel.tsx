import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import useSimStore from '../store/useSimStore';
import useAIStore from '../store/useAIStore';
  import { DRUG_LIST, LA_DRUG_KEYS } from '../engine/drugs';
import { DrugParams } from '../types';

// Drug-specific colors for visual identification
const DRUG_COLORS: Record<string, string> = {
  propofol: '#3b82f6',
  midazolam: '#8b5cf6',
  fentanyl: '#ef4444',
  ketamine: '#22c55e',
};

function CompactDrugCard({ drug, scenarioLocked, isUnlocked, scenarioHintRange }: {
  drug: DrugParams;
  scenarioLocked: boolean;
  isUnlocked: boolean;
  scenarioHintRange?: [number, number];
}) {
  const { t } = useTranslation();
  const { administerBolus, startInfusion, stopInfusion, infusions, pkStates } = useSimStore(
    useShallow(s => ({
      administerBolus: s.administerBolus,
      startInfusion: s.startInfusion,
      stopInfusion: s.stopInfusion,
      infusions: s.infusions,
      pkStates: s.pkStates,
    }))
  );
  const [showCustom, setShowCustom] = useState(false);
  const [customDose, setCustomDose] = useState('');
  const [infRate, setInfRate] = useState('');
  const drugKey = drug.name.toLowerCase();
  const infusion = infusions[drugKey];
  const ce = pkStates[drugKey]?.ce || 0;
  const color = DRUG_COLORS[drugKey] || '#888';

  // Buttons are disabled when scenario is locked AND this drug is not the unlocked one
  const buttonsDisabled = scenarioLocked && !isUnlocked;

  const presetDoses: Record<string, number[]> = {
    propofol: [20, 50, 100, 200],
    midazolam: [0.5, 1, 2, 5],
    fentanyl: [25, 50, 75, 100],
    ketamine: [10, 25, 50, 100],
  };

  return (
    <div
      className={`mb-1 ${buttonsDisabled ? 'opacity-50' : ''}`}
      style={{ borderLeft: `3px solid ${color}`, background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Header: Drug name + Ce + expand toggle */}
      <div className="flex items-center px-2 py-1">
        <span className="font-bold text-xs" style={{ color, minWidth: 70 }}>{drug.name}</span>
        {ce > 0.001 && (
          <span className="text-xs font-mono text-gray-500 ml-1">Ce:{ce.toFixed(2)}</span>
        )}
        {infusion?.isRunning && (
          <span className="text-xs ml-1 animate-pulse" style={{ color: '#22c55e' }}>
            {'\u25CF'} {infusion.rate}{drug.unit}/min
          </span>
        )}
        <div className="flex-1" />
        {scenarioHintRange && (
          <span className="text-xs text-cyan-400 mr-1">{scenarioHintRange[0]}-{scenarioHintRange[1]}{drug.unit}</span>
        )}
        <button
          onClick={() => setShowCustom(!showCustom)}
          disabled={buttonsDisabled}
          className="text-gray-500 hover:text-white text-xs px-1 disabled:cursor-not-allowed"
          title={t('drugs.customDoseTitle')}
          aria-label={`${showCustom ? 'Hide' : 'Show'} custom dose and infusion controls for ${drug.name}`}
          aria-expanded={showCustom}
          aria-controls={`${drugKey}-custom-controls`}
        >
          {showCustom ? '\u25B2' : '\u2699'}
        </button>
      </div>

      {/* Preset bolus buttons - always visible, single compact row */}
      <div className="flex gap-1 px-2 pb-1" role="group" aria-label={`${drug.name} preset bolus doses`}>
        {(presetDoses[drugKey] || []).map(dose => (
          <button
            key={dose}
            data-sim-id={`${drugKey}-${dose}`}
            onClick={() => administerBolus(drugKey, dose)}
            disabled={buttonsDisabled}
            aria-label={`Administer ${dose} ${drug.unit} bolus of ${drug.name}`}
            className="flex-1 py-0.5 rounded text-xs font-mono hover:brightness-125 transition-all disabled:cursor-not-allowed disabled:hover:brightness-100"
            style={{ background: `${color}22`, color, border: `1px solid ${color}44`, fontSize: 11 }}
          >
            {dose}
          </button>
        ))}
      </div>

      {/* Expandable: Custom dose + Infusion controls */}
      {showCustom && !buttonsDisabled && (
        <div id={`${drugKey}-custom-controls`} className="px-2 pb-1.5 space-y-1" style={{ background: 'rgba(0,0,0,0.2)' }}>
          {/* Custom bolus */}
          <div className="flex gap-1 items-center">
            <label htmlFor={`${drugKey}-custom-dose`} className="text-xs text-gray-400 w-12">{t('common.bolus')}</label>
            <input
              id={`${drugKey}-custom-dose`}
              type="number"
              value={customDose}
              onChange={(e) => setCustomDose(e.target.value)}
              placeholder={drug.unit}
              aria-label={`Custom bolus dose for ${drug.name} in ${drug.unit}`}
              className="flex-1 px-1.5 py-0.5 bg-gray-800 rounded text-xs border border-gray-700 font-mono"
              style={{ maxWidth: 70 }}
            />
            <button
              onClick={() => { if (customDose) { administerBolus(drugKey, Number(customDose)); setCustomDose(''); } }}
              aria-label={`Push ${customDose || '0'} ${drug.unit} bolus of ${drug.name}`}
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ background: `${color}33`, color, border: `1px solid ${color}` }}
            >{t('common.push')}</button>
          </div>
          {/* Infusion */}
          <div className="flex gap-1 items-center">
            <label htmlFor={`${drugKey}-inf-rate`} className="text-xs text-gray-400 w-12">{t('common.infuse')}</label>
            <input
              id={`${drugKey}-inf-rate`}
              type="number"
              value={infRate}
              onChange={(e) => setInfRate(e.target.value)}
              placeholder={`${drug.unit}/min`}
              aria-label={`Infusion rate for ${drug.name} in ${drug.unit} per minute`}
              className="flex-1 px-1.5 py-0.5 bg-gray-800 rounded text-xs border border-gray-700 font-mono"
              style={{ maxWidth: 70 }}
            />
            {!infusion?.isRunning ? (
              <button
                onClick={() => { if (infRate) startInfusion(drugKey, Number(infRate)); }}
                aria-label={`Start ${drug.name} infusion at ${infRate || 0} ${drug.unit} per minute`}
                className="px-2 py-0.5 bg-green-800 hover:bg-green-700 rounded text-xs"
              >{t('common.start')}</button>
            ) : (
              <button
                onClick={() => stopInfusion(drugKey)}
                aria-label={`Stop ${drug.name} infusion`}
                className="px-2 py-0.5 bg-red-800 hover:bg-red-700 rounded text-xs"
              >{t('common.stop')}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Check whether a drug key matches a protocol name
function drugMatchesProtocol(drugKey: string, protocolName: string): boolean {
  const normalizedProtocol = protocolName.toLowerCase();
  return drugKey === normalizedProtocol || drugKey.startsWith(normalizedProtocol);
}

export default function DrugPanel() {
  const { t } = useTranslation();
  const { isScenarioActive, scenarioDrugProtocols } = useSimStore(
    useShallow(s => ({ isScenarioActive: s.isScenarioActive, scenarioDrugProtocols: s.scenarioDrugProtocols }))
  );
  const unlockedDrug = useAIStore(s => s.unlockedDrug);

  const filteredDrugs = DRUG_LIST.filter(d =>
    !LA_DRUG_KEYS.some(k => d.name.toLowerCase() === k || d.name.toLowerCase().startsWith(k.split('_')[0]))
  );

  return (
    <div data-region="drugs">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">
        {t('drugs.title')}
      </div>
      {isScenarioActive && (
        <div className="mb-1 px-2 py-1 rounded text-xs text-cyan-300 bg-cyan-900/40 border border-cyan-700/50">
          {t('drugs.scenarioMode')}
        </div>
      )}
      {filteredDrugs.map(drug => {
        const drugKey = drug.name.toLowerCase();
        // When scenario active with protocols, only show protocol drugs (others deeply grayed)
        const inProtocol = !isScenarioActive || !scenarioDrugProtocols ||
          scenarioDrugProtocols.some(p => drugMatchesProtocol(drugKey, p.name));
        if (!inProtocol) {
          // Show deeply grayed out non-protocol drugs
          return (
            <div key={drug.name} className="mb-1 opacity-20 pointer-events-none"
              style={{ borderLeft: `3px solid #444`, background: 'rgba(255,255,255,0.01)' }}>
              <div className="flex items-center px-2 py-1">
                <span className="font-bold text-xs text-gray-600" style={{ minWidth: 70 }}>{drug.name}</span>
              </div>
            </div>
          );
        }
        const scenarioProtocol = scenarioDrugProtocols?.find(p => drugMatchesProtocol(drugKey, p.name));
        const isUnlocked = !!unlockedDrug && drugMatchesProtocol(drugKey, unlockedDrug);
        return (
          <CompactDrugCard
            key={drug.name}
            drug={drug}
            scenarioLocked={isScenarioActive}
            isUnlocked={isUnlocked}
            scenarioHintRange={scenarioProtocol?.typicalBolusRange}
          />
        );
      })}
    </div>
  );
}
