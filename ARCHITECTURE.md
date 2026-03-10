# SedSim Architecture & Engineering Specification

> **Purpose**: This document is the single source of truth for SedSim's architecture, conventions, and implementation roadmap. Feed this file to any AI coding agent (Copilot, Cursor, Claude) as context.

## 1. Project Overview

SedSim is a browser-based, real-time pharmacokinetic/pharmacodynamic (PK/PD) sedation simulator for medical education. Built with **TypeScript + React + Vite + Tailwind CSS**, it runs entirely client-side with optional Claude AI integration for the Millie the Mentor teaching companion.

### Tech Stack
- **Runtime**: Browser (no server required for core sim)
- **Framework**: React 18+ with functional components & hooks
- **Build**: Vite + TypeScript (strict mode)
- **Styling**: Tailwind CSS + custom CSS for waveforms
- **State**: Zustand store (`src/store/`)
- **AI**: Claude API via SSE streaming (`src/ai/claudeClient.ts`)
- **Audio**: Web Audio API (`src/engine/conductor/`)
- **Deploy**: GitHub Pages via Actions

## 2. Folder Structure

```
sedsim/
+-- ARCHITECTURE.md          # THIS FILE - agent context
+-- index.html
+-- package.json
+-- vite.config.ts
+-- tsconfig.json
+-- tailwind.config.js
+-- .env.example             # VITE_ANTHROPIC_API_KEY=
+-- .github/workflows/       # CI/CD
+-- docs/                    # Documentation assets
+-- worker/                  # Web Worker for PK/PD offloading
|
+-- src/
    +-- main.tsx             # Entry point
    +-- App.tsx              # Root router + layout
    +-- LandingPage.tsx      # Marketing/entry page
    +-- types.ts             # Shared type definitions
    +-- index.css            # Global styles
    |
    +-- engine/              # Core simulation logic (NO React imports)
    |   +-- pkModel.ts       # 3-compartment Marsh/Schnider PK
    |   +-- pdModel.ts       # Bouillon response surface PD
    |   +-- physiology.ts    # Vitals computation from drug effects
    |   +-- drugs.ts         # Drug parameter library
    |   +-- predict.ts       # Forward simulation (ghost dose)
    |   +-- cardiacRhythm.ts # ECG arrhythmia state machine
    |   +-- ecgWaveformEngine.ts  # ECG waveform generation
    |   +-- eegModel.ts      # BIS/EEG synthetic model
    |   +-- digitalTwin.ts   # Patient digital twin
    |   +-- scenarios.ts     # Scenario definitions
    |   +-- blsModule.ts     # BLS HeartCode education
    |   +-- educationModules.ts   # Education system
    |   +-- interactiveScenarios.ts
    |   +-- avatarMappings.ts     # Vitals -> avatar state
    |   +-- VitalCoherenceMonitor.ts  # Cross-vital validation
    |   +-- ScenarioEngine.ts     # Scenario state machine
    |   +-- ScenarioLoader.ts     # JSON scenario loading
    |   +-- SedSimCase.types.ts   # Case type definitions
    |   +-- SedSimCoreEngine.types.ts
    |   +-- conductor/       # Audio + orchestration layer
    |   +-- scenarios/       # JSON scenario data files
    |
    +-- ai/                  # AI integration layer
    |   +-- claudeClient.ts  # Claude API SSE client
    |   +-- mentor.ts        # Millie the Mentor orchestrator
    |   +-- milliePrompt.ts  # Millie system prompt
    |   +-- simMaster.ts     # SimMaster teaching companion
    |   +-- simMasterPrompt.ts
    |   +-- multiAgent.ts    # Multi-agent coordinator
    |   +-- digitalTwin.ts   # AI-powered digital twin
    |   +-- eegModel.ts      # AI EEG interpretation
    |   +-- scenarioGenerator.ts  # AI scenario generation
    |   +-- tutorialEngine.ts     # AI tutorial system
    |
    +-- components/          # React UI components
    |   +-- Dashboard.tsx    # Main sim layout
    |   +-- MonitorPanel.tsx  # Vital signs monitor
    |   +-- DrugPanel.tsx    # Drug admin controls
    |   +-- ControlBar.tsx   # Play/pause/speed
    |   +-- TrendGraph.tsx   # Concentration trends
    |   +-- EventLog.tsx     # Event timeline
    |   +-- EEGPanel.tsx     # EEG display
    |   +-- EchoSim.tsx      # Echo/PV loop
    |   +-- FrankStarlingCurve.tsx
    |   +-- OxyHbCurve.tsx   # O2-Hb dissociation
    |   +-- PhysiologyAvatar.tsx  # Patient avatar
    |   +-- PatientBanner.tsx     # Patient info header
    |   +-- PatientSelector.tsx   # Patient config
    |   +-- SedationGauge.tsx     # MOASS/sedation depth
    |   +-- GhostDosePreview.tsx  # Predictive dosing
    |   +-- InterventionPanel.tsx # Airway/emergency
    |   +-- EmergencyDrugsPanel.tsx
    |   +-- AEDPanel.tsx     # AED simulation
    |   +-- IVFluidsPanel.tsx
    |   +-- LocalAnesthPanel.tsx
    |   +-- VitalsPanel.tsx
    |   +-- VitalAnnotations.tsx
    |   +-- PrecordialStethoscope.tsx  # Audio auscultation
    |   +-- MentorChat.tsx   # Millie chat interface
    |   +-- MillieChat.tsx   # Millie chat bubble
    |   +-- MillieAvatar.tsx # Millie visual
    |   +-- SimMasterOverlay.tsx
    |   +-- ScenarioPanel.tsx
    |   +-- ScenarioCallout.tsx
    |   +-- ScenarioStepper.tsx
    |   +-- ScenarioTimeline.tsx
    |   +-- LearningPanel.tsx
    |   +-- TutorialMode.tsx
    |   +-- TutorialOverlay.tsx
    |
    +-- hooks/               # Custom React hooks
    +-- store/               # Zustand state management
    +-- utils/               # Pure utility functions
```

