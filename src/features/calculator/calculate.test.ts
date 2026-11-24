// @vitest-environment node
import {
  ESTIMATE_DISCLAIMER,
  MIX_RATIOS,
  STEEL_DIAMETERS_MM,
  STEEL_DISCLAIMER,
  UNIT_SIZE_PRESETS,
} from "./config";
import {
  calculateConcrete,
  calculateMasonry,
  calculateMix,
  calculateSteelBars,
  calculateSteelMesh,
  ceilTo,
  concreteVolume,
  steelKgPerMetre,
} from "./calculate";

/**
 * Every expected number below was worked out BY HAND from the formulas (see the comments), independently of the code under
 * test, so these are real cross-checks and not the implementation agreeing with itself.
 */
const ok = <T extends { ok: boolean }>(o: T) => {
  expect(o.ok).toBe(true);
  return o as Extract<T, { ok: true }>;
};
const row = (o: ReturnType<typeof calculateMix>, key: string) => {
  const r = ok(o).result.rows.find((x) => x.key === key);
  expect(r, key).toBeDefined();
  return r!;
};

describe("units and concrete volume (hand-computed)", () => {
  it("10 ft × 10 ft × 0.5 ft = 50 ft³ = 1.4158423296 m³  (0.3048³ = 0.028316846592)", () => {
    const v = ok(concreteVolume({ length: 10, width: 10, depth: 0.5, unit: "ft" })).value;
    expect(v.cubicFeet).toBeCloseTo(50, 9);
    expect(v.cubicMetres).toBeCloseTo(1.4158423296, 9);
  });

  it("the same slab in inches (120 × 120 × 6) and centimetres (304.8 × 304.8 × 15.24) gives the same volume", () => {
    const a = ok(concreteVolume({ length: 120, width: 120, depth: 6, unit: "in" })).value
      .cubicMetres;
    const b = ok(concreteVolume({ length: 304.8, width: 304.8, depth: 15.24, unit: "cm" })).value
      .cubicMetres;
    expect(a).toBeCloseTo(1.4158423296, 9);
    expect(b).toBeCloseTo(1.4158423296, 9);
  });

  it("300 cm × 200 cm × 15 cm = 0.9 m³;  5 m × 4 m × 0.15 m = 3 m³", () => {
    expect(
      ok(concreteVolume({ length: 300, width: 200, depth: 15, unit: "cm" })).value.cubicMetres,
    ).toBeCloseTo(0.9, 12);
    expect(
      ok(concreteVolume({ length: 5, width: 4, depth: 0.15, unit: "m" })).value.cubicMetres,
    ).toBeCloseTo(3, 12);
  });

  it("shows the formula and the steps", () => {
    const r = ok(calculateConcrete({ length: 5, width: 4, depth: 0.15, unit: "m" })).result;
    expect(r.steps.join(" ")).toMatch(/Volume = length × width × depth/);
    expect(r.summary.map((s) => s.value).join(" ")).toMatch(/3 m³/);
  });
});

