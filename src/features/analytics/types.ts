export const ATTRIBUTION_SOURCES = [
  "GOOGLE_SEARCH",
  "GOOGLE_MAPS",
  "DIRECT_WEBSITE",
  "WHATSAPP",
  "QR_CODE",
  "REFERRAL",
  "SOCIAL_MEDIA",
  "EXISTING_CUSTOMER",
  "OTHER",
  "UNKNOWN",
] as const;
export type AttributionSource = (typeof ATTRIBUTION_SOURCES)[number];

export type DateRangePreset =
  | "TODAY"
  | "7D"
  | "30D"
  | "90D"
  | "THIS_MONTH"
  | "PREV_MONTH"
  | "CUSTOM";

export interface AnalyticsOverview {
  totalEnquiries: number;
  newEnquiries: number;
  contactedEnquiries: number;
  quotationsIssuedEnquiries: number;
  confirmedEnquiries: number;
  completedEnquiries: number;
  cancelledEnquiries: number;
  totalCustomers: number;
  newCustomers: number;
  repeatCustomers: number;
  totalQuotations: number;
  acceptedQuotations: number;
  pendingQuotationResponses: number;
  totalOrders: number;
  completedOrders: number;
}

export interface ProductEnquiryMetric {
  productId: string;
  productName: string;
  brandName: string | null;
  enquiryCount: number;
  totalQuantity: number;
}

export interface ConversionMetrics {
  enquiryToQuotationRate: number;
  quotationToConfirmationRate: number;
  confirmationToCompletionRate: number;
  overallConversionRate: number;
  activeEnquiriesDenominator: number;
  quotedEnquiriesCount: number;
  confirmedOrCompletedCount: number;
  completedCount: number;
}

export interface MonthlyTrendPoint {
  month: string;
  enquiries: number;
  quotations: number;
  confirmedEnquiries: number;
  completedOrders: number;
  newCustomers: number;
  repeatCustomers: number;
}

export interface AttributionSummaryRow {
  source: AttributionSource;
  count: number;
}

export interface AnalyticsDashboardData {
  preset: DateRangePreset;
  fromIso: string;
  toIso: string;
  overview: AnalyticsOverview;
  conversion: ConversionMetrics;
  topProducts: ProductEnquiryMetric[];
  topBrands: { brandName: string; enquiryCount: number }[];
  monthlyTrends: MonthlyTrendPoint[];
  attribution: AttributionSummaryRow[];
}
