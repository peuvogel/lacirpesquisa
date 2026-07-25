---
phase: 03-testes-classicos-glm-novos
plan: 05
subsystem: integration
tags: [registry-flip, wave-a, handoff, assumption-nudges, sidebar, qual-teste-modal]

requires:
  - phase: 03-testes-classicos-glm-novos
    plan: 02
    provides: qui-quadrado module
  - phase: 03-testes-classicos-glm-novos
    plan: 03
    provides: anova-tukey module
  - phase: 03-testes-classicos-glm-novos
    plan: 04
    provides: kruskal-dunn module
provides:
  - Wave A classical tests available in sidebar and Qual teste modal
  - EstatisticaPage static switch for three classical modules
  - ANOVA→Kruskal cross-handoff with recognizedColumns preservation
affects: [03-06, 03-07, 03-08, 03-09]

tech-stack:
  added: []
  patterns: [registry flip gate, EstatisticaHandoffState.recognizedColumns, isTestAvailable guard on handoff]

key-files:
  created: []
  modified:
    - src/features/tests/registry.ts
    - src/features/tests/registry.test.ts
    - src/routes/estatistica/EstatisticaPage.tsx
    - src/routes/estatistica/EstatisticaPage.test.tsx
    - src/routes/estatistica/Sidebar.test.tsx
    - src/routes/estatistica/QualTesteModal.test.tsx
    - src/features/tests/anova-tukey/AnovaTukeyTest.tsx
    - src/features/tests/kruskal-dunn/KruskalDunnTest.tsx

key-decisions:
  - "Wave A flip limited to qui-quadrado, anova-tukey, kruskal-dunn; GLM trio stays em-breve until 03-09"
  - "Cross-handoff passes recognizedColumns via onNavigateTest second arg, stored in EstatisticaPage state"
  - "KruskalDunnTest accepts handoffRecognizedColumns prop to pre-fill Configurar after ANOVA nudge"

requirements-completed: [TEST-04, TEST-05, TEST-06, UX-02]

duration: 3min
completed: 2026-07-25
---

# Phase 3 Plan 05: Wave A Integration Gate Summary

**Flipped registry for three classical tests, wired EstatisticaPage routes with ANOVA→Kruskal handoff preserving column roles, and extended sidebar/modal/page integration tests.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-07-25T21:33:00Z
- **Completed:** 2026-07-25T21:35:00Z
- **Tasks:** 2/2
- **Files modified:** 9

## Accomplishments

- Set `qui-quadrado`, `anova-tukey`, `kruskal-dunn` to `available` (7 total available entries)
- Extended `EstatisticaPage` static switch and `EstatisticaHandoffState.recognizedColumns`
- ANOVA nudge CTA handoffs to Kruskal with same desfecho/grupo column mapping
- Sidebar and Qual teste modal show Wave A tests as clickable with Disponível badge
- 48 Vitest cases green across registry, page, sidebar, modal, and module smoke tests

## Task Commits

1. **Task 1: Flip Wave A registry and extend registry tests** — `9007db9` (feat)
2. **Task 2: Wire EstatisticaPage, handoff, and UX-02 integration tests** — `5dbd274` (feat)

## Files Created/Modified

- `src/features/tests/registry.ts` — Wave A status flip
- `src/routes/estatistica/EstatisticaPage.tsx` — mount + handoff wiring
- `src/features/tests/anova-tukey/AnovaTukeyTest.tsx` — pass recognizedColumns on Kruskal CTA
- `src/features/tests/kruskal-dunn/KruskalDunnTest.tsx` — accept handoffRecognizedColumns
- Integration tests in `EstatisticaPage.test.tsx`, `Sidebar.test.tsx`, `QualTesteModal.test.tsx`

## Test Results

```
npm run test:run -- src/features/tests/registry.test.ts
→ 15 passed

npm run test:run -- src/routes/estatistica/EstatisticaPage.test.tsx src/routes/estatistica/Sidebar.test.tsx src/routes/estatistica/QualTesteModal.test.tsx src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx src/features/tests/anova-tukey/AnovaTukeyTest.test.tsx src/features/tests/kruskal-dunn/KruskalDunnTest.test.tsx
→ 33 passed
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: .planning/phases/03-testes-classicos-glm-novos/03-05-SUMMARY.md
- FOUND: commit 9007db9
- FOUND: commit 5dbd274
