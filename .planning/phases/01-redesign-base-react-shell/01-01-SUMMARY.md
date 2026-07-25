---
phase: 01-redesign-base-react-shell
plan: 01
subsystem: infra
tags: [vite, react19, typescript, tailwindv4, vitest, shadcn, radix]

requires: []
provides:
  - Vite 8 + React 19 + TypeScript + Tailwind v4 toolchain (dev/build/preview)
  - vitest + RTL + jsdom test harness with canvas getContext/toDataURL stubs
  - "@/ path alias (tsconfig paths + vite resolve.alias)"
  - "npm run typecheck / test:run / build commands every later plan's verify depends on"
  - shadcn/Radix primitives under src/components/ui (button, dialog, navigation-menu, sheet, badge, tabs, checkbox, tooltip, alert)
  - src/lib/utils.ts cn() helper
  - legacy/index.html preserved as v1.0 port reference
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10, 01-11, 01-12]

tech-stack:
  added: [react@19.2, react-dom@19.2, react-router-dom@7.18, tailwindcss@4.3, "@tailwindcss/vite@4.3", clsx, tailwind-merge, class-variance-authority, lucide-react, vite@8.1, "@vitejs/plugin-react@6.0", typescript@5.9, vitest@4.1, jsdom, "@testing-library/react", "@testing-library/jest-dom", "@testing-library/user-event", shadcn (CLI), radix-ui, tw-animate-css, "@fontsource-variable/geist"]
  patterns:
    - "shadcn components generated on the Radix component-library base (not the CLI's new Base UI default) to match UI-SPEC's Radix accessibility assumptions"
    - "tsc project references (tsconfig.json -> tsconfig.node.json) with emit redirected into node_modules/.tsbuild so `tsc -b` doesn't pollute the repo root"
    - "canvas getContext/toDataURL stubs in src/test/setup.ts detect-then-install (guarded), not blind overrides"

key-files:
  created:
    - vite.config.ts
    - tsconfig.json
    - tsconfig.node.json
    - index.html
    - legacy/index.html
    - src/main.tsx
    - src/App.tsx
    - src/index.css
    - src/test/setup.ts
    - src/test/smoke.test.tsx
    - public/logo-lacir.png
    - components.json
    - src/lib/utils.ts
    - src/components/ui/button.tsx
    - src/components/ui/dialog.tsx
    - src/components/ui/navigation-menu.tsx
    - src/components/ui/sheet.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/tabs.tsx
    - src/components/ui/checkbox.tsx
    - src/components/ui/tooltip.tsx
    - src/components/ui/alert.tsx
    - src/components/ui/primitives.test.tsx
  modified:
    - package.json
    - package-lock.json
    - .gitignore

key-decisions:
  - "Used @vitejs/plugin-react@^6.0 instead of the plan's ^4.5 pin — 4.x's peer range tops out at vite@^7, and vite@^8.1 (locked by the plan) requires plugin-react 6.x"
  - "shadcn CLI initialized with the 'nova' preset (Lucide icons + Geist font) and explicit -b radix, since the current CLI replaced the base-color init flag with a base-color-plus-interactive-preset flow and defaults new inits to Base UI, not Radix"
  - "Pulled the tailwind.config.js/postcss.config.js deletion forward from Task 3 into Task 2, since the Tailwind v4 build could not succeed while the dead v3 configs were still present (exactly 01-RESEARCH.md Pitfall 5)"

requirements-completed: [UI-01]

duration: 35min
completed: 2026-07-25
---

# Phase 1 Plan 1: Vite/React/Tailwind v4 scaffold + vitest harness + shadcn primitives Summary

**Re-platformed the repo root from a CDN-importmap vanilla-JS page onto a Vite 8 + React 19 + TypeScript + Tailwind v4 stack, stood up the vitest+RTL+jsdom test harness every later plan's automated verify depends on, and generated nine shadcn/Radix UI primitives — while deleting the dead purple Tailwind v3 scaffold entirely.**

## Performance

- **Duration:** 35 min
- **Tasks:** 2 (Task 1 — package legitimacy gate — was pre-approved by the human before this session)
- **Files modified:** 31 (16 in Task 2, 15 in Task 3)

## Accomplishments

- `npm run dev` now serves the React placeholder (`<h1>Bioestatística LACIR</h1>`) instead of the legacy vanilla page — verified by curling the dev server's HTML output
- `npm run test:run` is green: 2 test files, 5 tests (App smoke test + 3 primitives tests)
- `npm run build` produces a Vite bundle with zero Tailwind v3 config and zero CDN importmap
- Zero occurrences of `8B5CF6` (purple) or `cult-ui` anywhere in `src/`, `components.json`, or `index.html`
- `public/logo-lacir.png` is byte-identical to the source `logo lacir.png` (verified with `cmp`)
- All 9 shadcn primitives export exactly the names the plan's `<interfaces>` block promises to downstream plans

## Task Commits

1. **Task 2: Scaffold Vite + React + TS + Tailwind v4 toolchain + vitest harness** — `e1786dc` (feat)
2. **Task 3: Generate shadcn primitives (Radix) + delete purple v3 scaffold** — `8705ffa` (feat)

