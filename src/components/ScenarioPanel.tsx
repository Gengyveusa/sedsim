import React, { useState } from 'react';
import { Scenario, Complication } from '../ai/scenarioGenerator';

// 10 pre-built clinical scenarios
const PREBUILT_SCENARIOS: Scenario[] = [
  {
    id: 'routine_colonoscopy',
    name: 'Routine Colonoscopy',
    description: 'Straightforward colonoscopy sedation for a healthy adult. Focus on titration to MOASS 2-3.',
    procedure: 'Colonoscopy',
    difficulty: 'easy',
    patient: { age: 45, weight: 70, height: 170, sex: 'M', asa: 1 },
    complications: [],
    triggerConditions: [],
    learningObjectives: [
      'Achieve target sedation depth MOASS 2-3',
      'Monitor vitals throughout procedure',
      'Titrate propofol infusion appropriately',
    ],
    timeLimit: 300,
  },
  {
    id: 'elderly_copd',
    name: 'Elderly Patient with COPD',
    description: 'Elderly male with COPD requiring colonoscopy. High risk of desaturation and hypotension.',
    procedure: 'Colonoscopy',
    difficulty: 'moderate',
    patient: { age: 72, weight: 65, height: 168, sex: 'M', asa: 3, copd: true },
    complications: [
      {
        type: 'desaturation',
        triggerTime: 120,
        severity: 'severe',
        description: 'Progressive O2 desaturation due to COPD + sedation',
        expectedResponse: 'Increase FiO2, reduce propofol infusion rate, jaw thrust if needed',
        vitalChanges: { spo2: -12, rr: -4 },
      },
    ],
    triggerConditions: [{ type: 'time', parameter: 'elapsedSeconds', threshold: 120, operator: '>=', complicationIndex: 0 }],
    learningObjectives: [
      'Manage sedation in high respiratory-risk patient',
      'Respond to desaturation in COPD patient',
      'Use supplemental oxygen proactively',
    ],
    timeLimit: 600,
  },
  {
    id: 'obese_osa',
    name: 'Obese OSA Patient – Difficult Airway',
    description: 'Obese patient with OSA presenting for upper GI endoscopy. High risk of airway obstruction.',
    procedure: 'Upper GI Endoscopy',
    difficulty: 'moderate',
    patient: { age: 55, weight: 110, height: 172, sex: 'F', asa: 3, osa: true, mallampati: 3 },
    complications: [
      {
        type: 'desaturation',
        triggerTime: 90,
        severity: 'severe',
        description: 'Partial airway obstruction due to OSA + sedation',
        expectedResponse: 'Jaw thrust, chin lift, nasal airway adjunct, reduce infusion rate',
        vitalChanges: { spo2: -15, rr: -5 },
      },
    ],
    triggerConditions: [{ type: 'time', parameter: 'elapsedSeconds', threshold: 90, operator: '>=', complicationIndex: 0 }],
    learningObjectives: [
      'Identify and manage airway obstruction in OSA',
      'Apply airway maneuvers appropriately',
      'Reduce sedation depth when airway is compromised',
    ],
    timeLimit: 600,
  },
  {
    id: 'pediatric_dental',
    name: 'Pediatric Dental Sedation',
    description: 'Pediatric patient for dental extraction. Higher weight-based dosing, rapid redistribution, higher agitation risk.',
    procedure: 'Dental Extraction',
    difficulty: 'moderate',
    patient: { age: 8, weight: 28, height: 128, sex: 'M', asa: 1 },
    complications: [
      {
        type: 'paradoxical_agitation',
        triggerTime: 150,
        severity: 'moderate',
        description: 'Paradoxical agitation with midazolam in pediatric patient',
        expectedResponse: 'Avoid additional midazolam. Consider small propofol bolus or ketamine.',
        vitalChanges: { hr: 25, sbp: 20, rr: 6 },
      },
    ],
    triggerConditions: [{ type: 'time', parameter: 'elapsedSeconds', threshold: 150, operator: '>=', complicationIndex: 0 }],
    learningObjectives: [
      'Adjust weight-based dosing for pediatric patients',
      'Recognize paradoxical reaction to benzodiazepines',
      'Manage emergence agitation',
    ],
    timeLimit: 600,
  },
  {
    id: 'paradoxical_agitation',
    name: 'Paradoxical Agitation from Midazolam',
    description: 'Elderly patient becomes increasingly agitated and disinhibited after midazolam administration.',
    procedure: 'Colonoscopy',
    difficulty: 'hard',
    patient: { age: 68, weight: 72, height: 165, sex: 'F', asa: 2 },
    complications: [
      {
        type: 'paradoxical_agitation',
        triggerTime: 90,
        severity: 'moderate',
        description: 'Paradoxical agitation: patient is combative and disinhibited after midazolam',
        expectedResponse: 'Do NOT give more midazolam. Propofol bolus 20-30mg. Consider halting procedure.',
        vitalChanges: { hr: 30, sbp: 25, rr: 8 },
      },
    ],
    triggerConditions: [{ type: 'time', parameter: 'elapsedSeconds', threshold: 90, operator: '>=', complicationIndex: 0 }],
    learningObjectives: [
      'Recognize paradoxical benzodiazepine reaction',
      'Avoid escalating midazolam dose in agitation',
      'Use alternative agent (propofol) to rescue the situation',
    ],
    timeLimit: 600,
  },
  {
    id: 'laryngospasm',
    name: 'Laryngospasm During Deep Sedation',
    description: 'Patient develops laryngospasm at MOASS 1 during upper GI endoscopy. Critical airway emergency.',
    procedure: 'Upper GI Endoscopy',
    difficulty: 'hard',
    patient: { age: 42, weight: 75, height: 175, sex: 'M', asa: 1 },
    complications: [
      {
        type: 'laryngospasm',
        triggerTime: 180,
        severity: 'critical',
        description: 'Laryngospasm: stridor + complete airway obstruction',
        expectedResponse: 'Remove scope. Jaw thrust + CPAP mask. Deepen sedation (propofol 0.5mg/kg). Succinylcholine if refractory.',
        vitalChanges: { spo2: -18, hr: 35, rr: -10 },
      },
    ],
    triggerConditions: [{ type: 'time', parameter: 'elapsedSeconds', threshold: 180, operator: '>=', complicationIndex: 0 }],
    learningObjectives: [
      'Recognize laryngospasm presentation',
      'Apply jaw thrust and positive pressure ventilation',
      'Deepen sedation to break spasm',
      'Know when to use succinylcholine',
    ],
    timeLimit: 600,
  },
  {
    id: 'last_toxicity',
    name: 'Local Anesthetic Systemic Toxicity (LAST)',
    description: 'Patient develops LAST after inadvertent intravascular lidocaine injection. Requires immediate intervention.',
    procedure: 'Nerve Block + Sedation',
    difficulty: 'hard',
    patient: { age: 58, weight: 80, height: 178, sex: 'M', asa: 2 },
    complications: [
      {
        type: 'laryngospasm',
        triggerTime: 60,
        severity: 'critical',
        description: 'LAST: perioral tingling → seizures → cardiovascular collapse',
        expectedResponse: 'STOP LA immediately. Lipid emulsion 20% 1.5mL/kg bolus. BVM, prepare for ACLS. Call for help.',
        vitalChanges: { hr: 40, sbp: -60, rr: -8, spo2: -15 },
      },
    ],
    triggerConditions: [{ type: 'time', parameter: 'elapsedSeconds', threshold: 60, operator: '>=', complicationIndex: 0 }],
    learningObjectives: [
      'Recognize early and late signs of LAST',
      'Apply LAST treatment protocol (lipid rescue)',
      'Manage cardiovascular collapse',
    ],
    timeLimit: 600,
  },
  {
    id: 'propofol_infusion_syndrome',
    name: 'Propofol Infusion Syndrome Warning Signs',
    description: 'Prolonged high-dose propofol infusion. Monitor for PRIS: metabolic acidosis, arrhythmias, renal failure.',
    procedure: 'Prolonged ICU Sedation',
    difficulty: 'expert',
    patient: { age: 50, weight: 85, height: 180, sex: 'M', asa: 4, hepaticImpairment: true },
    complications: [
      {
        type: 'bradycardia',
        triggerTime: 300,
        severity: 'severe',
        description: 'PRIS: new onset bradycardia + lipemia + metabolic acidosis',
        expectedResponse: 'STOP propofol infusion. Switch to alternative sedation (midazolam/dexmedetomidine). Supportive care.',
        vitalChanges: { hr: -35, sbp: -30 },
      },
    ],
    triggerConditions: [{ type: 'time', parameter: 'elapsedSeconds', threshold: 300, operator: '>=', complicationIndex: 0 }],
    learningObjectives: [
      'Recognize risk factors for PRIS (high dose, prolonged use)',
      'Identify early warning signs',
      'Know when to switch sedation agents',
    ],
    timeLimit: 900,
  },
  {
    id: 'multi_drug_emergency',
    name: 'Multi-Drug Interaction Emergency',
    description: 'Elderly frail patient receives combined propofol + midazolam + fentanyl. Severe synergistic respiratory depression.',
    procedure: 'Bronchoscopy',
    difficulty: 'expert',
    patient: { age: 78, weight: 52, height: 158, sex: 'F', asa: 4, copd: true, renalImpairment: true, drugSensitivity: 1.6 },
    complications: [
      {
        type: 'apnea',
        triggerTime: 90,
        severity: 'critical',
        description: 'Apnea from synergistic opioid-hypnotic-benzo respiratory depression',
        expectedResponse: 'Stop all infusions. Bag-mask ventilation. Naloxone 0.4mg if opioid component. Flumazenil if benzo-dominant.',
        vitalChanges: { rr: -12, spo2: -20, etco2: 20 },
      },
    ],
    triggerConditions: [{ type: 'time', parameter: 'elapsedSeconds', threshold: 90, operator: '>=', complicationIndex: 0 }],
    learningObjectives: [
      'Understand opioid-hypnotic-benzo synergy',
      'Recognize and treat apnea',
      'Know reversal agents: naloxone, flumazenil',
    ],
    timeLimit: 600,
  },
  {
    id: 'awareness_under_sedation',
    name: 'Awareness Under Sedation',
    description: 'Patient shows signs of awareness: purposeful movement, tachycardia, hypertension during procedure despite sedation.',
    procedure: 'Colonoscopy',
    difficulty: 'expert',
    patient: { age: 35, weight: 68, height: 172, sex: 'F', asa: 1, drugSensitivity: 0.7 },
    complications: [
      {
        type: 'awareness',
        triggerTime: 120,
        severity: 'moderate',
        description: 'Awareness: patient purposefully moves, tachycardia + hypertension (catecholamine surge)',
        expectedResponse: 'Supplemental propofol bolus. Verify IV patency and drug delivery. Consider analgesic adjunct. Reassure patient post-procedure.',
        vitalChanges: { hr: 25, sbp: 20 },
      },
    ],
    triggerConditions: [{ type: 'time', parameter: 'elapsedSeconds', threshold: 120, operator: '>=', complicationIndex: 0 }],
    learningObjectives: [
      'Identify clinical signs of patient awareness',
      'Respond to inadequate depth of sedation',
      'Understand drug resistance and tolerance',
    ],
    timeLimit: 600,
  },
];

