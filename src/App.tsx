import { useEffect } from 'react';
import { useSimStore } from './store/useSimStore';
import { PatientBanner } from './components/PatientBanner';
import { VitalsPanel } from './components/VitalsPanel';
import { DrugPanel } from './components/DrugPanel';
import { TrendGraph } from './components/TrendGraph';
import { ControlBar } from './components/ControlBar';
import { EventLog } from './components/EventLog';

export default function App() {
  const { isRunning, tick } = useSimStore();

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      tick();
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, tick]);

  return (
    <div className="h-screen flex flex-col bg-sim-bg text-white">
      {/* Top Banner */}
      <PatientBanner />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Drug Controls */}
        <div className="w-80 border-r border-gray-700 overflow-y-auto">
          <DrugPanel />
        </div>

        {/* Center - Vitals & Trends */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <VitalsPanel />
          <TrendGraph />
        </div>

        {/* Right Panel - Event Log */}
        <div className="w-72 border-l border-gray-700 overflow-y-auto">
          <EventLog />
        </div>
      </div>

      {/* Bottom Control Bar */}
      <ControlBar />
    </div>
  );
}