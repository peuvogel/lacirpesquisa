---
phase: 01-redesign-base-react-shell
plan: 02
subsystem: design-system
tags: [tailwindv4, css, design-tokens, vitest]

requires: [01-01]
provides:
  - "src/app/theme.css: single-source LACIR @theme token block (dark surfaces, teal accent, destructive/warning, radius scale, Sora/IBM Plex Mono fonts, 4-size/2-weight type scale)"
  - "shadcn CSS variables in src/index.css remapped onto LACIR tokens (:root and .dark, since the app has no light/dark toggle)"
  - "Two first-party D-15 accent classes: .lacir-header-grain, .lacir-route-enter (both reduced-motion safe)"
  - "src/app/theme.contract.test.ts: automated regression guard for token presence + forbidden legacy hexes"
affects: [01-05, 01-06, 01-07, 01-08, 01-09, 01-10, 01-11, 01-12]

tech-stack:
  added: []
  patterns:
    - "Tailwind v4 @theme block in a dedicated src/app/theme.css, imported once into src/index.css right after the tailwindcss import"
    - "shadcn semantic vars (--background/--primary/--border/...) are aliases onto LACIR tokens, not independent color choices"
    - "First-party CSS accents (no third-party registry) live in a @layer components block inside theme.css"

key-files:
  created:
    - src/app/theme.css
    - src/app/theme.contract.test.ts
  modified:
    - src/index.css

key-decisions:
  - "Removed --color-accent / --color-border / --color-destructive from index.css's pre-existing shadcn @theme inline remap — those three Tailwind theme keys collide by name with LACIR's own theme.css tokens; leaving both in place created either a circular custom-property reference (--border <-> --color-border) or a silent override of the teal accent by the neutral shadcn hover-accent color"
  - "Set LACIR values directly on :root (not only .dark) — the app never toggles a `.dark` class, so a dark-only app must carry its dark values on the default (:root) scope or shadcn primitives render in shadcn's light OKLCH defaults"
  - "Removed the dead @fontsource-variable/geist CSS import and its --font-sans: 'Geist Variable' override, which silently clobbered the required Sora font stack"

requirements-completed: [UI-01]

duration: ~40min
completed: 2026-07-25
---

# Phase 1 Plan 2: Dark+teal theme tokens, fonts, first-party CSS accents Summary

**Authored the single Tailwind v4 `@theme` token file that drives every LACIR color/radius/font/type-scale value app-wide, remapped shadcn's CSS variables onto it so unmodified primitives render dark+teal with zero per-component overrides, shipped the two locked first-party D-15 accents (header grain + route-entry fade) with no `@cult-ui` dependency, and added an automated contract test that fails loudly if a token disappears or a legacy purple/green hex returns.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 2/2 complete
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `src/app/theme.css` declares all 22 required tokens from the plan's `<interfaces>` block (colors, radius, fonts, 4-size type scale) in one `@theme` block, plus the two first-party accent classes in a `@layer components` block
- `src/index.css` imports `theme.css` exactly once, immediately after `@import "tailwindcss"`
- shadcn `--primary`/`--ring` resolve to `#10b981`, `--background` resolves to `#0a0f0d`, verified in the compiled Tailwind output (`--color-accent:#10b981`, no `var()` indirection loop)
- `#8b5cf6` and `#22c55e` (any case) are absent from both `src/index.css` and `src/app/theme.css`, comment-stripped
- `src/app/theme.contract.test.ts` — 28 assertions (22 required-token checks + accent value + 2 forbidden-hex checks + 2 accent-class checks + reduced-motion check + font-weight check) — all pass; manually verified it fails with a token-naming failure message when a token is deleted, then restored
- `npm run build`, `npm run test:run` (7 files / 61 tests), and `npx vitest run src/app/theme.contract.test.ts` all green

## Task Commits

1. **Task 1: Author the LACIR token layer and wire it into the Tailwind entry** — `312fa92` (feat)
2. **Task 2: Add the two first-party D-15 accents and the token contract test** — `5e369e4` (feat)

## Files Created/Modified

- `src/app/theme.css` — the `@theme` block (surfaces, teal accent + soft/border variants, text/muted, destructive/warning, borders, radius-sm/md/lg, font-sans/font-mono, 4-size type scale + data register) and the `@layer components` block with `.lacir-header-grain` (static SVG `feTurbulence` grain clamped to ~4% alpha via `feColorMatrix`, layered under a soft teal radial wash, `pointer-events: none`) and `.lacir-route-enter` (`@keyframes lacirRouteEnter`, 220ms ease-out fade+slide, disabled under `prefers-reduced-motion: reduce`)
- `src/index.css` — added the `theme.css` import; rewrote `:root`/`.dark` to alias every shadcn semantic variable onto a LACIR token (`--background` → `--color-bg`, `--card`/`--popover` → `--color-surface`/`--color-elevated`, `--primary` → `--color-accent` with `--primary-foreground: #04120c`, `--muted-foreground` → `--color-text-muted`, `--border`/`--input` → `--color-border`, `--ring` → `--color-accent`, plus the `--sidebar-*` family); removed the dead Geist font import/override; replaced the temporary body background rule with a `@layer base` rule (`bg-background text-foreground`, `font-family: var(--font-sans)`, `font-size: var(--text-body)`, `color-scheme: dark`) and added an app-wide `:focus-visible` teal outline rule
- `src/app/theme.contract.test.ts` — new vitest file, reads both CSS files from disk, strips comments before every hex check

