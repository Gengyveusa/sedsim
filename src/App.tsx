import { useEffect, useState } from 'react';
import useSimStore from './store/useSimStore';
import PatientBanner from './components/PatientBanner';
import PatientSelector from './components/PatientSelector';
import DrugPanel from './components/DrugPanel';
import InterventionPanel from './components/InterventionPanel';
import MonitorPanel from './components/MonitorPanel';
import LocalAnesthPanel from './components/LocalAnesthPanel';
import TrendGraph from './components/TrendGraph';
import ControlBar from './components/ControlBar';
import EventLog from './components/EventLog';
import { TutorialMode } from './components/TutorialMode';

export default function App() {
  const { isRunning, speedMultiplier, tick, trendData } = useSimStore();
    const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      // Call tick multiple times for speed multiplier
      const ticks = Math.round(speedMultiplier);
      for (let i = 0; i < ticks; i++) {
        tick();
      }
    }, 1000 / (speedMultiplier / Math.round(speedMultiplier) || 1));
    return () => clearInterval(interval);
  }, [isRunning, speedMultiplier, tick]);

  return (
    <div className="h-screen flex flex-col bg-sim-bg text-white">
      {/* Top Banner */}
      <PatientBanner />
            <button
        onClick={() => setShowTutorial(true)}
        className="absolute top-4 right-4 z-10 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg transition-colors flex items-center gap-2"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        Tutorial
      </button>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Drug Controls */}
        <div className="w-80 border-r border-gray-700 overflow-y-auto p-2 space-y-2">
          <PatientSelector />
          <DrugPanel />
                    <InterventionPanel />
                      <LocalAnesthPanel />
        </div>

        {/* Center - Monitor & Trends */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <MonitorPanel vitals={useSimStore.getState().vitals} history={trendData.map(t => t.vitals)} />
          <div className="flex-1 min-h-0 overflow-auto p-2">
            <TrendGraph />
          </div>
        </div>

        {/* Right Panel - Event Log */}
        <div className="w-72 border-l border-gray-700 overflow-y-auto">
          <EventLog />
        </div>
      </div>

      {/* Bottom Control Bar */}
      <ControlBar />
    </div>

      {showTutorial && (
        <TutorialMode
          onClose={() => setShowTutorial(false)}
          onSelectScenario={(scenario) => {
            // TODO: Apply scenario to simulation
            setShowTutorial(false);
          }}
        />
      )}
