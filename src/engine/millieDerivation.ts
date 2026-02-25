// =================================================================
// src/engine/millieDerivation.ts
// Pure function: full sim state -> MillieContext for AI mentor
// Builds a structured snapshot that Millie uses to generate
// clinically accurate, context-aware feedback in real time.
// Called once per tick inside simulationTick.ts
// =================================================================

import type { Patient, LogEntry, TrendPoint, AirwayDevice } from '../types';
import type {
  MillieContext, PharmacodynamicState, VitalsDisplay, DrugPKSnapshot
} from '../types/SimulationState';

// --- Trend direction helper ---
function trendDirection(
  points: TrendPoint[],
  accessor: (tp: TrendPoint) => number,
  windowSec: number = 60
): 'stable' | 'falling' | 'rising' {
  if (points.length < 3) return 'stable';
  const now = points[points.length - 1].time;
  const recent = points.filter(p => p.time >= now - windowSec);
  if (recent.length < 2) return 'stable';
  const first = accessor(recent[0]);
  const last = accessor(recent[recent.length - 1]);
  const delta = last - first;
  const threshold = Math.abs(first) * 0.05 + 2; // 5% + 2 absolute
  if (delta > threshold) return 'rising';
  if (delta < -threshold) return 'falling';
  return 'stable';
}

// --- Clinical concern generator ---
function identifyConcerns(
  pd: PharmacodynamicState,
  vitals: VitalsDisplay,
  alarms: Array<{ type: string; message: string; severity: string }>
): string[] {
  const concerns: string[] = [];

  if (vitals.spo2 < 90) concerns.push('Critical hypoxemia (SpO2 < 90%)');
  else if (vitals.spo2 < 94) concerns.push('Mild hypoxemia (SpO2 < 94%)');

  if (vitals.map < 55) concerns.push('Severe hypotension (MAP < 55)');
  else if (vitals.map < 65) concerns.push('Hypotension (MAP < 65)');

  if (vitals.rr < 6) concerns.push('Severe respiratory depression (RR < 6)');
  else if (vitals.rr < 8) concerns.push('Respiratory depression (RR < 8)');

  if (vitals.hr < 40) concerns.push('Severe bradycardia (HR < 40)');
  else if (vitals.hr > 140) concerns.push('Tachycardia (HR > 140)');

  if (pd.sedationDepth > 0.85) concerns.push('Deep sedation - risk of airway loss');

  if (pd.analgesiaLevel < 0.2 && pd.sedationDepth > 0.3) {
    concerns.push('Inadequate analgesia with ongoing sedation');
  }

  const respDep = Object.values(pd.drugContributions)
    .reduce((sum, d) => sum + d.respiratoryDepression, 0);
  if (respDep > 0.5) concerns.push('Significant respiratory depression from drugs');

  alarms.filter(a => a.severity === 'danger').forEach(a => {
    if (!concerns.some(c => c.includes(a.type))) {
      concerns.push(a.message);
    }
  });

  return concerns;
}

export function buildMillieContext(
  patient: Patient,
  pd: PharmacodynamicState,
  vitals: VitalsDisplay,
  drugSnapshots: Record<string, DrugPKSnapshot>,
  activeAlarms: Array<{ type: string; message: string; severity: string }>,
  interventions: Set<string>,
  airway: AirwayDevice,
  fio2: number,
  isScenarioActive: boolean,
  eventLog: LogEntry[],
  trendData: TrendPoint[]
): MillieContext {
  // Patient summary string
  const patientSummary = [
    `${patient.age}yo`,
    `${patient.weight}kg`,
    patient.asa ? `ASA ${patient.asa}` : '',
    patient.hepaticImpairment ? 'hepatic impairment' : '',
    patient.renalImpairment ? 'renal impairment' : '',
  ].filter(Boolean).join(', ');

  // Active drugs with concentrations
  const activeDrugs = Object.entries(drugSnapshots)
    .filter(([_, snap]) => snap.effectSiteConc > 0.001 || snap.isInfusing)
    .map(([name, snap]) => ({
      name,
      effectSiteConc: snap.effectSiteConc,
      plasmaConc: snap.plasmaConc,
      isInfusing: snap.isInfusing,
      totalGiven: snap.totalDoseGiven,
    }));

  // Trends
  const spo2Trend = trendDirection(trendData, tp => tp.vitals.spo2);
  const hrTrend = trendDirection(trendData, tp => tp.vitals.hr);
  const bpTrend = trendDirection(trendData, tp => tp.vitals.map);

  // Recent events (last 10)
  const recentEvents = eventLog.slice(-10);

  // Clinical concerns
  const clinicalConcerns = identifyConcerns(pd, vitals, activeAlarms);

  return {
    patientSummary,
    currentMOASS: pd.moass,
    currentVitals: vitals,
    activeDrugs,
    activeAlarms: activeAlarms.map(a => ({
      type: a.type, message: a.message, severity: a.severity
    })),
    activeInterventions: Array.from(interventions),
    airway,
    fio2,
    scenarioContext: {
      isActive: isScenarioActive,
      currentPhase: 'active',
      objectives: [],
      timeElapsed: trendData.length > 0 ? trendData[trendData.length - 1].time : 0,
    },
    recentEvents,
    trends: { spo2Trend, hrTrend, bpTrend },
    clinicalConcerns,
  };
}
