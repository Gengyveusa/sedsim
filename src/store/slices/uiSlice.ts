import { StateCreator } from 'zustand';
import { PKState, LogEntry, TrendPoint, EmergencyState, AirwayDevice, InterventionType } from '../../types';
import { DrugParams } from '../../types';
import { DRUG_DATABASE } from '../../engine/drugs';
import { stepPK } from '../../engine/pkModel';
import { combinedEffect, effectToMOASS } from '../../engine/pdModel';
import { calculateVitals, checkAlarms, BASELINE_VITALS, IVFluidContext } from '../../engine/physiology';
import { generateEEG } from '../../engine/eegModel';
import { createDigitalTwin, updateTwin } from '../../engine/digitalTwin';
import { sessionRecorderInstance } from '../../engine/sessionRecorderInstance';
import { computeVisualizationState, DEFAULT_VIZ_STATE } from './vitalsSlice';
import { INITIAL_PK_STATES } from './drugSlice';
import { useQuantumStore } from '../useQuantumStore';
import type { SimStore } from '../storeTypes';

export interface UiSlice {
  // State
  elapsedSeconds: number;
  isRunning: boolean;
  speedMultiplier: number;
  activeTab: string;
  activeGaugeMode: string;
  userIdleSeconds: number;
  lastUserInteraction: number;

  // Actions
  tick: () => void;
  toggleRunning: () => void;
  setSpeed: (speed: number) => void;
  setActiveTab: (tab: string) => void;
  setActiveGaugeMode: (mode: string) => void;
  recordUserInteraction: () => void;
  reset: () => void;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const createUiSlice: StateCreator<SimStore, [], [], UiSlice> = (set, get) => ({
  elapsedSeconds: 0,
  isRunning: false,
  speedMultiplier: 1,
  activeTab: '',
  activeGaugeMode: 'petals',
  userIdleSeconds: 0,
  lastUserInteraction: Date.now(),

  tick: () => {
    const state = get();
    if (!state.isRunning) return;

    const { patient, pkStates, infusions, vitals: prevVitals, fio2 } = state;
    const dt = 1;

    // Step PK models forward
    const newPkStates: Record<string, PKState> = {};
    Object.keys(pkStates).forEach(drugName => {
      const drug = DRUG_DATABASE[drugName];
      const infusion = infusions[drugName];
      const infusionRate = infusion?.isRunning ? infusion.rate : 0;
      newPkStates[drugName] = stepPK(
        pkStates[drugName],
        drug,
        0,
        infusionRate,
        dt
      );
    });

    // --- Quantum Contextuality Layer ---
    // When enabled, modulate PK/PD values by quantum interference multipliers.
    // ke0 multiplier: scale effect-site concentration (faster/slower equilibration)
    // emax multiplier: scale combined effect magnitude
    // synergy multiplier: further modulate combined effect (interaction strength)
    const quantum = useQuantumStore.getState();
    if (quantum.isEnabled) {
      const qKe0 = quantum.multipliers.ke0;
      for (const drugName of Object.keys(newPkStates)) {
        // Scale ce toward c1 by the ke0 multiplier offset
        // A multiplier >1 means faster equilibration (ce closer to c1)
        // A multiplier <1 means slower equilibration (ce lags c1 more)
        const s = newPkStates[drugName];
        const delta = s.ce - s.c1;
        newPkStates[drugName] = {
          ...s,
          ce: s.c1 + delta * (2 - qKe0),
        };
      }
    }

    // Calculate combined drug effect
    const drugEffects: { drug: DrugParams; ce: number }[] = Object.entries(newPkStates).map(
      ([name, s]) => ({ drug: DRUG_DATABASE[name], ce: s.ce })
    );
    let combinedEff = combinedEffect(drugEffects);

    // Apply quantum emax and synergy multipliers to combined effect
    if (quantum.isEnabled) {
      combinedEff = Math.min(1, combinedEff * quantum.multipliers.emax * quantum.multipliers.synergy);
    }

    const moass = effectToMOASS(combinedEff);

    // Calculate new vitals using physiology engine
    const prevRhythm = prevVitals.rhythm ?? 'normal_sinus';
    const ivFluidContext: IVFluidContext = {
      totalInfused: state.ivFluids.totalInfused,
      isBolus: state.ivFluids.isBolus,
      bolusVolume: state.ivFluids.bolusVolume,
    };
    const newVitals = calculateVitals(
      newPkStates, patient, prevVitals, fio2, prevRhythm, state.elapsedSeconds,
      state.interventions, ivFluidContext
    );

    // Check for alarms
    const activeAlarms = checkAlarms(newVitals);

    // Derive rhythm early (needed by updateTwin and log processing)
    const newRhythm = newVitals.rhythm ?? 'normal_sinus';
    const newTime = state.elapsedSeconds + dt;

    // Update digital twin before trendPoint so compositeRisk is available
    const newDigitalTwin = updateTwin(
      state.digitalTwin || createDigitalTwin(patient),
      newPkStates,
      newVitals.hr,
      newVitals.spo2,
      dt,
      newRhythm,
      newVitals.sbp
    );

    // Update trend data
    const newTrendPoint: TrendPoint = {
      time: newTime,
      vitals: newVitals,
      cp: Object.fromEntries(Object.entries(newPkStates).map(([name, s]) => [name, s.c1])),
      ce: Object.fromEntries(
        Object.entries(newPkStates).map(([name, s]) => [name, s.ce])
      ),
      moass,
      riskScore: newDigitalTwin.predictedOutcome.compositeRisk,
    };

    const trendData = [...state.trendData, newTrendPoint];
    if (trendData.length > state.maxTrendPoints) {
      trendData.shift();
    }

    // Log alarms to event log
    const newLogs: LogEntry[] = [];
    activeAlarms.forEach(alarm => {
      const alreadyActive = state.activeAlarms.some(
        a => a.type === alarm.type && a.severity === alarm.severity
      );
      if (!alreadyActive) {
        newLogs.push({
          time: newTime,
          type: 'alert',
          message: alarm.message,
          severity: alarm.severity,
        });
      }
    });

    // Log rhythm changes
    if (newRhythm !== prevRhythm) {
      const isLethal = [
        'ventricular_fibrillation', 'ventricular_tachycardia', 'polymorphic_vt',
        'asystole', 'pea',
      ].includes(newRhythm);
      newLogs.push({
        time: newTime,
        type: 'alert',
        message: isLethal
          ? `🚨 ARRHYTHMIA: ${newRhythm.replace(/_/g, ' ').toUpperCase()}`
          : `RHYTHM CHANGE: ${prevRhythm.replace(/_/g, ' ')} → ${newRhythm.replace(/_/g, ' ')}`,
        severity: isLethal ? 'danger' : 'warning',
      });
    }

    // Generate EEG state
    const propCe = newPkStates['propofol']?.ce || 0;
    const dexCe = newPkStates['dexmedetomidine']?.ce || 0;
    const ketCe = newPkStates['ketamine']?.ce || 0;
    const midazCe = newPkStates['midazolam']?.ce || 0;
    const fentCe = newPkStates['fentanyl']?.ce || 0;
    const newEegState = generateEEG(propCe, dexCe, ketCe, midazCe, fentCe, patient.age, newTime, combinedEff, state.eegState ?? undefined);

    // Accumulate IV fluid infused
    const newIvFluids = { ...state.ivFluids };
    if (state.ivFluids.activeFluid && !state.ivFluids.isBolus && state.ivFluids.rate > 0) {
      newIvFluids.totalInfused = state.ivFluids.totalInfused + state.ivFluids.rate / 3600;
    }

    // Compute emergency state from alarms and rhythm
    const arrestRhythms = ['ventricular_fibrillation', 'ventricular_tachycardia', 'polymorphic_vt', 'asystole', 'pea'];
    const isArrest = arrestRhythms.includes(newRhythm);
    const hasDanger = activeAlarms.some(a => a.severity === 'danger');
    const hasWarning = activeAlarms.some(a => a.severity === 'warning');
    const newEmergencyState: EmergencyState = {
      level: isArrest ? 'arrest' : hasDanger ? 'critical' : hasWarning ? 'warning' : 'normal',
      activeAlarms,
      isArrest,
      requiresImmediateIntervention: isArrest || hasDanger,
    };

    // Pre-compute derived visualization state
    const vizState = computeVisualizationState(newVitals, newPkStates, patient, moass, combinedEff, fio2);

    const newUserIdleSeconds = state.userIdleSeconds + dt;

    // Record snapshot for session playback
    sessionRecorderInstance.record({
      t: newTime,
      vitals: newVitals,
      pkStates: newPkStates,
      moass,
      combinedEff,
      interventions: [...state.interventions] as InterventionType[],
      airwayDevice: state.airwayDevice,
      fio2,
      newEvents: newLogs,
      millieMessages: [],
    });

    set({
      elapsedSeconds: newTime,
      pkStates: newPkStates,
      combinedEff,
      moass,
      vitals: newVitals,
      trendData,
      eventLog: [...state.eventLog, ...newLogs],
      activeAlarms,
      eegState: newEegState,
      digitalTwin: newDigitalTwin,
      ivFluids: newIvFluids,
      emergencyState: newEmergencyState,
      userIdleSeconds: newUserIdleSeconds,
      ...vizState,
    });
  },

  toggleRunning: () => {
    set(state => ({ isRunning: !state.isRunning }));
  },

  setSpeed: (speed) => {
    set({ speedMultiplier: speed });
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab, lastUserInteraction: Date.now(), userIdleSeconds: 0 });
  },

