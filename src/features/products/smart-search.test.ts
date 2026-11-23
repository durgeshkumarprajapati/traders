// @vitest-environment node
import {
  buildProductCorpus,
  matchesSmartSearch,
  normalize,
  scoreProductSearch,
} from "./smart-search";
import { getSynonymTokens, synonymsFor } from "./synonyms";
import { FIXTURE_BRANDS, FIXTURE_CATEGORIES, FIXTURE_PRODUCTS } from "./test-fixtures";
import type { Product } from "./types";

const [cementCat, steelCat, bricksCat, sandCat, hardwareCat] = FIXTURE_CATEGORIES;
const [brandA, brandB] = FIXTURE_BRANDS;
const base = FIXTURE_PRODUCTS[0];
const mk = (over: Partial<Product>): Product => ({
  ...base,
  description: "",
  specifications: [],
  sku: null,
  brandId: null,
  ...over,
});

const cement = mk({ id: "cement", name: "PPC Cement 50 kg", categoryId: cementCat.id });
const whiteCement = mk({ id: "white-cement", name: "White Cement 5 kg", categoryId: cementCat.id });
const tmt = mk({
  id: "tmt",
  name: "Fe 550D 12mm bar",
  categoryId: steelCat.id,
  description: "Thermo mechanically treated reinforcement",
  specifications: [
    { label: "Grade", value: "Fe 550D" },
    { label: "Diameter", value: "12 mm" },
  ],
  sku: "TMT-12-550",
});
const bindingWire = mk({
  id: "wire",
  name: "Binding wire 18 gauge",
  categoryId: hardwareCat.id,
  description: "Soft annealed wire for tying",
});
const brick = mk({ id: "brick", name: "Red clay brick", categoryId: bricksCat.id });
const sand = mk({ id: "sand", name: "River sand", categoryId: sandCat.id });
const paint = mk({
  id: "paint",
  name: "Interior emulsion paint",
  categoryId: hardwareCat.id,
  description: "Washable interior finish",
});
const sheet = mk({ id: "sheet", name: "Roofing sheet 8 ft", categoryId: hardwareCat.id });
const branded = mk({
  id: "branded",
  name: "Plain item",
  categoryId: hardwareCat.id,
  brandId: brandB.id,
});
const all = [cement, whiteCement, tmt, bindingWire, brick, sand, paint, sheet, branded];
const cats = new Map(FIXTURE_CATEGORIES.map((c) => [c.id, c]));
const brands = new Map(FIXTURE_BRANDS.map((b) => [b.id, b]));
const find = (q: string, list = all) =>
  list
    .filter((p) =>
      matchesSmartSearch(
        p,
        q,
        cats.get(p.categoryId),
        p.brandId ? brands.get(p.brandId) : undefined,
      ),
    )
    .map((p) => p.id);

describe("spec examples", () => {
  it("'cement' finds the cement products — and NOT binding wire or anything else", () => {
    expect(find("cement").sort()).toEqual(["cement", "white-cement"]);
  });

  it("'TMT' finds the steel product by name, SKU and category-independent text", () => {
    expect(find("TMT")).toEqual(["tmt"]);
    expect(find("tmt-12-550")).toEqual(["tmt"]);
  });

  it("'sariya' (configured synonym) finds the TMT/steel product only", () => {
    expect(find("sariya")).toEqual(["tmt"]);
    expect(find("SARIYA")).toEqual(["tmt"]);
  });

  it("a brand name shows only that brand's products", () => {
    expect(find("Sample Brand B")).toEqual(["branded"]);
    expect(find("sample brand a")).toEqual([]);
  });

  it("product SPECIFICATIONS are searchable (label and value)", () => {
    expect(find("550d")).toEqual(["tmt"]);
    expect(find("diameter 12 mm")).toEqual(["tmt"]);
    expect(find("grade")).toEqual(["tmt"]);
    expect(find("annealed")).toEqual(["wire"]); // description text
  });

  it("the category name is searched too", () => {
    expect(find("bricks").sort()).toEqual(["brick"]);
  });
});

