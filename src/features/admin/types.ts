import type { EnquiryStatus, StockStatus } from "@/components/ui/status-badge";

export type {
  CatalogueBrand,
  CatalogueCategory,
  CatalogueProduct,
  BusinessSettingsRecord,
  ValidationIssue,
  CatalogueSnapshot,
  WorksheetStats,
} from "@/features/catalogue/types";

export const ENQUIRY_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUOTATION_SENT",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type { EnquiryStatus, StockStatus };

export const ALLOWED_STATUS_TRANSITIONS: Record<EnquiryStatus, readonly EnquiryStatus[]> = {
  NEW: ["CONTACTED", "QUOTATION_SENT", "CANCELLED"],
  CONTACTED: ["QUOTATION_SENT", "CONFIRMED", "CANCELLED"],
  QUOTATION_SENT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: ["NEW"],
};

export interface AdminEnquiryListItem {
  id: string;
  reference: string;
  type: "BULK" | "GENERAL";
  status: EnquiryStatus;
  customerName: string;
  mobile: string;
  email: string | null;
  deliveryLocation: string | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  isCallback?: boolean;
}

export interface AdminEnquiryItem {
  id: string;
  position: number;
  productId: string;
  sku: string | null;
  productName: string;
  brandName: string | null;
  unitCode: string;
  unitLabel: string;
  quantity: number;
  listedPrice: number | null;
  stockStatus: StockStatus;
}

export interface AdminEnquiryNote {
  id: string;
  enquiryId: string;
  authorId: string;
  authorEmail: string | null;
  authorName: string | null;
  body: string;
  createdAt: string;
}

export interface AdminNotificationOutboxStatus {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "SENT" | "FAILED";
  attemptCount: number;
  maxAttempts: number;
  lastError: string | null;
  sentAt: string | null;
  nextAttemptAt: string;
}

export interface AdminEnquiryDetail {
  id: string;
  reference: string;
  type: "BULK" | "GENERAL";
  status: EnquiryStatus;
  customerName: string;
  mobile: string;
  email: string | null;
  deliveryLocation: string | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  items: AdminEnquiryItem[];
  notes: AdminEnquiryNote[];
  outbox: AdminNotificationOutboxStatus | null;
  trackingTokenHash?: string | null;
  trackingTokenExpiresAt?: string | null;
  trackingTokenRevokedAt?: string | null;
  callbackDetails?: {
    preferredDate: string | null;
    preferredTimeWindow: string | null;
    reason: string | null;
  } | null;
  statusHistory?: Array<{
    id: string;
    previousStatus: string | null;
    newStatus: string;
    description: string | null;
    createdAt: string;
  }>;
}

export interface AdminEnquiryListResult {
  enquiries: AdminEnquiryListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
