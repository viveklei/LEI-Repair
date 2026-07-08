import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone, Monitor } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return; // Don't show again for 7 days
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent;
    const isIOSDevice = /iphone|ipad|ipod/i.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // Show iOS instructions after a delay
      const t = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(t);
    }

    // Listen for Android/Desktop install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!showBanner || isInstalled) return null;

  return (
    <div className="fixed bottom-safe-bottom left-4 right-4 md:left-auto md:right-6 md:w-96 z-[9998] animate-slide-up">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl shadow-slate-900/40 overflow-hidden border border-slate-700/50">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0 shadow-lg">
              <img src="/favicon.png" className="w-7 h-7 object-contain" alt="LEI Repair" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-white">Install LEI Repair</p>
              {isIOS ? (
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Tap the <strong>Share</strong> button then <strong>"Add to Home Screen"</strong> to install the app.
                </p>
              ) : (
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Get instant access from your home screen — works offline too!
                </p>
              )}
            </div>
            <button
              onClick={handleDismiss}
              className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!isIOS && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleInstall}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-colors cursor-pointer shadow-md"
              >
                <Download className="h-4 w-4" />
                Install App
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2.5 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer"
              >
                Not now
              </button>
            </div>
          )}

          {/* Platform icons */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px]">
              <Smartphone className="h-3 w-3" />
              Android / iOS
            </div>
            <span className="text-slate-700">•</span>
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px]">
              <Monitor className="h-3 w-3" />
              Windows / Mac
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
