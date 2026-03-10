// src/ai/mentor.ts
// Conversational Explainable AI Mentor/Tutor
// Provides real-time guidance, post-session debrief, and adaptive feedback
// Uses Claude Opus API with offline KNOWLEDGE_BASE fallback

import { Vitals, LogEntry, MOASSLevel, AirwayState, CardiacRhythm } from '../types';
import { EEGState } from '../engine/eegModel';
import { DigitalTwin } from '../engine/digitalTwin';
import { streamClaude, offlineFallback, ClaudeContext } from './claudeClient';

export interface MentorMessage {
  role: 'user' | 'mentor' | 'system';
  content: string;
  timestamp: number;
  citations?: string[];    // Source references (ASA, NYSORA, etc.)
  confidence?: number;     // 0-1 confidence score
  isStreaming?: boolean;   // true while Claude is still streaming
}

export interface MentorState {
  messages: MentorMessage[];
  isThinking: boolean;
  isInitialized: boolean;
  learnerLevel: 'novice' | 'intermediate' | 'advanced';
  sessionScore: SessionScore;
}

export interface SessionScore {
  titrationAccuracy: number;    // 0-100
  eegInterpretation: number;    // 0-100
  complicationResponse: number; // 0-100
  overallGrade: string;         // A-F
  strengths: string[];
  improvements: string[];
}

// Suggested questions based on current simulation state
export const getSuggestedQuestions = (
  vitals: Vitals,
  moass: MOASSLevel,
  eeg?: EEGState
): string[] => {
  const questions: string[] = [];

  if (vitals.spo2 < 92) {
    questions.push('Why is SpO2 dropping and what should I do?');
  }
  if (vitals.hr < 50) {
    questions.push('How should I manage this bradycardia?');
  }
  if (vitals.sbp < 90) {
    questions.push('What is causing the hypotension?');
  }
  if (moass <= 1) {
    questions.push('Is the patient too deeply sedated?');
  }
  if (moass >= 4) {
    questions.push('Should I increase sedation depth?');
  }
  if (eeg && eeg.bisIndex < 20) {
    questions.push('What does this burst suppression pattern mean?');
  }
  if (eeg && eeg.bisIndex > 60 && moass <= 2) {
    questions.push('Why is BIS high but patient seems sedated?');
  }

  // Always available questions
  questions.push('Interpret the current EEG pattern');
  questions.push('Suggest optimal drug titration');
  questions.push('Explain current sedation depth');

  return questions.slice(0, 5);
};

// Knowledge base for offline mentor responses (RAG-lite)
// Keep for offline fallback — imported by claudeClient.ts as well
export { KNOWLEDGE_BASE } from './claudeClient';

// Generate mentor response based on query and simulation context.
// Uses Claude API when available; falls back to the offline KNOWLEDGE_BASE.
// Pass `onChunk` to receive streaming tokens as they arrive.
export const generateMentorResponse = async (
  query: string,
  context: {
    twin?: DigitalTwin;
    vitals: Vitals;
    moass: MOASSLevel;
    eeg?: EEGState;
    eventLog: LogEntry[];
    pkStates: Record<string, { ce: number }>;
    learnerLevel?: 'novice' | 'intermediate' | 'advanced';
  },
  onChunk?: (text: string) => void
): Promise<MentorMessage> => {
  // Build ClaudeContext
  const claudeCtx: ClaudeContext = {
    patient: context.twin
      ? {
          age: context.twin.age,
          weight: context.twin.weight,
          sex: context.twin.sex,
          asa: context.twin.asa,
          comorbidities: context.twin.comorbidities ?? [],
          mallampati: context.twin.mallampati,
          osa: context.twin.osa,
          drugSensitivity: context.twin.drugSensitivity,
        }
      : undefined,
    vitals: context.vitals,
    moass: context.moass,
    eeg: context.eeg,
    pkStates: context.pkStates,
    learnerLevel: context.learnerLevel,
    recentEvents: context.eventLog.slice(-5).map(e => e.message),
  };

  // Try Claude API first
  try {
    const fullText = await streamClaude(
      query,
      claudeCtx,
      (chunk) => onChunk?.(chunk)
    );
    return {
      role: 'mentor',
      content: fullText,
      timestamp: Date.now(),
      citations: ['Claude AI (SedSim Mentor)'],
      confidence: 0.92,
    };
  } catch {
    // Fall back to offline knowledge base
    const fallback = offlineFallback(query, claudeCtx);
    return {
      role: 'mentor',
      content: fallback.text,
      timestamp: Date.now(),
      citations: fallback.citations,
      confidence: fallback.confidence,
    };
  }
};

