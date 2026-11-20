// @vitest-environment node
import { SupabaseApiError } from "@/lib/supabase/errors";
import { hashIdentifier, RATE_LIMITS } from "./rate-limit";
import { submitBulkEnquiry, submitContactEnquiry } from "./submit";
import { KEY, SECRET, bulkInput, contactInput, setup } from "./test-helpers";

const ctx = { ip: "203.0.113.7" };
const ok = (r: { ok: boolean }) => expect(r.ok).toBe(true);

describe("bulk enquiry — authoritative snapshots and persistence", () => {
  it("saves one enquiry with item snapshots taken from the SERVER catalogue, ignoring everything else the browser sent", async () => {
    const t = await setup();
    const hostile = bulkInput({
      items: [
        // The browser tries to dictate names, brands, units and prices — none of it may be stored.
        {
          productId: "p1",
          quantity: 100,
          name: "HACKED NAME",
          productName: "HACKED",
          brandName: "Evil",
          unit: "KG",
          unitCode: "KG",
          price: 1,
          listedPrice: 1,
          stockStatus: "OUT_OF_STOCK",
        },
        { productId: "p3", quantity: 5.5, price: 0.01 },
      ],
      price: 1,
      status: "COMPLETED",
      type: "GENERAL",
    });
    const r = await submitBulkEnquiry(hostile, ctx, t.deps);
    expect(r).toMatchObject({ ok: true, reference: expect.stringMatching(/^ENQ-\d{4}-\d{6}$/) });

    expect(t.db.enquiries).toHaveLength(1);
    expect(t.db.enquiries[0]).toMatchObject({
      type: "BULK",
      status: "NEW",
      customer_name: "Asha Rao",
      mobile: "9123456780",
      email: "asha@example.test",
      delivery_location: "Pune site, Gate 2",
    });
    expect(t.db.items).toHaveLength(2);
    expect(t.db.items[0]).toMatchObject({
      position: 1,
      product_id: "p1",
      sku: "C-1",
      product_name: "Cement PPC 50kg",
      brand_name: "Brand One",
      unit_code: "BAG",
      unit_label: "Bag",
      quantity: 100,
      listed_price: 385,
      stock_status: "IN_STOCK",
    });
    expect(t.db.items[1]).toMatchObject({
      position: 2,
      product_id: "p3",
      product_name: "TMT 12mm",
      unit_code: "METRIC_TON",
      unit_label: "Metric Ton",
      quantity: 5.5,
      listed_price: 62500,
      stock_status: "AVAILABLE_ON_ORDER",
    });
    const stored = JSON.stringify(t.db.items) + JSON.stringify(t.db.enquiries);
    for (const forged of ["HACKED", "Evil", "COMPLETED", '"listed_price":1,'])
      expect(stored).not.toContain(forged);
  });

  it("supports AVAILABLE_ON_ORDER products and custom units, and stores a missing/invalid price as NULL — never 0", async () => {
    const t = await setup();
    const r = await submitBulkEnquiry(
      bulkInput({
        items: [
          { productId: "p3", quantity: 1 },
          { productId: "p6", quantity: 2 },
          { productId: "p4", quantity: 3 },
          { productId: "p2", quantity: 4 },
        ],
      }),
      ctx,
      t.deps,
    );
    ok(r);
    const by = (id: string) => t.db.items.find((i) => i.product_id === id)!;
    expect(by("p3").stock_status).toBe("AVAILABLE_ON_ORDER");
    expect(by("p6")).toMatchObject({ unit_code: "CUSTOM", unit_label: "Set", listed_price: 120 });
    expect(by("p4")).toMatchObject({
      unit_code: "TON",
      listed_price: null,
      stock_status: "OUT_OF_STOCK",
    }); // invalid sheet price "abc"
    expect(by("p2").listed_price).toBeNull(); // blank price
    expect(t.db.items.some((i) => i.listed_price === 0)).toBe(false);
  });

  it("rejects unknown, inactive and excluded product ids and saves NOTHING (even if other items are valid)", async () => {
    const t = await setup();
    const r = await submitBulkEnquiry(
      bulkInput({
        items: [
          { productId: "p1", quantity: 1 },
          { productId: "off", quantity: 1 },
          { productId: "badcat", quantity: 1 },
          { productId: "nope", quantity: 1 },
        ],
      }),
      ctx,
      t.deps,
    );
    expect(r).toMatchObject({
      ok: false,
      code: "INVALID_PRODUCTS",
      productIds: ["off", "badcat", "nope"],
    });
    expect(t.db.enquiries).toHaveLength(0);
    expect(t.db.items).toHaveLength(0);
    expect(t.db.outbox).toHaveLength(0);
    expect(t.tasks).toHaveLength(0);
  });

  it("does not accept unverified items when the catalogue cannot be read", async () => {
    const t = await setup({ loadCatalogue: async () => ({ ok: false }) });
    const r = await submitBulkEnquiry(bulkInput(), ctx, t.deps);
    expect(r).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(t.db.enquiries).toHaveLength(0);
  });

  it("creates the outbox row with the enquiry and sends the email AFTER the response, not before", async () => {
    const t = await setup();
    const r = await submitBulkEnquiry(bulkInput(), ctx, t.deps);
    ok(r);
    expect(t.db.outbox).toHaveLength(1);
    expect(t.db.outbox[0]).toMatchObject({ status: "PENDING", attempt_count: 0 });
    expect(t.sent).toHaveLength(0); // the customer's response did not wait for (or depend on) the email
    expect(t.tasks).toHaveLength(1);
    await t.runAfter();
    expect(t.sent).toHaveLength(1);
    expect(t.db.outbox[0].status).toBe("SENT");
    expect(t.sent[0].text).toContain((r as { reference: string }).reference);
  });
});

