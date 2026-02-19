// src/ai/mentor.ts
// Conversational Explainable AI Mentor/Tutor
// Provides real-time guidance, post-session debrief, and adaptive feedback
// Uses Claude Opus API with offline KNOWLEDGE_BASE fallback

import { Vitals, LogEntry, MOASSLevel } from '../types';
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

// Auto-generate a contextual observation based on current simulation state.
// Called periodically (e.g. every 30 sim-seconds) to produce proactive mentor notes.
export const autoObserve = (context: {
  vitals: Vitals;
  moass: MOASSLevel;
  eeg?: EEGState;
  pkStates: Record<string, { ce: number }>;
  elapsedSeconds: number;
}): MentorMessage | null => {
  const { vitals, moass, eeg, pkStates, elapsedSeconds } = context;
  const propCe = pkStates['propofol']?.ce || 0;
  const fentCe = pkStates['fentanyl']?.ce || 0;
  const dexCe = pkStates['dexmedetomidine']?.ce || 0;

  const observations: string[] = [];

  // EEG-based observations
  if (eeg) {
    if (eeg.bisIndex <= 20) {
      observations.push(`\u26A0 BIS ${eeg.bisIndex} – burst suppression detected. Sedation is excessively deep. Consider reducing hypnotic dose.`);
    } else if (eeg.bisIndex <= 40) {
      observations.push(`BIS ${eeg.bisIndex} (${eeg.sedationState}). Deep sedation. Monitor for hemodynamic depression.`);
    } else if (eeg.bisIndex <= 60) {
      observations.push(`BIS ${eeg.bisIndex} – moderate sedation. Appropriate range for procedural sedation (target 40-60).`);
    } else if (eeg.bisIndex > 75 && moass >= 3) {
      observations.push(`BIS ${eeg.bisIndex} – patient may be under-sedated (MOASS ${moass}). Consider supplemental dose if clinically indicated.`);
    }
  }

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

  // Periodic status messages (every 60 seconds)
  if (observations.length === 0 && elapsedSeconds > 0 && elapsedSeconds % 60 < 2) {
    if (moass >= 2 && moass <= 3) {
      observations.push(`Status check at T+${Math.floor(elapsedSeconds / 60)}min: MOASS ${moass}/5 – target sedation depth maintained. Vitals stable.`);
    } else if (moass === 1) {
      observations.push(`Status at T+${Math.floor(elapsedSeconds / 60)}min: Deep sedation (MOASS 1). ${eeg ? `BIS ${eeg.bisIndex}. ` : ''}Monitor airway and hemodynamics.`);
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
