import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import useSimStore from '../store/useSimStore';
import { moassLabel } from '../engine/pdModel';
import LanguageSelector from './LanguageSelector';

export default function PatientBanner() {
  const { t } = useTranslation();
  const { trueNorth, elapsedSeconds, moass, isRunning } = useSimStore(
    useShallow(s => ({
      trueNorth: s.trueNorth,
      elapsedSeconds: s.elapsedSeconds,
      moass: s.moass,
      isRunning: s.isRunning,
    }))
  );
  const { patient } = trueNorth;

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
    <header className="px-3 py-2 flex items-center justify-between min-w-0" role="banner" aria-label="Patient information banner">
      <div className="flex items-center gap-3 min-w-0 overflow-hidden">
        <h1 className="text-base font-bold text-sim-accent shrink-0">{t('patientBanner.title')}</h1>
        <div className="text-xs text-gray-300 hidden sm:flex items-center gap-1 truncate" aria-label={`Patient: ${patient.age} year old ${patient.sex}, ${patient.weight}kg / ${patient.height}cm, ASA ${patient.asa}`}>
          <span className="font-medium whitespace-nowrap">{patient.age}yo {patient.sex}</span>
          <span className="mx-1 text-gray-600" aria-hidden="true">|</span>
          <span className="whitespace-nowrap">{patient.weight}kg / {patient.height}cm</span>
          <span className="mx-1 text-gray-600 hidden md:inline" aria-hidden="true">|</span>
          <span className="hidden md:inline">{t('patientBanner.asa', { asa: patient.asa })}</span>
          {trueNorth.isLocked && (
            <span className="ml-1 text-xs text-cyan-400 font-semibold hidden md:inline">🔒 {trueNorth.label}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* MOASS Badge */}
        <div
          className={`px-2 py-0.5 rounded-full text-xs font-bold ${moassColors[moass]}`}
          role="status"
          aria-live="polite"
          aria-label={`Sedation depth: MOASS level ${moass}, ${moassLabel(moass)}`}
        >
          <span className="hidden sm:inline">MOASS </span>{moass}<span className="hidden sm:inline"> - {moassLabel(moass)}</span>
        </div>

        {/* Timer */}
        <div
          className="text-xl font-mono font-bold"
          aria-label={`Elapsed simulation time: ${timeStr}`}
          aria-live="off"
        >
          {timeStr}
        </div>

        {/* Language Selector */}
        <LanguageSelector />

        {/* Status indicator */}
        <div
          className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}
          role="status"
          aria-label={isRunning ? 'Simulation running' : 'Simulation paused'}
        />
      </div>
    </header>
  );
}
