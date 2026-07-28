# Phase 7: Baseline verde - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-28
**Phase:** 7-baseline-verde
**Areas discussed:** Destino do modo stepper, Como reescrever os 23 testes, Landing do / (router.test), Gate sem remote

**Diagnóstico rodado antes da discussão:** `npm run typecheck` (2 erros), `npx vitest run` (24 falhas / 652 passando, 18,7s), `npm run build` (vermelho — `tsc -b` para nos mesmos 2 erros). Ausência de `.github/workflows/`, de husky, de `core.hooksPath` e de remote git confirmadas por inspeção.

---

## Destino do modo stepper

### O que acontece com o modo `layout="stepper"`?

| Option | Description | Selected |
|--------|-------------|----------|
| Remover como código morto | Apaga o ramo stepper, o prop `layout` e os 5 testes de stepper. Menos superfície para os testes divergirem do app. | ✓ |
| Manter como API pública | Prop e testes continuam; os 23 migram para scroll mesmo assim. | |
| Marcar @deprecated e remover na 12 | Mantém com aviso e agenda remoção. | |

**User's choice:** Remover como código morto
**Notes:** O ROADMAP pedia essa decisão explicitamente. Nenhum código de produção passa `layout="stepper"` — só `FlowSteps.test.tsx`.

### Até onde vai a remoção?

| Option | Description | Selected |
|--------|-------------|----------|
| Limpeza completa da API | Sai o ramo, o prop `layout`, o prop `onStepChange` (morto nos 10 call sites), `FLOW_STEP_LABELS` e o import de `Check`. | ✓ |
| Só o ramo stepper | Mantém `onStepChange` na assinatura para não tocar os 10 módulos. | |
| Você decide durante o plano | Alcance a critério do planner. | |

**User's choice:** Limpeza completa da API
**Notes:** Verificado por grep antes de perguntar: `FLOW_STEP_LABELS` tem zero usos fora do ramo stepper; `onStepChange` é passado por 10 arquivos e nunca invocado no ramo scroll.

### A cobertura do scroll em FlowSteps.test.tsx cresce junto?

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, cobrir o contrato do scroll | resultados com canAdvance false; `aria-label`/`id` da seção; efeito scrollIntoView. | ✓ |
| Manter só os 2 existentes | Fase só remove e faz passar. | |
| Você decide | Planner escolhe os casos. | |

**User's choice:** Sim, cobrir o contrato do scroll
**Notes:** Regra derivada: o componente não sai da fase com cobertura líquida menor do que entrou.

### A ausência de caminho não-destrutivo de volta ao painel de colagem é aceita?

| Option | Description | Selected |
|--------|-------------|----------|
| Aceito — é o comportamento atual | O stepper era inalcançável; removê-lo não tira caminho de ninguém. | ✓ |
| Anotar para a varredura da Fase 12 | Aceito agora, registrado como ideia adiada. | |
| Corrigir agora na Fase 7 | Adicionar caminho não-destrutivo. | |

**User's choice:** Aceito — é o comportamento atual
**Notes:** Verificado que `ClearDataButton` (destrutivo, com diálogo) existe nos 9 módulos e no demo. Registrado como ideia adiada mesmo assim, por ser questão didática real.

### Que guarda estrutural impede esse tipo de deriva de voltar?

| Option | Description | Selected |
|--------|-------------|----------|
| A própria remoção basta | Sem o prop `layout` não existe segunda realidade que o teste possa dirigir. | ✓ |
| Remoção + teste de fumaça por módulo | Percorrer o TEST_REGISTRY montando cada módulo pelo caminho real. | |
| Remoção + regra escrita no CLAUDE.md | Documentar a convenção. | |

**User's choice:** A própria remoção basta
**Notes:** Guarda por construção, não por convenção — mesma lógica dos outros defeitos do milestone.

---

## Como reescrever os 23 testes

### Como os 23 testes são reescritos?

| Option | Description | Selected |
|--------|-------------|----------|
| Helper compartilhado em src/test/ | Os 9 arquivos convergem para um idioma; próxima mudança toca 1 arquivo. | ✓ |
| Inline em cada arquivo | Legível isoladamente, replica o idioma 23 vezes. | |
| Helper só onde repete literalmente | Meio-termo com dois idiomas convivendo. | |

