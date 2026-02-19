/**
 * Digital Twin Engine
 * Creates a patient-specific physiological model that adapts
 * to individual drug responses and vital sign patterns.
 * Integrates with existing PK/PD engine in src/engine/
 */

export interface PatientProfile {
  age: number;
  weight: number;
  height: number;
  gender: 'male' | 'female';
  asa: number;
  comorbidities: string[];
  allergies: string[];
  baselineVitals: {
    hr: number;
    sbp: number;
    dbp: number;
    spo2: number;
    rr: number;
    etco2: number;
  };
}

export interface TwinState {
  compartments: {
    central: number;
    peripheral1: number;
    peripheral2: number;
    effect: number;
  };
  vitals: {
    hr: number;
    sbp: number;
    dbp: number;
    map: number;
    spo2: number;
    rr: number;
    etco2: number;
    bis: number;
  };
  drugConcentrations: Record<string, number>;
  physiologyState: {
    cardiacOutput: number;
    svr: number;
    respiratoryDrive: number;
    consciousnessLevel: number;
  };
}

export interface DrugBolus {
  drug: string;
  dose: number;
  unit: string;
  route: 'iv' | 'oral' | 'im' | 'inhalation';
  timeStamp: number;
}

export class DigitalTwin {
  private profile: PatientProfile;
  private state: TwinState;
  private drugHistory: DrugBolus[] = [];
  private _tickInterval: number = 1000; // ms
  private elapsedTime: number = 0;

  constructor(profile: PatientProfile) {
    this.profile = profile;
    this.state = this.initializeState(profile);
  }

  private initializeState(profile: PatientProfile): TwinState {
    return {
      compartments: {
        central: 0,
        peripheral1: 0,
        peripheral2: 0,
        effect: 0,
      },
      vitals: {
        hr: profile.baselineVitals.hr,
        sbp: profile.baselineVitals.sbp,
        dbp: profile.baselineVitals.dbp,
        map: Math.round(
          profile.baselineVitals.dbp +
            (profile.baselineVitals.sbp - profile.baselineVitals.dbp) / 3
        ),
        spo2: profile.baselineVitals.spo2,
        rr: profile.baselineVitals.rr,
        etco2: profile.baselineVitals.etco2,
        bis: 97,
      },
      drugConcentrations: {},
      physiologyState: {
        cardiacOutput: this.estimateCardiacOutput(profile),
        svr: 1200,
        respiratoryDrive: 1.0,
        consciousnessLevel: 1.0,
      },
    };
  }

  private estimateCardiacOutput(profile: PatientProfile): number {
    // Simplified CO estimation based on patient factors
    const baseCO = 5.0; // L/min
    const ageFactor = profile.age > 65 ? 0.85 : 1.0;
    const weightFactor = profile.weight / 70;
    return baseCO * ageFactor * weightFactor;
  }

  administerDrug(bolus: DrugBolus): void {
    this.drugHistory.push(bolus);
    const concentration = this.calculateInitialConcentration(bolus);
    this.state.drugConcentrations[bolus.drug] =
      (this.state.drugConcentrations[bolus.drug] || 0) + concentration;
  }

  private calculateInitialConcentration(bolus: DrugBolus): number {
    // Volume of distribution estimation
    const vd = this.profile.weight * 0.15; // simplified
    return bolus.dose / vd;
  }

  tick(deltaMs: number): TwinState {
    this.elapsedTime += deltaMs;
    this.updateCompartments(deltaMs);
    this.updateVitals();
    return { ...this.state };
  }

  private updateCompartments(deltaMs: number): void {
    const dt = deltaMs / 1000 / 60; // convert to minutes
    // Three-compartment PK model update
    for (const [_drug, conc] of Object.entries(
      this.state.drugConcentrations
    )) {
      const ke = this.getDrugParam(drug, 'ke');
      const newConc = conc * Math.exp(-ke * dt);
      this.state.drugConcentrations[drug] = newConc;
      // Update effect site
      this.state.compartments.effect +=
        (newConc - this.state.compartments.effect) * 0.1 * dt;
    }
  }

  private getDrugParam(
    drug: string,
    param: 'ke' | 'k12' | 'k21' | 'k13' | 'k31'
  ): number {
    // Default PK parameters (can be extended per drug)
    const defaults: Record<string, number> = {
      ke: 0.1,
      k12: 0.05,
      k21: 0.03,
      k13: 0.02,
      k31: 0.01,
    };
    return defaults[param] || 0.1;
  }

  private updateVitals(): void {
    const totalEffect = Object.values(this.state.drugConcentrations).reduce(
      (sum, c) => sum + c,
      0
    );
    const depression = Math.min(totalEffect * 0.1, 0.6);

    this.state.vitals.hr = Math.round(
      this.profile.baselineVitals.hr * (1 - depression * 0.3) +
        (Math.random() - 0.5) * 2
    );
    this.state.vitals.sbp = Math.round(
      this.profile.baselineVitals.sbp * (1 - depression * 0.4) +
        (Math.random() - 0.5) * 3
    );
    this.state.vitals.dbp = Math.round(
      this.profile.baselineVitals.dbp * (1 - depression * 0.3) +
        (Math.random() - 0.5) * 2
    );
    this.state.vitals.map = Math.round(
      this.state.vitals.dbp +
        (this.state.vitals.sbp - this.state.vitals.dbp) / 3
    );
    this.state.vitals.spo2 = Math.min(
      100,
      Math.max(
        85,
        Math.round(
          this.profile.baselineVitals.spo2 * (1 - depression * 0.1) +
            (Math.random() - 0.5)
        )
      )
    );
    this.state.vitals.rr = Math.max(
      4,
      Math.round(
        this.profile.baselineVitals.rr * (1 - depression * 0.5) +
          (Math.random() - 0.5)
      )
    );
    this.state.vitals.bis = Math.max(
      20,
      Math.min(98, Math.round(97 - totalEffect * 15 + (Math.random() - 0.5) * 3))
    );
    this.state.vitals.etco2 = Math.round(
      this.profile.baselineVitals.etco2 * (1 + depression * 0.2) +
        (Math.random() - 0.5) * 2
    );

    // Update physiology state
    this.state.physiologyState.consciousnessLevel = Math.max(
      0,
      1 - depression
    );
    this.state.physiologyState.respiratoryDrive = Math.max(
      0.2,
      1 - depression * 0.7
    );
  }

  getState(): TwinState {
    return { ...this.state };
  }

  getProfile(): PatientProfile {
    return { ...this.profile };
  }

  getElapsedTime(): number {
    return this.elapsedTime;
  }

  getDrugHistory(): DrugBolus[] {
    return [...this.drugHistory];
  }
}
