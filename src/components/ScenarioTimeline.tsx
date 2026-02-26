// src/components/ScenarioTimeline.tsx
// Horizontal scenario phase timeline bar — replaces ScenarioStepper for MillieChat.
// Compact, elegant design that fits above the chat panel.

import React from 'react';
import useAIStore from '../store/useAIStore';
import { scenarioEngine } from '../engine/ScenarioEngine';

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

const ScenarioTimeline: React.FC = () => {
  const currentPhase = useAIStore(s => s.currentScenarioPhase);
  const elapsed = useAIStore(s => s.scenarioElapsedSeconds);
  const pendingContinue = useAIStore(s => s.pendingContinue);
  const [hoveredPhase, setHoveredPhase] = React.useState<Phase | null>(null);

  const currentIdx = currentPhase ? PHASES.findIndex(p => p.id === currentPhase) : -1;

  return (
    <div className="px-3 pt-2 pb-1.5 bg-gray-900/90 border-b border-gray-800">
      {/* Header row: label + elapsed time */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">
          Scenario
        </span>
        <span className="text-[10px] font-mono text-cyan-400">{formatTime(elapsed)}</span>
      </div>

      {/* Phase timeline bar */}
      <div className="flex items-center">
        {PHASES.map((phase, idx) => {
          const isCompleted = currentIdx >= 0 && idx < currentIdx;
          const isActive = idx === currentIdx;
          const isUpcoming = idx > currentIdx;

          return (
            <React.Fragment key={phase.id}>
              {/* Connector bar */}
              {idx > 0 && (
                <div
                  className="flex-1 transition-all duration-500"
                  style={{
                    height: 2,
                    background: isCompleted || isActive ? '#22c55e' : '#374151',
                    minWidth: 4,
                  }}
                />
              )}

              {/* Phase dot */}
              <div className="flex flex-col items-center" style={{ minWidth: 0 }}>
                <button
                  disabled={!isCompleted}
                  title={isCompleted ? `Jump to ${phase.label}` : phase.label}
                  onClick={isCompleted ? () => scenarioEngine.jumpToPhase(phase.id) : undefined}
                  onMouseEnter={isCompleted ? () => setHoveredPhase(phase.id) : undefined}
                  onMouseLeave={isCompleted ? () => setHoveredPhase(null) : undefined}
                  className="flex items-center justify-center transition-all duration-300 focus:outline-none"
                  style={{
                    width: isActive ? 16 : 12,
                    height: isActive ? 16 : 12,
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
                    animation: isActive ? 'timeline-pulse 1.4s ease-in-out infinite' : undefined,
                    boxShadow: isActive ? '0 0 0 3px rgba(34,211,238,0.2)' : undefined,
                    flexShrink: 0,
                    cursor: isCompleted ? 'pointer' : 'default',
                    transform: isCompleted && hoveredPhase === phase.id ? 'scale(1.25)' : undefined,
                  }}
                >
                  {isCompleted && (
                    <span style={{ fontSize: 8, color: 'white', lineHeight: 1, pointerEvents: 'none' }}>✓</span>
                  )}
                  {isActive && !pendingContinue && (
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22d3ee', display: 'block' }} />
                  )}
                  {isActive && pendingContinue && (
                    <span style={{ fontSize: 7, color: '#22d3ee', lineHeight: 1, fontWeight: 700 }}>⏸</span>
                  )}
                  {isUpcoming && (
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#374151', display: 'block' }} />
                  )}
                </button>

                {/* Phase label */}
                <span
                  className="mt-0.5 block transition-colors duration-300"
                  style={{
                    fontSize: 7,
                    color: isCompleted ? '#22c55e' : isActive ? '#22d3ee' : '#4b5563',
                    fontWeight: isActive ? 700 : 400,
                    whiteSpace: 'nowrap',
                    maxWidth: 32,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textAlign: 'center',
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
        @keyframes timeline-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(34,211,238,0.2); }
          50% { box-shadow: 0 0 0 6px rgba(34,211,238,0.06); }
        }
      `}</style>
    </div>
  );
};

export default ScenarioTimeline;
