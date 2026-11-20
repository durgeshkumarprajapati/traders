// @vitest-environment node
import type { EmailResult } from "@/lib/email/web3forms";
import { SupabaseApiError } from "@/lib/supabase/errors";
import { buildEnquiryEmail } from "./email-template";
import {
  processDueNotifications,
  processNotification,
  retryNotification,
  type NotificationDeps,
} from "./notifications";
import { KEY, bulkInput, contactInput, setup } from "./test-helpers";
import { submitBulkEnquiry, submitContactEnquiry } from "./submit";

const FAIL_503: EmailResult = {
  ok: false,
  kind: "HTTP",
  status: 503,
  retryable: true,
  summary: "Web3Forms returned HTTP 503",
};
const ctx = { ip: "203.0.113.7" };

/** Create an enquiry through the real service but without running the after-response task. */
async function created(t: Awaited<ReturnType<typeof setup>>, bulk = true) {
  const r = bulk
    ? await submitBulkEnquiry(bulkInput(), ctx, t.deps)
    : await submitContactEnquiry(contactInput(), ctx, t.deps);
  t.tasks.splice(0);
  return {
    reference: (r as { reference: string }).reference,
    outbox: t.db.outbox[t.db.outbox.length - 1],
  };
}

describe("processNotification", () => {
  it("claims, sends ONE email built from the stored snapshots, and records SENT with an audited attempt", async () => {
    const t = await setup();
    const { reference, outbox } = await created(t);
    expect(await processNotification(outbox.id, t.nd)).toBe("sent");
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0].subject).toBe(`Bulk quotation enquiry ${reference}`);
    expect(t.sent[0].replyTo).toBe("asha@example.test");
    for (const expected of [
      "Asha Rao",
      "9123456780",
      "Pune site, Gate 2",
      "Need it in two lots.",
      "1. Cement PPC 50kg (Brand One) [SKU C-1]",
      "Quantity: 100 Bag",
      "₹385.00 per Bag",
      "Availability at submission: In Stock",
      "2. TMT 12mm",
      "Quantity: 5.5 Metric Ton",
      "Availability at submission: Available on Order",
    ]) {
      expect(t.sent[0].text).toContain(expected);
    }
    expect(outbox).toMatchObject({ status: "SENT", attempt_count: 1 });
    expect(t.db.attempts).toEqual([
      expect.objectContaining({ attempt_number: 1, outcome: "SUCCESS", http_status: 200 }),
    ]);
  });

  it("a SENT notification is never sent again (no duplicate email), however often it is processed", async () => {
    const t = await setup();
    const { outbox } = await created(t);
    await processNotification(outbox.id, t.nd);
    for (let i = 0; i < 3; i++) expect(await processNotification(outbox.id, t.nd)).toBe("skipped");
    t.db.advance(24 * 3600_000);
    expect(await processNotification(outbox.id, t.nd)).toBe("skipped");
    expect(t.sent).toHaveLength(1);
  });

  it("records a failure with exponential backoff and does not retry before it elapses", async () => {
    const t = await setup({}, () => FAIL_503);
    const { outbox } = await created(t);
    expect(await processNotification(outbox.id, t.nd)).toBe("failed");
    expect(outbox).toMatchObject({
      status: "FAILED",
      attempt_count: 1,
      last_error: "Web3Forms returned HTTP 503",
    });
    expect(t.db.attempts[0]).toMatchObject({
      outcome: "FAILURE",
      http_status: 503,
      error_code: "HTTP",
    });
    expect(await processNotification(outbox.id, t.nd)).toBe("skipped"); // still backing off
    t.db.advance(59_000);
    expect(await processNotification(outbox.id, t.nd)).toBe("skipped");
    t.db.advance(2_000); // 61 s: first backoff (60 s) elapsed
    expect(await processNotification(outbox.id, t.nd)).toBe("failed");
    expect(outbox.attempt_count).toBe(2);
    const second = outbox.next_attempt_at - t.db.clock;
    expect(second).toBe(120_000); // 60 s → 120 s: doubles
  });

  it("succeeds on a later attempt and keeps the full audit trail", async () => {
    let n = 0;
    const t = await setup({}, () => (++n < 3 ? FAIL_503 : { ok: true }));
    const { outbox } = await created(t);
    await processNotification(outbox.id, t.nd);
    t.db.advance(61_000);
    await processNotification(outbox.id, t.nd);
    t.db.advance(121_000);
    expect(await processNotification(outbox.id, t.nd)).toBe("sent");
    expect(outbox.status).toBe("SENT");
    expect(t.db.attempts.map((a) => a.outcome)).toEqual(["FAILURE", "FAILURE", "SUCCESS"]);
    expect(t.sent).toHaveLength(3); // three attempts, the first two failed at the provider
  });

  it("stops automatic retries after the attempt ceiling", async () => {
    const t = await setup({}, () => FAIL_503);
    const { outbox } = await created(t);
    for (let i = 0; i < 20; i++) {
      await processNotification(outbox.id, t.nd);
      t.db.advance(7 * 3600_000);
    }
    expect(outbox.attempt_count).toBe(8);
    expect(outbox.status).toBe("FAILED");
    expect(await processNotification(outbox.id, t.nd)).toBe("skipped");
    expect(await t.db.rpc<string[]>("list_due_notifications", { p_limit: 10 })).toEqual([]);
  });

  it("maps provider timeouts to TIMEOUT, and permanent rejections to 'never auto-retried'", async () => {
    const t1 = await setup({}, () => ({
      ok: false,
      kind: "TIMEOUT",
      status: null,
      retryable: true,
      summary: "no response",
    }));
    const a = await created(t1);
    await processNotification(a.outbox.id, t1.nd);
    expect(t1.db.attempts[0].outcome).toBe("TIMEOUT");

    const t2 = await setup({}, () => ({
      ok: false,
      kind: "REJECTED",
      status: 200,
      retryable: false,
      summary: "Invalid Access Key",
    }));
    const b = await created(t2);
    await processNotification(b.outbox.id, t2.nd);
    expect(b.outbox.next_attempt_at).toBe(Number.POSITIVE_INFINITY);
    t2.db.advance(30 * 24 * 3600_000);
    expect(await processNotification(b.outbox.id, t2.nd)).toBe("skipped");
    expect(await t2.db.rpc<string[]>("list_due_notifications", { p_limit: 10 })).toEqual([]);
  });

  it("manual retry resets a failed notification and refuses an already-sent one (safe)", async () => {
    let ok = false;
    const t = await setup({}, () =>
      ok
        ? { ok: true }
        : {
            ok: false,
            kind: "REJECTED",
            status: 200,
            retryable: false,
            summary: "Invalid Access Key",
          },
    );
    const { outbox } = await created(t);
    await processNotification(outbox.id, t.nd);
    expect(outbox.status).toBe("FAILED");
    ok = true; // the owner fixed the key
    const r = await retryNotification(outbox.id, t.nd);
    expect(r).toEqual({ retried: true, outcome: "sent" });
    expect(outbox.status).toBe("SENT");
    expect(await retryNotification(outbox.id, t.nd)).toEqual({
      retried: false,
      reason: "ALREADY_SENT",
    });
    expect(t.sent).toHaveLength(2); // the first (rejected) attempt + the successful retry — never more
    expect(await retryNotification("00000000-0000-4000-8000-0000000000ff", t.nd)).toEqual({
      retried: false,
      reason: "NOT_FOUND",
    });
  });

  it("does not claim (and burns no attempt) when the email provider is not configured", async () => {
    const t = await setup();
    const { outbox } = await created(t);
    const unconfigured: NotificationDeps = { ...t.nd, web3forms: null };
    expect(await processNotification(outbox.id, unconfigured)).toBe("not_configured");
    expect(t.db.count("claim_notification")).toBe(0);
    expect(outbox).toMatchObject({ status: "PENDING", attempt_count: 0 });
    expect(await processNotification(outbox.id, t.nd)).toBe("sent"); // once configured, it is delivered
  });

  it("two workers racing on the same notification send exactly once", async () => {
    const t = await setup();
    const { outbox } = await created(t);
    const results = await Promise.all([
      processNotification(outbox.id, t.nd),
      processNotification(outbox.id, t.nd),
      processNotification(outbox.id, t.nd),
    ]);
    expect(results.filter((r) => r === "sent")).toHaveLength(1);
    expect(results.filter((r) => r === "skipped")).toHaveLength(2);
    expect(t.sent).toHaveLength(1);
  });

  it("an unexpected sender error is recorded as a retryable failure, not thrown", async () => {
    const t = await setup();
    const { outbox } = await created(t);
    const boom: NotificationDeps = {
      ...t.nd,
      send: async () => Promise.reject(new Error("kaboom")),
    };
    expect(await processNotification(outbox.id, boom)).toBe("failed");
    expect(outbox.status).toBe("FAILED");
    expect(t.db.attempts[0].error_summary).not.toContain("kaboom");
  });

  it("is at-least-once: if the result cannot be recorded, the lease expires and delivery is retried", async () => {
    const t = await setup();
    const { outbox } = await created(t);
    t.db.failNext("record_notification_attempt", new SupabaseApiError("down", 503, null, true));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await processNotification(outbox.id, t.nd)).toBe("unrecorded");
    spy.mockRestore();
    expect(outbox.status).toBe("IN_PROGRESS");
    expect(await processNotification(outbox.id, t.nd)).toBe("skipped"); // lease still held
    t.db.advance(121_000); // lease expired
    expect(await processNotification(outbox.id, t.nd)).toBe("sent");
    expect(t.sent).toHaveLength(2); // documented trade-off: a rare duplicate email, never a lost one
  });

  it("a stale worker cannot overwrite a newer attempt", async () => {
    const t = await setup();
    const { outbox } = await created(t);
    await t.db.rpc("claim_notification", { p_outbox_id: outbox.id, p_lease_seconds: 30 }); // worker A claims (attempt 1)…
    t.db.advance(31_000); // …and stalls past its lease
    await t.db.rpc("claim_notification", { p_outbox_id: outbox.id, p_lease_seconds: 120 }); // worker B (attempt 2)
    const late = await t.db.rpc<{ recorded: boolean }>("record_notification_attempt", {
      p_outbox_id: outbox.id,
      p_attempt_number: 1,
      p_outcome: "SUCCESS",
    });
    expect(late.recorded).toBe(false);
    expect(outbox.status).toBe("IN_PROGRESS");
  });

  it("copes with a malformed claim payload without crashing", async () => {
    const t = await setup();
    const { outbox } = await created(t);
    const weird: NotificationDeps = {
      ...t.nd,
      rpc: (async (fn: string) =>
        fn === "claim_notification"
          ? { outbox_id: "nope", attempt_number: 1 }
          : null) as NotificationDeps["rpc"],
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await processNotification(outbox.id, weird)).toBe("failed");
    spy.mockRestore();
    expect(t.sent).toHaveLength(0);
  });
});

