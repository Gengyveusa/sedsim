// src/components/ScenarioCallout.tsx
// Visual callout overlay for Millie interactive scenarios.
// Renders a pulsing highlight ring + tooltip arrow pointing to a target data-sim-id element.

import React, { useEffect, useRef, useState } from 'react';
import useAIStore from '../store/useAIStore';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface ResolvedHighlight {
  targetId: string;
  text: string;
  rect: TargetRect;
}

const ScenarioCallout: React.FC = () => {
  const activeHighlights = useAIStore(s => s.activeHighlights);
  const setActiveHighlights = useAIStore(s => s.setActiveHighlights);
  const [resolved, setResolved] = useState<ResolvedHighlight[]>([]);

  // Resolve element positions
  useEffect(() => {
    if (!activeHighlights || activeHighlights.length === 0) {
      setResolved([]);
      return;
    }

    const resolveAll = () => {
      const result: ResolvedHighlight[] = [];
      for (const h of activeHighlights) {
        const el = document.querySelector(`[data-sim-id="${h.targetId}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          result.push({
            targetId: h.targetId,
            text: h.text,
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          });
        }
      }
      setResolved(result);
    };

    // Small delay to let layout settle after step fires
    const timer = setTimeout(resolveAll, 150);

    // Auto-dismiss after 12 seconds
    const dismiss = setTimeout(() => setActiveHighlights(null), 12000);

    return () => {
      clearTimeout(timer);
      clearTimeout(dismiss);
    };
  }, [activeHighlights, setActiveHighlights]);

  if (!activeHighlights || resolved.length === 0) return null;

  return (
    <>
      {resolved.map((h) => (
        <CalloutItem
          key={h.targetId}
          highlight={h}
          onDismiss={() => setActiveHighlights(null)}
        />
      ))}
    </>
  );
};

interface CalloutItemProps {
  highlight: ResolvedHighlight;
  onDismiss: () => void;
}

const CalloutItem: React.FC<CalloutItemProps> = ({ highlight, onDismiss }) => {
  const { rect, text } = highlight;
  const [visible, setVisible] = useState(false);

  // Fade in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  // Centre of the target element
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  // Position tooltip above the element by default; clamp to viewport
  const tipWidth = 240;
  const tipHeight = 80;
  const gap = 14;

  let tipTop = rect.top - tipHeight - gap;
  let tipLeft = cx - tipWidth / 2;
  let arrowBelow = false;

  if (tipTop < 8) {
    // Flip below the element
    tipTop = rect.bottom + gap;
    arrowBelow = true;
  }
  tipLeft = Math.max(8, Math.min(tipLeft, window.innerWidth - tipWidth - 8));

  // Arrow centre x relative to tooltip
  const arrowX = Math.max(12, Math.min(cx - tipLeft, tipWidth - 12));

  return (
    <>
      {/* Pulsing ring around the target */}
      <div
        style={{
          position: 'fixed',
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          borderRadius: 6,
          border: '2px solid #3b82f6',
          boxShadow: '0 0 0 4px rgba(59,130,246,0.35)',
          pointerEvents: 'none',
          zIndex: 9998,
          animation: 'scenario-callout-pulse 1.2s ease-in-out infinite',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Tooltip bubble */}
      <div
        role="tooltip"
        onClick={onDismiss}
        style={{
          position: 'fixed',
          top: tipTop,
          left: tipLeft,
          width: tipWidth,
          zIndex: 9999,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(-6px)',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            background: 'rgba(15,23,42,0.97)',
            border: '1px solid #3b82f6',
            borderRadius: 8,
            padding: '8px 10px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>👩‍⚕️</span>
            <p style={{ margin: 0, fontSize: 11, color: '#e2e8f0', lineHeight: 1.5, flex: 1 }}>
              {text.length > 120 ? text.slice(0, 120) + '…' : text}
            </p>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 9, color: '#64748b', textAlign: 'right' }}>
            click to dismiss
          </p>

          {/* Arrow pointing to element */}
          <div
            style={{
              position: 'absolute',
              left: arrowX - 6,
              ...(arrowBelow
                ? { top: -10, borderBottom: '10px solid #3b82f6', borderLeft: '6px solid transparent', borderRight: '6px solid transparent' }
                : { bottom: -10, borderTop: '10px solid #3b82f6', borderLeft: '6px solid transparent', borderRight: '6px solid transparent' }),
              width: 0,
              height: 0,
            }}
          />
        </div>
      </div>

      {/* Keyframe animation injected once */}
      <style>{`
        @keyframes scenario-callout-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(59,130,246,0.35); }
          50% { box-shadow: 0 0 0 8px rgba(59,130,246,0.12); }
        }
      `}</style>
    </>
  );
};

export default ScenarioCallout;
