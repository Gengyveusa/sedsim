# SedSim: Real-Time Pharmacokinetic Sedation Simulator
## Functional Specification for Google Antigravity Agent Build

---

## PROJECT OVERVIEW

Build a browser-based, real-time procedural sedation simulator powered by validated pharmacokinetic-pharmacodynamic (PK/PD) models. This is NOT a branching scenario trainer — it is a computational physiology engine with a clinical training interface. Every vital sign, every waveform, every patient response is derived from the underlying math, not from pre-scripted outcomes.

**Tech Stack**: React 18+ with TypeScript, Tailwind CSS, Vite for bundling. Single-page application, no backend required for Phase 1. All computation runs client-side in the browser.

**Design Direction**: Medical-grade dark UI. Think Philips IntelliVue or GE CARESCAPE monitor aesthetic — black background, colored waveform traces (green SpO2, white ECG, yellow capnography, red arterial line), crisp sans-serif numerics. The monitor panel should feel like an actual anesthesia workstation. The drug administration panel should feel like a modern medication ordering system. No cartoon aesthetics, no toy-like elements. This is a professional clinical tool.

**Typography**: Use `JetBrains Mono` for numeric displays and monitor values. Use `IBM Plex Sans` for UI labels, headings, and body text. Import both from Google Fonts.

**Color Palette**:
- Background: `#0a0a0f` (near-black with slight blue)
- Monitor panel: `#111118` 
- SpO2 waveform/value: `#00ff88` (green)
- ECG waveform: `#00cc66` (slightly different green)
- Capnography waveform/value: `#ffcc00` (yellow)
- Heart rate: `#00ff88` (green)
- Blood pressure: `#ff4444` (red)
- Respiratory rate: `#ffcc00` (yellow)
- BIS/sedation depth: `#00aaff` (cyan/blue)
- Drug administration buttons: `#2563eb` (blue)
- Warning states: `#ff6600` (orange)
- Critical/alarm states: `#ff0000` (red) with pulsing animation
- UI text primary: `#e0e0e8`
- UI text secondary: `#888898`

---

## ARCHITECTURE

The application has four core modules. Build them as independent modules that communicate through a shared state manager (React Context or Zustand).

### Module 1: PK/PD Computation Engine (`/src/engine/`)

This is the heart of the simulator. It solves ordinary differential equations in real-time to compute drug concentrations across body compartments.

#### 1.1 Three-Compartment Pharmacokinetic Model

For each drug, implement a standard three-compartment mammillary model:

```
dA1/dt = -(k10 + k12 + k13) * A1 + k21 * A2 + k31 * A3 + R(t)
dA2/dt = k12 * A1 - k21 * A2
dA3/dt = k13 * A1 - k31 * A3
```

Where:
- `A1` = amount of drug in central compartment (mg)
- `A2` = amount in rapid peripheral compartment (mg)
- `A3` = amount in slow peripheral compartment (mg)
- `k10` = elimination rate constant (min⁻¹)
- `k12, k21` = distribution rate constants to/from rapid peripheral (min⁻¹)
- `k13, k31` = distribution rate constants to/from slow peripheral (min⁻¹)
- `R(t)` = rate of drug input (mg/min) — bolus or infusion

Plasma concentration: `Cp = A1 / V1` where V1 is central compartment volume.

#### 1.2 Effect-Site Equilibration

Add a fourth (effect-site) compartment with negligible volume:

```
dCe/dt = ke0 * (Cp - Ce)
```

Where:
- `Ce` = effect-site concentration (µg/mL)
- `ke0` = effect-site equilibration rate constant (min⁻¹)
- `Cp` = plasma concentration (µg/mL)

This models the delay between plasma drug levels and brain effect — the critical lag that causes oversedation.

#### 1.3 Pharmacodynamic Response (Sigmoid Emax Model)

```
Effect = E0 + Emax * Ce^γ / (Ce50^γ + Ce^γ)
```

Where:
- `E0` = baseline effect (no drug)
- `Emax` = maximum drug effect
- `Ce50` = effect-site concentration producing 50% of maximum effect
- `γ` (gamma) = Hill coefficient (steepness of concentration-response curve)

#### 1.4 Drug Parameter Library

Implement the following three drugs with these population PK parameters. Each drug is a TypeScript object/class with these properties:

