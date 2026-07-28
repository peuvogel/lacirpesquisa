# Phase 7: Baseline verde - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Tornar a suíte um sinal confiável de novo: `npm run typecheck` limpo, os 676 testes verdes sem nenhuma falha "conhecida", `npm run build` voltando a funcionar, e um portão que impeça o vermelho de retornar durante as Fases 8–12.

**Ground truth medido em 2026-07-28** (antes de qualquer decisão desta discussão):

- `npm run typecheck` → 2 erros
  - `src/routes/estatistica/SidebarTestLink.tsx:53` — `FlaskConical` usado sem import
  - `src/routes/mapas/ReviewAnalysisDialog.test.tsx:67` — fixture de `MapAnalysisState` sem `sharedTime` e `periodScope`
- `npx vitest run` → **24 falhas / 652 passando** (9 arquivos de 95), duração 18,7s
- `npm run build` → **também vermelho**; `tsc -b` para nos mesmos 2 erros e o `vite build` nunca chega a rodar (fato não registrado no ROADMAP)
- Ruído: 21 avisos de `act(...)` (todos dentro dos 24 que falham) e 190 de `HTMLCanvasElement.getContext` do jsdom
- Não existe `.github/workflows/`, não existe husky, `core.hooksPath` não está configurado, e **o repositório não tem remote**

**Correção ao enunciado do ROADMAP:** os 24 não têm uma causa só. **23** falham pelo mesmo motivo (dirigem o fluxo pela nav do stepper: clicam `Configurar`/`Resultados` e conferem `aria-current="step"`, marcação que só existe em `layout="stepper"`). O 24º, `src/app/router.test.tsx:40`, tem outra causa, detalhada em D-08.

**Fora de escopo:** taxonomia (Fase 8), pipeline e coleta (Fase 9), mapas dinâmicos (Fase 10), fluxo pesquisa→estatística (Fase 11), varredura de UAT (Fase 12). **A Fase 7 não muda comportamento de produção** — só remove código morto, alinha os testes ao que a aplicação de fato faz, e instala o portão.

</domain>

<decisions>
## Implementation Decisions

### Destino do modo `stepper` (ROADMAP pede decisão explícita)

- **D-01:** O modo `layout="stepper"` é **removido como código morto**. Nenhum código de produção o alcança — só `FlowSteps.test.tsx`. Menos superfície para os testes das Fases 8–12 divergirem do que a aplicação faz.
- **D-02:** Remoção é **limpeza completa da API**, não só do ramo. Saem de `src/shared/flow/FlowSteps.tsx`:
  - o bloco `if (layout === 'stepper')` (linhas 56–94)
  - o prop `layout`
  - o prop `onStepChange` — nunca invocado no ramo scroll, portanto morto nos 10 call sites (`src/features/tests/*/`, `src/routes/estatistica/demo/TesteDemo.tsx`). O `setActiveStep` interno de cada módulo permanece onde ainda for necessário; só deixa de ser repassado.
  - `FLOW_STEP_LABELS` (usado apenas dentro do ramo stepper — verificado por grep, zero usos externos)
  - o import de `Check` do lucide-react
  - `effectiveCanAdvance` — o override `dados: true` existia só para a nav; o scroll lê apenas `configurar` e `resultados`
- **D-03:** A cobertura de scroll em `FlowSteps.test.tsx` **cresce** para compensar os 5 testes de stepper que saem. Casos a cobrir, além dos 2 existentes:
  - resultados aparecem quando `active === 'resultados'` mesmo com `canAdvance.resultados === false`
  - a seção carrega `aria-label="Resultados"` e `id="lacir-flow-results"`
  - o efeito de `scrollIntoView` dispara ao chegar em resultados

  Regra: o FlowSteps não pode sair da fase com cobertura líquida menor do que entrou.
