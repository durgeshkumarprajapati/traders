/** Stock statuses (approved). Labels/colours live with the badge component in `components/ui/status-badge.tsx`. */
export const STOCK_STATUSES = [
  "IN_STOCK",
  "LIMITED_STOCK",
  "OUT_OF_STOCK",
  "AVAILABLE_ON_ORDER",
] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

/** Customer-facing labels (single source; the badge component and the email builder both use it). */
export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  IN_STOCK: "In Stock",
  LIMITED_STOCK: "Limited Stock",
  OUT_OF_STOCK: "Out of Stock",
  AVAILABLE_ON_ORDER: "Available on Order",
};
