"use client";

import { useSyncExternalStore } from "react";
import {
  LIMITS,
  STORAGE_KEY,
  STORAGE_VERSION,
  listSchema,
  projectSchema,
  type MaterialData,
  type MaterialItem,
  type MaterialList,
  type Project,
  type ProjectType,
} from "./types";

/**
 * Browser-only store for saved material lists and projects (no account, nothing sent anywhere until the customer chooses to
 * send an enquiry). Persistence is versioned and defensive:
 *   - every record is validated on load; an invalid record is dropped, the rest are kept;
 *   - an unreadable value is set aside under `<key>-corrupt` (never silently destroyed) and the store starts empty;
 *   - data written by a NEWER app version is backed up and never overwritten with an older shape;
 *   - a pre-versioned (v0) shape is migrated forward.
 * It stores no tokens, no personal data beyond what the customer types into names/notes, and no catalogue prices.
 */
export type StoreStatus = "ok" | "empty" | "recovered" | "future";
export type StoreState = MaterialData & { status: StoreStatus; persistFailed: boolean };

const EMPTY_STATE: StoreState = Object.freeze({
  lists: [],
  projects: [],
  status: "empty",
  persistFailed: false,
}) as StoreState;
const newId = () => {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};
const now = () => new Date().toISOString();

/** Forward-migrates an older stored shape to the current one. Returns null when the shape is unrecognisable. */
export function migrate(
  raw: unknown,
): { version: number; lists: unknown[]; projects: unknown[] } | null {
  if (Array.isArray(raw)) return { version: STORAGE_VERSION, lists: raw, projects: [] }; // v0: a bare array of lists
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const version = o.version === undefined ? 0 : o.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) return null;
  if (version > STORAGE_VERSION) return { version, lists: [], projects: [] };
  if (version === 0)
    return {
      version: STORAGE_VERSION,
      lists: Array.isArray(o.lists) ? o.lists : [],
      projects: Array.isArray(o.projects) ? o.projects : [],
    };
  return {
    version,
    lists: Array.isArray(o.lists) ? o.lists : [],
    projects: Array.isArray(o.projects) ? o.projects : [],
  };
}

export function parseStored(text: string | null): {
  state: StoreState;
  backup?: { key: string; value: string };
} {
  if (text === null || text === "") return { state: EMPTY_STATE };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      state: { ...EMPTY_STATE, status: "recovered" },
      backup: { key: `${STORAGE_KEY}-corrupt`, value: text.slice(0, 200_000) },
    };
  }
  const m = migrate(raw);
  if (!m)
    return {
      state: { ...EMPTY_STATE, status: "recovered" },
      backup: { key: `${STORAGE_KEY}-corrupt`, value: text.slice(0, 200_000) },
    };
  if (m.version > STORAGE_VERSION)
    return {
      state: { ...EMPTY_STATE, status: "future" },
      backup: { key: `${STORAGE_KEY}-future`, value: text.slice(0, 200_000) },
    };
  const lists: MaterialList[] = [];
  const projects: Project[] = [];
  let dropped = 0;
  const seen = new Set<string>();
  for (const l of m.lists) {
    const p = listSchema.safeParse(l);
    if (p.success && !seen.has(p.data.id) && lists.length < LIMITS.lists) {
      seen.add(p.data.id);
      lists.push(p.data);
    } else dropped++;
  }
  for (const pr of m.projects) {
    const p = projectSchema.safeParse(pr);
    if (p.success && !seen.has(p.data.id) && projects.length < LIMITS.projects) {
      seen.add(p.data.id);
      projects.push(p.data);
    } else dropped++;
  }
  const status: StoreStatus =
    dropped > 0 ? "recovered" : lists.length + projects.length === 0 ? "empty" : "ok";
  return {
    state: { lists, projects, status, persistFailed: false },
    backup:
      dropped > 0 ? { key: `${STORAGE_KEY}-corrupt`, value: text.slice(0, 200_000) } : undefined,
  };
}

