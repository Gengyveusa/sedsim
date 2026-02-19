import { useState } from 'react';
import useSimStore from '../store/useSimStore';
import { LA_META, LA_DRUG_KEYS } from '../engine/drugs';

// Colors for each local anesthetic
const LA_COLORS: Record<string, string> = {
  lidocaine_epi: '#ec4899',   // pink
  articaine_epi: '#f97316',   // orange
  bupivacaine: '#a855f7',     // purple
};

const LA_NAMES: Record<string, string> = {
  lidocaine_epi: 'Lidocaine 2% + Epi',
  articaine_epi: 'Articaine 4% + Epi',
  bupivacaine: 'Bupivacaine 0.5%',
};

export default function LocalAnesthPanel() {
  const { patient, administerBolus } = useSimStore();
  const [carpuleCounts, setCarpuleCounts] = useState<Record<string, number>>({});

  const handleCarpule = (drugKey: string) => {
    const meta = LA_META[drugKey];
    if (!meta) return;
    administerBolus(drugKey, meta.mgPerCartridge);
    setCarpuleCounts(prev => ({ ...prev, [drugKey]: (prev[drugKey] || 0) + 1 }));
  };

  return (
    <div className="space-y-1">
      {LA_DRUG_KEYS.map((drugKey) => {
        const meta = LA_META[drugKey];
        const color = LA_COLORS[drugKey] || '#ec4899';
        const name = LA_NAMES[drugKey] || drugKey;
        const count = carpuleCounts[drugKey] || 0;
        const maxDoseMg = patient.weight * meta.maxDosePerKg;
        const maxCarpules = Math.floor(maxDoseMg / meta.mgPerCartridge);
        const atLimit = count >= maxCarpules;

        return (
          <div
            key={drugKey}
            className="mb-1"
            style={{ borderLeft: `3px solid ${color}`, background: 'rgba(255,255,255,0.02)' }}
          >
            {/* Header row: name + count */}
            <div className="flex items-center px-2 py-1">
              <span className="font-bold text-xs" style={{ color, minWidth: 70 }}>{name}</span>
              {count > 0 && (
                <span className="text-xs font-mono text-gray-500 ml-1">x{count}</span>
              )}
              <div className="flex-1" />
              <span className="text-xs text-gray-600">{count}/{maxCarpules}</span>
            </div>
            {/* Carpule button row */}
            <div className="flex gap-1 px-2 pb-1">
              <button
                onClick={() => handleCarpule(drugKey)}
                disabled={atLimit}
                className="flex-1 py-0.5 rounded text-xs font-mono hover:brightness-125 transition-all flex items-center justify-center gap-1"
                style={{
                  background: atLimit ? '#33333366' : `${color}22`,
                  color: atLimit ? '#666' : color,
                  border: `1px solid ${atLimit ? '#44444466' : color + '44'}`,
                  fontSize: 11,
                  cursor: atLimit ? 'not-allowed' : 'pointer',
                }}
              >
                + Carpule
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