- **D-04:** A ausência de caminho **não-destrutivo** de volta ao painel de colagem (hoje só via "Limpar dados", com diálogo de confirmação, presente nos 9 módulos e no demo) é **aceita como está**. O stepper era inalcançável, então removê-lo não retira caminho de ninguém.
- **D-05:** A guarda contra a recorrência da deriva é **a própria remoção** — sem o prop `layout` deixa de existir uma segunda realidade que o teste possa dirigir. Guarda por construção, não por convenção. Nada de teste de fumaça extra nem de regra escrita no CLAUDE.md para isso.

### Reescrita dos 23 testes para o layout scroll

- **D-06:** A reescrita usa um **helper compartilhado em `src/test/`** (diretório que já hospeda os oracles compartilhados: `legacyStatsOracle.ts`, `praisModuleOracle.ts`, `correlacaoModuleOracle.ts`, `tStudentModuleOracle.ts`). Os 9 arquivos convergem para um idioma só; a próxima mudança de fluxo toca 1 arquivo em vez de 23.

  Ressalva registrada e aceita: uma abstração compartilhada é o que criou o problema atual. A diferença é que o helper só aciona interações reais de produção (`Usar exemplo`, `Analisar dados`), então não tem como divergir do que a aplicação faz.
- **D-07:** Idioma novo do helper — o antigo tinha 5 passos, o novo tem 3:

  | Passo antigo (stepper) | Passo novo (scroll) |
  |---|---|
  | `click('Usar exemplo')` / paste | igual |
  | `waitFor(getByRole('button',{name:'Configurar'})).not.toBeDisabled()` | **eliminado** |
  | `click('Configurar')` (nav) | **eliminado** |
  | `click('Analisar dados')` | precedido de `await screen.findByRole('button', { name: 'Analisar dados' })` — o botão só existe depois que o `configurar` monta, então esperar por ele **é** a prova de que o dado carregou |
  | `expect(getByRole('button',{name:'Resultados'})).toHaveAttribute('aria-current','step')` | `await screen.findByRole('region', { name: 'Resultados' })` |

  A `<section aria-label="Resultados">` expõe `role="region"` por ter nome acessível — nenhuma marcação só-para-teste é adicionada, e a asserção quebra se alguém tirar o rótulo da seção. O `advanceTimersByTimeAsync` do debounce de parse permanece onde já existe.
- **D-08:** Ruído do console **entra no escopo** — suíte verde **e muda**:
  - os 21 avisos de `act(...)` estão todos dentro dos 24 testes tocados; o que não sair de graça com a reescrita é corrigido
  - os 190 avisos de `HTMLCanvasElement.getContext`/`toDataURL` são silenciados por stub em `src/test/setup.ts`. **Sem dependência npm nova** (nada de pacote `canvas`) — respeita a regra de zero deps herdada da Fase 5.
  - **Não** fazer `console.error` derrubar teste: risco de quebrar a suíte por avisos legítimos de terceiros nas Fases 8–12.

### Landing do `/` e o segundo erro de typecheck

- **D-09:** Achado que redefine o problema: o heading "Estatística" em `/` **nunca foi intencional**. Desde a Fase 1 o `activeTestId` iniciava em `'demo'`, que **não está no `TEST_REGISTRY`** — então `getTestById('demo')` devolvia `undefined` e o fallback `?? 'Estatística'` disparava. O teste `router.test.tsx:40` achava que asseverava a D-04 da Fase 1 e asseverava o fallback. O trabalho pós-Fase-5 trocou o padrão para `'t-student'` (entrada real do registry, mudança capturada em `180e6e3`), o fallback parou de disparar e o heading virou "t de Student".

  A D-04 da Fase 1 diz "Landing route = **Estatística**" — é sobre a **rota**, não sobre o texto do heading. `/` continua sendo Estatística nos dois caminhos; nenhuma decisão travada está em jogo.
