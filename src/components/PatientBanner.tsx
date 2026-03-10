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
    <header className="bg-sim-panel border-b border-gray-700 px-4 py-2 flex items-center justify-between" role="banner" aria-label="Patient information banner">
      <div className="flex items-center gap-6">
        <h1 className="text-lg font-bold text-sim-accent">{t('patientBanner.title')}</h1>
        <div className="text-sm text-gray-300" aria-label={`Patient: ${patient.age} year old ${patient.sex}, ${patient.weight}kg / ${patient.height}cm, ASA ${patient.asa}`}>
          <span className="font-medium">{patient.age}yo {patient.sex}</span>
          <span className="mx-2" aria-hidden="true">|</span>
          <span>{patient.weight}kg / {patient.height}cm</span>
          <span className="mx-2" aria-hidden="true">|</span>
          <span>{t('patientBanner.asa', { asa: patient.asa })}</span>
          {trueNorth.isLocked && (
            <span className="ml-2 text-xs text-cyan-400 font-semibold">🔒 {trueNorth.label}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* MOASS Badge */}
        <div
          className={`px-3 py-1 rounded-full text-sm font-bold ${moassColors[moass]}`}
          role="status"
          aria-live="polite"
          aria-label={`Sedation depth: MOASS level ${moass}, ${moassLabel(moass)}`}
        >
          {t('patientBanner.moass', { level: moass, label: moassLabel(moass) })}
        </div>

        {/* Timer */}
        <div
          className="text-2xl font-mono font-bold"
          aria-label={`Elapsed simulation time: ${timeStr}`}
          aria-live="off"
        >
          {timeStr}
        </div>

        {/* Language Selector */}
        <LanguageSelector />

        {/* Status indicator */}
        <div
          className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}
          role="status"
          aria-label={isRunning ? 'Simulation running' : 'Simulation paused'}
        />
      </div>
    </header>
  );
}
