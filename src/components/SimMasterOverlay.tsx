/**
 * src/components/SimMasterOverlay.tsx
 * SimMaster v4 — Active visual annotation overlay.
 *
 * Renders colored highlight rings, animated pointer arrows, and pulsing glows
 * around data-region panels identified by SimMaster's teaching engine.
 * Reads annotations from the AI store and auto-dismisses when the learner
 * interacts with the highlighted panel.
 */

import React, { useEffect, useRef, useState } from 'react';
import useAIStore from '../store/useAIStore';
import useSimStore from '../store/useSimStore';
import { PANEL_REGION_MAP } from '../ai/simMasterKnowledge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OverlayAnnotation {
  id: string;
  targetRegion: string;          // key into PANEL_REGION_MAP
  severity: 'info' | 'warning' | 'critical';
  message: string;
  action: 'highlight' | 'pulse' | 'point';
  createdAt: number;
  autoDismissMs: number;         // 0 = manual dismiss only
}

interface AnnotationRect {
  annotation: OverlayAnnotation;
  rect: DOMRect;
}

// ---------------------------------------------------------------------------
// Severity → color mapping
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<string, { ring: string; glow: string; arrow: string; bg: string; text: string }> = {
  info:     { ring: 'rgba(34,197,94,0.7)',  glow: 'rgba(34,197,94,0.3)',  arrow: '#22c55e', bg: 'bg-emerald-900/80', text: 'text-emerald-200' },
  warning:  { ring: 'rgba(234,179,8,0.7)',  glow: 'rgba(234,179,8,0.3)',  arrow: '#eab308', bg: 'bg-amber-900/80',   text: 'text-amber-200' },
  critical: { ring: 'rgba(239,68,68,0.7)',  glow: 'rgba(239,68,68,0.3)',  arrow: '#ef4444', bg: 'bg-red-900/80',     text: 'text-red-200' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SimMasterOverlayProps {
  enabled: boolean;
}

const SimMasterOverlay: React.FC<SimMasterOverlayProps> = ({ enabled }) => {
  const annotations = useAIStore(s => s.simMasterOverlayAnnotations);
  const removeAnnotation = useAIStore(s => s.removeOverlayAnnotation);
  const clearAnnotations = useAIStore(s => s.clearOverlayAnnotations);
  const activeTab = useSimStore(s => s.activeTab);
  const activeGaugeMode = useSimStore(s => s.activeGaugeMode);

  const [rects, setRects] = useState<AnnotationRect[]>([]);
  const rafRef = useRef(0);
  const prevInteractionRef = useRef({ tab: activeTab, gauge: activeGaugeMode });

  // ── Auto-dismiss when learner interacts with a highlighted panel ────────
  useEffect(() => {
    const prev = prevInteractionRef.current;
    if (prev.tab !== activeTab || prev.gauge !== activeGaugeMode) {
      // Learner switched tabs or gauge mode — dismiss related annotations
      for (const ann of annotations) {
        const sel = PANEL_REGION_MAP[ann.targetRegion];
        if (!sel) continue;
        // If the learner opened a panel that this annotation was pointing to, dismiss it
        const regionKey = ann.targetRegion.toLowerCase();
        const tabKey = activeTab.toLowerCase();
        const gaugeKey = activeGaugeMode.toLowerCase();
        if (regionKey.includes(tabKey) || tabKey.includes(regionKey) ||
            regionKey.includes(gaugeKey) || gaugeKey.includes(regionKey)) {
          removeAnnotation(ann.id);
        }
      }
      prevInteractionRef.current = { tab: activeTab, gauge: activeGaugeMode };
    }
  }, [activeTab, activeGaugeMode, annotations, removeAnnotation]);

  // ── Auto-dismiss on timer ───────────────────────────────────────────────
  useEffect(() => {
    if (annotations.length === 0) return;
    const timers = annotations
      .filter(a => a.autoDismissMs > 0)
      .map(a => {
        const elapsed = Date.now() - a.createdAt;
        const remaining = Math.max(0, a.autoDismissMs - elapsed);
        return setTimeout(() => removeAnnotation(a.id), remaining);
      });
    return () => timers.forEach(clearTimeout);
  }, [annotations, removeAnnotation]);

  // ── Measure target element positions ────────────────────────────────────
  // Use a ref to hold the latest annotations so the rAF loop reads fresh data.
  const annotationsRef = useRef(annotations);
  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);

  useEffect(() => {
    if (!enabled || annotations.length === 0) {
      setRects([]);
      return;
    }
    const loop = () => {
      const measured: AnnotationRect[] = [];
      for (const ann of annotationsRef.current) {
        const selector = PANEL_REGION_MAP[ann.targetRegion];
        if (!selector) continue;
        const el = document.querySelector(selector);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        measured.push({ annotation: ann, rect });
      }
      setRects(measured);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [enabled, annotations]);

  // ── Clear all on disable ────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) clearAnnotations();
  }, [enabled, clearAnnotations]);

  if (!enabled || rects.length === 0) return null;

  return (
    <>
      {/* Inject keyframe styles */}
      <style>{KEYFRAME_STYLES}</style>

      {/* Full-screen overlay (pointer-events: none so user can interact through) */}
      <div
        className="fixed inset-0 z-50"
        style={{ pointerEvents: 'none' }}
        aria-hidden
      >
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
          {rects.map(({ annotation: ann, rect }) => {
            const colors = SEVERITY_COLORS[ann.severity] ?? SEVERITY_COLORS.info;
            const cx = rect.left + rect.width / 2;
            const pad = 6;

            return (
              <g key={ann.id}>
                {/* Glow backdrop */}
                <rect
                  x={rect.left - pad}
                  y={rect.top - pad}
                  width={rect.width + pad * 2}
                  height={rect.height + pad * 2}
                  rx={8}
                  fill="none"
                  stroke={colors.glow}
                  strokeWidth={ann.action === 'pulse' ? 4 : 2}
                  style={{
                    animation: ann.action === 'pulse'
                      ? 'simmaster-pulse 1.5s ease-in-out infinite'
                      : 'simmaster-glow 2s ease-in-out infinite',
                  }}
                />

                {/* Solid ring */}
                <rect
                  x={rect.left - pad}
                  y={rect.top - pad}
                  width={rect.width + pad * 2}
                  height={rect.height + pad * 2}
                  rx={8}
                  fill="none"
                  stroke={colors.ring}
                  strokeWidth={2}
                  strokeDasharray={ann.action === 'point' ? '8 4' : 'none'}
                />

                {/* Pointer arrow (animated bounce) for 'point' action */}
                {ann.action === 'point' && (
                  <g style={{ animation: 'simmaster-point 1s ease-in-out infinite' }}>
                    <line
                      x1={cx}
                      y1={rect.top - pad - 28}
                      x2={cx}
                      y2={rect.top - pad - 4}
                      stroke={colors.arrow}
                      strokeWidth={2}
                      markerEnd="url(#simmaster-arrowhead)"
                    />
                  </g>
                )}
              </g>
            );
          })}

          {/* Arrow marker definition */}
          <defs>
            <marker
              id="simmaster-arrowhead"
              markerWidth={8}
              markerHeight={6}
              refX={8}
              refY={3}
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="currentColor" className="text-white" />
            </marker>
          </defs>
        </svg>

        {/* Tooltip labels */}
        {rects.map(({ annotation: ann, rect }) => {
          const colors = SEVERITY_COLORS[ann.severity] ?? SEVERITY_COLORS.info;
          // Position tooltip below the highlighted region
          const top = rect.bottom + 12;
          const left = Math.max(8, Math.min(rect.left, window.innerWidth - 320));

          return (
            <div
              key={`label-${ann.id}`}
              className={`absolute max-w-xs px-3 py-2 rounded-lg border border-white/10 text-xs leading-relaxed shadow-lg ${colors.bg} ${colors.text}`}
              style={{
                top,
                left,
                pointerEvents: 'auto',
                animation: 'simmaster-glow 2s ease-in-out infinite',
              }}
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5">
                  {ann.severity === 'critical' ? '🔴' : ann.severity === 'warning' ? '🟡' : '🟢'}
                </span>
                <span>{ann.message}</span>
              </div>
              <button
                className="absolute top-1 right-1.5 text-white/50 hover:text-white text-xs"
                onClick={() => removeAnnotation(ann.id)}
                aria-label="Dismiss annotation"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// CSS keyframe animations
// ---------------------------------------------------------------------------

const KEYFRAME_STYLES = `
@keyframes simmaster-glow {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

@keyframes simmaster-pulse {
  0%, 100% { opacity: 0.4; stroke-width: 3; }
  50% { opacity: 1; stroke-width: 6; }
}

@keyframes simmaster-point {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
`;

export default SimMasterOverlay;
