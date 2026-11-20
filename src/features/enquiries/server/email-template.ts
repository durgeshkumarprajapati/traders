import { formatPrice } from "@/features/products/format";
import { STOCK_STATUS_LABELS, STOCK_STATUSES, type StockStatus } from "@/features/products/stock";
import type { EmailMessage } from "@/lib/email/web3forms";

/** Shapes returned by the `claim_notification` database function (validated before use). */
export type EmailEnquiry = {
  reference: string;
  type: "BULK" | "GENERAL";
  customer_name: string;
  mobile: string;
  email: string | null;
  delivery_location: string | null;
  message: string | null;
  created_at: string;
};
export type EmailItem = {
  position: number;
  product_id: string;
  sku: string | null;
  product_name: string;
  brand_name: string | null;
  unit_label: string;
  quantity: number | string;
  listed_price: number | string | null;
  stock_status: string;
};

/** Plain-text only (no HTML), control characters removed, bounded length: customer text can never inject markup or headers. */
const text = (v: string | null | undefined, max = 1200) =>
  (v ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);
const oneLine = (v: string | null | undefined, max = 200) => text(v, max).replace(/\s+/g, " ");

function itemLine(i: EmailItem): string {
  const price = i.listed_price === null ? null : formatPrice(Number(i.listed_price));
  const stock = (STOCK_STATUSES as readonly string[]).includes(i.stock_status)
    ? STOCK_STATUS_LABELS[i.stock_status as StockStatus]
    : oneLine(i.stock_status, 30);
  return [
    `${i.position}. ${oneLine(i.product_name)}${i.brand_name ? ` (${oneLine(i.brand_name, 100)})` : ""}${i.sku ? ` [SKU ${oneLine(i.sku, 64)}]` : ""}`,
    `   Quantity: ${Number(i.quantity)} ${oneLine(i.unit_label, 40)}`,
    `   Listed price at submission: ${price ? `${price} per ${oneLine(i.unit_label, 40)}` : "none (rate on request)"} — indicative`,
    `   Availability at submission: ${stock}`,
  ].join("\n");
}

/** Build the notification email for the business owner from the stored snapshots. */
export function buildEnquiryEmail(enquiry: EmailEnquiry, items: EmailItem[]): EmailMessage {
  const kind = enquiry.type === "BULK" ? "Bulk quotation enquiry" : "General enquiry";
  const lines = [
    `${kind} ${enquiry.reference}`,
    `Received: ${oneLine(enquiry.created_at, 40)}`,
    "",
    "CUSTOMER",
    `Name: ${oneLine(enquiry.customer_name, 100)}`,
    `Mobile: ${oneLine(enquiry.mobile, 20)}`,
    `Email: ${enquiry.email ? oneLine(enquiry.email, 254) : "—"}`,
    ...(enquiry.delivery_location
      ? [`Delivery location: ${oneLine(enquiry.delivery_location, 300)}`]
      : []),
    ...(enquiry.message ? ["", "MESSAGE", text(enquiry.message, 1000)] : []),
    ...(items.length > 0 ? ["", `ITEMS (${items.length})`, ...items.map(itemLine)] : []),
    "",
    "Prices shown are the indicative listed prices at the time of the enquiry. The enquiry is stored in the admin system under the reference above.",
  ];
  const email =
    enquiry.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enquiry.email) ? enquiry.email : undefined;
  return {
    subject: `${kind} ${enquiry.reference}`.slice(0, 150),
    fromName: "Sagar Traders website",
    text: lines.join("\n"),
    ...(email ? { replyTo: email } : {}),
  };
}
