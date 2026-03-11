/**
 * src/ai/simMasterKnowledge.ts
 * Clinical state transition knowledge base for SimMaster v4.
 *
 * Per-parameter definitions with normal/warning/critical ranges,
 * physiological transition explanations, and multi-parameter clinical
 * patterns used by the active teaching companion.
 */

// ---------------------------------------------------------------------------
// Per-parameter clinical state definitions
// ---------------------------------------------------------------------------

export interface ClinicalStateDefinition {
  parameter: string;
  label: string;
  unit: string;
  normalRange: [number, number];
  warningRange: [number, number];
  criticalRange: [number, number];
  transitionExplanations: {
    normalToWarning: string;
    warningToCritical: string;
    criticalToEmergent: string;
  };
  associatedPanels: string[];
  teachingPoints: string[];
}

export const CLINICAL_STATE_DEFINITIONS: Record<string, ClinicalStateDefinition> = {
  hr: {
    parameter: 'hr',
    label: 'Heart Rate',
    unit: 'bpm',
    normalRange: [60, 100],
    warningRange: [50, 110],
    criticalRange: [30, 150],
    transitionExplanations: {
      normalToWarning: 'Heart rate is moving outside the normal range. Bradycardia may indicate vagal stimulation, dexmedetomidine effect, or deep sedation. Tachycardia suggests sympathetic activation from pain, light sedation, or hypovolemia.',
      warningToCritical: 'Significant rate abnormality. Severe bradycardia (<40 bpm) risks decreased cardiac output and hypotension. Severe tachycardia (>130 bpm) shortens diastolic filling time and may compromise coronary perfusion.',
      criticalToEmergent: 'Heart rate at extremes — risk of hemodynamic collapse. Bradycardia <30 may precede asystole. Tachycardia >150 may indicate a malignant arrhythmia. Immediate intervention required.',
    },
    associatedPanels: ['hr', 'ecg-wave', 'bp'],
    teachingPoints: [
      'Propofol reduces sympathetic tone causing relative bradycardia',
      'Ketamine stimulates sympathetics causing tachycardia',
      'Dexmedetomidine is a potent chronotropic depressant',
      'Heart rate is the primary compensatory mechanism for falling BP',
    ],
  },
  spo2: {
    parameter: 'spo2',
    label: 'SpO2',
    unit: '%',
    normalRange: [95, 100],
    warningRange: [92, 100],
    criticalRange: [80, 100],
    transitionExplanations: {
      normalToWarning: 'SpO2 dipping below 95%. The O2-Hb dissociation curve is still on its plateau — small PaO2 changes cause small SpO2 changes. Early warning: check airway patency and respiratory rate.',
      warningToCritical: 'SpO2 below 92% — approaching the steep part of the O2-Hb curve. Each further drop in PaO2 causes a proportionally larger fall in SpO2. Opioid-induced respiratory depression or airway obstruction likely.',
      criticalToEmergent: 'SpO2 below 80% — severe hypoxemia. Oxygen delivery to vital organs is compromised. Risk of cardiac arrhythmia, end-organ damage. Immediate airway intervention and 100% FiO2 required.',
    },
    associatedPanels: ['spo2', 'pleth-wave', 'capno-wave', 'airway-controls'],
    teachingPoints: [
      'SpO2 lags PaO2 changes by 30-60 seconds (circulation time)',
      'The sigmoid shape of the O2-Hb curve means desaturation accelerates',
      'Supplemental O2 delays but does not prevent hypoventilation',
      'Pulse oximetry is unreliable during severe vasoconstriction or hypothermia',
    ],
  },
  sbp: {
    parameter: 'sbp',
    label: 'Systolic BP',
    unit: 'mmHg',
    normalRange: [90, 140],
    warningRange: [85, 160],
    criticalRange: [60, 200],
    transitionExplanations: {
      normalToWarning: 'Blood pressure trending outside normal limits. Propofol causes dose-dependent vasodilation and myocardial depression. Mild hypotension is common during induction and usually responds to fluid.',
      warningToCritical: 'Significant hypotension (SBP <85) or hypertension (>160). Hypotension may compromise cerebral and coronary perfusion. Consider fluid bolus, dose reduction, or vasopressor support.',
      criticalToEmergent: 'Cardiovascular collapse — SBP <60 or severe hypertensive crisis. End-organ damage imminent. Aggressive intervention with vasopressors, fluids, and stopping all vasodilating agents.',
    },
    associatedPanels: ['bp', 'trend-graph', 'intervention-panel'],
    teachingPoints: [
      'MAP >65 mmHg is the minimum for organ perfusion',
      'Propofol + fentanyl synergy amplifies hypotension',
      'Frank-Starling curve shows preload dependence of stroke volume',
      'Elderly patients have reduced baroreceptor reflexes',
    ],
  },
  rr: {
    parameter: 'rr',
    label: 'Respiratory Rate',
    unit: '/min',
    normalRange: [10, 20],
    warningRange: [8, 24],
    criticalRange: [0, 40],
    transitionExplanations: {
      normalToWarning: 'Respiratory rate changing. Slowing RR is often the earliest sign of opioid-mediated respiratory depression. The brainstem chemoreceptor CO2 response curve is shifting rightward.',
      warningToCritical: 'RR <8 or apnea developing. Severe respiratory depression — opioids and hypnotics synergistically depress the pontine respiratory centers. EtCO2 will be rising. SpO2 will follow.',
      criticalToEmergent: 'Apnea or near-apnea. No spontaneous ventilation — bag-mask ventilation required immediately. Opioid reversal (naloxone) may be indicated if fentanyl is the primary cause.',
    },
    associatedPanels: ['rr', 'capno-wave', 'etco2', 'airway-controls'],
    teachingPoints: [
      'RR is the earliest indicator of opioid respiratory depression',
      'EtCO2 rises before SpO2 falls during hypoventilation',
      'Supplemental O2 masks hypoventilation by maintaining SpO2',
      'Apneic oxygenation can sustain SpO2 for minutes without ventilation',
    ],
  },
  etco2: {
    parameter: 'etco2',
    label: 'EtCO2',
    unit: 'mmHg',
    normalRange: [35, 45],
    warningRange: [30, 50],
    criticalRange: [10, 80],
    transitionExplanations: {
      normalToWarning: 'EtCO2 trending abnormally. Rising EtCO2 (>45) suggests hypoventilation — CO2 retention from depressed respiratory drive. Falling EtCO2 (<30) may indicate hyperventilation or low cardiac output.',
      warningToCritical: 'EtCO2 significantly abnormal. Hypercapnia (>50) causes respiratory acidosis, rightward shift of O2-Hb curve, and cerebral vasodilation. Hypocapnia (<20) may indicate airway disconnection or cardiac arrest.',
      criticalToEmergent: 'Extreme EtCO2 values. Very high EtCO2 (>60) indicates severe ventilatory failure. Very low EtCO2 (<10) in a non-ventilated patient suggests cardiac arrest with no CO2 delivery to lungs.',
    },
    associatedPanels: ['etco2', 'capno-wave', 'rr'],
    teachingPoints: [
      'EtCO2 waveform shape reveals airway obstruction (shark-fin pattern)',
      'Rising EtCO2 is the earliest monitor sign of hypoventilation',
      'PaCO2 is approximately EtCO2 + 5 mmHg in healthy lungs',
      'Sudden EtCO2 drop to zero = disconnection, obstruction, or arrest',
    ],
  },
  moass: {
    parameter: 'moass',
    label: 'MOASS',
    unit: '/5',
    normalRange: [2, 5],
    warningRange: [1, 5],
    criticalRange: [0, 5],
    transitionExplanations: {
      normalToWarning: 'Sedation deepening to MOASS 1 — patient responds only to painful stimulation. Airway reflexes may be compromised. Transition from moderate to deep sedation changes the risk profile significantly.',
      warningToCritical: 'MOASS 0 — no response to stimulation. This is general anesthesia depth. Airway protection is lost, respiratory depression is likely, and hemodynamic instability is common.',
      criticalToEmergent: 'Unresponsive patient with compromised airway and hemodynamics. Burst suppression on EEG. Immediate dose reduction and supportive care required.',
    },
    associatedPanels: ['moass-gauge', 'eeg', 'drug-panel'],
    teachingPoints: [
      'MOASS 2-3 is the target for procedural sedation',
      'MOASS <=1 requires the same monitoring as general anesthesia',
      'BIS correlates with MOASS but they measure different things',
      'Drug synergy can cause rapid MOASS transitions',
    ],
  },
  bis: {
    parameter: 'bis',
    label: 'BIS Index',
    unit: '',
    normalRange: [40, 100],
    warningRange: [30, 100],
    criticalRange: [10, 100],
    transitionExplanations: {
      normalToWarning: 'BIS dropping below 40 — entering deep anesthesia range. EEG transitioning from theta/delta to predominantly delta with possible burst suppression. Propofol Ce likely >3-4 mcg/mL.',
      warningToCritical: 'BIS below 30 — burst suppression territory. Alternating high-amplitude bursts and electrical silence. Excessive CNS depression with risk of hemodynamic instability.',
      criticalToEmergent: 'BIS below 10 — near-isoelectric EEG. Profound cortical suppression. Risk of prolonged emergence and neurological sequelae. Stop all hypnotics immediately.',
    },
    associatedPanels: ['eeg', 'moass-gauge', 'drug-panel'],
    teachingPoints: [
      'BIS 40-60 = general anesthesia; BIS 60-80 = procedural sedation',
      'Propofol produces characteristic frontal alpha oscillations',
      'Burst suppression ratio indicates severity of cortical suppression',
      'Ketamine raises BIS despite clinical sedation — false reassurance',
    ],
  },
};

