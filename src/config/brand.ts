/**
 * Brand colours for NON-CSS uses only: Open Graph images, web-app manifest,
 * email/HTML notification templates, maps, charts. In components always use the
 * Tailwind token utilities (bg-primary, text-on-surface …) — never this file.
 *
 * Must mirror `src/styles/tokens.css`; `brand.test.ts` fails if they diverge.
 * This file and tokens.css are the only places hex colours may appear in `src/`.
 */
export const brandColors = {
  primary: "#17365D",
  onPrimary: "#FFFFFF",
  secondary: "#F5A623",
  onSecondary: "#000000",
  accent: "#F5A623",
  onAccent: "#000000",
  success: "#166534",
  onSuccess: "#FFFFFF",
  warning: "#B45309",
  onWarning: "#FFFFFF",
  error: "#B91C1C",
  onError: "#FFFFFF",
  info: "#1D4ED8",
  onInfo: "#FFFFFF",
  border: "#E5E7EB",
  surface: "#FFFFFF",
  onSurface: "#000000",
  surfaceMuted: "#F5F6F8",
  onSurfaceVariant: "#4B5563",
} as const;

export type BrandColorName = keyof typeof brandColors;
