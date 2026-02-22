import { InteractiveScenario } from '../ScenarioEngine';

export const EASY_COLONOSCOPY: InteractiveScenario = {
  id: 'easy_colonoscopy',
  title: 'Routine Colonoscopy - Healthy Adult',
  difficulty: 'easy',
  patientArchetype: 'healthy_adult',
  procedure: 'Colonoscopy',
  description: 'Straightforward colonoscopy sedation for a healthy adult. Focus on titration to MOASS 2-3.',
  learningObjectives: [
    'Perform focused pre-sedation assessment and assign ASA class',
    'Safely titrate midazolam and fentanyl to MOASS 2-3',
    'Recognize early respiratory depression and intervene',
    'Monitor vitals and capnography throughout',
  ],
  clinicalPearls: [
    'Always titrate sedatives incrementally in healthy patients',
    'Wait for drug effect before adding more medication',
    'Capnography changes precede SpO2 drops - watch EtCO2',
    'Even healthy adults require full monitoring and rescue readiness',
  ],
  preopVignette: {
    indication: 'Screening colonoscopy for colorectal cancer',
    setting: 'Ambulatory endoscopy suite',
    history: [
      '45-year-old healthy male, first screening colonoscopy',
      'No cardiopulmonary disease, no OSA, no prior anesthesia issues',
      'No medications, NKDA',
    ],
    exam: [
      'Airway: Mallampati I, good mouth opening, full neck ROM',
      'CV: RRR, no murmurs. Lungs: CTA bilaterally',
    ],
    baselineMonitors: ['NIBP q5min', 'SpO2', 'ECG', 'Capnography'],
    targetSedationGoal: 'MOASS 2-3 (moderate sedation)',
  },
  drugProtocols: [
    { name: 'midazolam', route: 'IV', typicalBolusRange: [0.5, 1], maxTotalDose: 5, unit: 'mg' },
    { name: 'fentanyl', route: 'IV', typicalBolusRange: [25, 50], maxTotalDose: 200, unit: 'mcg' },
  ],
  steps: [
    {
      id: 'step_asa',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        "Welcome! Let's review this patient before we begin sedation.",
        'Based on the history and exam I just presented, what ASA class would you assign?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Choose the ASA class for this patient.',
        options: ['ASA 1', 'ASA 2', 'ASA 3', 'ASA 4'],
        correctAnswer: 'ASA 1',
        feedback: {
          'ASA 1': 'Correct! Healthy adult without systemic disease.',
          'ASA 2': 'Not quite. ASA 2 requires mild systemic disease, which this patient lacks.',
          'ASA 3': 'Too high. Reserve ASA 3 for severe systemic disease.',
          'ASA 4': 'Far too high. ASA 4 is constant threat to life.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 0.29 },
      ],
      highlight: ['airway-nasal_cannula', 'fio2-slider'],
      teachingPoints: ['ASA classification drives your sedation plan and monitoring level.'],
    },
    {
      id: 'step_first_midazolam',
      phase: 'induction',
      triggerType: 'on_step_complete',
      afterStepId: 'step_asa',
      millieDialogue: [
        "Good. Now let's begin titrating sedation.",
        'What initial midazolam dose would you choose for this healthy adult?',
      ],
      question: {
        type: 'numeric_range',
        prompt: 'Enter midazolam dose in mg',
        correctAnswer: 1,
        idealRange: [0.5, 1],
        feedback: {
          low: 'Below 0.5 mg provides minimal anxiolysis.',
          ideal: 'Good choice. 0.5-1 mg provides anxiolysis with low risk in healthy adults.',
          high: 'Above 1 mg initial dose may overshoot the target MOASS in a healthy adult.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'midazolam', dose: 1 },
        { type: 'advance_time', seconds: 90 },
      ],
      highlight: ['midazolam-1'],
      teachingPoints: [
        'Benzodiazepines provide anxiolysis and amnesia but can cause respiratory depression.',
        'Allow 60-90 seconds between doses to see full effect before redosing.',
      ],
    },
    {
      id: 'step_fentanyl',
      phase: 'induction',
      triggerType: 'on_step_complete',
      afterStepId: 'step_first_midazolam',
      millieDialogue: [
        'The patient appears more relaxed but the colonoscopy will cause discomfort.',
        'What fentanyl dose would you give for analgesia?',
      ],
      question: {
        type: 'numeric_range',
        prompt: 'Enter fentanyl dose in mcg',
        correctAnswer: 50,
        idealRange: [25, 50],
        feedback: {
          low: 'Below 25 mcg may not provide adequate analgesia for colonoscopy.',
          ideal: 'Good choice. 25-50 mcg provides analgesia with minimal respiratory depression.',
          high: 'Above 50 mcg initial dose risks significant respiratory depression, especially combined with midazolam.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'fentanyl', dose: 50 },
        { type: 'advance_time', seconds: 120 },
      ],
      highlight: ['fentanyl-50'],
      teachingPoints: [
        'Opioid-benzodiazepine synergy: combined effect on respiratory drive is greater than either alone.',
        'Monitor RR and EtCO2 closely after adding fentanyl to midazolam.',
      ],
    },
    {
      id: 'step_maintenance_monitoring',
      phase: 'maintenance',
      triggerType: 'on_step_complete',
      afterStepId: 'step_fentanyl',
      millieDialogue: [
        'Good. The colonoscopy is now underway. Monitor the patient closely.',
        'Watch SpO2, EtCO2, and respiratory rate — these are your early warning indicators.',
      ],
      simActions: [
        { type: 'advance_time', seconds: 120 },
      ],
      teachingPoints: [
        'During maintenance, continuously monitor SpO2, EtCO2, HR, and BP.',
        'Capnography (EtCO2) changes are the earliest sign of hypoventilation — earlier than SpO2 drops.',
      ],
    },
    {
      id: 'step_desat_event',
      phase: 'complication',
      triggerType: 'on_physiology',
      triggerCondition: { parameter: 'spo2', operator: '<', threshold: 93, durationSeconds: 15 },
      millieDialogue: [
        'SpO2 is dropping below 93%. This is an early warning sign.',
        'What is your first-line response?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Best immediate action?',
        options: [
          'Increase O2 and perform chin lift/jaw thrust',
          'Give more midazolam',
          'Do nothing and observe',
          'Administer naloxone immediately',
        ],
        correctAnswer: 'Increase O2 and perform chin lift/jaw thrust',
        feedback: {
          'Increase O2 and perform chin lift/jaw thrust': 'Correct! Address airway and oxygenation first.',
          'Give more midazolam': 'Dangerous. This will worsen respiratory depression.',
          'Do nothing and observe': 'Risky. Early intervention prevents deeper desaturation.',
          'Administer naloxone immediately': 'Not first-line unless strong suspicion of pure opioid overdose.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'jaw_thrust' },
        { type: 'set_fio2', fio2: 0.40 },
      ],
      highlight: ['spo2-display', 'fio2-slider'],
      teachingPoints: [
        'Simple airway maneuvers and supplemental O2 correct most early desaturation.',
        'EtCO2 rises before SpO2 falls - capnography is your early warning system.',
      ],
    },
    {
      id: 'step_end',
      phase: 'recovery',
      triggerType: 'on_time',
      triggerTimeSeconds: 360,
      millieDialogue: [
        'The colonoscopy is complete. The patient is waking up nicely.',
        'What is the minimum MOASS level for safe discharge to PACU from the procedure room?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Minimum MOASS for discharge from procedure room?',
        options: ['MOASS 1', 'MOASS 2', 'MOASS 3', 'MOASS 4'],
        correctAnswer: 'MOASS 3',
        feedback: {
          'MOASS 1': 'Too sedated — not safe for routine discharge.',
          'MOASS 2': 'Close, but most guidelines require MOASS 3 or better before PACU transfer.',
          'MOASS 3': 'Correct. MOASS 3 (responds to voice) is generally the minimum for safe transfer.',
          'MOASS 4': 'Correct as a threshold but waiting for MOASS 4 may delay necessary care.',
        },
      },
      simActions: [],
      teachingPoints: [
        'Always confirm the patient can protect their airway before transfer.',
        'Document time to discharge criteria — important for billing and quality metrics.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'At what point could you have anticipated the desaturation earlier?',
      'How might you adjust your dosing strategy next time?',
      'Were your monitoring choices appropriate for this risk profile?',
    ],
    keyTakeaways: [
      'Start with small incremental doses and allow time to assess effect.',
      'Use capnography as an early indicator of hypoventilation.',
      'Even routine colonoscopy in ASA 1 patients requires full monitoring and rescue readiness.',
    ],
  },
};

export const EASY_DENTAL_EXTRACTION: InteractiveScenario = {
  id: 'easy_dental_extraction',
  title: 'Simple Dental Extraction - Anxious Young Adult',
  difficulty: 'easy',
  patientArchetype: 'anxious_young',
  procedure: 'Wisdom Tooth Extraction',
  description: 'Dental anxious young woman for wisdom tooth removal. Teach careful titration and the importance of waiting for drug effect.',
  learningObjectives: [
    'Recognize dental anxiety as a modifier for sedation planning',
    'Titrate midazolam slowly in a low-weight anxious patient',
    'Understand effect-site equilibration delay',
    'Recognize adequate anxiolysis vs. oversedation',
  ],
  clinicalPearls: [
    'Anxious patients may need slightly higher doses but are also at risk of oversedation if redosed too quickly',
    'Effect-site equilibration for midazolam takes 1-2 minutes — wait before redosing',
    'Nasal hood O2 is standard for dental sedation',
    'Titrate to MOASS 3-4 for dental procedures — light sedation is usually sufficient',
  ],
  preopVignette: {
    indication: 'Removal of impacted wisdom teeth under IV sedation',
    setting: 'Outpatient dental office with sedation capability',
    history: [
      '35-year-old female, significant dental anxiety',
      'No systemic disease, ASA 1. Weight: 62 kg',
      'No prior IV sedation, reports severe needle phobia',
      'No medications, NKDA',
    ],
    exam: [
      'Airway: Mallampati I, good mouth opening',
      'Vitals baseline: HR 92 (anxiety), BP 128/78, SpO2 99%',
    ],
    baselineMonitors: ['SpO2 (pulse oximetry)', 'NIBP', 'Capnography via nasal sampling'],
    targetSedationGoal: 'MOASS 3-4 (light to moderate sedation)',
  },
  drugProtocols: [
    { name: 'midazolam', route: 'IV', typicalBolusRange: [0.5, 1], maxTotalDose: 4, unit: 'mg' },
    { name: 'fentanyl', route: 'IV', typicalBolusRange: [25, 50], maxTotalDose: 100, unit: 'mcg' },
  ],
  steps: [
    {
      id: 'step_preop_plan',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        "Meet Sarah, a 35-year-old with severe dental anxiety here for wisdom tooth removal.",
        'Before giving any medications, what is the most important first step?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Most important pre-sedation step?',
        options: [
          'Place IV and apply all monitors before giving any drug',
          'Give midazolam 2 mg IM to calm her anxiety immediately',
          'Start O2 via nasal cannula and proceed without IV',
          'Ask the dentist to start without sedation',
        ],
        correctAnswer: 'Place IV and apply all monitors before giving any drug',
        feedback: {
          'Place IV and apply all monitors before giving any drug': 'Correct! Monitors first, then IV access, then medications — always.',
          'Give midazolam 2 mg IM to calm her anxiety immediately': 'Never give sedation without monitors and IV access established first.',
          'Start O2 via nasal cannula and proceed without IV': 'O2 is good but you still need IV access and all monitors before any sedation.',
          'Ask the dentist to start without sedation': 'This patient is a good candidate for sedation — do not skip it.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_hood' },
        { type: 'set_fio2', fio2: 0.35 },
      ],
      highlight: ['fio2-slider'],
      teachingPoints: [
        'ASA guidelines require monitors (SpO2, NIBP, ECG, capnography) active before sedation starts.',
        'IV access is mandatory for reversal agents and rescue drugs.',
      ],
    },
    {
      id: 'step_midazolam_dose',
      phase: 'induction',
      triggerType: 'on_step_complete',
      afterStepId: 'step_preop_plan',
      millieDialogue: [
        'Monitors are on, IV placed. The patient is extremely anxious — HR is 92.',
        'What is your initial midazolam dose for this 62 kg woman?',
      ],
      question: {
        type: 'numeric_range',
        prompt: 'Initial midazolam IV dose in mg',
        correctAnswer: 1,
        idealRange: [0.5, 1],
        feedback: {
          low: 'Below 0.5 mg is unlikely to provide meaningful anxiolysis.',
          ideal: '0.5-1 mg is ideal for initial anxiolysis in this patient. Wait 90 seconds before redosing.',
          high: 'Above 1 mg as an initial dose may overshoot in this 62 kg patient — start low, titrate slowly.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'midazolam', dose: 1 },
        { type: 'advance_time', seconds: 90 },
      ],
      highlight: ['midazolam-1'],
      teachingPoints: [
        'Weight matters: lower-weight patients need proportionally lower doses.',
        'Anxious baseline HR will fall as sedation takes effect — do not chase it with more drug.',
      ],
    },
    {
      id: 'step_fentanyl_analg',
      phase: 'induction',
      triggerType: 'on_step_complete',
      afterStepId: 'step_midazolam_dose',
      millieDialogue: [
        'Good — MOASS is now 4, patient is calmer. The dentist is ready to inject local anesthetic.',
        'Do you add fentanyl before local anesthetic injection?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Should you add fentanyl before local anesthetic injection?',
        options: [
          'Yes — 25 mcg IV for procedural analgesia',
          'No — local anesthetic provides all the analgesia needed',
          'Yes — 100 mcg IV for deep analgesia',
          'No — opioids are contraindicated with benzodiazepines',
        ],
        correctAnswer: 'Yes — 25 mcg IV for procedural analgesia',
        feedback: {
          'Yes — 25 mcg IV for procedural analgesia': 'Correct. A small opioid dose helps with the discomfort of injection and extraction.',
          'No — local anesthetic provides all the analgesia needed': "Local anesthetic takes time to work and doesn't prevent anxiety from sounds/pressure.",
          'Yes — 100 mcg IV for deep analgesia': 'Far too much — 100 mcg combined with midazolam risks apnea in this 62 kg patient.',
          'No — opioids are contraindicated with benzodiazepines': 'They can be combined carefully; the combination is common in sedation practice.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'fentanyl', dose: 25 },
        { type: 'advance_time', seconds: 180 },
      ],
      highlight: ['fentanyl-25'],
      teachingPoints: [
        'A small fentanyl dose (25-50 mcg) blunts the sympathetic response to injection and extraction.',
        'With midazolam on board, use the lower end of the opioid range.',
      ],
    },
    {
      id: 'step_oversedation_check',
      phase: 'maintenance',
      triggerType: 'on_time',
      triggerTimeSeconds: 300,
      millieDialogue: [
        'The extraction is underway. The patient seems very still — perhaps too still.',
        'MOASS appears to be 1-2. What should you do?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Patient appears deeply sedated (MOASS 1-2). Next action?',
        options: [
          'Sternal rub to assess depth, consider reducing or pausing stimulation',
          'Give more fentanyl to ensure comfort',
          'Increase O2 and continue — this is the desired depth',
          'Give flumazenil immediately',
        ],
        correctAnswer: 'Sternal rub to assess depth, consider reducing or pausing stimulation',
        feedback: {
          'Sternal rub to assess depth, consider reducing or pausing stimulation': 'Correct. Assess depth before acting — if oversedated, pause drug and monitor.',
          'Give more fentanyl to ensure comfort': 'Never add more drug when concerned about depth of sedation.',
          'Increase O2 and continue — this is the desired depth': 'MOASS 1-2 is too deep for dental sedation — this is oversedation.',
          'Give flumazenil immediately': 'Reversal not needed unless airway compromise — assess first, intervene proportionally.',
        },
      },
      simActions: [],
      teachingPoints: [
        'MOASS 1-2 means deep sedation — beyond the target for routine dental procedures.',
        'Verbal stimulation ("Sarah, open your mouth") is both a test of depth and a way to lighten sedation.',
      ],
    },
    {
      id: 'step_recovery',
      phase: 'recovery',
      triggerType: 'on_time',
      triggerTimeSeconds: 480,
      millieDialogue: [
        'The procedure is complete. The patient is waking up and asking where she is.',
        'How long must you monitor before discharging home?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Minimum post-sedation monitoring time before discharge?',
        options: ['15 minutes', '30 minutes', '60 minutes', 'No minimum — if MOASS 5, discharge immediately'],
        correctAnswer: '30 minutes',
        feedback: {
          '15 minutes': 'Too short — midazolam redistribution can cause resedation.',
          '30 minutes': 'Correct. 30 minutes minimum monitoring post-sedation before discharge, per ASA guidelines.',
          '60 minutes': '60 minutes is conservative but acceptable; standard minimum is 30 minutes.',
          'No minimum — if MOASS 5, discharge immediately': 'Incorrect. Drug effects can recurse — always observe for a defined minimum period.',
        },
      },
      simActions: [],
      teachingPoints: [
        'Discharge criteria include stable vitals, MOASS 5, no nausea, and a responsible adult escort.',
        'Never let sedated patients drive — this is a safety and legal requirement.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'How did the patient\'s low weight and anxiety affect your dosing choices?',
      'When is it appropriate to use flumazenil vs. supportive management?',
      'What discharge criteria would you use for this outpatient dental case?',
    ],
    keyTakeaways: [
      'Always establish monitors and IV access before any sedation.',
      'Titrate midazolam slowly in lower-weight patients — effect takes 60-90 seconds.',
      'Target MOASS 3-4 for dental sedation, not deep sedation.',
      'A 30-minute minimum monitoring period is required before discharge.',
    ],
  },
};

export const EASY_LACERATION_REPAIR: InteractiveScenario = {
  id: 'easy_laceration_repair',
  title: 'Laceration Repair - ED Mild Vasovagal',
  difficulty: 'easy',
  patientArchetype: 'healthy_adult',
  procedure: 'Emergency Department Laceration Repair',
  description: 'Young male in the ED for laceration repair under procedural sedation. Develops a mild vasovagal episode from pain and anxiety.',
  learningObjectives: [
    'Perform rapid pre-sedation assessment in an emergency setting',
    'Use ketamine as a dissociative analgesic for short procedures',
    'Recognize and manage vasovagal syncope during sedation',
    'Understand the emergence phenomenon with ketamine',
  ],
  clinicalPearls: [
    'Ketamine preserves airway reflexes and respiratory drive — ideal for short ED procedures',
    'Atropine pre-treatment reduces ketamine-associated hypersalivation',
    'Vasovagal episodes: Trendelenburg position + IV fluid bolus is first-line',
    'Quiet environment during emergence reduces dysphoric emergence reactions',
  ],
  preopVignette: {
    indication: 'Complex facial laceration repair requiring local + sedation',
    setting: 'Emergency department procedure room',
    history: [
      '28-year-old male, fell playing basketball, 6 cm facial laceration',
      'No medications, NKDA, no prior surgeries',
      'Reports vasovagal episode with blood draws in the past',
    ],
    exam: [
      'Airway: Normal, Mallampati I',
      'Anxious, HR 88, BP 118/74, SpO2 99%',
      'Laceration: 6 cm, full thickness, cheek',
    ],
    baselineMonitors: ['SpO2', 'NIBP', 'Continuous ECG'],
    targetSedationGoal: 'Dissociative sedation with ketamine (MOASS 1-2)',
  },
  drugProtocols: [
    { name: 'ketamine', route: 'IV', typicalBolusRange: [0.5, 1], maxTotalDose: 150, unit: 'mg' },
    { name: 'midazolam', route: 'IV', typicalBolusRange: [1, 2], maxTotalDose: 4, unit: 'mg' },
  ],
  steps: [
    {
      id: 'step_drug_choice',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        'A 28-year-old male needs laceration repair and has vasovagal history.',
        'Which sedation agent is best suited for this short procedure?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Best primary sedation agent for this short ED procedure?',
        options: ['Ketamine 1 mg/kg IV', 'Propofol 1.5 mg/kg IV', 'Midazolam 4 mg IV alone', 'Fentanyl 100 mcg IV alone'],
        correctAnswer: 'Ketamine 1 mg/kg IV',
        feedback: {
          'Ketamine 1 mg/kg IV': 'Correct! Ketamine provides dissociative analgesia while preserving airway reflexes — ideal for short ED procedures.',
          'Propofol 1.5 mg/kg IV': 'Propofol causes significant respiratory depression and hypotension — requires higher monitoring level than this setting.',
          'Midazolam 4 mg IV alone': 'Midazolam alone provides no analgesia — inadequate for laceration repair.',
          'Fentanyl 100 mcg IV alone': 'Opioid alone without hypnotic is inadequate for painful procedures and risks respiratory depression.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 0.29 },
      ],
      highlight: ['airway-nasal_cannula', 'fio2-slider'],
      teachingPoints: [
        'Ketamine: dissociative dose 1-2 mg/kg IV. Analgesic dose 0.3-0.5 mg/kg IV.',
        'Ketamine maintains pharyngeal-laryngeal reflexes and spontaneous respiration.',
        'Pre-treat with midazolam 1-2 mg to reduce emergence reactions.',
      ],
    },
    {
      id: 'step_ketamine_dose',
      phase: 'induction',
      triggerType: 'on_step_complete',
      afterStepId: 'step_drug_choice',
      millieDialogue: [
        'Good choice. The patient weighs 80 kg.',
        'What is the correct ketamine induction dose for dissociative sedation?',
      ],
      question: {
        type: 'numeric_range',
        prompt: 'Enter ketamine dose in mg (for 80 kg patient, target 1 mg/kg)',
        correctAnswer: 80,
        idealRange: [60, 100],
        feedback: {
          low: 'Below 60 mg (0.75 mg/kg) may be sub-dissociative — patient may have partial awareness.',
          ideal: '1 mg/kg (80 mg) is the standard dissociative dose. Well done.',
          high: 'Above 100 mg risks prolonged emergence and increased side effects — start at 1 mg/kg.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'midazolam', dose: 1 },
        { type: 'administer_drug', drug: 'ketamine', dose: 80 },
        { type: 'advance_time', seconds: 120 },
      ],
      highlight: ['midazolam-1', 'ketamine-100'],
      teachingPoints: [
        'Administer ketamine slowly over 30-60 seconds to reduce incidence of apnea and laryngospasm.',
        'Midazolam 1-2 mg co-administered reduces emergence dysphoria by ~50%.',
      ],
    },
    {
      id: 'step_ketamine_maintenance',
      phase: 'maintenance',
      triggerType: 'on_step_complete',
      afterStepId: 'step_ketamine_dose',
      millieDialogue: [
        'Good. Ketamine sedation is established. The laceration repair is underway.',
        'Maintain a quiet environment and minimise stimulation to reduce emergence phenomena.',
      ],
      simActions: [
        { type: 'advance_time', seconds: 120 },
      ],
      teachingPoints: [
        'Ketamine maintains airway reflexes and respiratory drive, making it ideal for brief procedural sedation.',
        'Monitor for hypersalivation — have suction available.',
      ],
    },
    {
      id: 'step_vasovagal',
      phase: 'complication',
      triggerType: 'on_physiology',
      triggerCondition: { parameter: 'hr', operator: '<', threshold: 55, durationSeconds: 10 },
      millieDialogue: [
        'HR has dropped to below 55 and BP is falling. Classic vasovagal pattern.',
        'What is your first-line treatment for this vasovagal episode?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'First-line treatment for vasovagal bradycardia/hypotension?',
        options: [
          'Trendelenburg position + IV fluid bolus',
          'Atropine 1 mg IV immediately',
          'Epinephrine 1 mg IV',
          'No treatment needed — observe',
        ],
        correctAnswer: 'Trendelenburg position + IV fluid bolus',
        feedback: {
          'Trendelenburg position + IV fluid bolus': 'Correct! Position and fluids are first-line for vasovagal.',
          'Atropine 1 mg IV immediately': 'Atropine is second-line for symptomatic vasovagal bradycardia, not first-line.',
          'Epinephrine 1 mg IV': 'Epinephrine is for anaphylaxis and cardiac arrest — not vasovagal.',
          'No treatment needed — observe': 'A symptomatic drop in HR + BP requires active management.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'chin_lift' },
        { type: 'set_fio2', fio2: 0.40 },
      ],
      highlight: ['hr-display', 'fio2-slider'],
      teachingPoints: [
        'Vasovagal syncope: triggered by pain, anxiety, or sight of blood. HR and BP both drop.',
        'Vagal maneuver reversal: leg elevation increases venous return rapidly.',
        'Atropine 0.5 mg IV is reserve for refractory cases.',
      ],
    },
    {
      id: 'step_emergence',
      phase: 'recovery',
      triggerType: 'on_time',
      triggerTimeSeconds: 360,
      millieDialogue: [
        'The laceration is repaired. The patient is emerging from ketamine.',
        'He appears confused and is mumbling. What is this and how do you manage it?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'The patient is confused after ketamine — most likely explanation?',
        options: [
          'Ketamine emergence phenomenon — manage with quiet environment and reassurance',
          'Hypoxic encephalopathy — check SpO2 and give O2',
          'Opioid overdose — give naloxone',
          'Stroke — activate stroke protocol',
        ],
        correctAnswer: 'Ketamine emergence phenomenon — manage with quiet environment and reassurance',
        feedback: {
          'Ketamine emergence phenomenon — manage with quiet environment and reassurance': 'Correct. This is expected after ketamine — minimize stimulation and reassure.',
          'Hypoxic encephalopathy — check SpO2 and give O2': 'Always check SpO2, but in the context of ketamine emergence this is expected.',
          'Opioid overdose — give naloxone': 'No opioids were given — naloxone would not help.',
          'Stroke — activate stroke protocol': 'Context matters — ketamine emergence is far more likely than acute stroke here.',
        },
      },
      simActions: [],
      teachingPoints: [
        'Ketamine emergence: minimize stimulation, dimmed lights, quiet voices.',
        'Preoperative midazolam significantly reduces emergence reactions.',
        'Most patients emerge smoothly within 10-15 minutes.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'How did the ketamine choice help manage the vasovagal risk?',
      'When would you choose propofol instead of ketamine for an ED procedure?',
      'What are contraindications to ketamine sedation?',
    ],
    keyTakeaways: [
      'Ketamine is the preferred agent for short, painful ED procedures.',
      'Always pre-treat with midazolam to reduce emergence dysphoria.',
      'Vasovagal: position + fluids first; atropine only for refractory bradycardia.',
      'Quiet emergence environment reduces ketamine recovery time and distress.',
    ],
  },
};

export const EASY_FRACTURE_REDUCTION: InteractiveScenario = {
  id: 'easy_fracture_reduction',
  title: 'Closed Fracture Reduction - Brief Desaturation',
  difficulty: 'easy',
  patientArchetype: 'healthy_adult',
  procedure: 'Closed Forearm Fracture Reduction',
  description: 'Healthy adult needs brief procedural sedation for closed forearm fracture reduction. A brief desaturation episode teaches chin lift technique.',
  learningObjectives: [
    'Select appropriate drugs for brief, painful orthopedic procedures',
    'Perform chin lift and jaw thrust for airway obstruction',
    'Titrate propofol for short procedure without deep oversedation',
    'Recognize transient desaturation vs. sustained respiratory compromise',
  ],
  clinicalPearls: [
    'Propofol provides excellent short-duration sedation but has a narrow therapeutic window',
    'Ketamine + propofol ("ketofol") reduces each drug\'s side effects',
    'Chin lift opens the oropharynx — most effective simple airway maneuver',
    'SpO2 of 92% for <15s with spontaneous recovery can be observed; <90% requires intervention',
  ],
  preopVignette: {
    indication: 'Closed reduction of distal radius fracture (Colles fracture)',
    setting: 'Emergency department procedure room',
    history: [
      '40-year-old female, fell on outstretched hand',
      'No significant medical history, no medications, NKDA',
      'Last meal: 4 hours ago (solid food)',
    ],
    exam: [
      'Airway: Mallampati I, normal mouth opening, neck supple',
      'Right wrist: dinner fork deformity, neurovascularly intact',
      'Vitals: HR 82, BP 126/80, SpO2 99%',
    ],
    baselineMonitors: ['SpO2', 'NIBP', 'Continuous ECG', 'EtCO2'],
    targetSedationGoal: 'Deep sedation (MOASS 1-2) for fracture reduction',
  },
  drugProtocols: [
    { name: 'propofol', route: 'IV', typicalBolusRange: [40, 80], maxTotalDose: 200, unit: 'mg' },
    { name: 'fentanyl', route: 'IV', typicalBolusRange: [25, 50], maxTotalDose: 150, unit: 'mcg' },
    { name: 'ketamine', route: 'IV', typicalBolusRange: [20, 40], maxTotalDose: 80, unit: 'mg' },
  ],
  steps: [
    {
      id: 'step_fasting',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        'A 40-year-old woman needs fracture reduction. She last ate 4 hours ago.',
        'The ASA fasting guidelines for solids require NPO for at least how many hours before elective sedation?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'ASA fasting guideline for solid food before elective sedation?',
        options: ['2 hours', '4 hours', '6 hours', '8 hours'],
        correctAnswer: '6 hours',
        feedback: {
          '2 hours': '2 hours applies to clear liquids only.',
          '4 hours': '4 hours applies to breast milk for infants.',
          '6 hours': 'Correct! The ASA "6-8-8 rule": 6h for light meal, 8h for heavy/fatty meal.',
          '8 hours': '8 hours is for heavy/fatty meals. Light meals require 6 hours minimum.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 0.29 },
      ],
      highlight: ['airway-nasal_cannula', 'fio2-slider'],
      teachingPoints: [
        'This is an emergency — fasting guidelines can be relaxed. Risk of aspiration must be weighed against urgency.',
        'In emergencies, have suction ready and consider rapid sequence approach.',
      ],
    },
    {
      id: 'step_induction_drug',
      phase: 'induction',
      triggerType: 'on_step_complete',
      afterStepId: 'step_fasting',
      millieDialogue: [
        'Good. Given the emergent nature, you proceed. What is an appropriate propofol induction dose for a 70 kg patient?',
      ],
      question: {
        type: 'numeric_range',
        prompt: 'Propofol induction dose in mg (target 1-1.5 mg/kg for 70 kg)',
        correctAnswer: 70,
        idealRange: [60, 100],
        feedback: {
          low: 'Below 60 mg may be insufficient for fracture reduction — a painful stimulus.',
          ideal: '1-1.5 mg/kg (70-100 mg) provides adequate sedation for reduction.',
          high: 'Above 100 mg as a single bolus risks apnea and significant hypotension.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'fentanyl', dose: 50 },
        { type: 'administer_drug', drug: 'propofol', dose: 80 },
        { type: 'advance_time', seconds: 60 },
      ],
      highlight: ['fentanyl-50', 'propofol-100'],
      teachingPoints: [
        'Propofol 1-1.5 mg/kg IV provides 5-10 minutes of procedural sedation.',
        'Always give opioid first (fentanyl 50 mcg) to reduce required propofol dose by 20-30%.',
      ],
    },
    {
      id: 'step_fracture_maintenance',
      phase: 'maintenance',
      triggerType: 'on_step_complete',
      afterStepId: 'step_induction_drug',
      millieDialogue: [
        'Sedation achieved. The orthopaedic team is performing the reduction.',
        'Keep the patient still and monitor closely — propofol sedation can be easily deepened or lightened.',
      ],
      simActions: [
        { type: 'advance_time', seconds: 120 },
      ],
      teachingPoints: [
        'Propofol allows rapid titration — its short context-sensitive half-life means quick offset.',
        'Watch for apnea in the first 60-90 seconds after bolus; have BVM immediately accessible.',
      ],
    },
    {
      id: 'step_desat',
      phase: 'complication',
      triggerType: 'on_physiology',
      triggerCondition: { parameter: 'spo2', operator: '<', threshold: 92, durationSeconds: 10 },
      millieDialogue: [
        'SpO2 has dipped to 91%. You notice the neck is slightly flexed and the mouth is closed.',
        'What simple maneuver should you perform immediately?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Immediate airway maneuver for positional obstruction?',
        options: ['Chin lift to open airway', 'Insert LMA immediately', 'Give naloxone 0.4 mg', 'Intubate the trachea'],
        correctAnswer: 'Chin lift to open airway',
        feedback: {
          'Chin lift to open airway': 'Correct! A simple chin lift opens the oropharynx and resolves most positional obstruction.',
          'Insert LMA immediately': 'LMA is a rescue airway — start with simple maneuvers first.',
          'Give naloxone 0.4 mg': 'Propofol (not opioid) is the primary cause — naloxone will not help.',
          'Intubate the trachea': 'Absolutely not first-line for brief, self-resolving sedation apnea.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'chin_lift' },
        { type: 'set_fio2', fio2: 0.40 },
      ],
      highlight: ['spo2-display', 'fio2-slider'],
      teachingPoints: [
        'Chin lift: extend the neck and lift the chin upward — opens pharyngeal airway.',
        'Jaw thrust: more powerful maneuver for suspected C-spine injury.',
        'Most propofol-induced apnea resolves with simple positioning within 30-60 seconds.',
      ],
    },
    {
      id: 'step_redose',
      phase: 'maintenance',
      triggerType: 'on_time',
      triggerTimeSeconds: 300,
      millieDialogue: [
        'The reduction is only halfway complete. SpO2 has recovered to 98%. Should you give a redose of propofol?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Propofol redose decision when procedure is incomplete?',
        options: [
          'Yes — give half the original dose (40 mg) if SpO2 and BP are stable',
          'No — once a desaturation happens, no more propofol',
          'Yes — give the full original dose again (80 mg)',
          'Switch to ketamine instead',
        ],
        correctAnswer: 'Yes — give half the original dose (40 mg) if SpO2 and BP are stable',
        feedback: {
          'Yes — give half the original dose (40 mg) if SpO2 and BP are stable': 'Correct. Redosing at 25-50% of initial dose is standard practice when needed.',
          'No — once a desaturation happens, no more propofol': 'A brief, corrected desaturation does not preclude continued sedation with appropriate caution.',
          'Yes — give the full original dose again (80 mg)': 'A full redose after recovery risks stacking — cumulative effect is greater than the initial.',
          'Switch to ketamine instead': 'Switching mid-procedure adds complexity — continue propofol with appropriate dose reduction.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'propofol', dose: 40 },
        { type: 'advance_time', seconds: 60 },
      ],
      highlight: ['propofol-50'],
      teachingPoints: [
        'Propofol redose: 25-50% of initial dose, titrated to effect.',
        'Monitor closely after each redose — cumulative drug effect builds.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'How did positioning affect the airway in this case?',
      'When is it appropriate to continue sedation after a brief desaturation?',
      'What role does pre-oxygenation play in prolonging apnea tolerance?',
    ],
    keyTakeaways: [
      'Chin lift is the first-line maneuver for positional airway obstruction during sedation.',
      'Pre-oxygenate patients before propofol to extend safe apnea window.',
      'Brief desaturation that corrects with positioning does not preclude continued sedation.',
      'Fentanyl pre-treatment reduces required propofol dose and respiratory depression.',
    ],
  },
};

export const EASY_ABSCESS_DRAINAGE: InteractiveScenario = {
  id: 'easy_abscess_drainage',
  title: 'Abscess Incision & Drainage - Propofol Hypotension',
  difficulty: 'easy',
  patientArchetype: 'healthy_adult',
  procedure: 'Abscess Incision and Drainage',
  description: 'Short procedure under propofol sedation. Patient develops mild hypotension after bolus — teaches propofol pharmacology and hypotension management.',
  learningObjectives: [
    'Understand propofol-induced vasodilation and hypotension mechanism',
    'Recognize and treat mild procedural hypotension',
    'Use smallest effective propofol dose for short procedures',
    'Know when to use IV fluid vs. vasopressor for hypotension',
  ],
  clinicalPearls: [
    'Propofol causes dose-dependent vasodilation and myocardial depression',
    'Hypotension threshold: SBP <90 mmHg or >20% drop from baseline',
    'Treatment: reduce infusion rate, fluid bolus, consider phenylephrine for refractory cases',
    'Pre-loading with 250-500 mL NS reduces propofol hypotension incidence',
  ],
  preopVignette: {
    indication: 'I&D of large gluteal abscess requiring short procedural sedation',
    setting: 'Emergency department procedure room',
    history: [
      '32-year-old male, ASA 2 (DM type 2, well controlled)',
      'Large painful gluteal abscess for 3 days',
      'Metformin only, NKDA',
      'Baseline BP: 128/82 — slightly elevated from pain',
    ],
    exam: [
      'Airway: Mallampati I, normal',
      'Large fluctuant abscess, 8 cm, right gluteal region',
      'Vitals: HR 96 (pain), BP 128/82, SpO2 98%',
    ],
    baselineMonitors: ['SpO2', 'NIBP q3min', 'ECG'],
    targetSedationGoal: 'MOASS 2-3 (procedural sedation)',
  },
  drugProtocols: [
    { name: 'propofol', route: 'IV', typicalBolusRange: [40, 80], maxTotalDose: 200, unit: 'mg' },
    { name: 'fentanyl', route: 'IV', typicalBolusRange: [25, 50], maxTotalDose: 150, unit: 'mcg' },
  ],
  steps: [
    {
      id: 'step_asa_class',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        'This 32-year-old male has well-controlled type 2 diabetes.',
        'What ASA class does well-controlled type 2 DM assign?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'ASA class for well-controlled DM2?',
        options: ['ASA 1', 'ASA 2', 'ASA 3', 'ASA 4'],
        correctAnswer: 'ASA 2',
        feedback: {
          'ASA 1': 'ASA 1 is for completely healthy patients with no systemic disease.',
          'ASA 2': 'Correct! Well-controlled DM2 = mild systemic disease = ASA 2.',
          'ASA 3': 'ASA 3 is for poorly controlled DM or DM with end-organ damage.',
          'ASA 4': 'Far too high for well-controlled DM without complications.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 0.29 },
      ],
      highlight: ['airway-nasal_cannula', 'fio2-slider'],
      teachingPoints: ['Well-controlled chronic diseases (DM, HTN) classify as ASA 2. End-organ damage bumps to ASA 3.'],
    },
    {
      id: 'step_propofol_induction',
      phase: 'induction',
      triggerType: 'on_step_complete',
      afterStepId: 'step_asa_class',
      millieDialogue: [
        'You pre-treat with fentanyl 50 mcg. Now you give propofol.',
        'What is a reasonable propofol induction dose for this 80 kg, ASA 2 patient?',
      ],
      question: {
        type: 'numeric_range',
        prompt: 'Propofol induction dose in mg (target 0.75-1 mg/kg for ASA 2)',
        correctAnswer: 70,
        idealRange: [50, 80],
        feedback: {
          low: 'Below 50 mg may be insufficient for procedural sedation.',
          ideal: '0.75-1 mg/kg (60-80 mg) is appropriate for ASA 2 procedural sedation.',
          high: 'Above 80 mg risks hypotension in this ASA 2 patient — reduce the dose for comorbidities.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'fentanyl', dose: 50 },
        { type: 'administer_drug', drug: 'propofol', dose: 70 },
        { type: 'advance_time', seconds: 90 },
      ],
      highlight: ['fentanyl-50', 'propofol-50'],
      teachingPoints: [
        'Reduce propofol dose by 20% for ASA 2 patients, 30-40% for ASA 3.',
        'Inject propofol slowly (over 30s) to reduce pain on injection and blunt BP drop.',
      ],
    },
    {
      id: 'step_abscess_maintenance',
      phase: 'maintenance',
      triggerType: 'on_step_complete',
      afterStepId: 'step_propofol_induction',
      millieDialogue: [
        'Sedation is underway. The surgeon is incising and draining the abscess.',
        'Watch BP closely — propofol can cause vasodilation and hypotension especially in older patients.',
      ],
      simActions: [
        { type: 'advance_time', seconds: 120 },
      ],
      teachingPoints: [
        'Propofol reduces systemic vascular resistance — have a vasopressor (phenylephrine or ephedrine) drawn up.',
        'Ensure IV access is functioning well before induction; hypotension requires rapid fluid bolus or vasopressor.',
      ],
    },
    {
      id: 'step_hypotension',
      phase: 'complication',
      triggerType: 'on_physiology',
      triggerCondition: { parameter: 'sbp', operator: '<', threshold: 90, durationSeconds: 10 },
      millieDialogue: [
        'BP has dropped to 85/50. The patient is still breathing but SpO2 is stable at 97%.',
        'What is the best immediate intervention for propofol-induced hypotension?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Best immediate treatment for propofol hypotension with stable SpO2?',
        options: [
          'IV fluid bolus 250-500 mL NS + leg elevation',
          'Give epinephrine 1 mg IV',
          'Increase propofol infusion to deepen sedation',
          'No treatment — propofol hypotension always self-resolves',
        ],
        correctAnswer: 'IV fluid bolus 250-500 mL NS + leg elevation',
        feedback: {
          'IV fluid bolus 250-500 mL NS + leg elevation': 'Correct! Fluid bolus + position restores preload. First-line for propofol hypotension.',
          'Give epinephrine 1 mg IV': 'Epinephrine is for anaphylaxis and cardiac arrest — not propofol vasodilation.',
          'Increase propofol infusion to deepen sedation': 'More propofol will worsen the hypotension — reduce or stop the infusion.',
          'No treatment — propofol hypotension always self-resolves': 'SBP <90 requires active management — do not wait.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'chin_lift' },
        { type: 'set_fio2', fio2: 0.40 },
      ],
      highlight: ['bp-display', 'fio2-slider'],
      teachingPoints: [
        'Propofol vasodilation: direct inhibition of vascular smooth muscle Ca2+ channels.',
        'Pre-loading with 250 mL NS before propofol reduces hypotension incidence significantly.',
        'Phenylephrine 100-200 mcg IV is the vasopressor of choice for pure vasodilatory hypotension.',
      ],
    },
    {
      id: 'step_end_of_procedure',
      phase: 'recovery',
      triggerType: 'on_time',
      triggerTimeSeconds: 300,
      millieDialogue: [
        'The abscess has been drained. BP has recovered to 110/70. Patient is waking.',
        'You want to send the patient home — what is the minimum discharge systolic BP?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Minimum systolic BP for discharge after sedation?',
        options: ['70 mmHg', '80 mmHg', '90 mmHg', '100 mmHg'],
        correctAnswer: '90 mmHg',
        feedback: {
          '70 mmHg': 'Too low — this is hemodynamic instability, not acceptable for discharge.',
          '80 mmHg': 'Still below acceptable threshold for discharge.',
          '90 mmHg': 'Correct. SBP ≥90 mmHg is the minimum threshold for discharge from post-sedation monitoring.',
          '100 mmHg': 'A conservative threshold — acceptable if required by institutional policy.',
        },
      },
      simActions: [],
      teachingPoints: [
        'Discharge criteria: stable vitals (SBP ≥90), MOASS 5, no nausea/vomiting, responsible adult escort.',
        'Document recovery room time — most guidelines require 30 minutes minimum.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'How does propofol cause hypotension, and what preemptive measures can you take?',
      'At what point would you escalate from fluids to vasopressors?',
      'How does ASA classification influence your propofol dosing strategy?',
    ],
    keyTakeaways: [
      'Propofol causes dose-dependent vasodilation — reduce dose for ASA 2+ patients.',
      'Pre-load with 250 mL NS before propofol to attenuate hypotension.',
      'Fluid bolus + leg elevation is first-line for propofol hypotension.',
      'Phenylephrine is the vasopressor of choice for pure vasodilatory hypotension.',
    ],
  },
};

export const EASY_SCENARIOS: InteractiveScenario[] = [
  EASY_COLONOSCOPY,
  EASY_DENTAL_EXTRACTION,
  EASY_LACERATION_REPAIR,
  EASY_FRACTURE_REDUCTION,
  EASY_ABSCESS_DRAINAGE,
];
