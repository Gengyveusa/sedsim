import React, { useState } from 'react';
import { generateScenario, Scenario } from '../ai/scenarioGenerator'
interface ScenarioHistoryItem {
  scenario: Scenario;
  timestamp: Date;
}

const DIFFICULTY_LEVELS = ['easy', 'moderate', 'hard', 'expert'] as const;

export const ScenarioPanel: React.FC = () => {
  const [difficulty, setDifficulty] = useState<Scenario['difficulty']>('moderate');
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [history, setHistory] = useState<ScenarioHistoryItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showObjectives, setShowObjectives] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    try {
      const scenario = generateScenario(difficulty);
      setCurrentScenario(scenario);
      setHistory((prev) => [
        { scenario, timestamp: new Date() },
        ...prev.slice(0, 9),
      ]);
      setShowObjectives(false);
    } catch (err) {
      console.error('Scenario generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadScenario = (scenario: Scenario) => {
    setCurrentScenario(scenario);
    setShowObjectives(false);
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
      <h2 className="text-lg font-bold text-white mb-4">
        AI Scenario Generator
      </h2>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Difficulty</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Scenario['difficulty'])}
            className="w-full bg-gray-800 text-white text-sm rounded px-2 py-1.5 border border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            {DIFFICULTY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white text-sm font-medium py-2 rounded transition-colors mb-4"
      >
        {isGenerating ? 'Generating...' : 'Generate Scenario'}
      </button>

      {/* Current Scenario */}
      {currentScenario && (
        <div className="bg-gray-800 rounded-lg p-3 mb-4">
          <h3 className="text-sm font-bold text-white mb-1">
            {currentScenario.name}
          </h3>
          <span className="inline-block text-xs px-2 py-0.5 rounded bg-blue-900 text-blue-300 mb-2">
            {currentScenario.difficulty}
          </span>

          <p className="text-xs text-gray-300 mb-3">
            {currentScenario.description}
          </p>

          {/* Patient Info */}
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-400 mb-1">Patient</h4>
            <p className="text-xs text-gray-300">
              Age:{' '}
              <span className="text-white">{currentScenario.patient.age}y</span>
            </p>
            <p className="text-xs text-gray-300">
              Weight:{' '}
              <span className="text-white">{currentScenario.patient.weight}kg</span>
            </p>
            <p className="text-xs text-gray-300">
              ASA:{' '}
              <span className="text-white">{currentScenario.patient.asa}</span>
            </p>
          </div>

          {/* Complications Timeline */}
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-400 mb-1">Complications</h4>
            {currentScenario.complications.map((comp, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-gray-300 mb-1">
                <span className="text-yellow-400">{comp.triggerTime ? `${Math.round(comp.triggerTime / 60)}min` : 'conditional'}</span>
                <span className="text-blue-400">{comp.type}</span>
                <span>{comp.description}</span>
              </div>
            ))}
          </div>

          {/* Learning Objectives (toggle) */}
          <button
            onClick={() => setShowObjectives(!showObjectives)}
            className="text-xs text-blue-400 hover:text-blue-300 mb-2"
          >
            {showObjectives ? 'Hide' : 'Show'} Learning Objectives
          </button>
          {showObjectives && (
            <ul className="list-disc list-inside text-xs text-gray-300 mt-1">
              {currentScenario.learningObjectives.map((obj, idx) => (
                <li key={idx}>{obj}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 mb-2">Recent Scenarios</h3>
          {history.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleLoadScenario(item.scenario)}
              className="w-full text-left bg-gray-800 hover:bg-gray-700 rounded px-2 py-1.5 text-xs transition-colors mb-1"
            >
              <span className="text-white">{item.scenario.name}</span>
              <span className="text-gray-500 ml-2">{item.timestamp.toLocaleTimeString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
