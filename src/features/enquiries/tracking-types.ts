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
  readonly isExpired?: boolean;
}

export interface TrackedEnquiry {
  readonly reference: string;
  readonly type: "BULK" | "GENERAL";
  readonly status: EnquiryStatus;
  /** Deliberately NO customer name, mobile, email or message: the tracking payload carries only what the customer needs. */
  readonly deliveryLocation: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly items: readonly TrackedEnquiryItem[];
  readonly statusHistory: readonly TrackedEnquiryStatusHistory[];
  readonly latestQuotation?: TrackedEnquiryQuotation | null;
}

export type TrackedEnquiryResult =
  | { ok: true; enquiry: TrackedEnquiry }
  | { ok: false; code: "NOT_FOUND" | "EXPIRED" | "REVOKED" | "DATABASE_ERROR"; message: string };

/**
 * Tracking link path. The credentials go in the URL FRAGMENT (after `#`): browsers never send a fragment to the server,
 * so the token is not written to access logs, CDN logs or `Referer` headers. The page reads it client-side.
 */
export function trackingPath(reference: string, token: string): string {
  return `/track-enquiry#ref=${encodeURIComponent(reference)}&token=${encodeURIComponent(token)}`;
}

/** Parses `ref` / `token` from a URL fragment (`#ref=…&token=…`) or a legacy query string (`?ref=…&token=…`). */
export function parseTrackingParams(hashOrSearch: string): { ref: string; token: string } | null {
  const p = new URLSearchParams(hashOrSearch.replace(/^[#?]/, ""));
  const ref = p.get("ref")?.trim() ?? "";
  const token = p.get("token")?.trim() ?? "";
  return ref && token ? { ref, token } : null;
}