## Decisions Made

- **Dropped 3 lines from the pre-existing shadcn `@theme inline` remap (`--color-border`, `--color-destructive`, `--color-accent`), not just remapped shadcn's raw vars in `:root`/`.dark`.** These three Tailwind theme keys are also LACIR's own token names. Keeping both directions of the mapping created two distinct bugs, confirmed in the compiled output before the fix: (1) `--color-border`/`--border` referenced each other (`--border: var(--color-border)` in `:root`, `--color-border: var(--border)` in `@theme inline`), a genuine CSS custom-property cycle that resolves to the guaranteed-invalid value — this would have broken every `border-border`/`border-input` utility app-wide, including the global `* { @apply border-border }` reset; same pattern for `--destructive`. (2) `--color-accent` (not circular, but wrong) resolved to `var(--accent)` → `var(--color-elevated)` — the neutral shadcn hover-surface color — silently replacing the locked teal everywhere `bg-accent`/`text-accent`/`ring-accent` utilities would be used, which contradicts must-have truth #2 ("teal as the only accent"). Fix: theme.css already owns these three keys as literal values; the `@theme inline` block no longer redeclares them, so Tailwind's cascade has exactly one source for each.
- **`:root` carries the same values as `.dark`, not light-mode OKLCH grays.** `App.tsx`/`main.tsx` never toggle a `.dark` class on `<html>`, so with the original shadcn scaffold every shadcn primitive was actually rendering in the *light* palette (`--background: oklch(1 0 0)` = white) — the `.dark` block was dead code. Since 01-UI-SPEC.md specifies a dark-only app with no theme switcher, both blocks now carry identical LACIR-mapped values; `.dark` is kept (not deleted) as a harmless no-op in case a future plan adds a toggle.
- **Removed `@import "@fontsource-variable/geist"` and its `--font-sans: 'Geist Variable'` override from `index.css`.** This was the shadcn `nova` preset's default font, installed by 01-01. Its `@theme inline` override sat later in the cascade than `theme.css`'s `--font-sans: 'Sora', ...` and would have silently won, so `body` would have rendered in Geist despite the token file declaring Sora. The npm dependency itself (`package.json`) was left untouched — it's outside this plan's `files_modified` scope and removing an unused CSS import doesn't require an uninstall to be correct.
- **`--accent`/`--accent-foreground` (shadcn's generic hover-surface vars, distinct from LACIR's teal) point at `--color-elevated`, not teal.** No currently-generated shadcn primitive (`button`, `dialog`, `navigation-menu`, `sheet`, `badge`, `tabs`, `checkbox`, `tooltip`, `alert`) uses `bg-accent`/`text-accent-foreground`, so this has no visible effect yet, but keeps the door open for a future Radix component (e.g. `DropdownMenu`) to get a quiet neutral hover instead of an unintended teal fill — consistent with D-15's "teal marks meaningful state, not decoration."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Circular CSS custom-property reference between `--border`/`--color-border` and `--destructive`/`--color-destructive`**
- **Found during:** Task 1 (`npm run build` / compiled-CSS inspection)
- **Issue:** The plan's Task 1 step 4 says to remap shadcn vars "inside the existing `:root`/dark block," but the pre-existing `@theme inline` block (from 01-01's shadcn scaffold) *also* mapped `--color-border`/`--color-destructive` back onto `--border`/`--destructive`. Once `:root`'s `--border`/`--destructive` were pointed at `--color-border`/`--color-destructive` (the plan's own instruction), the two blocks referenced each other, an invalid CSS cycle.
- **Fix:** Removed the `--color-border: var(--border)` and `--color-destructive: var(--destructive)` lines from the `@theme inline` block; `theme.css`'s literal values are now the only source for those two Tailwind theme keys.
- **Files modified:** `src/index.css`
- **Verification:** Compiled CSS shows `--color-border:#ffffff14` (literal, from theme.css) and `--border:var(--color-border)` (resolves, no cycle) — confirmed by inspecting `dist/assets/*.css` before and after the fix.
- **Committed in:** `312fa92`

