# Task 6 Report

Date: 2026-08-31

## Scope

Removed the research-question UI/state/text from the remaining five modules:

- `prais-winsten`
- `qui-quadrado`
- `poisson`
- `binomial-negativa`
- `logistica`

Preserved the requested domain-specific interpretation details: Prais–Winsten temporal/period/APC wording, chi-square variable/association text, and Poisson/NB/logistic estimates, intervals, dispersion, rare-event, and adequacy warnings.

Deleted the shared `ResearchQuestionField` only after the production import audit was clean.

## RED

Command:

```bash
npx vitest run src/routes/estatistica/EstatisticaPage.test.tsx src/features/tests/prais-winsten/PraisWinstenTest.test.tsx src/features/tests/prais-winsten/praisInterpretation.test.ts src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx src/features/tests/qui-quadrado/quiQuadradoInterpretation.test.ts src/features/tests/poisson/PoissonTest.test.tsx src/features/tests/poisson/poissonInterpretation.test.ts src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx src/features/tests/binomial-negativa/binomialNegativaInterpretation.test.ts src/features/tests/logistica/LogisticaTest.test.tsx src/features/tests/logistica/logisticaInterpretation.test.ts
```

Observed result:

- exit code `1`
- `15` failures across `8` files
- failures were the expected ones: config/result flows still exposed `Pergunta de pesquisa` or interpretations still emitted `Pergunta analisada:`

Representative failures:

- `BinomialNegativaTest.test.tsx`: expected no textbox named `Pergunta de pesquisa`, but the config textarea was still present
- `PoissonTest.test.tsx`, `QuiQuadradoTest.test.tsx`, `LogisticaTest.test.tsx`: expected no `Pergunta analisada:` paragraph in Resultados
- interpretation tests for `prais-winsten`, `qui-quadrado`, `poisson`, `binomial-negativa`, and `logistica`: expected joined output not to contain `Pergunta analisada:`

## GREEN

Commands:

```bash
npx vitest run src/routes/estatistica/EstatisticaPage.test.tsx src/features/tests/prais-winsten/PraisWinstenTest.test.tsx src/features/tests/prais-winsten/praisInterpretation.test.ts src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx src/features/tests/qui-quadrado/quiQuadradoInterpretation.test.ts src/features/tests/poisson/PoissonTest.test.tsx src/features/tests/poisson/poissonInterpretation.test.ts src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx src/features/tests/binomial-negativa/binomialNegativaInterpretation.test.ts src/features/tests/logistica/LogisticaTest.test.tsx src/features/tests/logistica/logisticaInterpretation.test.ts
npx vitest run src/routes/estatistica/EstatisticaPage.test.tsx src/features/tests/prais-winsten src/features/tests/qui-quadrado src/features/tests/poisson src/features/tests/binomial-negativa src/features/tests/logistica
npm run typecheck
```

Observed result:

- focused red/green rerun: exit code `0`, `11` files passed, `62` tests passed
- broader focused suite: exit code `0`, `16` files passed, `107` tests passed
- `typecheck`: exit code `0`

## Audit

Command:

```bash
rg -n "Pergunta de pesquisa|Pergunta analisada|ResearchQuestionField|researchQuestion|MAX_RESEARCH_QUESTION_LENGTH" src --glob '!**/*.test.*'
```

Observed result:

- exit code `1`
- no matches

Follow-up command:

```bash
rg -n "defaultQuestion" src/features/tests
```

Observed result:

- exit code `1`
- no matches

## Files Changed

- `src/routes/estatistica/EstatisticaPage.test.tsx`
- `src/features/tests/prais-winsten/*`
- `src/features/tests/qui-quadrado/*`
- `src/features/tests/poisson/*`
- `src/features/tests/binomial-negativa/*`
- `src/features/tests/logistica/*`
- deleted `src/features/tests/shared/ResearchQuestionField.tsx`

## What Changed

- Removed `researchQuestion` state, setter wiring, memo dependencies, and interpretation arguments from all five module containers.
- Removed `ResearchQuestionField` usage and props from all five config panels, leaving alpha and existing dataset review controls intact.
- Removed now-unused `defaultQuestion` and `MAX_RESEARCH_QUESTION_LENGTH` exports from the five config files.
- Removed `Pergunta analisada` / `Contexto informado` text from the interpretation builders while preserving the requested statistical wording and warnings.
- Expanded `EstatisticaPage.test.tsx` to cover the five final modules.
- Added meaningful config-step coverage in the module tests by asserting the missing textbox after `Usar exemplo`, not only after sidebar selection.
- Updated result-flow selectors to assert on real conclusion text and explicitly assert the removed sentence is absent.

## Self-Review

- Checked the targeted diff to keep the removal narrow and avoid touching engines, chart presets, alerts, or handoff behavior.
- Confirmed Prais–Winsten still reports period, classification, APC/absolute-change, and rho/beta text after removing the context sentence.
- Confirmed chi-square still reports the two detected variable labels, Cramér's V, and the sparse-cell caution.
- Confirmed Poisson, binomial negativa, and logística still report coefficients/ORs, intervals, deviance, dispersion/rare-event cautions, and the Poisson→NB CTA path.
- Verified the only production `ResearchQuestionField` hit before deletion was the component file itself.

## Concerns

- None after the focused suite, production audit, and `typecheck`.
