// src/components/ScoreBreakdown.tsx
// Displays the four-dimension scoring summary produced by scoringEngine.ts
// after a scenario completes.  Reads from useAIStore.lastScenarioScore.

import React, { useState } from 'react';
import useAIStore from '../store/useAIStore';
import type { DimensionScore } from '../engine/scoringEngine';

// ─── Dimension bar ─────────────────────────────────────────────────────────────

const DIM_ICONS: Record<string, string> = {
  Timing:          '⏱',
  Appropriateness: '💊',
  Safety:          '🛡',
  Completeness:    '✔',
};

interface DimBarProps {
  dim: DimensionScore;
}

const DimBar: React.FC<DimBarProps> = ({ dim }) => {
  const [expanded, setExpanded] = useState(false);
  const pct = dim.percent;
  const barColor =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 60 ? 'bg-yellow-500' :
                'bg-red-500';
  const icon = DIM_ICONS[dim.label] ?? '•';

  return (
    <div className="space-y-1">
      <button
        className="w-full flex items-center gap-2 text-left"
        onClick={() => setExpanded(v => !v)}
        title={`${dim.label} — click to toggle details`}
      >
        <span className="text-[11px] w-5">{icon}</span>
        <span className="flex-1 text-[11px] text-gray-300">{dim.label}</span>
        <span className="text-[10px] text-gray-400">{dim.score}/{dim.maxScore} pts</span>
        <span className={`text-[10px] font-bold w-10 text-right ${pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
          {pct}%
        </span>
        <span className="text-[10px] text-gray-500 ml-1">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Detail bullets */}
      {expanded && dim.details.length > 0 && (
        <ul className="pl-7 space-y-0.5">
          {dim.details.map((d, i) => (
            <li key={i} className="text-[10px] text-gray-400 leading-relaxed">{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ─── Main component ─────────────────────────────────────────────────────────────

const ScoreBreakdown: React.FC = () => {
  const summary = useAIStore(s => s.lastScenarioScore);
  const clearScore = useAIStore(s => s.setLastScenarioScore);

  if (!summary) return null;

  const passColor  = summary.passed ? 'text-emerald-400' : 'text-red-400';
  const passBorder = summary.passed ? 'border-emerald-600/60' : 'border-red-600/60';
  const passBg     = summary.passed ? 'bg-emerald-950/50' : 'bg-red-950/50';
  const passBadge  = summary.passed ? '✅ PASS' : '❌ FAIL';

  return (
    <div className={`mx-3 mb-3 rounded-lg border ${passBorder} ${passBg} p-3 space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className={`text-sm font-bold ${passColor}`}>{passBadge}</span>
          <span className="text-gray-400 text-xs ml-2">
            {summary.percentScore}% (Grade {summary.grade}) — pass ≥ {summary.passThreshold}%
          </span>
        </div>
        <button
          onClick={() => clearScore(null)}
          className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          title="Dismiss score"
        >
          ✕
        </button>
      </div>

      {/* Overall bar */}
      <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${summary.passed ? 'bg-emerald-500' : 'bg-red-500'}`}
          style={{ width: `${summary.percentScore}%` }}
        />
      </div>

      {/* Dimension breakdown */}
      <div className="space-y-2 pt-1">
        {Object.values(summary.dimensions).map(dim => (
          <DimBar key={dim.label} dim={dim} />
        ))}
      </div>
    </div>
  );
};

export default ScoreBreakdown;
