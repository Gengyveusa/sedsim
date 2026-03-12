import { create } from 'zustand';
import { computeQuantumMultipliers, createInitialState } from '../quantum/math';
import type { QuantumState, QuantumMultipliers } from '../quantum/types';

interface QuantumStore extends QuantumState {
  toggleEnabled: () => void;
  setContextOrder: (order: string[]) => void;
  addContext: (contextId: string) => void;
  removeContext: (contextId: string) => void;
  recompute: (patientArchetype: string, sensitivity: number) => void;
  isEnabled: boolean;
}

export const useQuantumStore = create<QuantumStore>((set, get) => ({
  vector: [{ re: 0.85, im: 0 }, { re: 0.15, im: 0.5 }],
  contextOrder: ['osa', 'pain', 'deep'],
  multipliers: {
    ke0: 1.0,
    emax: 1.0,
    synergy: 1.0,
    respDepressionRisk: 0.18,
    interferenceStrength: 0,
  } satisfies QuantumMultipliers,
  isEnabled: true,

  toggleEnabled: () => set((state) => ({ isEnabled: !state.isEnabled })),

  setContextOrder: (order) => {
    set({ contextOrder: order });
    get().recompute('standard', 1.0);
  },

  addContext: (id) => {
    const current = get().contextOrder;
    if (!current.includes(id)) {
      set({ contextOrder: [...current, id] });
    }
  },

  removeContext: (id) => {
    set((state) => ({
      contextOrder: state.contextOrder.filter(c => c !== id),
    }));
  },

  recompute: (patientArchetype: string, sensitivity: number) => {
    if (!get().isEnabled) return;

    const newMultipliers = computeQuantumMultipliers(get().contextOrder, sensitivity);
    const newVector = createInitialState(patientArchetype);

    set({
      vector: newVector,
      multipliers: newMultipliers,
    });
  },
}));

export default useQuantumStore;
