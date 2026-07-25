---
phase: 01-redesign-base-react-shell
plan: 05
subsystem: ui
tags: [react-router, react-context, vitest, session-state, routing]

requires:
  - phase: 01-01
    provides: Vite/React/Tailwind v4 scaffold, shadcn primitives, vitest+jsdom harness
  - phase: 01-02
    provides: "@theme design tokens (--color-accent, --color-text-muted, radius/type scale), .lacir-header-grain and .lacir-route-enter first-party accents"
provides:
  - "src/shared/session/SessionProvider.tsx — typed in-memory SessionState/SessionApi context (dataset/datasusSession/mapSelection, derived hasData), replaces window.__LACIR_SHARED__"
  - "src/app/Header.tsx — NAV_ITEMS + sticky translucent header with logo lockup and 4 locked NavLinks, no badge, no DATASUS link"
  - "src/app/AppShell.tsx — Header + Outlet keyed on pathname for the route-entry fade"
  - "src/app/router.tsx — createBrowserRouter with /, /meta-analise, /variaveis, /mapas under AppShell + friendly errorElement"
  - "src/components/PlaceholderShell.tsx + EmptyState.tsx — shared 'Em breve' layout reused by Meta-análise/Variáveis"
  - "src/routes/estatistica/EstatisticaPage.tsx + src/routes/mapas/MapasPage.tsx — real two-region skeletons with stable mount points for later plans"
affects: [01-06, 01-07, 01-08, 01-09, 01-10, 01-11, 01-12]

tech-stack:
  added: []
  patterns:
    - "SessionProvider: hasData is derived on every render from dataset/datasusSession, never stored as its own useState slice, so it can never go stale"
    - "AppShell keys the <Outlet> wrapper on useLocation().pathname so .lacir-route-enter replays once per route change, not on every re-render"
    - "PlaceholderShell/EmptyState: one shared component owns the 'Em breve' copy so Meta-análise and Variáveis cannot drift apart"
    - "Route skeletons (EstatisticaPage/MapasPage) leave stable class-named empty <aside>/<section> mount points instead of placeholder copy a later plan must remember to delete"

key-files:
  created:
    - src/shared/session/SessionProvider.tsx
    - src/shared/session/SessionProvider.test.tsx
    - src/app/LogoLockup.tsx
    - src/app/Header.tsx
    - src/app/Header.test.tsx
    - src/app/AppShell.tsx
    - src/app/router.tsx
    - src/app/router.test.tsx
    - src/app/RouteError.tsx
    - src/components/EmptyState.tsx
    - src/components/PlaceholderShell.tsx
    - src/routes/meta-analise/MetaAnalisePage.tsx
    - src/routes/variaveis/VariaveisPage.tsx
    - src/routes/estatistica/EstatisticaPage.tsx
    - src/routes/mapas/MapasPage.tsx
  modified:
    - src/main.tsx
  deleted:
    - src/App.tsx
    - src/test/smoke.test.tsx

key-decisions:
  - "Added src/app/RouteError.tsx (not explicitly named in the plan's files_modified list) to implement the plan's own required errorElement (T-01-ROUTE mitigation) — Rule 2, a correctness requirement the plan's task action already mandated, just under an unnamed file"
  - "Deleted src/test/smoke.test.tsx entirely rather than repointing it at the router, since router.test.tsx already renders the full boot tree (SessionProvider + RouterProvider) and the plan requires 'exactly one boot-level test'"
  - "Storage-API spy test uses a single vi.spyOn(Storage.prototype, 'setItem') instead of separate localStorage/sessionStorage spies — both share the same prototype method in jsdom, so one spy covers both APIs without double-wrapping"

requirements-completed: [UI-01]

duration: ~30min
completed: 2026-07-25
---

# Phase 1 Plan 05: Header nav, router, four route shells, in-memory session Summary

**Ported the LACIR portal shell onto React Router's `createBrowserRouter`: a sticky teal-accented header with the four locked nav items (no badge, no DATASUS link), four real route shells with Estatística as the landing route, a shared "Em breve" placeholder for Meta-análise/Variáveis, and a typed in-memory `SessionProvider` that fully replaces `window.__LACIR_SHARED__`.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3 completed
- **Files modified:** 16 (14 created, 1 modified, 2 deleted)

## Accomplishments

