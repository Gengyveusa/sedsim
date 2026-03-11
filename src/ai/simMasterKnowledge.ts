/**
 * src/ai/simMasterKnowledge.ts
 * SimMaster v4 — Clinical State Transition Knowledge Base
 *
 * Defines parameter-level clinical ranges with physiological explanations,
 * plus multi-parameter clinical patterns that SimMaster uses to detect
 * cascading events and generate targeted Socratic teaching.
 */

// ---------------------------------------------------------------------------
// Clinical State Definitions (per-parameter)
// ---------------------------------------------------------------------------

export interface ClinicalStateDefinition {
  parameter: string;
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
    normalRange: [60, 100],
    warningRange: [50, 110],
    criticalRange: [30, 150],
    transitionExplanations: {
      normalToWarning:
        'Heart rate is drifting outside normal range. Bradycardia may indicate vagal tone from opioids or dexmedetomidine. Tachycardia may reflect pain, light sedation, or sympathetic response to ketamine.',
      warningToCritical:
        'Significant heart rate abnormality. Severe bradycardia impairs cardiac output (CO = HR x SV). Severe tachycardia shortens diastolic filling time, reducing coronary perfusion and stroke volume.',
      criticalToEmergent:
        'Heart rate is at a life-threatening extreme. Bradycardia < 30 bpm risks asystole. Tachycardia > 150 bpm causes hemodynamic collapse from inadequate ventricular filling.',
    },
    associatedPanels: ['hr', 'ecg-wave', 'trend-graph'],
    teachingPoints: [
      'CO = HR x SV — both components matter for perfusion',
      'Opioids cause bradycardia via central vagal stimulation',
      'Ketamine uniquely causes sympathetic-mediated tachycardia',
      'Dexmedetomidine bradycardia is dose-dependent (alpha-2 agonism)',
    ],
  },
  spo2: {
    parameter: 'spo2',
    normalRange: [95, 100],
    warningRange: [92, 100],
    criticalRange: [80, 100],
    transitionExplanations: {
      normalToWarning:
        'SpO2 beginning to decline. The O2-Hb dissociation curve is sigmoidal — we are still on the relatively flat upper portion, but approaching the steep section where small PaO2 drops cause large SpO2 falls.',
      warningToCritical:
        'SpO2 is on the steep portion of the dissociation curve. Each 1 mmHg drop in PaO2 causes a disproportionately large fall in saturation. Tissue oxygen delivery is compromised.',
      criticalToEmergent:
        'Profound hypoxemia. At SpO2 < 80%, PaO2 is approximately 44 mmHg. Cerebral and myocardial hypoxia imminent. Bradycardia and cardiac arrest follow without immediate intervention.',
    },
    associatedPanels: ['spo2', 'pleth-wave', 'capno-wave', 'airway-controls'],
    teachingPoints: [
      'The O2-Hb curve inflection around PaO2 60 mmHg (SpO2 ~90%) is the critical threshold',
      'SpO2 is a LAGGING indicator — desaturation is already advanced by the time the probe reads it',
      'Pulse oximetry requires pulsatile flow; low perfusion states may give inaccurate readings',
      'FiO2 supplementation shifts the alveolar gas equation, buying time for airway intervention',
    ],
  },
  sbp: {
    parameter: 'sbp',
    normalRange: [90, 140],
    warningRange: [85, 160],
    criticalRange: [60, 200],
    transitionExplanations: {
      normalToWarning:
        'Blood pressure drifting. Propofol causes dose-dependent vasodilation and myocardial depression. MAP = CO x SVR — both components are affected by sedative drugs.',
      warningToCritical:
        'Significant hypotension threatens organ perfusion. MAP < 65 mmHg is the critical autoregulatory threshold for cerebral and renal perfusion. Coronary perfusion pressure drops dangerously.',
      criticalToEmergent:
        'Cardiovascular collapse. SBP < 60 mmHg indicates profound vasodilation or pump failure. Without vasopressors and volume resuscitation, multiorgan failure follows within minutes.',
    },
    associatedPanels: ['bp', 'trend-graph', 'intervention-panel'],
    teachingPoints: [
      'Propofol hypotension: vasodilation (SVR decrease) + myocardial depression (inotropy decrease)',
      'MAP = DBP + 1/3(SBP - DBP) — target MAP > 65 mmHg for organ perfusion',
      'Elderly patients have reduced baroreceptor sensitivity and stiffer vasculature',
      'Fluid bolus addresses preload; vasopressors address SVR; inotropes address contractility',
    ],
  },
  rr: {
    parameter: 'rr',
    normalRange: [10, 20],
    warningRange: [8, 24],
    criticalRange: [0, 40],
    transitionExplanations: {
      normalToWarning:
        'Respiratory rate changing. Opioids depress the brainstem respiratory center, shifting the CO2 response curve rightward. The patient requires a higher PaCO2 to generate the same ventilatory drive.',
      warningToCritical:
        'Significant respiratory depression. At RR < 8, minute ventilation is critically reduced. CO2 retention is accelerating, causing respiratory acidosis. Hypoxia will follow as FRC oxygen reserve depletes.',
      criticalToEmergent:
        'Apnea or near-apnea. Without ventilation, SpO2 will drop from 100% to 0% in 3-5 minutes (faster in obese/OSA patients). Immediate airway intervention and assisted ventilation required.',
    },
    associatedPanels: ['rr', 'capno-wave', 'etco2', 'airway-controls'],
    teachingPoints: [
      'Minute ventilation = RR x Tidal Volume — both decrease with sedation',
      'Opioids shift the CO2 response curve rightward, requiring higher PaCO2 to trigger breathing',
      'EtCO2 rises before SpO2 falls — it is a leading indicator of hypoventilation',
      'Functional residual capacity (FRC) is the oxygen reservoir; obese patients have less FRC',
    ],
  },
  etco2: {
    parameter: 'etco2',
    normalRange: [35, 45],
    warningRange: [30, 50],
    criticalRange: [10, 80],
    transitionExplanations: {
      normalToWarning:
        'EtCO2 trending abnormally. Rising EtCO2 indicates hypoventilation — CO2 production exceeds elimination. Falling EtCO2 may indicate hyperventilation, reduced cardiac output, or airway obstruction with no expiration.',
      warningToCritical:
        'Significant CO2 abnormality. EtCO2 > 60 mmHg indicates severe hypoventilation with respiratory acidosis. EtCO2 < 20 may indicate cardiac arrest (no CO2 delivery to lungs) or massive pulmonary embolism.',
      criticalToEmergent:
        'Extreme CO2 levels. Severe hypercapnia (> 80 mmHg) causes CO2 narcosis, cerebral vasodilation, and arrhythmias. Absent EtCO2 in an intubated patient confirms esophageal intubation or cardiac arrest.',
    },
    associatedPanels: ['etco2', 'capno-wave', 'rr', 'airway-controls'],
    teachingPoints: [
      'EtCO2 is the most sensitive real-time indicator of ventilation adequacy',
      'Normal gradient: PaCO2 = EtCO2 + 5 mmHg (gradient increases with V/Q mismatch)',
      'Rising EtCO2 precedes falling SpO2 — it is the earliest warning of respiratory depression',
      'Capnography waveform shape provides diagnostic information (shark fin = obstruction)',
    ],
  },
  moass: {
    parameter: 'moass',
    normalRange: [2, 5],
    warningRange: [1, 5],
    criticalRange: [0, 5],
    transitionExplanations: {
      normalToWarning:
        'Sedation deepening beyond procedural target. MOASS 1 indicates minimal response to stimulation — airway reflexes are significantly impaired. BIS is likely < 60.',
      warningToCritical:
        'MOASS 0 — no response to stimulation. This is equivalent to general anesthesia depth. All protective airway reflexes are abolished. Aspiration risk is maximal.',
      criticalToEmergent:
        'Deep sedation with burst suppression on EEG. Cortical activity is profoundly suppressed. Hemodynamic compromise is likely. Drug cessation and supportive care required.',
    },
    associatedPanels: ['moass-gauge', 'eeg', 'radar'],
    teachingPoints: [
      'MOASS correlates with BIS: MOASS 3 ~ BIS 70, MOASS 1 ~ BIS 40, MOASS 0 ~ BIS < 20',
      'Target MOASS 2-3 for procedural sedation — deep enough for comfort, light enough for airway reflexes',
      'Each MOASS level corresponds to specific EC50 thresholds on the drug response surface',
      'Individual variation in drug sensitivity means the same Ce produces different MOASS levels',
    ],
  },
  bis: {
    parameter: 'bis',
    normalRange: [40, 100],
    warningRange: [30, 100],
    criticalRange: [10, 100],
    transitionExplanations: {
      normalToWarning:
        'BIS declining below 40. EEG power is shifting from alpha to delta frequencies. Frontal cortical processing is significantly suppressed. This is deeper than target for procedural sedation.',
      warningToCritical:
        'BIS below 30 — approaching burst suppression territory. The EEG shows intermittent periods of electrical silence (suppression) between bursts of activity.',
      criticalToEmergent:
        'BIS below 10 — nearly isoelectric EEG with profound cortical suppression. Hemodynamic instability is very likely. Immediate drug dose reduction required.',
    },
    associatedPanels: ['eeg', 'moass-gauge', 'trend-graph'],
    teachingPoints: [
      'BIS 40-60 is the general anesthesia target; BIS 60-80 is procedural sedation target',
      'Burst suppression ratio > 50% indicates excessive cortical suppression',
      'Propofol produces characteristic frontal alpha oscillations (8-12 Hz) at moderate BIS levels',
      'Ketamine can falsely elevate BIS due to high-frequency EEG activity (excitatory dissociation)',
    ],
  },
};

