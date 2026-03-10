/**
 * xAPI (Tin Can) client for SedSim
 *
 * Generates and sends xAPI statements to a Learning Record Store (LRS).
 * Supports the key verbs required for LMS integration:
 *   - attempted  (scenario started)
 *   - completed  (scenario finished)
 *   - scored     (score reported)
 *   - interacted (drug administered / intervention applied)
 *   - experienced (simulation tick milestone)
 */

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export const XAPI_VERBS = {
  attempted: {
    id: 'http://adlnet.gov/expapi/verbs/attempted',
    display: { 'en-US': 'attempted' },
  },
  completed: {
    id: 'http://adlnet.gov/expapi/verbs/completed',
    display: { 'en-US': 'completed' },
  },
  scored: {
    id: 'http://adlnet.gov/expapi/verbs/scored',
    display: { 'en-US': 'scored' },
  },
  interacted: {
    id: 'http://adlnet.gov/expapi/verbs/interacted',
    display: { 'en-US': 'interacted' },
  },
  experienced: {
    id: 'http://adlnet.gov/expapi/verbs/experienced',
    display: { 'en-US': 'experienced' },
  },
  administered: {
    id: 'https://sedsim.app/verbs/administered-drug',
    display: { 'en-US': 'administered drug' },
  },
  'applied-intervention': {
    id: 'https://sedsim.app/verbs/applied-intervention',
    display: { 'en-US': 'applied intervention' },
  },
} as const;

export type XApiVerbKey = keyof typeof XAPI_VERBS;

// ─── Activity definitions ─────────────────────────────────────────────────────

export const ACTIVITY_BASE = 'https://sedsim.app/activities';

export function simulationActivity(scenarioId?: string) {
  const id = scenarioId
    ? `${ACTIVITY_BASE}/scenario/${scenarioId}`
    : `${ACTIVITY_BASE}/simulation`;
  return {
    id,
    definition: {
      type: 'http://adlnet.gov/expapi/activities/simulation',
      name: { 'en-US': scenarioId ? `SedSim Scenario: ${scenarioId}` : 'SedSim Simulation' },
      description: {
        'en-US': 'Real-time pharmacokinetic/pharmacodynamic sedation simulator',
      },
    },
    objectType: 'Activity' as const,
  };
}

export function drugActivity(drugName: string) {
  return {
    id: `${ACTIVITY_BASE}/drug/${drugName.toLowerCase().replace(/\s+/g, '-')}`,
    definition: {
      type: 'https://sedsim.app/activity-types/drug-administration',
      name: { 'en-US': drugName },
    },
    objectType: 'Activity' as const,
  };
}

export function interventionActivity(intervention: string) {
  return {
    id: `${ACTIVITY_BASE}/intervention/${intervention.toLowerCase().replace(/\s+/g, '-')}`,
    definition: {
      type: 'https://sedsim.app/activity-types/intervention',
      name: { 'en-US': intervention.replace(/_/g, ' ') },
    },
    objectType: 'Activity' as const,
  };
}

// ─── Statement types ──────────────────────────────────────────────────────────

export interface XApiActor {
  name: string;
  mbox: string;
  objectType: 'Agent';
}

export interface XApiStatement {
  id: string;
  actor: XApiActor;
  verb: { id: string; display: Record<string, string> };
  object: {
    id: string;
    definition?: Record<string, unknown>;
    objectType: 'Activity';
  };
  result?: {
    score?: { scaled: number; raw?: number; min?: number; max?: number };
    completion?: boolean;
    success?: boolean;
    duration?: string;
    response?: string;
    extensions?: Record<string, unknown>;
  };
  context?: {
    platform?: string;
    language?: string;
    extensions?: Record<string, unknown>;
  };
  timestamp: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a UUID v4 (simple, browser-compatible). */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Convert elapsed seconds to ISO 8601 duration string (PT…S). */
export function secondsToDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  let dur = 'PT';
  if (h > 0) dur += `${h}H`;
  if (m > 0) dur += `${m}M`;
  if (s > 0 || (h === 0 && m === 0)) dur += `${s}S`;
  return dur;
}

// ─── Statement builders ───────────────────────────────────────────────────────

export function buildAttemptedStatement(
  actor: XApiActor,
  scenarioId?: string,
  extensions?: Record<string, unknown>,
): XApiStatement {
  return {
    id: uuid(),
    actor,
    verb: XAPI_VERBS.attempted,
    object: simulationActivity(scenarioId),
    context: {
      platform: 'SedSim',
      language: 'en-US',
      extensions,
    },
    timestamp: new Date().toISOString(),
  };
}

