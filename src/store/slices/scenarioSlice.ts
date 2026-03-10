import { StateCreator } from 'zustand';
import { InterventionType, AirwayDevice, LogEntry } from '../../types';
import type { SimStore } from '../storeTypes';

export interface ScenarioSlice {
  // State
  interventions: Set<InterventionType>;
  fio2: number;
  airwayDevice: AirwayDevice;
  o2FlowRate: number;
  lastInterventionApplied: string | null;

  // Actions
  applyIntervention: (intervention: InterventionType) => void;
  removeIntervention: (intervention: InterventionType) => void;
  setFiO2: (fio2: number) => void;
  setAirwayDevice: (device: AirwayDevice) => void;
  setO2FlowRate: (rate: number) => void;
}

export const createScenarioSlice: StateCreator<SimStore, [], [], ScenarioSlice> = (set, get) => ({
  interventions: new Set<InterventionType>(),
  fio2: 0.21,
  airwayDevice: 'room_air' as AirwayDevice,
  o2FlowRate: 2,
  lastInterventionApplied: null,

  applyIntervention: (intervention) => {
    const state = get();
    const newInterventions = new Set(state.interventions);
    newInterventions.add(intervention);

    const logEntry: LogEntry = {
      time: state.elapsedSeconds,
      type: 'intervention',
      message: `Applied: ${intervention.replace('_', ' ')}`,
      severity: 'info',
    };

    set({
      interventions: newInterventions,
      eventLog: [...state.eventLog, logEntry],
      lastInterventionApplied: intervention,
      lastUserInteraction: Date.now(),
      userIdleSeconds: 0,
    });
  },

  removeIntervention: (intervention) => {
    const state = get();
    const newInterventions = new Set(state.interventions);
    newInterventions.delete(intervention);

    const logEntry: LogEntry = {
      time: state.elapsedSeconds,
      type: 'intervention',
      message: `Removed: ${intervention.replace('_', ' ')}`,
      severity: 'info',
    };

    set({
      interventions: newInterventions,
      eventLog: [...state.eventLog, logEntry],
    });
  },

  setFiO2: (fio2) => {
    const state = get();

    const logEntry: LogEntry = {
      time: state.elapsedSeconds,
      type: 'intervention',
      message: `FiO2 changed to ${Math.round(fio2 * 100)}%`,
      severity: 'info',
    };

    set({
      fio2,
      eventLog: [...state.eventLog, logEntry],
    });
  },

  setAirwayDevice: (device) => {
    const state = get();

    const deviceFiO2Defaults: Record<AirwayDevice, number> = {
      room_air: 0.21,
      nasal_cannula: 0.21 + 0.04 * state.o2FlowRate,
      nasal_hood: 0.40,
      oral_airway: 0.21,
      nasal_airway: 0.21,
      lma: 0.60,
      ett: 1.00,
      cricothyroidotomy: 1.00,
      tracheostomy: 1.00,
    };

    const newFio2 = deviceFiO2Defaults[device];

    const logEntry: LogEntry = {
      time: state.elapsedSeconds,
      type: 'intervention',
      message: `Airway: ${device.replace(/_/g, ' ')} — FiO2 auto-set to ${Math.round(newFio2 * 100)}%`,
      severity: 'info',
    };

    set({
      airwayDevice: device,
      fio2: newFio2,
      eventLog: [...state.eventLog, logEntry],
    });
  },

  setO2FlowRate: (rate) => {
    const state = get();
    const clampedRate = Math.max(1, Math.min(6, rate));

    let updates: Partial<SimStore> = { o2FlowRate: clampedRate };
    if (state.airwayDevice === 'nasal_cannula') {
      const newFio2 = Math.min(0.44, 0.21 + 0.04 * clampedRate);
      updates = { ...updates, fio2: newFio2 };
    }

    set(updates);
  },
});
