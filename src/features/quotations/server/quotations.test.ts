// @vitest-environment node
import { createHash } from "node:crypto";
import { loadFrom, realisticSheets } from "@/features/catalogue/test-catalogue";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  load: null as unknown,
  logs: [] as string[],
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc: state.rpc }),
}));
vi.mock("@/features/catalogue/server", () => ({ loadCatalogue: async () => state.load }));
vi.mock("@/lib/logger", () => {
  // Record what would be logged (message + serialised fields) so tests can assert no secret is ever logged.
  const record = (msg: string, fields?: unknown) => {
    let text = msg;
    try {
      text += JSON.stringify(fields, (_k, v) => (v instanceof Error ? v.message : v));
    } catch {
      // ignore unserialisable fields
    }
    state.logs.push(text);
  };
  return { logger: { error: record, warn: record, info: record } };
});

import {
  createQuotationDraft,
  getTrackedQuotation,
  issueQuotation,
  revokeQuotationLink,
  rotateQuotationLink,
} from "./quotations";

const ENQ = "11111111-1111-4111-8111-111111111111";
const line = (over: Record<string, unknown> = {}) => ({
  productName: "Manual cement line",
  unitCode: "BAG",
  unitLabel: "Bag",
  quantity: 10,
  unitPrice: 100,
  ...over,
});
const input = (over: Record<string, unknown> = {}) => ({
  enquiryId: ENQ,
  items: [line()],
  discountAmount: 0,
  taxAmount: 0,
  validDays: 7,
  ...over,
});
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

beforeEach(async () => {
  state.rpc
    .mockReset()
    .mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
  state.logs = [];
  state.load = await loadFrom(realisticSheets());
});

