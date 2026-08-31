# Task 7 — QA local e verificação de regressões

Data: 2026-08-31
Branch: `codex/results-interactions`
URL local: http://127.0.0.1:5173/
Servidor confirmado: PID 62999, Vite desta workspace (`--host 127.0.0.1`).

## Varredura estática

Comando:

```bash
rg -n "Portal DATASUS|Lembrar neste dispositivo|Salvo neste dispositivo|Pergunta de pesquisa|Pergunta analisada|ResearchQuestionField|setPersistenceEnabled|persistenceEnabled" src --glob '!**/*.test.*'
```

Resultado: nenhum resultado (exit 0 por `|| true` para registrar a ausência).

Estado inicial:

```text
## codex/results-interactions
 M src/app/Header.tsx
```

O único ajuste pendente era comentário obsoleto no `Header.tsx`, removendo a referência a Portal DATASUS exigida pela auditoria de fonte. Ele foi preservado e incluído no commit local.

## Bateria direcionada

Comando executado conforme o brief, cobrindo persistência, shell/sidebar, relatório/resultados, customização de gráficos e os dez módulos:

```bash
npx vitest run \
  src/shared/session/SessionPersistence.test.tsx \
  src/routes/estatistica/EstatisticaPage.test.tsx \
  src/routes/estatistica/Sidebar.test.tsx \
  src/routes/estatistica/resultReport.test.ts \
  src/routes/estatistica/ResultsPanel.test.tsx \
  src/shared/charts/ResultsPanelWithCustomizer.test.tsx \
  src/features/tests/t-student src/features/tests/anova-tukey \
  src/features/tests/kruskal-dunn src/features/tests/mann-whitney \
  src/features/tests/correlacao src/features/tests/prais-winsten \
  src/features/tests/qui-quadrado src/features/tests/poisson \
  src/features/tests/binomial-negativa src/features/tests/logistica
```

Resultado inicial: **36 test files passed, 235 tests passed**.

Após a correção responsiva e o teste de regressão da Sidebar: **36 test files passed, 236 tests passed**.

## Gate completo

Comando final:

```bash
npm run gate
```

Resultado: **passou**.

- `catalog:validate OK` — provenance gate passed.
- `pipeline:test` passou.
- O fixture de pipeline imprime o diagnóstico esperado de DBC corrompido (`RDAC1301.dbc ... implausible header size 0`) sem falhar o teste.
- Vitest completo: **172 test files, 1.357 tests passed** (1 skip conforme suíte).
- `tsc -b` passou.
- `vite build` passou, com o aviso conhecido de chunks acima de 500 kB.

O hook de commit também executou `npm run gate` e passou integralmente.

## QA no navegador local

Foi criada e usada uma aba local separada no Codex In-app Browser; a aba existente do GitHub Pages não foi substituída.

### 1440×1000

- Cabeçalho exibiu LACIR, Estatística, Meta-análise, Variáveis e Mapas; não exibiu Portal DATASUS nem painel de persistência.
- Barra lateral permaneceu `position: sticky`, top 64 px, durante scroll longo (`scrollY=734`); a navegação interna tem `overflow-y: auto`, `min-h-0` e altura limitada.
- `document.documentElement.scrollWidth` permaneceu 1440, sem overflow horizontal.
- Todos os dez botões de testes abriram seus módulos, sem campo/texto de pergunta (`Pergunta de pesquisa`, `Pergunta analisada` ou `ResearchQuestionField`).
- t de Student com **Usar exemplo** e **Analisar dados** produziu: médias 4,90 e 6,00; diferença −1,10; IC95% −1,35 a −0,85; `t = -9,526`, `gl = 12,00`, `p < 0,001`; Cohen’s `d = -5,09`, muito grande.
- Métrica “Média de Grupo A” cresceu no hover de transform identidade para `matrix(1.02, 0, 0, 1.02, 0, 0)` e recebeu foco por teclado (`tabindex=0`).
- Gráfico de diferença cresceu discretamente no hover (canvas 400×420 para aproximadamente 407,2×427,6), sem recorte; os controles Editar, Ampliar e Baixar permaneceram presentes.
- **Copiar tudo** anunciou “Copiado”. A leitura segura do clipboard retornou título, seção Resultados e seção Interpretação; não continha as linhas brutas da tabela.
- Mann–Whitney, usando as duas colunas do exemplo, mostrou Grupo A `n=7` e Grupo B `n=7`; após confirmação visível de independência executou e mostrou Estatística U, Efeito por postos e interpretação.

