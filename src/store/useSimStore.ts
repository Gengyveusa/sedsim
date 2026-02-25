import { create } from 'zustand';
import { PKState, Vitals, MOASSLevel, LogEntry, Patient, TrendPoint, DrugParams, InfusionState, InterventionType, AirwayDevice, EmergencyState, EchoParams, FrankStarlingPoint, OxyHbPoint, AvatarState, WaveformParams } from '../types';
import { DRUG_DATABASE } from '../engine/drugs';
import { createInitialPKState, stepPK } from '../engine/pkModel';
import { combinedEffect, effectToMOASS } from '../engine/pdModel';
import { calculateVitals, checkAlarms, BASELINE_VITALS, PATIENT_ARCHETYPES, IVFluidContext } from '../engine/physiology';
import { generateEEG, EEGState } from '../engine/eegModel';
import { DigitalTwin, createDigitalTwin, updateTwin } from '../engine/digitalTwin';

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

function buildTrueNorthLabel(archetypeKey: string, patient: Patient): string {
  const name = archetypeKey
    .split('_')
    .map((w: string) => {
      const abbrevs: Record<string, string> = { hcm: 'HCM', dcm: 'DCM', osa: 'OSA' };
      return abbrevs[w] || (w.charAt(0).toUpperCase() + w.slice(1));
    })
    .join(' ');
  return `${name} (${patient.age}y, ${patient.weight}kg, ASA ${patient.asa})`;
}

function buildTrueNorth(archetypeKey: string, patient: Patient, isLocked = false): TrueNorth {
  return {
    archetypeKey,
    patient,
    baselineVitals: BASELINE_VITALS,
    label: buildTrueNorthLabel(archetypeKey, patient),
    isLocked,
  };
}

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

  // SimMaster user behavior tracking
  activeTab: string;
  activeGaugeMode: string;
  userIdleSeconds: number;
  lastUserInteraction: number;
  lastDrugAdministered: { name: string; dose: number; timestamp: number } | null;
  lastInterventionApplied: string | null;
  drugsAdministeredCount: number;

  // Patient
  patient: Patient;
  archetypeKey: string;
  selectedArchetypeKey: string;
  trueNorth: TrueNorth;
  isScenarioActive: boolean;
  scenarioDrugProtocols: DrugProtocol[] | null;
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

  // Emergency state (derived from alarms + rhythm)
  emergencyState: EmergencyState;

  // Derived visualization state (pre-computed in tick() for pure component consumption)
  echoParams: EchoParams;
  frankStarlingPoint: FrankStarlingPoint;
  oxyHbPoint: OxyHbPoint;
  avatarState: AvatarState;
  waveformParams: WaveformParams;

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
  setTrueNorth: (trueNorth: TrueNorth) => void;
  setTrueNorthLocked: (locked: boolean) => void;
  setScenarioActive: (active: boolean) => void;
  setScenarioDrugProtocols: (protocols: DrugProtocol[] | null) => void;
  applyIntervention: (intervention: InterventionType) => void;
  removeIntervention: (intervention: InterventionType) => void;
  setFiO2: (fio2: number) => void;
  setAirwayDevice: (device: AirwayDevice) => void;
  setO2FlowRate: (rate: number) => void;
  startIVFluid: (fluid: string, rate: number, isBolus: boolean, bolusVolume: number) => void;
  stopIVFluid: () => void;
  setIVAccess: (location: string, gauge: string) => void;
  logEvent: (message: string, type?: LogEntry['type'], severity?: LogEntry['severity']) => void;
  overrideVital: (parameter: string, value: number) => void;
  setActiveTab: (tab: string) => void;
  setActiveGaugeMode: (mode: string) => void;
  recordUserInteraction: () => void;
  reset: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Compute pre-derived visualization parameters from current sim state.
 * Called once per tick so all components are pure consumers of store state.
 */