describe("processDueNotifications (sweeper / opportunistic retry)", () => {
  it("attempts only due notifications and summarises", async () => {
    const t = await setup({}, () => FAIL_503);
    const a = await created(t);
    t.db.advance(1000);
    await submitContactEnquiry(
      contactInput({ idempotencyKey: KEY(77) }),
      { ip: "1.2.3.4" },
      t.deps,
    );
    t.tasks.splice(0);
    const s1 = await processDueNotifications(10, t.nd);
    expect(s1).toMatchObject({ due: 2, failed: 2, sent: 0 });
    expect(await processDueNotifications(10, t.nd)).toMatchObject({ due: 0 }); // all backing off
    expect(a.outbox.attempt_count).toBe(1);
  });

  it("delivers older failures once the provider recovers, respecting the limit", async () => {
    let healthy = false;
    const t = await setup({}, () => (healthy ? { ok: true } : FAIL_503));
    for (let i = 0; i < 4; i++) {
      await submitContactEnquiry(
        contactInput({ idempotencyKey: KEY(600 + i), mobile: `91234567${20 + i}` }),
        { ip: `5.5.5.${i}` },
        t.deps,
      );
    }
    t.tasks.splice(0);
    expect(await processDueNotifications(10, t.nd)).toMatchObject({ due: 4, failed: 4 });
    healthy = true;
    t.db.advance(61_000);
    expect(await processDueNotifications(2, t.nd)).toMatchObject({ due: 2, sent: 2 }); // limit respected
    expect(await processDueNotifications(10, t.nd)).toMatchObject({ due: 2, sent: 2 });
    expect(t.db.outbox.every((o) => o.status === "SENT")).toBe(true);
  });
});

