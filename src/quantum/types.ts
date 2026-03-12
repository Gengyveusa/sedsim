export interface Complex {
  re: number;
  im: number;
}

export interface QuantumContext {
  id: string;
  name: string;
  description: string;
  projector: number[][]; // 2x2 Hermitian projector matrix (simplified)
  phase: number;         // interference phase in radians
  bias: {
    ke0: number;
    emax: number;
    synergy: number;
    respRisk: number;
  };
}

export interface QuantumMultipliers {
  ke0: number;
  emax: number;
  synergy: number;
  respDepressionRisk: number;
  interferenceStrength: number;
}

export interface QuantumState {
  vector: Complex[];
  contextOrder: string[];
  multipliers: QuantumMultipliers;
}
