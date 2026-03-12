import { useEffect, useRef } from 'react';
import { useQuantumStore } from '../store/useQuantumStore';
import { CONTEXTS } from '../quantum/math';

const QuantumPanel: React.FC = () => {
  const {
    isEnabled,
    toggleEnabled,
    contextOrder,
    multipliers,
    setContextOrder,
    addContext,
    removeContext,
    recompute,
  } = useQuantumStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Recompute when order changes
  useEffect(() => {
    recompute('standard', 1.0);
  }, [contextOrder, recompute]);

  // Canvas visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    const amp0 = Math.sqrt(0.85);
    const amp1 = Math.sqrt(multipliers.respDepressionRisk);

    // Amplitude bars
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(60, h - 40, 50, -amp0 * 160);

    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(160, h - 40, 50, -amp1 * 160);

    // Labels
    ctx.fillStyle = '#fff';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('Stable', 55, h - 15);
    ctx.fillText('Risk', 155, h - 15);

    // Phase circle (Bloch-like)
    ctx.beginPath();
    ctx.arc(280, 90, 55, 0, Math.PI * 2);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Interference arrow
    const angle = multipliers.interferenceStrength * Math.PI * 1.8;
    ctx.beginPath();
    ctx.moveTo(280, 90);
    ctx.lineTo(280 + Math.cos(angle) * 48, 90 + Math.sin(angle) * 48);
    ctx.strokeStyle = multipliers.interferenceStrength > 0.25 ? '#f43f5e' : '#22d3ee';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.fillText('Interference', 245, 175);
  }, [multipliers]);

  const availableContexts = Object.keys(CONTEXTS).filter(id => !contextOrder.includes(id));

  return (
    <div className="w-80 bg-zinc-950 border-l border-zinc-800 p-5 text-white h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-cyan-400">QUANTUM CONTEXTUALITY</h2>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={toggleEnabled}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
        </label>
      </div>

      {isEnabled && (
        <>
          {/* Context Order */}
          <div className="mb-6">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">CONTEXT ORDER (drag or use arrows)</div>
            <div className="space-y-2">
              {contextOrder.map((id, index) => {
                const ctx = CONTEXTS[id];
                return (
                  <div key={id} className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2.5 flex items-center justify-between group">
                    <div>
                      <div className="font-medium text-sm">{ctx.name}</div>
                      <div className="text-[10px] text-zinc-500">{ctx.description}</div>
                    </div>
                    <div className="flex gap-1 opacity-70 group-hover:opacity-100">
                      <button onClick={() => {
                        const newOrder = [...contextOrder];
                        if (index > 0) [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                        setContextOrder(newOrder);
                      }} className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded">
                        &uarr;
                      </button>
                      <button onClick={() => removeContext(id)} className="text-xs px-2 py-1 text-red-400 hover:bg-red-950 rounded">
                        &times;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Context */}
          {availableContexts.length > 0 && (
            <div className="mb-8">
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">ADD CONTEXT</div>
              <div className="flex flex-wrap gap-2">
                {availableContexts.map(id => (
                  <button
                    key={id}
                    onClick={() => addContext(id)}
                    className="text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 px-3 py-1 rounded-full transition-colors"
                  >
                    + {CONTEXTS[id].name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Visualization */}
          <div className="mb-6">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">QUANTUM STATE</div>
            <canvas ref={canvasRef} width={340} height={210} className="bg-black rounded border border-zinc-800" />
          </div>

          {/* Multipliers */}
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">MULTIPLIERS TO CLASSICAL ENGINE</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-zinc-900 p-3 rounded">
                ke&#x2080; <span className="text-cyan-400 font-mono">&times;{multipliers.ke0.toFixed(2)}</span>
              </div>
              <div className="bg-zinc-900 p-3 rounded">
                E&#x2098;&#x2090;&#x2093; <span className="text-cyan-400 font-mono">&times;{multipliers.emax.toFixed(2)}</span>
              </div>
              <div className="bg-zinc-900 p-3 rounded">
                Synergy <span className="text-cyan-400 font-mono">&times;{multipliers.synergy.toFixed(2)}</span>
              </div>
              <div className="bg-zinc-900 p-3 rounded">
                Resp Risk <span className={`${multipliers.respDepressionRisk > 0.28 ? 'text-red-400' : 'text-emerald-400'} font-mono`}>
                  {(multipliers.respDepressionRisk * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {multipliers.interferenceStrength > 0.22 && (
              <div className="mt-4 text-amber-400 text-xs border border-amber-900 bg-amber-950/50 p-3 rounded">
                Strong order effect detected ({(multipliers.interferenceStrength * 100).toFixed(0)}% interference)
              </div>
            )}
          </div>
        </>
      )}

      {!isEnabled && (
        <div className="text-zinc-400 text-center py-12">
          Quantum layer disabled — pure classical simulation active
        </div>
      )}
    </div>
  );
};

export default QuantumPanel;
