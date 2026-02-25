/**
 * src/ai/simMasterPrompt.ts
 * SimMaster v3 — Claude system prompt establishing SimMaster as an active
 * teaching companion who narrates real-time physiology, directs learners to
 * specific visualization panels, asks Socratic questions, and adapts to
 * learner level.
 */

import { ClaudeContext } from './claudeClient';

// ---------------------------------------------------------------------------
// Full panel inventory available in SedSim
// ---------------------------------------------------------------------------

export const PANEL_INVENTORY = `
## Available Visualization Panels in SedSim

1. **Monitor** — vital signs waveforms (ECG, pleth, capno), numeric readouts for HR, SpO2, BP, RR, EtCO2
2. **EEG Panel** (sidebar tab "EEG") — BIS index, DSA spectrogram, sedation state, suppression ratio, dominant frequency
3. **Avatar View** (gauge mode "AVATAR") — physiological avatar showing skin tone (normal/pale/cyanotic), chest rise matching RR, pupil dilation reflecting sedation depth, diaphoresis
4. **Radar View** (gauge mode "RADAR") — spider chart with 8 axes: Sedation, HR, SpO2, EtCO2, RR, MAP, Drug Effect, Risk
5. **Petals View** (gauge mode "PETALS") — flower petals for propofol/midazolam/fentanyl/ketamine showing Ce, safety halo ring, synergy badge
6. **EchoSim** (sidebar tab "Echo") — real-time echocardiogram simulation, EF%, mitral valve motion, cardiac output, E/A ratio, preload/afterload/contractility
7. **Frank-Starling Curve** (sidebar tab "F-S") — PV loop with ESPVR slope (Ees = contractility), operating point (VEDV, VESV), stroke volume, effect of preload/afterload changes
8. **O2-Hb Curve** (sidebar tab "O2-Hb") — oxygen-hemoglobin dissociation curve, current operating point (SpO2 vs PaO2), P50, right/left shift from pH/CO2/temperature
9. **Drug Panel** — bolus and infusion controls, ghost dose preview showing predicted Ce trajectory
10. **Trend Graph** — 10-minute history of vitals, Ce, MOASS
11. **Learning Panel** (sidebar tab "Learn") — scored quiz questions, session performance metrics
12. **Risk Metrics** (in EEG tab) — Digital Twin predictions: hypotension risk %, desaturation risk %, awareness risk %, arrhythmia risk %, time to emergence
13. **Emergency Drugs** — rapid-access panel for crash drugs (epinephrine, atropine, naloxone, flumazenil)
14. **Sedation Gauge** (center screen) — MOASS 0-5 with color coding, drug effect arc, mode selector (Avatar/Radar/Petals)
`;

// ---------------------------------------------------------------------------
// SimMaster system prompt builder
// ---------------------------------------------------------------------------

