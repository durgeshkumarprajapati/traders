// @vitest-environment node
import { createSheetsClient, createSheetsReader, columnLetter } from "./client";
import { createTokenProvider } from "./auth";
import { SheetsApiError, SheetsStructureError, SheetsTimeoutError } from "./errors";
import { APPEND_POLICY, fetchWithPolicy, parseRetryAfterMs, READ_POLICY } from "./http";
import { hang, json, makeKeyPair, scriptedHttp, testConfig, type Scripted } from "./test-utils";

const { privateKey } = makeKeyPair();
const config = testConfig(privateKey);
const token: Scripted = () => json({ access_token: "ya29.test-access-token", expires_in: 3600 });

function setup(script: Scripted[]) {
  const http = scriptedHttp([token, ...script]);
  return {
    http,
    client: createSheetsClient({
      config,
      deps: http.deps,
      tokens: createTokenProvider(config, http.deps),
    }),
  };
}
const sheetsCalls = (h: ReturnType<typeof scriptedHttp>) =>
  h.requests.filter((r) => r.url.includes("sheets.googleapis.com"));

describe("readWorksheets", () => {
  it("reads all worksheets in ONE batched request with the read-only token", async () => {
    const { http, client } = setup([
      json({ valueRanges: [{ values: [["a"]] }, {}, { values: [["b"]] }] }),
    ]);
    const out = await client.readWorksheets(["Products", "Categories", "Brands"]);
    expect(out).toEqual({ Products: [["a"]], Categories: undefined, Brands: [["b"]] }); // blank sheet → undefined
    const [call] = sheetsCalls(http);
    const url = new URL(call.url);
    expect(url.pathname).toBe("/v4/spreadsheets/test-sheet-id-0123456789abcdef/values:batchGet");
    expect(url.searchParams.getAll("ranges")).toEqual([
      "'Products'!A1:Z5001",
      "'Categories'!A1:Z5001",
      "'Brands'!A1:Z5001",
    ]);
    expect(url.searchParams.get("valueRenderOption")).toBe("UNFORMATTED_VALUE");
    expect((call.init.headers as Record<string, string>).authorization).toBe(
      "Bearer ya29.test-access-token",
    );
    expect(sheetsCalls(http)).toHaveLength(1);
    const assertion = new URLSearchParams(String(http.requests[0].init.body)).get("assertion")!;
    expect(JSON.parse(Buffer.from(assertion.split(".")[1], "base64url").toString()).scope).toMatch(
      /readonly$/,
    );
  });

  it("retries 429 honouring Retry-After, then succeeds (quota handling)", async () => {
    const { http, client } = setup([
      json({ error: { message: "quota" } }, 429, { "retry-after": "2" }),
      json({ valueRanges: [{ values: [["x"]] }] }),
    ]);
    expect(await client.readWorksheets(["Products"])).toEqual({ Products: [["x"]] });
    expect(http.sleeps).toEqual([2000]);
  });

  it("retries 5xx with backoff and gives up after the retry budget", async () => {
    const { http, client } = setup([json({}, 503), json({}, 500), json({}, 502)]);
    const err = (await client
      .readWorksheets(["Products"])
      .catch((e: unknown) => e)) as SheetsApiError;
    expect(err).toBeInstanceOf(SheetsApiError);
    expect(err.status).toBe(502);
    expect(err.retryable).toBe(true);
    expect(sheetsCalls(http)).toHaveLength(3); // 1 + 2 retries
    expect(http.sleeps).toEqual([300, 600]); // exponential, jitter mocked to 0
  });

  it("exhausted quota is reported as retryable 429, not as an empty result", async () => {
    const { client } = setup([json({}, 429), json({}, 429), json({}, 429)]);
    const err = (await client
      .readWorksheets(["Products"])
      .catch((e: unknown) => e)) as SheetsApiError;
    expect(err).toBeInstanceOf(SheetsApiError);
    expect(err.status).toBe(429);
  });

  it("does not retry permanent client errors and explains how to fix access", async () => {
    const { http, client } = setup([
      json(
        { error: { status: "PERMISSION_DENIED", message: "The caller does not have permission" } },
        403,
      ),
    ]);
    const err = (await client
      .readWorksheets(["Products"])
      .catch((e: unknown) => e)) as SheetsApiError;
    expect(err.retryable).toBe(false);
    expect(err.detail).toMatch(/Share the spreadsheet with the service-account/);
    expect(sheetsCalls(http)).toHaveLength(1);
    expect(http.sleeps).toHaveLength(0);
  });

  it("maps 404 to an actionable configuration hint", async () => {
    const { client } = setup([
      json({ error: { message: "Requested entity was not found." } }, 404),
    ]);
    await expect(client.readWorksheets(["Products"])).rejects.toMatchObject({
      status: 404,
      detail: expect.stringContaining("GOOGLE_SHEET_ID"),
    });
  });

  it("maps a missing worksheet tab to a structure error naming the tab", async () => {
    const { client } = setup([
      json({ error: { message: "Unable to parse range: Brands!A1:Z5001" } }, 400),
    ]);
    const err = (await client
      .readWorksheets(["Products", "Brands"])
      .catch((e: unknown) => e)) as SheetsStructureError;
    expect(err).toBeInstanceOf(SheetsStructureError);
    expect(err.worksheet).toBe("Brands");
  });

  it("retries network errors and times out hung requests", async () => {
    const a = setup([new TypeError("fetch failed"), json({ valueRanges: [{ values: [["x"]] }] })]);
    expect(await a.client.readWorksheets(["Products"])).toEqual({ Products: [["x"]] });

    const res = await fetchWithPolicy(
      "https://example.test",
      {},
      { ...READ_POLICY, timeoutMs: 20, maxRetries: 0 },
      scriptedHttp([hang]).deps,
    ).catch((e: unknown) => e);
    expect(res).toBeInstanceOf(SheetsTimeoutError);
    expect((res as SheetsTimeoutError).retryable).toBe(true);
  });

  it("stops retrying when the total deadline would be exceeded", async () => {
    const http = scriptedHttp([json({}, 503), json({}, 503), json({}, 503)]);
    const err = await fetchWithPolicy(
      "https://example.test",
      {},
      { ...READ_POLICY, deadlineMs: 100, baseDelayMs: 500 },
      http.deps,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SheetsApiError);
    expect(http.requests).toHaveLength(1);
  });

  it("rejects malformed responses and oversized worksheets instead of truncating", async () => {
    await expect(
      setup([json({ unexpected: 1 })]).client.readWorksheets(["Products"]),
    ).rejects.toBeInstanceOf(SheetsApiError);
    const big = Array.from({ length: 5002 }, () => ["x"]);
    await expect(
      setup([json({ valueRanges: [{ values: big }] })]).client.readWorksheets(["Products"]),
    ).rejects.toBeInstanceOf(SheetsStructureError);
  });

  it("never puts credentials or tokens into error text", async () => {
    const { client } = setup([
      json({ error: { message: "boom" } }, 500),
      json({}, 500),
      json({}, 500),
    ]);
    const err = (await client.readWorksheets(["Products"]).catch((e: unknown) => e)) as Error;
    const text = JSON.stringify(err) + err.message + err.stack;
    expect(text).not.toContain("ya29.test-access-token");
    expect(text).not.toContain("PRIVATE KEY");
    expect(text).not.toContain(config.spreadsheetId);
  });
});

