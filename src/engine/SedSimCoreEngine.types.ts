// src/engine/SedSimCoreEngine.types.ts
// SedSim-Core: Physio/PK-PD Engine interface definitions

export type Sex = "male" | "female";
export type ASAClass = 1 | 2 | 3 | 4;
export type AirwayRisk = "low" | "moderate" | "high";

export interface PatientArchetype {
  id: string;
  label: string;
  ageYears: number;
  weightKg: number;
  sex: Sex;
  asaClass: ASAClass;
  airwayRisk: AirwayRisk;
  cardiopulmonaryFrailty: number;
  pkPdSensitivity: number;
}

export type DrugName = "midazolam" | "fentanyl" | "propofol" | "ketamine" | "dexmedetomidine" | "naloxone" | "flumazenil";
export type Route = "iv_bolus" | "iv_infusion";

export interface DrugEvent {
  timeSec: number;
  drug: DrugName;
  route: Route;
  doseMg?: number;
  rateMgPerHr?: number;
  onOff?: "start" | "stop";
}

export type OxygenSource = "room_air" | "nasal_cannula" | "simple_mask" | "nonrebreather";
export type Position = "supine" | "semi_upright" | "lateral";

export interface ExternalStimulus {
  timeSec: number;
  type: "pain" | "airway_obstruction" | "verbal" | "jaw_thrust" | "chin_lift";
  intensity?: number;
}

export interface VitalSnapshot {
  timeSec: number;
  hr: number;
  sbp: number;
  dbp: number;
  map: number;
  spo2: number;
  respRate: number;
  etco2?: number;
}

export type MoassLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface DepthOfSedationSnapshot {
  timeSec: number;
  moass: MoassLevel;
  bisIndex: number;
  suppressionRatio: number;
}

export interface RiskSnapshot {
  timeSec: number;
  hypotensionRisk: number;
  desaturationRisk: number;
  awarenessRisk: number;
}

export interface EngineStateSnapshot {
  vital: VitalSnapshot;
  depth: DepthOfSedationSnapshot;
  risk: RiskSnapshot;
}

export interface SedSimCoreConfig {
  timeStepSec: number;
  maxTimeSec: number;
  oxygenSource: OxygenSource;
  position: Position;
}

export interface SedSimCoreInit {
  patient: PatientArchetype;
  config: SedSimCoreConfig;
  initialDrugs?: DrugEvent[];
}

export interface SedSimCoreTickInput {
  currentTimeSec: number;
  newDrugEvents?: DrugEvent[];
  newStimuli?: ExternalStimulus[];
  oxygenSource?: OxygenSource;
  position?: Position;
}

export interface SedSimCoreTickOutput {
  state: EngineStateSnapshot;
  effectSiteConcentrations?: Record<DrugName, number>;
}

export interface SedSimCoreEngine {
  init(seed: SedSimCoreInit): void;
  tick(input: SedSimCoreTickInput): SedSimCoreTickOutput;
  getHistory(): EngineStateSnapshot[];
  reset(): void;
}
