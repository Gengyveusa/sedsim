// src/components/MillieAvatar.tsx
// Small circular avatar for the Millie AI mentor with 5 emotion states.

import React from 'react';
import type { MillieEmotion } from '../engine/conductor/types';

interface MillieAvatarProps {
  emotion?: MillieEmotion;
  size?: number;
}

const EMOTION_CONFIG: Record<
  MillieEmotion,
  { bg: string; border: string; shadow: string; expression: string; title: string }
> = {
  neutral: {
    bg: 'bg-blue-700',
    border: 'border-blue-500',
    shadow: '',
    expression: '🎓',
    title: 'Millie – neutral',
  },
  concerned: {
    bg: 'bg-amber-700',
    border: 'border-amber-500',
    shadow: 'shadow-amber-500/30',
    expression: '🤔',
    title: 'Millie – concerned',
  },
  urgent: {
    bg: 'bg-red-700',
    border: 'border-red-500',
    shadow: 'shadow-red-500/40',
    expression: '⚠️',
    title: 'Millie – urgent',
  },
  encouraging: {
    bg: 'bg-emerald-700',
    border: 'border-emerald-500',
    shadow: 'shadow-emerald-500/30',
    expression: '✨',
    title: 'Millie – encouraging',
  },
  thinking: {
    bg: 'bg-purple-700',
    border: 'border-purple-500',
    shadow: 'shadow-purple-500/30',
    expression: '💭',
    title: 'Millie – thinking',
  },
};

const MillieAvatar: React.FC<MillieAvatarProps> = ({ emotion = 'neutral', size = 40 }) => {
  const cfg = EMOTION_CONFIG[emotion];
  return (
    <div
      className={`flex items-center justify-center rounded-full border-2 flex-shrink-0 ${cfg.bg} ${cfg.border} ${cfg.shadow ? `shadow-lg ${cfg.shadow}` : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      title={cfg.title}
      aria-label={cfg.title}
    >
      {cfg.expression}
    </div>
  );
};

export default MillieAvatar;