_Task 1 (package legitimacy gate) required no commit — it was a read-only human-verify checkpoint, pre-approved before this session started._

## Files Created/Modified

- `vite.config.ts` — react() + @tailwindcss/vite plugins, `@` → `src` alias, vitest jsdom `test` block scoped to `src/**`
- `tsconfig.json` / `tsconfig.node.json` — strict mode, `@/*` path alias, project references with emit redirected to `node_modules/.tsbuild`
- `index.html` — new SPA entry (Sora + IBM Plex Mono, no importmap, no Inter)
- `legacy/index.html` — preserved v1.0 entry document as a port reference
- `src/main.tsx`, `src/App.tsx`, `src/index.css` — placeholder boot + dark background so it's not white-on-white
- `src/test/setup.ts` — jest-dom matchers, RTL cleanup, guarded canvas `getContext`/`toDataURL` stubs
- `src/test/smoke.test.tsx` — renders `<App/>`, asserts heading + canvas stub
- `public/logo-lacir.png` — byte-identical copy of the brand mark
- `components.json` — shadcn config: style `radix-nova`, base color `neutral`, CSS variables on, `--radius: 0.75rem`
- `src/lib/utils.ts` — `cn()` (clsx + tailwind-merge)
- `src/components/ui/{button,dialog,navigation-menu,sheet,badge,tabs,checkbox,tooltip,alert}.tsx` — shadcn/Radix primitives
- `src/components/ui/primitives.test.tsx` — renders Button/Badge/open-Dialog to fail fast on a future renamed export
- `package.json` — new scripts (`test`, `test:run`, `typecheck`, `build: tsc -b && vite build`) and full Phase 1 dependency set
- `.gitignore` — added `*.tsbuildinfo`

## Decisions Made

