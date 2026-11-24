import {
  AGGREGATE_DENSITY_KG_M3,
  CEMENT_BAG_VOLUME_M3,
  CEMENT_BAG_WEIGHT_KG,
  CUBIC_FEET_PER_CUBIC_METRE,
  DRY_VOLUME_FACTOR,
  LENGTH_UNITS,
  MAX_BAR_COUNT,
  MAX_DIMENSION_METRES,
  MAX_JOINT_MM,
  MAX_UNIT_SIZE_MM,
  MAX_WASTAGE_PERCENT,
  MIN_DIMENSION_METRES,
  MIN_UNIT_SIZE_MM,
  MIX_RATIOS,
  SAND_DENSITY_KG_M3,
  STEEL_DENSITY_KG_M3,
  STEEL_DIAMETERS_MM,
  type LengthUnit,
  type MixRatioId,
} from "./config";

/**
 * Pure calculation functions (no React, no I/O). Quantities here are physical estimates, not money, so ordinary floating-point
 * maths is appropriate; results are rounded only for display, and "suggested purchase" quantities round UP.
 */

export type FieldErrors = Record<string, string>;
export type Row = {
  key: string;
  label: string;
  /** Exact result of the formula, before wastage. */
  theoretical: number;
  /** After wastage (equals `theoretical` when wastage is 0 or not applicable). */
  withWastage: number;
  /** Rounded UP to something purchasable. */
  suggested: number;
  unit: string;
};
export type CalcResult = {
  rows: Row[];
  steps: string[];
  assumptions: string[];
  /** Extra values worth showing that are not purchase rows (e.g. concrete volume). */
  summary: Array<{ label: string; value: string }>;
};
export type CalcOutcome = { ok: true; result: CalcResult } | { ok: false; errors: FieldErrors };

const r = (n: number, dp = 2) => Math.round((n + Number.EPSILON) * 10 ** dp) / 10 ** dp;
const fmt = (n: number, dp = 3) => String(r(n, dp));
export const ceilTo = (n: number, step = 1) => Math.ceil(n / step - 1e-6) * step;

function dimension(
  value: number,
  unit: LengthUnit,
  field: string,
  label: string,
  errors: FieldErrors,
): number {
  if (value === undefined || value === null || Number.isNaN(value)) {
    errors[field] = `${label} is required.`;
    return 0;
  }
  if (!Number.isFinite(value)) {
    errors[field] = `${label} must be a valid number.`;
    return 0;
  }
  if (value <= 0) {
    errors[field] = `${label} must be greater than zero.`;
    return 0;
  }
  const m = value * LENGTH_UNITS[unit].toMetres;
  if (m > MAX_DIMENSION_METRES)
    errors[field] = `${label} is too large (maximum ${MAX_DIMENSION_METRES} m).`;
  else if (m < MIN_DIMENSION_METRES) errors[field] = `${label} is too small.`;
  return m;
}

function wastage(percent: number | undefined, errors: FieldErrors): number {
  const p = percent ?? 0;
  if (!Number.isFinite(p) || p < 0 || p > MAX_WASTAGE_PERCENT) {
    errors.wastage = `Wastage must be between 0 and ${MAX_WASTAGE_PERCENT}%.`;
    return 0;
  }
  return p;
}

// ── Concrete ─────────────────────────────────────────────────────────────────────────────────────────────────────

export type ConcreteInput = { length: number; width: number; depth: number; unit: LengthUnit };

export type ConcreteVolume = { cubicMetres: number; cubicFeet: number; lines: string[] };

export function concreteVolume(
  i: ConcreteInput,
): { ok: true; value: ConcreteVolume } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (!(i.unit in LENGTH_UNITS)) errors.unit = "Choose a measurement unit.";
  const unit = i.unit in LENGTH_UNITS ? i.unit : "m";
  const L = dimension(i.length, unit, "length", "Length", errors);
  const W = dimension(i.width, unit, "width", "Width", errors);
  const D = dimension(i.depth, unit, "depth", "Depth or thickness", errors);
  if (Object.keys(errors).length) return { ok: false, errors };
  const m3 = L * W * D;
  return {
    ok: true,
    value: {
      cubicMetres: m3,
      cubicFeet: m3 * CUBIC_FEET_PER_CUBIC_METRE,
      lines: [
        `Convert to metres: length ${fmt(L)} m, width ${fmt(W)} m, depth ${fmt(D)} m (1 ${unit} = ${LENGTH_UNITS[unit].toMetres} m).`,
        `Volume = length × width × depth = ${fmt(L)} × ${fmt(W)} × ${fmt(D)} = ${fmt(m3, 4)} m³.`,
        `In cubic feet: ${fmt(m3, 4)} m³ × ${fmt(CUBIC_FEET_PER_CUBIC_METRE, 4)} = ${fmt(m3 * CUBIC_FEET_PER_CUBIC_METRE, 3)} ft³.`,
      ],
    },
  };
}