export function buildSimMasterSystemPrompt(
  ctx: ClaudeContext & {
    learnerLevel?: 'novice' | 'intermediate' | 'advanced';
    recentEvents?: string[];
    activeTab?: string;
    activeGaugeMode?: string;
  }
): string {
  const level = ctx.learnerLevel ?? 'intermediate';
  const levelDesc =
    level === 'novice'
      ? 'a nursing student or trainee with basic anatomy knowledge but limited pharmacology'
      : level === 'advanced'
      ? 'an experienced anesthesiologist or intensivist who understands PK/PD modeling'
      : 'a resident or nurse anesthetist with 1-2 years of sedation experience';

  const vitals = ctx.vitals;
  const moass = ctx.moass;
  const eeg = ctx.eeg;

  // Build current state summary
  const activeTabDesc = ctx.activeTab ? `The learner currently has the "${ctx.activeTab}" panel open.` : 'No panel is currently open.';
  const gaugeModeDesc = ctx.activeGaugeMode ? `The center gauge is showing "${ctx.activeGaugeMode}" mode.` : '';

  const drugCeEntries = Object.entries(ctx.pkStates)
    .filter(([, s]) => s.ce > 0.001)
    .map(([d, s]) => `${d} Ce ${s.ce.toFixed(3)} mcg/mL`)
    .join(', ');

  const eegDesc = eeg
    ? `BIS ${eeg.bisIndex.toFixed(0)}, sedation state: ${eeg.sedationState}, suppression ratio: ${(eeg.channels?.['Fp1']?.suppressionRatio ?? 0).toFixed(1)}%`
    : 'EEG not available';

  return `You are SimMaster, a proactive AI teaching companion integrated into SedSim — a real-time pharmacokinetic sedation simulator used for medical education.

## Your Role and Personality
You are NOT a passive alarm system. You are an ACTIVE teacher and sports commentator for the simulation. You:
1. **Narrate** what is happening in real-time, connecting drug actions to displayed physiology
2. **Direct attention** to specific visualization panels the learner should look at RIGHT NOW
3. **Ask Socratic questions** to deepen understanding
4. **Adapt** your language and complexity to the learner's level
5. **Connect** pharmacology → physiology → visualization → clinical action

You are distinct from "Millie" (the conversational chat mentor). You are proactive — you initiate commentary, you don't wait to be asked.

## Learner Level
The current learner is ${levelDesc}. Adjust your vocabulary, depth of explanation, and question difficulty accordingly.
${level === 'novice' ? 'Use simple analogies, avoid jargon, reference visual indicators ("look at the red number on the monitor").' : ''}
${level === 'advanced' ? 'Use precise pharmacological terminology, discuss PK/PD parameters directly, challenge with edge cases.' : ''}

## Current Simulation State
- **Vitals**: HR ${Math.round(vitals.hr)} bpm, SpO2 ${Math.round(vitals.spo2)}%, BP ${Math.round(vitals.sbp)}/${Math.round(vitals.dbp ?? 0)} mmHg, RR ${Math.round(vitals.rr)}/min, EtCO2 ${Math.round(vitals.etco2)} mmHg
- **Sedation depth**: MOASS ${moass}/5
- **EEG**: ${eegDesc}
- **Active drugs**: ${drugCeEntries || 'none'}
- **Active panel**: ${activeTabDesc} ${gaugeModeDesc}
- **Recent events**: ${ctx.recentEvents?.join('; ') || 'none'}

${PANEL_INVENTORY}

## Response Format
- Keep responses under 120 words unless explaining a complex concept
- When directing to a panel, use **bold panel name** and explain what to look for
- When asking a question, end with "?" and wait for learner response
- When evaluating answers, be encouraging but precise about clinical accuracy
- Use exact parameter values from the current simulation state when relevant
- Never make up drug doses or clinical values — use what's shown in the simulation

## Critical Rule
You exist to TEACH, not to alarm. Focus on the WHY behind what's happening, not just the WHAT. 
Every observation should connect to a learning objective.`;
}

// ---------------------------------------------------------------------------
// Question bank (offline fallback when Claude API is unavailable)
// ---------------------------------------------------------------------------

export interface SocraticQuestion {
  id: string;
  trigger: string; // event type that triggers this question
  question: string;
  expectedTopics: string[];
  difficulty: 'novice' | 'intermediate' | 'advanced';
  targetPanel?: string;
}

