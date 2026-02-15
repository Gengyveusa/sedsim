# SedSim

**Real-Time Pharmacokinetic Sedation Simulator** - Browser-based PK/PD simulation for medical education

## Overview

SedSim is a comprehensive, medical-grade browser-based simulator for procedural sedation training. It implements validated pharmacokinetic/pharmacodynamic models to simulate the real-time physiological effects of sedative medications on virtual patients.

## Features

### 🧬 Pharmacokinetic Engine
- **3-compartment PK models** with effect-site equilibration (ke0)
- **Validated drug models:**
  - Propofol (Marsh model, Eleveld parameters)
  - Midazolam (Maitre model)
  - Fentanyl (Scott model)
  - Ketamine (simplified 3-compartment)
- Real-time drug concentration calculation (central, peripheral, effect-site)
- Bolus and continuous infusion support

### 🫀 Physiological Simulation
- **Comprehensive respiratory model:**
  - Respiratory depression from hypnotics and opioids
  - Drug synergy effects
  - Minute ventilation cascade
  - SpO2 calculation via Hill equation
  - Oxygen-hemoglobin dissociation curve
  - V/Q mismatch modeling
- **Cardiovascular physiology:**
  - Baroreceptor reflex simulation
  - HR/BP responses to drug effects and hypoxia
  - Vasodilation and myocardial depression from propofol
  - Vagal bradycardia from fentanyl
- **EtCO2 modeling** based on ventilation status

### 👥 Patient Simulation
- **7 patient archetypes:**
  - Healthy Adult (35y, 75kg, ASA 1)
  - Elderly (78y, 58kg, ASA 2)
  - Obese with OSA (52y, 130kg, ASA 3)
  - Anxious Young Adult (28y, 62kg, ASA 1)
  - Hepatic Impairment (61y, 82kg, ASA 3)
  - Pediatric (17y, 65kg, ASA 1)
  - Random generation
- **Patient-specific factors:**
  - Drug sensitivity modifiers (0.6x - 1.8x)
  - Comorbidities (OSA, COPD, hepatic/renal impairment)
  - Mallampati score
  - ASA classification

### 🩺 Medical-Grade UI
- **Monitor Panel** with real-time waveforms:
  - ECG (3-lead morphology simulation)
  - SpO2 plethysmography
  - Capnography (EtCO2)
  - Numeric vital signs display
- **Dark medical theme** inspired by Philips/GE monitors
- **Color-coded waveforms:**
  - ECG: Green (#08cc66)
  - SpO2: Cyan (#00ff88)
  - Capno: Yellow (#ffcc00)

### 🚨 Safety Features
- **Real-time alarm system:**
  - SpO2 < 90% (warning), < 85% (critical)
  - HR < 50 or > 120 bpm
  - SBP < 90 mmHg
  - RR < 8 (warning), = 0 (apnea alarm)
  - EtCO2 > 55 mmHg
- Configurable alarm thresholds
- Visual alarm indicators with severity levels

### 💊 Interventions
- **Airway management:**
  - Jaw thrust / Chin lift
  - Oral/nasal airways
  - Bag-mask ventilation
  - Suction
- **Oxygenation:**
  - FiO2 control (21% - 100%)
  - Real-time SpO2 response

### 📊 Trend Tracking
- 10-minute rolling history (600 data points at 1 Hz)
- Real-time trend graphs for all vitals
- Drug concentration tracking
- MOASS (Modified Observer Assessment of Sedation) level

### 📝 Event Logging
- Timestamped event log with severity indicators
- Drug administration tracking (boluses, infusions)
- Alarm events
- Intervention tracking
- Patient changes

## Technical Stack

- **Framework:** React 18 + TypeScript
- **State Management:** Zustand
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Build:** Vite
- **Deployment:** StackBlitz / Vercel / Netlify ready

## Architecture

```
src/
├── engine/           # Core simulation engine
│   ├── pkModel.ts   # 3-compartment PK with Euler integration
│   ├── pdModel.ts   # Sigmoid Emax PD model
│   ├── physiology.ts # Comprehensive physiology simulation
│   └── drugs.ts     # Drug parameter database
├── store/           # Zustand state management
│   └── useSimStore.ts # Main simulation store
├── components/      # React UI components
│   ├── MonitorPanel.tsx     # Canvas-based waveforms
│   ├── PatientSelector.tsx  # Patient archetype selection
│   ├── DrugPanel.tsx        # Drug administration controls
│   ├── InterventionPanel.tsx # Airway/oxygen management
│   ├── TrendGraph.tsx       # Vital signs trends
│   ├── EventLog.tsx         # Event history
│   ├── ControlBar.tsx       # Simulation controls
│   └── PatientBanner.tsx    # Patient info display
└── types.ts         # TypeScript interfaces
```

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Live Demo

[View on StackBlitz](https://stackblitz.com/github/Gengyveusa/sedsim)

## Usage

1. **Select a patient** from the archetype dropdown
2. **Administer drugs** via bolus or infusion
3. **Monitor vitals** on the real-time monitor display
4. **Apply interventions** if needed (airway management, O2)
5. **Review trends** and event log
6. **Adjust simulation speed** (1x, 2x, 5x)

## Clinical Validity

- PK models based on published literature (Marsh, Eleveld, Scott, Maitre)
- Respiratory physiology validated against clinical observations
- SpO2 calculation uses standard Hill equation parameters
- Drug interactions model synergistic respiratory depression
- Patient variability based on clinical population studies

## Educational Use

Ideal for:
- Procedural sedation training
- Emergency medicine education
- Anesthesia residents
- Nurse anesthetists
- Simulation center scenarios
- Self-directed learning

## Limitations

- Simplified models vs. full anesthesia workstations
- Does not replace hands-on training
- Not for clinical decision-making
- Limited to conscious/moderate sedation scenarios

## Future Enhancements

- Additional drugs (dexmedetomidine, etomidate)
- Advanced airway scenarios (laryngospasm, bronchospasm)
- Scenario-based training modules
- Performance metrics and scoring
- Multi-user simulation sessions
- Audio alarms
- Export/import scenarios

## License

MIT License - See LICENSE file

## Author

Developed by [Gengyveusa](https://github.com/Gengyveusa)

## Acknowledgments

- PK/PD models from published anesthesia literature
- UI inspired by Philips IntelliVue and GE Carescape monitors
- Clinical validation input from anesthesiologists

---

**⚠️ Disclaimer:** This simulator is for educational purposes only. It should not be used for clinical decision-making or patient care. Always follow institutional protocols and clinical guidelines for actual patient sedation.
