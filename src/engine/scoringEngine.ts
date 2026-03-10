// src/engine/scoringEngine.ts
// Pure grading / scoring engine — no React, no side-effects.
//
// Scoring dimensions
// ------------------
//   timing          – how close the scenario duration was to the target
//   appropriateness – were drug boluses within recommended ranges?
//   safety          – absence of prolonged dangerous vital-sign excursions
//   completeness    – fraction of scenario steps that were completed

import type { LogEntry, TrendPoint } from '../types';

// ─── Rubric types ─────────────────────────────────────────────────────────────

/** Per-dimension criteria for a single scenario. */
export interface ScoringRubric {
  /** Minimum percent score (0-100) required to pass. */
  passThreshold: number;

  /**
   * Fractional weight for each dimension (must sum to 1.0).
   * Example: { timing: 0.15, appropriateness: 0.35, safety: 0.30, completeness: 0.20 }
   */
  weights: {
    timing: number;
    appropriateness: number;
    safety: number;
    completeness: number;
  };

  criteria: {
    timing: {
      /** Ideal scenario duration in seconds. */
      targetDurationSec: number;
      /**
       * Half-width of the "full-score" band around targetDurationSec.
       * Durations within [target - tolerance, target + 2*tolerance] score 100%.
       * Beyond that the timing score decays linearly to 0 at 3 × targetDurationSec.
       */
      toleranceSec: number;
    };

    appropriateness: {
      /** List of drugs with acceptable single-bolus dose ranges. */
      drugRanges: Array<{
        drug: string;
        /** Minimum acceptable single-bolus dose (in scenario units, e.g. mg or mcg). */
        minDose: number;
        /** Maximum acceptable single-bolus dose. */
        maxDose: number;
      }>;
    };

    safety: {
      /** SpO2 (%) below which a sample is considered "dangerous". Default 88. */
      spo2DangerThreshold: number;
      /** MOASS level strictly below which the patient is over-sedated. Default 1 (i.e. MOASS 0). */
      moassMinAllowed: number;
      /**
       * Total seconds in dangerous vital territory that are penalised at 100%.
       * Fewer than this many seconds still attracts a partial deduction.
       */
      maxDangerSeconds: number;
    };

    completeness: {
      /**
       * Minimum fraction of total steps (0-1) that must have fired to earn a
       * full completeness score.  Set to 1.0 to require every step.
       */
      requiredStepFraction: number;
    };
  };
}

// ─── Session snapshot ─────────────────────────────────────────────────────────

/** All data needed to evaluate one session deterministically. */
export interface ScoringSession {
  /** Wall-clock seconds that elapsed during the scenario. */
  elapsedSeconds: number;
  /** Ordered array of event-log entries written by the simulation. */
  eventLog: LogEntry[];
  /** Time-series of vitals / drug concentrations / MOASS sampled every second. */
  trendData: TrendPoint[];
  /** IDs of all scenario steps that were triggered (fired) during the session. */
  completedStepIds: string[];
  /** Total number of steps defined in the scenario. */
  totalStepCount: number;
}

// ─── Result types ─────────────────────────────────────────────────────────────

/** Score for a single dimension. */
export interface DimensionScore {
  label: string;
  score: number;
  maxScore: number;
  /** Rounded integer percentage (0–100). */
  percent: number;
  /** Human-readable explanation bullets. */
  details: string[];
}

/** Full scoring result returned by scoreScenario(). */
export interface ScoringSummary {
  dimensions: {
    timing: DimensionScore;
    appropriateness: DimensionScore;
    safety: DimensionScore;
    completeness: DimensionScore;
  };
  totalScore: number;
  maxScore: number;
  percentScore: number;
  passed: boolean;
  passThreshold: number;
  grade: string;
}

// ─── Default rubric helper ────────────────────────────────────────────────────

/**
 * Returns a sensible default rubric for the given difficulty level.
 * Scenarios may override individual fields as needed.
 */
