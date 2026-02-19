/**
 * Cardiac Rhythm Determination Engine
 *
 * Evaluates the patient's physiological state and returns the appropriate
 * CardiacRhythm type based on hypoxia, drug effects, and hemodynamics.
 */

import { CardiacRhythm, PKState, Patient, Vitals } from '../types';

interface RhythmResult {
  rhythm: CardiacRhythm;
  qrsWidth: number;   // ms
  prInterval: number; // ms
  qtInterval: number; // ms
}

/**
 * Determine the cardiac rhythm from the current physiological state.
 * Arrest tracking state is passed in/out to avoid module-level mutable state.
 *
 * @param vitals              Current computed vitals (before rhythm is set)
 * @param pkStates            Drug PK/effect-site concentrations
 * @param patient             Patient demographics
 * @param prevRhythm          Previous rhythm (for progression logic)
 * @param elapsedSeconds      Simulation elapsed time
 * @param arrestStartSeconds  Simulation time when arrest conditions first appeared (or null)
 */
export function determineRhythm(
  vitals: Vitals,
  pkStates: Record<string, PKState>,
  patient: Patient,
  prevRhythm: CardiacRhythm = 'normal_sinus',
  elapsedSeconds: number = 0,
  arrestStartSeconds: number | null = null
): RhythmResult & { arrestStartSeconds: number | null } {
  const { hr, spo2, map } = vitals;

  const propofolCe = pkStates.propofol?.ce ?? 0;
  const fentanylCe  = pkStates.fentanyl?.ce  ?? 0;
  const ketamineCe  = pkStates.ketamine?.ce  ?? 0;

  // Local anesthetic Ce (sum of relevant drugs, in mcg/mL equivalents)
  const bupivacaineCe = pkStates.bupivacaine?.ce   ?? 0;
  const lidocaineCe   = pkStates.lidocaine_epi?.ce ?? 0;
  const articaineCe   = pkStates.articaine_epi?.ce ?? 0;
  const localAnesthCe = bupivacaineCe + lidocaineCe + articaineCe;

  const sensitivity = patient.drugSensitivity ?? 1.0;

  // -----------------------------------------------------------------------
  // 1.  CARDIAC ARREST DETECTION & PROGRESSION
  // -----------------------------------------------------------------------
  const arrestCondition =
    (spo2 < 40 && spo2 > 0) || // severe sustained hypoxia
    (map < 30);                 // hemodynamic collapse

  let newArrestStart = arrestStartSeconds;
  if (arrestCondition) {
    if (newArrestStart === null) newArrestStart = elapsedSeconds;
  } else {
    newArrestStart = null;
  }

  const arrestProgressSeconds =
    newArrestStart !== null ? elapsedSeconds - newArrestStart : 0;

  // Full-arrest cascade: VTach → VFib → Asystole
  if (arrestProgressSeconds > 120) {
    return { ...buildResult('asystole', 0, 0, 0), arrestStartSeconds: newArrestStart };
  }
  if (arrestProgressSeconds > 60) {
    return { ...buildResult('ventricular_fibrillation', 0, 0, 0), arrestStartSeconds: newArrestStart };
  }
  if (arrestProgressSeconds > 20) {
    // PEA if organized-looking rhythm persists but no perfusion
    const peaQRS = prevRhythm === 'ventricular_tachycardia' ? 160 : 100;
    if (map < 30 && spo2 > 0) {
      return { ...buildResult('pea', peaQRS, 160, 400), arrestStartSeconds: newArrestStart };
    }
    return { ...buildResult('ventricular_tachycardia', 160, 0, 360), arrestStartSeconds: newArrestStart };
  }

  // Asystole / flatline
  if (spo2 <= 0 && hr < 10) {
    return { ...buildResult('asystole', 0, 0, 0), arrestStartSeconds: newArrestStart };
  }

  // -----------------------------------------------------------------------
  // 2.  LOCAL ANESTHETIC SYSTEMIC TOXICITY (LAST) SEQUENCE
  // -----------------------------------------------------------------------
  if (localAnesthCe > 0.02 * sensitivity) {
    return { ...buildResult('ventricular_fibrillation', 0, 0, 0), arrestStartSeconds: newArrestStart };
  }
  if (localAnesthCe > 0.01 * sensitivity) {
    return { ...buildResult('ventricular_tachycardia', 160, 0, 360), arrestStartSeconds: newArrestStart };
  }
  if (localAnesthCe > 0.005 * sensitivity) {
    return { ...buildResult('wide_complex_unknown', 150, 220, 440), arrestStartSeconds: newArrestStart };
  }
  if (localAnesthCe > 0.002 * sensitivity) {
    return { ...buildResult('first_degree_av_block', 100, 240, 420), arrestStartSeconds: newArrestStart };
  }

  // -----------------------------------------------------------------------
  // 3.  SEVERE HYPOXIA-DRIVEN ARRHYTHMIAS
  // -----------------------------------------------------------------------
  if (spo2 < 50 && spo2 > 0) {
    return { ...buildResult('ventricular_fibrillation', 0, 0, 0), arrestStartSeconds: newArrestStart };
  }
  if (spo2 < 60 && spo2 > 0) {
    return { ...buildResult('ventricular_tachycardia', 160, 0, 360), arrestStartSeconds: newArrestStart };
  }
  if (spo2 < 70 && spo2 > 0) {
    // Transition via polymorphic VT if previous rhythm was already VT
    const rhythm = prevRhythm === 'ventricular_tachycardia' ? 'polymorphic_vt' : 'ventricular_tachycardia';
    return { ...buildResult(rhythm, 160, 0, 360), arrestStartSeconds: newArrestStart };
  }
  if (spo2 < 80 && spo2 > 0) {
    return { ...buildResult('svt', 100, 0, 340), arrestStartSeconds: newArrestStart };
  }
  if (spo2 < 85 && spo2 > 0) {
    return { ...buildResult('atrial_fibrillation', 100, 0, 380), arrestStartSeconds: newArrestStart };
  }

  // -----------------------------------------------------------------------
  // 4.  BRADYARRHYTHMIAS (drug-induced or severe bradycardia)
  // -----------------------------------------------------------------------
  // Propofol high Ce: sinus bradycardia → 1st-degree AV block → junctional
  if (propofolCe > 8 * sensitivity) {
    return { ...buildResult('junctional', 100, 0, 480), arrestStartSeconds: newArrestStart };
  }
  if (propofolCe > 6 * sensitivity) {
    return { ...buildResult('first_degree_av_block', 100, 260, 460), arrestStartSeconds: newArrestStart };
  }

  // Fentanyl high Ce: sinus bradycardia via enhanced vagal tone
  if (fentanylCe > 6 * sensitivity) {
    return { ...buildResult('sinus_bradycardia', 100, 160, 480), arrestStartSeconds: newArrestStart };
  }

  // Complete heart block when HR is critically low
  if (hr < 30) {
    return { ...buildResult('third_degree_av_block', 120, 0, 600), arrestStartSeconds: newArrestStart };
  }

  // Wenckebach: moderate bradycardia with propofol
  if (hr < 40 && propofolCe > 4 * sensitivity) {
    return { ...buildResult('second_degree_type1', 100, 200, 480), arrestStartSeconds: newArrestStart };
  }

  // Second-degree Type II: fentanyl-driven dropped beats
  if (hr < 40 && fentanylCe > 3 * sensitivity) {
    return { ...buildResult('second_degree_type2', 100, 180, 480), arrestStartSeconds: newArrestStart };
  }

  // -----------------------------------------------------------------------
  // 5.  TACHYARRHYTHMIAS (drug-induced or sympathetic)
  // -----------------------------------------------------------------------
  // Ketamine-driven SVT at very high doses
  if (ketamineCe > 0.003 * sensitivity && hr > 140) {
    return { ...buildResult('svt', 100, 0, 340), arrestStartSeconds: newArrestStart };
  }

  // -----------------------------------------------------------------------
  // 6.  SINUS RHYTHM VARIANTS (rate-based)
  // -----------------------------------------------------------------------
  if (hr > 150) return { ...buildResult('sinus_tachycardia', 100, 140, 320), arrestStartSeconds: newArrestStart };
  if (hr > 100) return { ...buildResult('sinus_tachycardia', 100, 150, 340), arrestStartSeconds: newArrestStart };
  if (hr < 60)  return { ...buildResult('sinus_bradycardia', 100, 160, 440), arrestStartSeconds: newArrestStart };

  // Default: Normal Sinus Rhythm
  return { ...buildResult('normal_sinus', 100, 160, 400), arrestStartSeconds: newArrestStart };
}

