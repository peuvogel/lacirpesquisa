# Roadmap: Bioestatística LACIR

## Overview

**v3.0 é corretivo antes de ser aditivo.** O v2.0 entregou as cinco fases planejadas (shell React, 9 testes estatísticos, mapas como interface de análise, catálogo com proveniência), mas o trabalho que veio depois seguiu sem commit e deixou o produto *incorreto*, não apenas incompleto — 20 agravos servem dados de outra doença sob rótulo clínico convincente, o mapa promete 330 agravos e entrega 10, e uma consulta de município devolve 1.000 de 6.481 linhas com HTTP 200.

Um tema une os quatro defeitos, repetido em quatro camadas da pilha: **uma ausência que se parece com um valor.** Uma falha de DNS registrada como `OK · 0 linhas`. Um null coagido a 0 no domínio da escala. Um resultado truncado devolvido como sucesso. Um validador que confere presença e chama isso de correção. Cada fase deste milestone é, de alguma forma, sobre tornar a ausência visível.

**Ordem de build travada (com o porquê):** baseline verde → taxonomia → pipeline + coleta → mapas dinâmicos → fluxo → varredura. A taxonomia precede o pipeline porque o ledger é chaveado por `disease_id` — migrar os ids *antes* da coleta de vários dias, nunca depois. A Fase 9 só precisa entregar o **schema** do `sih_collection_status` (não a coleta completa) para a Fase 10 começar, que é o desacoplamento concreto que impede a Fase 10 de refazer o trabalho da Fase 9 enquanto a coleta longa roda.

**Meta-análise (antiga Fase 6) fica adiada para v3.1** por pedido explícito — primeiro garantir que o resto funcione.

## Phases

**Phase Numbering:**

- Integer phases (7, 8, 9): Planned milestone work
- Decimal phases (8.1, 8.2): Urgent insertions (marked with INSERTED)

Numeração continua do v2.0, que terminou na Fase 6.

- [x] **Phase 7: Baseline verde** - typecheck limpo, suíte inteira passando, gate de CI que impede o vermelho de voltar (completed 2026-07-29)
- [x] **Phase 8: Taxonomia canônica + integridade** - regerar a Lista Morb da fonte oficial, migrar ids no Supabase sem perder linha, validação fail-closed, apelidos clínicos (completed 2026-08-04)
- [ ] **Phase 9: Pipeline confiável + coleta completa** - ledger por agravo × medida × grão, falha ruidosa, retomada; 4 medidas × 330 agravos × UF e município
- [ ] **Phase 10: Mapas dinâmicos sobre Supabase** - choropleth ao vivo para os 330, tri-estado honesto, drill municipal sob demanda, sem truncamento silencioso
- [ ] **Phase 11: Fluxo pesquisa → estatística** - handoff limpo com proveniência preservada e ausentes tratados explicitamente
- [ ] **Phase 12: Varredura de bugs + UAT** - Estatística, Variáveis e Mapas de ponta a ponta em uso didático real

## Phase Details

### Phase 7: Baseline verde

**Goal**: O desenvolvedor consegue distinguir uma regressão nova de dívida herdada — a suíte volta a ser sinal
**Depends on**: Nothing (primeira fase do milestone)
**Requirements**: QA-01, QA-02, QA-03, QA-04
**Success Criteria** (what must be TRUE):

  1. `npm run typecheck` termina sem erros
  2. `npm run test:run` passa integralmente, sem teste marcado como falha conhecida
  3. Os 24 testes que dirigiam o fluxo pelo stepper agora exercitam o layout `scroll` que a aplicação de fato usa, e continuam cobrindo a mesma jornada Dados → Configurar → Resultados
  4. Registrar um teste novo sem ícone próprio não derruba o sidebar
  5. Um gate de CI bloqueia merge com teste vermelho ou typecheck sujo

