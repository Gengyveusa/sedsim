/**
 * src/ai/simMaster.ts
 * SimMaster v3 — Active AI Teaching Companion
 *
 * Replaces the passive vital-sign alarm panel with a pedagogically-oriented
 * event detection + action generation engine. Consumes the full simulation
 * state, detects clinical/educational events, and generates SimMasterAction
 * objects that drive the overlay UI (narration, panel pointers, questions).
 */

import { Vitals, MOASSLevel, Patient } from '../types';
import { EEGState } from '../engine/eegModel';

// ---------------------------------------------------------------------------
// Re-export legacy types for backward compatibility
// ---------------------------------------------------------------------------

export type ClinicalStatus = 'normal' | 'warning' | 'danger' | 'critical';

export interface ScreenRegion {
  id: string;
  label: string;
  selector: string;
  description: string;
}

export const SCREEN_REGIONS: Record<string, ScreenRegion> = {
  hr_display:   { id: 'hr_display',   label: 'Heart Rate',      selector: '[data-region="hr"]',    description: 'Heart rate display' },
  bp_display:   { id: 'bp_display',   label: 'Blood Pressure',  selector: '[data-region="bp"]',    description: 'Blood pressure display' },
  spo2_display: { id: 'spo2_display', label: 'SpO2',            selector: '[data-region="spo2"]',  description: 'Oxygen saturation' },
  rr_display:   { id: 'rr_display',   label: 'Resp Rate',       selector: '[data-region="rr"]',    description: 'Respiratory rate' },
  etco2_display:{ id: 'etco2_display',label: 'EtCO2',           selector: '[data-region="etco2"]', description: 'End-tidal CO2' },
  moass_gauge:  { id: 'moass_gauge',  label: 'MOASS',            selector: '[data-region="moass"]', description: 'Sedation depth gauge' },
  radar_chart:  { id: 'radar_chart',  label: 'Radar',            selector: '[data-region="radar"]', description: 'Drug concentration radar' },
  ecg_trace:    { id: 'ecg_trace',    label: 'ECG',              selector: '[data-region="ecg"]',   description: 'ECG waveform' },
  drug_panel:   { id: 'drug_panel',   label: 'Drug Panel',       selector: '[data-region="drugs"]', description: 'Drug bolus controls' },
};

export interface ClinicalRange {
  label: string;
  unit: string;
  normal: [number, number];
  warning_low?: number;
  warning_high?: number;
  danger_low?: number;
  danger_high?: number;
  critical_low?: number;
  critical_high?: number;
}

export const CLINICAL_RANGES: Record<string, ClinicalRange> = {
  hr: {
    label: 'Heart Rate', unit: 'bpm',
    normal: [60, 100],
    warning_low: 50, warning_high: 110,
    danger_low: 40, danger_high: 130,
    critical_low: 30, critical_high: 150,
  },
  spo2: {
    label: 'SpO2', unit: '%',
    normal: [95, 100],
    warning_low: 92,
    danger_low: 88,
    critical_low: 80,
  },
  sbp: {
    label: 'Systolic BP', unit: 'mmHg',
    normal: [90, 140],
    warning_low: 85, warning_high: 160,
    danger_low: 75, danger_high: 180,
    critical_low: 60, critical_high: 200,
  },
  rr: {
    label: 'Resp Rate', unit: '/min',
    normal: [10, 20],
    warning_low: 8, warning_high: 24,
    danger_low: 5, danger_high: 30,
    critical_low: 0, critical_high: 40,
  },
  etco2: {
    label: 'EtCO2', unit: 'mmHg',
    normal: [35, 45],
    warning_low: 30, warning_high: 50,
    danger_low: 20, danger_high: 60,
    critical_low: 10, critical_high: 80,
  },
  moass: {
    label: 'MOASS', unit: '/5',
    normal: [2, 5],
    warning_low: 1,
    danger_low: 0,
    critical_low: 0,
  },
  bis: {
    label: 'BIS Index', unit: '',
    normal: [40, 100],
    warning_low: 30,
    danger_low: 20,
    critical_low: 10,
  },
};

export function assessParam(key: string, value: number): ClinicalStatus {
  const r = CLINICAL_RANGES[key];
  if (!r) return 'normal';
  if (r.critical_low !== undefined && value <= r.critical_low) return 'critical';
  if (r.critical_high !== undefined && value >= r.critical_high) return 'critical';
  if (r.danger_low !== undefined && value <= r.danger_low) return 'danger';
  if (r.danger_high !== undefined && value >= r.danger_high) return 'danger';
  if (r.warning_low !== undefined && value <= r.warning_low) return 'warning';
  if (r.warning_high !== undefined && value >= r.warning_high) return 'warning';
  if (value >= r.normal[0] && value <= r.normal[1]) return 'normal';
  return 'warning';
}

export interface VitalAssessment {
  param: string;
  value: number;
  status: ClinicalStatus;
  label: string;
  unit: string;
}

function rv(v: number, decimals = 0): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

export function assessAllVitals(
  vitals: Vitals,
  moass: MOASSLevel,
  eeg?: EEGState,
  _pkStates?: Record<string, { ce: number }>
): VitalAssessment[] {
  const results: VitalAssessment[] = [
    { param: 'hr',   value: rv(vitals.hr),   status: assessParam('hr', vitals.hr),     label: 'HR',    unit: 'bpm' },
    { param: 'spo2', value: rv(vitals.spo2),  status: assessParam('spo2', vitals.spo2), label: 'SpO2',  unit: '%' },
    { param: 'sbp',  value: rv(vitals.sbp),   status: assessParam('sbp', vitals.sbp),   label: 'SBP',   unit: 'mmHg' },
    { param: 'rr',   value: rv(vitals.rr),    status: assessParam('rr', vitals.rr),     label: 'RR',    unit: '/min' },
    { param: 'etco2',value: rv(vitals.etco2), status: assessParam('etco2', vitals.etco2),label: 'EtCO2', unit: 'mmHg' },
    { param: 'moass',value: moass,            status: assessParam('moass', moass),       label: 'MOASS', unit: '/5' },
  ];
  if (eeg) {
    results.push({ param: 'bis', value: rv(eeg.bisIndex), status: assessParam('bis', eeg.bisIndex), label: 'BIS', unit: '' });
  }
  return results;
}

// Legacy annotation type (kept for backward compat with SimMasterOverlay v2)
export interface SimMasterAnnotation {
  message: string;
  target: string;
  severity: 'info' | 'warning' | 'danger';
  action: 'highlight' | 'point' | 'pulse';
  timestamp: number;
}