export function defaultRubric(
  difficulty: 'easy' | 'moderate' | 'hard' | 'expert'
): ScoringRubric {
  const durations: Record<string, number> = {
    easy: 420,     // 7 min
    moderate: 600, // 10 min
    hard: 780,     // 13 min
    expert: 960,   // 16 min
  };
  const thresholds: Record<string, number> = {
    easy: 60, moderate: 65, hard: 70, expert: 75,
  };
  return {
    passThreshold: thresholds[difficulty],
    weights: { timing: 0.15, appropriateness: 0.35, safety: 0.30, completeness: 0.20 },
    criteria: {
      timing: {
        targetDurationSec: durations[difficulty],
        toleranceSec: 60,
      },
      appropriateness: {
        drugRanges: [
          { drug: 'midazolam',  minDose: 0.5,  maxDose: 2.0  },
          { drug: 'fentanyl',   minDose: 25,   maxDose: 100  },
          { drug: 'propofol',   minDose: 10,   maxDose: 200  },
          { drug: 'ketamine',   minDose: 10,   maxDose: 100  },
          { drug: 'dexmedetomidine', minDose: 0.5, maxDose: 2.0 },
        ],
      },
      safety: {
        spo2DangerThreshold: 88,
        moassMinAllowed: 1,
        maxDangerSeconds: 30,
      },
      completeness: {
        requiredStepFraction: 0.75,
      },
    },
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function letterGrade(percent: number): string {
  if (percent >= 90) return 'A';
  if (percent >= 80) return 'B';
  if (percent >= 70) return 'C';
  if (percent >= 60) return 'D';
  return 'F';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Dimension scorers ────────────────────────────────────────────────────────

function scoreTiming(
  criteria: ScoringRubric['criteria']['timing'],
  session: ScoringSession,
  maxScore: number
): DimensionScore {
  const { targetDurationSec, toleranceSec } = criteria;
  const elapsed = session.elapsedSeconds;
  const details: string[] = [];

  details.push(`Scenario completed in ${elapsed}s (target ${targetDurationSec}s ± ${toleranceSec}s).`);

  let rawFraction: number;
  const lower = targetDurationSec - toleranceSec;
  const upper = targetDurationSec + toleranceSec * 2;
  const deadline = targetDurationSec * 3;

  if (elapsed <= lower) {
    // Finished unusually fast — still award full score (rushed but not penalised)
    rawFraction = 1.0;
    details.push('Completed ahead of schedule.');
  } else if (elapsed <= upper) {
    rawFraction = 1.0;
    details.push('Completed within the ideal time window.');
  } else if (elapsed < deadline) {
    // Linear decay from 1.0 at `upper` to 0.0 at `deadline`
    rawFraction = 1.0 - (elapsed - upper) / (deadline - upper);
    details.push('Took longer than ideal; pacing could be improved.');
  } else {
    rawFraction = 0.0;
    details.push('Scenario took more than 3× the target duration.');
  }

  const score = Math.round(rawFraction * maxScore);
  return { label: 'Timing', score, maxScore, percent: Math.round(rawFraction * 100), details };
}

function scoreAppropriateness(
  criteria: ScoringRubric['criteria']['appropriateness'],
  session: ScoringSession,
  maxScore: number
): DimensionScore {
  const details: string[] = [];
  const { drugRanges } = criteria;

  if (drugRanges.length === 0) {
    return { label: 'Appropriateness', score: maxScore, maxScore, percent: 100, details: ['No drug criteria defined — full credit awarded.'] };
  }

  // Collect bolus events from the event log
  const bolusEvents = session.eventLog.filter(e => e.type === 'bolus');

  let totalChecks = 0;
  let passedChecks = 0;

  for (const range of drugRanges) {
    const relevantBoluses = bolusEvents.filter(e =>
      e.message.toLowerCase().includes(range.drug.toLowerCase())
    );

    if (relevantBoluses.length === 0) continue;

    for (const ev of relevantBoluses) {
      totalChecks++;
      // Message format from useSimStore: "<DrugName> <dose> <unit> bolus"
      // e.g. "Midazolam 1 mg bolus" or "Fentanyl 50 mcg bolus"
      // Extract the first standalone number immediately after the drug name.
      const dosePattern = new RegExp(
        range.drug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + // escape drug name
        '\\s+([\\d.]+)',
        'i'
      );
      const match = ev.message.match(dosePattern);
      const dose = match ? parseFloat(match[1]) : NaN;

      if (isNaN(dose)) {
        // Cannot parse — give benefit of doubt
        passedChecks++;
        continue;
      }

      if (dose >= range.minDose && dose <= range.maxDose) {
        passedChecks++;
        details.push(`✅ ${range.drug} ${dose} — within range (${range.minDose}–${range.maxDose}).`);
      } else {
        details.push(`⚠️ ${range.drug} ${dose} — outside recommended range (${range.minDose}–${range.maxDose}).`);
      }
    }
  }

  if (totalChecks === 0) {
    details.push('No matching drug boluses found in event log — full credit awarded.');
    return { label: 'Appropriateness', score: maxScore, maxScore, percent: 100, details };
  }

  const rawFraction = clamp(passedChecks / totalChecks, 0, 1);
  const score = Math.round(rawFraction * maxScore);
  return {
    label: 'Appropriateness',
    score,
    maxScore,
    percent: Math.round(rawFraction * 100),
    details,
  };
}

function scoreSafety(
  criteria: ScoringRubric['criteria']['safety'],
  session: ScoringSession,
  maxScore: number
): DimensionScore {
  const details: string[] = [];
  const { spo2DangerThreshold, moassMinAllowed, maxDangerSeconds } = criteria;

  // Count seconds below SpO2 threshold
  const lowSpo2Seconds = session.trendData.filter(
    pt => pt.vitals.spo2 < spo2DangerThreshold
  ).length;

  // Count seconds at dangerous MOASS level
  const dangerMoassSeconds = session.trendData.filter(
    pt => pt.moass < moassMinAllowed
  ).length;

  const totalDangerSeconds = lowSpo2Seconds + dangerMoassSeconds;

  if (lowSpo2Seconds > 0) {
    details.push(`SpO2 below ${spo2DangerThreshold}% for ${lowSpo2Seconds}s.`);
  } else {
    details.push(`SpO2 remained above ${spo2DangerThreshold}% throughout.`);
  }

  if (dangerMoassSeconds > 0) {
    details.push(`MOASS below ${moassMinAllowed} (over-sedation) for ${dangerMoassSeconds}s.`);
  } else {
    details.push(`MOASS ≥ ${moassMinAllowed} maintained throughout.`);
  }

  // Also flag danger-severity log entries
  const dangerEvents = session.eventLog.filter(e => e.severity === 'danger');
  if (dangerEvents.length > 0) {
    details.push(`${dangerEvents.length} critical alert(s) triggered.`);
  }

  // Compute penalty fraction: 0 danger seconds → no penalty; maxDangerSeconds → full deduction
  const penaltyFraction = clamp(totalDangerSeconds / maxDangerSeconds, 0, 1);
  const rawFraction = 1.0 - penaltyFraction;
  const score = Math.round(rawFraction * maxScore);

  return {
    label: 'Safety',
    score,
    maxScore,
    percent: Math.round(rawFraction * 100),
    details,
  };
}

function scoreCompleteness(
  criteria: ScoringRubric['criteria']['completeness'],
  session: ScoringSession,
  maxScore: number
): DimensionScore {
  const details: string[] = [];
  const { completedStepIds, totalStepCount } = session;
  const { requiredStepFraction } = criteria;

  if (totalStepCount === 0) {
    return { label: 'Completeness', score: maxScore, maxScore, percent: 100, details: ['No steps defined — full credit.'] };
  }

  const fraction = completedStepIds.length / totalStepCount;
  details.push(`Completed ${completedStepIds.length} of ${totalStepCount} steps.`);

  let rawFraction: number;
  if (fraction >= requiredStepFraction) {
    rawFraction = 1.0;
    details.push('All required steps completed.');
  } else {
    rawFraction = fraction / requiredStepFraction;
    details.push(`Required ≥ ${Math.round(requiredStepFraction * 100)}% of steps — missed some.`);
  }

  const score = Math.round(rawFraction * maxScore);
  return {
    label: 'Completeness',
    score,
    maxScore,
    percent: Math.round(rawFraction * 100),
    details,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Pure function — given a rubric and a session snapshot returns a deterministic
 * ScoringSummary.  No imports from React or any store.
 */
export function scoreScenario(
  rubric: ScoringRubric,
  session: ScoringSession
): ScoringSummary {
  const MAX_TOTAL = 100;
  const w = rubric.weights;

  // Normalise weights so they always sum to 1 (defensive)
  const wSum = w.timing + w.appropriateness + w.safety + w.completeness;
  const wN = wSum > 0 ? wSum : 1;

  const maxTiming         = Math.round((w.timing         / wN) * MAX_TOTAL);
  const maxAppropriateness = Math.round((w.appropriateness / wN) * MAX_TOTAL);
  const maxSafety         = Math.round((w.safety         / wN) * MAX_TOTAL);
  // Assign any rounding remainder to completeness
  const maxCompleteness   = MAX_TOTAL - maxTiming - maxAppropriateness - maxSafety;

  const timing         = scoreTiming(rubric.criteria.timing, session, maxTiming);
  const appropriateness = scoreAppropriateness(rubric.criteria.appropriateness, session, maxAppropriateness);
  const safety         = scoreSafety(rubric.criteria.safety, session, maxSafety);
  const completeness   = scoreCompleteness(rubric.criteria.completeness, session, maxCompleteness);

  const totalScore = timing.score + appropriateness.score + safety.score + completeness.score;
  // totalScore is already expressed as points out of MAX_TOTAL (100), so percent equals totalScore directly.
  const percentScore = totalScore;
  const passed = percentScore >= rubric.passThreshold;

  return {
    dimensions: { timing, appropriateness, safety, completeness },
    totalScore,
    maxScore: MAX_TOTAL,
    percentScore,
    passed,
    passThreshold: rubric.passThreshold,
    grade: letterGrade(percentScore),
  };
}