// Generate post-session debrief
export const generateDebrief = (
  eventLog: LogEntry[],
  trendData: Array<{ vitals: Vitals; moass: MOASSLevel }>
): SessionScore => {
  // Analyze titration accuracy
  const targetMoass = [2, 3]; // Ideal sedation range
  const moassValues = trendData.map(t => t.moass);
  const inRange = moassValues.filter(m => targetMoass.includes(m)).length;
  const titrationAccuracy = Math.round((inRange / Math.max(1, moassValues.length)) * 100);

  // Analyze complication response
  const criticalEvents = eventLog.filter(e => e.severity === 'danger');
  const interventions = eventLog.filter(e => e.type === 'intervention');
  const complicationResponse = criticalEvents.length === 0 ? 100 :
    Math.min(100, Math.round((interventions.length / criticalEvents.length) * 50 + 50));

  // EEG interpretation score (placeholder - would need user interaction tracking)
  const eegInterpretation = 75;

  // Calculate grade
  const avg = (titrationAccuracy + eegInterpretation + complicationResponse) / 3;
  const overallGrade = avg >= 90 ? 'A' : avg >= 80 ? 'B' : avg >= 70 ? 'C' : avg >= 60 ? 'D' : 'F';

  // Generate feedback
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (titrationAccuracy > 70) strengths.push('Good sedation depth maintenance');
  else improvements.push('Practice titrating to target MOASS 2-3');

  if (complicationResponse > 70) strengths.push('Appropriate complication management');
  else improvements.push('Faster response to critical vital sign changes needed');

  const spo2Drops = trendData.filter(t => t.vitals.spo2 < 90).length;
  if (spo2Drops === 0) strengths.push('No significant desaturation episodes');
  else improvements.push(`${spo2Drops} desaturation episodes - review airway management`);

  return {
    titrationAccuracy,
    eegInterpretation,
    complicationResponse,
    overallGrade,
    strengths,
    improvements,
  };
};

export default { generateMentorResponse, generateDebrief, getSuggestedQuestions };

// ---------------------------------------------------------------------------
// Proactive teaching triggers
// ---------------------------------------------------------------------------

/** The 8 clinical pattern types that Millie can proactively teach about. */
export type ProactiveTriggerType =
  | 'oversedation'
  | 'respiratory_depression'
  | 'hemodynamic_instability'
  | 'drug_interaction'
  | 'airway_compromise'
  | 'cardiac_arrest_delayed'
  | 'incorrect_dosing'
  | 'missed_reversal';

/**
 * Cooldown state — maps each trigger type to the timestamp (ms) it last fired.
 * Pass a mutable object; `checkProactiveTriggers` updates it in-place.
 */
export type TriggerCooldowns = Partial<Record<ProactiveTriggerType, number>>;

/** Minimum gap between repeat firings of the same trigger (60 seconds). */
export const TRIGGER_COOLDOWN_MS = 60_000;

/** Context required by `checkProactiveTriggers`. */
export interface ProactiveTriggerContext {
  vitals: Vitals;
  moass: MOASSLevel;
  pkStates: Record<string, { ce: number }>;
  /** Optional EEG state — reserved for future trigger expansion. */
  eeg?: EEGState;
  /** Optional digital-twin patient data for dose-checking. */
  twin?: DigitalTwin;
  /** Optional airway state for airway-compromise trigger. */
  airway?: AirwayState;
  /** Recent event log entries for missed-reversal detection. */
  eventLog?: LogEntry[];
  /**
   * How many continuous seconds the airway has been compromised without any
   * physical intervention (jaw-thrust, oral airway, etc.).
   */
  secondsAirwayCompromisedWithoutIntervention?: number;
  /**
   * How many continuous seconds the current arrest rhythm has been active
   * without a documented ACLS intervention.
   */
  secondsWithArrestRhythm?: number;
  /**
   * The most recent bolus administered, used to check dose-per-kg validity.
   * `dose` must be in the drug's native bolus unit (mg for propofol/midazolam,
   * mcg for fentanyl) so that dose-per-kg comparisons use consistent units.
   * Set to `null` when no recent bolus is available.
   */
  recentBolus?: { drugName: string; dose: number; unit: string } | null;
}