// ---------------------------------------------------------------------------
// NEW v3: SimMasterAction — richer action type driving the new overlay
// ---------------------------------------------------------------------------

export type SimMasterActionType =
  | 'narrate'
  | 'direct_attention'
  | 'ask_question'
  | 'explain'
  | 'suggest_action'
  | 'quiz';

export type SimMasterTargetPanel =
  | 'monitor'
  | 'avatar'
  | 'radar'
  | 'petals'
  | 'eeg'
  | 'echo'
  | 'frank_starling'
  | 'oxyhb'
  | 'drug_panel'
  | 'trends'
  | 'ghost_dose'
  | 'sedation_gauge'
  | 'risk_metrics'
  | 'emergency_drugs'
  | 'iv_fluids'
  | 'airway'
  | 'learning_panel';

export interface SimMasterAction {
  type: SimMasterActionType;
  message: string;
  targetPanel?: SimMasterTargetPanel;
  openTab?: boolean;           // should SimMaster auto-open this sidebar tab?
  switchGauge?: string;        // should SimMaster switch the gauge mode?
  highlightSelector?: string;
  question?: string;
  expectedTopics?: string[];
  priority: number;            // higher = more important (shown first)
  displayDuration: number;     // ms to display this action
  requiresUserResponse?: boolean;
  eventType?: string;          // which event triggered this action
}

// ---------------------------------------------------------------------------
// NEW v3: Full simulation context
// ---------------------------------------------------------------------------

export interface SimMasterContext {
  // Patient
  patient: Patient;
  // Vitals & physiology
  vitals: Vitals;
  moass: MOASSLevel;
  combinedEff: number;
  emergencyState?: {
    level: 'normal' | 'warning' | 'critical' | 'arrest';
    isArrest: boolean;
  };
  activeAlarms: { type: string; message: string; severity: 'warning' | 'danger' }[];
  // Drug state
  pkStates: Record<string, { ce: number; cp?: number }>;
  infusions: Record<string, { rate: number; isRunning: boolean }>;
  // Visualization state
  eegState?: EEGState | null;
  frankStarlingPoint?: { vedv: number; vesv: number; sv: number; ef: number; ees: number } | null;
  oxyHbPoint?: { p50: number; paco2: number; pH: number } | null;
  // User behavior
  activeTab?: string;
  activeGaugeMode?: string;
  lastDrugAdministered?: { name: string; dose: number; timestamp: number } | null;
  lastInterventionApplied?: string | null;
  elapsedSeconds: number;
  simSpeed: number;
  userIdleSeconds: number;
  drugsAdministeredCount?: number;
  scenarioActive?: boolean;
}

// ---------------------------------------------------------------------------
// Event detection types
// ---------------------------------------------------------------------------

export type SimMasterEventType =
  | 'drug_onset'
  | 'drug_peak'
  | 'drug_wearing_off'
  | 'synergy_developing'
  | 'intervention_applied'
  | 'sedation_deepening'
  | 'sedation_lightening'
  | 'vital_trend'
  | 'eeg_transition'
  | 'rhythm_change'
  | 'desaturation_cascade'
  | 'hemodynamic_compromise'
  | 'frank_starling_shift'
  | 'oxyhb_curve_shift'
  | 'user_idle'
  | 'nothing_happening'
  | 'scenario_checkpoint';