- **`@vitejs/plugin-react@^6.0` instead of the plan's `^4.5`:** the plan pinned `vite@^8.1` + `@vitejs/plugin-react@^4.5`, but the published 4.x line's peer range only goes up to `vite@^7`; the plugin's own major version 6 is what supports `vite@^8`. Installing `^4.5` as specified would have produced a broken `npm install` (ERESOLVE). This is the same package, just the version that's actually compatible with the plan's own vite pin — not a substitution.
- **shadcn CLI `-b radix` re-init:** the CLI (`shadcn@4.14.1`) no longer accepts a base-color flag the way 01-RESEARCH.md documented (`-b neutral` errored: "Invalid enum value... received 'neutral'"). The modern CLI's `-b` selects the *component base library* (`radix` | `base` | `aria`) and requires an interactive (or `-p`) preset pick. The first successful init (`-t vite -p nova`) defaulted to Base UI (`@base-ui/react`), which conflicts with 01-UI-SPEC.md's explicit Radix accessibility assumptions (focus trapping, `Escape` handling documented as "Radix's default behavior"). Re-ran with `-b radix -p nova --reinstall -f` to get Radix-backed primitives (`components.json` style: `radix-nova`), then removed the now-unused `@base-ui/react` dependency.
- **Pulled `tailwind.config.js`/`postcss.config.js` deletion into Task 2:** Task 2's own verify step (`npm run build`) failed with "Cannot find module 'autoprefixer'" because the old `postcss.config.js` was still present and PostCSS-loading conflicted with the new `@tailwindcss/vite` plugin. Deleted both dead v3 files (Task 3's step 5) immediately rather than leaving Task 2 broken — documented here since it technically executes a later task's action early.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@vitejs/plugin-react@^4.5` is incompatible with `vite@^8.1`**
- **Found during:** Task 2 (dependency install)
- **Issue:** `npm install` failed with ERESOLVE — `@vitejs/plugin-react@4.7.0`'s peer range (`^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0`) doesn't include `vite@8`
- **Fix:** Installed `@vitejs/plugin-react@^6.0` (peer: `vite: ^8.0.0`) instead of the plan's `^4.5`
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npm install` succeeded; `npm run dev`/`build` both work with the plugin active
- **Committed in:** `e1786dc`

**2. [Rule 1 - Bug] `tsconfig.node.json` composite project emitted compiled JS into the repo root**
- **Found during:** Task 2 (tsconfig authoring)
- **Issue:** `composite: true` (required for the project reference from `tsconfig.json`) cannot coexist with `noEmit: true` (TS6310); removing `noEmit` caused `tsc -b` to emit `vite.config.js`/`vite.config.d.ts`/`*.tsbuildinfo` next to `vite.config.ts`
- **Fix:** Added `outDir`/`tsBuildInfoFile` pointing into `node_modules/.tsbuild/` for both `tsconfig.json` and `tsconfig.node.json`; added `*.tsbuildinfo` to `.gitignore` as a safety net
- **Files modified:** `tsconfig.json`, `tsconfig.node.json`, `.gitignore`
- **Verification:** `npm run build` no longer leaves any generated file outside `dist/` or `node_modules/`
- **Committed in:** `e1786dc`

**3. [Rule 1 - Bug] Canvas `toDataURL` stub-detection never installed the stub**
- **Found during:** Task 2 (smoke test)
- **Issue:** jsdom's real `toDataURL` doesn't throw (it logs "Not implemented" and returns `null`); the original detection logic used try/catch only, so it never triggered the stub and the smoke test's canvas assertion failed
- **Fix:** Changed detection to check the *returned value* (`typeof result !== 'string' || !result.startsWith('data:')`) instead of relying solely on an exception
- **Files modified:** `src/test/setup.ts`
- **Verification:** `npx vitest run src/test/smoke.test.tsx` passes (both assertions)
- **Committed in:** `e1786dc`

**4. [Rule 3 - Blocking] Dead Tailwind v3 configs broke the Tailwind v4 build**
- **Found during:** Task 2 (`npm run build` verify)
- **Issue:** `postcss.config.js` (referencing `autoprefixer`, not a dependency) caused `vite build` to fail loading the CSS pipeline, since `@tailwindcss/vite` doesn't need PostCSS at all
- **Fix:** Deleted `tailwind.config.js` and `postcss.config.js` (this is Task 3 step 5, executed early since Task 2's own verify gate required it)
- **Files modified:** deleted `tailwind.config.js`, `postcss.config.js`
- **Verification:** `npm run build` succeeds; `grep -rn '8b5cf6' src components.json index.html` returns no matches
- **Committed in:** `e1786dc`

**5. [Rule 4-adjacent, resolved without architectural change] shadcn CLI defaulted to Base UI instead of Radix**
- **Found during:** Task 3 (shadcn init)
- **Issue:** `npx shadcn@latest init -y -t vite -p nova` (the only non-interactive path the current CLI accepts without a base-color flag) silently defaulted to the `base` component library (`@base-ui/react`), not Radix — 01-UI-SPEC.md's Accessibility section explicitly documents modal focus-trap/`Escape` behavior as "Radix's default behavior"
- **Fix:** Re-ran `npx shadcn@latest init -y -f --reinstall -t vite -b radix -p nova`, confirmed `components.json` now reads `"style": "radix-nova"` and `button.tsx` imports from `radix-ui`, then removed the now-unused `@base-ui/react` dependency
- **Files modified:** `components.json`, `src/components/ui/button.tsx`, `package.json`, `package-lock.json`
- **Verification:** `grep -rn "@base-ui" src/` returns no matches; all 9 primitives import from `radix-ui`
- **Committed in:** `8705ffa`

---

**Total deviations:** 5 auto-fixed (2 blocking/version-drift, 2 bugs, 1 CLI-default correction to match the design contract). **Impact:** All auto-fixes were necessary for the toolchain to build/typecheck at all, or to keep the shadcn primitives on the accessibility base (Radix) the UI-SPEC assumes. No scope creep — no new features, no architectural changes beyond swapping a package's pinned version/preset flag to one that actually resolves.

## Issues Encountered

- **`npm audit` reports 2 high-severity findings** for `react-router` (GHSA-qwww-vcr4-c8h2, "RSC Mode CSRF Bypass"). This app is a pure client SPA using `createBrowserRouter` — it never uses React Router's RSC/Server Components mode — so the advisory's attack surface does not apply here. The suggested fix (`npm audit fix --force`) would downgrade `react-router-dom` below the plan's pinned `^7.18`, so it was left as-is. Flagging for awareness; no action taken.
- The dev server started for the plan-level `npm run dev` verification (confirming it serves the React shell, not the legacy page) could not be killed from this sandboxed shell (`kill`/`pkill` both denied — sandbox process-management restriction). It is a harmless background `vite` process on port 5183 that does not affect any committed state; it will end when this session's sandbox is torn down.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The toolchain, path alias, test harness, and shadcn/Radix primitive set are all in place and green (`typecheck`, `test:run`, `build` all pass) — 01-02 (dark+teal token layer) can proceed immediately.
- `src/index.css` currently has the shadcn-generated light/dark OKLCH variable set (from the `nova` preset) plus the plan's temporary dark placeholder `body` background — 01-02 is expected to replace/extend this with the locked D-16 teal token set and `app/theme.css` import, per its own plan.
- No blockers. The `npm audit` react-router advisory (RSC-only, not applicable to this SPA) and the harmless stray dev-server process are noted above for awareness, not as blockers.

## Self-Check: PASSED

- All 23 key files verified present on disk (`[ -f ]` check)
- Both task commits (`e1786dc`, `8705ffa`) verified present in `git log`
- Re-ran plan-level `<verification>`: `npm run typecheck` (0 errors), `npm run test:run` (2 files / 5 tests passed), `npm run build` (exits 0, emits `dist/index.html` + hashed assets)
- Re-ran Task 2 + Task 3 `<acceptance_criteria>`: importmap/Inter grep = 0, `legacy/index.html` exists, `logo lacir.png` byte-identical to `public/logo-lacir.png`, `tailwind.config.js`/`postcss.config.js` absent, `8b5cf6`/`cult-ui` grep = 0 matches, all 9 primitive modules present under `src/components/ui/` with the export names fixed in `<interfaces>`

---
*Phase: 01-redesign-base-react-shell*
*Completed: 2026-07-25*
