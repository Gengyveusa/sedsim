import { create } from 'zustand';
import type { StudySlice } from './slices/studySlice';
import { createStudySlice } from './slices/studySlice';

export type { StudySlice };

/**
 * Study store for the A/B crossover study protocol.
 * Separate from useSimStore and useAIStore to keep study concerns isolated.
 */
const useStudyStore = create<StudySlice>()((...a) => ({
  ...createStudySlice(...a),
}));

export default useStudyStore;
