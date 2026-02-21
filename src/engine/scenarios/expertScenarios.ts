import { InteractiveScenario } from '../ScenarioEngine';

export const EXPERT_PRIS: InteractiveScenario = {
  id: 'expert_pris',
  title: 'Propofol Infusion Syndrome (PRIS)',
  difficulty: 'expert',
  patientArchetype: 'hepatic',
  procedure: 'Prolonged ICU Sedation',
  description: 'ICU patient on prolonged high-dose propofol infusion develops PRIS: new-onset bradycardia, lipemia, and metabolic acidosis. Requires rapid recognition and agent switch.',
  learningObjectives: [
    'Recognize the clinical triad of PRIS',
    'Identify risk factors for PRIS',
    'Switch to alternative sedation immediately upon PRIS suspicion',
    'Manage PRIS metabolic complications',
  ],
  clinicalPearls: [
    'PRIS criteria: metabolic acidosis + at least one of: rhabdomyolysis, hepatomegaly, cardiac dysfunction, lipemia',
    'Risk factors: dose >4 mg/kg/h for >48h, low carbohydrate intake, high fat diet, catecholamine co-infusion',
    'Stop propofol immediately upon PRIS suspicion — switch to midazolam or dexmedetomidine',
    'Mortality of PRIS: 30-50% if not recognized — early diagnosis is life-saving',
  ],
  preopVignette: {
    indication: 'ICU sedation for mechanical ventilation after hepatic surgery',
    setting: 'Surgical ICU',
    history: [
      '50-year-old male, hepatic resection 2 days ago for HCC',
      'ICU day 2: propofol infusion at 5 mg/kg/h for 52 hours',
      'Underlying mild hepatic impairment (residual liver function adequate post-resection)',
      'ASA 4 perioperative. Concurrent norepinephrine for vasopressor support.',
    ],
    exam: [
      'Day 2 ICU: new bradycardia HR 44, BP 85/50',
      'Triglycerides: 890 mg/dL (lipemia — triglycerides drawn from same line)',
      'ABG: pH 7.28, PaCO2 38, HCO3 18, lactate 4.2 — metabolic acidosis with elevated lactate',
    ],
    labs: [
      'CK: 3200 U/L (elevated — rhabdomyolysis)',
      'Propofol infusion rate: 5 mg/kg/h × 52 hours',
      'ECG: new right bundle branch block pattern',
    ],
    baselineMonitors: ['Continuous ECG', 'Arterial line', 'Central venous pressure', 'SpO2'],
    targetSedationGoal: 'Switch from propofol to alternative sedation ASAP',
  },
  drugProtocols: [
    { name: 'propofol', route: 'IV infusion', typicalBolusRange: [1, 4], maxTotalDose: 400, unit: 'mg/kg/h' },
    { name: 'midazolam', route: 'IV infusion', typicalBolusRange: [0.02, 0.1], maxTotalDose: 0.2, unit: 'mg/kg/h' },
  ],
  steps: [
    {
      id: 'step_pris_recognition',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        'Day 2 ICU: propofol 5 mg/kg/h for 52 hours. New bradycardia HR 44, metabolic acidosis, triglycerides 890.',
        'What syndrome do these findings suggest?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Day 2 high-dose propofol + bradycardia + metabolic acidosis + lipemia = ?',
        options: [
          'Propofol Infusion Syndrome (PRIS)',
          'Septic shock',
          'Acute adrenal insufficiency',
          'Benzodiazepine toxicity',
        ],
        correctAnswer: 'Propofol Infusion Syndrome (PRIS)',
        feedback: {
          'Propofol Infusion Syndrome (PRIS)': 'Correct! Classic PRIS triad: high-dose prolonged propofol + new bradycardia + metabolic acidosis + lipemia.',
          'Septic shock': 'Septic shock causes vasodilation and hypotension, but the metabolic picture with lipemia strongly suggests PRIS.',
          'Acute adrenal insufficiency': "Adrenal crisis does not produce lipemia or rhabdomyolysis.",
          'Benzodiazepine toxicity': 'Patient is on propofol, not benzodiazepines — and the metabolic pattern is specific to PRIS.',
        },
      },
      simActions: [],
      teachingPoints: [
        'PRIS: dose >4 mg/kg/h AND duration >48h are the key risk factors.',
        'PRIS mechanism: propofol disrupts mitochondrial respiratory chain → impaired fat oxidation → metabolic acidosis.',
        'New ECG changes (RBBB, ST elevation in V1-V3 — "Brugada-like") are a hallmark of PRIS cardiac toxicity.',
      ],
    },
    {
      id: 'step_stop_propofol',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_pris_recognition',
      millieDialogue: [
        'PRIS confirmed. What is the SINGLE most important immediate action?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Most important immediate action for PRIS?',
        options: [
          'STOP propofol infusion immediately and switch to alternative sedation',
          'Reduce propofol to 2 mg/kg/h — acceptable dose',
          'Give sodium bicarbonate to correct acidosis, continue propofol',
          'Increase norepinephrine for the hypotension',
        ],
        correctAnswer: 'STOP propofol infusion immediately and switch to alternative sedation',
        feedback: {
          'STOP propofol infusion immediately and switch to alternative sedation': 'Correct! Stop propofol — it is the cause. Every minute of continued infusion worsens PRIS.',
          'Reduce propofol to 2 mg/kg/h — acceptable dose': 'No dose is safe once PRIS is established — stopping completely is mandatory.',
          'Give sodium bicarbonate to correct acidosis, continue propofol': 'Treating the acidosis while continuing the cause is dangerous — treat the cause first.',
          'Increase norepinephrine for the hypotension': 'Vasopressors treat the BP but not the underlying mitochondrial toxicity.',
        },
      },
      simActions: [
        { type: 'set_fio2', fio2: 1.0 },
      ],
      teachingPoints: [
        'Stop propofol IMMEDIATELY. There is no safe dose of propofol once PRIS is established.',
        'Alternative ICU sedation: midazolam infusion, dexmedetomidine, or lorazepam infusion.',
        'Continue all supportive care: vasopressors, renal replacement therapy if needed, cardiology input.',
      ],
    },
    {
      id: 'step_bradycardia_management',
      phase: 'complication',
      triggerType: 'on_physiology',
      triggerCondition: { parameter: 'hr', operator: '<', threshold: 40, durationSeconds: 20 },
      millieDialogue: [
        'HR drops to 35 bpm with BP 70/40. ECG shows new RBBB pattern.',
        'What cardiac complication of PRIS are you seeing?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'New RBBB + bradycardia + hypotension in PRIS — mechanism?',
        options: [
          'PRIS cardiac toxicity: mitochondrial dysfunction → myocardial conduction failure',
          'Hyperkalemia from rhabdomyolysis causing bradycardia',
          'Propofol blocking cardiac calcium channels',
          'Vasoplegia from propofol metabolites',
        ],
        correctAnswer: 'PRIS cardiac toxicity: mitochondrial dysfunction → myocardial conduction failure',
        feedback: {
          'PRIS cardiac toxicity: mitochondrial dysfunction → myocardial conduction failure': 'Correct! PRIS disrupts myocardial mitochondria → reduced ATP → conduction system failure.',
          'Hyperkalemia from rhabdomyolysis causing bradycardia': 'Hyperkalemia is a valid concern with PRIS rhabdomyolysis but the ECG pattern of RBBB/Brugada is specific to PRIS.',
          'Propofol blocking cardiac calcium channels': 'Propofol has mild calcium channel effects but PRIS cardiac toxicity is primarily mitochondrial.',
          'Vasoplegia from propofol metabolites': 'Vasoplegia is a component but the conduction changes are primary myocardial toxicity.',
        },
      },
      simActions: [
        { type: 'set_fio2', fio2: 1.0 },
      ],
      teachingPoints: [
        'PRIS cardiac pattern: new RBBB or Brugada-like ST pattern in V1-V3 is a red flag.',
        'Temporary pacing may be needed for PRIS-related complete heart block.',
        'Early ECMO referral for refractory PRIS cardiac failure — has been life-saving.',
      ],
    },
    {
      id: 'step_alternative_sedation',
      phase: 'maintenance',
      triggerType: 'on_step_complete',
      afterStepId: 'step_bradycardia_management',
      millieDialogue: [
        'Propofol stopped. Cardiologist on the way. You need to maintain ICU sedation.',
        'What alternative sedation agent is preferred in this ventilated ICU patient?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Best alternative sedation after PRIS in a mechanically ventilated ICU patient?',
        options: [
          'Dexmedetomidine infusion — cooperative, opioid-sparing, minimal respiratory depression',
          'Restart propofol at 2 mg/kg/h',
          'Ketamine infusion — dissociative, hemodynamically stable',
          'Haloperidol boluses only — no sedation infusion',
        ],
        correctAnswer: 'Dexmedetomidine infusion — cooperative, opioid-sparing, minimal respiratory depression',
        feedback: {
          'Dexmedetomidine infusion — cooperative, opioid-sparing, minimal respiratory depression': 'Correct! Dexmedetomidine is the ideal alternative — "cooperative sedation" without respiratory depression.',
          'Restart propofol at 2 mg/kg/h': 'Absolutely contraindicated — propofol caused PRIS. Never restart it in this patient.',
          'Ketamine infusion — dissociative, hemodynamically stable': 'Ketamine is an option but increases sympathetic tone and secretions — less ideal for ICU sedation.',
          'Haloperidol boluses only — no sedation infusion': 'Haloperidol alone is insufficient for a ventilated patient who needs consistent sedation.',
        },
      },
      simActions: [
        { type: 'set_fio2', fio2: 1.0 },
      ],
      teachingPoints: [
        'PRIS → switch to: midazolam infusion, dexmedetomidine, or lorazepam infusion.',
        'Dexmedetomidine allows cooperative sedation — patient can be weaned and assessed.',
        'Document PRIS as a propofol adverse reaction — avoid propofol for life.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'How could PRIS have been prevented in this patient?',
      'What monitoring would you implement for any ICU patient on propofol >48 hours?',
      'What is the role of ECMO in PRIS?',
    ],
    keyTakeaways: [
      'PRIS: high-dose propofol (>4 mg/kg/h) × >48h + metabolic acidosis + lipemia + cardiac changes.',
      'Stop propofol immediately — every minute continued worsens outcomes.',
      'Monitor: daily triglycerides, CK, lactate, ECG for any patient on propofol >48h.',
      'Dexmedetomidine or midazolam as alternatives. NEVER restart propofol after PRIS.',
    ],
  },
};