- `SessionProvider`/`useSession` implement the exact `SessionState`/`SessionApi` contract from the plan's `<interfaces>` block; `hasData` is derived every render (never stored), `useSession` throws outside a provider, and a spy-based test proves zero `localStorage`/`sessionStorage` calls across every mutation path
- Zero occurrences of `window.__LACIR_SHARED__`, `localStorage`, or `sessionStorage` anywhere in non-test `src/`
- `Header` exports `NAV_ITEMS` and renders the four labels (`Estatística`, `Meta-análise`, `Variáveis`, `Mapas`) in locked order with correct accents; automated tests assert the header contains **no** badge/version text and **no** DATASUS link — the exact regression guard D-02/D-03 require
- Header carries the legacy sticky translucent chrome (`backdrop-filter: blur(20px) saturate(180%)` + `-webkit-` prefix) and the `.lacir-header-grain` first-party accent from plan 01-02
- `router.tsx` serves `/` (Estatística, D-04 landing), `/meta-analise`, `/variaveis`, `/mapas` under `AppShell`, with a Portuguese `errorElement` (`RouteError`) that also catches unknown paths — verified by a dedicated test rendering the fallback + "Voltar para Estatística" link instead of a blank page
- `PlaceholderShell` + `EmptyState` deliver the exact UI-SPEC "Em breve" copy, reused identically by `MetaAnalisePage` and `VariaveisPage` (D-06, no interactive controls)
- `EstatisticaPage` proves `useSession()` is reachable from the route (two-column skeleton with a stable `.lacir-sidebar` mount point for plan 01-07); `MapasPage` ships the matching two-panel skeleton (map ~60% / panel ~40%) for plan 01-09
- `main.tsx` now boots `<SessionProvider><RouterProvider router={router} /></SessionProvider>`; the 01-01 `App.tsx`/`smoke.test.tsx` placeholders are gone, leaving `router.test.tsx` as the sole boot-level test
- Full suite green: `npm run test:run` (11 files / 137 tests), `npm run typecheck` (clean), `npm run build` (exit 0)

## Task Commits

Each task was committed atomically:

1. **Task 1: In-memory session context replacing the legacy global** - `3c5829f` (feat)
2. **Task 2: LACIR header with logo lockup and the four locked nav items** - `d53bc30` (feat)
3. **Task 3: Router, four route shells, and app bootstrap** - `200d096` (feat)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `src/shared/session/SessionProvider.tsx` - `SessionProvider`, `useSession`, `SessionState`/`SessionApi`/`SessionDataset` types
- `src/shared/session/SessionProvider.test.tsx` - hasData derivation, clearSession, outside-provider throw, zero-storage-API spy tests
- `src/app/LogoLockup.tsx` - presentational logo + "LACIR"/"Bioestatística" wordmark (unmodified PNG, D-16)
- `src/app/Header.tsx` - `NAV_ITEMS`, sticky translucent header, active teal underline+text NavLink styling
- `src/app/Header.test.tsx` - label order/accents, nav accessible name, logo alt text, no-badge/no-DATASUS assertions
- `src/app/AppShell.tsx` - `<Header/>` + pathname-keyed `<Outlet/>` wrapper for the route-entry fade
- `src/app/router.tsx` - `createBrowserRouter` with the 4 routes + `errorElement`
- `src/app/router.test.tsx` - `createMemoryRouter` coverage of all 4 routes + unknown-path fallback
- `src/app/RouteError.tsx` - friendly Portuguese error/404 fallback with a link back to `/`
- `src/components/EmptyState.tsx` - heading/body/children empty-state shape
- `src/components/PlaceholderShell.tsx` - title + centered `EmptyState`, exact "Em breve" copy
- `src/routes/meta-analise/MetaAnalisePage.tsx`, `src/routes/variaveis/VariaveisPage.tsx` - thin `PlaceholderShell` wrappers
- `src/routes/estatistica/EstatisticaPage.tsx` - two-column skeleton, `useSession()` reachability proof
- `src/routes/mapas/MapasPage.tsx` - two-panel skeleton
- `src/main.tsx` - boots `SessionProvider` + `RouterProvider`
- `src/App.tsx`, `src/test/smoke.test.tsx` - deleted (superseded by the router/route pages and `router.test.tsx`)

## Decisions Made

