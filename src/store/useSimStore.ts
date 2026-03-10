import { create } from 'zustand';
import type { SimStore } from './storeTypes';
import { createPatientSlice } from './slices/patientSlice';
import { createDrugSlice } from './slices/drugSlice';
import { createVitalsSlice } from './slices/vitalsSlice';
import { createScenarioSlice } from './slices/scenarioSlice';
import { createUiSlice } from './slices/uiSlice';

// Re-export public types so existing consumers remain compatible
export type { DrugProtocol, TrueNorth } from './slices/patientSlice';
export type { IVFluidState } from './slices/drugSlice';
export { formatTime } from './slices/uiSlice';

/**
 * Root simulation store composed from typed slices.
 *
 * Slices:
 *  - patientSlice  – patient demographics & archetype selection
 *  - drugSlice     – PK states, infusions, IV fluids
 *  - vitalsSlice   – vitals, alarms, EEG, visualization params
 *  - scenarioSlice – interventions, airway, scenario protocols
 *  - uiSlice       – simulation clock, tab/gauge UI, tick/reset
 */
const useSimStore = create<SimStore>()((...a) => ({
  ...createPatientSlice(...a),
  ...createDrugSlice(...a),
  ...createVitalsSlice(...a),
  ...createScenarioSlice(...a),
  ...createUiSlice(...a),
}));

export default useSimStore;
