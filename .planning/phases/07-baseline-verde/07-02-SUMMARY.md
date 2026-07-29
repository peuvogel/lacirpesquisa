---
phase: 07-baseline-verde
plan: 02
subsystem: testing
tags: [vitest, testing-library, jsdom, canvas, test-helper]

# Dependency graph
requires:
  - phase: 07-01
    provides: "npm run typecheck limpo — base de tipos limpa para escrever o helper novo"
provides:
  - "runToResultados(user) — helper de fluxo compartilhado em src/test/flowHelpers.ts, idioma de 3 passos (D-06/D-07)"
  - "src/test/flowHelpers.test.tsx — prova executável do idioma contra fixture local, independente de qualquer módulo de produção"
  - "src/test/setup.ts reescrito — stub incondicional de getContext/toDataURL, 190 → 0 avisos de canvas (D-08)"
affects: [07-03, 07-04, 07-05, 07-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Helper de fluxo compartilhado em src/test/ com export nomeado, seguindo a convenção dos 4 oracles vizinhos (legacyStatsOracle, praisModuleOracle, correlacaoModuleOracle, tStudentModuleOracle)"
    - "Stub de API do browser (canvas) substituído incondicionalmente no setup file, nunca sondado contra o método real — sondar é o que causava o próprio ruído que se queria evitar"

key-files:
  created:
    - src/test/flowHelpers.ts
    - src/test/flowHelpers.test.tsx
  modified:
    - src/test/setup.ts

key-decisions:
  - "D-06/D-07 implementadas exatamente como travadas: runToResultados(user) tem 2 passos no corpo (click + findByRole('region')), sem aria-current, sem clique em nav, sem espera manual de temporizador"
  - "D-08 (parte canvas) implementada: substituição incondicional de proto.getContext/proto.toDataURL, sem sondar o método real do jsdom primeiro — 190 avisos → 0, confirmado por grep sobre a suíte inteira"
  - "Docstring do helper reescrita para não conter os literais que os próprios critérios de aceite proíbem no arquivo (aria-current, Configurar, advanceTimersByTime, setTimeout) — a rationale ficou paraphraseada em vez de citar os termos proibidos"

patterns-established:
  - "Quando um critério de aceite proíbe um literal específico no arquivo, comentários explicativos que citam esse literal (mesmo para dizer 'nunca faça isso') violam o grep — parafrasear a intenção em vez de citar o termo"

requirements-completed: [QA-02]

duration: ~7min
completed: 2026-07-29
---

# Phase 7 Plano 2: Baseline verde — helper de fluxo compartilhado + stub de canvas Summary

**`runToResultados(user)` entrega o idioma de 3 passos que os 9 arquivos das ondas seguintes vão consumir, e `src/test/setup.ts` passou de sondagem-que-imprime-o-próprio-aviso para substituição incondicional — 190 avisos de `HTMLCanvasElement` viraram 0.**

## Performance

- **Duração:** ~7 min
- **Início:** 2026-07-29T08:02:00Z (aprox.)
- **Término:** 2026-07-29T08:09:00Z (aprox.)
- **Tasks:** 2/2 completas
- **Arquivos modificados:** 3 (2 criados, 1 reescrito)

## Accomplishments
- `src/test/flowHelpers.ts` exporta `runToResultados(user: UserEvent)`: espera `findByRole('button', { name: 'Analisar dados' })`, clica, e devolve `findByRole('region', { name: 'Resultados' })` — exatamente os 2 passos do corpo que substituem os 5 passos do idioma antigo (D-06/D-07)
- `src/test/flowHelpers.test.tsx` prova o idioma contra um componente-fixture local que renderiza `<FlowSteps>` real (nenhum outro módulo de produção importado): botão monta após tick assíncrono, helper resolve com a região certa (`id="lacir-flow-results"`), e rejeita por timeout quando Resultados nunca monta
- `src/test/setup.ts` reescrito: os dois IIFEs de sondagem (`needsGetContextStub`/`needsToDataURLStub`) saíram por completo — a causa raiz era a própria chamada de sondagem contra o método real do jsdom, que loga e retorna em vez de lançar. Substituição incondicional de `proto.getContext`/`proto.toDataURL` no topo de escopo do módulo
- `npx vitest run` inteiro: 0 ocorrências de `Not implemented: HTMLCanvasElement` (era 190) — confirmado sobre a saída completa da suíte, não só sobre os arquivos tocados
- `TStudentTest.test.tsx` e `CorrelacaoTest.test.tsx` (os 2 módulos já verdes) continuam verdes com o stub novo — 6/6 testes passando
- Zero dependência npm nova — `git diff --stat package-lock.json` vazio nos dois commits
- Os 24 testes pré-existentes falhando em 9 arquivos permanecem intocados (658 passando / 24 falhando, mesma contagem do ground truth de 07-01) — dívida herdada fora do escopo deste plano, tratada em 07-03 a 07-06

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Criar o helper de fluxo compartilhado runToResultados com teste próprio** - `e7ee9c5` (feat)
2. **Task 2: Substituir a sondagem de canvas por stub incondicional em src/test/setup.ts** - `8a822cd` (fix)

**Plan metadata:** commit final ao término desta execução (docs)

## Files Created/Modified
- `src/test/flowHelpers.ts` (novo) - `runToResultados(user)`, export nomeado, 2 passos no corpo (click em "Analisar dados" + `findByRole('region', { name: 'Resultados' })`); comentário documenta os dois casos estruturais fora do escopo do helper (soft reset e "Resultados travado") para os consumidores de 07-04/07-05
- `src/test/flowHelpers.test.tsx` (novo) - componente-fixture local sobre `FlowSteps` real; 3 casos: resolve com a região Resultados, id devolvido é `lacir-flow-results`, rejeita por timeout se Resultados nunca montar
- `src/test/setup.ts` - os dois blocos de sondagem removidos; `proto.getContext`/`proto.toDataURL` atribuídos incondicionalmente; comentário reescrito com a causa raiz correta

## Decisions Made
- Nenhuma decisão nova além das já travadas em `07-CONTEXT.md` (D-06, D-07, D-08). Implementação seguiu à risca a assinatura e o conteúdo verificados em `07-RESEARCH.md` §Pattern 1 e §Code Examples ("Stub de canvas incondicional").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Docstring do helper violava os próprios critérios de aceite que ele deveria satisfazer**
- **Found during:** Task 1, verificação dos critérios de aceite via grep
- **Issue:** A primeira versão de `src/test/flowHelpers.ts` documentava, em comentário, os passos proibidos do idioma antigo citando os termos literais (`aria-current`, `Configurar`, `advanceTimersByTimeAsync`, `setTimeout`). Os próprios critérios de aceite da Task 1 proíbem esses literais em qualquer lugar do arquivo (`grep -c "aria-current" ... retorna 0`, etc.) — a explicação em prosa do que o helper *não* faz acabou incluindo o texto proibido, fazendo `grep -c 'aria-current'` retornar 1 em vez de 0.
- **Fix:** Reescrita da docstring para parafrasear a mesma intenção sem citar os literais — "ler o atributo que o antigo stepper usava para marcar o passo ativo" em vez de `aria-current`, "clicar em qualquer botão de navegação entre etapas" em vez de `'Configurar'`, "espera manual de temporizador (relógio falso avançado manualmente ou `Promise` própria)" em vez de `advanceTimersByTimeAsync`/`setTimeout`.
- **Files modified:** `src/test/flowHelpers.ts`
- **Verification:** todos os 8 critérios de aceite grep da Task 1 confirmados individualmente (retornos exatos: 1,1,0,0,0,0,0, diff vazio); `npx vitest run src/test/flowHelpers.test.tsx` continua com 3/3 testes passando após a reescrita
- **Committed in:** `e7ee9c5` (a docstring corrigida já foi o que entrou no commit — a versão com os literais nunca foi commitada)

---

**Total deviations:** 1 auto-fixed (Rule 1 — o próprio arquivo continha o texto que seus critérios de aceite proibiam; corrigido antes do commit, então o histórico de git não carrega a versão quebrada)
**Impact on plan:** Nenhum — correção local, dentro do mesmo arquivo e da mesma task, sem mudança de comportamento do helper.

## Issues Encountered
Nenhum além da deviation documentada acima.

## User Setup Required
None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- `runToResultados(user)` está pronto para ser consumido pelos 9 arquivos de teste reescritos em 07-04/07-05 (Wave 3) — assinatura estável, export nomeado em `src/test/flowHelpers.ts`, sem dependência de nenhum módulo de produção específico além de `@testing-library/react`/`user-event`
- `npx vitest run` inteiro confirma 0 avisos de `Not implemented: HTMLCanvasElement` — D-08 (parte canvas) fechada; os 21 avisos de `act(...)` remanescentes (dentro dos 24 testes que falham) ficam para as ondas que reescrevem esses arquivos
- Os 24 testes pré-existentes falhando permanecem exatamente como estavam (658 passando / 24 falhando) — nenhuma regressão introduzida por este plano
- `git diff --stat package-lock.json` vazio nos dois commits — zero dependência npm nova, regra herdada da Fase 5 respeitada

---
*Phase: 07-baseline-verde*
*Completed: 2026-07-29*

## Self-Check: PASSED

Todos os arquivos declarados e todos os commits referenciados foram verificados presentes no working tree / git log:
- `src/test/flowHelpers.ts`, `src/test/flowHelpers.test.tsx`, `src/test/setup.ts`, `.planning/phases/07-baseline-verde/07-02-SUMMARY.md` — FOUND
- `e7ee9c5`, `8a822cd`, `d815808` — FOUND
