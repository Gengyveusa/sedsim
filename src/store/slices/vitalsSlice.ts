import { StateCreator } from 'zustand';
import {
  PKState,
  Vitals,
  MOASSLevel,
  LogEntry,
  Patient,
  TrendPoint,
  EmergencyState,
  EchoParams,
  FrankStarlingPoint,
  OxyHbPoint,
  AvatarState,
  WaveformParams,
} from '../../types';
import { BASELINE_VITALS, PATIENT_ARCHETYPES } from '../../engine/physiology';
import { EEGState } from '../../engine/eegModel';
import { DigitalTwin, createDigitalTwin } from '../../engine/digitalTwin';
import type { SimStore } from '../storeTypes';

export interface VitalsSlice {
  // State
  vitals: Vitals;
  moass: MOASSLevel;
  combinedEff: number;
  activeAlarms: { type: string; message: string; severity: 'warning' | 'danger' }[];
  eegState: EEGState | null;
  digitalTwin: DigitalTwin | null;
  emergencyState: EmergencyState;
  echoParams: EchoParams;
  frankStarlingPoint: FrankStarlingPoint;
  oxyHbPoint: OxyHbPoint;
  avatarState: AvatarState;
  waveformParams: WaveformParams;
  trendData: TrendPoint[];
  maxTrendPoints: number;
  eventLog: LogEntry[];

  // Actions
  logEvent: (message: string, type?: LogEntry['type'], severity?: LogEntry['severity']) => void;
  overrideVital: (parameter: string, value: number) => void;
}

/**
 * Compute pre-derived visualization parameters from current sim state.
 * Called once per tick so all components are pure consumers of store state.
 */
