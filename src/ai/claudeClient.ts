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
  pkStates: Record<string, { ce: number }>;
  elapsedSeconds?: number;
  learnerLevel?: 'novice' | 'intermediate' | 'advanced';
  recentEvents?: string[];
}

// ---------------------------------------------------------------------------
// Knowledge base (offline fallback — kept from mentor.ts)
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
};

// ---------------------------------------------------------------------------
// Simple response cache (query → response text)
// ---------------------------------------------------------------------------

const responseCache = new Map<string, string>();

// ---------------------------------------------------------------------------
// Build system prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(ctx: ClaudeContext): string {
  const level = ctx.learnerLevel ?? 'intermediate';
  return `You are an expert AI mentor embedded in SedSim, a real-time IV procedural sedation simulator.
You are acting as a virtual attending anesthesiologist / sedation specialist who teaches ${level}-level clinicians.

## Pharmacology knowledge base
- 3-compartment Marsh/Schnider PK models for all IV drugs (propofol, midazolam, fentanyl, ketamine, dexmedetomidine)
- MOASS (Modified Observer's Assessment of Alertness/Sedation) scale 0-5 (0=unresponsive, 5=fully awake)
- BIS index 0-100 (target 40-60 for procedural sedation)
- ASA sedation guidelines, NYSORA, Miller's Anesthesia, Eleveld model, Bouillon response surface
- All drug delivery is INTRAVENOUS (IV); no subcutaneous/oral routes in this simulator

## Teaching style
- Adapt explanation depth to ${level} level
- For novice: use analogies and simple cause-effect chains
- For intermediate: include pharmacokinetic reasoning (Ce, EC50, ke0)
- For advanced: discuss response surfaces, individual variability, Schnider vs Marsh differences
- Always reference the specific patient's characteristics when relevant
- Be concise but complete (2-4 sentences unless a detailed explanation is requested)
- Cite guidelines when giving clinical recommendations

## Current simulation context
${buildContextString(ctx)}

Respond only to the user's question/request. Do not repeat the context back unless directly relevant.`;
}

function buildContextString(ctx: ClaudeContext): string {
  const lines: string[] = [];
  if (ctx.patient) {
    const { age, weight, sex, asa, comorbidities, mallampati, osa, drugSensitivity } = ctx.patient;
    lines.push(`Patient: ${age}yo ${sex}, ${weight}kg, ASA ${asa}`);
    if (mallampati) lines.push(`Mallampati: ${mallampati}`);
    if (osa) lines.push('OSA: YES — increased sensitivity to respiratory depressants');
    if (drugSensitivity && drugSensitivity !== 1.0) lines.push(`Drug sensitivity modifier: ${drugSensitivity.toFixed(2)}x`);
    if (comorbidities.length) lines.push(`Comorbidities: ${comorbidities.join(', ')}`);
  }
  lines.push(`Vitals: HR ${ctx.vitals.hr}, BP ${ctx.vitals.sbp}/${ctx.vitals.dbp}, SpO2 ${ctx.vitals.spo2}%, RR ${ctx.vitals.rr}, EtCO2 ${ctx.vitals.etco2}`);
  lines.push(`MOASS: ${ctx.moass}/5`);
  if (ctx.eeg) lines.push(`EEG/BIS: ${ctx.eeg.bisIndex}, state: ${ctx.eeg.sedationState}`);
  const ceEntries = Object.entries(ctx.pkStates)
    .filter(([, s]) => s.ce > 0)
    .map(([d, s]) => `${d}: ${s.ce.toFixed(3)} mcg/mL`);
  if (ceEntries.length) lines.push(`Drug Ce: ${ceEntries.join(', ')}`);
  if (ctx.elapsedSeconds) lines.push(`Elapsed: ${Math.floor(ctx.elapsedSeconds / 60)}m${ctx.elapsedSeconds % 60}s`);
  if (ctx.recentEvents?.length) lines.push(`Recent events: ${ctx.recentEvents.slice(-3).join('; ')}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Offline fallback — pattern-match against KNOWLEDGE_BASE
// ---------------------------------------------------------------------------

export function offlineFallback(
  query: string,
  ctx: ClaudeContext
): { text: string; citations: string[]; confidence: number } {
  const q = query.toLowerCase();
  let entry: { text: string; citations: string[] } | undefined;

  if (q.includes('spo2') || q.includes('desat') || q.includes('oxygen')) entry = KNOWLEDGE_BASE['desaturation'];
  else if (q.includes('brady') || q.includes('heart rate') || q.includes(' hr')) entry = KNOWLEDGE_BASE['bradycardia'];
  else if (q.includes('hypotension') || q.includes('blood pressure') || q.includes(' bp')) entry = KNOWLEDGE_BASE['hypotension'];
  else if (q.includes('burst') || q.includes('suppression')) entry = KNOWLEDGE_BASE['burst_suppression'];
  else if (q.includes('awareness') || q.includes('too light')) entry = KNOWLEDGE_BASE['awareness'];
  else if (q.includes('eeg') || q.includes('interpret') || q.includes('bis')) entry = KNOWLEDGE_BASE['eeg_interpretation'];
  else if (q.includes('titrat') || q.includes('dose') || q.includes('how much')) entry = KNOWLEDGE_BASE['propofol_titration'];
  else if (q.includes('synergy') || q.includes('interaction')) entry = KNOWLEDGE_BASE['drug_synergy'];
  else if (q.includes('pediatric') || q.includes('child')) entry = KNOWLEDGE_BASE['pediatric'];
  else if (q.includes('osa') || q.includes('sleep apnea') || q.includes('apnoea')) entry = KNOWLEDGE_BASE['osa'];

  let text = entry?.text ?? '';
  let confidence = entry ? 0.85 : 0.65;

  // Append live context observations
  const extras: string[] = [];
  if (ctx.vitals.spo2 < 92) extras.push(`⚠ Current SpO2 ${ctx.vitals.spo2}% — IMMEDIATE ACTION REQUIRED.`);
  if (ctx.vitals.sbp < 85) extras.push(`⚠ BP ${ctx.vitals.sbp}/${ctx.vitals.dbp} — significant hypotension.`);
  if (ctx.vitals.hr < 45) extras.push(`⚠ HR ${ctx.vitals.hr} — symptomatic bradycardia threshold.`);
  if (ctx.eeg && ctx.eeg.bisIndex < 20) extras.push(`⚠ BIS ${ctx.eeg.bisIndex} — burst suppression detected.`);

  if (!text) {
    text = `Based on current state: MOASS ${ctx.moass}/5, ${ctx.vitals.spo2}% SpO2. `;
    if (ctx.vitals.spo2 < 94) text += 'Note: SpO2 trending low — monitor closely. ';
    if (ctx.moass <= 1) text += 'Patient deeply sedated. ';
    text += 'Consider the overall clinical picture and titrate to effect. What specific aspect would you like guidance on?';
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

/**
 * Stream a response from Claude.  Calls `onChunk` for each text delta and
 * resolves with the full accumulated text.  Throws on network/API errors so
 * callers can fall back to `offlineFallback`.
 */
export async function streamClaude(
  query: string,
  ctx: ClaudeContext,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) throw new Error('No API key');

  const cacheKey = `${query}|${ctx.moass}|${ctx.vitals.spo2}|${ctx.vitals.sbp}`;
  if (responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey)!;
    onChunk(cached);
    return cached;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      stream: true,
      system: buildSystemPrompt(ctx),
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
