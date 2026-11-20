import { isSensitiveKey, logger, redact, redactString } from "./logger";

function lastLine(spy: ReturnType<typeof vi.spyOn>) {
  return JSON.parse(String(spy.mock.calls.at(-1)?.[0]));
}

describe("logger redaction", () => {
  it("redacts top-level sensitive fields", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("hi", { apiKey: "abc", user: "x" });
    const out = lastLine(spy);
    expect(out.apiKey).toBe("[redacted]");
    expect(out.user).toBe("x");
    spy.mockRestore();
  });

  it("redacts nested secrets in objects and arrays", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("nested", {
      request: {
        headers: { Authorization: "Bearer abc.def.ghi", "x-trace": "t1" },
        body: { email: "a@b.c", password: "hunter2", profile: { new_password: "p2" } },
        cookies: [{ name: "sb", session_token: "tok" }],
      },
      supabase: { SUPABASE_SERVICE_ROLE_KEY: "srk-123", url: "https://x.supabase.co" },
    });
    const raw = String(spy.mock.calls.at(-1)?.[0]);
    for (const secret of ["hunter2", 'p2"', "abc.def.ghi", "srk-123", '"tok"']) {
      expect(raw).not.toContain(secret);
    }
    const out = JSON.parse(raw);
    expect(out.request.headers["x-trace"]).toBe("t1");
    expect(out.request.body.email).toBe("a@b.c");
    expect(out.supabase.url).toBe("https://x.supabase.co");
    expect(out.request.body.password).toBe("[redacted]");
    expect(out.request.body.profile.new_password).toBe("[redacted]");
    expect(out.supabase.SUPABASE_SERVICE_ROLE_KEY).toBe("[redacted]");
    spy.mockRestore();
  });

  it("serialises Error instances including cause, with secrets removed", () => {
    const cause = new Error("db connect failed postgres://user:pa55@host:5432/db");
    const err = new Error("upstream failed token=abc123", { cause });
    const out = redact({ err }) as {
      err: { name: string; message: string; stack: string; cause: { message: string } };
    };
    expect(out.err.name).toBe("Error");
    expect(out.err.message).toContain("upstream failed");
    expect(out.err.message).not.toContain("abc123");
    expect(out.err.stack).toBeTruthy();
    expect(out.err.cause.message).not.toContain("pa55");
    expect(JSON.stringify(out)).not.toContain("pa55");
  });

  it("redacts secrets embedded in strings regardless of key name", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk";
    const pem = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg\n-----END PRIVATE KEY-----";
    expect(redactString(`jwt ${jwt}`)).not.toContain("eyJhbGci");
    expect(redactString(`key ${pem}`)).not.toContain("MIIEvQ");
    expect(redactString("Authorization: Bearer abcDEF123")).not.toContain("abcDEF123");
    expect(redactString("https://u:p@example.com/x")).toBe("https://[redacted]@example.com/x");
    expect(redactString("a=1&password=s3cret&b=2")).toBe("a=1&password=[redacted]&b=2");
    expect(redact({ note: `leaked ${jwt}` })).toEqual({ note: "leaked [redacted]" });
  });

  it("redacts Error extras and Map entries with sensitive keys", () => {
    const err = Object.assign(new Error("x"), { code: "E1", apiKey: "k-1" });
    const out = redact({
      err,
      m: new Map([
        ["secret", "v"],
        ["ok", "fine"],
      ]),
    }) as {
      err: Record<string, unknown>;
      m: Record<string, unknown>;
    };
    expect(out.err.code).toBe("E1");
    expect(out.err.apiKey).toBe("[redacted]");
    expect(out.m).toEqual({ secret: "[redacted]", ok: "fine" });
  });

  it("handles circular references and deep nesting without throwing", () => {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    expect(() => redact(a)).not.toThrow();
    expect(redact(a)).toEqual({ name: "a", self: "[circular]" });
    let deep: Record<string, unknown> = { password: "x" };
    for (let i = 0; i < 20; i++) deep = { child: deep };
    expect(JSON.stringify(redact(deep))).not.toContain('"x"');
  });

  it("does not let context overwrite level, message or time", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("real", { level: "info", message: "fake", time: "never" });
    const out = lastLine(spy);
    expect(out.level).toBe("warn");
    expect(out.message).toBe("real");
    expect(out.time).not.toBe("never");
    spy.mockRestore();
  });

  it("does not over-redact ordinary keys", () => {
    for (const k of ["email", "keyboard", "monkey", "status", "productId", "name"]) {
      expect(isSensitiveKey(k)).toBe(false);
    }
    for (const k of [
      "password",
      "Password",
      "x-api-key",
      "api_key",
      "SERVICE_ROLE_KEY",
      "refresh_token",
      "Authorization",
      "cookie",
      "key",
    ]) {
      expect(isSensitiveKey(k)).toBe(true);
    }
  });
});
