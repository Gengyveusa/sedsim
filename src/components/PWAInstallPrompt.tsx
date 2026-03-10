import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Listens for the browser's beforeinstallprompt event and renders an
 * unobtrusive "Install App" button so users can add SedSim to their
 * home screen / desktop as a PWA.
 */
const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 border border-blue-600/60 text-white text-xs rounded-xl px-4 py-3 shadow-xl">
      <span className="text-lg">📲</span>
      <div className="flex flex-col">
        <span className="font-semibold text-sm">Install SedSim</span>
        <span className="text-gray-400">Run offline from your home screen</span>
      </div>
      <div className="flex gap-2 ml-2">
        <button
          onClick={handleInstall}
          className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
        >
          Install
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-white px-2 py-1.5 rounded-lg transition-colors"
          aria-label="Dismiss install prompt"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