export function buildCompletedStatement(
  actor: XApiActor,
  scenarioId: string | undefined,
  elapsedSeconds: number,
  success?: boolean,
): XApiStatement {
  return {
    id: uuid(),
    actor,
    verb: XAPI_VERBS.completed,
    object: simulationActivity(scenarioId),
    result: {
      completion: true,
      success,
      duration: secondsToDuration(elapsedSeconds),
    },
    context: { platform: 'SedSim', language: 'en-US' },
    timestamp: new Date().toISOString(),
  };
}

export function buildScoredStatement(
  actor: XApiActor,
  scenarioId: string | undefined,
  rawScore: number,
  maxScore: number,
  elapsedSeconds: number,
): XApiStatement {
  const scaled = maxScore > 0 ? rawScore / maxScore : 0;
  return {
    id: uuid(),
    actor,
    verb: XAPI_VERBS.scored,
    object: simulationActivity(scenarioId),
    result: {
      score: {
        scaled: Math.round(scaled * 100) / 100,
        raw: rawScore,
        min: 0,
        max: maxScore,
      },
      completion: true,
      success: scaled >= 0.7,
      duration: secondsToDuration(elapsedSeconds),
    },
    context: { platform: 'SedSim', language: 'en-US' },
    timestamp: new Date().toISOString(),
  };
}

export function buildDrugAdministeredStatement(
  actor: XApiActor,
  drugName: string,
  dose: number,
  unit: string,
  elapsedSeconds: number,
  scenarioId?: string,
): XApiStatement {
  return {
    id: uuid(),
    actor,
    verb: XAPI_VERBS.administered,
    object: drugActivity(drugName),
    result: {
      response: `${dose} ${unit}`,
      extensions: {
        'https://sedsim.app/extensions/sim-time': elapsedSeconds,
        'https://sedsim.app/extensions/dose': dose,
        'https://sedsim.app/extensions/unit': unit,
      },
    },
    context: {
      platform: 'SedSim',
      language: 'en-US',
      extensions: scenarioId
        ? { 'https://sedsim.app/extensions/scenario-id': scenarioId }
        : undefined,
    },
    timestamp: new Date().toISOString(),
  };
}

export function buildInterventionStatement(
  actor: XApiActor,
  intervention: string,
  elapsedSeconds: number,
  scenarioId?: string,
): XApiStatement {
  return {
    id: uuid(),
    actor,
    verb: XAPI_VERBS['applied-intervention'],
    object: interventionActivity(intervention),
    result: {
      extensions: {
        'https://sedsim.app/extensions/sim-time': elapsedSeconds,
      },
    },
    context: {
      platform: 'SedSim',
      language: 'en-US',
      extensions: scenarioId
        ? { 'https://sedsim.app/extensions/scenario-id': scenarioId }
        : undefined,
    },
    timestamp: new Date().toISOString(),
  };
}

// ─── LRS sender ───────────────────────────────────────────────────────────────

export interface LRSConfig {
  endpoint: string;
  authType: 'basic' | 'bearer' | 'none';
  username?: string;
  password?: string;
  token?: string;
}

function buildAuthHeader(config: LRSConfig): string | null {
  if (config.authType === 'basic' && config.username && config.password) {
    const encoded = btoa(`${config.username}:${config.password}`);
    return `Basic ${encoded}`;
  }
  if (config.authType === 'bearer' && config.token) {
    return `Bearer ${config.token}`;
  }
  return null;
}

/**
 * Send one or more xAPI statements to the configured LRS.
 * Returns `true` on HTTP 2xx, `false` otherwise (never throws).
 */
export async function sendStatements(
  statements: XApiStatement[],
  config: LRSConfig,
): Promise<boolean> {
  if (!config.endpoint) return false;
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Experience-API-Version': '1.0.3',
    };
    const auth = buildAuthHeader(config);
    if (auth) headers['Authorization'] = auth;

    const url = config.endpoint.replace(/\/$/, '') + '/statements';
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(statements.length === 1 ? statements[0] : statements),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Test LRS connectivity by sending a minimal `experienced` statement.
 * Returns `true` on success.
 */
export async function testLRSConnection(
  config: LRSConfig,
  actor: XApiActor,
): Promise<boolean> {
  const testStatement: XApiStatement = {
    id: uuid(),
    actor,
    verb: XAPI_VERBS.experienced,
    object: simulationActivity(),
    context: { platform: 'SedSim', language: 'en-US' },
    timestamp: new Date().toISOString(),
  };
  return sendStatements([testStatement], config);
}