describe("general contact enquiry", () => {
  it("is saved without any products and does not need the catalogue", async () => {
    const t = await setup({ loadCatalogue: async () => ({ ok: false }) }); // sheet is down — contacting the business must still work
    const r = await submitContactEnquiry(contactInput(), ctx, t.deps);
    expect(r).toMatchObject({ ok: true, reference: expect.stringMatching(/^ENQ-/) });
    expect(t.loadCatalogue).not.toHaveBeenCalled();
    expect(t.db.enquiries[0]).toMatchObject({
      type: "GENERAL",
      customer_name: "Ravi Kumar",
      email: null,
      delivery_location: null,
    });
    expect(t.db.items).toHaveLength(0);
    expect(t.db.outbox).toHaveLength(1);
  });

  it("there is no per-product enquiry type: a forged type is ignored and BULK/GENERAL are decided by the endpoint", async () => {
    const t = await setup();
    await submitContactEnquiry(
      contactInput({ type: "PRODUCT", items: [{ productId: "p1", quantity: 1 }] }),
      ctx,
      t.deps,
    );
    expect(t.db.enquiries[0].type).toBe("GENERAL");
    expect(t.db.items).toHaveLength(0);
  });
});

describe("validation (server-side, before any I/O)", () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ["missing name", { name: "" }, "name"],
    ["one-letter name", { name: "A" }, "name"],
    ["invalid mobile", { mobile: "12345" }, "mobile"],
    ["mobile with letters", { mobile: "98765abcde" }, "mobile"],
    ["invalid email", { email: "not-an-email" }, "email"],
    ["missing delivery location", { deliveryLocation: "" }, "deliveryLocation"],
    ["message too long", { message: "x".repeat(1001) }, "message"],
    ["no items", { items: [] }, "items"],
    ["zero quantity", { items: [{ productId: "p1", quantity: 0 }] }, "items"],
    ["negative quantity", { items: [{ productId: "p1", quantity: -2 }] }, "items"],
    ["NaN quantity", { items: [{ productId: "p1", quantity: Number.NaN }] }, "items"],
    ["string quantity", { items: [{ productId: "p1", quantity: "5" }] }, "items"],
    ["huge quantity", { items: [{ productId: "p1", quantity: 1_000_001 }] }, "items"],
    ["too many decimals", { items: [{ productId: "p1", quantity: 1.2345 }] }, "items"],
    [
      "duplicate product",
      {
        items: [
          { productId: "p1", quantity: 1 },
          { productId: "p1", quantity: 2 },
        ],
      },
      "items",
    ],
    [
      "unsafe product id",
      { items: [{ productId: "p1; DROP TABLE enquiries", quantity: 1 }] },
      "items",
    ],
    [
      "51 items",
      { items: Array.from({ length: 51 }, (_, i) => ({ productId: `x${i}`, quantity: 1 })) },
      "items",
    ],
    ["bad idempotency key", { idempotencyKey: "nope" }, "form"],
  ];
  it.each(cases)("bulk: %s", async (_n, over, field) => {
    const t = await setup();
    const r = await submitBulkEnquiry(bulkInput(over), ctx, t.deps);
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect((r as { fieldErrors: Record<string, string> }).fieldErrors).toHaveProperty(field);
    expect(t.db.calls).toHaveLength(0); // rejected before the rate limiter, the catalogue or the database
    expect(t.loadCatalogue).not.toHaveBeenCalled();
  });

  it.each([
    ["short message", { message: "too short" }, "message"],
    ["missing message", { message: "" }, "message"],
    ["invalid mobile", { mobile: "0000000000" }, "mobile"],
    ["missing name", { name: " " }, "name"],
  ])("contact: %s", async (_n, over, field) => {
    const t = await setup();
    const r = await submitContactEnquiry(contactInput(over), ctx, t.deps);
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect((r as { fieldErrors: Record<string, string> }).fieldErrors).toHaveProperty(field);
    expect(t.db.calls).toHaveLength(0);
  });

  it("normalises Indian mobile formats (+91, spaces, dashes) and rejects non-input shapes", async () => {
    const t = await setup();
    for (const [i, m] of ["+91 98765-43210", "098765 43210", "91 9876543210"].entries()) {
      ok(
        await submitContactEnquiry(
          contactInput({ mobile: m, idempotencyKey: KEY(100 + i) }),
          { ip: `10.0.0.${i}` },
          t.deps,
        ),
      );
    }
    expect(t.db.enquiries.every((e) => e.mobile === "9876543210")).toBe(true); // all three formats normalise to the same 10 digits
    expect(t.db.enquiries.map((e) => e.mobile).every((m) => /^[6-9]\d{9}$/.test(m))).toBe(true);
    for (const bad of [null, undefined, "string", 42, []]) {
      expect(await submitBulkEnquiry(bad, ctx, t.deps)).toMatchObject({
        ok: false,
        code: "VALIDATION",
      });
    }
  });
});

