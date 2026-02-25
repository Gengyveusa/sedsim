/**
 * src/ai/claudeClient.ts
 * Anthropic Claude API client with streaming support.
 * Falls back to the offline KNOWLEDGE_BASE when the API key is unavailable
 * or when the request fails.
 *
 * API key: set VITE_ANTHROPIC_API_KEY in your .env file.
 * All PK/PD models are IV (intravenous). Drug delivery uses 3-compartment
 * Marsh/Schnider models. MOASS scale 0-5.
 */

import { Vitals, MOASSLevel } from '../types';
import { EEGState } from '../engine/eegModel';
import { buildMillieSystemPrompt } from './milliePrompt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClaudeStreamChunk {
  type: 'content_block_delta' | 'message_stop' | 'error';
  delta?: { type: string; text: string };
  error?: { message: string };
}

export interface ClaudeContext {
  patient?: {
    age: number;
    weight: number;
    sex: string;
    asa: number;
    comorbidities: string[];
    mallampati?: number;
    osa?: boolean;
    drugSensitivity?: number;
  };
  vitals: Vitals;
  moass: MOASSLevel;
  eeg?: EEGState;
  pkStates: Record<string, { ce: number; cp?: number }>;
  elapsedSeconds?: number;
  _systemOverride?: string;
  learnerLevel?: 'novice' | 'intermediate' | 'advanced';
  recentEvents?: string[];
  activeTab?: string;
  activeGaugeMode?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Knowledge base (offline fallback)
// ---------------------------------------------------------------------------

export const KNOWLEDGE_BASE: Record<string, { text: string; citations: string[] }> = {
  desaturation: {
    text: 'Per ASA guidelines for sedation, SpO2 < 90% requires immediate intervention: increase FiO2, perform jaw thrust/chin lift, consider airway adjunct. If BVM ventilation needed, pause procedure. Risk factors include OSA, obesity, opioid synergy.',
    citations: ['ASA Practice Guidelines for Sedation 2018', 'NYSORA Sedation Monitoring'],
  },
  bradycardia: {
    text: 'Bradycardia during sedation commonly results from dexmedetomidine or high-dose opioids. Per ACLS: if symptomatic (HR < 50 with hypotension), consider atropine 0.5mg IV. Reduce or stop causative agent.',
    citations: ['ACLS Guidelines', 'ASA Sedation Standards'],
  },
  hypotension: {
    text: 'Propofol-induced hypotension is dose-dependent via vasodilation and myocardial depression. Manage with fluid bolus (250-500mL crystalloid), reduce infusion rate, consider vasopressor if persistent. Elderly patients are more susceptible.',
    citations: ["Miller's Anesthesia Ch. 26", 'ASA Sedation Guidelines'],
  },
  burst_suppression: {
    text: 'Burst suppression on EEG indicates excessive sedation depth (BIS < 20). This pattern shows alternating high-amplitude bursts and periods of electrical silence. Reduce or stop hypnotic agents. Risk of hemodynamic instability.',
    citations: ['Purdon et al. 2013 NEJM', 'BIS Monitoring Guidelines'],
  },
  awareness: {
    text: 'Risk of awareness: BIS > 60 with clinical signs of light sedation. Verify drug delivery, check IV patency. Consider supplemental bolus. NYSORA recommends maintaining BIS 40-60 for procedural sedation.',
    citations: ['NYSORA Awareness Prevention', 'ASA Practice Advisory'],
  },
  eeg_interpretation: {
    text: 'Normal awake EEG: dominant alpha (8-13 Hz). Light sedation: alpha slowing + beta activation. Moderate: theta/delta emergence (4-8 Hz). Deep: high-amplitude delta with possible burst suppression. Propofol characteristically produces frontal alpha.',
    citations: ['Purdon et al. 2013', 'Rampil 1998 Anesthesiology'],
  },
  propofol_titration: {
    text: 'Propofol for procedural sedation (ASA): Loading dose 0.5-1 mg/kg over 1-3 min, then infusion 25-75 mcg/kg/min. Titrate to MOASS 2-3. Elderly: reduce dose by 30-50%. EC50 for loss of consciousness ~3-4 mcg/mL.',
    citations: ['ASA Sedation Guidelines', 'Eleveld et al. 2018'],
  },
  drug_synergy: {
    text: 'Opioid-hypnotic synergy: fentanyl significantly reduces propofol requirements (up to 50% reduction in EC50). Midazolam-propofol synergy is supra-additive. Always account for combined respiratory depression.',
    citations: ['Bouillon Response Surface Model', 'Minto et al. 2000'],
  },
  pediatric: {
    text: 'Pediatric sedation considerations: Higher weight-based dosing due to larger volume of distribution. More rapid redistribution. Higher risk of airway obstruction. Emergence agitation common with propofol.',
    citations: ['Pediatric Sedation Guidelines AAP', 'Cravero et al. 2009'],
  },
  osa: {
    text: 'OSA patients require special monitoring: increased sensitivity to respiratory depressants, higher risk of airway obstruction, consider reduced opioid dosing. STOP-BANG score guides risk stratification.',
    citations: ['ASA OSA Perioperative Guidelines', 'STOP-BANG Scoring'],
  },
  arrhythmia: {
    text: 'Arrhythmias during sedation: Ventricular fibrillation (VF) and pulseless ventricular tachycardia (VT) require immediate defibrillation per ACLS. Junctional rhythms may occur with propofol. Torsades de pointes: give magnesium 2g IV. Check electrolytes, stop QT-prolonging agents.',
    citations: ['ACLS Guidelines 2020', 'AHA Arrhythmia Management'],
  },
  cardiac_arrest: {
    text: 'Cardiac arrest during sedation: Initiate CPR immediately. For VF/pulseless VT: defibrillate 200J biphasic. Epinephrine 1mg IV every 3-5 min. Amiodarone 300mg IV for refractory VF/VT. Address reversible causes (Hs and Ts). Drug-induced arrest: stop all sedatives.',
    citations: ['ACLS Guidelines 2020', 'AHA Emergency Cardiovascular Care'],
  },
  overdose: {
    text: 'Drug overdose during sedation: For opioid overdose, give naloxone 0.04-0.4mg IV titrated. For benzodiazepine overdose, give flumazenil 0.2mg IV. There is no specific reversal for propofol - supportive care with airway management. Monitor for resedation after reversal.',
    citations: ['ASA Sedation Rescue Guidelines', 'Toxicology references'],
  },
  crash: {
    text: 'Patient crashing during sedation: 1) Call for help. 2) Stop all sedative infusions. 3) Secure airway (jaw thrust, BVM, consider intubation). 4) Give 100% O2. 5) Fluid resuscitation. 6) Vasopressors if needed (ephedrine 5-10mg or phenylephrine 100mcg). 7) Follow ACLS if arrest.',
    citations: ['ASA Difficult Airway Algorithm', 'Emergency Sedation Response Protocol'],
  },
  airway: {
    text: 'Airway management during sedation: Start with chin lift/jaw thrust. If obstruction persists, insert oral or nasal airway. For severe obstruction, use LMA or endotracheal intubation. Always have suction ready. Position patient with head elevation.',
    citations: ['ASA Difficult Airway Algorithm', 'NYSORA Airway Management'],
  },
  naloxone: {
    text: 'Naloxone for opioid reversal: Start with 0.04mg IV (40mcg) to avoid complete reversal and rebound pain. Titrate every 2-3 min. Duration is shorter than most opioids, so monitor for resedation. Higher doses (0.4-2mg) for respiratory arrest.',
    citations: ['ACLS Guidelines', 'ASA Opioid Reversal'],
  },
  ketamine: {
    text: 'Ketamine is a dissociative anesthetic providing sedation, analgesia, and amnesia while preserving airway reflexes and respiratory drive. Dose: 0.5-1 mg/kg IV for sedation. Preserves hemodynamics via sympathetic stimulation. Watch for emergence reactions (treat with midazolam).',
    citations: ['Ketamine Clinical Guidelines', 'Green et al. Annals EM'],
  },
  dexmedetomidine: {
    text: 'Dexmedetomidine is a selective alpha-2 agonist providing sedation without significant respiratory depression. Load 1mcg/kg over 10 min, maintain 0.2-0.7 mcg/kg/hr. Causes bradycardia and hypotension. Unique "cooperative sedation" with arousable patient.',
    citations: ['Dexmedetomidine Package Insert', 'ASA Sedation Guidelines'],
  },
};

// ---------------------------------------------------------------------------
// Simple response cache (query -> response text)
// ---------------------------------------------------------------------------
const responseCache = new Map<string, string>();

// ---------------------------------------------------------------------------
// Offline fallback - enhanced pattern matching against KNOWLEDGE_BASE
// ---------------------------------------------------------------------------

export function offlineFallback(
  query: string,
  ctx: ClaudeContext
): { text: string; citations: string[]; confidence: number } {
  const q = query.toLowerCase();

  // Handle greetings
  const greetings = ['hello', 'hi', 'hey', 'help', 'what can you do', 'who are you'];
  if (greetings.some(g => q.includes(g))) {
    const moassDesc = ctx.moass <= 1 ? 'deeply sedated' : ctx.moass <= 3 ? 'moderately sedated' : 'lightly sedated or awake';
    return {
      text: `Hi! I'm Millie, your AI sedation mentor. The patient is currently ${moassDesc} (MOASS ${ctx.moass}/5) with SpO2 ${Math.round(ctx.vitals.spo2)}%, HR ${Math.round(ctx.vitals.hr)}, BP ${Math.round(ctx.vitals.sbp)}/${Math.round(ctx.vitals.dbp)}. Ask me about drug dosing, EEG interpretation, airway management, or any clinical concern.`,
      citations: ['Millie AI Mentor'],
      confidence: 0.9,
    };
  }

  // Pattern match to knowledge base entries
  let entry: { text: string; citations: string[] } | undefined;
  if (q.includes('spo2') || q.includes('desat') || q.includes('oxygen') || q.includes('hypox')) entry = KNOWLEDGE_BASE['desaturation'];
  else if (q.includes('brady') || (q.includes('heart') && q.includes('slow'))) entry = KNOWLEDGE_BASE['bradycardia'];
  else if (q.includes('hypotension') || q.includes('blood pressure') || q.includes('low bp') || q.includes('pressure drop')) entry = KNOWLEDGE_BASE['hypotension'];
  else if (q.includes('burst') || q.includes('suppression')) entry = KNOWLEDGE_BASE['burst_suppression'];
  else if (q.includes('awareness') || q.includes('too light') || q.includes('waking up')) entry = KNOWLEDGE_BASE['awareness'];
  else if (q.includes('eeg') || q.includes('interpret') || q.includes('bis') || q.includes('brain wave')) entry = KNOWLEDGE_BASE['eeg_interpretation'];
  else if (q.includes('titrat') || q.includes('dose') || q.includes('how much') || q.includes('bolus')) entry = KNOWLEDGE_BASE['propofol_titration'];
  else if (q.includes('synergy') || q.includes('interaction') || q.includes('combine')) entry = KNOWLEDGE_BASE['drug_synergy'];
  else if (q.includes('pediatric') || q.includes('child')) entry = KNOWLEDGE_BASE['pediatric'];
  else if (q.includes('osa') || q.includes('sleep apnea') || q.includes('apnoea') || q.includes('apnea')) entry = KNOWLEDGE_BASE['osa'];
  else if (q.includes('arrhyth') || q.includes('vfib') || q.includes('vtach') || q.includes('fibrillation') || q.includes('tachycardia') || q.includes('junctional') || q.includes('rhythm')) entry = KNOWLEDGE_BASE['arrhythmia'];
  else if (q.includes('arrest') || q.includes('cpr') || q.includes('code blue') || q.includes('pulseless') || q.includes('asystole')) entry = KNOWLEDGE_BASE['cardiac_arrest'];
  else if (q.includes('overdose') || q.includes('reversal') || q.includes('reverse') || q.includes('flumazenil')) entry = KNOWLEDGE_BASE['overdose'];
  else if (q.includes('crash') || q.includes('dying') || q.includes('emergency') || q.includes('resuscitat') || q.includes('save')) entry = KNOWLEDGE_BASE['crash'];
  else if (q.includes('airway') || q.includes('intubat') || q.includes('lma') || q.includes('jaw thrust') || q.includes('obstruct')) entry = KNOWLEDGE_BASE['airway'];
  else if (q.includes('naloxone') || q.includes('narcan')) entry = KNOWLEDGE_BASE['naloxone'];
  else if (q.includes('ketamine') || q.includes('dissociative')) entry = KNOWLEDGE_BASE['ketamine'];
  else if (q.includes('dexmedetomidine') || q.includes('precedex') || q.includes('dex ')) entry = KNOWLEDGE_BASE['dexmedetomidine'];

  let text = entry?.text ?? '';
  let confidence = entry ? 0.85 : 0.65;

  // Append live context observations for critical states
  const extras: string[] = [];
  if (ctx.vitals.spo2 < 92) extras.push(`Current SpO2 ${Math.round(ctx.vitals.spo2)}% -- IMMEDIATE ACTION REQUIRED.`);
  if (ctx.vitals.sbp < 85) extras.push(`BP ${Math.round(ctx.vitals.sbp)}/${Math.round(ctx.vitals.dbp)} -- significant hypotension.`);
  if (ctx.vitals.hr < 45) extras.push(`HR ${Math.round(ctx.vitals.hr)} -- symptomatic bradycardia threshold.`);
  if (ctx.vitals.hr > 130) extras.push(`HR ${Math.round(ctx.vitals.hr)} -- significant tachycardia.`);
  if (ctx.vitals.rr <= 4) extras.push(`RR ${Math.round(ctx.vitals.rr)} -- severe respiratory depression!`);
  if (ctx.eeg && ctx.eeg.bisIndex < 20) extras.push(`BIS ${Math.round(ctx.eeg.bisIndex)} -- burst suppression detected.`);

  if (!text) {
    // Build comprehensive context-aware response
    const parts: string[] = [];
    parts.push(`Current patient status: MOASS ${ctx.moass}/5, SpO2 ${Math.round(ctx.vitals.spo2)}%, HR ${Math.round(ctx.vitals.hr)}, BP ${Math.round(ctx.vitals.sbp)}/${Math.round(ctx.vitals.dbp)}, RR ${Math.round(ctx.vitals.rr)}, EtCO2 ${Math.round(ctx.vitals.etco2)}.`);
    if (ctx.eeg) parts.push(`EEG/BIS: ${Math.round(ctx.eeg.bisIndex)} (${ctx.eeg.sedationState}).`);
    const ceEntries = Object.entries(ctx.pkStates).filter(([, s]) => s.ce > 0).map(([d, s]) => `${d} Ce ${s.ce.toFixed(2)} mcg/mL`);
    if (ceEntries.length) parts.push(`Active drugs: ${ceEntries.join(', ')}.`);

    // Crisis detection - auto-match knowledge base when vitals are critical
    if (ctx.vitals.spo2 < 90) {
      parts.push(KNOWLEDGE_BASE['desaturation'].text);
      confidence = 0.85;
    } else if (ctx.vitals.hr < 45) {
      parts.push(KNOWLEDGE_BASE['bradycardia'].text);
      confidence = 0.85;
    } else if (ctx.vitals.sbp < 75) {
      parts.push(KNOWLEDGE_BASE['hypotension'].text);
      confidence = 0.85;
    } else if (ctx.vitals.rr <= 4) {
      parts.push('Severe respiratory depression detected. Consider naloxone if opioids are active, perform jaw thrust, prepare BVM ventilation.');
      confidence = 0.8;
    } else if (ctx.moass <= 1) {
      parts.push('The patient is deeply sedated (MOASS 0-1). Ensure airway patency, monitor for respiratory depression, and consider whether this depth is appropriate.');
    } else if (ctx.moass <= 3) {
      parts.push('Sedation depth is in the moderate range (MOASS 2-3), appropriate for procedural sedation. Continue monitoring.');
    } else if (ctx.moass >= 4) {
      parts.push('The patient is lightly sedated (MOASS 4-5). If deeper sedation is needed, consider titrating additional medication.');
    }

    if (parts.length <= 2 && extras.length === 0) {
      parts.push('All vitals are within acceptable ranges. Continue standard monitoring and titrate medications as needed. Ask me about specific drugs, dosing, EEG patterns, or clinical scenarios.');
    }
    text = parts.join(' ');
    if (!confidence || confidence < 0.7) confidence = 0.75;
  }

  if (extras.length) {
    text += '\n\n' + extras.join(' ');
    confidence = Math.min(0.95, confidence + 0.05 * extras.length);
  }

  return { text, citations: entry?.citations ?? ['Clinical judgment based on current state'], confidence };
}

// ---------------------------------------------------------------------------
// Claude API streaming call
// ---------------------------------------------------------------------------

export async function streamClaude(
  query: string,
  ctx: ClaudeContext,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  const proxyUrl = import.meta.env.VITE_CLAUDE_PROXY_URL as string | undefined;
  const useProxy = !!proxyUrl;
  const endpoint = proxyUrl || 'https://api.anthropic.com/v1/messages';

  if (!useProxy && !apiKey) throw new Error('No API key');

  const cacheKey = `${query}|${ctx.moass}|${Math.round(ctx.vitals.spo2)}|${Math.round(ctx.vitals.sbp)}`;
  if (responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey)!;
    onChunk(cached);
    return cached;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(useProxy ? {} : { 'x-api-key': apiKey!, 'anthropic-version': '2023-06-01' }),
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      stream: true,
      system: ctx._systemOverride || buildMillieSystemPrompt(ctx),
      messages: [{ role: 'user', content: query }],
    }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') break;
      try {
        const parsed: ClaudeStreamChunk = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          fullText += parsed.delta.text;
          onChunk(parsed.delta.text);
        }
      } catch {
        // ignore parse errors on SSE metadata lines
      }
    }
  }

  // Cache up to 50 entries
  if (responseCache.size >= 50) responseCache.delete(responseCache.keys().next().value!);
  if (fullText) responseCache.set(cacheKey, fullText);

  return fullText;
}
