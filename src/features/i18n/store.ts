"use client";

import { useSyncExternalStore } from "react";
import { SUPPORTED_LOCALES, type Locale } from "./types";

const LOCALE_KEY = "sagar-locale-v1";
const EASY_MODE_KEY = "sagar-easy-mode-v1";

let currentLocale: Locale | null = null;
let currentEasyMode: boolean | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function readLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const val = window.localStorage.getItem(LOCALE_KEY);
    if (val && (SUPPORTED_LOCALES as readonly string[]).includes(val)) {
      return val as Locale;
    }
  } catch {
    /* ignore */
  }
  return "en";
}

function readEasyMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(EASY_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setLocale(next: Locale) {
  currentLocale = next;
  try {
    window.localStorage.setItem(LOCALE_KEY, next);
    document.documentElement.lang = next;
  } catch {
    /* ignore */
  }
  notify();
}

export function setEasyMode(enabled: boolean) {
  currentEasyMode = enabled;
  try {
    window.localStorage.setItem(EASY_MODE_KEY, String(enabled));
    if (enabled) {
      document.documentElement.setAttribute("data-easy-mode", "true");
    } else {
      document.documentElement.removeAttribute("data-easy-mode");
    }
  } catch {
    /* ignore */
  }
  notify();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useLocale(): Locale {
  return useSyncExternalStore(
    subscribe,
    () => (currentLocale ??= readLocale()),
    () => "en",
  );
}

export function useEasyMode(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (currentEasyMode ??= readEasyMode()),
    () => false,
  );
}
