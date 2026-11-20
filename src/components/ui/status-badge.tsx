import { STOCK_STATUSES, STOCK_STATUS_LABELS, type StockStatus } from "@/features/products/stock";
import { Badge, type Tone } from "./badge";

// Re-exported so existing imports keep working; the constant now lives in a plain module so the
// server-side data layer does not import a React component file.
export { STOCK_STATUSES, type StockStatus };

/** Single source of truth mapping domain statuses to badge styling (palette-only). */
export type EnquiryStatus =
  "NEW" | "CONTACTED" | "QUOTATION_SENT" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

const stock: Record<StockStatus, { label: string; tone: Tone }> = {
  IN_STOCK: { label: STOCK_STATUS_LABELS.IN_STOCK, tone: "success" },
  LIMITED_STOCK: { label: STOCK_STATUS_LABELS.LIMITED_STOCK, tone: "warning" },
  OUT_OF_STOCK: { label: STOCK_STATUS_LABELS.OUT_OF_STOCK, tone: "error" },
  AVAILABLE_ON_ORDER: { label: STOCK_STATUS_LABELS.AVAILABLE_ON_ORDER, tone: "info" },
};

const enquiry: Record<
  EnquiryStatus,
  { label: string; tone: Tone; appearance: "solid" | "outline" }
> = {
  NEW: { label: "New", tone: "primary", appearance: "solid" },
  CONTACTED: { label: "Contacted", tone: "warning", appearance: "solid" },
  QUOTATION_SENT: { label: "Quotation Sent", tone: "info", appearance: "solid" },
  CONFIRMED: { label: "Confirmed", tone: "success", appearance: "outline" },
  COMPLETED: { label: "Completed", tone: "success", appearance: "solid" },
  CANCELLED: { label: "Cancelled", tone: "error", appearance: "solid" },
};

export function StockBadge({ status }: { status: StockStatus }) {
  const s = stock[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  const s = enquiry[status];
  return (
    <Badge tone={s.tone} appearance={s.appearance}>
      {s.label}
    </Badge>
  );
}

/** Customer-facing label for a stock status (single source, shared with filters and tables). */
export function stockStatusLabel(status: StockStatus): string {
  return stock[status].label;
}