const DIFFICULTY_COLORS: Record<Scenario['difficulty'], string> = {
  easy: 'bg-green-900 text-green-300',
  moderate: 'bg-yellow-900 text-yellow-300',
  hard: 'bg-orange-900 text-orange-300',
  expert: 'bg-red-900 text-red-300',
};

const DIFFICULTY_FILTERS = ['all', 'easy', 'moderate', 'hard', 'expert'] as const;
type DifficultyFilter = (typeof DIFFICULTY_FILTERS)[number];

export const ScenarioPanel: React.FC = () => {
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [showObjectives, setShowObjectives] = useState(false);
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('sedsim_completed_scenarios') || '[]');
    } catch {
      return [];
    }
  });

  const filtered = difficultyFilter === 'all'
    ? PREBUILT_SCENARIOS
    : PREBUILT_SCENARIOS.filter(s => s.difficulty === difficultyFilter);

  const markComplete = (id: string) => {
    const updated = Array.from(new Set([...completedIds, id]));
    setCompletedIds(updated);
    try { localStorage.setItem('sedsim_completed_scenarios', JSON.stringify(updated)); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">Clinical Scenarios</h2>
        <span className="text-xs text-gray-400">{completedIds.length}/{PREBUILT_SCENARIOS.length} completed</span>
      </div>

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
                    <span className="text-white text-xs font-semibold truncate">{scenario.name}</span>
                    {completedIds.includes(scenario.id) && <span className="text-green-400 text-[10px]">✓</span>}
                  </div>
                  <p className="text-gray-400 text-[10px] line-clamp-2">{scenario.description}</p>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${DIFFICULTY_COLORS[scenario.difficulty]}`}>
                  {scenario.difficulty.toUpperCase()}
                </span>
              </div>
              <div className="flex gap-3 mt-2 text-[9px] text-gray-500">
                <span>ASA {scenario.patient.asa}</span>
                <span>{scenario.patient.age}y {scenario.patient.sex}</span>
                <span>{scenario.complications.length} complication{scenario.complications.length !== 1 ? 's' : ''}</span>
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
              <h3 className="text-sm font-bold text-white">{currentScenario.name}</h3>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${DIFFICULTY_COLORS[currentScenario.difficulty]}`}>
                {currentScenario.difficulty.toUpperCase()}
              </span>
            </div>

            <p className="text-xs text-gray-300">{currentScenario.description}</p>

            {/* Patient */}
            <div className="bg-gray-900 rounded p-2 text-xs space-y-1">
              <div className="text-gray-400 font-semibold text-[10px] uppercase tracking-wide">Patient</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <span className="text-gray-400">Age: <span className="text-white">{currentScenario.patient.age}y</span></span>
                <span className="text-gray-400">Weight: <span className="text-white">{currentScenario.patient.weight}kg</span></span>
                <span className="text-gray-400">ASA: <span className="text-white">{currentScenario.patient.asa}</span></span>
                <span className="text-gray-400">Sex: <span className="text-white">{currentScenario.patient.sex}</span></span>
                {currentScenario.patient.copd && <span className="text-orange-400">COPD</span>}
                {currentScenario.patient.osa && <span className="text-orange-400">OSA</span>}
                {currentScenario.patient.hepaticImpairment && <span className="text-orange-400">Hepatic</span>}
                {currentScenario.patient.renalImpairment && <span className="text-orange-400">Renal</span>}
                {(currentScenario.patient.drugSensitivity ?? 1) !== 1 && (
                  <span className="text-yellow-400">Sensitivity ×{currentScenario.patient.drugSensitivity?.toFixed(1)}</span>
                )}
              </div>
            </div>

            {/* Complications timeline */}
            {currentScenario.complications.length > 0 && (
              <div className="space-y-1">
                <div className="text-gray-400 font-semibold text-[10px] uppercase tracking-wide">Complications</div>
                {currentScenario.complications.map((comp: Complication, idx: number) => (
                  <div key={idx} className="bg-gray-900 rounded p-2 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-yellow-400 font-mono">{comp.triggerTime ? `T+${Math.floor(comp.triggerTime / 60)}m${comp.triggerTime % 60}s` : 'Conditional'}</span>
                      <span className={`text-[9px] px-1 py-0.5 rounded ${comp.severity === 'critical' ? 'bg-red-900 text-red-300' : comp.severity === 'severe' ? 'bg-orange-900 text-orange-300' : 'bg-yellow-900 text-yellow-300'}`}>
                        {comp.severity}
                      </span>
                      <span className="text-blue-400 font-semibold">{comp.type.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-gray-400">{comp.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Learning objectives */}
            <button
              onClick={() => setShowObjectives(!showObjectives)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {showObjectives ? '▼' : '▶'} Learning Objectives
            </button>
            {showObjectives && (
              <ul className="list-disc list-inside text-xs text-gray-300 space-y-0.5 pl-1">
                {currentScenario.learningObjectives.map((obj, idx) => (
                  <li key={idx}>{obj}</li>
                ))}
              </ul>
            )}

            {/* Mark complete button */}
            <button
              onClick={() => markComplete(currentScenario.id)}
              disabled={completedIds.includes(currentScenario.id)}
              className={`w-full text-xs py-1.5 rounded transition-colors ${
                completedIds.includes(currentScenario.id)
                  ? 'bg-green-900 text-green-300 cursor-default'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
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
