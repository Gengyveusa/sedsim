import type { Complex, QuantumContext, QuantumMultipliers } from './types';

export const CONTEXTS: Record<string, QuantumContext> = {
  osa: {
    id: 'osa',
    name: 'OSA Comorbidity',
    description: 'Obstructive Sleep Apnea - increases contextual sensitivity',
    projector: [[0.85, 0.12], [0.12, 0.25]],
    phase: 1.8,
    bias: { ke0: -0.18, emax: 0.22, synergy: 0.15, respRisk: 0.28 },
  },
  pain: {
    id: 'pain',
    name: 'High Pain Stimulus',
    description: 'Intense procedural pain - strong context effect',
    projector: [[0.35, 0.45], [0.45, 0.75]],
    phase: 2.4,
    bias: { ke0: 0.12, emax: 0.35, synergy: 0.08, respRisk: 0.19 },
  },
  deep: {
    id: 'deep',
    name: 'Deep Sedation Intent',
    description: 'Targeting MOASS 1-2',
    projector: [[0.65, 0.25], [0.25, 0.45]],
    phase: 0.9,
    bias: { ke0: -0.08, emax: 0.41, synergy: 0.25, respRisk: 0.31 },
  },
  elderly: {
    id: 'elderly',
    name: 'Elderly Frailty',
    description: 'Age-related sensitivity',
    projector: [[0.75, 0.18], [0.18, 0.35]],
    phase: 1.4,
    bias: { ke0: -0.25, emax: 0.12, synergy: 0.10, respRisk: 0.22 },
  },
  opioid: {
    id: 'opioid',
    name: 'Opioid Synergy',
    description: 'Fentanyl + Propofol interaction context',
    projector: [[0.45, 0.55], [0.55, 0.65]],
    phase: 2.1,
    bias: { ke0: 0.05, emax: 0.18, synergy: 0.48, respRisk: 0.37 },
  },
};

// Simple complex helpers
function complexNorm(vec: Complex[]): number {
  return Math.sqrt(vec.reduce((sum, c) => sum + c.re * c.re + c.im * c.im, 0));
}

function normalize(vec: Complex[]): Complex[] {
  const n = complexNorm(vec);
  return vec.map(c => ({ re: c.re / n, im: c.im / n }));
}

// Kept for future use in full Hilbert-space operations
export function complexMultiply(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

// Apply a projector (very simplified matrix application for cognition model)
function applyProjector(state: Complex[], proj: number[][]): Complex[] {
  const newState: Complex[] = [
    {
      re: proj[0][0] * state[0].re + proj[0][1] * state[1].re,
      im: proj[0][0] * state[0].im + proj[0][1] * state[1].im,
    },
    {
      re: proj[1][0] * state[0].re + proj[1][1] * state[1].re,
      im: proj[1][0] * state[0].im + proj[1][1] * state[1].im,
    },
  ];
  return normalize(newState);
}

// Main function - compute multipliers based on context order
export function computeQuantumMultipliers(
  contextOrder: string[],
  patientSensitivity: number = 1.0,
): QuantumMultipliers {
  let state: Complex[] = [
    { re: 0.85, im: 0.0 },   // Mostly "stable" response initially
    { re: 0.15, im: 0.52 },  // Some superposition of risky response
  ];
  state = normalize(state);

  let totalInterference = 0;

  contextOrder.forEach((ctxId, index) => {
    const ctx = CONTEXTS[ctxId];
    if (!ctx) return;

    state = applyProjector(state, ctx.projector);

    // Add interference phase rotation
    const phaseRot = ctx.phase * (index + 1) * 0.6;
    state[1].im = state[1].re * Math.sin(phaseRot) + state[1].im * Math.cos(phaseRot);
    totalInterference += Math.cos(phaseRot) * 0.4;
  });

  const riskProb = state[1].re * state[1].re + state[1].im * state[1].im; // |risky amplitude|^2

  // Classical baseline (no interference)
  const classicalRisk = 0.18;

  const interferenceStrength = Math.abs(totalInterference) * 0.7;

  // Derive multipliers from quantum deviation
  const riskDelta = riskProb - classicalRisk;

  return {
    ke0: 1.0 + (riskDelta * -0.65) + (patientSensitivity - 1) * -0.12,
    emax: 1.0 + (riskDelta * 1.45),
    synergy: 1.0 + (riskDelta * 2.1),
    respDepressionRisk: Math.max(0.05, Math.min(0.85, classicalRisk + riskDelta * 1.8)),
    interferenceStrength: Math.max(0, Math.min(1, interferenceStrength)),
  };
}

// Helper for initial state based on patient archetype
export function createInitialState(archetype: string): Complex[] {
  const base: Complex[] = archetype.includes('obese') || archetype.includes('osa')
    ? [{ re: 0.72, im: 0.0 }, { re: 0.28, im: 0.45 }]
    : [{ re: 0.88, im: 0.0 }, { re: 0.12, im: 0.35 }];
  return normalize(base);
}