export const QUESTION_BANK: SocraticQuestion[] = [
  {
    id: 'drug_onset_propofol',
    trigger: 'drug_onset',
    question: 'Propofol is reaching the effect site. What Ce do you expect at peak, and what MOASS level should the patient reach?',
    expectedTopics: ['Ce trajectory', 'EC50', 'MOASS', 'redistribution'],
    difficulty: 'intermediate',
    targetPanel: 'petals',
  },
  {
    id: 'drug_onset_fentanyl',
    trigger: 'drug_onset',
    question: 'Fentanyl is equilibrating at the effect site. Why does opioid pretreatment reduce the propofol dose needed for sedation?',
    expectedTopics: ['synergy', 'opioid-hypnotic interaction', 'EC50 reduction'],
    difficulty: 'intermediate',
    targetPanel: 'petals',
  },
  {
    id: 'desaturation_cascade',
    trigger: 'desaturation_cascade',
    question: "SpO2 is dropping to {spo2}%. Explain the physiological cascade connecting propofol's CNS depression to falling SpO2. What would you do first?",
    expectedTopics: ['respiratory depression', 'airway obstruction', 'jaw thrust', 'FiO2'],
    difficulty: 'intermediate',
    targetPanel: 'oxyhb',
  },
  {
    id: 'eeg_burst_suppression',
    trigger: 'eeg_transition',
    question: 'BIS dropped below 40. What does burst suppression mean physiologically? Is this appropriate for procedural sedation?',
    expectedTopics: ['burst suppression', 'electrical silence', 'oversedation', 'BIS target range'],
    difficulty: 'intermediate',
    targetPanel: 'eeg',
  },
  {
    id: 'frank_starling_fluid',
    trigger: 'frank_starling_shift',
    question: 'A fluid bolus is increasing preload. Looking at the Frank-Starling curve, what happens to stroke volume as VEDV increases? Is there a limit?',
    expectedTopics: ['preload', 'stroke volume', 'Frank-Starling law', 'VEDV', 'wall stress'],
    difficulty: 'advanced',
    targetPanel: 'frank_starling',
  },
  {
    id: 'synergy_developing',
    trigger: 'synergy_developing',
    question: 'Combined drug effect is {combinedEff}%. When two sedatives are combined, the effect is often greater than additive. What term describes this? Why is it clinically important?',
    expectedTopics: ['synergy', 'supra-additive', 'Bouillon response surface', 'dose reduction'],
    difficulty: 'intermediate',
    targetPanel: 'petals',
  },
  {
    id: 'stable_sedation_depth',
    trigger: 'nothing_happening',
    question: 'Patient is stable at MOASS {moass} for several minutes. If a painful procedure started now, is this sedation depth adequate? What signs indicate more or less sedation?',
    expectedTopics: ['MOASS scale', 'procedural sedation depth', 'movement on stimulation', 'BIS target'],
    difficulty: 'novice',
    targetPanel: 'monitor',
  },
  {
    id: 'rhythm_change',
    trigger: 'rhythm_change',
    question: 'A rhythm change was just detected. Looking at the ECG trace on the monitor, what features help you distinguish a benign from a dangerous arrhythmia?',
    expectedTopics: ['QRS width', 'rate', 'regularity', 'P waves', 'ACLS'],
    difficulty: 'intermediate',
    targetPanel: 'monitor',
  },
  {
    id: 'oxyhb_shift',
    trigger: 'oxyhb_curve_shift',
    question: "The O2-Hb curve's operating point shifted. A rising EtCO2 causes a right shift in the dissociation curve. What does this mean for oxygen delivery to tissues?",
    expectedTopics: ['Bohr effect', 'P50', 'oxygen delivery', 'respiratory acidosis'],
    difficulty: 'advanced',
    targetPanel: 'oxyhb',
  },
  {
    id: 'hemodynamic_compromise',
    trigger: 'hemodynamic_compromise',
    question: 'BP is falling. Propofol causes hypotension through two mechanisms. Can you name them? What intervention addresses each?',
    expectedTopics: ['vasodilation', 'myocardial depression', 'fluid bolus', 'vasopressors', 'dose reduction'],
    difficulty: 'intermediate',
    targetPanel: 'frank_starling',
  },
];

export function getQuestionForEvent(
  eventType: string,
  level: 'novice' | 'intermediate' | 'advanced'
): SocraticQuestion | null {
  const candidates = QUESTION_BANK.filter(
    q => q.trigger === eventType && q.difficulty === level
  );
  if (candidates.length === 0) {
    // Fall back to any difficulty matching the event
    const any = QUESTION_BANK.filter(q => q.trigger === eventType);
    if (any.length === 0) return null;
    return any[Math.floor(Math.random() * any.length)];
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}
