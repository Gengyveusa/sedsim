/**
 * src/engine/analytics.ts
 * Research-grade telemetry engine for the A/B study protocol.
 * Pure engine file — NO React imports.
 *
 * Stores events in memory during a session, flushes to localStorage on end.
 * Provides CSV export for SPSS/R analysis.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type TelemetryEventType =
  | 'session_start'
  | 'session_end'
  | 'drug_bolus'
  | 'drug_infusion_start'
  | 'drug_infusion_stop'
  | 'intervention_applied'
  | 'intervention_removed'
  | 'vital_alarm_fired'
  | 'vital_alarm_acknowledged'
  | 'mentor_question_asked'
  | 'mentor_answer_received'
  | 'learner_question_asked'
  | 'learner_answer_given'
  | 'scenario_phase_entered'
  | 'scenario_completed'
  | 'pretest_answer'
  | 'posttest_answer'
  | 'tab_opened'
  | 'gauge_mode_changed'
  | 'simmaster_event'
  | 'idle_detected'
  | 'arm_assigned'
  | 'vital_snapshot';

export interface TelemetryEvent {
  sessionId: string;
  learnerId: string;
  studyArm: 'A' | 'B' | 'C';
  scenarioId: string;
  timestamp: number;       // ms since session start
  wallClock: string;       // ISO 8601
  eventType: TelemetryEventType;
  payload: Record<string, unknown>;
}

export interface SessionSummary {
  sessionId: string;
  learnerId: string;
  studyArm: 'A' | 'B' | 'C';
  scenarioId: string;
  duration_s: number;
  totalDrugBoluses: number;
  totalInterventions: number;
  totalAlarmsTriggered: number;
  peakRiskScore: number;
  lowestSpO2: number;
  lowestMOASS: number;
  scenarioScore: number;
  pretestScore: number;
  posttestScore: number;
  mentorInteractions: number;
  meanResponseLatency_ms: number;
}

// ─── localStorage key prefix ─────────────────────────────────────────────────

const LS_EVENTS_PREFIX = 'sedsim_study_events_';
const LS_SUMMARIES_KEY = 'sedsim_study_summaries';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateSessionId(): string {
  return `ses_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Escape a value for CSV (RFC 4180). */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function eventToCSVRow(e: TelemetryEvent): string {
  return [
    csvEscape(e.sessionId),
    csvEscape(e.learnerId),
    csvEscape(e.studyArm),
    csvEscape(e.scenarioId),
    csvEscape(e.timestamp),
    csvEscape(e.wallClock),
    csvEscape(e.eventType),
    csvEscape(JSON.stringify(e.payload)),
  ].join(',');
}

const EVENT_CSV_HEADER =
  'sessionId,learnerId,studyArm,scenarioId,timestamp,wallClock,eventType,payload';

function summaryToCSVRow(s: SessionSummary): string {
  return [
    csvEscape(s.sessionId),
    csvEscape(s.learnerId),
    csvEscape(s.studyArm),
    csvEscape(s.scenarioId),
    csvEscape(s.duration_s),
    csvEscape(s.totalDrugBoluses),
    csvEscape(s.totalInterventions),
    csvEscape(s.totalAlarmsTriggered),
    csvEscape(s.peakRiskScore),
    csvEscape(s.lowestSpO2),
    csvEscape(s.lowestMOASS),
    csvEscape(s.scenarioScore),
    csvEscape(s.pretestScore),
    csvEscape(s.posttestScore),
    csvEscape(s.mentorInteractions),
    csvEscape(s.meanResponseLatency_ms),
  ].join(',');
}

const SUMMARY_CSV_HEADER =
  'sessionId,learnerId,studyArm,scenarioId,duration_s,totalDrugBoluses,totalInterventions,totalAlarmsTriggered,peakRiskScore,lowestSpO2,lowestMOASS,scenarioScore,pretestScore,posttestScore,mentorInteractions,meanResponseLatency_ms';

// ─── AnalyticsEngine ─────────────────────────────────────────────────────────

export class AnalyticsEngine {
  private events: TelemetryEvent[] = [];
  private sessionId = '';
  private learnerId = '';
  private studyArm: 'A' | 'B' | 'C' = 'A';
  private scenarioId = '';
  private sessionStartTime = 0;
  private isActive = false;

  // Running stats
  private lowestSpO2 = 100;
  private lowestMOASS = 5;
  private peakRiskScore = 0;
  private pretestScore = -1;
  private posttestScore = -1;
  private scenarioScore = 0;
  private responseTimes: number[] = [];

  startSession(learnerId: string, arm: 'A' | 'B' | 'C', scenarioId: string): string {
    this.sessionId = generateSessionId();
    this.learnerId = learnerId;
    this.studyArm = arm;
    this.scenarioId = scenarioId;
    this.sessionStartTime = Date.now();
    this.isActive = true;
    this.events = [];
    this.lowestSpO2 = 100;
    this.lowestMOASS = 5;
    this.peakRiskScore = 0;
    this.pretestScore = -1;
    this.posttestScore = -1;
    this.scenarioScore = 0;
    this.responseTimes = [];

    this.log({ timestamp: 0, wallClock: new Date().toISOString(), eventType: 'session_start', scenarioId, payload: { arm } });
    return this.sessionId;
  }

