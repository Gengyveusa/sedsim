import useSimStore from '../store/useSimStore';
import { LA_META, LA_DRUG_KEYS } from '../engine/drugs';

export default function LocalAnesthPanel() {
  const { patient, administerBolus } = useSimStore();

  const handleCartridge = (drugKey: string) => {
    const meta = LA_META[drugKey];
    if (!meta) return;

    // Administer one full cartridge worth of medication
    administerBolus(drugKey, meta.mgPerCartridge);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-cyan-400 border-b border-cyan-700 pb-2">
        LOCAL ANESTHETICS
      </h2>

      {LA_DRUG_KEYS.map((drugKey) => {
        const meta = LA_META[drugKey];
        const maxDoseMg = patient.weight * meta.maxDosePerKg;
        const maxCartridges = Math.floor(maxDoseMg / meta.mgPerCartridge);

        return (
          <div
            key={drugKey}
            className="border border-pink-700 bg-pink-950/30 rounded p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-pink-300">
                  {meta.mgPerMl}mg/mL {drugKey.includes('lidocaine') ? 'Lidocaine' : drugKey.includes('articaine') ? 'Articaine' : 'Bupivacaine'}
                  {meta.hasEpi && ` + Epi ${meta.epiConcentration}`}
                </h3>
                <div className="text-xs text-gray-400 space-y-0.5">
                  <div>{meta.mgPerCartridge}mg per cartridge ({meta.mlPerCartridge}mL)</div>
                  <div>Max: {maxDoseMg.toFixed(0)}mg ({maxCartridges} cartridges)</div>
                  <div>Onset: {meta.onsetMinutes}min | Duration: {meta.durationMinutes}min</div>
                  <div>Toxic level: &gt;{meta.toxicPlasmaLevel} mcg/mL plasma</div>
                </div>
              </div>
              <button
                onClick={() => handleCartridge(drugKey)}
                className="bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded font-semibold text-sm whitespace-nowrap"
              >
                + Cartridge
              </button>
            </div>
          </div>
        );
      })}

      <div className="text-xs text-gray-400 bg-gray-800/50 p-2 rounded">
        <div className="font-semibold text-yellow-400 mb-1">{"\u26A0\uFE0F"} Oral Surgery Context</div>
        <div>Local anesthetics are administered via infiltration or nerve block for procedures like:</div>
        <ul className="list-disc list-inside ml-2 mt-1">
          <li>Wisdom teeth extractions</li>
          <li>Dental implants</li>
          <li>Bone grafting</li>
          <li>Complex oral surgery</li>
        </ul>
        <div className="mt-2">All IV sedation drugs use intravenous bolus pharmacokinetics.</div>
      </div>
    </div>
  );
}
