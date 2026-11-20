"use client";

import { useSyncExternalStore } from "react";

/**
 * Browser-side enquiry list (a quotation list, NOT a shopping cart). It stores ONLY
 * `productId` + `quantity`: names, prices and units are never persisted client-side and the
 * server re-reads authoritative data on submission (Phase 6).
 * Persistence in localStorage is PROVISIONAL (owner decision pending); failures degrade to in-memory.
 */
export type EnquiryItem = { productId: string; quantity: number };

export const ENQUIRY_LIST_KEY = "sagar-enquiry-list-v1";
export const MAX_ENQUIRY_ITEMS = 50;
const MAX_QUANTITY = 1_000_000;

const EMPTY: readonly EnquiryItem[] = Object.freeze([]);
let items: readonly EnquiryItem[] | null = null; // null = not yet loaded from storage
const listeners = new Set<() => void>();

function sanitize(raw: unknown): readonly EnquiryItem[] {
  if (!Array.isArray(raw)) return EMPTY;
  const seen = new Set<string>();
  const out: EnquiryItem[] = [];
  for (const r of raw) {
    const id = (r as EnquiryItem)?.productId;
    const q = (r as EnquiryItem)?.quantity;
    if (typeof id !== "string" || !id || seen.has(id)) continue;
    if (typeof q !== "number" || !Number.isFinite(q) || q <= 0 || q > MAX_QUANTITY) continue;
    seen.add(id);
    out.push({ productId: id, quantity: q });
    if (out.length >= MAX_ENQUIRY_ITEMS) break;
  }
  return out;
}

function load(): readonly EnquiryItem[] {
  try {
    const raw = window.localStorage.getItem(ENQUIRY_LIST_KEY);
    return raw ? sanitize(JSON.parse(raw)) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function commit(next: readonly EnquiryItem[]) {
  items = next;
  try {
    window.localStorage.setItem(ENQUIRY_LIST_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable (private mode, quota): keep in-memory state */
  }
  emit();
}

function getSnapshot(): readonly EnquiryItem[] {
  if (items === null) items = load();
  return items;
}

function onStorage(e: StorageEvent) {
  if (e.key === ENQUIRY_LIST_KEY || e.key === null) {
    items = load();
    emit();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export const enquiryList = {
  /** Add a product (or increase its quantity). Returns false when the list is full. */
  add(productId: string, quantity = 1): boolean {
    const current = getSnapshot();
    const existing = current.find((i) => i.productId === productId);
    if (existing) {
      commit(
        current.map((i) =>
          i === existing ? { ...i, quantity: Math.min(i.quantity + quantity, MAX_QUANTITY) } : i,
        ),
      );
      return true;
    }
    if (current.length >= MAX_ENQUIRY_ITEMS) return false;
    commit([...current, { productId, quantity: Math.min(quantity, MAX_QUANTITY) }]);
    return true;
  },
  setQuantity(productId: string, quantity: number) {
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) return;
    commit(getSnapshot().map((i) => (i.productId === productId ? { ...i, quantity } : i)));
  },
  remove(productId: string) {
    commit(getSnapshot().filter((i) => i.productId !== productId));
  },
  clear() {
    commit(EMPTY);
  },
  /** Test helper: forget in-memory state so the next read reloads from storage. */
  _reset() {
    items = null;
    emit();
  },
};

/** Current list. Server/first-hydration render is always empty, so there is no hydration mismatch. */
export function useEnquiryItems(): readonly EnquiryItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
