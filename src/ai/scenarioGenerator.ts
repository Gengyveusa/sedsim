// src/ai/scenarioGenerator.ts
// Generative AI Scenario Creator + Multi-Agent Team/CRM Layer
// Auto-generates unlimited adaptive scenarios from the digital twin

import { Patient } from '../types';

export interface Scenario {
  id: string;
  name: string;
  description: string;
  procedure: string;
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert';
  patient: Partial<Patient>;
  complications: Complication[];
  triggerConditions: TriggerCondition[];
  learningObjectives: string[];
  timeLimit?: number; // seconds
  // AI-generated teaching content
  teachingPoints?: string[];
  clinicalReasoning?: string;
}

export interface Complication {
  type: string;
  triggerTime?: number;     // seconds after start, or undefined for condition-based
  severity: 'mild' | 'moderate' | 'severe' | 'critical';
  description: string;
  expectedResponse: string;
  vitalChanges?: Partial<{
    hr: number;
    sbp: number;
    dbp: number;
    spo2: number;
    rr: number;
    etco2: number;
  }>;
}

export interface TriggerCondition {
  type: 'time' | 'drug_dose' | 'vital_threshold' | 'moass_level';
  parameter: string;
  threshold: number;
  operator: '>' | '<' | '==' | '>=' | '<=';
  complicationIndex: number; // Index into complications array
}

