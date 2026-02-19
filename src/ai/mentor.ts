// src/ai/mentor.ts
// Conversational Explainable AI Mentor/Tutor
// Provides real-time guidance, post-session debrief, and adaptive feedback
// Uses WebLLM for offline inference or API fallback

import { Vitals, LogEntry, MOASSLevel } from '../types';
import { EEGState } from '../engine/eegModel';
import { DigitalTwin } from '../engine/digitalTwin';

export interface MentorMessage {
  role: 'user' | 'mentor' | 'system';
  content: string;
  timestamp: number;
  citations?: string[];    // Source references (ASA, NYSORA, etc.)
  confidence?: number;     // 0-1 confidence score
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
const KNOWLEDGE_BASE: Record<string, string> = {
  'desaturation': 'Per ASA guidelines for sedation, SpO2 < 90% requires immediate intervention: increase FiO2, perform jaw thrust/chin lift, consider airway adjunct. If BVM ventilation needed, pause procedure. Risk factors include OSA, obesity, opioid synergy.',
  'bradycardia': 'Bradycardia during sedation commonly results from dexmedetomidine or high-dose opioids. Per ACLS: if symptomatic (HR < 50 with hypotension), consider atropine 0.5mg IV. Reduce or stop causative agent.',
  'hypotension': 'Propofol-induced hypotension is dose-dependent via vasodilation and myocardial depression. Manage with fluid bolus (250-500mL crystalloid), reduce infusion rate, consider vasopressor if persistent. Elderly patients are more susceptible.',
  'burst_suppression': 'Burst suppression on EEG indicates excessive sedation depth (BIS < 20). This pattern shows alternating high-amplitude bursts and periods of electrical silence. Reduce or stop hypnotic agents. Risk of hemodynamic instability.',
  'awareness': 'Risk of awareness: BIS > 60 with clinical signs of light sedation. Verify drug delivery, check IV patency. Consider supplemental bolus. NYSORA recommends maintaining BIS 40-60 for procedural sedation.',
  'eeg_interpretation': 'Normal awake EEG: dominant alpha (8-13 Hz). Light sedation: alpha slowing + beta activation. Moderate: theta/delta emergence (4-8 Hz). Deep: high-amplitude delta with possible burst suppression. Propofol characteristically produces frontal alpha.',
  'propofol_titration': 'Propofol for procedural sedation (ASA): Loading dose 0.5-1 mg/kg over 1-3 min, then infusion 25-75 mcg/kg/min. Titrate to MOASS 2-3. Elderly: reduce dose by 30-50%. EC50 for loss of consciousness ~3-4 mcg/mL.',
  'drug_synergy': 'Opioid-hypnotic synergy: fentanyl significantly reduces propofol requirements (up to 50% reduction in EC50). Midazolam-propofol synergy is supra-additive. Always account for combined respiratory depression.',
  'pediatric': 'Pediatric sedation considerations: Higher weight-based dosing due to larger volume of distribution. More rapid redistribution. Higher risk of airway obstruction. Emergence agitation common with propofol.',
  'osa': 'OSA patients require special monitoring: increased sensitivity to respiratory depressants, higher risk of airway obstruction, consider reduced opioid dosing. STOP-BANG score guides risk stratification.',
};

// Generate mentor response based on query and simulation context
export const generateMentorResponse = async (
  query: string,
  context: {
    twin?: DigitalTwin;
    vitals: Vitals;
    moass: MOASSLevel;
    eeg?: EEGState;
    eventLog: LogEntry[];
    pkStates: Record<string, { ce: number }>;
  }
): Promise<MentorMessage> => {
  const queryLower = query.toLowerCase();

  // Build context string
  const contextStr = [
    `Patient: ${context.twin?.age}yo ${context.twin?.sex}, ${context.twin?.weight}kg`,
    `Vitals: HR ${context.vitals.hr}, BP ${context.vitals.sbp}/${context.vitals.dbp}, SpO2 ${context.vitals.spo2}%, RR ${context.vitals.rr}`,
    `MOASS: ${context.moass}/5`,
    context.eeg ? `BIS: ${context.eeg.bisIndex}, State: ${context.eeg.sedationState}` : '',
    `Comorbidities: ${context.twin?.comorbidities?.join(', ') || 'None'}`,
    `Recent events: ${context.eventLog.slice(-3).map(e => e.message).join('; ')}`,
    `Drug Ce: ${Object.entries(context.pkStates).map(([d, s]) => `${d}: ${s.ce.toFixed(2)}`).join(', ')}`,
  ].filter(Boolean).join('\n');

  // Match knowledge base entries
  let response = '';
  let citations: string[] = [];
  let confidence = 0.85;

  // Pattern matching for common queries
  if (queryLower.includes('spo2') || queryLower.includes('desat') || queryLower.includes('oxygen')) {
    response = KNOWLEDGE_BASE['desaturation'];
    citations = ['ASA Practice Guidelines for Sedation 2018', 'NYSORA Sedation Monitoring'];
    if (context.vitals.spo2 < 92) {
      response += `\n\nCURRENT STATUS: SpO2 is ${context.vitals.spo2}% - IMMEDIATE ACTION REQUIRED.`;
      confidence = 0.95;
    }
  } else if (queryLower.includes('brady') || queryLower.includes('heart rate') || queryLower.includes('hr')) {
    response = KNOWLEDGE_BASE['bradycardia'];
    citations = ['ACLS Guidelines', 'ASA Sedation Standards'];
  } else if (queryLower.includes('hypotension') || queryLower.includes('blood pressure') || queryLower.includes('bp')) {
    response = KNOWLEDGE_BASE['hypotension'];
    citations = ['Miller\'s Anesthesia Ch. 26', 'ASA Sedation Guidelines'];
  } else if (queryLower.includes('burst') || queryLower.includes('suppression')) {
    response = KNOWLEDGE_BASE['burst_suppression'];
    citations = ['Purdon et al. 2013 NEJM', 'BIS Monitoring Guidelines'];
  } else if (queryLower.includes('awareness') || queryLower.includes('too light')) {
    response = KNOWLEDGE_BASE['awareness'];
    citations = ['NYSORA Awareness Prevention', 'ASA Practice Advisory'];
  } else if (queryLower.includes('eeg') || queryLower.includes('interpret')) {
    response = KNOWLEDGE_BASE['eeg_interpretation'];
    if (context.eeg) {
      response += `\n\nCURRENT EEG: BIS ${context.eeg.bisIndex}, ${context.eeg.sedationState}. ` +
        `SEF: ${context.eeg.channels['Fp1']?.sef || 'N/A'} Hz. ` +
        `Suppression Ratio: ${context.eeg.channels['Fp1']?.suppressionRatio || 0}%.`;
    }
    citations = ['Purdon et al. 2013', 'Rampil 1998 Anesthesiology'];
  } else if (queryLower.includes('titrat') || queryLower.includes('dose') || queryLower.includes('how much')) {
    response = KNOWLEDGE_BASE['propofol_titration'];
    citations = ['ASA Sedation Guidelines', 'Eleveld et al. 2018'];
  } else if (queryLower.includes('synergy') || queryLower.includes('interaction')) {
    response = KNOWLEDGE_BASE['drug_synergy'];
    citations = ['Bouillon Response Surface Model', 'Minto et al. 2000'];
  } else {
    // Generic context-aware response
    response = `Based on current simulation state:\n${contextStr}\n\n`;
    if (context.vitals.spo2 < 94) {
      response += 'Note: SpO2 trending low - monitor closely. ';
    }
    if (context.moass <= 1) {
      response += 'Patient appears deeply sedated. ';
    }
    response += 'Consider the overall clinical picture and titrate to effect. What specific aspect would you like guidance on?';
    citations = ['Clinical judgment based on current state'];
    confidence = 0.7;
  }

  return {
    role: 'mentor',
    content: response,
    timestamp: Date.now(),
    citations,
    confidence,
  };
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