export function calculateConcrete(i: ConcreteInput): CalcOutcome {
  const v = concreteVolume(i);
  if (!v.ok) return v;
  return {
    ok: true,
    result: {
      rows: [],
      steps: v.value.lines,
      assumptions: [
        "Volume of the finished (wet) concrete only. Cement, sand and aggregate are estimated in the next calculator.",
      ],
      summary: [
        { label: "Concrete volume", value: `${fmt(v.value.cubicMetres, 3)} m³` },
        { label: "Concrete volume", value: `${fmt(v.value.cubicFeet, 2)} ft³` },
      ],
    },
  };
}

// ── Cement, sand and aggregate for a mix ─────────────────────────────────────────────────────────────────────────

export type MixInput = ConcreteInput & { mix: MixRatioId; wastagePercent?: number };

export function calculateMix(i: MixInput): CalcOutcome {
  const v = concreteVolume(i);
  const errors: FieldErrors = v.ok ? {} : { ...v.errors };
  const mix = MIX_RATIOS.find((m) => m.id === i.mix);
  if (!mix) errors.mix = "Choose a mix ratio.";
  const w = wastage(i.wastagePercent, errors);
  if (!v.ok || !mix || Object.keys(errors).length) return { ok: false, errors };

  const wet = v.value.cubicMetres;
  const dry = wet * DRY_VOLUME_FACTOR;
  const parts = mix.cement + mix.sand + mix.aggregate;
  const factor = 1 + w / 100;
  const cementM3 = (dry * mix.cement) / parts;
  const sandM3 = (dry * mix.sand) / parts;
  const aggM3 = (dry * mix.aggregate) / parts;
  const bags = cementM3 / CEMENT_BAG_VOLUME_M3;
  const ft = CUBIC_FEET_PER_CUBIC_METRE;

  return {
    ok: true,
    result: {
      steps: [
        ...v.value.lines,
        `Dry volume = wet volume × ${DRY_VOLUME_FACTOR} = ${fmt(wet, 4)} × ${DRY_VOLUME_FACTOR} = ${fmt(dry, 4)} m³.`,
        `Mix ${mix.label} → total parts = ${fmt(parts, 2)}; cement share = ${fmt(mix.cement, 2)}/${fmt(parts, 2)}.`,
        `Cement volume = dry volume × ${fmt(mix.cement, 2)}/${fmt(parts, 2)} = ${fmt(cementM3, 4)} m³; one ${CEMENT_BAG_WEIGHT_KG} kg bag = ${fmt(CEMENT_BAG_VOLUME_M3, 5)} m³, so bags = ${fmt(bags, 3)}.`,
        `Sand volume = dry volume × ${fmt(mix.sand, 2)}/${fmt(parts, 2)} = ${fmt(sandM3, 4)} m³ (${fmt(sandM3 * ft, 2)} ft³).`,
        `Aggregate volume = dry volume × ${fmt(mix.aggregate, 2)}/${fmt(parts, 2)} = ${fmt(aggM3, 4)} m³ (${fmt(aggM3 * ft, 2)} ft³).`,
        `Wastage ${fmt(w, 2)}% applied: quantities × ${fmt(factor, 4)}. The suggested purchase quantity is rounded UP.`,
      ],
      assumptions: [
        `Dry-volume factor ${DRY_VOLUME_FACTOR}.`,
        `Cement bag ${CEMENT_BAG_WEIGHT_KG} kg at ${CEMENT_BAG_WEIGHT_KG / CEMENT_BAG_VOLUME_M3} kg/m³ density (${fmt(CEMENT_BAG_VOLUME_M3, 5)} m³ per bag).`,
        `Sand bulk density ${SAND_DENSITY_KG_M3} kg/m³; aggregate bulk density ${AGGREGATE_DENSITY_KG_M3} kg/m³ (used only for the weights).`,
        `Wastage ${fmt(w, 2)}% (you can change it).`,
        "The mix ratio is only used for the arithmetic. Whether a ratio suits a particular element is for a structural engineer to decide.",
      ],
      summary: [
        { label: "Concrete volume", value: `${fmt(wet, 3)} m³ (${fmt(v.value.cubicFeet, 2)} ft³)` },
        { label: "Mix", value: mix.label },
        {
          label: "Cement weight (with wastage)",
          value: `${fmt(bags * factor * CEMENT_BAG_WEIGHT_KG, 0)} kg`,
        },
        {
          label: "Sand weight (with wastage)",
          value: `${fmt(sandM3 * factor * SAND_DENSITY_KG_M3, 0)} kg`,
        },
        {
          label: "Aggregate weight (with wastage)",
          value: `${fmt(aggM3 * factor * AGGREGATE_DENSITY_KG_M3, 0)} kg`,
        },
      ],
      rows: [
        {
          key: "cement",
          label: "Cement",
          theoretical: r(bags, 3),
          withWastage: r(bags * factor, 3),
          suggested: ceilTo(bags * factor),
          unit: `bags (${CEMENT_BAG_WEIGHT_KG} kg)`,
        },
        {
          key: "sand",
          label: "Sand",
          theoretical: r(sandM3 * ft, 2),
          withWastage: r(sandM3 * ft * factor, 2),
          suggested: ceilTo(sandM3 * ft * factor),
          unit: "cubic feet",
        },
        {
          key: "aggregate",
          label: "Aggregate",
          theoretical: r(aggM3 * ft, 2),
          withWastage: r(aggM3 * ft * factor, 2),
          suggested: ceilTo(aggM3 * ft * factor),
          unit: "cubic feet",
        },
      ],
    },
  };
}