describe("createQuotationDraft: server-side validation (the database is never reached for bad input)", () => {
  it.each([
    ["no items", input({ items: [] })],
    ["too many items", input({ items: Array.from({ length: 101 }, () => line()) })],
    ["zero rate", input({ items: [line({ unitPrice: 0 })] })],
    ["negative rate", input({ items: [line({ unitPrice: -5 })] })],
    ["zero quantity", input({ items: [line({ quantity: 0 })] })],
    ["absurd quantity", input({ items: [line({ quantity: 1e9 })] })],
    ["unknown unit", input({ items: [line({ unitCode: "FURLONG" })] })],
    ["blank description", input({ items: [line({ productName: "   " })] })],
    ["validity 0", input({ validDays: 0 })],
    ["validity 91", input({ validDays: 91 })],
    ["fractional validity", input({ validDays: 1.5 })],
    ["negative discount", input({ discountAmount: -1 })],
    ["discount above subtotal", input({ discountAmount: 1001 })],
    ["bad enquiry id", input({ enquiryId: "not-a-uuid" })],
    ["string numbers", input({ items: [line({ quantity: "10", unitPrice: "100" })] })],
    ["not an object", "hello"],
    ["null", null],
  ])("rejects %s", async (_n, body) => {
    const r = await createQuotationDraft(body);
    expect(r.ok).toBe(false);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("sends exactly the validated fields (extra browser fields such as totals are dropped)", async () => {
    state.rpc.mockResolvedValue({
      data: { id: "q1", reference: "QUO-2026-001000", version: 1, total_amount: 1000 },
      error: null,
    });
    const r = await createQuotationDraft({
      ...input({ termsAndConditions: "  Pay on delivery  " }),
      totalAmount: 1,
      subtotal: 1,
      createdBy: "someone-else",
      status: "ISSUED",
      items: [{ ...line(), lineTotal: 1, id: "x" }],
    });
    expect(r).toEqual({ ok: true, quotationId: "q1", reference: "QUO-2026-001000", version: 1 });
    const [name, args] = state.rpc.mock.calls[0];
    expect(name).toBe("create_quotation_draft");
    const p = args.p_payload;
    expect(Object.keys(p).sort()).toEqual([
      "discount_amount",
      "enquiry_id",
      "items",
      "tax_amount",
      "terms",
      "valid_days",
    ]);
    expect(p.terms).toBe("Pay on delivery");
    expect(JSON.stringify(p)).not.toMatch(
      /lineTotal|line_total|totalAmount|total_amount|createdBy|created_by|ISSUED/,
    );
  });

  it("catalogue-backed lines take name, brand, SKU and unit from the SERVER catalogue, never from the browser", async () => {
    const load = state.load as {
      ok: true;
      catalogue: { products: { id: string; name: string; unit: { code: string } }[] };
    };
    const real = load.catalogue.products[0];
    state.rpc.mockResolvedValue({
      data: { id: "q", reference: "R", version: 1, total_amount: 100 },
      error: null,
    });
    await createQuotationDraft(
      input({
        items: [
          line({
            productId: real.id,
            productName: "TAMPERED NAME",
            brandName: "TAMPERED BRAND",
            unitCode: "KG",
            unitLabel: "TAMPERED UNIT",
            quantity: 1,
            unitPrice: 100,
          }),
        ],
      }),
    );
    const sent = state.rpc.mock.calls[0][1].p_payload.items[0];
    expect(sent.product_id).toBe(real.id);
    expect(sent.product_name).toBe(real.name);
    expect(sent.unit_code).toBe(real.unit.code);
    expect(JSON.stringify(sent)).not.toContain("TAMPERED");
    expect(sent.unit_price).toBe(100); // the rate is the administrator's quoted rate
  });

  it("a product that is not in the catalogue becomes a manual line and claims no catalogue identity", async () => {
    state.rpc.mockResolvedValue({
      data: { id: "q", reference: "R", version: 1, total_amount: 1000 },
      error: null,
    });
    await createQuotationDraft(
      input({ items: [line({ productId: "no-such-product", productName: "Legacy item" })] }),
    );
    const sent = state.rpc.mock.calls[0][1].p_payload.items[0];
    expect(sent.product_id).toBeNull();
    expect(sent.product_name).toBe("Legacy item");
  });

  it("works when the catalogue is unavailable (manual lines never need it)", async () => {
    state.load = { ok: false };
    state.rpc.mockResolvedValue({
      data: { id: "q", reference: "R", version: 1, total_amount: 1000 },
      error: null,
    });
    expect((await createQuotationDraft(input({ items: [line({ productId: "p1" })] }))).ok).toBe(
      true,
    );
  });
});

describe("database errors: curated messages only, never internals", () => {
  it.each([
    [{ code: "42501", message: "permission denied for table quotations" }, /not authorised/i],
    [
      { code: "22023", message: "quotation: discount cannot exceed the subtotal" },
      /^Discount cannot exceed the subtotal$/,
    ],
    [{ code: "P0002", message: "quotation: enquiry not found" }, /^Enquiry not found$/],
  ])("shows a curated message for %j", async (error, expected) => {
    state.rpc.mockResolvedValue({ data: null, error });
    const r = await createQuotationDraft(input());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(expected);
  });

  it("replaces constraint names, SQL text and anything unexpected with a generic message", async () => {
    state.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "23514",
        message:
          'new row for relation "quotation_items" violates check constraint "quotation_items_unit_code_check"',
      },
    });
    const r = await createQuotationDraft(input());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toBe("Could not create the quotation draft.");
      expect(r.message).not.toMatch(/constraint|relation|quotation_items/);
    }
  });

  it("a thrown error never reaches the caller as text", async () => {
    state.rpc.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2"));
    const r = await createQuotationDraft(input());
    expect(r).toEqual({
      ok: false,
      message: "An unexpected error occurred while creating the quotation.",
    });
  });
});