export const EXPERT_MULTI_DRUG: InteractiveScenario = {
  id: 'expert_multi_drug',
  title: 'Multi-Drug Interaction - Synergistic Apnea',
  difficulty: 'expert',
  patientArchetype: 'elderly',
  procedure: 'Bronchoscopy',
  description: 'Elderly frail patient with COPD and CKD receives combined propofol + midazolam + fentanyl. Severe synergistic respiratory depression causes apnea. Requires multi-drug reversal strategy.',
  learningObjectives: [
    'Understand synergistic respiratory depression from opioid-hypnotic-benzodiazepine combination',
    'Know reversal agents: naloxone (opioid), flumazenil (benzodiazepine)',
    'Apply bag-mask ventilation during pharmacologic reversal',
    'Prevent future multi-drug iatrogenic apnea through dosing discipline',
  ],
  clinicalPearls: [
    'Three-drug synergy: opioid + benzo + propofol has multiplicative (not additive) respiratory depression',
    'Naloxone: 0.04 mg increments IV — titrate to respiratory effect, avoid precipitating acute pain crisis',
    'Flumazenil: 0.2 mg IV — avoid large doses if benzo-dependent (seizure risk)',
    'Frail elderly: drastically reduce ALL doses — one drug at normal dose may cause apnea',
  ],
  preopVignette: {
    indication: 'Diagnostic bronchoscopy for hemoptysis',
    setting: 'Bronchoscopy suite',
    history: [
      '78-year-old female, BMI 19 (frail), COPD GOLD stage III, CKD stage 4 (eGFR 22)',
      'Hemoptysis × 3 weeks — urgent bronchoscopy',
      'Multiple medications: LAMA/LABA, aspirin, amlodipine, furosemide',
      'ASA 4 — multiple severe systemic diseases',
    ],
    exam: [
      'Airway: Mallampati 3 — limited mouth opening from arthritis',
      'SpO2 92% on room air (COPD baseline)',
      'HR 82, BP 128/78',
    ],
    labs: ['eGFR 22 (CKD stage 4)', 'Albumin 2.8 g/dL (malnourished)'],
    baselineMonitors: ['SpO2', 'EtCO2', 'ECG', 'NIBP q3min', 'Arterial line recommended'],
    targetSedationGoal: 'Minimal sedation (MOASS 3-4) — do NOT use multi-drug combination',
  },
  drugProtocols: [
    { name: 'fentanyl', route: 'IV', typicalBolusRange: [10, 25], maxTotalDose: 50, unit: 'mcg' },
    { name: 'midazolam', route: 'IV', typicalBolusRange: [0.25, 0.5], maxTotalDose: 1, unit: 'mg' },
  ],
  steps: [
    {
      id: 'step_frailty_risk',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        'This 78-year-old frail ASA 4 patient has COPD + CKD + low albumin. The resident wants to give "standard" doses of propofol + midazolam + fentanyl.',
        'What is the most dangerous aspect of this plan?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Greatest danger of using standard multi-drug doses in this frail elderly patient?',
        options: [
          'Synergistic respiratory depression — three drugs together have multiplicative effect',
          'The drugs will not work because of renal clearance',
          'Propofol allergy risk is higher in the elderly',
          'Standard doses are fine — elderly patients are just slower to wake up',
        ],
        correctAnswer: 'Synergistic respiratory depression — three drugs together have multiplicative effect',
        feedback: {
          'Synergistic respiratory depression — three drugs together have multiplicative effect': 'Correct! Opioid + benzo + hypnotic = multiplicative, not additive, respiratory depression in frail elderly.',
          'The drugs will not work because of renal clearance': 'The opposite — CKD causes drug accumulation, making standard doses HIGHER relative exposure.',
          'Propofol allergy risk is higher in the elderly': 'True allergy to propofol is rare and not age-related.',
          'Standard doses are fine — elderly patients are just slower to wake up': 'Dangerously wrong. Standard doses can cause apnea in frail elderly patients.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 0.40 },
      ],
      teachingPoints: [
        'Frailty + COPD + CKD: reduce ALL drug doses by 50-70%. Use one drug at a time.',
        'Low albumin (2.8): more free drug (unbound fraction higher) — further increases effective dose.',
        'The ideal plan: topical lidocaine to airway + minimal fentanyl only, or dexmedetomidine alone.',
      ],
    },
    {
      id: 'step_apnea',
      phase: 'complication',
      triggerType: 'on_time',
      triggerTimeSeconds: 90,
      millieDialogue: [
        'Despite your warning, standard doses were given by the trainee: fentanyl 50 mcg, midazolam 2 mg, propofol 80 mg.',
        'The EtCO2 trace goes flat. SpO2 drops from 92% to 85%. RR = 0. Complete apnea.',
        'What is your FIRST action?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Complete apnea (RR 0, SpO2 dropping) — FIRST action?',
        options: [
          'BVM ventilation with 100% O2 immediately',
          'Naloxone 0.4 mg IV immediately',
          'Flumazenil 1 mg IV immediately',
          'Intubate immediately',
        ],
        correctAnswer: 'BVM ventilation with 100% O2 immediately',
        feedback: {
          'BVM ventilation with 100% O2 immediately': 'Correct! Airway and oxygenation FIRST before any pharmacologic reversal.',
          'Naloxone 0.4 mg IV immediately': 'Naloxone is appropriate next, but airway first — SpO2 is already 85% and falling.',
          'Flumazenil 1 mg IV immediately': 'Large flumazenil dose can precipitate seizures. Airway first, then titrated flumazenil.',
          'Intubate immediately': 'BVM is the first-line rescue — do not intubate before attempting BVM oxygenation.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'bag_mask' },
        { type: 'set_fio2', fio2: 1.0 },
      ],
      teachingPoints: [
        'Apnea management: A-B-C first. Airway → Breathing (BVM) → Circulation.',
        'BVM can fully manage apnea while pharmacologic reversal takes effect.',
        'Never forget: drug reversal takes 1-3 minutes — BVM bridges that gap.',
      ],
    },
    {
      id: 'step_naloxone',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_apnea',
      millieDialogue: [
        'BVM ventilation is ongoing. SpO2 recovering to 94%. You want to use pharmacologic reversal.',
        'You decide to give naloxone. What is the appropriate dose strategy?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Naloxone dosing strategy for opioid component of multi-drug apnea?',
        options: [
          '0.04 mg IV increments — titrate to respiratory effect, avoid acute reversal of analgesia',
          '0.4 mg IV bolus — full dose immediately',
          '2 mg IV — maximum dose for certainty',
          'Naloxone should not be given — it will cause acute pain',
        ],
        correctAnswer: '0.04 mg IV increments — titrate to respiratory effect, avoid acute reversal of analgesia',
        feedback: {
          '0.04 mg IV increments — titrate to respiratory effect, avoid acute reversal of analgesia': 'Correct! Titrated naloxone avoids acute pain crisis, hypertension, and pulmonary edema.',
          '0.4 mg IV bolus — full dose immediately': '0.4 mg bolus causes acute pain/anxiety, hypertension, tachycardia, and can precipitate pulmonary edema.',
          '2 mg IV — maximum dose for certainty': 'Far too high — this will cause severe catecholamine storm and acute pain crisis.',
          'Naloxone should not be given — it will cause acute pain': 'Naloxone IS indicated for opioid respiratory depression — titrate carefully.',
        },
      },
      simActions: [
        { type: 'set_fio2', fio2: 0.60 },
      ],
      teachingPoints: [
        'Naloxone 0.04 mg IV every 2-3 min: titrate to spontaneous respiration, not full reversal.',
        'Full naloxone reversal causes acute pain crisis, HTN, and pulmonary edema — dangerous in elderly.',
        'Duration: naloxone 45-90 min < fentanyl redistribution — may need repeat dosing.',
      ],
    },
    {
      id: 'step_flumazenil',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_naloxone',
      millieDialogue: [
        'Naloxone helped but patient is still deeply sedated from midazolam + propofol.',
        'You consider flumazenil. What is the risk of giving flumazenil to this patient?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Key risk of flumazenil in a patient on chronic benzodiazepines or with benzodiazepine dependence?',
        options: [
          'Acute withdrawal seizures if patient is benzodiazepine-dependent',
          'Permanent reversal of sedation — patient will never sedate again',
          'Flumazenil causes cardiovascular depression',
          'No significant risks — flumazenil is universally safe',
        ],
        correctAnswer: 'Acute withdrawal seizures if patient is benzodiazepine-dependent',
        feedback: {
          'Acute withdrawal seizures if patient is benzodiazepine-dependent': 'Correct! Flumazenil can precipitate acute benzodiazepine withdrawal seizures in dependent patients.',
          'Permanent reversal of sedation — patient will never sedate again': 'Flumazenil has a short half-life (~1h) — sedation returns as it wears off.',
          'Flumazenil causes cardiovascular depression': 'Flumazenil has minimal cardiovascular effects in typical doses.',
          'No significant risks — flumazenil is universally safe': 'Seizure risk in benzodiazepine-dependent patients is a real and serious risk.',
        },
      },
      simActions: [
        { type: 'set_fio2', fio2: 0.44 },
      ],
      teachingPoints: [
        'Flumazenil 0.2 mg IV: first dose. Repeat 0.1 mg every 60 sec to max 1 mg.',
        'Avoid in: benzodiazepine-dependent patients, epilepsy, tricyclic antidepressant overdose.',
        'Short duration: 45-90 min. Resedation is common — monitor for at least 2 hours.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'How would you design a sedation protocol specifically for frail elderly ASA 4 bronchoscopy patients?',
      'What monitoring would reduce the risk of iatrogenic apnea in high-risk patients?',
      'When is reversal of sedation agents appropriate vs. supportive management?',
    ],
    keyTakeaways: [
      'Three-drug synergy: multiplicative respiratory depression in frail elderly — use one drug at a time.',
      'Apnea: BVM first, then titrated naloxone (0.04 mg increments), then flumazenil (0.2 mg).',
      'Frail elderly: reduce ALL doses 50-70%. Low albumin increases free drug fraction further.',
      'Monitor for resedation after reversal — naloxone and flumazenil both shorter than drug duration.',
    ],
  },
};

export const EXPERT_AWARENESS: InteractiveScenario = {
  id: 'expert_awareness',
  title: 'Awareness Under Sedation - Catecholamine Surge',
  difficulty: 'expert',
  patientArchetype: 'anxious_young',
  procedure: 'Colonoscopy',
  description: 'Young woman with low drug sensitivity develops awareness under sedation during colonoscopy. Signs: purposeful movement, tachycardia, hypertension. Requires recognition, management, and medico-legal considerations.',
  learningObjectives: [
    'Recognize clinical signs of patient awareness during sedation',
    'Understand the medicolegal and psychological impact of sedation awareness',
    'Titrate supplemental sedation safely for apparent awareness',
    'Conduct a proper post-procedure debrief for a patient who may have been aware',
  ],
  clinicalPearls: [
    'Awareness incidence: 0.1-0.2% for general anesthesia, potentially higher for moderate sedation',
    'Signs: purposeful movement, tachycardia, hypertension, sweating, grimacing',
    'Drug resistance: young fit patients (especially females) may need higher doses than standard',
    'Post-procedure: always tell patients what happened — concealment worsens psychological harm',
  ],
  preopVignette: {
    indication: 'Screening colonoscopy',
    setting: 'Ambulatory endoscopy suite',
    history: [
      '35-year-old female, athletic, ASA 1',
      'Low drug sensitivity (reported needing more anesthesia for prior dental procedures)',
      'No regular medications, NKDA',
      'BMI 21 — no obesity',
    ],
    exam: [
      'Airway: Mallampati 1',
      'HR 68, BP 112/72, SpO2 99%',
      'Very fit — reduced adipose tissue (smaller volume of distribution for lipophilic drugs)',
    ],
    baselineMonitors: ['SpO2', 'EtCO2', 'NIBP q5min', 'ECG'],
    targetSedationGoal: 'MOASS 2-3 — may require higher than standard doses',
  },
  drugProtocols: [
    { name: 'propofol', route: 'IV', typicalBolusRange: [60, 120], maxTotalDose: 300, unit: 'mg' },
    { name: 'fentanyl', route: 'IV', typicalBolusRange: [50, 100], maxTotalDose: 200, unit: 'mcg' },
    { name: 'midazolam', route: 'IV', typicalBolusRange: [1, 2], maxTotalDose: 6, unit: 'mg' },
  ],
  steps: [
    {
      id: 'step_drug_resistance',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        "This patient mentions she needed 'extra' anesthesia for a previous dental procedure.",
        'What factor most likely explains lower sensitivity to sedative agents in this patient?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Most likely reason for reduced sedative drug sensitivity in a fit young female?',
        options: [
          'Pharmacodynamic variability — reduced GABA-A receptor sensitivity',
          'She is making it up',
          'Higher hepatic metabolism from regular exercise',
          'Larger blood volume diluting the drugs',
        ],
        correctAnswer: 'Pharmacodynamic variability — reduced GABA-A receptor sensitivity',
        feedback: {
          'Pharmacodynamic variability — reduced GABA-A receptor sensitivity': 'Correct! GABA-A receptor subunit polymorphisms cause true pharmacodynamic variability in drug sensitivity.',
          'She is making it up': 'Never dismiss patient-reported drug sensitivity — it is a real and documented phenomenon.',
          'Higher hepatic metabolism from regular exercise': 'Exercise affects some drugs but GABA sensitivity is a receptor-level pharmacodynamic difference.',
          'Larger blood volume diluting the drugs': 'Blood volume differences are small and do not explain significant drug resistance.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 0.29 },
      ],
      teachingPoints: [
        'Drug sensitivity varies 10-fold between individuals for the same drug.',
        'Document "requires higher sedation doses" in the chart — guides future anesthesia providers.',
        'Consider EEG-guided sedation (BIS monitor) for patients with known drug resistance.',
      ],
    },
    {
      id: 'step_awareness_signs',
      phase: 'complication',
      triggerType: 'on_time',
      triggerTimeSeconds: 180,
      millieDialogue: [
        'Mid-procedure: patient suddenly reaches toward the scope, HR spikes to 118, BP 158/94.',
        'She appears to be grimacing. What does this clinical picture suggest?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Purposeful movement + tachycardia + hypertension during sedation = ?',
        options: [
          'Patient awareness — catecholamine surge from consciousness',
          'Vasovagal episode',
          'Paradoxical benzodiazepine reaction',
          'Normal movement during sedation — ignore',
        ],
        correctAnswer: 'Patient awareness — catecholamine surge from consciousness',
        feedback: {
          'Patient awareness — catecholamine surge from consciousness': 'Correct! Purposeful movement + sympathetic activation = classic awareness picture.',
          'Vasovagal episode': 'Vasovagal causes bradycardia and hypotension — opposite of this picture.',
          'Paradoxical benzodiazepine reaction': 'Paradoxical reaction is agitation after benzodiazepine without purposeful goal-directed movement.',
          'Normal movement during sedation — ignore': 'Purposeful (goal-directed) movement is never normal — it indicates inadequate depth.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'midazolam', dose: 1 },
        { type: 'administer_drug', drug: 'propofol', dose: 40 },
        { type: 'advance_time', seconds: 60 },
      ],
      teachingPoints: [
        'Awareness signs: purposeful movement, tachycardia, hypertension, sweating, eye opening, grimacing.',
        'Immediate response: supplemental propofol + midazolam. Verify IV patency — disconnected IV is a common cause.',
        'Ask patient later: "Do you recall anything from the procedure?" — disclosure obligation.',
      ],
    },
    {
      id: 'step_iv_patency',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_awareness_signs',
      millieDialogue: [
        'You gave more propofol but the patient is still moving. You notice the IV site looks swollen.',
        'What has likely happened?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'IV site is swollen, drugs not working — most likely explanation?',
        options: [
          'IV infiltration — drugs are going subcutaneously, not IV',
          'Complete drug resistance — this patient cannot be sedated',
          'Allergic reaction to propofol',
          'The drugs need more time — just wait',
        ],
        correctAnswer: 'IV infiltration — drugs are going subcutaneously, not IV',
        feedback: {
          'IV infiltration — drugs are going subcutaneously, not IV': 'Correct! Swollen IV site = infiltration. Drugs are not reaching systemic circulation.',
          'Complete drug resistance — this patient cannot be sedated': 'Drug resistance exists but does not cause complete treatment failure — check IV first.',
          'Allergic reaction to propofol': 'Allergic reaction presents with hives, hypotension, bronchospasm — not infiltration.',
          'The drugs need more time — just wait': 'Never wait when IV site is swollen and drugs are not working — check IV patency immediately.',
        },
      },
      simActions: [
        { type: 'administer_drug', drug: 'fentanyl', dose: 50 },
        { type: 'administer_drug', drug: 'propofol', dose: 60 },
        { type: 'advance_time', seconds: 90 },
      ],
      teachingPoints: [
        'IV patency: check at every bolus. Swelling, pain, or coolness at site = infiltration.',
        'Restart IV in new site before proceeding — drug delivery is the first troubleshooting step for awareness.',
        'Ensure you confirm blood flashback before giving any drug.',
      ],
    },
    {
      id: 'step_postprocedure_disclosure',
      phase: 'recovery',
      triggerType: 'on_time',
      triggerTimeSeconds: 480,
      millieDialogue: [
        'Procedure complete with new IV site and higher doses. Patient is now fully awake.',
        'She says "I think I remember something — it was like a dream." How do you respond?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Patient reports possible awareness recall — how do you respond?',
        options: [
          'Acknowledge her experience, document it, offer a full honest explanation and psychological support',
          'Tell her it was just a dream — sedation always works',
          'Say nothing and document nothing',
          'Tell her the drugs were given correctly — she must be wrong',
        ],
        correctAnswer: 'Acknowledge her experience, document it, offer a full honest explanation and psychological support',
        feedback: {
          'Acknowledge her experience, document it, offer a full honest explanation and psychological support': 'Correct! Duty of candor: disclose, document, support. This is both ethical and legally required.',
          'Tell her it was just a dream — sedation always works': 'Dismissing awareness can cause significant psychological harm and undermines trust.',
          'Say nothing and document nothing': 'Concealment of adverse events is unethical and potentially illegal.',
          'Tell her the drugs were given correctly — she must be wrong': 'Defensive response — invalidates patient experience and damages trust.',
        },
      },
      simActions: [],
      teachingPoints: [
        'Duty of candor: obligatory disclosure of any adverse event including awareness.',
        'Awareness post-sedation: document full details, offer psychological referral.',
        'PTSD can develop after awareness events — early psychological support reduces this risk.',
        'Note: "patient reports possible procedural recall — IV infiltration identified and corrected" in the chart.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'What preoperative steps could have predicted this patient\'s drug resistance?',
      'How does the medico-legal concept of "duty of candor" apply to awareness events?',
      'What changes would you make to your sedation technique for future cases with this patient?',
    ],
    keyTakeaways: [
      'Always verify IV patency before each drug bolus — infiltration is a common cause of awareness.',
      'Document patient-reported drug sensitivity and use higher starting doses for next procedure.',
      'Awareness events require honest disclosure, documentation, and psychological follow-up.',
      'Consider BIS monitoring for patients with known sedation resistance.',
    ],
  },
};

export const EXPERT_MALIGNANT_HYPERTHERMIA: InteractiveScenario = {
  id: 'expert_malignant_hyperthermia',
  title: 'Malignant Hyperthermia Mimic - Ketamine & Dental',
  difficulty: 'expert',
  patientArchetype: 'hcm_young',
  procedure: 'Complex Dental Surgery with Ketamine Sedation',
  description: 'Young male with unknown RYR1 mutation develops hyperthermia, tachycardia, and rigidity during ketamine sedation. The MH-like picture requires differential diagnosis and urgent dantrolene.',
  learningObjectives: [
    'Recognize the clinical features of malignant hyperthermia',
    'Perform rapid MH differential diagnosis (serotonin syndrome, neuroleptic malignant syndrome, heat stroke)',
    'Initiate the MH crisis protocol including dantrolene dosing',
    'Understand why ketamine can occasionally trigger MH in susceptible individuals',
  ],
  clinicalPearls: [
    'MH triad: hyperthermia + muscle rigidity + tachycardia after triggering agent',
    'Triggering agents: volatile anesthetics (halothane, sevoflurane), succinylcholine. Ketamine: rare trigger.',
    'Dantrolene 2.5 mg/kg IV: inhibits ryanodine receptor → prevents SR Ca2+ release',
    'MH hotline: 1-800-MH-HYPER — contact for real-time expert guidance',
  ],
  preopVignette: {
    indication: 'Complex third molar surgery — bone impaction, multiple extractions',
    setting: 'Oral surgery suite',
    history: [
      '22-year-old male, previously healthy, no known drug reactions',
      'ASA 1 — no prior anesthesia. Family history unknown (adopted).',
      'No medications, NKDA',
      'Has had muscle cramps with vigorous exercise (not investigated)',
    ],
    exam: [
      'Airway: Mallampati 1, excellent mouth opening',
      'HR 72, BP 118/72, SpO2 99%',
      'Athletic build, well-muscled',
    ],
    baselineMonitors: ['Continuous ECG', 'SpO2', 'EtCO2', 'Core temperature probe', 'NIBP q3min'],
    targetSedationGoal: 'MOASS 1-2 for complex dental surgery',
  },
  drugProtocols: [
    { name: 'ketamine', route: 'IV', typicalBolusRange: [1, 2], maxTotalDose: 200, unit: 'mg' },
    { name: 'midazolam', route: 'IV', typicalBolusRange: [1, 2], maxTotalDose: 4, unit: 'mg' },
    { name: 'propofol', route: 'IV', typicalBolusRange: [40, 80], maxTotalDose: 200, unit: 'mg' },
  ],
  steps: [
    {
      id: 'step_mh_history',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        "This young man mentions exercise-induced muscle cramps but never had anesthesia. Family history is unknown.",
        'What pre-anesthesia screening question would reveal MH susceptibility risk?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Best screening question for MH susceptibility?',
        options: [
          '"Has anyone in your biological family had an unusual reaction to anesthesia (high fever, muscle stiffness)?"',
          '"Do you have any drug allergies?"',
          '"Have you ever fainted?"',
          '"Do you exercise regularly?"',
        ],
        correctAnswer: '"Has anyone in your biological family had an unusual reaction to anesthesia (high fever, muscle stiffness)?"',
        feedback: {
          '"Has anyone in your biological family had an unusual reaction to anesthesia (high fever, muscle stiffness)?"': 'Correct! Family history of MH or unexplained perioperative death is the key screening question.',
          '"Do you have any drug allergies?"': 'MH is not an allergy — it is a pharmacogenomic susceptibility.',
          '"Have you ever fainted?"': 'Fainting is not related to MH.',
          '"Do you exercise regularly?"': 'Exercise-induced muscle cramps can be a sign of RYR1 mutation but is not the specific MH screening question.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 0.35 },
        { type: 'administer_drug', drug: 'midazolam', dose: 2 },
        { type: 'administer_drug', drug: 'ketamine', dose: 80 },
        { type: 'advance_time', seconds: 120 },
      ],
      teachingPoints: [
        'MH susceptibility: autosomal dominant RYR1 mutations in 70% of cases.',
        'Adopted patients or unknown family history = proceed with caution, have dantrolene available.',
        'MH-safe technique: propofol + opioid. Avoid: volatile agents, succinylcholine.',
      ],
    },
    {
      id: 'step_mh_recognition',
      phase: 'complication',
      triggerType: 'on_time',
      triggerTimeSeconds: 180,
      millieDialogue: [
        '20 minutes in: HR is 145, temperature 39.8°C (rising fast), jaw is stiff (trismus), EtCO2 is 68.',
        'This is not emergence agitation. What is happening?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Tachycardia + rising temperature + trismus + high EtCO2 — most likely diagnosis?',
        options: [
          'Malignant hyperthermia — activate MH protocol immediately',
          'Ketamine emergence reaction',
          'Neuroleptic malignant syndrome',
          'Serotonin syndrome',
        ],
        correctAnswer: 'Malignant hyperthermia — activate MH protocol immediately',
        feedback: {
          'Malignant hyperthermia — activate MH protocol immediately': 'Correct! Trismus (masseter spasm) + rising temperature + tachycardia + elevated EtCO2 = MH until proven otherwise.',
          'Ketamine emergence reaction': 'Emergence is confusion/agitation — not hyperthermia, muscle rigidity, and rising CO2.',
          'Neuroleptic malignant syndrome': 'NMS requires prior antipsychotic exposure and takes days to develop — not this acute.',
          'Serotonin syndrome': 'Serotonin syndrome requires serotonergic drug exposure — this patient has none.',
        },
      },
      simActions: [
        { type: 'set_fio2', fio2: 1.0 },
        { type: 'apply_intervention', intervention: 'bag_mask' },
      ],
      teachingPoints: [
        'MH clinical criteria (Larach score): temperature rise ≥1.5°C/hr, masseter spasm, EtCO2 >55 despite adequate ventilation.',
        'CALL for help immediately — MH crisis requires a team response.',
        'Stop any triggering agent immediately.',
      ],
    },
    {
      id: 'step_dantrolene',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_mh_recognition',
      millieDialogue: [
        'MH protocol activated. What is the correct initial dantrolene dose for this 80 kg patient?',
      ],
      question: {
        type: 'numeric_range',
        prompt: 'Dantrolene initial IV bolus in mg for MH (2.5 mg/kg × 80 kg)',
        correctAnswer: 200,
        idealRange: [160, 240],
        feedback: {
          low: 'Below 160 mg is underdosing — 2.5 mg/kg is the minimum initial dose.',
          ideal: '2.5 mg/kg (200 mg) is the correct initial dose. Can repeat every 5 minutes to max 10 mg/kg.',
          high: 'Above 240 mg as initial dose is higher than recommended starting dose.',
        },
      },
      simActions: [
        { type: 'set_fio2', fio2: 1.0 },
        { type: 'set_airway_device', device: 'ett' },
      ],
      teachingPoints: [
        'Dantrolene 2.5 mg/kg IV: inhibits RYR1 receptor → reduces SR calcium release → breaks muscle hypermetabolism.',
        'Dantrolene reconstitution: 20 mg per vial + 60 mL sterile water. For 200 mg: need 10 vials — requires team effort.',
        'MH hotline: 1-800-MH-HYPER — provides real-time dosing guidance.',
        'Repeat 2.5 mg/kg every 5 min until symptoms abate. Max 10 mg/kg.',
      ],
    },
    {
      id: 'step_mh_treatment',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_dantrolene',
      millieDialogue: [
        'Dantrolene given. What other cooling and metabolic interventions are needed?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Additional treatment measures for MH besides dantrolene?',
        options: [
          'Active cooling + bicarbonate for acidosis + treat arrhythmias + ICU admission',
          'Dantrolene is sufficient — no other treatment needed',
          'Succinylcholine to relax the muscles',
          'Propofol infusion to suppress temperature',
        ],
        correctAnswer: 'Active cooling + bicarbonate for acidosis + treat arrhythmias + ICU admission',
        feedback: {
          'Active cooling + bicarbonate for acidosis + treat arrhythmias + ICU admission': 'Correct! MH is a multi-system crisis requiring comprehensive treatment.',
          'Dantrolene is sufficient — no other treatment needed': 'Dantrolene addresses the primary cause but supportive treatment of complications is essential.',
          'Succinylcholine to relax the muscles': 'Succinylcholine can TRIGGER MH — absolutely contraindicated.',
          'Propofol infusion to suppress temperature': 'Propofol is not a temperature control agent and is safe to use but does not treat hyperthermia directly.',
        },
      },
      simActions: [
        { type: 'set_fio2', fio2: 1.0 },
      ],
      teachingPoints: [
        'MH comprehensive treatment: Dantrolene + active cooling + sodium bicarbonate 1-2 mEq/kg + treat VF/VT.',
        'Target core temperature <38.5°C. Stop cooling at 38°C — avoid overcorrection.',
        'ICU admission for 24-48 hours — late MH recurrence can occur.',
        'Test patient and family for RYR1 mutation — referral to MH testing center.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'What would you tell this patient and his family after this MH event?',
      'How does MH differ from serotonin syndrome and neuroleptic malignant syndrome?',
      'What anesthetic technique would you use for this patient\'s future surgeries?',
    ],
    keyTakeaways: [
      'MH: hyperthermia + rigidity + tachycardia + rising EtCO2 = dantrolene + cooling + call MH hotline.',
      'Dantrolene 2.5 mg/kg IV: repeat every 5 min to max 10 mg/kg.',
      'Succinylcholine is absolutely contraindicated in MH susceptible patients.',
      'Future anesthesia: total IV anesthesia (TIVA) with propofol + opioid only — no volatile agents.',
    ],
  },
};

export const EXPERT_CARDIAC_ARREST: InteractiveScenario = {
  id: 'expert_cardiac_arrest',
  title: 'Cardiac Arrest During Sedation - VFib in HCM Patient',
  difficulty: 'expert',
  patientArchetype: 'hcm_old',
  procedure: 'Third Molar Surgery',
  description: 'Elderly patient with hypertrophic cardiomyopathy (HCM) and known VT history develops ventricular fibrillation during routine third molar surgery under sedation. Requires immediate ACLS.',
  learningObjectives: [
    'Recognize ventricular fibrillation from the ECG during sedation',
    'Apply ACLS high-quality CPR and defibrillation immediately',
    'Understand how HCM creates substrate for VF during sedation',
    'Manage post-ROSC care in the sedation setting',
  ],
  clinicalPearls: [
    'HCM: dynamic LVOT obstruction worsened by tachycardia, vasodilation (propofol), and reduced preload',
    'Sedation for HCM: maintain heart rate (not too fast, not too slow), volume loading, avoid vasodilators',
    'VFib management: CPR + shock within 2 minutes = 70%+ survival. Every minute without shock: -10% survival.',
    'Post-ROSC: targeted temperature management, ECHO to assess function, cardiac catheterization consideration',
  ],
  preopVignette: {
    indication: 'Third molar extraction under IV sedation — patient refused GA',
    setting: 'Oral surgery suite with AED available',
    history: [
      '70-year-old male, HCM (septal hypertrophy 22mm on echo)',
      'Known non-sustained VT on Holter, on amiodarone and metoprolol',
      'ASA 3 — compensated HCM, no syncope',
      'Cardiologist cleared for sedation with specific recommendations',
    ],
    exam: [
      'Airway: Mallampati 2',
      'HR 58 (beta-blocked), BP 128/82, SpO2 98%',
      'Soft systolic murmur at LLSB — dynamic obstruction',
    ],
    labs: ['Echo: EF 70%, septal thickness 22mm, mild LVOT gradient 18mmHg at rest'],
    baselineMonitors: ['Continuous 12-lead ECG capability', 'SpO2', 'Arterial line (recommended)', 'NIBP q3min', 'AED/defibrillator at bedside'],
    targetSedationGoal: 'MOASS 3-4 ONLY — avoid deep sedation in HCM. No propofol alone.',
  },
  drugProtocols: [
    { name: 'midazolam', route: 'IV', typicalBolusRange: [0.5, 1], maxTotalDose: 3, unit: 'mg' },
    { name: 'fentanyl', route: 'IV', typicalBolusRange: [25, 50], maxTotalDose: 100, unit: 'mcg' },
    { name: 'ketamine', route: 'IV', typicalBolusRange: [20, 40], maxTotalDose: 100, unit: 'mg' },
  ],
  steps: [
    {
      id: 'step_hcm_physiology',
      phase: 'pre_induction',
      triggerType: 'on_start',
      millieDialogue: [
        "This HCM patient has a dynamic LVOT obstruction. His cardiologist said 'avoid vasodilators and tachycardia'.",
        'Why is propofol potentially dangerous in HCM?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Why is propofol potentially hazardous in HCM with LVOT obstruction?',
        options: [
          'Propofol vasodilation reduces preload and afterload → worsens LVOT obstruction → cardiovascular collapse',
          'Propofol is arrhythmogenic in HCM',
          'Propofol causes bradycardia, worsening heart block',
          'Propofol increases LVOT gradient by stimulating myocardial contraction',
        ],
        correctAnswer: 'Propofol vasodilation reduces preload and afterload → worsens LVOT obstruction → cardiovascular collapse',
        feedback: {
          'Propofol vasodilation reduces preload and afterload → worsens LVOT obstruction → cardiovascular collapse': 'Correct! HCM LVOT obstruction worsens with reduced preload/afterload — propofol vasodilation is catastrophic.',
          'Propofol is arrhythmogenic in HCM': 'While arrhythmias can occur, the primary danger is hemodynamic from vasodilation and preload reduction.',
          'Propofol causes bradycardia, worsening heart block': 'Propofol can cause mild bradycardia but this is not the primary HCM risk.',
          'Propofol increases LVOT gradient by stimulating myocardial contraction': 'Propofol is a myocardial depressant, not a stimulant.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'nasal_cannula' },
        { type: 'set_fio2', fio2: 0.32 },
        { type: 'administer_drug', drug: 'midazolam', dose: 1 },
        { type: 'administer_drug', drug: 'fentanyl', dose: 25 },
        { type: 'advance_time', seconds: 90 },
      ],
      teachingPoints: [
        'HCM sedation principles: maintain preload (IV fluids), maintain afterload (avoid vasodilators), control HR (neither too fast nor too slow).',
        'Safe HCM sedation: midazolam + fentanyl only, or ketamine (maintains sympathetic tone).',
        'Pre-load with 250-500 mL NS before sedation.',
      ],
    },
    {
      id: 'step_vfib_recognition',
      phase: 'complication',
      triggerType: 'on_time',
      triggerTimeSeconds: 180,
      millieDialogue: [
        'Suddenly, the ECG alarm sounds — chaotic disorganized waveform, no recognizable QRS.',
        'SpO2 probe falls off. The oral surgeon turns to you in panic.',
        'What rhythm is this and what do you do FIRST?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Chaotic ECG without recognizable QRS — FIRST action?',
        options: [
          'Confirm pulselessness, call for help, start CPR immediately',
          'Wait 30 seconds for spontaneous conversion',
          'Give amiodarone 300 mg IV immediately',
          'Increase O2 and see if rhythm converts',
        ],
        correctAnswer: 'Confirm pulselessness, call for help, start CPR immediately',
        feedback: {
          'Confirm pulselessness, call for help, start CPR immediately': 'Correct! VFib = no pulse = start CPR + call for help + get defibrillator. Every second counts.',
          'Wait 30 seconds for spontaneous conversion': 'VFib does not self-terminate — waiting kills neurons. Start CPR immediately.',
          'Give amiodarone 300 mg IV immediately': 'Amiodarone is given AFTER the first shock — start CPR and defibrillation first.',
          'Increase O2 and see if rhythm converts': 'VFib is a cardiac arrest — O2 alone will not convert it.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'bag_mask' },
        { type: 'set_fio2', fio2: 1.0 },
      ],
      teachingPoints: [
        'VFib recognition: chaotic, irregularly irregular ECG with no organized QRS complex.',
        'CPR first: rate 100-120/min, depth ≥2 inches, minimize interruptions.',
        'Time to first shock: every 1 minute delay reduces survival by ~10%.',
      ],
    },
    {
      id: 'step_defibrillation',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_vfib_recognition',
      millieDialogue: [
        'CPR is ongoing. The AED is ready. What is the correct defibrillation dose?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Correct defibrillation energy for VFib with biphasic defibrillator?',
        options: [
          '200 J biphasic (or maximum for device) — shock immediately',
          '50 J — start low, titrate up',
          '360 J monophasic equivalent first',
          '100 J initially, then 200 J if unsuccessful',
        ],
        correctAnswer: '200 J biphasic (or maximum for device) — shock immediately',
        feedback: {
          '200 J biphasic (or maximum for device) — shock immediately': 'Correct! AHA 2020: biphasic 200 J (or device maximum). Monophasic: 360 J.',
          '50 J — start low, titrate up': 'Sub-therapeutic dose wastes time — start at 200 J for VFib.',
          '360 J monophasic equivalent first': '360 J is correct for monophasic only — modern biphasic defibrillators are more efficient at 200 J.',
          '100 J initially, then 200 J if unsuccessful': 'No evidence for escalating protocol — start at 200 J for VFib.',
        },
      },
      simActions: [
        { type: 'set_fio2', fio2: 1.0 },
        { type: 'apply_intervention', intervention: 'bag_mask' },
      ],
      teachingPoints: [
        'Defibrillation: 200 J biphasic first. Resume CPR immediately after shock — do not wait to check pulse.',
        'Post-shock rhythm check: 2 minutes of CPR before rhythm check.',
        'Epinephrine 1 mg IV every 3-5 minutes after first shock.',
      ],
    },
    {
      id: 'step_post_rosc',
      phase: 'recovery',
      triggerType: 'on_time',
      triggerTimeSeconds: 420,
      millieDialogue: [
        'After 2 shocks and 4 minutes of CPR, ROSC achieved! HR 68, BP 102/66.',
        'What are the immediate post-ROSC priorities?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Immediate post-ROSC priorities after VFib in HCM?',
        options: [
          '12-lead ECG, airway secured, transfer to ICU for targeted temperature management + cardiology',
          'Discharge home after 30 minutes observation',
          'Resume the dental procedure immediately',
          'Give full amiodarone infusion and monitor in this room',
        ],
        correctAnswer: '12-lead ECG, airway secured, transfer to ICU for targeted temperature management + cardiology',
        feedback: {
          '12-lead ECG, airway secured, transfer to ICU for targeted temperature management + cardiology': 'Correct! All post-VFib ROSC patients need ICU level care, ECG, and cardiology involvement.',
          'Discharge home after 30 minutes observation': 'Absolutely not — post-VFib patients require ICU admission.',
          'Resume the dental procedure immediately': 'No procedure after cardiac arrest in a dental suite.',
          'Give full amiodarone infusion and monitor in this room': 'Amiodarone is appropriate but ICU transfer is mandatory — cannot manage post-arrest in a dental suite.',
        },
      },
      simActions: [
        { type: 'set_airway_device', device: 'ett' },
        { type: 'set_fio2', fio2: 1.0 },
      ],
      teachingPoints: [
        'Post-ROSC: 12-lead ECG to assess for STEMI (PCI indication), secure airway, transfer to ICU.',
        'Targeted temperature management: 32-36°C for 24 hours if comatose post-ROSC.',
        'Cardiology: evaluate for ICD implantation in HCM with VFib arrest.',
        'Document everything: times, interventions, drug doses — legal and quality improvement.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'What is the acceptable minimum response time to first defibrillation in an outpatient sedation suite?',
      'How does HCM pathophysiology create the substrate for VFib?',
      'What sedation technique would you use for future procedures in this patient?',
    ],
    keyTakeaways: [
      'HCM + sedation: maintain preload/afterload, avoid propofol vasodilation, use ketamine or midazolam.',
      'VFib: confirm pulselessness, CPR immediately, shock at 200 J biphasic, resume CPR after shock.',
      'AED should be present within 3 minutes of ANY procedure room with sedation.',
      'All post-VFib ROSC patients: ICU, 12-lead ECG, cardiology, consider TTM.',
    ],
  },
};

export const EXPERT_SCENARIOS: InteractiveScenario[] = [
  EXPERT_PRIS,
  EXPERT_MULTI_DRUG,
  EXPERT_AWARENESS,
  EXPERT_MALIGNANT_HYPERTHERMIA,
  EXPERT_CARDIAC_ARREST,
];
