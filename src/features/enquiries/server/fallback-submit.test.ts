// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getStaticCatalogue } from "@/features/catalogue/data/static-catalogue";
import { SupabaseApiError } from "@/lib/supabase/errors";
import { submitBulkEnquiry, submitContactEnquiry } from "./submit";
import { bulkInput, contactInput, setup } from "./test-helpers";

const ctx = { ip: "203.0.113.88" };

describe("Phase 11 Enquiry Fallback & Reliability", () => {
  it("submits a bulk enquiry using static fallback products and stores null prices", async () => {
    const staticCat = getStaticCatalogue();
    const t = await setup({
      loadCatalogue: async () => ({
        ok: true,
        catalogue: staticCat,
        settings: {
          name: "Sagar Traders",
          tagline: null,
          phone: null,
          whatsappNumber: null,
          email: null,
          address: null,
          businessHours: null,
          gstNumber: null,
          googleMapsUrl: null,
          deliveryCoverage: null,
          announcement: null,
          social: {},
          whyChooseUs: [],
        },
        source: "STATIC",
        fetchedAt: new Date().toISOString(),
      }),
    });

    const input = bulkInput({
      items: [
        { productId: "static-cement-opc53", quantity: 50 },
        { productId: "static-steel-tmt-12mm", quantity: 20 },
      ],
    });

    const res = await submitBulkEnquiry(input, ctx, t.deps);
    expect(res).toMatchObject({ ok: true, reference: expect.stringMatching(/^ENQ-\d{4}-\d{6}$/) });

    expect(t.db.enquiries).toHaveLength(1);
    expect(t.db.items).toHaveLength(2);

    // Verify snapshots: prices must be null (never fabricated!)
    expect(t.db.items[0]).toMatchObject({
      product_id: "static-cement-opc53",
      product_name: "OPC 53 Grade Cement",
      quantity: 50,
      listed_price: null,
      stock_status: "AVAILABLE_ON_ORDER",
    });
    expect(t.db.items[1]).toMatchObject({
      product_id: "static-steel-tmt-12mm",
      product_name: "Fe 550D TMT Steel Rebar 12mm",
      quantity: 20,
      listed_price: null,
      stock_status: "AVAILABLE_ON_ORDER",
    });
  });

  it("server-side product resolution rejects browser-tampered prices and brands", async () => {
    const staticCat = getStaticCatalogue();
    const t = await setup({
      loadCatalogue: async () => ({
        ok: true,
        catalogue: staticCat,
        settings: {
          name: "Sagar Traders",
          tagline: null,
          phone: null,
          whatsappNumber: null,
          email: null,
          address: null,
          businessHours: null,
          gstNumber: null,
          googleMapsUrl: null,
          deliveryCoverage: null,
          announcement: null,
          social: {},
          whyChooseUs: [],
        },
        source: "STATIC",
        fetchedAt: new Date().toISOString(),
      }),
    });

    const hostile = bulkInput({
      items: [
        {
          productId: "static-cement-opc53",
          quantity: 10,
          price: 5, // hostile browser price
          listedPrice: 5,
          productName: "Hacked Cement",
          brandName: "Fake Brand",
          stockStatus: "IN_STOCK",
        },
      ],
    });

    const res = await submitBulkEnquiry(hostile, ctx, t.deps);
    expect(res).toMatchObject({ ok: true });

    expect(t.db.items[0]).toMatchObject({
      product_id: "static-cement-opc53",
      product_name: "OPC 53 Grade Cement", // authoritative
      listed_price: null, // authoritative (never 5)
      stock_status: "AVAILABLE_ON_ORDER", // authoritative
    });
  });

  it("activates degraded email-only fallback when Supabase is down and Web3Forms is available", async () => {
    const emailsSent: Array<{ subject: string; text: string }> = [];
    const t = await setup({
      enableEmailFallback: true,
      web3formsConfig: { accessKey: "test-web3forms-key-12345" },
      sendEmail: async (_cfg, msg) => {
        emailsSent.push(msg);
        return { ok: true };
      },
    });

    // Simulate Supabase create_enquiry failure
    t.db.failNext(
      "create_enquiry",
      new SupabaseApiError("Database connection lost", 500, "XX000", true),
    );

    const res = await submitBulkEnquiry(bulkInput(), ctx, t.deps);

    expect(res).toMatchObject({
      ok: true,
      mode: "EMAIL_FALLBACK",
      reference: expect.stringMatching(/^ENQ-\d{4}-FAL-\d{6}$/),
      message: "Your enquiry has been sent successfully. Our team will contact you shortly.",
    });

    // Database must not have phantom entries
    expect(t.db.enquiries).toHaveLength(0);

    // Email must have been dispatched directly
    expect(emailsSent).toHaveLength(1);
    expect(emailsSent[0].subject).toContain("Bulk quotation enquiry");
    expect(emailsSent[0].text).toContain("DEGRADED EMAIL FALLBACK");
    expect(emailsSent[0].text).toContain("Asha Rao");
  });

  it("returns UNAVAILABLE and preserves entered data when both Supabase and Web3Forms fail", async () => {
    const t = await setup({
      enableEmailFallback: true,
      web3formsConfig: { accessKey: "test-web3forms-key-12345" },
      sendEmail: async () => ({
        ok: false,
        kind: "NETWORK",
        status: null,
        retryable: true,
        summary: "Web3Forms unreachable",
      }),
    });

    // Simulate Supabase create_enquiry failure
    t.db.failNext("create_enquiry", new SupabaseApiError("Database down", 500, "XX000", true));

    const res = await submitBulkEnquiry(bulkInput(), ctx, t.deps);

    expect(res).toMatchObject({
      ok: false,
      code: "UNAVAILABLE",
    });
    expect(t.db.enquiries).toHaveLength(0);
  });

  it("handles general contact enquiry through degraded email-only fallback", async () => {
    const emailsSent: Array<{ subject: string; text: string }> = [];
    const t = await setup({
      enableEmailFallback: true,
      web3formsConfig: { accessKey: "test-web3forms-key-12345" },
      sendEmail: async (_cfg, msg) => {
        emailsSent.push(msg);
        return { ok: true };
      },
    });

    t.db.failNext(
      "create_enquiry",
      new SupabaseApiError("Supabase connection timeout", 504, "08006", true),
    );

    const res = await submitContactEnquiry(contactInput(), ctx, t.deps);

    expect(res).toMatchObject({
      ok: true,
      mode: "EMAIL_FALLBACK",
      reference: expect.stringMatching(/^ENQ-\d{4}-FAL-\d{6}$/),
      message: "Your enquiry has been sent successfully. Our team will contact you shortly.",
    });

    expect(emailsSent).toHaveLength(1);
    expect(emailsSent[0].subject).toContain("General enquiry");
    expect(emailsSent[0].text).toContain("Ravi Kumar");
  });

  it("rejects unknown product IDs that do not exist in live or fallback catalogue", async () => {
    const t = await setup();
    const res = await submitBulkEnquiry(
      bulkInput({ items: [{ productId: "completely-unknown-product-id", quantity: 5 }] }),
      ctx,
      t.deps,
    );
    expect(res).toMatchObject({
      ok: false,
      code: "INVALID_PRODUCTS",
      productIds: ["completely-unknown-product-id"],
    });
  });
});
