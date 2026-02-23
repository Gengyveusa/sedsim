import { useState } from 'react';
import { EDUCATION_MODULES, LearningModule } from '../engine/educationModules';

/**
 * Minimal inline markdown renderer.
 * Supported: # headings (1–3), --- horizontal rules, - /* list items, **bold** text, blank-line paragraphs.
 * Unsupported: links, images, code blocks, nested formatting, tables.
 */
function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split('\n');
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      nodes.push(
        <ul key={key} className="list-disc list-inside text-gray-300 text-xs space-y-1 mb-2 ml-2">
          {listItems.map((li, i) => <li key={i}>{li}</li>)}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, i) => {
    if (line.startsWith('### ')) {
      flushList(`pre-h3-${i}`);
      nodes.push(<h3 key={i} className="text-sm font-bold text-cyan-300 mt-3 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      flushList(`pre-h2-${i}`);
      nodes.push(<h2 key={i} className="text-sm font-bold text-cyan-400 mt-4 mb-1 border-b border-gray-700 pb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      flushList(`pre-h1-${i}`);
      nodes.push(<h1 key={i} className="text-base font-bold text-cyan-400 mb-2">{line.slice(2)}</h1>);
    } else if (line.startsWith('---')) {
      flushList(`pre-hr-${i}`);
      nodes.push(<hr key={i} className="border-gray-700 my-2" />);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.slice(2));
    } else if (line.trim() === '') {
      flushList(`empty-${i}`);
    } else {
      flushList(`pre-p-${i}`);
      // Handle inline bold (non-greedy to avoid runaway matches)
      const parts = line.split(/(\*\*[^*]*?\*\*)/g);
      const rendered = parts.map((p, j) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={j} className="text-white font-semibold">{p.slice(2, -2)}</strong>
          : p
      );
      nodes.push(<p key={i} className="text-gray-300 text-xs mb-1 leading-relaxed">{rendered}</p>);
    }
  });
  flushList('final');
  return nodes;
}

interface QuizState {
  selectedIndex: number | null;
  submitted: boolean;
}

