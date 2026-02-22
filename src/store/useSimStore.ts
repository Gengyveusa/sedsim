import { create } from 'zustand';
import { PKState, Vitals, MOASSLevel, LogEntry, Patient, TrendPoint, DrugParams, InfusionState, InterventionType, AirwayDevice } from '../types';
import { DRUG_DATABASE } from '../engine/drugs';
import { createInitialPKState, stepPK } from '../engine/pkModel';
import { combinedEffect, effectToMOASS } from '../engine/pdModel';
import { calculateVitals, checkAlarms, BASELINE_VITALS, PATIENT_ARCHETYPES } from '../engine/physiology';
import { generateEEG, EEGState } from '../engine/eegModel';
import { DigitalTwin, createDigitalTwin, updateTwin } from '../engine/digitalTwin';

export interface IVFluidState {
  activeFluid: string | null;
  rate: number; // mL/hr
  location: string;
  gauge: string;
  totalInfused: number; // mL
  isBolus: boolean;
  bolusVolume: number;
}

interface SimState {
  // Time
  elapsedSeconds: number;
  isRunning: boolean;
  speedMultiplier: number;

  // Patient
  patient: Patient;
  archetypeKey: string;
  selectedArchetypeKey: string;
  isPatientLocked: boolean;
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
  airwayDevice: AirwayDevice;
  o2FlowRate: number; // L/min, used for nasal cannula

  // History for trend graphs (keep last 10 minutes = 600 points at 1 Hz)
  trendData: TrendPoint[];
  maxTrendPoints: number;
  eventLog: LogEntry[];

  // Alarms
  activeAlarms: { type: string; message: string; severity: 'warning' | 'danger' }[];

  // EEG state (updated every tick)
  eegState: EEGState | null;

  // Digital Twin (risk predictions)
  digitalTwin: DigitalTwin | null;

  // IV Fluids
  ivFluids: IVFluidState;

  // Actions
  tick: () => void;
  administerBolus: (drugName: string, dose: number) => void;
  startInfusion: (drugName: string, rate: number) => void;
  stopInfusion: (drugName: string) => void;
  changeInfusionRate: (drugName: string, rate: number) => void;
  toggleRunning: () => void;
  setSpeed: (speed: number) => void;
  selectPatient: (archetypeKey: string) => void;
  setPatientLocked: (locked: boolean) => void;
  applyIntervention: (intervention: InterventionType) => void;
  removeIntervention: (intervention: InterventionType) => void;
  setFiO2: (fio2: number) => void;
  setAirwayDevice: (device: AirwayDevice) => void;
  setO2FlowRate: (rate: number) => void;
  startIVFluid: (fluid: string, rate: number, isBolus: boolean, bolusVolume: number) => void;
  stopIVFluid: () => void;
  setIVAccess: (location: string, gauge: string) => void;
  logEvent: (message: string, type?: LogEntry['type'], severity?: LogEntry['severity']) => void;
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
  archetypeKey: 'healthy_adult',
  selectedArchetypeKey: 'healthy_adult',
  isPatientLocked: false,
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
  airwayDevice: 'room_air' as AirwayDevice,
  o2FlowRate: 2,

  trendData: [],
  maxTrendPoints: 600,
  eventLog: [],
  activeAlarms: [],

  eegState: null,
  digitalTwin: createDigitalTwin(PATIENT_ARCHETYPES.healthy_adult),

  ivFluids: {
    activeFluid: null,
    rate: 0,
    location: 'Right Hand',
    gauge: '20G',
    totalInfused: 0,
    isBolus: false,
    bolusVolume: 0,
  },

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
    const prevRhythm = prevVitals.rhythm ?? 'normal_sinus';
    const newVitals = calculateVitals(newPkStates, patient, prevVitals, fio2, prevRhythm, state.elapsedSeconds);

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

    // Log rhythm changes
    const newRhythm = newVitals.rhythm ?? 'normal_sinus';
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
    // Generate EEG state from effect-site concentrations
    const propCe = newPkStates['propofol']?.ce || 0;
    const dexCe = newPkStates['dexmedetomidine']?.ce || 0;
    const ketCe = newPkStates['ketamine']?.ce || 0;
    const midazCe = newPkStates['midazolam']?.ce || 0;
    const fentCe = newPkStates['fentanyl']?.ce || 0;
    const newEegState = generateEEG(propCe, dexCe, ketCe, midazCe, fentCe, patient.age, newTime, state.eegState ?? undefined);

    // Update digital twin with current PK states
    const newDigitalTwin = updateTwin(
      state.digitalTwin || createDigitalTwin(patient),
      newPkStates,
      newVitals.hr,
      newVitals.spo2,
      dt,
      newRhythm
    );

    // Accumulate IV fluid infused (rate is mL/hr, dt is 1 second -> mL/3600)
    const newIvFluids = { ...state.ivFluids };
    if (state.ivFluids.activeFluid && !state.ivFluids.isBolus && state.ivFluids.rate > 0) {
      newIvFluids.totalInfused = state.ivFluids.totalInfused + state.ivFluids.rate / 3600;
    }

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
      archetypeKey,
      selectedArchetypeKey: archetypeKey,
      digitalTwin: createDigitalTwin(patient),
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

  setAirwayDevice: (device) => {
    const state = get();

    // Auto-set FiO2 based on device defaults
    const deviceFiO2Defaults: Record<AirwayDevice, number> = {
      room_air: 0.21,
      nasal_cannula: 0.21 + 0.04 * state.o2FlowRate, // dynamic based on flow
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

    // If nasal cannula is selected, auto-update FiO2
    let updates: Partial<typeof state> = { o2FlowRate: clampedRate };
    if (state.airwayDevice === 'nasal_cannula') {
      const newFio2 = Math.min(0.44, 0.21 + 0.04 * clampedRate);
      updates = { ...updates, fio2: newFio2 };
    }

    set(updates);
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

  setPatientLocked: (locked) => {
    set({ isPatientLocked: locked });
  },

  logEvent: (message, type = 'intervention', severity = 'info') => {
    const state = get();
    set({
      eventLog: [...state.eventLog, { time: state.elapsedSeconds, type, message, severity }],
    });
  },

  reset: () => {
    const patient = get().patient;
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
    });
  },
}));

export default useSimStore;
export { formatTime };
