import React, { useState } from 'react';
import { generateScenario, Scenario } from '../ai/scenarioGenerator';
import useSimStore from '../store/useSimStore';

interface ScenarioHistoryItem {
  scenario: Scenario;
  timestamp: Date;
}

const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
const FOCUS_AREAS = [
  'Airway Management',
  'Hemodynamic Instability',
  'Drug Interactions',
  'Pediatric Sedation',
  'Geriatric Considerations',
  'Malignant Hyperthermia',
  'Local Anesthetic Toxicity',
  'Respiratory Depression',
  'Anaphylaxis',
  'Cardiac Arrest',
] as const;

export const ScenarioPanel: React.FC = () => {
  const [difficulty, setDifficulty] = useState<string>('intermediate');
  const [focusArea, setFocusArea] = useState<string>('Airway Management');
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [history, setHistory] = useState<ScenarioHistoryItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showObjectives, setShowObjectives] = useState(false);

  const simState = useSimStore((s) => ({
    drugs: s.drugs,
    vitals: s.vitals,
    patient: s.patient,
  }));

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const scenario = await generateScenario({
        difficulty,
        focusArea,
        currentState: simState,
      });
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
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full bg-gray-800 text-white text-sm rounded px-2 py-1.5 border border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            {DIFFICULTY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Focus Area</label>
          <select
            value={focusArea}
            onChange={(e) => setFocusArea(e.target.value)}
            className="w-full bg-gray-800 text-white text-sm rounded px-2 py-1.5 border border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            {FOCUS_AREAS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white text-sm font-medium py-2 rounded transition-colors mb-4"
      >
        {isGenerating ? 'Generating...' : 'Generate Scenario'}
      </button>

      {/* Current Scenario */}
      {currentScenario && (
        <div className="bg-gray-800 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-semibold text-sm">
              {currentScenario.title}
            </h3>
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                currentScenario.difficulty === 'beginner'
                  ? 'bg-green-900 text-green-300'
                  : currentScenario.difficulty === 'intermediate'
                  ? 'bg-yellow-900 text-yellow-300'
                  : currentScenario.difficulty === 'advanced'
                  ? 'bg-orange-900 text-orange-300'
                  : 'bg-red-900 text-red-300'
              }`}
            >
              {currentScenario.difficulty}
            </span>
          </div>

          <p className="text-gray-300 text-xs mb-3">
            {currentScenario.description}
          </p>

          {/* Patient Info */}
          <div className="bg-gray-900 rounded p-2 mb-3">
            <h4 className="text-xs font-medium text-gray-400 mb-1">Patient</h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Age:</span>{' '}
                <span className="text-white">{currentScenario.patient.age}y</span>
              </div>
              <div>
                <span className="text-gray-500">Weight:</span>{' '}
                <span className="text-white">{currentScenario.patient.weight}kg</span>
              </div>
              <div>
                <span className="text-gray-500">ASA:</span>{' '}
                <span className="text-white">{currentScenario.patient.asa}</span>
              </div>
            </div>
            {currentScenario.patient.comorbidities.length > 0 && (
              <div className="mt-1">
                <span className="text-xs text-gray-500">Comorbidities: </span>
                <span className="text-xs text-yellow-400">
                  {currentScenario.patient.comorbidities.join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Events Timeline */}
          <div className="mb-3">
            <h4 className="text-xs font-medium text-gray-400 mb-1">
              Scheduled Events
            </h4>
            <div className="space-y-1">
              {currentScenario.events.map((event, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs bg-gray-900 rounded px-2 py-1"
                >
                  <span className="text-blue-400 font-mono w-12">
                    {event.timeMin}min
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs ${
                      event.type === 'complication'
                        ? 'bg-red-900 text-red-300'
                        : event.type === 'drug'
                        ? 'bg-blue-900 text-blue-300'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {event.type}
                  </span>
                  <span className="text-gray-300 flex-1">
                    {event.description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Learning Objectives (toggle) */}
          <button
            onClick={() => setShowObjectives(!showObjectives)}
            className="text-xs text-blue-400 hover:text-blue-300 mb-2"
          >
            {showObjectives ? 'Hide' : 'Show'} Learning Objectives
          </button>
          {showObjectives && (
            <ul className="list-disc list-inside text-xs text-gray-300 space-y-1">
              {currentScenario.objectives.map((obj, idx) => (
                <li key={idx}>{obj}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-gray-400 mb-2">
            Recent Scenarios
          </h3>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {history.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleLoadScenario(item.scenario)}
                className="w-full text-left bg-gray-800 hover:bg-gray-700 rounded px-2 py-1.5 text-xs transition-colors"
              >
                <span className="text-white">{item.scenario.title}</span>
                <span className="text-gray-500 ml-2">
                  {item.timestamp.toLocaleTimeString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
