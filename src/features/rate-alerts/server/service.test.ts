// @vitest-environment node
import type { CatalogueLoad } from "@/features/catalogue/server";
import type { CustomerEmailProvider } from "@/lib/email/provider";
import type { Rpc } from "@/lib/supabase/rest";
import {
  confirmRateAlert,
  hashToken,
  rateAlertToken,
  runRateAlertCycle,
  subscribeRateAlert,
  unsubscribeRateAlert,
  type RateAlertDeps,
} from "./service";
import { RATE_ALERT_MESSAGES, formatPaise, parseRupeesToPaise, toPaise } from "../types";

vi.mock("server-only", () => ({}));

const SECRET = "test-secret-0123456789abcdef";
const catalogue = (source: "LIVE" | "STATIC" = "LIVE"): CatalogueLoad =>
  ({
    ok: true,
    source,
    settings: {},
    fetchedAt: "now",
    catalogue: {
      products: [
        { id: "p1", name: "PPC Cement", price: 399.5 },
        { id: "p2", name: "No Rate Item", price: null },
      ],
    },
  }) as unknown as CatalogueLoad;

type Call = { fn: string; args: Record<string, unknown> };
function harness(
  opts: {
    provider?: CustomerEmailProvider | null;
    load?: CatalogueLoad;
    created?: boolean;
    limited?: boolean;
    due?: unknown[];
  } = {},
) {
  const calls: Call[] = [];
  const rpc = (async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    if (fn === "check_rate_limit") return { allowed: !opts.limited };
    if (fn === "subscribe_rate_alert") return { created: opts.created ?? true };
    if (fn === "record_price_snapshots") return 1;
    if (fn === "queue_rate_alert_notifications") return 2;
    if (fn === "list_rate_alerts_due") return opts.due ?? [];
    if (fn === "confirm_rate_alert" || fn === "unsubscribe_rate_alert") return true;
    return null;
  }) as Rpc;
  const sent: Array<{ to: string; subject: string; text: string }> = [];
  const provider: CustomerEmailProvider | null =
    opts.provider === undefined
      ? {
          send: async (m) => {
            sent.push(m);
            return { ok: true };
          },
        }
      : opts.provider;
  const deps: RateAlertDeps = {
    rpc,
    provider,
    secret: SECRET,
    loadCatalogue: async () => opts.load ?? catalogue(),
    origin: "https://shop.example",
  };
  return { deps, calls, sent };
}
const input = (over: Record<string, unknown> = {}) => ({
  productId: "p1",
  email: "Buyer@Example.com",
  alertType: "ANY_CHANGE",
  targetPrice: "",
  consent: true,
  ...over,
});
const stored = (calls: Call[]) => calls.filter((c) => c.fn !== "check_rate_limit");

describe("money helpers", () => {
  it("converts exactly", () => {
    expect(toPaise(399.5)).toBe(39950);
    expect(toPaise(0.29)).toBe(29);
    expect(parseRupeesToPaise("349.5")).toBe(34950);
    expect(parseRupeesToPaise("350")).toBe(35000);
    expect(parseRupeesToPaise("1.234")).toBeNull();
    expect(formatPaise(39905)).toBe("₹399.05");
  });
});

describe("subscribeRateAlert", () => {
  it("reports unavailable and stores NOTHING when no email provider exists", async () => {
    const h = harness({ provider: null });
    const r = await subscribeRateAlert(input(), { ip: "1.2.3.4" }, h.deps);
    expect(r).toEqual({ ok: false, code: "UNAVAILABLE", message: RATE_ALERT_MESSAGES.unavailable });
    expect(h.calls).toHaveLength(0);
  });

  it("requires explicit consent and a valid target for DROPS_BELOW", async () => {
    const h = harness();
    expect(await subscribeRateAlert(input({ consent: false }), { ip: null }, h.deps)).toMatchObject(
      { code: "VALIDATION" },
    );
    expect(
      await subscribeRateAlert(
        input({ alertType: "DROPS_BELOW", targetPrice: "abc" }),
        { ip: null },
        h.deps,
      ),
    ).toMatchObject({ code: "VALIDATION", fieldErrors: { targetPrice: expect.any(String) } });
    expect(stored(h.calls)).toHaveLength(0);
  });

  it("stores hashed tokens only and emails the raw confirm link once", async () => {
    const h = harness();
    const r = await subscribeRateAlert(input(), { ip: "1.2.3.4" }, h.deps);
    expect(r).toEqual({ ok: true, message: RATE_ALERT_MESSAGES.checkInbox });
    const sub = stored(h.calls)[0].args;
    expect(sub.p_email).toBe("buyer@example.com");
    const token = rateAlertToken("confirm", sub.p_id as string, SECRET);
    expect(sub.p_confirm_hash).toBe(hashToken(token));
    expect(JSON.stringify(h.calls)).not.toContain(token);
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].text).toContain(`https://shop.example/rate-alerts/confirm#t=${token}`);
    expect(h.sent[0].text).not.toContain("?t=");
  });

  it("answers identically for an already-subscribed address and sends nothing", async () => {
    const h = harness({ created: false });
    const r = await subscribeRateAlert(input(), { ip: null }, h.deps);
    expect(r).toEqual({ ok: true, message: RATE_ALERT_MESSAGES.checkInbox });
    expect(h.sent).toHaveLength(0);
  });

  it("rolls the pending subscription back and says so when the confirmation email fails", async () => {
    const h = harness({ provider: { send: async () => ({ ok: false, error: "boom" }) } });
    const r = await subscribeRateAlert(input(), { ip: null }, h.deps);
    expect(r).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(h.calls.some((c) => c.fn === "unsubscribe_rate_alert")).toBe(true);
  });

  it("rejects products without a listed rate, and rate-limits", async () => {
    expect(
      await subscribeRateAlert(input({ productId: "p2" }), { ip: null }, harness().deps),
    ).toMatchObject({ code: "INVALID_PRODUCT" });
    expect(
      await subscribeRateAlert(input({ productId: "zzz" }), { ip: null }, harness().deps),
    ).toMatchObject({ code: "INVALID_PRODUCT" });
    expect(
      await subscribeRateAlert(input(), { ip: null }, harness({ limited: true }).deps),
    ).toMatchObject({ code: "RATE_LIMITED" });
  });

  it("ignores honeypot submissions silently", async () => {
    const h = harness();
    expect(await subscribeRateAlert(input({ website: "x" }), { ip: null }, h.deps)).toMatchObject({
      ok: true,
    });
    expect(h.calls).toHaveLength(0);
  });
});

