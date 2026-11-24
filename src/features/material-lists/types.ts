import { z } from "zod";

/**
 * Shared model for saved material lists AND project checklists (one item type, one validator) — a project simply contains a
 * list of the same items. Everything is stored only in the customer's browser. A catalogue-linked item stores the product id
 * plus a NAME snapshot for display; prices, stock and units are never stored — they are re-read from the catalogue whenever a
 * list is opened or sent.
 */
export const LIMITS = {
  lists: 50,
  projects: 30,
  itemsPerList: 100,
  name: 80,
  notes: 500,
  itemName: 200,
  itemNotes: 300,
  unit: 40,
  location: 120,
  measurements: 20,
  measurementText: 40,
  maxQuantity: 1_000_000,
} as const;

export const PRODUCT_ID = /^[A-Za-z0-9_-]{1,64}$/;

export const itemSchema = z.object({
  id: z.string().min(1).max(64),
  /** Catalogue product id, or null for a custom requirement that is not a catalogue product. */
  productId: z.string().regex(PRODUCT_ID).nullable(),
  name: z.string().trim().min(1).max(LIMITS.itemName),
  quantity: z.number().finite().positive().max(LIMITS.maxQuantity),
  unit: z.string().trim().max(LIMITS.unit).default(""),
  notes: z.string().trim().max(LIMITS.itemNotes).default(""),
  /** ESTIMATED = came from the calculator; MANUAL = typed by the customer. */
  source: z.enum(["ESTIMATED", "MANUAL"]).default("MANUAL"),
});
export type MaterialItem = z.infer<typeof itemSchema>;

const base = {
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(LIMITS.name),
  notes: z.string().trim().max(LIMITS.notes).default(""),
  items: z.array(itemSchema).max(LIMITS.itemsPerList).default([]),
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40),
};

export const listSchema = z.object(base);
export type MaterialList = z.infer<typeof listSchema>;

export const PROJECT_TYPES = ["HOUSE", "ROOM", "BOUNDARY_WALL", "RENOVATION", "CUSTOM"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];
export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  HOUSE: "House construction",
  ROOM: "Room construction",
  BOUNDARY_WALL: "Boundary wall",
  RENOVATION: "Renovation",
  CUSTOM: "Custom project",
};

export const projectSchema = z.object({
  ...base,
  type: z.enum(PROJECT_TYPES),
  location: z.string().trim().max(LIMITS.location).default(""),
  /** Free-text label/value pairs the customer wants to remember (e.g. "Plot length" / "30 ft"). Never used in a calculation. */
  measurements: z
    .array(
      z.object({
        label: z.string().trim().max(LIMITS.measurementText),
        value: z.string().trim().max(LIMITS.measurementText),
      }),
    )
    .max(LIMITS.measurements)
    .default([]),
});
export type Project = z.infer<typeof projectSchema>;

export type MaterialData = { lists: MaterialList[]; projects: Project[] };

/** Current on-disk format. Bump when the shape changes and add a step to `migrate` in store.ts. */
export const STORAGE_VERSION = 1;
export const STORAGE_KEY = "sagar-material-data-v1";
