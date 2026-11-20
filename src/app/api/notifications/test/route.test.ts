// @vitest-environment node
const email = vi.hoisted(() => ({ send: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/email/web3forms", async (orig) => ({
  ...(await orig<typeof import("@/lib/email/web3forms")>()),
  loadWeb3FormsConfig: email.load,
  sendWeb3FormsEmail: email.send,
}));

import * as route from "./route";

const { POST } = route;

const SECRET = "cron-secret-0123456789abcdef";
const KEY = "11111111-2222-3333-4444-555555555555";
const req = (auth?: string, method = "POST") =>
  new Request("https://example.test/api/notifications/test", {
    method,
    headers: auth ? { authorization: auth } : {},
  });

beforeEach(() => {
  email.load.mockReset().mockReturnValue({ accessKey: KEY });
  email.send.mockReset().mockResolvedValue({ ok: true });
  vi.stubEnv("CRON_SECRET", SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe("email delivery test route", () => {
  it("is POST-only (a GET or link prefetch can never send mail)", () => {
    expect(Object.keys(route)).toEqual(["POST"]);
  });

  it("refuses while CRON_SECRET is unset or short, and for wrong or missing tokens — without sending", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(req(`Bearer ${SECRET}`))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", SECRET);
    for (const a of [undefined, "", "Bearer nope", SECRET, "bearer " + SECRET])
      expect((await POST(req(a))).status).toBe(401);
    expect(email.send).not.toHaveBeenCalled();
  });

  it("reports a missing/malformed Web3Forms key with a clear next step", async () => {
    email.load.mockReturnValue(null);
    const res = await POST(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("EMAIL_NOT_CONFIGURED");
    expect(body.hint).toMatch(/WEB3FORMS_ACCESS_KEY/);
    expect(email.send).not.toHaveBeenCalled();
  });

  it("sends exactly one test message and confirms acceptance (without claiming inbox delivery)", async () => {
    const res = await POST(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.message).toMatch(/Check the inbox/);
    expect(email.send).toHaveBeenCalledTimes(1);
    const [, message] = email.send.mock.calls[0];
    expect(message.subject).toMatch(/delivery test/i);
    expect(JSON.stringify(body)).not.toContain(KEY);
  });

  it.each([
    [
      {
        ok: false,
        kind: "HTTP",
        status: 403,
        retryable: false,
        summary: "Web3Forms returned HTTP 403",
      },
      /free plan/,
    ],
    [
      { ok: false, kind: "TIMEOUT", status: null, retryable: true, summary: "no response" },
      /timeout/i,
    ],
    [
      { ok: false, kind: "REJECTED", status: 200, retryable: false, summary: "rejected" },
      /did not send/,
    ],
  ])("explains a failed send (%#) without leaking the key", async (result, hint) => {
    email.send.mockResolvedValue(result);
    const res = await POST(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.hint).toMatch(hint);
    expect(JSON.stringify(body)).not.toContain(KEY);
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });
});