// ── Bricks / blocks ──────────────────────────────────────────────────────────────────────────────────────────────

export type MasonryInput = {
  kind: "brick" | "block";
  wallLength: number;
  wallHeight: number;
  wallThickness: number;
  unit: LengthUnit;
  /** Opening area (doors/windows) in square units of `unit`; 0 or undefined = none. */
  openingArea?: number;
  /** Unit size in millimetres — must be provided (a preset the customer picked, or their own). */
  unitLength: number;
  unitWidth: number;
  unitHeight: number;
  jointMm: number;
  wastagePercent?: number;
};

function sizeMm(v: number, field: string, label: string, errors: FieldErrors) {
  if (v === undefined || Number.isNaN(v)) errors[field] = `${label} is required.`;
  else if (!Number.isFinite(v) || v < MIN_UNIT_SIZE_MM || v > MAX_UNIT_SIZE_MM)
    errors[field] = `${label} must be between ${MIN_UNIT_SIZE_MM} and ${MAX_UNIT_SIZE_MM} mm.`;
}

export function calculateMasonry(i: MasonryInput): CalcOutcome {
  const errors: FieldErrors = {};
  const unit = i.unit in LENGTH_UNITS ? i.unit : "m";
  if (!(i.unit in LENGTH_UNITS)) errors.unit = "Choose a measurement unit.";
  const L = dimension(i.wallLength, unit, "wallLength", "Wall length", errors);
  const H = dimension(i.wallHeight, unit, "wallHeight", "Wall height", errors);
  const T = dimension(i.wallThickness, unit, "wallThickness", "Wall thickness", errors);
  sizeMm(i.unitLength, "unitLength", `${i.kind === "brick" ? "Brick" : "Block"} length`, errors);
  sizeMm(i.unitWidth, "unitWidth", `${i.kind === "brick" ? "Brick" : "Block"} width`, errors);
  sizeMm(i.unitHeight, "unitHeight", `${i.kind === "brick" ? "Brick" : "Block"} height`, errors);
  if (i.jointMm === undefined || Number.isNaN(i.jointMm))
    errors.jointMm = "Mortar joint thickness is required (enter 0 for none).";
  else if (!Number.isFinite(i.jointMm) || i.jointMm < 0 || i.jointMm > MAX_JOINT_MM)
    errors.jointMm = `Joint thickness must be between 0 and ${MAX_JOINT_MM} mm.`;
  const w = wastage(i.wastagePercent, errors);
  const openingUnits = i.openingArea ?? 0;
  if (!Number.isFinite(openingUnits) || openingUnits < 0)
    errors.openingArea = "Opening area cannot be negative.";
  if (Object.keys(errors).length) return { ok: false, errors };

  const opening = openingUnits * LENGTH_UNITS[unit].toMetres ** 2;
  const grossArea = L * H;
  if (opening >= grossArea)
    return { ok: false, errors: { openingArea: "Openings must be smaller than the wall area." } };
  const netArea = grossArea - opening;
  const netVolume = netArea * T;
  const j = i.jointMm / 1000;
  const unitModuleM3 =
    (i.unitLength / 1000 + j) * (i.unitWidth / 1000 + j) * (i.unitHeight / 1000 + j);
  const count = netVolume / unitModuleM3;
  const factor = 1 + w / 100;
  const name = i.kind === "brick" ? "Bricks" : "Blocks";

  return {
    ok: true,
    result: {
      steps: [
        `Wall area = length × height = ${fmt(L)} × ${fmt(H)} = ${fmt(grossArea, 3)} m².`,
        `Net area = wall area − openings = ${fmt(grossArea, 3)} − ${fmt(opening, 3)} = ${fmt(netArea, 3)} m².`,
        `Net wall volume = net area × thickness ${fmt(T)} m = ${fmt(netVolume, 4)} m³.`,
        `One ${i.kind} with its mortar joint occupies (${i.unitLength} + ${i.jointMm}) × (${i.unitWidth} + ${i.jointMm}) × (${i.unitHeight} + ${i.jointMm}) mm = ${fmt(unitModuleM3, 6)} m³.`,
        `Count = net wall volume ÷ ${i.kind} volume = ${fmt(netVolume, 4)} ÷ ${fmt(unitModuleM3, 6)} = ${fmt(count, 1)}.`,
        `Wastage ${fmt(w, 2)}% applied: × ${fmt(factor, 4)}. The suggested quantity is rounded UP.`,
      ],
      assumptions: [
        `${i.kind === "brick" ? "Brick" : "Block"} size ${i.unitLength} × ${i.unitWidth} × ${i.unitHeight} mm and joint ${i.jointMm} mm exactly as you entered / selected — real products vary by maker.`,
        "Counted by volume: wall thickness is the thickness you entered; it is not checked against the unit size or the bond pattern.",
        `Wastage ${fmt(w, 2)}%.`,
        "Mortar, plaster, lintels and corners are not included.",
      ],
      summary: [
        { label: "Wall area (net)", value: `${fmt(netArea, 2)} m²` },
        { label: "Wall volume (net)", value: `${fmt(netVolume, 3)} m³` },
      ],
      rows: [
        {
          key: i.kind,
          label: name,
          theoretical: r(count, 1),
          withWastage: r(count * factor, 1),
          suggested: ceilTo(count * factor),
          unit: "pieces",
        },
      ],
    },
  };
}

