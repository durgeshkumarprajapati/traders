import type { Brand, Category, Product } from "./types";
import { SYNONYM_PHRASES, synonymsFor } from "./synonyms";
import { unitLabel } from "./units";

/** Lower-cases, strips punctuation (keeping letters, digits, "." and "-"), collapses whitespace. */
export function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ProductCorpus = {
  haystack: string;
  /** Whole words (and the parts of hyphenated / dotted words) a search term may start. */
  words: readonly string[];
  name: string;
  sku: string;
  brand: string;
  category: string;
  specs: string;
};

function specText(
  specs: Product["specifications"] | Record<string, unknown> | null | undefined,
): string {
  if (!specs) return "";
  const rows: Array<[string, unknown]> = Array.isArray(specs)
    ? specs.map((r) => [r.label, r.value])
    : Object.entries(specs);
  return rows.map(([k, v]) => `${normalize(String(k))} ${normalize(String(v))}`).join(" ");
}

/** Builds the searchable text of a product from catalogue data only (name, SKU, brand, category, description, unit, specifications). */
export function buildProductCorpus(p: Product, category?: Category, brand?: Brand): ProductCorpus {
  const name = normalize(p.name);
  const sku = p.sku ? normalize(p.sku) : "";
  const brandText = brand ? normalize(brand.name) : "";
  const categoryText = category ? normalize(category.name) : "";
  const specs = specText(p.specifications);
  const haystack = [
    name,
    sku,
    brandText,
    categoryText,
    normalize(p.description),
    normalize(`${p.unit.code} ${unitLabel(p.unit)}`),
    specs,
  ].join(" ");
  const words = new Set<string>();
  for (const w of haystack.split(" ")) {
    if (!w) continue;
    words.add(w);
    for (const part of w.split(/[.-]/)) if (part) words.add(part);
  }
  return {
    haystack,
    words: [...words],
    name,
    sku,
    brand: brandText,
    category: categoryText,
    specs,
  };
}

/**
 * A term matches a product at WORD boundaries: some word must START with the term ("cem" finds "cement", "12" finds "12mm").
 *  - A short trade word that is in the synonym dictionary ("int", "ent", "eet", "tmt", "ppc", "tin"…) must match a WHOLE word,
 *    otherwise "int" (brick) would match "interior" and "tin" would match "tinted".
 *  - A term is matched INSIDE a word only when it contains a digit and is at least 3 characters ("550d" finds "fe550d",
 *    "12mm" finds "x12mm"). Letters-only terms never match mid-word: "cement" must not match "reinforcement".
 */
function termMatches(term: string, c: ProductCorpus, allowInside: boolean): boolean {
  if (!term) return false;
  if (term.includes(" ")) return ` ${c.haystack} `.includes(` ${term}`); // phrase: starts at a word boundary
  const exactOnly = term.length <= 4 && synonymsFor(term).length > 0;
  if (exactOnly ? c.words.includes(term) : c.words.some((w) => w.startsWith(term))) return true;
  return allowInside && term.length >= 3 && /\d/.test(term) && c.haystack.includes(term);
}

/** One query unit matches directly, or through its dictionary expansion (expansions are whole-word only). */
function unitMatches(unit: string, c: ProductCorpus): boolean {
  if (termMatches(unit, c, true)) return true;
  return synonymsFor(unit).some((s) => termMatches(s, c, false));
}

/** Splits a query into units: known multi-word phrases stay together, everything else is one word per unit. */
function queryUnits(clean: string): string[] {
  let rest = ` ${clean} `;
  const units: string[] = [];
  for (const phrase of SYNONYM_PHRASES) {
    const needle = ` ${phrase} `;
    while (rest.includes(needle)) {
      units.push(phrase);
      rest = rest.replace(needle, " ");
    }
  }
  units.push(...rest.trim().split(" ").filter(Boolean));
  return units;
}

/** True when EVERY unit of the query matches the product (name, brand, category, SKU, specs, description or a configured synonym). */
export function matchesSmartSearch(
  p: Product,
  query: string,
  category?: Category,
  brand?: Brand,
): boolean {
  const clean = normalize(query);
  if (!clean) return true;
  const corpus = buildProductCorpus(p, category, brand);
  return queryUnits(clean).every((u) => unitMatches(u, corpus));
}

/** Relevance for ordering matched products: exact SKU/name first, then field weights; synonym-only matches rank below direct ones. */
export function scoreProductSearch(
  p: Product,
  query: string,
  category?: Category,
  brand?: Brand,
): number {
  const clean = normalize(query);
  if (!clean) return 0;
  const c = buildProductCorpus(p, category, brand);
  let score = 0;
  if (c.sku && c.sku === clean) score += 100;
  if (c.name === clean) score += 80;
  if (c.name.startsWith(clean)) score += 50;
  for (const t of queryUnits(clean)) {
    if (c.name.includes(t)) score += 30;
    if (c.brand.includes(t)) score += 20;
    if (c.category.includes(t)) score += 15;
    if (c.sku && c.sku.includes(t)) score += 20;
    if (c.specs.includes(t)) score += 15;
    if (termMatches(t, c, true)) score += 5;
  }
  return score;
}
