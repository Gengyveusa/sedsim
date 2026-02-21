import { InteractiveScenario } from '../ScenarioEngine';

export const HARD_PARADOXICAL_AGITATION: InteractiveScenario = {
  id: 'hard_paradoxical_agitation',
  title: 'Severe Paradoxical Midazolam Agitation - Elderly',
  difficulty: 'hard',
  patientArchetype: 'elderly',
  procedure: 'Colonoscopy',
  description: 'Elderly woman for colonoscopy develops severe paradoxical agitation after midazolam. Must recognize, avoid escalating benzodiazepine, and switch to an alternative agent safely.',
  learningObjectives: [
    'Differentiate paradoxical agitation from pain/anxiety/awareness',
    'Understand why more midazolam worsens paradoxical agitation',
    'Use propofol as rescue for benzodiazepine paradoxical reaction',
    'Manage the safe switch between agents mid-procedure',
  ],
  clinicalPearls: [
    'Paradoxical agitation: disinhibition from GABA-A beta3 subunit activity in limbic system',
    'Elderly and very young patients at highest risk',
    'Never increase midazolam for paradoxical agitation — it deepens disinhibition',
    'Propofol targets different GABA-A subunits — effective rescue',
  ],
  preopVignette: {
    indication: 'Surveillance colonoscopy — prior adenomas',
    setting: 'Ambulatory endoscopy suite',
    history: [
      '68-year-old female, ASA 2 — mild HTN only',
      'No prior anesthesia issues reported',
      'Medications: amlodipine. NKDA.',
      'Baseline: calm, cooperative',
    ],
    exam: [
      'Airway: Mallampati 2',
      'HR 70, BP 138/82, SpO2 97%',
      'Cooperative at baseline — no cognitive impairment',
    ],
    baselineMonitors: ['SpO2', 'EtCO2', 'NIBP q5min', 'ECG'],
    targetSedationGoal: 'MOASS 2-3 for colonoscopy',
  },
  drugProtocols: [
    { name: 'midazolam', route: 'IV', typicalBolusRange: [0.5, 1], maxTotalDose: 3, unit: 'mg' },
    { name: 'fentanyl', route: 'IV', typicalBolusRange: [25, 50], maxTotalDose: 100, unit: 'mcg' },
    { name: 'propofol', route: 'IV', typicalBolusRange: [20, 40], maxTotalDose: 150, unit: 'mg' },
  ],
  steps: [
    {
      id: 'step_initial_plan',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        "Meet Helen, a 68-year-old for colonoscopy. She's calm and cooperative at baseline.",
        'You give midazolam 1 mg IV. Three minutes later she becomes increasingly agitated and combative.',
        'What is the FIRST thing you should NOT do?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'What should you NOT do for paradoxical agitation after midazolam?',
        options: [
          'Give more midazolam to "complete the sedation"',
          'Assess airway and oxygen saturation first',
          'Hold further sedation and assess the patient',
          'Consider propofol as a rescue agent',
        ],
        correctAnswer: 'Give more midazolam to "complete the sedation"',
        feedback: {
          'Give more midazolam to "complete the sedation"': 'Correct — this is what you must NOT do. More midazolam will worsen the paradoxical reaction.',
          'Assess airway and oxygen saturation first': 'This is appropriate — assessment first is always correct.',
          'Hold further sedation and assess the patient': 'This is the right initial approach.',
          'Consider propofol as a rescue agent': 'This is an appropriate rescue option.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 0.32 },
        { type: 'administer_drug', drug: 'midazolam', dose: 1 },
        { type: 'advance_time', seconds: 180 },
      ],
      highlight: ['midazolam-1', 'airway-nasal_cannula', 'fio2-slider'],
      teachingPoints: [
        'Paradoxical agitation: disinhibition, not undersedation. More midazolam = more disinhibition.',
        'First step: ensure airway, stop the midazolam, assess severity.',
      ],
    },
    {
      id: 'step_differentiate',
      phase: 'complication',
      triggerType: 'on_time',
      triggerTimeSeconds: 200,
      millieDialogue: [
        'Helen is now shouting, pulling at the IV, and kicking. SpO2 is 95%. HR 105.',
        'The endoscopist says "she needs more sedation." What do you say?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Your response to the endoscopist requesting more sedation?',
        options: [
          'This is a paradoxical reaction — more midazolam will worsen it. I will use propofol rescue.',
          'You are right — I will give another 2 mg midazolam.',
          'We should just restrain her and proceed.',
          'This is anxiety — give 1 mg more midazolam and it will work.',
        ],
        correctAnswer: 'This is a paradoxical reaction — more midazolam will worsen it. I will use propofol rescue.',
        feedback: {
          'This is a paradoxical reaction — more midazolam will worsen it. I will use propofol rescue.': 'Correct! Communicate the mechanism and offer an evidence-based rescue.',
          'You are right — I will give another 2 mg midazolam.': 'Wrong — this will worsen the paradoxical reaction significantly.',
          'We should just restrain her and proceed.': 'Ethically inappropriate. Address the sedation problem before proceeding.',
          'This is anxiety — give 1 mg more midazolam and it will work.': 'Misdiagnosis of the mechanism — this will worsen the paradoxical reaction.',
        },
      },
      simActions: [],
      teachingPoints: [
        'Clear communication to the procedure team is critical — explain the mechanism and the rescue plan.',
        'Team dynamics: the sedationist must be able to hold the procedure when safety is at stake.',
      ],
    },
    {
      id: 'step_propofol_rescue',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_differentiate',
      millieDialogue: [
        'You decide to use propofol rescue. Helen weighs 65 kg.',
        'What propofol dose do you give to achieve MOASS 2 in this elderly patient?',
      ],
      question: {
        type: 'numeric_range',
        prompt: 'Propofol rescue dose in mg for 65 kg elderly female',
        correctAnswer: 30,
        idealRange: [20, 40],
        feedback: {
          low: 'Below 20 mg may be insufficient for rescue of severe agitation.',
          ideal: '20-40 mg is appropriate for elderly patients — use the lower end first.',
          high: 'Above 40 mg risks respiratory depression in this elderly patient — propofol is more potent in the elderly.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'propofol', dose: 30 },
        { type: 'advance_time', seconds: 60 },
      ],
      highlight: ['propofol-20'],
      teachingPoints: [
        'Propofol rescue: 0.5 mg/kg IV for elderly (0.5 × 65 = 32 mg).',
        'Onset: 30-60 seconds. Acts on different GABA-A receptor subtypes — bypasses paradoxical mechanism.',
        'Monitor SpO2 and BP closely after propofol in elderly patients.',
      ],
    },
    {
      id: 'step_maintain_sedation',
      phase: 'maintenance',
      triggerType: 'on_time',
      triggerTimeSeconds: 420,
      millieDialogue: [
        'Helen is now calm at MOASS 2 after propofol. The colonoscopy is progressing.',
        'To maintain sedation, should you give more midazolam or more propofol?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'To maintain sedation after paradoxical midazolam agitation?',
        options: [
          'Small propofol boluses — avoid any further midazolam',
          'Midazolam 0.5 mg increments — small doses are fine',
          'Midazolam 2 mg to ensure amnesia',
          'Ketamine for maintenance analgesia',
        ],
        correctAnswer: 'Small propofol boluses — avoid any further midazolam',
        feedback: {
          'Small propofol boluses — avoid any further midazolam': 'Correct! Once paradoxical reaction established, avoid all further benzodiazepines for this case.',
          'Midazolam 0.5 mg increments — small doses are fine': 'No dose is safe once paradoxical reaction is established — avoid midazolam entirely.',
          'Midazolam 2 mg to ensure amnesia': 'This will certainly re-trigger the paradoxical reaction.',
          'Ketamine for maintenance analgesia': 'Ketamine for analgesia is reasonable but propofol should be the hypnotic — not midazolam.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'propofol', dose: 20 },
      ],
      highlight: ['propofol-20'],
      teachingPoints: [
        'After establishing a paradoxical reaction, avoid ALL further benzodiazepines for the remainder of the case.',
        'Document clearly: "Paradoxical midazolam reaction — avoid benzodiazepines in future."',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'How would you document this event to prevent recurrence in future procedures?',
      'What preoperative screening might identify patients at high risk for paradoxical reactions?',
      'How would your management differ if the patient also had a respiratory compromise?',
    ],
    keyTakeaways: [
      'Paradoxical midazolam reaction: NEVER give more benzodiazepine — switch to propofol.',
      'Elderly patients have higher incidence of paradoxical benzodiazepine reactions.',
      'Clear team communication: explain mechanism and rescue plan to the proceduralist.',
      'Document as drug sensitivity for all future encounters.',
    ],
  },
};

export const HARD_LARYNGOSPASM: InteractiveScenario = {
  id: 'hard_laryngospasm',
  title: 'Laryngospasm During Deep Sedation',
  difficulty: 'hard',
  patientArchetype: 'healthy_adult',
  procedure: 'Upper GI Endoscopy',
  description: 'Healthy adult develops laryngospasm during deep sedation for upper GI endoscopy. Critical airway emergency requiring immediate escalating intervention.',
  learningObjectives: [
    'Recognize laryngospasm presentation and differentiate from partial obstruction',
    'Apply the laryngospasm notch maneuver',
    'Understand the role of propofol deepening vs. succinylcholine for laryngospasm',
    'Know when to call for help and escalate to emergency airway',
  ],
  clinicalPearls: [
    'Laryngospasm: adductor muscle closure of vocal cords. Partial = stridor. Complete = silent.',
    'Laryngospasm notch: firm pressure in the groove between mastoid and posterior mandibular ramus — powerful vagal override',
    'Propofol 0.5-1 mg/kg IV: deepening sedation can break mild-moderate spasm',
    'Succinylcholine 0.1-0.5 mg/kg IV (or 4 mg/kg IM): use for complete, refractory laryngospasm',
  ],
  preopVignette: {
    indication: 'Dysphagia evaluation — upper GI endoscopy',
    setting: 'Endoscopy suite',
    history: [
      '42-year-old male, healthy, ASA 1',
      'Upper respiratory tract infection 3 weeks ago (now resolved)',
      'No medications, NKDA',
    ],
    exam: [
      'Airway: Mallampati 1, good mouth opening',
      'HR 74, BP 122/78, SpO2 99%',
    ],
    baselineMonitors: ['SpO2 continuous', 'EtCO2', 'NIBP', 'ECG'],
    targetSedationGoal: 'Deep sedation (MOASS 1-2) — endoscope passes through pharynx',
  },
  drugProtocols: [
    { name: 'propofol', route: 'IV', typicalBolusRange: [60, 100], maxTotalDose: 250, unit: 'mg' },
    { name: 'fentanyl', route: 'IV', typicalBolusRange: [25, 50], maxTotalDose: 150, unit: 'mcg' },
  ],
  steps: [
    {
      id: 'step_laryngospasm_risk',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        "This patient had an upper respiratory infection 3 weeks ago — now resolved.",
        'How does a recent URTI increase laryngospasm risk during airway manipulation?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Mechanism of increased laryngospasm risk after recent URTI?',
        options: [
          'Airway hyperreactivity persists for up to 6 weeks after URTI',
          'URTI causes permanent damage to vocal cords',
          'No increased risk after 2 weeks — URTI is no longer relevant',
          'URTI only increases bronchospasm risk, not laryngospasm',
        ],
        correctAnswer: 'Airway hyperreactivity persists for up to 6 weeks after URTI',
        feedback: {
          'Airway hyperreactivity persists for up to 6 weeks after URTI': 'Correct! Airway hyperreactivity can persist 4-6 weeks post-URTI — increased laryngospasm risk.',
          'URTI causes permanent damage to vocal cords': 'URTI does not cause permanent damage — it causes temporary hyperreactivity.',
          'No increased risk after 2 weeks — URTI is no longer relevant': 'Incorrect. Hyperreactivity persists up to 6 weeks — 3 weeks is still a risk period.',
          'URTI only increases bronchospasm risk, not laryngospasm': 'Both are increased — upper and lower airway hyperreactivity.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 0.40 },
      ],
      highlight: ['airway-nasal_cannula', 'fio2-slider'],
      teachingPoints: [
        'Post-URTI airway hyperreactivity: consider rescheduling elective procedures for 4-6 weeks.',
        'If proceeding: pre-oxygenate thoroughly, have succinylcholine drawn up at bedside.',
      ],
    },
    {
      id: 'step_induction',
      phase: 'induction',
      triggerType: 'on_step_complete',
      afterStepId: 'step_laryngospasm_risk',
      millieDialogue: [
        'You proceed. The patient is pre-oxygenated. Propofol 120 mg given.',
        'As the endoscope approaches the pharynx, you hear high-pitched stridor. What is this?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'High-pitched stridor as endoscope enters pharynx — most likely?',
        options: [
          'Partial laryngospasm — adductor muscles partially closing the glottis',
          'Bronchospasm — lower airway wheeze',
          'Normal sound of the endoscope passing',
          'Snoring from soft tissue obstruction — reposition head',
        ],
        correctAnswer: 'Partial laryngospasm — adductor muscles partially closing the glottis',
        feedback: {
          'Partial laryngospasm — adductor muscles partially closing the glottis': 'Correct! Inspiratory stridor with scope in pharynx = partial laryngospasm.',
          'Bronchospasm — lower airway wheeze': 'Bronchospasm is expiratory wheeze — stridor is upper airway and inspiratory.',
          'Normal sound of the endoscope passing': 'Stridor is never normal — it indicates upper airway obstruction.',
          'Snoring from soft tissue obstruction — reposition head': 'Snoring is a low-pitched gurgling — stridor is high-pitched and more ominous.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'fentanyl', dose: 50 },
        { type: 'administer_drug', drug: 'propofol', dose: 120 },
        { type: 'advance_time', seconds: 60 },
      ],
      highlight: ['fentanyl-50', 'propofol-100'],
      teachingPoints: [
        'Partial laryngospasm: stridor present, some airflow, SpO2 starting to fall.',
        'Complete laryngospasm: silent — no stridor, no airflow, SpO2 falling rapidly.',
      ],
    },
    {
      id: 'step_spasm_intervention',
      phase: 'complication',
      triggerType: 'on_physiology',
      triggerCondition: { parameter: 'spo2', operator: '<', threshold: 90, durationSeconds: 10 },
      millieDialogue: [
        'SpO2 is now 88% and dropping! The stridor has become silent — complete laryngospasm.',
        'Endoscope has been removed. What is your immediate sequence of actions?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Immediate sequence for complete laryngospasm with SpO2 88%?',
        options: [
          'Remove stimulus, 100% O2 CPAP mask, jaw thrust, laryngospasm notch pressure',
          'Immediately give succinylcholine 1.5 mg/kg IV',
          'Reinsert endoscope to open the airway',
          'Give more propofol — deepen sedation first',
        ],
        correctAnswer: 'Remove stimulus, 100% O2 CPAP mask, jaw thrust, laryngospasm notch pressure',
        feedback: {
          'Remove stimulus, 100% O2 CPAP mask, jaw thrust, laryngospasm notch pressure': 'Correct! CPAP + laryngospasm notch resolves most partial and many complete spasms.',
          'Immediately give succinylcholine 1.5 mg/kg IV': 'Succinylcholine is the escalation after non-pharmacologic measures fail.',
          'Reinsert endoscope to open the airway': 'Do not reintroduce the airway stimulus that caused the spasm.',
          'Give more propofol — deepen sedation first': 'Propofol deepening is appropriate but CPAP + notch pressure is more immediate first-line.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'jaw_thrust' },
        { type: 'apply_intervention', intervention: 'bag_mask' },
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 1.0 },
      ],
      highlight: ['spo2-display', 'airway-nasal_cannula', 'fio2-slider'],
      teachingPoints: [
        'Laryngospasm notch: Larson\'s point — firm digital pressure medial to mastoid, posterior to mandibular ramus.',
        'CPAP via bag-mask: 20-30 cmH2O can physically force the cords open.',
        'Propofol 0.5-1 mg/kg IV: deepening breaks mild-moderate spasm.',
        'Succinylcholine: the definitive pharmacologic reversal. Dose: 0.1 mg/kg IV (intramuscular 4 mg/kg if no IV access).',
      ],
    },
    {
      id: 'step_succ_decision',
      phase: 'complication',
      triggerType: 'on_time',
      triggerTimeSeconds: 300,
      millieDialogue: [
        'Notch pressure and CPAP not working — SpO2 now 82% and falling rapidly.',
        'You must act now. What is the correct succinylcholine dose for laryngospasm?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Succinylcholine dose for refractory laryngospasm in 80 kg patient?',
        options: [
          '0.1-0.5 mg/kg IV (8-40 mg) — sub-paralytic dose to break spasm',
          '1.5 mg/kg IV (120 mg) — full RSI dose',
          '4 mg/kg IM only — no IV option',
          '0.01 mg/kg IV — microdose',
        ],
        correctAnswer: '0.1-0.5 mg/kg IV (8-40 mg) — sub-paralytic dose to break spasm',
        feedback: {
          '0.1-0.5 mg/kg IV (8-40 mg) — sub-paralytic dose to break spasm': 'Correct! Sub-paralytic dose relaxes adductors without full paralysis — can still breathe spontaneously.',
          '1.5 mg/kg IV (120 mg) — full RSI dose': 'Full RSI dose causes complete paralysis — requires intubation. Use sub-paralytic dose for laryngospasm first.',
          '4 mg/kg IM only — no IV option': '4 mg/kg IM is for when IV is unavailable — IV is always preferred if accessible.',
          '0.01 mg/kg IV — microdose': 'Far too low to break laryngospasm.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'propofol', dose: 60 },
        { type: 'set_fio2', fio2: 1.0 },
      ],
      highlight: ['propofol-50', 'fio2-slider'],
      teachingPoints: [
        'Sub-paralytic succinylcholine (0.1-0.5 mg/kg IV) relaxes the adductor muscles while preserving respiratory effort.',
        'Full RSI dose (1.5 mg/kg) causes complete apnea — requires bag-mask ventilation and intubation.',
        'If no IV access: succinylcholine 4 mg/kg IM (thigh) — slower onset but effective.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'What preoperative factors would make you prepare succinylcholine at the bedside proactively?',
      'How does CPAP mechanically break laryngospasm?',
      'When would you escalate from sub-paralytic to full RSI dosing of succinylcholine?',
    ],
    keyTakeaways: [
      'Post-URTI airway hyperreactivity lasts up to 6 weeks — consider rescheduling.',
      'Laryngospasm sequence: remove stimulus → CPAP + notch pressure → propofol deepening → succinylcholine.',
      'Sub-paralytic succinylcholine (0.1-0.5 mg/kg) is preferred for laryngospasm — preserves respiratory effort.',
      'Always have succinylcholine drawn up for deep sedation airway procedures.',
    ],
  },
};

export const HARD_LAST_TOXICITY: InteractiveScenario = {
  id: 'hard_last_toxicity',
  title: 'Local Anesthetic Systemic Toxicity (LAST)',
  difficulty: 'hard',
  patientArchetype: 'healthy_adult',
  procedure: 'Regional Nerve Block with Sedation',
  description: 'Patient develops local anesthetic systemic toxicity (LAST) after inadvertent intravascular injection during peripheral nerve block. Seizures and cardiovascular collapse require immediate lipid rescue.',
  learningObjectives: [
    'Recognize early and late signs of LAST',
    'Know the ASRA LAST treatment algorithm',
    'Administer lipid emulsion rescue therapy correctly',
    'Understand why early recognition is critical for survival',
  ],
  clinicalPearls: [
    'LAST: CNS signs first (perioral tingling, tinnitus, seizures), then cardiovascular (dysrhythmia, arrest)',
    'Bupivacaine is most cardiotoxic — ventricular dysrhythmias, hard to treat',
    'Lipid emulsion 20%: 1.5 mL/kg IV bolus, then 0.25 mL/kg/min infusion — the antidote',
    'Benzodiazepines for seizures in LAST — avoid propofol (contains lipid solvent, delays emulsion)',
  ],
  preopVignette: {
    indication: 'Femoral nerve block for knee surgery under light sedation',
    setting: 'Procedure room',
    history: [
      '58-year-old male, ASA 2 — hypertension',
      'Total knee arthroplasty under regional + sedation',
      'Medications: amlodipine. No allergies.',
      '40 mL bupivacaine 0.5% planned for femoral nerve block',
    ],
    exam: [
      'Airway: Mallampati 1, adequate',
      'HR 72, BP 132/84, SpO2 98%',
    ],
    baselineMonitors: ['ECG (continuous)', 'SpO2', 'NIBP', 'EtCO2'],
    targetSedationGoal: 'MOASS 3-4 during block placement, MOASS 2 during procedure',
  },
  drugProtocols: [
    { name: 'midazolam', route: 'IV', typicalBolusRange: [1, 2], maxTotalDose: 4, unit: 'mg' },
    { name: 'fentanyl', route: 'IV', typicalBolusRange: [25, 50], maxTotalDose: 150, unit: 'mcg' },
  ],
  steps: [
    {
      id: 'step_early_signs',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        'Bupivacaine block has just been injected. The patient says: "My lips feel numb and I hear a ringing sound."',
        'What do these symptoms represent?',
      ],
      question: {
        type: 'single_choice',
        prompt: '"Lip numbness and tinnitus" after local anesthetic injection — what is this?',
        options: [
          'Early CNS signs of LAST — stop injection immediately',
          'Expected spread of local anesthetic — normal finding',
          'Anxiety response — reassure and continue',
          'Allergic reaction — give antihistamine',
        ],
        correctAnswer: 'Early CNS signs of LAST — stop injection immediately',
        feedback: {
          'Early CNS signs of LAST — stop injection immediately': 'Correct! Perioral paresthesias and tinnitus = early CNS toxicity of LAST. STOP immediately.',
          'Expected spread of local anesthetic — normal finding': 'Never dismiss perioral numbness after LA injection — it is a cardinal LAST warning sign.',
          'Anxiety response — reassure and continue': 'These are not anxiety symptoms — they are specific neurological LAST signs.',
          'Allergic reaction — give antihistamine': 'True LA allergy is rare. These are CNS toxicity signs, not allergy.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 0.40 },
      ],
      highlight: ['airway-nasal_cannula', 'fio2-slider'],
      teachingPoints: [
        'LAST early signs: perioral tingling, tinnitus, metallic taste, tongue numbness, light-headedness.',
        'LAST late signs: seizures, dysrhythmias, cardiovascular collapse.',
        'Rule: any CNS symptom during or after LA injection = STOP and treat as LAST until proven otherwise.',
      ],
    },
    {
      id: 'step_seizure',
      phase: 'complication',
      triggerType: 'on_time',
      triggerTimeSeconds: 90,
      millieDialogue: [
        'You stop the injection but 90 seconds later the patient has a generalized tonic-clonic seizure!',
        'What is the recommended treatment for seizures in LAST?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'First-line seizure treatment in LAST?',
        options: [
          'Midazolam or lorazepam IV — benzodiazepine for seizure control',
          'Propofol 200 mg IV — immediate deep sedation',
          'Succinylcholine only — to prevent injury from convulsions',
          'Wait for seizure to terminate spontaneously',
        ],
        correctAnswer: 'Midazolam or lorazepam IV — benzodiazepine for seizure control',
        feedback: {
          'Midazolam or lorazepam IV — benzodiazepine for seizure control': 'Correct! Benzodiazepines are first-line for LAST seizures. Avoid propofol (lipid vehicle interferes with emulsion).',
          'Propofol 200 mg IV — immediate deep sedation': 'Propofol CONTAINS a lipid emulsion vehicle — avoid in LAST as it can delay/interfere with intralipid rescue.',
          'Succinylcholine only — to prevent injury from convulsions': 'Succinylcholine paralyzes — seizure activity continues in the brain. Add benzodiazepine.',
          'Wait for seizure to terminate spontaneously': 'Ongoing seizures in LAST progress to cardiovascular collapse — treat immediately.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'midazolam', dose: 2 },
        { type: 'set_fio2', fio2: 1.0 },
        { type: 'apply_intervention', intervention: 'bag_mask' },
      ],
      highlight: ['midazolam-2', 'fio2-slider'],
      teachingPoints: [
        'LAST seizure control: midazolam 2-4 mg IV, or lorazepam 2-4 mg IV.',
        'Avoid propofol in LAST — its lipid vehicle is thought to interfere with intralipid rescue.',
        'Ensure airway — seizures cause apnea. Have BVM immediately available.',
      ],
    },
    {
      id: 'step_lipid_rescue',
      phase: 'complication',
      triggerType: 'on_physiology',
      triggerCondition: { parameter: 'sbp', operator: '<', threshold: 80, durationSeconds: 10 },
      millieDialogue: [
        'After the seizure, BP drops to 75/40! ECG shows wide-complex rhythm.',
        'You must start lipid emulsion rescue. What is the correct initial dose of Intralipid 20%?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Intralipid 20% initial bolus dose for LAST cardiovascular collapse?',
        options: [
          '1.5 mL/kg IV over 1 minute',
          '0.1 mL/kg IV slowly',
          '10 mL/kg IV as fast as possible',
          '50 mL IV flat dose — not weight-based',
        ],
        correctAnswer: '1.5 mL/kg IV over 1 minute',
        feedback: {
          '1.5 mL/kg IV over 1 minute': 'Correct! ASRA LAST protocol: Intralipid 20% 1.5 mL/kg IV bolus over 1 minute, then 0.25 mL/kg/min infusion.',
          '0.1 mL/kg IV slowly': 'Far too little and too slow — this dose is ineffective for cardiac rescue.',
          '10 mL/kg IV as fast as possible': 'Far too much — causes lipid embolism and ARDS. Use 1.5 mL/kg bolus.',
          '50 mL IV flat dose — not weight-based': 'LAST dosing is weight-based. 1.5 mL/kg × 80 kg = 120 mL bolus.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'bag_mask' },
        { type: 'set_fio2', fio2: 1.0 },
      ],
      highlight: ['bp-display', 'fio2-slider'],
      teachingPoints: [
        'Intralipid 20% LAST protocol: 1.5 mL/kg bolus → 0.25 mL/kg/min infusion.',
        'Mechanism: "lipid sink" — partitions bupivacaine away from cardiac sodium channels.',
        'Can repeat bolus twice for refractory cardiac arrest. Max dose: 12 mL/kg.',
        'LAST kit: every procedure room with LA use should have premixed Intralipid ready.',
      ],
    },
    {
      id: 'step_acls',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_lipid_rescue',
      millieDialogue: [
        'Despite lipid rescue, the patient loses pulse. You start CPR.',
        'How does LAST cardiac arrest differ from standard ACLS?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'LAST cardiac arrest vs. standard ACLS — key difference?',
        options: [
          'Avoid vasopressin and use low-dose epinephrine; continue Intralipid; consider ECMO',
          'Give high-dose epinephrine (5 mg) immediately',
          'LAST arrest is identical to standard ACLS — follow standard protocol',
          'Never shock VF in LAST — defibrillation is contraindicated',
        ],
        correctAnswer: 'Avoid vasopressin and use low-dose epinephrine; continue Intralipid; consider ECMO',
        feedback: {
          'Avoid vasopressin and use low-dose epinephrine; continue Intralipid; consider ECMO': 'Correct! ASRA LAST: low-dose epi (≤1 mcg/kg), avoid vasopressin, continue Intralipid, early ECMO referral.',
          'Give high-dose epinephrine (5 mg) immediately': 'High-dose epi worsens bupivacaine cardiac toxicity — use low doses.',
          'LAST arrest is identical to standard ACLS — follow standard protocol': 'LAST arrest has specific modifications — not identical to standard ACLS.',
          'Never shock VF in LAST — defibrillation is contraindicated': 'Defibrillation IS indicated for VF in LAST — treat shock-rhythm normally.',
        },
      },
      simActions: [
        { type: 'set_fio2', fio2: 1.0 },
      ],
      highlight: ['fio2-slider'],
      teachingPoints: [
        'LAST ACLS modifications: reduce epinephrine dose (≤1 mcg/kg), avoid vasopressin, continue Intralipid.',
        'ECMO: early referral for refractory LAST cardiac arrest — has saved lives.',
        'Bupivacaine arrest can last 1+ hour — prolonged CPR is justified if on Intralipid.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'What preventive measures reduce LAST incidence during nerve block placement?',
      'Why does Intralipid work for bupivacaine toxicity but not for other cardiac arrests?',
      'How do you organize a LAST kit for a procedure room?',
    ],
    keyTakeaways: [
      'LAST: early signs = perioral tingling, tinnitus. Late = seizures, cardiovascular collapse.',
      'STOP injection immediately at any early sign — do not dismiss.',
      'Intralipid 20%: 1.5 mL/kg bolus → 0.25 mL/kg/min infusion.',
      'ACLS modifications: low-dose epi, no vasopressin, continue Intralipid, consider ECMO.',
    ],
  },
};

export const HARD_BRONCHOSPASM: InteractiveScenario = {
  id: 'hard_bronchospasm',
  title: 'Reactive Airway Bronchospasm During Bronchoscopy',
  difficulty: 'hard',
  patientArchetype: 'healthy_adult',
  procedure: 'Flexible Bronchoscopy',
  description: 'Patient with asthma develops severe bronchospasm during bronchoscopy under deep sedation. Requires prompt recognition and step-wise bronchodilator therapy.',
  learningObjectives: [
    'Differentiate bronchospasm from laryngospasm and mucus plugging',
    'Apply stepwise bronchodilator treatment for bronchoscopy-triggered bronchospasm',
    'Understand ketamine\'s bronchodilatory properties',
    'Know when to abort the procedure vs. treat through',
  ],
  clinicalPearls: [
    'Bronchospasm during bronchoscopy: scope in airway is a constant stimulus — remove if possible',
    'Ketamine is a bronchodilator — useful in asthmatic patients requiring sedation',
    'Beta-2 agonist nebulization or IV salbutamol is first-line pharmacotherapy',
    'Heliox (helium-oxygen) reduces turbulent flow and work of breathing in severe bronchospasm',
  ],
  preopVignette: {
    indication: 'Flexible bronchoscopy for persistent cough evaluation',
    setting: 'Bronchoscopy suite',
    history: [
      '45-year-old female, mild persistent asthma — well controlled on ICS',
      'Last asthma exacerbation: 1 year ago. SpO2 baseline 98%.',
      'Medications: fluticasone inhaler, salbutamol PRN. NKDA.',
      'ASA 2',
    ],
    exam: [
      'Airway: Mallampati 1, adequate',
      'Chest: mild expiratory wheeze bilaterally at baseline',
      'SpO2 98%, HR 76, BP 120/78',
    ],
    baselineMonitors: ['SpO2', 'EtCO2', 'Continuous ECG', 'NIBP'],
    targetSedationGoal: 'Deep sedation (MOASS 1-2) — scope traverses vocal cords',
  },
  drugProtocols: [
    { name: 'propofol', route: 'IV', typicalBolusRange: [60, 100], maxTotalDose: 200, unit: 'mg' },
    { name: 'ketamine', route: 'IV', typicalBolusRange: [20, 40], maxTotalDose: 100, unit: 'mg' },
    { name: 'fentanyl', route: 'IV', typicalBolusRange: [25, 50], maxTotalDose: 150, unit: 'mcg' },
  ],
  steps: [
    {
      id: 'step_preop_risk',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        'An asthmatic patient needs bronchoscopy. Her asthma is usually well controlled but she has baseline wheeze.',
        'What preoperative measure reduces bronchospasm risk for this asthmatic patient?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Best preoperative measure to reduce bronchospasm risk in an asthmatic patient?',
        options: [
          'Pre-procedure salbutamol (albuterol) 2.5 mg nebulization',
          'Oral prednisolone 40 mg — start morning of procedure',
          'No premedication needed if asthma is well-controlled',
          'IV aminophylline loading dose pre-procedure',
        ],
        correctAnswer: 'Pre-procedure salbutamol (albuterol) 2.5 mg nebulization',
        feedback: {
          'Pre-procedure salbutamol (albuterol) 2.5 mg nebulization': 'Correct! Beta-2 agonist pre-treatment optimizes bronchodilation before airway manipulation.',
          'Oral prednisolone 40 mg — start morning of procedure': 'Steroids take 4-6 hours to work — not useful for immediate bronchospasm prevention.',
          'No premedication needed if asthma is well-controlled': 'Bronchoscopy is a strong airway stimulus — proactive bronchodilation is always warranted in asthma.',
          'IV aminophylline loading dose pre-procedure': 'Aminophylline has a narrow therapeutic window and arrhythmia risk — not recommended for routine prophylaxis.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 0.40 },
      ],
      highlight: ['airway-nasal_cannula', 'fio2-slider'],
      teachingPoints: [
        'Pre-procedure beta-2 agonist nebulization is standard for any asthmatic patient undergoing airway manipulation.',
        'Topical lidocaine to vocal cords reduces cough reflex and bronchospasm trigger.',
        'Consider ketamine as the hypnotic agent — it has intrinsic bronchodilatory properties.',
      ],
    },
    {
      id: 'step_ketamine_use',
      phase: 'induction',
      triggerType: 'on_step_complete',
      afterStepId: 'step_preop_risk',
      millieDialogue: [
        'You are considering your induction agent for this asthmatic patient.',
        'Why is ketamine particularly useful in asthmatic patients requiring sedation?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Why is ketamine advantageous in asthmatic patients?',
        options: [
          'Ketamine causes bronchodilation via sympathomimetic and direct smooth muscle effects',
          'Ketamine causes bronchoconstriction — helps with secretion clearance',
          'Ketamine has no effect on airway tone',
          'Ketamine reduces mucus production',
        ],
        correctAnswer: 'Ketamine causes bronchodilation via sympathomimetic and direct smooth muscle effects',
        feedback: {
          'Ketamine causes bronchodilation via sympathomimetic and direct smooth muscle effects': 'Correct! Ketamine releases endogenous catecholamines and directly relaxes bronchial smooth muscle.',
          'Ketamine causes bronchoconstriction — helps with secretion clearance': 'Completely incorrect — ketamine is a bronchodilator.',
          'Ketamine has no effect on airway tone': 'Incorrect — ketamine has well-documented bronchodilatory effects.',
          'Ketamine reduces mucus production': 'Ketamine can actually increase secretions (sympathomimetic effect on salivary glands).',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'fentanyl', dose: 50 },
        { type: 'administer_drug', drug: 'ketamine', dose: 30 },
        { type: 'administer_drug', drug: 'propofol', dose: 60 },
        { type: 'advance_time', seconds: 60 },
      ],
      highlight: ['fentanyl-50', 'ketamine-25', 'propofol-50'],
      teachingPoints: [
        'Ketamine + propofol ("ketofol"): ketamine provides bronchodilation and analgesia; propofol prevents excess salivation and emergence reactions.',
        'Topical lidocaine at the cords before scope insertion further reduces bronchospasm.',
      ],
    },
    {
      id: 'step_bronchospasm',
      phase: 'complication',
      triggerType: 'on_physiology',
      triggerCondition: { parameter: 'spo2', operator: '<', threshold: 88, durationSeconds: 15 },
      millieDialogue: [
        'SpO2 dropped to 86%! You see high airway pressures and diffuse bilateral expiratory wheeze.',
        'The scope is still in the airway. What is your first action?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Severe bronchospasm during bronchoscopy — first action?',
        options: [
          'Withdraw the bronchoscope and give 100% O2',
          'Increase sedation depth and continue the procedure',
          'Push salbutamol down the working channel of the scope',
          'Administer IV epinephrine 1 mg immediately',
        ],
        correctAnswer: 'Withdraw the bronchoscope and give 100% O2',
        feedback: {
          'Withdraw the bronchoscope and give 100% O2': 'Correct! Remove the triggering stimulus (scope) and maximize FiO2 immediately.',
          'Increase sedation depth and continue the procedure': 'Continuing with the scope in situ perpetuates the stimulus — remove it first.',
          'Push salbutamol down the working channel of the scope': 'Creative but not the first step — withdraw scope and administer proper nebulized bronchodilator.',
          'Administer IV epinephrine 1 mg immediately': 'IV epi 1 mg is for anaphylaxis and cardiac arrest — not bronchospasm. Start with beta-2 agonist.',
        },
      },
      simActions: [
        { type: 'set_fio2', fio2: 1.0 },
        { type: 'apply_intervention', intervention: 'bag_mask' },
      ],
      highlight: ['spo2-display', 'fio2-slider'],
      teachingPoints: [
        'Remove the airway stimulus (scope) FIRST in any bronchoscopy-triggered bronchospasm.',
        'Then: 100% O2, IV salbutamol or nebulized bronchodilator, IV ketamine for additional bronchodilation.',
        'Rarely: IV epinephrine 0.1-0.3 mg for life-threatening refractory bronchospasm.',
      ],
    },
    {
      id: 'step_treatment_escalation',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_bronchospasm',
      millieDialogue: [
        'Scope withdrawn, 100% O2 on, but wheeze persists and SpO2 is 84%.',
        'What medication should you give next for persistent bronchospasm?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Next treatment for persistent bronchospasm after scope removal and O2?',
        options: [
          'IV salbutamol (albuterol) 200-500 mcg IV slowly',
          'IV furosemide 40 mg — for fluid overload component',
          'Theophylline 500 mg IV loading dose',
          'Magnesium sulfate 2 g IV — for anaphylaxis',
        ],
        correctAnswer: 'IV salbutamol (albuterol) 200-500 mcg IV slowly',
        feedback: {
          'IV salbutamol (albuterol) 200-500 mcg IV slowly': 'Correct! IV beta-2 agonist is the drug of choice for severe bronchospasm requiring IV treatment.',
          'IV furosemide 40 mg — for fluid overload component': 'No evidence of fluid overload — furosemide will worsen bronchospasm by causing bronchial irritation.',
          'Theophylline 500 mg IV loading dose': 'Theophylline is a third-line agent with a narrow TI and arrhythmia risk — not first-line.',
          'Magnesium sulfate 2 g IV — for anaphylaxis': 'MgSO4 2 g IV can help bronchospasm, but it is second-line after beta-2 agonist. Dose for bronchospasm is correct but drug is not first-line.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'ketamine', dose: 20 },
        { type: 'set_fio2', fio2: 1.0 },
      ],
      highlight: ['ketamine-25', 'fio2-slider'],
      teachingPoints: [
        'Bronchospasm treatment ladder: beta-2 agonist → MgSO4 2g IV → IV ketamine → IV epinephrine.',
        'Ketamine IV 0.5-1 mg/kg: powerful bronchodilation via catecholamine release and direct smooth muscle effect.',
        'Heliox (70:30 He:O2) reduces work of breathing in severe obstruction.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'When would you cancel bronchoscopy for this asthmatic patient vs. proceed with extra precautions?',
      'How does ketamine differ from propofol for airway management in asthma?',
      'What post-procedure monitoring is required for a patient who had a severe bronchospasm episode?',
    ],
    keyTakeaways: [
      'Pre-procedure beta-2 agonist nebulization is mandatory for any asthmatic undergoing airway procedures.',
      'Ketamine is the preferred hypnotic for asthmatics — bronchodilation and hemodynamic stability.',
      'Bronchospasm during bronchoscopy: withdraw scope → O2 → IV salbutamol → consider IV ketamine.',
      'Abort procedure if bronchospasm is refractory — patient safety over diagnostic yield.',
    ],
  },
};

export const HARD_HEMORRHAGE: InteractiveScenario = {
  id: 'hard_hemorrhage',
  title: 'Intraoperative Hemorrhage During Complex Dental Surgery',
  difficulty: 'hard',
  patientArchetype: 'healthy_adult',
  procedure: 'Complex Dental Surgery',
  description: 'Unexpected significant arterial bleeding during complex dental surgery under sedation. Hemodynamic instability forces a decision to deepen sedation or convert to general anesthesia.',
  learningObjectives: [
    'Recognize hemorrhagic shock stages and signs during a sedation case',
    'Understand when to convert from sedation to general anesthesia for hemorrhage',
    'Manage hemodynamic resuscitation simultaneously with airway',
    'Know the decision threshold for blood transfusion vs. crystalloid',
  ],
  clinicalPearls: [
    'Hemorrhagic shock class II: >750 mL blood loss, HR >100, BP normal, anxious',
    'Class III: >1500 mL, HR >120, BP drops, confused — conversion to GA often required',
    'Airway control becomes priority in heavy orofacial bleeding — blood in airway is a crisis',
    '1:1:1 ratio for massive transfusion: pRBC : FFP : platelets',
  ],
  preopVignette: {
    indication: 'Complex extraction of multiple impacted third molars with bone grafting',
    setting: 'Oral surgery suite with IV sedation',
    history: [
      '55-year-old male, ASA 2 — mild hypertension on lisinopril',
      'No bleeding history, normal INR',
      'On aspirin 81 mg — not stopped (GI protective)',
      'Procedure estimated 90-120 minutes',
    ],
    exam: [
      'Airway: Mallampati 2, adequate mouth opening',
      'HR 72, BP 138/86, SpO2 99%',
    ],
    baselineMonitors: ['SpO2', 'NIBP q3min', 'ECG', 'EtCO2'],
    targetSedationGoal: 'MOASS 2-3 with propofol + fentanyl + midazolam combination',
  },
  drugProtocols: [
    { name: 'propofol', route: 'IV', typicalBolusRange: [40, 80], maxTotalDose: 300, unit: 'mg' },
    { name: 'fentanyl', route: 'IV', typicalBolusRange: [25, 50], maxTotalDose: 200, unit: 'mcg' },
    { name: 'midazolam', route: 'IV', typicalBolusRange: [1, 2], maxTotalDose: 6, unit: 'mg' },
    { name: 'ketamine', route: 'IV', typicalBolusRange: [20, 40], maxTotalDose: 80, unit: 'mg' },
  ],
  steps: [
    {
      id: 'step_aspirin_risk',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        'This patient is on aspirin 81 mg. The surgeon asks if it should have been stopped.',
        'What is the current recommendation for low-dose aspirin and dental surgery?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Management of low-dose aspirin for dental surgery?',
        options: [
          'Continue aspirin — thrombotic risk outweighs minor bleeding risk in low-risk dental surgery',
          'Always stop aspirin 7 days before any dental procedure',
          'Stop aspirin 24 hours before — that is sufficient',
          'Aspirin has no effect on dental bleeding',
        ],
        correctAnswer: 'Continue aspirin — thrombotic risk outweighs minor bleeding risk in low-risk dental surgery',
        feedback: {
          'Continue aspirin — thrombotic risk outweighs minor bleeding risk in low-risk dental surgery': 'Correct! Most guidelines recommend continuing low-dose aspirin for most dental procedures.',
          'Always stop aspirin 7 days before any dental procedure': 'Overly aggressive — stops aspirin for routine dental procedures is not evidence-based.',
          'Stop aspirin 24 hours before — that is sufficient': '24h is insufficient — aspirin effect lasts the lifetime of the platelet (~7-10 days).',
          'Aspirin has no effect on dental bleeding': 'Aspirin inhibits platelet aggregation — it does increase bleeding tendency.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 0.29 },
        { type: 'administer_drug', drug: 'midazolam', dose: 2 },
        { type: 'administer_drug', drug: 'fentanyl', dose: 50 },
        { type: 'administer_drug', drug: 'propofol', dose: 70 },
        { type: 'advance_time', seconds: 120 },
      ],
      highlight: ['airway-nasal_cannula', 'fio2-slider', 'midazolam-2', 'fentanyl-50', 'propofol-50'],
      teachingPoints: [
        'Low-dose aspirin: continue for most dental procedures. Stop only for major oral surgery with high bleeding risk.',
        'Aspirin irreversibly inhibits platelet cyclooxygenase — effect lasts 7-10 days (platelet lifespan).',
      ],
    },
    {
      id: 'step_hemorrhage_recognition',
      phase: 'complication',
      triggerType: 'on_time',
      triggerTimeSeconds: 180,
      millieDialogue: [
        'At 45 minutes, the surgeon hits an arterial bleeder. Estimated 600 mL blood in suction.',
        'HR is 108, BP 100/60. Patient looks pale. What hemorrhagic shock class is this?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'HR 108, BP 100/60, ~600 mL blood loss — hemorrhagic shock class?',
        options: [
          'Class II — compensated shock: tachycardia, borderline BP',
          'Class I — mild blood loss, no hemodynamic effect',
          'Class III — decompensated shock, requires immediate transfusion',
          'Class IV — life-threatening, imminent cardiac arrest',
        ],
        correctAnswer: 'Class II — compensated shock: tachycardia, borderline BP',
        feedback: {
          'Class II — compensated shock: tachycardia, borderline BP': 'Correct! 500-1000 mL loss (15-30% blood volume), tachycardia, borderline BP = class II.',
          'Class I — mild blood loss, no hemodynamic effect': 'Class I is <500 mL with essentially no hemodynamic response.',
          'Class III — decompensated shock, requires immediate transfusion': 'Class III is >1500 mL with clear decompensation — this patient is still compensating.',
          'Class IV — life-threatening, imminent cardiac arrest': 'Class IV is >2000 mL with imminent death — not yet at that stage.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'increase_fio2' },
        { type: 'set_fio2', fio2: 0.60 },
      ],
      highlight: ['bp-display', 'fio2-slider'],
      teachingPoints: [
        'Hemorrhagic shock classification: I <15%, II 15-30%, III 30-40%, IV >40% blood volume.',
        'Class II: tachycardia but BP maintained. Start fluid resuscitation — 2L NS or LR.',
      ],
    },
    {
      id: 'step_airway_decision',
      phase: 'complication',
      triggerType: 'on_physiology',
      triggerCondition: { parameter: 'sbp', operator: '<', threshold: 85, durationSeconds: 20 },
      millieDialogue: [
        'Despite IV fluids, BP drops to 82/50. Bleeding is pooling in the airway.',
        'What is the critical decision you must make now?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Hemorrhage with blood in airway and BP 82/50 — critical decision?',
        options: [
          'Convert to general anesthesia with rapid sequence intubation — airway control is priority',
          'Continue sedation and increase fluids',
          'Give vasopressor and continue with sedation only',
          'Terminate procedure immediately — nothing else',
        ],
        correctAnswer: 'Convert to general anesthesia with rapid sequence intubation — airway control is priority',
        feedback: {
          'Convert to general anesthesia with rapid sequence intubation — airway control is priority': 'Correct! Blood in airway + hemodynamic instability = definitive airway. Convert to GA.',
          'Continue sedation and increase fluids': 'Inadequate — sedation does not protect the airway from blood aspiration.',
          'Give vasopressor and continue with sedation only': 'Vasopressors treat the BP but do not address the airway blood — aspiration risk remains.',
          'Terminate procedure immediately — nothing else': 'Terminating the procedure is necessary but without airway control, aspiration risk is high.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'ett' },
        { type: 'set_fio2', fio2: 1.0 },
        { type: 'administer_drug', drug: 'propofol', dose: 80 },
        { type: 'administer_drug', drug: 'ketamine', dose: 40 },
      ],
      highlight: ['airway-ett', 'fio2-slider', 'propofol-100', 'ketamine-50'],
      teachingPoints: [
        'Blood in the oropharynx + sedation = aspiration risk. Secure the airway early.',
        'Rapid sequence intubation (RSI): ketamine (hemodynamically stable induction) + succinylcholine.',
        'Ketamine is preferred induction agent in hemorrhagic shock — maintains cardiovascular tone.',
      ],
    },
    {
      id: 'step_resuscitation',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_airway_decision',
      millieDialogue: [
        'Airway secured. Estimated blood loss now 1500 mL. BP is 80/40.',
        'What is the appropriate resuscitation strategy at this point?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Resuscitation strategy for 1500 mL blood loss with BP 80/40?',
        options: [
          'Activate massive transfusion protocol — pRBC + FFP + platelets in balanced ratio',
          'Give 3 L normal saline rapidly',
          'Give albumin 5% alone',
          'Only give vasopressors — no volume',
        ],
        correctAnswer: 'Activate massive transfusion protocol — pRBC + FFP + platelets in balanced ratio',
        feedback: {
          'Activate massive transfusion protocol — pRBC + FFP + platelets in balanced ratio': 'Correct! Class III hemorrhage requires blood products, not just crystalloid.',
          'Give 3 L normal saline rapidly': 'Crystalloid alone for class III hemorrhage causes dilutional coagulopathy — blood products needed.',
          'Give albumin 5% alone': 'Colloid without coagulation factor replacement worsens coagulopathy in hemorrhagic shock.',
          'Only give vasopressors — no volume': 'Vasopressors without volume replacement in hemorrhagic shock causes further organ ischemia.',
        },
      },
      simActions: [
        { type: 'set_fio2', fio2: 1.0 },
      ],
      highlight: ['fio2-slider'],
      teachingPoints: [
        'Massive transfusion protocol: balanced 1:1:1 ratio of pRBC:FFP:platelets.',
        'Tranexamic acid (TXA) 1 g IV: given within 3 hours of major hemorrhage reduces mortality.',
        'Permissive hypotension (MAP 50-65) may be acceptable until surgical hemostasis achieved.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'What preoperative measures could reduce the risk of intraoperative hemorrhage in this case?',
      'At what point should you call for additional help (second anesthesiologist, surgery attending)?',
      'How does ketamine help maintain hemodynamics during hemorrhagic shock?',
    ],
    keyTakeaways: [
      'Convert from sedation to GA when: blood in airway, class III+ hemorrhage, or patient deteriorating rapidly.',
      'Ketamine is the preferred induction agent in hemorrhagic shock — maintains sympathetic tone.',
      'Class III hemorrhage: activate massive transfusion protocol — blood products, not just saline.',
      'Tranexamic acid within 3 hours of major hemorrhage reduces mortality — give early.',
    ],
  },
};

export const HARD_SCENARIOS: InteractiveScenario[] = [
  HARD_PARADOXICAL_AGITATION,
  HARD_LARYNGOSPASM,
  HARD_LAST_TOXICITY,
  HARD_BRONCHOSPASM,
  HARD_HEMORRHAGE,
];
