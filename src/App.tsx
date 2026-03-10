import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import useSimStore from './store/useSimStore';
import useAIStore from './store/useAIStore';
import useLMSStore from './store/useLMSStore';
import PatientBanner from './components/PatientBanner';
import PatientSelector from './components/PatientSelector';
import DrugPanel from './components/DrugPanel';
import InterventionPanel from './components/InterventionPanel';
import MonitorPanel from './components/MonitorPanel';
import LocalAnesthPanel from './components/LocalAnesthPanel';
import EmergencyDrugsPanel from './components/EmergencyDrugsPanel';
import IVFluidsPanel from './components/IVFluidsPanel';
import TrendGraph from './components/TrendGraph';
import ControlBar from './components/ControlBar';
import EventLog from './components/EventLog';
import SedationGauge from './components/SedationGauge';
import AEDPanel from './components/AEDPanel';
import SimMasterOverlay from './components/SimMasterOverlay';
import { Dashboard } from './components/Dashboard';
import OfflineBanner from './components/OfflineBanner';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import LMSPanel from './components/LMSPanel';
import { usePerformanceObserver } from './hooks/usePerformanceObserver';

export default function App() {
  const { t } = useTranslation();

  // Dev-mode performance monitoring
  usePerformanceObserver();

  // Narrow subscription: only the fields needed for the tick loop and layout.
  const { isRunning, speedMultiplier, tick } = useSimStore(
    useShallow(s => ({ isRunning: s.isRunning, speedMultiplier: s.speedMultiplier, tick: s.tick }))
  );
  const trendData = useSimStore(s => s.trendData);
  const vitals = useSimStore(s => s.vitals);
  const [trendsExpanded, setTrendsExpanded] = useState(false);
  const [airwayExpanded, setAirwayExpanded] = useState(false);
  const simMasterEnabled = useAIStore(s => s.simMasterEnabled);
  const { initScorm, terminateScorm } = useLMSStore();

  // Initialise SCORM session on mount; terminate on unmount
  useEffect(() => {
    initScorm();
    return () => terminateScorm();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Memoize the vitals history array so MonitorPanel's memo check stays stable.
  const vitalsHistory = useMemo(() => trendData.map(t => t.vitals), [trendData]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const ticks = Math.round(speedMultiplier);
      for (let i = 0; i < ticks; i++) {
        tick();
      }
    }, 1000 / (speedMultiplier / Math.round(speedMultiplier) || 1));
    return () => clearInterval(interval);
  }, [isRunning, speedMultiplier, tick]);

  return (
    <>
      {/* Skip navigation for keyboard users */}
      <a href="#sim-main" className="skip-link">Skip to main content</a>

      <div className="h-screen flex flex-col bg-sim-bg text-white">
        {/* Offline Banner */}
        <OfflineBanner />
        {/* Top Banner */}
        <PatientBanner />

        {/* Main Content */}
        <div id="sim-main" className="flex-1 flex overflow-hidden" role="main" aria-label="Sedation simulator workspace">
          {/* Left Panel - Drug Controls */}
          <div className="w-80 border-r border-gray-700 overflow-y-auto p-2 space-y-2" role="complementary" aria-label="Drug and intervention controls">
            <PatientSelector />
            <DrugPanel />
            <LocalAnesthPanel />
            <EmergencyDrugsPanel />
            <IVFluidsPanel />

            {/* SimMaster Panel */}
            <div className="border border-gray-700 rounded p-3 bg-gray-800/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{"\ud83c\udfaf"}</span>
                <span className="text-sm font-bold text-white">{t('app.simmaster.title')}</span>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                {t('app.simmaster.description')}
              </p>
              <button
                onClick={() => {
                  const store = useAIStore.getState();
                  store.setSimMasterEnabled(!store.simMasterEnabled);
                }}
                aria-label={simMasterEnabled ? 'Disable SimMaster AI observer' : 'Enable SimMaster AI observer'}
                aria-pressed={simMasterEnabled}
                className={`px-4 py-2 rounded text-white text-sm font-bold transition-colors w-full ${
                  simMasterEnabled
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-purple-600 hover:bg-purple-500'
                }`}
              >
                {simMasterEnabled ? t('app.simmaster.disable') : t('app.simmaster.enable')}
              </button>
              {simMasterEnabled && (
                <p className="text-[10px] text-green-400 mt-2 animate-pulse">
                  {t('app.simmaster.active')}
                </p>
              )}
            </div>
          </div>

          {/* Center - Hero Gauge + Monitor */}
          <div className="flex-1 flex flex-col overflow-hidden relative" role="region" aria-label="Patient monitor and sedation gauge">
            {/* Compact vitals monitor strip at top */}
            <MonitorPanel vitals={vitals} history={vitalsHistory} />
            {/* HERO: Giant Sedation Gauge - takes up most of center */}
            <div className="flex-1 overflow-y-auto">
              <SedationGauge />
              {/* AED Panel — bottom of center column */}
              <div className="px-2 pb-2">
                <AEDPanel />
              </div>
            </div>
          </div>

          {/* Right Sidebar - Collapsible Intervention Panel */}
          <div className="flex flex-row">
            {!airwayExpanded && (
              <button
                onClick={() => setAirwayExpanded(true)}
                className="h-full w-10 flex items-center justify-center bg-gray-800/60 hover:bg-gray-700/80 transition-colors group"
                title={t('app.simmaster.expandAirway')}
                aria-label="Show Airway and O₂ controls"
                aria-expanded={false}
                aria-controls="airway-panel"
              >
                <span className="text-xs text-gray-400 group-hover:text-cyan-400 whitespace-nowrap tracking-wider uppercase" style={{ writingMode: 'vertical-rl' as const, textOrientation: 'mixed' as const }}>{t('app.simmaster.airwayLabel')}</span>
              </button>
            )}
            {airwayExpanded && (
              <div id="airway-panel" className="flex flex-col h-full bg-sim-panel" role="region" aria-label="Airway and O₂ controls">
                <div className="flex items-center justify-between px-2 py-1 border-b border-gray-700">
                  <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">{t('app.simmaster.airwayTitle')}</span>
                  <button
                    onClick={() => setAirwayExpanded(false)}
                    className="text-gray-400 hover:text-white text-sm px-1"
                    title={t('app.simmaster.collapseAirway')}
                    aria-label="Collapse Airway and O₂ panel"
                    aria-expanded={true}
                    aria-controls="airway-panel"
                  >
                    &laquo;
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <InterventionPanel />
                </div>
              </div>
            )}
          </div>

          {/* Right side: LMS Panel + Event Log + Collapsible Trends */}
          <div className="flex flex-row" role="complementary" aria-label="Trends and event log">
            {/* LMS / xAPI / SCORM Panel */}
            <LMSPanel />
            {/* Trends Panel - collapsible side drawer */}
            <div
              className={`transition-all duration-300 ease-in-out border-l border-gray-700 overflow-hidden flex flex-col ${
                trendsExpanded ? 'w-80' : 'w-10'
              }`}
            >
              {/* Collapsed: vertical tab button */}
              {!trendsExpanded && (
                <button
                  onClick={() => setTrendsExpanded(true)}
                  className="h-full w-10 flex items-center justify-center bg-gray-800/60 hover:bg-gray-700/80 transition-colors group"
                  title={t('app.simmaster.expandTrends')}
                  aria-label="Show Trend Graphs panel"
                  aria-expanded={false}
                  aria-controls="trends-panel"
                >
                  <span className="text-xs text-gray-400 group-hover:text-cyan-400 whitespace-nowrap tracking-wider uppercase" style={{ writingMode: 'vertical-rl' as const, textOrientation: 'mixed' as const }}>{t('app.simmaster.trendsLabel')}</span>
                </button>
              )}
              {/* Expanded: full trend panel */}
              {trendsExpanded && (
                <div id="trends-panel" className="flex flex-col h-full bg-sim-panel" role="region" aria-label="Trend graphs">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-gray-700">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">{t('app.simmaster.trendsTitle')}</span>
                    <button
                      onClick={() => setTrendsExpanded(false)}
                      className="text-gray-400 hover:text-white text-sm px-1"
                      title={t('app.simmaster.collapseTrends')}
                      aria-label="Collapse Trend Graphs panel"
                      aria-expanded={true}
                      aria-controls="trends-panel"
                    >
                      &raquo;
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <TrendGraph />
                  </div>
                </div>
              )}
            </div>

            {/* Event Log */}
            <div className="w-72 border-l border-gray-700 overflow-y-auto">
              <EventLog />
            </div>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <ControlBar />
      </div>
      {/* AI Dashboard */}
      <div className="fixed bottom-20 right-4 z-40">
        <Dashboard />
      </div>
      <SimMasterOverlay enabled={simMasterEnabled} />
      <PWAInstallPrompt />
    </>
  );
}