describe("synonyms must not silently match unrelated products", () => {
  it("short trade words match whole words only: 'int' (brick) does not find paint, 'ent' does not find cement, 'eet' does not find sheets", () => {
    expect(find("int")).toEqual(["brick"]); // via the dictionary, not via 'pa-int' / 'interior'
    expect(find("ent")).toEqual(["brick"]);
    expect(find("eet")).toEqual(["brick"]);
    expect(find("int")).not.toContain("paint");
    expect(find("ent")).not.toContain("cement");
    expect(find("eet")).not.toContain("sheet");
  });

  it("expansions never drag in neighbours: no 'binding wire' for cement, no cement for putty, no wire for loha", () => {
    expect(find("cement")).not.toContain("wire");
    const putty = mk({ id: "putty", name: "Wall putty 20 kg", categoryId: hardwareCat.id });
    expect(find("putty", [...all, putty])).toEqual(["putty"]); // white cement is NOT a putty match
    expect(find("loha")).toEqual(["tmt"]);
    expect(find("loha")).not.toContain("wire");
  });

  it("the dictionary does not contain the over-broad expansions that caused those problems", () => {
    expect(synonymsFor("cement")).not.toEqual(expect.arrayContaining(["bind"]));
    expect(synonymsFor("cement")).toEqual(["ppc", "opc", "psc"]);
    expect(synonymsFor("tmt")).not.toContain("bar");
    expect(synonymsFor("putty")).not.toContain("white cement");
  });

  it("expansions match as whole words, not as fragments inside other words", () => {
    const barbed = mk({ id: "barbed", name: "Barbed fence", categoryId: hardwareCat.id });
    expect(find("tmt", [barbed, tmt])).toEqual(["tmt"]);
  });
});

describe("queries are normalised and every term counts", () => {
  it.each(["  TMT  ", "tmt,", "TMT!!", "(tmt)", "t-m-t".replace(/-/g, ""), "TmT"])(
    "%j finds TMT",
    (q) => {
      expect(find(q)).toEqual(["tmt"]);
    },
  );

  it("punctuation and case are ignored across several words", () => {
    expect(find("TMT, 12mm")).toEqual(["tmt"]);
    expect(find("  fe   550D ")).toEqual(["tmt"]);
  });

  it("every word must match (AND): an extra unmatched word removes the product", () => {
    expect(find("tmt 12mm")).toEqual(["tmt"]);
    expect(find("tmt 20mm")).toEqual([]);
    expect(find("cement steel")).toEqual([]);
  });

  it("a known multi-word phrase does NOT make the rest of the query optional", () => {
    expect(find("binding wire 18")).toEqual(["wire"]);
    expect(find("binding wire 99999")).toEqual([]);
  });

  it("a word-start prefix works; letters from the middle of a word never match", () => {
    expect(find("cem").sort()).toEqual(["cement", "white-cement"]);
    expect(find("ement")).toEqual([]);
    expect(find("forcement")).toEqual([]);
  });

  it("'cement' does not match 'reinforcement' (a very common word in steel descriptions)", () => {
    const rebar = mk({
      id: "rebar",
      name: "Rebar 10mm",
      description: "High strength reinforcement bar",
      categoryId: steelCat.id,
    });
    expect(find("cement", [rebar])).toEqual([]);
  });

  it("a term with a digit may match inside a word, e.g. a grade or size written without a space", () => {
    const fe = mk({ id: "fe", name: "Fe550D rebar x12mm", categoryId: steelCat.id });
    expect(find("550d", [fe])).toEqual(["fe"]);
    expect(find("12mm", [fe])).toEqual(["fe"]);
  });

  it("empty and whitespace queries match everything", () => {
    expect(find("")).toHaveLength(all.length);
    expect(find("   ")).toHaveLength(all.length);
  });
});

describe("hostile and odd input never throws", () => {
  it.each([
    "constructor",
    "__proto__",
    "toString",
    "hasOwnProperty",
    "valueOf",
    "prototype",
    "(.*",
    "[a-z]+",
    "\\",
    "%00",
    "a".repeat(5000),
    "🙂🙂",
    "<script>alert(1)</script>",
    "'; drop table products;--",
  ])("%j is handled", (q) => {
    expect(() => find(q)).not.toThrow();
    expect(() => scoreProductSearch(cement, q)).not.toThrow();
    expect(() => getSynonymTokens(q)).not.toThrow();
  });

  it("prototype property names have no synonyms and match nothing by accident", () => {
    expect(synonymsFor("constructor")).toEqual([]);
    expect(synonymsFor("__proto__")).toEqual([]);
    expect(find("constructor")).toEqual([]);
  });

  it("normalize only strips punctuation and collapses space", () => {
    expect(normalize("  A,B;C   d-e.f  ")).toBe("a b c d-e.f");
  });
});