describe("cement, sand and aggregate (hand-computed, 5 m × 4 m × 0.15 m, mix 1:2:4)", () => {
  // wet 3.000 m³ → dry 3 × 1.54 = 4.62 m³ → parts 7
  // cement 4.62/7 = 0.66 m³ → 0.66 × 1440 ÷ 50 = 19.008 bags
  // sand 4.62×2/7 = 1.32 m³ = 1.32 × 35.31466672 = 46.6154 ft³ ;  aggregate 4.62×4/7 = 2.64 m³ = 93.2307 ft³
  const run = (wastagePercent: number) =>
    calculateMix({ length: 5, width: 4, depth: 0.15, unit: "m", mix: "1:2:4", wastagePercent });

  it("matches the independent figures with no wastage", () => {
    expect(row(run(0), "cement").theoretical).toBeCloseTo(19.008, 3);
    expect(row(run(0), "sand").theoretical).toBeCloseTo(46.6154, 2);
    expect(row(run(0), "aggregate").theoretical).toBeCloseTo(93.2307, 2);
  });

  it("5% wastage: 19.008 × 1.05 = 19.9584 bags → suggest 20; sand 48.946 → 49; aggregate 97.892 → 98", () => {
    expect(row(run(5), "cement").withWastage).toBeCloseTo(19.9584, 3);
    expect(row(run(5), "cement").suggested).toBe(20);
    expect(row(run(5), "sand").suggested).toBe(49);
    expect(row(run(5), "aggregate").suggested).toBe(98);
  });

  it("keeps the theoretical quantity and the rounded purchase quantity separate, and never rounds down", () => {
    for (const w of [0, 3, 5, 12.5]) {
      for (const key of ["cement", "sand", "aggregate"]) {
        const r = row(run(w), key);
        expect(Number.isInteger(r.suggested)).toBe(true);
        expect(r.suggested).toBeGreaterThanOrEqual(r.withWastage - 1e-6);
        expect(r.withWastage).toBeGreaterThanOrEqual(r.theoretical - 1e-9);
      }
    }
  });

  it("cement bags, e.g. 12.4 → 13 and an exact 12 stays 12", () => {
    expect(ceilTo(12.4)).toBe(13);
    expect(ceilTo(12)).toBe(12);
    expect(ceilTo(12.0000001)).toBe(12); // float noise is not a whole extra bag
    expect(ceilTo(12.01)).toBe(13);
  });

  it("every ratio's three shares add up to the whole dry volume", () => {
    for (const m of MIX_RATIOS) {
      const o = calculateMix({
        length: 5,
        width: 4,
        depth: 0.15,
        unit: "m",
        mix: m.id,
        wastagePercent: 0,
      });
      const cementM3 = (row(o, "cement").theoretical * 50) / 1440; // bags → m³
      const sandM3 = row(o, "sand").theoretical / 35.31466672;
      const aggM3 = row(o, "aggregate").theoretical / 35.31466672;
      expect(cementM3 + sandM3 + aggM3).toBeCloseTo(4.62, 2);
    }
  });

  it("documents its assumptions and says it is an estimate", () => {
    const r = ok(run(5)).result;
    const text = r.assumptions.join(" ");
    for (const must of [
      "Dry-volume factor 1.54",
      "50 kg",
      "1440",
      "1600",
      "1500",
      "Wastage 5%",
      "structural engineer",
    ])
      expect(text, must).toContain(must);
    expect(ESTIMATE_DISCLAIMER).toMatch(
      /approximate planning estimates, not an engineering specification/,
    );
  });
});

