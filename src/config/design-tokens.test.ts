// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The Tailwind theme clears the default scales, so an unknown `text-*` / `rounded-*` / `font-*` class
 * silently generates NO CSS (the element then inherits). This guard fails on such classes.
 */
const SRC = join(process.cwd(), "src");
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) =>
    statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)],
  );
const tokens = readFileSync(join(SRC, "styles/tokens.css"), "utf8");
const defined = (prefix: string) =>
  new Set(
    [...tokens.matchAll(new RegExp(`--${prefix}-([a-z0-9-]+?)(?:--[a-z-]+)?:`, "g"))].map(
      (m) => m[1],
    ),
  );
const textSizes = defined("text");
const radii = new Set([...defined("radius"), "none"]);
const sources = walk(SRC).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));

// Colour utilities that legitimately share the `text-` prefix.
const TEXT_NON_SIZE =
  /^(left|right|center|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|\[)/;
const isColour = (name: string) =>
  /^(primary|secondary|accent|success|warning|error|info|surface|on-|border|current|transparent|inherit|white|black)/.test(
    name,
  );

describe("design tokens", () => {
  it("defines the type scale and radii this guard relies on", () => {
    expect(textSizes.has("body-md")).toBe(true);
    expect(textSizes.has("headline-lg-mobile")).toBe(true);
    expect(radii.has("lg")).toBe(true);
  });

  it("no source file uses a text-*, rounded-* or font-* class that has no token (the four known offenders and any new ones)", () => {
    const offenders: string[] = [];
    for (const f of sources) {
      const t = readFileSync(f, "utf8");
      for (const m of t.matchAll(
        /(?<![\w-])((?:[a-z-]+:)*)(text|rounded|font)-([a-z0-9-]+)(?![\w[-])/g,
      )) {
        const [, , kind, name] = m;
        const cls = `${kind}-${name}`;
        if (kind === "text") {
          if (TEXT_NON_SIZE.test(name) || isColour(name) || textSizes.has(name)) continue;
          offenders.push(`${f.replace(SRC, "src")}: ${cls}`);
        } else if (kind === "rounded") {
          const base = name.replace(/^(t|b|l|r|tl|tr|bl|br|s|e)(-|$)/, "");
          if (radii.has(name) || radii.has(base) || base === "") continue;
          offenders.push(`${f.replace(SRC, "src")}: ${cls}`);
        } else if (kind === "font") {
          if (/^(sans|mono|normal|medium|semibold|bold|extrabold|black|light|thin)$/.test(name))
            continue;
          offenders.push(`${f.replace(SRC, "src")}: ${cls}`);
        }
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });
});