// ---------------------------------------------------------------------------
// Multi-parameter Clinical Patterns
// ---------------------------------------------------------------------------

export type PatternConditionOperator = '<' | '>' | '<=' | '>=' | 'between' | 'trending_down' | 'trending_up';

export interface PatternCondition {
  parameter: string;
  operator: PatternConditionOperator;
  value: number | [number, number]; // single threshold or [lo, hi] for "between"
}

export interface ClinicalPattern {
  id: string;
  name: string;
  conditions: PatternCondition[];
  explanation: string;
  expectedLearnerAction: string;
  panelsToHighlight: string[];
  socraticQuestions: string[];
}

export const CLINICAL_PATTERNS: ClinicalPattern[] = [
  // 1. Respiratory Depression Cascade
  {
    id: 'respiratory_depression_cascade',
    name: 'Respiratory Depression Cascade',
    conditions: [
      { parameter: 'rr', operator: '<', value: 10 },
      { parameter: 'etco2', operator: '>', value: 45 },
      { parameter: 'spo2', operator: '<', value: 95 },
    ],
    explanation:
      'Opioids and hypnotics depress the brainstem respiratory center, reducing respiratory rate and tidal volume. ' +
      'As minute ventilation falls, CO2 accumulates (EtCO2 rises). The alveolar gas equation dictates that rising ' +
      'PACO2 displaces PAO2, causing alveolar hypoxia. After the functional residual capacity oxygen reservoir ' +
      'depletes (30-90 seconds), SpO2 begins to fall. This cascade is predictable: RR drops first, then EtCO2 rises, ' +
      'then SpO2 falls. EtCO2 is the LEADING indicator — by the time SpO2 drops, hypoventilation has been present ' +
      'for over a minute.',
    expectedLearnerAction:
      'Verbal/physical stimulation → jaw thrust/chin lift → increase FiO2 → reduce or stop opioid/hypnotic → ' +
      'consider naloxone if opioid-driven → prepare bag-mask ventilation.',
    panelsToHighlight: ['rr', 'etco2', 'spo2', 'capno-wave', 'airway-controls'],
    socraticQuestions: [
      'Which vital sign changed FIRST in this cascade? Why is EtCO2 a leading indicator while SpO2 is lagging?',
      'The patient\'s RR is falling. What happens to minute ventilation, and how does the alveolar gas equation explain the SpO2 drop?',
      'If you increase FiO2 to 100%, will that fix the underlying problem? What does supplemental oxygen buy you?',
      'At what RR would you intervene with bag-mask ventilation vs. verbal stimulation alone?',
    ],
  },

  // 2. Hemodynamic Compromise
  {
    id: 'hemodynamic_compromise',
    name: 'Hemodynamic Compromise',
    conditions: [
      { parameter: 'sbp', operator: '<', value: 90 },
      { parameter: 'hr', operator: '>', value: 90 },
    ],
    explanation:
      'Propofol causes dose-dependent vasodilation (reduced SVR) and direct myocardial depression (reduced contractility). ' +
      'Blood pressure drops as MAP = CO × SVR, with both components impaired. Initially, baroreceptor-mediated tachycardia ' +
      'compensates — HR rises to maintain cardiac output. If propofol concentration continues to rise or volume status is ' +
      'inadequate, compensatory tachycardia fails: HR may paradoxically drop as myocardial oxygen supply-demand mismatch ' +
      'worsens. The Frank-Starling curve shifts downward (reduced Ees slope) and leftward (reduced preload from venodilation). ' +
      'Decompensation — bradycardia with hypotension — signals imminent cardiovascular collapse.',
    expectedLearnerAction:
      'Reduce propofol infusion rate → IV fluid bolus (250-500 mL crystalloid) → Trendelenburg position → ' +
      'ephedrine 5-10 mg IV or phenylephrine 100 mcg if fluid-unresponsive → consider stopping propofol.',
    panelsToHighlight: ['bp', 'hr', 'trend-graph', 'intervention-panel'],
    socraticQuestions: [
      'The BP is falling. Looking at the Frank-Starling curve, what has happened to the operating point? Is this a preload or contractility problem?',
      'HR is rising as BP falls — what reflex is responsible? What happens when this compensation fails?',
      'Propofol causes hypotension through two mechanisms. Can you name them and explain which is more dangerous?',
      'Would you choose ephedrine or phenylephrine for this patient? What\'s the key difference in their mechanism?',
    ],
  },

  // 3. Oversedation Trajectory
  {
    id: 'oversedation_trajectory',
    name: 'Oversedation Trajectory',
    conditions: [
      { parameter: 'moass', operator: '<=', value: 1 },
      { parameter: 'bis', operator: '<', value: 40 },
    ],
    explanation:
      'The patient is progressing toward dangerously deep sedation. MOASS ≤ 1 indicates minimal or no response to ' +
      'stimulation — all protective airway reflexes are abolished. BIS < 40 confirms profound cortical suppression ' +
      'with the EEG shifting to delta-dominant or burst suppression patterns. At this depth, propofol\'s effect-site ' +
      'concentration has crossed the EC95 for loss of consciousness and is approaching the burst suppression threshold ' +
      '(typically Ce > 4-5 mcg/mL). The clinical trajectory is: loss of verbal response → loss of response to pain → ' +
      'burst suppression → isoelectric EEG. Each step deepens hemodynamic depression and respiratory compromise.',
    expectedLearnerAction:
      'Stop or significantly reduce hypnotic infusion → ensure airway patency → support ventilation if needed → ' +
      'monitor BIS for recovery toward 60-80 → reassess target sedation depth for procedure.',
    panelsToHighlight: ['moass-gauge', 'eeg', 'drug-panel', 'radar'],
    socraticQuestions: [
      'BIS is below 40. What does burst suppression look like on the EEG, and why is it concerning for procedural sedation?',
      'The patient is at MOASS 1. What airway reflexes are still intact at this depth? What about at MOASS 0?',
      'If you stop the propofol infusion now, how long until the patient lightens? What determines the wake-up time?',
      'This patient crossed from MOASS 2 to MOASS 1 rapidly. What PK factor explains this sudden deepening?',
    ],
  },

  // 4. Drug Synergy Effects
  {
    id: 'drug_synergy_effects',
    name: 'Drug Synergy Effects',
    conditions: [
      { parameter: 'combinedEff', operator: '>', value: 0.5 },
    ],
    explanation:
      'Multiple CNS-depressant drugs are acting simultaneously, producing supra-additive (synergistic) effects. ' +
      'The Bouillon response-surface model predicts that propofol + fentanyl interaction is strongly synergistic: ' +
      'fentanyl reduces the propofol EC50 for loss of consciousness by 30-50%. Similarly, midazolam + propofol ' +
      'synergy amplifies sedation beyond what either drug achieves alone. The clinical implication is that combined ' +
      'drug effect (plotted on the response surface) exceeds the sum of individual effects. A patient who tolerates ' +
      'propofol Ce 2.0 mcg/mL alone may become dangerously oversedated at the same Ce when fentanyl is added. ' +
      'Both respiratory depression and hemodynamic effects are amplified by synergy.',
    expectedLearnerAction:
      'Recognize synergy is active → reduce hypnotic dose by 30-50% when opioid is co-administered → ' +
      'monitor MOASS and BIS more closely → anticipate exaggerated respiratory depression → have reversal agents ready.',
    panelsToHighlight: ['radar', 'moass-gauge', 'drug-panel'],
    socraticQuestions: [
      'Two drugs are active simultaneously. What does "supra-additive" mean, and how does the response surface model predict it?',
      'Fentanyl was given 3 minutes before propofol. How should this change your propofol dosing strategy?',
      'Look at the Petals view. The overlapping petals represent overlapping CNS targets. Which receptors does each drug act on?',
      'If the combined effect is 60% but propofol alone would only produce 30% effect, what accounts for the extra 30%?',
    ],
  },

  // 5. Airway Obstruction Sequence
  {
    id: 'airway_obstruction_sequence',
    name: 'Airway Obstruction Sequence',
    conditions: [
      { parameter: 'rr', operator: '>', value: 0 },
      { parameter: 'etco2', operator: '<', value: 15 },
      { parameter: 'spo2', operator: '<', value: 92 },
    ],
    explanation:
      'Upper airway obstruction follows a predictable sequence during sedation. As pharyngeal muscle tone decreases, ' +
      'the soft palate and tongue base collapse posteriorly. Initial sign: snoring (partial obstruction with turbulent ' +
      'airflow). Progression: paradoxical breathing (chest rises while abdomen retracts — "see-saw" pattern). ' +
      'Capnography shows absent or minimal EtCO2 waveform despite respiratory effort — the hallmark of obstructive apnea. ' +
      'Unlike central apnea (where RR = 0), obstructive apnea shows respiratory effort with no effective gas exchange. ' +
      'SpO2 drops rapidly because the obstruction prevents both O2 delivery and CO2 elimination. The Avatar view shows ' +
      'respiratory effort without chest rise.',
    expectedLearnerAction:
      'Jaw thrust → head tilt/chin lift → oral or nasal airway insertion → increase FiO2 → ' +
      'suction if secretions → consider LMA if basic maneuvers fail → reduce sedative dose.',
    panelsToHighlight: ['capno-wave', 'spo2', 'rr', 'airway-controls', 'avatar'],
    socraticQuestions: [
      'The patient is making respiratory effort but EtCO2 is near zero. What type of apnea is this — central or obstructive? How can you tell?',
      'What is the sequence of airway interventions from least to most invasive?',
      'Look at the Avatar — is chest rising? What does "paradoxical breathing" look like and what causes it?',
      'Which sedative drugs most commonly cause upper airway obstruction, and through what mechanism?',
    ],
  },

  // 6. Paradoxical Reactions
  {
    id: 'paradoxical_reactions',
    name: 'Paradoxical Reactions',
    conditions: [
      { parameter: 'hr', operator: '>', value: 100 },
      { parameter: 'moass', operator: '>=', value: 4 },
    ],
    explanation:
      'Paradoxical excitation can occur with benzodiazepines (especially midazolam) and occasionally with propofol. ' +
      'Instead of sedation, the patient becomes agitated, combative, or delirious. This is more common in elderly ' +
      'patients (age > 65), pediatric patients, and those with CNS pathology. The mechanism involves disinhibition ' +
      'of cortical centers that normally suppress excitatory pathways. The patient shows signs of sympathetic ' +
      'activation: tachycardia, hypertension, and movement despite adequate drug concentrations. MOASS paradoxically ' +
      'shows lightening even though Ce is rising. BIS may show high-frequency activity rather than the expected ' +
      'slow-wave pattern. Management involves stopping the offending drug and considering alternative agents.',
    expectedLearnerAction:
      'Recognize paradoxical reaction → stop midazolam/offending agent → do NOT increase the dose → ' +
      'consider propofol or ketamine as alternative → flumazenil if midazolam-induced → ensure patient safety.',
    panelsToHighlight: ['moass-gauge', 'hr', 'eeg', 'drug-panel'],
    socraticQuestions: [
      'The patient is agitated despite receiving midazolam. Is this undersedation or a paradoxical reaction? How do you differentiate?',
      'What patient populations are at highest risk for paradoxical benzodiazepine reactions?',
      'If you give MORE midazolam for this agitation, what will likely happen? What should you do instead?',
      'What role does flumazenil play here, and what are the risks of benzodiazepine reversal?',
    ],
  },

  // 7. Malignant Hyperthermia
  {
    id: 'malignant_hyperthermia',
    name: 'Malignant Hyperthermia',
    conditions: [
      { parameter: 'hr', operator: '>', value: 120 },
      { parameter: 'etco2', operator: '>', value: 60 },
    ],
    explanation:
      'Malignant hyperthermia (MH) is a life-threatening hypermetabolic crisis triggered by volatile anesthetics ' +
      'or succinylcholine in genetically susceptible individuals (RYR1 mutation). The earliest sign is unexplained ' +
      'rising EtCO2 that does not respond to increased ventilation — CO2 production is massively increased from ' +
      'uncontrolled skeletal muscle metabolism. Tachycardia follows as the sympathetic nervous system responds to ' +
      'hypermetabolism. Temperature rises late (often 1-2°C/hour) — do NOT wait for fever to diagnose MH. The ' +
      'sequence is: rising EtCO2 → tachycardia → muscle rigidity → metabolic/respiratory acidosis → hyperkalemia → ' +
      'rhabdomyolysis → temperature rise → cardiac arrest if untreated. MH mortality is 70% untreated vs. 5% with ' +
      'early dantrolene.',
    expectedLearnerAction:
      'Call for help → stop all triggering agents immediately → hyperventilate with 100% O2 → ' +
      'dantrolene 2.5 mg/kg IV initial bolus → active cooling → treat hyperkalemia → ' +
      'monitor CK/myoglobin for rhabdomyolysis.',
    panelsToHighlight: ['etco2', 'hr', 'capno-wave', 'intervention-panel'],
    socraticQuestions: [
      'EtCO2 is rising rapidly despite adequate ventilation. What diagnosis should you consider?',
      'What is the earliest clinical sign of malignant hyperthermia? Is it temperature?',
      'How does dantrolene work at the molecular level, and what is the initial dosing?',
      'Which drugs used in procedural sedation are safe in MH-susceptible patients, and which are triggers?',
    ],
  },
];