**PROPOFOL** (Eleveld model, simplified for real-time):
```typescript
{
  name: "Propofol",
  unit: "mg",
  concentrationUnit: "µg/mL",
  bolusOptions: [10, 20, 30, 40, 50], // mg
  infusionOptions: [25, 50, 75, 100, 150, 200], // µg/kg/min
  color: "#a78bfa", // purple accent for drug-specific UI
  // PK parameters (adult 70kg, 170cm, 40yr male baseline)
  // These will be scaled by patient covariates
  basePK: {
    V1: 6.28,    // L (central volume)
    V2: 25.5,    // L (rapid peripheral)
    V3: 273,     // L (slow peripheral)
    CL1: 1.89,   // L/min (elimination clearance)
    CL2: 1.29,   // L/min (intercompartmental clearance 1)
    CL3: 0.836,  // L/min (intercompartmental clearance 2)
    ke0: 0.146,  // min⁻¹ (effect-site equilibration)
  },
  // PD parameters for BIS
  basePD: {
    E0: 93,       // baseline BIS
    Emax: 93,     // maximum BIS reduction
    Ce50: 3.08,   // µg/mL for 50% BIS reduction
    gamma: 1.47,  // Hill coefficient
  },
  // Covariate scaling functions (simplified Eleveld)
  scaleForPatient: (patient) => {
    // V1 scales with weight
    // CL1 scales with weight and age
    // Females have ~20% lower CL1
    // Elderly (>65) have ~30% reduced CL1
    // Obesity: V1 increases, CL1 increases but less proportionally
  }
}
```

**MIDAZOLAM** (Maitre model):
```typescript
{
  name: "Midazolam",
  unit: "mg",
  concentrationUnit: "ng/mL",
  bolusOptions: [0.5, 1.0, 1.5, 2.0], // mg
  infusionOptions: [], // typically bolus only for procedural sedation
  color: "#60a5fa", // blue accent
  basePK: {
    V1: 5.88,     // L
    V2: 16.0,     // L  
    V3: 98.3,     // L
    CL1: 0.408,   // L/min
    CL2: 0.373,   // L/min
    CL3: 0.0367,  // L/min
    ke0: 0.076,   // min⁻¹ (slower onset than propofol)
  },
  basePD: {
    E0: 93,
    Emax: 50,      // midazolam alone has ceiling effect on BIS
    Ce50: 120,     // ng/mL
    gamma: 3.0,
  }
}
```

**FENTANYL** (Scott model):
```typescript
{
  name: "Fentanyl",
  unit: "µg",
  concentrationUnit: "ng/mL",
  bolusOptions: [12.5, 25, 50, 75, 100], // µg
  infusionOptions: [0.5, 1.0, 1.5, 2.0], // µg/kg/hr
  color: "#f97316", // orange accent
  basePK: {
    V1: 13.0,     // L
    V2: 51.4,     // L
    V3: 242,      // L
    CL1: 0.717,   // L/min
    CL2: 1.11,    // L/min
    CL3: 0.508,   // L/min
    ke0: 0.147,   // min⁻¹
  },
  // Fentanyl PD: respiratory depression (effect on respiratory rate)
  respiratoryPD: {
    E0: 16,        // baseline respiratory rate (breaths/min)
    Emax: 16,      // max reduction (i.e., can go to 0)
    Ce50: 1.5,     // ng/mL for 50% respiratory depression
    gamma: 2.5,
  },
  // Fentanyl has minimal direct BIS effect but potentiates propofol/midazolam
  bisInteractionFactor: 1.3, // multiplicative factor on other drug Ce50 shift
}
```

**REVERSAL AGENTS:**

**NALOXONE** (opioid reversal):
```typescript
{
  name: "Naloxone",
  unit: "mg",
  bolusOptions: [0.04, 0.08, 0.1, 0.2, 0.4], // mg (titrated doses)
  color: "#ef4444", // red accent — emergency drug
  onsetTime: 1.5,  // minutes to peak effect IV
  duration: 30,     // minutes (shorter than most opioids — risk of renarcotization)
  effect: "Competitively displaces fentanyl from mu-opioid receptors",
  // On administration: exponentially reduce fentanyl Ce with rate proportional to naloxone dose
  // Must model renarcotization: naloxone wears off, fentanyl Ce rebounds if still in peripheral compartments
}
```

**FLUMAZENIL** (benzodiazepine reversal):
```typescript
{
  name: "Flumazenil",
  unit: "mg",
  bolusOptions: [0.1, 0.2, 0.3, 0.5], // mg
  color: "#ef4444", // red accent
  onsetTime: 1.0,
  duration: 45,
  effect: "Competitively antagonizes midazolam at GABA-A receptor",
  // On administration: reduce midazolam effective Ce
  // Model resedation risk
}
```

#### 1.5 Drug Interaction Model

Implement an **additive interaction model** for combined sedation depth:

```
CombinedEffect_BIS = f(propofol_Ce/propofol_Ce50 + midazolam_Ce/midazolam_Ce50)
```

This uses the concept of "fractional occupancy" — each drug's contribution to the total effect is its Ce expressed as a fraction of its Ce50. When combined fractions exceed 1.0, you're past 50% effect.

For respiratory depression, use a **synergistic model**:
```
CombinedRespEffect = opioidEffect * (1 + hypnoticSynergyFactor * hypnoticFractionalOccupancy)
```

This captures the clinically critical reality that propofol + fentanyl respiratory depression is greater than the sum of individual effects.

#### 1.6 ODE Solver