export interface SimMasterEvent {
  type: SimMasterEventType;
  data: Record<string, unknown>;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Internal state for event detection (module-level)
// ---------------------------------------------------------------------------

interface DetectionState {
  prevMoass: MOASSLevel;
  prevVitals: Vitals;
  prevCe: Record<string, number>;
  prevEegState: string; // sedationState string
  prevRhythm: string;
  prevCombinedEff: number;
  lastEventTimes: Partial<Record<SimMasterEventType, number>>;
  lastSocraticTime: number;
  prevIntervention: string | null;
  prevP50: number;
}

let detectionState: DetectionState | null = null;

function initDetectionState(ctx: SimMasterContext): DetectionState {
  return {
    prevMoass: ctx.moass,
    prevVitals: { ...ctx.vitals },
    prevCe: Object.fromEntries(Object.entries(ctx.pkStates).map(([k, v]) => [k, v.ce])),
    prevEegState: ctx.eegState?.sedationState ?? 'awake',
    prevRhythm: ctx.vitals.rhythm ?? 'normal_sinus',
    prevCombinedEff: ctx.combinedEff,
    lastEventTimes: {},
    lastSocraticTime: 0,
    prevIntervention: ctx.lastInterventionApplied ?? null,
    prevP50: ctx.oxyHbPoint?.p50 ?? 26.6,
  };
}

function cooldown(
  state: DetectionState,
  eventType: SimMasterEventType,
  minGapMs: number
): boolean {
  const last = state.lastEventTimes[eventType] ?? 0;
  return Date.now() - last < minGapMs;
}

// ---------------------------------------------------------------------------
// Event Detector
// ---------------------------------------------------------------------------

export function detectEvents(ctx: SimMasterContext): SimMasterEvent[] {
  if (!detectionState) {
    detectionState = initDetectionState(ctx);
    return [];
  }

  const state = detectionState;
  const events: SimMasterEvent[] = [];
  const now = Date.now();

  // Helper to push event and record time
  const push = (type: SimMasterEventType, data: Record<string, unknown> = {}) => {
    events.push({ type, data, timestamp: now });
    state.lastEventTimes[type] = now;
  };

  // ── Drug onset / peak / wearing off ──────────────────────────────────────
  const drugNames = ['propofol', 'fentanyl', 'midazolam', 'ketamine', 'dexmedetomidine'];
  for (const drugName of drugNames) {
    const ce = ctx.pkStates[drugName]?.ce ?? 0;
    const prevCe = state.prevCe[drugName] ?? 0;
    const delta = ce - prevCe;

    if (!cooldown(state, 'drug_onset', 15000) && prevCe < 0.01 && ce >= 0.01) {
      push('drug_onset', { drug: drugName, ce });
    } else if (!cooldown(state, 'drug_wearing_off', 20000) && prevCe > 0.05 && ce < prevCe * 0.7 && ce > 0.005) {
      push('drug_wearing_off', { drug: drugName, ce, prevCe });
    } else if (!cooldown(state, 'drug_peak', 20000) && delta < 0 && prevCe > ce * 1.1 && ce > 0.1) {
      // Peak detected when Ce starts falling after rising
      push('drug_peak', { drug: drugName, ce });
    }
  }

  // ── Synergy developing ────────────────────────────────────────────────────
  if (!cooldown(state, 'synergy_developing', 30000)) {
    const propCe = ctx.pkStates['propofol']?.ce ?? 0;
    const fentCe = ctx.pkStates['fentanyl']?.ce ?? 0;
    const midazCe = ctx.pkStates['midazolam']?.ce ?? 0;
    const hasSynergy = (propCe > 0.1 && fentCe > 0.0005) || (propCe > 0.1 && midazCe > 0.01);
    const prevEff = state.prevCombinedEff;
    if (hasSynergy && ctx.combinedEff > 0.5 && prevEff < 0.5) {
      push('synergy_developing', { combinedEff: ctx.combinedEff });
    }
  }

  // ── Intervention applied ─────────────────────────────────────────────────
  if (
    ctx.lastInterventionApplied &&
    ctx.lastInterventionApplied !== state.prevIntervention &&
    !cooldown(state, 'intervention_applied', 10000)
  ) {
    push('intervention_applied', { intervention: ctx.lastInterventionApplied });
  }

  // ── Sedation deepening / lightening ──────────────────────────────────────
  if (!cooldown(state, 'sedation_deepening', 15000) && ctx.moass < state.prevMoass && state.prevMoass - ctx.moass >= 1) {
    push('sedation_deepening', { moass: ctx.moass, prevMoass: state.prevMoass });
  }
  if (!cooldown(state, 'sedation_lightening', 15000) && ctx.moass > state.prevMoass && ctx.moass - state.prevMoass >= 1) {
    push('sedation_lightening', { moass: ctx.moass, prevMoass: state.prevMoass });
  }

  // ── EEG transition ────────────────────────────────────────────────────────
  const currentEegState = ctx.eegState?.sedationState ?? 'awake';
  if (!cooldown(state, 'eeg_transition', 20000) && currentEegState !== state.prevEegState) {
    push('eeg_transition', {
      from: state.prevEegState,
      to: currentEegState,
      bis: ctx.eegState?.bisIndex ?? 0,
    });
  }

  // ── Rhythm change ─────────────────────────────────────────────────────────
  const currentRhythm = ctx.vitals.rhythm ?? 'normal_sinus';
  if (!cooldown(state, 'rhythm_change', 20000) && currentRhythm !== state.prevRhythm) {
    push('rhythm_change', { from: state.prevRhythm, to: currentRhythm });
  }

  // ── Desaturation cascade ──────────────────────────────────────────────────
  if (!cooldown(state, 'desaturation_cascade', 15000)) {
    const spo2Falling = ctx.vitals.spo2 < 94 && ctx.vitals.spo2 < state.prevVitals.spo2 - 1;
    const rrFalling = ctx.vitals.rr < 10 && ctx.vitals.rr < state.prevVitals.rr - 1;
    const etco2Rising = ctx.vitals.etco2 > 45 && ctx.vitals.etco2 > state.prevVitals.etco2 + 2;
    if ((spo2Falling && rrFalling) || (spo2Falling && etco2Rising)) {
      push('desaturation_cascade', { spo2: ctx.vitals.spo2, rr: ctx.vitals.rr, etco2: ctx.vitals.etco2 });
    }
  }

  // ── Hemodynamic compromise ────────────────────────────────────────────────
  if (!cooldown(state, 'hemodynamic_compromise', 20000)) {
    const sbpFalling = ctx.vitals.sbp < 90 && ctx.vitals.sbp < state.prevVitals.sbp - 5;
    const mapFalling = ctx.vitals.map < 65 && ctx.vitals.map < (state.prevVitals.map ?? ctx.vitals.map) - 5;
    if (sbpFalling || mapFalling) {
      push('hemodynamic_compromise', { sbp: ctx.vitals.sbp, map: ctx.vitals.map });
    }
  }

  // ── Frank-Starling shift ──────────────────────────────────────────────────
  if (!cooldown(state, 'frank_starling_shift', 30000) && ctx.frankStarlingPoint) {
    // Detect significant VEDV change (preload shift)
    const prevVedv = (state as unknown as Record<string, number>)['prevVedv'] ?? ctx.frankStarlingPoint.vedv;
    if (Math.abs(ctx.frankStarlingPoint.vedv - prevVedv) > 10) {
      push('frank_starling_shift', {
        vedv: ctx.frankStarlingPoint.vedv,
        sv: ctx.frankStarlingPoint.sv,
        ees: ctx.frankStarlingPoint.ees,
      });
      (state as unknown as Record<string, number>)['prevVedv'] = ctx.frankStarlingPoint.vedv;
    }
  }

  // ── O2-Hb curve shift ────────────────────────────────────────────────────
  if (!cooldown(state, 'oxyhb_curve_shift', 30000) && ctx.oxyHbPoint) {
    if (Math.abs(ctx.oxyHbPoint.p50 - state.prevP50) > 2) {
      push('oxyhb_curve_shift', {
        p50: ctx.oxyHbPoint.p50,
        direction: ctx.oxyHbPoint.p50 > state.prevP50 ? 'right' : 'left',
        paco2: ctx.oxyHbPoint.paco2,
      });
    }
  }

  // ── User idle ─────────────────────────────────────────────────────────────
  if (!cooldown(state, 'user_idle', 35000) && ctx.userIdleSeconds > 30) {
    push('user_idle', { idleSeconds: ctx.userIdleSeconds });
  }

  // ── Nothing happening (teachable stable moment) ───────────────────────────
  if (!cooldown(state, 'nothing_happening', 50000)) {
    const vitalsStable =
      Math.abs(ctx.vitals.spo2 - state.prevVitals.spo2) < 1 &&
      Math.abs(ctx.vitals.hr - state.prevVitals.hr) < 5 &&
      Math.abs(ctx.vitals.sbp - state.prevVitals.sbp) < 5;
    if (vitalsStable && ctx.vitals.spo2 > 94 && ctx.moass >= 2 && ctx.moass <= 4 && ctx.elapsedSeconds > 60) {
      push('nothing_happening', { moass: ctx.moass });
    }
  }

  // ── Update detection state ────────────────────────────────────────────────
  state.prevMoass = ctx.moass;
  state.prevVitals = { ...ctx.vitals };
  state.prevCe = Object.fromEntries(Object.entries(ctx.pkStates).map(([k, v]) => [k, v.ce]));
  state.prevEegState = currentEegState;
  state.prevRhythm = currentRhythm;
  state.prevCombinedEff = ctx.combinedEff;
  state.prevIntervention = ctx.lastInterventionApplied ?? null;
  if (ctx.oxyHbPoint) state.prevP50 = ctx.oxyHbPoint.p50;

  return events;
}

/** Reset the detection state (e.g., on sim reset) */
export function resetDetectionState(): void {
  detectionState = null;
}

// ---------------------------------------------------------------------------
// Action Generator — converts events to SimMasterAction objects
// ---------------------------------------------------------------------------

export function generateActions(
  events: SimMasterEvent[],
  ctx: SimMasterContext
): SimMasterAction[] {
  const actions: SimMasterAction[] = [];

  for (const event of events) {
    switch (event.type) {

      case 'drug_onset': {
        const drug = event.data['drug'] as string;
        const ce = event.data['ce'] as number;
        const propCe = ctx.pkStates['propofol']?.ce ?? 0;
        if (drug === 'propofol') {
          actions.push({
            type: 'narrate',
            message: `Propofol is reaching the effect site (Ce ${ce.toFixed(2)} mcg/mL). Check the EEG panel — BIS is dropping and the spectrogram is shifting to lower frequencies as the frontal cortex is depressed.`,
            targetPanel: 'eeg',
            openTab: true,
            priority: 70,
            displayDuration: 15000,
            eventType: event.type,
          });
        } else if (drug === 'fentanyl') {
          actions.push({
            type: 'narrate',
            message: `Fentanyl is at the effect site (Ce ${(ce * 1000).toFixed(1)} ng/mL). Opioids bind μ-receptors in the brainstem — watch for RR dropping and EtCO2 rising. Check Petals view to see fentanyl's contribution to combined effect.`,
            targetPanel: 'petals',
            switchGauge: 'petals',
            priority: 65,
            displayDuration: 15000,
            eventType: event.type,
          });
        } else if (drug === 'midazolam') {
          actions.push({
            type: 'narrate',
            message: `Midazolam onset. Benzodiazepines enhance GABA-A inhibition without direct anesthesia. Note how it lowers the propofol Ce needed for the same MOASS — that's synergy. Propofol Ce currently ${propCe.toFixed(2)}.`,
            targetPanel: 'petals',
            switchGauge: 'petals',
            priority: 60,
            displayDuration: 14000,
            eventType: event.type,
          });
        } else if (drug === 'ketamine') {
          actions.push({
            type: 'narrate',
            message: `Ketamine (Ce ${ce.toFixed(2)}) is active. Unlike propofol, ketamine stimulates sympathetics — watch BP and HR on the monitor. Echo will show improved contractility. EEG will show high-frequency activity, not the slow-wave pattern from propofol.`,
            targetPanel: 'echo',
            openTab: true,
            priority: 65,
            displayDuration: 16000,
            eventType: event.type,
          });
        }
        break;
      }

      case 'drug_wearing_off': {
        const drug = event.data['drug'] as string;
        const ce = event.data['ce'] as number;
        actions.push({
          type: 'narrate',
          message: `${drug.charAt(0).toUpperCase() + drug.slice(1)} Ce declining (now ${ce.toFixed(2)} mcg/mL). Redistribution is outpacing effect-site equilibration. Watch MOASS — patient may lighten. Switch to Petals to see drug levels shrinking.`,
          targetPanel: 'petals',
          switchGauge: 'petals',
          priority: 55,
          displayDuration: 12000,
          eventType: event.type,
        });
        break;
      }

      case 'synergy_developing': {
        const eff = (event.data['combinedEff'] as number) * 100;
        actions.push({
          type: 'explain',
          message: `Drug synergy active — combined effect ${eff.toFixed(0)}%. Two drugs together exceed the sum of individual effects. The Bouillon response-surface model predicts this supra-additivity. Check the Petals view — overlapping petals = overlapping CNS targets.`,
          targetPanel: 'petals',
          switchGauge: 'petals',
          priority: 75,
          displayDuration: 16000,
          eventType: event.type,
        });
        break;
      }

      case 'intervention_applied': {
        const intv = event.data['intervention'] as string;
        const itvLabel = intv.replace(/_/g, ' ');
        actions.push({
          type: 'narrate',
          message: `${itvLabel} applied. Watch the monitor for effect — SpO2 and RR should respond within 15-30 seconds. The Avatar mode will show chest rise improving. O2-Hb curve operating point should shift back up the steep part of the sigmoid.`,
          targetPanel: 'avatar',
          switchGauge: 'avatar',
          priority: 80,
          displayDuration: 14000,
          eventType: event.type,
        });
        break;
      }

      case 'sedation_deepening': {
        const moass = event.data['moass'] as MOASSLevel;
        actions.push({
          type: 'narrate',
          message: `Sedation deepening — MOASS ${moass}. Effect-site concentration is crossing the MOASS threshold. Open the EEG panel to see BIS declining and the DSA spectrogram shifting toward delta frequencies.`,
          targetPanel: 'eeg',
          openTab: true,
          priority: 72,
          displayDuration: 14000,
          eventType: event.type,
        });
        break;
      }

      case 'sedation_lightening': {
        const moass = event.data['moass'] as MOASSLevel;
        actions.push({
          type: 'narrate',
          message: `Sedation lightening — MOASS ${moass}. Drug redistribution is allowing consciousness to return. BIS rising, EEG showing more alpha activity. If a procedure is still in progress, this may indicate re-dosing is needed.`,
          targetPanel: 'eeg',
          openTab: true,
          priority: 70,
          displayDuration: 14000,
          eventType: event.type,
        });
        break;
      }

      case 'eeg_transition': {
        const from = event.data['from'] as string;
        const to = event.data['to'] as string;
        const bis = event.data['bis'] as number;
        let msg: string;
        if (to === 'burst_suppression') {
          msg = `BIS ${bis.toFixed(0)} — burst suppression detected. EEG shows alternating high-amplitude bursts and electrical silence. This is DEEP sedation, likely beyond procedural goals. Suppression ratio is climbing. Consider reducing drug dose.`;
        } else if (to === 'deep') {
          msg = `EEG transitioning to deep sedation (BIS ${bis.toFixed(0)}). Open the EEG panel — the DSA spectrogram shows power concentrating in delta range (0-4 Hz). Propofol's signature: frontal alpha spindles disappearing, replaced by slow waves.`;
        } else if (to === 'moderate') {
          msg = `EEG shows moderate sedation (BIS ${bis.toFixed(0)}). Theta/delta waves emerging. From ${from}. This is the target range for most procedural sedation (BIS 60-80 = sedation; BIS 40-60 = general anesthesia).`;
        } else {
          msg = `EEG state: ${from} → ${to} (BIS ${bis.toFixed(0)}). Open the EEG panel to see the spectral changes in real time.`;
        }
        actions.push({
          type: 'explain',
          message: msg,
          targetPanel: 'eeg',
          openTab: true,
          priority: 78,
          displayDuration: 16000,
          eventType: event.type,
        });
        break;
      }

      case 'rhythm_change': {
        const toRhythm = (event.data['to'] as string).replace(/_/g, ' ');
        const fromRhythm = (event.data['from'] as string).replace(/_/g, ' ');
        const isDangerous = ['ventricular fibrillation', 'ventricular tachycardia', 'polymorphic vt', 'asystole', 'pea'].includes(toRhythm);
        if (isDangerous) {
          actions.push({
            type: 'suggest_action',
            message: `⚠ RHYTHM CHANGE: ${fromRhythm} → ${toRhythm}. This is a DANGEROUS rhythm requiring immediate action. Open Emergency Drugs panel. Follow ACLS algorithm. Stop all sedatives.`,
            targetPanel: 'emergency_drugs',
            priority: 100,
            displayDuration: 20000,
            eventType: event.type,
          });
        } else {
          actions.push({
            type: 'narrate',
            message: `Rhythm change detected: ${fromRhythm} → ${toRhythm}. Look at the ECG on the monitor. Key questions: Is the QRS narrow or wide? Is the rate regular? Are P waves visible? These features guide management.`,
            targetPanel: 'monitor',
            priority: 82,
            displayDuration: 15000,
            eventType: event.type,
          });
        }
        break;
      }

      case 'desaturation_cascade': {
        const spo2 = event.data['spo2'] as number;
        const rr = event.data['rr'] as number;
        actions.push({
          type: 'direct_attention',
          message: `SpO2 ${spo2.toFixed(0)}% + RR ${rr.toFixed(0)}/min falling together — desaturation cascade. Opioid/hypnotic CNS depression → ↓ respiratory drive → ↓ RR → ↑ EtCO2 → ↓ PaO2 → ↓ SpO2. Open O2-Hb curve to see the operating point sliding down the steep sigmoid.`,
          targetPanel: 'oxyhb',
          openTab: true,
          priority: 90,
          displayDuration: 18000,
          eventType: event.type,
        });
        break;
      }

      case 'hemodynamic_compromise': {
        const sbp = event.data['sbp'] as number;
        const map = event.data['map'] as number;
        actions.push({
          type: 'direct_attention',
          message: `BP falling — SBP ${sbp.toFixed(0)}, MAP ${map.toFixed(0)}. Propofol causes vasodilation + myocardial depression. Open Frank-Starling: the operating point is shifting left (reduced preload) and the ESPVR slope (Ees = contractility) may be declining.`,
          targetPanel: 'frank_starling',
          openTab: true,
          priority: 88,
          displayDuration: 18000,
          eventType: event.type,
        });
        break;
      }

      case 'frank_starling_shift': {
        const vedv = event.data['vedv'] as number;
        const sv = event.data['sv'] as number;
        actions.push({
          type: 'explain',
          message: `Preload changing — VEDV ${vedv.toFixed(0)} mL, SV ${sv.toFixed(0)} mL. Open Frank-Starling to watch the operating point move along the curve. More preload → more stretch → more force (Starling's law). But beyond optimal length, the curve flattens.`,
          targetPanel: 'frank_starling',
          openTab: true,
          priority: 65,
          displayDuration: 15000,
          eventType: event.type,
        });
        break;
      }

      case 'oxyhb_curve_shift': {
        const dir = event.data['direction'] as string;
        const paco2 = event.data['paco2'] as number;
        actions.push({
          type: 'explain',
          message: `O2-Hb curve shifting ${dir} (PaCO2 ${paco2.toFixed(0)} mmHg → P50 changing). ${dir === 'right' ? 'Right shift (Bohr effect): higher CO2/lower pH causes Hb to release O2 more readily. Good for tissue delivery, but SpO2 appears lower for same PaO2.' : 'Left shift: alkalosis makes Hb bind O2 more tightly — less delivery to tissues.'} Open O2-Hb panel.`,
          targetPanel: 'oxyhb',
          openTab: true,
          priority: 62,
          displayDuration: 16000,
          eventType: event.type,
        });
        break;
      }

      case 'user_idle': {
        const idle = event.data['idleSeconds'] as number;
        // Cycle through educational directions when user is idle
        const idleMsgs = [
          {
            msg: `While the patient is stable, explore the Echo tab — real-time echocardiogram shows EF ${(ctx.frankStarlingPoint?.ef ?? 60).toFixed(0)}%. Notice mitral valve opening each cycle. E/A ratio reflects diastolic function.`,
            panel: 'echo' as SimMasterTargetPanel,
            tab: true,
          },
          {
            msg: `Have you explored the O2-Hb dissociation curve? The patient's operating point is at SpO2 ${ctx.vitals.spo2.toFixed(0)}%. The curve shape explains why small PaO2 drops near the plateau cause large SpO2 falls on the steep part.`,
            panel: 'oxyhb' as SimMasterTargetPanel,
            tab: true,
          },
          {
            msg: `Switch to Avatar view — chest rise matches RR on the monitor. Skin tone reflects SpO2 (normal pink → pale → cyanotic below 90%). Pupils dilate with deep sedation (MOASS ≤1).`,
            panel: 'avatar' as SimMasterTargetPanel,
            switchGauge: 'avatar',
          },
          {
            msg: `Check Frank-Starling — the ESPVR slope (Ees) represents contractility. Propofol decreases Ees as you deepen sedation. Notice the PV loop shape changing with drug levels.`,
            panel: 'frank_starling' as SimMasterTargetPanel,
            tab: true,
          },
        ];
        const pick = idleMsgs[Math.floor(idle / 30) % idleMsgs.length];
        actions.push({
          type: 'direct_attention',
          message: pick.msg,
          targetPanel: pick.panel,
          openTab: pick.tab,
          switchGauge: pick.switchGauge,
          priority: 40,
          displayDuration: 18000,
          eventType: event.type,
        });
        break;
      }

      case 'nothing_happening': {
        const moass = event.data['moass'] as MOASSLevel;
        const bis = ctx.eegState?.bisIndex ?? 0;
        actions.push({
          type: 'explain',
          message: `Patient stable at MOASS ${moass}${bis > 0 ? `, BIS ${bis.toFixed(0)}` : ''}. Good sedation management. This is a good time to review the Drug Panel — Ghost Dose shows predicted Ce trajectory for the next dose. What's the expected peak Ce for a 1 mg/kg propofol bolus?`,
          targetPanel: 'drug_panel',
          priority: 35,
          displayDuration: 18000,
          eventType: event.type,
        });
        break;
      }

      default:
        break;
    }
  }

  // Sort by priority descending
  return actions.sort((a, b) => b.priority - a.priority);
}

// ---------------------------------------------------------------------------
// Directed exploration commentary (for Socratic Q&A via Claude)
// ---------------------------------------------------------------------------

export function shouldAskQuestion(
  ctx: SimMasterContext,
  lastSocraticTime: number
): boolean {
  const timeSinceLast = Date.now() - lastSocraticTime;
  const interval = 60000 + Math.random() * 30000; // 60-90 seconds
  return (
    timeSinceLast > interval &&
    ctx.elapsedSeconds > 30 &&
    ctx.moass >= 1 &&
    ctx.moass <= 4 &&
    ctx.userIdleSeconds < 120 // don't interrupt if user has been idle very long
  );
}

// ---------------------------------------------------------------------------
// Legacy API (backward compatibility)
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
    Math.abs(current.vitals.hr - prev.vitals.hr) > 8 ||
    Math.abs(current.vitals.spo2 - prev.vitals.spo2) > 2 ||
    Math.abs(current.vitals.sbp - prev.vitals.sbp) > 10 ||
    Math.abs(current.vitals.rr - prev.vitals.rr) > 3 ||
    Math.abs(current.vitals.etco2 - prev.vitals.etco2) > 5 ||
    current.moass !== prev.moass ||
    current.vitals.spo2 < 93 ||
    current.vitals.hr < 50 ||
    current.vitals.hr > 120 ||
    current.vitals.sbp < 85 ||
    current.vitals.rr <= 6 ||
    current.vitals.etco2 > 55;
  lastSnapshot = current;
  return changed;
}

