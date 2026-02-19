/**
 * Multi-Agent Orchestration System
 * Coordinates between the Digital Twin, EEG Model, Mentor,
 * and Scenario Generator to provide a unified AI experience.
 * Acts as the central nervous system for all AI features.
 */
import { DigitalTwin, TwinState, DrugBolus } from './digitalTwin';
import { EEGModel, EEGSnapshot } from './eegModel';
import { generateMentorResponse, MentorMessage } from './mentor';
import { generateScenario, Scenario } from './scenarioGenerator';

export interface AgentMessage {
  from: 'twin' | 'eeg' | 'mentor' | 'scenario' | 'orchestrator';
  type: 'alert' | 'update' | 'recommendation' | 'warning';
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface OrchestratorState {
  twinState: TwinState | null;
  eegSnapshot: EEGSnapshot | null;
  activeAlerts: AgentMessage[];
  isRunning: boolean;
  tickCount: number;
}

type AgentCallback = (messages: AgentMessage[]) => void;

export class MultiAgentOrchestrator {
  private twin: DigitalTwin | null = null;
  private eeg: EEGModel;
  private callbacks: AgentCallback[] = [];
  private alertHistory: AgentMessage[] = [];
  private isRunning: boolean = false;
  private tickCount: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.eeg = new EEGModel();
  }

  setTwin(twin: DigitalTwin): void {
    this.twin = twin;
  }

  onMessages(callback: AgentCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  private emit(messages: AgentMessage[]): void {
    this.alertHistory.push(...messages);
    // Keep only last 100 alerts
    if (this.alertHistory.length > 100) {
      this.alertHistory = this.alertHistory.slice(-100);
    }
    for (const cb of this.callbacks) {
      cb(messages);
    }
  }

  start(tickIntervalMs: number = 1000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalId = setInterval(() => this.tick(tickIntervalMs), tickIntervalMs);
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick(deltaMs: number): void {
    this.tickCount++;
    const messages: AgentMessage[] = [];

    // Update Digital Twin
    if (this.twin) {
      const twinState = this.twin.tick(deltaMs);

      // Sync EEG with BIS from twin
      this.eeg.setBIS(twinState.vitals.bis);

      // Check for critical vital signs
      messages.push(...this.checkVitals(twinState));
    }

    // Generate EEG samples
    const eegSamples = Math.round((deltaMs / 1000) * 256);
    const eegSnapshot = this.eeg.generateSamples(eegSamples);

    // Check EEG patterns
    messages.push(...this.checkEEGPatterns(eegSnapshot));

    if (messages.length > 0) {
      this.emit(messages);
    }
  }

  private checkVitals(state: TwinState): AgentMessage[] {
    const messages: AgentMessage[] = [];
    const now = Date.now();

    if (state.vitals.spo2 < 90) {
      messages.push({
        from: 'twin',
        type: 'alert',
        priority: state.vitals.spo2 < 85 ? 'critical' : 'high',
        message: `SpO2 critically low: ${state.vitals.spo2}%`,
        data: { spo2: state.vitals.spo2 },
        timestamp: now,
      });
    }

    if (state.vitals.hr < 50 || state.vitals.hr > 120) {
      messages.push({
        from: 'twin',
        type: 'alert',
        priority: state.vitals.hr < 40 || state.vitals.hr > 140 ? 'critical' : 'high',
        message: `Heart rate abnormal: ${state.vitals.hr} bpm`,
        data: { hr: state.vitals.hr },
        timestamp: now,
      });
    }

    if (state.vitals.map < 60) {
      messages.push({
        from: 'twin',
        type: 'alert',
        priority: 'high',
        message: `MAP below threshold: ${state.vitals.map} mmHg`,
        data: { map: state.vitals.map },
        timestamp: now,
      });
    }

    if (state.vitals.rr < 8) {
      messages.push({
        from: 'twin',
        type: 'warning',
        priority: state.vitals.rr < 6 ? 'critical' : 'high',
        message: `Respiratory rate depressed: ${state.vitals.rr}/min`,
        data: { rr: state.vitals.rr },
        timestamp: now,
      });
    }

    return messages;
  }

  private checkEEGPatterns(snapshot: EEGSnapshot): AgentMessage[] {
    const messages: AgentMessage[] = [];
    const now = Date.now();

    if (snapshot.suppressionRatio > 50) {
      messages.push({
        from: 'eeg',
        type: 'warning',
        priority: 'high',
        message: `High burst suppression ratio: ${snapshot.suppressionRatio}%`,
        data: { suppressionRatio: snapshot.suppressionRatio },
        timestamp: now,
      });
    }

    if (snapshot.bis < 20) {
      messages.push({
        from: 'eeg',
        type: 'alert',
        priority: 'critical',
        message: `BIS dangerously low: ${snapshot.bis}`,
        data: { bis: snapshot.bis },
        timestamp: now,
      });
    }

    return messages;
  }

  administerDrug(bolus: DrugBolus): void {
    if (this.twin) {
      this.twin.administerDrug(bolus);
      this.emit([
        {
          from: 'orchestrator',
          type: 'update',
          priority: 'medium',
          message: `Drug administered: ${bolus.drug} ${bolus.dose}${bolus.unit} ${bolus.route}`,
          data: { bolus },
          timestamp: Date.now(),
        },
      ]);
    }
  }

  async askMentor(question: string, context?: Record<string, unknown>): Promise<MentorMessage> {
    const simContext = {
      vitals: this.twin?.getState()?.vitals || { hr: 0, sbp: 0, dbp: 0, map: 0, spo2: 0, rr: 0, etco2: 0, bis: 97 },
      moass: 5 as const,
      eventLog: [] as Array<{ message: string; type: string; severity: string; timestamp: number }>,
      pkStates: {} as Record<string, { ce: number }>,
      ...context,
    };
    return generateMentorResponse(question, simContext);
  }

  generateNewScenario(
    difficulty: string,
    _focusArea: string
  ): Scenario {
    return generateScenario(
      difficulty as 'easy' | 'moderate' | 'hard' | 'expert'
    );
  }

  getState(): OrchestratorState {
    return {
      twinState: this.twin?.getState() || null,
      eegSnapshot: null,
      activeAlerts: this.alertHistory.slice(-10),
      isRunning: this.isRunning,
      tickCount: this.tickCount,
    };
  }

  getAlertHistory(): AgentMessage[] {
    return [...this.alertHistory];
  }

  destroy(): void {
    this.stop();
    this.callbacks = [];
    this.alertHistory = [];
  }
}
