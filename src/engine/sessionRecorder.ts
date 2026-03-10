/**
 * sessionRecorder.ts
 *
 * Captures full simulation state snapshots at each tick for post-session
 * review and instructor debriefing. Uses delta encoding to keep exported
 * JSON under 5 MB for a 30-minute session.
 *
 * NOTE: This file MUST NOT import React. Engine files are pure TypeScript.
 */

import { Vitals, MOASSLevel, PKState, LogEntry, InterventionType, AirwayDevice } from '../types';

// ─── Public types ────────────────────────────────────────────────────────────

/** Full state captured at a single simulation tick. */
export interface SessionSnapshot {
  /** Elapsed simulation time in seconds. */
  t: number;
  vitals: Vitals;
  pkStates: Record<string, PKState>;
  moass: MOASSLevel;
  combinedEff: number;
  interventions: InterventionType[];
  airwayDevice: AirwayDevice;
  fio2: number;
  /** New event-log entries added this tick. */
  newEvents: LogEntry[];
  /** New Millie/AI messages added this tick. */
  millieMessages: string[];
}

/** Exported recording that can be saved as JSON. */
export interface SessionRecording {
  version: 2;
  sessionId: string;
  startedAt: string;   // ISO 8601
  endedAt: string;     // ISO 8601
  durationSeconds: number;
  patient: {
    archetypeKey: string;
    age: number;
    weight: number;
    sex: string;
    asa: number;
  };
  /** Compressed timeline of frames (mix of keyframes + delta frames). */
  frames: StoredFrame[];
  /** All event-log entries for the session (deduplicated). */
  eventLog: LogEntry[];
  /** All Millie messages for the session. */
  millieMessages: { t: number; text: string }[];
}

// ─── Internal storage format ─────────────────────────────────────────────────

/** Compact vitals stored in a keyframe. Field names shortened to save bytes. */
interface CompactVitals {
  hr: number; sbp: number; dbp: number; map: number;
  rr: number; spo2: number; etco2: number;
  rhy?: string; // rhythm (omit when normal_sinus)
  qrs?: number; pr?: number; qt?: number;
}

/** Delta vitals: only fields that changed. */
type DeltaVitals = Partial<CompactVitals>;

/** Compact PK state. */
interface CompactPK {
  c1: number; c2: number; c3: number; ce: number;
}

/** A full keyframe (stored every KEYFRAME_INTERVAL seconds). */
interface KeyFrame {
  _k: true;
  t: number;
  v: CompactVitals;
  pk: Record<string, CompactPK>;
  m: MOASSLevel;
  e: number;         // combinedEff
  i: string[];       // active interventions
  ad: string;        // airwayDevice
  fi: number;        // fio2
  ev?: StoredEvent[];
  ml?: string[];
}

/** A delta frame (only fields that changed vs. previous keyframe). */
interface DeltaFrame {
  _k?: false;
  t: number;
  v?: DeltaVitals;
  pk?: Record<string, Partial<CompactPK>>;
  m?: MOASSLevel;
  e?: number;
  i?: string[];
  ad?: string;
  fi?: number;
  ev?: StoredEvent[];
  ml?: string[];
}

type StoredFrame = KeyFrame | DeltaFrame;

