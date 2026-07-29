---
phase: 07-baseline-verde
plan: 05
subsystem: testing
tags: [vitest, testing-library, flow-helper, poisson, prais-winsten, qui-quadrado, demo]

# Dependency graph
requires:
  - phase: 07-02
    provides: "runToResultados(user) em src/test/flowHelpers.ts — idioma de 3 passos consumido por este plano"
  - phase: 07-03
    provides: "layout scroll único em FlowSteps — o botão/nav 'Configurar' e o aria-current='step' deixaram de existir em produção"
  - phase: 07-04
    provides: "padrão within(resultados) já demonstrado para escopar asserções de texto ambíguo sob o layout scroll"
provides:
  - "PoissonTest.test.tsx, PraisWinstenTest.test.tsx, QuiQuadradoTest.test.tsx, TesteDemo.test.tsx verdes no idioma scroll (11 casos, os 2 estruturais incluídos)"
  - "Os 23 casos herdados do stepper (07-04 + 07-05) estão reescritos; só router.test.tsx segue vermelho, de causa distinta (07-06)"
affects: [07-06, 07-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "runToResultados(user) captura o retorno (região Resultados) sempre que uma asserção de texto pode colidir com conteúdo homônimo em Dados e configuração, que no layout scroll nunca desmonta — escopar com within(resultados) em vez de afrouxar a asserção"
    - "Prova de carga sem chegar em Resultados: await screen.findByRole('button', { name: 'Analisar dados' }) quando o conteúdo checado vive dentro do próprio painel de configuração, não em resultsContent"

key-files:
  created: []
  modified:
    - src/features/tests/poisson/PoissonTest.test.tsx
    - src/features/tests/prais-winsten/PraisWinstenTest.test.tsx
    - src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx
    - src/routes/estatistica/demo/TesteDemo.test.tsx

key-decisions:
  - "D-06/D-07 aplicadas aos 11 casos: click 'Configurar' + aria-current='step' saíram; runToResultados(user) entrou nos casos que chegam em Resultados"
  - "Poisson: os casos de nudge de superdispersão e de CTA para Binomial Negativa usam runToResultados, não apenas findByRole('Analisar dados') — confirmado por leitura de PoissonTest.tsx que AssumptionNudgeStrip só monta dentro de resultsContent, exigindo confirmedDataset"
  - "Prais-Winsten: o caso 'shows series preview on Configurar' NÃO usa o helper — SeriesPreviewTable e o botão 'Analisar dados' vivem dentro de PraisWinstenConfigPanel, que monta assim que loadedInput existe, antes de qualquer confirmação; a prova de carga é findByRole('Analisar dados')"
  - "Os dois casos de soft reset (Poisson, Qui-Quadrado) perderam o segundo click em 'Configurar' — a seção 'Dados e configuração' nunca desmonta no layout scroll, então o <select> de papel de coluna já está na tela; a asserção 'Modo alterado.' foi preservada verbatim (T-07-05-02)"
  - "TesteDemo 'keeps Resultados locked until a dataset is confirmed' traduzido por ausência de região: expect(screen.queryByRole('region', { name: 'Resultados' })).not.toBeInTheDocument() — não usa o helper, prova exatamente 'travado' no layout scroll (T-07-05-01)"
  - "[Achado durante verificação] QuiQuadradoTest 'Pressupostos' ficou ambíguo sob o layout scroll: o texto aparece tanto no título do card didático dentro da seção configurar (sempre montada) quanto em AssumptionNudgeStrip dentro de Resultados. Corrigido capturando o retorno de runToResultados e escopando com within(resultados).getByText('Pressupostos') — mesmo gotcha documentado em 07-04-SUMMARY.md, reincidente em arquivo diferente"

patterns-established:
  - "Quando o layout scroll expõe uma ambiguidade de texto entre a seção de configuração (que nunca desmonta) e Resultados, a correção é sempre escopar com within(resultados), nunca afrouxar/remover a asserção (QA-03) — segundo caso confirmado desta natureza na fase, após o de BinomialNegativaTest em 07-04"

requirements-completed: [QA-02]

duration: ~10min
completed: 2026-07-29
---

# Phase 7 Plano 5: Baseline verde — reescrita de Poisson/Prais-Winsten/Qui-Quadrado/TesteDemo para o idioma scroll Summary

**Os 11 casos restantes dirigindo o fluxo pela nav do stepper foram reescritos para `runToResultados(user)` (`@/test/flowHelpers`), incluindo os dois casos estruturais que o helper deliberadamente não cobre — o soft reset do Poisson/Qui-Quadrado sem clique de nav e o "Resultados travado" do TesteDemo por ausência de região — fechando SC#3: só `router.test.tsx` segue vermelho, de causa distinta.**

## Performance

- **Duração:** ~10 min
- **Tasks:** 2/2 completas
- **Arquivos modificados:** 4

## Accomplishments

- `PoissonTest.test.tsx`: os 4 casos convergem para `runToResultados(user)`. Confirmado por leitura de `PoissonTest.tsx` que `AssumptionNudgeStrip` só monta dentro de `resultsContent` (exige `confirmedDataset` e `loadedInput`) — por isso os casos de nudge de superdispersão e de CTA para Binomial Negativa também usam o helper, não apenas a espera pelo botão "Analisar dados". O caso de soft reset perdeu o segundo `click('Configurar')`; a asserção `'Modo alterado.'` sobreviveu intacta.
- `PraisWinstenTest.test.tsx`: os 3 casos reescritos. O caso `'shows series preview on Configurar after Usar exemplo'` foi o único dos 11 que **não** usa `runToResultados` — confirmado por leitura de `PraisWinstenConfigPanel.tsx` que `SeriesPreviewTable` e o botão "Analisar dados" vivem dentro do próprio painel de configuração, montado assim que `loadedInput` existe, antes de qualquer confirmação. A prova de carga virou `await screen.findByRole('button', { name: 'Analisar dados' })`.
- `QuiQuadradoTest.test.tsx`: os 2 casos reescritos, incluindo o soft reset (mesmo padrão do Poisson — segundo clique em "Configurar" removido).
- **Achado durante a verificação (não estava no plano):** o caso `'runs exemplo flow...'` de `QuiQuadradoTest` quebrou com `Found multiple elements` na asserção `screen.getByText('Pressupostos')` — o texto aparece tanto no título do card didático dentro de "Dados e configuração" (seção que nunca desmonta no layout scroll) quanto no `AlertTitle` de `AssumptionNudgeStrip` dentro de Resultados. Corrigido capturando o retorno de `runToResultados(user)` e escopando com `within(resultados).getByText('Pressupostos')` — mesma classe de ambiguidade já documentada em `07-04-SUMMARY.md` para `BinomialNegativaTest`, reincidente aqui em arquivo diferente (ver Deviations).
- `TesteDemo.test.tsx`: o caso `'keeps Resultados locked until a dataset is confirmed'` foi traduzido por ausência de região (`expect(screen.queryByRole('region', { name: 'Resultados' })).not.toBeInTheDocument()`), sem usar o helper — é a tradução fiel de "travado" no layout scroll, onde não existe mais botão desabilitado. O caso `'loads sample data...'` passou a usar `runToResultados(user)`. O caso `'exposes both Dados input modes'` não foi tocado (já passava).
- `npx vitest run` sobre os 4 arquivos: 11/11 verdes (mais o caso já verde do demo = 12 no total do escopo do plano).
- `npx vitest run` inteiro: **679 passando / 1 falhando (680 total)** — a única falha restante é `src/app/router.test.tsx`, de causa distinta (D-09), owned por 07-06. Confirmado que nenhum dos 4 arquivos deste plano aparece na lista de falhas.
- `npm run typecheck` → exit 0.
- 0 ocorrências de `Not implemented: HTMLCanvasElement` e 0 avisos de `act(...)` na suíte inteira — D-08 permanece fechada; os últimos avisos de `act(...)` que restavam nos arquivos deste plano desapareceram junto com a reescrita.
- `git diff --stat package-lock.json` vazio nos dois commits — zero dependência npm nova.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Reescrever PoissonTest.test.tsx (4 casos, inclui o soft reset) e PraisWinstenTest.test.tsx** - `32fcdbf` (test)
2. **Task 2: Reescrever QuiQuadradoTest.test.tsx e TesteDemo.test.tsx (inclui o caso 'Resultados travado')** - `809fae4` (test)

**Plan metadata:** commit final ao término desta execução (docs)

## Files Created/Modified

- `src/features/tests/poisson/PoissonTest.test.tsx` - 4 casos reescritos com `runToResultados`; soft reset sem clique de nav; zero `aria-current`, zero `'Configurar'`
- `src/features/tests/prais-winsten/PraisWinstenTest.test.tsx` - 3 casos reescritos; o caso de preview da série usa `findByRole('Analisar dados')` em vez do helper, por não depender de Resultados
- `src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx` - 2 casos reescritos com `runToResultados`; asserção `'Pressupostos'` escopada com `within(resultados)` após ambiguidade descoberta na verificação
- `src/routes/estatistica/demo/TesteDemo.test.tsx` - caso `'keeps Resultados locked...'` traduzido por ausência de região (`queryByRole('region', ...).not.toBeInTheDocument()`), sem usar o helper; caso `'loads sample data...'` usa `runToResultados`

## Decisions Made

Nenhuma decisão nova além das já travadas em `07-CONTEXT.md` (D-06, D-07). A implementação seguiu a regra de transformação do próprio `07-05-PLAN.md` e o padrão verbatim do `07-PATTERNS.md`. A única descoberta local foi a ambiguidade de `'Pressupostos'` em `QuiQuadradoTest`, resolvida com o mesmo padrão `within(resultados)` já estabelecido em 07-04 (ver Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Asserção `screen.getByText('Pressupostos')` ficou ambígua sob o layout scroll em `QuiQuadradoTest.test.tsx`**
- **Found during:** Task 2, execução de `npx vitest run` após a reescrita mecânica do arquivo
- **Issue:** A asserção original (herdada do idioma stepper) presumia que só um painel estava montado no momento em que "Resultados" era alcançado. No layout scroll, "Dados e configuração" nunca desmonta, e essa seção contém um card didático cujo título é "Pressupostos" (`quiQuadradoConfig.ts:53`) — o mesmo texto literal usado pelo `AlertTitle` de `AssumptionNudgeStrip` dentro de Resultados (`AssumptionNudgeStrip.tsx:34`). `getByText` passou a encontrar 2 elementos e lançar erro.
- **Fix:** Capturado o valor de retorno de `runToResultados(user)` (a região Resultados) em uma variável `resultados`, e a asserção reescrita como `within(resultados).getByText('Pressupostos')` — mesmo conteúdo verificado, apenas escopado ao container correto. Nenhuma asserção foi enfraquecida, removida ou trocada por uma variante que tolerasse ambiguidade.
- **Files modified:** `src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx`
- **Verification:** `npx vitest run src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx` → 2/2 passando; `npm run typecheck` → exit 0
- **Committed in:** `809fae4` (Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 1 — ambiguidade de query exposta pela mudança estrutural do layout scroll, não um bug de produção; mesma classe do achado documentado em `07-04-SUMMARY.md` para `BinomialNegativaTest`, aqui em arquivo diferente)
**Impact on plan:** Nenhum sobre o escopo; a correção ficou dentro do mesmo arquivo e da mesma task, sem tocar código de produção.

## Issues Encountered

Nenhum além da deviation documentada acima.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- Os 11 casos destes 4 arquivos passam no idioma scroll; `PoissonTest.test.tsx`, `PraisWinstenTest.test.tsx`, `QuiQuadradoTest.test.tsx` e `TesteDemo.test.tsx` não aparecem mais na lista de falhas da suíte.
- Somados aos 12 casos de 07-04, os **23 casos herdados do stepper estão reescritos** (SC#3 fechado). Resta exatamente 1 falha na suíte inteira: `router.test.tsx` (1 caso, causa distinta — D-09), owned por 07-06.
- `src/test/flowHelpers.ts` permanece intocado — nenhuma mudança de assinatura ou contrato que pudesse afetar 07-06/07-07.
- `npm run typecheck` continua em exit 0; `git diff --stat package-lock.json` vazio; 0 avisos de canvas e de `act(...)` na suíte inteira.
- Pronto para 07-06 atacar `router.test.tsx` (D-09/D-12) e, na sequência, 07-07 instalar o gate (D-15 a D-18).

---
*Phase: 07-baseline-verde*
*Completed: 2026-07-29*

## Self-Check: PASSED

Todos os arquivos declarados e todos os commits referenciados foram verificados presentes no working tree / git log:
- `src/features/tests/poisson/PoissonTest.test.tsx`, `src/features/tests/prais-winsten/PraisWinstenTest.test.tsx`, `src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx`, `src/routes/estatistica/demo/TesteDemo.test.tsx`, `.planning/phases/07-baseline-verde/07-05-SUMMARY.md` — FOUND
- `32fcdbf`, `809fae4`, `da853ad` — FOUND