export function generateObservation(
  vitals: Vitals,
  moass: MOASSLevel,
  eeg?: EEGState,
  pkStates?: Record<string, { ce: number }>
): SimMasterAnnotation {
  const assessments = assessAllVitals(vitals, moass, eeg, pkStates);
  const abnormal = assessments.filter(a => a.status !== 'normal');

  const CLINICAL_MESSAGES_INLINE = [
    { param: 'rr', condition: (v: number) => v === 0, status: 'critical',
      message: () => 'APNEA! No respiratory effort detected. Bag-mask ventilate immediately!', target: 'rr_display', priority: 100 },
    { param: 'spo2', condition: (v: number) => v <= 80, status: 'critical',
      message: (v: number) => `CRITICAL HYPOXIA: SpO2 ${rv(v)}%! Immediate airway intervention required.`, target: 'spo2_display', priority: 99 },
    { param: 'sbp', condition: (v: number) => v <= 60, status: 'critical',
      message: (v: number) => `CARDIOVASCULAR COLLAPSE: SBP ${rv(v)}mmHg. Vasopressors + fluid resuscitation NOW.`, target: 'bp_display', priority: 97 },
    { param: 'spo2', condition: (v: number) => v <= 88, status: 'danger',
      message: (v: number) => `DESATURATION: SpO2 ${rv(v)}%. Increase FiO2, jaw thrust, consider airway adjunct.`, target: 'spo2_display', priority: 90 },
    { param: 'rr', condition: (v: number) => v <= 5 && v > 0, status: 'danger',
      message: (v: number) => `Severe respiratory depression: RR ${rv(v)}/min.`, target: 'rr_display', priority: 89 },
    { param: 'sbp', condition: (v: number) => v <= 75, status: 'danger',
      message: (v: number) => `Significant hypotension: SBP ${rv(v)}mmHg. Fluid bolus, reduce propofol.`, target: 'bp_display', priority: 88 },
    { param: 'spo2', condition: (v: number) => v <= 92, status: 'warning',
      message: (v: number) => `SpO2 trending down to ${rv(v)}%. Monitor airway patency, increase O2.`, target: 'spo2_display', priority: 70 },
    { param: 'rr', condition: (v: number) => v <= 8, status: 'warning',
      message: (v: number) => `Respiratory rate low at ${rv(v)}/min. Watch for further depression.`, target: 'rr_display', priority: 69 },
  ];

  for (const cm of CLINICAL_MESSAGES_INLINE) {
    const assessment = assessments.find(a => a.param === cm.param);
    if (assessment && cm.condition(assessment.value)) {
      return {
        message: cm.message(assessment.value),
        target: cm.target,
        severity: cm.status === 'critical' || cm.status === 'danger' ? 'danger' : 'warning',
        action: cm.status === 'critical' ? 'pulse' : cm.status === 'danger' ? 'point' : 'highlight',
        timestamp: Date.now(),
      };
    }
  }

  if (abnormal.length === 0) {
    return {
      message: `All vitals normal. MOASS ${moass}/5. Continue monitoring.`,
      target: 'moass_gauge',
      severity: 'info',
      action: 'highlight',
      timestamp: Date.now(),
    };
  }

  const worst = abnormal[0];
  const PARAM_TO_TARGET: Record<string, string> = {
    hr: 'hr_display', spo2: 'spo2_display', sbp: 'bp_display',
    rr: 'rr_display', etco2: 'etco2_display', moass: 'moass_gauge', bis: 'ecg_trace',
  };
  return {
    message: `${worst.label} is ${worst.value}${worst.unit} (${worst.status}). Monitor closely.`,
    target: PARAM_TO_TARGET[worst.param] || 'moass_gauge',
    severity: worst.status === 'normal' ? 'info' : worst.status === 'warning' ? 'warning' : 'danger',
    action: worst.status === 'critical' || worst.status === 'danger' ? 'pulse' : 'highlight',
    timestamp: Date.now(),
  };
}

