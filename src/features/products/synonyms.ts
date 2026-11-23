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
  loha: ["steel", "tmt", "iron", "wire"],
  tmt: ["steel", "rebar", "bar", "sariya"],
  rebar: ["tmt", "steel", "sariya"],
  "binding wire": ["wire", "binding", "taar", "loha"],
  taar: ["wire", "binding wire"],

  // Cement & Concrete
  cement: ["ppc", "opc", "dhalai", "concrete", "mortar", "bind"],
  "dhalai cement": ["ppc", "opc", "cement", "concrete"],
  "chhat cement": ["ppc", "cement", "dhalai"],
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
  nal: ["pipe", "plumbing", "pvc", "cpvc"],
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
  putty: ["wall putty", "white cement", "skim coat", "basecoat"],
  "wall putty": ["putty", "white cement", "polymer"],
  "white cement": ["putty", "portland", "decorative"],
  paint: ["primer", "emulsion", "distemper"],
  primer: ["paint", "wall primer"],

  // Roofing & Sheets
  patra: ["sheet", "tin sheet", "roofing", "corrugated"],
  tin: ["sheet", "roofing", "corrugated"],
  sheet: ["roofing", "corrugated", "profile"],
};

/**
 * Expands a search query string with related synonym tokens.
 * Returns an array of search token groups where any term in a group satisfying a match contributes.
 */
export function getSynonymTokens(query: string): string[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return [];

  const tokens = clean.split(/\s+/).filter(Boolean);
  const expanded = new Set<string>(tokens);

  // Check multi-word phrases first
  for (const [phrase, syns] of Object.entries(CONSTRUCTION_SYNONYMS)) {
    if (phrase.includes(" ") && clean.includes(phrase)) {
      for (const s of syns) expanded.add(s);
    }
  }

  // Check single-word tokens
  for (const token of tokens) {
    const syns = CONSTRUCTION_SYNONYMS[token];
    if (syns) {
      for (const s of syns) expanded.add(s);
    }
  }

  return Array.from(expanded);
}
