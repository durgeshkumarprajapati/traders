// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { toErrorResponse } from "@/lib/errors";
import {
  SheetsApiError,
  SheetsConfigError,
  SheetsConflictError,
  SheetsNotFoundError,
} from "@/lib/google-sheets/errors";
import { makeKeyPair } from "@/lib/google-sheets/test-utils";
import { logger } from "@/lib/logger";
import { SheetsValidationError } from "./write-errors";

const SRC = join(process.cwd(), "src");
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) =>
    statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)],
  );
const rel = (f: string) => relative(SRC, f).split(sep).join("/");
const files = walk(SRC).filter((f) => /\.(tsx?|css)$/.test(f));
const nonTest = files.filter((f) => !/\.test\.tsx?$/.test(f) && !/\/test-[a-z-]+\.tsx?$/.test(f));
const text = (f: string) => readFileSync(f, "utf8");

describe("credential boundaries", () => {
  it("no client component imports the Sheets library or the catalogue data layer", () => {
    const offenders = files
      .filter((f) => /^\s*["']use client["']/m.test(text(f)))
      .filter((f) => /from\s+["']@\/(lib\/google-sheets|features\/catalogue)\b/.test(text(f)));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("every credentialed module is marked server-only", () => {
    const mustBeServerOnly = [
      "lib/google-sheets/config.ts",
      "lib/google-sheets/client.ts",
      "lib/google-sheets/auth.ts",
      "lib/google-sheets/jwt.ts",
      "lib/google-sheets/http.ts",
      "features/catalogue/cache.ts",
      "features/catalogue/snapshot.ts",
      "features/catalogue/write.ts",
      "features/catalogue/invalidate.ts",
      "lib/env/server.ts",
    ];
    for (const f of mustBeServerOnly)
      expect(text(join(SRC, f)), f).toMatch(/^import "server-only";/m);
  });

  it("Google credentials are never exposed as public (NEXT_PUBLIC_) variables", () => {
    for (const f of nonTest) expect(text(f), rel(f)).not.toMatch(/NEXT_PUBLIC_GOOGLE/);
  });

  it("no spreadsheet id, private key or service-account address is hard-coded in source", () => {
    for (const f of nonTest) {
      const t = text(f);
      expect(t, rel(f)).not.toMatch(/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]{20,}/);
      expect(t, rel(f)).not.toMatch(/-----BEGIN (RSA )?PRIVATE KEY-----\s*[A-Za-z0-9+/=\n]{40,}/);
      expect(t, rel(f)).not.toMatch(/[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com/);
    }
  });

  const customerFacing = nonTest.filter(
    (f) =>
      (rel(f).startsWith("app/") &&
        !rel(f).startsWith("app/dev/") &&
        !rel(f).startsWith("app/admin/")) ||
      rel(f).startsWith("components/website/") ||
      rel(f).startsWith("components/common/"),
  );
  const imports = (f: string) => [...text(f).matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);

  it("customer-facing code reads catalogue data ONLY through features/catalogue/server (+ pure view/type modules)", () => {
    const forbidden =
      /^@\/(lib\/google-sheets|features\/catalogue\/(write|write-errors|cache|snapshot|invalidate|parse|schemas|constants))/;
    const offenders = customerFacing.flatMap((f) =>
      imports(f)
        .filter((i) => forbidden.test(i))
        .map((i) => `${rel(f)} → ${i}`),
    );
    expect(offenders).toEqual([]);
  });

  it("write functions and the Google client are not imported by anything except the catalogue layer and admin actions", () => {
    const owners = (needle: RegExp) =>
      nonTest
        .filter((f) => imports(f).some((i) => needle.test(i)))
        .map(rel)
        .filter((r) => !r.startsWith("lib/google-sheets/") && !r.startsWith("features/catalogue/"));
    expect(owners(/features\/catalogue\/write(-errors)?$/)).toEqual(["features/admin/actions.ts"]);
    expect(owners(/lib\/google-sheets\/(client|auth|jwt|http|config)$/)).toEqual([
      "app/dev/sheets/diagnostics.tsx",
    ]); // dev-only (404 in production)
  });

  it("only features/catalogue/server.ts reads the cached snapshot (one shared cache entry)", () => {
    const readers = nonTest
      .filter((f) => imports(f).some((i) => /catalogue\/cache$|^\.\/cache$/.test(i)))
      .map(rel);
    expect(readers.sort()).toEqual([
      "app/dev/sheets/diagnostics.tsx",
      "features/catalogue/server.ts",
    ]);
  });

  it("sample data is gone: nothing in the app imports test fixtures or the removed demo module", () => {
    expect(
      nonTest
        .filter((f) =>
          imports(f).some((i) => /test-fixtures|test-utils|test-catalogue|demo-data/.test(i)),
        )
        .map(rel),
    ).toEqual([]);
    expect(nonTest.map(rel)).not.toContain("features/products/demo-data.ts");
  });
});

describe("secrets never reach logs or HTTP responses", () => {
  const { privateKey } = makeKeyPair();
  const body = privateKey.split("\n")[1];

  it("logging an error chain that contains a private key redacts it (message, cause, and extra fields)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const cause = new Error(`parse failed for ${privateKey}`);
    const err = new SheetsApiError("Google error", 500, true, { cause });
    logger.error("sheets_snapshot_failed", {
      error: err,
      config: { clientEmail: "svc@test.example", privateKey, spreadsheetId: "abc" },
    });
    const out = String(spy.mock.calls.at(-1)?.[0]);
    expect(out).not.toContain(body);
    expect(out).not.toContain("BEGIN PRIVATE KEY");
    expect(out).toContain("Google error");
    spy.mockRestore();
  });

  it("logged tokens and assertions are redacted", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("x", {
      headers: { authorization: "Bearer ya29.secret-token" },
      assertion: "eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJ4In0.c2lnbmF0dXJl",
      note: "token=abc123",
    });
    const out = String(spy.mock.calls.at(-1)?.[0]);
    for (const s of ["ya29.secret-token", "eyJhbGci", "abc123"]) expect(out).not.toContain(s);
    spy.mockRestore();
  });

  it("HTTP error responses carry only a code and a generic message", async () => {
    const cases: [Error, number][] = [
      [new SheetsApiError(`Google denied access ${privateKey}`, 403, false), 502],
      [new SheetsConfigError(["GOOGLE_PRIVATE_KEY"], []), 500],
      [new SheetsConflictError("row 7 changed"), 409],
      [new SheetsNotFoundError('Product "p1"'), 404],
      [
        new SheetsValidationError([
          {
            worksheet: "Products",
            row: 2,
            column: "slug",
            severity: "error",
            code: "INVALID_FORMAT",
            message: "slug invalid",
          },
        ]),
        400,
      ],
    ];
    for (const [err, status] of cases) {
      const res = toErrorResponse(err);
      const json = await res.json();
      expect(res.status).toBe(status);
      expect(Object.keys(json.error).sort()).toEqual(["code", "message"]);
      expect(JSON.stringify(json)).not.toMatch(
        /BEGIN PRIVATE KEY|GOOGLE_PRIVATE_KEY|row 7|slug invalid|denied access/,
      );
    }
  });
});