export async function querySimMaster(): Promise<SimMasterAnnotation | null> {
  return null;
}

export function fallbackAnnotation(): SimMasterAnnotation {
  return { message: 'Observing...', target: 'moass_gauge', severity: 'info', action: 'highlight', timestamp: Date.now() };
}

// ---------------------------------------------------------------------------
// v4: Teaching-mode aware action filtering
// ---------------------------------------------------------------------------

export type SimMasterTeachingMode = 'observer' | 'active_teaching' | 'assessment';

/**
 * Filter generated actions based on the current teaching mode.
 *
 * - **observer** (Arm A): Only safety-critical actions (priority >= 85).
 *   No Socratic questions, no explanations — just urgent alerts.
 * - **active_teaching** (Arm B): All actions pass through. Full Socratic
 *   engagement, panel pointing, and explanations.
 * - **assessment** (Arm C): Convert questions and explanations into
 *   "what would you do?" prompts. Hide direct answers until learner responds.
 */
export function filterActionsByTeachingMode(
  actions: SimMasterAction[],
  mode: SimMasterTeachingMode
): SimMasterAction[] {
  switch (mode) {
    case 'observer':
      // Safety alerts only: suggest_action and direct_attention with high priority
      return actions.filter(
        a => a.priority >= 85 || a.type === 'suggest_action'
      );

    case 'assessment':
      // Transform actions into assessment prompts
      return actions.map(a => {
        if (a.type === 'explain' || a.type === 'narrate') {
          return {
            ...a,
            type: 'ask_question' as SimMasterActionType,
            message: `Look at this clinical situation. What do you observe, and what would you do next?`,
            question: a.message, // Original explanation stored as the answer
            requiresUserResponse: true,
          };
        }
        if (a.type === 'direct_attention') {
          return {
            ...a,
            type: 'ask_question' as SimMasterActionType,
            message: `Something important is changing on the monitor. Can you identify what it is and why it matters?`,
            question: a.message,
            requiresUserResponse: true,
          };
        }
        return a;
      });

    case 'active_teaching':
    default:
      return actions;
  }
}