// ---------------------------------------------------------------------------
// Multi-parameter clinical patterns
// ---------------------------------------------------------------------------

export interface PatternCondition {
  parameter: string;
  operator: 'lt' | 'gt' | 'lte' | 'gte' | 'between' | 'eq';
  value: number;
  value2?: number;
}

export interface ClinicalPattern {
  id: string;
  name: string;
  conditions: PatternCondition[];
  explanation: string;
  expectedLearnerAction: string;
  panelsToHighlight: string[];
  socraticQuestions: string[];
  severity: 'info' | 'warning' | 'critical';
}

export function evaluateCondition(
  condition: PatternCondition,
  values: Record<string, number>
): boolean {
  const v = values[condition.parameter];
  if (v === undefined) return false;
  switch (condition.operator) {
    case 'lt': return v < condition.value;
    case 'gt': return v > condition.value;
    case 'lte': return v <= condition.value;
    case 'gte': return v >= condition.value;
    case 'eq': return v === condition.value;
    case 'between': return v >= condition.value && v <= (condition.value2 ?? condition.value);
    default: return false;
  }
}

export function detectClinicalPatterns(
  values: Record<string, number>
): ClinicalPattern[] {
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  return CLINICAL_PATTERNS
    .filter(p => p.conditions.every(c => evaluateCondition(c, values)))
    .sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));
}

