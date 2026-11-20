# Design System Audit (Phase 0)

Compared `sagar_traders_design_system.md` and the inline Tailwind config (identical in all 13 pages, hash-verified) with the HTML bodies.

## 1. Tokens: spec vs HTML config

The Tailwind config in every page matches the spec (colors, 16 type styles, spacing, radii, motion). **Findings:**

- Config sets `darkMode: 'class'` and exports `light-*` colors → remove; plan forbids dark mode.
- Config is Tailwind v3 JS format. Project uses **Tailwind 4.3** → must be converted to CSS `@theme` variables (`--text-*`, `--radius-*`, `--spacing-*`, `--ease-*`, `--duration-*`).
- Motion tokens: spec has three (`state-change` 120ms, `drawer-enter` 200ms ease-out, `drawer-exit` 150ms ease-in); the plan lists only 120ms.
- Shadow token exists only in prose (`0 4px 12px rgba(0,0,0,0.06)`, floating drawers/modals only).

### ⚠ Defects in the foundation I already created (`src/styles/tokens.css`)

That file was written from the plan summary before the spec was read. It is **incorrect** and must be replaced in Phase 1:

1. **Radius names are shifted.** Spec: `sm 4 / DEFAULT 6 / md 8 / lg 12 / full`. Mine: `sm 4 / md 6 / lg 8 / xl 12`. Stitch classes `rounded-md` (8px) and `rounded-lg` (12px) would render wrong.
2. Missing: typography scale, spacing tokens, `on-*` colors, `on-surface-variant #4B5563`, shadow, motion curves/durations, container (`max-w-7xl`, 260px sidebar).
3. Button/header/footer components use `text-foreground/70` opacity text rather than the specified `on-surface-variant` token.

## 2. Palette violations in the HTML (despite "no arbitrary colors")

Stitch body markup uses off-token Tailwind defaults extensively:

| Class family                                                                                                                                                                              | Count    | Where                             | Should map to                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------- | ------------------------------------------ |
| `text-gray-400/500/600/700`                                                                                                                                                               | ~370     | everywhere                        | `on-surface-variant #4B5563` (500/600/700) |
| `bg-green-100 / text-green-800`                                                                                                                                                           | 31/31    | status badges                     | `success` token tint                       |
| `bg-amber-500`, `bg-amber-100`, `text-amber-800`                                                                                                                                          | 31/12/16 | limited-stock / status            | `warning` / `secondary`                    |
| `bg-slate-800`                                                                                                                                                                            | 21       | buttons/badges (**dark surface**) | `primary`                                  |
| `bg-slate-200`                                                                                                                                                                            | 7        | avatar circle                     | `surface-muted`                            |
| `bg-red-50/100`, `bg-blue-50/100`, `text-blue-800`, `bg-purple-600`, `bg-blue-600`                                                                                                        | misc     | enquiry status dots/badges        | `error` / `info`; **purple has no token**  |
| Action: define tint tokens (`success-subtle`, `warning-subtle`, `error-subtle`, `info-subtle`) for approval, and a single status→token map. Purple for "Quotation Sent" needs a decision. |

## 3. Rule-by-rule check against plan "Mandatory implementation rules"

| Rule                          | Status                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One Inter family              | ✅ (plus Material Symbols icon font — deliberate exception, to be replaced by Lucide)                                                                                    |
| White backgrounds, black text | ⚠ Admin pages use `bg-surface-muted` body; homepage banner (line 642) is a full-navy `bg-primary` section; footer likely navy too. Needs explicit approval or correction |
| Navy/amber per palette        | ⚠ off-palette greens/blues/purple above                                                                                                                                  |
| One shared button             | ❌ buttons hand-styled per page (different heights `h-10/h-12`, `bg-slate-800` vs `bg-primary`)                                                                          |
| Shared form controls etc.     | ❌ none shared; Tailwind Forms plugin used                                                                                                                               |
| No arbitrary values           | ⚠ `min-h-[1024px]` on `<body>` (Stitch artefact)                                                                                                                         |
| Pills / rounded-full          | spec bans "cartoonish pills"; `rounded-full` used 2–5× per page for avatars/dots (acceptable for dots/avatars; verify badges)                                            |
| Dark mode                     | config present, but 0 `dark:` classes used                                                                                                                               |
| Gradients/blur                | none ✅                                                                                                                                                                  |

## 4. Responsive findings

Public pages are responsive. `admin_portal_login`, `admin_product_catalog`, `admin_enquiry_workflow` have **no** responsive classes; sidebar never collapses. Phase 8/9 needs mobile admin behaviour designed (drawer pattern exists in spec: `modal-drawer`).

## 5. Missing from the export

- `components/` sticker sheets (badge, button, card, input-field, modal, table, tabs) — referenced by the spec but **not supplied**. Phase 1 "convert every sticker sheet" cannot be completed exactly.
- Select, Notification (error/warning/info), Form-error, Loading, Empty, Error, Pagination, Breadcrumb, Timeline, Stat-card have no canonical sheet.
