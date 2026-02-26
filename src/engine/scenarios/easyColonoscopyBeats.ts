/**
 * src/engine/scenarios/easyColonoscopyBeats.ts
 * Hand-crafted ConductorScenario for the easy colonoscopy.
 *
 * Each step unfolds over 5-10 seconds with:
 *   - Millie narration beats (staggered ~2-3 s)
 *   - Callout beats pointing at relevant UI elements
 *   - VitalBadge beats explaining drug effects
 *   - SimAction beats
 *   - Question beats
 */

import type { ConductorScenario } from '../conductor/types';

export const EASY_COLONOSCOPY_BEATS: ConductorScenario = {
  id: 'easy_colonoscopy',
  title: 'Routine Colonoscopy - Healthy Adult',
  difficulty: 'easy',
  patientArchetype: 'healthy_adult',
  steps: [
    // ── Step 1: Pre-sedation assessment & ASA classification ─────────────────
    {
      id: 'step_asa',
      phase: 'pre_induction',
      triggerType: 'on_start',
      beats: [
        {
          id: 'step_asa_b0_phase',
          type: 'phase',
          delayMs: 0,
          phaseLabel: 'Pre-Induction Assessment',
        },
        {
          id: 'step_asa_b1_millie',
          type: 'millie',
          delayMs: 500,
          millieText: "Welcome! Let's review this patient before we begin sedation.",
        },
        {
          id: 'step_asa_b2_callout',
          type: 'callout',
          delayMs: 1500,
          callout: {
            targetId: 'patient-banner',
            text: '45-year-old healthy male — no cardiopulmonary disease, no OSA, no prior anesthesia issues',
            severity: 'normal',
          },
        },
        {
          id: 'step_asa_b3_millie',
          type: 'millie',
          delayMs: 3000,
          millieText: 'Based on the history and exam, what ASA physical status class would you assign?',
        },
        {
          id: 'step_asa_b4_simAction',
          type: 'simAction',
          delayMs: 3500,
          simAction: { type: 'set_airway_device', device: 'nasal_cannula' },
        },
        {
          id: 'step_asa_b5_simAction',
          type: 'simAction',
          delayMs: 3750,
          simAction: { type: 'set_fio2', fio2: 0.29 },
        },
        {
          id: 'step_asa_b6_callout',
          type: 'callout',
          delayMs: 4000,
          callout: {
            targetId: 'airway',
            text: 'Applying supplemental O₂ via nasal cannula (FiO₂ ~29%) before sedation',
            severity: 'normal',
          },
        },
        {
          id: 'step_asa_b7_question',
          type: 'question',
          delayMs: 5500,
          question: {
            type: 'single_choice',
            prompt: 'Choose the ASA class for this patient.',
            options: ['ASA 1', 'ASA 2', 'ASA 3', 'ASA 4'],
            correctAnswer: 'ASA 1',
            feedback: {
              'ASA 1': 'Correct! Healthy adult without systemic disease — ASA 1.',
              'ASA 2': 'Not quite. ASA 2 requires mild systemic disease, which this patient lacks.',
              'ASA 3': 'Too high. Reserve ASA 3 for severe systemic disease.',
              'ASA 4': 'Far too high. ASA 4 is a constant threat to life.',
            },
          },
          questionStepId: 'step_asa',
        },
      ],
      teachingPoints: [
        'ASA classification drives your sedation plan and monitoring level.',
      ],
    },

    // ── Step 2: Initial midazolam dose ───────────────────────────────────────
    {
      id: 'step_first_midazolam',
      phase: 'induction',
      triggerType: 'on_step_complete',
      afterStepId: 'step_asa',
      beats: [
        {
          id: 'step_midaz_b0_phase',
          type: 'phase',
          delayMs: 0,
          phaseLabel: 'Induction — Anxiolysis',
        },
        {
          id: 'step_midaz_b1_millie',
          type: 'millie',
          delayMs: 500,
          millieText: "Good. Now let's begin titrating sedation. The patient is comfortable but awake.",
        },
        {
          id: 'step_midaz_b2_callout',
          type: 'callout',
          delayMs: 1500,
          callout: {
            targetId: 'sedation_gauge',
            text: 'Target MOASS 2-3 — moderate sedation for colonoscopy',
            severity: 'normal',
          },
        },
        {
          id: 'step_midaz_b3_millie',
          type: 'millie',
          delayMs: 3000,
          millieText: 'What initial midazolam dose would you choose for this healthy adult?',
        },
        {
          id: 'step_midaz_b4_callout',
          type: 'callout',
          delayMs: 4000,
          callout: {
            targetId: 'drug_panel',
            text: 'Midazolam — typical starting dose 0.5–1 mg IV for anxiolysis',
            severity: 'normal',
          },
        },
        {
          id: 'step_midaz_b5_vitalBadge',
          type: 'vitalBadge',
          delayMs: 4500,
          vitalBadge: {
            parameter: 'rr',
            label: 'Watch RR after benzo',
            value: 14,
            severity: 'normal',
            timestamp: 0,
          },
        },
        {
          id: 'step_midaz_b6_question',
          type: 'question',
          delayMs: 5500,
          question: {
            type: 'numeric_range',
            prompt: 'Enter midazolam dose in mg',
            correctAnswer: 1,
            idealRange: [0.5, 1],
            feedback: {
              low: 'Below 0.5 mg provides minimal anxiolysis.',
              ideal: 'Good choice. 0.5–1 mg provides anxiolysis with low risk in healthy adults.',
              high: 'Above 1 mg initial dose may overshoot the target MOASS in a healthy adult.',
            },
          },
          questionStepId: 'step_first_midazolam',
        },
        {
          id: 'step_midaz_b7_simAction',
          type: 'simAction',
          delayMs: 6500,
          simAction: { type: 'administer_drug', drug: 'midazolam', dose: 1 },
        },
        {
          id: 'step_midaz_b8_simAction',
          type: 'simAction',
          delayMs: 7000,
          simAction: { type: 'advance_time', seconds: 90 },
        },
      ],
      teachingPoints: [
        'Benzodiazepines provide anxiolysis and amnesia but can cause respiratory depression.',
        'Allow 60–90 seconds between doses to see full effect before redosing.',
      ],
    },

    // ── Step 3: Fentanyl for analgesia ───────────────────────────────────────
    {
      id: 'step_fentanyl',
      phase: 'induction',
      triggerType: 'on_step_complete',
      afterStepId: 'step_first_midazolam',
      beats: [
        {
          id: 'step_fent_b0_millie',
          type: 'millie',
          delayMs: 500,
          millieText: 'The patient appears more relaxed, but the colonoscopy will cause discomfort.',
        },
        {
          id: 'step_fent_b1_callout',
          type: 'callout',
          delayMs: 1500,
          callout: {
            targetId: 'monitor-etco2',
            text: 'EtCO₂ baseline ~38 mmHg — rising EtCO₂ or flattened waveform = hypoventilation',
            severity: 'normal',
          },
        },
        {
          id: 'step_fent_b2_millie',
          type: 'millie',
          delayMs: 3000,
          millieText: 'What fentanyl dose would you give for procedural analgesia?',
        },
        {
          id: 'step_fent_b3_callout',
          type: 'callout',
          delayMs: 4000,
          callout: {
            targetId: 'drug_panel',
            text: 'Fentanyl — typical 25–50 mcg IV; wait for midazolam to peak first',
            severity: 'normal',
          },
        },
        {
          id: 'step_fent_b4_vitalBadge',
          type: 'vitalBadge',
          delayMs: 4500,
          vitalBadge: {
            parameter: 'rr',
            label: 'Opioid + Benzo → ↓RR synergy',
            value: 14,
            severity: 'warning',
            timestamp: 0,
          },
        },
        {
          id: 'step_fent_b5_question',
          type: 'question',
          delayMs: 5500,
          question: {
            type: 'numeric_range',
            prompt: 'Enter fentanyl dose in mcg',
            correctAnswer: 50,
            idealRange: [25, 50],
            feedback: {
              low: 'Below 25 mcg may not provide adequate analgesia for colonoscopy.',
              ideal: 'Good choice. 25–50 mcg provides analgesia with minimal respiratory depression.',
              high: 'Above 50 mcg initial dose risks significant respiratory depression, especially combined with midazolam.',
            },
          },
          questionStepId: 'step_fentanyl',
        },
        {
          id: 'step_fent_b6_simAction',
          type: 'simAction',
          delayMs: 6500,
          simAction: { type: 'administer_drug', drug: 'fentanyl', dose: 50 },
        },
        {
          id: 'step_fent_b7_simAction',
          type: 'simAction',
          delayMs: 7000,
          simAction: { type: 'advance_time', seconds: 120 },
        },
      ],
      teachingPoints: [
        'Opioid–benzodiazepine synergy: combined respiratory depressant effect is greater than additive.',
        'Monitor RR and EtCO₂ closely after adding fentanyl to midazolam.',
      ],
    },

    // ── Step 4: Maintenance monitoring ──────────────────────────────────────
    {
      id: 'step_maintenance_monitoring',
      phase: 'maintenance',
      triggerType: 'on_step_complete',
      afterStepId: 'step_fentanyl',
      beats: [
        {
          id: 'step_maint_b0_phase',
          type: 'phase',
          delayMs: 0,
          phaseLabel: 'Maintenance & Monitoring',
        },
        {
          id: 'step_maint_b1_millie',
          type: 'millie',
          delayMs: 500,
          millieText: 'Good. The colonoscopy is now underway. Monitor the patient closely.',
        },
        {
          id: 'step_maint_b2_callout',
          type: 'callout',
          delayMs: 1500,
          callout: {
            targetId: 'monitor-spo2',
            text: 'SpO₂ must stay ≥ 94%. Below 93% for >15 s triggers a complication response.',
            severity: 'normal',
          },
        },
        {
          id: 'step_maint_b3_callout',
          type: 'callout',
          delayMs: 3500,
          callout: {
            targetId: 'monitor-etco2',
            text: 'EtCO₂ > 50 mmHg or flat waveform = hypoventilation — intervene early!',
            severity: 'warning',
          },
        },
        {
          id: 'step_maint_b4_millie',
          type: 'millie',
          delayMs: 5000,
          millieText: 'Watch SpO₂, EtCO₂, and respiratory rate — these are your early warning indicators.',
        },
        {
          id: 'step_maint_b5_simAction',
          type: 'simAction',
          delayMs: 6000,
          simAction: { type: 'advance_time', seconds: 120 },
        },
      ],
      teachingPoints: [
        'During maintenance, continuously monitor SpO₂, EtCO₂, HR, and BP.',
        'Capnography (EtCO₂) changes are the earliest sign of hypoventilation — earlier than SpO₂ drops.',
      ],
    },

    // ── Step 5: Desaturation complication ────────────────────────────────────
    {
      id: 'step_desat_event',
      phase: 'complication',
      triggerType: 'on_physiology',
      triggerCondition: {
        parameter: 'spo2',
        operator: '<',
        threshold: 93,
        durationSeconds: 15,
      },
      beats: [
        {
          id: 'step_desat_b0_millie',
          type: 'millie',
          delayMs: 0,
          millieText: '⚠️ SpO₂ is dropping! Recognise this early — intervene now before it worsens.',
        },
        {
          id: 'step_desat_b1_callout',
          type: 'callout',
          delayMs: 500,
          callout: {
            targetId: 'monitor-spo2',
            text: 'SpO₂ < 93% — respiratory depression from opioid + benzo combination',
            severity: 'danger',
          },
        },
        {
          id: 'step_desat_b2_vitalBadge',
          type: 'vitalBadge',
          delayMs: 1000,
          vitalBadge: {
            parameter: 'spo2',
            label: 'Desaturation',
            value: 91,
            severity: 'critical',
            timestamp: 0,
          },
        },
        {
          id: 'step_desat_b3_millie',
          type: 'millie',
          delayMs: 2500,
          millieText: 'First: increase FiO₂, perform jaw thrust, and stimulate verbally. Have reversal agents ready.',
        },
        {
          id: 'step_desat_b4_callout',
          type: 'callout',
          delayMs: 3500,
          callout: {
            targetId: 'airway',
            text: 'Jaw thrust + ↑O₂ — stimulate the patient verbally first before pharmacologic reversal',
            severity: 'danger',
          },
        },
        {
          id: 'step_desat_b5_question',
          type: 'question',
          delayMs: 5000,
          question: {
            type: 'single_choice',
            prompt: 'Best immediate action for SpO₂ < 93%?',
            options: [
              'Increase O₂ and perform chin lift/jaw thrust',
              'Give more midazolam',
              'Do nothing and observe',
              'Administer naloxone immediately',
            ],
            correctAnswer: 'Increase O₂ and perform chin lift/jaw thrust',
            feedback: {
              'Increase O₂ and perform chin lift/jaw thrust':
                'Correct! Address airway and oxygenation first.',
              'Give more midazolam':
                'Dangerous. This will worsen respiratory depression.',
              'Do nothing and observe':
                'Risky. Early intervention prevents deeper desaturation.',
              'Administer naloxone immediately':
                'Not first-line unless strong suspicion of pure opioid overdose.',
            },
          },
          questionStepId: 'step_desat_event',
        },
        {
          id: 'step_desat_b6_simAction',
          type: 'simAction',
          delayMs: 6000,
          simAction: { type: 'apply_intervention', intervention: 'jaw_thrust' },
        },
        {
          id: 'step_desat_b7_simAction',
          type: 'simAction',
          delayMs: 6250,
          simAction: { type: 'set_fio2', fio2: 0.40 },
        },
      ],
      vitalTargets: { spo2: 94 },
      teachingPoints: [
        'Recognise desaturation early — SpO₂ < 93% for 15 s requires immediate intervention.',
        'Physical stimulation (jaw thrust, verbal) is often effective before pharmacologic reversal.',
        'Flumazenil reverses midazolam; naloxone reverses fentanyl — have both at bedside.',
      ],
    },

    // ── Step 6: Recovery ─────────────────────────────────────────────────────
    {
      id: 'step_end',
      phase: 'recovery',
      triggerType: 'on_time',
      triggerTimeSeconds: 360,
      beats: [
        {
          id: 'step_end_b0_phase',
          type: 'phase',
          delayMs: 0,
          phaseLabel: 'Recovery',
        },
        {
          id: 'step_end_b1_millie',
          type: 'millie',
          delayMs: 500,
          millieText: 'The colonoscopy is complete. The patient is waking up nicely.',
        },
        {
          id: 'step_end_b2_callout',
          type: 'callout',
          delayMs: 1500,
          callout: {
            targetId: 'sedation_gauge',
            text: 'MOASS should reach 3+ before transfer to PACU',
            severity: 'normal',
          },
        },
        {
          id: 'step_end_b3_millie',
          type: 'millie',
          delayMs: 3000,
          millieText: 'What is the minimum MOASS level for safe discharge to PACU from the procedure room?',
        },
        {
          id: 'step_end_b4_question',
          type: 'question',
          delayMs: 4500,
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
          questionStepId: 'step_end',
        },
      ],
      teachingPoints: [
        'Recovery monitoring is as important as induction — drugs are still active.',
        'Minimum MOASS 3 before PACU transfer; document discharge criteria met.',
      ],
    },
  ],

  debrief: {
    discussionQuestions: [
      'What were the early signs of respiratory compromise in this case?',
      'How does opioid–benzodiazepine synergy affect your dosing strategy?',
      'What monitoring parameters are most important during moderate sedation?',
      'When would you choose naloxone vs. flumazenil for reversal?',
    ],
    keyTakeaways: [
      'Always titrate sedatives incrementally and wait for full drug effect.',
      'Capnography changes precede SpO₂ drops — it is the earliest warning system.',
      'Have reversal agents (flumazenil, naloxone) immediately available.',
      'Even healthy ASA I patients require full monitoring and rescue readiness.',
    ],
  },
};
