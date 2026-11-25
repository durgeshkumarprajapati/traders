// @vitest-environment node
import { createHmac } from "node:crypto";
import { normalizeIndianMobile, updateCustomerSchema } from "@/features/crm/schemas";
import {
  buildAnalyticsCsv,
  computeConversionMetrics,
  normalizeAttributionSource,
  safeRate,
} from "@/features/analytics/calculations";
import { isValidOrderTransition } from "@/features/orders/server/orders";
import { saveProjectSchema } from "@/features/projects/schemas";
import {
  buildEnquiryReferenceShareUrl,
  buildOrderStatusShareUrl,
  buildQuotationShareUrl,
} from "@/features/whatsapp/manual";
import {
  MetaCloudWhatsAppProvider,
  verifyWhatsAppWebhookSignature,
} from "@/features/whatsapp/provider";

describe("Phase 14 — CRM identity & validation", () => {
  it("normalizes Indian mobile numbers consistently", () => {
    expect(normalizeIndianMobile("9876543210")).toBe("9876543210");
    expect(normalizeIndianMobile("+91 98765-43210")).toBe("9876543210");
    expect(normalizeIndianMobile("09876543210")).toBe("9876543210");
    expect(normalizeIndianMobile("919876543210")).toBe("9876543210");
    expect(normalizeIndianMobile("1234567890")).toBeNull();
    expect(normalizeIndianMobile("98765")).toBeNull();
  });

  it("validates customer profile updates without requiring GSTIN", () => {
    const parsed = updateCustomerSchema.safeParse({
      name: "Suresh Constructions",
      customerType: "CONTRACTOR",
      relationshipTier: "PREFERRED",
      isContractor: true,
      programmeStatus: "ACTIVE",
      lifecycleStatus: "ACTIVE",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("Phase 14 — Business Analytics & Attribution", () => {
  it("handles zero denominators without NaN or Infinity", () => {
    expect(safeRate(0, 0)).toBe(0);
    expect(safeRate(5, 0)).toBe(0);
    expect(safeRate(1, 3)).toBe(33.3);
  });

  it("deduplicates multiple quotation revisions for the same enquiry", () => {
    const m = computeConversionMetrics({
      nonCancelledEnquiryIds: ["e1", "e2", "e3", "e4"],
      quotedEnquiryIds: ["e1", "e1", "e1", "e2"],
      confirmedEnquiryIds: ["e1"],
      completedEnquiryIds: ["e1"],
    });
    expect(m.quotedEnquiriesCount).toBe(2);
    expect(m.enquiryToQuotationRate).toBe(50);
    expect(m.quotationToConfirmationRate).toBe(50);
    expect(m.confirmationToCompletionRate).toBe(100);
    expect(m.overallConversionRate).toBe(25);
  });

  it("normalizes attribution sources from UTM, QR, and referrer", () => {
    expect(normalizeAttributionSource({ qrCampaign: "depot-poster" })).toBe("QR_CODE");
    expect(normalizeAttributionSource({ utmSource: "google", utmMedium: "cpc" })).toBe(
      "GOOGLE_SEARCH",
    );
    expect(normalizeAttributionSource({ utmSource: "whatsapp" })).toBe("WHATSAPP");
    expect(normalizeAttributionSource({ referrer: "https://maps.google.com/" })).toBe(
      "GOOGLE_MAPS",
    );
    expect(normalizeAttributionSource({})).toBe("DIRECT_WEBSITE");
  });

  it("builds safe CSV output", () => {
    const csv = buildAnalyticsCsv([{ month: "2026-11", enquiries: 12 }]);
    expect(csv).toBe("month,enquiries\n2026-11,12");
  });
});

describe("Phase 14 — WhatsApp Integration", () => {
  it("builds manual click-to-chat URLs from verified business/customer data", () => {
    const url = buildQuotationShareUrl({
      customerMobile: "919876543210",
      customerName: "Amit",
      businessName: "Sagar Traders",
      quotationReference: "QUO-2026-001001",
      quotationUrl: "https://example.com/quotation/tok",
    });
    expect(url).toContain("https://wa.me/919876543210?text=");
    expect(decodeURIComponent(url!)).toContain("QUO-2026-001001");

    const enqUrl = buildEnquiryReferenceShareUrl({
      customerMobile: "9876543210",
      customerName: "Amit",
      businessName: "Sagar Traders",
      enquiryReference: "ENQ-ABCD-1234-EF56",
    });
    expect(enqUrl).toContain("https://wa.me/9876543210?text=");

    const ordUrl = buildOrderStatusShareUrl({
      customerMobile: "9876543210",
      customerName: "Amit",
      businessName: "Sagar Traders",
      orderReference: "ORD-2026-001001",
      orderStatus: "OUT_FOR_DELIVERY",
    });
    expect(decodeURIComponent(ordUrl!)).toContain("OUT FOR DELIVERY");
  });

  it("keeps automated delivery disabled and refuses to simulate when credentials are absent", async () => {
    const provider = new MetaCloudWhatsAppProvider({ configured: false, provider: "NONE" });
    expect(provider.isConfigured()).toBe(false);
    const res = await provider.sendTemplateMessage({
      recipientMobile: "9876543210",
      templateName: "order_update",
      idempotencyKey: "k1",
    });
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe("NOT_CONFIGURED");
  });

  it("verifies Meta webhook HMAC-SHA256 signatures", () => {
    const secret = "test_app_secret";
    const body = '{"entry":[]}';
    const sig = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(verifyWhatsAppWebhookSignature(body, sig, secret)).toBe(true);
    expect(verifyWhatsAppWebhookSignature(body, "sha256=deadbeef", secret)).toBe(false);
    expect(verifyWhatsAppWebhookSignature(body, sig, undefined)).toBe(false);
  });
});

describe("Phase 14 — Orders & Project Showcase", () => {
  it("enforces valid order status transitions", () => {
    expect(isValidOrderTransition("CONFIRMED", "PREPARING")).toBe(true);
    expect(isValidOrderTransition("CONFIRMED", "DELIVERED")).toBe(false);
    expect(isValidOrderTransition("DELIVERED", "CANCELLED")).toBe(false);
  });

  it("blocks publishing projects without authenticity confirmation or customer consent", () => {
    const unconfirmed = saveProjectSchema.safeParse({
      title: "Raipur Commercial Complex",
      slug: "raipur-commercial-complex",
      description: "Supplied 500 bags of PPC cement and TMT steel.",
      category: "Commercial",
      status: "PUBLISHED",
      authenticityConfirmed: false,
    });
    expect(unconfirmed.success).toBe(false);

    const missingConsent = saveProjectSchema.safeParse({
      title: "Raipur Commercial Complex",
      slug: "raipur-commercial-complex",
      description: "Supplied 500 bags of PPC cement and TMT steel.",
      category: "Commercial",
      customerDisplayName: "Ramesh Verma",
      isAnonymized: false,
      status: "PUBLISHED",
      authenticityConfirmed: true,
      customerConsentObtained: false,
    });
    expect(missingConsent.success).toBe(false);

    const validAnonymized = saveProjectSchema.safeParse({
      title: "Raipur Commercial Complex",
      slug: "raipur-commercial-complex",
      description: "Supplied 500 bags of PPC cement and TMT steel.",
      category: "Commercial",
      isAnonymized: true,
      status: "PUBLISHED",
      authenticityConfirmed: true,
    });
    expect(validAnonymized.success).toBe(true);
  });
});