- **D-10:** **t-Student permanece o teste padrão** e o teste passa a dizer isso. Nenhum código de produção muda — coerente com o princípio de que a Fase 7 não muda comportamento.
- **D-11:** O fallback `?? 'Estatística'` (`EstatisticaPage.tsx:122`) é **eliminado por tipagem**: `activeTestId` passa a ser um tipo derivado do `TEST_REGISTRY`, de modo que um id inexistente vira **erro de typecheck** em vez de heading silenciosamente trocado. Mesma forma exata do `FlaskConical` que o ROADMAP chama de "mina para o décimo" — um fallback inalcançável escondendo uma classe de bug.

  Fronteira de runtime preservada: `handleSelectTest` e `handleCrossTestHandoff` recebem ids de fora (estado de rota, handoff do mapa) e continuam guardados por `isTestAvailable`.
- **D-12:** O `router.test.tsx` passa a asseverar **duas coisas distinguíveis**: (a) `/` renderiza a Estatística — a decisão travada D-04 da Fase 1, via landmark da página ou `data-active-test-id`; (b) o teste ativo padrão é `t-student` — o comportamento atual. Quando uma quebrar, dá para saber qual.
- **D-13:** O fixture de `MapAnalysisState` em `ReviewAnalysisDialog.test.tsx:67` é consertado **espalhando a fábrica de produção**: `{ ...createInitialMapAnalysisState(), groups, activeGroupId, provenance: 'catalog' }`. Herda o estado inicial real, não pode divergir dele, e campo novo obrigatório nunca mais o quebra — paga sozinho na Fase 10, que vai mexer bastante nesse estado.
- **D-14 (QA-04, discricionário confirmado pelo usuário):** O ícone faltante no sidebar recebe o **mesmo padrão da D-11** — ícone exigido pelo tipo do registry (typecheck pega no momento do cadastro) **mais** fallback em runtime **mais** um teste que registra uma entrada sem ícone e prova que o sidebar não cai.

### Gate

- **D-15:** O gate vive em **dois lugares**:
  - `.githooks/` versionado, ativado por `core.hooksPath` (hoje não configurado). **Sem dependência npm nova** — husky seria pacote novo, contra a regra herdada da Fase 5. `.git/hooks` não serve: não é versionado.
  - `.github/workflows/ci.yml` versionado, que passa a valer no minuto em que existir remote.

  Razão: o SC#5 fala em "bloqueia merge", e só o workflow bloqueia merge de verdade — mas **o repositório não tem remote**, então sem o hook local o gate ficaria 100% inerte durante todo o milestone.
- **D-16:** **Uma definição, três gatilhos.** Um único script npm — `npm run gate` — é chamado por `pre-commit`, `pre-push` e pelo workflow do Actions. Nenhum dos três pode divergir dos outros. Mesmo princípio da D-05.
- **D-17:** `npm run gate` executa **typecheck + test:run + build**. O `vite build` pega o que o typecheck não pega — resolução de asset, import quebrado, JSON malformado — o que importa diretamente nas Fases 8–12 (packs, seeds, `variables.json`, variáveis de ambiente). E o build está vermelho hoje: verificá-lo faz parte de "baseline verde".

  Nota de implementação: `test:run` já encadeia `catalog:validate` (D-10 da Fase 5), e `build` já roda `tsc -b`, que produz exatamente os mesmos erros que `tsc --noEmit`. O planner deve compor o gate sem rodar `tsc` duas vezes.
- **D-18:** O `pre-commit` **pula quando todos os arquivos staged estão sob `.planning/`** — o executor do GSD commita documentação com frequência e um gate de ~25–30s por commit de docs é custo puro. `pre-push` e o workflow do Actions rodam **sempre, sem exceção**, então a exceção local nunca deixa código passar.

### Claude's Discretion