// ── Steel (conservative) ─────────────────────────────────────────────────────────────────────────────────────────

export const steelKgPerMetre = (diameterMm: number) =>
  (Math.PI / 4) * (diameterMm / 1000) ** 2 * STEEL_DENSITY_KG_M3;

function steelDiameter(d: number, errors: FieldErrors) {
  if (!(STEEL_DIAMETERS_MM as readonly number[]).includes(d))
    errors.diameter = "Choose a bar diameter from the list.";
}

export type SteelBarsInput = {
  diameterMm: number;
  barCount: number;
  barLength: number;
  unit: LengthUnit;
};

/** Weight of a stated number of bars of a stated length and diameter. No layout is assumed. */
export function calculateSteelBars(i: SteelBarsInput): CalcOutcome {
  const errors: FieldErrors = {};
  steelDiameter(i.diameterMm, errors);
  if (i.barCount === undefined || Number.isNaN(i.barCount))
    errors.barCount = "Number of bars is required.";
  else if (!Number.isInteger(i.barCount) || i.barCount < 1 || i.barCount > MAX_BAR_COUNT)
    errors.barCount = `Number of bars must be a whole number from 1 to ${MAX_BAR_COUNT}.`;
  const unit = i.unit in LENGTH_UNITS ? i.unit : "m";
  const len = dimension(i.barLength, unit, "barLength", "Length of each bar", errors);
  if (Object.keys(errors).length) return { ok: false, errors };
  const perM = steelKgPerMetre(i.diameterMm);
  const total = i.barCount * len;
  const kg = total * perM;
  return {
    ok: true,
    result: {
      steps: [
        `Weight per metre = π/4 × d² × density = π/4 × (${i.diameterMm / 1000} m)² × ${STEEL_DENSITY_KG_M3} = ${fmt(perM, 4)} kg/m.`,
        `Total bar length = bars × length = ${i.barCount} × ${fmt(len)} m = ${fmt(total, 2)} m.`,
        `Weight = total length × weight per metre = ${fmt(total, 2)} × ${fmt(perM, 4)} = ${fmt(kg, 2)} kg.`,
      ],
      assumptions: [
        `Steel density ${STEEL_DENSITY_KG_M3} kg/m³, plain round section of the stated diameter.`,
        "Only the bars you counted. Laps, hooks, bends, cover, stirrups and extra bars are NOT included.",
      ],
      summary: [
        { label: "Total bar length", value: `${fmt(total, 2)} m` },
        { label: "Estimated weight", value: `${fmt(kg, 1)} kg (${fmt(kg / 1000, 3)} tonnes)` },
      ],
      rows: [
        {
          key: "steel",
          label: `Steel bars ${i.diameterMm} mm`,
          theoretical: r(kg, 2),
          withWastage: r(kg, 2),
          suggested: ceilTo(kg, 1),
          unit: "kg",
        },
      ],
    },
  };
}

