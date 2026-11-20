import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ── Design-system enforcement (see docs/DESIGN_SYSTEM.md) ───────────────────
// Colours come from tokens only: bg-primary, text-on-surface-variant, …
const OFF_PALETTE =
  "\\b(?:bg|text|border|ring|fill|stroke|outline|from|to|via|divide|shadow|accent|caret|decoration)-(?:\\[#|\\[rgb|\\[hsl|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d)";
// The palette is cleared, so these classes do not exist and would silently do nothing.
const BLACK_WHITE =
  "\\b(?:bg|text|border|ring|fill|stroke|outline|divide|accent|caret|decoration)-(?:black|white)\\b";
const BW_MESSAGE =
  "text-/bg-/border-white|black do not exist in this design system and silently do nothing. Use surface, on-surface, on-primary, on-secondary … tokens.";

// Inline styles: only runtime-dynamic geometry or CSS custom properties.
const DYNAMIC_STYLE_PROPS =
  "width|height|minWidth|maxWidth|minHeight|maxHeight|inlineSize|blockSize|transform";
const STYLE = "JSXAttribute[name.name='style']";

const noOffPalette = [
  "error",
  {
    selector: `Literal[value=/${OFF_PALETTE}/]`,
    message:
      "Use design-token colours (bg-primary, text-on-surface-variant …), not raw/default palette colours.",
  },
  {
    selector: `TemplateElement[value.raw=/${OFF_PALETTE}/]`,
    message: "Use design-token colours, not raw/default palette colours.",
  },
  { selector: `Literal[value=/${BLACK_WHITE}/]`, message: BW_MESSAGE },
  { selector: `TemplateElement[value.raw=/${BLACK_WHITE}/]`, message: BW_MESSAGE },
  { selector: "Literal[value=/\\bdark:/]", message: "Dark mode is not part of the design system." },
  // ── inline style: allowed only as a dynamic-value escape hatch ──
  {
    selector: `${STYLE} > Literal`,
    message: "style must be an object with runtime-dynamic values, not a string.",
  },
  {
    selector: `${STYLE} > JSXExpressionContainer > :not(ObjectExpression)`,
    message: "style must be an inline object literal so its keys can be checked.",
  },
  {
    selector: `${STYLE} ObjectExpression > SpreadElement`,
    message: "No spread in style; list the allowed properties explicitly.",
  },
  {
    selector: `${STYLE} ObjectExpression > Property[computed=true]`,
    message: "No computed keys in style.",
  },
  {
    selector: `${STYLE} ObjectExpression > Property[key.type='Identifier'][key.name!=/^(${DYNAMIC_STYLE_PROPS})$/]`,
    message: `Inline style is limited to runtime-dynamic geometry (${DYNAMIC_STYLE_PROPS.replaceAll("|", ", ")}) or CSS custom properties ('--name'). Use token utilities for everything else.`,
  },
  {
    selector: `${STYLE} ObjectExpression > Property[key.type='Literal'][key.value!=/^--/]`,
    message: "Quoted style keys must be CSS custom properties ('--name').",
  },
  {
    selector: `${STYLE} ObjectExpression > Property[value.type='Literal']`,
    message:
      "Static values belong in token utilities; style may only carry runtime-dynamic values.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { files: ["src/**/*.{ts,tsx}"], rules: { "no-restricted-syntax": noOffPalette } },
  // The rule tests need violating fixture strings.
  { files: ["src/lib/lint-rules.test.ts"], rules: { "no-restricted-syntax": "off" } },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
