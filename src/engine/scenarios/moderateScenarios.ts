import { InteractiveScenario } from '../ScenarioEngine';

export const MOD_ELDERLY_COPD: InteractiveScenario = {
  id: 'mod_elderly_copd',
  title: 'Elderly COPD Patient - Colonoscopy',
  difficulty: 'moderate',
  patientArchetype: 'elderly',
  procedure: 'Colonoscopy',
  description: 'Elderly patient with COPD needs colonoscopy sedation. Progressive desaturation requires proactive O2 supplementation and dose reduction.',
  learningObjectives: [
    'Modify sedation plan for elderly patients with pulmonary disease',
    'Recognize COPD-specific risk factors for sedation',
    'Titrate sedation conservatively in high-risk respiratory patients',
    'Manage progressive desaturation proactively',
  ],
  clinicalPearls: [
    'COPD patients have reduced respiratory reserve — even mild sedation can cause significant hypoventilation',
    'Hypoxic drive: some COPD patients rely on hypoxic drive — high FiO2 may blunt ventilation',
    'Elderly patients require 30-50% dose reduction due to altered pharmacokinetics',
    'Capnography is essential — rising EtCO2 precedes desaturation by minutes',
  ],
  preopVignette: {
    indication: 'Surveillance colonoscopy for colon polyps',
    setting: 'Ambulatory endoscopy unit',
    history: [
      '72-year-old male, COPD GOLD stage II (FEV1 58%), ex-smoker',
      'Hypertension, hyperlipidemia — ASA 3',
      'Medications: tiotropium, salbutamol, lisinopril, atorvastatin',
      'SpO2 on room air at baseline: 95%',
    ],
    exam: [
      'Airway: Mallampati 2, adequate mouth opening, mild barrel chest',
      'Lungs: Bilateral expiratory wheeze, prolonged expiratory phase',
      'HR 72, BP 142/88, SpO2 95% on room air',
    ],
    labs: ['ABG (recent): pH 7.40, PaCO2 46, PaO2 72 — mild chronic CO2 retention'],
    baselineMonitors: ['SpO2 (continuous)', 'EtCO2 (capnography)', 'NIBP q3min', 'ECG'],
    targetSedationGoal: 'MOASS 2-3 — light to moderate sedation only',
  },
  drugProtocols: [
    { name: 'fentanyl', route: 'IV', typicalBolusRange: [25, 50], maxTotalDose: 100, unit: 'mcg' },
    { name: 'midazolam', route: 'IV', typicalBolusRange: [0.5, 1], maxTotalDose: 3, unit: 'mg' },
    { name: 'propofol', route: 'IV', typicalBolusRange: [20, 40], maxTotalDose: 100, unit: 'mg' },
  ],
  steps: [
    {
      id: 'step_risk_assess',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        "Let's review our 72-year-old COPD patient. His baseline SpO2 is 95% on room air.",
        'Which factor most increases his sedation risk compared to a healthy adult?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Greatest sedation risk factor in this patient?',
        options: [
          'Reduced respiratory reserve from COPD',
          'His age alone',
          'Hypertension',
          'Hyperlipidemia',
        ],
        correctAnswer: 'Reduced respiratory reserve from COPD',
        feedback: {
          'Reduced respiratory reserve from COPD': 'Correct! COPD reduces the buffer for drug-induced hypoventilation.',
          'His age alone': 'Age is important (altered PK) but COPD is the dominant respiratory risk factor.',
          'Hypertension': 'Hypertension is a cardiovascular risk but not the primary sedation risk here.',
          'Hyperlipidemia': 'Hyperlipidemia has minimal direct impact on sedation safety.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 0.32 },
      ],
      highlight: ['airway-nasal_cannula', 'fio2-slider'],
      teachingPoints: [
        'COPD reduces FRC and increases V/Q mismatch — small doses cause disproportionate desaturation.',
        'Elderly + COPD: reduce all sedative doses by 30-50% from the standard.',
      ],
    },
    {
      id: 'step_fentanyl_dose',
      phase: 'induction',
      triggerType: 'on_step_complete',
      afterStepId: 'step_risk_assess',
      millieDialogue: [
        'You decide to use fentanyl + midazolam conservatively.',
        'What is an appropriate initial fentanyl dose for this elderly COPD patient?',
      ],
      question: {
        type: 'numeric_range',
        prompt: 'Initial fentanyl dose in mcg (reduce by ~50% for elderly COPD)',
        correctAnswer: 25,
        idealRange: [15, 25],
        feedback: {
          low: 'Below 15 mcg may provide insufficient analgesia even for elderly patients.',
          ideal: '25 mcg is appropriate for this elderly COPD patient — conservative start.',
          high: 'Above 25 mcg initial dose is too high for elderly COPD — risks respiratory depression.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'fentanyl', dose: 25 },
        { type: 'administer_drug', drug: 'midazolam', dose: 0.5 },
        { type: 'advance_time', seconds: 120 },
      ],
      highlight: ['fentanyl-25', 'midazolam-0.5'],
      teachingPoints: [
        'Start low, go slow: elderly COPD patients are exquisitely sensitive to opioid respiratory depression.',
        'Midazolam 0.5 mg is adequate for an elderly patient — do not default to 1-2 mg.',
      ],
    },
    {
      id: 'step_copd_maintenance',
      phase: 'maintenance',
      triggerType: 'on_step_complete',
      afterStepId: 'step_fentanyl_dose',
      millieDialogue: [
        'Sedation is established. The procedure is underway.',
        'In COPD patients, monitor EtCO2 vigilantly — their hypoxic drive means CO2 accumulates faster.',
      ],
      simActions: [
        { type: 'advance_time', seconds: 120 },
      ],
      teachingPoints: [
        'COPD patients rely more on hypoxic drive — excessive supplemental O2 can blunt this response.',
        'Rising EtCO2 is your earliest warning of hypoventilation in this patient.',
      ],
    },
    {
      id: 'step_etco2_rising',
      phase: 'complication',
      triggerType: 'on_physiology',
      triggerCondition: { parameter: 'etco2', operator: '>', threshold: 50, durationSeconds: 20 },
      millieDialogue: [
        'EtCO2 is rising above 50 mmHg. SpO2 is still 93% but trending down.',
        'What does a rising EtCO2 indicate in a sedated patient?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Rising EtCO2 during sedation most likely indicates?',
        options: [
          'Hypoventilation — CO2 accumulating due to reduced respiratory drive',
          'Hyperventilation from anxiety',
          'Normal capnography variation',
          'Equipment malfunction only',
        ],
        correctAnswer: 'Hypoventilation — CO2 accumulating due to reduced respiratory drive',
        feedback: {
          'Hypoventilation — CO2 accumulating due to reduced respiratory drive': 'Correct! Rising EtCO2 = CO2 retention = hypoventilation. Act before SpO2 drops.',
          'Hyperventilation from anxiety': 'Hyperventilation causes EtCO2 to fall, not rise.',
          'Normal capnography variation': 'EtCO2 >50 in a patient with a known baseline of 46 is not normal variation.',
          'Equipment malfunction only': 'Always assume real until proven otherwise — treat the patient, not the monitor.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'chin_lift' },
        { type: 'set_fio2', fio2: 0.40 },
      ],
      highlight: ['rr-display', 'fio2-slider'],
      teachingPoints: [
        'EtCO2 is your earliest warning of respiratory depression — acts 2-5 minutes before SpO2 drops.',
        'Target EtCO2: <50 mmHg during sedation. Trending up = time to act.',
        'In COPD, mild hypercapnia (PaCO2 46-50) is acceptable; acute rise above baseline is not.',
      ],
    },
    {
      id: 'step_desat_rescue',
      phase: 'complication',
      triggerType: 'on_physiology',
      triggerCondition: { parameter: 'spo2', operator: '<', threshold: 90, durationSeconds: 10 },
      millieDialogue: [
        'SpO2 has now dropped to 89%! You have already done chin lift and increased O2.',
        'What is the next escalation step?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'SpO2 89% despite chin lift and supplemental O2 — next step?',
        options: [
          'Jaw thrust + stimulate patient verbally to breathe',
          'Intubate immediately',
          'Give more midazolam',
          'Continue to observe — COPD patients tolerate low SpO2',
        ],
        correctAnswer: 'Jaw thrust + stimulate patient verbally to breathe',
        feedback: {
          'Jaw thrust + stimulate patient verbally to breathe': 'Correct. Escalate airway maneuvers and stimulate respiration before invasive rescue.',
          'Intubate immediately': 'Premature — exhaust non-invasive measures first.',
          'Give more midazolam': 'Absolutely not. This would worsen respiratory depression.',
          'Continue to observe — COPD patients tolerate low SpO2': 'Dangerous misconception. SpO2 <90 requires active management in any patient.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'jaw_thrust' },
        { type: 'set_fio2', fio2: 0.44 },
      ],
      highlight: ['spo2-display', 'fio2-slider'],
      teachingPoints: [
        'Escalation ladder: verbal stimulation → chin lift → jaw thrust → nasal airway → BVM.',
        'SpO2 <90% in a COPD patient is a critical threshold requiring immediate action.',
      ],
    },
    {
      id: 'step_procedure_end',
      phase: 'recovery',
      triggerType: 'on_time',
      triggerTimeSeconds: 480,
      millieDialogue: [
        'The colonoscopy is complete. SpO2 recovered to 94%. You are in recovery.',
        'What monitoring level does this COPD patient need in the recovery area?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Appropriate post-sedation monitoring for COPD patient?',
        options: [
          'SpO2 + capnography monitoring for at least 30 minutes',
          'Discharge immediately if MOASS 5',
          'ICU admission for all COPD patients post-sedation',
          'Only pulse ox for 10 minutes',
        ],
        correctAnswer: 'SpO2 + capnography monitoring for at least 30 minutes',
        feedback: {
          'SpO2 + capnography monitoring for at least 30 minutes': 'Correct. COPD patients need extended monitoring — drug redistribution can cause late desaturation.',
          'Discharge immediately if MOASS 5': 'MOASS 5 is necessary but not sufficient — SpO2 at baseline is also required.',
          'ICU admission for all COPD patients post-sedation': 'Not required for uncomplicated recovery — but extended step-down monitoring is appropriate.',
          'Only pulse ox for 10 minutes': 'Insufficient for a COPD patient who had intraoperative desaturation.',
        },
      },
      simActions: [],
      teachingPoints: [
        'Discharge criterion for COPD: SpO2 back to preoperative baseline on room air.',
        'Extended recovery monitoring (30-60 min) is appropriate for any patient with intraoperative desaturation.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'How would your plan differ if this patient had baseline SpO2 of 90% on room air?',
      'At what point would you cancel the procedure due to respiratory concerns?',
      'How does COPD affect your choice between fentanyl and propofol?',
    ],
    keyTakeaways: [
      'COPD: reduce all sedative doses by 30-50% and use capnography proactively.',
      'EtCO2 >50 during sedation is an early warning requiring intervention.',
      'Escalation ladder: chin lift → jaw thrust → nasal airway → BVM.',
      'Discharge requires return to baseline SpO2 on room air, not just MOASS 5.',
    ],
  },
};

export const MOD_OBESE_OSA: InteractiveScenario = {
  id: 'mod_obese_osa',
  title: 'Obese OSA Patient - Upper GI Endoscopy',
  difficulty: 'moderate',
  patientArchetype: 'obese_osa',
  procedure: 'Upper GI Endoscopy (EGD)',
  description: 'Obese patient with OSA for upper GI endoscopy. High risk of partial airway obstruction from pharyngeal soft tissue collapse under sedation.',
  learningObjectives: [
    'Assess Mallampati score and OSA risk for sedation planning',
    'Apply proactive airway strategies for obese OSA patients',
    'Recognize and manage partial airway obstruction',
    'Understand the role of CPAP and NPA in managing OSA airway',
  ],
  clinicalPearls: [
    'OSA patients: pharyngeal muscles relax under sedation → upper airway collapse',
    'STOP-BANG score ≥5 = high OSA risk',
    'Supine position worsens OSA — consider lateral positioning when possible',
    'Nasal pharyngeal airway (NPA) is highly effective for partial obstruction in awake/lightly sedated patients',
  ],
  preopVignette: {
    indication: 'Dysphagia evaluation with upper GI endoscopy',
    setting: 'Endoscopy suite',
    history: [
      '55-year-old female, BMI 42, OSA on home CPAP',
      'STOP-BANG score: 6/8 (high risk)',
      'Mallampati 3, short neck, limited mouth opening',
      'ASA 3, Hypertension, on CPAP nightly',
    ],
    exam: [
      'Airway: Mallampati 3, short neck, BMI 42',
      'BP: 148/92, HR 78, SpO2 97% on room air',
      'Lungs clear, no wheezing',
    ],
    baselineMonitors: ['SpO2', 'Continuous capnography', 'NIBP q3min', 'ECG'],
    targetSedationGoal: 'MOASS 2-3 — avoid deep sedation in high-risk OSA airway',
  },
  drugProtocols: [
    { name: 'propofol', route: 'IV', typicalBolusRange: [20, 40], maxTotalDose: 150, unit: 'mg' },
    { name: 'fentanyl', route: 'IV', typicalBolusRange: [25, 50], maxTotalDose: 100, unit: 'mcg' },
  ],
  steps: [
    {
      id: 'step_stopbang',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        "This patient has a STOP-BANG score of 6. Let's think about airway strategy.",
        'With Mallampati 3 and OSA, which airway device should you have immediately available (not necessarily placed, but ready)?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Rescue airway to have immediately available for this high-risk OSA patient?',
        options: [
          'Laryngeal mask airway (LMA) + bag-mask + crash cart',
          'No special preparation needed for moderate sedation',
          'Nasopharyngeal airway only',
          'Surgical airway kit only',
        ],
        correctAnswer: 'Laryngeal mask airway (LMA) + bag-mask + crash cart',
        feedback: {
          'Laryngeal mask airway (LMA) + bag-mask + crash cart': 'Correct! High-risk airway = full rescue kit at bedside before sedation starts.',
          'No special preparation needed for moderate sedation': 'Wrong. OSA + Mallampati 3 mandates advanced airway preparedness.',
          'Nasopharyngeal airway only': 'NPA is useful but insufficient as the sole rescue airway for Mallampati 3.',
          'Surgical airway kit only': 'Surgical airway is last resort — prepare bag-mask and LMA first.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 0.40 },
      ],
      highlight: ['airway-nasal_cannula', 'fio2-slider'],
      teachingPoints: [
        'STOPBANG ≥5: have anesthesia backup, difficult airway cart, and LMA ready before starting.',
        'Pre-oxygenate with 100% O2 for 3-5 minutes to build O2 reserve — extends apnea tolerance.',
      ],
    },
    {
      id: 'step_drug_dose',
      phase: 'induction',
      triggerType: 'on_step_complete',
      afterStepId: 'step_stopbang',
      millieDialogue: [
        'Patient is pre-oxygenated. For this 130 kg OSA patient, you want minimal propofol.',
        'What is a safe initial propofol dose for induction in this high-risk patient?',
      ],
      question: {
        type: 'numeric_range',
        prompt: 'Initial propofol dose in mg for this 130 kg OSA patient (use lean body weight ~80 kg, target 0.5 mg/kg)',
        correctAnswer: 40,
        idealRange: [30, 50],
        feedback: {
          low: 'Below 30 mg will be insufficient for even light sedation.',
          ideal: '40 mg (0.5 mg/kg lean body weight) is appropriate — conservative for high-risk airway.',
          high: 'Above 50 mg risks airway obstruction and apnea in this OSA patient.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'fentanyl', dose: 25 },
        { type: 'administer_drug', drug: 'propofol', dose: 40 },
        { type: 'advance_time', seconds: 90 },
      ],
      highlight: ['fentanyl-25', 'propofol-50'],
      teachingPoints: [
        'Dose propofol on lean body weight (LBW), not total body weight for obese patients.',
        'Titrate slowly — obese patients have larger volume of distribution but also slower redistribution.',
      ],
    },
    {
      id: 'step_osa_maintenance',
      phase: 'maintenance',
      triggerType: 'on_step_complete',
      afterStepId: 'step_drug_dose',
      millieDialogue: [
        'Sedation established. The procedure is proceeding.',
        'Obese OSA patients have reduced functional residual capacity — desaturation can be rapid. Stay vigilant.',
      ],
      simActions: [
        { type: 'advance_time', seconds: 120 },
      ],
      teachingPoints: [
        'Pre-oxygenate obese patients with HOB at 30° to maximise apnoeic oxygenation time.',
        'Use a nasal cannula under the mask for continuous O2 delivery during sedation.',
      ],
    },
    {
      id: 'step_airway_obstruction',
      phase: 'complication',
      triggerType: 'on_physiology',
      triggerCondition: { parameter: 'spo2', operator: '<', threshold: 92, durationSeconds: 15 },
      millieDialogue: [
        'SpO2 is falling — you hear snoring and the capnography trace has become flat.',
        'What does a flat capnography trace mean?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Flat capnography trace during sedation most likely means?',
        options: [
          'Complete or near-complete airway obstruction — no CO2 being exhaled',
          'Patient has stopped breathing — apnea',
          'Normal — some patients do not exhale CO2',
          'Equipment failure — ignore and continue',
        ],
        correctAnswer: 'Complete or near-complete airway obstruction — no CO2 being exhaled',
        feedback: {
          'Complete or near-complete airway obstruction — no CO2 being exhaled': 'Correct. No CO2 waveform = no airflow. Immediate airway intervention needed.',
          'Patient has stopped breathing — apnea': 'Partially correct — obstruction and apnea can both cause flat trace; both need action.',
          'Normal — some patients do not exhale CO2': 'Every patient exhales CO2. Flat trace = abnormal = act immediately.',
          'Equipment failure — ignore and continue': 'Never ignore a flat capnography trace — assume obstruction until proven otherwise.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'jaw_thrust' },
        { type: 'set_airway_device', device: 'nasal_airway' },
        { type: 'set_fio2', fio2: 0.44 },
      ],
      highlight: ['spo2-display', 'fio2-slider'],
      teachingPoints: [
        'Flat capnography = airway obstruction. Immediate jaw thrust + NPA placement.',
        'NPA is highly effective for OSA-pattern soft tissue obstruction.',
        'If NPA fails: bag-mask ventilation, then LMA, then call anesthesia.',
      ],
    },
    {
      id: 'step_recovery_position',
      phase: 'recovery',
      triggerType: 'on_time',
      triggerTimeSeconds: 420,
      millieDialogue: [
        'EGD is complete. Patient is waking up. OSA puts her at risk during recovery too.',
        'What recovery position reduces airway risk in OSA patients?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Optimal recovery position for OSA patient after sedation?',
        options: [
          'Semi-lateral (recovery position) — reduces tongue falling back',
          'Supine flat — standard recovery position',
          'Trendelenburg — feet elevated',
          'Sitting upright immediately',
        ],
        correctAnswer: 'Semi-lateral (recovery position) — reduces tongue falling back',
        feedback: {
          'Semi-lateral (recovery position) — reduces tongue falling back': 'Correct! Lateral position reduces upper airway collapse from gravity.',
          'Supine flat — standard recovery position': 'Supine flat is the worst position for OSA patients — tongue falls back.',
          'Trendelenburg — feet elevated': 'Trendelenburg worsens work of breathing in obese patients.',
          'Sitting upright immediately': 'Too soon post-sedation — patient may not be able to protect airway when fully upright.',
        },
      },
      simActions: [],
      teachingPoints: [
        'Lateral (recovery) position reduces gravity-induced airway collapse in OSA.',
        'CPAP should be resumed as soon as the patient tolerates it in recovery.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'How does the Mallampati score influence your decision to proceed with moderate vs. monitored anesthesia care?',
      'What is the role of CPAP in the perioperative period for OSA patients?',
      'When would you cancel an endoscopy due to airway concerns?',
    ],
    keyTakeaways: [
      'OSA + Mallampati 3: pre-oxygenate, dose conservatively on lean body weight, have rescue airway ready.',
      'Flat capnography = obstruction — act immediately with jaw thrust and NPA.',
      'Lateral position in recovery reduces upper airway collapse from gravity.',
      'CPAP should be restarted as soon as tolerated post-procedure.',
    ],
  },
};

export const MOD_PEDIATRIC_DENTAL: InteractiveScenario = {
  id: 'mod_pediatric_dental',
  title: 'Pediatric Dental Sedation - Paradoxical Agitation',
  difficulty: 'moderate',
  patientArchetype: 'pediatric',
  procedure: 'Pediatric Dental Extraction',
  description: 'An 8-year-old boy for dental extraction under midazolam sedation develops paradoxical agitation — a classic teaching case.',
  learningObjectives: [
    'Calculate weight-based drug doses in pediatric patients',
    'Recognize paradoxical benzodiazepine reaction',
    'Manage paradoxical agitation without additional benzodiazepine',
    'Understand pediatric sedation differences from adult practice',
  ],
  clinicalPearls: [
    'Paradoxical benzodiazepine reaction occurs in 1-15% of pediatric patients',
    'Risk factors: young age, developmental delay, prior paradoxical reaction',
    'Management: do NOT give more midazolam — consider propofol 1 mg/kg or ketamine',
    'Ensure parental presence or reassurance during induction when possible',
  ],
  preopVignette: {
    indication: 'Extraction of badly decayed primary molars under IV sedation',
    setting: 'Pediatric dental office with IV sedation capability',
    history: [
      '8-year-old male, 28 kg, ASA 1',
      'Extreme dental anxiety, failed previous attempts at dental treatment',
      'No medical history, no medications, NKDA',
    ],
    exam: [
      'Airway: Mallampati 1, good mouth opening',
      'Cooperative for baseline vitals: HR 95, SpO2 99%, BP 98/60',
      'Four decayed primary molars requiring extraction',
    ],
    baselineMonitors: ['SpO2', 'Capnography', 'NIBP', 'ECG'],
    targetSedationGoal: 'MOASS 3 (responds to voice) — moderate sedation for dental procedure',
  },
  drugProtocols: [
    { name: 'midazolam', route: 'IV', typicalBolusRange: [0.05, 0.1], maxTotalDose: 3, unit: 'mg/kg' },
    { name: 'propofol', route: 'IV', typicalBolusRange: [1, 1.5], maxTotalDose: 3, unit: 'mg/kg' },
    { name: 'ketamine', route: 'IV', typicalBolusRange: [0.5, 1], maxTotalDose: 2, unit: 'mg/kg' },
  ],
  steps: [
    {
      id: 'step_weight_dose',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        "An 8-year-old, 28 kg boy needs dental sedation. Let's calculate the midazolam dose.",
        'Standard pediatric dose is 0.05-0.1 mg/kg IV. What is the correct dose for 28 kg?',
      ],
      question: {
        type: 'numeric_range',
        prompt: 'Midazolam dose in mg for 28 kg child (0.05-0.1 mg/kg)',
        correctAnswer: 2,
        idealRange: [1.4, 2.8],
        feedback: {
          low: 'Below 1.4 mg (0.05 mg/kg × 28 kg) is below therapeutic range.',
          ideal: '1.4-2.8 mg (0.05-0.1 mg/kg) is the appropriate range for this child.',
          high: 'Above 2.8 mg risks oversedation — do not exceed 0.1 mg/kg for initial dose.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_hood' },
        { type: 'set_fio2', fio2: 0.35 },
        { type: 'administer_drug', drug: 'midazolam', dose: 2 },
        { type: 'advance_time', seconds: 120 },
      ],
      highlight: ['midazolam-2', 'fio2-slider'],
      teachingPoints: [
        'Pediatric dosing is ALWAYS weight-based. Double-check every calculation.',
        'Maximum single midazolam dose: 0.1 mg/kg or 2.5 mg, whichever is less.',
      ],
    },
    {
      id: 'step_agitation_recognition',
      phase: 'complication',
      triggerType: 'on_time',
      triggerTimeSeconds: 150,
      millieDialogue: [
        'The child was calm for 2 minutes, but now he is thrashing, crying, and kicking. HR is 135.',
        'This reaction occurred AFTER midazolam. What is the most likely explanation?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Child is agitated after midazolam — most likely cause?',
        options: [
          'Paradoxical benzodiazepine reaction',
          'Underdosing — needs more midazolam',
          'Anaphylaxis to midazolam',
          'Normal behavior — proceed with procedure',
        ],
        correctAnswer: 'Paradoxical benzodiazepine reaction',
        feedback: {
          'Paradoxical benzodiazepine reaction': 'Correct! Paradoxical agitation after benzodiazepine is a class effect — common in young children.',
          'Underdosing — needs more midazolam': 'DANGEROUS. More midazolam will worsen the paradoxical reaction.',
          'Anaphylaxis to midazolam': 'Anaphylaxis presents with hives, bronchospasm, hypotension — not isolated agitation.',
          'Normal behavior — proceed with procedure': 'A combative child who is unable to cooperate is not a safe sedation candidate to continue without addressing agitation.',
        },
      },
      simActions: [],
      teachingPoints: [
        'Paradoxical reaction: disinhibition from CNS benzodiazepine receptor activity in developing brains.',
        'Do NOT give more midazolam — this worsens the reaction.',
        'Risk factors: age <7, developmental delay, prior paradoxical reaction.',
      ],
    },
    {
      id: 'step_agitation_management',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_agitation_recognition',
      millieDialogue: [
        'The child is combative and cannot be treated safely.',
        'What is the best approach to manage this paradoxical agitation?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Management of paradoxical agitation from midazolam in a pediatric patient?',
        options: [
          'Give propofol 1 mg/kg IV to achieve sedation via different mechanism',
          'Double the midazolam dose immediately',
          'Give flumazenil and abandon the procedure',
          'Physical restraint and proceed with procedure',
        ],
        correctAnswer: 'Give propofol 1 mg/kg IV to achieve sedation via different mechanism',
        feedback: {
          'Give propofol 1 mg/kg IV to achieve sedation via different mechanism': 'Correct! Propofol acts on different GABA-A receptor subtypes and is effective rescue for paradoxical agitation.',
          'Double the midazolam dose immediately': 'This will deepen the paradoxical reaction — do not give more benzodiazepine.',
          'Give flumazenil and abandon the procedure': 'Flumazenil is an option but the child still needs dental care — propofol rescue allows procedure to continue.',
          'Physical restraint and proceed with procedure': 'Ethically problematic without adequate sedation — patient safety and dignity matter.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'propofol', dose: 28 },
        { type: 'advance_time', seconds: 60 },
      ],
      highlight: ['propofol-20'],
      teachingPoints: [
        'Propofol 1-1.5 mg/kg IV: effective rescue for paradoxical benzodiazepine agitation.',
        'Ketamine 1 mg/kg IV is an alternative rescue for paradoxical agitation.',
        'Document the paradoxical reaction for future anesthesia providers.',
      ],
    },
    {
      id: 'step_recovery_monitoring',
      phase: 'recovery',
      triggerType: 'on_time',
      triggerTimeSeconds: 360,
      millieDialogue: [
        'The procedure is complete. The child received both midazolam and propofol.',
        'What specific recovery monitoring is required before a pediatric patient can be discharged?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Pediatric discharge criteria after combined midazolam + propofol?',
        options: [
          'MOASS 5, stable vitals × 30 min, with parent/guardian escort',
          'MOASS 5 alone — no time requirement for children',
          'Child must be fully alert for 60 minutes',
          'No special monitoring — children recover faster than adults',
        ],
        correctAnswer: 'MOASS 5, stable vitals × 30 min, with parent/guardian escort',
        feedback: {
          'MOASS 5, stable vitals × 30 min, with parent/guardian escort': 'Correct. Same criteria as adults plus responsible adult escort required.',
          'MOASS 5 alone — no time requirement for children': 'Incorrect. Children also need a 30-minute minimum observation period.',
          'Child must be fully alert for 60 minutes': 'Overly conservative — 30 minutes is standard.',
          'No special monitoring — children recover faster than adults': 'Incorrect. Pediatric patients require the same post-sedation monitoring as adults.',
        },
      },
      simActions: [],
      teachingPoints: [
        'Pediatric discharge requires: MOASS 5, stable vitals, tolerating oral fluids, with responsible adult.',
        'Always document the paradoxical reaction and note it as a drug sensitivity for future providers.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'What would you document for this patient to prevent a repeat paradoxical reaction?',
      'When is flumazenil appropriate for paradoxical agitation vs. propofol rescue?',
      'How does pediatric pharmacology differ from adult for benzodiazepines?',
    ],
    keyTakeaways: [
      'Paradoxical midazolam reaction: do NOT give more — use propofol or ketamine as rescue.',
      'Pediatric dosing is always weight-based — calculate and double-check.',
      'Document paradoxical reactions as a drug sensitivity for future anesthesia providers.',
      'Same discharge criteria as adults — 30 minutes minimum, with responsible adult escort.',
    ],
  },
};

export const MOD_DIABETIC_CARDIOVERSION: InteractiveScenario = {
  id: 'mod_diabetic_cardioversion',
  title: 'Diabetic Patient Cardioversion - Transient Bradycardia',
  difficulty: 'moderate',
  patientArchetype: 'healthy_adult',
  procedure: 'Elective Electrical Cardioversion',
  description: 'Diabetic patient with atrial fibrillation needs cardioversion under brief procedural sedation. Develops transient bradycardia post-shock.',
  learningObjectives: [
    'Plan sedation for cardioversion — brief, deep, rapid recovery',
    'Understand why propofol or etomidate is preferred for cardioversion',
    'Recognize and manage post-cardioversion bradycardia',
    'Know when to use atropine for symptomatic bradycardia',
  ],
  clinicalPearls: [
    'Cardioversion sedation: goal is brief deep sedation (MOASS 1) for 30-60 seconds',
    'Propofol 1-1.5 mg/kg is standard — rapid onset, rapid recovery',
    'Post-cardioversion bradycardia: sinus node recovery time may be prolonged after long AF',
    'Atropine 0.5 mg IV for symptomatic bradycardia; temporary pacing if refractory',
  ],
  preopVignette: {
    indication: 'Elective cardioversion for persistent atrial fibrillation',
    setting: 'Cardiology procedure room with full defibrillation capability',
    history: [
      '62-year-old male, AF × 6 weeks, on anticoagulation',
      'Type 2 DM (HbA1c 7.2%), mild hypertension — ASA 2',
      'Metformin, lisinopril. No known allergies.',
      'Echo: LV function normal, no thrombus.',
    ],
    exam: [
      'Airway: Mallampati 2, adequate',
      'HR 88 (AF), BP 136/84, SpO2 98%',
      'Lungs clear. No signs of heart failure.',
    ],
    baselineMonitors: ['Continuous ECG (cardioversion pads applied)', 'SpO2', 'NIBP', 'EtCO2'],
    targetSedationGoal: 'MOASS 1-2 for cardioversion — brief deep sedation',
  },
  drugProtocols: [
    { name: 'propofol', route: 'IV', typicalBolusRange: [60, 100], maxTotalDose: 150, unit: 'mg' },
    { name: 'fentanyl', route: 'IV', typicalBolusRange: [25, 50], maxTotalDose: 100, unit: 'mcg' },
    { name: 'midazolam', route: 'IV', typicalBolusRange: [1, 2], maxTotalDose: 4, unit: 'mg' },
  ],
  steps: [
    {
      id: 'step_drug_selection',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        'A 62-year-old with AF needs cardioversion. You need 30-60 seconds of deep sedation.',
        'Which agent is best for brief cardioversion sedation?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Best sedation agent for electrical cardioversion?',
        options: [
          'Propofol 1-1.5 mg/kg IV — rapid onset, rapid recovery',
          'Midazolam 4 mg IV — amnesia without respiratory depression',
          'Ketamine 1 mg/kg IV — preserves cardiovascular stability',
          'Diazepam 10 mg IV — long-acting benzodiazepine',
        ],
        correctAnswer: 'Propofol 1-1.5 mg/kg IV — rapid onset, rapid recovery',
        feedback: {
          'Propofol 1-1.5 mg/kg IV — rapid onset, rapid recovery': 'Correct! Propofol is ideal — fast on, fast off, and provides complete amnesia.',
          'Midazolam 4 mg IV — amnesia without respiratory depression': 'Midazolam has slow onset and slow offset — not ideal for the brief cardioversion window.',
          'Ketamine 1 mg/kg IV — preserves cardiovascular stability': 'Ketamine causes tachycardia, which could interfere with rhythm assessment post-cardioversion.',
          'Diazepam 10 mg IV — long-acting benzodiazepine': 'Diazepam has a very long half-life — prolonged sedation is not ideal for outpatient cardioversion.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 0.40 },
      ],
      highlight: ['airway-nasal_cannula', 'fio2-slider'],
      teachingPoints: [
        'Cardioversion sedation: target brief, deep, amnestic sedation for 30-60 seconds.',
        'Propofol context-sensitive half-life is very short — ideal for brief procedures.',
      ],
    },
    {
      id: 'step_propofol_dose',
      phase: 'induction',
      triggerType: 'on_step_complete',
      afterStepId: 'step_drug_selection',
      millieDialogue: [
        'You proceed with propofol. The patient weighs 82 kg. What dose do you give?',
      ],
      question: {
        type: 'numeric_range',
        prompt: 'Propofol dose for cardioversion in mg (82 kg, ASA 2)',
        correctAnswer: 100,
        idealRange: [80, 120],
        feedback: {
          low: 'Below 80 mg risks incomplete sedation — patient may wake during the shock.',
          ideal: '1-1.5 mg/kg (80-120 mg) is appropriate for cardioversion.',
          high: 'Above 120 mg may cause prolonged apnea for a procedure lasting only 30-60 seconds.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'fentanyl', dose: 25 },
        { type: 'administer_drug', drug: 'propofol', dose: 100 },
        { type: 'advance_time', seconds: 60 },
      ],
      highlight: ['fentanyl-25', 'propofol-100'],
      teachingPoints: [
        'Give fentanyl 25 mcg before propofol to reduce the pain of cardioversion if patient briefly lightens.',
        'Cardioversion is brief — propofol will have you back to baseline in 5-10 minutes.',
      ],
    },
    {
      id: 'step_cardioversion_maintenance',
      phase: 'maintenance',
      triggerType: 'on_step_complete',
      afterStepId: 'step_propofol_dose',
      millieDialogue: [
        'The cardioversion shock is about to be delivered. The patient is adequately sedated.',
        'Monitor HR and rhythm carefully on the post-shock ECG.',
      ],
      simActions: [
        { type: 'advance_time', seconds: 60 },
      ],
      teachingPoints: [
        'Synchronised cardioversion is delivered on the R-wave to avoid inducing VF.',
        'Ensure all personnel are clear before shock delivery.',
      ],
    },
    {
      id: 'step_bradycardia',
      phase: 'complication',
      triggerType: 'on_physiology',
      triggerCondition: { parameter: 'hr', operator: '<', threshold: 45, durationSeconds: 15 },
      millieDialogue: [
        'The cardioversion was successful! Patient is in sinus rhythm. But HR has dropped to 40 bpm.',
        'What is the most likely cause of this post-cardioversion bradycardia?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Post-cardioversion bradycardia at HR 40 — most likely cause?',
        options: [
          'Sinus node dysfunction — prolonged sinus recovery time after long AF',
          'Propofol causing bradycardia',
          'Heart block from the electrical shock',
          'Vasovagal reaction from pain',
        ],
        correctAnswer: 'Sinus node dysfunction — prolonged sinus recovery time after long AF',
        feedback: {
          'Sinus node dysfunction — prolonged sinus recovery time after long AF': 'Correct! Long-standing AF suppresses the sinus node — it needs time to recover after cardioversion.',
          'Propofol causing bradycardia': 'Propofol can cause mild bradycardia but not typically to 40 bpm after a bolus.',
          'Heart block from the electrical shock': 'Cardioversion rarely causes heart block — this is far less common than sinus node recovery time.',
          'Vasovagal reaction from pain': 'Patient is sedated — vasovagal from pain is unlikely.',
        },
      },
      simActions: [],
      teachingPoints: [
        'Post-AF cardioversion bradycardia: sinus node was suppressed by long-standing AF.',
        'Usually self-resolves in 30-60 seconds as the sinus node warms up.',
        'Treat if: symptomatic, SBP <90, or HR <40 for >60 seconds.',
      ],
    },
    {
      id: 'step_atropine_decision',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_bradycardia',
      millieDialogue: [
        'HR is 40. BP is 92/60. The patient is still sedated but starting to wake.',
        'Do you give atropine now?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Should you give atropine for HR 40, BP 92/60?',
        options: [
          'Yes — symptomatic bradycardia with borderline BP warrants atropine 0.5 mg IV',
          'No — wait indefinitely for spontaneous recovery',
          'Yes — give atropine 2 mg IV for maximum effect',
          'No — give propofol to deepen sedation instead',
        ],
        correctAnswer: 'Yes — symptomatic bradycardia with borderline BP warrants atropine 0.5 mg IV',
        feedback: {
          'Yes — symptomatic bradycardia with borderline BP warrants atropine 0.5 mg IV': 'Correct! HR 40 + borderline BP = symptomatic bradycardia = atropine 0.5 mg IV indicated.',
          'No — wait indefinitely for spontaneous recovery': 'Waiting is reasonable for 30-60 seconds, but borderline BP makes treatment appropriate now.',
          'Yes — give atropine 2 mg IV for maximum effect': 'Too much — atropine 2 mg causes anticholinergic effects (tachycardia, dry mouth). Start at 0.5 mg.',
          'No — give propofol to deepen sedation instead': 'Propofol would worsen bradycardia and hypotension — never deepening sedation for hemodynamic instability.',
        },
      },
      simActions: [
        { type: 'set_fio2', fio2: 0.40 },
      ],
      highlight: ['hr-display', 'fio2-slider'],
      teachingPoints: [
        'Atropine dose: 0.5 mg IV, repeat every 3-5 minutes to max 3 mg.',
        'Minimum dose 0.5 mg IV — doses <0.5 mg may paradoxically worsen bradycardia (vagal stimulation).',
        'Have transcutaneous pacing ready for refractory post-cardioversion bradycardia.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'What is the mechanism of sinus node recovery time after long-standing AF?',
      'When would you cancel cardioversion and proceed to rate control instead?',
      'How does DM affect your sedation plan in this case?',
    ],
    keyTakeaways: [
      'Propofol is the agent of choice for cardioversion — fast on, fast off.',
      'Post-cardioversion bradycardia is common from sinus node suppression by AF.',
      'Atropine 0.5 mg IV for symptomatic bradycardia — minimum dose matters.',
      'Always have transcutaneous pacing available for cardioversion procedures.',
    ],
  },
};

export const MOD_RENAL_BIOPSY: InteractiveScenario = {
  id: 'mod_renal_biopsy',
  title: 'CKD Patient Bone Marrow Biopsy - Prolonged Sedation',
  difficulty: 'moderate',
  patientArchetype: 'hepatic',
  procedure: 'Bone Marrow Biopsy',
  description: 'Patient with chronic kidney disease (CKD) needs bone marrow biopsy under sedation. Impaired renal drug clearance causes prolonged sedation depth — teaches PK modifications for renal patients.',
  learningObjectives: [
    'Understand how CKD alters pharmacokinetics of sedation agents',
    'Recognize prolonged sedation in a patient with reduced drug clearance',
    'Select agents with minimal renal clearance for CKD patients',
    'Manage unexpectedly prolonged sedation appropriately',
  ],
  clinicalPearls: [
    'CKD reduces renal clearance — active metabolites accumulate (e.g., morphine-6-glucuronide)',
    'Midazolam metabolite (1-hydroxymidazolam glucuronide) is renally cleared — accumulates in CKD',
    'Propofol is primarily hepatically metabolized — safer in CKD than renally-cleared drugs',
    'Fentanyl is preferred over morphine in CKD — minimal active renally-cleared metabolites',
  ],
  preopVignette: {
    indication: 'Bone marrow biopsy for suspected lymphoma evaluation',
    setting: 'Interventional hematology suite',
    history: [
      '58-year-old female, CKD stage 3b (eGFR 35 mL/min/1.73m²)',
      'Hypertension, anemia of CKD — ASA 3',
      'Medications: amlodipine, erythropoietin, furosemide',
      'No history of liver disease',
    ],
    exam: [
      'Airway: Mallampati 2, adequate',
      'HR 78, BP 148/92, SpO2 97%',
      'Hgb 9.2 g/dL (anemia of CKD)',
    ],
    labs: ['Cr 2.8 mg/dL, eGFR 35 — CKD stage 3b', 'LFTs normal', 'INR 1.1'],
    baselineMonitors: ['SpO2', 'EtCO2', 'NIBP q5min', 'ECG'],
    targetSedationGoal: 'MOASS 2-3 for 20-minute procedure',
  },
  drugProtocols: [
    { name: 'propofol', route: 'IV', typicalBolusRange: [30, 60], maxTotalDose: 150, unit: 'mg' },
    { name: 'fentanyl', route: 'IV', typicalBolusRange: [25, 50], maxTotalDose: 100, unit: 'mcg' },
    { name: 'midazolam', route: 'IV', typicalBolusRange: [0.5, 1], maxTotalDose: 2, unit: 'mg' },
  ],
  steps: [
    {
      id: 'step_ckd_drug_choice',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        'This patient has CKD stage 3b (eGFR 35). You are considering an opioid for analgesia.',
        'Which opioid is preferred in CKD patients and why?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Preferred opioid in CKD (eGFR 35)?',
        options: [
          'Fentanyl — minimal renally-cleared active metabolites',
          'Morphine — most familiar and effective',
          'Codeine — mild opioid, less risk',
          'Hydromorphone — potent and renally cleared',
        ],
        correctAnswer: 'Fentanyl — minimal renally-cleared active metabolites',
        feedback: {
          'Fentanyl — minimal renally-cleared active metabolites': 'Correct! Fentanyl metabolites (norfentanyl) are inactive — safe in CKD.',
          'Morphine — most familiar and effective': 'Morphine produces M6G (active metabolite) which accumulates in CKD causing prolonged respiratory depression.',
          'Codeine — mild opioid, less risk': 'Codeine is a prodrug of morphine — same M6G accumulation problem. Avoid in CKD.',
          'Hydromorphone — potent and renally cleared': 'Hydromorphone-3-glucuronide accumulates in CKD causing neuroexcitatory effects.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 0.32 },
      ],
      highlight: ['airway-nasal_cannula', 'fio2-slider'],
      teachingPoints: [
        'CKD-safe opioids: fentanyl (first choice), hydromorphone (reduced dose).',
        'Avoid in CKD: morphine, codeine, meperidine (accumulate active/toxic metabolites).',
      ],
    },
    {
      id: 'step_sedation_dose',
      phase: 'induction',
      triggerType: 'on_step_complete',
      afterStepId: 'step_ckd_drug_choice',
      millieDialogue: [
        'You choose fentanyl 25 mcg + propofol. Propofol is hepatically metabolized — safer in CKD.',
        'What propofol dose is appropriate for this ASA 3, 65 kg patient?',
      ],
      question: {
        type: 'numeric_range',
        prompt: 'Propofol dose in mg for 65 kg ASA 3 patient (reduce 30-40% from standard)',
        correctAnswer: 50,
        idealRange: [40, 65],
        feedback: {
          low: 'Below 40 mg is likely insufficient for bone marrow biopsy pain.',
          ideal: '40-65 mg (reduced dose for ASA 3) is appropriate.',
          high: 'Above 65 mg risks oversedation in this ASA 3 patient.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'fentanyl', dose: 25 },
        { type: 'administer_drug', drug: 'propofol', dose: 50 },
        { type: 'advance_time', seconds: 120 },
      ],
      highlight: ['fentanyl-25', 'propofol-50'],
      teachingPoints: [
        'Propofol is primarily hepatically glucuronidated — relatively safe in CKD.',
        'Still reduce dose for ASA 3 patients — comorbidities increase sensitivity.',
      ],
    },
    {
      id: 'step_prolonged_sedation',
      phase: 'complication',
      triggerType: 'on_time',
      triggerTimeSeconds: 360,
      millieDialogue: [
        'The procedure ended 10 minutes ago but the patient is still at MOASS 2 — unusually prolonged.',
        'What is the most likely explanation for prolonged sedation in this CKD patient?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Why is sedation prolonged in this CKD patient?',
        options: [
          'Midazolam metabolite accumulation — 1-OH-midazolam glucuronide is renally cleared',
          'Propofol toxicity — PRIS from a single dose',
          'Fentanyl accumulation — fentanyl half-life doubles in CKD',
          'Patient is just a slow metabolizer — no concern needed',
        ],
        correctAnswer: 'Midazolam metabolite accumulation — 1-OH-midazolam glucuronide is renally cleared',
        feedback: {
          'Midazolam metabolite accumulation — 1-OH-midazolam glucuronide is renally cleared': 'Correct! Even small midazolam doses can cause prolonged sedation in CKD via metabolite accumulation.',
          'Propofol toxicity — PRIS from a single dose': 'PRIS requires prolonged high-dose infusion — not a single procedural bolus.',
          'Fentanyl accumulation — fentanyl half-life doubles in CKD': 'Fentanyl is chosen specifically because its metabolites are inactive — it is safe in CKD.',
          'Patient is just a slow metabolizer — no concern needed': 'CKD-related pharmacokinetic changes are predictable and require monitoring.',
        },
      },
      simActions: [],
      teachingPoints: [
        'Even small midazolam doses can cause prolonged sedation in CKD — the active metabolite accumulates.',
        'For CKD patients: minimize benzodiazepine use. Propofol + fentanyl is the preferred combination.',
      ],
    },
    {
      id: 'step_management',
      phase: 'recovery',
      triggerType: 'on_step_complete',
      afterStepId: 'step_prolonged_sedation',
      millieDialogue: [
        'The patient has prolonged sedation (MOASS 2) with normal vitals and SpO2 97%.',
        'What is the appropriate management of this prolonged but hemodynamically stable sedation?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Best management of prolonged stable sedation (MOASS 2, SpO2 97%) after CKD procedure?',
        options: [
          'Continued monitoring, O2 supplementation, verbal stimulation — allow natural metabolism',
          'Give flumazenil 0.2 mg IV immediately',
          'Give naloxone 0.4 mg IV immediately',
          'Intubate for airway protection',
        ],
        correctAnswer: 'Continued monitoring, O2 supplementation, verbal stimulation — allow natural metabolism',
        feedback: {
          'Continued monitoring, O2 supplementation, verbal stimulation — allow natural metabolism': 'Correct. Stable vitals = monitor and allow natural metabolism. Reversal agents have short duration of action.',
          'Give flumazenil 0.2 mg IV immediately': 'Flumazenil is an option but has a short half-life (1h) and the midazolam metabolite will re-sedate. Monitor first.',
          'Give naloxone 0.4 mg IV immediately': 'No opioid respiratory depression present — naloxone is not indicated here.',
          'Intubate for airway protection': 'SpO2 97% and spontaneous breathing — intubation is not warranted.',
        },
      },
      simActions: [
        { type: 'set_fio2', fio2: 0.35 },
      ],
      highlight: ['fio2-slider'],
      teachingPoints: [
        'Flumazenil duration: 45-90 min. Midazolam metabolite duration in CKD: hours. Resedation is common after flumazenil.',
        'For stable prolonged sedation: monitor, O2, verbal stimulation, allow natural metabolism.',
        'If respiratory compromise develops: THEN flumazenil is appropriate as bridge.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'How would you modify the sedation plan prospectively knowing this is a CKD patient?',
      'What is the clinical significance of midazolam metabolite accumulation?',
      'How does flumazenil\'s duration of action limit its utility in CKD?',
    ],
    keyTakeaways: [
      'CKD: avoid midazolam (accumulating metabolite) — use propofol + fentanyl instead.',
      'Fentanyl is preferred over morphine in CKD — inactive metabolites.',
      'Prolonged but hemodynamically stable sedation: monitor and allow natural metabolism.',
      'Flumazenil has shorter duration than midazolam metabolite — resedation is common.',
    ],
  },
};

export const MODERATE_SCENARIOS: InteractiveScenario[] = [
  MOD_ELDERLY_COPD,
  MOD_OBESE_OSA,
  MOD_PEDIATRIC_DENTAL,
  MOD_DIABETIC_CARDIOVERSION,
  MOD_RENAL_BIOPSY,
];