**Notes**: Nenhum código de produção passa `layout="stepper"` — só `FlowSteps.test.tsx`. Decidir explicitamente se o modo stepper permanece como API pública ou é removido como código morto. `FlaskConical` é usado como fallback em `SidebarTestLink.tsx:53` e nunca importado: hoje é inalcançável porque os 9 ids têm ícone, mas é uma mina para o décimo.

**Plans**: 7 plans (5 waves)

Plans:
**Wave 1**

- [x] 07-01-PLAN.md — Tipagem derivada do registry + os 2 erros de typecheck (QA-01, QA-04)
- [x] 07-02-PLAN.md — Helper de fluxo compartilhado + stub de canvas incondicional

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 07-03-PLAN.md — Remoção do modo stepper e limpeza da API do FlowSteps

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 07-04-PLAN.md — Reescrita scroll: anova-tukey, kruskal-dunn, logistica, binomial-negativa
- [x] 07-05-PLAN.md — Reescrita scroll: poisson, prais-winsten, qui-quadrado, TesteDemo

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 07-06-PLAN.md — Landing/router separado + suíte verde e silenciosa

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 07-07-PLAN.md — Gate: npm run gate, .githooks/ e ci.yml, com prova de bloqueio

**Cross-cutting constraints:**

- Nenhum teste é removido, pulado, marcado `.todo` ou anotado como falha conhecida para chegar ao verde (QA-03)

### Phase 8: Taxonomia canônica + integridade

**Goal**: Nenhum agravo exibe dados de outra doença, e a validação impede que isso volte
**Depends on**: Phase 7 (precisa de suíte verde para provar que a migração não quebrou nada)
**Requirements**: TAX-01, TAX-02, TAX-03, TAX-04, TAX-05, TAX-06
**Success Criteria** (what must be TRUE):

  1. Para os 331 agravos (330 com dado coletado — D-25), `id`, `tabnetCode`, `cid` e `label` são mutuamente consistentes com a Lista Morb CID-10 oficial
  2. A validação falha quando `id ↔ tabnetCode ↔ label` divergem — rodando contra a taxonomia de hoje, ela acusa os 21 registros corrompidos
  3. Depois da migração, `sih_disease` tem 331 linhas (330 com dado coletado — D-25), `sih_metric_uf` 30.313 e `sih_metric_muni` 1.099.403, com integridade referencial conferida antes e depois
  4. A migração é reversível e atravessa os ciclos de renomeação sem violar a chave primária
  5. O estudante encontra "AVC" e chega aos ids canônicos corretos (`infarto_cerebral`, `acid_vascular_cerebr_nao_espec…`), sem que o apelido vire chave de dado
  6. Packs, `variables.json`, seeds SQL e a cópia no bundle são gerados da taxonomia canônica — nenhuma lista mantida à mão em paralelo

**Notes**: Ground truth verificado em `.planning/notes/2026-07-28-taxonomia-corrompida-ground-truth.md` — **nenhum dado precisa ser re-coletado**, `tabnetCode`/`cid`/`label` já concordam entre si; só o slug `id` está errado (emenda datada de 2026-08-03: são 21 ids corrompidos, não 20 — faltava o código 180). Dois ciclos de renomeação (`hemorroidas`↔`outras_doencas_veias`, `embolia_pulmonar`↔`doencas_reumaticas_cronicas`) exigem duas passadas ou constraint deferida. **D-08: não** adicionar `ON UPDATE CASCADE` às FKs — depois desta fase, renomear `disease_id` deixa de ser operação esperada, e CASCADE tornaria fácil fazer em silêncio exatamente o que a fase existe para tornar difícil. O código TabNet 330 ("Todas as outras causas externas") entra na taxonomia como agravo canônico por decisão D-25 — `sih_disease` passa a 331 linhas, com dado coletado permanecendo em 330 (sem métrica associada ao código 330 nesta fase). Consultar `pg_constraint` para os nomes reais das constraints antes de escrever o SQL; nunca adivinhar. Ensaiar fora da tabela viva: é a mudança de maior raio de dano do milestone.

