---
phase: 07-baseline-verde
plan: 04
subsystem: testing
tags: [vitest, testing-library, flow-helper, glm-tests]

# Dependency graph
requires:
  - phase: 07-02
    provides: "runToResultados(user) em src/test/flowHelpers.ts — idioma de 3 passos consumido por este plano"
  - phase: 07-03
    provides: "layout scroll único em FlowSteps — o botão/nav 'Configurar' e o aria-current='step' deixaram de existir em produção"
provides:
  - "AnovaTukeyTest.test.tsx, KruskalDunnTest.test.tsx, LogisticaTest.test.tsx, BinomialNegativaTest.test.tsx verdes no idioma scroll (12 casos)"
affects: [07-05, 07-06, 07-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "runToResultados(user) captura o retorno (região Resultados) quando um caso precisa escopar uma asserção para dentro dela — evita colisão com conteúdo homônimo em Dados e configuração, que no layout scroll nunca desmonta"

key-files:
  created: []
  modified:
    - src/features/tests/anova-tukey/AnovaTukeyTest.test.tsx
    - src/features/tests/kruskal-dunn/KruskalDunnTest.test.tsx
    - src/features/tests/logistica/LogisticaTest.test.tsx
    - src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx

key-decisions:
  - "D-06/D-07 aplicadas literalmente nos 12 casos: click 'Configurar' + aria-current 'step' saíram; runToResultados(user) entrou no lugar exato onde o caso chega em Resultados"
  - "Nos 2 casos de BinomialNegativaTest que checam 'θ (dispersão)' o retorno de runToResultados foi capturado e a asserção escopada com within(resultados) — o layout scroll mantém a seção 'Dados e configuração' (com o gatilho colapsável 'Parâmetro θ (dispersão)') montada ao lado de Resultados, algo que o stepper antigo nunca permitia simultaneamente"
  - "Caso de restauração de sessão do BinomialNegativaTest não ganhou nenhum advanceTimersByTimeAsync novo — a prova de carga é screen.findByRole('button', { name: 'Analisar dados' }), como o próprio plano instruiu, porque o dado chega via setDataset, não via debounce de parse de colagem"

patterns-established:
  - "Quando o layout scroll faz duas seções coexistirem, uma asserção de texto que era única sob o stepper pode virar ambígua — a correção correta é escopar a query à região retornada pelo helper (within), nunca afrouxar ou remover a asserção (QA-03)"

requirements-completed: [QA-02]

duration: ~8min
completed: 2026-07-29
---

# Phase 7 Plano 4: Baseline verde — reescrita de AnovaTukey/KruskalDunn/Logistica/BinomialNegativa para o idioma scroll Summary

**Os 12 casos herdados destes 4 arquivos convergem para `runToResultados(user)` (`@/test/flowHelpers`); dois deles precisaram escopar uma asserção com `within(resultados)` porque o layout scroll expôs uma ambiguidade de texto que o stepper antigo escondia ao desmontar a configuração.**

## Performance

- **Duração:** ~8 min
- **Tasks:** 2/2 completas
- **Arquivos modificados:** 4

## Accomplishments

- `AnovaTukeyTest.test.tsx` e `KruskalDunnTest.test.tsx`: os 3 casos de cada um passaram a usar `runToResultados(user)` no lugar da sequência `waitFor(not.toBeDisabled) → click('Configurar') → click('Analisar dados') → waitFor(aria-current)`. O caso de soft reset de cada arquivo perdeu o segundo `click('Configurar')` — o `<select>` de papel de coluna já está na tela porque "Dados e configuração" nunca desmonta no layout scroll. O terceiro caso de cada arquivo ('calls onNavigateTest for Kruskal CTA...' / 'shows assumption nudge strip...') de fato chega em Resultados (confirmado lendo `AnovaTukeyTest.tsx`/`KruskalDunnTest.tsx`: `AssumptionNudgeStrip` e a seção "Comparações par a par" só existem dentro de `resultsContent`, que só é não-nulo com `confirmedDataset` presente) — por isso também usam o helper, não só `findByRole('Analisar dados')`.
- `LogisticaTest.test.tsx`: os 3 casos convergem para `runToResultados(user)`, incluindo o caso 'shows rare events warning nudge on imbalanced paste' — confirmado por leitura de `LogisticaTest.tsx:141-189` que `AssumptionNudgeStrip` só é montado dentro de `resultsContent`, ou seja, depois de "Analisar dados", não durante a configuração.
- `BinomialNegativaTest.test.tsx`: os 3 casos convergem para o helper. O caso de restauração de sessão via handoff do Poisson (`bootstraps recognizedColumns...`) não usa `Usar exemplo` nem colagem — o dado chega via `setDataset` no harness local — então a prova de carga é `await screen.findByRole('button', { name: 'Analisar dados' })` sem nenhum `advanceTimersByTimeAsync` inventado, exatamente como o plano instruiu.
- **Achado durante a verificação (não estava no plano):** os 2 casos de `BinomialNegativaTest.test.tsx` que checavam `screen.getByText(/θ \(dispersão\)/i)` quebraram com `TestingLibraryElementError: Found multiple elements` — o layout scroll mantém a seção "Entenda este teste" (dentro de "Dados e configuração") montada ao lado de Resultados, e essa seção tem um gatilho colapsável cujo texto é "Parâmetro θ (dispersão)", que também casa com a mesma regex. Sob o stepper antigo isso nunca colidia porque só um painel ficava montado por vez. Corrigido capturando o retorno de `runToResultados(user)` (a região Resultados) e escopando a asserção com `within(resultados).getByText(...)` — a asserção de conteúdo continua a mesma, só passou a mirar o lugar certo (Rule 1, ver Deviations).
- `npx vitest run` sobre os 4 arquivos: 12/12 verdes. `npx vitest run` inteiro: 12 falhas / 668 passando (680 total) — exatamente a dívida restante esperada, dividida entre 07-05 (Poisson 4, Prais-Winsten 3, Qui-Quadrado 2, TesteDemo 2 = 11) e 07-06 (`router.test.tsx` 1). Nenhuma delas pertence a este plano.
- `npm run typecheck` → exit 0.
- 0 avisos de `HTMLCanvasElement.getContext` na suíte inteira (D-08 seguiu fechada). Dos 10 avisos de `act(...)` restantes, todos pertencem a arquivos fora do escopo deste plano (Poisson, Prais-Winsten, Qui-Quadrado, TesteDemo) — nenhum dos 4 arquivos deste plano produz aviso de `act(...)`.
- `git diff --stat package-lock.json` vazio nos dois commits — zero dependência npm nova.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Reescrever AnovaTukeyTest.test.tsx e KruskalDunnTest.test.tsx no idioma scroll** - `4cf6696` (test)
2. **Task 2: Reescrever LogisticaTest.test.tsx e BinomialNegativaTest.test.tsx no idioma scroll** - `30d8406` (test)

**Plan metadata:** commit final ao término desta execução (docs)

## Files Created/Modified

- `src/features/tests/anova-tukey/AnovaTukeyTest.test.tsx` - 3 casos reescritos com `runToResultados`; zero `aria-current`, zero `'Configurar'`
- `src/features/tests/kruskal-dunn/KruskalDunnTest.test.tsx` - 3 casos reescritos com `runToResultados`; zero `aria-current`, zero `'Configurar'`
- `src/features/tests/logistica/LogisticaTest.test.tsx` - 3 casos reescritos com `runToResultados`, incluindo o caso de colagem desbalanceada
- `src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx` - 3 casos reescritos com `runToResultados`; caso de handoff de sessão usa `findByRole` direto (sem debounce); 2 asserções de "θ (dispersão)" escopadas com `within(resultados)`

## Decisions Made

Nenhuma decisão nova além das já travadas em `07-CONTEXT.md` (D-06, D-07). A implementação seguiu a regra de transformação do próprio `07-04-PLAN.md` e o padrão verbatim do `07-PATTERNS.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Asserção `screen.getByText(/θ \(dispersão\)/i)` ficou ambígua sob o layout scroll em `BinomialNegativaTest.test.tsx`**
- **Found during:** Task 2, execução de `npx vitest run` após a reescrita mecânica dos 2 arquivos
- **Issue:** A asserção original (herdada do idioma stepper) presumia que só um painel estava montado no momento em que "Resultados" era alcançado. No layout scroll, "Dados e configuração" nunca desmonta, e essa seção contém um `<button>` colapsável "Entenda este teste" cujo rótulo "Parâmetro θ (dispersão)" também casa com a regex `/θ \(dispersão\)/i` — o mesmo texto que aparece no rótulo da métrica dentro de Resultados. `getByText` passou a encontrar 2 elementos e lançar erro, nos 2 casos que fazem essa checagem ('runs exemplo flow...' e 'bootstraps recognizedColumns...').
- **Fix:** Capturado o valor de retorno de `runToResultados(user)` (a região Resultados) em uma variável `resultados`, e a asserção reescrita como `within(resultados).getByText(/θ \(dispersão\)/i)` — mesmo conteúdo verificado, apenas escopado ao container correto. Nenhuma asserção foi enfraquecida, removida ou trocada por uma variante `query*`/`getAllBy*` que tolerasse ambiguidade.
- **Files modified:** `src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx`
- **Verification:** `npx vitest run src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx` → 3/3 passando; `npm run typecheck` → exit 0
- **Committed in:** `30d8406` (Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 1 — ambiguidade de query exposta pela mudança estrutural do layout scroll, não um bug de produção)
**Impact on plan:** Nenhum sobre o escopo; a correção ficou dentro do mesmo arquivo e da mesma task, sem tocar código de produção.

## Issues Encountered

Nenhum além da deviation documentada acima.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- Os 12 casos destes 4 arquivos passam no idioma scroll; `AnovaTukeyTest.test.tsx`, `KruskalDunnTest.test.tsx`, `LogisticaTest.test.tsx` e `BinomialNegativaTest.test.tsx` não aparecem mais na lista de falhas da suíte.
- Restam 12 falhas na suíte inteira, todas fora do escopo deste plano: `PoissonTest.test.tsx` (4), `PraisWinstenTest.test.tsx` (3), `QuiQuadradoTest.test.tsx` (2), `TesteDemo.test.tsx` (2) — owned por 07-05 — e `router.test.tsx` (1) — owned por 07-06.
- `src/test/flowHelpers.ts` permanece intocado — nenhuma mudança de assinatura ou contrato que pudesse afetar 07-05.
- `npm run typecheck` continua em exit 0; `git diff --stat package-lock.json` vazio.

---
*Phase: 07-baseline-verde*
*Completed: 2026-07-29*

## Self-Check: PASSED

Todos os arquivos declarados e todos os commits referenciados foram verificados presentes no working tree / git log:
- `src/features/tests/anova-tukey/AnovaTukeyTest.test.tsx`, `src/features/tests/kruskal-dunn/KruskalDunnTest.test.tsx`, `src/features/tests/logistica/LogisticaTest.test.tsx`, `src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx` — FOUND
- `4cf6696`, `30d8406` — FOUND