describe("confirm / unsubscribe", () => {
  it("only accept well-formed tokens and hash them before the database sees them", async () => {
    const h = harness();
    expect(await confirmRateAlert("nope", h.deps.rpc)).toBe(false);
    expect(await unsubscribeRateAlert("nope", h.deps.rpc)).toBe("NOT_FOUND");
    expect(h.calls).toHaveLength(0);
    const t = rateAlertToken("unsubscribe", "11111111-1111-4111-8111-111111111111", SECRET);
    expect(await unsubscribeRateAlert(t, h.deps.rpc)).toBe("DONE");
    expect(h.calls[0].args).toEqual({ p_unsubscribe_hash: hashToken(t) });
  });
  it("confirm and unsubscribe tokens for one subscription differ", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(rateAlertToken("confirm", id, SECRET)).not.toBe(
      rateAlertToken("unsubscribe", id, SECRET),
    );
  });
});

describe("runRateAlertCycle", () => {
  it("snapshots and queues even without a provider, but sends nothing", async () => {
    const h = harness({ provider: null });
    const s = await runRateAlertCycle(h.deps, "2026-11-24");
    expect(s).toMatchObject({
      snapshotsRecorded: 1,
      queued: 2,
      sent: 0,
      providerConfigured: false,
      skippedReason: "NO_EMAIL_PROVIDER",
    });
    const snap = h.calls.find((c) => c.fn === "record_price_snapshots")!;
    expect(snap.args.p_prices).toEqual([{ product_id: "p1", price_paise: 39950 }]);
  });

  it("never snapshots the built-in fallback catalogue", async () => {
    const h = harness({ load: catalogue("STATIC") });
    const s = await runRateAlertCycle(h.deps, "2026-11-24");
    expect(s.skippedReason).toBe("LIVE_CATALOGUE_UNAVAILABLE");
    expect(h.calls).toHaveLength(0);
  });

  it("sends due notifications with an unsubscribe link and records each result", async () => {
    const due = [
      {
        id: "n1",
        subscription_id: "11111111-1111-4111-8111-111111111111",
        email: "a@example.com",
        product_id: "p1",
        price_from_paise: 39000,
        price_to_paise: 39950,
      },
    ];
    const h = harness({ due });
    const s = await runRateAlertCycle(h.deps, "2026-11-24");
    expect(s).toMatchObject({ sent: 1, failed: 0 });
    expect(h.sent[0].text).toContain("₹399.50");
    expect(h.sent[0].text).toContain("was ₹390.00");
    expect(h.sent[0].text).toContain("/rate-alerts/unsubscribe#t=ra_");
    expect(h.calls.find((c) => c.fn === "record_rate_alert_result")!.args).toEqual({
      p_id: "n1",
      p_sent: true,
      p_error: null,
    });
  });

  it("records provider failures for retry", async () => {
    const h = harness({
      provider: { send: async () => ({ ok: false, error: "rejected" }) },
      due: [
        {
          id: "n1",
          subscription_id: "11111111-1111-4111-8111-111111111111",
          email: "a@example.com",
          product_id: "p1",
          price_from_paise: null,
          price_to_paise: 100,
        },
      ],
    });
    const s = await runRateAlertCycle(h.deps, "2026-11-24");
    expect(s).toMatchObject({ sent: 0, failed: 1 });
    expect(h.calls.find((c) => c.fn === "record_rate_alert_result")!.args).toMatchObject({
      p_sent: false,
      p_error: "rejected",
    });
  });
});