Implement a **4th-order Runge-Kutta solver** with adaptive time stepping:

```typescript
interface SimulationState {
  time: number;              // seconds since simulation start
  drugs: {
    [drugName: string]: {
      A1: number;            // central compartment amount
      A2: number;            // rapid peripheral amount
      A3: number;            // slow peripheral amount
      Ce: number;            // effect-site concentration
      Cp: number;            // plasma concentration
      infusionRate: number;  // current infusion rate (0 if none)
    }
  };
  physiology: PhysiologyState;
}

// Solver runs at 10Hz (every 100ms) for smooth waveform generation
// Internal ODE steps at 1ms resolution for numerical stability
// Each 100ms tick: solve 100 internal steps, emit one state update
```

### Module 2: Physiological Systems Model (`/src/physiology/`)

This module takes the PK/PD engine outputs and computes realistic vital signs. All parameters are interconnected — this is a coupled system, not independent channels.

#### 2.1 Patient Model

```typescript
interface Patient {
  // Demographics
  age: number;               // years
  weight: number;            // kg
  height: number;            // cm
  sex: "male" | "female";
  bmi: number;               // computed
  asaClass: 1 | 2 | 3;
  
  // Baseline physiology (set at patient creation, with normal variation)
  baselineHR: number;        // 60-90 bpm
  baselineSBP: number;       // 110-140 mmHg
  baselineDBP: number;       // 60-85 mmHg
  baselineRR: number;        // 12-20 breaths/min
  baselineSpO2: number;      // 96-100%
  baselineEtCO2: number;     // 35-45 mmHg
  baselineBIS: number;       // 90-98
  
  // Risk factors
  mallampati: 1 | 2 | 3 | 4;
  osa: boolean;              // obstructive sleep apnea
  copd: boolean;
  hepaticImpairment: boolean;
  renalImpairment: boolean;
  
  // Sensitivity modifier (normal distribution around 1.0)
  // <1.0 = resistant, >1.0 = sensitive
  drugSensitivity: number;   // 0.6 - 1.8, mean 1.0, SD 0.25
}
```

**Pre-built patient archetypes** (selectable at scenario start):

1. **Healthy Adult** — 35yo M, 75kg, 178cm, ASA I, Mallampati I, sensitivity 1.0
2. **Elderly Patient** — 78yo F, 58kg, 160cm, ASA II, Mallampati II, sensitivity 1.4
3. **Obese with OSA** — 52yo M, 130kg, 175cm, ASA III, Mallampati III, OSA, sensitivity 1.2
4. **Anxious Young Female** — 28yo F, 62kg, 165cm, ASA I, Mallampati I, sensitivity 0.8 (resistant — high anxiety, high catecholamines)
5. **Hepatic Impairment** — 61yo M, 82kg, 172cm, ASA III, hepaticImpairment, sensitivity 1.5
6. **Pediatric/Young Adult** — 17yo M, 65kg, 170cm, ASA I, Mallampati I, sensitivity 0.9
7. **Random Patient** — randomly generated within physiological ranges

#### 2.2 Respiratory Model

```typescript
// Respiratory rate is a function of:
// 1. Baseline rate
// 2. Opioid-induced depression (from fentanyl Ce)
// 3. Hypnotic-induced depression (from propofol/midazolam Ce)
// 4. CO2 chemoreceptor drive (rising CO2 stimulates breathing)
// 5. Hypoxic ventilatory response (SpO2 < 90% stimulates breathing, but blunted by opioids)

computeRespiratoryRate(state):
  opioidDepression = sigmoidEmax(fentanylCe, respiratoryPD)
  hypnoticDepression = 0.3 * propofol_fractional_occupancy  // propofol has milder RR effect
  synergyFactor = 1 + 0.5 * opioidFraction * hypnoticFraction  // synergy multiplier
  
  totalDepression = (opioidDepression + hypnoticDepression) * synergyFactor
  
  // CO2 drive: as RR drops, CO2 rises, which partially compensates
  co2Drive = max(0, (currentEtCO2 - 40) * 0.3)
  
  RR = max(0, baselineRR - totalDepression + co2Drive)
  
  // If RR < 4: near-apnea. If RR = 0: apnea.
  return RR

// Tidal Volume also decreases with sedation (proportional to RR decrease)
// Minute ventilation = RR * TV
// Alveolar ventilation drives gas exchange
```

#### 2.3 Oxygen Cascade / SpO2 Model

