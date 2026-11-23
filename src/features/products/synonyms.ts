/**
 * Curated construction and building material vernacular synonyms dictionary.
 * Maps common vernacular terms (Hindi/Hinglish/trade terms) and alternate spellings
 * to canonical product keywords for multi-field search expansion.
 */

export const CONSTRUCTION_SYNONYMS: Record<string, readonly string[]> = {
  // Steel & Rebars
  sariya: ["tmt", "steel", "rebar", "fe 550d", "fe 500d"],
  saria: ["tmt", "steel", "rebar"],
  "dhalai sariya": ["tmt", "steel", "rebar", "10mm", "12mm"],
  chhad: ["tmt", "steel", "rebar"],
  loha: ["iron", "steel"],
  tmt: ["steel", "rebar", "sariya"],
  rebar: ["tmt", "steel", "sariya"],
  "binding wire": ["wire", "binding", "taar", "loha"],
  taar: ["wire", "binding wire"],

  // Cement & Concrete
  cement: ["ppc", "opc", "psc"],
  "dhalai cement": ["ppc", "opc", "cement"],
  "chhat cement": ["ppc", "opc", "cement"],
  "chhat dhalai": ["cement", "tmt", "sariya"],
  ppc: ["cement", "portland pozzolana"],
  opc: ["cement", "ordinary portland"],
  psc: ["cement", "slag", "portland slag"],

  // Bricks & Blocks
  eent: ["brick", "red brick", "clay brick"],
  ent: ["brick", "red brick"],
  eet: ["brick", "red brick"],
  int: ["brick", "red brick"],
  "red bricks": ["clay", "brick", "red"],
  "fly ash": ["brick", "block", "ash"],
  aac: ["block", "autoclaved", "aerated"],
  blocks: ["aac", "concrete", "block"],

  // Aggregates, Sand & Stone
  reti: ["sand", "river sand", "m-sand"],
  balu: ["sand", "river sand"],
  badarpur: ["sand", "aggregate", "crushed"],
  sand: ["reti", "balu", "m-sand"],
  gitti: ["aggregate", "stone", "gravel", "crushed"],
  aggregate: ["gitti", "gravel", "stone"],
  morrum: ["soil", "gravel", "filling"],
  dust: ["stone dust", "crushed stone", "m-sand"],

  // Plumbing, Pipes & Fittings
  nal: ["pipe", "plumbing"],
  nalli: ["pipe", "plumbing"],
  pipe: ["pvc", "cpvc", "upvc", "plumbing", "conduit"],
  pvc: ["pipe", "conduit", "plumbing"],
  cpvc: ["pipe", "hot cold", "plumbing"],
  upvc: ["pipe", "plumbing"],

  // Waterproofing & Chemicals
  waterproof: ["waterproofing", "chemical", "sealant", "dampproof"],
  "waterproofing chemical": ["chemical", "sealant", "admixture", "curing"],
  chemical: ["waterproofing", "admixture", "curing"],
  dampproof: ["waterproofing", "sealant", "liquid"],

  // Wall Care, Putty & Paint
  putty: ["wall putty", "skim coat"],
  "wall putty": ["putty", "skim coat"],
  "white cement": ["cement"],
  paint: ["primer", "emulsion", "distemper"],
  primer: ["paint", "wall primer"],

  // Roofing & Sheets
  patra: ["sheet", "tin sheet", "roofing", "corrugated"],
  tin: ["sheet", "roofing", "corrugated"],
  sheet: ["roofing", "corrugated", "profile"],
};

/**
 * Prototype-safe lookup: a plain object would return Object.prototype members for queries such as "constructor" or
 * "__proto__" (which are not iterable and would crash the search page).
 */
const SYNONYM_MAP: ReadonlyMap<string, readonly string[]> = new Map(
  Object.entries(CONSTRUCTION_SYNONYMS),
);

export function synonymsFor(term: string): readonly string[] {
  return SYNONYM_MAP.get(term) ?? [];
}

/** Multi-word dictionary keys, longest first, so a longer phrase wins over a shorter one it contains. */
export const SYNONYM_PHRASES: readonly string[] = [...SYNONYM_MAP.keys()]
  .filter((k) => k.includes(" "))
  .sort((a, b) => b.length - a.length);

/**
 * Expands a search query string with related synonym tokens.
 * Returns the typed words plus the dictionary expansions for them (informational; matching lives in smart-search.ts).
 */
export function getSynonymTokens(query: string): string[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return [];
  const tokens = clean.split(/\s+/).filter(Boolean);
  const expanded = new Set<string>(tokens);
  for (const phrase of SYNONYM_PHRASES)
    if (clean.includes(phrase)) for (const x of synonymsFor(phrase)) expanded.add(x);
  for (const token of tokens) for (const x of synonymsFor(token)) expanded.add(x);
  return Array.from(expanded);
}
