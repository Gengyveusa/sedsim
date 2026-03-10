import React, { useState } from 'react';
import { INTERACTIVE_SCENARIOS } from '../engine/interactiveScenarios';
import { InteractiveScenario } from '../engine/ScenarioEngine';
import useAIStore from '../store/useAIStore';
import useSimStore from '../store/useSimStore';
import { useConductor } from '../hooks/useConductor';
import useInstructorStore, { getLearnerName } from '../store/useInstructorStore';

const DIFFICULTY_COLORS: Record<InteractiveScenario['difficulty'], string> = {
  easy: 'bg-green-900 text-green-300',
  moderate: 'bg-yellow-900 text-yellow-300',
  hard: 'bg-orange-900 text-orange-300',
  expert: 'bg-red-900 text-red-300',
};

const DIFFICULTY_FILTERS = ['all', 'easy', 'moderate', 'hard', 'expert'] as const;
type DifficultyFilter = (typeof DIFFICULTY_FILTERS)[number];

export const ScenarioPanel: React.FC = () => {
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [currentScenario, setCurrentScenario] = useState<InteractiveScenario | null>(null);
  const [showObjectives, setShowObjectives] = useState(false);
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('sedsim_completed_scenarios') || '[]');
    } catch {
      return [];
    }
  });

  const isScenarioRunning = useAIStore(s => s.isScenarioRunning);
  const conductor = useConductor();

  const filtered = difficultyFilter === 'all'
    ? INTERACTIVE_SCENARIOS
    : INTERACTIVE_SCENARIOS.filter(s => s.difficulty === difficultyFilter);

  const markComplete = (id: string) => {
    const updated = Array.from(new Set([...completedIds, id]));
    setCompletedIds(updated);
    try { localStorage.setItem('sedsim_completed_scenarios', JSON.stringify(updated)); } catch { /* ignore */ }
  };


    const handlePlayScenario = (scenario: InteractiveScenario) => {
      // ── 1. Reset simulator and load the scenario's patient archetype ──
      const sim = useSimStore.getState();
      sim.reset();
      sim.selectPatient(scenario.patientArchetype);
      sim.setTrueNorthLocked(true);
      sim.setScenarioDrugProtocols(scenario.drugProtocols);
      sim.setScenarioActive(true);

      // ── 2. Prepare AI store ──
      const ai = useAIStore.getState();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ai.setActiveScenario(scenario as any);
      ai.setCurrentQuestion(null);
      ai.setPendingContinue(null);
      ai.setActiveAITab('mentor');

      // ── 3. Inject "scenario loaded" mentor message ──
      ai.addMentorMessage(
        'mentor',
        `🎓 Scenario loaded: **${scenario.title}** (${scenario.difficulty.toUpperCase()})\n\n${scenario.description}`
      );

      // ── 4. Inject pre-op vignette presentation ──
      const v = scenario.preopVignette;
      const vignetteLines: string[] = [
        `👩‍⚕️ **Millie the Mentor** — Let's begin your scenario!\n`,
        `**📋 Pre-op Vignette: ${scenario.title}**\n`,
        `**Indication:** ${v.indication}\n**Setting:** ${v.setting}`,
        `**History:**\n${v.history.map((h: string) => `• ${h}`).join('\n')}`,
        `**Exam:**\n${v.exam.map((e: string) => `• ${e}`).join('\n')}`,
      ];
      if (v.labs?.length) {
        vignetteLines.push(`**Labs:**\n${v.labs.map((l: string) => `• ${l}`).join('\n')}`);
      }
      vignetteLines.push(
        `**Baseline Monitors:** ${v.baselineMonitors.join(', ')}`,
        `**Target Sedation Goal:** ${v.targetSedationGoal}`,
        `\n**Learning Objectives:**\n${scenario.learningObjectives.map((o: string) => `• ${o}`).join('\n')}`
      );
      ai.addMentorMessage('mentor', vignetteLines.join('\n\n'));

      // ── 5. Load into Conductor and start ──
      conductor.loadLegacyScenario(scenario);
      conductor.start();

      // ── 6. Ensure sim clock is ticking ──
      const simNow = useSimStore.getState();
      if (!simNow.isRunning) simNow.toggleRunning();
  };
  
  const handleStopScenario = () => {
    conductor.stop();

    // ── Record session for instructor dashboard ──────────────────────────
    if (currentScenario) {
      const sim = useSimStore.getState();
      const trendData = sim.trendData;
      const spo2Values = trendData.map(p => p.vitals.spo2).filter(v => v > 0);
      const sbpValues  = trendData.map(p => p.vitals.sbp).filter(v => v > 0);
      const moassValues = trendData.map(p => p.moass);

      useInstructorStore.getState().addSession({
        studentName:            getLearnerName(),
        scenarioId:             currentScenario.id,
        scenarioTitle:          currentScenario.title,
        difficulty:             currentScenario.difficulty,
        completedAt:            Date.now(),
        durationSeconds:        sim.elapsedSeconds,
        drugsAdministeredCount: sim.drugsAdministeredCount,
        interventionsApplied:   sim.eventLog.filter(e => e.type === 'intervention').length,
        alertsTriggered:        sim.eventLog.filter(e => e.type === 'alert').length,
        minSpo2:                spo2Values.length ? Math.min(...spo2Values) : 99,
        minSbp:                 sbpValues.length  ? Math.min(...sbpValues)  : 120,
        maxMoass:               moassValues.length ? Math.max(...moassValues) : 0,
      });
    }

    // ── Clean up scenario state ──────────────────────────────────────────
    const sim = useSimStore.getState();
    sim.setTrueNorthLocked(false);
    sim.setScenarioActive(false);
    sim.setScenarioDrugProtocols(null);
    useAIStore.getState().setActiveScenario(null);
    if (currentScenario) markComplete(currentScenario.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">Clinical Scenarios</h2>
        <span className="text-xs text-gray-400">{completedIds.length}/{INTERACTIVE_SCENARIOS.length} completed</span>
      </div>

      {/* Active scenario banner */}
      {isScenarioRunning && (
        <div className="bg-blue-900/60 border border-blue-600 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-blue-300 font-semibold">🎓 Millie scenario running…</span>
          <button
            onClick={handleStopScenario}
            className="text-[10px] bg-red-700 hover:bg-red-600 text-white px-2 py-1 rounded transition-colors"
          >
            Stop &amp; Debrief
          </button>
        </div>
      )}

      {/* Difficulty filter */}
      <div className="flex gap-1 flex-wrap">
        {DIFFICULTY_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setDifficultyFilter(f)}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              difficultyFilter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Scenario list */}
      {currentScenario === null ? (
        <div className="space-y-2">
          {filtered.map(scenario => (
            <button
              key={scenario.id}
              onClick={() => { setCurrentScenario(scenario); setShowObjectives(false); }}
              className="w-full text-left bg-gray-800 hover:bg-gray-700 rounded-lg p-3 transition-colors border border-gray-700 hover:border-gray-500"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-xs font-semibold truncate">{scenario.title}</span>
                    {completedIds.includes(scenario.id) && <span className="text-green-400 text-[10px]">✓</span>}
                  </div>
                  <p className="text-gray-400 text-[10px] line-clamp-2">{scenario.description}</p>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${DIFFICULTY_COLORS[scenario.difficulty as InteractiveScenario['difficulty']]}`}>
                  {scenario.difficulty.toUpperCase()}
                </span>
              </div>
              <div className="flex gap-3 mt-2 text-[9px] text-gray-500">
                <span>{scenario.procedure}</span>
                <span>{scenario.steps.length} steps</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* Scenario detail view */
        <div>
          <button
            onClick={() => setCurrentScenario(null)}
            className="text-xs text-blue-400 hover:text-blue-300 mb-3 flex items-center gap-1"
          >
            ← Back to scenarios
          </button>

          <div className="bg-gray-800 rounded-lg p-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold text-white">{currentScenario.title}</h3>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${DIFFICULTY_COLORS[currentScenario.difficulty]}`}>
                {currentScenario.difficulty.toUpperCase()}
              </span>
            </div>

            <p className="text-xs text-gray-300">{currentScenario.description}</p>

            {/* Pre-op vignette summary */}
            <div className="bg-gray-900 rounded p-2 text-xs space-y-1">
              <div className="text-gray-400 font-semibold text-[10px] uppercase tracking-wide">Pre-op Vignette</div>
              <p className="text-gray-300"><span className="text-gray-500">Setting:</span> {currentScenario.preopVignette.setting}</p>
              <p className="text-gray-300"><span className="text-gray-500">Indication:</span> {currentScenario.preopVignette.indication}</p>
              <p className="text-gray-300"><span className="text-gray-500">Target:</span> {currentScenario.preopVignette.targetSedationGoal}</p>
            </div>

            {/* Learning objectives */}
            <button
              onClick={() => setShowObjectives(!showObjectives)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {showObjectives ? '▼' : '▶'} Learning Objectives ({currentScenario.learningObjectives.length})
            </button>
            {showObjectives && (
              <ul className="list-disc list-inside text-xs text-gray-300 space-y-0.5 pl-1">
                {currentScenario.learningObjectives.map((obj, idx) => (
                  <li key={idx}>{obj}</li>
                ))}
              </ul>
            )}

            {/* Play / Stop buttons */}
            {isScenarioRunning ? (
              <button
                onClick={handleStopScenario}
                className="w-full text-xs py-2 rounded bg-red-700 hover:bg-red-600 text-white font-semibold transition-colors"
              >
                ⏹ Stop Scenario &amp; Run Debrief
              </button>
            ) : (
              <button
                onClick={() => handlePlayScenario(currentScenario)}
                className="w-full text-xs py-2 rounded bg-green-700 hover:bg-green-600 text-white font-semibold transition-colors"
              >
                ▶ Play Scenario with Millie
              </button>
            )}

            {/* Mark complete button */}
            <button
              onClick={() => markComplete(currentScenario.id)}
              disabled={completedIds.includes(currentScenario.id)}
              className={`w-full text-xs py-1.5 rounded transition-colors ${
                completedIds.includes(currentScenario.id)
                  ? 'bg-green-900 text-green-300 cursor-default'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {completedIds.includes(currentScenario.id) ? '✓ Completed' : 'Mark as Completed'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
