// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { brandColors } from "./brand";

const SRC = join(process.cwd(), "src");
const kebabToCamel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function cssColorTokens(): Record<string, string> {
  const css = readFileSync(join(SRC, "styles", "tokens.css"), "utf8");
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/^\s*--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/gm)) {
    out[kebabToCamel(m[1])] = m[2].toUpperCase();
  }
  return out;
}

describe("brand colour export parity with tokens.css", () => {
  it("has exactly the same colour names and values as tokens.css", () => {
    const fromCss = cssColorTokens();
    const fromTs = Object.fromEntries(
      Object.entries(brandColors).map(([k, v]) => [k, v.toUpperCase()]),
    );
    expect(Object.keys(fromCss).length).toBeGreaterThan(0);
    expect(fromTs).toEqual(fromCss);
  });

  it("detects divergence (self-check of the comparison)", () => {
    const fromCss = cssColorTokens();
    const tampered = { ...brandColors, primary: "#000001" } as Record<string, string>;
    expect(
      Object.fromEntries(Object.entries(tampered).map(([k, v]) => [k, v.toUpperCase()])),
    ).not.toEqual(fromCss);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("no hard-coded colours outside the token sources", () => {
  const allowed = new Set([join("styles", "tokens.css"), join("config", "brand.ts")]);
  const files = walk(SRC).filter(
    (f) =>
      /\.(tsx?|css|mdx?)$/.test(f) && !/\.test\.tsx?$/.test(f) && !allowed.has(relative(SRC, f)),
  );

  it("scans a non-trivial number of files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((f) => [relative(SRC, f).split(sep).join("/"), f]))("%s", (_name, file) => {
    const text = readFileSync(file, "utf8");
    const hex = text.match(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})\b/g);
    const fn = text.match(/\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\(/g);
    expect({ hex, fn }).toEqual({ hex: null, fn: null });
  });
});
