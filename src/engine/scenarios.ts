// Predefined clinical scenarios with guided tutorials

export interface ScenarioStep {
  time: number; // seconds into simulation
  action: 'bolus' | 'infusion_start' | 'infusion_stop' | 'intervention' | 'wait' | 'observe';
  drug?: string;
  dose?: number;
  rate?: number;
  intervention?: string;
  narration: string; // Text explanation
  voiceText: string; // Natural voice narration script
  highlight?: string[]; // UI elements to highlight
}

export interface ClinicalScenario {
  id: string;
  title: string;
  patientArchetype: string;
  description: string;
  learningObjectives: string[];
  duration: number; // expected duration in seconds
  steps: ScenarioStep[];
  clinicalPearls: string[];
}

export const SCENARIOS: Record<string, ClinicalScenario> = {
  healthy_adult_routine: {
    id: 'healthy_adult_routine',
    title: 'Routine Wisdom Tooth Extraction - Healthy Adult',
    patientArchetype: 'healthy_adult',
    description: 'A straightforward case demonstrating standard conscious sedation for an uncomplicated third molar extraction.',
    learningObjectives: [
      'Understand titration technique for IV sedation',
      'Recognize appropriate depth of sedation',
      'Learn local anesthetic administration timing',
      'Monitor vital signs during procedure'
    ],
    duration: 600,
    steps: [
      {
        time: 0,
        action: 'observe',
        narration: 'Patient Assessment: 35-year-old male, ASA 1, presenting for wisdom tooth extraction. Baseline vitals are stable.',
        voiceText: 'We have a healthy thirty-five year old male patient, A S A class one, here for a routine wisdom tooth extraction. His baseline vitals are completely stable. Heart rate is seventy-five, blood pressure one twenty over eighty, and oxygen saturation is ninety-nine percent on room air.',
        highlight: ['patient-info', 'vitals']
      },
      {
        time: 10,
        action: 'bolus',
        drug: 'midazolam',
        dose: 2,
        narration: 'Administer 2mg Midazolam: Starting with anxiolysis. This provides amnesia and reduces anxiety without deep sedation.',
        voiceText: 'Let\'s begin with two milligrams of midazolam intravenously. This benzodiazepine will provide anxiolysis and amnesia while keeping our patient comfortable and cooperative. We\'re giving it slowly over thirty seconds.',
        highlight: ['midazolam-panel']
      },
      {
        time: 90,
        action: 'observe',
        narration: 'Assess Response: Wait 60-90 seconds to evaluate midazolam effect. Patient should appear relaxed but responsive.',
        voiceText: 'Now we wait sixty to ninety seconds to allow the midazolam to take effect. Notice how the plasma concentration is rising on our pharmacokinetic graph. The patient should become visibly more relaxed while remaining responsive to verbal commands.',
        highlight: ['trend-graph', 'moass-indicator']
      },
      {
        time: 120,
        action: 'bolus',
        drug: 'fentanyl',
        dose: 50,
        narration: 'Administer 50mcg Fentanyl: Adding analgesia for the procedure. Fentanyl provides pain relief with minimal respiratory depression at this dose.',
        voiceText: 'Next, we\'ll add fifty micrograms of fentanyl for analgesia. This synthetic opioid provides excellent pain control with a rapid onset. At this dose, we shouldn\'t see significant respiratory depression, but we\'ll monitor closely.',
        highlight: ['fentanyl-panel']
      },
      {
        time: 180,
        action: 'bolus',
        drug: 'propofol',
        dose: 20,
        narration: 'Administer 20mg Propofol: Titrating sedation depth. Small incremental doses allow precise control.',
        voiceText: 'Now we\'ll titrate propofol in twenty milligram increments. This allows us to carefully control the depth of sedation. Propofol has a rapid onset and short duration, making it ideal for titration. Watch the M O A S S score.',
        highlight: ['propofol-panel', 'moass-indicator']
      },
      {
        time: 210,
        action: 'bolus',
        drug: 'propofol',
        dose: 20,
        narration: 'Additional 20mg Propofol: Deepening sedation to moderate level. Patient should be drowsy but easily arousable.',
        voiceText: 'Another twenty milligrams of propofol. We\'re aiming for moderate sedation, also called conscious sedation. The patient should be drowsy but respond purposefully to verbal or tactile stimulation.',
        highlight: ['propofol-panel']
      },
      {
        time: 240,
        action: 'bolus',
        drug: 'lidocaine_epi',
        dose: 36,
        narration: 'Local Anesthetic: One cartridge of 2% Lidocaine with Epinephrine. The systemic sedation allows comfortable injection.',
        voiceText: 'Perfect. Now that our patient is comfortably sedated, we can administer local anesthesia. We\'re using one cartridge of two percent lidocaine with epinephrine. The epinephrine causes vasoconstriction, prolonging the anesthetic effect and reducing bleeding.',
        highlight: ['local-anesth-panel']
      },
      {
        time: 270,
        action: 'bolus',
        drug: 'lidocaine_epi',
        dose: 36,
        narration: 'Second cartridge: Ensuring complete regional anesthesia for the extraction site.',
        voiceText: 'And a second cartridge to ensure complete regional anesthesia. Notice on the pharmacokinetic graph how the lidocaine is gradually absorbed from the local injection site. Peak plasma levels occur in ten to twenty minutes.',
        highlight: ['local-anesth-panel', 'trend-graph']
      },
      {
        time: 300,
        action: 'observe',
        narration: 'Procedure Time: Surgeon performs extraction. Sedation maintains patient comfort. Monitor vitals continuously.',
        voiceText: 'The surgeon is now performing the extraction. Our patient remains in moderate sedation, comfortable and still. Heart rate and blood pressure are stable. Respiratory rate is slightly reduced but adequate. Oxygen saturation remains excellent.',
        highlight: ['vitals', 'moass-indicator']
      },
      {
        time: 420,
        action: 'observe',
        narration: 'Emergence: Propofol wearing off. Patient becoming more responsive. This is normal emergence from sedation.',
        voiceText: 'The procedure is complete, and we\'re seeing normal emergence. The propofol is metabolized quickly, and our patient is becoming more alert. The midazolam and fentanyl have longer half-lives, so some sedation and analgesia will persist.',
        highlight: ['trend-graph', 'moass-indicator']
      },
      {
        time: 600,
        action: 'observe',
        narration: 'Recovery: Patient fully responsive. Ready for discharge criteria assessment. No complications observed.',
        voiceText: 'Excellent outcome. Our patient is now fully responsive to verbal commands. Vital signs have returned to baseline. He\'s ready for post-operative monitoring and discharge criteria assessment. This demonstrates a textbook case of conscious sedation for outpatient oral surgery.',
        highlight: ['vitals', 'event-log']
      }
    ],
    clinicalPearls: [
      'Always titrate sedatives incrementally in healthy patients',
      'Wait for drug effect before adding more medication',
      'Local anesthetic with epinephrine reduces bleeding and prolongs effect',
      'Monitor respiratory status continuously during sedation',
      'Propofol\'s short half-life allows rapid emergence'
    ]
  },
  
  elderly_osa_case: {
    id: 'elderly_osa_case',
    title: 'Dental Implant - Elderly with OSA',
    patientArchetype: 'elderly',
    description: 'Complex case requiring careful sedation in a patient with obstructive sleep apnea and reduced physiologic reserve.',
    learningObjectives: [
      'Recognize OSA-related airway challenges',
      'Apply conservative dosing strategies',
      'Understand drug sensitivity in elderly',
      'Master airway intervention techniques'
    ],
    duration: 720,
    steps: [
      {
        time: 0,
        action: 'observe',
        narration: 'High-Risk Patient: 78-year-old female, ASA 2, with OSA and reduced cardiac reserve. Requires cautious approach.',
        voiceText: 'This is a higher-risk case. We have a seventy-eight year old female patient, A S A class two, with a history of obstructive sleep apnea. She also has reduced cardiac reserve. This patient requires a much more conservative approach to sedation.',
        highlight: ['patient-info', 'patient-selector']
      },
      {
        time: 20,
        action: 'intervention',
        intervention: 'fio2',
        narration: 'Supplemental Oxygen: Increase FiO2 to 40% prophylactically. OSA patients prone to desaturation.',
        voiceText: 'First, let\'s be proactive with oxygenation. I\'m increasing the F I O two to forty percent via nasal cannula before we even begin sedation. Patients with O S A are prone to rapid desaturation, so we want to pre-oxygenate.',
        highlight: ['interventions-panel']
      },
      {
        time: 40,
        action: 'bolus',
        drug: 'midazolam',
        dose: 0.5,
        narration: 'Reduced Midazolam Dose: Only 0.5mg in elderly. Sensitivity to benzodiazepines increases with age.',
        voiceText: 'For initial anxiolysis, we\'re using just half a milligram of midazolam. That\'s seventy-five percent less than we used in our young healthy patient. Elderly patients are much more sensitive to benzodiazepines, and she already has respiratory compromise from O S A.',
        highlight: ['midazolam-panel']
      },
      {
        time: 150,
        action: 'observe',
        narration: 'Extended Wait Time: Allow more time for drug effect in elderly patients due to altered pharmacokinetics.',
        voiceText: 'Notice we\'re waiting longer between doses. In elderly patients, the volume of distribution changes, and hepatic metabolism slows. What we gave two minutes ago may not reach peak effect for another minute or two.',
        highlight: ['trend-graph']
      }
    ],
    clinicalPearls: [
      'Reduce standard doses by 50-75% in elderly patients',
      'OSA patients require aggressive airway management',
      'Extended intervals between doses allow assessment',
      'Have reversal agents readily available',
      'Consider avoiding benzodiazepines entirely in severe OSA'
    ]
  },
  
  hcm_young_case: {
    id: 'hcm_young_case',
    title: 'Third Molar Surgery - Young Adult with HCM',
    patientArchetype: 'hcm_young',
    description: 'Managing sedation in a patient with hypertrophic cardiomyopathy. Requires careful hemodynamic management.',
    learningObjectives: [
      'Understand HCM pathophysiology implications',
      'Avoid medications that worsen outflow obstruction',
      'Maintain adequate preload and afterload',
      'Recognize hemodynamic instability early'
    ],
    duration: 540,
    steps: [
      {
        time: 0,
        action: 'observe',
        narration: 'HCM Patient: 28-year-old with hypertrophic cardiomyopathy. Hemodynamics are critical - avoid tachycardia and hypotension.',
        voiceText: 'This twenty-eight year old patient has hypertrophic cardiomyopathy. In H C M, the interventricular septum is thickened, creating left ventricular outflow obstruction. We must avoid anything that worsens this obstruction, including tachycardia, decreased preload, or decreased afterload.',
        highlight: ['patient-info', 'vitals']
      },
      {
        time: 30,
        action: 'bolus',
        drug: 'midazolam',
        dose: 1,
        narration: 'Conservative Midazolam: 1mg dose. Anxiolysis reduces endogenous catecholamines that could cause tachycardia.',
        voiceText: 'We\'ll start with one milligram of midazolam. Anxiolysis is actually beneficial here because it reduces the patient\'s endogenous catecholamine release, which can cause tachycardia and worsen outflow obstruction.',
        highlight: ['midazolam-panel']
      }
    ],
    clinicalPearls: [
      'Maintain adequate intravascular volume in HCM',
      'Avoid medications causing significant vasodilation',
      'Tachycardia worsens outflow obstruction',
      'Ketamine may be preferred over propofol',
      'Have phenylephrine available for blood pressure support'
    ]
  }
};

export const SCENARIO_LIST = Object.values(SCENARIOS);
