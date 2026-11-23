"use client";

import { useEffect, useState } from "react";
import { Download, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // In development or production, register the service worker cleanly
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Check for worker updates
          reg.update();
        })
        .catch(() => {
          // Gracefully continue without SW if unsupported
        });
    }
  }, []);

  return null;
}

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
    }
    function handleOffline() {
      setIsOffline(true);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-warning text-on-warning px-4 py-2 text-center text-body-sm font-medium flex items-center justify-center gap-2 sticky top-0 z-50 shadow-xs"
    >
      <WifiOff className="size-4 shrink-0" />
      <span>You are currently browsing offline. Showing previously cached materials.</span>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  if (!deferredPrompt || isDismissed) return null;

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }

  return (
    <aside
      aria-label="Install Sagar Traders App"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-40 rounded-lg border border-border bg-surface p-4 shadow-lg flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary font-bold text-label-md">
          ST
        </div>
        <div>
          <p className="font-semibold text-primary text-body-sm leading-snug">
            Install Sagar Traders
          </p>
          <p className="text-body-sm text-on-surface-variant">Instant access & offline browsing</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button size="sm" variant="primary" onClick={handleInstallClick}>
          <Download className="size-3.5 mr-1" />
          Install
        </Button>
        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-muted transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    </aside>
  );
}
