import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Displays a fixed top banner when the browser is offline.
 * AI/Claude features are network-dependent; the core simulator runs fully offline.
 */
const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-amber-600/90 text-white text-xs px-4 py-2 flex items-center justify-center gap-2 z-50"
    >
      <span className="text-base">📡</span>
      <span>
        <strong>You&apos;re offline.</strong> The simulator runs fully without network.
        AI features (Millie Mentor, SimMaster) are unavailable until you reconnect.
      </span>
    </div>
  );
};

export default OfflineBanner;
