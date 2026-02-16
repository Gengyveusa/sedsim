import useSimStore from '../store/useSimStore';
import { PATIENT_ARCHETYPES } from '../engine/physiology';

export default function PatientSelector() {
  const { patient, availableArchetypes, selectPatient, isRunning } = useSimStore();

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
      <h3 className="text-sm font-bold text-gray-300 mb-2">PATIENT</h3>
      
      <div className="space-y-2">
        <select
          value={findArchetypeKey(patient)}
          onChange={(e) => selectPatient(e.target.value)}
          disabled={isRunning}
          className="w-full px-2 py-1 bg-gray-800 text-gray-100 rounded border border-gray-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {availableArchetypes.map((key) => {
            const archetype = PATIENT_ARCHETYPES[key];
            return (
              <option key={key} value={key}>
                {formatArchetypeName(key)} ({archetype.age}y, {archetype.weight}kg, ASA {archetype.asa})
              </option>
            );
          })}
        </select>

        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="text-gray-400">Age:</div>
          <div className="text-gray-100">{patient.age} years</div>
          
          <div className="text-gray-400">Weight:</div>
          <div className="text-gray-100">{patient.weight} kg</div>
          
          <div className="text-gray-400">Height:</div>
          <div className="text-gray-100">{patient.height} cm</div>
          
          <div className="text-gray-400">Sex:</div>
          <div className="text-gray-100">{patient.sex}</div>
          
          <div className="text-gray-400">ASA:</div>
          <div className="text-gray-100">{patient.asa}</div>
          
          {patient.mallampati && (
            <>
              <div className="text-gray-400">Mallampati:</div>
              <div className="text-gray-100">{patient.mallampati}</div>
            </>
          )}
          
          {patient.osa && (
            <>
              <div className="text-gray-400">OSA:</div>
              <div className="text-yellow-400">Yes</div>
            </>
          )}
          
          {patient.copd && (
            <>
              <div className="text-gray-400">COPD:</div>
              <div className="text-yellow-400">Yes</div>
            </>
          )}
          
          {patient.hepaticImpairment && (
            <>
              <div className="text-gray-400">Hepatic:</div>
              <div className="text-yellow-400">Impaired</div>
            </>
          )}
          
          {patient.renalImpairment && (
            <>
              <div className="text-gray-400">Renal:</div>
              <div className="text-yellow-400">Impaired</div>
            </>
          )}
          
          <div className="text-gray-400">Sensitivity:</div>
          <div className="text-gray-100">{patient.drugSensitivity}x</div>
        </div>
      </div>
    </div>
  );
}

function findArchetypeKey(patient: typeof PATIENT_ARCHETYPES[keyof typeof PATIENT_ARCHETYPES]): string {
  for (const [key, archetype] of Object.entries(PATIENT_ARCHETYPES)) {
    if (
      archetype.age === patient.age &&
      archetype.weight === patient.weight &&
      archetype.height === patient.height
    ) {
      return key;
    }
  }
  return 'healthy_adult';
}

const ABBREVIATIONS: Record<string, string> = { hcm: 'HCM', dcm: 'DCM', osa: 'OSA' };

function formatArchetypeName(key: string): string {
  return key
    .split('_')
    .map(word => ABBREVIATIONS[word] || (word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}