function buildResult(
  rhythm: CardiacRhythm,
  qrsWidth: number,
  prInterval: number,
  qtInterval: number
): RhythmResult {
  return { rhythm, qrsWidth, prInterval, qtInterval };
}

// -----------------------------------------------------------------------
// ACLS GUIDANCE LOOKUP
// -----------------------------------------------------------------------
export function getAclsGuidance(rhythm: CardiacRhythm): string[] {
  switch (rhythm) {
    case 'ventricular_fibrillation':
    case 'ventricular_tachycardia':
    case 'polymorphic_vt':
      return [
        'Shockable rhythm — Defibrillate 200J biphasic',
        'Start CPR 30:2',
        'Epinephrine 1mg IV q3-5min',
        'Amiodarone 300mg IV (first dose), 150mg (second dose)',
      ];
    case 'asystole':
    case 'pea':
      return [
        'Non-shockable rhythm — Do NOT defibrillate',
        'Start CPR 30:2',
        'Epinephrine 1mg IV q3-5min',
        'Identify reversible causes (Hs and Ts)',
      ];
    case 'third_degree_av_block':
    case 'second_degree_type2':
    case 'second_degree_type1':
    case 'junctional':
    case 'sinus_bradycardia':
      return [
        'Atropine 0.5mg IV q3-5min (max 3mg)',
        'Consider transcutaneous pacing',
        'Dopamine 5-20 mcg/kg/min or Epinephrine 2-10 mcg/min',
      ];
    case 'svt':
    case 'atrial_flutter':
      return [
        'Vagal maneuvers',
        'Adenosine 6mg rapid IV push, may repeat 12mg ×2',
        'If unstable: Synchronized cardioversion',
      ];
    case 'atrial_fibrillation':
      return [
        'Rate control: Diltiazem 0.25 mg/kg IV or Metoprolol 5mg IV',
        'If unstable: Synchronized cardioversion',
      ];
    case 'wide_complex_unknown':
      return [
        'Amiodarone 150mg IV over 10 min',
        'Consider procainamide',
        'If unstable: Synchronized cardioversion',
      ];
    default:
      return [];
  }
}

/** True for rhythms that have no effective cardiac output */
export function isPulselessRhythm(rhythm: CardiacRhythm): boolean {
  return (
    rhythm === 'ventricular_fibrillation' ||
    rhythm === 'asystole' ||
    rhythm === 'pea'
  );
}

/** True for rhythms that are immediately life-threatening */
export function isLethalRhythm(rhythm: CardiacRhythm): boolean {
  return (
    rhythm === 'ventricular_fibrillation' ||
    rhythm === 'ventricular_tachycardia' ||
    rhythm === 'polymorphic_vt' ||
    rhythm === 'asystole' ||
    rhythm === 'pea'
  );
}