/**
 * Evaluate all 8 proactive teaching triggers against the current simulation
 * state and fire the highest-priority one that is not on cooldown.
 *
 * - Updates `cooldowns` in-place when a trigger fires.
 * - Returns a `MentorMessage` using a Socratic question (not a direct answer),
 *   or `null` when no trigger condition is met or all matching triggers are
 *   still within their cooldown window.
 *
 * @param context  Current simulation snapshot.
 * @param cooldowns  Mutable cooldown-state object (persisted by the caller).
 * @param nowMs  Current wall-clock time in milliseconds (default: Date.now()).
 */
export const checkProactiveTriggers = (
  context: ProactiveTriggerContext,
  cooldowns: TriggerCooldowns,
  nowMs: number = Date.now()
): MentorMessage | null => {
  const { vitals, moass, pkStates, twin, airway, eventLog = [] } = context;

  const propCe  = pkStates['propofol']?.ce ?? 0;
  const fentCe  = pkStates['fentanyl']?.ce ?? 0;
  const midazCe = pkStates['midazolam']?.ce ?? 0;

  const isOnCooldown = (type: ProactiveTriggerType): boolean => {
    const last = cooldowns[type];
    return last !== undefined && nowMs - last < TRIGGER_COOLDOWN_MS;
  };

  const fire = (type: ProactiveTriggerType, content: string): MentorMessage => {
    cooldowns[type] = nowMs;
    return { role: 'mentor', content, timestamp: nowMs, confidence: 0.9 };
  };

  // --- Trigger 1: Oversedation (MOASS 0-1) ---
  if (moass <= 1 && !isOnCooldown('oversedation')) {
    return fire(
      'oversedation',
      `🔍 MOASS is ${moass}/5 — the patient shows minimal response to stimulation. ` +
      `What does this level of sedation depth tell you about airway reflex preservation? ` +
      `Which vital signs or clinical signs would you reassess right now? -- Millie`
    );
  }

  // --- Trigger 2: Respiratory depression (RR < 8 or SpO₂ < 90) ---
  if ((vitals.rr < 8 || vitals.spo2 < 90) && !isOnCooldown('respiratory_depression')) {
    const detail = vitals.rr < 8
      ? `respiratory rate of ${vitals.rr}/min`
      : `SpO₂ of ${vitals.spo2}%`;
    return fire(
      'respiratory_depression',
      `⚠️ I'm noticing a ${detail}. What physiological mechanism links hypnotic and opioid ` +
      `effect-site concentrations to this finding? What would be your first clinical intervention? -- Millie`
    );
  }

  // --- Trigger 3: Hemodynamic instability (SBP < 90 or HR < 50) ---
  if ((vitals.sbp < 90 || vitals.hr < 50) && !isOnCooldown('hemodynamic_instability')) {
    const detail = vitals.sbp < 90
      ? `BP ${vitals.sbp}/${vitals.dbp} mmHg`
      : `HR ${vitals.hr} bpm`;
    return fire(
      'hemodynamic_instability',
      `⚠️ ${detail} is outside safe parameters. Which drugs currently active have ` +
      `sympatholytic or vasodilatory properties? How does each one contribute to this hemodynamic picture? -- Millie`
    );
  }

  // --- Trigger 4: Drug interaction — propofol + opioid synergy ---
  if (propCe > 1.5 && fentCe > 0.001 && !isOnCooldown('drug_interaction')) {
    return fire(
      'drug_interaction',
      `💊 Propofol Ce ${propCe.toFixed(1)} mcg/mL and fentanyl Ce ${(fentCe * 1000).toFixed(1)} ng/mL ` +
      `are both clinically active simultaneously. How do these two agents interact ` +
      `pharmacodynamically? What does the Bouillon response-surface model predict about their ` +
      `combined effect on sedation depth and respiratory drive? -- Millie`
    );
  }

  // --- Trigger 5: Airway compromise without intervention ---
  const airwayCompromisedSeconds =
    context.secondsAirwayCompromisedWithoutIntervention ?? 0;
  const airwayObstructed =
    airway !== undefined && airway.obstructionType !== 'none' && airway.intervention === 'none';

  if (
    (airwayCompromisedSeconds > 30 || airwayObstructed) &&
    !isOnCooldown('airway_compromise')
  ) {
    const detail = airwayCompromisedSeconds > 30
      ? `been compromised for over ${Math.round(airwayCompromisedSeconds)} seconds`
      : `showing ${airway?.obstructionType} obstruction`;
    return fire(
      'airway_compromise',
      `🫁 The airway has ${detail} without a physical intervention. ` +
      `What non-pharmacological maneuvers are available to you right now? ` +
      `At what point would you escalate to a definitive airway device? -- Millie`
    );
  }

  // --- Trigger 6: Delayed recognition of cardiac arrest rhythm ---
  const arrestRhythms: CardiacRhythm[] = [
    'ventricular_fibrillation',
    'asystole',
    'pea',
    'ventricular_tachycardia',
  ];
  const currentRhythm = vitals.rhythm;
  const arrestDelaySeconds = context.secondsWithArrestRhythm ?? 0;

  if (
    currentRhythm !== undefined &&
    arrestRhythms.includes(currentRhythm) &&
    arrestDelaySeconds > 10 &&
    !isOnCooldown('cardiac_arrest_delayed')
  ) {
    const rhythmLabel = currentRhythm.replace(/_/g, ' ');
    return fire(
      'cardiac_arrest_delayed',
      `🚨 The monitor has been showing ${rhythmLabel} for ${Math.round(arrestDelaySeconds)} seconds. ` +
      `Is this a shockable or non-shockable rhythm? ` +
      `What does the ACLS algorithm call for as the immediate next step? -- Millie`
    );
  }

  // --- Trigger 7: Incorrect drug/dose for patient weight/age ---
  if (context.recentBolus && twin && !isOnCooldown('incorrect_dosing')) {
    const { drugName, dose, unit } = context.recentBolus;
    const weight = twin.weight;
    const age    = twin.age;
    // `dosePerKg` uses the drug's native unit (mg/kg for propofol/midazolam, mcg/kg for fentanyl)
    const dosePerKg = dose / weight;
    let isHighDose   = false;
    let safeDoseHint = '';

    if (drugName === 'propofol' && dosePerKg > 1.5) {
      isHighDose   = true;
      safeDoseHint = 'typical induction dose is 1–2 mg/kg; elderly/ASA III–IV patients often need 30–50% less';
    } else if (drugName === 'fentanyl' && dosePerKg > 2.0) {
      // fentanyl dose is always in mcg in this codebase, so dosePerKg is mcg/kg
      isHighDose   = true;
      safeDoseHint = 'typical procedural bolus is 0.5–2 mcg/kg titrated to effect';
    } else if (drugName === 'midazolam' && dosePerKg > 0.05) {
      isHighDose   = true;
      safeDoseHint = 'typical dose is 0.02–0.04 mg/kg; reduce by 30% in elderly or debilitated patients';
    }

    if (isHighDose) {
      const ageNote = age > 65 ? `, elderly (${age} yo)` : '';
      return fire(
        'incorrect_dosing',
        `💉 That bolus of ${drugName} calculates to ${dosePerKg.toFixed(2)} ${unit}/kg ` +
        `for a ${weight} kg${ageNote} patient — above typical ranges (${safeDoseHint}). ` +
        `How does the Eleveld model account for age and weight when predicting effect-site ` +
        `concentration? What patient factors lower the safe induction dose? -- Millie`
      );
    }
  }

  // --- Trigger 8: Missed reversal agent opportunity ---
  // 8a: Opioid-driven respiratory depression without naloxone
  if (fentCe > 0.002 && vitals.rr < 8 && !isOnCooldown('missed_reversal')) {
    const naloxoneGiven = eventLog.some(e =>
      e.message.toLowerCase().includes('naloxone')
    );
    if (!naloxoneGiven) {
      return fire(
        'missed_reversal',
        `💊 Fentanyl Ce is ${(fentCe * 1000).toFixed(1)} ng/mL with RR ${vitals.rr}/min. ` +
        `Is a reversal agent appropriate here? What is the mechanism of naloxone, ` +
        `and what are the risks of administering a full reversal dose in an opioid-tolerant patient? -- Millie`
      );
    }
  }

  // 8b: Benzodiazepine-driven deep sedation without flumazenil
  if (midazCe > 0.1 && moass <= 1 && !isOnCooldown('missed_reversal')) {
    const flumazenilGiven = eventLog.some(e =>
      e.message.toLowerCase().includes('flumazenil')
    );
    if (!flumazenilGiven) {
      return fire(
        'missed_reversal',
        `💊 Midazolam Ce is ${midazCe.toFixed(2)} mcg/mL with deep sedation (MOASS ${moass}/5). ` +
        `Would flumazenil be appropriate in this scenario? ` +
        `What are the indications, contraindications, and duration-of-action considerations ` +
        `for benzodiazepine reversal? -- Millie`
      );
    }
  }

  return null;
};