describe("ordering", () => {
  it("exact SKU > exact name > name prefix > field matches; direct matches outrank synonym-only ones", () => {
    const exactSku = scoreProductSearch(tmt, "tmt-12-550", steelCat);
    const namePrefix = scoreProductSearch(cement, "ppc cement", cementCat);
    expect(exactSku).toBeGreaterThanOrEqual(100);
    expect(namePrefix).toBeGreaterThan(scoreProductSearch(whiteCement, "cement", cementCat) - 1);
    const direct = scoreProductSearch(tmt, "tmt", steelCat);
    const viaSynonym = scoreProductSearch(tmt, "sariya", steelCat);
    expect(direct).toBeGreaterThan(viaSynonym);
  });

  it("an empty query scores 0", () => {
    expect(scoreProductSearch(cement, "")).toBe(0);
  });
});

describe("corpus", () => {
  it("is built from catalogue fields only", () => {
    const c = buildProductCorpus({ ...tmt, brandId: brandA.id }, steelCat, brandA);
    for (const part of [
      "fe 550d 12mm bar",
      "tmt-12-550",
      "sample brand a",
      "steel",
      "grade fe 550d",
      "diameter 12 mm",
    ])
      expect(c.haystack).toContain(part);
    expect(c.words).toEqual(expect.arrayContaining(["tmt", "12", "550", "grade"])); // hyphenated SKU parts are words
  });

  it("tolerates a legacy key/value specification map", () => {
    const legacy = {
      ...tmt,
      specifications: { Grade: "Fe 500" } as unknown as Product["specifications"],
    };
    expect(buildProductCorpus(legacy).specs).toContain("grade fe 500");
  });
});

describe("price-availability and unit filters", () => {
  // These live in query.ts / units.ts but belong to the same finder feature.
  it("price filter: 'listed' keeps only products with a real rate, 'request' only those without — never treating a missing price as 0", async () => {
    const { filterAndSort, parseListingParams } = await import("./query");
    const data = {
      categories: FIXTURE_CATEGORIES,
      brands: FIXTURE_BRANDS,
      products: [
        mk({ id: "p-listed", name: "A", price: 100 }),
        mk({ id: "p-none", name: "B", price: null }),
        mk({ id: "p-zero", name: "C", price: 0 }),
      ],
    };
    const ids = (q: Record<string, string>) =>
      filterAndSort(data, parseListingParams(q))
        .map((p) => p.id)
        .sort();
    expect(ids({})).toEqual(["p-listed", "p-none", "p-zero"]);
    expect(ids({ price: "listed" })).toEqual(["p-listed"]);
    expect(ids({ price: "request" })).toEqual(["p-none", "p-zero"]);
    expect(ids({ price: "bogus" })).toEqual(["p-listed", "p-none", "p-zero"]); // unknown value falls back to 'any'
  });

  it("price filter survives in the URL and is dropped when 'any'", async () => {
    const { listingQuery, parseListingParams } = await import("./query");
    expect(listingQuery(parseListingParams({ price: "listed" }))).toBe("?price=listed");
    expect(listingQuery(parseListingParams({ price: "any" }))).toBe("");
  });

  it("unit options come from units in the catalogue, in canonical order, with TON and METRIC_TON kept apart", async () => {
    const { availableUnitOptions } = await import("./units");
    const options = availableUnitOptions([
      { unit: { code: "METRIC_TON" } },
      { unit: { code: "TON" } },
      { unit: { code: "BAG" } },
      { unit: { code: "CUSTOM", customLabel: "Roll" } },
      { unit: { code: "BAG" } },
    ]);
    expect(options.map((o) => o.code)).toEqual(["BAG", "TON", "METRIC_TON", "CUSTOM"]);
    expect(options.find((o) => o.code === "TON")?.label).toBe("Ton");
    expect(options.find((o) => o.code === "METRIC_TON")?.label).toBe("Metric Ton");
    expect(options.find((o) => o.code === "CUSTOM")?.label).toBe("Other units");
    expect(availableUnitOptions([])).toEqual([]);
  });
});