// ---------------------------------------------------------------------------
// v4: Convert SimMasterAction → OverlayAnnotation for the visual system
// ---------------------------------------------------------------------------

import type { OverlayAnnotation } from '../components/SimMasterOverlay';

/** Map SimMasterTargetPanel names to data-region keys used by the overlay. */
const TARGET_PANEL_TO_REGION: Record<string, string> = {
  monitor: 'hr',
  avatar: 'moass-gauge',
  radar: 'radar',
  petals: 'moass-gauge',
  eeg: 'eeg',
  echo: 'eeg',
  frank_starling: 'bp',
  oxyhb: 'spo2',
  drug_panel: 'drug-panel',
  trends: 'trend-graph',
  ghost_dose: 'drug-panel',
  sedation_gauge: 'moass-gauge',
  risk_metrics: 'eeg',
  emergency_drugs: 'intervention-panel',
  iv_fluids: 'intervention-panel',
  airway: 'airway-controls',
  learning_panel: 'eventlog',
};

let overlayIdCounter = 0;

/**
 * Convert a SimMasterAction into an OverlayAnnotation suitable for the
 * visual overlay system.
 */
export function actionToOverlayAnnotation(action: SimMasterAction): OverlayAnnotation | null {
  const targetPanel = action.targetPanel;
  if (!targetPanel) return null;

  const regionKey = TARGET_PANEL_TO_REGION[targetPanel];
  if (!regionKey) return null;

  const severity: OverlayAnnotation['severity'] =
    action.priority >= 85 ? 'critical' :
    action.priority >= 60 ? 'warning' : 'info';

  const overlayAction: OverlayAnnotation['action'] =
    action.type === 'suggest_action' || action.type === 'direct_attention' ? 'pulse' :
    action.type === 'ask_question' ? 'point' : 'highlight';

  return {
    id: `sm-${++overlayIdCounter}-${Date.now()}`,
    targetRegion: regionKey,
    severity,
    message: action.message.length > 200
      ? action.message.slice(0, 197) + '...'
      : action.message,
    action: overlayAction,
    createdAt: Date.now(),
    autoDismissMs: action.displayDuration || 15000,
  };
}

