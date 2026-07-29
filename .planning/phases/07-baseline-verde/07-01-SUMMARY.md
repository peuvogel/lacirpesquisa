---
phase: 07-baseline-verde
plan: 01
subsystem: testing
tags: [typescript, type-guards, satisfies, vitest, testing-library, react]

# Dependency graph
requires: []
provides:
  - "TestId — union literal derivada de TEST_REGISTRY (as const satisfies), exportada de src/features/tests/registry.ts"
  - "isTestAvailable(id: string): id is TestId — type guard, mesma assinatura runtime de antes"
  - "getTestById sobrecarregado: TestId -> TestRegistryEntry (nunca undefined), string -> TestRegistryEntry | undefined"
  - "iconFor(id) em SidebarTestLink.tsx — lookup tolerante a runtime com fallback FlaskConical, coberto por teste dedicado (QA-04)"
  - "npm run typecheck limpo (exit 0) — QA-01 fechado"
affects: [07-02, 07-03, 07-04, 07-05, 07-06, 07-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tipo derivado do array de dados (as const satisfies + (typeof X)[number]['field']) em vez de união escrita à mão paralela"
    - "Type guard (id is T) em vez de retorno boolean solto, para preservar narrowing em call sites guardados"
    - "Cast controlado isolado numa função helper (iconFor) como ponto único onde o fallback de runtime sobrevive à tipagem exaustiva"

key-files:
  created:
    - src/routes/estatistica/SidebarTestLink.test.tsx
  modified:
    - src/features/tests/registry.ts
    - src/features/tests/registry.test.ts
    - src/routes/estatistica/SidebarTestLink.tsx
    - src/routes/estatistica/EstatisticaPage.tsx
    - src/routes/mapas/ReviewAnalysisDialog.test.tsx

key-decisions:
  - "D-11/D-14 implementadas exatamente como travadas: TestId deriva de TEST_REGISTRY, isTestAvailable virou type guard, TEST_ICONS ficou exaustivo com fallback de runtime testado"
  - "D-10 respeitada: t-Student continua o teste padrão, nenhum valor do TEST_REGISTRY mudou"
  - "D-13 implementada: fixture de ReviewAnalysisDialog.test.tsx herda de createInitialMapAnalysisState()"
  - "registry.test.ts widened com `as TestStatus` no teste 'has no em-breve entries remaining' — TS2367 surgiu como efeito direto do as const satisfies da Task 1, corrigido inline (Rule 1)"

patterns-established:
  - "Ao apertar um tipo com as const satisfies, toda comparação de igualdade contra um valor de união que não existe mais nos literais concretos vira TS2367 — checar testes que comparam status/enum antes de considerar a tipagem fechada"

requirements-completed: [QA-01, QA-04]

duration: 12min
completed: 2026-07-29
---

# Phase 7 Plano 1: Baseline verde — tipagem exaustiva do registry Summary

**`TestId` derivado de `TEST_REGISTRY` via `as const satisfies`, `isTestAvailable`/`TEST_ICONS` tipados exaustivamente com fallback de runtime testado — zera os 2 erros de `npm run typecheck` do ground truth eliminando a classe de bug, não remendando o sintoma.**

## Performance

- **Duração:** 12 min
- **Início:** 2026-07-29T04:52:00Z
- **Término:** 2026-07-29T05:00:00Z
- **Tasks:** 3/3 completas
- **Arquivos modificados:** 5 (4 do plano + 1 fix inline em `registry.test.ts`)

## Accomplishments
- `npm run typecheck` sai com exit 0 — QA-01 fechado, os 2 erros do ground truth (`SidebarTestLink.tsx:53`, `ReviewAnalysisDialog.test.tsx:67`) deixaram de existir
- `TestId` é um tipo derivado (nunca uma segunda lista escrita à mão) — cadastrar um teste novo sem ícone correspondente agora é erro de compilação (`TS2741`), não bug silencioso (QA-04/D-14)
- `SidebarTestLink.test.tsx` novo prova QA-04 concretamente: uma `TestRegistryEntry` construída fora do `TEST_REGISTRY` real, com um `id` sem ícone dedicado, renderiza sem lançar e o fallback `FlaskConical` aparece
- O fallback `?? 'Estatística'` de `EstatisticaPage.tsx` foi eliminado por tipagem (D-11) — um `activeTestId` inexistente vira erro de typecheck, não heading silenciosamente trocado
- O fixture de `MapAnalysisState` em `ReviewAnalysisDialog.test.tsx` passou a espalhar `createInitialMapAnalysisState()` (D-13) — não pode mais divergir da fábrica de produção
- Zero mudança de comportamento de produção: t-Student continua o teste padrão (D-10), nenhum valor do `TEST_REGISTRY` foi alterado, zero dependência npm nova

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Derivar TestId do TEST_REGISTRY e transformar isTestAvailable em type guard** - `5ea5c8a` (feat)
2. **Task 2: TEST_ICONS exaustivo + iconFor com fallback + teste de QA-04** - `4d9c8d1` (feat)
3. **Task 3: Eliminar o fallback de título por tipagem e consertar o fixture de MapAnalysisState** - `2af8a3b` (fix)

**Plan metadata:** commit final ao término desta execução (docs)

## Files Created/Modified
- `src/features/tests/registry.ts` - `TEST_REGISTRY` fechado com `as const satisfies readonly TestRegistryEntry[]`; `export type TestId`; `getTestById` sobrecarregado; `isTestAvailable` virou type guard `id is TestId`
- `src/features/tests/registry.test.ts` - `as TestStatus` no teste de 'em-breve' para manter a asserção compilando após o `as const satisfies` (deviation, ver abaixo)
- `src/routes/estatistica/SidebarTestLink.tsx` - `TEST_ICONS: Record<TestId, LucideIcon>` exaustivo; `iconFor(id)` com cast controlado + fallback `FlaskConical`; import de `FlaskConical` (era o erro original de typecheck)
- `src/routes/estatistica/SidebarTestLink.test.tsx` (novo) - 3 casos: entry sem ícone não lança (QA-04), entry real renderiza com ícone dedicado, clique chama `onSelect` com o id
- `src/routes/estatistica/EstatisticaPage.tsx` - `useState<TestId>('t-student')`; `pageTitle = getTestById(activeTestId).title` sem fallback
- `src/routes/mapas/ReviewAnalysisDialog.test.tsx` - fixture espalha `{ ...createInitialMapAnalysisState(), groups, activeGroupId: 'g1', mapView: { level: 'uf' }, provenance: 'catalog' }`

## Decisions Made
- Nenhuma decisão nova além das já travadas em `07-CONTEXT.md` (D-09 a D-14). O plano foi executado seguindo exatamente os padrões verificados em `07-RESEARCH.md` §Pattern 2 (`as const satisfies`, `id is TestId`, `iconFor` com cast).
- A sobrecarga de `getTestById` (TestId → TestRegistryEntry sem undefined; string → TestRegistryEntry | undefined) compilou de primeira sem precisar do fallback `getTestById(activeTestId)!.title` previsto como plano B na Task 1 — não foi necessário registrar nenhum erro de sobrecarga rejeitada.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `registry.test.ts` parou de compilar após o `as const satisfies` da Task 1**
- **Found during:** Task 2 (verificação de `npm run typecheck` completo)
- **Issue:** Com `TEST_REGISTRY` fechado por `as const satisfies`, o campo `status` de cada uma das 9 entradas atuais (todas `'available'`) narrow para o literal `'available'`, não para o tipo largo `TestStatus`. O teste `'has no em-breve entries remaining'` compara `entry.status === 'em-breve'`, e o TypeScript rejeita essa comparação como `TS2367` (sem overlap entre os dois literais).
- **Fix:** Import de `type TestStatus` de `./registry` e cast explícito `(entry.status as TestStatus) === 'em-breve'` — mantém a intenção original do teste (guarda contra uma futura entrada `em-breve` reaparecer) sem alterar nenhum valor de produção.
- **Files modified:** `src/features/tests/registry.ts` (causa raiz, já coberta na Task 1), `src/features/tests/registry.test.ts` (correção)
- **Verification:** `npm run typecheck` volta a exit 0; `npx vitest run src/features/tests/registry.test.ts` passa (10/10 testes)
- **Committed in:** `4d9c8d1` (parte do commit da Task 2, onde o erro foi descoberto durante a verificação de typecheck completo)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug de compilação causado diretamente pela própria mudança de tipo desta fase, não dívida herdada)
**Impact on plan:** Correção mínima e local, necessária para que `npm run typecheck` (QA-01, o critério de sucesso central deste plano) realmente feche em exit 0. Nenhum scope creep — o arquivo tocado (`registry.test.ts`) não estava no `files_modified` do plano, mas o erro só existe porque a Task 1 apertou o tipo de `TEST_REGISTRY` como o próprio plano pediu.

## Issues Encountered
Nenhum além da deviation documentada acima.

## User Setup Required
None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- `npm run typecheck` está verde (exit 0, zero erros) — pré-condição para `npm run build` funcionar de novo (`tsc -b` para nos mesmos erros hoje) e para os planos seguintes desta fase (07-02 a 07-07) trabalharem sobre uma base de tipos limpa.
- A suíte continua com os 24 testes falhando pré-existentes em 9 arquivos (confirmado: `9 failed | 87 passed` de arquivos, `24 failed | 655 passed` de testes + os 3 novos de `SidebarTestLink.test.tsx` = 679 testes totais rodados vs. os 676 do ground truth + 3 novos). Essas 24 falhas são dívida herdada, fora do escopo deste plano — 07-03 a 07-06 tratam delas em waves futuras. Nenhuma delas foi tocada.
- `git diff --stat package-lock.json` vazio — zero dependência npm nova, regra herdada da Fase 5 respeitada.
- `TestId` e o padrão `iconFor`/type-guard ficam disponíveis como precedente para qualquer plano futuro que precise apertar outro tipo derivado de um registry/array de dados.

---
*Phase: 07-baseline-verde*
*Completed: 2026-07-29*