export type SteelMeshInput = {
  panelLength: number;
  panelWidth: number;
  spacing: number;
  diameterMm: number;
  unit: LengthUnit;
};

/** One layer of bars in BOTH directions across a rectangular panel at a stated spacing. Nothing else is assumed. */
export function calculateSteelMesh(i: SteelMeshInput): CalcOutcome {
  const errors: FieldErrors = {};
  steelDiameter(i.diameterMm, errors);
  const unit = i.unit in LENGTH_UNITS ? i.unit : "m";
  const L = dimension(i.panelLength, unit, "panelLength", "Panel length", errors);
  const W = dimension(i.panelWidth, unit, "panelWidth", "Panel width", errors);
  const S = dimension(i.spacing, unit, "spacing", "Bar spacing", errors);
  if (!errors.spacing && !errors.panelLength && !errors.panelWidth && (S > L || S > W))
    errors.spacing = "Bar spacing cannot be larger than the panel.";
  if (Object.keys(errors).length) return { ok: false, errors };
  const alongL = Math.floor(W / S + 1e-9) + 1; // bars running the length, spaced across the width
  const alongW = Math.floor(L / S + 1e-9) + 1;
  const total = alongL * L + alongW * W;
  const perM = steelKgPerMetre(i.diameterMm);
  const kg = total * perM;
  return {
    ok: true,
    result: {
      steps: [
        `Bars running along the length = ⌊width ÷ spacing⌋ + 1 = ⌊${fmt(W)} ÷ ${fmt(S)}⌋ + 1 = ${alongL}, each ${fmt(L)} m.`,
        `Bars running along the width = ⌊length ÷ spacing⌋ + 1 = ⌊${fmt(L)} ÷ ${fmt(S)}⌋ + 1 = ${alongW}, each ${fmt(W)} m.`,
        `Total bar length = ${alongL} × ${fmt(L)} + ${alongW} × ${fmt(W)} = ${fmt(total, 2)} m.`,
        `Weight per metre (${i.diameterMm} mm) = ${fmt(perM, 4)} kg/m → weight = ${fmt(total, 2)} × ${fmt(perM, 4)} = ${fmt(kg, 2)} kg.`,
      ],
      assumptions: [
        "ONE layer of bars in each direction at the stated spacing, over the whole panel.",
        `Steel density ${STEEL_DENSITY_KG_M3} kg/m³.`,
        "Concrete cover, laps, hooks, bends, edge or additional bars, top steel, beams, columns and stirrups are NOT included.",
      ],
      summary: [
        { label: "Total bar length", value: `${fmt(total, 2)} m` },
        { label: "Estimated weight", value: `${fmt(kg, 1)} kg (${fmt(kg / 1000, 3)} tonnes)` },
      ],
      rows: [
        {
          key: "steel",
          label: `Steel bars ${i.diameterMm} mm`,
          theoretical: r(kg, 2),
          withWastage: r(kg, 2),
          suggested: ceilTo(kg, 1),
          unit: "kg",
        },
      ],
    },
  };
}
