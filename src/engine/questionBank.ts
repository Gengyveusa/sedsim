/**
 * src/engine/questionBank.ts
 * Validated sedation question bank for pre/post testing.
 * Pure engine file — NO React imports.
 *
 * 18 questions across 3 difficulty tiers (6 each), covering:
 *   Basic: airway anatomy, O2-Hb dissociation, ASA classification
 *   Intermediate: drug interactions, PK/PD, reversal agents
 *   Advanced: crisis management, patient sensitivity, BIS interpretation
 *
 * Questions are grouped into 3 balanced sets of 5 for the 3-arm rotation,
 * each set containing a mix of difficulties.
 */

export type QuestionDifficulty = 'basic' | 'intermediate' | 'advanced';

export type QuestionTopic =
  | 'airway_anatomy'
  | 'oxygen_hemoglobin'
  | 'asa_classification'
  | 'drug_interactions'
  | 'pk_pd'
  | 'reversal_agents'
  | 'crisis_management'
  | 'patient_sensitivity'
  | 'bis_interpretation';

export interface StudyQuestion {
  id: string;
  stem: string;
  options: string[];
  correctIndex: number;
  difficulty: QuestionDifficulty;
  topic: QuestionTopic;
  explanation: string;
}

// ─── Question Bank ───────────────────────────────────────────────────────────

