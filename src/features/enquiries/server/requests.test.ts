// @vitest-environment node
import { submitExpertEnquiry, submitFreightEnquiry } from "./requests";
import { KEY, setup } from "./test-helpers";

vi.mock("server-only", () => ({}));

/** Runs setup() with an rpc wrapper that records every create_enquiry payload. */
async function recording() {
  const base = await setup();
  const payloads: Array<Record<string, unknown>> = [];
  const rpc = (async (name: string, args: Record<string, unknown>, opts: never) => {
    if (name === "create_enquiry") payloads.push(args.p_payload as Record<string, unknown>);
    return base.db.rpc(name, args, opts);
  }) as typeof base.db.rpc;
  const t = await setup({ rpc });
  return { ...t, payloads };
}

const freight = (over: Record<string, unknown> = {}) => ({
  idempotencyKey: KEY(901),
  name: "Ravi Kumar",
  mobile: "9876543210",
  email: "",
  pincode: "110 001",
  locality: "Sector 5, Old Town",
  materials: "Cement and steel bars",
  quantityNote: "about 200 bags",
  message: "",
  ...over,
});
const expert = (over: Record<string, unknown> = {}) => ({
  idempotencyKey: KEY(902),
  name: "Ravi Kumar",
  mobile: "9876543210",
  email: "",
  topic: "CONCRETE_MASONRY",
  projectType: "NEW_CONSTRUCTION",
  question: "Which cement grade suits a ground floor slab?",
  usage: "",
  ...over,
});

describe("freight enquiry", () => {
  it("stores a GENERAL enquiry with DELIVERY metadata and no delivery promise", async () => {
    const t = await recording();
    const r = await submitFreightEnquiry(freight(), { ip: "203.0.113.5" }, t.deps);
    expect(r).toMatchObject({ ok: true, mode: "PERSISTED" });
    const payload = t.payloads[0];
    expect(payload).toMatchObject({
      type: "GENERAL",
      delivery_location: "Sector 5, Old Town, PIN 110001",
      items: [],
      metadata: {
        kind: "DELIVERY",
        data: { pincode: "110001", materials: "Cement and steel bars" },
      },
    });
    expect(String(payload.message)).toMatch(/PIN 110001/);
    expect(JSON.stringify(payload)).not.toMatch(/₹|price|charge/i);
  });

  it("records a coverage status computed on the server, never one supplied by the browser", async () => {
    const t = await recording();
    await submitFreightEnquiry(
      freight({ coverageStatus: "LISTED", coverage_status_at_submission: "LISTED" }),
      { ip: "203.0.113.6" },
      t.deps,
    );
    const payload = t.payloads[0] as { metadata: { data: Record<string, unknown> } };
    expect(["NOT_CONFIGURED", "LISTED", "NOT_LISTED"]).toContain(
      payload.metadata.data.coverage_status_at_submission,
    );
    expect(Object.keys(payload.metadata.data)).not.toContain("coverageStatus");
  });

  it("rejects an invalid PIN, a honeypot is silently dropped, and nothing is stored in either case", async () => {
    const t = await recording();
    expect(
      await submitFreightEnquiry(freight({ pincode: "12345" }), { ip: null }, t.deps),
    ).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(
      await submitFreightEnquiry(freight({ website: "http://spam" }), { ip: null }, t.deps),
    ).toEqual({ ok: true, reference: null });
    expect(t.payloads).toHaveLength(0);
  });
});

describe("expert enquiry", () => {
  it("stores a GENERAL enquiry with EXPERT metadata and marks attachments unsupported", async () => {
    const t = await recording();
    const r = await submitExpertEnquiry(expert(), { ip: "203.0.113.7" }, t.deps);
    expect(r).toMatchObject({ ok: true });
    const payload = t.payloads[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      type: "GENERAL",
      metadata: {
        kind: "EXPERT",
        data: { topic: "CONCRETE_MASONRY", attachments: "NOT_SUPPORTED" },
      },
    });
  });

  it("validates topic and question length", async () => {
    const t = await setup();
    for (const bad of [{ topic: "ANYTHING" }, { question: "short" }, { question: "x".repeat(801) }])
      expect(await submitExpertEnquiry(expert(bad), { ip: null }, t.deps)).toMatchObject({
        ok: false,
        code: "VALIDATION",
      });
  });
});
