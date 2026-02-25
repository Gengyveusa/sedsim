# SedSim Data Flow Audit

## Architecture

```
tick() → stepPK() → calculateVitals(pkStates, patient, prevVitals, fio2, prevRhythm,
                                     elapsedSeconds, interventions, ivFluids, scenarioOverrides)
  ↓
Single Vitals + Rhythm + EEG + MOASS + Alarms + EmergencyState
  ↓
Zustand store update (ONE atomic set() call)
  ↓
ALL components re-render from store (pure consumers)
```

## Component Data Flow

### EchoSim.tsx
- **Reads from props:** `vitals` (hr, sbp, dbp, map, spo2, rr, etco2), `patient`, `moass`, `combinedEff`, `pkStates`
- **Independent computation:** YES — computes hemodynamics (EF, CO, SV, etc.) from pkStates and vitals
- **Status:** Receives canonical vitals from store (via parent Dashboard), then derives echo-specific parameters locally. This is acceptable since EchoSim uses vitals.sbp/hr from store as its primary inputs.

### FrankStarlingCurve.tsx
- **Reads from props:** `vitals`, `patient`, `moass`, `combinedEff`, `pkStates`
- **Independent computation:** YES — computes PV loop parameters from pkStates, patient age/comorbidities
- **Status:** Uses vitals.sbp and vitals.hr from store as anchor points; derives PV loop locally. Acceptable.

### OxyHbCurve.tsx
- **Reads from props:** `vitals` (spo2, etco2), `fio2`, `patient`, `airwayDevice`
- **Independent computation:** YES — estimates PaO2 from etco2 and fio2 using alveolar gas equation
- **Status:** ✅ Uses vitals.spo2 from store as the current operating point (correct). PaO2 estimation is visualization-only.

### PhysiologyAvatar.tsx
- **Reads from props:** `vitals`, `moass`, `combinedEff`, `patient`, `rhythm`
- **Independent computation:** YES — computes cardioState from vitals using local `computeCardioState()`
- **Status:** ✅ Reads canonical vitals from store; local cardioState derivation is for display only. Chest rise = vitals.rr, skin color = vitals.spo2 thresholds (>94 normal, 90-94 pale, <90 cyanotic).

### SedationGauge.tsx
- **Reads from store:** `combinedEff`, `moass`, `pkStates`, `vitals`, `patient`
- **Independent computation:** NO — pure read from store for MOASS/vitals
- **Status:** ✅ Pure consumer

### EEGPanel.tsx
- **Reads from props:** `eegState` (from store), `isRunning`
- **Independent computation:** NO — pure read from store
- **Status:** ✅ Pure consumer

### MonitorPanel.tsx
- **Reads from props:** `vitals`, `history`; reads `isRunning` and `emergencyState` from store
- **Independent computation:** YES — generates ECG/pleth/capno waveforms from vitals
- **Status:** ✅ Waveform generation is visualization-only; uses canonical vitals.rhythm from store for ECG morphology. SpO2 pleth amplitude scales with pulse pressure (SBP-DBP). Capno flatlines when rr===0. **Alarm flash and audio alarms now driven by `emergencyState` from store (FIXED).**

### GhostDosePreview.tsx
- **Reads from store:** `pkStates`, `infusions`, `patient`, `vitals`, `fio2`, `interventions`
- **Independent computation:** NO — uses `predictForward()` → `calculateVitals()` (same physics engine)
- **Status:** ✅ Forward simulation now passes current `interventions` from store to `calculateVitals()`.

## Known Issues Fixed

### 1. Interventions Not Affecting Physiology (FIXED)
**Before:** `tick()` called `calculateVitals(pkStates, patient, prevVitals, fio2, ...)` without interventions.
**After:** `tick()` passes `state.interventions` and `ivFluidContext` to `calculateVitals()`.

**Intervention effects in `calculateVitals()`:**
| Intervention | Effect |
|---|---|
| `bag_mask` | Forces RR to ~90% of baseline; SpO2 uses higher effective FiO2 (≥0.5) |
| `jaw_thrust` | Recovers 40% of RR depression |
| `chin_lift` | Recovers 25% of RR depression |
| `oral_airway` | Recovers 30% of RR depression |
| `nasal_airway` | Recovers 25% of RR depression |
| `suction` | Recovers 15% of RR depression |
| IV fluids | 250mL → ~10% MAP improvement (saturates at 1000mL → 15%) |

### 2. Emergency State Not Propagated (FIXED)
**Before:** No unified emergency state; alarms in sim store, some in AI store.
**After:** `emergencyState: EmergencyState` computed every tick from `activeAlarms` and cardiac rhythm.

```typescript
interface EmergencyState {
  level: 'normal' | 'warning' | 'critical' | 'arrest';
  activeAlarms: Alarm[];
  isArrest: boolean; // VFib, VTach, asystole, PEA
  requiresImmediateIntervention: boolean;
}
```

### 3. Scenario Overrides Support (ADDED)
`calculateVitals()` now accepts `scenarioOverrides?: Partial<Vitals>` applied last, after all physiological calculations. This lets ScenarioEngine force-set specific vital parameters that propagate through the system.

### 4. VitalCoherenceMonitor Alarm Unification (FIXED)
**Before:** VitalCoherenceMonitor re-evaluated individual vital thresholds independently (polling every 2s), duplicating the logic in `checkAlarms()`.
**After:** VitalCoherenceMonitor now reads `activeAlarms` from the store — alarms computed by `checkAlarms()` in `tick()` — and uses those as the trigger condition for mentor messages. This ensures ONE alarm evaluation system drives both the display and the mentor.

### 5. GhostDosePreview Interventions (FIXED)
**Before:** `predictForward()` called `calculateVitals()` without passing current interventions.
**After:** `predictForward()` accepts an optional `interventions` parameter, and `GhostDosePreview` passes `state.interventions` from the store, so forward simulations respect active airway interventions.

## Remaining Divergences (Future Work)

1. **EchoSim & FrankStarlingCurve** still compute their own hemodynamic models. Could pre-compute `echoParams` and `frankStarlingPoint` in `tick()` and store them for pure consumption.
2. **VitalCoherenceMonitor** polls every 2 seconds; should be unified with the main alarm system.
3. **EEG** is generated from raw PK concentrations rather than from `combinedEff`; this means it doesn't automatically reflect synergistic drug interactions.
