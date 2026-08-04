---
phase: 8
slug: taxonomia-can-nica-integridade
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-03
verified: 2026-08-03
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `08-RESEARCH.md` § Validation Architecture. All infrastructure facts marked **[VERIFIED]** there were confirmed against the live repo.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest `^4.1.10` — config lives in `vite.config.ts`, **not** a separate `vitest.config.ts` |
| **Config file** | `vite.config.ts` → `test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'], css: false, include: ['src/**/*.{test,spec}.{ts,tsx}'] }` |
| **Quick run command** | `npm run catalog:validate` |
| **Full suite command** | `npm run test:run` (= `catalog:validate && vitest run`) |
| **Phase gate** | `npm run gate` (= `test:run && build`) — already exists from Phase 7, nothing new to configure |
| **Estimated runtime** | `catalog:validate` ~seconds (no network, per D-09); full suite dominated by vitest |

### ⚠ Blocking constraint on test file placement

The confirmed `include` glob is `src/**/*.{test,spec}.{ts,tsx}`. **A `.test.mjs` placed in `scripts/catalog/` will not run under `vitest run`** — it will silently pass by never executing, which is precisely the failure mode this phase exists to eliminate.

Every vitest test for invariants A–F, including the D-24 pre-migration regression fixture, **must live under `src/`** (e.g. `src/features/catalog/` or `src/test/`), even when the function under test is imported from `scripts/catalog/validate.mjs`. Relative imports work across the two trees since both are ES modules.

---

## Sampling Rate

- **After every task commit:** `npm run catalog:validate` — on any change to `scripts/catalog/*.mjs` or to the data files (`diseases.json`, `rename-map.json`, `aliases.json`, `exclusions.json`)
- **After every plan wave:** `npm run test:run` (adds vitest, adds invariant F)
- **Before touching production:** the full D-02 local rehearsal — up → D-04 integrity check → down → verify return to initial state. **Manual, not part of the automated gate** (needs a populated local Postgres, which CI does not have)
- **Before `/gsd:verify-work`:** `npm run gate` green
- **Max feedback latency:** seconds for `catalog:validate`; the gate is the slow path

---

## Per-Task Verification Map

Task IDs are assigned by the planner. This is the requirement-level contract each task must inherit from.

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| TAX-01 | `id ↔ tabnetCode ↔ cid ↔ label` mutually consistent across the **331** agravos (330 `lista_morb` + `amputacao_mmii`, post-D-25) | unit — invariants A/D/E in `validate.mjs` | `npm run catalog:validate` | ❌ W0 |
| TAX-02 | Validation fails against the *real* bug (`avc`→163), run over the pre-migration taxonomy as a **fixture** (D-24) | unit — must live under `src/` | `npx vitest run` | ❌ W0 |
| TAX-03 | Exact row counts + referential integrity before/after | integration — against the D-02 local Postgres, never prod in CI | D-04 aggregate-sum SQL, run manually during rehearsal | ❌ W0 |
| TAX-04 | Migration reversible; rename cycles never violate PK | integration — `--down` script. **Mechanism already reproduced empirically** (RESEARCH §4.2) | same up/down migration pair, invoked in the rehearsal | ❌ W0 |
| TAX-05 | Alias resolves to the correct canonical ids | unit, pure — **algorithm and threshold already measured** (RESEARCH §6.2) | `npx vitest run` | ❌ W0 |
| TAX-06 | Derived artifacts byte-match the canonical source | unit — invariant B in `validate.mjs` | `npm run catalog:validate` | ❌ W0 |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Invariants **A, B, C, D, E** as new exported functions in `scripts/catalog/validate.mjs`, same mould as the existing `checkEntry`/`checkCatalog`. None exist today — current `validate.mjs` only covers `variables.json`/pack provenance from Phase 5
- [ ] Invariant **F** as a new vitest test under `src/` (e.g. `src/test/noTombstoneLiterals.test.ts`) walking `git ls-files`, with `rename-map.json` as the sole legitimate home for tombstone ids
- [ ] **Pre-migration taxonomy fixture** for TAX-02 / D-24 — decide format (minimal array of the 21 corrupted + a control sample, or a frozen full copy of today's `diseases.json`)
- [ ] `rename-map.json`, `exclusions.json`, `aliases.json` — none exist; format is planner's discretion. `exclusions.json` gets **331/332/333** (reason: data-quality marker, not a clinical category) and **not 330**, which now enters the taxonomy normally per D-25 once `/^todas/i` becomes `code === 'TODAS_AS_CATEGORIAS__'`. `extra-diseases.json` stays scoped to `amputacao_mmii` only
- [ ] D-04 integrity-check SQL (aggregate sums per disease × measure) — exists nowhere yet. The two-pass multi-CTE pattern is already validated by real reproduction (RESEARCH §4.2); what remains is instantiating it with the 21 real ids
- [ ] `supabase/` scaffold (`config.toml`, `migrations/`) — does not exist. Confirmed setup path: `supabase init` → `supabase link --project-ref hmfbxqemububjyhdckrj` (no DB password needed) → `supabase migration new <name>`
- [ ] **Docker must be running** for `supabase db dump` — the CLI runs `pg_dump` inside a `supabase/postgres:17.6.1.147` container rather than using the host binary. Docker Desktop was not running by default on this machine
- [ ] Pure alias-matching function — algorithm already measured and recommended (RESEARCH §6.2: 6-char floor + AND across query tokens); implementation outstanding

**Not required:** `supabase/functions/sih-ingest/` — D-07 audit is **closed** (RESEARCH §7). The function source was downloaded and contains no hardcoded disease id, so it is outside the contamination radius. Versioning it into the repo remains Phase 9 work.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration cost / lock profile at production volume (~1.13M rows) | TAX-03, TAX-04 | CI has no populated Postgres; measuring this requires a `pg_dump` restore of production volume. Deliberately not approximated during research | D-02 rehearsal: restore dump → time the up migration → run D-04 integrity check → run down → confirm return to initial state |
| Student finds "AVC" and reaches the correct canonical ids | TAX-05 | End-user search behavior in the live picker; automated component test (below) is a DOM-level proxy, not a substitute for eyes on the running app | Open Mapas → disease picker → type "avc" → confirm the 4 categories (177 Hemorragia intracraniana, 178 Infarto cerebral, 179 Acid vascular cerebr não espec hemorrág ou isquêm, 180 Outras doenças cerebrovasculares — broadened from 3 to 4 at the 08-07 human checkpoint) appear as normal selectable rows with the explanatory strip (D-18), and that the displayed label is always the official one (D-19). Repeat with "tvp", "ait" and "aterosclerose" (plan 08-09 Task 2 acceptance criteria). **Automated proxy exists as of 08-09:** `src/routes/mapas/MeasureDiseasePicker.test.tsx` (9 cases) renders the real component, types into the real search input via `userEvent`, and asserts the exact same behaviors (row count/labels sourced from `aliases.json`, strip text, checkbox → canonical id, D-19 label-identity across search paths) — but this is jsdom, not a human eyeballing the rendered UI in a browser. The literal browser click-through remains deferred to end-of-phase human_needed per this project's established pattern (Phase 4/5 did the same). |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or a declared Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ references above
- [ ] No watch-mode flags
- [ ] Every vitest file for invariants A–F lives under `src/` (see blocking constraint)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
