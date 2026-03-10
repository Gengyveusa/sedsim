import { StateCreator } from 'zustand';
import { PKState, InfusionState, LogEntry } from '../../types';
import { DRUG_DATABASE } from '../../engine/drugs';
import { createInitialPKState, stepPK } from '../../engine/pkModel';
import type { SimStore } from '../storeTypes';

export interface IVFluidState {
  activeFluid: string | null;
  rate: number; // mL/hr
  location: string;
  gauge: string;
  totalInfused: number; // mL
  isBolus: boolean;
  bolusVolume: number;
}

export interface DrugSlice {
  // State
  pkStates: Record<string, PKState>;
  infusions: Record<string, InfusionState>;
  ivFluids: IVFluidState;
  lastDrugAdministered: { name: string; dose: number; timestamp: number } | null;
  drugsAdministeredCount: number;

  // Actions
  administerBolus: (drugName: string, dose: number) => void;
  startInfusion: (drugName: string, rate: number) => void;
  stopInfusion: (drugName: string) => void;
  changeInfusionRate: (drugName: string, rate: number) => void;
  startIVFluid: (fluid: string, rate: number, isBolus: boolean, bolusVolume: number) => void;
  stopIVFluid: () => void;
  setIVAccess: (location: string, gauge: string) => void;
}

export const INITIAL_PK_STATES: Record<string, PKState> = {
  propofol: createInitialPKState(),
  midazolam: createInitialPKState(),
  fentanyl: createInitialPKState(),
  ketamine: createInitialPKState(),
  dexmedetomidine: createInitialPKState(),
  lidocaine_epi: createInitialPKState(),
  articaine_epi: createInitialPKState(),
  bupivacaine: createInitialPKState(),
};

export const createDrugSlice: StateCreator<SimStore, [], [], DrugSlice> = (set, get) => ({
  pkStates: { ...INITIAL_PK_STATES },
  infusions: {},
  ivFluids: {
    activeFluid: null,
    rate: 0,
    location: 'Right Hand',
    gauge: '20G',
    totalInfused: 0,
    isBolus: false,
    bolusVolume: 0,
  },
  lastDrugAdministered: null,
  drugsAdministeredCount: 0,

  administerBolus: (drugName, dose) => {
    const state = get();
    const drug = DRUG_DATABASE[drugName];

    const newState = stepPK(
      state.pkStates[drugName],
      drug,
      dose,
      0,
      1
    );

    const logEntry: LogEntry = {
      time: state.elapsedSeconds,
      type: 'bolus',
      message: `${drug.name} ${dose} ${drug.unit} bolus`,
      severity: 'info',
    };

    set({
      pkStates: { ...state.pkStates, [drugName]: newState },
      eventLog: [...state.eventLog, logEntry],
      lastDrugAdministered: { name: drug.name, dose, timestamp: Date.now() },
      drugsAdministeredCount: state.drugsAdministeredCount + 1,
      lastUserInteraction: Date.now(),
      userIdleSeconds: 0,
    });
  },

  startInfusion: (drugName, rate) => {
    const state = get();
    const drug = DRUG_DATABASE[drugName];

    const logEntry: LogEntry = {
      time: state.elapsedSeconds,
      type: 'infusion_start',
      message: `${drug.name} infusion started at ${rate} mcg/kg/min`,
      severity: 'info',
    };

    set({
      infusions: {
        ...state.infusions,
        [drugName]: { drugName: drug.name, rate, unit: 'mcg/kg/min', isRunning: true },
      },
      eventLog: [...state.eventLog, logEntry],
    });
  },

  stopInfusion: (drugName) => {
    const state = get();
    const infusion = state.infusions[drugName];
    if (!infusion) return;

    const logEntry: LogEntry = {
      time: state.elapsedSeconds,
      type: 'infusion_stop',
      message: `${infusion.drugName} infusion stopped`,
      severity: 'info',
    };

    const newInfusions = { ...state.infusions };
    delete newInfusions[drugName];

    set({
      infusions: newInfusions,
      eventLog: [...state.eventLog, logEntry],
    });
  },

  changeInfusionRate: (drugName, rate) => {
    const state = get();
    const infusion = state.infusions[drugName];
    if (!infusion) return;

    const logEntry: LogEntry = {
      time: state.elapsedSeconds,
      type: 'infusion_change',
      message: `${infusion.drugName} infusion changed to ${rate} mcg/kg/min`,
      severity: 'info',
    };

    set({
      infusions: {
        ...state.infusions,
        [drugName]: { ...infusion, rate },
      },
      eventLog: [...state.eventLog, logEntry],
    });
  },

  startIVFluid: (fluid, rate, isBolus, bolusVolume) => {
    const state = get();
    const location = state.ivFluids.location;
    const gauge = state.ivFluids.gauge;
    const message = isBolus
      ? `[IV] ${fluid} ${bolusVolume}mL bolus started (${location} ${gauge})`
      : `[IV] ${fluid} ${rate} mL/hr started (${location} ${gauge})`;
    set({
      ivFluids: {
        ...state.ivFluids,
        activeFluid: fluid,
        rate,
        isBolus,
        bolusVolume,
        totalInfused: isBolus ? state.ivFluids.totalInfused + bolusVolume : state.ivFluids.totalInfused,
      },
      eventLog: [...state.eventLog, { time: state.elapsedSeconds, type: 'intervention', message, severity: 'info' }],
    });
  },

  stopIVFluid: () => {
    const state = get();
    if (!state.ivFluids.activeFluid) return;
    set({
      ivFluids: { ...state.ivFluids, activeFluid: null, rate: 0, isBolus: false, bolusVolume: 0 },
      eventLog: [...state.eventLog, { time: state.elapsedSeconds, type: 'intervention', message: `[IV] ${state.ivFluids.activeFluid} stopped`, severity: 'info' }],
    });
  },

  setIVAccess: (location, gauge) => {
    const state = get();
    set({ ivFluids: { ...state.ivFluids, location, gauge } });
  },
});
