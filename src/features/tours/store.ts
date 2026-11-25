"use client";

import { useSyncExternalStore } from "react";
import { TOUR_DEFINITIONS } from "./config";

const TOUR_KEY = "sagar-tour-state-v1";

export interface TourState {
  welcomeDismissed: boolean;
  completedTours: string[];
  activeTourId: string | null;
  stepIndex: number;
}

const DEFAULT_STATE: TourState = {
  welcomeDismissed: false,
  completedTours: [],
  activeTourId: null,
  stepIndex: 0,
};

let state: TourState | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function loadState(): TourState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(TOUR_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<TourState>;
    return {
      welcomeDismissed: Boolean(parsed.welcomeDismissed),
      completedTours: Array.isArray(parsed.completedTours) ? parsed.completedTours.map(String) : [],
      activeTourId: typeof parsed.activeTourId === "string" ? parsed.activeTourId : null,
      stepIndex: typeof parsed.stepIndex === "number" ? Math.max(0, parsed.stepIndex) : 0,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function save(next: TourState) {
  state = next;
  try {
    window.localStorage.setItem(TOUR_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  emit();
}

export const tourStore = {
  start(tourId = "welcome-overview") {
    const cur = state ?? loadState();
    save({ ...cur, welcomeDismissed: true, activeTourId: tourId, stepIndex: 0 });
  },
  next() {
    const cur = state ?? loadState();
    const def = TOUR_DEFINITIONS.find((d) => d.id === cur.activeTourId);
    if (!def) return;
    if (cur.stepIndex + 1 >= def.steps.length) {
      save({
        ...cur,
        activeTourId: null,
        stepIndex: 0,
        completedTours: Array.from(new Set([...cur.completedTours, def.id])),
      });
    } else {
      save({ ...cur, stepIndex: cur.stepIndex + 1 });
    }
  },
  prev() {
    const cur = state ?? loadState();
    save({ ...cur, stepIndex: Math.max(0, cur.stepIndex - 1) });
  },
  skip() {
    const cur = state ?? loadState();
    save({ ...cur, welcomeDismissed: true, activeTourId: null, stepIndex: 0 });
  },
  dismissWelcome() {
    const cur = state ?? loadState();
    save({ ...cur, welcomeDismissed: true });
  },
};

export function useTourState(): TourState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => (state ??= loadState()),
    () => DEFAULT_STATE,
  );
}
