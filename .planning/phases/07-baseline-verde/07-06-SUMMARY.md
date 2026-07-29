---
phase: 07-baseline-verde
plan: 06
subsystem: testing
tags: [vitest, testing-library, router, react-router, act-warnings, canvas-warnings]

# Dependency graph
requires:
  - phase: 07-01
    provides: "TestId derivado de TEST_REGISTRY + remoção do fallback `?? 'Estatística'` em EstatisticaPage.tsx — pré-condição para o heading em / nunca mais ser o literal 'Estatística'"
  - phase: 07-04
    provides: "12 dos 23 casos herdados do stepper reescritos para o idioma scroll"
  - phase: 07-05
    provides: "os 11 casos restantes reescritos — router.test.tsx ficou como a única falha remanescente da suíte, de causa distinta"
provides:
  - "router.test.tsx com landing route (D-04) e teste ativo padrão (D-10/D-12) asseverados em dois casos independentes"
  - "suíte inteira verde e silenciosa comprovada mecanicamente: 0 falhas, 0 skipped, 0 avisos de act(), 0 avisos de canvas"
affects: [07-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Landmark estrutural (#lacir-test-module-mount, data-active-test-id) em vez de heading copy para provar rota vs. comportamento padrão — duas queries que quebram de forma independente"

key-files:
  created: []
  modified:
    - src/app/router.test.tsx

key-decisions:
  - "D-09/D-12 implementadas: o caso único da linha 40 virou dois — (a) a rota renderiza EstatisticaPage via #lacir-test-module-mount + botão 'Qual teste usar?', sem depender de qual teste está ativo; (b) o teste ativo padrão é t-student via data-active-test-id e o heading 't de Student'"
  - "D-10 respeitada: nenhum arquivo de produção tocado nesta task — git diff --stat EstatisticaPage.tsx vazio"
  - "D-08 fechada por medição, não por correção: os 0 avisos de act()/canvas já estavam em 0 antes da Task 2 (efeito colateral das reescritas de 07-01 a 07-05) — nenhum arquivo além de router.test.tsx precisou de mudança"

requirements-completed: [QA-02, QA-03]

duration: ~8min
completed: 2026-07-29
---

# Phase 7 Plano 6: Baseline verde — router.test.tsx separado e suíte comprovadamente verde e silenciosa Summary

**`router.test.tsx` desdobrado em duas asserções independentes (rota via `#lacir-test-module-mount` × teste padrão via `data-active-test-id`/heading), fechando a 24ª e última falha da suíte; a suíte inteira sai em 681/681 passando, 0 skipped, 0 avisos de `act()` e 0 avisos de canvas, todos os quatro números medidos mecanicamente após a mudança, não assumidos.**

## Performance

- **Duração:** ~8 min
- **Tasks:** 2/2 completas
- **Arquivos modificados:** 1

## Accomplishments

- O caso quebrado `'renders the Estatística heading at / (landing route, D-04)'` foi substituído por dois casos:
  - `'renders the Estatística page at / (landing route, D-04)'` — prova a D-04 da Fase 1 (rota, não texto): `container.querySelector('#lacir-test-module-mount')` não é `null` e `screen.getByRole('button', { name: 'Qual teste usar?' })` está presente, ambos exclusivos de `EstatisticaPage`/`Sidebar` (confirmado em `Sidebar.test.tsx:114`), diferente do link "Estatística" do `Header` que aparece em toda rota.
  - `'defaults the active test to t-student at / (D-10/D-12)'` — prova o comportamento atual por duas vias que quebram juntas se o padrão mudar: `data-active-test-id` igual a `'t-student'` no mesmo nó, e o heading `'t de Student'`.
- `npx vitest run src/app/router.test.tsx` → 6/6 passando (5 casos originais intocados + 1 desdobrado em 2). Os critérios de aceite mecânicos da Task 1 (`grep -c "it("` = 6, `grep -c` do heading "Estatística" antigo = 0, `lacir-test-module-mount` ≥ 2, `data-active-test-id', 't-student'` = 1, `git diff --stat` de `EstatisticaPage.tsx` vazio) todos conferidos e batendo.
- Task 2 rodou a suíte inteira (`npx vitest run`, reporter padrão — `--reporter=basic` não existe mais no Vitest 4) e mediu as três contagens do ground truth **antes de tocar em qualquer outro arquivo**:
  - Falhas: **0** (681 testes passando em 97 arquivos — contra 1 falha / 679 passando no ground truth medido pelo orquestrador antes deste plano)
  - `was not wrapped in act`: **0** (contra 21 no ground truth original da fase)
  - `Not implemented: HTMLCanvasElement`: **0** (contra 190 no ground truth original da fase)

  Nenhum aviso residual de `act()` foi encontrado — a hipótese A2 de `07-RESEARCH.md` (a reescrita das ondas 3–5 elimina os avisos de `act()` sozinha, sem correção pontual) se confirmou por completo; **nenhum arquivo além de `router.test.tsx` precisou de mudança na Task 2.**
- Varredura de QA-03 em todo `src/`: `grep -rn "it.skip\|it.todo\|xit(\|describe.skip\|test.skip\|\.failing(" src` não retornou nenhuma linha — nenhum teste vermelho conhecido, pulado ou anotado em lugar nenhum do repositório.
- `npm run typecheck` → exit 0. `npm run test:run` → exit 0. `git diff --stat package-lock.json` vazio — zero dependência npm nova.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Separar landing route e teste padrão em router.test.tsx** - `d57518a` (test)
2. **Task 2: Provar suíte verde E silenciosa e eliminar avisos residuais de act()** - sem commit (nenhuma mudança de arquivo necessária — as três contagens já estavam em 0/0/0 antes desta task; verificação pura, documentada abaixo)

**Plan metadata:** commit final ao término desta execução (docs)

## Files Created/Modified

- `src/app/router.test.tsx` - o caso da linha 40 virou dois casos independentes (rota via landmark estrutural, teste padrão via `data-active-test-id`/heading); os outros 4 casos (meta-análise, variáveis, mapas, rota inexistente) permaneceram intocados

## Decisions Made

Nenhuma decisão nova além das já travadas em `07-CONTEXT.md` (D-08, D-09, D-10, D-12). A Task 1 seguiu exatamente os dois landmarks que `07-PATTERNS.md` já identificava como candidatos verificados (`#lacir-test-module-mount` e o botão "Qual teste usar?"), evitando explicitamente o link "Estatística" do `Header` por não distinguir rota.

A única constatação nova é empírica, não uma decisão: a Task 2 confirmou por medição — não por suposição — que o trabalho de D-08 já estava completo antes deste plano começar. O plano previa a possibilidade de precisar corrigir avisos de `act()` pontuais (causa: timer resolvendo depois da asserção, promessa de import dinâmico, callback de `ResizeObserver`); nenhum desses cenários se materializou.

## Deviations from Plan

None - o plano foi executado exatamente como escrito. A Task 2 não exigiu nenhuma correção porque as contagens de ruído já estavam zeradas (efeito colateral correto das reescritas de 07-01 a 07-05, como o próprio `phase_critical_notes` do orquestrador já sinalizava antes de despachar este plano).

## Issues Encountered

Nenhum.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- `npm run typecheck` → exit 0. `npx vitest run` → 681/681 passando, 0 skipped, 0 `.todo`. `npm run test:run` → exit 0.
- 0 avisos de `act()`, 0 avisos de canvas, 0 ocorrências de `it.skip`/`it.todo`/`xit(`/`describe.skip`/`test.skip`/`.failing(` em `src/` inteiro — D-08 e QA-03 fechadas por completo, comprovadas mecanicamente.
- `git diff --stat package-lock.json` vazio nos dois commits — zero dependência npm nova.
- SC#3 do ROADMAP da Fase 7 (suíte 100% verde, sem falha conhecida) está fechado. Resta apenas 07-07 (D-15 a D-18, o gate `npm run gate` + `.githooks/` + `.github/workflows/ci.yml`) para fechar a fase inteira.

---
*Phase: 07-baseline-verde*
*Completed: 2026-07-29*

## Self-Check: PASSED

Todos os arquivos declarados e todos os commits referenciados foram verificados presentes no working tree / git log:
- `src/app/router.test.tsx`, `.planning/phases/07-baseline-verde/07-06-SUMMARY.md` — FOUND
- `d57518a`, `3aa9658` — FOUND