describe("honeypot", () => {
  it("looks successful to bots but stores nothing and touches nothing", async () => {
    const t = await setup();
    for (const submit of [
      () => submitBulkEnquiry(bulkInput({ website: "http://spam.example" }), ctx, t.deps),
      () => submitContactEnquiry(contactInput({ website: "x" }), ctx, t.deps),
    ]) {
      expect(await submit()).toEqual({ ok: true, reference: null });
    }
    expect(t.db.calls).toHaveLength(0);
    expect(t.db.enquiries).toHaveLength(0);
    expect(t.tasks).toHaveLength(0);
    expect(t.loadCatalogue).not.toHaveBeenCalled();
  });
  it("does not trip on an empty or whitespace-only honeypot", async () => {
    const t = await setup();
    ok(await submitContactEnquiry(contactInput({ website: "   " }), ctx, t.deps));
    expect(t.db.enquiries).toHaveLength(1);
  });
});

describe("idempotency and duplicate prevention", () => {
  it("the same idempotency key returns the same enquiry; no second enquiry, items or email", async () => {
    const t = await setup();
    const a = await submitBulkEnquiry(bulkInput(), ctx, t.deps);
    const b = await submitBulkEnquiry(bulkInput(), ctx, t.deps);
    expect(a).toEqual(b);
    expect(t.db.enquiries).toHaveLength(1);
    expect(t.db.items).toHaveLength(2);
    expect(t.db.outbox).toHaveLength(1);
    await t.runAfter();
    expect(t.sent).toHaveLength(1); // two submissions, ONE email
    expect(t.db.attempts).toHaveLength(1);
  });

  it("different keys create different enquiries with different references", async () => {
    const t = await setup();
    const a = (await submitContactEnquiry(
      contactInput({ idempotencyKey: KEY(10) }),
      { ip: "1.1.1.1" },
      t.deps,
    )) as { reference: string };
    const b = (await submitContactEnquiry(
      contactInput({ idempotencyKey: KEY(11) }),
      { ip: "1.1.1.2" },
      t.deps,
    )) as { reference: string };
    expect(a.reference).not.toBe(b.reference);
    expect(t.db.enquiries).toHaveLength(2);
  });

  it("a customer retry after a failed email re-attempts delivery without duplicating the enquiry", async () => {
    let fail = true;
    const t = await setup({}, () =>
      fail
        ? { ok: false, kind: "HTTP", status: 503, retryable: true, summary: "down" }
        : { ok: true },
    );
    await submitBulkEnquiry(bulkInput(), ctx, t.deps);
    await t.runAfter();
    expect(t.db.outbox[0].status).toBe("FAILED");
    fail = false;
    await submitBulkEnquiry(bulkInput(), ctx, t.deps); // retry during backoff: nothing is sent yet
    await t.runAfter();
    expect(t.sent).toHaveLength(1);
    t.db.advance(61_000); // backoff elapsed
    await submitBulkEnquiry(bulkInput(), ctx, t.deps);
    await t.runAfter();
    expect(t.sent).toHaveLength(2);
    expect(t.db.outbox[0].status).toBe("SENT");
    expect(t.db.enquiries).toHaveLength(1);
  });
});