```typescript
// SpO2 is NOT instantaneous — it reflects:
// 1. Alveolar oxygen tension (PAO2) based on FiO2 and ventilation
// 2. Arterial oxygen tension (PaO2) with V/Q mismatch
// 3. Oxygen-hemoglobin dissociation curve
// 4. Pulse oximeter delay (30-60 second averaging + peripheral delay)

// Simplified but physiologically grounded:

computeSpO2(state):
  minuteVentilation = RR * tidalVolume
  
  // Alveolar gas equation (simplified)
  PAO2 = FiO2 * (760 - 47) - (PaCO2 / 0.8)
  
  // V/Q mismatch factor (worse with obesity, supine position, atelectasis from sedation)
  vqMismatchFactor = 1.0 - (0.05 * (bmi > 30 ? 1 : 0)) - (0.03 * sedationDepth)
  
  PaO2 = PAO2 * vqMismatchFactor
  
  // Oxygen-hemoglobin dissociation curve (Hill equation)
  SpO2_true = 100 * PaO2^2.7 / (PaO2^2.7 + 26.6^2.7)
  
  // Pulse ox delay: use exponential smoothing with tau = 30-60 seconds
  SpO2_displayed = SpO2_displayed + (SpO2_true - SpO2_displayed) * (dt / pulseOxDelay)
  
  // FiO2 can be changed by user (room air = 0.21, nasal cannula = 0.24-0.40, bag-mask = 1.0)

// CRITICAL: Obese patients desaturate MUCH faster due to reduced FRC
// Time-to-desaturation from apnea onset:
// Normal adult on room air: ~90 seconds to SpO2 < 90%
// Obese adult on room air: ~30-45 seconds to SpO2 < 90%
// Pre-oxygenated normal adult: ~5-8 minutes
```

#### 2.4 Cardiovascular Model

```typescript
computeHemodynamics(state):
  // Heart rate: baseline modified by:
  // - Propofol: moderate reduction (vagal tone)
  // - Fentanyl: bradycardia (direct vagal effect)
  // - Hypotension triggers baroreceptor reflex → compensatory tachycardia
  // - Hypoxia → tachycardia (then bradycardia if severe/prolonged)
  
  propofolHREffect = -0.15 * propofol_fractional_occupancy * baselineHR
  fentanylHREffect = -0.10 * fentanyl_fractional_occupancy * baselineHR
  
  // Baroreceptor reflex
  mapCurrent = (SBP + 2 * DBP) / 3
  mapBaseline = (baselineSBP + 2 * baselineDBP) / 3
  baroreflexDrive = -0.5 * (mapCurrent - mapBaseline) // drop in MAP → increase HR
  
  HR = baselineHR + propofolHREffect + fentanylHREffect + baroreflexDrive
  
  // Blood pressure:
  // Propofol causes dose-dependent vasodilation and myocardial depression
  // This is the dominant hemodynamic effect in sedation
  
  propofolBPEffect = -0.25 * propofol_fractional_occupancy // up to 25% MAP reduction
  
  SBP = baselineSBP * (1 + propofolBPEffect)
  DBP = baselineDBP * (1 + propofolBPEffect * 0.7)
  
  // Severe hypoxia cascade: if SpO2 < 75% for > 30 seconds → bradycardia
  if (SpO2 < 75 && durationBelow75 > 30):
    HR = HR * 0.5 // precipitous bradycardia
  
  // Cardiac arrest: if SpO2 < 50% for > 60 seconds OR HR < 20
  if (SpO2 < 50 && durationBelow50 > 60) || HR < 20:
    triggerCardiacArrest()
```

#### 2.5 Airway Model

```typescript
// Upper airway patency is a critical nonlinear function of sedation depth
// This is where most sedation disasters originate

computeAirwayPatency(state):
  // Sedation depth: combined BIS-based metric (0 = awake, 1 = deep anesthesia)
  sedationDepth = 1 - (currentBIS / baselineBIS)
  
  // Base obstruction probability increases with sedation depth
  // Modified by patient risk factors
  baseObstructionRisk = sedationDepth^2  // nonlinear — risk accelerates at deeper levels
  
  mallampatiModifier = 1 + (mallampati - 1) * 0.15  // each class adds 15% risk
  osaModifier = patient.osa ? 1.4 : 1.0
  bmiModifier = 1 + max(0, (bmi - 25) * 0.02)  // 2% per BMI point above 25
  
  obstructionProbability = min(0.95, baseObstructionRisk * mallampatiModifier * osaModifier * bmiModifier)
  
  // Partial obstruction: reduces tidal volume by obstruction severity
  // Complete obstruction: TV → 0, triggers desaturation cascade
  
  // Obstruction is a probabilistic state transition with hysteresis:
  // Once obstruction occurs, it persists until intervention OR lightening of sedation
  
  // Interventions that relieve obstruction:
  // - Jaw thrust / chin lift → immediate partial relief
  // - Oral/nasal airway → sustained relief
  // - Bag-mask ventilation → forced ventilation bypassing obstruction
  // - Reduce/stop drug infusion → gradual lightening
```

#### 2.6 EtCO2 / Capnography Model

