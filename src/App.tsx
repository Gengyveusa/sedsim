import { useEffect } from 'react';
import useSimStore from './store/useSimStore';
import PatientBanner from './components/PatientBanner';
import PatientSelector from './components/PatientSelector';
import DrugPanel from './components/DrugPanel';
import MonitorPanel from './components/MonitorPanel';
import TrendGraph from './components/TrendGraph';
import ControlBar from './components/ControlBar';
import EventLog from './components/EventLog';

export default function App() {
  const { isRunning, speedMultiplier, tick, trendData } = useSimStore();

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

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Drug Controls */}
        <div className="w-80 border-r border-gray-700 overflow-y-auto p-2 space-y-2">
          <PatientSelector />
          <DrugPanel />
        </div>

        {/* Center - Monitor & Trends */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <MonitorPanel vitals={useSimStore.getState().vitals} history={trendData} />
          <div className="flex-1 overflow-hidden p-2">
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
  );
}