export const QUESTION_BANK: StudyQuestion[] = [
  // ── BASIC (6) ──────────────────────────────────────────────────────────────

  {
    id: 'B1',
    stem: 'Which anatomical structure is the most common site of upper airway obstruction during procedural sedation?',
    options: [
      'Epiglottis',
      'Tongue/soft palate',
      'Vocal cords',
      'Tracheal rings',
    ],
    correctIndex: 1,
    difficulty: 'basic',
    topic: 'airway_anatomy',
    explanation:
      'During sedation, loss of pharyngeal muscle tone causes the tongue and soft palate to fall posteriorly against the posterior pharyngeal wall, making it the most frequent cause of upper airway obstruction.',
  },
  {
    id: 'B2',
    stem: 'A pulse oximeter reads 90%. Approximately what is the corresponding PaO2 on the oxygen-hemoglobin dissociation curve?',
    options: [
      '40 mmHg',
      '60 mmHg',
      '80 mmHg',
      '100 mmHg',
    ],
    correctIndex: 1,
    difficulty: 'basic',
    topic: 'oxygen_hemoglobin',
    explanation:
      'SpO2 of 90% corresponds to a PaO2 of approximately 60 mmHg on the O2-Hb dissociation curve. This is the "cliff" point — below this, small drops in PaO2 cause large falls in saturation.',
  },
  {
    id: 'B3',
    stem: 'An ASA Physical Status III patient is best described as:',
    options: [
      'A normal healthy patient',
      'A patient with mild systemic disease',
      'A patient with severe systemic disease',
      'A moribund patient not expected to survive without the operation',
    ],
    correctIndex: 2,
    difficulty: 'basic',
    topic: 'asa_classification',
    explanation:
      'ASA III denotes a patient with severe systemic disease that limits activity but is not incapacitating (e.g., poorly controlled DM, morbid obesity, active hepatitis, moderate-severe COPD).',
  },
  {
    id: 'B4',
    stem: 'Which airway maneuver is the first-line intervention for relieving soft-tissue obstruction during sedation?',
    options: [
      'Emergency cricothyroidotomy',
      'Jaw thrust / chin lift',
      'Endotracheal intubation',
      'Nasopharyngeal airway insertion',
    ],
    correctIndex: 1,
    difficulty: 'basic',
    topic: 'airway_anatomy',
    explanation:
      'Jaw thrust (with or without chin lift) displaces the mandible anteriorly, pulling the tongue forward and relieving the most common cause of obstruction. It is non-invasive and should be attempted before any device.',
  },
  {
    id: 'B5',
    stem: 'What is the primary effect of supplemental oxygen delivered via nasal cannula at 4 L/min?',
    options: [
      'FiO2 of approximately 36%',
      'FiO2 of approximately 60%',
      'FiO2 of approximately 80%',
      'FiO2 of approximately 100%',
    ],
    correctIndex: 0,
    difficulty: 'basic',
    topic: 'oxygen_hemoglobin',
    explanation:
      'Each litre/min of nasal cannula flow adds roughly 3-4% to the FiO2 above the 21% baseline. At 4 L/min: 21% + (4 × 4%) ≈ 37%, closest to 36%.',
  },
  {
    id: 'B6',
    stem: 'Which of the following ASA classifications would most appropriately describe a healthy 30-year-old presenting for elective colonoscopy?',
    options: [
      'ASA I',
      'ASA II',
      'ASA III',
      'ASA IV',
    ],
    correctIndex: 0,
    difficulty: 'basic',
    topic: 'asa_classification',
    explanation:
      'A healthy 30-year-old with no comorbidities is ASA I — a normal healthy patient. ASA II would apply if there were mild systemic disease (e.g., well-controlled asthma, social drinking).',
  },

  // ── INTERMEDIATE (6) ──────────────────────────────────────────────────────

  {
    id: 'I1',
    stem: 'When propofol and fentanyl are co-administered, their combined effect on respiratory depression is best described as:',
    options: [
      'Additive',
      'Synergistic (supra-additive)',
      'Antagonistic',
      'Independent / no interaction',
    ],
    correctIndex: 1,
    difficulty: 'intermediate',
    topic: 'drug_interactions',
    explanation:
      'The Bouillon response-surface model demonstrates that propofol-opioid combinations produce supra-additive (synergistic) respiratory depression. The combined effect is greater than the sum of individual effects, requiring dose reductions of both agents.',
  },
  {
    id: 'I2',
    stem: 'The effect-site equilibration rate constant (ke0) determines:',
    options: [
      'The rate of drug elimination from the body',
      'The speed at which the drug reaches its peak clinical effect',
      'The volume of distribution of the central compartment',
      'The drug\'s protein binding fraction',
    ],
    correctIndex: 1,
    difficulty: 'intermediate',
    topic: 'pk_pd',
    explanation:
      'ke0 governs the transfer rate between the plasma (central) compartment and the effect site. A higher ke0 means faster equilibration — the drug reaches peak clinical effect sooner after a bolus, which is critical for titration timing.',
  },
  {
    id: 'I3',
    stem: 'A patient receiving midazolam for sedation becomes unresponsive with MOASS 0. The most appropriate reversal agent and initial dose is:',
    options: [
      'Naloxone 0.4 mg IV',
      'Flumazenil 0.2 mg IV',
      'Sugammadex 200 mg IV',
      'Atropine 0.5 mg IV',
    ],
    correctIndex: 1,
    difficulty: 'intermediate',
    topic: 'reversal_agents',
    explanation:
      'Flumazenil is the specific competitive antagonist at GABA-A benzodiazepine receptors. The initial dose is 0.2 mg IV over 15 seconds, which can be repeated at 1-minute intervals to a maximum of 1 mg. Naloxone reverses opioids, not benzodiazepines.',
  },
  {
    id: 'I4',
    stem: 'Which pharmacokinetic parameter is most affected by obesity, leading to prolonged sedation with propofol?',
    options: [
      'ke0 (effect-site equilibration)',
      'Volume of distribution (Vd)',
      'Hill coefficient (gamma)',
      'EC50',
    ],
    correctIndex: 1,
    difficulty: 'intermediate',
    topic: 'pk_pd',
    explanation:
      'Propofol is highly lipophilic. In obese patients, the volume of distribution increases substantially because adipose tissue acts as a large peripheral compartment. This leads to drug accumulation and prolonged effect after repeated doses or infusions.',
  },
  {
    id: 'I5',
    stem: 'What is the duration of action concern when using flumazenil to reverse midazolam sedation?',
    options: [
      'Flumazenil lasts longer than midazolam, causing prolonged antagonism',
      'Flumazenil has a shorter half-life than midazolam, risking re-sedation',
      'Flumazenil permanently inactivates benzodiazepine receptors',
      'There is no duration concern — effects are matched',
    ],
    correctIndex: 1,
    difficulty: 'intermediate',
    topic: 'reversal_agents',
    explanation:
      'Flumazenil has a half-life of 40-80 minutes, while midazolam has an elimination half-life of 1.5-2.5 hours. As flumazenil wears off, midazolam still present can re-bind to receptors, causing re-sedation. Patients must be monitored for at least 2 hours.',
  },
  {
    id: 'I6',
    stem: 'Concurrent administration of ketamine with propofol ("ketofol") is used clinically because:',
    options: [
      'Ketamine potentiates propofol\'s respiratory depression',
      'Their hemodynamic effects partially offset each other',
      'Both drugs share the same receptor mechanism',
      'Ketamine eliminates the need for monitoring',
    ],
    correctIndex: 1,
    difficulty: 'intermediate',
    topic: 'drug_interactions',
    explanation:
      'Propofol causes vasodilation and myocardial depression (hypotension), while ketamine is a sympathomimetic that increases heart rate and blood pressure. Combined, their hemodynamic effects partially counterbalance, providing more stable vitals with adequate sedation depth.',
  },

  // ── ADVANCED (6) ──────────────────────────────────────────────────────────

  {
    id: 'A1',
    stem: 'During procedural sedation, the capnography waveform suddenly becomes flat (EtCO2 = 0) while SpO2 is still 96%. The most likely cause is:',
    options: [
      'Cardiac arrest',
      'Complete upper airway obstruction or apnea',
      'Malignant hyperthermia',
      'Anaphylaxis',
    ],
    correctIndex: 1,
    difficulty: 'advanced',
    topic: 'crisis_management',
    explanation:
      'Loss of the capnography waveform with maintained SpO2 indicates apnea or complete obstruction. SpO2 lags because of the oxygen reservoir in the lungs (especially if pre-oxygenated). Capnography is the earliest warning of ventilatory failure — it detects apnea minutes before desaturation.',
  },
  {
    id: 'A2',
    stem: 'The Eleveld pharmacokinetic model for propofol adjusts parameters based on which patient factors?',
    options: [
      'Age, weight, and height only',
      'Age, weight, height, sex, and PMA (post-menstrual age for neonates)',
      'Weight and ASA class only',
      'BMI and hepatic function only',
    ],
    correctIndex: 1,
    difficulty: 'advanced',
    topic: 'patient_sensitivity',
    explanation:
      'The Eleveld model is a general-purpose allometric PK/PD model for propofol that incorporates age (including PMA for pediatric/neonatal patients), weight, height, and sex as covariates. It spans neonatal to elderly populations and was validated on over 30 prior studies.',
  },
  {
    id: 'A3',
    stem: 'A BIS value of 22 with burst suppression ratio of 40% during propofol sedation indicates:',
    options: [
      'Adequate sedation for a painful procedure',
      'Light sedation — patient may be aware',
      'Excessive depth — cortical suppression requiring immediate dose reduction',
      'Equipment malfunction — BIS cannot read below 30',
    ],
    correctIndex: 2,
    difficulty: 'advanced',
    topic: 'bis_interpretation',
    explanation:
      'BIS < 40 with burst suppression indicates cortical electrical silence interspersed with brief bursts of activity. This is deeper than general anesthesia targets (40-60) and represents excessive sedation. Immediate reduction in propofol dosing is warranted to prevent hemodynamic collapse and prolonged recovery.',
  },
  {
    id: 'A4',
    stem: 'In a patient with suspected opioid-induced rigid chest syndrome during fentanyl administration, the immediate management is:',
    options: [
      'Administer naloxone 2 mg IV push',
      'Administer succinylcholine and perform endotracheal intubation',
      'Apply continuous positive airway pressure (CPAP)',
      'Wait and monitor — the rigidity will resolve spontaneously',
    ],
    correctIndex: 1,
    difficulty: 'advanced',
    topic: 'crisis_management',
    explanation:
      'Fentanyl-induced chest wall rigidity ("wooden chest") causes inability to ventilate. While naloxone may help, the definitive treatment in severe cases is neuromuscular blockade (succinylcholine 1-2 mg/kg IV) followed by intubation and mechanical ventilation. CPAP cannot overcome rigid chest wall muscles.',
  },
  {
    id: 'A5',
    stem: 'Which BIS range is considered the target for moderate procedural sedation while maintaining protective reflexes?',
    options: [
      'BIS 20-40',
      'BIS 40-60',
      'BIS 60-80',
      'BIS 80-100',
    ],
    correctIndex: 2,
    difficulty: 'advanced',
    topic: 'bis_interpretation',
    explanation:
      'For moderate (conscious) sedation where protective reflexes should be maintained, BIS 60-80 is the target range. BIS 40-60 is the general anesthesia target. BIS < 40 suggests excessive depth with cortical suppression.',
  },
  {
    id: 'A6',
    stem: 'An elderly patient (82 yo, 55 kg, ASA III) requires propofol for colonoscopy sedation. Compared to a healthy 30-year-old, the initial bolus dose should be:',
    options: [
      'The same — age does not affect propofol dosing',
      'Increased by 50% due to higher volume of distribution',
      'Reduced by 30-50% due to decreased cardiac output and increased sensitivity',
      'Eliminated — only infusion should be used in the elderly',
    ],
    correctIndex: 2,
    difficulty: 'advanced',
    topic: 'patient_sensitivity',
    explanation:
      'Elderly patients have reduced cardiac output (slower drug delivery to effect site), reduced central compartment volume, and increased brain sensitivity to propofol. Both the Marsh and Eleveld models predict higher effect-site concentrations per mg/kg. A 30-50% dose reduction is standard practice.',
  },
];