```typescript
computeEtCO2(state):
  // EtCO2 rises when ventilation decreases (inverse relationship)
  // Normal EtCO2: 35-45 mmHg
  
  // CO2 production is roughly constant (~200 mL/min at rest)
  co2Production = 200 // mL/min
  
  // Alveolar ventilation determines CO2 clearance
  alveolarVentilation = minuteVentilation * (1 - deadSpaceFraction)
  
  // Steady-state PaCO2 ≈ CO2 production / alveolar ventilation * constant
  targetPaCO2 = co2Production / max(alveolarVentilation, 0.1) * 0.863
  
  // EtCO2 equilibrates toward target with time constant ~30 seconds
  EtCO2 = EtCO2 + (targetPaCO2 - EtCO2) * (dt / 30)
  
  // Apnea: EtCO2 rises ~3-5 mmHg per minute
  // Complete airway obstruction: EtCO2 waveform goes FLAT (no gas flow) — critical diagnostic sign
  
  // Capnography waveform shape:
  // Normal: square wave with slight upslope on plateau
  // Partial obstruction: "shark fin" morphology (sloped upstroke)
  // Complete obstruction: flatline
  // Rebreathing: elevated baseline
```

#### 2.7 BIS / Sedation Depth

```typescript
computeBIS(state):
  // BIS is derived from the combined PD effects of all hypnotic drugs
  // Range: 0 (isoelectric EEG) to 100 (fully awake)
  // Clinical targets:
  //   90-100: Awake
  //   70-90: Light sedation (minimal/moderate sedation)
  //   60-70: Deep sedation
  //   40-60: General anesthesia
  //   <40: Deep anesthesia / burst suppression
  
  combinedFractionalOccupancy = (propofol_Ce / propofol_Ce50) + (midazolam_Ce / midazolam_Ce50)
  
  // Apply patient sensitivity modifier
  effectiveFraction = combinedFractionalOccupancy * patient.drugSensitivity
  
  // Sigmoid response
  BIS = E0 - Emax * effectiveFraction^gamma / (1 + effectiveFraction^gamma)
  
  // Add realistic noise (BIS is notoriously noisy)
  BIS += gaussianNoise(0, 2)
  
  // Clamp
  BIS = clamp(BIS, 0, 98)
```

### Module 3: Monitor Display (`/src/monitor/`)

This is the primary visual interface. It should look and feel like a real patient monitor.

#### 3.1 Layout

The monitor occupies the **top 60%** of the screen. Layout:

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────┐  ┌────────────────────┐  │
│  │                                   │  │  HR        ♥  78   │  │
│  │   ECG Waveform Trace              │  │  ──────────────── │  │
│  │   (green, scrolling L→R)          │  │  SpO2       98%   │  │
│  │                                   │  │  ──────────────── │  │
│  ├───────────────────────────────────┤  │  BP    120/75     │  │
│  │                                   │  │  (MAP 90)          │  │
│  │   SpO2 Plethysmograph             │  │  ──────────────── │  │
│  │   (green, pulsatile waveform)     │  │  RR         14    │  │
│  │                                   │  │  ──────────────── │  │
│  ├───────────────────────────────────┤  │  EtCO2      38    │  │
│  │                                   │  │  ──────────────── │  │
│  │   Capnography Waveform            │  │  BIS        94    │  │
│  │   (yellow, respiratory cycle)     │  │                    │  │
│  │                                   │  │  FiO2      0.21   │  │
│  └───────────────────────────────────┘  └────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  TIME: 00:04:32    STATUS: ● Moderate Sedation    ALARMS  ▶││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2 Waveform Generation

Each waveform is generated procedurally from the physiological state:

**ECG**: Generate a simplified PQRST complex. P-wave, QRS complex, T-wave. Cycle length = 60/HR seconds. Vary slightly (±2%) for realism. During bradycardia, widen the gap. During cardiac arrest, show flatline or VFib pattern.

**SpO2 Pleth**: Sinusoidal-ish pulse waveform with dicrotic notch. Amplitude correlates with pulse pressure. Rate matches HR. During poor perfusion (hypotension), amplitude decreases. Lost signal during arrest.

**Capnography**: Square waveform synced to respiratory rate.
- Phase I: baseline (inspiratory, near-zero CO2)
- Phase II: sharp upstroke (dead space gas transitioning to alveolar gas)
- Phase III: alveolar plateau, slight upslope, peak = EtCO2 value
- Phase IV: sharp downstroke (inspiration begins)
- During partial obstruction: Phase II becomes sloped ("shark fin")
- During complete obstruction: waveform disappears (FLATLINE — this is the earliest warning sign)
- During apnea: last waveform fades, then flatline

**Waveform rendering**: Use `<canvas>` elements with a scrolling time-based display. Sweep speed ~25mm/sec equivalent. 3-second visible window. Render at 60fps but data updates at 10Hz from the engine.

#### 3.3 Alarm System