**User's choice:** Helper compartilhado em src/test/
**Notes:** Ressalva levantada antes da escolha e aceita: uma abstração compartilhada é o que criou o problema atual, mas um helper que só toca `Usar exemplo` e `Analisar dados` dirige o caminho real de produção e não tem como divergir dele.

### O que substitui `aria-current="step"` como prova de que chegou em Resultados?

| Option | Description | Selected |
|--------|-------------|----------|
| A região Resultados | `findByRole('region', { name: 'Resultados' })` — landmark que o app já renderiza. | ✓ |
| Conteúdo didático dos resultados | Esperar por 'O que isso significa?' / 'Baixar todos'. | |
| data-testid dedicado | Adicionar marcação só-para-teste. | |

**User's choice:** A região Resultados
**Notes:** `<section aria-label="Resultados">` expõe `role="region"` por ter nome acessível — nada precisa mudar no componente.

### Qual passa a ser o sinal de "o dado carregou"?

| Option | Description | Selected |
|--------|-------------|----------|
| O próprio botão Analisar dados | Só existe depois que o `configurar` monta — esperar por ele já é a prova. | ✓ |
| A tabela de preview das colunas | Nem todo módulo mostra preview do mesmo jeito. | |
| Você decide por arquivo | Sinal caso a caso. | |

**User's choice:** O próprio botão Analisar dados
**Notes:** Elimina a espera intermediária em vez de traduzi-la.

### O ruído do console entra no escopo do baseline verde?

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, zerar os dois | 21 act(...) corrigidos; 190 do canvas silenciados por stub em setup.ts, sem dep nova. | ✓ |
| Só o que a reescrita resolver | Deixa o resto. | |
| Fora de escopo — fica para a Fase 12 | Registra como ideia adiada. | |
| Zerar e travar: console.error falha o teste | Torna ruído novo impossível de ignorar. | |

**User's choice:** Sim, zerar os dois
**Notes:** A quarta opção foi apresentada com o risco explícito de derrubar a suíte por avisos legítimos de terceiros nas Fases 8–12, e não foi escolhida — mas ficou registrada como ideia adiada.

---

## Landing do / (router.test)

### O que `/` mostra?

| Option | Description | Selected |
|--------|-------------|----------|
| t-Student, e o teste passa a dizer isso | Nenhum código de produção muda. | ✓ |
| Landing neutra Estatística, de propósito | `activeTestId` vazio + estado de entrada. | |
| t-Student agora, avaliar em UAT na Fase 12 | Igual à primeira, com ideia adiada registrada. | |

**User's choice:** t-Student, e o teste passa a dizer isso
**Notes:** Achado apresentado antes da pergunta e que mudou o enquadramento: o heading "Estatística" nunca foi intencional — `activeTestId` iniciava em `'demo'`, ausente do TEST_REGISTRY, então o fallback `?? 'Estatística'` é que disparava. Verificado por `git log -L` que a troca para `'t-student'` entrou em `180e6e3`. A D-04 da Fase 1 é sobre a rota, não sobre o heading, então nenhuma decisão travada foi contrariada. A landing neutra ficou registrada como ideia adiada para a Fase 12.

### O que fazer com o fallback `?? 'Estatística'`?

| Option | Description | Selected |
|--------|-------------|----------|
| Tipar o id contra o registry | Id inexistente vira erro de typecheck. | ✓ |
| Manter como rede de segurança | Heading degrada em vez de sumir. | |
| Você decide | Planner escolhe. | |

**User's choice:** Tipar o id contra o registry
**Notes:** Mesmo padrão que o QA-04 aplica ao ícone — os dois fallbacks inalcançáveis da fase recebem uma solução só. Nota registrada: `handleSelectTest` e `handleCrossTestHandoff` recebem ids de fora e continuam guardados por `isTestAvailable`.

### O que o router.test passa a asseverar em `/`?

| Option | Description | Selected |
|--------|-------------|----------|
| A rota e o teste padrão | Duas asserções distinguíveis: D-04 e o padrão atual. | ✓ |
| Só o heading 't de Student' | Continua acoplado à cópia do registry. | |
| Só a rota (D-04) | Deixa o teste padrão sem cobertura. | |

**User's choice:** A rota e o teste padrão

### Como o fixture de MapAnalysisState é consertado?