**Plans**: 10 plans (7 waves)

Plans:
**Wave 1**

- [x] 08-01-PLAN.md — Snapshot versionado da Lista Morb, fontes de entrada como dado, invariante C, emenda 330→331 (TAX-01, TAX-06)

**Wave 2** *(blocked on Wave 1)*

- [x] 08-02-PLAN.md — Gerador canônico sem `KNOWN_BY_CODE`, fixture pré-migração, `rename-map.json` computado do diff (TAX-01, TAX-02)

**Wave 3** *(blocked on Wave 2)*

- [x] 08-03-PLAN.md — Invariantes A/B/D/D2 e a prova de TAX-02 contra a fixture pré-migração (TAX-01, TAX-02, TAX-06)
- [x] 08-04-PLAN.md — Motor de renomeação dirigido pelo mapa, gerador de seeds SQL, guarda de tombstone no upload (TAX-06)
- [x] 08-05-PLAN.md — Scaffold `supabase/`, migração up/down gerada do mapa, prova de integridade D-04 (TAX-03, TAX-04)

**Wave 4** *(blocked on Wave 3)*

- [x] 08-06-PLAN.md — FLIP: taxonomia canônica, todo derivado regenerado, invariantes ligados ao gate, invariante F — commit único (TAX-01, TAX-02, TAX-06)

**Wave 5** *(blocked on Wave 4)*

- [x] 08-07-PLAN.md — Apelidos clínicos: `aliases.json`, matcher puro, invariante E, conferência clínica *(checkpoint)* (TAX-05)

**Wave 6** *(blocked on Wave 5)*

- [x] 08-08-PLAN.md — Ensaio local sobre cópia de produção: up → integridade → down → retorno, com medição de custo (TAX-03, TAX-04)
- [x] 08-09-PLAN.md — Apelidos plugados no picker de Mapas, tira explicativa D-18, cobertura em Variáveis (TAX-05)

**Wave 7** *(blocked on Wave 6)*

- [x] 08-10-PLAN.md — `[BLOCKING]` push em produção, verificação de contagens, doc do schema real *(checkpoint)* (TAX-03, TAX-04)

**Cross-cutting constraints:**

- Nesta fase, listas de ids nunca se escrevem à mão: são computadas e a recomputação é afirmada por teste (D-12)
- Renomeação e invariantes entram no mesmo commit — o gate nunca fica vermelho e nenhum invariante nasce com allowlist (D-24)
- O ensaio local (08-08) precede obrigatoriamente o push em produção (08-10)

### Phase 9: Pipeline confiável + coleta completa

**Goal**: O estudante seleciona qualquer um dos 331 agravos e encontra as 4 medidas nos dois grãos — porque a fonte passa a ser o microdado do SIH, não a raspagem de tabela
**Depends on**: Phase 8 (a taxonomia canônica é a chave de agregação do microdado)
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):

  1. A lista de arquivos esperados (`RD{UF}{AA}{MM}`, 27 UFs × 12 meses × N anos) é computada antes do download, e a ausência de qualquer um deles é falha ruidosa com saída não-zero — nunca `OK · 0 linhas`
  2. O operador consulta um ledger por (agravo × medida × grão) que distingue coletado, falhou e nunca tentado — e o app consegue lê-lo
  3. Interromper e reexecutar a coleta continua de onde parou, sem duplicar linhas
  4. O cache bruto só é apagado depois que a contagem de linhas é relida do Supabase e confere
  5. As 4 medidas estão presentes para os **331** agravos no grão UF e no grão município, com `taxa_mortalidade` derivável em todo o catálogo
  6. Cada métrica servida carrega a data em que foi derivada e a versão do mapa CID que a produziu
  7. A agregação reproduz o TabNet nos 85 pares (agravo × UF × ano) que já temos coletados — ou cada categoria divergente tem a razão escrita e a faixa CID corrigida

