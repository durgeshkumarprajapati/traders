// @vitest-environment node
import { CALLBACK_TIME_WINDOWS, callbackSubmissionSchema } from "./callback-schemas";
import { generateTrackingToken, hashTrackingToken } from "./server/tracking";
import { submitCallbackEnquiry } from "./server/submit";
import { setup } from "./server/test-helpers";

describe("tracking token security", () => {
  it("generates 32-byte cryptographically secure tokens with tr_ prefix", () => {
    const token1 = generateTrackingToken();
    const token2 = generateTrackingToken();

    expect(token1).toMatch(/^tr_[0-9a-f]{64}$/);
    expect(token2).toMatch(/^tr_[0-9a-f]{64}$/);
    expect(token1).not.toBe(token2);
  });

  it("produces deterministic SHA-256 hashes", () => {
    const token = "tr_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const hash1 = hashTrackingToken(token);
    const hash2 = hashTrackingToken(token);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("callback submission validation", () => {
  it("validates 10-digit Indian mobile and name", () => {
    const valid = callbackSubmissionSchema.safeParse({
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      name: "Ramesh Kumar",
      mobile: "9876543210",
      preferredTimeWindow: "MORNING",
      reason: "Need rate for 20 MT cement",
    });
    expect(valid.success).toBe(true);

    const invalidMobile = callbackSubmissionSchema.safeParse({
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      name: "Ramesh Kumar",
      mobile: "12345",
      preferredTimeWindow: "MORNING",
    });
    expect(invalidMobile.success).toBe(false);

    const invalidName = callbackSubmissionSchema.safeParse({
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      name: "A",
      mobile: "9876543210",
    });
    expect(invalidName.success).toBe(false);
  });

  it("covers all approved time windows", () => {
    expect([...CALLBACK_TIME_WINDOWS]).toEqual(["MORNING", "AFTERNOON", "EVENING", "ANYTIME"]);
  });
});

describe("submitCallbackEnquiry integration", () => {
  it("persists callback as a GENERAL enquiry with tracking link returned", async () => {
    const t = await setup();
    const input = {
      idempotencyKey: "00000000-0000-4000-8000-000000000042",
      name: "Rajesh Sharma",
      mobile: "9876543210",
      preferredDate: "2026-12-01",
      preferredTimeWindow: "MORNING",
      reason: "TMT Rebar pricing for direct site delivery",
    };

    const res = await submitCallbackEnquiry(input, { ip: "127.0.0.1" }, t.deps);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.reference).toMatch(/^ENQ-(\d{4}-\d{6}|[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4})$/);
      expect(res.trackingToken).toMatch(/^tr_[0-9a-f]{64}$/);
      expect(res.trackingUrl).toContain("/track-enquiry#ref="); // credentials in the fragment, never the query
      expect(res.trackingUrl).not.toContain("?");
    }
  });

  it("silently drops honeypot spam without saving", async () => {
    const t = await setup();
    const spam = {
      idempotencyKey: "00000000-0000-4000-8000-000000000043",
      name: "Bot User",
      mobile: "9876543210",
      website: "https://spam-bot.example",
    };

    const res = await submitCallbackEnquiry(spam, { ip: "127.0.0.1" }, t.deps);
    expect(res).toEqual({ ok: true, reference: null });
    expect(t.db.enquiries).toHaveLength(0);
  });
});