describe("bricks and blocks (hand-computed)", () => {
  // wall 10 × 3 × 0.23 m, opening 2 m²: net area 28, volume 28 × 0.23 = 6.44 m³
  // brick 190×90×90 + 10 mm joint → 0.2 × 0.1 × 0.1 = 0.002 m³ → 6.44 ÷ 0.002 = 3220 ; +5% = 3381
  const wall = {
    kind: "brick" as const,
    wallLength: 10,
    wallHeight: 3,
    wallThickness: 0.23,
    unit: "m" as const,
    unitLength: 190,
    unitWidth: 90,
    unitHeight: 90,
    jointMm: 10,
  };

  it("3220 bricks, 3381 with 5% wastage", () => {
    const r = ok(calculateMasonry({ ...wall, openingArea: 2, wastagePercent: 5 })).result.rows[0];
    expect(r.theoretical).toBeCloseTo(3220, 1);
    expect(r.withWastage).toBeCloseTo(3381, 1);
    expect(r.suggested).toBe(3381);
  });

  it("with no openings: 30 × 0.23 = 6.9 m³ ÷ 0.002 = 3450", () => {
    expect(
      ok(calculateMasonry({ ...wall, wastagePercent: 0 })).result.rows[0].theoretical,
    ).toBeCloseTo(3450, 1);
  });

  it("works in feet and inches too: 32.8084 ft long equals 10 m (to rounding)", () => {
    const a = ok(calculateMasonry({ ...wall, wastagePercent: 0 })).result.rows[0].theoretical;
    const b = ok(
      calculateMasonry({
        ...wall,
        wallLength: 10 / 0.3048,
        wallHeight: 3 / 0.3048,
        wallThickness: 0.23 / 0.3048,
        unit: "ft",
        wastagePercent: 0,
      }),
    ).result.rows[0].theoretical;
    expect(b).toBeCloseTo(a, 3);
  });

  it("AAC block 600 × 200 × 100 with 3 mm joint: module 0.603 × 0.203 × 0.103 = 0.012607... m³", () => {
    const o = ok(
      calculateMasonry({
        kind: "block",
        wallLength: 6,
        wallHeight: 3,
        wallThickness: 0.1,
        unit: "m",
        unitLength: 600,
        unitWidth: 200,
        unitHeight: 100,
        jointMm: 3,
        wastagePercent: 0,
      }),
    ).result.rows[0];
    // volume 6×3×0.1 = 1.8 m³ ; module = 0.603 × 0.203 × 0.103 = 0.01260... → 1.8 / 0.012608... ≈ 142.77
    expect(o.theoretical).toBeCloseTo(1.8 / (0.603 * 0.203 * 0.103), 1);
    expect(o.label).toBe("Blocks");
  });

  it("a thicker joint means fewer units (the joint is part of each unit's space)", () => {
    const thin = ok(calculateMasonry({ ...wall, jointMm: 0, wastagePercent: 0 })).result.rows[0]
      .theoretical;
    const thick = ok(calculateMasonry({ ...wall, jointMm: 20, wastagePercent: 0 })).result.rows[0]
      .theoretical;
    expect(thin).toBeGreaterThan(thick);
  });

  it("no size is ever assumed: the unit size and the joint are required", () => {
    const o = calculateMasonry({
      ...wall,
      unitLength: Number.NaN,
      unitWidth: Number.NaN,
      unitHeight: Number.NaN,
      jointMm: Number.NaN,
    });
    expect(o.ok).toBe(false);
    if (!o.ok)
      expect(Object.keys(o.errors).sort()).toEqual([
        "jointMm",
        "unitHeight",
        "unitLength",
        "unitWidth",
      ]);
  });

  it("presets are only starting points and are all in range", () => {
    expect(UNIT_SIZE_PRESETS.length).toBeGreaterThan(3);
    for (const p of UNIT_SIZE_PRESETS) {
      expect(
        calculateMasonry({
          ...wall,
          kind: p.kind,
          unitLength: p.length,
          unitWidth: p.width,
          unitHeight: p.height,
          wastagePercent: 0,
        }).ok,
      ).toBe(true);
    }
  });

  it("rejects openings as large as the wall", () => {
    const o = calculateMasonry({ ...wall, openingArea: 30 });
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.errors.openingArea).toMatch(/smaller than the wall/);
  });
});

