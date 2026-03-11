/**
 * src/components/SimMasterOverlay.tsx
 * SimMaster v4 — Visual Annotation System
 *
 * Renders colored highlight rings, animated pointer arrows, and pulsing glows
 * on DOM panels identified by data-region attributes. Annotations auto-dismiss
 * after a timeout or when the learner interacts with the highlighted panel.
 *
 * Uses CSS transforms and will-change for GPU-accelerated animations.
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import useAIStore from '../store/useAIStore';
import type { SimMasterV4Annotation } from '../store/slices/aiSlice';
import { REGION_SELECTORS } from '../ai/simMaster';

// ---------------------------------------------------------------------------
// CSS Animation Styles (injected once)
// ---------------------------------------------------------------------------

const OVERLAY_STYLES = `
@keyframes simmaster-glow {
  0%, 100% { box-shadow: 0 0 8px 2px var(--sm-glow-color); }
  50% { box-shadow: 0 0 20px 6px var(--sm-glow-color); }
}

@keyframes simmaster-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.85; }
}

@keyframes simmaster-point {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

@keyframes simmaster-fadein {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes simmaster-fadeout {
  from { opacity: 1; }
  to { opacity: 0; }
}

.sm-overlay-ring {
  position: absolute;
  pointer-events: none;
  border-radius: 8px;
  z-index: 90;
  will-change: box-shadow, transform;
  transition: all 0.3s ease-out;
}

.sm-ring-info {
  --sm-glow-color: rgba(34, 197, 94, 0.6);
  border: 2px solid rgba(34, 197, 94, 0.7);
  animation: simmaster-glow 2s ease-in-out infinite;
}

.sm-ring-warning {
  --sm-glow-color: rgba(234, 179, 8, 0.6);
  border: 2px solid rgba(234, 179, 8, 0.7);
  animation: simmaster-glow 1.5s ease-in-out infinite;
}

.sm-ring-critical {
  --sm-glow-color: rgba(239, 68, 68, 0.7);
  border: 3px solid rgba(239, 68, 68, 0.8);
  animation: simmaster-pulse 0.8s ease-in-out infinite;
}

.sm-tooltip {
  position: absolute;
  z-index: 91;
  max-width: 320px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.4;
  color: #e2e8f0;
  pointer-events: auto;
  will-change: opacity, transform;
  animation: simmaster-fadein 0.3s ease-out;
  backdrop-filter: blur(8px);
}

.sm-tooltip-info {
  background: rgba(20, 83, 45, 0.92);
  border: 1px solid rgba(34, 197, 94, 0.5);
}

.sm-tooltip-warning {
  background: rgba(113, 63, 18, 0.92);
  border: 1px solid rgba(234, 179, 8, 0.5);
}

.sm-tooltip-critical {
  background: rgba(127, 29, 29, 0.92);
  border: 1px solid rgba(239, 68, 68, 0.5);
}

.sm-tooltip-question {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  font-style: italic;
  color: #c4b5fd;
}

.sm-tooltip-teaching {
  margin-top: 4px;
  font-size: 10px;
  color: #93c5fd;
}

.sm-tooltip-dismiss {
  position: absolute;
  top: 4px;
  right: 6px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 2px;
}

.sm-tooltip-dismiss:hover {
  color: rgba(255, 255, 255, 0.9);
}

.sm-pointer-arrow {
  position: absolute;
  z-index: 90;
  pointer-events: none;
  animation: simmaster-point 1.2s ease-in-out infinite;
  will-change: transform;
}
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnnotationPosition {
  annotation: SimMasterV4Annotation;
  rect: DOMRect;
}

interface SimMasterOverlayProps {
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SimMasterOverlay: React.FC<SimMasterOverlayProps> = ({ enabled }) => {
  const annotations = useAIStore(s => s.simMasterAnnotations);
  const dismiss = useAIStore(s => s.dismissSimMasterAnnotation);
  const [positions, setPositions] = useState<AnnotationPosition[]>([]);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const timerRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Inject styles once
  useEffect(() => {
    if (styleRef.current) return;
    const style = document.createElement('style');
    style.textContent = OVERLAY_STYLES;
    document.head.appendChild(style);
    styleRef.current = style;
    return () => {
      if (styleRef.current) {
        document.head.removeChild(styleRef.current);
        styleRef.current = null;
      }
    };
  }, []);

  // Compute positions of active (non-dismissed) annotations
  const computePositions = useCallback(() => {
    const active = annotations.filter(a => !a.dismissed);
    const result: AnnotationPosition[] = [];

    for (const ann of active) {
      const selector = REGION_SELECTORS[ann.targetPanel];
      if (!selector) continue;
      const el = document.querySelector(selector);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      result.push({ annotation: ann, rect });
    }

    setPositions(result);
  }, [annotations]);

  // Recompute on annotation changes and on scroll/resize
  useEffect(() => {
    if (!enabled) { setPositions([]); return; }
    computePositions();
    window.addEventListener('scroll', computePositions, true);
    window.addEventListener('resize', computePositions);
    return () => {
      window.removeEventListener('scroll', computePositions, true);
      window.removeEventListener('resize', computePositions);
    };
  }, [enabled, computePositions]);

  // Auto-dismiss timers
  useEffect(() => {
    const active = annotations.filter(a => !a.dismissed && a.autoDismissMs > 0);
    for (const ann of active) {
      if (timerRefs.current.has(ann.id)) continue;
      const timer = setTimeout(() => {
        dismiss(ann.id);
        timerRefs.current.delete(ann.id);
      }, ann.autoDismissMs);
      timerRefs.current.set(ann.id, timer);
    }
    // Clean up timers for dismissed annotations
    for (const [id, timer] of timerRefs.current.entries()) {
      const ann = annotations.find(a => a.id === id);
      if (!ann || ann.dismissed) {
        clearTimeout(timer);
        timerRefs.current.delete(id);
      }
    }
  }, [annotations, dismiss]);

  // Auto-dismiss when learner clicks on highlighted panel
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const regionEl = target.closest('[data-region]');
      if (!regionEl) return;
      const region = regionEl.getAttribute('data-region');
      if (!region) return;
      // Dismiss annotations targeting this region
      for (const ann of annotations) {
        if (!ann.dismissed && ann.targetPanel === region) {
          dismiss(ann.id);
        }
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [enabled, annotations, dismiss]);

  if (!enabled || positions.length === 0) return null;

  return (
    <div
      className="simmaster-overlay"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 89 }}
    >
      {positions.map(({ annotation: ann, rect }) => {
        const severityClass = `sm-ring-${ann.severity}`;
        const tooltipClass = `sm-tooltip-${ann.severity}`;

        // Position ring around target element
        const ringStyle: React.CSSProperties = {
          left: rect.left - 4,
          top: rect.top - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        };

        // Tooltip below the ring, clamped to viewport
        const tooltipLeft = Math.min(rect.left, window.innerWidth - 340);
        const tooltipTop = rect.bottom + 8;
        const tooltipStyle: React.CSSProperties = {
          left: Math.max(8, tooltipLeft),
          top: tooltipTop > window.innerHeight - 120 ? rect.top - 100 : tooltipTop,
        };

        return (
          <React.Fragment key={ann.id}>
            {/* Highlight ring */}
            <div
              className={`sm-overlay-ring ${severityClass}`}
              style={ringStyle}
            />

            {/* Pointer arrow for "point" action */}
            {ann.action === 'point' && (
              <svg
                className="sm-pointer-arrow"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                style={{
                  left: rect.left + rect.width / 2 - 10,
                  top: rect.top - 24,
                }}
              >
                <polygon
                  points="10,18 2,4 18,4"
                  fill={ann.severity === 'critical' ? '#ef4444' : ann.severity === 'warning' ? '#eab308' : '#22c55e'}
                  opacity={0.85}
                />
              </svg>
            )}

            {/* Tooltip with message */}
            <div
              className={`sm-tooltip ${tooltipClass}`}
              style={tooltipStyle}
            >
              <button
                className="sm-tooltip-dismiss"
                onClick={() => dismiss(ann.id)}
                style={{ pointerEvents: 'auto' }}
                aria-label="Dismiss annotation"
              >
                x
              </button>
              <div>{ann.message}</div>
              {ann.socraticQuestion && (
                <div className="sm-tooltip-question">{ann.socraticQuestion}</div>
              )}
              {ann.teachingPoint && (
                <div className="sm-tooltip-teaching">{ann.teachingPoint}</div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default SimMasterOverlay;