describe("writes", () => {
  it("updateCells sends only the listed cells with RAW input and the write-scope token", async () => {
    const { http, client } = setup([json({ totalUpdatedCells: 2 })]);
    await client.updateCells("Products", [
      { rowNumber: 5, columnIndex: 9, value: 123.5 },
      { rowNumber: 5, columnIndex: 16, value: "=HYPERLINK(1)" },
    ]);
    const [call] = sheetsCalls(http);
    expect(call.url).toContain("values:batchUpdate");
    const body = JSON.parse(String(call.init.body));
    expect(body.valueInputOption).toBe("RAW"); // text is never parsed as a formula
    expect(body.data).toEqual([
      { range: "'Products'!J5", majorDimension: "ROWS", values: [[123.5]] },
      { range: "'Products'!Q5", majorDimension: "ROWS", values: [["=HYPERLINK(1)"]] },
    ]);
    const assertion = new URLSearchParams(String(http.requests[0].init.body)).get("assertion")!;
    expect(
      JSON.parse(Buffer.from(assertion.split(".")[1], "base64url").toString()).scope,
    ).not.toMatch(/readonly/);
  });

  it("updateCells is retried (idempotent) and must be confirmed", async () => {
    const a = setup([json({}, 503), json({ totalUpdatedCells: 1 })]);
    await a.client.updateCells("Products", [{ rowNumber: 2, columnIndex: 0, value: "x" }]);
    expect(sheetsCalls(a.http)).toHaveLength(2);
    const b = setup([json({ totalUpdatedCells: 0 })]);
    await expect(
      b.client.updateCells("Products", [{ rowNumber: 2, columnIndex: 0, value: "x" }]),
    ).rejects.toMatchObject({ detail: expect.stringMatching(/did not confirm/i) });
  });

  it("appendRow is NOT retried on 5xx or timeouts (it may already have been applied)", async () => {
    const a = setup([json({}, 503)]);
    await expect(a.client.appendRow("Products", ["x"])).rejects.toBeInstanceOf(SheetsApiError);
    expect(sheetsCalls(a.http)).toHaveLength(1);
    const b = setup([new TypeError("socket hang up")]);
    await expect(b.client.appendRow("Products", ["x"])).rejects.toBeInstanceOf(SheetsApiError);
    expect(sheetsCalls(b.http)).toHaveLength(1);
  });

  it("appendRow retries 429 only and reports the new row number", async () => {
    const { http, client } = setup([
      json({}, 429),
      json({ updates: { updatedRange: "Products!A12:Q12", updatedRows: 1 } }),
    ]);
    expect(await client.appendRow("Products", ["x"])).toEqual({ rowNumber: 12 });
    expect(sheetsCalls(http)).toHaveLength(2);
    expect(sheetsCalls(http)[1].url).toContain("valueInputOption=RAW");
    expect(sheetsCalls(http)[1].url).toContain("insertDataOption=INSERT_ROWS");
  });
});

