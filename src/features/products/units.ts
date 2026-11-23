/**
 * Canonical product units (owner-confirmed list; see docs/PROJECT_BLUEPRINT.md §5.3).
 * - `TON` and `METRIC_TON` are different units and are NEVER converted into each other.
 * - `CUSTOM` carries a user-defined display label.
 * - "50 kg Bag" is a pack description and "3m Length" a product size: neither is a unit.
 */
export const UNIT_CODES = [
  "BAG",
  "PIECE",
  "KG",
  "TON",
  "METRIC_TON",
  "CUBIC_FEET",
  "CUBIC_METER",
  "BUNDLE",
  "BOX",
  "METER",
  "BRASS",
  "BLOCK",
  "CUSTOM",
] as const;

export type UnitCode = (typeof UNIT_CODES)[number];

export const UNIT_LABELS: Record<UnitCode, string> = {
  BAG: "Bag",
  PIECE: "Piece",
  KG: "Kg",
  TON: "Ton",
  METRIC_TON: "Metric Ton",
  CUBIC_FEET: "Cubic Feet",
  CUBIC_METER: "Cubic Meter",
  BUNDLE: "Bundle",
  BOX: "Box",
  METER: "Meter",
  BRASS: "Brass",
  BLOCK: "Block",
  CUSTOM: "Custom unit",
};

export type ProductUnit = { code: UnitCode; customLabel?: string };

export function isUnitCode(value: unknown): value is UnitCode {
  return typeof value === "string" && (UNIT_CODES as readonly string[]).includes(value);
}

/** Display text for a unit. `CUSTOM` shows its user-defined label; a CUSTOM unit without a label is invalid. */
export function unitLabel(unit: ProductUnit): string {
  if (unit.code === "CUSTOM") {
    const label = unit.customLabel?.trim();
    return label ? label : UNIT_LABELS.CUSTOM;
  }
  return UNIT_LABELS[unit.code];
}

/** True when a unit is internally consistent (CUSTOM needs a label; others must not carry one). */
export function isValidUnit(unit: ProductUnit): boolean {
  const hasLabel = Boolean(unit.customLabel?.trim());
  return unit.code === "CUSTOM" ? hasLabel : !hasLabel;
}

export type UnitOption = { code: UnitCode; label: string };

/**
 * Filter options for the units that actually occur in the catalogue, in canonical order. `TON` and `METRIC_TON` stay separate
 * options; every `CUSTOM` unit shares one option (its per-product display label is shown on the product itself).
 */
export function availableUnitOptions(products: Array<{ unit: ProductUnit }>): UnitOption[] {
  const present = new Set(products.map((p) => p.unit.code));
  return UNIT_CODES.filter((c) => present.has(c)).map((code) => ({
    code,
    label: code === "CUSTOM" ? "Other units" : UNIT_LABELS[code],
  }));
}
