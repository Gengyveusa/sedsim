// src/components/SimMasterOverlay.tsx
// Beautiful floating overlay for SimMaster v2 - displays real-time
// vital sign assessments with color-coded status indicators and
// clinical observations pointing to specific UI regions.

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  SimMasterAnnotation,
  SCREEN_REGIONS,
  generateObservation,
  assessAllVitals,
  hasSignificantChange,
  VitalAssessment,
  ClinicalStatus,
} from '../ai/simMaster';
import useSimStore from '../store/useSimStore';

interface SimMasterOverlayProps {
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Status colors and icons
// ---------------------------------------------------------------------------
const STATUS_CONFIG: Record<ClinicalStatus, {
  bg: string; border: string; text: string; dot: string; glow: string; icon: string;
}> = {
  normal:   { bg: 'bg-emerald-950/80', border: 'border-emerald-500/60', text: 'text-emerald-300', dot: 'bg-emerald-400', glow: 'shadow-emerald-500/20', icon: String.fromCodePoint(0x2713) },
  warning:  { bg: 'bg-amber-950/80',   border: 'border-amber-500/60',   text: 'text-amber-300',   dot: 'bg-amber-400',   glow: 'shadow-amber-500/30',   icon: String.fromCodePoint(0x26A0) },
  danger:   { bg: 'bg-red-950/80',     border: 'border-red-500/60',     text: 'text-red-300',     dot: 'bg-red-500',     glow: 'shadow-red-500/40',     icon: String.fromCodePoint(0x2716) },
  critical: { bg: 'bg-red-950/90',     border: 'border-red-400',        text: 'text-red-200',     dot: 'bg-red-400',     glow: 'shadow-red-500/60',     icon: String.fromCodePoint(0x203C) },
};

const SEVERITY_STYLES: Record<string, {
  bg: string; border: string; text: string; headerBg: string; glow: string;
}> = {
  info:    { bg: 'bg-slate-900/95', border: 'border-cyan-500/50',  text: 'text-cyan-200',  headerBg: 'bg-cyan-900/60',  glow: 'shadow-cyan-500/20' },
  warning: { bg: 'bg-slate-900/95', border: 'border-amber-500/50', text: 'text-amber-200', headerBg: 'bg-amber-900/60', glow: 'shadow-amber-500/30' },
  danger:  { bg: 'bg-slate-900/95', border: 'border-red-500/60',   text: 'text-red-200',   headerBg: 'bg-red-900/60',   glow: 'shadow-red-500/40' },
};

// ---------------------------------------------------------------------------
// Vital Pill component
// ---------------------------------------------------------------------------
const VitalPill: React.FC<{ a: VitalAssessment }> = ({ a }) => {
  const c = STATUS_CONFIG[a.status];
  const pulse = a.status === 'critical' || a.status === 'danger' ? 'animate-pulse' : '';
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${c.border} ${c.bg} ${pulse}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot} inline-block flex-shrink-0`} />
      <span className={`text-xs font-bold ${c.text}`}>{a.label}</span>
      <span className="text-xs text-gray-400">{a.value}{a.unit}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const SimMasterOverlay: React.FC<SimMasterOverlayProps> = ({ enabled }) => {
  const [annotation, setAnnotation] = useState<SimMasterAnnotation | null>(null);
  const [assessments, setAssessments] = useState<VitalAssessment[]>([]);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const simState = useSimStore((s) => ({
    vitals: s.vitals,
    moass: s.moass,
    eegState: s.eegState,
    pkStates: s.pkStates,
    isRunning: s.isRunning,
  }));

  // Find target DOM element
  const updateTargetPosition = useCallback((targetId: string) => {
    const region = SCREEN_REGIONS[targetId];
    if (!region) return;
    const el = document.querySelector(region.selector);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    }
  }, []);

  // Determine overall status
  const overallStatus = useMemo(() => {
    if (assessments.some(a => a.status === 'critical')) return 'critical';
    if (assessments.some(a => a.status === 'danger')) return 'danger';
    if (assessments.some(a => a.status === 'warning')) return 'warning';
    return 'normal';
  }, [assessments]);

  // Proactive evaluation loop - runs every 3 seconds, fully offline
  useEffect(() => {
    if (!enabled || !simState.isRunning) {
      setAnnotation(null);
      setAssessments([]);
      setIsVisible(false);
      return;
    }

    const evaluate = () => {
      const snapshot = {
        vitals: simState.vitals,
        moass: simState.moass,
        eeg: simState.eegState ?? undefined,
        pkStates: simState.pkStates,
      };

      // Always update vital assessments
      const allVitals = assessAllVitals(
        simState.vitals,
        simState.moass,
        simState.eegState ?? undefined,
        simState.pkStates
      );
      setAssessments(allVitals);

      // Only update annotation on significant change
      if (hasSignificantChange(snapshot)) {
        const obs = generateObservation(
          simState.vitals,
          simState.moass,
          simState.eegState ?? undefined,
          simState.pkStates
        );
        setAnnotation(obs);
        updateTargetPosition(obs.target);
        setIsVisible(true);

        // Auto-cycle annotations every 12 seconds
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => setAnnotation(null), 400);
        }, 12000);
      }
    };

    // Run immediately
    evaluate();
    const interval = setInterval(evaluate, 3000);
    return () => {
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, simState, updateTargetPosition]);

  // Update position on resize
  useEffect(() => {
    if (!annotation) return;
    const handleResize = () => updateTargetPosition(annotation.target);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [annotation, updateTargetPosition]);

  if (!enabled || !simState.isRunning) return null;

  const sev = annotation ? SEVERITY_STYLES[annotation.severity] ?? SEVERITY_STYLES.info : SEVERITY_STYLES.info;
  const statusColor = STATUS_CONFIG[overallStatus];

  // Highlight ring around target element
  const highlightStyle: React.CSSProperties | null =
    targetRect && annotation && isVisible
      ? {
          position: 'fixed',
          left: targetRect.left - 4,
          top: targetRect.top - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
          zIndex: 9998,
          pointerEvents: 'none' as const,
          borderRadius: 8,
          opacity: 1,
          transition: 'all 0.4s ease',
        }
      : null;

  return (
    <>
      {/* Highlight ring around target */}
      {highlightStyle && (
        <div
          style={highlightStyle}
          className={`border-2 ${
            annotation?.severity === 'danger' ? 'border-red-500 simmaster-pulse-ring' : 'border-amber-400 simmaster-glow-ring'
          }`}
        />
      )}

      {/* Main SimMaster panel - bottom right */}
      <div className="fixed bottom-16 right-2 z-[9999] pointer-events-auto" style={{ maxWidth: 320 }}>

        {/* Collapsed state - just a status orb */}
        {!isExpanded && (
          <div
            onClick={() => setIsExpanded(true)}
            className={`w-12 h-12 rounded-full ${statusColor.bg} border-2 ${statusColor.border} flex items-center justify-center shadow-lg ${statusColor.glow} hover:scale-110 transition-transform cursor-pointer`}
            title="Expand SimMaster"
          >
            <span className="text-lg">{statusColor.icon}</span>
          </div>
        )}

        {/* Expanded panel */}
        {isExpanded && (
          <div className={`${sev.bg} border ${sev.border} rounded-xl shadow-2xl ${sev.glow} overflow-hidden`}>

            {/* Header */}
            <div className={`flex items-center justify-between px-3 py-2 ${sev.headerBg}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${statusColor.dot} ${overallStatus !== 'normal' ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-bold text-white">SimMaster</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}>
                  {overallStatus.toUpperCase()}
                </span>
              </div>
              <span className="text-gray-400 text-xs">{String.fromCodePoint(0x2014)}</span>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-500 hover:text-white text-sm leading-none px-1 cursor-pointer"
                title="Minimize"
              >
                {String.fromCodePoint(0x2014)}
              </button>
            </div>

            {/* Vital sign pills */}
            {assessments.length > 0 && (
              <div className="flex flex-wrap gap-1 px-3 py-2">
                {assessments.map((a) => (
                  <VitalPill key={a.param} a={a} />
                ))}
              </div>
            )}

            {/* Clinical observation */}
            {annotation && isVisible && (
              <div className={`px-3 py-2 border-t border-gray-700/50`}>
                <p className={`text-xs ${sev.text} leading-relaxed`}>{annotation.message}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[9px] text-gray-500">{String.fromCodePoint(0x27A4)}</span>
                  <span className="text-[9px] text-gray-500">{SCREEN_REGIONS[annotation.target]?.label ?? annotation.target}</span>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes simmaster-pulse-ring-kf {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
          50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
        }
        .simmaster-pulse-ring {
          animation: simmaster-pulse-ring-kf 1.5s ease-in-out infinite;
        }
        @keyframes simmaster-glow-ring-kf {
          0%, 100% { box-shadow: 0 0 4px rgba(245, 158, 11, 0.3); }
          50% { box-shadow: 0 0 12px rgba(245, 158, 11, 0.5); }
        }
        .simmaster-glow-ring {
          animation: simmaster-glow-ring-kf 2s ease-in-out infinite;
        }
      `}</style>
    </>
  );
};

export default SimMasterOverlay;