// ---------------------------------------------------------------------------
// v4: Enhanced Claude query for SimMaster with structured response
// ---------------------------------------------------------------------------

import { streamClaude, ClaudeContext } from './claudeClient';
import { buildSimMasterSystemPrompt } from './simMasterPrompt';
import {
  detectClinicalPatterns,
  CLINICAL_STATE_DEFINITIONS,
} from './simMasterKnowledge';

export interface SimMasterClaudeResponse {
  message: string;
  targetPanel: SimMasterTargetPanel | null;
  severity: 'info' | 'warning' | 'critical';
  teachingPoint: string;
  socraticQuestion: string;
}

/**
 * Build a rich context string summarizing the current simulation state,
 * detected patterns, and recent events for Claude.
 */
function buildEnhancedContextSummary(ctx: SimMasterContext): string {
  const lines: string[] = [];

  // Vital signs with clinical status
  const assessments = assessAllVitals(ctx.vitals, ctx.moass, ctx.eegState ?? undefined);
  for (const a of assessments) {
    const def = CLINICAL_STATE_DEFINITIONS[a.param];
    const statusTag = a.status !== 'normal' ? ` [${a.status.toUpperCase()}]` : '';
    lines.push(`${a.label}: ${a.value}${a.unit}${statusTag}`);
    if (a.status !== 'normal' && def) {
      const transition = a.status === 'warning'
        ? def.transitionExplanations.normalToWarning
        : a.status === 'danger'
        ? def.transitionExplanations.warningToCritical
        : def.transitionExplanations.criticalToEmergent;
      lines.push(`  → ${transition}`);
    }
  }

  // Drug concentrations
  const activeDrugs = Object.entries(ctx.pkStates)
    .filter(([, s]) => s.ce > 0.001)
    .map(([name, s]) => `${name} Ce=${s.ce.toFixed(3)} mcg/mL`);
  if (activeDrugs.length) {
    lines.push(`Active drugs: ${activeDrugs.join(', ')}`);
  }

  // Detected clinical patterns
  const patternValues: Record<string, number> = {
    hr: ctx.vitals.hr,
    spo2: ctx.vitals.spo2,
    sbp: ctx.vitals.sbp,
    rr: ctx.vitals.rr,
    etco2: ctx.vitals.etco2,
    moass: ctx.moass,
    bis: ctx.eegState?.bisIndex ?? 100,
    propofol_ce: ctx.pkStates['propofol']?.ce ?? 0,
    fentanyl_ce: ctx.pkStates['fentanyl']?.ce ?? 0,
    midazolam_ce: ctx.pkStates['midazolam']?.ce ?? 0,
  };
  const patterns = detectClinicalPatterns(patternValues);
  if (patterns.length > 0) {
    lines.push(`\nDetected clinical patterns:`);
    for (const p of patterns.slice(0, 3)) {
      lines.push(`- ${p.name} (${p.severity}): ${p.explanation.slice(0, 120)}...`);
    }
  }

  // User behavior
  if (ctx.userIdleSeconds > 15) {
    lines.push(`\nLearner has been idle for ${Math.round(ctx.userIdleSeconds)} seconds.`);
  }
  if (ctx.lastDrugAdministered) {
    lines.push(`Last drug administered: ${ctx.lastDrugAdministered.name} ${ctx.lastDrugAdministered.dose} at t=${ctx.lastDrugAdministered.timestamp}`);
  }

  return lines.join('\n');
}

