/**
 * src/ai/simMaster.ts
 * SimMaster - proactive AI observer that monitors simulator state
 * and produces on-screen annotations pointing to specific UI regions.
 * Uses Claude API with a specialized system prompt.
 */

import { ClaudeContext, streamClaude } from './claudeClient';
import { Vitals, MOASSLevel } from '../types';
import { EEGState } from '../engine/eegModel';

// ---------------------------------------------------------------------------
// Screen region map - annotatable UI targets
// ---------------------------------------------------------------------------
export interface ScreenRegion {
  id: string;
  label: string;
  selector: string;
  description: string;
}

export const SCREEN_REGIONS: Record<string, ScreenRegion> = {
  hr_display: {
    id: 'hr_display',
    label: 'Heart Rate',
    selector: '[data-region="hr"]',
    description: 'Heart rate display in monitor strip',
  },
  bp_display: {
    id: 'bp_display',
    label: 'Blood Pressure',
    selector: '[data-region="bp"]',
    description: 'Blood pressure display',
  },
  spo2_display: {
    id: 'spo2_display',
    label: 'SpO2',
    selector: '[data-region="spo2"]',
    description: 'Oxygen saturation display',
  },
  rr_display: {
    id: 'rr_display',
    label: 'Respiratory Rate',
    selector: '[data-region="rr"]',
    description: 'Respiratory rate display',
  },
  etco2_display: {
    id: 'etco2_display',
    label: 'EtCO2',
    selector: '[data-region="etco2"]',
    description: 'End-tidal CO2 display and waveform',
  },
  moass_gauge: {
    id: 'moass_gauge',
    label: 'MOASS Score',
    selector: '[data-region="moass"]',
    description: 'Central sedation depth gauge showing MOASS 0-5',
  },
  radar_chart: {
    id: 'radar_chart',
    label: 'Radar Display',
    selector: '[data-region="radar"]',
    description: 'Radar chart showing drug concentrations and physiologic axes',
  },
  propofol_ce: {
    id: 'propofol_ce',
    label: 'Propofol Ce',
    selector: '[data-region="propofol"]',
    description: 'Propofol effect-site concentration on radar',
  },
  fentanyl_ce: {
    id: 'fentanyl_ce',
    label: 'Fentanyl Ce',
    selector: '[data-region="fentanyl"]',
    description: 'Fentanyl effect-site concentration on radar',
  },
  midazolam_ce: {
    id: 'midazolam_ce',
    label: 'Midazolam Ce',
    selector: '[data-region="midazolam"]',
    description: 'Midazolam effect-site concentration on radar',
  },
  ketamine_ce: {
    id: 'ketamine_ce',
    label: 'Ketamine Ce',
    selector: '[data-region="ketamine"]',
    description: 'Ketamine effect-site concentration on radar',
  },
  ecg_trace: {
    id: 'ecg_trace',
    label: 'ECG Waveform',
    selector: '[data-region="ecg"]',
    description: 'ECG waveform trace in monitor strip',
  },
  pleth_trace: {
    id: 'pleth_trace',
    label: 'Pleth Waveform',
    selector: '[data-region="pleth"]',
    description: 'Plethysmograph waveform trace',
  },
  co2_trace: {
    id: 'co2_trace',
    label: 'CO2 Waveform',
    selector: '[data-region="co2"]',
    description: 'Capnography waveform trace',
  },
  drug_panel: {
    id: 'drug_panel',
    label: 'Drug Panel',
    selector: '[data-region="drugs"]',
    description: 'Left sidebar drug bolus controls',
  },
  event_log: {
    id: 'event_log',
    label: 'Event Log',
    selector: '[data-region="eventlog"]',
    description: 'Right sidebar event log timeline',
  },
  airway_panel: {
    id: 'airway_panel',
    label: 'Airway Controls',
    selector: '[data-region="airway"]',
    description: 'Airway and O2 intervention controls',
  },
};

// ---------------------------------------------------------------------------
// SimMaster annotation types
// ---------------------------------------------------------------------------
export interface SimMasterAnnotation {
  message: string;
  target: string; // key from SCREEN_REGIONS
  severity: 'info' | 'warning' | 'danger';
  action: 'highlight' | 'point' | 'pulse';
  timestamp: number;
}

// ---------------------------------------------------------------------------
// SimMaster system prompt
// ---------------------------------------------------------------------------
function buildSimMasterSystemPrompt(ctx: ClaudeContext): string {
  const regionList = Object.entries(SCREEN_REGIONS)
    .map(([key, r]) => `  ${key}: ${r.description}`)
    .join('\n');

  return `You are SimMaster, a proactive AI clinical observer embedded in SedSim.
You monitor the simulation in real time and point out clinically significant
events, trends, and teaching moments.

## Your role
- Act as an eagle-eyed attending watching over the student's shoulder
- Proactively flag concerning trends BEFORE they become emergencies
- Point to specific UI elements where the student should look
- Be brief: one observation per response (1-2 sentences max)
- Use clinical urgency language for dangerous situations

## Response format
Always respond with EXACTLY one JSON object (no markdown, no extra text):
{"message":"your observation","target":"region_key","severity":"info|warning|danger","action":"highlight|point|pulse"}

## Available screen targets
${regionList}

## Severity levels
- info: teaching moment, subtle finding, positive reinforcement
- warning: trending toward danger, requires attention soon
- danger: immediate patient safety concern, act now

## Action types
- highlight: gentle glow around the target element
- point: arrow pointing to the element
- pulse: urgent pulsing animation for critical findings

## Current simulation state
${buildSimMasterContext(ctx)}

Analyze the current state and provide ONE observation about the most
clinically significant finding. If everything is stable, provide a
teaching pearl relevant to the current drug concentrations or patient state.`;
}