export const CLINICAL_PATTERNS: ClinicalPattern[] = [
  {
    id: 'respiratory_depression_cascade',
    name: 'Respiratory Depression Cascade',
    conditions: [
      { parameter: 'rr', operator: 'lt', value: 10 },
      { parameter: 'etco2', operator: 'gt', value: 45 },
      { parameter: 'spo2', operator: 'lt', value: 94 },
    ],
    explanation:
      'Classic respiratory depression cascade: CNS depression reduces respiratory drive (RR falls), ' +
      'causing CO2 retention (EtCO2 rises), which eventually leads to hypoxemia (SpO2 drops). ' +
      'This sequence is the hallmark of opioid and hypnotic respiratory depression.',
    expectedLearnerAction:
      'Stimulate patient, perform jaw thrust/chin lift, increase FiO2, consider reducing ' +
      'opioid/hypnotic infusion, prepare bag-mask ventilation, consider naloxone if opioid-driven.',
    panelsToHighlight: ['rr', 'etco2', 'spo2', 'capno-wave', 'airway-controls'],
    socraticQuestions: [
      'What is the physiological sequence connecting drug-induced CNS depression to falling SpO2?',
      'Why does EtCO2 rise before SpO2 falls?',
      'Which monitor parameter gives the earliest warning of respiratory depression?',
      'If you give supplemental O2, does that fix the underlying problem? Why or why not?',
    ],
    severity: 'critical',
  },
  {
    id: 'hemodynamic_compromise',
    name: 'Hemodynamic Compromise',
    conditions: [
      { parameter: 'sbp', operator: 'lt', value: 90 },
      { parameter: 'hr', operator: 'gt', value: 90 },
    ],
    explanation:
      'Compensatory tachycardia with hypotension: the baroreceptor reflex is trying to maintain ' +
      'cardiac output by increasing heart rate as blood pressure falls. If HR fails to compensate, ' +
      'decompensation follows with bradycardia and cardiovascular collapse.',
    expectedLearnerAction:
      'Administer IV fluid bolus (250-500 mL crystalloid), reduce or stop vasodilating agents ' +
      '(propofol), consider vasopressor (ephedrine 5-10 mg or phenylephrine 100 mcg).',
    panelsToHighlight: ['bp', 'hr', 'trend-graph', 'intervention-panel'],
    socraticQuestions: [
      'Why is the heart rate rising as blood pressure falls?',
      'Which drugs currently active cause vasodilation?',
      'What does the Frank-Starling curve predict about the response to a fluid bolus?',
      'At what point does compensatory tachycardia fail?',
    ],
    severity: 'warning',
  },
  {
    id: 'hemodynamic_decompensation',
    name: 'Hemodynamic Decompensation',
    conditions: [
      { parameter: 'sbp', operator: 'lt', value: 75 },
      { parameter: 'hr', operator: 'lt', value: 55 },
    ],
    explanation:
      'Decompensated hemodynamic collapse: both blood pressure and heart rate are critically low. ' +
      'The baroreceptor reflex has failed — the heart can no longer compensate for the profound ' +
      'vasodilation. This may represent severe myocardial depression or impending arrest.',
    expectedLearnerAction:
      'Stop all sedative infusions. Epinephrine 10-20 mcg IV bolus, aggressive fluid resuscitation, ' +
      'consider vasopressin. Prepare for CPR if arrest ensues.',
    panelsToHighlight: ['bp', 'hr', 'ecg-wave', 'intervention-panel'],
    socraticQuestions: [
      'Why has the compensatory tachycardia given way to bradycardia?',
      'What is the difference between distributive and cardiogenic shock in this context?',
      'Which drug would you give first — ephedrine or phenylephrine — and why?',
    ],
    severity: 'critical',
  },
  {
    id: 'oversedation_trajectory',
    name: 'Oversedation Trajectory',
    conditions: [
      { parameter: 'moass', operator: 'lte', value: 1 },
      { parameter: 'bis', operator: 'lt', value: 40 },
    ],
    explanation:
      'Deep sedation beyond procedural targets: MOASS <=1 with BIS <40 indicates general ' +
      'anesthesia depth. Airway protective reflexes are abolished, respiratory depression is likely, ' +
      'and hemodynamic instability may follow.',
    expectedLearnerAction:
      'Reduce or stop hypnotic infusion. Ensure airway patency. Consider airway adjunct. ' +
      'Monitor for hemodynamic depression. Target BIS 60-80 for procedural sedation.',
    panelsToHighlight: ['moass-gauge', 'eeg', 'drug-panel'],
    socraticQuestions: [
      'What is the BIS target range for procedural sedation vs general anesthesia?',
      'Why does the risk profile change dramatically below MOASS 2?',
      'What EEG features distinguish moderate from deep sedation?',
      'How would you lighten sedation — stop the infusion or give a reversal agent?',
    ],
    severity: 'warning',
  },
  {
    id: 'drug_synergy_propofol_fentanyl',
    name: 'Propofol-Fentanyl Synergy',
    conditions: [
      { parameter: 'propofol_ce', operator: 'gt', value: 1.5 },
      { parameter: 'fentanyl_ce', operator: 'gt', value: 0.001 },
    ],
    explanation:
      'Propofol and fentanyl are both active — their combined effect is supra-additive ' +
      '(synergistic). Even moderate opioid concentrations dramatically reduce the propofol Ce ' +
      'needed for loss of consciousness, but also amplify respiratory depression and hypotension.',
    expectedLearnerAction:
      'Monitor closely for respiratory depression and hypotension. Expect deeper sedation ' +
      'than individual drug doses would suggest. Consider reducing propofol if MOASS is lower ' +
      'than intended.',
    panelsToHighlight: ['drug-panel', 'moass-gauge', 'rr', 'bp'],
    socraticQuestions: [
      'How do propofol and fentanyl interact pharmacodynamically?',
      'What does "supra-additive" mean in the context of drug interactions?',
      'Why does opioid co-administration reduce the propofol EC50?',
      'Which adverse effect of this combination is most dangerous?',
    ],
    severity: 'info',
  },
  {
    id: 'airway_obstruction_sequence',
    name: 'Airway Obstruction Sequence',
    conditions: [
      { parameter: 'rr', operator: 'lt', value: 8 },
      { parameter: 'spo2', operator: 'lt', value: 92 },
      { parameter: 'moass', operator: 'lte', value: 1 },
    ],
    explanation:
      'Deep sedation with respiratory compromise suggests airway obstruction. As MOASS drops, ' +
      'pharyngeal muscle tone is lost, the tongue falls back, and soft tissues collapse. ' +
      'Sequence: snoring, partial obstruction, complete obstruction, desaturation.',
    expectedLearnerAction:
      'Perform head-tilt/chin-lift or jaw thrust. Insert oral or nasal airway. ' +
      'If obstruction persists, consider LMA or endotracheal intubation. Increase FiO2. ' +
      'Reduce sedation depth.',
    panelsToHighlight: ['airway-controls', 'spo2', 'rr', 'moass-gauge'],
    socraticQuestions: [
      'What anatomical changes cause airway obstruction during deep sedation?',
      'What non-pharmacological maneuvers can relieve upper airway obstruction?',
      'At what point would you escalate from a simple airway maneuver to a definitive airway?',
      'How does the capnography waveform change with partial vs complete obstruction?',
    ],
    severity: 'critical',
  },
  {
    id: 'paradoxical_reaction',
    name: 'Paradoxical Reaction',
    conditions: [
      { parameter: 'moass', operator: 'gte', value: 4 },
      { parameter: 'hr', operator: 'gt', value: 100 },
      { parameter: 'midazolam_ce', operator: 'gt', value: 0.02 },
    ],
    explanation:
      'Patient showing agitation and tachycardia despite active benzodiazepine levels. ' +
      'This is a paradoxical reaction — midazolam is causing disinhibition and combativeness ' +
      'instead of sedation. More common in elderly patients and children.',
    expectedLearnerAction:
      'Do NOT give more midazolam. Consider flumazenil (0.2 mg IV) for reversal. ' +
      'Switch to a different sedative class (propofol, dexmedetomidine). Ensure patient safety.',
    panelsToHighlight: ['drug-panel', 'moass-gauge', 'hr'],
    socraticQuestions: [
      'What is a paradoxical reaction to benzodiazepines?',
      'Which patient populations are most susceptible?',
      'Why would giving more midazolam worsen this situation?',
      'What reversal agent is available, and what are the risks of using it?',
    ],
    severity: 'warning',
  },
  {
    id: 'malignant_hyperthermia',
    name: 'Malignant Hyperthermia',
    conditions: [
      { parameter: 'hr', operator: 'gt', value: 120 },
      { parameter: 'etco2', operator: 'gt', value: 60 },
      { parameter: 'rr', operator: 'gt', value: 24 },
    ],
    explanation:
      'Tachycardia with rising EtCO2 and tachypnea suggests a hypermetabolic state. ' +
      'The combination of unexplained tachycardia, rapidly rising EtCO2, and metabolic acidosis ' +
      'should trigger consideration of malignant hyperthermia.',
    expectedLearnerAction:
      'Stop all triggering agents. Administer dantrolene 2.5 mg/kg IV. Cool the patient. ' +
      'Treat hyperkalemia. Monitor for rhabdomyolysis. Call for help.',
    panelsToHighlight: ['hr', 'etco2', 'trend-graph'],
    socraticQuestions: [
      'What are the classic early signs of malignant hyperthermia?',
      'Why does EtCO2 rise so rapidly in a hypermetabolic state?',
      'What is the mechanism of action of dantrolene?',
      'Which anesthetic agents are safe to use in MH-susceptible patients?',
    ],
    severity: 'critical',
  },
];