export default function LearningPanel() {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'learn' | 'quiz' | 'scenarios'>('learn');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('resp_anatomy_physiology');
  const [quizStates, setQuizStates] = useState<Record<number, QuizState>>({});

  const module: LearningModule | undefined = EDUCATION_MODULES[selectedModuleId];

  const handleOptionSelect = (qIndex: number, optIndex: number) => {
    setQuizStates(prev => ({
      ...prev,
      [qIndex]: { selectedIndex: optIndex, submitted: false },
    }));
  };

  const handleSubmitAnswer = (qIndex: number) => {
    setQuizStates(prev => ({
      ...prev,
      [qIndex]: { ...prev[qIndex], submitted: true },
    }));
  };

  const resetQuiz = () => setQuizStates({});

  return (
    <div
      className={`transition-all duration-300 ease-in-out border-l border-gray-700 overflow-hidden flex flex-col ${
        expanded ? 'w-80' : 'w-10'
      }`}
    >
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="h-full w-10 flex items-center justify-center bg-gray-800/60 hover:bg-gray-700/80 transition-colors group"
          title="Show Learning Panel"
        >
          <span
            className="text-xs text-gray-400 group-hover:text-green-400 whitespace-nowrap tracking-wider uppercase"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            Learn
          </span>
        </button>
      )}

      {expanded && (
        <div className="flex flex-col h-full bg-sim-panel">
          {/* Header */}
          <div className="flex items-center justify-between px-2 py-1 border-b border-gray-700 shrink-0">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Education</span>
            <button
              onClick={() => setExpanded(false)}
              className="text-gray-400 hover:text-white text-sm px-1"
              title="Collapse Learning Panel"
            >
              &raquo;
            </button>
          </div>

          {/* Module Selector */}
          <div className="px-2 py-1 border-b border-gray-700 shrink-0">
            <select
              value={selectedModuleId}
              onChange={e => { setSelectedModuleId(e.target.value); resetQuiz(); }}
              className="w-full text-xs bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-gray-300"
            >
              {Object.values(EDUCATION_MODULES).map(m => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-700 shrink-0">
            {(['learn', 'quiz', 'scenarios'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-xs py-1 capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-cyan-400 border-b-2 border-cyan-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-2">
            {!module && (
              <p className="text-gray-500 text-xs">Module not found.</p>
            )}

            {module && activeTab === 'learn' && (
              <div>
                <div className="mb-2">
                  <span className="text-xs text-green-400 uppercase tracking-wider">{module.category.replace('_', ' ')}</span>
                  {' · '}
                  <span className="text-xs text-gray-500 capitalize">{module.level}</span>
                </div>
                <div className="mb-3">
                  <h4 className="text-xs text-cyan-300 font-semibold mb-1 uppercase tracking-wider">Learning Objectives</h4>
                  <ol className="list-decimal list-inside space-y-1">
                    {module.objectives.map((obj, i) => (
                      <li key={i} className="text-xs text-gray-300 leading-relaxed">{obj}</li>
                    ))}
                  </ol>
                </div>
                <div>{renderMarkdown(module.content)}</div>
              </div>
            )}

            {module && activeTab === 'quiz' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">{module.quizQuestions.length} questions</span>
                  <button
                    onClick={resetQuiz}
                    className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                  >
                    Reset
                  </button>
                </div>
                {module.quizQuestions.map((q, qi) => {
                  const state = quizStates[qi] ?? { selectedIndex: null, submitted: false };
                  const isCorrect = state.submitted && state.selectedIndex === q.correctIndex;
                  const isWrong = state.submitted && state.selectedIndex !== null && state.selectedIndex !== q.correctIndex;
                  return (
                    <div key={qi} className="bg-gray-800/60 rounded p-2">
                      <p className="text-xs text-white mb-2 font-medium">{qi + 1}. {q.question}</p>
                      <div className="space-y-1 mb-2">
                        {q.options.map((opt, oi) => {
                          let optClass = 'border border-gray-600 text-gray-300';
                          if (state.submitted) {
                            if (oi === q.correctIndex) optClass = 'border border-green-500 text-green-300 bg-green-900/30';
                            else if (oi === state.selectedIndex) optClass = 'border border-red-500 text-red-300 bg-red-900/30';
                          } else if (state.selectedIndex === oi) {
                            optClass = 'border border-cyan-500 text-cyan-300';
                          }
                          return (
                            <button
                              key={oi}
                              disabled={state.submitted}
                              onClick={() => handleOptionSelect(qi, oi)}
                              className={`w-full text-left text-xs rounded px-2 py-1 transition-colors ${optClass} ${!state.submitted ? 'hover:border-gray-400' : ''}`}
                            >
                              {String.fromCharCode(65 + oi)}. {opt}
                            </button>
                          );
                        })}
                      </div>
                      {!state.submitted && state.selectedIndex !== null && (
                        <button
                          onClick={() => handleSubmitAnswer(qi)}
                          className="text-xs bg-cyan-700 hover:bg-cyan-600 text-white rounded px-3 py-1 transition-colors"
                        >
                          Submit
                        </button>
                      )}
                      {state.submitted && (
                        <div className={`text-xs rounded p-1.5 mt-1 ${isCorrect ? 'bg-green-900/40 text-green-300' : isWrong ? 'bg-red-900/40 text-red-300' : ''}`}>
                          <strong>{isCorrect ? '✓ Correct!' : '✗ Incorrect.'}</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {module && activeTab === 'scenarios' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 mb-2">Guided simulator scenarios for this module:</p>
                {module.simulatorScenarios.length === 0 && (
                  <p className="text-xs text-gray-500 italic">No linked scenarios.</p>
                )}
                {module.simulatorScenarios.map(sid => (
                  <div key={sid} className="bg-gray-800/60 rounded p-2">
                    <p className="text-xs text-cyan-300 font-medium">{sid.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Open the Scenario panel and select this scenario to practice with simulator guidance.</p>
                  </div>
                ))}
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-1 font-semibold">Millie Mentor Scripts</p>
                  {module.millieScripts.map((ms, i) => (
                    <div key={i} className="bg-gray-900/60 rounded p-2 mb-1 border border-gray-700">
                      <p className="text-xs text-green-400 font-medium mb-0.5">Trigger: {ms.trigger.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-300 italic">&ldquo;{ms.text}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