  log(event: Omit<TelemetryEvent, 'sessionId' | 'learnerId' | 'studyArm'>): void {
    if (!this.isActive) return;
    const full: TelemetryEvent = {
      sessionId: this.sessionId,
      learnerId: this.learnerId,
      studyArm: this.studyArm,
      ...event,
    };
    this.events.push(full);

    // Update running stats from certain event types
    const p = event.payload;
    if (event.eventType === 'vital_snapshot') {
      const spo2 = p.spo2 as number | undefined;
      const moass = p.moass as number | undefined;
      const risk = p.riskScore as number | undefined;
      if (spo2 !== undefined && spo2 < this.lowestSpO2) this.lowestSpO2 = spo2;
      if (moass !== undefined && moass < this.lowestMOASS) this.lowestMOASS = moass;
      if (risk !== undefined && risk > this.peakRiskScore) this.peakRiskScore = risk;
    }
    if (event.eventType === 'mentor_answer_received') {
      const lat = p.latency_ms as number | undefined;
      if (lat !== undefined) this.responseTimes.push(lat);
    }
    if (event.eventType === 'scenario_completed') {
      this.scenarioScore = (p.score as number) ?? 0;
    }
  }

  setPretestScore(score: number): void {
    this.pretestScore = score;
  }

  setPosttestScore(score: number): void {
    this.posttestScore = score;
  }

  endSession(): SessionSummary {
    const duration_s = Math.round((Date.now() - this.sessionStartTime) / 1000);
    this.log({
      timestamp: duration_s * 1000,
      wallClock: new Date().toISOString(),
      eventType: 'session_end',
      scenarioId: this.scenarioId,
      payload: { duration_s },
    });

    const summary = this.buildSummary(duration_s);
    this.flushToLocalStorage();
    this.isActive = false;
    return summary;
  }

  exportEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  exportSummary(): SessionSummary {
    const duration_s = Math.round((Date.now() - this.sessionStartTime) / 1000);
    return this.buildSummary(duration_s);
  }

  exportCSV(): string {
    const rows = this.events.map(eventToCSVRow);
    return [EVENT_CSV_HEADER, ...rows].join('\n');
  }

  exportSummaryCSV(): string {
    const summary = this.exportSummary();
    return [SUMMARY_CSV_HEADER, summaryToCSVRow(summary)].join('\n');
  }

  /** Whether a session is currently active. */
  get active(): boolean {
    return this.isActive;
  }

  /** Current session elapsed ms. */
  get elapsedMs(): number {
    if (!this.isActive) return 0;
    return Date.now() - this.sessionStartTime;
  }

  // ─── Bulk export across all sessions in localStorage ───────────────────────

  static exportAllEventsCSV(): string {
    const rows: string[] = [EVENT_CSV_HEADER];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LS_EVENTS_PREFIX)) {
        try {
          const events: TelemetryEvent[] = JSON.parse(localStorage.getItem(key) || '[]');
          for (const e of events) rows.push(eventToCSVRow(e));
        } catch { /* skip corrupt entries */ }
      }
    }
    return rows.join('\n');
  }

  static exportAllSummariesCSV(): string {
    const rows: string[] = [SUMMARY_CSV_HEADER];
    try {
      const summaries: SessionSummary[] = JSON.parse(localStorage.getItem(LS_SUMMARIES_KEY) || '[]');
      for (const s of summaries) rows.push(summaryToCSVRow(s));
    } catch { /* skip corrupt */ }
    return rows.join('\n');
  }

  static getAllSummaries(): SessionSummary[] {
    try {
      return JSON.parse(localStorage.getItem(LS_SUMMARIES_KEY) || '[]');
    } catch { return []; }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private buildSummary(duration_s: number): SessionSummary {
    const totalDrugBoluses = this.events.filter(e => e.eventType === 'drug_bolus').length;
    const totalInterventions = this.events.filter(e => e.eventType === 'intervention_applied').length;
    const totalAlarmsTriggered = this.events.filter(e => e.eventType === 'vital_alarm_fired').length;
    const mentorInteractions = this.events.filter(
      e => e.eventType === 'learner_question_asked' || e.eventType === 'mentor_question_asked'
    ).length;
    const meanResponseLatency_ms =
      this.responseTimes.length > 0
        ? Math.round(this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length)
        : 0;

    return {
      sessionId: this.sessionId,
      learnerId: this.learnerId,
      studyArm: this.studyArm,
      scenarioId: this.scenarioId,
      duration_s,
      totalDrugBoluses,
      totalInterventions,
      totalAlarmsTriggered,
      peakRiskScore: Math.round(this.peakRiskScore * 100) / 100,
      lowestSpO2: this.lowestSpO2,
      lowestMOASS: this.lowestMOASS,
      scenarioScore: this.scenarioScore,
      pretestScore: this.pretestScore,
      posttestScore: this.posttestScore,
      mentorInteractions,
      meanResponseLatency_ms,
    };
  }

  private flushToLocalStorage(): void {
    try {
      // Store events keyed by session
      localStorage.setItem(
        `${LS_EVENTS_PREFIX}${this.sessionId}`,
        JSON.stringify(this.events)
      );

      // Append summary
      const existing: SessionSummary[] = JSON.parse(
        localStorage.getItem(LS_SUMMARIES_KEY) || '[]'
      );
      const duration_s = Math.round((Date.now() - this.sessionStartTime) / 1000);
      existing.push(this.buildSummary(duration_s));
      localStorage.setItem(LS_SUMMARIES_KEY, JSON.stringify(existing));
    } catch {
      // localStorage may be full or unavailable — silently skip
    }
  }
}

/** Singleton for global use by the wiring hooks. */
export const analyticsEngine = new AnalyticsEngine();