describe("issuing and customer links: only hashes are stored", () => {
  it("passes a 64-hex SHA-256 hash of the new token — the raw token goes only to the administrator", async () => {
    state.rpc.mockResolvedValue({
      data: { reference: "QUO-1", enquiry_status_changed: true },
      error: null,
    });
    const r = await issueQuotation("q-id");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [name, args] = state.rpc.mock.calls[0];
    expect(name).toBe("issue_quotation");
    expect(r.rawToken).toMatch(/^qt_[0-9a-f]{64}$/);
    expect(args.p_token_hash).toBe(sha(r.rawToken));
    expect(args.p_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain(r.rawToken);
    expect(r.trackingUrl).toBe(`/quotation/${r.rawToken}`);
    expect(r.enquiryStatusChanged).toBe(true);
    const days = (Date.parse(args.p_expires) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89.9);
    expect(days).toBeLessThan(90.1);
    expect(state.logs.join("")).not.toContain(r.rawToken);
  });

  it("every issue creates a different token (never reused or derived from the quotation id)", async () => {
    state.rpc.mockResolvedValue({
      data: { reference: "Q", enquiry_status_changed: false },
      error: null,
    });
    const a = await issueQuotation("same-id");
    const b = await issueQuotation("same-id");
    expect(a.ok && b.ok && a.rawToken !== b.rawToken).toBe(true);
  });

  it("refusals from the database (already issued, not admin…) are reported without a token", async () => {
    state.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "55000",
        message: "quotation: only a draft can be issued (this one is already ISSUED)",
      },
    });
    const r = await issueQuotation("q");
    expect(r).toEqual({
      ok: false,
      message: "Only a draft can be issued (this one is already ISSUED)",
    });
  });

  it("rotate creates a fresh hashed link; revoke calls the revoke function", async () => {
    state.rpc.mockResolvedValue({ data: null, error: null });
    const rot = await rotateQuotationLink("q");
    expect(rot.ok).toBe(true);
    const [name, args] = state.rpc.mock.calls[0];
    expect(name).toBe("rotate_quotation_token");
    if (rot.ok) expect(args.p_token_hash).toBe(sha(rot.trackingUrl.replace("/quotation/", "")));
    expect(await revokeQuotationLink("q")).toEqual({ ok: true });
    expect(state.rpc.mock.calls[1][0]).toBe("revoke_quotation_token");
  });
});

describe("getTrackedQuotation (customer access)", () => {
  const rpc = vi.fn();
  const raw = {
    reference: "QUO-1",
    enquiry_reference: "ENQ-AAAA-BBBB-CCCC",
    version: 2,
    status: "ISSUED",
    is_latest: true,
    is_expired: false,
    customer_name: "Asha",
    delivery_location: "Pune",
    subtotal: "1000.00",
    discount_amount: "0",
    tax_amount: "0",
    total_amount: "1000.00",
    terms_and_conditions: null,
    valid_until: null,
    issued_at: null,
    items: [],
  };
  beforeEach(() => {
    rpc.mockReset();
  });

  it("rejects malformed tokens without touching the database", async () => {
    for (const t of ["", "short", "x".repeat(31), "x".repeat(129)])
      expect(await getTrackedQuotation(t, rpc)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("looks up by the SHA-256 hash, never by the raw token", async () => {
    rpc.mockResolvedValue(raw);
    const token = `qt_${"a".repeat(64)}`;
    const q = await getTrackedQuotation(token, rpc);
    expect(rpc.mock.calls[0][0]).toBe("get_tracked_quotation");
    expect(rpc.mock.calls[0][1]).toEqual({ p_token_hash: sha(token) });
    expect(q?.totalAmount).toBe(1000);
    expect(q?.isLatest).toBe(true);
  });

  it("maps superseded / expired flags, and returns nothing internal", async () => {
    rpc.mockResolvedValue({
      ...raw,
      is_latest: false,
      is_expired: true,
      id: "internal",
      created_by: "x",
      mobile: "9",
      email: "e@x.test",
    });
    const q = (await getTrackedQuotation(`qt_${"b".repeat(64)}`, rpc))!;
    expect(q.isLatest).toBe(false);
    expect(q.isExpired).toBe(true);
    const json = JSON.stringify(q);
    expect(json).not.toMatch(/internal|created_by|"mobile"|"email"|tracking/);
  });

  it("unknown, expired and revoked all look the same (null); errors also return null", async () => {
    rpc.mockResolvedValue(null);
    expect(await getTrackedQuotation(`qt_${"c".repeat(64)}`, rpc)).toBeNull();
    rpc.mockImplementation(async () => {
      throw new Error("db down");
    });
    expect(await getTrackedQuotation(`qt_${"c".repeat(64)}`, rpc)).toBeNull();
  });
});
