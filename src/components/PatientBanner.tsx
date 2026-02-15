import useSimStore from '../store/useSimStore';
import { moassLabel } from '../engine/pdModel';

export default function PatientBanner() {
  const { patient, elapsedSeconds, moass, isRunning } = useSimStore();

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const moassColors: Record<number, string> = {
    5: 'bg-green-600',
    4: 'bg-yellow-500',
    3: 'bg-orange-500',
    2: 'bg-red-500',
    1: 'bg-red-700',
    0: 'bg-red-900',
  };

  return (
    <div className="bg-sim-panel border-b border-gray-700 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <h1 className="text-lg font-bold text-sim-accent">SedSim</h1>
        <div className="text-sm text-gray-300">
          <span className="font-medium">{patient.age}yo {patient.sex}</span>
          <span className="mx-2">|</span>
          <span>{patient.weight}kg / {patient.height}cm</span>
          <span className="mx-2">|</span>
          <span>ASA {patient.asa}</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* MOASS Badge */}
        <div className={`px-3 py-1 rounded-full text-sm font-bold ${moassColors[moass]}`}>
          MOASS {moass} - {moassLabel(moass)}
        </div>

        {/* Timer */}
        <div className="text-2xl font-mono font-bold">
          {timeStr}
        </div>

        {/* Status indicator */}
        <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
      </div>
    </div>
  );
}