export function computeVisualizationState(
  vitals: Vitals,
  pkStates: Record<string, PKState>,
  patient: Patient,
  moass: MOASSLevel,
  combinedEff: number,
  fio2: number,
  fluidVolumeML: number = 0,
): { echoParams: EchoParams; frankStarlingPoint: FrankStarlingPoint; oxyHbPoint: OxyHbPoint; avatarState: AvatarState; waveformParams: WaveformParams } {
  // ── Cardiac arrest detection ──
  const rhythm = vitals.rhythm ?? 'normal_sinus';
  const isArrest = rhythm === 'ventricular_fibrillation' || rhythm === 'asystole' || rhythm === 'pea';

  // ── Shared cardiac modifier computation (same as EchoSim & FrankStarlingCurve) ──
  let ees = 2.5;
  let edpScale = 1.0;
  let vedv = 130;
  let peakSys = vitals.sbp || 120;
  const hr = vitals.hr || 75;

  if (patient.age > 65) { ees -= 0.4; edpScale += 0.3; }
  else if (patient.age > 50) { ees -= 0.2; edpScale += 0.15; }
  if (patient.asa >= 3) { ees -= 0.3; edpScale += 0.2; }
  else if (patient.asa >= 2) { ees -= 0.1; }
  if (patient.copd) { vedv -= 5; }
  if (patient.hepaticImpairment) { ees -= 0.2; }
  if (patient.renalImpairment) { edpScale += 0.2; vedv += 10; }

  const propCe = pkStates['propofol']?.ce || 0;
  const midazCe = pkStates['midazolam']?.ce || 0;
  const fentCe = pkStates['fentanyl']?.ce || 0;
  const ketCe = pkStates['ketamine']?.ce || 0;

  if (propCe > 0) { ees -= propCe * 0.15; peakSys -= propCe * 5; vedv -= propCe * 3; }
  if (midazCe > 0) { ees -= midazCe * 0.05; }
  if (fentCe > 0) { ees -= fentCe * 0.2; peakSys -= fentCe * 3; }
  if (ketCe > 0) { ees += ketCe * 0.1; peakSys += ketCe * 4; }

  // Fluid loading increases preload (EDV)
  if (fluidVolumeML > 0) { vedv += fluidVolumeML * 0.02; }

  // Sedation-related hemodynamic depression (MOASS <= 3 = moderate/deep sedation)
  if (moass <= 2) { ees -= 0.3; peakSys -= 15; }
  else if (moass <= 3) { ees -= 0.15; peakSys -= 8; }
  ees -= combinedEff * 0.08;

  ees = Math.max(0.8, Math.min(4.0, ees));
  edpScale = Math.max(0.5, Math.min(3.0, edpScale));
  vedv = Math.max(90, Math.min(160, vedv));
  peakSys = Math.max(60, Math.min(200, peakSys));

  // ESV = f(afterload, contractility). Vasodilation (lower peakSys) reduces ESV.
  const afterloadFactor = peakSys / 120; // normalised to baseline SBP
  let vesv = Math.max(30, Math.min(vedv - 20, vedv * 0.35 * afterloadFactor / (ees / 2.5) + 5));
  let sv = vedv - vesv;
  let ef = (sv / vedv) * 100;

  // Cardiac arrest: collapse ejection
  if (isArrest) {
    vesv = vedv - 2;
    sv = 2;
    ef = (sv / vedv) * 100;
  }
  const pEdp = edpScale * Math.pow(Math.max(0, vedv - 10), 2) / 1000;

  const echoParams: EchoParams = {
    preload: Math.max(40, Math.min(200, vedv * edpScale * 0.92)),
    afterload: Math.max(40, Math.min(200, peakSys * 0.6)),
    contractility: Math.max(0.3, Math.min(2.0, ees / 2.5)),
    heartRate: hr,
  };

  const frankStarlingPoint: FrankStarlingPoint = { vedv, vesv, sv, ef, pEdp, peakSys, ees, hr };

  // ── OxyHb operating point ──
  const etco2 = vitals.etco2 ?? 38;
  const paco2 = etco2 + 5;
  const pao2 = Math.max(0, fio2 * (760 - 47) - paco2 / 0.8);
  const pH = 7.4 - (paco2 - 40) * 0.008;
  let p50 = 26.6;
  p50 *= Math.pow(10, 0.48 * (7.4 - pH));
  p50 += (paco2 - 40) * 0.02;
  p50 = Math.max(10, p50);

  const oxyHbPoint: OxyHbPoint = { pao2, spo2: vitals.spo2, p50, paco2, pH };

  // ── Avatar visual state ──
  const skinTone: AvatarState['skinTone'] = vitals.spo2 < 90 ? 'cyanotic' : vitals.spo2 < 94 ? 'pale' : 'normal';
  const avatarState: AvatarState = {
    skinTone,
    diaphoresis: vitals.hr > 120 || vitals.sbp < 80,
    pupilDilated: moass <= 1,
    chestRiseRate: vitals.rr,
  };

  // ── Waveform display parameters ──
  const pulsePressure = (vitals.sbp - vitals.dbp) || 40;
  const waveformParams: WaveformParams = {
    plethAmplitude: Math.min(1.8, Math.max(0.1, pulsePressure / 40)),
    capnoFlat: vitals.rr === 0,
    rhythm: vitals.rhythm ?? 'normal_sinus',
  };

  return { echoParams, frankStarlingPoint, oxyHbPoint, avatarState, waveformParams };
}

/** Default derived visualization state (used for initial and reset state) */
export const DEFAULT_VIZ_STATE = computeVisualizationState(
  { hr: 75, sbp: 120, dbp: 80, map: 93, rr: 14, spo2: 98, etco2: 38 },
  {},
  PATIENT_ARCHETYPES.healthy_adult,
  5 as MOASSLevel,
  0,
  0.21,
);

export const createVitalsSlice: StateCreator<SimStore, [], [], VitalsSlice> = (set, get) => ({
  vitals: BASELINE_VITALS,
  moass: 5 as MOASSLevel,
  combinedEff: 0,
  activeAlarms: [],
  eegState: null,
  digitalTwin: createDigitalTwin(PATIENT_ARCHETYPES.healthy_adult),
  emergencyState: {
    level: 'normal',
    activeAlarms: [],
    isArrest: false,
    requiresImmediateIntervention: false,
  },
  ...DEFAULT_VIZ_STATE,
  trendData: [],
  maxTrendPoints: 600,
  eventLog: [],

  logEvent: (message, type = 'intervention', severity = 'info') => {
    const state = get();
    set({
      eventLog: [...state.eventLog, { time: state.elapsedSeconds, type, message, severity }],
    });
  },

  overrideVital: (parameter, value) => {
    const state = get();
    const updated = { ...state.vitals, [parameter]: value };
    set({ vitals: updated });
  },
});
