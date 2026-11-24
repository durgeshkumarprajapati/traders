"use client";

import { useSyncExternalStore } from "react";
import { MAX_COMPARE } from "./compare";

/**
 * The customer's comparison list: up to three product ids in this browser. Only ids are stored; the page re-reads every product
 * from the current catalogue and drops anything that is no longer available.
 */
export const COMPARE_KEY = "sagar-compare-v1";
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const EMPTY: readonly string[] = Object.freeze([]);
let ids: readonly string[] | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function clean(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return EMPTY;
  const out: string[] = [];
  for (const v of raw)
    if (typeof v === "string" && ID.test(v) && !out.includes(v) && out.length < MAX_COMPARE)
      out.push(v);
  return out;
}
function load(): readonly string[] {
  try {
    const raw = window.localStorage.getItem(COMPARE_KEY);
    return raw ? clean(JSON.parse(raw)) : EMPTY;
  } catch {
    return EMPTY;
  }
}
const snapshot = () => (ids ??= load());
function commit(next: readonly string[]) {
  ids = next;
  try {
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: kept in memory */
  }
  emit();
}
function onStorage(e: StorageEvent) {
  if (e.key === COMPARE_KEY || e.key === null) {
    ids = load();
    emit();
  }
}
function subscribe(l: () => void) {
  listeners.add(l);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export type AddResult = "added" | "exists" | "full" | "invalid";

export const compareStore = {
  add(id: string): AddResult {
    if (!ID.test(id)) return "invalid";
    const cur = snapshot();
    if (cur.includes(id)) return "exists";
    if (cur.length >= MAX_COMPARE) return "full";
    commit([...cur, id]);
    return "added";
  },
  remove(id: string) {
    commit(snapshot().filter((x) => x !== id));
  },
  toggle(id: string): AddResult | "removed" {
    if (snapshot().includes(id)) {
      this.remove(id);
      return "removed";
    }
    return this.add(id);
  },
  /** Replaces the list (used to sync with the URL; invalid / extra ids are dropped). */
  set(next: string[]) {
    const c = clean(next);
    const cur = snapshot();
    if (c.length !== cur.length || c.some((x, i) => x !== cur[i])) commit(c);
  },
  clear() {
    commit(EMPTY);
  },
  _reset() {
    ids = null;
    emit();
  },
};

export function useCompareIds(): readonly string[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