describe("failure handling", () => {
  it("a database failure saves nothing, schedules no email, and returns a generic message without internals", async () => {
    const t = await setup();
    t.db.failNext(
      "create_enquiry",
      new SupabaseApiError(
        "Supabase RPC create_enquiry failed (HTTP 500) secret-internal-detail",
        500,
        "XX000",
        true,
      ),
    );
    const r = await submitBulkEnquiry(bulkInput(), ctx, t.deps);
    expect(r).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(JSON.stringify(r)).not.toMatch(/secret-internal-detail|XX000|Supabase|SQLSTATE/);
    expect(t.db.enquiries).toHaveLength(0);
    expect(t.db.outbox).toHaveLength(0);
    expect(t.tasks).toHaveLength(0);
  });

  it("an email failure never affects the saved enquiry or the customer's confirmation", async () => {
    const t = await setup({}, () => ({
      ok: false,
      kind: "TIMEOUT",
      status: null,
      retryable: true,
      summary: "Web3Forms did not respond",
    }));
    const r = await submitBulkEnquiry(bulkInput(), ctx, t.deps);
    expect(r).toMatchObject({ ok: true });
    await t.runAfter();
    expect(t.db.enquiries).toHaveLength(1);
    expect(t.db.outbox[0]).toMatchObject({ status: "FAILED", attempt_count: 1 });
    expect(t.db.attempts[0]).toMatchObject({ outcome: "TIMEOUT", error_code: "TIMEOUT" });
  });

  it("a failing after-response task is contained (never throws into the request)", async () => {
    const t = await setup({ processNotification: async () => Promise.reject(new Error("boom")) });
    ok(await submitContactEnquiry(contactInput(), ctx, t.deps));
    await expect(t.runAfter()).resolves.toBeUndefined();
  });
});

