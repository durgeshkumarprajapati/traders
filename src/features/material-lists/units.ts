/**
 * Whether a calculated quantity's unit is the same kind of unit as a catalogue product's unit. Used ONLY to warn the customer —
 * quantities are never converted automatically (TON and METRIC_TON, bags and kilograms are different units and stay different).
 */
const norm = (u: string): string => {
  const s = u
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/^bags?$/.test(s)) return "bag";
  if (/^(cubic feet|cubic foot|cft|cu ft)$/.test(s)) return "cubic feet";
  if (/^(pieces?|pcs|blocks?|bricks?)$/.test(s)) return "piece";
  if (/^(kg|kgs|kilograms?)$/.test(s)) return "kg";
  return s;
};

export function unitsMatch(calculated: string, product: string): boolean {
  if (!calculated.trim() || !product.trim()) return false;
  return norm(calculated) === norm(product);
}
