"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

/**
 * PWA Install Banner - Mobile Only
 * 
 * Prompts users to install the app as a PWA for better mobile experience.
 * Only shows on mobile devices and can be permanently dismissed.
 */
export default function PwaInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if already dismissed
    const dismissed = localStorage.getItem("pwa-banner-dismissed");
    if (dismissed === "true") return;

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      // Already installed as PWA
      return;
    }

    // Check if on mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    if (!isMobile) return;

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Show the banner
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // For iOS devices (which don't support beforeinstallprompt)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;
    
    if (isIOS && !isInStandaloneMode) {
      // Show banner for iOS after a short delay
      setTimeout(() => setShowBanner(true), 2000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // For iOS or browsers that don't support install prompt
      // Show instructions instead
      alert(
        "To install this app:\n\n" +
        "1. Tap the Share button\n" +
        "2. Scroll down and tap 'Add to Home Screen'\n" +
        "3. Tap 'Add' in the top right corner"
      );
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`User response to install prompt: ${outcome}`);

    // Clear the deferredPrompt for next time
    setDeferredPrompt(null);
    setShowBanner(false);

    if (outcome === "accepted") {
      localStorage.setItem("pwa-banner-dismissed", "true");
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-banner-dismissed", "true");
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-linear-to-r from-orange-500 to-orange-600 px-4 py-3 shadow-lg md:hidden">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20">
          <Download className="h-5 w-5 text-white" />
        </div>
        
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">
            Install NTS Claims Tracker
          </p>
          <p className="text-xs text-orange-100">
            Quick access from your home screen
          </p>
        </div>

        <button
          onClick={handleInstall}
          className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-orange-600 transition-colors hover:bg-orange-50"
        >
          Install
        </button>

        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-2 text-white transition-colors hover:bg-white/20"
          aria-label="Dismiss install prompt"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
