import type { EnquiryStatus } from "@/components/ui/status-badge";

export interface TrackedEnquiryItem {
  readonly id: string;
  readonly position: number;
  readonly productName: string;
  readonly brandName: string | null;
  readonly unitLabel: string;
  readonly quantity: number;
  readonly listedPrice: number | null;
}

export interface TrackedEnquiryStatusHistory {
  readonly id: string;
  readonly previousStatus: string | null;
  readonly newStatus: string;
  readonly description: string | null;
  readonly createdAt: string;
}

export interface TrackedEnquiryQuotation {
  readonly reference: string;
  readonly version: number;
  readonly totalAmount: number;
  readonly validUntil?: string | null;
  readonly trackingUrl: string;
}

export interface TrackedEnquiry {
  readonly reference: string;
  readonly type: "BULK" | "GENERAL";
  readonly status: EnquiryStatus;
  readonly customerName: string;
  readonly mobile: string;
  readonly email: string | null;
  readonly deliveryLocation: string | null;
  readonly message: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly items: readonly TrackedEnquiryItem[];
  readonly statusHistory: readonly TrackedEnquiryStatusHistory[];
  readonly latestQuotation?: TrackedEnquiryQuotation | null;
}

export type TrackedEnquiryResult =
  | { ok: true; enquiry: TrackedEnquiry }
  | { ok: false; code: "NOT_FOUND" | "EXPIRED" | "REVOKED" | "DATABASE_ERROR"; message: string };
