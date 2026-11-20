# Foundation (Phase 2)

- Next.js 16 App Router, React 19, Tailwind 4, strict TypeScript, `cacheComponents` enabled.
- Tokens: `src/styles/tokens.css` — see `docs/DESIGN_SYSTEM.md`. UI library: `src/components/ui` — see `docs/COMPONENT_USAGE.md`.
- Route groups: `(website)` public pages; `admin/*` (auth added in Phase 7).
- Shared UI: `src/components/ui` (Button via cva), `common`, `website`, `admin`.
- Env: `src/lib/env/server.ts` (server-only, Zod) and `public.ts`. Copy `.env.example` to `.env.local`.
- Errors/logging: `src/lib/errors.ts` (`AppError`, `toErrorResponse`), `src/lib/logger.ts` (redacts secrets).
- Security headers: `next.config.ts`. CSP deferred to Phase 11.
- Tests: vitest + testing-library (`npm test`), config in `vitest.config.mts`. Prettier: `npm run format`.

Commands: `npm run dev | build | lint`, `npx tsc --noEmit`.

## Updates (foundation-fix batch, 2026-11-18)

- Brand colours for non-CSS uses: `src/config/brand.ts` (parity-tested against `tokens.css`; the only other place hex colours may appear).
- Logger redacts nested secrets and serialises `Error`/`cause` (`src/lib/logger.ts`); error boundaries log via `src/lib/use-log-error.ts`.
- Error handling: `app/error.tsx` and `app/global-error.tsx` use Next 16 `retry`; `app/admin/{error,loading,not-found}.tsx`.
- `/dev/components`: development only — the showcase is loaded behind a build-time `NODE_ENV` check and is absent from production output (route renders 404).
- Placeholder routes use `PlaceholderPage`/`placeholderMetadata` (`noindex`, visible notice). `/admin/categories` has Categories and Brands tabs; `/admin/brands` redirects to it.
- Accessibility: `SkipLink`, `NavLink` (`aria-current`), `<main id="main-content">`; `metadataBase` from `NEXT_PUBLIC_SITE_URL`; `engines.node >=22`.
- ESLint: restricted dynamic inline styles; hints for `text-white`/`bg-black`; tests in `src/lib/lint-rules.test.ts`.
