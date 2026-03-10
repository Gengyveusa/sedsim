import { StateCreator } from 'zustand';
import { Patient, Vitals, LogEntry } from '../../types';
import { PATIENT_ARCHETYPES, BASELINE_VITALS } from '../../engine/physiology';
import { createDigitalTwin } from '../../engine/digitalTwin';
import type { SimStore } from '../storeTypes';

export interface DrugProtocol {
  name: string;
  route: string;
  typicalBolusRange: [number, number];
  maxTotalDose: number;
  unit: string;
}

export interface TrueNorth {
  archetypeKey: string;
  patient: Patient;
  baselineVitals: Vitals;
  label: string;
  isLocked: boolean;
}

export interface PatientSlice {
  // State
  patient: Patient;
  archetypeKey: string;
  selectedArchetypeKey: string;
  trueNorth: TrueNorth;
  isScenarioActive: boolean;
  scenarioDrugProtocols: DrugProtocol[] | null;
  availableArchetypes: string[];

  // Actions
  selectPatient: (archetypeKey: string) => void;
  setTrueNorth: (trueNorth: TrueNorth) => void;
  setTrueNorthLocked: (locked: boolean) => void;
  setScenarioActive: (active: boolean) => void;
  setScenarioDrugProtocols: (protocols: DrugProtocol[] | null) => void;
}

export function buildTrueNorthLabel(archetypeKey: string, patient: Patient): string {
  const name = archetypeKey
    .split('_')
    .map((w: string) => {
      const abbrevs: Record<string, string> = { hcm: 'HCM', dcm: 'DCM', osa: 'OSA' };
      return abbrevs[w] || (w.charAt(0).toUpperCase() + w.slice(1));
    })
    .join(' ');
  return `${name} (${patient.age}y, ${patient.weight}kg, ASA ${patient.asa})`;
}

export function buildTrueNorth(archetypeKey: string, patient: Patient, isLocked = false): TrueNorth {
  return {
    archetypeKey,
    patient,
    baselineVitals: BASELINE_VITALS,
    label: buildTrueNorthLabel(archetypeKey, patient),
    isLocked,
  };
}

export const createPatientSlice: StateCreator<SimStore, [], [], PatientSlice> = (set, get) => ({
  patient: PATIENT_ARCHETYPES.healthy_adult,
  archetypeKey: 'healthy_adult',
  selectedArchetypeKey: 'healthy_adult',
  trueNorth: buildTrueNorth('healthy_adult', PATIENT_ARCHETYPES.healthy_adult),
  isScenarioActive: false,
  scenarioDrugProtocols: null,
  availableArchetypes: Object.keys(PATIENT_ARCHETYPES),

  selectPatient: (archetypeKey) => {
    const patient = PATIENT_ARCHETYPES[archetypeKey];
    if (!patient) return;

    const logEntry: LogEntry = {
      time: get().elapsedSeconds,
      type: 'intervention',
      message: `Patient changed to: ${archetypeKey.replace('_', ' ')}`,
      severity: 'info',
    };

    set(state => ({
      patient,
      archetypeKey,
      selectedArchetypeKey: archetypeKey,
      trueNorth: buildTrueNorth(archetypeKey, patient, state.trueNorth.isLocked),
      digitalTwin: createDigitalTwin(patient),
      eventLog: [...state.eventLog, logEntry],
    }));
  },

  setTrueNorth: (trueNorth) => {
    set({ trueNorth });
  },

  setTrueNorthLocked: (locked) => {
    set(state => ({ trueNorth: { ...state.trueNorth, isLocked: locked } }));
  },

  setScenarioActive: (active) => {
    set({ isScenarioActive: active });
  },

  setScenarioDrugProtocols: (protocols) => {
    set({ scenarioDrugProtocols: protocols });
  },
});
