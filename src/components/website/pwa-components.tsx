"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, RefreshCw, Share, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const SW_URL = "/sw.js";
const DISMISS_KEY = "sagar-pwa-install-dismissed-at";
const DISMISS_DAYS = 30;

/** Registers the service worker (not in development, where it is removed instead) and announces updates. */
export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") {
      // In development the worker would serve saved copies of pages while the dev server compiles, which shows stale HTML
      // that no longer matches the freshly compiled code (hydration errors). Remove any worker and cache left from earlier visits.
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => void r.unregister()))
        .catch(() => undefined);
      void globalThis.caches
        ?.keys()
        .then((keys) =>
          keys.filter((k) => k.startsWith("sagar-")).forEach((k) => void caches.delete(k)),
        )
        .catch(() => undefined);
      return;
    }
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker
      .register(SW_URL)
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
          });
        });
      })
      .catch(() => {
        // The site works normally without a service worker (unsupported browser, private mode, blocked).
      });
    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  if (!waiting) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 shadow-overlay"
    >
      <p className="text-body-md">A new version of the site is ready.</p>
      <Button size="sm" onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}>
        <RefreshCw aria-hidden className="mr-1.5 size-4" />
        Refresh
      </Button>
    </div>
  );
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Time the browser's saved copy of THIS page was stored (stamped by the service worker), or null if unknown. */
async function savedAt(): Promise<Date | null> {
  try {
    if (!("caches" in window)) return null;
    const res = await caches.match(window.location.href);
    const iso = res?.headers.get("x-sw-cached-at");
    return iso ? new Date(iso) : null;
  } catch {
    return null;
  }
}

/**
 * Shown ONLY while the browser reports no connection. It says plainly that what is on screen is a saved copy, when it
 * was saved, and that prices and availability may be out of date. Enquiries cannot be sent while offline.
 */
export function OfflineBanner() {
  const isOffline = useSyncExternalStore(
    subscribeOnline,
    () => !navigator.onLine,
    () => false,
  );
  const [saved, setSaved] = useState<Date | null>(null);

  useEffect(() => {
    if (!isOffline) return;
    let cancelled = false;
    savedAt().then((d) => {
      if (!cancelled) setSaved(d);
    });
    return () => {
      cancelled = true;
    };
  }, [isOffline]);

  if (!isOffline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-start justify-center gap-2 bg-warning px-4 py-2 text-center text-body-sm font-medium text-on-warning shadow-xs"
    >
      <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        You are offline — this is a saved copy
        {saved
          ? ` from ${saved.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
          : ""}
        . Prices and availability may be out of date. Enquiries can only be sent when you are
        online.
      </span>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Boolean(at) && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}
function rememberDismissal() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Storage unavailable: the prompt simply may reappear next visit.
  }
}
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIosSafari = () => {
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return iOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
};

/**
 * Install prompt. Chromium browsers: uses the browser's own install prompt on the customer's click. iOS Safari (no install
 * API): shows the manual "Add to Home Screen" steps. Never shown inside an installed app, remembered for 30 days once
 * dismissed, and it never claims the app is installed — only the browser's `appinstalled` event hides it.
 */
const noopSubscribe = () => () => {};

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [closed, setClosed] = useState(false);
  // Client-only facts, read without setState-in-effect (server snapshot: not eligible, so nothing renders on the server).
  const eligible = useSyncExternalStore(
    noopSubscribe,
    () => !isStandalone() && !recentlyDismissed(),
    () => false,
  );
  const ios = useSyncExternalStore(noopSubscribe, isIosSafari, () => false);

  useEffect(() => {
    if (!eligible) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setClosed(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [eligible]);

  function dismiss() {
    rememberDismissal();
    setClosed(true);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "dismissed") rememberDismissal();
    setClosed(true);
  }

  if (!eligible || closed || (!deferred && !ios)) return null;
  return (
    <aside
      aria-label="Install the Sagar Traders app"
      className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-overlay sm:left-auto sm:right-6 sm:w-96"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-title-md font-semibold text-primary">
            Add Sagar Traders to your home screen
          </p>
          <p className="text-body-sm text-on-surface-variant">
            Open the catalogue like an app. You can still browse saved pages offline; prices may be
            out of date.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss install suggestion"
          onClick={dismiss}
          className="-m-2 flex size-11 shrink-0 items-center justify-center rounded text-on-surface-variant hover:bg-surface-muted"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      {deferred ? (
        <Button size="sm" onClick={install}>
          <Download aria-hidden className="mr-1.5 size-4" />
          Install
        </Button>
      ) : (
        <p className="flex items-start gap-2 text-body-sm">
          <Share aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            In Safari tap the <strong>Share</strong> button, then choose{" "}
            <strong>Add to Home Screen</strong>.
          </span>
        </p>
      )}
    </aside>
  );
}
