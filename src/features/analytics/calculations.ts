import type { AttributionSource, ConversionMetrics, DateRangePreset } from "./types";

/**
 * Percentage rounded to 1 decimal place. Always returns 0 when denominator <= 0
 * so charts and KPI cards never render NaN or Infinity.
 */
export function safeRate(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * Computes distinct-enquiry conversion rates without double-counting quotation revisions.
 *
 * Formulas:
 * - Enquiry -> Quotation: distinct quoted enquiries / distinct non-cancelled enquiries
 * - Quotation -> Confirmation: distinct confirmed-or-completed enquiries / distinct quoted enquiries
 * - Confirmation -> Completion: distinct completed enquiries / distinct confirmed-or-completed enquiries
 * - Overall Conversion: distinct completed enquiries / distinct non-cancelled enquiries
 */
export function computeConversionMetrics(input: {
  nonCancelledEnquiryIds: string[];
  quotedEnquiryIds: string[];
  confirmedEnquiryIds: string[];
  completedEnquiryIds: string[];
}): ConversionMetrics {
  const activeSet = new Set(input.nonCancelledEnquiryIds);
  const quotedSet = new Set(input.quotedEnquiryIds.filter((id) => activeSet.has(id)));
  const completedSet = new Set(input.completedEnquiryIds.filter((id) => activeSet.has(id)));
  const confirmedOrCompletedSet = new Set([
    ...input.confirmedEnquiryIds.filter((id) => activeSet.has(id)),
    ...completedSet,
  ]);

  const activeCount = activeSet.size;
  const quotedCount = quotedSet.size;
  const confirmedOrCompletedCount = confirmedOrCompletedSet.size;
  const completedCount = completedSet.size;

  return {
    enquiryToQuotationRate: safeRate(quotedCount, activeCount),
    quotationToConfirmationRate: safeRate(confirmedOrCompletedCount, quotedCount),
    confirmationToCompletionRate: safeRate(completedCount, confirmedOrCompletedCount),
    overallConversionRate: safeRate(completedCount, activeCount),
    activeEnquiriesDenominator: activeCount,
    quotedEnquiriesCount: quotedCount,
    confirmedOrCompletedCount,
    completedCount,
  };
}

export function resolveDateRange(
  preset: DateRangePreset,
  customFrom?: string,
  customTo?: string,
  now = new Date(),
): { from: Date; to: Date } {
  const end = new Date(now);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  switch (preset) {
    case "TODAY":
      return { from: startOfToday, to: end };
    case "7D":
      return { from: new Date(startOfToday.getTime() - 6 * 86_400_000), to: end };
    case "30D":
      return { from: new Date(startOfToday.getTime() - 29 * 86_400_000), to: end };
    case "90D":
      return { from: new Date(startOfToday.getTime() - 89 * 86_400_000), to: end };
    case "THIS_MONTH":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), to: end };
    case "PREV_MONTH": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from, to };
    }
    case "CUSTOM": {
      const parsedFrom = customFrom ? new Date(customFrom) : startOfToday;
      const parsedTo = customTo ? new Date(customTo) : end;
      return {
        from: Number.isNaN(parsedFrom.getTime()) ? startOfToday : parsedFrom,
        to: Number.isNaN(parsedTo.getTime()) ? end : parsedTo,
      };
    }
  }
}

export function normalizeAttributionSource(input: {
  utmSource?: string | null;
  utmMedium?: string | null;
  qrCampaign?: string | null;
  referrer?: string | null;
}): AttributionSource {
  if (input.qrCampaign?.trim()) return "QR_CODE";

  const src = (input.utmSource ?? "").trim().toLowerCase();
  const med = (input.utmMedium ?? "").trim().toLowerCase();
  const ref = (input.referrer ?? "").trim().toLowerCase();

  if (src.includes("whatsapp") || med.includes("whatsapp") || ref.includes("wa.me")) {
    return "WHATSAPP";
  }
  if (src.includes("maps") || ref.includes("maps.google")) {
    return "GOOGLE_MAPS";
  }
  if (src.includes("google") || ref.includes("google.")) {
    return "GOOGLE_SEARCH";
  }
  if (
    src.includes("facebook") ||
    src.includes("instagram") ||
    med.includes("social") ||
    ref.includes("facebook.") ||
    ref.includes("instagram.")
  ) {
    return "SOCIAL_MEDIA";
  }
  if (med.includes("referral") || src.includes("referral")) {
    return "REFERRAL";
  }
  if (!src && !ref) {
    return "DIRECT_WEBSITE";
  }
  if (ref) return "REFERRAL";
  return "OTHER";
}

export function buildAnalyticsCsv(rows: Record<string, string | number | null>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");
}