interface StoredEvent {
  t: number;
  tp: string;
  msg: string;
  sev?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Store a full keyframe every N seconds. */
const KEYFRAME_INTERVAL = 30;

/** Minimum change thresholds before recording a delta for numeric vitals. */
const VITAL_THRESHOLDS: Partial<Record<keyof CompactVitals, number>> = {
  hr: 0.5, sbp: 0.5, dbp: 0.5, map: 0.5,
  rr: 0.5, spo2: 0.2, etco2: 0.5,
  qrs: 1, pr: 1, qt: 1,
};

const PK_THRESHOLD = 0.0005; // mcg/mL

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _idCounter = 0;
function generateId(): string {
  _idCounter += 1;
  return `rec_${Date.now()}_${_idCounter}`;
}

function roundVital(val: number, dp = 1): number {
  const factor = Math.pow(10, dp);
  return Math.round(val * factor) / factor;
}

function roundPK(val: number): number {
  return Math.round(val * 10000) / 10000;
}

function vitalsToCompact(v: Vitals): CompactVitals {
  const c: CompactVitals = {
    hr:    roundVital(v.hr),
    sbp:   roundVital(v.sbp),
    dbp:   roundVital(v.dbp),
    map:   roundVital(v.map),
    rr:    roundVital(v.rr),
    spo2:  roundVital(v.spo2, 1),
    etco2: roundVital(v.etco2, 1),
  };
  if (v.rhythm && v.rhythm !== 'normal_sinus') c.rhy = v.rhythm;
  if (v.qrsWidth  != null) c.qrs = roundVital(v.qrsWidth,  0);
  if (v.prInterval != null) c.pr  = roundVital(v.prInterval, 0);
  if (v.qtInterval != null) c.qt  = roundVital(v.qtInterval, 0);
  return c;
}

function pkToCompact(pk: PKState): CompactPK {
  return {
    c1: roundPK(pk.c1),
    c2: roundPK(pk.c2),
    c3: roundPK(pk.c3),
    ce: roundPK(pk.ce),
  };
}

function computeVitalsDelta(prev: CompactVitals, curr: CompactVitals): DeltaVitals | null {
  const delta: DeltaVitals = {};
  let hasChange = false;

  for (const key of ['hr','sbp','dbp','map','rr','spo2','etco2'] as const) {
    const threshold = VITAL_THRESHOLDS[key] ?? 0.5;
    const pVal = prev[key] ?? 0;
    const cVal = curr[key] ?? 0;
    if (Math.abs(cVal - pVal) >= threshold) {
      (delta as Record<string, number>)[key] = cVal;
      hasChange = true;
    }
  }
  // String fields
  if (prev.rhy !== curr.rhy) { delta.rhy = curr.rhy; hasChange = true; }
  // Interval fields
  for (const key of ['qrs','pr','qt'] as const) {
    const pVal = prev[key];
    const cVal = curr[key];
    if (pVal !== cVal) { delta[key] = cVal; hasChange = true; }
  }
  return hasChange ? delta : null;
}

function computePKDelta(
  prev: Record<string, CompactPK>,
  curr: Record<string, CompactPK>,
): Record<string, Partial<CompactPK>> | null {
  const delta: Record<string, Partial<CompactPK>> = {};
  let hasChange = false;

  for (const drug of new Set([...Object.keys(prev), ...Object.keys(curr)])) {
    const p = prev[drug] ?? { c1: 0, c2: 0, c3: 0, ce: 0 };
    const c = curr[drug] ?? { c1: 0, c2: 0, c3: 0, ce: 0 };
    const d: Partial<CompactPK> = {};
    let drugChange = false;
    for (const field of ['c1','c2','c3','ce'] as const) {
      if (Math.abs((c[field] ?? 0) - (p[field] ?? 0)) >= PK_THRESHOLD) {
        d[field] = c[field];
        drugChange = true;
      }
    }
    if (drugChange) { delta[drug] = d; hasChange = true; }
  }
  return hasChange ? delta : null;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ─── SessionRecorder class ────────────────────────────────────────────────────

export class SessionRecorder {
  private frames: StoredFrame[] = [];
  private eventLog: LogEntry[] = [];
  private millieLog: { t: number; text: string }[] = [];
  private sessionId: string;
  private startedAt: string;
  private patientInfo: SessionRecording['patient'] = {
    archetypeKey: 'unknown', age: 0, weight: 0, sex: 'M', asa: 1,
  };
  private lastKeyframeVitals: CompactVitals | null = null;
  private lastKeyframePK: Record<string, CompactPK> = {};
  private lastKeyframeMoass: MOASSLevel = 5;
  private lastKeyframeEff = 0;
  private lastKeyframeInterventions: string[] = [];
  private lastKeyframeAirwayDevice = '';
  private lastKeyframeFio2 = 0.21;
  private lastKeyframeTime = -1;

  constructor() {
    this.sessionId = generateId();
    this.startedAt = new Date().toISOString();
  }

  /** Set patient metadata for inclusion in the exported recording. */
  setPatient(info: SessionRecording['patient']): void {
    this.patientInfo = { ...info };
  }

  /**
   * Record a simulation snapshot. Call this once per simulation tick.
   * Automatically decides between keyframe and delta frame.
   */
  record(snapshot: SessionSnapshot): void {
    const compactVitals = vitalsToCompact(snapshot.vitals);
    const compactPK: Record<string, CompactPK> = {};
    for (const [drug, state] of Object.entries(snapshot.pkStates)) {
      compactPK[drug] = pkToCompact(state);
    }
    const compactInterventions = [...snapshot.interventions].sort();
    const roundedEff = Math.round(snapshot.combinedEff * 1000) / 1000;

    // Accumulate events and millie messages into the session-level logs
    for (const ev of snapshot.newEvents) {
      this.eventLog.push(ev);
    }
    for (const msg of snapshot.millieMessages) {
      this.millieLog.push({ t: snapshot.t, text: msg });
    }

    const storedEvents: StoredEvent[] = snapshot.newEvents.map(e => ({
      t: e.time,
      tp: e.type,
      msg: e.message,
      ...(e.severity && e.severity !== 'info' ? { sev: e.severity } : {}),
    }));
    const storedMillie: string[] = snapshot.millieMessages;

    // Decide whether to write a keyframe
    const needKeyframe =
      this.lastKeyframeTime < 0 ||
      snapshot.t - this.lastKeyframeTime >= KEYFRAME_INTERVAL;

    if (needKeyframe) {
      const kf: KeyFrame = {
        _k: true,
        t: snapshot.t,
        v: compactVitals,
        pk: compactPK,
        m: snapshot.moass,
        e: roundedEff,
        i: compactInterventions,
        ad: snapshot.airwayDevice,
        fi: Math.round(snapshot.fio2 * 100) / 100,
        ...(storedEvents.length ? { ev: storedEvents } : {}),
        ...(storedMillie.length ? { ml: storedMillie } : {}),
      };
      this.frames.push(kf);
      this.lastKeyframeVitals = compactVitals;
      this.lastKeyframePK = compactPK;
      this.lastKeyframeMoass = snapshot.moass;
      this.lastKeyframeEff = roundedEff;
      this.lastKeyframeInterventions = compactInterventions;
      this.lastKeyframeAirwayDevice = snapshot.airwayDevice;
      this.lastKeyframeFio2 = Math.round(snapshot.fio2 * 100) / 100;
      this.lastKeyframeTime = snapshot.t;
    } else {
      // Build delta frame — only fields that changed
      const df: DeltaFrame = { t: snapshot.t };
      let hasAnyDelta = false;

      const vDelta = this.lastKeyframeVitals
        ? computeVitalsDelta(this.lastKeyframeVitals, compactVitals)
        : null;
      if (vDelta) { df.v = vDelta; hasAnyDelta = true; }

      const pkDelta = computePKDelta(this.lastKeyframePK, compactPK);
      if (pkDelta) { df.pk = pkDelta; hasAnyDelta = true; }

      if (snapshot.moass !== this.lastKeyframeMoass) {
        df.m = snapshot.moass; hasAnyDelta = true;
      }
      if (Math.abs(roundedEff - this.lastKeyframeEff) >= 0.001) {
        df.e = roundedEff; hasAnyDelta = true;
      }
      if (!arraysEqual(compactInterventions, this.lastKeyframeInterventions)) {
        df.i = compactInterventions; hasAnyDelta = true;
      }
      if (snapshot.airwayDevice !== this.lastKeyframeAirwayDevice) {
        df.ad = snapshot.airwayDevice; hasAnyDelta = true;
      }
      const roundedFio2 = Math.round(snapshot.fio2 * 100) / 100;
      if (Math.abs(roundedFio2 - this.lastKeyframeFio2) >= 0.01) {
        df.fi = roundedFio2; hasAnyDelta = true;
      }
      if (storedEvents.length) { df.ev = storedEvents; hasAnyDelta = true; }
      if (storedMillie.length) { df.ml = storedMillie; hasAnyDelta = true; }

      // Only push frame if something changed (or there are events)
      if (hasAnyDelta) this.frames.push(df);
    }
  }

  /** Add a Millie/AI message to the recording (call from the AI layer). */
  addMillieMessage(text: string, simulationTime: number): void {
    this.millieLog.push({ t: simulationTime, text });
  }

  /** Reset recorder for a new session. */
  clear(): void {
    this.frames = [];
    this.eventLog = [];
    this.millieLog = [];
    this.sessionId = generateId();
    this.startedAt = new Date().toISOString();
    this.lastKeyframeVitals = null;
    this.lastKeyframePK = {};
    this.lastKeyframeMoass = 5;
    this.lastKeyframeEff = 0;
    this.lastKeyframeInterventions = [];
    this.lastKeyframeAirwayDevice = '';
    this.lastKeyframeFio2 = 0.21;
    this.lastKeyframeTime = -1;
  }

  /** Export the recording as a structured object (serialise with JSON.stringify). */
  exportRecording(): SessionRecording {
    const lastFrame = this.frames[this.frames.length - 1];
    return {
      version: 2,
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      endedAt: new Date().toISOString(),
      durationSeconds: lastFrame ? lastFrame.t : 0,
      patient: { ...this.patientInfo },
      frames: this.frames,
      eventLog: this.eventLog,
      millieMessages: this.millieLog,
    };
  }

  /** Serialise the recording to a JSON string. */
  exportToJSON(): string {
    return JSON.stringify(this.exportRecording());
  }

  /** Number of frames currently stored. */
  get frameCount(): number {
    return this.frames.length;
  }

  /** Whether there is anything recorded. */
  get hasData(): boolean {
    return this.frames.length > 0;
  }

  /** Return an approximate size estimate of the recording in bytes. */
  estimatedSizeBytes(): number {
    return new TextEncoder().encode(this.exportToJSON()).length;
  }
}

// ─── Playback helpers ─────────────────────────────────────────────────────────

/** Full reconstructed state for a single tick during playback. */
export interface PlaybackFrame {
  t: number;
  vitals: Vitals;
  pkStates: Record<string, PKState>;
  moass: MOASSLevel;
  combinedEff: number;
  interventions: InterventionType[];
  airwayDevice: AirwayDevice;
  fio2: number;
  events: LogEntry[];
  millieMessages: string[];
}

function compactToVitals(c: CompactVitals): Vitals {
  return {
    hr:    c.hr,
    sbp:   c.sbp,
    dbp:   c.dbp,
    map:   c.map,
    rr:    c.rr,
    spo2:  c.spo2,
    etco2: c.etco2,
    ...(c.rhy ? { rhythm: c.rhy as Vitals['rhythm'] } : { rhythm: 'normal_sinus' }),
    ...(c.qrs != null ? { qrsWidth: c.qrs } : {}),
    ...(c.pr  != null ? { prInterval: c.pr  } : {}),
    ...(c.qt  != null ? { qtInterval: c.qt  } : {}),
  };
}

function compactToPK(c: CompactPK): PKState {
  return { c1: c.c1, c2: c.c2, c3: c.c3, ce: c.ce };
}

const VALID_LOG_TYPES = new Set<LogEntry['type']>([
  'bolus', 'infusion_start', 'infusion_stop', 'infusion_change', 'alert', 'vitals', 'intervention',
]);

function storedEventToLogEntry(e: StoredEvent): LogEntry {
  const type: LogEntry['type'] = VALID_LOG_TYPES.has(e.tp as LogEntry['type'])
    ? (e.tp as LogEntry['type'])
    : 'alert';
  return {
    time: e.t,
    type,
    message: e.msg,
    ...(e.sev ? { severity: e.sev as LogEntry['severity'] } : { severity: 'info' }),
  };
}

/**
 * Reconstruct the full playback timeline from a SessionRecording.
 * Returns an array of PlaybackFrame objects (one per stored frame).
 */
export function reconstructTimeline(recording: SessionRecording): PlaybackFrame[] {
  const result: PlaybackFrame[] = [];

  // Running state that we mutate as we apply frames
  let vitals: CompactVitals = {
    hr: 75, sbp: 120, dbp: 80, map: 93,
    rr: 14, spo2: 98, etco2: 38,
  };
  let pk: Record<string, CompactPK> = {};
  let moass: MOASSLevel = 5;
  let combinedEff = 0;
  let interventions: string[] = [];
  let airwayDevice = 'room_air';
  let fio2 = 0.21;

  for (const frame of recording.frames) {
    if ((frame as KeyFrame)._k) {
      // Full keyframe — replace entire state
      const kf = frame as KeyFrame;
      vitals = { ...kf.v };
      pk = Object.fromEntries(Object.entries(kf.pk).map(([d, s]) => [d, { ...s }]));
      moass = kf.m;
      combinedEff = kf.e;
      interventions = [...kf.i];
      airwayDevice = kf.ad;
      fio2 = kf.fi;
    } else {
      // Delta frame — apply only changed fields
      const df = frame as DeltaFrame;
      if (df.v) {
        vitals = { ...vitals, ...df.v } as CompactVitals;
      }
      if (df.pk) {
        for (const [drug, d] of Object.entries(df.pk)) {
          pk[drug] = { ...(pk[drug] ?? { c1: 0, c2: 0, c3: 0, ce: 0 }), ...d } as CompactPK;
        }
      }
      if (df.m !== undefined) moass = df.m;
      if (df.e !== undefined) combinedEff = df.e;
      if (df.i !== undefined) interventions = [...df.i];
      if (df.ad !== undefined) airwayDevice = df.ad;
      if (df.fi !== undefined) fio2 = df.fi;
    }

    result.push({
      t: frame.t,
      vitals: compactToVitals(vitals),
      pkStates: Object.fromEntries(Object.entries(pk).map(([d, s]) => [d, compactToPK(s)])),
      moass,
      combinedEff,
      interventions: [...interventions] as InterventionType[],
      airwayDevice: airwayDevice as AirwayDevice,
      fio2,
      events: (frame.ev ?? []).map(storedEventToLogEntry),
      millieMessages: frame.ml ? [...frame.ml] : [],
    });
  }

  return result;
}