```typescript
interface AlarmThreshold {
  parameter: string;
  warningLow?: number;
  warningHigh?: number;
  criticalLow?: number;
  criticalHigh?: number;
}

const defaultAlarms: AlarmThreshold[] = [
  { parameter: "SpO2", warningLow: 94, criticalLow: 90 },
  { parameter: "HR", warningLow: 50, warningHigh: 120, criticalLow: 40, criticalHigh: 150 },
  { parameter: "RR", warningLow: 8, criticalLow: 4 },
  { parameter: "EtCO2", warningHigh: 50, criticalHigh: 60, criticalLow: 10 },
  { parameter: "SBP", warningLow: 90, criticalLow: 70 },
  { parameter: "BIS", warningLow: 40 },
];

// Warning: amber numeric display, single tone
// Critical: red flashing numeric display, continuous alarm tone
// Alarms can be silenced for 60 seconds (like real monitors)
```

Include audio: Use Web Audio API. Warning = two-tone beep. Critical = continuous fast beep. SpO2 audible tone that changes pitch with saturation (high pitch at 99%, drops as SpO2 drops — this is one of the most important clinical cues and almost no simulator implements it).

### Module 4: Drug Administration & Control Panel (`/src/controls/`)

Occupies the **bottom 40%** of the screen.

#### 4.1 Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  PATIENT: Healthy Adult 35M 75kg    ┃  ⏱ Simulation Speed: 1x │
│  ASA I | Mallampati I | No OSA      ┃  [▶ Play] [⏸ Pause] [⟲] │
├─────────────────────┬───────────────┴───────────────────────────┤
│                     │                                           │
│  MEDICATIONS        │  INTERVENTIONS                            │
│                     │                                           │
│  ┌─PROPOFOL───────┐ │  O₂ Management:                          │
│  │ [10] [20] [30] │ │  [Room Air] [NC 2L] [NC 4L] [NC 6L]     │
│  │ [40] [50] mg   │ │  [Face Mask] [NRB] [Bag-Mask 100%]      │
│  │                │ │                                           │
│  │ Infusion:      │ │  Airway:                                  │
│  │ [Start ▾] µg/  │ │  [Jaw Thrust] [Chin Lift] [Oral Airway]  │
│  │         kg/min │ │  [Nasal Airway] [Suction]                 │
│  └────────────────┘ │                                           │
│  ┌─MIDAZOLAM──────┐ │  Stimulation:                             │
│  │ [0.5] [1.0]    │ │  [Verbal] [Tactile] [Painful]            │
│  │ [1.5] [2.0] mg │ │  [Procedure Start] [Procedure Stop]      │
│  └────────────────┘ │                                           │
│  ┌─FENTANYL───────┐ │  Emergency:                               │
│  │ [25] [50] [75] │ │  [CALL FOR HELP 📞]                      │
│  │ [100] µg       │ │  [Naloxone ▾] [Flumazenil ▾]             │
│  └────────────────┘ │                                           │
│                     │                                           │
├─────────────────────┴───────────────────────────────────────────┤
│  DRUG CONCENTRATION TIMELINE (sparkline graphs)                 │
│  Propofol Ce: ──────────╱╲──────── 1.2 µg/mL                  │
│  Midazolam Ce: ─────────────────── 0.0 ng/mL                  │
│  Fentanyl Ce: ──────╱╲──────────── 0.8 ng/mL                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.2 Drug Administration Mechanics

- **Bolus**: Click a dose button → drug is injected as a rapid infusion over 15 seconds (not instantaneous — models clinical practice)
- **Infusion**: Select rate from dropdown → starts continuous infusion. Can adjust rate or stop.
- **Each administration is timestamped and logged**
- **Cumulative dose displayed** for each drug
- **Time since last dose displayed**
- Button debounce: 3-second cooldown between boluses of the same drug (prevents accidental double-dosing)

#### 4.3 Intervention Mechanics

**O₂ Management**: Changes FiO2 in the respiratory model
- Room air: FiO2 = 0.21
- Nasal cannula 2L: FiO2 = 0.28
- Nasal cannula 4L: FiO2 = 0.36
- Nasal cannula 6L: FiO2 = 0.44
- Simple face mask: FiO2 = 0.50
- Non-rebreather: FiO2 = 0.80
- Bag-mask 100%: FiO2 = 1.0 + forced ventilation (overrides respiratory rate to 12/min equivalent)

