---
phase: 07-baseline-verde
plan: 03
subsystem: testing
tags: [react, dead-code-removal, vitest, testing-library]

# Dependency graph
requires:
  - phase: 07-01
    provides: "npm run typecheck limpo — só assim o typecheck vira sinal utilizável para provar esta remoção"
provides:
  - "FlowSteps com um único caminho de render (scroll) — layout=\"stepper\" removido do repositório junto com toda a API morta (onStepChange, FLOW_STEP_LABELS, effectiveCanAdvance, import de Check)"
  - "FlowSteps.test.tsx com 5 casos vivos cobrindo só o layout scroll, contra os 2 que existiam antes do stepper sair"
  - "Os 10 call sites de produção + o call site de teste em flowHelpers.test.tsx simplificados, sem onStepChange"
affects: [07-04, 07-05, 07-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ramo morto de componente removido por completo (branch + prop + tipos associados), não depreciado — guarda contra recorrência é a ausência estrutural da API, não uma convenção documentada (D-05)"

key-files:
  created: []
  modified:
    - src/shared/flow/FlowSteps.tsx
    - src/shared/flow/FlowSteps.test.tsx
    - src/features/tests/t-student/TStudentTest.tsx
    - src/features/tests/correlacao/CorrelacaoTest.tsx
    - src/features/tests/prais-winsten/PraisWinstenTest.tsx
    - src/features/tests/qui-quadrado/QuiQuadradoTest.tsx
    - src/features/tests/anova-tukey/AnovaTukeyTest.tsx
    - src/features/tests/kruskal-dunn/KruskalDunnTest.tsx
    - src/features/tests/poisson/PoissonTest.tsx
    - src/features/tests/binomial-negativa/BinomialNegativaTest.tsx
    - src/features/tests/logistica/LogisticaTest.tsx
    - src/routes/estatistica/demo/TesteDemo.tsx
    - src/test/flowHelpers.test.tsx

key-decisions:
  - "D-01/D-02 implementadas literalmente: saiu o bloco if (layout === 'stepper') inteiro, o prop layout, o prop onStepChange, FLOW_STEP_LABELS, effectiveCanAdvance e o import de Check; o import de cn (@/lib/utils) também saiu por ter ficado órfão — só era usado dentro do ramo removido"
  - "D-03 implementada: FlowSteps.test.tsx fecha com 5 casos vivos (2 preexistentes + 3 novos: active==='resultados' sem canAdvance.resultados, region+id acessíveis, scrollIntoView disparando), contra os 2 que sobrariam sem compensação"
  - "D-04/D-05 respeitadas: nenhum caminho novo de volta ao painel de colagem, nenhuma regra nova em CLAUDE.md — a remoção em si é a guarda"

patterns-established:
  - "Ao remover uma prop de um componente compartilhado, grep por '<ComponenteX' tem que cobrir também arquivos de teste com fixtures locais (não só módulos de produção) — o inventário do plano listava 10 call sites de produção e não capturou o 11º, dentro de um helper de teste criado no plano anterior"

requirements-completed: [QA-02]

duration: ~15min (sessão retomada após interrupção do operador; Task 1 já estava no disco, não commitada)
completed: 2026-07-29
---

# Phase 7 Plano 3: Baseline verde — remoção do modo stepper de FlowSteps Summary

**`layout="stepper"` e toda a API morta associada (onStepChange, FLOW_STEP_LABELS, effectiveCanAdvance, import de Check) saíram de `FlowSteps.tsx` e dos 11 call sites que a referenciavam; `FlowSteps.test.tsx` fecha com 5 casos vivos cobrindo só o layout scroll, mais do que os 2 que existiam antes da remoção.**

## Performance

- **Duração:** ~15 min nesta sessão (execução foi interrompida pelo operador entre as tasks; Task 1 já estava aplicada em disco, não commitada, ao retomar)
- **Tasks:** 2/2 completas
- **Arquivos modificados:** 13 (12 do plano + `src/test/flowHelpers.test.tsx`, fora do `files_modified` original)

## Accomplishments
- `FlowSteps.tsx` tem agora um único caminho de render: `layout`, `onStepChange`, `FLOW_STEP_LABELS`, `effectiveCanAdvance` e o import de `Check` (lucide-react) saíram por completo, junto com o bloco `if (layout === 'stepper') { ... }` inteiro. `FlowStepsProps` fica com exatamente 5 campos: `active`, `canAdvance`, `dados`, `configurar`, `resultados`
- O `useEffect` de `scrollIntoView` perdeu a guarda `layout !== 'scroll'` e `layout` do array de dependências — o efeito roda sempre que `active` muda
- Os 10 call sites de produção (`t-student`, `correlacao`, `prais-winsten`, `qui-quadrado`, `anova-tukey`, `kruskal-dunn`, `poisson`, `binomial-negativa`, `logistica`, `TesteDemo`) perderam só a linha `onStepChange={setActiveStep}`; `useState<FlowStep>` e todas as chamadas internas de `setActiveStep` continuam intactas
- `FlowSteps.test.tsx` foi reescrito: o `describe('FlowSteps stepper layout', ...)` inteiro (5 casos que clicavam na nav e liam `aria-current`) saiu; os 2 casos de scroll que ficaram perderam os props `layout`/`onStepChange`; 3 casos novos entraram (D-03) — `active === 'resultados'` renderiza mesmo com `canAdvance.resultados === false`; a seção é alcançável via `getByRole('region', { name: 'Resultados' })` e carrega `id="lacir-flow-results"`; `scrollIntoView` dispara ao chegar em resultados. Total: 5 casos vivos, todos sobre o único layout que a aplicação usa
- `npm run typecheck` sai com exit 0 (zero erros) — o segundo erro de tipo (em `flowHelpers.test.tsx`, ver Deviations) foi fechado junto com o de `FlowSteps.test.tsx`
- Suíte inteira (`npx vitest run`): 24 falhas / 656 passando (680 total) — exatamente a dívida herdada esperada (23 testes de módulo + `router.test.tsx`, ambos fora do escopo deste plano) menos os 2 testes líquidos que saíram de `FlowSteps.test.tsx` (7 → 5). Os 2 módulos que já estavam verdes (`TStudentTest.test.tsx`, `CorrelacaoTest.test.tsx`) continuam verdes (6/6)
- `git diff --stat package-lock.json` vazio — zero dependência npm nova

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Remover o ramo stepper e a API morta de FlowSteps, e limpar os 10 call sites** - `81e17f3` (feat)
2. **Task 2: Reescrever FlowSteps.test.tsx — remover os 5 casos de stepper e fazer a cobertura de scroll crescer** - `a298fa4` (test)

**Plan metadata:** commit final ao término desta execução (docs)

## Files Created/Modified
- `src/shared/flow/FlowSteps.tsx` - único caminho de render (scroll); API reduzida a 5 props; `useEffect` de scroll simplificado
- `src/shared/flow/FlowSteps.test.tsx` - reescrito: 5 casos vivos sobre o layout scroll (2 preexistentes ajustados + 3 novos de D-03)
- 10 call sites de produção (`t-student/TStudentTest.tsx`, `correlacao/CorrelacaoTest.tsx`, `prais-winsten/PraisWinstenTest.tsx`, `qui-quadrado/QuiQuadradoTest.tsx`, `anova-tukey/AnovaTukeyTest.tsx`, `kruskal-dunn/KruskalDunnTest.tsx`, `poisson/PoissonTest.tsx`, `binomial-negativa/BinomialNegativaTest.tsx`, `logistica/LogisticaTest.tsx`, `routes/estatistica/demo/TesteDemo.tsx`) - removida a linha `onStepChange={setActiveStep}`
- `src/test/flowHelpers.test.tsx` - removida a linha `onStepChange={() => {}}` do componente-fixture local (deviation, ver abaixo)

## Decisions Made
Nenhuma decisão nova além das já travadas em `07-CONTEXT.md` (D-01 a D-05). A execução seguiu à risca o mapa de remoção do `07-PATTERNS.md` (linhas exatas do "o que sai" e "o que fica").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `src/test/flowHelpers.test.tsx` também passava `onStepChange` para `<FlowSteps>` e não estava no inventário de 10 call sites do plano**
- **Found during:** Task 1, verificação de `npm run typecheck` após a remoção do prop
- **Issue:** O plano fez o inventário de "10 call sites" via grep antes do planejamento, mas o componente-fixture local criado pelo plano 07-02 (`src/test/flowHelpers.test.tsx`, arquivo de teste, não módulo de produção) também renderiza `<FlowSteps onStepChange={() => {}} ...>`. Depois que a Task 1 removeu o prop `onStepChange` de `FlowStepsProps`, esse 11º call site parou de compilar (`TS2322`), deixando **dois** arquivos com erro de typecheck em vez do único (`FlowSteps.test.tsx`) previsto pelo critério de aceite da Task 1.
- **Fix:** Removida a linha `onStepChange={() => {}}` do componente `Fixture` em `flowHelpers.test.tsx` — mesma edição mecânica aplicada aos outros 10 call sites. Nenhum outro comportamento do arquivo foi tocado.
- **Files modified:** `src/test/flowHelpers.test.tsx`
- **Verification:** `npm run typecheck 2>&1 | grep "error TS" | grep -vc "FlowSteps.test.tsx"` retornou 0 depois da correção; `npx vitest run src/test/flowHelpers.test.tsx` continua 3/3 passando
- **Committed in:** `81e17f3` (parte do commit da Task 1, onde o erro foi descoberto durante a verificação de typecheck)

---

**Total deviations:** 1 auto-fixed (Rule 3 — call site de `FlowSteps` fora do inventário do plano, quebrado diretamente pela remoção do prop desta task)
**Impact on plan:** Correção mínima e mecanicamente idêntica às demais 10 já previstas; nenhuma mudança de comportamento, nenhum scope creep além de tornar o typecheck realmente verde ao final da Task 2.

## Issues Encountered

Durante a verificação de conformidade dos critérios de aceite da Task 1, notou-se que o grep literal `grep -rc "stepper" src` (citado tanto no acceptance_criteria da Task 1 quanto na `<verification>` final do plano) retorna 1 ocorrência em `src/test/flowHelpers.ts` mesmo depois de ambas as tasks completas — é um comentário de documentação ("... o atributo que o antigo stepper usava...") escrito no plano 07-02 (já commitado antes deste plano começar), fora do `files_modified` desta plano e fora do escopo desta remoção (não referencia nenhuma API removida, é só uma referência histórica em prosa). Por SCOPE BOUNDARY (dívida pré-existente, não introduzida por esta task), o arquivo não foi tocado. O `grep` restrito às duas localizações que este plano realmente controla (`FlowSteps.tsx` e `FlowSteps.test.tsx`) confirma zero ocorrências de `stepper` em ambos após a Task 2.

## User Setup Required
None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- `FlowSteps` tem um único caminho de render — não existe mais uma segunda realidade (`layout="stepper"`) que os testes das Fases 8–12 possam dirigir por engano (D-05 fechada estruturalmente)
- `npm run typecheck` continua em exit 0 (QA-01 e QA-02 não regrediram)
- Os 24 testes pré-existentes que falham (23 de módulo + `router.test.tsx`) permanecem exatamente a mesma dívida herdada, intocados por este plano — ficam para 07-04/07-05 (reescrita para o idioma `runToResultados`) e para o plano que trata D-09/D-12 do `router.test.tsx`
- `git diff --stat package-lock.json` vazio nos dois commits — zero dependência npm nova
- Nenhum arquivo de módulo de teste (`AnovaTukeyTest.test.tsx`, `KruskalDunnTest.test.tsx`, etc.) foi tocado ou tornado `.skip`/`.todo` — QA-03 respeitada

---
*Phase: 07-baseline-verde*
*Completed: 2026-07-29*

## Self-Check: PASSED

Todos os arquivos declarados e todos os commits referenciados foram verificados presentes no working tree / git log:
- `src/shared/flow/FlowSteps.tsx`, `src/shared/flow/FlowSteps.test.tsx`, `src/test/flowHelpers.test.tsx`, os 10 call sites de produção — FOUND (via `git show --stat` dos commits abaixo)
- `81e17f3`, `a298fa4` — FOUND (`git log --oneline` confirma ambos presentes em HEAD)
