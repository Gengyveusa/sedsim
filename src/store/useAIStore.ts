import { create } from 'zustand';
import type { AISlice } from './slices/aiSlice';
import { createAISlice } from './slices/aiSlice';

// Re-export public slice type so consumers can reference it if needed
export type { AISlice };

/**
 * AI store composed from the typed aiSlice.
 *
 * Slice:
 *  - aiSlice – orchestrator, mentor, scenario engine, SimMaster, conductor
 */
const useAIStore = create<AISlice>()((...a) => ({
  ...createAISlice(...a),
}));

export default useAIStore;
