import { unitLabel, type ProductUnit } from "./units";

/** Exact approved disclaimer. Show wherever a price (or "rate on request") appears. */
export const PRICE_DISCLAIMER =
  "Prices are indicative and subject to change. Please confirm the final rate before placing an order.";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

/** "₹1,234.50" — or null when there is no valid price. A missing/invalid/non-positive price is never shown as 0. */
export function formatPrice(price: number | null): string | null {
  if (price === null || !Number.isFinite(price) || price <= 0) return null;
  return inr.format(price);
}

/** "₹1,234.50 / Bag" — or null when there is no valid price. */
export function formatRate(price: number | null, unit: ProductUnit): string | null {
  const p = formatPrice(price);
  return p ? `${p} / ${unitLabel(unit)}` : null;
}

/** Absolute, locale-stable date (e.g. "18 Nov 2026"). Returns null for missing/invalid input; never fabricates a date. */
export function formatUpdated(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(t);
}
