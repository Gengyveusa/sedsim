/**
 * src/hooks/useStudyAnalytics.ts
 * React hook that wires the AnalyticsEngine into the simulation tick loop,
 * DrugPanel actions, InterventionPanel actions, and MentorChat exchanges.
 *
 * Only active when research mode is enabled.
 * Call this once in the App component.
 */

import { useEffect, useRef } from 'react';
import useSimStore from '../store/useSimStore';
import useStudyStore from '../store/useStudyStore';
import { analyticsEngine } from '../engine/analytics';

/** Configurable interval (in simulation seconds) between vital snapshots. */
const VITAL_SNAPSHOT_INTERVAL_S = 5;

export function useStudyAnalytics(): void {
  const researchMode = useStudyStore(s => s.researchMode);
  const currentArm = useStudyStore(s => s.currentArm);
  const studyPhase = useStudyStore(s => s.studyPhase);

  const elapsedSeconds = useSimStore(s => s.elapsedSeconds);
  const isRunning = useSimStore(s => s.isRunning);
  const vitals = useSimStore(s => s.vitals);
  const moass = useSimStore(s => s.moass);
  const activeAlarms = useSimStore(s => s.activeAlarms);
  const eventLog = useSimStore(s => s.eventLog);
  const lastDrugAdministered = useSimStore(s => s.lastDrugAdministered);
  const lastInterventionApplied = useSimStore(s => s.lastInterventionApplied);
  const activeTab = useSimStore(s => s.activeTab);
  const activeGaugeMode = useSimStore(s => s.activeGaugeMode);

  const lastVitalSnapshotRef = useRef(0);
  const lastEventLogLenRef = useRef(0);
  const lastAlarmCountRef = useRef(0);
  const lastDrugRef = useRef<typeof lastDrugAdministered>(null);
  const lastInterventionRef = useRef<string | null>(null);
  const lastTabRef = useRef('');
  const lastGaugeModeRef = useRef('');

  // Vital snapshots at configurable interval
  useEffect(() => {
    if (!researchMode || !analyticsEngine.active || !isRunning) return;
    if (studyPhase !== 'simulation') return;

    if (elapsedSeconds - lastVitalSnapshotRef.current >= VITAL_SNAPSHOT_INTERVAL_S) {
      lastVitalSnapshotRef.current = elapsedSeconds;
      analyticsEngine.log({
        timestamp: elapsedSeconds * 1000,
        wallClock: new Date().toISOString(),
        eventType: 'vital_snapshot',
        scenarioId: `arm_${currentArm ?? 'unknown'}`,
        payload: {
          hr: vitals.hr,
          sbp: vitals.sbp,
          dbp: vitals.dbp,
          rr: vitals.rr,
          spo2: vitals.spo2,
          etco2: vitals.etco2,
          moass,
          riskScore: 0,
        },
      });
    }
  }, [researchMode, isRunning, elapsedSeconds, vitals, moass, currentArm, studyPhase]);

  // Drug boluses — detect changes to lastDrugAdministered
  useEffect(() => {
    if (!researchMode || !analyticsEngine.active) return;
    if (!lastDrugAdministered || lastDrugAdministered === lastDrugRef.current) return;
    if (lastDrugRef.current?.timestamp === lastDrugAdministered.timestamp) return;
    lastDrugRef.current = lastDrugAdministered;

    analyticsEngine.log({
      timestamp: analyticsEngine.elapsedMs,
      wallClock: new Date().toISOString(),
      eventType: 'drug_bolus',
      scenarioId: `arm_${currentArm ?? 'unknown'}`,
      payload: {
        drug: lastDrugAdministered.name,
        dose: lastDrugAdministered.dose,
      },
    });
  }, [researchMode, lastDrugAdministered, currentArm]);

  // Interventions — detect changes to lastInterventionApplied
  useEffect(() => {
    if (!researchMode || !analyticsEngine.active) return;
    if (!lastInterventionApplied || lastInterventionApplied === lastInterventionRef.current) return;
    lastInterventionRef.current = lastInterventionApplied;

    analyticsEngine.log({
      timestamp: analyticsEngine.elapsedMs,
      wallClock: new Date().toISOString(),
      eventType: 'intervention_applied',
      scenarioId: `arm_${currentArm ?? 'unknown'}`,
      payload: { type: lastInterventionApplied },
    });
  }, [researchMode, lastInterventionApplied, currentArm]);

  // Alarms — detect new alarms
  useEffect(() => {
    if (!researchMode || !analyticsEngine.active) return;
    if (activeAlarms.length > lastAlarmCountRef.current) {
      const newAlarms = activeAlarms.slice(lastAlarmCountRef.current);
      for (const alarm of newAlarms) {
        analyticsEngine.log({
          timestamp: analyticsEngine.elapsedMs,
          wallClock: new Date().toISOString(),
          eventType: 'vital_alarm_fired',
          scenarioId: `arm_${currentArm ?? 'unknown'}`,
          payload: {
            type: alarm.type,
            severity: alarm.severity,
            message: alarm.message,
          },
        });
      }
    }
    lastAlarmCountRef.current = activeAlarms.length;
  }, [researchMode, activeAlarms, currentArm]);

  // Event log — detect new events for bolus/infusion logging
  useEffect(() => {
    if (!researchMode || !analyticsEngine.active) return;
    if (eventLog.length <= lastEventLogLenRef.current) return;

    const newEvents = eventLog.slice(lastEventLogLenRef.current);
    lastEventLogLenRef.current = eventLog.length;

    for (const ev of newEvents) {
      if (ev.type === 'infusion_start') {
        analyticsEngine.log({
          timestamp: analyticsEngine.elapsedMs,
          wallClock: new Date().toISOString(),
          eventType: 'drug_infusion_start',
          scenarioId: `arm_${currentArm ?? 'unknown'}`,
          payload: { message: ev.message },
        });
      } else if (ev.type === 'infusion_stop') {
        analyticsEngine.log({
          timestamp: analyticsEngine.elapsedMs,
          wallClock: new Date().toISOString(),
          eventType: 'drug_infusion_stop',
          scenarioId: `arm_${currentArm ?? 'unknown'}`,
          payload: { message: ev.message },
        });
      }
    }
  }, [researchMode, eventLog, currentArm]);

  // Tab changes
  useEffect(() => {
    if (!researchMode || !analyticsEngine.active) return;
    if (activeTab === lastTabRef.current) return;
    lastTabRef.current = activeTab;
    if (!activeTab) return;

    analyticsEngine.log({
      timestamp: analyticsEngine.elapsedMs,
      wallClock: new Date().toISOString(),
      eventType: 'tab_opened',
      scenarioId: `arm_${currentArm ?? 'unknown'}`,
      payload: { tab: activeTab },
    });
  }, [researchMode, activeTab, currentArm]);

  // Gauge mode changes
  useEffect(() => {
    if (!researchMode || !analyticsEngine.active) return;
    if (activeGaugeMode === lastGaugeModeRef.current) return;
    lastGaugeModeRef.current = activeGaugeMode;

    analyticsEngine.log({
      timestamp: analyticsEngine.elapsedMs,
      wallClock: new Date().toISOString(),
      eventType: 'gauge_mode_changed',
      scenarioId: `arm_${currentArm ?? 'unknown'}`,
      payload: { mode: activeGaugeMode },
    });
  }, [researchMode, activeGaugeMode, currentArm]);
}