/**
 * Query Claude for a context-aware SimMaster response.
 * Falls back to a locally generated response if the API is unavailable.
 */
export async function querySimMasterClaude(
  ctx: SimMasterContext,
  triggerEvent: string,
  learnerLevel: 'novice' | 'intermediate' | 'advanced' = 'intermediate',
  signal?: AbortSignal
): Promise<SimMasterClaudeResponse> {
  const contextSummary = buildEnhancedContextSummary(ctx);

  const claudeCtx: ClaudeContext = {
    vitals: ctx.vitals,
    moass: ctx.moass,
    eeg: ctx.eegState ?? undefined,
    pkStates: ctx.pkStates,
    elapsedSeconds: ctx.elapsedSeconds,
    learnerLevel,
    recentEvents: [],
    activeTab: ctx.activeTab,
    activeGaugeMode: ctx.activeGaugeMode,
    _systemOverride: buildSimMasterSystemPrompt({
      vitals: ctx.vitals,
      moass: ctx.moass,
      eeg: ctx.eegState ?? undefined,
      pkStates: ctx.pkStates,
      learnerLevel,
      recentEvents: [],
      activeTab: ctx.activeTab,
      activeGaugeMode: ctx.activeGaugeMode,
    }),
  };

  const prompt = `Event: ${triggerEvent}\n\nSimulation state:\n${contextSummary}\n\nGenerate a teaching response. Include:\n1. A concise observation (what's happening)\n2. Which panel the learner should look at\n3. A Socratic question to deepen understanding\n\nKeep it under 120 words. Be specific about current values.`;

  try {
    let fullText = '';
    await streamClaude(prompt, claudeCtx, (chunk) => { fullText += chunk; }, signal);

    // Parse the response — Claude returns free text, we structure it
    return {
      message: fullText,
      targetPanel: null, // Let the event detector determine the panel
      severity: ctx.vitals.spo2 < 90 || ctx.vitals.sbp < 75 || ctx.vitals.rr <= 5 ? 'critical' :
                ctx.vitals.spo2 < 94 || ctx.vitals.sbp < 90 || ctx.vitals.rr < 8 ? 'warning' : 'info',
      teachingPoint: fullText.split('\n')[0] ?? '',
      socraticQuestion: fullText.split('?')[0]?.split('\n').pop()?.trim() + '?' || '',
    };
  } catch {
    // Fallback: use local knowledge base
    const assessments = assessAllVitals(ctx.vitals, ctx.moass, ctx.eegState ?? undefined);
    const worst = assessments.find(a => a.status !== 'normal');
    return {
      message: worst
        ? `${worst.label} is ${worst.value}${worst.unit} (${worst.status}). Monitor closely.`
        : `Patient stable at MOASS ${ctx.moass}. Continue monitoring.`,
      targetPanel: null,
      severity: worst?.status === 'critical' || worst?.status === 'danger' ? 'critical' :
                worst?.status === 'warning' ? 'warning' : 'info',
      teachingPoint: '',
      socraticQuestion: '',
    };
  }
}

// ---------------------------------------------------------------------------
// v4: Idle detection enhancement — urgent attention when idle during critical
// ---------------------------------------------------------------------------

/**
 * Check if the learner is idle during a critical event and generate an
 * urgent attention-directing action.
 */
export function checkIdleDuringCritical(
  ctx: SimMasterContext,
  lastIdleAlertTime: number
): SimMasterAction | null {
  const now = Date.now();
  if (now - lastIdleAlertTime < 20000) return null; // 20s cooldown

  const isCritical =
    ctx.vitals.spo2 < 90 ||
    ctx.vitals.sbp < 75 ||
    ctx.vitals.rr <= 5 ||
    ctx.vitals.hr < 35 ||
    ctx.emergencyState?.level === 'arrest' ||
    ctx.emergencyState?.level === 'critical';

  if (!isCritical || ctx.userIdleSeconds < 15) return null;

  // Determine what's most urgent
  if (ctx.vitals.spo2 < 90) {
    return {
      type: 'direct_attention',
      message: `⚠ SpO2 ${Math.round(ctx.vitals.spo2)}% — patient is desaturating and you haven't intervened! Open the Airway controls panel immediately. Jaw thrust, increase FiO2, or bag-mask ventilate.`,
      targetPanel: 'airway',
      priority: 95,
      displayDuration: 20000,
      eventType: 'user_idle',
    };
  }
  if (ctx.vitals.sbp < 75) {
    return {
      type: 'direct_attention',
      message: `⚠ SBP ${Math.round(ctx.vitals.sbp)} mmHg — severe hypotension without intervention! Stop sedative infusions, give fluid bolus, consider vasopressor from Emergency Drugs panel.`,
      targetPanel: 'emergency_drugs',
      priority: 95,
      displayDuration: 20000,
      eventType: 'user_idle',
    };
  }
  if (ctx.emergencyState?.isArrest) {
    return {
      type: 'suggest_action',
      message: `🚨 CARDIAC ARREST — immediate action required! Start CPR, open Emergency Drugs for epinephrine. Follow ACLS algorithm. Every second counts.`,
      targetPanel: 'emergency_drugs',
      priority: 100,
      displayDuration: 25000,
      eventType: 'user_idle',
    };
  }

  return {
    type: 'direct_attention',
    message: `The patient's condition is critical and deteriorating. Review the monitor and take action.`,
    targetPanel: 'monitor',
    priority: 90,
    displayDuration: 18000,
    eventType: 'user_idle',
  };
}

export default {
  generateObservation,
  assessAllVitals,
  assessParam,
  hasSignificantChange,
  detectEvents,
  generateActions,
  resetDetectionState,
  shouldAskQuestion,
  filterActionsByTeachingMode,
  actionToOverlayAnnotation,
  querySimMasterClaude,
  checkIdleDuringCritical,
  SCREEN_REGIONS,
  CLINICAL_RANGES,
};
