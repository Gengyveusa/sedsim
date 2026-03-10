import { InteractiveScenario } from '../ScenarioEngine';
import type { ScoringRubric } from '../scoringEngine';

/** Shared rubric for all BLS/ACLS scenarios. */
const BLS_RUBRIC: ScoringRubric = {
  passThreshold: 70,
  weights: { timing: 0.20, appropriateness: 0.20, safety: 0.40, completeness: 0.20 },
  criteria: {
    timing: { targetDurationSec: 600, toleranceSec: 90 },
    appropriateness: {
      drugRanges: [
        { drug: 'epinephrine', minDose: 0.5, maxDose: 1.5 },
        { drug: 'atropine',    minDose: 0.4, maxDose: 1.0 },
        { drug: 'amiodarone',  minDose: 150, maxDose: 400 },
        { drug: 'naloxone',    minDose: 0.04, maxDose: 0.4 },
      ],
    },
    safety: { spo2DangerThreshold: 85, moassMinAllowed: 0, maxDangerSeconds: 30 },
    completeness: { requiredStepFraction: 0.85 },
  },
};


// ─────────────────────────────────────────────────────────────────────────────
// BLS Cardiac Arrest Scenarios for SedSim
// ─────────────────────────────────────────────────────────────────────────────

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. Adult VFib Cardiac Arrest
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const BLS_ADULT_VFIB_ARREST: InteractiveScenario = {
  id: 'bls_adult_vfib_arrest',
  title: 'Adult VFib Cardiac Arrest During Sedation',
  difficulty: 'hard',
  patientArchetype: 'healthy_adult',
  procedure: 'BLS Cardiac Arrest Management',
  description:
    'A 55-year-old male collapses during moderate sedation for colonoscopy. Monitor shows ventricular fibrillation. Learner must recognize cardiac arrest, initiate high-quality CPR, apply the AED, deliver shock, and manage through ROSC.',
  learningObjectives: [
    'Recognize cardiac arrest and activate emergency response',
    'Initiate high-quality CPR within 10 seconds of recognition',
    'Apply AED and deliver shock for VFib',
    'Perform 2-minute CPR cycles with minimal interruptions',
    'Recognize return of spontaneous circulation (ROSC)',
    'Initiate post-cardiac arrest care',
  ],
  clinicalPearls: [
    'Push hard (≥2 inches / 5 cm), push fast (100-120/min), allow full chest recoil',
    'Minimize interruptions in chest compressions — pauses <10 seconds',
    'VFib is a shockable rhythm — early defibrillation is the definitive treatment',
    'CPR before and after shock — do not delay compressions for rhythm analysis',
    'In-facility arrests have better outcomes due to witnessed collapse and immediate CPR',
  ],
  preopVignette: {
    indication: 'Screening colonoscopy under moderate sedation',
    setting: 'Ambulatory endoscopy suite',
    history: [
      '55-year-old male, history of hyperlipidemia and smoking (20 pack-years)',
      'No known cardiac disease, last stress test 3 years ago was normal',
      'Medications: atorvastatin 40 mg daily. NKDA.',
      'Received midazolam 2 mg + fentanyl 75 mcg IV over past 10 minutes',
    ],
    exam: [
      'Pre-procedure: HR 78, BP 142/88, SpO2 98% on 2L NC',
      'Airway: Mallampati II, BMI 29',
      'CV: RRR, no murmurs. Lungs: CTA bilaterally',
    ],
    baselineMonitors: ['Continuous ECG', 'SpO2', 'NIBP q5min', 'Capnography'],
    targetSedationGoal: 'Recognize VFib arrest → High-quality CPR → AED shock → ROSC',
  },
  drugProtocols: [
    { name: 'epinephrine', route: 'IV', typicalBolusRange: [1, 1], maxTotalDose: 10, unit: 'mg' },
  ],
  patientDetail: {
    age: 55,
    sex: 'M',
    heightCm: 178,
    weightKg: 90,
    asa: 2,
    comorbidities: ['hyperlipidemia', 'smoking history'],
    airway: {
      mallampati: 2,
      bmi: 29,
    },
  },
  steps: [
    {
      id: 'step_arrest_recognition',
      phase: 'complication',
      triggerType: 'on_start',
      millieDialogue: [
        'The colonoscopy has been underway for 8 minutes. Suddenly the patient becomes unresponsive.',
        'The monitor alarm sounds — look at the ECG. The patient has no pulse.',
        'What is the FIRST thing you should do?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Patient is unresponsive with no pulse. First action?',
        options: [
          'Call for help and begin chest compressions immediately',
          'Give another dose of midazolam to deepen sedation',
          'Check blood pressure and wait for next reading',
          'Administer flumazenil to reverse sedation',
        ],
        correctAnswer: 'Call for help and begin chest compressions immediately',
        feedback: {
          'Call for help and begin chest compressions immediately':
            'Correct! Activate emergency response and start CPR within 10 seconds of recognizing arrest.',
          'Give another dose of midazolam to deepen sedation':
            'Dangerous — this patient is in cardiac arrest, not oversedated.',
          'Check blood pressure and wait for next reading':
            'No — unresponsive + no pulse = cardiac arrest. Every second without CPR reduces survival.',
          'Administer flumazenil to reverse sedation':
            'This is cardiac arrest, not oversedation. Reversal agents will not help a fibrillating heart.',
        },
      },
      simActions: [
        { type: 'set_vital', parameter: 'hr', value: 0 },
        { type: 'set_vital', parameter: 'sbp', value: 0 },
        { type: 'set_vital', parameter: 'spo2', value: 45 },
        { type: 'set_vital', parameter: 'etco2', value: 8 },
        { type: 'set_vital', parameter: 'rr', value: 0 },
      ],
      highlight: ['hr-display', 'spo2-display', 'ecg-display'],
      teachingPoints: [
        'Cardiac arrest recognition: unresponsive + no normal breathing + no pulse.',
        'In a monitored setting, VFib on the monitor with loss of consciousness is immediate confirmation.',
        'AHA guidelines: begin CPR within 10 seconds of arrest recognition.',
      ],
    },
    {
      id: 'step_cpr_quality',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_arrest_recognition',
      millieDialogue: [
        'Good — you have called for help and started chest compressions.',
        'What are the key parameters for high-quality adult CPR?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Which describes correct adult CPR parameters?',
        options: [
          'Rate 100-120/min, depth ≥2 inches (5 cm), full recoil, minimize interruptions',
          'Rate 80-100/min, depth 1 inch (2.5 cm), full recoil',
          'Rate 120-140/min, depth ≥3 inches (7.5 cm), quick compressions',
          'Rate 100-120/min, depth ≥2 inches, lean on chest between compressions',
        ],
        correctAnswer:
          'Rate 100-120/min, depth ≥2 inches (5 cm), full recoil, minimize interruptions',
        feedback: {
          'Rate 100-120/min, depth ≥2 inches (5 cm), full recoil, minimize interruptions':
            'Correct! These are the AHA high-quality CPR benchmarks.',
          'Rate 80-100/min, depth 1 inch (2.5 cm), full recoil':
            'Too slow and too shallow — inadequate perfusion pressure.',
          'Rate 120-140/min, depth ≥3 inches (7.5 cm), quick compressions':
            'Too fast and too deep — risks rib fractures and incomplete recoil reduces venous return.',
          'Rate 100-120/min, depth ≥2 inches, lean on chest between compressions':
            'Leaning prevents full recoil and reduces venous return — a common CPR error.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'chest_compressions' },
        { type: 'advance_time', seconds: 30 },
      ],
      highlight: ['ecg-display'],
      teachingPoints: [
        'High-quality CPR: push hard (≥5 cm), push fast (100-120/min), allow full recoil.',
        'Compression fraction goal: ≥80% — minimize any pauses.',
        '30:2 compression-to-ventilation ratio for single rescuer with no advanced airway.',
      ],
    },
    {
      id: 'step_aed_application',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_cpr_quality',
      millieDialogue: [
        'Someone has brought the AED. You need to apply it while minimizing CPR interruptions.',
        'How should you coordinate AED application with CPR?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'How to apply AED while maintaining CPR quality?',
        options: [
          'Continue CPR while pads are applied — pause only for rhythm analysis',
          'Stop CPR completely, apply pads, then analyze rhythm',
          'Apply pads but continue CPR through the analysis phase',
          'Wait for 5 complete CPR cycles before applying the AED',
        ],
        correctAnswer:
          'Continue CPR while pads are applied — pause only for rhythm analysis',
        feedback: {
          'Continue CPR while pads are applied — pause only for rhythm analysis':
            'Correct! A second rescuer applies pads while compressions continue. Pause only when AED says "analyzing."',
          'Stop CPR completely, apply pads, then analyze rhythm':
            'Unnecessary pause — pads can be applied during ongoing compressions.',
          'Apply pads but continue CPR through the analysis phase':
            'Compressions during analysis cause artifact — the AED cannot read the rhythm accurately.',
          'Wait for 5 complete CPR cycles before applying the AED':
            'No — apply AED as soon as it arrives. Early defibrillation is critical for VFib.',
        },
      },
      simActions: [{ type: 'advance_time', seconds: 30 }],
      highlight: ['ecg-display'],
      teachingPoints: [
        'AED pads go on during CPR — second rescuer applies while first continues compressions.',
        'Pause compressions only when AED announces "Analyzing rhythm — do not touch the patient."',
        'Anterior-lateral pad placement: right infraclavicular + left mid-axillary.',
      ],
    },
    {
      id: 'step_shock_delivery',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_aed_application',
      millieDialogue: [
        'The AED analyzes: "Shockable rhythm detected. Shock advised."',
        'What do you do now?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'AED advises shock. Next action?',
        options: [
          'Ensure no one is touching the patient, press shock button, resume CPR immediately after',
          'Check pulse first before delivering shock',
          'Deliver shock, then wait 2 minutes to check pulse before resuming CPR',
          'Override the AED — continue CPR without shocking',
        ],
        correctAnswer:
          'Ensure no one is touching the patient, press shock button, resume CPR immediately after',
        feedback: {
          'Ensure no one is touching the patient, press shock button, resume CPR immediately after':
            'Correct! Clear the patient, deliver shock, and resume CPR immediately — do not check pulse yet.',
          'Check pulse first before delivering shock':
            'No — the AED confirmed a shockable rhythm. Pulse checks delay defibrillation.',
          'Deliver shock, then wait 2 minutes to check pulse before resuming CPR':
            'Resume CPR immediately after shock — do not wait. The 2-minute cycle starts with compressions.',
          'Override the AED — continue CPR without shocking':
            'VFib requires defibrillation. CPR alone cannot convert VFib — shock is the definitive treatment.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'defibrillation' },
        { type: 'advance_time', seconds: 5 },
        { type: 'apply_intervention', intervention: 'chest_compressions' },
        { type: 'advance_time', seconds: 120 },
      ],
      highlight: ['ecg-display', 'hr-display'],
      teachingPoints: [
        'After shock delivery: resume CPR immediately for 2 minutes before next rhythm check.',
        'VFib → shock → immediate CPR. Do NOT pause to check pulse right after the shock.',
        'Early defibrillation for VFib: survival decreases ~10% per minute without defibrillation.',
      ],
    },
    {
      id: 'step_rosc_recognition',
      phase: 'recovery',
      triggerType: 'on_step_complete',
      afterStepId: 'step_shock_delivery',
      millieDialogue: [
        'Two minutes of CPR completed after the shock. The AED re-analyzes: "No shock advised."',
        'You check a pulse — there is a strong carotid pulse. HR 88, BP 95/60. EtCO2 jumps to 38 mmHg.',
        'What does this indicate?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Pulse present, rising EtCO2, organized rhythm on monitor — what happened?',
        options: [
          'Return of spontaneous circulation (ROSC) — stop CPR and begin post-arrest care',
          'AED malfunction — continue CPR regardless',
          'The patient is in asystole — continue CPR',
          'Pulseless electrical activity — continue CPR',
        ],
        correctAnswer:
          'Return of spontaneous circulation (ROSC) — stop CPR and begin post-arrest care',
        feedback: {
          'Return of spontaneous circulation (ROSC) — stop CPR and begin post-arrest care':
            'Correct! Palpable pulse + rising EtCO2 + organized rhythm = ROSC. Transition to post-arrest care.',
          'AED malfunction — continue CPR regardless':
            'The clinical signs (pulse, EtCO2, rhythm) all confirm ROSC. This is not a malfunction.',
          'The patient is in asystole — continue CPR':
            'The patient has a pulse and organized rhythm — this is ROSC, not asystole.',
          'Pulseless electrical activity — continue CPR':
            'PEA means organized rhythm WITHOUT a pulse. This patient has a pulse — this is ROSC.',
        },
      },
      simActions: [
        { type: 'set_vital', parameter: 'hr', value: 88 },
        { type: 'set_vital', parameter: 'sbp', value: 95 },
        { type: 'set_vital', parameter: 'spo2', value: 92 },
        { type: 'set_vital', parameter: 'etco2', value: 38 },
        { type: 'set_vital', parameter: 'rr', value: 14 },
      ],
      highlight: ['hr-display', 'spo2-display', 'etco2-display'],
      teachingPoints: [
        'ROSC indicators: palpable pulse, rising EtCO2 (>40 suggests good cardiac output), organized ECG rhythm.',
        'EtCO2 is the earliest and most reliable indicator of ROSC — a sudden jump during CPR is a strong sign.',
        'Post-ROSC: optimize oxygenation (SpO2 92-98%), maintain BP, monitor for re-arrest.',
      ],
    },
    {
      id: 'step_post_rosc',
      phase: 'recovery',
      triggerType: 'on_step_complete',
      afterStepId: 'step_rosc_recognition',
      millieDialogue: [
        'Excellent work — you achieved ROSC. The patient is breathing spontaneously.',
        'What are your immediate post-ROSC priorities?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Immediate post-ROSC priorities?',
        options: [
          'Optimize oxygenation (SpO2 92-98%), maintain BP, 12-lead ECG, prepare for transport to higher care',
          'Extubate immediately and resume the colonoscopy',
          'Give epinephrine 1 mg IV to maintain blood pressure',
          'Discharge the patient once vitals are stable for 5 minutes',
        ],
        correctAnswer:
          'Optimize oxygenation (SpO2 92-98%), maintain BP, 12-lead ECG, prepare for transport to higher care',
        feedback: {
          'Optimize oxygenation (SpO2 92-98%), maintain BP, 12-lead ECG, prepare for transport to higher care':
            'Correct! Post-ROSC care: targeted oxygenation, hemodynamic support, 12-lead ECG for STEMI, arrange definitive care.',
          'Extubate immediately and resume the colonoscopy':
            'Absolutely not — this patient had a cardiac arrest. The procedure is cancelled. ICU care is needed.',
          'Give epinephrine 1 mg IV to maintain blood pressure':
            'Arrest-dose epinephrine post-ROSC causes dangerous hypertension and tachycardia. Use vasopressors if needed at lower doses.',
          'Discharge the patient once vitals are stable for 5 minutes':
            'A cardiac arrest patient requires ICU-level care, cardiac catheterization evaluation, and prolonged monitoring.',
        },
      },
      simActions: [
        { type: 'set_fio2', fio2: 1.0 },
        { type: 'advance_time', seconds: 60 },
      ],
      highlight: ['spo2-display', 'fio2-slider'],
      teachingPoints: [
        'Post-ROSC: avoid hyperoxia (target SpO2 92-98%), titrate FiO2 down once SpO2 is adequate.',
        '12-lead ECG immediately post-ROSC to evaluate for STEMI — emergent cath if indicated.',
        'Prepare for targeted temperature management (TTM) — 32-36°C for comatose post-arrest patients.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'What were the earliest signs of cardiac arrest in this monitored patient?',
      'How did continuous monitoring change your response time compared to an unmonitored collapse?',
      'What factors in this patient\'s history may have predisposed him to VFib arrest?',
      'How would your approach differ if the AED had said "No shock advised" on first analysis?',
    ],
    keyTakeaways: [
      'VFib cardiac arrest: early defibrillation is the single most important intervention.',
      'High-quality CPR: rate 100-120/min, depth ≥5 cm, full recoil, minimal interruptions.',
      'AED use: apply during CPR, pause only for analysis, shock then immediately resume CPR.',
      'ROSC recognition: palpable pulse + sudden EtCO2 rise + organized rhythm on monitor.',
      'Post-ROSC: targeted oxygenation, 12-lead ECG, hemodynamic support, arrange definitive care.',
    ],
  },
  scoringRubric: BLS_RUBRIC,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. Adult Asystole Cardiac Arrest
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const BLS_ADULT_ASYSTOLE: InteractiveScenario = {
  id: 'bls_adult_asystole',
  title: 'Adult Asystole — Non-Shockable Arrest',
  difficulty: 'hard',
  patientArchetype: 'elderly',
  procedure: 'BLS Non-Shockable Arrest Management',
  description:
    'A 72-year-old female with multiple comorbidities arrests during sedation for upper endoscopy. The rhythm is asystole — non-shockable. Learner must recognize the non-shockable rhythm, perform high-quality CPR, correctly interpret AED "no shock advised," and manage continuous CPR cycles.',
  learningObjectives: [
    'Differentiate shockable (VFib/pVT) from non-shockable (asystole/PEA) rhythms',
    'Perform high-quality CPR for non-shockable arrest',
    'Correctly respond to AED "no shock advised" — continue CPR',
    'Manage 2-minute CPR cycles with rhythm checks',
    'Recognize reversible causes (Hs and Ts)',
    'Understand when to consider termination of resuscitation',
  ],
  clinicalPearls: [
    'Asystole: confirm in 2 leads — check cable connections and gain to rule out fine VFib',
    '"No shock advised" does NOT mean stop — it means continue CPR',
    'Asystole has a worse prognosis than VFib — CPR quality is paramount',
    'Search for reversible causes: Hypovolemia, Hypoxia, H+, Hypo/Hyperkalemia, Hypothermia, Tension pneumo, Tamponade, Toxins, Thrombosis (PE/MI)',
    'Do NOT defibrillate asystole — it will not help and delays compressions',
  ],
  preopVignette: {
    indication: 'Upper endoscopy for iron deficiency anemia workup',
    setting: 'Ambulatory endoscopy suite',
    history: [
      '72-year-old female, ASA 3 — HTN, type 2 DM, CKD stage 3',
      'History of atrial fibrillation on apixaban (held for procedure)',
      'Iron deficiency anemia (Hgb 8.2) — reason for upper endoscopy',
      'Medications: metoprolol, lisinopril, metformin, apixaban (held). NKDA.',
      'Received midazolam 1 mg + fentanyl 50 mcg IV',
    ],
    exam: [
      'Pre-procedure: HR 62 (on metoprolol), BP 128/74, SpO2 96% on 2L NC',
      'Airway: Mallampati II, dentures removed',
      'CV: Irregularly irregular (AFib), no murmurs. Lungs: bibasilar crackles',
    ],
    labs: [
      'Hgb: 8.2 g/dL, K+: 5.1 mEq/L (high normal)',
      'Creatinine: 1.8 mg/dL (CKD3)',
      'ECG: atrial fibrillation, rate controlled',
    ],
    baselineMonitors: ['Continuous ECG', 'SpO2', 'NIBP q3min', 'Capnography'],
    targetSedationGoal: 'Recognize asystole → High-quality CPR → AED no shock → Continue CPR cycles',
  },
  drugProtocols: [
    { name: 'epinephrine', route: 'IV', typicalBolusRange: [1, 1], maxTotalDose: 10, unit: 'mg' },
  ],
  patientDetail: {
    age: 72,
    sex: 'F',
    heightCm: 160,
    weightKg: 68,
    asa: 3,
    comorbidities: ['hypertension', 'type 2 diabetes', 'CKD stage 3', 'atrial fibrillation', 'anemia'],
    airway: {
      mallampati: 2,
      bmi: 26.6,
    },
  },
  steps: [
    {
      id: 'step_arrest_recognition',
      phase: 'complication',
      triggerType: 'on_start',
      millieDialogue: [
        'During the endoscopy, the ECG monitor suddenly shows a flat line. The patient is unresponsive.',
        'SpO2 probe loses signal. No palpable carotid pulse.',
        'What rhythm are you seeing and what does it mean?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Flat line on ECG, no pulse, unresponsive. What rhythm is this?',
        options: [
          'Asystole — non-shockable cardiac arrest',
          'Ventricular fibrillation — shockable rhythm',
          'Artifact — the ECG leads fell off',
          'Normal sinus rhythm — the monitor is malfunctioning',
        ],
        correctAnswer: 'Asystole — non-shockable cardiac arrest',
        feedback: {
          'Asystole — non-shockable cardiac arrest':
            'Correct! Flat line + no pulse + unresponsive = asystole. This is a non-shockable rhythm. Begin CPR immediately.',
          'Ventricular fibrillation — shockable rhythm':
            'VFib shows chaotic electrical activity, not a flat line. This is asystole.',
          'Artifact — the ECG leads fell off':
            'Always consider lead disconnect, but combined with no pulse and unresponsiveness, this is asystole until proven otherwise. Start CPR.',
          'Normal sinus rhythm — the monitor is malfunctioning':
            'A flat line with no pulse is never normal sinus rhythm. This is cardiac arrest.',
        },
      },
      simActions: [
        { type: 'set_vital', parameter: 'hr', value: 0 },
        { type: 'set_vital', parameter: 'sbp', value: 0 },
        { type: 'set_vital', parameter: 'spo2', value: 40 },
        { type: 'set_vital', parameter: 'etco2', value: 6 },
        { type: 'set_vital', parameter: 'rr', value: 0 },
      ],
      highlight: ['ecg-display', 'hr-display'],
      teachingPoints: [
        'Asystole confirmation: check in 2 leads, verify cable connections, increase gain.',
        'If flat line + no pulse → treat as asystole. Start CPR immediately while confirming.',
        'Asystole is a NON-shockable rhythm — defibrillation will not help.',
      ],
    },
    {
      id: 'step_confirm_asystole',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_arrest_recognition',
      millieDialogue: [
        'You have started CPR. Someone questions whether this might be very fine VFib.',
        'How do you differentiate asystole from fine VFib?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'How do you confirm asystole vs fine VFib?',
        options: [
          'Confirm flat line in 2 leads, check connections, increase gain — if still flat, treat as asystole',
          'Shock empirically — if it was fine VFib, the shock will convert it',
          'Switch to a different monitor to get a second opinion',
          'The distinction does not matter — treat both the same way',
        ],
        correctAnswer:
          'Confirm flat line in 2 leads, check connections, increase gain — if still flat, treat as asystole',
        feedback: {
          'Confirm flat line in 2 leads, check connections, increase gain — if still flat, treat as asystole':
            'Correct! Systematic confirmation. If flat line persists in multiple leads, this is asystole.',
          'Shock empirically — if it was fine VFib, the shock will convert it':
            'AHA recommends against shocking asystole. If uncertain, high-quality CPR may convert fine VFib to coarser VFib that is then shockable.',
          'Switch to a different monitor to get a second opinion':
            'Changing the lead on the same monitor is sufficient — checking 2 leads is the standard.',
          'The distinction does not matter — treat both the same way':
            'It matters — VFib is shockable, asystole is not. But CPR is appropriate for both.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'chest_compressions' },
        { type: 'advance_time', seconds: 30 },
      ],
      highlight: ['ecg-display'],
      teachingPoints: [
        'Fine VFib vs asystole: check 2 leads, verify connections, increase gain.',
        'If any doubt, continue high-quality CPR — compressions may convert fine VFib to coarse VFib.',
        'Never shock a confirmed asystole — it delays compressions with no benefit.',
      ],
    },
    {
      id: 'step_aed_no_shock',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_confirm_asystole',
      millieDialogue: [
        'The AED has been applied. It announces: "No shock advised."',
        'What should you do?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'AED says "No shock advised." Your action?',
        options: [
          'Resume CPR immediately — "no shock advised" means continue compressions',
          'Remove the AED pads and stop resuscitation',
          'Press the shock button anyway — override the AED',
          'Wait 1 minute and re-analyze before doing anything',
        ],
        correctAnswer:
          'Resume CPR immediately — "no shock advised" means continue compressions',
        feedback: {
          'Resume CPR immediately — "no shock advised" means continue compressions':
            'Correct! "No shock advised" means the rhythm is non-shockable — continue CPR. It does NOT mean "stop."',
          'Remove the AED pads and stop resuscitation':
            'Absolutely not — "no shock" does not mean "no resuscitation." CPR must continue.',
          'Press the shock button anyway — override the AED':
            'Do not override the AED. Shocking asystole is harmful — it delays compressions and causes myocardial damage.',
          'Wait 1 minute and re-analyze before doing anything':
            'Every second without CPR reduces survival. Resume compressions immediately.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'chest_compressions' },
        { type: 'advance_time', seconds: 120 },
      ],
      highlight: ['ecg-display'],
      teachingPoints: [
        '"No shock advised" = non-shockable rhythm. It is a prompt to CONTINUE CPR, not to stop.',
        'A common BLS error: stopping resuscitation when AED says no shock. This is wrong — always continue CPR.',
        'Leave AED pads on — the rhythm may change to a shockable rhythm during resuscitation.',
      ],
    },
    {
      id: 'step_reversible_causes',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_aed_no_shock',
      millieDialogue: [
        'You are 4 minutes into CPR. The rhythm remains asystole.',
        'For asystole with poor prognosis, searching for reversible causes is critical.',
        'What are the most likely reversible causes in this patient?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Most likely reversible causes of asystole in this patient (72F, CKD3, K+ 5.1)?',
        options: [
          'Hyperkalemia (CKD + high-normal K+) and hypoxia (sedation-related hypoventilation)',
          'Tension pneumothorax from the endoscopy',
          'Cardiac tamponade from endoscope perforation',
          'Hypothermia from cold IV fluids',
        ],
        correctAnswer:
          'Hyperkalemia (CKD + high-normal K+) and hypoxia (sedation-related hypoventilation)',
        feedback: {
          'Hyperkalemia (CKD + high-normal K+) and hypoxia (sedation-related hypoventilation)':
            'Correct! CKD with borderline K+ could have tipped into hyperkalemia. Sedation-related hypoxia is also likely.',
          'Tension pneumothorax from the endoscopy':
            'Upper endoscopy rarely causes pneumothorax. This is not the most likely cause.',
          'Cardiac tamponade from endoscope perforation':
            'Esophageal perforation is rare and would not cause tamponade.',
          'Hypothermia from cold IV fluids':
            'Room-temperature IV fluids do not cause hypothermia significant enough for arrest.',
        },
      },
      simActions: [{ type: 'advance_time', seconds: 120 }],
      highlight: ['ecg-display'],
      teachingPoints: [
        'Hs and Ts: the mnemonic for reversible causes of cardiac arrest.',
        'Hs: Hypovolemia, Hypoxia, Hydrogen ion (acidosis), Hypo/Hyperkalemia, Hypothermia.',
        'Ts: Tension pneumothorax, Tamponade, Toxins, Thrombosis (PE/MI).',
        'In CKD patients, always consider hyperkalemia — empiric calcium chloride is reasonable.',
      ],
    },
    {
      id: 'step_continued_cpr',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_reversible_causes',
      millieDialogue: [
        'Six minutes of high-quality CPR. AED re-analyzes — still "No shock advised."',
        'ACLS team is arriving. What is the role of the BLS provider at this point?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'ACLS team arrives during ongoing BLS resuscitation. BLS provider role?',
        options: [
          'Continue high-quality CPR, brief the ACLS team on events, timing, and interventions given',
          'Step back completely — BLS is no longer needed once ACLS arrives',
          'Switch to giving medications — the ACLS team will do compressions',
          'Stop CPR and let the ACLS team reassess from scratch',
        ],
        correctAnswer:
          'Continue high-quality CPR, brief the ACLS team on events, timing, and interventions given',
        feedback: {
          'Continue high-quality CPR, brief the ACLS team on events, timing, and interventions given':
            'Correct! High-quality CPR continues without interruption. Brief the team: arrest time, rhythm, shocks given, drugs given.',
          'Step back completely — BLS is no longer needed once ACLS arrives':
            'BLS is the foundation — compressions must continue. ACLS builds on top of BLS, not replaces it.',
          'Switch to giving medications — the ACLS team will do compressions':
            'Drug administration requires ACLS training. BLS providers continue compressions.',
          'Stop CPR and let the ACLS team reassess from scratch':
            'Never interrupt CPR for handover. Brief while compressions continue.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'chest_compressions' },
        { type: 'advance_time', seconds: 120 },
      ],
      highlight: ['ecg-display', 'hr-display'],
      teachingPoints: [
        'BLS is the foundation of all resuscitation — ACLS adds drugs and advanced airways but depends on high-quality CPR.',
        'Team communication: time of arrest, witnessed/unwitnessed, initial rhythm, interventions performed, number of shocks.',
        'Asystole prognosis: if no ROSC after 20+ minutes of high-quality CPR and all reversible causes addressed, consider termination.',
      ],
    },
    {
      id: 'step_end',
      phase: 'recovery',
      triggerType: 'on_step_complete',
      afterStepId: 'step_continued_cpr',
      millieDialogue: [
        'The ACLS team has taken over. They administer epinephrine and address the hyperkalemia.',
        'After 12 total minutes, the rhythm converts to sinus bradycardia and a pulse is detected.',
        'What is the most important BLS lesson from this scenario?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Key BLS takeaway from asystole arrest?',
        options: [
          'High-quality uninterrupted CPR is the single most important intervention for non-shockable rhythms',
          'Asystole always means the patient cannot be saved',
          'The AED should be shocked even when it says no shock advised',
          'BLS is irrelevant once ACLS providers arrive',
        ],
        correctAnswer:
          'High-quality uninterrupted CPR is the single most important intervention for non-shockable rhythms',
        feedback: {
          'High-quality uninterrupted CPR is the single most important intervention for non-shockable rhythms':
            'Correct! For non-shockable rhythms, CPR quality determines outcomes. There is no shortcut.',
          'Asystole always means the patient cannot be saved':
            'Not true — reversible causes (hyperkalemia, hypoxia) can be treated if identified and addressed.',
          'The AED should be shocked even when it says no shock advised':
            'Shocking asystole is harmful and delays compressions.',
          'BLS is irrelevant once ACLS providers arrive':
            'BLS is the foundation of ALL resuscitation. ACLS builds on top of high-quality BLS.',
        },
      },
      simActions: [
        { type: 'set_vital', parameter: 'hr', value: 52 },
        { type: 'set_vital', parameter: 'sbp', value: 85 },
        { type: 'set_vital', parameter: 'spo2', value: 90 },
        { type: 'set_vital', parameter: 'etco2', value: 32 },
        { type: 'set_vital', parameter: 'rr', value: 10 },
      ],
      highlight: ['hr-display', 'spo2-display'],
      teachingPoints: [
        'Asystole outcomes depend on CPR quality and identification of reversible causes.',
        'Non-shockable rhythms: CPR is your primary weapon. Drugs and advanced airways are secondary.',
        'Team-based resuscitation: BLS providers play a critical and ongoing role throughout.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'What clinical features suggested this patient was at higher risk for cardiac arrest?',
      'How did the non-shockable rhythm change your management compared to VFib?',
      'What reversible causes did you identify and how would ACLS address them?',
      'When is it appropriate to consider terminating resuscitation for asystole?',
    ],
    keyTakeaways: [
      'Asystole is a non-shockable rhythm — never shock, always continue CPR.',
      '"No shock advised" means continue CPR, NOT stop resuscitation.',
      'Identify reversible causes (Hs and Ts) — they may be the key to ROSC.',
      'High-quality CPR is the foundation of all cardiac arrest management.',
      'BLS providers play a critical role even after ACLS arrives.',
    ],
  },
  scoringRubric: BLS_RUBRIC,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. Pediatric VFib Cardiac Arrest
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const BLS_PEDIATRIC_ARREST: InteractiveScenario = {
  id: 'bls_pediatric_arrest',
  title: 'Pediatric VFib Arrest — Child (8 yo)',
  difficulty: 'hard',
  patientArchetype: 'pediatric',
  procedure: 'Pediatric BLS Cardiac Arrest Management',
  description:
    'An 8-year-old, 25 kg child undergoing procedural sedation for fracture reduction develops VFib arrest. Learner must apply pediatric BLS modifications: 1-2 hand compressions, ~2 inch depth, pediatric AED pads, and age-appropriate CPR parameters.',
  learningObjectives: [
    'Apply pediatric CPR modifications for a child (1 year to puberty)',
    'Use correct compression depth (~2 inches / 5 cm) and technique for a child',
    'Apply pediatric AED pads correctly (or use dose attenuator)',
    'Deliver ventilations at appropriate pediatric rate',
    'Understand pediatric-specific arrest etiologies (usually respiratory)',
    'Recognize ROSC in a pediatric patient',
  ],
  clinicalPearls: [
    'Pediatric arrests are usually respiratory in origin — not primary cardiac',
    'Child CPR: 1 or 2 hands for compressions, depth about 2 inches (5 cm) or ⅓ AP diameter',
    'Use pediatric AED pads/dose attenuator if available; if not, use adult pads (do not let them touch)',
    'Compression-to-ventilation ratio: 30:2 for single rescuer, 15:2 for 2 rescuers',
    'Lone rescuer with a child: 2 minutes of CPR before leaving to call for help (if no phone)',
  ],
  preopVignette: {
    indication: 'Procedural sedation for closed reduction of distal radius fracture',
    setting: 'Pediatric emergency department',
    history: [
      '8-year-old male, 25 kg, fell from monkey bars — distal radius fracture',
      'No medical history, no medications, NKDA',
      'Fasting: 4 hours since light snack',
      'Received ketamine 1 mg/kg IV for sedation — procedure started',
      'Known family history: father had sudden cardiac arrest at age 35 (long QT syndrome suspected)',
    ],
    exam: [
      'Pre-sedation: HR 105, BP 100/65, SpO2 99%, RR 22',
      'Airway: normal for age, Mallampati not assessed (pediatric)',
      'CV: RRR, no murmurs. Lungs: clear. Active, crying pre-sedation.',
    ],
    baselineMonitors: ['Continuous ECG', 'SpO2', 'NIBP q3min', 'Capnography'],
    targetSedationGoal: 'Recognize pediatric VFib → Modified pediatric CPR → Pediatric AED → ROSC',
  },
  drugProtocols: [
    { name: 'epinephrine', route: 'IV', typicalBolusRange: [0.01, 0.01], maxTotalDose: 0.1, unit: 'mg/kg' },
  ],
  patientDetail: {
    age: 8,
    sex: 'M',
    heightCm: 128,
    weightKg: 25,
    asa: 1,
    comorbidities: ['family history of sudden cardiac arrest — possible inherited channelopathy'],
  },
  steps: [
    {
      id: 'step_peds_arrest_recognition',
      phase: 'complication',
      triggerType: 'on_start',
      millieDialogue: [
        'During fracture reduction, the child suddenly becomes limp and unresponsive.',
        'The ECG shows a chaotic, irregular rhythm with no identifiable QRS complexes.',
        'No pulse is palpable. What is this rhythm and what do you do first?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Unresponsive child, chaotic ECG, no pulse. Rhythm identification and first action?',
        options: [
          'Ventricular fibrillation — call for help and begin pediatric CPR immediately',
          'Artifact from movement — wait for the child to settle',
          'Sinus tachycardia from pain — give more ketamine',
          'Supraventricular tachycardia — vagal maneuvers first',
        ],
        correctAnswer:
          'Ventricular fibrillation — call for help and begin pediatric CPR immediately',
        feedback: {
          'Ventricular fibrillation — call for help and begin pediatric CPR immediately':
            'Correct! Chaotic rhythm + no pulse = VFib. Begin CPR immediately and send for the AED.',
          'Artifact from movement — wait for the child to settle':
            'The child is unresponsive with no pulse — this is not artifact. This is cardiac arrest.',
          'Sinus tachycardia from pain — give more ketamine':
            'The child is pulseless and the rhythm is chaotic — this is VFib, not sinus tachycardia.',
          'Supraventricular tachycardia — vagal maneuvers first':
            'SVT has a narrow, regular, fast rhythm. This is chaotic with no pulse — VFib.',
        },
      },
      simActions: [
        { type: 'set_vital', parameter: 'hr', value: 0 },
        { type: 'set_vital', parameter: 'sbp', value: 0 },
        { type: 'set_vital', parameter: 'spo2', value: 50 },
        { type: 'set_vital', parameter: 'etco2', value: 7 },
        { type: 'set_vital', parameter: 'rr', value: 0 },
      ],
      highlight: ['ecg-display', 'hr-display'],
      teachingPoints: [
        'Pediatric VFib is uncommon but can occur with channelopathies (long QT, Brugada), electrolyte imbalance, or drug effects.',
        'Family history of sudden cardiac death is a red flag — this child may have inherited long QT syndrome.',
        'Pediatric arrest recognition: unresponsive + no breathing + no pulse within 10 seconds.',
      ],
    },
    {
      id: 'step_peds_cpr_technique',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_peds_arrest_recognition',
      millieDialogue: [
        'You are starting CPR on this 8-year-old, 25 kg child.',
        'What are the correct CPR parameters for a child this age?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Correct CPR parameters for an 8-year-old child?',
        options: [
          '1 or 2 hands, depth ~2 inches (5 cm or ⅓ AP diameter), rate 100-120/min',
          '2 fingers only, depth 1.5 inches, rate 100-120/min',
          'Full adult technique — 2 hands, depth ≥2.4 inches, rate 100-120/min',
          '1 hand only, depth 1 inch, rate 80-100/min',
        ],
        correctAnswer:
          '1 or 2 hands, depth ~2 inches (5 cm or ⅓ AP diameter), rate 100-120/min',
        feedback: {
          '1 or 2 hands, depth ~2 inches (5 cm or ⅓ AP diameter), rate 100-120/min':
            'Correct! Child CPR: 1 or 2 hands based on child size, compress about ⅓ of the AP chest diameter (~2 inches), rate 100-120/min.',
          '2 fingers only, depth 1.5 inches, rate 100-120/min':
            'Two-finger technique is for INFANTS (<1 year), not children. An 8-year-old needs 1-2 hand compressions.',
          'Full adult technique — 2 hands, depth ≥2.4 inches, rate 100-120/min':
            'Close, but compression depth for children is about 2 inches (⅓ AP diameter), not ≥2.4 inches. Excessive depth risks injury.',
          '1 hand only, depth 1 inch, rate 80-100/min':
            'Too shallow and too slow. One inch is insufficient, and 80-100/min is below the recommended rate.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'chest_compressions' },
        { type: 'advance_time', seconds: 30 },
      ],
      highlight: ['ecg-display'],
      teachingPoints: [
        'Child (1 year to puberty): 1 or 2 hands on lower sternum, depth ≈2 inches (⅓ AP diameter).',
        'Rate: 100-120/min — same as adult. Allow full chest recoil between compressions.',
        'Single rescuer: 30:2 ratio. Two rescuers: 15:2 ratio (more ventilations for children).',
      ],
    },
    {
      id: 'step_peds_ventilation',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_peds_cpr_technique',
      millieDialogue: [
        'You are providing 30:2 CPR as the sole rescuer. A second nurse arrives.',
        'With two rescuers, what compression-to-ventilation ratio do you use for this child?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Two-rescuer pediatric CPR compression-to-ventilation ratio?',
        options: [
          '15:2 — more ventilations because pediatric arrests are often respiratory in origin',
          '30:2 — same as single rescuer',
          '5:1 — the old pediatric standard',
          'Continuous compressions with ventilation every 6 seconds',
        ],
        correctAnswer:
          '15:2 — more ventilations because pediatric arrests are often respiratory in origin',
        feedback: {
          '15:2 — more ventilations because pediatric arrests are often respiratory in origin':
            'Correct! Two-rescuer pediatric CPR uses 15:2 to provide more ventilations — critical because most pediatric arrests are respiratory.',
          '30:2 — same as single rescuer':
            '30:2 is for single rescuer only. With two rescuers in pediatrics, switch to 15:2.',
          '5:1 — the old pediatric standard':
            'The 5:1 ratio was abandoned by AHA years ago. Current standard: 15:2 for two-rescuer pediatric.',
          'Continuous compressions with ventilation every 6 seconds':
            'This is for patients with an advanced airway in place. Without an advanced airway, use 15:2.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'bag_mask_ventilation' },
        { type: 'advance_time', seconds: 60 },
      ],
      highlight: ['rr-display', 'spo2-display'],
      teachingPoints: [
        'Two-rescuer pediatric BLS: 15:2 compression-to-ventilation ratio.',
        'Pediatric arrests are usually respiratory → ventilation is even more important than in adults.',
        'Bag-mask ventilation: visible chest rise, avoid excessive volumes (risk of gastric insufflation).',
      ],
    },
    {
      id: 'step_peds_aed',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_peds_ventilation',
      millieDialogue: [
        'The AED arrives. You see both adult pads and a pediatric dose attenuator.',
        'Which pads do you use for this 8-year-old?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'AED pad selection for an 8-year-old child?',
        options: [
          'Use pediatric pads/dose attenuator if available — they deliver a reduced energy dose',
          'Always use adult pads for any child over 1 year',
          'Do not use AED on children — manual defibrillation only',
          'Use pediatric pads but place both on the front of the chest',
        ],
        correctAnswer:
          'Use pediatric pads/dose attenuator if available — they deliver a reduced energy dose',
        feedback: {
          'Use pediatric pads/dose attenuator if available — they deliver a reduced energy dose':
            'Correct! For children 1-8 years, use pediatric pads/attenuator. If unavailable, adult pads are acceptable.',
          'Always use adult pads for any child over 1 year':
            'Pediatric pads are preferred for children 1-8. Adult pads are a backup if pediatric pads are not available.',
          'Do not use AED on children — manual defibrillation only':
            'AEDs can and should be used on children. An AED is far better than no defibrillation.',
          'Use pediatric pads but place both on the front of the chest':
            'Anterior-posterior placement is preferred if pads are too large for anterior-lateral. Ensure pads do not overlap.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'defibrillation' },
        { type: 'advance_time', seconds: 5 },
        { type: 'apply_intervention', intervention: 'chest_compressions' },
        { type: 'advance_time', seconds: 120 },
      ],
      highlight: ['ecg-display'],
      teachingPoints: [
        'Pediatric AED: use pediatric pads/dose attenuator for children 1-8 years.',
        'If only adult pads available: use them — some defibrillation is better than none.',
        'Anterior-posterior pad placement if pads are large relative to chest — ensure pads do not touch each other.',
        'After shock: immediately resume CPR for 2 minutes before next analysis.',
      ],
    },
    {
      id: 'step_peds_rosc',
      phase: 'recovery',
      triggerType: 'on_step_complete',
      afterStepId: 'step_peds_aed',
      millieDialogue: [
        'After the shock and 2 minutes of CPR, you re-check. The child has a pulse — HR 120, BP 88/55.',
        'Spontaneous respirations are present but shallow. SpO2 is 85%.',
        'What is your immediate priority?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'ROSC achieved in 8-year-old. SpO2 85%, shallow respirations. Priority?',
        options: [
          'Support ventilation with bag-mask, supplemental O2, monitor closely for re-arrest',
          'Stop all interventions — the child has a pulse so the emergency is over',
          'Intubate immediately regardless of respiratory effort',
          'Give another dose of ketamine to keep the child sedated',
        ],
        correctAnswer:
          'Support ventilation with bag-mask, supplemental O2, monitor closely for re-arrest',
        feedback: {
          'Support ventilation with bag-mask, supplemental O2, monitor closely for re-arrest':
            'Correct! Post-ROSC: support oxygenation and ventilation, monitor for re-arrest, prepare for transport to PICU.',
          'Stop all interventions — the child has a pulse so the emergency is over':
            'The child is not out of danger. Post-arrest care is critical — monitor and support.',
          'Intubate immediately regardless of respiratory effort':
            'If the child is breathing spontaneously, support with bag-mask and O2 first. Intubation if breathing deteriorates.',
          'Give another dose of ketamine to keep the child sedated':
            'This child just had a cardiac arrest. No further sedation — the procedure is abandoned.',
        },
      },
      simActions: [
        { type: 'set_vital', parameter: 'hr', value: 120 },
        { type: 'set_vital', parameter: 'sbp', value: 88 },
        { type: 'set_vital', parameter: 'spo2', value: 85 },
        { type: 'set_vital', parameter: 'etco2', value: 30 },
        { type: 'set_vital', parameter: 'rr', value: 16 },
        { type: 'set_fio2', fio2: 1.0 },
        { type: 'apply_intervention', intervention: 'bag_mask_ventilation' },
      ],
      highlight: ['spo2-display', 'rr-display', 'fio2-slider'],
      teachingPoints: [
        'Pediatric post-ROSC: support ventilation, target SpO2 94-99%, avoid hyperoxia.',
        'This child needs genetic/cardiac workup for channelopathy given family history.',
        'Prepare for transfer to PICU — post-arrest care includes targeted temperature management consideration.',
      ],
    },
    {
      id: 'step_peds_debrief_question',
      phase: 'recovery',
      triggerType: 'on_step_complete',
      afterStepId: 'step_peds_rosc',
      millieDialogue: [
        'The child is stabilized and being transferred to the PICU.',
        'Reflecting on this case — why was the family history so important?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Why was the family history of sudden cardiac death significant in this case?',
        options: [
          'It suggests inherited channelopathy (long QT) — a known cause of pediatric VFib arrest',
          'Family history is always irrelevant for procedural sedation planning',
          'It means the child should have received prophylactic amiodarone',
          'It means this child should never receive any anesthesia',
        ],
        correctAnswer:
          'It suggests inherited channelopathy (long QT) — a known cause of pediatric VFib arrest',
        feedback: {
          'It suggests inherited channelopathy (long QT) — a known cause of pediatric VFib arrest':
            'Correct! Family history of sudden cardiac arrest at young age is a red flag for inherited channelopathies. Pre-sedation ECG screening should have been considered.',
          'Family history is always irrelevant for procedural sedation planning':
            'Family history of sudden cardiac death is highly relevant — it changes risk assessment.',
          'It means the child should have received prophylactic amiodarone':
            'Prophylactic antiarrhythmics require a confirmed diagnosis and cardiologist guidance.',
          'It means this child should never receive any anesthesia':
            'Patients with channelopathies can receive anesthesia/sedation, but with appropriate precautions and cardiac monitoring.',
        },
      },
      simActions: [],
      teachingPoints: [
        'Family history of sudden cardiac death in young relatives: screen for long QT, Brugada, HCM.',
        'Pre-sedation ECG screening is indicated when family history suggests channelopathy.',
        'Ketamine is generally considered safe in long QT, but the combination of stress + sedation may unmask arrhythmias.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'How do pediatric CPR parameters differ from adult CPR?',
      'Why is the compression-to-ventilation ratio different for two-rescuer pediatric CPR?',
      'What pre-sedation screening might have identified this child as high-risk?',
      'How would management differ if this were an infant (<1 year)?',
    ],
    keyTakeaways: [
      'Pediatric CPR: 1-2 hands, ~2 inches depth (⅓ AP diameter), 100-120/min, 15:2 with two rescuers.',
      'Use pediatric AED pads/dose attenuator for children 1-8 years when available.',
      'Pediatric arrests are usually respiratory — ventilation is critical.',
      'Family history of sudden cardiac death warrants pre-procedure cardiac screening.',
      'Post-ROSC: support oxygenation, avoid hyperoxia, prepare for PICU transfer.',
    ],
  },
  scoringRubric: BLS_RUBRIC,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. Adult Choking (FBAO)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const BLS_CHOKING_ADULT: InteractiveScenario = {
  id: 'bls_choking_adult',
  title: 'Adult FBAO — Choking During Procedure',
  difficulty: 'moderate',
  patientArchetype: 'healthy_adult',
  procedure: 'BLS Foreign Body Airway Obstruction Management',
  description:
    'A 48-year-old male undergoing dental sedation aspirates a tooth fragment during extraction. He initially shows signs of severe airway obstruction (conscious choking), then loses consciousness. Learner must manage the choking progression from conscious to unconscious and potential cardiac arrest.',
  learningObjectives: [
    'Recognize signs of severe (complete) vs mild (partial) airway obstruction',
    'Perform abdominal thrusts (Heimlich maneuver) for conscious choking adult',
    'Transition to CPR when choking patient becomes unconscious',
    'Perform mouth sweeps to look for visible foreign body',
    'Manage choking that progresses to cardiac arrest',
  ],
  clinicalPearls: [
    'Severe obstruction: cannot speak, cough, or breathe — silent patient with universal choking sign',
    'Mild obstruction: forceful cough, can make sounds — encourage coughing, do NOT perform abdominal thrusts',
    'Unconscious choking: lower to ground, begin CPR, look in mouth before ventilations',
    'In dental/procedural setting: suction and direct laryngoscopy may be immediately available',
    'Aspiration of dental material is a known sedation complication — use throat packs and suction',
  ],
  preopVignette: {
    indication: 'Extraction of fractured molar under IV sedation',
    setting: 'Outpatient dental surgery center',
    history: [
      '48-year-old male, ASA 1, no medical history',
      'Fractured lower first molar with deep caries',
      'Received midazolam 2 mg + fentanyl 50 mcg IV',
      'Procedure underway — tooth is being sectioned for extraction',
    ],
    exam: [
      'Pre-procedure: HR 75, BP 130/80, SpO2 99% on nasal cannula',
      'Airway: Mallampati I, good mouth opening',
      'Alert and anxious pre-sedation, now at MOASS 3',
    ],
    baselineMonitors: ['SpO2', 'NIBP q5min', 'Capnography', 'ECG'],
    targetSedationGoal: 'Recognize choking → Abdominal thrusts → Manage progression to unconscious → CPR if needed',
  },
  drugProtocols: [],
  patientDetail: {
    age: 48,
    sex: 'M',
    heightCm: 175,
    weightKg: 82,
    asa: 1,
    comorbidities: [],
    airway: {
      mallampati: 1,
      bmi: 26.8,
    },
  },
  steps: [
    {
      id: 'step_choking_recognition',
      phase: 'complication',
      triggerType: 'on_start',
      millieDialogue: [
        'During tooth extraction, a fragment falls into the posterior pharynx.',
        'The patient suddenly sits up, clutches his throat with both hands, mouth open, eyes wide.',
        'He cannot speak or cough. SpO2 is dropping rapidly. EtCO2 waveform is absent.',
        'What type of airway obstruction is this?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Patient clutching throat, cannot speak or cough, SpO2 dropping. Type of obstruction?',
        options: [
          'Severe (complete) airway obstruction — immediate intervention needed',
          'Mild (partial) obstruction — encourage coughing',
          'Laryngospasm from sedation — give succinylcholine',
          'Anxiety reaction — reassure the patient',
        ],
        correctAnswer: 'Severe (complete) airway obstruction — immediate intervention needed',
        feedback: {
          'Severe (complete) airway obstruction — immediate intervention needed':
            'Correct! Universal choking sign (hands to throat) + inability to speak/cough = severe obstruction requiring immediate intervention.',
          'Mild (partial) obstruction — encourage coughing':
            'If the patient could cough or make sounds, this would be partial. He cannot — this is complete obstruction.',
          'Laryngospasm from sedation — give succinylcholine':
            'The clinical picture is foreign body obstruction, not laryngospasm. The tooth fragment was seen falling posteriorly.',
          'Anxiety reaction — reassure the patient':
            'Anxiety does not cause absent EtCO2 and silent choking. This is a life-threatening airway emergency.',
        },
      },
      simActions: [
        { type: 'set_vital', parameter: 'spo2', value: 88 },
        { type: 'set_vital', parameter: 'etco2', value: 0 },
        { type: 'set_vital', parameter: 'rr', value: 2 },
        { type: 'set_vital', parameter: 'hr', value: 110 },
      ],
      highlight: ['spo2-display', 'etco2-display'],
      teachingPoints: [
        'Severe FBAO: cannot speak, cannot cough, cannot breathe. May have universal choking sign.',
        'Absent EtCO2 waveform with no chest rise confirms complete obstruction.',
        'In dental setting, aspiration of tooth fragments, crowns, or instruments is a recognized hazard.',
      ],
    },
    {
      id: 'step_abdominal_thrusts',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_choking_recognition',
      millieDialogue: [
        'The patient is conscious but cannot breathe. SpO2 is 82% and falling.',
        'What is the correct BLS intervention for a conscious choking adult?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Conscious adult with severe choking. Correct intervention?',
        options: [
          'Abdominal thrusts (Heimlich maneuver) — stand behind, fist above navel, quick upward thrusts',
          'Back blows only — 5 firm blows between shoulder blades',
          'Finger sweep of the mouth immediately',
          'Begin chest compressions as for cardiac arrest',
        ],
        correctAnswer:
          'Abdominal thrusts (Heimlich maneuver) — stand behind, fist above navel, quick upward thrusts',
        feedback: {
          'Abdominal thrusts (Heimlich maneuver) — stand behind, fist above navel, quick upward thrusts':
            'Correct! AHA BLS for conscious choking adult: abdominal thrusts until object expelled or patient becomes unconscious.',
          'Back blows only — 5 firm blows between shoulder blades':
            'AHA recommends abdominal thrusts for adults. Some international guidelines use alternating back blows and abdominal thrusts.',
          'Finger sweep of the mouth immediately':
            'Blind finger sweeps are NOT recommended — risk pushing the object deeper. Only remove a visible object.',
          'Begin chest compressions as for cardiac arrest':
            'Chest compressions are for UNCONSCIOUS choking patients. This patient is still conscious.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'abdominal_thrusts' },
        { type: 'advance_time', seconds: 30 },
      ],
      highlight: ['spo2-display'],
      teachingPoints: [
        'Conscious adult choking: abdominal thrusts (Heimlich). Repeat until successful or patient becomes unconscious.',
        'Position: stand behind, wrap arms around waist, fist just above navel, quick inward-upward thrust.',
        'For pregnant or obese patients: chest thrusts instead of abdominal thrusts.',
      ],
    },
    {
      id: 'step_unconscious_transition',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_abdominal_thrusts',
      millieDialogue: [
        'After several abdominal thrusts, the object has not dislodged.',
        'The patient becomes limp and unresponsive. SpO2 is 65%.',
        'What do you do now?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Choking patient has become unconscious. Next action?',
        options: [
          'Lower to ground, call for help, begin CPR — look in mouth before each ventilation attempt',
          'Continue abdominal thrusts on the unconscious patient',
          'Perform a blind finger sweep of the mouth',
          'Stop interventions and wait for the advanced airway team',
        ],
        correctAnswer:
          'Lower to ground, call for help, begin CPR — look in mouth before each ventilation attempt',
        feedback: {
          'Lower to ground, call for help, begin CPR — look in mouth before each ventilation attempt':
            'Correct! Unconscious choking → CPR. Chest compressions may dislodge the object. Look in the mouth before ventilating.',
          'Continue abdominal thrusts on the unconscious patient':
            'Abdominal thrusts are for conscious patients only. Unconscious → begin CPR.',
          'Perform a blind finger sweep of the mouth':
            'Blind sweeps are not recommended. Look in the mouth before ventilations — remove only VISIBLE objects.',
          'Stop interventions and wait for the advanced airway team':
            'Never wait — begin CPR immediately. Every second of hypoxia worsens outcome.',
        },
      },
      simActions: [
        { type: 'set_vital', parameter: 'spo2', value: 65 },
        { type: 'set_vital', parameter: 'hr', value: 50 },
        { type: 'apply_intervention', intervention: 'chest_compressions' },
        { type: 'advance_time', seconds: 120 },
      ],
      highlight: ['spo2-display', 'hr-display'],
      teachingPoints: [
        'Unconscious choking: transition to CPR. Compressions generate intrathoracic pressure that may expel the object.',
        'Before each ventilation attempt: open mouth, look for visible foreign body, remove if seen.',
        'If ventilations do not cause chest rise: reposition airway and try again. If still blocked, continue CPR.',
      ],
    },
    {
      id: 'step_object_expelled',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_unconscious_transition',
      millieDialogue: [
        'During CPR, after 1 minute of compressions, you look in the mouth and see the tooth fragment.',
        'You remove it with Magill forceps. Ventilation now produces chest rise.',
        'The patient has a pulse — HR 55, weak. SpO2 is 70% but rising. No spontaneous breathing.',
        'What is your next step?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Foreign body removed, pulse present, no spontaneous breathing. Next step?',
        options: [
          'Provide rescue breathing — 1 breath every 5-6 seconds, monitor pulse every 2 minutes',
          'Continue full CPR — 30:2 ratio',
          'Stop all interventions — the foreign body is out',
          'Place the patient in recovery position and observe',
        ],
        correctAnswer:
          'Provide rescue breathing — 1 breath every 5-6 seconds, monitor pulse every 2 minutes',
        feedback: {
          'Provide rescue breathing — 1 breath every 5-6 seconds, monitor pulse every 2 minutes':
            'Correct! Pulse present but not breathing = respiratory arrest. Provide rescue breathing and reassess pulse every 2 minutes.',
          'Continue full CPR — 30:2 ratio':
            'The patient has a pulse — full CPR is not indicated. Provide rescue breathing only.',
          'Stop all interventions — the foreign body is out':
            'The patient is not breathing. Without rescue breathing, this will progress to cardiac arrest.',
          'Place the patient in recovery position and observe':
            'Recovery position is for a patient who IS breathing. This patient needs assisted ventilation.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'bag_mask_ventilation' },
        { type: 'set_fio2', fio2: 1.0 },
        { type: 'set_vital', parameter: 'spo2', value: 78 },
        { type: 'set_vital', parameter: 'hr', value: 60 },
        { type: 'advance_time', seconds: 120 },
      ],
      highlight: ['spo2-display', 'rr-display', 'fio2-slider'],
      teachingPoints: [
        'Respiratory arrest with pulse: rescue breathing at 1 breath every 5-6 seconds (10-12/min).',
        'Check pulse every 2 minutes — if pulse is lost, transition to full CPR.',
        'In a dental/procedural setting, Magill forceps and suction should always be immediately available.',
      ],
    },
    {
      id: 'step_recovery_breathing',
      phase: 'recovery',
      triggerType: 'on_step_complete',
      afterStepId: 'step_object_expelled',
      millieDialogue: [
        'After 2 minutes of rescue breathing with high-flow O2, SpO2 climbs to 94%.',
        'The patient begins breathing spontaneously — RR 14, HR 78, BP 125/80.',
        'He is groggy but responsive to voice. What is your plan now?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Patient recovering after choking episode. SpO2 94%, breathing spontaneously. Next?',
        options: [
          'Continue monitoring, suction available, get chest X-ray, arrange observation for aspiration risk',
          'Discharge the patient — the emergency is over',
          'Resume the dental procedure immediately',
          'Give flumazenil to reverse all sedation immediately',
        ],
        correctAnswer:
          'Continue monitoring, suction available, get chest X-ray, arrange observation for aspiration risk',
        feedback: {
          'Continue monitoring, suction available, get chest X-ray, arrange observation for aspiration risk':
            'Correct! Post-choking: monitor for aspiration pneumonia, get CXR to rule out retained fragments, observe for at least several hours.',
          'Discharge the patient — the emergency is over':
            'Aspiration risk remains. Delayed pulmonary complications can occur hours later.',
          'Resume the dental procedure immediately':
            'Absolutely not — the procedure is cancelled. This patient needs medical observation.',
          'Give flumazenil to reverse all sedation immediately':
            'Flumazenil reversal is not urgent. The patient is breathing and conscious. Supportive care is the priority.',
        },
      },
      simActions: [
        { type: 'set_vital', parameter: 'spo2', value: 96 },
        { type: 'set_vital', parameter: 'hr', value: 78 },
        { type: 'set_vital', parameter: 'sbp', value: 125 },
        { type: 'set_vital', parameter: 'rr', value: 14 },
        { type: 'set_vital', parameter: 'etco2', value: 36 },
      ],
      highlight: ['spo2-display'],
      teachingPoints: [
        'Post-choking: monitor for aspiration pneumonia (fever, cough, desaturation hours later).',
        'Chest X-ray to rule out retained foreign body fragments in the airway or lung.',
        'Prevention: use throat packs, high-volume suction, and a rubber dam during dental extractions under sedation.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'What prevention strategies could have avoided this aspiration event?',
      'How does management differ between conscious and unconscious choking?',
      'At what point would you have called for an emergency surgical airway?',
      'What if the patient had been pregnant — how would you modify abdominal thrusts?',
    ],
    keyTakeaways: [
      'Severe FBAO in conscious adult: abdominal thrusts until resolved or patient becomes unconscious.',
      'Unconscious choking: CPR + look in mouth before each ventilation for visible foreign body.',
      'Pulse present but not breathing: rescue breathing 1 breath every 5-6 seconds.',
      'Post-choking: observe for aspiration, CXR, do not discharge immediately.',
      'Prevention: suction, throat packs, and surgical airway readiness during dental/airway procedures.',
    ],
  },
  scoringRubric: BLS_RUBRIC,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. Near-Drowning
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const BLS_DROWNING: InteractiveScenario = {
  id: 'bls_drowning',
  title: 'Near-Drowning — Hypothermic Submersion Victim',
  difficulty: 'hard',
  patientArchetype: 'healthy_adult',
  procedure: 'BLS Drowning Resuscitation',
  description:
    'A 32-year-old male pulled from a lake after 4-minute submersion. Hypothermic (core temp 33°C), pulseless, not breathing. Learner must apply drowning-specific BLS modifications: ventilation-first approach, manage hypothermia, and understand the unique physiology of submersion cardiac arrest.',
  learningObjectives: [
    'Apply ventilation-priority resuscitation sequence for drowning victims',
    'Recognize and manage hypothermic cardiac arrest',
    'Understand drowning pathophysiology: hypoxia is the primary mechanism',
    'Perform CPR modifications for hypothermic patients',
    'Know when to withhold or continue resuscitation in hypothermic drowning',
  ],
  clinicalPearls: [
    'Drowning is an asphyxial arrest — ventilation is priority (not compression-first)',
    'Rescue breathing sequence: 5 initial rescue breaths before starting compressions',
    'Hypothermia is neuroprotective — "not dead until warm and dead"',
    'Cold water submersion can cause VFib — check rhythm early',
    'Do NOT delay CPR for cervical spine precautions unless high-energy mechanism (diving)',
    'Remove wet clothing, insulate, avoid rough handling (can trigger VFib in hypothermic heart)',
  ],
  preopVignette: {
    indication: 'Near-drowning victim brought to ED by EMS',
    setting: 'Emergency department resuscitation bay',
    history: [
      '32-year-old male, recreational swimmer, witnessed submersion in cold lake',
      'Submersion time estimated 4 minutes before bystander rescue',
      'No spinal injury mechanism — was wading, not diving',
      'Bystanders pulled him out — no CPR performed prior to EMS arrival',
      'EMS reports: core temp 33°C (rectal), pulseless, apneic on arrival',
    ],
    exam: [
      'Arrival: unresponsive, cyanotic, cold to touch, pupils dilated',
      'No pulse (carotid check for 10 seconds), no respiratory effort',
      'ECG: appears to be fine VFib (may be artifact from shivering)',
      'Core temp: 33°C (mild-moderate hypothermia)',
    ],
    labs: [
      'ABG pending',
      'Point-of-care glucose: 95 mg/dL',
      'EMS reported water aspiration with frothing at the mouth',
    ],
    baselineMonitors: ['Continuous ECG', 'SpO2 (may not read due to vasoconstriction)', 'Core temperature probe', 'Capnography'],
    targetSedationGoal: 'Ventilation-first BLS → Manage hypothermia → CPR → Warming → ROSC',
  },
  drugProtocols: [
    { name: 'epinephrine', route: 'IV', typicalBolusRange: [1, 1], maxTotalDose: 10, unit: 'mg' },
  ],
  patientDetail: {
    age: 32,
    sex: 'M',
    heightCm: 180,
    weightKg: 78,
    asa: 1,
    comorbidities: ['hypothermia (33°C)', 'submersion injury'],
  },
  steps: [
    {
      id: 'step_drowning_assessment',
      phase: 'complication',
      triggerType: 'on_start',
      millieDialogue: [
        'A 32-year-old male is brought in after 4-minute lake submersion. Cold, pulseless, not breathing.',
        'Core temp is 33°C. The monitor shows a fine irregular pattern.',
        'How does drowning change your BLS approach compared to standard cardiac arrest?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'How does drowning modify the BLS resuscitation sequence?',
        options: [
          'Ventilation first — give 5 rescue breaths before starting compressions (drowning is hypoxic arrest)',
          'Standard C-A-B — compressions first, same as all cardiac arrest',
          'Chest compressions only (hands-only CPR) — ventilation is not important in drowning',
          'Do not start CPR until the patient is rewarmed to 35°C',
        ],
        correctAnswer:
          'Ventilation first — give 5 rescue breaths before starting compressions (drowning is hypoxic arrest)',
        feedback: {
          'Ventilation first — give 5 rescue breaths before starting compressions (drowning is hypoxic arrest)':
            'Correct! Drowning is an asphyxial arrest. The primary problem is hypoxia, so ventilation takes priority. Give 5 initial rescue breaths.',
          'Standard C-A-B — compressions first, same as all cardiac arrest':
            'For most cardiac arrests, C-A-B is correct. Drowning is the key exception — ventilation first due to hypoxic mechanism.',
          'Chest compressions only (hands-only CPR) — ventilation is not important in drowning':
            'Hands-only CPR is insufficient for drowning. These patients are profoundly hypoxic — they need ventilation.',
          'Do not start CPR until the patient is rewarmed to 35°C':
            'Never delay CPR for rewarming. Start CPR immediately while rewarming in parallel.',
        },
      },
      simActions: [
        { type: 'set_vital', parameter: 'hr', value: 0 },
        { type: 'set_vital', parameter: 'sbp', value: 0 },
        { type: 'set_vital', parameter: 'spo2', value: 40 },
        { type: 'set_vital', parameter: 'rr', value: 0 },
        { type: 'set_vital', parameter: 'etco2', value: 5 },
      ],
      highlight: ['spo2-display', 'etco2-display'],
      teachingPoints: [
        'Drowning = asphyxial arrest. Ventilation is the single most important initial intervention.',
        'Give 5 rescue breaths first (AHA/ILCOR drowning-specific guidance), then begin 30:2 CPR.',
        'Do NOT perform the Heimlich maneuver to expel water — it does not work and delays CPR.',
      ],
    },
    {
      id: 'step_initial_ventilations',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_drowning_assessment',
      millieDialogue: [
        'You deliver 5 rescue breaths with bag-mask and 100% O2.',
        'Chest rise is present but diminished — likely due to pulmonary edema from aspirated water.',
        'The patient remains pulseless. You begin 30:2 CPR. The monitor shows fine VFib.',
        'What is your approach to defibrillation in this hypothermic patient?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Hypothermic (33°C) drowning victim in fine VFib. Defibrillation approach?',
        options: [
          'Attempt defibrillation — at 33°C (mild-moderate hypothermia), shocks may still work',
          'Do not defibrillate until patient is rewarmed above 30°C',
          'Give 3 rapid stacked shocks before starting CPR',
          'Defibrillation is contraindicated in all hypothermic patients',
        ],
        correctAnswer:
          'Attempt defibrillation — at 33°C (mild-moderate hypothermia), shocks may still work',
        feedback: {
          'Attempt defibrillation — at 33°C (mild-moderate hypothermia), shocks may still work':
            'Correct! At 33°C, defibrillation is reasonable. Below 30°C, shocks often fail and may be limited to one attempt until rewarmed above 30°C.',
          'Do not defibrillate until patient is rewarmed above 30°C':
            'At 33°C, the heart may respond to defibrillation. The 30°C threshold applies to severe hypothermia.',
          'Give 3 rapid stacked shocks before starting CPR':
            'Stacked shocks are not recommended in current guidelines. Single shock then CPR.',
          'Defibrillation is contraindicated in all hypothermic patients':
            'This is not true. Defibrillation should be attempted — especially in mild-moderate hypothermia.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'bag_mask_ventilation' },
        { type: 'set_fio2', fio2: 1.0 },
        { type: 'apply_intervention', intervention: 'chest_compressions' },
        { type: 'advance_time', seconds: 60 },
      ],
      highlight: ['ecg-display', 'fio2-slider'],
      teachingPoints: [
        'Hypothermic VFib: attempt defibrillation. If unsuccessful at <30°C, focus on CPR and rewarming.',
        'At 33°C (mild-moderate), the heart may respond to standard defibrillation and medications.',
        'Below 30°C: limit shocks to 1 attempt, withhold epinephrine until rewarmed above 30°C (per AHA).',
      ],
    },
    {
      id: 'step_hypothermia_management',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_initial_ventilations',
      millieDialogue: [
        'You deliver one shock. The rhythm does not change. You resume CPR.',
        'While continuing CPR, what rewarming measures should be initiated?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Rewarming priorities during CPR for hypothermic drowning patient?',
        options: [
          'Remove wet clothing, warm blankets, warm IV fluids, warm humidified O2 — active rewarming',
          'Only passive rewarming — place blankets and let the body rewarm naturally',
          'Immerse the patient in hot water during CPR',
          'Rewarming is not a priority — focus only on CPR and medications',
        ],
        correctAnswer:
          'Remove wet clothing, warm blankets, warm IV fluids, warm humidified O2 — active rewarming',
        feedback: {
          'Remove wet clothing, warm blankets, warm IV fluids, warm humidified O2 — active rewarming':
            'Correct! Active rewarming during resuscitation: remove wet clothes, warm IV fluids (43°C), warm humidified oxygen, forced-air warming.',
          'Only passive rewarming — place blankets and let the body rewarm naturally':
            'Passive rewarming alone is too slow in cardiac arrest. Active measures are needed.',
          'Immerse the patient in hot water during CPR':
            'Impractical during CPR and risks burns. Use warm IV fluids and forced-air warming instead.',
          'Rewarming is not a priority — focus only on CPR and medications':
            'Rewarming IS part of the treatment — the hypothermic heart may not respond to defibrillation until warmer.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'chest_compressions' },
        { type: 'advance_time', seconds: 120 },
      ],
      highlight: ['ecg-display'],
      teachingPoints: [
        'Active rewarming: warm IV fluids (43°C), warm humidified O2, forced-air warming (Bair Hugger).',
        'Remove all wet clothing — evaporative heat loss is the fastest heat loss mechanism.',
        'Handle hypothermic patients gently — rough movement can trigger VFib.',
      ],
    },
    {
      id: 'step_ongoing_resuscitation',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_hypothermia_management',
      millieDialogue: [
        'CPR continues. Core temp has risen to 34°C with active rewarming.',
        'After the second shock at 34°C, the rhythm converts to sinus tachycardia.',
        'A weak pulse is palpable. HR 110, BP 75/45. SpO2 probe now reads 78%.',
        'What are your immediate priorities?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'ROSC achieved in hypothermic drowning patient. SpO2 78%, BP 75/45. Priorities?',
        options: [
          'Ventilation with 100% O2, IV fluid resuscitation, continue rewarming, prepare for ICU',
          'Stop oxygen — the patient has ROSC and no longer needs supplemental O2',
          'Immediate discharge once vitals normalize',
          'Resume chest compressions — BP is too low',
        ],
        correctAnswer:
          'Ventilation with 100% O2, IV fluid resuscitation, continue rewarming, prepare for ICU',
        feedback: {
          'Ventilation with 100% O2, IV fluid resuscitation, continue rewarming, prepare for ICU':
            'Correct! Post-ROSC drowning: aggressive oxygenation (pulmonary edema likely), volume resuscitation, continue rewarming, ICU admission.',
          'Stop oxygen — the patient has ROSC and no longer needs supplemental O2':
            'This patient has pulmonary edema from aspiration — SpO2 of 78% needs maximal oxygenation.',
          'Immediate discharge once vitals normalize':
            'Drowning victims need prolonged observation for delayed pulmonary complications (ARDS).',
          'Resume chest compressions — BP is too low':
            'The patient has a pulse. Low BP post-ROSC is treated with fluids and vasopressors, not compressions.',
        },
      },
      simActions: [
        { type: 'set_vital', parameter: 'hr', value: 110 },
        { type: 'set_vital', parameter: 'sbp', value: 75 },
        { type: 'set_vital', parameter: 'spo2', value: 78 },
        { type: 'set_vital', parameter: 'etco2', value: 28 },
        { type: 'set_vital', parameter: 'rr', value: 8 },
        { type: 'set_fio2', fio2: 1.0 },
      ],
      highlight: ['spo2-display', 'fio2-slider', 'hr-display'],
      teachingPoints: [
        'Drowning + ROSC: expect pulmonary edema and poor oxygenation. Aggressive respiratory support needed.',
        'Continue active rewarming to normothermia (≥36°C).',
        'All drowning survivors with loss of consciousness need hospital admission and observation for ARDS.',
      ],
    },
    {
      id: 'step_prognosis_discussion',
      phase: 'recovery',
      triggerType: 'on_step_complete',
      afterStepId: 'step_ongoing_resuscitation',
      millieDialogue: [
        'The patient is stabilizing. Core temp now 35°C, SpO2 improving to 88% on 100% O2.',
        'When considering prognosis in drowning, what is the key principle about hypothermia?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Key prognostic principle for hypothermic drowning victims?',
        options: [
          '"Not dead until warm and dead" — hypothermia is neuroprotective; continue resuscitation until normothermic',
          'If no ROSC within 10 minutes, stop resuscitation',
          'Hypothermia always means poor prognosis — brain damage is inevitable',
          'Only children benefit from hypothermic neuroprotection — adults do not',
        ],
        correctAnswer:
          '"Not dead until warm and dead" — hypothermia is neuroprotective; continue resuscitation until normothermic',
        feedback: {
          '"Not dead until warm and dead" — hypothermia is neuroprotective; continue resuscitation until normothermic':
            'Correct! Cold water submersion can be neuroprotective. Resuscitation should continue until core temp is ≥32-35°C. Remarkable recoveries have been reported.',
          'If no ROSC within 10 minutes, stop resuscitation':
            'Standard time limits do not apply to hypothermic arrest. Extended resuscitation is indicated.',
          'Hypothermia always means poor prognosis — brain damage is inevitable':
            'The opposite — hypothermia can protect the brain. Some patients have survived >30 minutes of submersion in cold water with good neurological outcomes.',
          'Only children benefit from hypothermic neuroprotection — adults do not':
            'Adults can also benefit, though children are reported to have better outcomes — likely due to faster cooling.',
        },
      },
      simActions: [
        { type: 'set_vital', parameter: 'spo2', value: 92 },
        { type: 'set_vital', parameter: 'hr', value: 95 },
        { type: 'set_vital', parameter: 'sbp', value: 100 },
      ],
      highlight: ['spo2-display'],
      teachingPoints: [
        '"Not dead until warm and dead": hypothermia slows metabolism and can protect the brain from anoxic injury.',
        'Continue resuscitation until core temp reaches ≥32°C before making prognostic decisions.',
        'Favorable prognostic signs: submersion <5 minutes, cold water, witnessed event, CPR started quickly.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'Why is drowning resuscitation ventilation-first rather than the standard C-A-B sequence?',
      'How does hypothermia affect the heart\'s response to defibrillation and medications?',
      'What determines the decision to continue vs terminate resuscitation in hypothermic drowning?',
      'How would your approach differ if the submersion occurred in warm water (bath/pool)?',
    ],
    keyTakeaways: [
      'Drowning = asphyxial arrest. Ventilation-first: 5 rescue breaths before compressions.',
      'Hypothermia: "not dead until warm and dead" — continue resuscitation during rewarming.',
      'Active rewarming: warm fluids, warm O2, forced-air warming. Remove wet clothing.',
      'Defibrillation at 33°C is reasonable; below 30°C, limit shocks until rewarmed.',
      'Post-ROSC: expect pulmonary edema, aggressive oxygenation, ICU observation for ARDS.',
    ],
  },
  scoringRubric: BLS_RUBRIC,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. Opioid Overdose — Fentanyl During Sedation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const BLS_OPIOID_OVERDOSE: InteractiveScenario = {
  id: 'bls_opioid_overdose',
  title: 'Opioid Overdose — Fentanyl-Induced Respiratory and Cardiac Arrest',
  difficulty: 'hard',
  patientArchetype: 'obese_osa',
  procedure: 'BLS Opioid Overdose Management',
  description:
    'A 42-year-old obese male with OSA receives excessive fentanyl during sedation for colonoscopy. He progresses from respiratory depression → apnea → respiratory arrest → cardiac arrest. Learner must recognize the opioid toxidrome, administer naloxone, and manage the full BLS algorithm if arrest occurs.',
  learningObjectives: [
    'Recognize opioid toxidrome: pinpoint pupils, respiratory depression, altered mental status',
    'Differentiate respiratory depression from respiratory arrest from cardiac arrest',
    'Administer naloxone as opioid reversal agent',
    'Apply BLS when opioid overdose progresses to cardiac arrest',
    'Understand naloxone dosing, routes, onset, and duration',
    'Manage post-reversal care and monitoring',
  ],
  clinicalPearls: [
    'Opioid toxidrome triad: miosis (pinpoint pupils), respiratory depression, decreased LOC',
    'Naloxone: 0.04-0.4 mg IV every 2-3 minutes, titrate to respiratory effort (not full reversal)',
    'Naloxone duration (30-90 min) may be shorter than fentanyl effect — re-sedation risk',
    'Ventilation before naloxone — BLS airway management is the first priority',
    'In sedation-related overdose, the fentanyl dose given is known — this aids management',
    'OSA patients have exaggerated sensitivity to opioid respiratory depression',
  ],
  preopVignette: {
    indication: 'Diagnostic colonoscopy for rectal bleeding',
    setting: 'Ambulatory endoscopy suite',
    history: [
      '42-year-old male, BMI 38, diagnosed OSA on CPAP (non-compliant)',
      'ASA 3: Obesity, OSA, mild HTN',
      'Patient requested deep sedation — "I don\'t want to feel anything"',
      'Received fentanyl 150 mcg + midazolam 3 mg IV over 5 minutes (excessive dosing)',
      'Medications: lisinopril, CPAP (non-compliant). NKDA.',
    ],
    exam: [
      'Pre-procedure: HR 85, BP 145/92, SpO2 95% on 3L NC (baseline for OSA)',
      'Airway: Mallampati III, BMI 38, neck circumference 44 cm, receding chin',
      'Difficult airway features: obesity, OSA, thick neck, high Mallampati',
    ],
    baselineMonitors: ['SpO2', 'Capnography', 'NIBP q3min', 'ECG'],
    targetSedationGoal: 'Recognize opioid overdose → Ventilate → Naloxone → BLS if arrest occurs',
  },
  drugProtocols: [
    { name: 'naloxone', route: 'IV', typicalBolusRange: [0.04, 0.4], maxTotalDose: 2, unit: 'mg' },
    { name: 'epinephrine', route: 'IV', typicalBolusRange: [1, 1], maxTotalDose: 10, unit: 'mg' },
  ],
  patientDetail: {
    age: 42,
    sex: 'M',
    heightCm: 175,
    weightKg: 115,
    asa: 3,
    comorbidities: ['obesity (BMI 38)', 'obstructive sleep apnea', 'hypertension', 'CPAP non-compliant'],
    airway: {
      mallampati: 3,
      bmi: 38,
      neckCircumferenceCm: 44,
    },
  },
  steps: [
    {
      id: 'step_resp_depression',
      phase: 'complication',
      triggerType: 'on_start',
      millieDialogue: [
        'Three minutes after the last fentanyl dose, the patient is deeply sedated — MOASS 1.',
        'RR has dropped to 6. SpO2 is 89% and falling. EtCO2 is 55 mmHg (rising). Pupils are pinpoint.',
        'What is happening and what is your immediate first action?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'MOASS 1, RR 6, SpO2 89%, EtCO2 55, pinpoint pupils. Diagnosis and first action?',
        options: [
          'Opioid-induced respiratory depression — open airway, provide bag-mask ventilation immediately',
          'Normal sedation depth — continue monitoring',
          'Give naloxone 2 mg IV push immediately without ventilating first',
          'Give more midazolam to deepen sedation and reduce the EtCO2',
        ],
        correctAnswer:
          'Opioid-induced respiratory depression — open airway, provide bag-mask ventilation immediately',
        feedback: {
          'Opioid-induced respiratory depression — open airway, provide bag-mask ventilation immediately':
            'Correct! Ventilation is the first priority. Open the airway (jaw thrust/chin lift), provide BVM with O2. Naloxone comes after initial ventilation.',
          'Normal sedation depth — continue monitoring':
            'RR 6 with SpO2 89% and rising EtCO2 is NOT normal sedation. This is respiratory depression requiring immediate intervention.',
          'Give naloxone 2 mg IV push immediately without ventilating first':
            'Naloxone takes 1-2 minutes IV. The patient needs oxygen NOW. Ventilate first, then give naloxone.',
          'Give more midazolam to deepen sedation and reduce the EtCO2':
            'This would worsen the respiratory depression catastrophically. EtCO2 is elevated due to hypoventilation, not because of CO2 overproduction.',
        },
      },
      simActions: [
        { type: 'set_vital', parameter: 'rr', value: 6 },
        { type: 'set_vital', parameter: 'spo2', value: 89 },
        { type: 'set_vital', parameter: 'etco2', value: 55 },
        { type: 'set_vital', parameter: 'hr', value: 58 },
      ],
      highlight: ['spo2-display', 'etco2-display', 'rr-display'],
      teachingPoints: [
        'Opioid respiratory depression: pinpoint pupils + decreased RR + elevated EtCO2 + decreased LOC.',
        'ALWAYS ventilate before administering naloxone — oxygen delivery is the immediate priority.',
        'In OSA patients, opioid sensitivity is greatly increased — standard doses can cause profound respiratory depression.',
      ],
    },
    {
      id: 'step_ventilation_and_naloxone',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_resp_depression',
      millieDialogue: [
        'You perform jaw thrust and start bag-mask ventilation. Chest rise is minimal — difficult to ventilate due to obesity.',
        'You insert an OPA and try again — chest rise improves. SpO2 stabilizes at 85%.',
        'What naloxone dose do you give?',
      ],
      question: {
        type: 'numeric_range',
        prompt: 'Naloxone IV dose in mg for opioid-induced respiratory depression during sedation',
        correctAnswer: 0.2,
        idealRange: [0.04, 0.4],
        feedback: {
          low: 'Below 0.04 mg is subtherapeutic. Start with 0.04-0.1 mg in sedation settings for careful titration.',
          ideal: 'Good choice. Titrated naloxone (0.04-0.4 mg) restores respiratory drive without full reversal that causes vomiting and agitation.',
          high: 'Above 0.4 mg initial dose risks abrupt full reversal — severe pain, vomiting, aspiration, and pulmonary edema. Titrate carefully.',
        },
      },
      simActions: [
        { type: 'apply_intervention', intervention: 'jaw_thrust' },
        { type: 'set_airway_device', device: 'opa' },
        { type: 'apply_intervention', intervention: 'bag_mask_ventilation' },
        { type: 'set_fio2', fio2: 1.0 },
        { type: 'administer_drug', drug: 'naloxone', dose: 0.2 },
        { type: 'advance_time', seconds: 120 },
      ],
      highlight: ['spo2-display', 'rr-display', 'fio2-slider'],
      teachingPoints: [
        'Naloxone titration: start low (0.04-0.1 mg IV) in monitored settings — goal is respiratory drive, not full awakening.',
        'Abrupt full reversal risks: severe pain, vomiting, aspiration, sympathetic surge, pulmonary edema.',
        'Naloxone onset IV: 1-2 minutes. Repeat every 2-3 minutes if needed.',
        'In obese/OSA patients, difficult ventilation is expected — use OPA/NPA, two-person BVM, head-up position.',
      ],
    },
    {
      id: 'step_respiratory_arrest',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_ventilation_and_naloxone',
      millieDialogue: [
        'Despite naloxone 0.2 mg IV, the patient is not responding adequately. RR remains 4.',
        'SpO2 drops to 70%. Then the patient stops breathing entirely. HR drops to 38.',
        'What is the current situation and what do you do?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'No respiratory effort, HR 38, SpO2 70%. What is happening?',
        options: [
          'Respiratory arrest progressing to cardiac arrest — continue ventilation, give additional naloxone, prepare for CPR',
          'The naloxone is working — just wait longer',
          'This is a normal sedation response — continue monitoring',
          'Give midazolam to treat the bradycardia',
        ],
        correctAnswer:
          'Respiratory arrest progressing to cardiac arrest — continue ventilation, give additional naloxone, prepare for CPR',
        feedback: {
          'Respiratory arrest progressing to cardiac arrest — continue ventilation, give additional naloxone, prepare for CPR':
            'Correct! Apnea with bradycardia and severe hypoxemia = respiratory arrest leading to cardiac arrest. Aggressive ventilation, repeat naloxone, prepare for CPR.',
          'The naloxone is working — just wait longer':
            'The patient is deteriorating, not improving. Additional naloxone and supportive measures are needed immediately.',
          'This is a normal sedation response — continue monitoring':
            'HR 38 with apnea and SpO2 70% is never a normal sedation response. This is a life-threatening emergency.',
          'Give midazolam to treat the bradycardia':
            'Midazolam does not treat bradycardia and would worsen the respiratory depression.',
        },
      },
      simActions: [
        { type: 'set_vital', parameter: 'rr', value: 0 },
        { type: 'set_vital', parameter: 'spo2', value: 70 },
        { type: 'set_vital', parameter: 'hr', value: 38 },
        { type: 'administer_drug', drug: 'naloxone', dose: 0.4 },
        { type: 'apply_intervention', intervention: 'bag_mask_ventilation' },
        { type: 'advance_time', seconds: 60 },
      ],
      highlight: ['hr-display', 'spo2-display', 'rr-display'],
      teachingPoints: [
        'Opioid overdose cascade: respiratory depression → apnea → hypoxemia → bradycardia → cardiac arrest.',
        'Repeat naloxone: give 0.4 mg IV every 2-3 minutes. Total doses up to 10 mg have been used for fentanyl.',
        'The bradycardia is hypoxia-driven — treat the cause (ventilate) rather than giving atropine alone.',
      ],
    },
    {
      id: 'step_cardiac_arrest',
      phase: 'complication',
      triggerType: 'on_step_complete',
      afterStepId: 'step_respiratory_arrest',
      millieDialogue: [
        'Despite additional naloxone and ventilation, the patient loses his pulse.',
        'The ECG shows a slow, wide-complex rhythm that rapidly degenerates to asystole.',
        'What do you do?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Pulseless with asystole after opioid-induced respiratory arrest. Actions?',
        options: [
          'Begin CPR immediately — 30:2, give naloxone 2 mg IV, continue high-quality CPR cycles',
          'Give only naloxone — CPR is not needed if you reverse the opioid',
          'Perform defibrillation — all cardiac arrests need a shock',
          'Give flumazenil instead of naloxone',
        ],
        correctAnswer:
          'Begin CPR immediately — 30:2, give naloxone 2 mg IV, continue high-quality CPR cycles',
        feedback: {
          'Begin CPR immediately — 30:2, give naloxone 2 mg IV, continue high-quality CPR cycles':
            'Correct! In opioid-associated cardiac arrest, standard BLS CPR is indicated. Naloxone is given as part of the protocol, but CPR is the priority.',
          'Give only naloxone — CPR is not needed if you reverse the opioid':
            'Naloxone cannot restart a stopped heart. CPR is required for cardiac arrest regardless of the cause.',
          'Perform defibrillation — all cardiac arrests need a shock':
            'Asystole is NON-shockable. Defibrillation will not help. CPR is the treatment.',
          'Give flumazenil instead of naloxone':
            'Flumazenil reverses benzodiazepines, not opioids. Naloxone is the opioid antagonist.',
        },
      },
      simActions: [
        { type: 'set_vital', parameter: 'hr', value: 0 },
        { type: 'set_vital', parameter: 'sbp', value: 0 },
        { type: 'set_vital', parameter: 'spo2', value: 50 },
        { type: 'set_vital', parameter: 'etco2', value: 8 },
        { type: 'apply_intervention', intervention: 'chest_compressions' },
        { type: 'administer_drug', drug: 'naloxone', dose: 2 },
        { type: 'advance_time', seconds: 120 },
      ],
      highlight: ['ecg-display', 'hr-display'],
      teachingPoints: [
        'Opioid-associated cardiac arrest: standard CPR + naloxone. Naloxone does not replace CPR.',
        'AHA opioid-associated emergency algorithm: suspected overdose → check responsiveness → activate EMS → ventilate → naloxone → CPR if no pulse.',
        'In sedation settings, the known drug doses help guide management — high-dose fentanyl requires high-dose naloxone.',
      ],
    },
    {
      id: 'step_rosc_opioid',
      phase: 'recovery',
      triggerType: 'on_step_complete',
      afterStepId: 'step_cardiac_arrest',
      millieDialogue: [
        'After 4 minutes of CPR with additional naloxone (total 2.6 mg), the patient regains a pulse.',
        'HR 100, BP 160/95 (sympathetic surge from naloxone), SpO2 82% (recovering), RR 18.',
        'He is agitated and confused. What is the critical post-reversal concern?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Post-ROSC after opioid-induced arrest with naloxone reversal. Critical concern?',
        options: [
          'Renarcotization — fentanyl outlasts naloxone, so the patient may re-arrest when naloxone wears off',
          'The patient no longer needs monitoring since naloxone was given',
          'Give more naloxone to ensure complete reversal',
          'The hypertension is dangerous — give immediate antihypertensives',
        ],
        correctAnswer:
          'Renarcotization — fentanyl outlasts naloxone, so the patient may re-arrest when naloxone wears off',
        feedback: {
          'Renarcotization — fentanyl outlasts naloxone, so the patient may re-arrest when naloxone wears off':
            'Correct! Naloxone duration is 30-90 minutes. Fentanyl can last longer. Continuous monitoring and repeat dosing or infusion may be needed.',
          'The patient no longer needs monitoring since naloxone was given':
            'Extremely dangerous assumption. Renarcotization can occur when naloxone wears off.',
          'Give more naloxone to ensure complete reversal':
            'The patient is already agitated — more naloxone increases sympathetic surge risk. Titrate to respiratory effort.',
          'The hypertension is dangerous — give immediate antihypertensives':
            'Post-reversal hypertension is usually transient from sympathetic surge. Monitor; it typically resolves.',
        },
      },
      simActions: [
        { type: 'set_vital', parameter: 'hr', value: 100 },
        { type: 'set_vital', parameter: 'sbp', value: 160 },
        { type: 'set_vital', parameter: 'spo2', value: 88 },
        { type: 'set_vital', parameter: 'rr', value: 18 },
        { type: 'set_vital', parameter: 'etco2', value: 34 },
      ],
      highlight: ['hr-display', 'spo2-display', 'rr-display'],
      teachingPoints: [
        'Renarcotization: naloxone wears off (30-90 min) before fentanyl — monitor for at least 2 hours post-reversal.',
        'Consider naloxone infusion (2/3 of the effective bolus dose per hour) for prolonged reversal.',
        'Post-reversal sympathetic surge: hypertension, tachycardia, agitation, vomiting — manage supportively.',
      ],
    },
    {
      id: 'step_root_cause',
      phase: 'recovery',
      triggerType: 'on_step_complete',
      afterStepId: 'step_rosc_opioid',
      millieDialogue: [
        'The patient is stabilized and will be admitted to the ICU for monitoring.',
        'Reflecting on this case — what was the root cause of this near-fatal event?',
      ],
      question: {
        type: 'single_choice',
        prompt: 'Root cause of opioid overdose in this sedation case?',
        options: [
          'Excessive fentanyl dosing (150 mcg) in a high-risk patient (obese, OSA, + midazolam synergy)',
          'The patient had a fentanyl allergy that was not documented',
          'Equipment malfunction — the pulse oximeter did not work',
          'The colonoscopy procedure itself caused the respiratory arrest',
        ],
        correctAnswer:
          'Excessive fentanyl dosing (150 mcg) in a high-risk patient (obese, OSA, + midazolam synergy)',
        feedback: {
          'Excessive fentanyl dosing (150 mcg) in a high-risk patient (obese, OSA, + midazolam synergy)':
            'Correct! 150 mcg fentanyl + 3 mg midazolam in 5 minutes for an obese OSA patient is excessive. OSA patients need reduced opioid doses and slower titration.',
          'The patient had a fentanyl allergy that was not documented':
            'This was dose-dependent toxicity, not an allergic reaction.',
          'Equipment malfunction — the pulse oximeter did not work':
            'The monitoring detected the problem — the issue was the drug dosing, not the monitoring.',
          'The colonoscopy procedure itself caused the respiratory arrest':
            'Colonoscopy does not cause respiratory arrest. The sedation dosing was the cause.',
        },
      },
      simActions: [],
      teachingPoints: [
        'OSA patients: reduce opioid doses by 25-50% and titrate slowly. Synergy with benzodiazepines is amplified.',
        'Fentanyl + midazolam: synergistic respiratory depression. Total dose and speed of administration matter.',
        'Prevention: weight-based dosing, incremental titration, continuous capnography, and pre-sedation risk assessment.',
        'ASA guidelines: OSA is a high-risk factor for sedation complications — require enhanced monitoring.',
      ],
    },
  ],
  debrief: {
    discussionQuestions: [
      'What pre-sedation risk factors should have prompted a modified dosing strategy?',
      'How does the opioid-benzodiazepine synergy affect respiratory drive?',
      'What monitoring could have provided earlier warning of respiratory compromise?',
      'How would you manage this scenario if naloxone was not available?',
    ],
    keyTakeaways: [
      'Opioid toxidrome: pinpoint pupils + respiratory depression + decreased LOC.',
      'Ventilate FIRST, then give naloxone. Oxygen delivery is the immediate priority.',
      'Naloxone titration: 0.04-0.4 mg IV, repeat q2-3 min. Goal: respiratory drive, not full reversal.',
      'Renarcotization risk: naloxone (30-90 min) may wear off before fentanyl — prolonged monitoring required.',
      'OSA + obesity = high-risk sedation patients — reduce doses, titrate slowly, monitor with capnography.',
      'CPR is required for cardiac arrest regardless of cause — naloxone alone cannot restart a heart.',
    ],
  },
  scoringRubric: BLS_RUBRIC,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Export all BLS scenarios
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const BLS_SCENARIOS: Record<string, InteractiveScenario> = {
  bls_adult_vfib_arrest: BLS_ADULT_VFIB_ARREST,
  bls_adult_asystole: BLS_ADULT_ASYSTOLE,
  bls_pediatric_arrest: BLS_PEDIATRIC_ARREST,
  bls_choking_adult: BLS_CHOKING_ADULT,
  bls_drowning: BLS_DROWNING,
  bls_opioid_overdose: BLS_OPIOID_OVERDOSE,
};

export const BLS_SCENARIOS_ARRAY: InteractiveScenario[] = Object.values(BLS_SCENARIOS);