// ─── Balanced test sets for 3-arm rotation ──────────────────────────────────

/**
 * 3 test sets of 5 questions each, matched for difficulty distribution.
 * Each set: 2 basic + 2 intermediate + 1 advanced (or 1 basic + 2 intermediate + 2 advanced).
 * Used for pre-test before each arm and post-test after.
 */
export const TEST_SETS: [string[], string[], string[]] = [
  // Set 0 (Arm rotation 1): 2 basic + 2 intermediate + 1 advanced
  ['B1', 'B2', 'I1', 'I2', 'A1'],
  // Set 1 (Arm rotation 2): 2 basic + 2 intermediate + 1 advanced
  ['B3', 'B4', 'I3', 'I4', 'A3'],
  // Set 2 (Arm rotation 3): 2 basic + 2 intermediate + 1 advanced
  ['B5', 'B6', 'I5', 'I6', 'A5'],
];

/** Look up a question by ID. */
export function getQuestionById(id: string): StudyQuestion | undefined {
  return QUESTION_BANK.find(q => q.id === id);
}

/** Get the questions for a given test set index (0, 1, or 2). */
export function getTestSet(setIndex: number): StudyQuestion[] {
  const ids = TEST_SETS[setIndex % 3];
  return ids.map(id => getQuestionById(id)).filter((q): q is StudyQuestion => q !== undefined);
}
