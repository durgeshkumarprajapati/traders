/**
 * Construction-calculator constants. EVERY assumption the calculator makes lives in this file and is shown to the customer
 * next to the result — nothing is hidden in formulas.
 *
 * These are common planning values, NOT standards, specifications or engineering advice. Real cement bags, sand, aggregate
 * and steel differ by source and moisture; actual consumption depends on site practice. The owner/engineer may change a value
 * here and the on-screen assumptions and the tests (which carry independently hand-computed samples) will follow.
 */

/** Supported length units for wall / slab dimensions, with their exact conversion to metres. */
export const LENGTH_UNITS = {
  ft: { label: "Feet", toMetres: 0.3048 },
  in: { label: "Inches", toMetres: 0.0254 },
  m: { label: "Metres", toMetres: 1 },
  cm: { label: "Centimetres", toMetres: 0.01 },
} as const;
export type LengthUnit = keyof typeof LENGTH_UNITS;

/** 1 m³ expressed in ft³: exactly 1 / 0.3048³. */
export const CUBIC_FEET_PER_CUBIC_METRE = 1 / 0.3048 ** 3;

/** Safety limits: anything beyond this is treated as a typing error, not a real dimension. */
export const MAX_DIMENSION_METRES = 1000;
export const MIN_DIMENSION_METRES = 0.001;
export const MAX_WASTAGE_PERCENT = 25;
export const DEFAULT_WASTAGE_PERCENT = 5;

/**
 * Wet → dry volume multiplier. Concrete loses volume when mixed; a dry-volume factor of about 1.54 is the usual planning
 * allowance (values between roughly 1.52 and 1.57 are quoted).
 */
export const DRY_VOLUME_FACTOR = 1.54;

/** Cement: 50 kg bag, bulk density 1440 kg/m³ → one bag occupies 50 / 1440 m³ ≈ 0.0347 m³. */
export const CEMENT_BAG_WEIGHT_KG = 50;
export const CEMENT_DENSITY_KG_M3 = 1440;
export const CEMENT_BAG_VOLUME_M3 = CEMENT_BAG_WEIGHT_KG / CEMENT_DENSITY_KG_M3;

/** Loose dry bulk densities used only to give a weight alongside the volume. */
export const SAND_DENSITY_KG_M3 = 1600;
export const AGGREGATE_DENSITY_KG_M3 = 1500;

/**
 * Mix ratios offered (cement : sand : aggregate by volume). They are listed so the arithmetic can be done — NOT as advice that a
 * ratio suits a given element; the structural engineer decides that.
 */
export const MIX_RATIOS = [
  { id: "1:1:2", label: "1 : 1 : 2", cement: 1, sand: 1, aggregate: 2 },
  { id: "1:1.5:3", label: "1 : 1.5 : 3", cement: 1, sand: 1.5, aggregate: 3 },
  { id: "1:2:4", label: "1 : 2 : 4", cement: 1, sand: 2, aggregate: 4 },
  { id: "1:3:6", label: "1 : 3 : 6", cement: 1, sand: 3, aggregate: 6 },
] as const;
export type MixRatioId = (typeof MIX_RATIOS)[number]["id"];

/**
 * Nominal unit sizes (mm) offered as starting points. Real products vary by maker — the customer must pick one or enter their
 * own; the calculator never assumes a size on their behalf.
 */
export const UNIT_SIZE_PRESETS = [
  {
    id: "modular-brick",
    label: "Modular brick 190 × 90 × 90 mm",
    kind: "brick",
    length: 190,
    width: 90,
    height: 90,
  },
  {
    id: "traditional-brick",
    label: "Traditional brick 230 × 110 × 70 mm",
    kind: "brick",
    length: 230,
    width: 110,
    height: 70,
  },
  {
    id: "aac-100",
    label: "AAC block 600 × 100 × 200 mm",
    kind: "block",
    length: 600,
    width: 100,
    height: 200,
  },
  {
    id: "aac-150",
    label: "AAC block 600 × 150 × 200 mm",
    kind: "block",
    length: 600,
    width: 150,
    height: 200,
  },
  {
    id: "aac-200",
    label: "AAC block 600 × 200 × 200 mm",
    kind: "block",
    length: 600,
    width: 200,
    height: 200,
  },
  {
    id: "concrete-block",
    label: "Concrete block 400 × 200 × 200 mm",
    kind: "block",
    length: 400,
    width: 200,
    height: 200,
  },
] as const;
export const MAX_UNIT_SIZE_MM = 2000;
export const MIN_UNIT_SIZE_MM = 10;
export const MAX_JOINT_MM = 50;

/** Steel: density 7850 kg/m³ → weight per metre = π/4 · d² · 7850. Diameters (mm) offered for the bar calculators. */
export const STEEL_DENSITY_KG_M3 = 7850;
export const STEEL_DIAMETERS_MM = [6, 8, 10, 12, 16, 20, 25, 32] as const;
export type SteelDiameter = (typeof STEEL_DIAMETERS_MM)[number];
export const MAX_BAR_COUNT = 100_000;

export const ESTIMATE_DISCLAIMER =
  "These are approximate planning estimates, not an engineering specification. Quantities depend on site conditions, material quality and workmanship; the final quantity is confirmed by Sagar Traders when you request a quotation.";

export const STEEL_DISCLAIMER =
  "Steel quantities are preliminary estimates only. Final reinforcement requirements must be confirmed by a qualified structural engineer using approved structural drawings.";
