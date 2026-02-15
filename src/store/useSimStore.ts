import { create } from 'zustand';
import { PKState, Vitals, MOASSLevel, LogEntry, Patient, TrendPoint, DrugParams, InfusionState } from '../types';
import { DRUG_DATABASE } from '../engine/drugs';
import { createInitialPKState, stepPK } from '../engine/pkModel';
import { combinedEffect, effectToMOASS } from '../engine/pdModel';
import { calculateVitals, checkAlarms, BASELINE_VITALS } from '../engine/physiology';

interface SimState {
  // Time
  elapsedSeconds: number;
  isRunning: boolean;
  speedMultiplier: number;

  // Patient
  patient: Patient;

  // Drug PK states
  pkStates: Record<string, PKState>;

  // Active infusions
  infusions: Record<string, InfusionState>;

  // Current vitals & sedation
  vitals: Vitals;
  moass: MOASSLevel;
  combinedEff: number;

  // History
  trendData: TrendPoint[];
  eventLog: LogEntry[];

  // Actions
  tick: () => void;
  administerBolus: (drugName: string, dose: number) => void;
  startInfusion: (drugName: string, rate: number) => void;
  stopInfusion: (drugName: string) => void;
  changeInfusionRate: (drugName: string, rate: number) => void;
  toggleRunning: () => void;
  setSpeed: (speed: number) => void;
  reset: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const initialPKStates: Record<string, PKState> = {};
for (const key of Object.keys(DRUG_DATABASE)) {
  initialPKStates[key] = createInitialPKState();
}

export const useSimStore = create<SimState>((set, get) => ({
  elapsedSeconds: 0,
  isRunning: false,
  speedMultiplier: 1,
  patient: { age: 45, weight: 70, height: 170, sex: 'M', asa: 2 },
  pkStates: { ...initialPKStates },
  infusions: {},
  vitals: { ...BASELINE_VITALS },
  moass: 5,
  combinedEff: 0,
  trendData: [],
  eventLog: [],

  tick: () => {
    const state = get();
    const dt = 1; // 1 second per tick
    const newPKStates: Record<string, PKState> = {};

    // Step each drug's PK model
    for (const [name, drug] of Object.entries(DRUG_DATABASE)) {
      const currentPK = state.pkStates[name] || createInitialPKState();
      const infusion = state.infusions[name];
      const infusionRate = infusion?.isRunning ? infusion.rate : 0;
      newPKStates[name] = stepPK(currentPK, drug, 0, infusionRate, dt);
    }

    // Calculate combined PD effect
    const drugEffects = Object.entries(DRUG_DATABASE).map(([name, drug]) => ({
      drug,
      ce: newPKStates[name].ce,
    })).filter(d => d.ce > 0.0001);

    const effect = combinedEffect(drugEffects);
    const moass = effectToMOASS(effect);
    const vitals = calculateVitals(effect);

    // Check alarms
    const alarms = checkAlarms(vitals);
    const newLogs = [...state.eventLog];
    for (const alarm of alarms) {
      if (state.elapsedSeconds % 10 === 0) {
        newLogs.push({
          time: state.elapsedSeconds + dt,
          type: 'alert',
          message: alarm,
          severity: 'danger',
        });
      }
    }

    // Record trend point every 5 seconds
    const newTrend = [...state.trendData];
    if ((state.elapsedSeconds + dt) % 5 === 0) {
      const ceRecord: Record<string, number> = {};
      for (const [name] of Object.entries(DRUG_DATABASE)) {
        ceRecord[name] = newPKStates[name].ce;
      }
      newTrend.push({
        time: state.elapsedSeconds + dt,
        vitals,
        ce: ceRecord,
        moass,
      });
    }

    set({
      elapsedSeconds: state.elapsedSeconds + dt,
      pkStates: newPKStates,
      vitals,
      moass,
      combinedEff: effect,
      trendData: newTrend,
      eventLog: newLogs,
    });
  },

  administerBolus: (drugName: string, dose: number) => {
    const state = get();
    const drug = DRUG_DATABASE[drugName];
    if (!drug) return;

    const currentPK = state.pkStates[drugName] || createInitialPKState();
    const newPK = stepPK(currentPK, drug, dose, 0, 0);

    set({
      pkStates: { ...state.pkStates, [drugName]: newPK },
      eventLog: [...state.eventLog, {
        time: state.elapsedSeconds,
        type: 'bolus',
        message: `${drug.name} ${dose}${drug.unit} bolus`,
        severity: 'info',
      }],
    });
  },

  startInfusion: (drugName: string, rate: number) => {
    const state = get();
    const drug = DRUG_DATABASE[drugName];
    if (!drug) return;

    set({
      infusions: {
        ...state.infusions,
        [drugName]: { drugName, rate, unit: `${drug.unit}/min`, isRunning: true },
      },
      eventLog: [...state.eventLog, {
        time: state.elapsedSeconds,
        type: 'infusion_start',
        message: `${drug.name} infusion started at ${rate} ${drug.unit}/min`,
        severity: 'info',
      }],
    });
  },

  stopInfusion: (drugName: string) => {
    const state = get();
    const drug = DRUG_DATABASE[drugName];
    const infusions = { ...state.infusions };
    if (infusions[drugName]) {
      infusions[drugName] = { ...infusions[drugName], isRunning: false };
    }
    set({
      infusions,
      eventLog: [...state.eventLog, {
        time: state.elapsedSeconds,
        type: 'infusion_stop',
        message: `${drug?.name || drugName} infusion stopped`,
        severity: 'info',
      }],
    });
  },

  changeInfusionRate: (drugName: string, rate: number) => {
    const state = get();
    const drug = DRUG_DATABASE[drugName];
    const infusions = { ...state.infusions };
    if (infusions[drugName]) {
      infusions[drugName] = { ...infusions[drugName], rate };
    }
    set({
      infusions,
      eventLog: [...state.eventLog, {
        time: state.elapsedSeconds,
        type: 'infusion_change',
        message: `${drug?.name || drugName} rate changed to ${rate}`,
        severity: 'info',
      }],
    });
  },

  toggleRunning: () => set((s) => ({ isRunning: !s.isRunning })),
  setSpeed: (speed: number) => set({ speedMultiplier: speed }),

  reset: () => set({
    elapsedSeconds: 0,
    isRunning: false,
    pkStates: { ...initialPKStates },
    infusions: {},
    vitals: { ...BASELINE_VITALS },
    moass: 5,
    combinedEff: 0,
    trendData: [],
    eventLog: [],
  }),
}));