**Notes**: **Mudança de fonte (spike de 2026-08-04, ver `.planning/notes/2026-08-04-pysus-microdado-spike.md`).** A coleta deixa de raspar o TabNet agravo a agravo e passa a baixar o microdado SIH-RD uma vez (~10 GB para 2013-2025, Brasil inteiro) e agregar localmente com o `lista-morb-cid.json` congelado na Fase 8. Motivo: o scraping atual produziu **424 de 654 CSVs com 0 bytes** e 84 dos 85 agravos com conteúdo trazem só `internacoes` — e com microdado as 4 medidas, os 331 agravos e os dois grãos saem de uma passada só, sem requisição por agravo que possa voltar vazia.

Isto **derruba explicitamente** a decisão anterior de "zero pacotes de terceiros / Python 3.9.6". Pinar `pysus==1.0.1` e **não** a 2.x: a reescrita da 2.0.0 quebrou o índice de arquivos do SIH (devolve um arquivo arbitrário por mês, `group="RD"` vem vazio, arquivos RJ/AIH-rejeitada e SP/serviços-profissionais entram no lugar do RD) — registrar o porquê junto do pin. Requer Python ≥3.10; a máquina já tem 3.11.15 e `uv`.

O critério 7 é o gate de verdade da fase: hoje a agregação bate exato em 31 dos 85 e vem sempre *a mais* (mediana +3,5%). Já descartados por medição: competência×processamento, AIH tipo 5, `N_AIH` duplicado, e erro de agregação do scraper (36.564 pares UF×município conferem sem uma única incoerência). Como um terço bate exato, o desvio está em faixas CID específicas — provavelmente categorias "restante de..." absorvendo o que o TabNet manda para categorias mais estreitas. É depurável categoria a categoria, não difuso.

**Entregar o schema de `sih_collection_status` cedo na fase**, para a Fase 10 poder começar enquanto a coleta roda. Rotacionar o `INGEST_SECRET` hardcoded (ver Riscos). O CR-04 do `08-REVIEW.md` (`uploadSihToSupabase.mjs` lança em diretório com nome de tombstone) cai nesta fase — reavaliar se o caminho de ingest sobrevive à troca de fonte antes de consertá-lo.

**Plans**: 14 planos em 9 ondas

Plans:
**Wave 1**

