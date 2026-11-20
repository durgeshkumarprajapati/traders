// @vitest-environment node
import {
  EMAIL_TIMEOUT_MS,
  WEB3FORMS_ENDPOINT,
  loadWeb3FormsConfig,
  sendWeb3FormsEmail,
} from "./web3forms";

const KEY = "11111111-2222-3333-4444-555555555555";
const message = {
  subject: "Bulk quotation enquiry ENQ-2026-001000",
  fromName: "Sagar Traders website",
  text: "body",
  replyTo: "a@example.test",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("loadWeb3FormsConfig", () => {
  it("accepts a UUID-style key and returns null (never throws, never echoes) otherwise", () => {
    expect(loadWeb3FormsConfig({ WEB3FORMS_ACCESS_KEY: KEY })).toEqual({ accessKey: KEY });
    expect(loadWeb3FormsConfig({})).toBeNull();
    expect(loadWeb3FormsConfig({ WEB3FORMS_ACCESS_KEY: "  " })).toBeNull();
    expect(loadWeb3FormsConfig({ WEB3FORMS_ACCESS_KEY: "has spaces and <script>" })).toBeNull();
  });
});

describe("sendWeb3FormsEmail", () => {
  it("posts JSON to the Web3Forms endpoint (server-side) and reports success", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const r = await sendWeb3FormsEmail({ accessKey: KEY }, message, async (url, init) => {
      calls.push({ url, init: init! });
      return json({ success: true, message: "Email sent" });
    });
    expect(r).toEqual({ ok: true });
    expect(calls[0].url).toBe(WEB3FORMS_ENDPOINT);
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({
      access_key: KEY,
      subject: message.subject,
      from_name: message.fromName,
      replyto: "a@example.test",
      message: "body",
    });
  });

  it("omits replyto when the customer gave no email", async () => {
    let body: Record<string, unknown> = {};
    await sendWeb3FormsEmail(
      { accessKey: KEY },
      { ...message, replyTo: undefined },
      async (_u, init) => {
        body = JSON.parse(String(init!.body));
        return json({ success: true });
      },
    );
    expect("replyto" in body).toBe(false);
  });

  it("classifies provider rejections (permanent) vs transient failures, with a short sanitised summary", async () => {
    const rejected = await sendWeb3FormsEmail({ accessKey: KEY }, message, async () =>
      json({ success: false, message: "Invalid Access Key\n\u0000injected" }),
    );
    expect(rejected).toMatchObject({ ok: false, kind: "REJECTED", retryable: false });
    expect(JSON.stringify(rejected)).not.toMatch(/\u0000|\n/);

    expect(
      await sendWeb3FormsEmail({ accessKey: KEY }, message, async () => json({}, 429)),
    ).toMatchObject({ ok: false, kind: "HTTP", status: 429, retryable: true });
    expect(
      await sendWeb3FormsEmail({ accessKey: KEY }, message, async () => json({}, 503)),
    ).toMatchObject({ retryable: true, status: 503 });
    expect(
      await sendWeb3FormsEmail({ accessKey: KEY }, message, async () =>
        json({ message: "bad" }, 400),
      ),
    ).toMatchObject({ kind: "HTTP", status: 400, retryable: false });
    expect(
      await sendWeb3FormsEmail(
        { accessKey: KEY },
        message,
        async () => new Response("<html>", { status: 502 }),
      ),
    ).toMatchObject({ retryable: true });
  });

  it("reports network errors and timeouts as retryable failures", async () => {
    expect(
      await sendWeb3FormsEmail({ accessKey: KEY }, message, async () =>
        Promise.reject(new TypeError("fetch failed")),
      ),
    ).toMatchObject({ ok: false, kind: "NETWORK", retryable: true });
    vi.useFakeTimers();
    try {
      const p = sendWeb3FormsEmail(
        { accessKey: KEY },
        message,
        (_u, init) =>
          new Promise((_res, rej) =>
            init!.signal?.addEventListener("abort", () =>
              rej(new DOMException("aborted", "AbortError")),
            ),
          ),
      );
      await vi.advanceTimersByTimeAsync(EMAIL_TIMEOUT_MS + 10);
      expect(await p).toMatchObject({ ok: false, kind: "TIMEOUT", retryable: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it("never leaks the access key or customer data into a failure result", async () => {
    const r = await sendWeb3FormsEmail(
      { accessKey: KEY },
      { ...message, text: "customer secret text" },
      async () => Promise.reject(new Error(`boom ${KEY} customer secret text`)),
    );
    expect(JSON.stringify(r)).not.toContain(KEY);
    expect(JSON.stringify(r)).not.toContain("customer secret text");
  });
});