### 390×844

- Layout compacto exibiu sidebar recolhida, ícones de todos os dez testes e conteúdo sem overflow horizontal (`scrollWidth=390`).
- Ao expandir manualmente a sidebar, a primeira inspeção reproduziu um defeito: a linha flex passava a 442 px e comprimía o conteúdo.
- Correção aplicada: em viewport estreita, sidebar expandida usa overlay `position: fixed`, top 64 px, z-index 40; a lista mantém altura fixa e `overflow-y: auto`.
- Após a correção, sidebar expandida permaneceu visível durante scroll de página (`scrollY=500`, top=64), `scrollWidth=390` e sem overflow horizontal.
- Screenshot pós-correção confirmou a lista expandida sobre o conteúdo, sem ampliar a página.

## Persistência e limpeza (somente comportamento visível)

- Após carregar o exemplo, `reload` restaurou a tabela, valores (`4,8`, `6,1`, etc.), bindings Grupo A/Grupo B e preferência de significância 5%.
- **Limpar tabela** retornou ao estado “Cole ou envie seus dados”; após novo `reload`, nenhuma linha foi restaurada.
- Uma alteração posterior visível via textarea (`Grupo A;Grupo B` com 1/2, 3/4, 5/6) mostrou “Dados reconhecidos”; novo `reload` restaurou os seis valores e a origem “colado”.
- Não foram inspecionados cookies, localStorage, session stores ou qualquer armazenamento interno.

## Movimento reduzido e limitações

- A folha de estilos contém `@media (prefers-reduced-motion: reduce)` removendo escalas/transições dos cartões de métricas e gráficos e animações de entrada/saída; `ChartCanvas` usa a mesma media query para `animation: false`.
- O Browser control disponível nesta sessão não expõe emulação de `prefers-reduced-motion`; portanto essa parte foi validada por estrutura CSS, código e testes unitários existentes, não por emulação real do media feature.

## Correção e commits

Defeito encontrado: sidebar expandida manualmente em mobile criava overflow horizontal. Correção mínima: classe semântica `lacir-stat-sidebar`, regra CSS narrow-screen para overlay fixo e um teste de regressão em `Sidebar.test.tsx`.

Commit local:

```text
46418cf fix: polish local statistics interactions
```

Arquivos incluídos: `src/app/Header.tsx`, `src/index.css`, `src/routes/estatistica/Sidebar.tsx` e `src/routes/estatistica/Sidebar.test.tsx`.

Este relatório foi criado após a verificação e será incluído em um commit local separado. Não houve push, PR, deploy ou alteração da publicação GitHub Pages.

## Fix round 1 — regressão direta do contrato CSS

Finding addressed: the prior regression only checked the component marker class and could pass with the actual overlay rule removed or broken.

Covering files:

- `src/routes/estatistica/Sidebar.test.tsx`: reads the real `src/index.css` and asserts the narrow media query, exact `.lacir-stat-sidebar[data-state='expanded']` selector, `position: fixed`, `top: 4rem`, `z-index: 40`, and `max-width: 100vw` non-overflow safeguard.
- `src/index.css`: adds `max-width: 100vw` to the mobile expanded overlay contract.

TDD evidence: before the CSS declaration was added, the focused test failed with `expected ... to match /max-width:\s*100vw/`; after the declaration:

```bash
npx vitest run src/routes/estatistica/Sidebar.test.tsx && npm run typecheck
```

```text
Test Files  1 passed (1)
Tests       15 passed (15)
npm run typecheck — passed (tsc --noEmit)
```

The round-1 changes are included in the local fix commit; no push, deploy, PR, or GitHub Pages modification was performed.