- Nome e assinatura exatos do helper de teste em `src/test/` (ex.: `runToResultados(user, options)`), e se ele devolve a região de Resultados ou apenas resolve.
- Estrutura interna de `.githooks/` e do `ci.yml` (versão do Node, cache de dependências, matriz).
- Como o `npm run gate` compõe os passos sem duplicar o `tsc`.
- Ordem das ondas de execução dentro da fase (sugestão natural: typecheck → remoção do stepper → reescrita dos 23 + helper → landing/router → ruído do console → gate).
- Como derivar o tipo de `activeTestId` a partir do `TEST_REGISTRY` (union literal, `satisfies`, ou tipo derivado do array).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planejamento

- `.planning/ROADMAP.md` — Fase 7: goal, 5 success criteria, e a nota que pede decisão explícita sobre o stepper e alerta sobre o `FlaskConical`
- `.planning/REQUIREMENTS.md` §"Baseline / Saúde do código" — QA-01 a QA-04
- `.planning/PROJECT.md` §"Estado herdado do v2.0 (diagnóstico 2026-07-28)" — os quatro defeitos do milestone e o parágrafo sobre os 24 testes e os 2 erros de typecheck
- `.planning/phases/01-redesign-base-react-shell/01-CONTEXT.md` — **D-04 ("Landing route = Estatística") e D-05 (sidebar colapsável)**; contexto indispensável para a D-09/D-12 acima
- `.planning/phases/05-variaveis-no-site-scrape-referencias/05-CONTEXT.md` — D-10 (`catalog:validate` encadeado em `test:run`); a regra de zero dependências npm novas vem desta fase

### Código a modificar

- `src/shared/flow/FlowSteps.tsx` — ramo stepper nas linhas 56–94; API a limpar (D-02)
- `src/shared/flow/FlowSteps.test.tsx` — 5 testes de stepper saem, cobertura de scroll cresce (D-03)
- `src/routes/estatistica/SidebarTestLink.tsx:53` — `FlaskConical` sem import (QA-04, D-14)
- `src/routes/estatistica/EstatisticaPage.tsx:89,122` — `useState('t-student')` e o fallback `?? 'Estatística'` (D-10, D-11)
- `src/app/router.test.tsx:40` — asserção a reescrever (D-12)
- `src/routes/mapas/ReviewAnalysisDialog.test.tsx:67` — fixture a consertar (D-13)
- `src/routes/mapas/mapAnalysisState.ts:199` — `createInitialMapAnalysisState()`, a fábrica a espalhar (D-13)
- `src/features/tests/registry.ts` — 9 ids; `'demo'` **não** está registrado (origem da D-09)
- `src/test/setup.ts` — stub de canvas (D-08)

### Os 9 arquivos de teste a reescrever

- `src/features/tests/anova-tukey/AnovaTukeyTest.test.tsx` (3 falhas)
- `src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx` (3)
- `src/features/tests/kruskal-dunn/KruskalDunnTest.test.tsx` (3)
- `src/features/tests/logistica/LogisticaTest.test.tsx` (3)
- `src/features/tests/poisson/PoissonTest.test.tsx` (4)
- `src/features/tests/prais-winsten/PraisWinstenTest.test.tsx` (3)
- `src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx` (2)
- `src/routes/estatistica/demo/TesteDemo.test.tsx` (2)
- `src/app/router.test.tsx` (1 — causa distinta, ver D-09)

### Arquivos a criar

