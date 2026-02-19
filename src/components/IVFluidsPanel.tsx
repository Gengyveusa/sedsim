import { useState } from 'react';
import useSimStore from '../store/useSimStore';

const FLUIDS = [
  { key: 'NS', name: '0.9% Normal Saline', abbrev: 'NS', color: '#3b82f6' },
  { key: 'LR', name: "Lactated Ringer's", abbrev: 'LR', color: '#22c55e' },
  { key: 'D5HNS', name: 'D5 ½ NS', abbrev: 'D5½NS', color: '#a855f7' },
  { key: 'D5W', name: '5% Dextrose in Water', abbrev: 'D5W', color: '#f59e0b' },
  { key: 'D5NS', name: '5% Dextrose in NS', abbrev: 'D5NS', color: '#f97316' },
  { key: 'PLY', name: 'Plasmalyte', abbrev: 'Plasmalyte', color: '#06b6d4' },
  { key: 'ALB5', name: 'Albumin 5%', abbrev: 'Albumin 5%', color: '#ec4899' },
  { key: 'PRBC', name: 'Packed Red Blood Cells', abbrev: 'pRBC', color: '#ef4444' },
];

const RATE_OPTIONS = [50, 75, 100, 125, 150, 200, 250, 500, 1000];
const BOLUS_VOLUMES = [250, 500, 1000];

const IV_LOCATIONS = [
  'Right Hand', 'Left Hand',
  'Right AC', 'Left AC',
  'Right EJ', 'Left EJ',
  'Right IJ', 'Left IJ',
  'Right Subclavian', 'Left Subclavian',
  'Right Femoral', 'Left Femoral',
];

const GAUGES = ['24G', '22G', '20G', '18G', '16G', '14G'];

export default function IVFluidsPanel() {
  const [collapsed, setCollapsed] = useState(true);
  const [selectedFluid, setSelectedFluid] = useState<string | null>(null);
  const [rate, setRate] = useState<number>(100);
  const [isBolus, setIsBolus] = useState(false);
  const [bolusVolume, setBolusVolume] = useState<number>(500);

  const { ivFluids, startIVFluid, stopIVFluid, setIVAccess } = useSimStore();

  const handleStart = () => {
    if (!selectedFluid) return;
    const fluid = FLUIDS.find(f => f.key === selectedFluid);
    if (!fluid) return;
    startIVFluid(fluid.abbrev, rate, isBolus, bolusVolume);
  };

  const totalMl = Math.round(ivFluids.totalInfused);

  return (
    <div className="bg-blue-950/30 border border-blue-800/60 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-900/30 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          <span className="text-blue-400 text-base">💧</span>
          <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">IV Fluids</span>
          {ivFluids.activeFluid && (
            <span className="text-xs text-blue-400 font-mono bg-blue-900/50 px-1.5 rounded animate-pulse">
              {ivFluids.activeFluid} {ivFluids.isBolus ? `${ivFluids.bolusVolume}mL bolus` : `${ivFluids.rate} mL/hr`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {totalMl > 0 && (
            <span className="text-xs text-gray-500 font-mono">{totalMl}mL</span>
          )}
          <span className="text-gray-500 text-xs">{collapsed ? '▶' : '▼'}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="px-2 pb-2 space-y-2">
          {/* IV Access selector */}
          <div className="flex gap-2 items-center">
            <span className="text-xs text-gray-500 w-10 shrink-0">Access</span>
            <select
              value={ivFluids.location}
              onChange={e => setIVAccess(e.target.value, ivFluids.gauge)}
              className="flex-1 px-1.5 py-0.5 bg-gray-800 text-gray-200 rounded border border-gray-700 text-xs"
            >
              {IV_LOCATIONS.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            <select
              value={ivFluids.gauge}
              onChange={e => setIVAccess(ivFluids.location, e.target.value)}
              className="w-16 px-1.5 py-0.5 bg-gray-800 text-gray-200 rounded border border-gray-700 text-xs"
            >
              {GAUGES.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* IV Access Badge */}
          <div className="text-xs text-blue-400 font-mono bg-blue-900/30 px-2 py-0.5 rounded inline-block">
            IV: {ivFluids.location} {ivFluids.gauge}
          </div>

          {/* Fluid selection grid */}
          <div className="grid grid-cols-2 gap-1">
            {FLUIDS.map(fluid => (
              <button
                key={fluid.key}
                onClick={() => setSelectedFluid(selectedFluid === fluid.key ? null : fluid.key)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all text-left ${
                  selectedFluid === fluid.key ? 'brightness-125' : 'opacity-60 hover:opacity-80'
                }`}
                style={{
                  background: `${fluid.color}18`,
                  color: fluid.color,
                  border: `1px solid ${fluid.color}${selectedFluid === fluid.key ? 'cc' : '44'}`,
                  outline: selectedFluid === fluid.key ? `2px solid ${fluid.color}` : 'none',
                }}
              >
                <div className="font-bold">{fluid.abbrev}</div>
                <div className="text-gray-500 truncate" style={{ fontSize: 9 }}>{fluid.name}</div>
              </button>
            ))}
          </div>

          {selectedFluid && (
            <div className="space-y-1.5 pt-1 border-t border-gray-700">
              {/* Bolus toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsBolus(false)}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition-all ${!isBolus ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  Rate
                </button>
                <button
                  onClick={() => setIsBolus(true)}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition-all ${isBolus ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  Bolus
                </button>
              </div>

              {!isBolus ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-10 shrink-0">Rate</span>
                  <select
                    value={rate}
                    onChange={e => setRate(Number(e.target.value))}
                    className="flex-1 px-1.5 py-0.5 bg-gray-800 text-gray-200 rounded border border-gray-700 text-xs"
                  >
                    {RATE_OPTIONS.map(r => (
                      <option key={r} value={r}>{r} mL/hr</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-10 shrink-0">Volume</span>
                  <select
                    value={bolusVolume}
                    onChange={e => setBolusVolume(Number(e.target.value))}
                    className="flex-1 px-1.5 py-0.5 bg-gray-800 text-gray-200 rounded border border-gray-700 text-xs"
                  >
                    {BOLUS_VOLUMES.map(v => (
                      <option key={v} value={v}>{v} mL</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-1">
                <button
                  onClick={handleStart}
                  className="flex-1 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs font-bold transition-colors"
                >
                  {ivFluids.activeFluid ? 'Change' : 'Start'}
                </button>
                {ivFluids.activeFluid && (
                  <button
                    onClick={stopIVFluid}
                    className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white rounded text-xs font-bold transition-colors"
                  >
                    Stop
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Total infused */}
          {totalMl > 0 && (
            <div className="text-xs text-gray-500 font-mono border-t border-gray-700 pt-1">
              Total infused: <span className="text-blue-400 font-bold">{totalMl} mL</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