// Auto-generate a contextual observation based on current simulation state.
// Called periodically (e.g. every 30 sim-seconds) to produce proactive mentor notes.
export const autoObserve = (context: {
  vitals: Vitals;
  moass: MOASSLevel;
  eeg?: EEGState;
  pkStates: Record<string, { ce: number }>;
  elapsedSeconds: number;
}): MentorMessage | null => {
  const { vitals, moass, eeg: _eeg, pkStates, elapsedSeconds } = context;
  const propCe = pkStates['propofol']?.ce || 0;
  const fentCe = pkStates['fentanyl']?.ce || 0;
  const dexCe = pkStates['dexmedetomidine']?.ce || 0;

  const observations: string[] = [];

  // Vital sign observations
  if (vitals.spo2 < 90) {
    observations.push(`\u26A0 SpO\u2082 critically low at ${vitals.spo2}%. Increase FiO2, apply jaw thrust, reduce respiratory-depressant infusion.`);
  } else if (vitals.spo2 < 94) {
    observations.push(`SpO\u2082 trending down to ${vitals.spo2}%. Increase supplemental oxygen. Monitor airway patency.`);
  }

  if (vitals.sbp < 80) {
    observations.push(`\u26A0 Hypotension: BP ${vitals.sbp}/${vitals.dbp} mmHg. Fluid bolus, reduce propofol rate, consider vasopressor.`);
  } else if (vitals.sbp < 90 && propCe > 2) {
    observations.push(`BP ${vitals.sbp}/${vitals.dbp} – borderline hypotension with propofol Ce ${propCe.toFixed(1)} mcg/mL. Consider reducing infusion rate.`);
  }

  if (vitals.hr < 45) {
    observations.push(`\u26A0 Bradycardia HR ${vitals.hr} bpm. ${dexCe > 0.3 ? 'Likely dexmedetomidine-related. ' : ''}Consider atropine 0.5 mg IV if symptomatic.`);
  }

  if (vitals.rr <= 6 || vitals.rr === 0) {
    observations.push(`\u26A0 Respiratory rate ${vitals.rr}/min. ${fentCe > 0.003 ? 'Opioid-related respiratory depression – consider naloxone 0.04 mg increments. ' : 'Consider airway maneuvers and BVM readiness.'}`);
  }

  // Drug-specific observations
  if (propCe > 4) {
    observations.push(`Propofol Ce ${propCe.toFixed(1)} mcg/mL – approaching burst-suppression threshold (>4 mcg/mL). Assess for over-sedation.`);
  }

  if (fentCe > 0.003 && vitals.rr < 10) {
    observations.push(`Fentanyl Ce ${(fentCe * 1000).toFixed(1)} ng/mL with RR ${vitals.rr}/min. Opioid synergy with hypnotic – monitor closely.`);
  }

  // Periodic status messages (every 30 seconds)
  if (observations.length === 0 && elapsedSeconds > 0 && elapsedSeconds % 30 < 2) {
    if (moass >= 2 && moass <= 3) {
      observations.push(`Status check at T+${Math.floor(elapsedSeconds / 60)}min: MOASS ${moass}/5 – target sedation depth maintained. Vitals stable.`);
    } else if (moass === 1) {
              observations.push(`Status at T+${Math.floor(elapsedSeconds / 60)}min: Deep sedation (MOASS 1). Monitor airway and hemodynamics.`);
    }
  }

  if (observations.length === 0) return null;

  return {
    role: 'mentor',
    content: observations[0],
    timestamp: Date.now(),
    confidence: 0.9,
  };
};
