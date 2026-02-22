// Education Module Infrastructure for SedSim

export type EducationCategory =
  | 'anatomy_physiology'
  | 'pharmacology'
  | 'sedation_principles'
  | 'pathophysiology'
  | 'crisis_management'
  | 'scenarios'
  | 'assessment'
  | 'advanced';

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface MillieScript {
  trigger: string;
  text: string;
}

export interface LearningModule {
  id: string;
  title: string;
  category: EducationCategory;
  level: 'beginner' | 'intermediate' | 'advanced';
  objectives: string[];
  content: string; // markdown
  quizQuestions: QuizQuestion[];
  simulatorScenarios: string[]; // references to scenario IDs
  millieScripts: MillieScript[];
}

export const EDUCATION_MODULES: Record<string, LearningModule> = {
  resp_anatomy_physiology: {
    id: 'resp_anatomy_physiology',
    title: 'Foundations - Respiratory Anatomy & Physiology for Procedural Sedation',
    category: 'anatomy_physiology',
    level: 'beginner',
    objectives: [
      'Identify the key anatomical structures of the upper airway relevant to sedation-related obstruction (pharynx, epiglottis, larynx) and explain how sedation-induced muscle relaxation compromises patency.',
      'Describe the oxygen-hemoglobin dissociation curve and explain why a SpO2 of 90% corresponds to a PaO2 of ~60 mmHg, and why pulse oximetry lags behind true arterial desaturation.',
      'Explain ventilation-perfusion (V/Q) matching and how sedation, obesity, and pulmonary pathology create V/Q mismatch that accelerates desaturation.',
      'Calculate minute ventilation (MV = RR × Vt) and predict how respiratory rate depression from opioids reduces alveolar ventilation and elevates PaCO2.',
      'Describe the respiratory cascade from atmospheric oxygen to mitochondrial utilization and identify at which steps sedating agents introduce the greatest risk.',
    ],
    content: `# Respiratory Anatomy & Physiology for Procedural Sedation

## Beginner

### Upper Airway Anatomy
The upper airway consists of the nasal cavity, oral cavity, pharynx, and larynx. During sedation, pharyngeal muscle tone is reduced, causing the tongue and soft palate to fall posteriorly and obstruct airflow. The **epiglottis** protects the laryngeal inlet; sedation impairs this reflex, increasing aspiration risk.

Key structures at risk during sedation:
- **Nasopharynx**: First area to obstruct with muscle relaxation
- **Oropharynx**: Tongue base obstruction – most common cause of sedation airway obstruction
- **Hypopharynx / Larynx**: Laryngospasm can occur with light sedation and stimulation

### Respiratory Rate and Depth
Normal respiratory rate is 12–20 breaths/min. Each breath moves approximately 500 mL (tidal volume). **Minute ventilation = RR × Tidal Volume**. Opioids primarily reduce respiratory rate; propofol reduces both rate and tidal volume.

---

## Intermediate

### Oxygen-Hemoglobin Dissociation Curve
Hemoglobin binds oxygen in a sigmoidal fashion. The P50 (PaO2 at 50% saturation) is approximately 26.6 mmHg at normal pH and temperature.

Key landmarks:
- **PaO2 100 mmHg → SpO2 ~99%** (normal breathing room air)
- **PaO2 60 mmHg → SpO2 ~90%** (the "cliff edge" – below this, saturation falls steeply)
- **PaO2 40 mmHg → SpO2 ~75%** (venous blood, tissue hypoxia imminent)

**Clinical implication**: Because of the flat upper portion of the curve, a patient pre-oxygenated to SpO2 99% has substantially more oxygen reserve before reaching the steep portion than a patient at 94% (as seen in CHF).

### V/Q Matching
Ventilation (V) and perfusion (Q) must be matched at the alveolar level for efficient gas exchange. Normal V/Q ratio ≈ 0.8.

- **V/Q < 0.8 (shunt)**: Blood passes unventilated alveoli → hypoxemia. Worsened by obesity, pulmonary edema (CHF), atelectasis from sedation.
- **V/Q > 0.8 (dead space)**: Ventilated alveoli not perfused → CO2 retention. Worsened by hypotension, PE.

Supplemental oxygen corrects low V/Q hypoxemia but NOT true shunt (intracardiac or complete atelectasis).

---

## Advanced

### Alveolar Gas Equation and Respiratory Cascade
The alveolar oxygen equation: **PAO2 = FiO2 × (Patm − PH2O) − PaCO2 / RQ**

At room air (FiO2 0.21): PAO2 ≈ 0.21 × (760 − 47) − 40/0.8 ≈ 100 mmHg

As ventilation decreases (opioid effect), PaCO2 rises (hypercapnia). This reduces PAO2 even without lung disease – another reason opioid-induced hypoventilation desaturates patients faster than expected.

### Pulse Oximetry Lag
The SpO2 displayed lags behind true arterial saturation by 30–60 seconds due to circulation time from the lungs to the fingertip sensor. In a rapidly desaturating patient, by the time SpO2 alarm fires at 90%, true arterial saturation may already be 85% or lower. This underscores the importance of continuous capnography (EtCO2) which detects hypoventilation in real time, before desaturation.

### Cascade Summary
1. **Inspired air** → FiO2 × Patm
2. **Alveolar gas** → after humidification and CO2 exchange (PAO2)
3. **Arterial blood** → after V/Q matching (PaO2)
4. **Hemoglobin saturation** → O2-Hb curve (SpO2)
5. **Tissue delivery** → CO × CaO2 (cardiac output × oxygen content)
6. **Mitochondrial utilization** → oxidative phosphorylation

Sedating agents primarily impair steps 1–3; CHF additionally impairs steps 4–5.
`,
    quizQuestions: [
      {
        question: 'A patient receiving fentanyl 100 mcg IV develops a respiratory rate of 6 breaths/min with a tidal volume of 400 mL. What is their approximate minute ventilation?',
        options: [
          '2.4 L/min',
          '4.0 L/min',
          '6.7 L/min',
          '8.4 L/min',
        ],
        correctIndex: 0,
        explanation: 'Minute ventilation = RR × Tidal Volume = 6 × 0.4 L = 2.4 L/min. Normal is approximately 5–8 L/min. This severe reduction will rapidly cause hypercapnia and hypoxemia.',
      },
      {
        question: 'At what approximate SpO2 does the oxygen-hemoglobin dissociation curve enter its steep ("cliff") portion, signalling impending severe hypoxemia?',
        options: [
          '99%',
          '95%',
          '90%',
          '85%',
        ],
        correctIndex: 2,
        explanation: 'SpO2 ~90% corresponds to PaO2 ~60 mmHg, which is at the inflection point of the sigmoidal O2-Hb curve. Below this, small further decreases in PaO2 cause large drops in saturation. This is the clinical "cliff edge" alarm threshold.',
      },
      {
        question: 'Why does supplemental oxygen (increasing FiO2 from 0.21 to 0.40) NOT fully correct hypoxemia due to a true intrapulmonary shunt?',
        options: [
          'Because oxygen cannot dissolve in blood at those concentrations',
          'Because shunted blood bypasses ventilated alveoli entirely and is never exposed to the higher FiO2',
          'Because hemoglobin is already 99% saturated and cannot carry more oxygen',
          'Because high FiO2 causes absorption atelectasis immediately',
        ],
        correctIndex: 1,
        explanation: 'In a true shunt, blood passes through completely unventilated (or non-ventilated) alveoli and mixes with oxygenated blood. Because shunted blood never contacts the higher FiO2, increasing inspired oxygen has minimal effect on shunt-related hypoxemia, unlike low V/Q mismatch where it is partially effective.',
      },
      {
        question: 'A CHF patient has a baseline SpO2 of 94% on room air. What does this indicate about their position on the oxygen-hemoglobin dissociation curve compared with a healthy patient at 99%?',
        options: [
          'They are on the flat part of the curve, with plenty of reserve',
          'They are close to the steep portion of the curve and will desaturate rapidly with any additional insult',
          'Their hemoglobin is defective and cannot bind oxygen normally',
          'Their SpO2 monitor is inaccurate due to poor perfusion',
        ],
        correctIndex: 1,
        explanation: 'SpO2 94% corresponds to PaO2 ~73 mmHg, already descending toward the inflection point at 90%/60 mmHg. With sedation-induced hypoventilation or V/Q worsening, these patients reach critical desaturation much faster than a patient starting at 99%.',
      },
      {
        question: 'Capnography (EtCO2 monitoring) detects opioid-induced hypoventilation BEFORE pulse oximetry because:',
        options: [
          'EtCO2 sensors are more accurate than SpO2 sensors',
          'CO2 rises with each breath of hypoventilation, while oxygen stores in blood buffer desaturation by 30–60 seconds',
          'Opioids directly increase CO2 production',
          'Pulse oximetry cannot detect respiratory depression',
        ],
        correctIndex: 1,
        explanation: 'When a patient hypoventilates, PaCO2 rises immediately with each breath, and EtCO2 reflects this in real time. Meanwhile, the oxygen stores in hemoglobin and dissolved in blood provide a buffer, and the pulse oximeter only detects the resulting desaturation after a 30–60 second lag. EtCO2 is thus an earlier warning of respiratory depression.',
      },
    ],
    simulatorScenarios: ['healthy_adult_routine', 'elderly_osa_case'],
    millieScripts: [
      {
        trigger: 'rr_below_10',
        text: 'Respiratory rate has fallen below 10. Remember, minute ventilation equals respiratory rate times tidal volume. As the rate drops, alveolar ventilation decreases and PaCO2 rises, shifting the O2-Hb curve right. Watch EtCO2 for early warning — it rises before SpO2 falls.',
      },
      {
        trigger: 'spo2_alarm',
        text: 'SpO2 alarm is firing. We are now on the steep portion of the oxygen-hemoglobin dissociation curve. Every percentage point drop below 90 represents a large fall in PaO2. Increase FiO2, stimulate the patient, and consider jaw thrust if airway obstruction is contributing. EtCO2 tells you whether this is hypoventilation or V/Q mismatch.',
      },
      {
        trigger: 'apnea',
        text: 'Apnea detected — respiratory rate is zero. Minute ventilation is zero. Hypoxemia and hypercapnia will develop within seconds to minutes depending on pre-oxygenation and metabolic demand. Provide bag-mask ventilation immediately. Review the respiratory cascade: atmosphere, alveolus, arterial blood, tissue. We are failing at step one.',
      },
    ],
  },
};
