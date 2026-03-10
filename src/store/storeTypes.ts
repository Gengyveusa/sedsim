import type { PatientSlice } from './slices/patientSlice';
import type { DrugSlice } from './slices/drugSlice';
import type { VitalsSlice } from './slices/vitalsSlice';
import type { ScenarioSlice } from './slices/scenarioSlice';
import type { UiSlice } from './slices/uiSlice';

/**
 * Combined type for the main simulation store.
 * Composed from all typed slices.
 */
export type SimStore = PatientSlice & DrugSlice & VitalsSlice & ScenarioSlice & UiSlice;