**Airway interventions**: Modify the airway patency model
- Jaw thrust: immediate partial relief (reduces obstruction severity by 60%)
- Chin lift: partial relief (40%)
- Oral airway: sustained relief (80%) — only effective at BIS < 70 (patient won't tolerate if too awake)
- Nasal airway: sustained relief (70%) — tolerated at lighter sedation
- Suction: clears secretions (minor effect unless aspiration scenario)

**Stimulation**: Modifies effective sedation depth
- Verbal: -5 BIS points (arousal) for 15 seconds
- Tactile: -10 BIS points for 10 seconds
- Painful (procedural stimulus): -15 BIS points sustained while active
- Procedure Start/Stop: toggles ongoing painful stimulus

#### 4.4 Simulation Controls

- **Speed**: 1x (real-time), 2x, 4x, 8x — for fast-forwarding through stable periods
- **Pause**: Freezes simulation state for discussion/analysis
- **Reset**: Returns to scenario start
- **Timer**: Elapsed simulation time displayed prominently

### Module 5: Scoring & Assessment (`/src/scoring/`)

#### 5.1 Event Logger

```typescript
interface SimulationEvent {
  timestamp: number;           // simulation time in seconds
  type: "drug_admin" | "intervention" | "alarm_triggered" | "alarm_acknowledged" | 
        "vital_sign_change" | "complication_onset" | "patient_response";
  details: Record<string, any>;
  physiologySnapshot: PhysiologyState;  // full state at event time
}

// Log EVERYTHING. This is the basis for scoring and debrief.
```

#### 5.2 Scoring Rubric

After scenario completion, display a structured performance report:

**Safety Metrics**:
- Time SpO2 < 94%: ___ seconds (target: 0)
- Time SpO2 < 90%: ___ seconds (target: 0)
- Lowest SpO2 recorded: ___%
- Time to recognize desaturation (alarm → first intervention): ___ seconds
- Apnea episodes: count and duration
- Hypotension episodes (MAP < 60): count and duration

**Sedation Quality Metrics**:
- Time in target sedation range (BIS 65-85 for moderate sedation): ___%
- Oversedation episodes (BIS < 60): count and duration
- Undersedation episodes (BIS > 85 during procedure): count and duration
- Total drug doses administered vs. expected range for patient type

**Decision Quality**:
- Pre-oxygenation performed before first sedative? (Y/N, +10 points)
- Appropriate starting dose for patient risk? (+/- 10 points)
- Titration-to-effect approach used? (multiple small doses vs. single large dose)
- Time to intervention when complications arose
- Appropriate use of reversal agents (if needed)
- "Call for help" initiated when appropriate (BIS < 40, or SpO2 < 85%, or apnea > 60s)
- Use of supplemental oxygen before sedation

**Overall Grade**: A (>90) / B (75-90) / C (60-75) / F (<60)

#### 5.3 Debrief Timeline

Display a timeline visualization showing:
- Drug administrations as vertical markers with dose labels
- Vital sign trends (SpO2, HR, BP, BIS) as overlaid line graphs
- Complication zones highlighted in red/orange
- Intervention markers
- Clickable: click any point to see full state at that moment

---

## USER INTERFACE FLOW

### Screen 1: Scenario Selection
- Title: "SedSim — Procedural Sedation Simulator"
- Select patient archetype (cards with patient photo silhouette, demographics, risk factors)
- Select procedure context: "GI Endoscopy", "Dental/OMS", "ER Laceration Repair", "Interventional Radiology", "Custom"
- Procedure context sets expected duration and stimulus intensity
- [Start Simulation] button

### Screen 2: Simulation (Main Interface)
- Monitor (top 60%) + Controls (bottom 40%) as described above
- Real-time, interactive
- Simulation runs until user clicks [End Simulation] or cardiac arrest occurs

### Screen 3: Debrief & Scoring
- Performance scorecard
- Interactive timeline
- Key moments highlighted with educational annotations
- [Replay] [New Scenario] [Export Report as PDF] buttons

---

## IMPLEMENTATION PRIORITIES

Build in this order — each phase should be a deployable, testable milestone:

### Sprint 1: PK/PD Engine + Minimal Display
- ODE solver with propofol only
- Single numeric display of Cp, Ce, and computed BIS
- Bolus input via button
- Verify: BIS should drop ~15 seconds after 1mg/kg propofol bolus, nadir around 60 seconds, gradually recover

### Sprint 2: Full Drug Library + Physiology
- Add midazolam, fentanyl, naloxone, flumazenil
- Implement respiratory model, SpO2 model, cardiovascular model
- All vitals displayed as numbers (no waveforms yet)
- Drug interaction model

### Sprint 3: Monitor Waveforms
- Canvas-based ECG, SpO2 pleth, capnography waveforms
- Alarm system with audio
- SpO2 audible pitch change
- Full monitor layout

### Sprint 4: Airway Model + Interventions
- Airway obstruction mechanics
- O2 management, jaw thrust, airways
- Stimulation model
- Full control panel

### Sprint 5: Scenarios + Scoring
- Patient archetypes
- Scoring engine
- Debrief timeline visualization
- Scenario selection screen

### Sprint 6: Polish
- Responsive design (works on tablet landscape minimum)
- Performance optimization (ensure 60fps waveform rendering)
- Tutorial / onboarding walkthrough
- Sound design refinement
- Export/share functionality

---

## TESTING VALIDATION CRITERIA

The simulator must reproduce these clinically established benchmarks:

1. **Propofol 2mg/kg bolus in healthy adult**: BIS should drop to ~40-50 within 90 seconds, recover to >80 by ~8-10 minutes. SpO2 should dip if no supplemental O2, especially with concurrent fentanyl.

2. **Fentanyl 1.5µg/kg + Propofol 1mg/kg**: More respiratory depression than either alone. RR should drop below 8. SpO2 decline should be more rapid than propofol alone.

3. **Obese patient with OSA**: Should desaturate significantly faster during any apneic episode. Airway obstruction should occur at lighter sedation depths.

4. **Elderly patient**: Should require ~40-50% less propofol for equivalent BIS. Hypotension should be more pronounced.

5. **Naloxone reversal**: After fentanyl-induced respiratory depression, 0.04-0.08mg naloxone should partially reverse respiratory depression within 1-2 minutes. Renarcotization should occur 30-45 minutes later if significant fentanyl remains in peripheral compartments.

---

## FILE STRUCTURE

```
sedsim/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── engine/
│   │   ├── ODESolver.ts           # RK4 solver
│   │   ├── PKModel.ts            # three-compartment PK
│   │   ├── PDModel.ts            # sigmoid Emax PD
│   │   ├── DrugLibrary.ts        # propofol, midazolam, fentanyl, reversals
│   │   ├── DrugInteractions.ts   # additive/synergistic models
│   │   └── SimulationEngine.ts   # orchestrator: runs solver, emits state
│   ├── physiology/
│   │   ├── PatientModel.ts       # patient demographics & baseline physiology
│   │   ├── RespiratoryModel.ts   # RR, tidal volume, minute ventilation
│   │   ├── OxygenModel.ts        # SpO2 cascade with delay
│   │   ├── CardiovascularModel.ts# HR, BP, baroreceptor reflex
│   │   ├── AirwayModel.ts        # obstruction probability & mechanics
│   │   ├── CapnographyModel.ts   # EtCO2 computation & waveform shape
│   │   └── BISModel.ts           # combined sedation depth
│   ├── monitor/
│   │   ├── MonitorPanel.tsx       # main monitor layout
│   │   ├── WaveformCanvas.tsx     # reusable canvas waveform renderer
│   │   ├── ECGWaveform.tsx        # ECG-specific generator
│   │   ├── PlethWaveform.tsx      # SpO2 pleth generator
│   │   ├── CapnoWaveform.tsx      # capnography waveform generator
│   │   ├── NumericDisplay.tsx     # vital sign numeric display with alarms
│   │   ├── AlarmSystem.ts        # threshold management & audio
│   │   └── StatusBar.tsx         # time, sedation level, alarm controls
│   ├── controls/
│   │   ├── ControlPanel.tsx       # main control layout
│   │   ├── DrugPanel.tsx          # medication buttons + infusion controls
│   │   ├── InterventionPanel.tsx  # O2, airway, stimulation
│   │   ├── SimControls.tsx        # play/pause/speed/reset
│   │   └── ConcentrationTimeline.tsx  # sparkline drug concentration graphs
│   ├── scoring/
│   │   ├── EventLogger.ts        # records all events + state snapshots
│   │   ├── ScoringEngine.ts      # computes performance metrics
│   │   ├── DebriefTimeline.tsx    # interactive timeline visualization
│   │   └── ScoreCard.tsx         # performance report display
│   ├── scenarios/
│   │   ├── PatientArchetypes.ts  # pre-built patient configurations
│   │   ├── ProcedureContexts.ts  # procedure types & stimulus profiles
│   │   └── ScenarioSelector.tsx  # scenario selection screen
│   ├── store/
│   │   └── simulationStore.ts    # Zustand store for shared state
│   ├── utils/
│   │   ├── math.ts               # clamp, gaussianNoise, interpolation
│   │   └── audio.ts              # Web Audio API helpers
│   └── types/
│       └── index.ts              # shared TypeScript interfaces
├── public/
│   └── fonts/                    # JetBrains Mono, IBM Plex Sans
└── README.md
```

---

## NOTES FOR THE AGENT

- This is a MEDICAL SIMULATION. Physiological accuracy matters. When in doubt, err toward clinical realism over simplification.
- All drug parameters come from published peer-reviewed PK/PD models. Do not invent parameters.
- The ODE solver MUST be numerically stable. Use RK4 with internal timestep ≤ 1ms. If you see oscillations or negative concentrations, reduce the timestep.
- Waveforms should scroll smoothly at 60fps. Use `requestAnimationFrame` for the canvas rendering loop, separate from the 10Hz simulation tick.
- The SpO2 audible pitch change (high pitch = good, dropping pitch = bad) is one of the most important features. Implement this using Web Audio API oscillator with frequency mapped to SpO2 value.
- Mobile/tablet support is secondary but the layout should not break on iPad landscape.
- No backend, no authentication, no database for Phase 1. Everything runs in the browser.
- Use Zustand (not Redux) for state management — lighter weight, less boilerplate.
- Prefer `canvas` over SVG for waveforms due to performance with real-time rendering.