describe("read-only client", () => {
  it("exposes only readWorksheets (no write methods) and uses the read-only scope", async () => {
    const http = scriptedHttp([token, json({ valueRanges: [{ values: [["x"]] }] })]);
    const reader = createSheetsReader({
      config,
      deps: http.deps,
      tokens: createTokenProvider(config, http.deps),
    });
    expect(Object.keys(reader)).toEqual(["readWorksheets"]);
    expect(await reader.readWorksheets(["Products"])).toEqual({ Products: [["x"]] });
    const assertion = new URLSearchParams(String(http.requests[0].init.body)).get("assertion")!;
    expect(JSON.parse(Buffer.from(assertion.split(".")[1], "base64url").toString()).scope).toMatch(
      /readonly$/,
    );
  });
});

describe("helpers", () => {
  it("columnLetter maps 0-based indexes and rejects out-of-range", () => {
    expect([columnLetter(0), columnLetter(9), columnLetter(25)]).toEqual(["A", "J", "Z"]);
    expect(() => columnLetter(26)).toThrow(SheetsApiError);
    expect(() => columnLetter(-1)).toThrow(SheetsApiError);
  });
  it("parseRetryAfterMs caps and ignores HTTP-dates", () => {
    expect(parseRetryAfterMs("2", 4000)).toBe(2000);
    expect(parseRetryAfterMs("60", 4000)).toBe(4000);
    expect(parseRetryAfterMs("Wed, 21 Oct 2026 07:28:00 GMT", 4000)).toBeNull();
    expect(parseRetryAfterMs(null, 4000)).toBeNull();
    expect(APPEND_POLICY.retryStatuses).toEqual([429]);
  });
});