**2. [Rule 1 - Bug] `--color-accent` silently overridden by shadcn's neutral hover-accent, not teal**
- **Found during:** Task 1 (compiled-CSS inspection)
- **Issue:** Same root cause as #1 — the `@theme inline` block's `--color-accent: var(--accent)` came later in cascade order than `theme.css`'s `--color-accent: #10b981` and won, so `--primary`/`--ring` (which the plan explicitly requires to resolve to `#10b981`) would have actually resolved to the neutral elevated-surface color instead.
- **Fix:** Removed `--color-accent: var(--accent)` from the `@theme inline` block (kept `--color-accent-foreground`, which doesn't collide with any LACIR token name).
- **Files modified:** `src/index.css`
- **Verification:** Compiled CSS shows `--color-accent:#10b981` and `--primary:var(--color-accent)` resolving correctly; re-ran the plan's literal grep-based acceptance checks.
- **Committed in:** `312fa92`

**3. [Rule 1 - Bug] Dead `@fontsource-variable/geist` import overrode the required Sora font stack**
- **Found during:** Task 1 (reading the pre-existing `@theme inline` block before editing)
- **Issue:** `index.css` imported `@fontsource-variable/geist` and declared `--font-sans: 'Geist Variable', sans-serif` in the `@theme inline` block, positioned after `theme.css`'s import — this would have silently made `body` render in Geist despite the acceptance criteria requiring the Sora stack.
- **Fix:** Removed both the import and the `--font-sans`/`--font-heading` override lines.
- **Files modified:** `src/index.css`
- **Verification:** Compiled CSS's `body` rule shows `font-family:var(--font-sans)` resolving to the Sora stack from `theme.css`; no `Geist` font-face entries remain in the build output (bundle size dropped ~1.5kB gzip after removing the bundled woff2 files).
- **Committed in:** `312fa92`

**Total deviations:** 3 auto-fixed, all Rule 1 (bugs directly caused by the interaction between this plan's required shadcn remap and the pre-existing 01-01 scaffold). No scope creep, no architectural changes — all three are single-line-or-fewer removals from a file already in this plan's `files_modified` list.

## Issues Encountered

- **Concurrent sibling plan execution caused transient `npm run build` failures unrelated to this plan.** This repo is being executed with wave-based parallelization — other plans (01-03's `src/shared/data-input/parseTabular.ts`, 01-04's `src/shared/charts/`) were mid-edit in the same working tree while this plan ran, and their in-progress TypeScript errors made the full `tsc -b && vite build` pipeline fail intermittently. This plan's own contribution was verified independently via `npx vite build` (isolates the CSS/Tailwind compile step, which is all this plan touches) and `npx vitest run src/app/theme.contract.test.ts`, both green throughout. By the time of the final verification pass, the sibling plans had completed and `npm run build` / `npm run test:run` passed cleanly (61/61 tests). No files outside this plan's scope (`src/app/theme.css`, `src/index.css`, `src/app/theme.contract.test.ts`) were modified.
- **`@fontsource-variable/geist` remains an unused npm dependency in `package.json`.** Only its CSS import was removed (in-scope, `src/index.css`); uninstalling the package itself would touch `package.json`/`package-lock.json`, outside this plan's `files_modified`. Flagging for a future cleanup pass, not a blocker.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Every token name in this plan's `<interfaces>` block is live and consumable as a Tailwind utility (`bg-bg`, `bg-surface`, `bg-elevated`, `bg-accent`/`text-accent`/`ring-accent` → teal, `bg-destructive`, `bg-warning`, `rounded-sm/md/lg`, `font-sans`/`font-mono`, `text-label`/`text-body`/`text-heading`/`text-display`/`text-data`).
- shadcn primitives generated in 01-01 (`button`, `dialog`, `navigation-menu`, `sheet`, `badge`, `tabs`, `checkbox`, `tooltip`, `alert`) now inherit dark+teal automatically — no later plan needs a per-component color override to match 01-UI-SPEC.md.
- `.lacir-header-grain` is ready for `AppHeader` (01-05/01-06) to apply directly; `.lacir-route-enter` is ready for any route-content wrapper to apply on mount.
- `src/app/theme.contract.test.ts` will fail immediately (with the specific missing token named) if a later plan accidentally deletes or renames a required token — no manual visual check needed to catch that class of regression.
- No blockers for 01-03 onward.

## Self-Check: PASSED

- `[ -f src/app/theme.css ]` → FOUND
- `[ -f src/app/theme.contract.test.ts ]` → FOUND
- `git log --oneline --all | grep 312fa92` → FOUND
- `git log --oneline --all | grep 5e369e4` → FOUND
- Re-ran plan `<verification>`: `npx vitest run src/app/theme.contract.test.ts` (28/28 passed), `npm run build` (exit 0, emits `#10b981` and zero forbidden hexes in compiled CSS), `npm run test:run` (7 files / 61 tests, all green)
- Re-ran Task 1 + Task 2 `<acceptance_criteria>`: import count = 1, forbidden-hex grep = 0, `--primary`/`--ring` resolve to `#10b981` and `--background` resolves to `#0a0f0d` in compiled output, exactly two accent classes present, `prefers-reduced-motion` present, no disallowed font-weight found

---
*Phase: 01-redesign-base-react-shell*
*Completed: 2026-07-25*