function buildSimMasterContext(ctx: ClaudeContext): string {
  const lines: string[] = [];
  if (ctx.patient) {
    const p = ctx.patient;
    lines.push(`Patient: ${p.age}yo ${p.sex}, ${p.weight}kg, ASA ${p.asa}`);
    if (p.osa) lines.push('OSA: YES');
    if (p.comorbidities.length)
      lines.push(`Comorbidities: ${p.comorbidities.join(', ')}`);
  }
  lines.push(
    `Vitals: HR ${ctx.vitals.hr}, BP ${ctx.vitals.sbp}/${ctx.vitals.dbp}, ` +
    `SpO2 ${ctx.vitals.spo2}%, RR ${ctx.vitals.rr}, EtCO2 ${ctx.vitals.etco2}`
  );
  lines.push(`MOASS: ${ctx.moass}/5`);
  if (ctx.eeg) lines.push(`BIS: ${ctx.eeg.bisIndex}`);
  const ceEntries = Object.entries(ctx.pkStates)
    .filter(([, s]) => s.ce > 0)
    .map(([d, s]) => `${d}: ${s.ce.toFixed(3)}`);
  if (ceEntries.length) lines.push(`Ce: ${ceEntries.join(', ')}`);
  if (ctx.recentEvents?.length)
    lines.push(`Events: ${ctx.recentEvents.slice(-3).join('; ')}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Significant change detection
// ---------------------------------------------------------------------------
interface SimSnapshot {
  vitals: Vitals;
  moass: MOASSLevel;
  eeg?: EEGState;
  pkStates: Record<string, { ce: number }>;
}

let lastSnapshot: SimSnapshot | null = null;

export function hasSignificantChange(current: SimSnapshot): boolean {
  if (!lastSnapshot) {
    lastSnapshot = current;
    return true;
  }
  const prev = lastSnapshot;
  const changed =
    Math.abs(current.vitals.hr - prev.vitals.hr) > 10 ||
    Math.abs(current.vitals.spo2 - prev.vitals.spo2) > 3 ||
    Math.abs(current.vitals.sbp - prev.vitals.sbp) > 15 ||
    Math.abs(current.vitals.rr - prev.vitals.rr) > 4 ||
    current.moass !== prev.moass ||
    current.vitals.spo2 < 92 ||
    current.vitals.hr < 50 ||
    current.vitals.sbp < 85 ||
    current.vitals.rr <= 6;
  lastSnapshot = current;
  return changed;
}

// ---------------------------------------------------------------------------
// Query SimMaster via Claude API
// ---------------------------------------------------------------------------
export async function querySimMaster(
  ctx: ClaudeContext,
  signal?: AbortSignal
): Promise<SimMasterAnnotation | null> {
  try {
    let fullText = '';
    await streamClaude(
      'Analyze the current simulation state and provide one observation.',
      { ...ctx, _systemOverride: buildSimMasterSystemPrompt(ctx) } as any,
      (chunk) => { fullText += chunk; },
      signal
    );
    // Parse the JSON response
    const jsonMatch = fullText.match(/\{[^}]+\}/);
    if (!jsonMatch) return fallbackAnnotation(ctx);
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.message || !parsed.target) return fallbackAnnotation(ctx);
    return {
      message: parsed.message,
      target: parsed.target in SCREEN_REGIONS ? parsed.target : 'moass_gauge',
      severity: ['info', 'warning', 'danger'].includes(parsed.severity) ? parsed.severity : 'info',
      action: ['highlight', 'point', 'pulse'].includes(parsed.action) ? parsed.action : 'highlight',
      timestamp: Date.now(),
    };
  } catch {
    return fallbackAnnotation(ctx);
  }
}

// ---------------------------------------------------------------------------
// Offline fallback - rule-based annotations
// ---------------------------------------------------------------------------
function fallbackAnnotation(ctx: ClaudeContext): SimMasterAnnotation {
  if (ctx.vitals.spo2 < 90) {
    return {
      message: `SpO2 critically low at ${ctx.vitals.spo2}%. Increase O2, jaw thrust, check airway.`,
      target: 'spo2_display',
      severity: 'danger',
      action: 'pulse',
      timestamp: Date.now(),
    };
  }
  if (ctx.vitals.sbp < 80) {
    return {
      message: `Hypotension: BP ${ctx.vitals.sbp}/${ctx.vitals.dbp}. Consider fluid bolus.`,
      target: 'bp_display',
      severity: 'danger',
      action: 'pulse',
      timestamp: Date.now(),
    };
  }
  if (ctx.vitals.hr < 45) {
    return {
      message: `Bradycardia HR ${ctx.vitals.hr}. Consider atropine if symptomatic.`,
      target: 'hr_display',
      severity: 'warning',
      action: 'point',
      timestamp: Date.now(),
    };
  }
  if (ctx.vitals.rr <= 6) {
    return {
      message: `Respiratory depression: RR ${ctx.vitals.rr}. Assess opioid load.`,
      target: 'rr_display',
      severity: 'danger',
      action: 'pulse',
      timestamp: Date.now(),
    };
  }
  if (ctx.vitals.spo2 < 94) {
    return {
      message: `SpO2 trending down to ${ctx.vitals.spo2}%. Monitor closely.`,
      target: 'spo2_display',
      severity: 'warning',
      action: 'highlight',
      timestamp: Date.now(),
    };
  }
  return {
    message: `MOASS ${ctx.moass}/5. Current vitals stable. Continue monitoring.`,
    target: 'moass_gauge',
    severity: 'info',
    action: 'highlight',
    timestamp: Date.now(),
  };
}

export default {
  querySimMaster,
  hasSignificantChange,
  SCREEN_REGIONS,
  fallbackAnnotation,
};