- [x] 09-01-PLAN.md — Pré-requisitos humanos: credencial Postgres do D-17 e ordem de relevância cirúrgica do D-23 (Onda 1)
- [x] 09-02-PLAN.md — Onda 0 do pipeline Python: projeto `uv` com `pysus==1.0.1`, guarda de caminho ASVS V12, e `npm run gate` fail-closed sobre a suíte Python (Onda 1)
- [x] 09-03-PLAN.md — Schema v3 em produção: dimensão `local`, `sih_collection_status` e as quatro tabelas de população, tudo gerado de `schema-v3.json` (Onda 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 09-04-PLAN.md — Enumeração determinística (SC-1), ledger de arquivo, download com isolamento de falha por arquivo, e o disparo da corrida completa (Onda 2)
- [x] 09-05-PLAN.md — Raspador mínimo do TabNet e o oráculo dos 85 pares re-raspado ao vivo, com os descartes escritos (Onda 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 09-07-PLAN.md — Canonização compartilhada, matcher CID com camada de correção, e a agregação das 4 medidas × 2 grãos × 2 locais (Onda 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 09-06-PLAN.md — População POPSVS 2013–2025 nos dois grãos, com checkpoint de dimensionamento e confirmação da fonte do denominador (Onda 4)
- [x] 09-08-PLAN.md — Depuração do SC-7 categoria a categoria em AC/2019, e a divergência residual como dado com razão escrita (Onda 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 09-09-PLAN.md — As 27 partições de município no Supabase Storage e o consumidor TypeScript com `DecompressionStream` (Onda 5)
- [x] 09-11-PLAN.md — Confirmação em UF grande, checkpoint clínico em lote, e o gate permanente do SC-7 (Onda 5)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 09-10-PLAN.md — `COPY` para staging, swap transacional pelo Session Pooler, e o PIPE-04: cache só some depois da recontagem paginada (Onda 6)

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 09-12-PLAN.md — Conclusão da corrida, ledger de cobertura completo e auditoria com conferência humana (Onda 7)

**Wave 8** *(blocked on Wave 7 completion)*

- [ ] 09-13-PLAN.md — Os 10 packs regerados do dado novo e o corpus legado de 654 CSVs fora do caminho de build (Onda 8)

**Wave 9** *(blocked on Wave 8 completion)*

- [ ] 09-14-PLAN.md — Aposentadoria por remoção: uploader, scrapers, Edge Function, `INGEST_SECRET` e `sih_metric_muni`, mais o contrato documentado (Onda 9)

### Phase 10: Mapas dinâmicos sobre Supabase

**Goal**: O estudante pesquisa qualquer um dos 330 agravos no mapa e o que ele vê é verdade
**Depends on**: Phase 9 (schema do ledger; a coleta completa pode continuar em paralelo)
**Requirements**: MAPA-01, MAPA-02, MAPA-03, MAPA-04, MAPA-05, MAPA-06, MAPA-07, MAPA-08, MAPA-09, MAPA-10
**Success Criteria** (what must be TRUE):

  1. Selecionar qualquer um dos 330 agravos produz dado real, "carregando" ou "ainda não coletamos" — nunca clique morto nem mapa vazio sem explicação
  2. O choropleth em grão UF vem do Supabase ao vivo, e os 10 packs embutidos deixam de ser a fonte
  3. "Sem dado coletado", "zero verdadeiro" e "menor balde" são distinguíveis no mapa e na legenda
  4. Um ausente não vira 0 em lugar nenhum — render, domínio da escala, legenda ou tabela montada
  5. O drill municipal busca sob demanda, com carregamento restrito à região aberta, e redrilhar na mesma sessão não refaz a busca
  6. Um resultado maior que o limite do PostgREST é paginado por completo ou falha alto — nunca truncado em silêncio
  7. Trocar de agravo durante uma busca em voo nunca pinta o dado anterior sob o rótulo novo
  8. Sem Supabase acessível, a interface diz isso
  9. A proveniência da métrica ativa fica visível durante a exploração

**Notes**: Causa raiz é precisa — `taxonomy.ts` valida contra o espaço 330×6 enquanto `catalogAnalysisData.ts` só tem valores para 10 diseases: o seletor e o choropleth leem universos de tamanhos diferentes. A conversão sync→async é limitada, não uma reescrita: só duas chamadas impuras estão dentro do reducer; `choroplethValues` já é `useMemo`. Ordem interna sugerida em 5 ondas (repositório → cache de query → repontar o reducer → drill/handoff → gate) para que nenhuma onda desfaça a anterior. Corrigir o truncamento de `fetchHandoffMetrics.ts` **dentro** deste trabalho — é o mesmo caminho de código. Verificado ao vivo: `content-range: 0-999/6481`. O defeito null-vs-zero está apurado em `.planning/notes/2026-07-28-null-vs-zero-choropleth.md`.

**UI hint**: yes

**Plans**: TBD

### Phase 11: Fluxo pesquisa → estatística

**Goal**: O dado atravessa do mapa até o resultado do teste sem perder proveniência nem ganhar zeros inventados
**Depends on**: Phase 10 (consumidor do repositório unificado, não um esforço paralelo de busca)
**Requirements**: FLUXO-01, FLUXO-02, FLUXO-03, FLUXO-04
**Success Criteria** (what must be TRUE):

  1. A seleção do mapa (território × tempo × agravo × grupo) chega ao teste estatístico com a tabela montada corretamente a partir dos dados ao vivo
  2. A proveniência sobrevive ao handoff e continua visível no resultado do teste, depois que o estudante já saiu do mapa
  3. Ausentes chegam ao módulo estatístico como ausentes, e o módulo declara o que fez com eles — nunca imputa em silêncio
  4. O estudante é avisado quando a comparação montada é frágil (denominador pequeno, taxa instável, inferência agregada)

**Notes**: `ReviewAnalysisDialog.handleConfirm` hoje passa `sourceLabel` como string plana — precisa virar (ou acompanhar) um descritor estruturado que as telas de resultado ainda consigam renderizar. Reaproveitar a família `AssumptionNudgeStrip` já existente para os avisos, com gatilhos novos. Requer a coluna de data de coleta entregue na Fase 9 — dependência cruzada explícita.

**UI hint**: yes

**Plans**: TBD

### Phase 12: Varredura de bugs + UAT

**Goal**: Tudo que o milestone prometeu funciona em uso didático real, exceto meta-análise
**Depends on**: Phase 11
**Requirements**: BUG-01, BUG-02, BUG-03
**Success Criteria** (what must be TRUE):

  1. Os 9 módulos estatísticos rodam de ponta a ponta pelo fluxo atual sem erro
  2. O catálogo de Variáveis navega, filtra e carrega sem rótulo enganoso
  3. O fluxo de Mapas roda de ponta a ponta em UAT com a liga, em condição de aula
  4. Os testes de regressão das fases 8–11 seguem verdes

**Plans**: TBD

## Riscos conhecidos

| Risco | Fase | Mitigação |
|---|---|---|
| Migração de PK em tabela de 1.1M linhas com ciclos de renomeação, sem `ON UPDATE CASCADE` (não adicionada — decisão deliberada, D-08) | 8 | Ensaiar fora da produção; contagem + integridade antes/depois; mapa inverso guardado |
| Coleta de 4 medidas × 330 agravos × 2 grãos é longa e sujeita a interrupção | 9 | Ledger + retomada idempotente são pré-requisito, não melhoria |
| `INGEST_SECRET = "lacir-sih-ingest-2026"` em texto plano em `scrape_upload_sih.py:33`, presente no histórico git a partir de `180e6e3` | 9 | Repositório **não tem remote** — nada foi publicado. Rotacionar o valor no Supabase, mover para variável de ambiente e adicionar varredura de segredo antes de qualquer push |
| Edge Function `sih-ingest` não está versionada no repositório | 9 | Trazer o fonte para o repo com testes; hoje o comportamento do servidor não é revisável |
| Suposição de que o TabNet nunca emite célula `0` explícita (ausência de linha *é* o zero) vem do próprio pipeline, não de spec oficial | 9 | Uma verificação empírica contra o portal antes de travar a lógica null-vs-zero nessa premissa |
| Índice `sih_metric_muni_uf_ano` documentado como intenção, não confirmado aplicado | 9/10 | Verificar ao vivo antes de depender dele para o drill |

## Progress

**Execution Order:**
Phases execute in numeric order: 7 → 8 → 9 → 10 → 11 → 12

| Phase | Plans Complete | Status | Completed |
|-------|-----------------|--------|-----------|
| 7. Baseline verde | 7/7 | Complete   | 2026-07-29 |
| 8. Taxonomia canônica + integridade | 10/10 | Complete    | 2026-08-04 |
| 9. Pipeline confiável + coleta completa | 9/14 | In Progress|  |
| 10. Mapas dinâmicos sobre Supabase | 0/TBD | Not started | - |
| 11. Fluxo pesquisa → estatística | 0/TBD | Not started | - |
| 12. Varredura de bugs + UAT | 0/TBD | Not started | - |

## Milestones anteriores

**v2.0 — Suite estatística + mapas DataSUS** (fases 1–5 completas, 2026-07-25). Fase 6 (Meta-análise) planejada e não iniciada, adiada para v3.1.
