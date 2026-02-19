import { useState } from 'react';
import useSimStore from '../store/useSimStore';

interface EmergencyDrug {
  key: string;
  name: string;
  abbrev: string;
  doses: { label: string; dose: number; unit: string }[];
  color: string;
  indication: string;
}

const EMERGENCY_DRUGS: EmergencyDrug[] = [
  {
    key: 'epinephrine',
    name: 'Epinephrine',
    abbrev: 'Epi',
    color: '#ef4444',
    indication: 'Anaphylaxis / Cardiac Arrest',
    doses: [
      { label: '0.3mg IM', dose: 0.3, unit: 'mg' },
      { label: '0.5mg IM', dose: 0.5, unit: 'mg' },
      { label: '1mg IV', dose: 1.0, unit: 'mg' },
    ],
  },
  {
    key: 'atropine',
    name: 'Atropine',
    abbrev: 'Atr',
    color: '#f97316',
    indication: 'Bradycardia / Bronchospasm',
    doses: [
      { label: '0.5mg', dose: 0.5, unit: 'mg' },
      { label: '1mg', dose: 1.0, unit: 'mg' },
    ],
  },
  {
    key: 'succinylcholine',
    name: 'Succinylcholine',
    abbrev: 'Succ',
    color: '#eab308',
    indication: 'RSI / Laryngospasm',
    doses: [
      { label: '100mg', dose: 100, unit: 'mg' },
      { label: '200mg', dose: 200, unit: 'mg' },
    ],
  },
  {
    key: 'naloxone',
    name: 'Naloxone',
    abbrev: 'Narcan',
    color: '#10b981',
    indication: 'Opioid Reversal',
    doses: [
      { label: '0.4mg', dose: 0.4, unit: 'mg' },
      { label: '0.8mg', dose: 0.8, unit: 'mg' },
      { label: '2mg', dose: 2.0, unit: 'mg' },
    ],
  },
  {
    key: 'flumazenil',
    name: 'Flumazenil',
    abbrev: 'Flum',
    color: '#14b8a6',
    indication: 'Benzo Reversal',
    doses: [
      { label: '0.2mg', dose: 0.2, unit: 'mg' },
      { label: '0.5mg', dose: 0.5, unit: 'mg' },
      { label: '1mg', dose: 1.0, unit: 'mg' },
    ],
  },
  {
    key: 'diphenhydramine',
    name: 'Diphenhydramine',
    abbrev: 'Benadryl',
    color: '#a855f7',
    indication: 'Allergic Reaction',
    doses: [
      { label: '25mg', dose: 25, unit: 'mg' },
      { label: '50mg', dose: 50, unit: 'mg' },
    ],
  },
  {
    key: 'dexamethasone',
    name: 'Dexamethasone',
    abbrev: 'Decadron',
    color: '#06b6d4',
    indication: 'Airway Edema / Allergy',
    doses: [
      { label: '4mg', dose: 4, unit: 'mg' },
      { label: '8mg', dose: 8, unit: 'mg' },
    ],
  },
  {
    key: 'nitroglycerin',
    name: 'Nitroglycerin',
    abbrev: 'NTG',
    color: '#f43f5e',
    indication: 'Hypertensive Crisis / Angina',
    doses: [
      { label: '0.4mg SL', dose: 0.4, unit: 'mg' },
      { label: '0.8mg SL', dose: 0.8, unit: 'mg' },
    ],
  },
];

export default function EmergencyDrugsPanel() {
  const [collapsed, setCollapsed] = useState(true);
  const { administerBolus, logEvent } = useSimStore();

  // Apply emergency drug effect: log to event log, and for known drugs apply PK if in store
  const administerEmergency = (drug: EmergencyDrug, dose: { label: string; dose: number; unit: string }) => {
    // For naloxone and flumazenil, use the existing PK engine
    if (drug.key === 'naloxone' || drug.key === 'flumazenil') {
      administerBolus(drug.key, dose.dose);
      return;
    }
    // For other emergency drugs, apply physiological effect via store log + vitals nudge
    let message = `[EMERG] ${drug.name} ${dose.label}`;

    // Physiological effect descriptions by drug
    switch (drug.key) {
      case 'epinephrine':
        message += ' — ↑HR ↑BP (vasopressor/bronchodilator)';
        break;
      case 'atropine':
        message += ' — ↑HR (vagolytic)';
        break;
      case 'succinylcholine':
        message += ' — Neuromuscular blockade (fasciculations)';
        break;
      case 'diphenhydramine':
        message += ' — Antihistamine (mild sedation)';
        break;
      case 'dexamethasone':
        message += ' — Anti-inflammatory (airway edema ↓)';
        break;
      case 'nitroglycerin':
        message += ' — ↓BP (vasodilation)';
        break;
    }

    logEvent(message, 'intervention', 'warning');
  };

  return (
    <div className="bg-red-950/30 border border-red-800/60 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-red-900/30 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          <span className="text-red-400 text-base">🚨</span>
          <span className="text-xs font-bold text-red-300 uppercase tracking-wider">Emergency Drugs</span>
        </div>
        <span className="text-gray-500 text-xs">{collapsed ? '▶' : '▼'}</span>
      </button>

      {!collapsed && (
        <div className="px-2 pb-2 space-y-1">
          {EMERGENCY_DRUGS.map(drug => (
            <div
              key={drug.key}
              className="rounded"
              style={{ borderLeft: `3px solid ${drug.color}`, background: 'rgba(255,255,255,0.02)' }}
            >
              <div className="flex items-center px-2 py-1">
                <span className="font-bold text-xs" style={{ color: drug.color, minWidth: 72 }}>
                  {drug.name}
                </span>
                <span className="text-xs text-gray-600 ml-1 truncate">{drug.indication}</span>
              </div>
              <div className="flex gap-1 px-2 pb-1 flex-wrap">
                {drug.doses.map(d => (
                  <button
                    key={d.label}
                    onClick={() => administerEmergency(drug, d)}
                    className="py-0.5 px-2 rounded text-xs font-mono hover:brightness-125 transition-all"
                    style={{
                      background: `${drug.color}22`,
                      color: drug.color,
                      border: `1px solid ${drug.color}44`,
                      fontSize: 11,
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
