// src/components/ScenarioStepper.tsx
// Horizontal scenario phase progress stepper shown while a scenario is running.

import React from 'react';
import useAIStore from '../store/useAIStore';

type Phase = 'pre_induction' | 'induction' | 'maintenance' | 'complication' | 'recovery' | 'debrief';

const PHASES: { id: Phase; label: string; short: string }[] = [
  { id: 'pre_induction', label: 'Pre-Induction', short: 'Pre' },
  { id: 'induction',     label: 'Induction',     short: 'Ind' },
  { id: 'maintenance',   label: 'Maintenance',   short: 'Maint' },
  { id: 'complication',  label: 'Complication',  short: 'Comp' },
  { id: 'recovery',      label: 'Recovery',      short: 'Rec' },
  { id: 'debrief',       label: 'Debrief',       short: 'Debrief' },
];

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const ScenarioStepper: React.FC = () => {
  const currentPhase = useAIStore(s => s.currentScenarioPhase);
  const elapsed = useAIStore(s => s.scenarioElapsedSeconds);
  const pendingContinue = useAIStore(s => s.pendingContinue);

  const currentIdx = currentPhase ? PHASES.findIndex(p => p.id === currentPhase) : -1;

  return (
    <div className="px-3 py-2 bg-gray-900/80 border-b border-gray-800">
      {/* Elapsed time */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] text-gray-500 uppercase tracking-wider">Scenario Progress</span>
        <span className="text-[10px] font-mono text-cyan-400">{formatTime(elapsed)}</span>
      </div>

      {/* Phase stepper */}
      <div className="flex items-center gap-0">
        {PHASES.map((phase, idx) => {
          const isCompleted = currentIdx >= 0 && idx < currentIdx;
          const isActive = idx === currentIdx;
          const isUpcoming = idx > currentIdx;

          return (
            <React.Fragment key={phase.id}>
              {/* Connector line */}
              {idx > 0 && (
                <div
                  className="flex-1 h-px transition-colors duration-500"
                  style={{
                    background: isCompleted || isActive
                      ? '#22c55e'
                      : '#374151',
                    minWidth: 4,
                  }}
                />
              )}

              {/* Phase node */}
              <div className="flex flex-col items-center" style={{ minWidth: 0 }}>
                <div
                  className="relative flex items-center justify-center transition-all duration-500"
                  style={{
                    width: isActive ? 18 : 14,
                    height: isActive ? 18 : 14,
                    borderRadius: '50%',
                    background: isCompleted
                      ? '#22c55e'
                      : isActive
                        ? 'transparent'
                        : '#1f2937',
                    border: isCompleted
                      ? '2px solid #22c55e'
                      : isActive
                        ? '2px solid #22d3ee'
                        : '2px solid #374151',
                    animation: isActive ? 'stepper-pulse 1.4s ease-in-out infinite' : undefined,
                    boxShadow: isActive ? '0 0 0 3px rgba(34,211,238,0.25)' : undefined,
                    flexShrink: 0,
                  }}
                >
                  {isCompleted && (
                    <span style={{ fontSize: 9, color: 'white', lineHeight: 1 }}>✓</span>
                  )}
                  {isActive && !pendingContinue && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22d3ee', display: 'block' }} />
                  )}
                  {isActive && pendingContinue && (
                    <span style={{ fontSize: 7, color: '#22d3ee', lineHeight: 1, fontWeight: 700 }}>⏸</span>
                  )}
                  {isUpcoming && (
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#374151', display: 'block' }} />
                  )}
                </div>

                {/* Phase label */}
                <span
                  className="transition-colors duration-300 mt-0.5"
                  style={{
                    fontSize: 7,
                    color: isCompleted ? '#22c55e' : isActive ? '#22d3ee' : '#4b5563',
                    fontWeight: isActive ? 700 : 400,
                    whiteSpace: 'nowrap',
                    maxWidth: 36,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textAlign: 'center',
                    display: 'block',
                  }}
                >
                  {phase.short}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <style>{`
        @keyframes stepper-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(34,211,238,0.25); }
          50% { box-shadow: 0 0 0 6px rgba(34,211,238,0.08); }
        }
      `}</style>
    </div>
  );
};

export default ScenarioStepper;