## 3. Core Engine Architecture

### 3.1 Simulation Tick Loop
The simulation runs at configurable speed (1x, 2x, 4x) with a tick every ~250ms real-time:

```
tick() -> pkModel.step() -> pdModel.effect() -> physiology.compute() -> vitals + MOASS + waveforms
```

**Key invariants:**
- Engine files (`src/engine/`) NEVER import React
- All engine functions are pure: `(state, params, dt) => newState`
- Side effects (audio, UI) happen in hooks/components reacting to store changes

### 3.2 PK Model (3-Compartment)
- Runge-Kutta 4th order integration
- Supports simultaneous multi-drug tracking
- Each drug has independent PKState {c1, c2, c3, ce}
- Effect-site equilibration via ke0

### 3.3 PD Model (Response Surface)
- Bouillon response surface for drug interactions
- Hill equation for single-drug effect
- Multi-drug interaction via response surface methodology
- Outputs fractional effect [0,1] driving MOASS and vitals

### 3.4 Physiology Pipeline
- Maps drug effects to vital signs
- Inputs: drug effects, patient baseline, active interventions
- Outputs: HR, BP, RR, SpO2, EtCO2, rhythm
- Includes airway patency model and O2/CO2 dynamics

### 3.5 Cardiac Rhythm State Machine
- 18 rhythm types with transition rules
- Driven by drug effects, electrolyte state, interventions
- Feeds into ecgWaveformEngine for visual rendering

## 4. AI Integration (Millie the Mentor)

### 4.1 Architecture
- `claudeClient.ts`: SSE streaming to Claude API
- `mentor.ts`: Orchestrates when/what Millie says
- `simMaster.ts`: Higher-level teaching strategy
- `multiAgent.ts`: Coordinates mentor + simMaster + digital twin

### 4.2 Millie's Behavior
- Observes simulation state every tick
- Speaks when: critical events, learner errors, teachable moments
- Tone: encouraging, Socratic, never condescending
- Context window: last 60s of sim state + current vitals + event log

## 5. State Management (Zustand)

Single store as source of truth for all reactive state:
- Patient demographics & config
- Active drugs, PK states, infusion rates
- Current vitals, MOASS level
- Event log, scenario state
- UI state (panel visibility, selected views)
- AI state (mentor messages, tutorial progress)

## 6. Implementation Phases

### Phase 1: Core Stabilization
1. Audit & fix all TS strict errors
2. Engine unit tests (pkModel, pdModel, physiology)
3. Store refactor into typed slices
4. Scenario JSON schema validation (Zod)
5. VitalCoherenceMonitor hardening
6. Conductor audio reliability
7. Ghost dose prediction accuracy
8. CI pipeline (lint + typecheck + test)

### Phase 2: Feature Completion
1. Full BLS/ACLS scenario library (12+ scenarios)
2. Millie proactive teaching triggers
3. Digital Twin risk scoring
4. EchoSim PV loop accuracy
5. Grading/scoring engine
6. Session recording & playback
7. Accessibility audit (WCAG 2.1 AA)
8. Performance profiling (60fps target)

### Phase 3: Polish & Scale
1. Multi-language support (i18n)
2. LMS integration (SCORM/xAPI)
3. Offline mode (ServiceWorker)
4. Mobile responsive layout
5. Instructor dashboard
6. Publication-ready validation

## 7. Coding Conventions

### For AI Agents
- **Always read this file first** before making changes
- **Never modify `src/engine/`** files to import React
- **All new engine functions** must be pure and testable
- **Use existing types** from `src/types.ts` - extend, don't duplicate
- **Tailwind only** for styling - no inline styles or CSS modules
- **Zustand store** for all shared state - no prop drilling beyond 2 levels
- **Error boundaries** around every major panel component

### Naming
- Files: `camelCase.ts` for engine, `PascalCase.tsx` for components
- Types/Interfaces: `PascalCase`
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Hooks: `use` prefix

### Git
- Branch: `feat/description`, `fix/description`, `refactor/description`
- Commit: `type: description` (feat, fix, refactor, docs, test, ci)
- PRs reference issue numbers

## 8. Environment Setup

```bash
git clone https://github.com/Gengyveusa/sedsim.git
cd sedsim
npm install
cp .env.example .env  # Add VITE_ANTHROPIC_API_KEY if using AI features
npm run dev           # http://localhost:5173
npm run build         # Production build
```

## 9. Agent Quick Reference

| Task | Where to look |
|------|---------------|
| Add a new drug | `src/engine/drugs.ts` + `src/types.ts` |
| New vital sign logic | `src/engine/physiology.ts` |
| New UI panel | `src/components/` + wire in `Dashboard.tsx` |
| New scenario | `src/engine/scenarios/` (JSON) + `ScenarioLoader.ts` |
| Millie behavior | `src/ai/mentor.ts` + `src/ai/milliePrompt.ts` |
| Store changes | `src/store/` |
| New test | `__tests__/` (create if needed) |
| CI changes | `.github/workflows/` |
