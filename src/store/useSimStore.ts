import { create } from 'zustand';
import { PKState, Vitals, MOASSLevel, LogEntry, Patient, TrendPoint, DrugParams, InfusionState, InterventionType } from '../types';
import { DRUG_DATABASE } from '../engine/drugs';
import { createInitialPKState, stepPK } from '../engine/pkModel';
import { combinedEffect, effectToMOASS } from '../engine/pdModel';
import { calculateVitals, checkAlarms, BASELINE_VITALS, PATIENT_ARCHETYPES } from '../engine/physiology';

interface SimState {
  // Time
  elapsedSeconds: number;
  isRunning: boolean;
  speedMultiplier: number;

  // Patient
  patient: Patient;
  availableArchetypes: string[];

  // Drug PK states
  pkStates: Record<string, PKState>;

  // Active infusions
  infusions: Record<string, InfusionState>;

  // Current vitals & sedation
  vitals: Vitals;
  moass: MOASSLevel;
  combinedEff: number;

  // Interventions
  interventions: Set<InterventionType>;
  fio2: number; // 0.21-1.0

  // History for trend graphs (keep last 10 minutes = 600 points at 1 Hz)
  trendData: TrendPoint[];
  maxTrendPoints: number;
  eventLog: LogEntry[];

  // Alarms
  activeAlarms: { type: string; message: string; severity: 'warning' | 'danger' }[];

  // Actions
  tick: () => void;
  administerBolus: (drugName: string, dose: number) => void;
  startInfusion: (drugName: string, rate: number) => void;
  stopInfusion: (drugName: string) => void;
  changeInfusionRate: (drugName: string, rate: number) => void;
  toggleRunning: () => void;
  setSpeed: (speed: number) => void;
  selectPatient: (archetypeKey: string) => void;
  applyIntervention: (intervention: InterventionType) => void;
  removeIntervention: (intervention: InterventionType) => void;
  setFiO2: (fio2: number) => void;
  reset: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const useSimStore = create<SimState>((set, get) => ({
  // Initial state
  elapsedSeconds: 0,
  isRunning: false,
  speedMultiplier: 1,

  patient: PATIENT_ARCHETYPES.healthy_adult,
  availableArchetypes: Object.keys(PATIENT_ARCHETYPES),

  pkStates: {
    propofol: createInitialPKState(),
    midazolam: createInitialPKState(),
    fentanyl: createInitialPKState(),
    ketamine: createInitialPKState(),
        lidocaine_epi: createInitialPKState(),
    articaine_epi: createInitialPKState(),
    bupivacaine: createInitialPKState(),
  },

  infusions: {},

  vitals: BASELINE_VITALS,
  moass: 5,
  combinedEff: 0,

  interventions: new Set(),
  fio2: 0.21,

  trendData: [],
  maxTrendPoints: 600,
  eventLog: [],

  activeAlarms: [],

  // Tick function - runs every simulation second
  tick: () => {
    const state = get();
    if (!state.isRunning) return;

    const { patient, pkStates, infusions, vitals: prevVitals, fio2 } = state;
    const dt = 1; // 1 second

    // Step PK models forward
    const newPkStates: Record<string, PKState> = {};
    Object.keys(pkStates).forEach(drugName => {
      const drug = DRUG_DATABASE[drugName];
      const infusion = infusions[drugName];
      const infusionRate = infusion?.isRunning ? infusion.rate : 0;

      newPkStates[drugName] = stepPK(
        pkStates[drugName],
        drug,
        0, // no bolus during tick
        infusionRate,
        dt
      );
    });

    // Calculate combined drug effect
    const drugEffects: { drug: DrugParams; ce: number }[] = Object.entries(newPkStates).map(
      ([name, state]) => ({ drug: DRUG_DATABASE[name], ce: state.ce })
    );
    const combinedEff = combinedEffect(drugEffects);
    const moass = effectToMOASS(combinedEff);

    // Calculate new vitals using physiology engine
    const newVitals = calculateVitals(newPkStates, patient, prevVitals, fio2);

    // Check for alarms
    const activeAlarms = checkAlarms(newVitals);

    // Update trend data
    const newTime = state.elapsedSeconds + dt;
    const newTrendPoint: TrendPoint = {
      time: newTime,
      vitals: newVitals,
            cp: Object.fromEntries(Object.entries(newPkStates).map(([name, s]) => [name, s.c1])),
      ce: Object.fromEntries(
        Object.entries(newPkStates).map(([name, state]) => [name, state.ce])
      ),
      moass,
    };

    const trendData = [...state.trendData, newTrendPoint];
    // Keep only last maxTrendPoints
    if (trendData.length > state.maxTrendPoints) {
      trendData.shift();
    }

    // Log alarms to event log
    const newLogs: LogEntry[] = [];
    activeAlarms.forEach(alarm => {
      // Only log if not already in active alarms (new alarm)
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

    set({
      elapsedSeconds: newTime,
      pkStates: newPkStates,
      combinedEff,
      moass,
      vitals: newVitals,
      trendData,
      eventLog: [...state.eventLog, ...newLogs],
      activeAlarms,
    });
  },

  administerBolus: (drugName, dose) => {
    const state = get();
    const drug = DRUG_DATABASE[drugName];

    // Step PK forward with bolus
    const newState = stepPK(
              state.pkStates[drugName],
      drug,
            dose, // flat dose in mg (or mcg for fentanyl)
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

  toggleRunning: () => {
    set(state => ({ isRunning: !state.isRunning }));
  },

  setSpeed: (speed) => {
    set({ speedMultiplier: speed });
  },

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
      eventLog: [...state.eventLog, logEntry],
    }));
  },

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

  reset: () => {
    set({
      elapsedSeconds: 0,
      isRunning: false,
      pkStates: {
        propofol: createInitialPKState(),
        midazolam: createInitialPKState(),
        fentanyl: createInitialPKState(),
        ketamine: createInitialPKState(),
                lidocaine_epi: createInitialPKState(),
                articaine_epi: createInitialPKState(),
                bupivacaine: createInitialPKState(),
      },
      infusions: {},
      vitals: BASELINE_VITALS,
      moass: 5,
      combinedEff: 0,
      fio2: 0.21,
      trendData: [],
      eventLog: [],
      activeAlarms: [],
    });
  },
}));

export default useSimStore;
export { formatTime };
