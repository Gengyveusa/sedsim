import type { LearningModule } from './educationModules';

// AHA BLS HeartCode — Complete Course Module for SedSim Education Engine
// Aligned with AHA HeartCode BLS 2020/2025 Guidelines

export const BLS_HEARTCODE_MODULE: LearningModule = {
  id: 'bls_heartcode',
  title: 'AHA BLS HeartCode — Complete Course',
  category: 'crisis_management',
  level: 'beginner',
  objectives: [
    'Describe the impact of high-quality CPR on survival from cardiac arrest and explain why bystander CPR doubles or triples survival rates.',
    'Explain the Chain of Survival concept for both adult and pediatric cardiac arrest, identifying each link and its role in improving outcomes.',
    'Recognize when CPR is needed by assessing scene safety, responsiveness, breathing, and pulse within 10 seconds.',
    'Perform high-quality CPR for adult, child, and infant patients, adapting technique to patient size and age.',
    'Demonstrate correct hand placement, maintain a compression rate of 100–120/min, achieve proper depth (adult 2–2.4 in, child ~2 in, infant ~1.5 in), and allow full chest recoil between compressions.',
    'Deliver effective rescue breaths with visible chest rise using head-tilt chin-lift, jaw thrust, and bag-mask ventilation techniques.',
    'Explain the importance of early AED use in cardiac arrest and how defibrillation within 3–5 minutes can raise survival rates to 50–70%.',
    'Operate an AED correctly: power on, attach pads, allow analysis, clear the patient, deliver shock, and resume CPR immediately.',
    'Coordinate team-based multirescuer CPR including 2-rescuer roles, compression-to-ventilation ratios, and compressor switching every 2 minutes.',
    'Manage foreign body airway obstruction (FBAO) in conscious and unconscious adults, children, and infants using age-appropriate techniques.',
  ],

  content: `# AHA BLS HeartCode — Complete Course

## Why High-Quality CPR Matters

Cardiac arrest strikes over **350,000 people** outside hospitals in the United States each year. Without intervention, survival drops **7–10% for every minute** that passes. **High-quality CPR** is the single most important factor a rescuer controls — it maintains perfusion to the brain and heart until advanced care arrives.

Key survival statistics:
- Bystander CPR **doubles or triples** survival from witnessed cardiac arrest.
- CPR combined with AED use within **3–5 minutes** can produce survival rates of **50–70%**.
- Poor-quality CPR (too slow, too shallow, excessive interruptions) may be no better than no CPR at all.

**Bottom line**: Push hard, push fast, minimize interruptions, and get the AED on as soon as possible.

---

## The Chain of Survival

The **Chain of Survival** is a sequence of critical actions that, when performed in rapid succession, maximize the chance of survival from cardiac arrest. Every link must be strong — a single weak link can be fatal.

### Adult Out-of-Hospital Chain of Survival
1. **Early Recognition & Activation** — Recognize cardiac arrest, call 911 (or direct someone to call)
2. **Early High-Quality CPR** — Begin chest compressions immediately
3. **Early Defibrillation** — Apply AED as soon as available
4. **Advanced Life Support** — Paramedics provide ACLS (medications, advanced airway)
5. **Post-Cardiac Arrest Care** — ICU management, targeted temperature management
6. **Recovery** — Rehabilitation and long-term follow-up

### Pediatric Out-of-Hospital Chain of Survival
1. **Prevention of Arrest** — Injury prevention, safe sleep, vaccination (many pediatric arrests are respiratory in origin)
2. **Early High-Quality CPR** — Bystander CPR is even more critical in children
3. **Activation of Emergency Response** — Call 911
4. **Advanced Life Support** — Pediatric-specific ACLS
5. **Post-Cardiac Arrest Care** — Pediatric ICU management
6. **Recovery** — Developmental follow-up

> **Key Difference**: Adult arrests are most commonly **cardiac** in origin (VF/pVT), so early defibrillation is paramount. Pediatric arrests are most commonly **respiratory** in origin, so early CPR with ventilations is critical.

---

## Recognizing Cardiac Arrest

You cannot treat what you do not recognize. Speed is everything — every second of delay costs myocardial and cerebral cells.

### Step-by-Step Assessment

1. **Scene Safety** — Before approaching, confirm the scene is safe for you and the victim. Look for hazards: traffic, electrical wires, toxic exposure.

2. **Check Responsiveness** — Tap the victim's shoulders firmly and shout: *"Are you okay? Are you okay?"*
   - **Adult/Child**: Tap both shoulders
   - **Infant**: Flick the sole of the foot

3. **Assess Breathing** — Look at the chest for **no more than 10 seconds**.
   - **No breathing or only gasping** = treat as cardiac arrest
   - **Agonal gasps** are NOT effective breathing — they are irregular, labored, snoring-like sounds that occur in up to **40% of cardiac arrest victims**. Do NOT mistake gasping for breathing.

4. **Check Pulse** — Simultaneously with breathing check or immediately after:
   - **Adult/Child**: Palpate the **carotid artery** (groove between trachea and sternocleidomastoid muscle)
   - **Infant**: Palpate the **brachial artery** (medial aspect of the upper arm)
   - Allow **no more than 10 seconds** for pulse check
   - If you are unsure whether you feel a pulse, **assume there is no pulse** and begin CPR

5. **Activate EMS** — Call 911 (or direct a bystander to call) and send someone to retrieve the nearest **AED**.
   - If alone with an **adult**: Call 911 first, then begin CPR (cardiac arrest is likely cardiac — need defibrillator)
   - If alone with a **child or infant**: Perform **2 minutes of CPR first**, then call 911 (arrest is likely respiratory — need ventilations)

---

## High-Quality CPR — Adult

### Compression-Only (Hands-Only) CPR vs. Conventional CPR
- **Compression-only CPR** is recommended for **untrained bystanders** or those unwilling to provide breaths. It is effective for the first several minutes of witnessed adult cardiac arrest because residual oxygen remains in the blood.
- **Conventional CPR** (compressions + breaths at 30:2) is preferred when the rescuer is trained and willing, especially for prolonged resuscitation, drowning, or respiratory-cause arrest.

### Hand Placement
- Place the **heel of one hand** on the **lower half of the sternum** (center of the chest, between the nipples).
- Place the **heel of the second hand** on top of the first.
- Interlace fingers and keep them **off the ribs**.
- Position your shoulders directly over your hands, arms straight, elbows locked.

### Compression Parameters
| Parameter | Adult Target |
|-----------|-------------|
| **Rate** | **100–120 compressions/min** |
| **Depth** | **At least 2 inches (5 cm), no more than 2.4 inches (6 cm)** |
| **Recoil** | **Allow full chest recoil** — do not lean on the chest between compressions |
| **Interruptions** | **Minimize to <10 seconds** (for pulse checks, ventilations, AED analysis) |
| **Ratio** | **30:2** (single rescuer) |

### Critical Quality Markers
- **Push hard**: Compressions that are too shallow fail to generate adequate coronary perfusion pressure (CPP). Target CPP > 15 mmHg for ROSC.
- **Push fast**: Rates below 100/min produce inadequate cardiac output. Rates above 120/min reduce filling time and compress depth.
- **Full recoil**: Leaning on the chest between compressions ("residual leaning") reduces venous return and coronary perfusion by up to **30%**.
- **Minimize interruptions**: Every pause in compressions drops CPP to near zero. It takes **multiple compressions** to rebuild CPP. The **chest compression fraction** (proportion of time spent compressing) should be **>60%**, ideally **>80%**.

---

## High-Quality CPR — Child (Age 1 Year to Puberty)

Children in cardiac arrest most commonly have a **respiratory** etiology — asthma, drowning, choking, trauma. Effective ventilations are therefore especially important.

### Technique
- Use **one or two hands** (based on child's size) on the **lower half of the sternum**.
- **Depth**: Approximately **2 inches (5 cm)**, or about **one-third the anteroposterior (AP) diameter** of the chest.
- **Rate**: **100–120 compressions/min** (same as adult).
- **Recoil**: Allow full chest recoil.

### Compression-to-Ventilation Ratio
| Scenario | Ratio |
|----------|-------|
| **Single rescuer** | **30:2** |
| **Two rescuers** | **15:2** |

> **Why 15:2 with two rescuers?** Because pediatric arrest is usually respiratory, delivering more frequent ventilations improves oxygenation. With two rescuers, the additional breaths do not significantly interrupt compressions.

---

## High-Quality CPR — Infant (Less Than 1 Year)

### Single-Rescuer Technique: Two-Finger Method
- Place **two fingers** (index and middle) on the **lower half of the sternum**, just below the nipple line.
- **Depth**: Approximately **1.5 inches (4 cm)**, or about **one-third the AP diameter** of the chest.
- **Rate**: **100–120 compressions/min**.
- **Ratio**: **30:2** (single rescuer).

### Two-Rescuer Technique: Two-Thumb Encircling Hands
- Place **both thumbs** side by side on the **lower half of the sternum**.
- **Encircle the infant's thorax** with your fingers, supporting the back.
- This technique generates **higher coronary perfusion pressures** and is preferred when two rescuers are present.
- **Ratio**: **15:2** (two rescuers).

### Key Infant Differences
- **Pulse check**: Brachial artery (medial upper arm), not carotid.
- **Compression method**: Two fingers (1 rescuer) or two-thumb encircling hands (2 rescuers) — **never use the heel of the hand** on an infant.
- **Ventilation volume**: Just enough to produce **visible chest rise** — overinflation causes gastric distension and regurgitation.

---

## Rescue Breaths

### Airway Opening Techniques
- **Head-tilt chin-lift**: Default maneuver. Place one hand on the forehead and tilt the head back while lifting the chin with the fingers of the other hand. For infants, use a **neutral "sniffing" position** — do not hyperextend.
- **Jaw thrust**: Use when **cervical spine injury** is suspected. Place fingers behind the angles of the mandible and lift the jaw forward without tilting the head.

### Delivering Breaths
- Each breath should last **approximately 1 second**.
- Deliver just enough volume to produce **visible chest rise**.
- Avoid excessive ventilation — it causes **gastric inflation**, increases intrathoracic pressure, reduces venous return, and decreases coronary perfusion.
- **Mouth-to-mouth**: Pinch the nose, seal your mouth over the patient's mouth.
- **Mouth-to-mouth-and-nose** (infant): Cover both the mouth and nose with your mouth.
- **Bag-mask ventilation (BVM)**: Use E-C clamp technique — the thumb and index finger form a "C" over the mask to seal it, while the remaining three fingers form an "E" along the mandible to maintain jaw lift.

### Troubleshooting Breaths That Don't Produce Chest Rise
1. **Reposition the airway** — re-tilt the head, re-lift the chin.
2. **Ensure a tight mask seal** (if using BVM).
3. **Check for foreign body** — look in the mouth before each ventilation attempt.
4. If still unsuccessful after repositioning, **resume compressions** — do not delay CPR for ventilation troubleshooting.

---

## AED — Automated External Defibrillator

### Why Early Defibrillation Matters
The most common initial rhythm in witnessed adult cardiac arrest is **ventricular fibrillation (VF)**. VF is a **shockable rhythm** — the only definitive treatment is defibrillation. VF deteriorates to **asystole** over minutes, which is **non-shockable** and carries a much worse prognosis. Every minute without defibrillation reduces survival by **7–10%**.

### Shockable vs. Non-Shockable Rhythms
| Rhythm | Shockable? | Description |
|--------|-----------|-------------|
| **Ventricular Fibrillation (VF)** | **Yes** | Chaotic electrical activity, no coordinated contraction, no pulse |
| **Pulseless Ventricular Tachycardia (pVT)** | **Yes** | Rapid, organized ventricular rhythm but no effective cardiac output |
| **Asystole** | **No** | No electrical activity ("flatline") |
| **Pulseless Electrical Activity (PEA)** | **No** | Organized electrical activity on monitor but no palpable pulse |

### AED Operation — Step by Step
1. **Power ON** the AED (press the power button or open the lid).
2. **Attach pads** to the patient's bare, dry chest:
   - **Right pad**: Below the right clavicle, to the right of the sternum.
   - **Left pad**: Left side of the chest, below the armpit (left mid-axillary line), below the level of the nipple.
   - Ensure pads are flat with no air pockets. If the chest is wet, dry it first. If excessive hair, shave or remove it quickly.
3. **Analyze** — The AED will analyze the heart rhythm. **Ensure no one is touching the patient** during analysis.
4. **Shock advised** — The AED will charge. Once charged, ensure everyone is **clear** ("I'm clear, you're clear, everybody's clear!") and press the **shock button**.
5. **Shock NOT advised** — The rhythm is non-shockable (asystole or PEA). Immediately resume CPR.
6. **Resume CPR immediately** after shock delivery — do NOT stop to recheck the rhythm. Continue for **2 full minutes** (5 cycles of 30:2), then the AED will re-analyze.

### Energy Levels
- **Adult**: Biphasic defibrillators typically use **120–200 J** for the first shock (follow manufacturer recommendations). Escalating energy may be used for subsequent shocks.
- **Pediatric (<8 years or <25 kg)**: Use **pediatric pads** or a **dose attenuator** if available. Energy dose: **2 J/kg** for the first shock, **4 J/kg** for subsequent shocks (typical pediatric pads deliver **50–75 J**).
- If only adult pads are available for a child, **use them** — defibrillation with adult pads is better than no defibrillation. Ensure pads do not touch or overlap (use anterior-posterior placement if needed).

### Special AED Considerations
- **Water**: Move the patient to a dry surface. Dry the chest before applying pads.
- **Implanted pacemaker/defibrillator**: If a lump is visible below the clavicle, place the AED pad at least **1 inch (2.5 cm) away** from the device.
- **Transdermal medication patches**: Remove the patch and wipe the area clean before applying pads (risk of burns or reduced energy delivery).

---

## Two-Rescuer CPR

When two or more rescuers are available, CPR becomes significantly more effective through role assignment and reduced fatigue.

### Roles
- **Compressor**: Delivers chest compressions. Positioned at the patient's side.
- **Ventilator**: Manages the airway and delivers breaths. Positioned at the patient's head.

### Compression-to-Ventilation Ratios (Two Rescuers)
| Patient | Ratio |
|---------|-------|
| **Adult** | **30:2** |
| **Child** | **15:2** |
| **Infant** | **15:2** |

### Switching Compressors
- **Switch every 2 minutes** (approximately every 5 cycles of 30:2).
- The switch should take **less than 5 seconds** — coordinate the handoff.
- Research shows that **compressor fatigue** begins within **1–2 minutes**, even when the rescuer does not feel tired. Compression depth and rate degrade with fatigue.
- Typical switch timing: AED re-analysis every 2 minutes provides a natural switching point.

### Team Communication
- Clearly state your role: *"I'll do compressions. You manage the airway."*
- Count compressions aloud so the ventilator can anticipate breaths.
- Call out before switching: *"Switch in 5 compressions — 5, 4, 3, 2, 1, switch!"*

---

## Foreign Body Airway Obstruction (FBAO)

Choking is a potentially reversible cause of death. Rapid recognition and intervention can be lifesaving.

### Recognition
- **Mild (partial) obstruction**: Patient can cough forcefully, may wheeze. **Encourage coughing.** Do NOT intervene with abdominal thrusts — you may convert a partial obstruction to a complete one.
- **Severe (complete) obstruction**: Patient **cannot speak, cough, or breathe**. May clutch the throat (universal choking sign). Skin becomes cyanotic.

### Conscious Adult or Child — Abdominal Thrusts (Heimlich Maneuver)
1. Stand behind the patient.
2. Place one fist (thumb side in) just **above the navel** and well **below the xiphoid process**.
3. Grasp the fist with the other hand.
4. Deliver quick **inward and upward thrusts**.
5. Repeat until the object is expelled or the patient becomes unconscious.
6. For **pregnant or obese** patients: use **chest thrusts** instead (arms around the chest at the nipple line).

### Conscious Infant — Back Slaps and Chest Thrusts
1. Support the infant face-down on your forearm, head lower than the trunk.
2. Deliver **5 back slaps** between the shoulder blades with the heel of your hand.
3. Turn the infant face-up, supporting the head.
4. Deliver **5 chest thrusts** using **two fingers** on the lower half of the sternum (same location as infant CPR compressions).
5. Repeat the cycle of 5 back slaps and 5 chest thrusts until the object is expelled or the infant becomes unconscious.

> **NEVER perform blind finger sweeps** in infants or children — you may push the object deeper.

### Unconscious Victim (Any Age)
1. Lower the patient to the ground.
2. **Activate EMS** if not already done.
3. Begin **CPR** (starting with chest compressions).
4. **Each time you open the airway** to deliver breaths, **look into the mouth**. If you see an object, remove it with a finger sweep (adults only) or forceps.
5. Attempt to deliver breaths. If the breath does not produce chest rise, reposition the airway and try again.
6. Continue cycles of compressions, airway check, and ventilation attempts.

---

## BLS Algorithm Summary

This is the master algorithm you should commit to memory. Every BLS resuscitation follows this sequence:

### Step-by-Step BLS Algorithm
1. **Scene Safety** — Ensure the environment is safe for rescuers and the victim.
2. **Check Responsiveness** — Tap shoulders and shout. No response?
3. **Activate EMS / Get AED** — Call 911 (or delegate). Send for the nearest AED.
4. **Check Breathing and Pulse** — Look for breathing; palpate carotid (adult/child) or brachial (infant) pulse. No more than **10 seconds**.
5. **No Pulse → Begin CPR** — Start with **chest compressions** (C-A-B sequence). Deliver 30 compressions, then open the airway and give 2 breaths (30:2).
6. **AED Arrives → Power On → Attach Pads** — Bare the chest, attach pads in correct positions.
7. **AED Analyzes Rhythm**:
   - **Shockable (VF/pVT)** → Deliver shock → **Resume CPR immediately for 2 minutes**
   - **Non-shockable (Asystole/PEA)** → **Resume CPR immediately for 2 minutes**
8. **After 2 Minutes** — AED re-analyzes. Repeat steps 7–8.
9. **Continue Until**:
   - **ROSC** (return of spontaneous circulation) — patient moves, breathes, pulse returns
   - **ACLS team arrives** and assumes care
   - You are physically unable to continue (exhaustion)
   - The scene becomes unsafe

### C-A-B Sequence
BLS follows a **Compressions–Airway–Breathing (C-A-B)** approach, not the older A-B-C. Rationale: chest compressions maintain coronary and cerebral perfusion immediately, while delays for airway positioning and breaths in the first moments waste critical time.

---

## Special Circumstances

### Drowning
- Cardiac arrest in drowning is **hypoxic** in origin. **Ventilations are the priority**.
- Begin with **5 rescue breaths** before starting compressions (if trained).
- Standard 30:2 CPR thereafter.
- Remove the patient from the water first (perform CPR on a firm surface).
- Hypothermia may be present — see below.

### Opioid Overdose
- Suspect opioid overdose if: respiratory arrest or cardiac arrest in a patient with known opioid use, pinpoint pupils, or evidence of drug paraphernalia.
- **Administer naloxone (Narcan)** if available:
  - Intranasal: **4 mg in one nostril**
  - Intramuscular: **0.4 mg IM**
  - May repeat every **2–3 minutes**
- **Naloxone does NOT replace CPR.** If the patient is in cardiac arrest (no pulse), perform standard BLS. Naloxone alone will not restart the heart.
- Continue CPR and deliver naloxone simultaneously.

### Pregnancy (>20 Weeks Gestation)
- **Manual left uterine displacement (LUD)**: A second rescuer pushes the uterus to the patient's left side to relieve **aortocaval compression** by the gravid uterus, which otherwise reduces venous return and makes CPR less effective.
- Perform standard BLS with the following modifications:
  - Compressions may be slightly **higher on the sternum** than usual.
  - Defibrillation at **standard energy levels** — shocks do not harm the fetus.
  - If no ROSC by **4–5 minutes**, prepare for **perimortem cesarean delivery** (performed by advanced team).

### Hypothermia
- Cold patients may have **very slow or absent pulses** — check for pulse for up to **60 seconds** in severe hypothermia.
- **Continue CPR** even if the patient appears lifeless. The cold brain is more resistant to hypoxic injury ("You're not dead until you're warm and dead").
- Defibrillation may be ineffective below core temperature of **30°C (86°F)** — limit to **one attempt**, then resume CPR and focus on rewarming.
- Avoid aggressive movements that could trigger VF in a hypothermic heart.

---

## Quick Reference Card

| Parameter | Adult | Child (1 yr – puberty) | Infant (<1 yr) |
|-----------|-------|----------------------|-----------------|
| **Compression depth** | 2–2.4 in (5–6 cm) | ~2 in (5 cm) or 1/3 AP | ~1.5 in (4 cm) or 1/3 AP |
| **Compression rate** | 100–120/min | 100–120/min | 100–120/min |
| **Hand placement** | 2 hands, lower sternum | 1 or 2 hands, lower sternum | 2 fingers (1 rescuer) or 2-thumb encircling (2 rescuers) |
| **Compression:Ventilation (1 rescuer)** | 30:2 | 30:2 | 30:2 |
| **Compression:Ventilation (2 rescuers)** | 30:2 | 15:2 | 15:2 |
| **Pulse check location** | Carotid | Carotid | Brachial |
| **AED pads** | Adult pads | Pediatric pads if <8 yr | Pediatric pads (anterior-posterior if needed) |
`,

  quizQuestions: [
    // === CPR Parameters (Rate, Depth, Ratio) ===
    {
      question: 'What is the recommended chest compression rate for adult CPR?',
      options: [
        '60–80 compressions per minute',
        '80–100 compressions per minute',
        '100–120 compressions per minute',
        '120–140 compressions per minute',
      ],
      correctIndex: 2,
      explanation:
        'The AHA recommends a compression rate of 100–120 per minute for all age groups. Rates below 100/min generate inadequate cardiac output, while rates above 120/min reduce compression depth and ventricular filling time, both of which decrease coronary perfusion pressure.',
    },
    {
      question: 'What is the correct compression depth for adult CPR?',
      options: [
        'At least 1 inch (2.5 cm)',
        'At least 1.5 inches (4 cm)',
        'At least 2 inches (5 cm) but no more than 2.4 inches (6 cm)',
        'At least 3 inches (7.5 cm)',
      ],
      correctIndex: 2,
      explanation:
        'Adult compression depth should be at least 2 inches (5 cm) but no more than 2.4 inches (6 cm). Compressions that are too shallow fail to generate adequate coronary perfusion pressure (CPP > 15 mmHg is needed for ROSC). Compressions deeper than 2.4 inches increase the risk of rib fractures and internal organ injury without improving outcomes.',
    },
    {
      question: 'For a single rescuer performing CPR on an 8-month-old infant, what is the correct compression-to-ventilation ratio?',
      options: [
        '15:2',
        '30:2',
        '15:1',
        '30:1',
      ],
      correctIndex: 1,
      explanation:
        'A single rescuer uses a 30:2 compression-to-ventilation ratio for ALL age groups (adult, child, and infant). The 15:2 ratio is used only when TWO rescuers are performing CPR on a child or infant, because the additional ventilator can deliver more frequent breaths without interrupting compressions.',
    },
    {
      question: 'What is the recommended compression depth for an infant during CPR?',
      options: [
        'Approximately 0.5 inches (1.3 cm)',
        'Approximately 1.5 inches (4 cm), or one-third the AP diameter of the chest',
        'Approximately 2 inches (5 cm)',
        'Approximately 2.4 inches (6 cm)',
      ],
      correctIndex: 1,
      explanation:
        'Infant compression depth should be approximately 1.5 inches (4 cm), or about one-third the anteroposterior (AP) diameter of the chest. This depth is sufficient to generate adequate cardiac output in an infant without causing injury to the compliant infant thorax.',
    },
    {
      question: 'When two rescuers are performing CPR on a 4-year-old child, what compression-to-ventilation ratio should they use?',
      options: [
        '30:2',
        '15:2',
        '15:1',
        '5:1',
      ],
      correctIndex: 1,
      explanation:
        'Two-rescuer CPR on a child (or infant) uses a 15:2 compression-to-ventilation ratio. This delivers more ventilations per minute than the single-rescuer 30:2 ratio, which is important because pediatric cardiac arrest is most commonly respiratory in origin. The second rescuer can manage the airway without significantly interrupting compressions.',
    },
    {
      question: 'What is the preferred compression technique for two-rescuer infant CPR?',
      options: [
        'One-hand compression on the lower sternum',
        'Two-finger technique on the lower sternum',
        'Two-thumb encircling hands technique on the lower sternum',
        'Heel of the hand on the center of the chest',
      ],
      correctIndex: 2,
      explanation:
        'The two-thumb encircling hands technique is preferred for two-rescuer infant CPR because it generates higher coronary perfusion pressures than the two-finger technique. The rescuer places both thumbs side by side on the lower half of the sternum while the fingers encircle the thorax and support the back. The two-finger technique is reserved for single-rescuer CPR when one hand is needed to maintain head position for ventilations.',
    },

    // === AED Operation and Rhythms ===
    {
      question: 'Which of the following cardiac rhythms is shockable by an AED?',
      options: [
        'Asystole',
        'Pulseless electrical activity (PEA)',
        'Ventricular fibrillation (VF)',
        'Sinus bradycardia',
      ],
      correctIndex: 2,
      explanation:
        'Ventricular fibrillation (VF) and pulseless ventricular tachycardia (pVT) are the two shockable rhythms. VF is chaotic disorganized electrical activity with no effective cardiac contraction. Defibrillation delivers a controlled electrical shock that depolarizes the entire myocardium simultaneously, giving the sinoatrial node an opportunity to resume normal pacemaker activity. Asystole and PEA are non-shockable — they require CPR and treatment of reversible causes.',
    },
    {
      question: 'After the AED delivers a shock, what should you do immediately?',
      options: [
        'Check for a pulse',
        'Resume CPR for 2 minutes',
        'Turn off the AED',
        'Deliver another shock',
      ],
      correctIndex: 1,
      explanation:
        'Immediately resume CPR for 2 minutes (approximately 5 cycles of 30:2) after any shock delivery. Do NOT pause to check the pulse right after the shock. Most patients do not immediately regain a perfusing rhythm after defibrillation, and the myocardium needs compressions to maintain coronary perfusion while it recovers. The AED will prompt re-analysis after 2 minutes.',
    },
    {
      question: 'Where should AED pads be placed on an adult patient?',
      options: [
        'Both pads on the left side of the chest',
        'Right pad below the right clavicle; left pad on the left side below the armpit',
        'Right pad on the right side of the abdomen; left pad on the left shoulder',
        'One pad on the chest and one pad on the right thigh',
      ],
      correctIndex: 1,
      explanation:
        'Standard anterolateral placement: the right pad goes below the right clavicle to the right of the sternum, and the left pad goes on the left side of the chest below the armpit (left mid-axillary line). This placement positions the heart between the two pads, allowing the defibrillation current to pass through the maximum amount of myocardium. Pads should be flat against dry, bare skin with no air pockets.',
    },
    {
      question: 'An 18-month-old child is in cardiac arrest. Pediatric AED pads are NOT available. What should you do?',
      options: [
        'Do not use the AED; perform CPR only',
        'Use adult pads and place them in an anterior-posterior position if they are too large',
        'Cut the adult pads in half',
        'Delay resuscitation until pediatric pads arrive',
      ],
      correctIndex: 1,
      explanation:
        'If pediatric pads or a dose attenuator are not available, use adult pads. Defibrillation with adult pads is far better than no defibrillation. If the pads are too large and risk touching or overlapping on the small chest, use anterior-posterior placement: one pad on the center of the chest (anterior) and one on the back between the shoulder blades (posterior). Never delay defibrillation because the ideal equipment is unavailable.',
    },

    // === Chain of Survival ===
    {
      question: 'What is the FIRST link in the adult out-of-hospital Chain of Survival?',
      options: [
        'Early defibrillation',
        'Early high-quality CPR',
        'Early recognition and activation of EMS',
        'Advanced life support',
      ],
      correctIndex: 2,
      explanation:
        'The first link in the adult Chain of Survival is early recognition of cardiac arrest and activation of the emergency medical system (calling 911). Without recognizing that someone is in cardiac arrest and calling for help, no subsequent links can be initiated. The full chain is: Recognition & Activation → CPR → Defibrillation → Advanced Care → Post-Arrest Care → Recovery.',
    },
    {
      question: 'Why does the pediatric Chain of Survival emphasize prevention as the first link rather than early recognition?',
      options: [
        'Because children rarely experience cardiac arrest',
        'Because pediatric arrests are usually respiratory in origin and many are preventable (drowning, choking, SIDS)',
        'Because AEDs cannot be used on children',
        'Because children always recover from cardiac arrest without intervention',
      ],
      correctIndex: 1,
      explanation:
        'Unlike adults, whose cardiac arrests are most commonly caused by primary cardiac events (VF/pVT), pediatric cardiac arrests are predominantly caused by respiratory failure or shock — conditions that are often preventable. Injury prevention (safe sleep practices, drowning prevention, choking hazard awareness, car seat use) is therefore the most impactful first link in the pediatric chain.',
    },

    // === Recognition of Cardiac Arrest ===
    {
      question: 'You find an unresponsive adult with occasional gasping breaths and no pulse. What should you do?',
      options: [
        'Place in the recovery position and monitor breathing',
        'Begin rescue breathing only (no compressions)',
        'Treat as cardiac arrest — begin CPR and activate EMS',
        'Wait 2 minutes to see if normal breathing returns',
      ],
      correctIndex: 2,
      explanation:
        'Agonal gasps are NOT effective breathing. They are irregular, labored, snoring-like sounds that occur in up to 40% of cardiac arrest victims in the first minutes. An unresponsive patient who is only gasping and has no pulse is in cardiac arrest and requires immediate CPR and EMS activation. Failure to recognize agonal gasps as a sign of cardiac arrest is one of the most common reasons bystanders delay CPR.',
    },
    {
      question: 'What is the maximum time allowed for a pulse check during BLS assessment?',
      options: [
        '5 seconds',
        '10 seconds',
        '15 seconds',
        '30 seconds',
      ],
      correctIndex: 1,
      explanation:
        'The pulse check should take no more than 10 seconds. If you cannot definitively feel a pulse within 10 seconds, assume the patient is pulseless and begin CPR. Prolonged pulse checks delay the start of compressions, and even trained healthcare providers have difficulty reliably detecting a pulse — studies show error rates of 10–40% within 10 seconds. When in doubt, start CPR.',
    },

    // === Two-Rescuer CPR ===
    {
      question: 'During two-rescuer CPR, how often should compressors switch roles?',
      options: [
        'Every 1 minute',
        'Every 2 minutes (approximately every 5 cycles of 30:2)',
        'Every 5 minutes',
        'Only when the compressor reports fatigue',
      ],
      correctIndex: 1,
      explanation:
        'Compressors should switch every 2 minutes (or every 5 cycles of 30:2). Research demonstrates that compression quality (depth and rate) degrades within 1–2 minutes of continuous compressions, even when the rescuer does not subjectively feel tired. The 2-minute AED analysis interval provides a natural and convenient switching point. The switch should be completed in less than 5 seconds to minimize interruptions.',
    },
    {
      question: 'In two-rescuer CPR, what is the primary role of the rescuer positioned at the patient\'s head?',
      options: [
        'Performing chest compressions',
        'Managing the airway and delivering ventilations',
        'Operating the AED',
        'Calling 911',
      ],
      correctIndex: 1,
      explanation:
        'In two-rescuer CPR, one rescuer (at the patient\'s side) delivers chest compressions while the other (at the patient\'s head) manages the airway and delivers ventilations using a bag-mask or mouth-to-mask device. The airway rescuer maintains head-tilt chin-lift (or jaw thrust), ensures a good mask seal, monitors for visible chest rise, and coordinates with the compressor\'s count.',
    },

    // === FBAO ===
    {
      question: 'A conscious 9-month-old infant is choking and cannot cough, cry, or breathe. What is the correct intervention?',
      options: [
        'Abdominal thrusts (Heimlich maneuver)',
        'Alternating 5 back slaps and 5 chest thrusts',
        'Blind finger sweep of the mouth',
        'Chest compressions only',
      ],
      correctIndex: 1,
      explanation:
        'For a conscious choking infant, deliver alternating cycles of 5 back slaps (with the infant face-down on your forearm, head lower than trunk) and 5 chest thrusts (with the infant face-up, using two fingers on the lower sternum). Abdominal thrusts (Heimlich maneuver) are NOT used in infants due to the risk of abdominal organ injury. Blind finger sweeps are contraindicated as they may push the object deeper into the airway.',
    },
    {
      question: 'A choking adult becomes unconscious during abdominal thrust attempts. What should you do FIRST?',
      options: [
        'Continue abdominal thrusts on the ground',
        'Lower the patient to the ground and begin CPR, looking for the object each time you open the airway',
        'Perform blind finger sweeps to remove the object',
        'Attempt rescue breathing immediately',
      ],
      correctIndex: 1,
      explanation:
        'When a choking victim becomes unconscious, lower them to the ground, activate EMS (if not done), and begin CPR starting with chest compressions. Each time you open the airway to deliver breaths, look in the mouth for the foreign body. If you see it, remove it. Chest compressions during CPR may generate enough force to dislodge the object. Do NOT perform blind finger sweeps — only remove an object you can see.',
    },

    // === Special Situations ===
    {
      question: 'In a drowning victim who is in cardiac arrest, what modification to standard BLS should be prioritized?',
      options: [
        'Use chest compressions only — skip ventilations',
        'Deliver 5 rescue breaths before beginning compressions',
        'Apply the AED before starting CPR',
        'Place the victim in the recovery position and wait for EMS',
      ],
      correctIndex: 1,
      explanation:
        'Drowning causes hypoxic cardiac arrest — the lungs are the primary problem. Early ventilations are critical to restore oxygenation. Trained rescuers should deliver 5 rescue breaths before beginning chest compressions. After the initial 5 breaths, continue standard 30:2 CPR. This differs from the typical C-A-B approach because the underlying cause is respiratory, not primary cardiac.',
    },
    {
      question: 'A patient is found unresponsive with pinpoint pupils, a respiratory rate of 4, and drug paraphernalia nearby. Naloxone (Narcan) is available. The patient has no palpable pulse. What is the correct course of action?',
      options: [
        'Administer naloxone and wait for the patient to wake up',
        'Perform standard BLS (CPR + AED) and administer naloxone; do not delay CPR for naloxone',
        'Only provide rescue breathing — chest compressions are unnecessary in opioid overdose',
        'Do not administer naloxone until advanced EMS arrives',
      ],
      correctIndex: 1,
      explanation:
        'If the patient is pulseless, they are in cardiac arrest and require full BLS including chest compressions and AED use. Naloxone should be administered (intranasal 4 mg or IM 0.4 mg) simultaneously, but it does NOT replace CPR. Naloxone reverses the respiratory depression caused by opioids, but it cannot restart a heart that has already arrested. Both interventions should happen concurrently — naloxone may help restore spontaneous breathing while CPR maintains perfusion.',
    },

    // === BLS Algorithm Sequence ===
    {
      question: 'In the BLS algorithm, after confirming that an adult patient is unresponsive and not breathing normally, what is the NEXT step?',
      options: [
        'Begin chest compressions immediately',
        'Activate EMS and send someone to get the AED',
        'Open the airway and deliver 2 rescue breaths',
        'Check the carotid pulse for 30 seconds',
      ],
      correctIndex: 1,
      explanation:
        'After confirming unresponsiveness and abnormal or absent breathing, the next step is to activate EMS (call 911 or direct a bystander to call) and send someone to retrieve the nearest AED. Then proceed to check the pulse (no more than 10 seconds). This follows the BLS sequence: Scene Safety → Check Responsiveness → Activate EMS/Get AED → Check Pulse → Begin CPR → AED. For a lone rescuer with an adult victim, calling 911 first ensures that defibrillation and advanced care are en route.',
    },
    {
      question: 'BLS guidelines recommend starting with chest compressions rather than ventilations (C-A-B instead of A-B-C). What is the primary rationale?',
      options: [
        'Rescue breaths are ineffective during cardiac arrest',
        'Compressions maintain coronary and cerebral perfusion immediately, while delays for airway positioning and breaths waste critical time',
        'Ventilations are only needed for pediatric patients',
        'The AED cannot analyze the rhythm until compressions have been started',
      ],
      correctIndex: 1,
      explanation:
        'The C-A-B (Compressions–Airway–Breathing) sequence was adopted because: (1) Chest compressions can begin within seconds, while positioning the airway and delivering breaths introduces delays of 30+ seconds. (2) In the first minutes of adult cardiac arrest, oxygen is still present in the blood — what is needed most urgently is circulation to deliver that oxygen to the brain and heart. (3) Studies showed that the A-B-C approach led to significant delays in the first compression, worsening outcomes.',
    },

    // === Additional Questions ===
    {
      question: 'What is the most important determinant of CPR quality, as measured by outcome studies?',
      options: [
        'Ventilation volume',
        'Chest compression fraction (the proportion of time spent performing compressions)',
        'The brand of AED used',
        'The number of rescuers present',
      ],
      correctIndex: 1,
      explanation:
        'Chest compression fraction (CCF) — the percentage of total resuscitation time during which chest compressions are being actively delivered — is the strongest modifiable predictor of survival. A CCF >60% is associated with improved outcomes, and >80% is the target. Every pause in compressions (for pulse checks, ventilations, AED analysis, intubation, or rescuer confusion) drops coronary perfusion pressure, which requires multiple subsequent compressions to rebuild.',
    },
    {
      question: 'During CPR, you notice the compressor is leaning on the chest between compressions. What is the primary consequence of this error?',
      options: [
        'Rib fractures',
        'Reduced venous return and coronary perfusion due to increased intrathoracic pressure',
        'Damage to the AED pads',
        'Gastric distension',
      ],
      correctIndex: 1,
      explanation:
        'Incomplete chest recoil ("leaning") prevents the chest from fully expanding between compressions. This keeps intrathoracic pressure elevated, which impedes venous return to the heart and reduces coronary perfusion by up to 30%. The heart cannot fill properly if it is not allowed to recoil fully. Rescuers should completely release pressure between compressions while keeping their hands in contact with the sternum.',
    },
  ],

  simulatorScenarios: [
    'bls_adult_vfib_arrest',
    'bls_adult_asystole',
    'bls_pediatric_arrest',
    'bls_choking_adult',
    'bls_drowning',
    'bls_opioid_overdose',
  ],

  millieScripts: [
    {
      trigger: 'cardiac_arrest_detected',
      text: 'Cardiac arrest detected. The patient is unresponsive with no pulse and no effective breathing. Activate the BLS algorithm now: ensure someone has called 911, send for the AED, and begin high-quality chest compressions immediately — push hard to at least 2 inches, push fast at 100–120 per minute, allow full recoil, and minimize interruptions. Every second without compressions costs the brain and heart perfusion.',
    },
    {
      trigger: 'vfib_detected',
      text: 'The monitor shows ventricular fibrillation — this is a shockable rhythm. VF is chaotic disorganized electrical activity with no effective cardiac contraction. The definitive treatment is defibrillation. Apply AED pads immediately: right pad below the right clavicle, left pad below the left axilla. Let the AED analyze, ensure everyone is clear, and deliver the shock. Then resume CPR immediately for 2 full minutes before the next analysis. Do not stop to check the pulse right after the shock.',
    },
    {
      trigger: 'asystole_detected',
      text: 'The monitor shows asystole — a flatline with no electrical activity. This is a non-shockable rhythm. Do NOT deliver a shock. Continue high-quality CPR with 30:2 compressions and ventilations. Focus on excellent compression quality: rate 100–120 per minute, depth at least 2 inches, full recoil. Consider reversible causes: the Hs and Ts — hypovolemia, hypoxia, hydrogen ion (acidosis), hypo/hyperkalemia, hypothermia, tension pneumothorax, tamponade, toxins, thrombosis pulmonary, thrombosis coronary. Continue until ACLS team arrives.',
    },
    {
      trigger: 'pea_detected',
      text: 'The monitor shows an organized electrical rhythm, but the patient has no palpable pulse — this is pulseless electrical activity, or PEA. PEA is non-shockable. The heart has electrical activity but cannot generate mechanical contraction. Continue CPR and search for reversible causes. Common causes include hypovolemia (give fluids), tension pneumothorax (needle decompress), cardiac tamponade, pulmonary embolism, and drug overdose. Treat the cause if identifiable while maintaining high-quality CPR.',
    },
    {
      trigger: 'rosc_achieved',
      text: 'Return of spontaneous circulation achieved! The patient now has a palpable pulse and signs of life. Transition to post-cardiac arrest care: place the patient in the recovery position if breathing adequately and no spinal injury is suspected. Monitor breathing, pulse, and SpO2 continuously. Be prepared to resume CPR immediately if the patient re-arrests — ROSC can be fragile in the first minutes. Keep the AED attached and pads in place. Support ventilations with bag-mask if breathing is inadequate.',
    },
    {
      trigger: 'cpr_quality_check',
      text: 'CPR quality check: verify your compression parameters. Rate should be 100–120 per minute — not too slow, not too fast. Depth should be at least 2 inches for an adult, about 2 inches for a child, and about 1.5 inches for an infant. Allow complete chest recoil between every compression — do not lean on the chest. Minimize all interruptions to less than 10 seconds. Your goal is a chest compression fraction above 80%. Remember, the quality of CPR is the single most important modifiable factor in survival.',
    },
    {
      trigger: 'aed_pad_placement',
      text: 'AED pad placement guidance: bare the patient\'s chest completely. Place the right pad just below the right clavicle, to the right of the sternum. Place the left pad on the left side of the chest, below the armpit at the mid-axillary line. Pads must be flat against dry skin with no air pockets or wrinkles. If the chest is wet, wipe it dry. If excessive chest hair prevents good contact, shave or pull the pads off quickly to remove hair, then apply new pads. For children under 8 years, use pediatric pads if available; if not, use adult pads in anterior-posterior position.',
    },
    {
      trigger: 'two_min_cpr_cycle',
      text: 'Two minutes of CPR completed — it is time to switch compressors and allow the AED to re-analyze the rhythm. Compressor fatigue begins within 1–2 minutes even if you do not feel tired, and compression quality degrades silently. Coordinate the switch: the new compressor takes position, the current compressor counts down — 5, 4, 3, 2, 1, switch — and the transition should take less than 5 seconds. The AED will now analyze the rhythm. Ensure nobody is touching the patient during analysis.',
    },
    {
      trigger: 'fbao_detected',
      text: 'Foreign body airway obstruction detected. For a conscious adult or child with severe obstruction — unable to speak, cough, or breathe — perform abdominal thrusts: stand behind the patient, fist above the navel, quick inward and upward thrusts. For an infant: alternate 5 back slaps and 5 chest thrusts. If the patient becomes unconscious, lower them to the ground and begin CPR. Each time you open the airway, look for the object. Remove it only if you can see it. Compressions may dislodge the obstruction.',
    },
    {
      trigger: 'compression_rate_low',
      text: 'Your compression rate has dropped below 100 per minute. This is too slow to generate adequate cardiac output and coronary perfusion pressure. Increase your rate — aim for 100 to 120 compressions per minute. Think of the beat of the song "Stayin\' Alive" by the Bee Gees — that tempo is approximately 104 beats per minute and serves as a useful mental metronome. Maintain this rate consistently.',
    },
    {
      trigger: 'compression_depth_shallow',
      text: 'Compressions are too shallow. You need to push deeper — at least 2 inches for an adult. Lock your elbows, position your shoulders directly over your hands, and use your body weight to drive each compression. Shallow compressions fail to generate the coronary perfusion pressure needed for ROSC. If you are fatigued, call for a compressor switch immediately — fatigue is the most common cause of degrading compression depth.',
    },
  ],
};
