import type { Brand, Category, Product } from "./types";
import { CONSTRUCTION_SYNONYMS } from "./synonyms";
import { unitLabel } from "./units";

/**
 * Normalizes text for comparison by lowercasing and standardizing spaces.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds the searchable text corpus for a product.
 */
export function buildProductCorpus(
  p: Product,
  category?: Category,
  brand?: Brand,
): {
  haystack: string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  specs: string;
} {
  const normName = normalize(p.name);
  const normSku = p.sku ? normalize(p.sku) : "";
  const normBrand = brand ? normalize(brand.name) : "";
  const normCat = category ? normalize(category.name) : "";
  const normDesc = normalize(p.description);
  const normUnit = normalize(`${p.unit.code} ${unitLabel(p.unit)}`);

  const specTokens = p.specifications
    ? Object.entries(p.specifications)
        .map(([k, v]) => `${normalize(k)} ${normalize(String(v))}`)
        .join(" ")
    : "";

  const haystack = [normName, normSku, normBrand, normCat, normDesc, normUnit, specTokens]
    .join(" ")
    .toLowerCase();

  return {
    haystack,
    name: normName,
    sku: normSku,
    brand: normBrand,
    category: normCat,
    specs: specTokens,
  };
}

/**
 * Checks whether a single search token matches a product corpus directly or via synonyms.
 */
function tokenMatches(token: string, corpus: { haystack: string }): boolean {
  if (corpus.haystack.includes(token)) {
    return true;
  }

  // Check synonym expansion for this token
  const syns = CONSTRUCTION_SYNONYMS[token];
  if (syns) {
    for (const s of syns) {
      if (corpus.haystack.includes(s)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Determines whether a product matches a user's search query.
 * Supports multi-field matching across name, brand, category, SKU, specifications, unit,
 * and expands vernacular construction synonyms.
 * Every term in the query must match either directly or via synonym expansion.
 */
export function matchesSmartSearch(
  p: Product,
  query: string,
  category?: Category,
  brand?: Brand,
): boolean {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return true;

  const corpus = buildProductCorpus(p, category, brand);

  // Check if query is a recognized multi-word synonym phrase
  for (const [phrase, syns] of Object.entries(CONSTRUCTION_SYNONYMS)) {
    if (phrase.includes(" ") && cleanQ.includes(phrase)) {
      if (corpus.haystack.includes(phrase)) return true;
      for (const s of syns) {
        if (corpus.haystack.includes(s)) return true;
      }
    }
  }

  const rawTokens = cleanQ.split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return true;

  // Every token must match directly or via synonym
  return rawTokens.every((t) => tokenMatches(t, corpus));
}

/**
 * Calculates a relevance score for matched products to order search results.
 */
export function scoreProductSearch(
  p: Product,
  query: string,
  category?: Category,
  brand?: Brand,
): number {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return 0;

  const corpus = buildProductCorpus(p, category, brand);
  let score = 0;

  // Exact matches
  if (corpus.sku && corpus.sku === cleanQ) score += 100;
  if (corpus.name === cleanQ) score += 80;
  if (corpus.name.startsWith(cleanQ)) score += 50;

  const rawTokens = cleanQ.split(/\s+/).filter(Boolean);
  for (const t of rawTokens) {
    if (corpus.name.includes(t)) score += 30;
    if (corpus.brand.includes(t)) score += 20;
    if (corpus.category.includes(t)) score += 15;
    if (corpus.sku && corpus.sku.includes(t)) score += 20;
    if (corpus.specs.includes(t)) score += 15;
  }

  return score;
}