// ---------------------------------------------------------------------------
// Pattern matching utility
// ---------------------------------------------------------------------------

export interface PatternMatchResult {
  pattern: ClinicalPattern;
  matchedConditions: number;
  totalConditions: number;
  isFullMatch: boolean;
}

/**
 * Evaluate all clinical patterns against the current parameter values.
 * Returns patterns that fully match (all conditions met), sorted by number
 * of conditions (most specific patterns first).
 */
export function matchPatterns(
  params: Record<string, number>,
): PatternMatchResult[] {
  const results: PatternMatchResult[] = [];

  for (const pattern of CLINICAL_PATTERNS) {
    let matched = 0;
    for (const cond of pattern.conditions) {
      const val = params[cond.parameter];
      if (val === undefined) continue;
      const threshold = cond.value;
      let condMet = false;
      switch (cond.operator) {
        case '<':  condMet = val < (threshold as number); break;
        case '>':  condMet = val > (threshold as number); break;
        case '<=': condMet = val <= (threshold as number); break;
        case '>=': condMet = val >= (threshold as number); break;
        case 'between':
          condMet = Array.isArray(threshold) && val >= threshold[0] && val <= threshold[1];
          break;
        default: break;
      }
      if (condMet) matched++;
    }
    const total = pattern.conditions.length;
    if (matched === total) {
      results.push({ pattern, matchedConditions: matched, totalConditions: total, isFullMatch: true });
    }
  }

  return results.sort((a, b) => b.totalConditions - a.totalConditions);
}

/**
 * Get a state definition for a given parameter name.
 */
export function getStateDefinition(param: string): ClinicalStateDefinition | undefined {
  return CLINICAL_STATE_DEFINITIONS[param];
}

/**
 * Determine the clinical state of a parameter value relative to its defined ranges.
 */
export function classifyParameter(
  param: string,
  value: number,
): 'normal' | 'warning' | 'critical' | 'unknown' {
  const def = CLINICAL_STATE_DEFINITIONS[param];
  if (!def) return 'unknown';
  if (value >= def.normalRange[0] && value <= def.normalRange[1]) return 'normal';
  if (value >= def.criticalRange[0] && value <= def.criticalRange[1]) {
    // Within critical outer bounds — check warning inner bounds
    if (value >= def.warningRange[0] && value <= def.warningRange[1]) return 'warning';
    return 'critical';
  }
  return 'critical'; // outside critical range entirely
}
