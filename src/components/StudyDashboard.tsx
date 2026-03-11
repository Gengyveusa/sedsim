/**
 * src/components/StudyDashboard.tsx
 * Progress dashboard for the A/B study protocol.
 * Shows per-arm scores, progress through 3 arms, CSV export, admin aggregate view.
 */

import { useState, useCallback } from 'react';
import useStudyStore from '../store/useStudyStore';
import { AnalyticsEngine } from '../engine/analytics';
import type { SessionSummary } from '../engine/analytics';
import { STUDY_ARMS } from '../ai/studyArms';
import type { StudyArmId } from '../ai/studyArms';

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StudyDashboard() {
  const {
    learnerId,
    armSequence,
    currentArmIndex,
    armResults,
    studyPhase,
  } = useStudyStore();

  const [showAdmin, setShowAdmin] = useState(false);

  const handleExportEvents = useCallback(() => {
    const csv = AnalyticsEngine.exportAllEventsCSV();
    downloadCSV(csv, `sedsim_events_${learnerId}_${Date.now()}.csv`);
  }, [learnerId]);

  const handleExportSummaries = useCallback(() => {
    const csv = AnalyticsEngine.exportAllSummariesCSV();
    downloadCSV(csv, `sedsim_summaries_${learnerId}_${Date.now()}.csv`);
  }, [learnerId]);

  const allSummaries = AnalyticsEngine.getAllSummaries();

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-900 rounded-xl border border-gray-700 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Study Dashboard</h2>
          <p className="text-[10px] text-gray-500 font-mono">{learnerId}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded border ${
          studyPhase === 'study_complete'
            ? 'bg-green-900/30 text-green-400 border-green-700/50'
            : 'bg-blue-900/30 text-blue-400 border-blue-700/50'
        }`}>
          {studyPhase === 'study_complete' ? 'COMPLETE' : `Arm ${currentArmIndex + 1}/3`}
        </span>
      </div>

      {/* Arm progress overview */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">Study Arms Progress</h3>
        {armSequence.map((arm, idx) => {
          const result = armResults.find(r => r.arm === arm);
          const isComplete = idx < currentArmIndex || studyPhase === 'study_complete';
          const isCurrent = idx === currentArmIndex && studyPhase !== 'study_complete';
          return (
            <ArmCard
              key={idx}
              arm={arm}
              index={idx}
              result={result}
              isComplete={isComplete}
              isCurrent={isCurrent}
            />
          );
        })}
      </div>

      {/* Score comparison chart (text-based) */}
      {armResults.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Score Comparison</h3>
          <div className="bg-gray-800 rounded p-3 border border-gray-700">
            <div className="grid grid-cols-4 gap-2 text-[10px] text-gray-500 mb-2 uppercase tracking-wider font-semibold">
              <span>Arm</span>
              <span>Pre-test</span>
              <span>Post-test</span>
              <span>Change</span>
            </div>
            {armResults.map((r, i) => {
              const change = r.posttestScore - r.pretestScore;
              return (
                <div key={i} className="grid grid-cols-4 gap-2 text-xs text-gray-300 py-1 border-t border-gray-700/50">
                  <span className="font-bold">Arm {r.arm}</span>
                  <span>{r.pretestScore}/5</span>
                  <span>{r.posttestScore}/5</span>
                  <span className={change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-500'}>
                    {change > 0 ? '+' : ''}{change}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CSV Export */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Data Export</h3>
        <div className="flex gap-2">
          <button
            onClick={handleExportEvents}
            className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-semibold transition-colors"
          >
            Export All Events (CSV)
          </button>
          <button
            onClick={handleExportSummaries}
            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition-colors"
          >
            Export Summaries (CSV)
          </button>
        </div>
        <p className="text-[10px] text-gray-500 mt-1">
          CSV format compatible with SPSS, R, and Excel.
        </p>
      </div>

      {/* Admin aggregate view */}
      <div className="border-t border-gray-700 pt-4">
        <button
          onClick={() => setShowAdmin(!showAdmin)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {showAdmin ? '\u25BC' : '\u25B6'} Admin: Aggregate Data ({allSummaries.length} sessions)
        </button>

        {showAdmin && (
          <AdminView summaries={allSummaries} />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ArmCard({
  arm, index, result, isComplete, isCurrent,
}: {
  arm: StudyArmId;
  index: number;
  result?: { pretestScore: number; posttestScore: number; scenarioScore: number; duration_s: number };
  isComplete: boolean;
  isCurrent: boolean;
}) {
  const def = STUDY_ARMS[arm];
  return (
    <div className={`p-3 rounded border ${
      isComplete
        ? 'bg-green-900/20 border-green-700/40'
        : isCurrent
        ? 'bg-blue-900/20 border-blue-700/40'
        : 'bg-gray-800/50 border-gray-700/40'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-white">
          Arm {arm}: {def.name}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
          isComplete ? 'bg-green-600/30 text-green-400' : isCurrent ? 'bg-blue-600/30 text-blue-400' : 'bg-gray-700 text-gray-500'
        }`}>
          {isComplete ? 'Complete' : isCurrent ? 'In Progress' : `Step ${index + 1}`}
        </span>
      </div>
      <p className="text-[10px] text-gray-400 mb-2">{def.shortDescription}</p>

      {result && (
        <div className="grid grid-cols-4 gap-2 text-[10px]">
          <div>
            <span className="text-gray-500 block">Pre-test</span>
            <span className="text-white font-bold">{result.pretestScore}/5</span>
          </div>
          <div>
            <span className="text-gray-500 block">Post-test</span>
            <span className="text-white font-bold">{result.posttestScore}/5</span>
          </div>
          <div>
            <span className="text-gray-500 block">Scenario</span>
            <span className="text-white font-bold">{result.scenarioScore}%</span>
          </div>
          <div>
            <span className="text-gray-500 block">Duration</span>
            <span className="text-white font-bold">{Math.floor(result.duration_s / 60)}m</span>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminView({ summaries }: { summaries: SessionSummary[] }) {
  if (summaries.length === 0) {
    return <p className="text-xs text-gray-500 mt-2">No session data in localStorage.</p>;
  }

  // Group by arm
  const byArm: Record<string, SessionSummary[]> = { A: [], B: [], C: [] };
  for (const s of summaries) {
    if (byArm[s.studyArm]) byArm[s.studyArm].push(s);
  }

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : 0;

  return (
    <div className="mt-3 bg-gray-800 rounded p-3 border border-gray-700 text-xs">
      <div className="grid grid-cols-4 gap-2 text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">
        <span>Arm</span>
        <span>Sessions</span>
        <span>Avg Pre</span>
        <span>Avg Post</span>
      </div>
      {(['A', 'B', 'C'] as const).map(arm => {
        const sessions = byArm[arm];
        return (
          <div key={arm} className="grid grid-cols-4 gap-2 text-gray-300 py-1 border-t border-gray-700/50">
            <span className="font-bold">Arm {arm}</span>
            <span>{sessions.length}</span>
            <span>{avg(sessions.map(s => s.pretestScore))}</span>
            <span>{avg(sessions.map(s => s.posttestScore))}</span>
          </div>
        );
      })}
      <p className="text-[10px] text-gray-500 mt-2">
        Total participants: {new Set(summaries.map(s => s.learnerId)).size} |
        Total sessions: {summaries.length}
      </p>
    </div>
  );
}
