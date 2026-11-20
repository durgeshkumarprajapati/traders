// @vitest-environment node
import { createVerify } from "node:crypto";
import { createTokenProvider } from "./auth";
import { SheetsAuthError } from "./errors";
import { GOOGLE_TOKEN_URL, signServiceAccountJwt } from "./jwt";
import { SHEETS_SCOPES } from "./config";
import { TEST_EMAIL, json, makeKeyPair, scriptedHttp, testConfig } from "./test-utils";

const { privateKey, publicKey } = makeKeyPair();
const config = testConfig(privateKey);
const ok = (token = "ya29.test-access-token", expires = 3600) =>
  json({ access_token: token, expires_in: expires, token_type: "Bearer" });
const b64 = (s: string) => JSON.parse(Buffer.from(s, "base64url").toString());

describe("signServiceAccountJwt", () => {
  it("produces a verifiable RS256 JWT with the expected claims", () => {
    const jwt = signServiceAccountJwt({
      clientEmail: TEST_EMAIL,
      privateKey,
      scope: SHEETS_SCOPES.read,
      nowSeconds: 1_700_000_000,
    });
    const [h, c, s] = jwt.split(".");
    expect(b64(h)).toEqual({ alg: "RS256", typ: "JWT" });
    expect(b64(c)).toEqual({
      iss: TEST_EMAIL,
      scope: SHEETS_SCOPES.read,
      aud: GOOGLE_TOKEN_URL,
      iat: 1_700_000_000,
      exp: 1_700_003_600,
    });
    const v = createVerify("RSA-SHA256");
    v.update(`${h}.${c}`);
    expect(v.verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
  });
  it("uses least-privilege scopes (readonly for reads, full only for writes)", () => {
    expect(SHEETS_SCOPES.read).toMatch(/spreadsheets\.readonly$/);
    expect(SHEETS_SCOPES.write).toMatch(/spreadsheets$/);
  });
});

describe("token provider", () => {
  it("exchanges a signed assertion and caches the token per scope", async () => {
    const http = scriptedHttp([ok("ya29.read-token"), ok("ya29.write-token")]);
    const tokens = createTokenProvider(config, http.deps);
    expect(await tokens.getAccessToken("read")).toBe("ya29.read-token");
    expect(await tokens.getAccessToken("read")).toBe("ya29.read-token"); // cached
    expect(await tokens.getAccessToken("write")).toBe("ya29.write-token"); // separate scope → separate token
    expect(http.requests).toHaveLength(2);
    const body = new URLSearchParams(String(http.requests[0].init.body));
    expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    expect(b64(body.get("assertion")!.split(".")[1]).scope).toBe(SHEETS_SCOPES.read);
    expect(b64(body.get("assertion")!.split(".")[1]).scope).not.toBe(SHEETS_SCOPES.write);
  });

  it("shares one in-flight exchange between concurrent callers", async () => {
    const http = scriptedHttp([ok("ya29.once-token")]);
    const tokens = createTokenProvider(config, http.deps);
    const [a, b, c] = await Promise.all([
      tokens.getAccessToken("read"),
      tokens.getAccessToken("read"),
      tokens.getAccessToken("read"),
    ]);
    expect([a, b, c]).toEqual(["ya29.once-token", "ya29.once-token", "ya29.once-token"]);
    expect(http.requests).toHaveLength(1);
  });

  it("refreshes shortly before expiry", async () => {
    const http = scriptedHttp([ok("ya29.first", 120), ok("ya29.second", 3600)]);
    const tokens = createTokenProvider(config, http.deps);
    expect(await tokens.getAccessToken("read")).toBe("ya29.first");
    await http.deps.sleep(70_000); // 120s token, 60s margin ⇒ now inside the refresh window
    expect(await tokens.getAccessToken("read")).toBe("ya29.second");
  });

  it("retries transient token-endpoint failures", async () => {
    const http = scriptedHttp([json({}, 503), ok("ya29.after-retry")]);
    expect(await createTokenProvider(config, http.deps).getAccessToken("read")).toBe(
      "ya29.after-retry",
    );
    expect(http.sleeps).toHaveLength(1);
  });

  it("reports a rejected credential without leaking key material or the assertion", async () => {
    const http = scriptedHttp([
      json({ error: "invalid_grant", error_description: "Invalid JWT Signature." }, 400),
    ]);
    const err = await createTokenProvider(config, http.deps)
      .getAccessToken("read")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SheetsAuthError);
    const assertion = new URLSearchParams(String(http.requests[0].init.body)).get("assertion")!;
    const text = `${(err as Error).message} ${(err as SheetsAuthError).detail} ${JSON.stringify(err)}`;
    expect(text).toContain("invalid_grant");
    expect(text).not.toContain(assertion);
    expect(text).not.toContain("PRIVATE KEY");
    expect((err as SheetsAuthError).publicMessage).toBe("Product data is temporarily unavailable.");
  });

  it("converts an unusable private key into a safe error (no key-parsing text)", async () => {
    const http = scriptedHttp([]);
    const bad = createTokenProvider(
      { ...config, privateKey: "-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----" },
      http.deps,
    );
    const err = (await bad.getAccessToken("read").catch((e: unknown) => e)) as SheetsAuthError;
    expect(err).toBeInstanceOf(SheetsAuthError);
    expect(err.detail).toMatch(/GOOGLE_PRIVATE_KEY/);
    expect(JSON.stringify(err) + err.stack).not.toMatch(/AAAA|asn1|DECODER|PEM routines/i);
    expect(http.requests).toHaveLength(0); // never contacted Google
  });

  it("rejects malformed token responses", async () => {
    const http = scriptedHttp([json({ nope: true })]);
    await expect(
      createTokenProvider(config, http.deps).getAccessToken("read"),
    ).rejects.toBeInstanceOf(SheetsAuthError);
  });
});
