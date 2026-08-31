# Task 2 — Integração temporal e validação Prais–Winsten

## Status

Implementada na branch `codex/results-interactions`, sobre a base `f9efa616c21932bba5b628a364b65a273091ccf4`.

## Implementação

- `TabularInputOptions` agora aceita `temporalKeys`; fallback posicional, identificação de bindings e validade da tabela tratam essas chaves com `isSupportedTemporalToken`, mantendo `numericKeys` somente para números.
- As sugestões de tipo em `TableDocument` e `ColumnPreviewTable` reconhecem rótulos temporais semânticos, como `2024-S1`, sem classificar medidas numéricas curtas como tempo.
- A configuração Prais associa aliases de semestre/trimestre/mês/data, marca `tempo` como temporal e mantém apenas `variavel_y` como numérica.
- O Prais resolve a coluna temporal uma vez, mantendo `temporal.values[rowIndex]` alinhado às linhas de origem. Os rótulos brutos seguem nas linhas, `coordinate` alimenta o modelo e `timePeriodIndex` preserva a grade de períodos para validação.
- `PraisBuiltDataset` expõe a resolução temporal, issues estruturadas, frequência e base de efeito. `validateSeriesIssues` é a API estruturada; `validateSeries` permanece um adaptador de mensagens bloqueantes.
- Desfechos ausentes, inválidos e negativos viram issues com números de linha. A retirada de uma linha de desfecho inválido mantém a lacuna da sequência temporal restante.
- Em séries numéricas regulares, índices discretos são normalizados para validar lacunas sem alterar a coordenada numérica usada pelo modelo.

## Arquivos alterados

- `src/shared/data-input/types.ts`
- `src/shared/data-input/parseTabular.ts`
- `src/shared/data-input/tableDocument.ts`
- `src/shared/data-input/analysisTable.ts`
- `src/routes/estatistica/ColumnPreviewTable.tsx`
- `src/features/tests/prais-winsten/praisConfig.ts`
- `src/features/tests/prais-winsten/praisEngine.ts`
- Testes correspondentes em `tableDocument`, `analysisTable`, `praisEngine` e o fixture tipado de `praisInterpretation`.

## RED / GREEN

1. RED — a colagem literal de 12 semestres falhou: `frequencyLabel` era `undefined`.
   GREEN — 12 observações, frequência `Semestral`, coordenadas `2021`, `2021.5`, `2022` e nenhum issue bloqueante.
2. RED — `2024-S1` era sugerido como categórico e `2024-X9` passava pela validade da tabela.
   GREEN — o primeiro é temporal, e o segundo é listado como linha inválida para a chave temporal.
3. RED — ao excluir o desfecho inválido da linha 2, as linhas restantes não tinham `timePeriodIndex`.
   GREEN — a issue `invalid_outcome` aponta a linha 2 e a lacuna residual é identificada entre as linhas 1 e 3.

## Comandos e resultados

```text
npm exec vitest run -- src/features/tests/prais-winsten/praisEngine.test.ts -t "user semester"
RED: 1 falha esperada; `frequencyLabel` recebido como undefined.

npm exec vitest run -- src/shared/data-input/tableDocument.test.ts src/shared/data-input/analysisTable.test.ts
RED: 2 falhas esperadas; tipo categórico para semestre e token temporal inválido aceito.

npm exec vitest run -- src/features/tests/prais-winsten/praisEngine.test.ts -t "invalid outcome"
RED: 1 falha esperada; `timePeriodIndex` ausente.

npm exec vitest run -- src/shared/data-input/temporalPeriods.test.ts src/shared/data-input/tableDocument.test.ts src/shared/data-input/analysisTable.test.ts src/features/tests/prais-winsten/praisEngine.test.ts
GREEN: 4 arquivos, 53 testes aprovados.

npm run typecheck
GREEN: `tsc --noEmit` concluído sem erros.
```

Não foi executado `npm run gate`, em conformidade com a restrição de espaço em disco.

## Self-review

- Mantido o quinto parâmetro `resolved` em `tableValiditySummary`; `temporalKeys` é o sexto.
- A escolha explícita chega ao motor por `temporalMode` e substitui o modo automático.
- Não houve imputação de períodos/valores, conversão de ausentes para zero, alteração de fórmulas estatísticas, pipeline, Docker, deploy ou push.
- A API de documentos/tabela manteve seus campos existentes; não foram antecipados resumos ou diagnósticos das Tasks 4–6.

## Concerns

- A seleção de `temporalMode` já é aceita pelo motor, mas a interface para o usuário escolhê-la explicitamente pertence à migração posterior de UI; esta tarefa não a antecipou.

## Fix round 1/5

### Findings corrigidos

- `runAnalysis` agora é a fronteira de autorização: consulta `validateSeriesIssues`, lança o primeiro erro bloqueante e não chama Prais–Winsten quando houver issue `error`.
- Issues de sequência da coluna completa (`temporal_missing_period` e `temporal_duplicate_period`) são removidas da validação final e substituídas por gaps/duplicidades calculados somente com `orderedRows` e `timePeriodIndex` após a exclusão de desfechos inválidos.
- `ColumnPreviewTable.test.tsx` agora cobre a classificação de `2024-S1`/`2024-S2`, a linha `2024-X9` inválida na validade e a precedência de tipo e vínculo explicitamente escolhidos pelo usuário.

### Arquivos

- `src/features/tests/prais-winsten/praisEngine.ts`
- `src/features/tests/prais-winsten/praisEngine.test.ts`
- `src/routes/estatistica/ColumnPreviewTable.test.tsx`
- `.superpowers/sdd/2026-08-31-importacao-periodos-confiaveis/task-2-report.md`

### RED / GREEN

1. RED — três datasets bloqueantes (lacuna, duplicidade e desfecho inválido) ainda retornavam resultado de `runAnalysis`; o spy de `statsEngine.praisWinsten` registrava chamada.
   GREEN — `runAnalysis` lança antes do cálculo e o spy não registra chamadas.
2. RED — após excluir o desfecho da linha 2, a issue de lacuna ainda vinha da coluna completa (`temporal_missing_period`, linhas 2 e 3).
   GREEN — a issue efetiva é `missing_period`, linhas 1 e 3; uma duplicidade cuja linha duplicada foi excluída não continua como issue de duplicidade.
3. A primeira asserção de UI procurou texto dividido por elementos e falhou por seletor; foi corrigida para consultar a região semântica `Validade das linhas` e então verificou o conteúdo real.

### Comandos e resultados

```text
npm exec vitest run -- src/features/tests/prais-winsten/praisEngine.test.ts -t "does not run Prais|reconciles temporal|does not retain a duplicate"
RED: 2 falhas esperadas — `runAnalysis` não lançava e `temporal_missing_period` permanecia.

npm exec vitest run -- src/features/tests/prais-winsten/praisEngine.test.ts
GREEN: 14 testes aprovados.

npm exec vitest run -- src/routes/estatistica/ColumnPreviewTable.test.tsx
GREEN: 14 testes aprovados.

npm run typecheck
GREEN: `tsc --noEmit` concluído sem erros.
```

### Self-review

- A guarda usa as mesmas `AnalysisIssue` estruturadas expostas pelo dataset e preserva `validateSeries` como adaptador legado de mensagens bloqueantes.
- A reconciliação deixa intactos erros temporais que não são de sequência, como token inválido ou frequência mista, e remove somente lacuna/duplicidade calculadas na coluna bruta.
- Não foram incluídas mudanças de higiene, gate, Docker, pipeline ou o Minor ledgerado para etapa posterior.