function computeVisualizationState(
  vitals: Vitals,
  pkStates: Record<string, PKState>,
  patient: Patient,
  moass: MOASSLevel,
  combinedEff: number,
  fio2: number,
): { echoParams: EchoParams; frankStarlingPoint: FrankStarlingPoint; oxyHbPoint: OxyHbPoint; avatarState: AvatarState; waveformParams: WaveformParams } {
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

  if (propCe > 0) { ees -= propCe * 0.15; peakSys -= propCe * 5; }
  if (midazCe > 0) { ees -= midazCe * 0.05; }
  if (fentCe > 0) { ees -= fentCe * 0.2; peakSys -= fentCe * 3; }
  if (ketCe > 0) { ees += ketCe * 0.1; peakSys += ketCe * 4; }

  if (moass >= 4) { ees -= 0.3; peakSys -= 15; }
  else if (moass >= 2) { ees -= 0.15; peakSys -= 8; }
  ees -= combinedEff * 0.08;

  ees = Math.max(0.8, Math.min(4.0, ees));
  edpScale = Math.max(0.5, Math.min(3.0, edpScale));
  vedv = Math.max(90, Math.min(160, vedv));
  peakSys = Math.max(60, Math.min(200, peakSys));

  const vesv = Math.max(30, Math.min(vedv - 20, peakSys / ees + 5));
  const sv = vedv - vesv;
  const ef = (sv / vedv) * 100;
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
const DEFAULT_VIZ_STATE = computeVisualizationState(
  { hr: 75, sbp: 120, dbp: 80, map: 93, rr: 14, spo2: 98, etco2: 38 },
  {},
  PATIENT_ARCHETYPES.healthy_adult,
  5 as MOASSLevel,
  0,
  0.21,
);

const useSimStore = create<SimState>((set, get) => ({
  // Initial state
  elapsedSeconds: 0,
  isRunning: false,
  speedMultiplier: 1,

  // SimMaster user behavior tracking
  activeTab: '',
  activeGaugeMode: 'petals',
  userIdleSeconds: 0,
  lastUserInteraction: Date.now(),
  lastDrugAdministered: null,
  lastInterventionApplied: null,
  drugsAdministeredCount: 0,

  patient: PATIENT_ARCHETYPES.healthy_adult,
  archetypeKey: 'healthy_adult',
  selectedArchetypeKey: 'healthy_adult',
  trueNorth: buildTrueNorth('healthy_adult', PATIENT_ARCHETYPES.healthy_adult),
  isScenarioActive: false,
  scenarioDrugProtocols: null,
  availableArchetypes: Object.keys(PATIENT_ARCHETYPES),

  pkStates: {
    propofol: createInitialPKState(),
    midazolam: createInitialPKState(),
    fentanyl: createInitialPKState(),
    ketamine: createInitialPKState(),
    dexmedetomidine: createInitialPKState(),
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

  emergencyState: {
    level: 'normal',
    activeAlarms: [],
    isArrest: false,
    requiresImmediateIntervention: false,
  },

  ...DEFAULT_VIZ_STATE,

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
    // Generate EEG state from combinedEff (accounts for drug synergies) + individual CEs for drug-specific features
    const propCe = newPkStates['propofol']?.ce || 0;
    const dexCe = newPkStates['dexmedetomidine']?.ce || 0;
    const ketCe = newPkStates['ketamine']?.ce || 0;
    const midazCe = newPkStates['midazolam']?.ce || 0;
    const fentCe = newPkStates['fentanyl']?.ce || 0;
    const newEegState = generateEEG(propCe, dexCe, ketCe, midazCe, fentCe, patient.age, newTime, combinedEff, state.eegState ?? undefined);

    // Update digital twin with current PK states
    const newDigitalTwin = updateTwin(
      state.digitalTwin || createDigitalTwin(patient),
      newPkStates,
      newVitals.hr,
      newVitals.spo2,
      dt,
      newRhythm,
      newVitals.sbp
    );

    // Accumulate IV fluid infused (rate is mL/hr, dt is 1 second -> mL/3600)
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

    // Pre-compute derived visualization state (all components are pure consumers)
    const vizState = computeVisualizationState(newVitals, newPkStates, patient, moass, combinedEff, fio2);

    // Update userIdleSeconds
    const newUserIdleSeconds = state.userIdleSeconds + dt;

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
    const state = get();
    const patient = state.patient;
    set({
      elapsedSeconds: 0,
      isRunning: false,
      isScenarioActive: false,
      scenarioDrugProtocols: null,
      pkStates: {
        propofol: createInitialPKState(),
        midazolam: createInitialPKState(),
        fentanyl: createInitialPKState(),
        ketamine: createInitialPKState(),
        dexmedetomidine: createInitialPKState(),
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
}));

export default useSimStore;
export { formatTime };
