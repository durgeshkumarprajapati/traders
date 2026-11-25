import type { UnitCode } from "@/features/products/units";

export const QUOTATION_STATUSES = [
  "DRAFT",
  "ISSUED",
  "REVISED",
  "EXPIRED",
  "ACCEPTED",
  "REJECTED",
  "CHANGE_REQUESTED",
] as const;

export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export type QuotationLinkState = "NONE" | "ACTIVE" | "EXPIRED" | "REVOKED";

export interface QuotationItemInput {
  productId?: string | null;
  sku?: string | null;
  productName: string;
  brandName?: string | null;
  unitCode: UnitCode;
  unitLabel: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
}

export interface QuotationItem extends QuotationItemInput {
  id: string;
  quotationId: string;
  position: number;
  lineTotal: number;
}

export interface QuotationRecord {
  id: string;
  reference: string;
  enquiryId: string;
  enquiryReference?: string;
  version: number;
  status: QuotationStatus;
  customerName: string;
  mobile: string;
  email: string | null;
  deliveryLocation: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  termsAndConditions: string | null;
  validUntil: string | null;
  /** State of the customer access link. The token itself is never stored (only its hash) and never sent to the browser. */
  linkState: QuotationLinkState;
  linkExpiresAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  issuedAt: string | null;
  items: QuotationItem[];
}

export interface CustomerTrackedQuotation {
  reference: string;
  enquiryReference: string;
  version: number;
  status: QuotationStatus;
  /** False when a newer version has been issued: this one is shown as superseded. */
  isLatest: boolean;
  /** True once the validity date has passed; the quotation is then informational only. */
  isExpired: boolean;
  customerName: string;
  deliveryLocation: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  termsAndConditions: string | null;
  validUntil: string | null;
  issuedAt: string | null;
  response?: {
    responseType: "ACCEPTED" | "CHANGE_REQUESTED" | "REJECTED";
    comment: string | null;
    respondedAt: string;
  } | null;
  items: Array<{
    position: number;
    productName: string;
    brandName: string | null;
    unitLabel: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    notes: string | null;
  }>;
}
