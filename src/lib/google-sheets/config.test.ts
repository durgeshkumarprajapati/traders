// @vitest-environment node
import { loadSheetsConfig, normalisePrivateKey } from "./config";
import { SheetsConfigError } from "./errors";
import { TEST_EMAIL, TEST_SHEET_ID, makeKeyPair } from "./test-utils";

const { privateKey } = makeKeyPair();
const escaped = privateKey.replace(/\n/g, "\\n");
const good = {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: TEST_EMAIL,
  GOOGLE_PRIVATE_KEY: escaped,
  GOOGLE_SHEET_ID: TEST_SHEET_ID,
};

describe("normalisePrivateKey", () => {
  it("accepts real newlines, literal \\n sequences and surrounding quotes", () => {
    expect(normalisePrivateKey(privateKey)).toBe(privateKey.trim());
    expect(normalisePrivateKey(escaped)).toBe(privateKey.trim());
    expect(normalisePrivateKey(`"${escaped}"`)).toBe(privateKey.trim());
    expect(normalisePrivateKey(`'${escaped}'`)).toBe(privateKey.trim());
  });
});

describe("loadSheetsConfig", () => {
  it("loads a valid configuration", () => {
    const c = loadSheetsConfig(good);
    expect(c).toMatchObject({
      clientEmail: TEST_EMAIL,
      spreadsheetId: TEST_SHEET_ID,
      priceHistoryEnabled: false,
    });
    expect(c.privateKey.startsWith("-----BEGIN PRIVATE KEY-----\n")).toBe(true);
    expect(
      loadSheetsConfig({ ...good, GOOGLE_SHEETS_PRICE_HISTORY: "true" }).priceHistoryEnabled,
    ).toBe(true);
  });

  it("reports missing variables by NAME only", () => {
    try {
      loadSheetsConfig({});
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(SheetsConfigError);
      expect((e as SheetsConfigError).missing).toEqual([
        "GOOGLE_SERVICE_ACCOUNT_EMAIL",
        "GOOGLE_PRIVATE_KEY",
        "GOOGLE_SHEET_ID",
      ]);
      expect((e as SheetsConfigError).publicMessage).toBe(
        "The product data source is not configured.",
      );
    }
  });

  it("flags invalid values by name and never echoes the values (secret protection)", () => {
    const secret = "SUPER-SECRET-NOT-A-PEM-VALUE";
    for (const bad of [
      { ...good, GOOGLE_PRIVATE_KEY: secret },
      { ...good, GOOGLE_SERVICE_ACCOUNT_EMAIL: "not-an-email" },
      { ...good, GOOGLE_SHEET_ID: "short" },
      { ...good, GOOGLE_SHEETS_PRICE_HISTORY: "maybe" },
    ]) {
      try {
        loadSheetsConfig(bad);
        expect.unreachable();
      } catch (e) {
        const err = e as SheetsConfigError;
        expect(err.invalid.length).toBe(1);
        const text = `${err.message} ${err.detail} ${JSON.stringify(err)}`;
        expect(text).not.toContain(secret);
        expect(text).not.toContain("not-an-email");
        expect(text).not.toContain("BEGIN PRIVATE KEY");
      }
    }
  });
});