| Option | Description | Selected |
|--------|-------------|----------|
| Espalhar a fábrica de produção | `{ ...createInitialMapAnalysisState(), ... }` — herda o estado inicial real. | ✓ |
| Completar os dois campos à mão | Diff mínimo; próximo campo quebra de novo. | |
| Fábrica dedicada em src/test/fixtures/ | Aplicada também aos outros 6 arquivos. | |

**User's choice:** Espalhar a fábrica de produção
**Notes:** `createInitialMapAnalysisState()` já existe em produção (`mapAnalysisState.ts:199`). A terceira opção virou ideia adiada para a Fase 10.

---

## Gate sem remote

### Onde vive o gate?

| Option | Description | Selected |
|--------|-------------|----------|
| Hook local + workflow do Actions | `.githooks/` + `core.hooksPath` protege hoje; `ci.yml` vale no dia do remote. | ✓ |
| Só hook local | Evita arquivo inerte; gate de merge fica para depois. | |
| Só workflow do Actions | Literal ao SC#5, mas 100% inerte sem remote. | |

**User's choice:** Hook local + workflow do Actions
**Notes:** Tensão apresentada antes da pergunta: sem remote, `git push` nunca acontece, então um `pre-push` seria tão inerte quanto o Actions — só o `pre-commit` dispara hoje. Husky descartado por ser dependência npm nova, contra a regra da Fase 5.

### Como o gate é definido e acionado?

| Option | Description | Selected |
|--------|-------------|----------|
| Um `npm run gate`, três gatilhos | Uma definição chamada por pre-commit, pre-push e Actions. | ✓ |
| Escalonado por gatilho | pre-commit só typecheck; suíte no push e no Actions. | |
| Só pre-commit, com tudo | Sem pre-push. | |

**User's choice:** Um `npm run gate`, três gatilhos
**Notes:** Suíte medida em 18,7s; com typecheck o portão fica em ~25s, custo aceitável por commit atômico do executor.

### O que o `npm run gate` executa?

| Option | Description | Selected |
|--------|-------------|----------|
| typecheck + test:run + build | O `vite build` pega asset/import/JSON quebrado que o typecheck não pega. | ✓ |
| typecheck + test:run | O mínimo que o SC#5 pede. | |
| typecheck + test:run agora, build no Actions | Build fica sem gate durante o milestone. | |

**User's choice:** typecheck + test:run + build
**Notes:** Achado apresentado antes da pergunta: `npm run build` está vermelho hoje — `tsc -b` para nos mesmos 2 erros e o `vite build` nunca roda. Fato não registrado no ROADMAP. Nota de implementação registrada: `test:run` já encadeia `catalog:validate` e `build` já roda `tsc -b`, então o gate não deve rodar `tsc` duas vezes.

### O hook de pre-commit roda sempre?

| Option | Description | Selected |
|--------|-------------|----------|
| Pular quando só toca .planning/ | Commits de doc do GSD ficam instantâneos; pre-push e Actions rodam sempre. | ✓ |
| Rodar sempre | Regra mais simples, ~30s por commit de docs. | |
| Pular quando não toca src/ nem scripts/ | `package.json` e `vite.config.ts` escapariam. | |

**User's choice:** Pular quando só toca .planning/

---

## Claude's Discretion

- **QA-04 (fallback de ícone do sidebar):** apresentado como discricionário na abertura e não contestado — ícone exigido pelo tipo do registry + fallback em runtime + teste que registra entrada sem ícone.
- Nome e assinatura do helper de teste em `src/test/`.
- Estrutura interna de `.githooks/` e do `ci.yml` (versão do Node, cache, matriz).
- Como compor o `npm run gate` sem duplicar o `tsc`.
- Ordem das ondas de execução dentro da fase.
- Como derivar o tipo de `activeTestId` a partir do `TEST_REGISTRY`.

## Deferred Ideas

- Landing neutra "Estatística" com estado de entrada — avaliar em UAT na Fase 12.
- Caminho não-destrutivo de volta ao painel de colagem — Fase 12.
- `console.error` inesperado derrubando o teste — reconsiderar quando o milestone estabilizar.
- Fábrica de teste `makeMapAnalysisState(overrides)` aplicada aos outros 6 arquivos — Fase 10.
- Varredura de segredo antes de push (`INGEST_SECRET`) — Fase 9, conforme a tabela de Riscos do ROADMAP; o `.githooks/` desta fase cria onde ela vai morar.
