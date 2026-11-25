export type ProjectEstimateType = "WALL" | "FLOOR" | "ROOM" | "RESIDENTIAL_BASIC";

export interface EstimatorInput {
  projectType: ProjectEstimateType;
  lengthFt: number;
  widthFt: number;
  heightFt: number;
  wastagePercent: number;
}

export interface EstimatorLine {
  key: string;
  label: string;
  materialHint: string;
  quantity: number;
  unitLabel: string;
  formulaNote: string;
  matchedProductId?: string | null;
  matchedProductName?: string | null;
  unitPrice?: number | null;
  estimatedCost?: number | null;
}

export const ESTIMATOR_DISCLAIMER =
  "These quantities and costs are approximate estimates for initial planning only. They are not guaranteed quantities or structural engineering advice. Please verify final requirements with a qualified engineer, mason, or the Sagar Traders team before ordering.";

/**
 * Pure, documented material quantity estimator using simple feet measurements.
 * Formulas:
 * - 1 sq ft of 9-inch brick wall ≈ 10 bricks + 0.05 bags cement + 0.008 brass sand (with wastage).
 * - 1 sq ft of PCC/tile floor (4-inch base) ≈ 0.08 bags cement + 0.006 brass sand + 0.01 brass aggregate.
 * - Room = 4 walls (2*(L+W)*H) + floor (L*W).
 * - Basic residential slab/structure planning = area * 0.45 bags cement + area * 3.5 kg steel + area * 12 bricks.
 */
export function calculateProjectEstimate(input: EstimatorInput): {
  areaSqFt: number;
  lines: EstimatorLine[];
} {
  const L = Math.max(1, input.lengthFt);
  const W = Math.max(1, input.widthFt);
  const H = Math.max(1, input.heightFt);
  const waste = 1 + Math.min(30, Math.max(0, input.wastagePercent)) / 100;

  let areaSqFt = L * W;
  const lines: EstimatorLine[] = [];

  if (input.projectType === "WALL") {
    areaSqFt = L * H;
    lines.push(
      {
        key: "bricks",
        label: "Bricks / Blocks",
        materialHint: "brick",
        quantity: Math.ceil(areaSqFt * 10 * waste),
        unitLabel: "Pieces",
        formulaNote: `${areaSqFt.toFixed(1)} sq ft × 10 bricks/sq ft × ${waste.toFixed(2)} wastage`,
      },
      {
        key: "cement",
        label: "Cement (Mortar & Plaster)",
        materialHint: "cement",
        quantity: Math.ceil(areaSqFt * 0.05 * waste),
        unitLabel: "Bags",
        formulaNote: `${areaSqFt.toFixed(1)} sq ft × 0.05 bags/sq ft × ${waste.toFixed(2)} wastage`,
      },
      {
        key: "sand",
        label: "River / Plaster Sand",
        materialHint: "sand",
        quantity: Math.round(areaSqFt * 0.008 * waste * 100) / 100,
        unitLabel: "Brass",
        formulaNote: `${areaSqFt.toFixed(1)} sq ft × 0.008 brass/sq ft × ${waste.toFixed(2)} wastage`,
      },
    );
  } else if (input.projectType === "FLOOR") {
    areaSqFt = L * W;
    lines.push(
      {
        key: "cement",
        label: "Cement (Floor Base)",
        materialHint: "cement",
        quantity: Math.ceil(areaSqFt * 0.08 * waste),
        unitLabel: "Bags",
        formulaNote: `${areaSqFt.toFixed(1)} sq ft × 0.08 bags/sq ft × ${waste.toFixed(2)} wastage`,
      },
      {
        key: "sand",
        label: "Sand",
        materialHint: "sand",
        quantity: Math.round(areaSqFt * 0.006 * waste * 100) / 100,
        unitLabel: "Brass",
        formulaNote: `${areaSqFt.toFixed(1)} sq ft × 0.006 brass/sq ft × ${waste.toFixed(2)} wastage`,
      },
      {
        key: "aggregate",
        label: "Aggregate (Gitti)",
        materialHint: "aggregate",
        quantity: Math.round(areaSqFt * 0.01 * waste * 100) / 100,
        unitLabel: "Brass",
        formulaNote: `${areaSqFt.toFixed(1)} sq ft × 0.01 brass/sq ft × ${waste.toFixed(2)} wastage`,
      },
    );
  } else if (input.projectType === "ROOM") {
    const wallArea = 2 * (L + W) * H;
    const floorArea = L * W;
    areaSqFt = floorArea;
    lines.push(
      {
        key: "bricks",
        label: "Wall Bricks",
        materialHint: "brick",
        quantity: Math.ceil(wallArea * 10 * waste),
        unitLabel: "Pieces",
        formulaNote: `4 walls (${wallArea.toFixed(1)} sq ft) × 10 bricks/sq ft × ${waste.toFixed(2)}`,
      },
      {
        key: "cement",
        label: "Cement (Walls + Floor)",
        materialHint: "cement",
        quantity: Math.ceil((wallArea * 0.05 + floorArea * 0.08) * waste),
        unitLabel: "Bags",
        formulaNote: `Wall (${wallArea.toFixed(1)} sq ft) + Floor (${floorArea.toFixed(1)} sq ft) cement`,
      },
      {
        key: "sand",
        label: "Sand",
        materialHint: "sand",
        quantity: Math.round((wallArea * 0.008 + floorArea * 0.006) * waste * 100) / 100,
        unitLabel: "Brass",
        formulaNote: `Combined wall & floor mortar sand with ${input.wastagePercent}% wastage`,
      },
    );
  } else {
    areaSqFt = L * W;
    lines.push(
      {
        key: "cement",
        label: "Cement (Approx. Total)",
        materialHint: "cement",
        quantity: Math.ceil(areaSqFt * 0.45 * waste),
        unitLabel: "Bags",
        formulaNote: `${areaSqFt.toFixed(1)} sq ft × 0.45 bags/sq ft × ${waste.toFixed(2)} wastage`,
      },
      {
        key: "steel",
        label: "TMT Steel (Approx. Total)",
        materialHint: "tmt",
        quantity: Math.ceil(areaSqFt * 3.5 * waste),
        unitLabel: "Kg",
        formulaNote: `${areaSqFt.toFixed(1)} sq ft × 3.5 kg/sq ft × ${waste.toFixed(2)} wastage`,
      },
      {
        key: "bricks",
        label: "Bricks (Approx. Total)",
        materialHint: "brick",
        quantity: Math.ceil(areaSqFt * 12 * waste),
        unitLabel: "Pieces",
        formulaNote: `${areaSqFt.toFixed(1)} sq ft × 12 bricks/sq ft × ${waste.toFixed(2)} wastage`,
      },
    );
  }

  return { areaSqFt, lines };
}