  setActiveGaugeMode: (mode) => {
    set({ activeGaugeMode: mode, lastUserInteraction: Date.now(), userIdleSeconds: 0 });
  },

  recordUserInteraction: () => {
    set({ lastUserInteraction: Date.now(), userIdleSeconds: 0 });
  },

  reset: () => {
    // Clear the session recorder so a new recording starts fresh
    sessionRecorderInstance.clear();
    const state = get();
    const patient = state.patient;
    set({
      elapsedSeconds: 0,
      isRunning: false,
      isScenarioActive: false,
      scenarioDrugProtocols: null,
      pkStates: { ...INITIAL_PK_STATES },
      infusions: {},
      vitals: BASELINE_VITALS,
      moass: 5,
      combinedEff: 0,
      fio2: 0.21,
      airwayDevice: 'room_air' as AirwayDevice,
      o2FlowRate: 2,
      trendData: [],
      eventLog: [],
      activeAlarms: [],
      eegState: null,
      digitalTwin: createDigitalTwin(patient),
      ivFluids: {
        activeFluid: null,
        rate: 0,
        location: 'Right Hand',
        gauge: '20G',
        totalInfused: 0,
        isBolus: false,
        bolusVolume: 0,
      },
      emergencyState: {
        level: 'normal',
        activeAlarms: [],
        isArrest: false,
        requiresImmediateIntervention: false,
      },
      activeTab: '',
      activeGaugeMode: 'petals',
      userIdleSeconds: 0,
      lastUserInteraction: Date.now(),
      lastDrugAdministered: null,
      lastInterventionApplied: null,
      drugsAdministeredCount: 0,
      ...DEFAULT_VIZ_STATE,
    });
  },
});