let state: StoreState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load(): StoreState {
  try {
    const { state: s, backup } = parseStored(window.localStorage.getItem(STORAGE_KEY));
    if (backup) {
      try {
        window.localStorage.setItem(backup.key, backup.value);
      } catch {
        /* quota: keep going without a backup */
      }
    }
    return s;
  } catch {
    return EMPTY_STATE;
  }
}

function snapshot(): StoreState {
  if (state === null) state = load();
  return state;
}

function commit(next: Pick<StoreState, "lists" | "projects">) {
  const prev = snapshot();
  // Never overwrite data written by a newer version of the app.
  const keepStatus =
    prev.status === "future"
      ? "future"
      : next.lists.length + next.projects.length === 0
        ? "empty"
        : "ok";
  let persistFailed = false;
  if (prev.status !== "future") {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: STORAGE_VERSION, lists: next.lists, projects: next.projects }),
      );
    } catch {
      persistFailed = true; // private mode / quota: the data stays in memory for this visit
    }
  } else persistFailed = true;
  state = {
    ...next,
    status: keepStatus === "ok" && prev.status === "recovered" ? "ok" : keepStatus,
    persistFailed,
  };
  emit();
}

function onStorage(e: StorageEvent) {
  if (e.key === STORAGE_KEY || e.key === null) {
    state = load();
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

export function useMaterialData(): StoreState {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY_STATE);
}

export type Kind = "list" | "project";
const clampName = (s: string, fallback: string) => s.trim().slice(0, LIMITS.name) || fallback;

function bump<T extends { updatedAt: string }>(x: T): T {
  return { ...x, updatedAt: now() };
}

function mapKind(
  kind: Kind,
  id: string,
  fn: (x: MaterialList | Project) => MaterialList | Project,
): boolean {
  const s = snapshot();
  const coll = kind === "list" ? s.lists : s.projects;
  if (!coll.some((x) => x.id === id)) return false;
  const next = coll.map((x) => (x.id === id ? bump(fn(x)) : x));
  commit(
    kind === "list"
      ? { lists: next as MaterialList[], projects: s.projects }
      : { lists: s.lists, projects: next as Project[] },
  );
  return true;
}

export const materialStore = {
  createList(name: string, items: MaterialItem[] = [], notes = ""): string | null {
    const s = snapshot();
    if (s.lists.length >= LIMITS.lists) return null;
    const id = newId();
    const t = now();
    commit({
      lists: [
        ...s.lists,
        {
          id,
          name: clampName(name, "My list"),
          notes: notes.slice(0, LIMITS.notes),
          items: items.slice(0, LIMITS.itemsPerList),
          createdAt: t,
          updatedAt: t,
        },
      ],
      projects: s.projects,
    });
    return id;
  },
  createProject(input: {
    name: string;
    type: ProjectType;
    location?: string;
    notes?: string;
    items?: MaterialItem[];
  }): string | null {
    const s = snapshot();
    if (s.projects.length >= LIMITS.projects) return null;
    const id = newId();
    const t = now();
    commit({
      lists: s.lists,
      projects: [
        ...s.projects,
        {
          id,
          name: clampName(input.name, "My project"),
          type: input.type,
          location: (input.location ?? "").slice(0, LIMITS.location),
          notes: (input.notes ?? "").slice(0, LIMITS.notes),
          measurements: [],
          items: (input.items ?? []).slice(0, LIMITS.itemsPerList),
          createdAt: t,
          updatedAt: t,
        },
      ],
    });
    return id;
  },
  rename(kind: Kind, id: string, name: string) {
    return mapKind(kind, id, (x) => ({ ...x, name: clampName(name, x.name) }));
  },
  setNotes(kind: Kind, id: string, notes: string) {
    return mapKind(kind, id, (x) => ({ ...x, notes: notes.slice(0, LIMITS.notes) }));
  },
  updateProject(id: string, patch: Partial<Pick<Project, "type" | "location" | "measurements">>) {
    return mapKind("project", id, (x) => ({
      ...(x as Project),
      ...(patch.type ? { type: patch.type } : {}),
      ...(patch.location !== undefined
        ? { location: patch.location.slice(0, LIMITS.location) }
        : {}),
      ...(patch.measurements
        ? { measurements: patch.measurements.slice(0, LIMITS.measurements) }
        : {}),
    }));
  },
  duplicate(kind: Kind, id: string): string | null {
    const s = snapshot();
    const src = (kind === "list" ? s.lists : s.projects).find((x) => x.id === id);
    if (!src) return null;
    if (
      (kind === "list" ? s.lists : s.projects).length >=
      (kind === "list" ? LIMITS.lists : LIMITS.projects)
    )
      return null;
    const copyId = newId();
    const t = now();
    const copy = {
      ...src,
      id: copyId,
      name: `${src.name} (copy)`.slice(0, LIMITS.name),
      items: src.items.map((i) => ({ ...i, id: newId() })),
      createdAt: t,
      updatedAt: t,
    };
    commit(
      kind === "list"
        ? { lists: [...s.lists, copy as MaterialList], projects: s.projects }
        : { lists: s.lists, projects: [...s.projects, copy as Project] },
    );
    return copyId;
  },
  delete(kind: Kind, id: string) {
    const s = snapshot();
    commit(
      kind === "list"
        ? { lists: s.lists.filter((x) => x.id !== id), projects: s.projects }
        : { lists: s.lists, projects: s.projects.filter((x) => x.id !== id) },
    );
  },
  /** Adds an item, merging into an existing line for the same catalogue product (quantities add up). Returns false when full. */
  addItem(kind: Kind, id: string, item: Omit<MaterialItem, "id"> & { id?: string }): boolean {
    let ok = true;
    const changed = mapKind(kind, id, (x) => {
      const existing = item.productId
        ? x.items.find((i) => i.productId === item.productId)
        : undefined;
      if (existing) {
        return {
          ...x,
          items: x.items.map((i) =>
            i === existing
              ? { ...i, quantity: Math.min(i.quantity + item.quantity, LIMITS.maxQuantity) }
              : i,
          ),
        };
      }
      if (x.items.length >= LIMITS.itemsPerList) {
        ok = false;
        return x;
      }
      return {
        ...x,
        items: [
          ...x.items,
          {
            ...item,
            id: item.id ?? newId(),
            quantity: Math.min(item.quantity, LIMITS.maxQuantity),
          },
        ],
      };
    });
    return changed && ok;
  },
  updateItem(
    kind: Kind,
    id: string,
    itemId: string,
    patch: Partial<Pick<MaterialItem, "quantity" | "notes" | "name" | "unit">>,
  ) {
    if (
      patch.quantity !== undefined &&
      (!Number.isFinite(patch.quantity) ||
        patch.quantity <= 0 ||
        patch.quantity > LIMITS.maxQuantity)
    )
      return false;
    return mapKind(kind, id, (x) => ({
      ...x,
      items: x.items.map((i) =>
        i.id === itemId
          ? {
              ...i,
              ...(patch.quantity !== undefined
                ? { quantity: patch.quantity, source: "MANUAL" as const }
                : {}),
              ...(patch.notes !== undefined
                ? { notes: patch.notes.slice(0, LIMITS.itemNotes) }
                : {}),
              ...(patch.name !== undefined && !i.productId
                ? { name: patch.name.trim().slice(0, LIMITS.itemName) || i.name }
                : {}),
              ...(patch.unit !== undefined && !i.productId
                ? { unit: patch.unit.slice(0, LIMITS.unit) }
                : {}),
            }
          : i,
      ),
    }));
  },
  removeItem(kind: Kind, id: string, itemId: string) {
    return mapKind(kind, id, (x) => ({ ...x, items: x.items.filter((i) => i.id !== itemId) }));
  },
  /** Deletes the set-aside copy of unreadable data once the customer has seen the notice. */
  acknowledgeRecovery() {
    const s = snapshot();
    if (s.status === "recovered") {
      state = { ...s, status: s.lists.length + s.projects.length ? "ok" : "empty" };
      emit();
    }
  },
  /** Test helper: forget in-memory state so the next read reloads from storage. */
  _reset() {
    state = null;
    emit();
  },
};
