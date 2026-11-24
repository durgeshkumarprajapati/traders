// @vitest-environment node
import { unitsMatch } from "./units";

describe("unitsMatch (a warning aid — quantities are never converted)", () => {
  it.each([
    ["bags (50 kg)", "Bag"],
    ["cubic feet", "Cubic Feet"],
    ["pieces", "Piece"],
    ["pieces", "Block"],
    ["kg", "Kg"],
  ])("%s ≈ %s", (a, b) => expect(unitsMatch(a, b)).toBe(true));

  it.each([
    ["bags (50 kg)", "Metric Ton"],
    ["kg", "Ton"],
    ["kg", "Metric Ton"],
    ["cubic feet", "Cubic Meter"],
    ["cubic feet", "Brass"],
    ["pieces", "Bag"],
    ["", "Bag"],
    ["bags", ""],
  ])("%s ≠ %s (different units are never treated as the same)", (a, b) =>
    expect(unitsMatch(a, b)).toBe(false),
  );

  it("TON and METRIC_TON are never the same", () =>
    expect(unitsMatch("Ton", "Metric Ton")).toBe(false));
});
