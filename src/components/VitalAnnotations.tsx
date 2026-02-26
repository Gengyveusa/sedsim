// src/components/VitalAnnotations.tsx
// Floating colored pill badges positioned near vital sign numbers on the MonitorPanel.
// Reads vitalAnnotations[] from useAIStore and uses data-sim-id attributes for positioning.

import React, { useEffect, useState } from 'react';
import useAIStore from '../store/useAIStore';
import type { VitalAnnotation } from '../engine/conductor/types';

const SEVERITY_STYLES: Record<
  VitalAnnotation['severity'],
  { bg: string; text: string; border: string }
> = {
  normal:   { bg: 'bg-emerald-900/90', text: 'text-emerald-300', border: 'border-emerald-500/60' },
  warning:  { bg: 'bg-amber-900/90',   text: 'text-amber-300',   border: 'border-amber-500/60'   },
  danger:   { bg: 'bg-red-900/90',     text: 'text-red-300',     border: 'border-red-500/60'     },
  critical: { bg: 'bg-red-950/90',     text: 'text-red-200',     border: 'border-red-400/80'     },
};

/** Resolve the bounding rect of a [data-sim-id=...] element. Returns null if not found. */
function resolveRect(simId: string): DOMRect | null {
  const el = document.querySelector(`[data-sim-id="${simId}"]`);
  return el ? el.getBoundingClientRect() : null;
}

interface ResolvedAnnotation extends VitalAnnotation {
  rect: DOMRect;
}

const AUTO_DISMISS_TIMEOUT_MS = 8000;

const VitalAnnotations: React.FC = () => {
  const rawAnnotations = useAIStore(s => s.vitalAnnotations);
  const clearVitalAnnotations = useAIStore(s => s.clearVitalAnnotations);
  const [resolved, setResolved] = useState<ResolvedAnnotation[]>([]);

  useEffect(() => {
    if (rawAnnotations.length === 0) {
      setResolved([]);
      return;
    }

    const resolve = () => {
      const result: ResolvedAnnotation[] = [];
      for (const ann of rawAnnotations) {
        const rect = resolveRect(ann.parameter);
        if (rect) result.push({ ...ann, rect });
      }
      setResolved(result);
    };

    // Small delay to allow layout to settle
    const layoutTimer = setTimeout(resolve, 120);

    // Auto-dismiss all after timeout
    const dismissTimer = setTimeout(() => {
      clearVitalAnnotations();
    }, AUTO_DISMISS_TIMEOUT_MS);

    return () => {
      clearTimeout(layoutTimer);
      clearTimeout(dismissTimer);
    };
  }, [rawAnnotations, clearVitalAnnotations]);

  if (resolved.length === 0) return null;

  return (
    <>
      {resolved.map((ann) => (
        <AnnotationPill key={`${ann.parameter}-${ann.timestamp}`} annotation={ann} />
      ))}
    </>
  );
};

interface AnnotationPillProps {
  annotation: ResolvedAnnotation;
}

const AnnotationPill: React.FC<AnnotationPillProps> = ({ annotation }) => {
  const { rect, label, severity } = annotation;
  const styles = SEVERITY_STYLES[severity];

  // Position the pill to the right of the vital display element
  const pillTop = rect.top + rect.height / 2 - 11; // vertically centred (~22px pill height)
  const pillLeft = rect.right + 6;

  const isDanger = severity === 'danger' || severity === 'critical';

  return (
    <div
      style={{
        position: 'fixed',
        top: pillTop,
        left: pillLeft,
        zIndex: 9990,
        pointerEvents: 'none',
        animation: isDanger ? 'ann-pulse 0.9s ease-in-out infinite' : 'ann-fadein 0.3s ease',
      }}
    >
      <div
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${styles.bg} ${styles.text} ${styles.border}`}
      >
        {isDanger && <span className="text-[9px]">⚠</span>}
        {label}
      </div>
      <style>{`
        @keyframes ann-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes ann-fadein {
          from { opacity: 0; transform: translateX(-4px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default VitalAnnotations;