- Added `RouteError.tsx` as its own file rather than inlining the fallback JSX into `router.tsx` — keeps the error boundary content testable in isolation and reusable if a future plan needs the same fallback elsewhere
- Kept `EstatisticaPage`'s `useSession()` proof-of-reachability as a `data-has-session-data` attribute on the empty `<section>` mount point rather than rendering visible text, since the plan explicitly says this route is a skeleton with "clearly marked mount points," not placeholder copy
- Gave `MapasPage` a visible `Display`-role "Mapas" heading (matching `EstatisticaPage`'s treatment) rather than a screen-reader-only heading, since the plan calls this "the same treatment" as Estatística and `router.test.tsx` asserts a visible heading

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `src/app/RouteError.tsx`**
- **Found during:** Task 3
- **Issue:** The plan's Task 3 action item 6 explicitly requires "an `errorElement` on the root route rendering a friendly Portuguese fallback and a link back to Estatística," but no file for this component was named in the plan's `files_modified` list
- **Fix:** Created `src/app/RouteError.tsx` as the `errorElement` component, imported by both `router.tsx` and `router.test.tsx`
- **Files modified:** `src/app/RouteError.tsx`, `src/app/router.tsx`, `src/app/router.test.tsx`
- **Verification:** `router.test.tsx`'s unknown-path test asserts the "Algo deu errado" heading and "Voltar para Estatística" link render instead of a blank page
- **Committed in:** `200d096` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — a file needed to satisfy a requirement the plan's own task text already mandated, just without naming the file explicitly).
**Impact on plan:** No scope creep — the component implements exactly what Task 3's action item already specified; it just needed its own file.

## Issues Encountered

- `vi.spyOn(window.localStorage, 'setItem')` failed in jsdom ("property not defined on the object") because `setItem` lives on `Storage.prototype`, not the instance. Fixed inline by spying on `Storage.prototype.setItem` once (shared by both `localStorage` and `sessionStorage` in jsdom) — resolved before the Task 1 commit, not a deviation from the plan's intent (the acceptance criterion "zero storage-API usage" is still fully covered).
- The `npm run dev` server started for the plan's manual human-check could not be reached via the available browser automation tool in this sandboxed session (no browser tab could be created). Confirmed via `curl` that the dev server serves the expected SPA shell; the visual click-through of all four nav items (dark background, teal active underline, route-entry fade, no full reload) is deferred to a human, consistent with how prior plans in this phase (e.g. 01-04's PNG pixel check) handled checks the automated harness cannot verify. All *automated* equivalents of this check (route content, landing route, error fallback) pass in `router.test.tsx`.
- A background `vite` dev server process from the manual-check attempt could not be killed from this sandboxed shell (same restriction noted in 01-01's summary) — harmless, ends when the session's sandbox is torn down, does not affect any committed state.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `useSession()` is live and consumable from every route; plan 01-06 (`useTabularInput`)/01-07 (Estatística sidebar+flow+modal) and 01-08 (DataSUS wizard) can call `setDataset`/`setDatasusSession`/`clearSession` directly
- `.lacir-sidebar` (Estatística) and `.lacir-mapas-map`/`.lacir-mapas-panel` (Mapas) are stable, named mount points ready for 01-07 and 01-09 to fill without restructuring the route shells
- `Header.test.tsx`'s no-badge/no-DATASUS assertions will fail loudly if a future change reintroduces either element, locking in D-02/D-03 structurally
- **Manual visual check deferred:** run `npm run dev`, confirm dark background + teal active underline, click all four nav items, confirm each renders its own layout with the route-entry fade and no full page reload (browser automation was unavailable in this session; all automated equivalents pass)
- No blockers

## Self-Check: PASSED

- All 15 created files verified present on disk (`[ -f ]` checks passed for every file in `key-files.created`)
- All 3 task commit hashes (`3c5829f`, `d53bc30`, `200d096`) verified in `git log --oneline`
- Re-ran every task's `<acceptance_criteria>`: `SessionProvider`/`useSession` shape matches `<interfaces>` exactly; `hasData` derived not stored; zero `__LACIR_SHARED__`/storage-API references in non-test `src` (grep count = 0); `useSession` throws outside a provider; `clearSession` resets all three slices; exactly four nav items in locked order with correct accents; no badge/version or DATASUS text/link in `Header`; active `NavLink` = teal underline + text with `end` on `/`; header sticky with blur/saturate chrome + grain class; logo renders `/logo-lacir.png` with `alt="Logo LACIR"`; all four routes resolve with `/` as landing; both placeholders share the exact "Em breve" copy; unknown path renders the friendly fallback; `main.tsx` wraps the router in `SessionProvider`; exactly one boot-level test file remains
- Re-ran plan-level `<verification>`: `npm run test:run` (11 files / 137 tests, all green), `npm run build` (exit 0, `dist/index.html` + hashed assets emitted)

---
*Phase: 01-redesign-base-react-shell*
*Completed: 2026-07-25*
