import { useState } from 'react';

interface Scenario {
  id: string;
  title: string;
  description: string;
  patient: {
    weight: number;
    age: number;
    sex: 'M' | 'F';
    asa: 1 | 2 | 3 | 4;
  };
  steps: {
    instruction: string;
    drug: string;
    dose: number;
    expectedOutcome: string;
  }[];
  learningPoints: string[];
}

const CLINICAL_SCENARIOS: Scenario[] = [
  {
    id: 'routine-extraction',
    title: 'Routine Extraction',
    description: 'A healthy adult patient scheduled for a routine wisdom tooth extraction.',
    patient: { weight: 70, age: 28, sex: 'M', asa: 1 },
    steps: [
      {
        instruction: 'Administer initial midazolam dose for anxiolysis',
        drug: 'midazolam',
        dose: 2,
        expectedOutcome: 'Patient should reach mild sedation (RSS 3-4) within 5 minutes'
      },
      {
        instruction: 'Administer fentanyl for analgesia before local anesthetic',
        drug: 'fentanyl',
        dose: 50,
        expectedOutcome: 'Provides analgesia without deep sedation'
      },
      {
        instruction: 'Titrate additional midazolam if needed for procedure comfort',
        drug: 'midazolam',
        dose: 1,
        expectedOutcome: 'Maintain RSS 4-5 throughout procedure'
      }
    ],
    learningPoints: [
      'Benzodiazepines provide anxiolysis and amnesia',
      'Opioids provide analgesia but not sedation',
      'Titrate slowly - wait for peak effect before re-dosing',
      'Monitor respiratory rate and SpO2 continuously'
    ]
  },
  {
    id: 'anxious-patient',
    title: 'Highly Anxious Patient',
    description: 'A 45-year-old patient with severe dental anxiety and previous panic attacks.',
    patient: { weight: 65, age: 45, sex: 'F', asa: 2 },
    steps: [
      {
        instruction: 'Start with low-dose midazolam and assess response',
        drug: 'midazolam',
        dose: 1.5,
        expectedOutcome: 'Gradual onset of anxiolysis over 3-5 minutes'
      },
      {
        instruction: 'Add fentanyl for procedure comfort',
        drug: 'fentanyl',
        dose: 25,
        expectedOutcome: 'Analgesia without respiratory depression'
      },
      {
        instruction: 'Carefully titrate additional midazolam if needed',
        drug: 'midazolam',
        dose: 1,
        expectedOutcome: 'Achieve RSS 4-5 with stable vital signs'
      }
    ],
    learningPoints: [
      'Anxious patients may need higher benzodiazepine doses',
      'Start low and go slow - avoid oversedation',
      'Paradoxical reactions can occur with benzodiazepines',
      'Have flumazenil available for reversal if needed'
    ]
  },
  {
    id: 'multiple-extractions',
    title: 'Multiple Extractions',
    description: 'A 22-year-old requiring removal of 4 impacted wisdom teeth.',
    patient: { weight: 80, age: 22, sex: 'M', asa: 1 },
    steps: [
      {
        instruction: 'Induce with midazolam for baseline sedation',
        drug: 'midazolam',
        dose: 3,
        expectedOutcome: 'RSS 4 within 5 minutes'
      },
      {
        instruction: 'Add fentanyl before starting surgical procedure',
        drug: 'fentanyl',
        dose: 75,
        expectedOutcome: 'Adequate analgesia for surgical manipulation'
      },
      {
        instruction: 'Consider propofol for deeper sedation during difficult extractions',
        drug: 'propofol',
        dose: 40,
        expectedOutcome: 'Brief deep sedation (RSS 5-6) for surgical peaks'
      }
    ],
    learningPoints: [
      'Longer procedures may require combination techniques',
      'Propofol provides rapid, titratable deep sedation',
      'Monitor for respiratory depression with multiple agents',
      'Have appropriate reversal agents and airway equipment ready'
    ]
  }
];

interface TutorialModeProps {
  onClose: () => void;
  onSelectScenario: (scenario: Scenario) => void;
}

export function TutorialMode({ onClose, onSelectScenario }: TutorialModeProps) {
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  if (selectedScenario) {
    const step = selectedScenario.steps[currentStep];
    const isLastStep = currentStep === selectedScenario.steps.length - 1;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{selectedScenario.title}</h2>
              <p className="text-sm text-gray-600">Step {currentStep + 1} of {selectedScenario.steps.length}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 text-xl">
              X
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Current Task</h3>
              <p className="text-blue-800">{step.instruction}</p>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Recommended Action</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <p><span className="font-medium">Drug:</span> {step.drug.charAt(0).toUpperCase() + step.drug.slice(1)}</p>
                  <p><span className="font-medium">Dose:</span> {step.dose} {step.drug === 'fentanyl' ? 'mcg' : 'mg'}</p>
                  <p><span className="font-medium">Expected Outcome:</span> {step.expectedOutcome}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h4 className="font-semibold text-gray-900 mb-3">Learning Points</h4>
              <ul className="space-y-2">
                {selectedScenario.learningPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-blue-600 mt-0.5">*</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              {currentStep > 0 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  Previous Step
                </button>
              )}
              <button
                onClick={() => {
                  if (isLastStep) {
                    onSelectScenario(selectedScenario);
                  } else {
                    setCurrentStep(currentStep + 1);
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                {isLastStep ? 'Start Simulation' : 'Next Step'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">Clinical Scenarios</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 text-xl">
            X
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-600 mb-6">
            Practice your sedation skills with guided clinical scenarios. Each scenario walks you through
            a realistic patient case with step-by-step instructions and learning points.
          </p>

          <div className="grid gap-4">
            {CLINICAL_SCENARIOS.map((scenario) => (
              <div
                key={scenario.id}
                className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedScenario(scenario)}
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{scenario.title}</h3>
                <p className="text-gray-600 mb-4">{scenario.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span>Age {scenario.patient.age}, {scenario.patient.sex}</span>
                    <span>{scenario.patient.weight}kg</span>
                    <span>ASA {scenario.patient.asa}</span>
                  </div>
                  <span className="text-blue-600 font-medium">Start Scenario &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