describe("rate limiting (shared store, hashed keys)", () => {
  it("limits by IP, tells the customer when to retry, and saves nothing for blocked requests", async () => {
    const t = await setup();
    for (let i = 0; i < RATE_LIMITS.ip.limit; i++) {
      ok(
        await submitContactEnquiry(
          contactInput({ idempotencyKey: KEY(200 + i), mobile: `91234567${String(10 + i)}` }),
          ctx,
          t.deps,
        ),
      );
    }
    const blocked = await submitContactEnquiry(
      contactInput({ idempotencyKey: KEY(300), mobile: "9123456799" }),
      ctx,
      t.deps,
    );
    expect(blocked).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfterSeconds: expect.any(Number),
    });
    expect((blocked as { message: string }).message).toMatch(/try again in about \d+ minute/);
    expect(t.db.enquiries).toHaveLength(RATE_LIMITS.ip.limit);
    t.db.advance(RATE_LIMITS.ip.windowSeconds * 1000 + 1000); // a new window
    ok(
      await submitContactEnquiry(
        contactInput({ idempotencyKey: KEY(301), mobile: "9123456798" }),
        ctx,
        t.deps,
      ),
    );
  });

  it("limits by mobile number across different IPs", async () => {
    const t = await setup();
    for (let i = 0; i < RATE_LIMITS.mobile.limit; i++) {
      ok(
        await submitContactEnquiry(
          contactInput({ idempotencyKey: KEY(400 + i) }),
          { ip: `198.51.100.${i}` },
          t.deps,
        ),
      );
    }
    const blocked = await submitContactEnquiry(
      contactInput({ idempotencyKey: KEY(410) }),
      { ip: "198.51.100.99" },
      t.deps,
    );
    expect(blocked).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(t.db.enquiries).toHaveLength(RATE_LIMITS.mobile.limit);
  });

  it("a blocked IP does not consume the mobile quota", async () => {
    const t = await setup();
    for (let i = 0; i < RATE_LIMITS.ip.limit; i++)
      await submitContactEnquiry(
        contactInput({
          idempotencyKey: KEY(500 + i),
          mobile: `9000000${String(100 + i)}`.slice(0, 10),
        }),
        ctx,
        t.deps,
      );
    await submitContactEnquiry(
      contactInput({ idempotencyKey: KEY(520), mobile: "9555555555" }),
      ctx,
      t.deps,
    ); // blocked by IP
    const mobileKey = hashIdentifier("mobile", "9555555555", SECRET);
    expect(t.db.limits.has(mobileKey)).toBe(false);
  });

  it("stores only HMAC hashes — never a raw IP address or phone number", async () => {
    const t = await setup();
    ok(await submitContactEnquiry(contactInput(), ctx, t.deps));
    const keys = [...t.db.limits.keys()];
    expect(keys).toHaveLength(2);
    expect(keys.join(" ")).not.toContain("203.0.113.7");
    expect(keys.join(" ")).not.toContain("9123456789");
    expect(keys).toContain(hashIdentifier("ip", "203.0.113.7", SECRET));
    expect(keys).toContain(hashIdentifier("mobile", "9123456789", SECRET));
    expect(hashIdentifier("ip", "203.0.113.7", SECRET)).not.toBe(
      hashIdentifier("ip", "203.0.113.7", "another-secret-value-0000"),
    );
  });

  it("works without a client IP (shared 'unknown' bucket) and fails closed when the limiter store is down", async () => {
    const t = await setup();
    ok(await submitContactEnquiry(contactInput(), { ip: null }, t.deps));
    expect(t.db.limits.has(hashIdentifier("ip", "unknown", SECRET))).toBe(true);
    const down = await setup();
    down.db.failNext("check_rate_limit", new SupabaseApiError("down", 503, null, true));
    expect(await submitContactEnquiry(contactInput(), ctx, down.deps)).toMatchObject({
      ok: false,
      code: "UNAVAILABLE",
    });
    expect(down.db.enquiries).toHaveLength(0);
  });
});

describe("privacy of logs", () => {
  it("never writes customer personal data to the logs (success, failure, honeypot and validation paths)", async () => {
    const spies = (["log", "warn", "error"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    try {
      const t = await setup();
      t.db.failNext(
        "create_enquiry",
        new SupabaseApiError("Supabase RPC create_enquiry failed (HTTP 500)", 500, null, true),
      );
      await submitBulkEnquiry(bulkInput(), ctx, t.deps); // database failure
      ok(
        await submitBulkEnquiry(bulkInput({ idempotencyKey: KEY(900) }), { ip: "9.9.9.9" }, t.deps),
      ); // success
      await t.runAfter();
      await submitBulkEnquiry(bulkInput({ website: "spam" }), ctx, t.deps); // honeypot
      await submitBulkEnquiry(bulkInput({ mobile: "1" }), ctx, t.deps); // validation
      const logged = spies.flatMap((s) => s.mock.calls.map((c) => String(c[0]))).join("\n");
      expect(logged).toContain("enquiry_saved");
      for (const pii of [
        "Asha Rao",
        "9876543210",
        "98765 43210",
        "asha@example.test",
        "Pune site",
        "Need it in two lots",
        "9.9.9.9",
        "203.0.113.7",
      ]) {
        expect(logged, pii).not.toContain(pii);
      }
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });
});