describe("email builder", () => {
  const enquiry = {
    reference: "ENQ-2026-001000",
    type: "GENERAL" as const,
    customer_name: "Ravi\r\nBcc: evil@example.test",
    mobile: "9123456789",
    email: "ravi@example.test",
    delivery_location: null,
    message: "Line one\u0000\u0007 with control chars\nLine two",
    created_at: "2026-11-18T12:00:00Z",
  };

  it("builds a plain-text message: control characters removed, no markup injection into headers", () => {
    const m = buildEnquiryEmail(enquiry, []);
    expect(m.subject).toBe("General enquiry ENQ-2026-001000");
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.text).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/);
    expect(m.text).toContain("Name: Ravi Bcc: evil@example.test"); // CR/LF collapsed: cannot start a new header line
    expect(m.text).toContain("Line two");
    expect(m.text).not.toContain("ITEMS");
    expect(m.replyTo).toBe("ravi@example.test");
  });

  it("omits reply-to for a missing or malformed email, marks missing prices, and bounds very long input", () => {
    expect(buildEnquiryEmail({ ...enquiry, email: null }, []).replyTo).toBeUndefined();
    expect(buildEnquiryEmail({ ...enquiry, email: "not an email" }, []).replyTo).toBeUndefined();
    const m = buildEnquiryEmail({ ...enquiry, message: "x".repeat(5000) }, [
      {
        position: 1,
        product_id: "p",
        sku: null,
        product_name: "Thing",
        brand_name: null,
        unit_label: "Set",
        quantity: "2.500",
        listed_price: null,
        stock_status: "OUT_OF_STOCK",
      },
    ]);
    expect(m.text.length).toBeLessThan(3000);
    expect(m.text).toContain("Quantity: 2.5 Set");
    expect(m.text).toContain("Listed price at submission: none (rate on request)");
    expect(m.text).toContain("Availability at submission: Out of Stock");
  });
});
