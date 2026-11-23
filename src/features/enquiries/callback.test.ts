// @vitest-environment node
import {
  CALLBACK_MAX_DAYS_AHEAD,
  CALLBACK_TIME_WINDOW_LABELS,
  callbackSubmissionSchema,
  istDatePlusDays,
  istToday,
} from "./callback-schemas";
import { submitCallbackEnquiry } from "./server/submit";
import { setup } from "./server/test-helpers";

const base = {
  idempotencyKey: "00000000-0000-4000-8000-0000000000aa",
  name: "Ramesh Kumar",
  mobile: "9876543210",
  preferredTimeWindow: "MORNING",
};

describe("callback date validation (server-side, India time)", () => {
  it("IST today differs from UTC today when it should (early IST morning = previous UTC day)", () => {
    expect(istToday(new Date("2026-11-23T20:00:00Z"))).toBe("2026-11-24"); // 01:30 IST next day
    expect(istToday(new Date("2026-11-23T10:00:00Z"))).toBe("2026-11-23");
  });

  it("accepts today, the last allowed day, and no date at all", () => {
    for (const d of [istToday(), istDatePlusDays(CALLBACK_MAX_DAYS_AHEAD), "", undefined])
      expect(
        callbackSubmissionSchema.safeParse({ ...base, preferredDate: d }).success,
        String(d),
      ).toBe(true);
  });

  it.each([
    ["yesterday", () => istDatePlusDays(-1), /past/i],
    ["beyond the window", () => istDatePlusDays(CALLBACK_MAX_DAYS_AHEAD + 1), /within the next/i],
    ["an impossible date", () => "2026-02-30", /valid date/i],
    ["month 13", () => "2026-13-01", /valid date/i],
    ["a malformed string", () => "tomorrow", /valid date/i],
    ["a timestamp", () => "2026-11-23T10:00:00Z", /valid date/i],
  ])("rejects %s with a clear message", (_n, make, message) => {
    const r = callbackSubmissionSchema.safeParse({ ...base, preferredDate: make() });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(message);
  });
});

describe("callback fields", () => {
  it("email and message are optional but validated and bounded", () => {
    expect(callbackSubmissionSchema.safeParse({ ...base }).success).toBe(true);
    expect(
      callbackSubmissionSchema.safeParse({ ...base, email: "a@b.test", message: "hello" }).success,
    ).toBe(true);
    expect(callbackSubmissionSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(
      false,
    );
    expect(callbackSubmissionSchema.safeParse({ ...base, message: "x".repeat(501) }).success).toBe(
      false,
    );
    expect(callbackSubmissionSchema.safeParse({ ...base, reason: "x".repeat(201) }).success).toBe(
      false,
    );
  });

  it("time-window labels promise no clock times or hours (those come from Business Settings)", () => {
    for (const label of Object.values(CALLBACK_TIME_WINDOW_LABELS))
      expect(label).not.toMatch(/\d|AM|PM|business hours/i);
  });
});

describe("callback persistence", () => {
  const input = (over: Record<string, unknown> = {}) => ({ ...base, ...over });

  it("stores structured callback details, the optional email, and a readable one-line summary", async () => {
    const t = await setup();
    const date = istDatePlusDays(2);
    const res = await submitCallbackEnquiry(
      input({
        email: "c@x.test",
        preferredDate: date,
        reason: "TMT rates",
        message: "Call after 5",
      }),
      { ip: "127.0.0.1" },
      t.deps,
    );
    expect(res.ok).toBe(true);
    const e = t.db.enquiries[0];
    expect(e.type).toBe("GENERAL");
    expect(e.email).toBe("c@x.test");
    expect(e.message).toContain("Callback requested (Morning, " + date + ")");
    expect(e.message).toContain("Reason: TMT rates");
    expect(e.message).toContain("Call after 5");
    expect(e.message).not.toMatch(/\d{1,2}:\d{2}/); // no invented hours
  });

  it("an invalid date is rejected before anything is saved", async () => {
    const t = await setup();
    const res = await submitCallbackEnquiry(
      input({ preferredDate: istDatePlusDays(-3) }),
      { ip: "127.0.0.1" },
      t.deps,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("VALIDATION");
    expect(t.db.enquiries).toHaveLength(0);
  });

  it("a repeated idempotency key returns the same enquiry and never creates a duplicate", async () => {
    const t = await setup();
    const a = await submitCallbackEnquiry(input(), { ip: "127.0.0.1" }, t.deps);
    const b = await submitCallbackEnquiry(input(), { ip: "127.0.0.1" }, t.deps);
    expect(a.ok && b.ok && a.reference === b.reference).toBe(true);
    expect(t.db.enquiries).toHaveLength(1);
  });

  it("is rate limited like every other public form", async () => {
    const t = await setup();
    let blocked = false;
    for (let i = 0; i < 6 && !blocked; i++) {
      const r = await submitCallbackEnquiry(
        input({
          idempotencyKey: `00000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`,
        }),
        { ip: "127.0.0.1" },
        t.deps,
      );
      blocked = !r.ok && r.code === "RATE_LIMITED";
    }
    expect(blocked).toBe(true); // the per-mobile limit (3/hour) trips
  });
});
