// src/components/ScenarioCallout.tsx
// Visual callout overlay for Millie interactive scenarios.
// Renders a pulsing highlight ring + tooltip arrow pointing to a target data-sim-id element.

import React, { useEffect, useState, useRef } from 'react';
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
  vitalLabel?: string;
  vitalValue?: number;
  severity?: 'normal' | 'warning' | 'danger';
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
            vitalLabel: h.vitalLabel,
            vitalValue: h.vitalValue,
            severity: h.severity,
          });
        }
      }
      setResolved(result);
    };

    // Small delay to let layout settle after step fires
    const timer = setTimeout(resolveAll, LAYOUT_SETTLE_DELAY_MS);

    // Auto-dismiss after timeout
    const dismiss = setTimeout(() => setActiveHighlights(null), AUTO_DISMISS_TIMEOUT_MS);

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

const LAYOUT_SETTLE_DELAY_MS = 150;
const AUTO_DISMISS_TIMEOUT_MS = 12000;
const MAX_TOOLTIP_TEXT_LENGTH = 120;

function formatVitalDisplay(label: string, value: number): string {
  const integerLabels = ['SpO2', 'HR', 'RR', 'SBP', 'MOASS'];
  const formatted = integerLabels.includes(label) ? value.toFixed(0) : value.toFixed(1);
  const unit = label === 'SpO2' ? '%' : label === 'SBP' ? ' mmHg' : '';
  return `${label}: ${formatted}${unit}`;
}

const SEVERITY_COLORS = {
  danger: { text: '#ef4444', border: '#ef4444', bg: 'rgba(127,29,29,0.9)' },
  warning: { text: '#f59e0b', border: '#f59e0b', bg: 'rgba(120,53,15,0.9)' },
  normal: { text: '#22c55e', border: '#22c55e', bg: 'rgba(20,83,45,0.9)' },
};

const CalloutItem: React.FC<CalloutItemProps> = ({ highlight, onDismiss }) => {
  const { rect, text, vitalLabel, vitalValue, severity = 'warning' } = highlight;
  const [visible, setVisible] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Fade in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  // Centre of the target element
  const centerX = rect.left + rect.width / 2;

  // Extra height for vital badge
  const hasBadge = vitalLabel !== undefined && vitalValue !== undefined;
  const badgeHeight = hasBadge ? 36 : 0;

  // Position tooltip above the element by default; clamp to viewport
  const tipWidth = 240;
  const tipHeight = 80 + badgeHeight;
  const gap = 14;
  const rectBottom = rect.top + rect.height;

  let tipTop = rect.top - tipHeight - gap;
  let tipLeft = centerX - tipWidth / 2;
  let arrowBelow = false;

  if (tipTop < 8) {
    // Flip below the element
    tipTop = rectBottom + gap;
    arrowBelow = true;
  }
  tipLeft = Math.max(8, Math.min(tipLeft, window.innerWidth - tipWidth - 8));

  // Arrow centre x relative to tooltip
  const arrowX = Math.max(12, Math.min(centerX - tipLeft, tipWidth - 12));

  // Connector line: from tooltip bottom-centre to target element centre
  const lineStartX = tipLeft + arrowX;
  const lineStartY = arrowBelow ? tipTop : tipTop + tipHeight;
  const lineEndX = centerX;
  const lineEndY = arrowBelow ? rect.top : rectBottom;

  const sc = SEVERITY_COLORS[severity];
  const ringColor = hasBadge ? sc.border : '#3b82f6';

  return (
    <>
      {/* Animated dashed connector line (SVG overlay) */}
      {visible && (
        <svg
          ref={svgRef}
          style={{
            position: 'fixed',
            top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none',
            zIndex: 9997,
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          <line
            x1={lineStartX}
            y1={lineStartY}
            x2={lineEndX}
            y2={lineEndY}
            stroke={ringColor}
            strokeWidth={1.5}
            strokeDasharray="5,4"
            opacity={0.55}
            style={{ animation: 'callout-dash 1s linear infinite' }}
          />
        </svg>
      )}

      {/* Pulsing ring around the target */}
      <div
        style={{
          position: 'fixed',
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          borderRadius: 6,
          border: `2px solid ${ringColor}`,
          boxShadow: `0 0 0 4px ${ringColor}59`,
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
            border: `1px solid ${ringColor}`,
            borderRadius: 8,
            padding: '8px 10px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
            position: 'relative',
          }}
        >
          {/* Vital value badge */}
          {hasBadge && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 6,
                padding: '4px 8px',
                borderRadius: 6,
                background: sc.bg,
                border: `1px solid ${sc.border}`,
                animation: severity === 'danger' ? 'vital-badge-pulse 0.8s ease-in-out infinite' : undefined,
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 'bold', color: sc.text, letterSpacing: '0.03em' }}>
                {formatVitalDisplay(vitalLabel, vitalValue)}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>👩‍⚕️</span>
            <p style={{ margin: 0, fontSize: 11, color: '#e2e8f0', lineHeight: 1.5, flex: 1 }}>
              {text.length > MAX_TOOLTIP_TEXT_LENGTH ? text.slice(0, MAX_TOOLTIP_TEXT_LENGTH) + '…' : text}
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
                ? { top: -10, borderBottom: `10px solid ${ringColor}`, borderLeft: '6px solid transparent', borderRight: '6px solid transparent' }
                : { bottom: -10, borderTop: `10px solid ${ringColor}`, borderLeft: '6px solid transparent', borderRight: '6px solid transparent' }),
              width: 0,
              height: 0,
            }}
          />
        </div>
      </div>

      {/* Keyframe animations injected once */}
      <style>{`
        @keyframes scenario-callout-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(59,130,246,0.35); }
          50% { box-shadow: 0 0 0 8px rgba(59,130,246,0.12); }
        }
        @keyframes vital-badge-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(1.04); }
        }
        @keyframes callout-dash {
          to { stroke-dashoffset: -18; }
        }
      `}</style>
    </>
  );
};

export default ScenarioCallout;

