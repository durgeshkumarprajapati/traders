# Design System (Phase 1)

Single source: `src/styles/tokens.css` (Tailwind 4 `@theme`). Spec: `sagar_traders_design_system.md`. Light theme only.

The default Tailwind colour palette, type scale, radii, shadows and fonts are **cleared**, so classes like `text-gray-500`, `bg-green-100`, `rounded-xl`, `text-sm` do not exist. ESLint additionally rejects raw/default palette colours, `dark:` variants and inline `style` props in `src/`.

## Colours

| Token (utility suffix)                         | Value                                        | Use                                                        |
| ---------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| `primary` / `on-primary`                       | #17365D / #FFFFFF                            | Brand navy: primary buttons, links, focus ring, active tab |
| `secondary` = `accent` / `on-secondary`        | #F5A623 / #000000                            | Amber: high-intent actions (Bulk Quote, WhatsApp)          |
| `success`, `warning`, `error`, `info` + `on-*` | #166534, #B45309, #B91C1C, #1D4ED8 / #FFFFFF | Status                                                     |
| `border`                                       | #E5E7EB                                      | Hairlines, input borders                                   |
| `surface` / `on-surface`                       | #FFFFFF / #000000                            | Page canvas and text                                       |
| `surface-muted`                                | #F5F6F8                                      | Table headers, hover, skeleton                             |
| `on-surface-variant`                           | #4B5563                                      | Secondary text                                             |

Opacity modifiers on tokens (`bg-primary/90` hover, `bg-on-surface/50` modal backdrop) derive from approved colours and add no new hues. No tint tokens were introduced (decision: no colours outside palette).

## Typography (Inter)

Utilities bundle size, line-height, weight and letter-spacing: `text-display-lg`, `-display-lg-mobile`, `headline-xl|lg|md|sm` (+ `-mobile` for xl/lg), `title-lg|md`, `body-lg|md|sm`, `label-lg|md|sm`. Use mobile variants below `md`, e.g. `text-headline-lg-mobile md:text-headline-xl`.

## Spacing, layout

`gutter-xs 4`, `-sm 8`, `-md 16`, `-lg 24`, `-xl 32`, `section-sm 32`, `-md 48`, `-lg 64`, `page-margin 24`, `sidebar 260` (e.g. `p-gutter-md`, `py-section-sm`, `w-sidebar`). Public container: `PageContainer` (`max-w-7xl`, 16/24/32px gutters). Breakpoints: Tailwind defaults (`sm 640`, `md 768`, `lg 1024`, `xl 1280`) — the Stitch pages use only these.

## Radii

`rounded-sm` 4 · `rounded` 6 (default) · `rounded-md` 8 · `rounded-lg` 12 · `rounded-full`. (Corrects the Phase-2 tokens, whose names were shifted.)

## Elevation

Hairline borders only. `shadow-overlay` (`0 4px 12px rgba(0,0,0,.06)`) is for modals/drawers/toasts **only**.

## Motion

Default transition 120ms `cubic-bezier(.4,0,.2,1)` (applies to all `transition-*` utilities). Drawer enter 200ms ease-out; exit 150ms ease-in (CSS vars `--duration-drawer-*`; exit animation not yet implemented). Respects `prefers-reduced-motion`.

## Known deviations / gaps

- Drawer exit animation not implemented (native `<dialog>` closes instantly).
- Sticker sheets, screenshots and logo were not supplied; see COMPONENT_USAGE for which components are reconstructed. No logo was invented — header/sidebar use a text wordmark placeholder.
- Spec says "no cartoonish pills": `rounded-full` is used only for count badges and status dots.
