/**
 * src/ai/simMasterBridge.ts
 * Bridges mentor.ts proactive teaching triggers → SimMaster visual annotations.
 *
 * When a proactive trigger fires (oversedation, respiratory depression, etc.),
 * this module converts the trigger into overlay annotations that highlight the
 * relevant panels and display the Socratic question visually.
 */

import type { ProactiveTriggerType } from './mentor';
import type { OverlayAnnotation } from '../components/SimMasterOverlay';

let bridgeIdCounter = 0;

/**
 * Map each proactive trigger type to the panel regions it should highlight
 * and the annotation severity.
 */
const TRIGGER_PANEL_MAP: Record<ProactiveTriggerType, {
  regions: string[];
  severity: OverlayAnnotation['severity'];
  action: OverlayAnnotation['action'];
}> = {
  oversedation: {
    regions: ['moass-gauge', 'eeg', 'drug-panel'],
    severity: 'warning',
    action: 'pulse',
  },
  respiratory_depression: {
    regions: ['rr', 'spo2', 'capno-wave'],
    severity: 'critical',
    action: 'pulse',
  },
  hemodynamic_instability: {
    regions: ['bp', 'hr', 'intervention-panel'],
    severity: 'critical',
    action: 'pulse',
  },
  drug_interaction: {
    regions: ['drug-panel', 'moass-gauge'],
    severity: 'info',
    action: 'highlight',
  },
  airway_compromise: {
    regions: ['airway-controls', 'spo2', 'rr'],
    severity: 'critical',
    action: 'pulse',
  },
  cardiac_arrest_delayed: {
    regions: ['ecg-wave', 'intervention-panel'],
    severity: 'critical',
    action: 'pulse',
  },
  incorrect_dosing: {
    regions: ['drug-panel'],
    severity: 'warning',
    action: 'point',
  },
  missed_reversal: {
    regions: ['drug-panel', 'rr'],
    severity: 'warning',
    action: 'point',
  },
};

/**
 * Convert a proactive teaching trigger + Socratic message into overlay
 * annotations. Returns one annotation per relevant panel region.
 *
 * @param triggerType  Which of the 8 trigger types fired.
 * @param message      The Socratic question / mentor message content.
 * @returns            Array of OverlayAnnotation objects for the AI store.
 */
export function triggerToOverlayAnnotations(
  triggerType: ProactiveTriggerType,
  message: string
): OverlayAnnotation[] {
  const mapping = TRIGGER_PANEL_MAP[triggerType];
  if (!mapping) return [];

  const truncatedMsg = message.length > 200
    ? message.slice(0, 197) + '...'
    : message;

  // Create an annotation for the primary region (first in the list)
  // with the full message, and highlight-only for secondary regions.
  return mapping.regions.map((region, idx) => ({
    id: `trigger-${++bridgeIdCounter}-${Date.now()}`,
    targetRegion: region,
    severity: mapping.severity,
    message: idx === 0 ? truncatedMsg : '',
    action: idx === 0 ? mapping.action : 'highlight' as OverlayAnnotation['action'],
    createdAt: Date.now(),
    autoDismissMs: mapping.severity === 'critical' ? 20000 : 15000,
  }));
}