// ---------------------------------------------------------------------------
// Data-region panel lookup (maps panel names to DOM selectors)
// ---------------------------------------------------------------------------

export const PANEL_REGION_MAP: Record<string, string> = {
  hr: '[data-region="hr"]',
  spo2: '[data-region="spo2"]',
  bp: '[data-region="bp"]',
  rr: '[data-region="rr"]',
  etco2: '[data-region="etco2"]',
  'ecg-wave': '[data-region="ecg"]',
  'pleth-wave': '[data-region="pleth"]',
  'capno-wave': '[data-region="co2"]',
  'drug-panel': '[data-region="drugs"]',
  'moass-gauge': '[data-region="moass"]',
  radar: '[data-region="radar"]',
  eeg: '[data-region="eeg"]',
  eventlog: '[data-region="eventlog"]',
  'trend-graph': '[data-region="trend-graph"]',
  'intervention-panel': '[data-region="intervention-panel"]',
  'airway-controls': '[data-region="airway"]',
};

// ---------------------------------------------------------------------------
// Helper: Get transition explanation for a parameter
// ---------------------------------------------------------------------------

export function getTransitionExplanation(
  param: string,
  from: 'normal' | 'warning' | 'critical',
  to: 'warning' | 'critical' | 'emergent'
): string | undefined {
  const def = CLINICAL_STATE_DEFINITIONS[param];
  if (!def) return undefined;
  if (from === 'normal' && to === 'warning') return def.transitionExplanations.normalToWarning;
  if (from === 'warning' && to === 'critical') return def.transitionExplanations.warningToCritical;
  if (from === 'critical' && to === 'emergent') return def.transitionExplanations.criticalToEmergent;
  return undefined;
}

// ---------------------------------------------------------------------------
// Helper: Match clinical patterns (partial match with ranking)
// ---------------------------------------------------------------------------

export interface PatternMatchResult {
  pattern: ClinicalPattern;
  matchedConditions: PatternCondition[];
  matchPercentage: number;
}

export function matchClinicalPatterns(
  params: Record<string, number>
): PatternMatchResult[] {
  const results: PatternMatchResult[] = [];
  for (const pattern of CLINICAL_PATTERNS) {
    const matched: PatternCondition[] = [];
    for (const cond of pattern.conditions) {
      if (evaluateCondition(cond, params)) matched.push(cond);
    }
    if (matched.length > 0) {
      results.push({
        pattern,
        matchedConditions: matched,
        matchPercentage: matched.length / pattern.conditions.length,
      });
    }
  }
  return results.sort((a, b) => b.matchPercentage - a.matchPercentage);
}