export interface AgentMessage {
  agent: 'patient' | 'nurse' | 'surgeon' | 'anesthesiologist';
  message: string;
  timestamp: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface Session {
  id: string;
  scenarioId: string;
  startTime: number;
  endTime?: number;
  score?: number;
  events: string[];
  agentMessages: AgentMessage[];
}

// Complication templates
const COMPLICATION_TEMPLATES: Complication[] = [
  {
    type: 'laryngospasm',
    severity: 'critical',
    description: 'Patient develops laryngospasm during light sedation',
    expectedResponse: 'Apply jaw thrust, positive pressure ventilation, deepen sedation. Succinylcholine if refractory.',
    vitalChanges: { spo2: -15, hr: 30, rr: -8 },
  },
  {
    type: 'hypotension',
    severity: 'moderate',
    description: 'Significant drop in blood pressure following propofol bolus',
    expectedResponse: 'Fluid bolus, reduce infusion rate, consider vasopressor',
    vitalChanges: { sbp: -40, dbp: -25, hr: 15 },
  },
  {
    type: 'desaturation',
    severity: 'severe',
    description: 'Progressive oxygen desaturation despite supplemental O2',
    expectedResponse: 'Increase FiO2, airway maneuvers, consider BVM, pause procedure',
    vitalChanges: { spo2: -12, rr: -4 },
  },
  {
    type: 'paradoxical_agitation',
    severity: 'moderate',
    description: 'Patient becomes agitated despite sedation (common with midazolam)',
    expectedResponse: 'Avoid additional midazolam. Consider propofol bolus or ketamine.',
    vitalChanges: { hr: 25, sbp: 20, rr: 6 },
  },
  {
    type: 'awareness',
    severity: 'mild',
    description: 'Patient shows signs of awareness - purposeful movement during procedure',
    expectedResponse: 'Assess sedation depth, administer supplemental bolus, verify drug delivery',
    vitalChanges: { hr: 20, sbp: 15 },
  },
  {
    type: 'bradycardia',
    severity: 'severe',
    description: 'Symptomatic bradycardia developing gradually',
    expectedResponse: 'Reduce or stop dexmedetomidine/opioids, atropine if HR < 40',
    vitalChanges: { hr: -35, sbp: -20 },
  },
  {
    type: 'apnea',
    severity: 'critical',
    description: 'Patient develops apnea following rapid drug administration',
    expectedResponse: 'Bag-mask ventilation, airway adjuncts, reduce drug infusion',
    vitalChanges: { rr: -12, spo2: -20, etco2: 15 },
  },
  {
    type: 'emergence_delirium',
    severity: 'moderate',
    description: 'Post-procedure emergence delirium with disorientation',
    expectedResponse: 'Reassurance, low-dose propofol, avoid restraints, safe environment',
    vitalChanges: { hr: 30, sbp: 25, rr: 8 },
  },
];

// Procedure types
const PROCEDURES = [
  'Upper GI Endoscopy',
  'Colonoscopy',
  'Bronchoscopy',
  'Dental Extraction (Complex)',
  'Cardioversion',
  'Fracture Reduction',
  'Wound Debridement',
  'Lumbar Puncture',
  'Bone Marrow Biopsy',
  'MRI (Pediatric)',
];

// Generate a random scenario
export const generateScenario = (
  difficulty: Scenario['difficulty'] = 'moderate',
  specificProcedure?: string
): Scenario => {
  const procedure = specificProcedure || PROCEDURES[Math.floor(Math.random() * PROCEDURES.length)];

  // Adjust patient and complications based on difficulty
  const numComplications = difficulty === 'easy' ? 1 :
    difficulty === 'moderate' ? 2 : difficulty === 'hard' ? 3 : 4;

  // Shuffle and pick complications
  const shuffled = [...COMPLICATION_TEMPLATES].sort(() => Math.random() - 0.5);
  const complications = shuffled.slice(0, numComplications);

  // Assign trigger times
  complications.forEach((c, i) => {
    c.triggerTime = 60 + (i * 90) + Math.floor(Math.random() * 60); // Stagger triggers
  });

  // Generate patient profile based on difficulty
  const patient = generatePatientForDifficulty(difficulty);

  const objectives = [
    'Achieve and maintain appropriate sedation depth (MOASS 2-3)',
    'Monitor and respond to vital sign changes',
    ...complications.map(c => `Manage ${c.type.replace('_', ' ')} appropriately`),
  ];

  // Generate contextual teaching points based on patient and complications
  const teachingPoints = generateTeachingPoints(patient, complications, difficulty);
  const clinicalReasoning = generateClinicalReasoning(patient, procedure, difficulty);

  return {
    id: `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: `${procedure} - ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`,
    description: `Perform procedural sedation for ${procedure} with ${numComplications} potential complication(s).`,
    procedure,
    difficulty,
    patient,
    complications,
    triggerConditions: complications.map((_, i) => ({
      type: 'time' as const,
      parameter: 'elapsedSeconds',
      threshold: complications[i].triggerTime || 120,
      operator: '>=' as const,
      complicationIndex: i,
    })),
    learningObjectives: objectives,
    timeLimit: difficulty === 'easy' ? 300 : difficulty === 'moderate' ? 600 : 900,
    teachingPoints,
    clinicalReasoning,
  };
};

// Generate appropriate patient based on difficulty
const generatePatientForDifficulty = (difficulty: Scenario['difficulty']): Partial<Patient> => {
  switch (difficulty) {
    case 'easy':
      return {
        age: 35 + Math.floor(Math.random() * 15),
        weight: 65 + Math.floor(Math.random() * 20),
        height: 165 + Math.floor(Math.random() * 20),
        sex: Math.random() > 0.5 ? 'M' : 'F',
        asa: 1,
      };
    case 'moderate':
      return {
        age: 50 + Math.floor(Math.random() * 20),
        weight: 75 + Math.floor(Math.random() * 30),
        height: 160 + Math.floor(Math.random() * 25),
        sex: Math.random() > 0.5 ? 'M' : 'F',
        asa: 2,
        osa: Math.random() > 0.7,
      };
    case 'hard':
      return {
        age: 65 + Math.floor(Math.random() * 20),
        weight: 90 + Math.floor(Math.random() * 40),
        height: 155 + Math.floor(Math.random() * 25),
        sex: Math.random() > 0.5 ? 'M' : 'F',
        asa: 3,
        osa: true,
        copd: Math.random() > 0.5,
        hepaticImpairment: Math.random() > 0.6,
      };
    case 'expert':
      return {
        age: 75 + Math.floor(Math.random() * 15),
        weight: 45 + Math.floor(Math.random() * 20),
        height: 150 + Math.floor(Math.random() * 20),
        sex: Math.random() > 0.5 ? 'M' : 'F',
        asa: 4,
        osa: true,
        copd: true,
        hepaticImpairment: true,
        renalImpairment: Math.random() > 0.5,
        mallampati: 3,
        drugSensitivity: 1.4 + Math.random() * 0.4,
      };
  }
};

// Generate patient-specific teaching points based on demographics and complications
const generateTeachingPoints = (
  patient: Partial<Patient>,
  complications: Complication[],
  difficulty: Scenario['difficulty']
): string[] => {
  const points: string[] = [];

  if (patient.age && patient.age > 65) {
    points.push(`Elderly patient (${patient.age}yo): reduce propofol dose by 30-50%. Schnider model predicts lower V1 and slower clearance in older patients.`);
  }
  if (patient.osa) {
    points.push('OSA: elevated sensitivity to opioids and hypnotics. Expect faster SpO2 desaturation and increased airway obstruction risk.');
  }
  if (patient.hepaticImpairment) {
    points.push('Hepatic impairment: reduced propofol and midazolam clearance. Expect prolonged effect. Reduce infusion rates accordingly.');
  }
  if (patient.drugSensitivity && patient.drugSensitivity > 1.2) {
    points.push(`High drug sensitivity (${patient.drugSensitivity.toFixed(1)}x): EC50 effectively reduced. Start with 60% of standard doses.`);
  }
  if (patient.mallampati && patient.mallampati >= 3) {
    points.push(`Mallampati ${patient.mallampati}: difficult airway predicted. Prepare oral/nasal airway and bag-mask ventilation before starting sedation.`);
  }

  // Complication-specific points
  complications.forEach(c => {
    if (c.type === 'hypotension') {
      points.push('Propofol causes vasodilation and reduced SVR. Anticipate BP drop 60-90s after bolus. Have fluid bolus ready.');
    }
    if (c.type === 'laryngospasm') {
      points.push('Laryngospasm: partial (stridor) → jaw thrust + CPAP. Complete (silent) → deepen with propofol or succinylcholine 0.5mg/kg IV.');
    }
    if (c.type === 'apnea') {
      points.push('Drug-induced apnea: stop infusion, apply bag-mask, consider naloxone for opioid-related apnea. Keep Ce in mind — effect outlasts plasma.');
    }
  });

  if (difficulty === 'expert') {
    points.push('Expert level: use Bouillon interaction surface model to account for opioid-hypnotic synergy. Fentanyl shifts propofol EC50 leftward by up to 50%.');
  }

  return points;
};

// Generate narrative clinical reasoning for the scenario
const generateClinicalReasoning = (
  patient: Partial<Patient>,
  procedure: string,
  difficulty: Scenario['difficulty']
): string => {
  const age = patient.age ?? 50;
  const weight = patient.weight ?? 75;
  const comorbidities: string[] = [];
  if (patient.osa) comorbidities.push('OSA');
  if (patient.copd) comorbidities.push('COPD');
  if (patient.hepaticImpairment) comorbidities.push('hepatic impairment');

  let reasoning = `This ${age}-year-old, ${weight}kg patient requires procedural sedation for ${procedure}.`;

  if (comorbidities.length) {
    reasoning += ` Comorbidities (${comorbidities.join(', ')}) increase pharmacodynamic sensitivity and airway risk.`;
  }

  if (age > 65) {
    reasoning += ' Apply Schnider model adjustments: reduced V1, higher Ce at equivalent doses. Target MOASS 2-3 with careful titration.';
  } else {
    reasoning += ' Standard Marsh model parameters apply. Titrate to MOASS 2-3 for optimal procedural conditions.';
  }

  if (difficulty === 'hard' || difficulty === 'expert') {
    reasoning += ' Multiple complications may occur sequentially — prioritise airway and haemodynamic stability. Consider pre-emptive interventions based on risk profile.';
  }

  return reasoning;
};

// Multi-Agent message generation based on simulation state
export const generateAgentMessages = (
  elapsedSeconds: number,
  moass: number,
  vitals: { hr: number; spo2: number; sbp: number; rr: number },
  activeComplication?: string
): AgentMessage[] => {
  const messages: AgentMessage[] = [];
  const now = Date.now();

  // Patient agent - verbal responses based on sedation level
  if (moass >= 4) {
    messages.push({
      agent: 'patient',
      message: Math.random() > 0.5 ? '"I can feel that..."' : '"Am I supposed to be awake?"',
      timestamp: now,
      urgency: 'medium',
    });
  } else if (moass === 3) {
    if (Math.random() > 0.7) {
      messages.push({
        agent: 'patient',
        message: '*moans softly*',
        timestamp: now,
        urgency: 'low',
      });
    }
  }

  // Nurse agent
  if (vitals.spo2 < 92) {
    messages.push({
      agent: 'nurse',
      message: `SpO2 is ${vitals.spo2}% - should I get the crash cart?`,
      timestamp: now,
      urgency: 'high',
    });
  }
  if (vitals.hr < 45) {
    messages.push({
      agent: 'nurse',
      message: `Heart rate is ${vitals.hr} - do you want me to draw up atropine?`,
      timestamp: now,
      urgency: 'high',
    });
  }
  if (elapsedSeconds > 0 && elapsedSeconds % 120 < 2) {
    messages.push({
      agent: 'nurse',
      message: 'Vitals are documented. Any changes to the sedation plan?',
      timestamp: now,
      urgency: 'low',
    });
  }

  // Surgeon agent
  if (moass >= 4 && activeComplication !== 'awareness') {
    messages.push({
      agent: 'surgeon',
      message: 'Patient is moving - I need them to be still. Can you deepen?',
      timestamp: now,
      urgency: 'medium',
    });
  }
  if (activeComplication === 'laryngospasm') {
    messages.push({
      agent: 'surgeon',
      message: 'I\'m stopping the procedure. Let me know when the airway is secure.',
      timestamp: now,
      urgency: 'critical',
    });
  }

  return messages;
};

export default { generateScenario, generateAgentMessages };
