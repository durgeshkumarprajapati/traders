// @vitest-environment node
import { createHash, createHmac } from "node:crypto";
import { generateTrackingToken, getTrackedEnquiry, hashTrackingToken } from "./tracking";
import { parseTrackingParams, trackingPath } from "../tracking-types";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const TOKEN = `tr_${"a".repeat(64)}`;
const rawEnquiry = {
  reference: "ENQ-AB12-CD34-EF56",
  type: "BULK",
  status: "CONTACTED",
  delivery_location: "Pune",
  created_at: "2026-11-23T10:00:00Z",
  updated_at: "2026-11-23T11:00:00Z",
  timeline: [
    {
      previous_status: null,
      new_status: "NEW",
      description: "Enquiry received",
      created_at: "2026-11-23T10:00:00Z",
    },
  ],
  items: [
    {
      position: 1,
      product_name: "Cement",
      brand_name: null,
      unit_label: "Bag",
      quantity: "10",
      listed_price: null,
    },
  ],
  quotation: null,
};

describe("tracking tokens", () => {
  it("random tokens are 32 bytes, prefixed, and never repeat", () => {
    const set = new Set(Array.from({ length: 200 }, () => generateTrackingToken()));
    expect(set.size).toBe(200);
    for (const t of set) expect(t).toMatch(/^tr_[0-9a-f]{64}$/);
  });

  it("seeded tokens are stable for one seed (safe retries), unguessable without the secret, and domain-separated", () => {
    const a = generateTrackingToken("seed-1", "server-secret-0123456789");
    expect(a).toBe(generateTrackingToken("seed-1", "server-secret-0123456789"));
    expect(a).not.toBe(generateTrackingToken("seed-2", "server-secret-0123456789"));
    expect(a).not.toBe(generateTrackingToken("seed-1", "other-secret-0123456789"));
    const undomained = `tr_${createHmac("sha256", "server-secret-0123456789").update("seed-1").digest("hex")}`;
    expect(a).not.toBe(undomained); // the key is never used for the bare seed (e.g. rate-limit style hashing)
    expect(a).toBe(
      `tr_${createHmac("sha256", "server-secret-0123456789").update("tracking-token:v1:seed-1").digest("hex")}`,
    );
  });

  it("only the SHA-256 hash is ever derived for storage", () => {
    expect(hashTrackingToken(TOKEN)).toBe(sha(TOKEN));
    expect(hashTrackingToken(TOKEN)).not.toContain(TOKEN);
  });
});

describe("tracking link format", () => {
  it("puts the credentials in the URL fragment, never the query string", () => {
    const p = trackingPath("ENQ-AB12-CD34-EF56", TOKEN);
    expect(p).toBe(`/track-enquiry#ref=ENQ-AB12-CD34-EF56&token=${TOKEN}`);
    expect(p).not.toContain("?");
  });

  it("parses fragments and legacy query strings, rejects incomplete ones", () => {
    expect(parseTrackingParams(`#ref=ENQ-1&token=${TOKEN}`)).toEqual({
      ref: "ENQ-1",
      token: TOKEN,
    });
    expect(parseTrackingParams(`?ref=ENQ-1&token=${TOKEN}`)).toEqual({
      ref: "ENQ-1",
      token: TOKEN,
    });
    expect(parseTrackingParams("#ref=ENQ-1")).toBeNull();
    expect(parseTrackingParams("")).toBeNull();
  });
});

describe("getTrackedEnquiry", () => {
  const rpc = vi.fn();
  beforeEach(() => {
    rpc.mockReset();
  });

  it.each([
    "",
    "ENQ-1",
    "enq-ab12-cd34-ef56x",
    "ENQ-AB12-CD34",
    "ENQ-ZZZZ-CD34-EF56",
    "ENQ-2026-12",
    "'; drop table--",
    "ENQ-AB12-CD34-EF56-AAAA",
  ])("malformed reference %j never reaches the database", async (ref) => {
    expect(await getTrackedEnquiry(ref, TOKEN, rpc)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(["", "short", "x".repeat(31), "x".repeat(129)])(
    "malformed token %j never reaches the database",
    async (t) => {
      expect(await getTrackedEnquiry("ENQ-AB12-CD34-EF56", t, rpc)).toBeNull();
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it("accepts the current random format and the legacy sequential format (case-insensitively)", async () => {
    rpc.mockResolvedValue(rawEnquiry);
    expect(await getTrackedEnquiry("enq-ab12-cd34-ef56", TOKEN, rpc)).not.toBeNull();
    expect(rpc.mock.calls[0][1].p_reference).toBe("ENQ-AB12-CD34-EF56");
    rpc.mockClear();
    expect(await getTrackedEnquiry("ENQ-2026-001234", TOKEN, rpc)).not.toBeNull();
  });

  it("queries by the token HASH, never the raw token", async () => {
    rpc.mockResolvedValue(rawEnquiry);
    await getTrackedEnquiry("ENQ-AB12-CD34-EF56", TOKEN, rpc);
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe("get_tracked_enquiry");
    expect(args).toEqual({ p_reference: "ENQ-AB12-CD34-EF56", p_token_hash: sha(TOKEN) });
    expect(JSON.stringify(args)).not.toContain(TOKEN);
  });

  it("returns only customer-safe fields even if the database were to return internal ones", async () => {
    rpc.mockResolvedValue({
      ...rawEnquiry,
      id: "internal-uuid",
      notes: [{ body: "INTERNAL NOTE" }],
      outbox: { last_error: "smtp secret" },
      idempotency_key: "key",
      tracking_token_hash: "hash",
      mobile: "9876543210",
      email: "c@x.test",
      customer_name: "Hidden",
      notification_attempts: [1],
    });
    const t = await getTrackedEnquiry("ENQ-AB12-CD34-EF56", TOKEN, rpc);
    const json = JSON.stringify(t);
    for (const secret of [
      "internal-uuid",
      "INTERNAL NOTE",
      "smtp secret",
      "idempotency",
      "hash",
      "9876543210",
      "c@x.test",
      "Hidden",
      "notification",
    ])
      expect(json, secret).not.toContain(secret);
    expect(t?.reference).toBe("ENQ-AB12-CD34-EF56");
    expect(t?.statusHistory).toHaveLength(1);
    expect(t?.items[0].productName).toBe("Cement");
  });

  it("invalid / expired / revoked (null) and database errors both come back as null", async () => {
    rpc.mockResolvedValue(null);
    expect(await getTrackedEnquiry("ENQ-AB12-CD34-EF56", TOKEN, rpc)).toBeNull();
    rpc.mockImplementation(async () => {
      throw new Error("db down");
    });
    expect(await getTrackedEnquiry("ENQ-AB12-CD34-EF56", TOKEN, rpc)).toBeNull();
  });

  it("surfaces the real quotation summary including the expired flag, with no fabricated link", async () => {
    rpc.mockResolvedValue({
      ...rawEnquiry,
      quotation: {
        reference: "QUO-1",
        version: 2,
        total_amount: "500.50",
        valid_until: "2026-01-01T00:00:00Z",
        is_expired: true,
      },
    });
    const t = await getTrackedEnquiry("ENQ-AB12-CD34-EF56", TOKEN, rpc);
    expect(t?.latestQuotation).toEqual({
      reference: "QUO-1",
      version: 2,
      totalAmount: 500.5,
      validUntil: "2026-01-01T00:00:00Z",
      isExpired: true,
    });
    expect(JSON.stringify(t)).not.toContain("/quotation/QUO-1");
  });
});