- `.githooks/pre-commit` e `.githooks/pre-push` (D-15, D-16, D-18)
- `.github/workflows/ci.yml` (D-15)
- helper de fluxo em `src/test/` (D-06, D-07)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/test/` já é o lar dos helpers compartilhados (4 oracles) — o helper de fluxo tem precedente e lugar natural
- `createInitialMapAnalysisState()` já existe e é o que a produção usa — o fixture pode herdar dela em vez de reinventar
- `TEST_REGISTRY` é fonte única para sidebar e modal (decisão da Fase 1) — é o que torna a tipagem da D-11/D-14 possível
- `ClearDataButton` já existe nos 9 módulos e no demo, com diálogo de confirmação — é o caminho de volta que sobra depois da D-01

### Established Patterns

- Scripts npm compostos por encadeamento (`test:run` = `catalog:validate && vitest run`) — o `gate` segue a mesma forma
- **Zero dependências npm novas** para trabalho de feature (Fase 5) — decide contra husky e contra o pacote `canvas`
- Testes de módulo montam o componente com `SessionProvider` e mockam `chart.js` via `vi.hoisted` — o helper precisa conviver com esse setup e com `vi.useFakeTimers({ shouldAdvanceTime: true })`
- Cópia em PT-BR nos rótulos que os testes consultam (`Usar exemplo`, `Analisar dados`, `Limpar dados`, `Resultados`)

### Integration Points

- `FlowSteps` é consumido por 10 módulos — a D-02 toca todos eles
- `EstatisticaPage` recebe ids de fora por `location.state` (handoff de Variáveis e de Mapas) — a fronteira que a D-11 precisa preservar
- O gate se conecta ao git por `core.hooksPath`, que ainda não está configurado — a ativação faz parte da entrega, não é pressuposto

</code_context>

<specifics>
## Specific Ideas

- O usuário escolheu consistentemente a opção que **elimina a possibilidade do bug** em vez da que o documenta ou o amortece: remover o prop em vez de depreciá-lo (D-01), tipar em vez de manter rede (D-11), uma definição de gate em vez de três (D-16). É o mesmo princípio que o ROADMAP do milestone enuncia — "tornar a ausência visível" — aplicado à camada de ferramentas.
- Recusou explicitamente as duas opções que ampliariam a fase para mudança de UX: nenhum caminho não-destrutivo novo de volta aos dados (D-04), nenhuma landing neutra (D-10). **Fase 7 estabiliza, não redesenha.**
- Recusou também a opção mais agressiva de ruído (`console.error` derrubando teste), aceitando zerar o ruído sem travá-lo — reconhecendo que as Fases 8–12 vão introduzir avisos de terceiros.

</specifics>

<deferred>
## Deferred Ideas

- **Landing neutra "Estatística"** com estado de entrada (escolher teste / abrir o "Qual teste?") em vez de abrir direto no t-Student — questão didática real (abrir num teste específico sugere que ele é a escolha padrão, o que corta contra a pedagogia do "Qual teste?"), mas é mudança de UX. Avaliar em UAT com a liga na **Fase 12**.
- **Caminho não-destrutivo de volta ao painel de colagem** — hoje só via "Limpar dados", que é destrutivo e confirmado por diálogo. Avaliar em uso didático real na **Fase 12**.
- **`console.error`/`console.warn` inesperado derrubando o teste** — transformaria ruído novo em falha imediata; adiado por risco de quebrar a suíte com avisos legítimos de terceiros durante as Fases 8–12. Reconsiderar quando o milestone estabilizar.
- **Fábrica de teste dedicada `makeMapAnalysisState(overrides)`** aplicada aos outros 6 arquivos que montam esse estado (`SessionProvider.test.tsx`, `SelectionSummaryStrip.test.tsx`, `GroupBar.test.tsx`, `mapAnalysisState.test.ts`, `GroupConfigPanel.test.tsx`, `SharedPeriodPanel.test.tsx`) — a D-13 resolve só o arquivo quebrado. Candidato natural para a **Fase 10**, que vai remexer esse estado.
- **Varredura de segredo antes de push** (`INGEST_SECRET` em texto plano, no histórico a partir de `180e6e3`) — o `.githooks/` desta fase cria a infraestrutura onde ela vai morar, mas a varredura em si é escopo da **Fase 9**, conforme a tabela de Riscos do ROADMAP.

</deferred>

---

*Phase: 07-baseline-verde*
*Context gathered: 2026-07-28*
