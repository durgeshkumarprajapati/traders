// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Content gate (docs/PROJECT_BLUEPRINT.md, risk R1): fails if Stitch demo data or unsupported
 * business claims leak into application source. Business facts must come from Business Settings
 * (Google Sheets), never from code. Test files are exempt (they may use fake numbers).
 */
const BANNED: Array<[RegExp, string]> = [
  [/98000\s?00000|98111\s?11111|98765\s?43210|98222\s?33333|98333\s?44444/, "demo phone number"],
  [/27AABCS0000A1Z5/i, "demo GSTIN"],
  // Phase 14: the visiting-card reference image's demonstration values must never reach the app.
  [/22AABCS0000A1Z5/i, "demo GSTIN (visiting-card reference)"],
  [/Plot 45-B|Raipur Bypass/i, "demo address (visiting-card reference)"],
  [/sagartraders-demo|sagartraders\.com/i, "demo email/domain"],
  [/admin123|admin@sagartraders/i, "demo credentials"],
  [/DEMO PROTOTYPE|\[Demo/i, "demo banner/label"],
  [/Plot 45-B|Industrial (Zone|Area), Bypass/i, "demo address"],
  [/Since 2008|450\+\s*MT|35,000\s*sq/i, "unverified business claim"],
  [/100%\s*Original|Certified Brands|Same-Day Site|Same-day delivery/i, "unverified claim"],
  [/within 30 minutes|IS 1489|Tamper[- ]Proof|tensile strength/i, "unverified claim"],
  [/Live Depot|Live Price Board/i, "'live' price claim"],
  [
    /UltraTech|Tata Tiscon|Jindal|Finolex|Ambuja|\bACC Cement|Siporex/i,
    "real brand name (dealership unverified)",
  ],
  [/lh3\.googleusercontent\.com/i, "temporary Stitch image URL"],
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const SRC = join(process.cwd(), "src");
const files = walk(SRC).filter((f) => /\.(tsx?|css|mdx?)$/.test(f) && !/\.test\.tsx?$/.test(f));

describe("demo-content gate", () => {
  it("scans the source tree", () => {
    expect(files.length).toBeGreaterThan(40);
  });
  it.each(files.map((f) => [relative(SRC, f).split(sep).join("/"), f]))("%s", (_n, file) => {
    const text = readFileSync(file, "utf8");
    const hits = BANNED.filter(([re]) => re.test(text)).map(([, why]) => why);
    expect(hits).toEqual([]);
  });
});