describe("steel (hand-computed, conservative)", () => {
  it("weight per metre: 12 mm → π/4 × 0.012² × 7850 = 0.88781 kg/m ; 10 mm → 0.61654 kg/m", () => {
    expect(steelKgPerMetre(12)).toBeCloseTo(0.88781, 4);
    expect(steelKgPerMetre(10)).toBeCloseTo(0.61654, 4);
    expect(steelKgPerMetre(12) / (144 / 162.2)).toBeCloseTo(1, 2); // agrees with the familiar d²/162 rule of thumb
  });

  it("20 bars × 6 m × 12 mm = 120 m × 0.88781 = 106.54 kg", () => {
    const r = ok(calculateSteelBars({ diameterMm: 12, barCount: 20, barLength: 6, unit: "m" }))
      .result.rows[0];
    expect(r.theoretical).toBeCloseTo(106.54, 1);
    expect(r.suggested).toBe(107);
    expect(r.unit).toBe("kg");
  });

  it("mesh 4 m × 3 m at 150 mm, 10 mm bars: (⌊3/0.15⌋+1)=21 bars × 4 m + (⌊4/0.15⌋+1)=27 bars × 3 m = 165 m → 101.73 kg", () => {
    const r = ok(
      calculateSteelMesh({
        panelLength: 4,
        panelWidth: 3,
        spacing: 0.15,
        diameterMm: 10,
        unit: "m",
      }),
    ).result;
    expect(r.rows[0].theoretical).toBeCloseTo(101.73, 1);
    expect(r.summary[0].value).toMatch(/165 m/);
  });

  it("states exactly what is NOT included", () => {
    const text = ok(
      calculateSteelMesh({
        panelLength: 4,
        panelWidth: 3,
        spacing: 0.15,
        diameterMm: 10,
        unit: "m",
      }),
    ).result.assumptions.join(" ");
    for (const must of ["ONE layer", "cover", "laps", "stirrups", "NOT included"])
      expect(text, must).toContain(must);
    expect(STEEL_DISCLAIMER).toBe(
      "Steel quantities are preliminary estimates only. Final reinforcement requirements must be confirmed by a qualified structural engineer using approved structural drawings.",
    );
  });

  it("refuses to guess: diameter must come from the list; counts are whole numbers; spacing must fit the panel", () => {
    expect(calculateSteelBars({ diameterMm: 13, barCount: 20, barLength: 6, unit: "m" }).ok).toBe(
      false,
    );
    expect(calculateSteelBars({ diameterMm: 12, barCount: 2.5, barLength: 6, unit: "m" }).ok).toBe(
      false,
    );
    expect(calculateSteelBars({ diameterMm: 12, barCount: 0, barLength: 6, unit: "m" }).ok).toBe(
      false,
    );
    expect(calculateSteelBars({ diameterMm: 12, barCount: 1e9, barLength: 6, unit: "m" }).ok).toBe(
      false,
    );
    const wide = calculateSteelMesh({
      panelLength: 2,
      panelWidth: 2,
      spacing: 3,
      diameterMm: 10,
      unit: "m",
    });
    expect(wide.ok).toBe(false);
    for (const d of STEEL_DIAMETERS_MM) expect(steelKgPerMetre(d)).toBeGreaterThan(0);
  });
});

describe("validation", () => {
  const base = { length: 5, width: 4, depth: 0.15, unit: "m" as const, mix: "1:2:4" as const };
  const errorsOf = (o: ReturnType<typeof calculateMix>) => (o.ok ? {} : o.errors);

  it.each([
    ["zero", 0],
    ["negative", -3],
    ["NaN (blank / not a number)", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["beyond the safety limit (2000 m)", 2000],
    ["far beyond the limit in centimetres", 1e9],
  ])("rejects a %s dimension", (_n, bad) => {
    for (const field of ["length", "width", "depth"] as const) {
      const o = calculateMix({ ...base, [field]: bad });
      expect(o.ok, field).toBe(false);
      expect(errorsOf(o)[field], field).toBeTruthy();
    }
  });

  it("a too-small dimension and a wrong unit are rejected", () => {
    expect(calculateMix({ ...base, depth: 0.0000001 }).ok).toBe(false);
    expect(calculateMix({ ...base, unit: "yd" as never }).ok).toBe(false);
    expect(calculateMix({ ...base, mix: "9:9:9" as never }).ok).toBe(false);
  });

  it("reports every missing field at once (not one at a time)", () => {
    const o = calculateMix({
      length: Number.NaN,
      width: Number.NaN,
      depth: Number.NaN,
      unit: "m",
      mix: "1:2:4",
    });
    expect(Object.keys(errorsOf(o)).sort()).toEqual(["depth", "length", "width"]);
  });

  it("wastage is limited to 0–25%", () => {
    expect(calculateMix({ ...base, wastagePercent: 26 }).ok).toBe(false);
    expect(calculateMix({ ...base, wastagePercent: -1 }).ok).toBe(false);
    expect(calculateMix({ ...base, wastagePercent: 25 }).ok).toBe(true);
  });

  it("the largest supported input stays finite and never throws", () => {
    const o = ok(
      calculateMix({
        length: 1000,
        width: 1000,
        depth: 1000,
        unit: "m",
        mix: "1:1:2",
        wastagePercent: 25,
      }),
    );
    for (const r of o.result.rows) {
      expect(Number.isFinite(r.suggested)).toBe(true);
      expect(r.suggested).toBeGreaterThan(0);
    }
  });

  it("is deterministic and has no side effects (same input, same output)", () => {
    const a = JSON.stringify(calculateMix({ ...base, wastagePercent: 5 }));
    const b = JSON.stringify(calculateMix({ ...base, wastagePercent: 5 }));
    expect(a).toBe(b);
  });
});
