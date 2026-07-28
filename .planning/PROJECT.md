# Bioestatística LACIR

## What This Is

Plataforma didática de bioestatística da LACIR (Liga Acadêmica) para capacitação prática semestral. Ligantes pesquisam agravos do DataSUS direto no mapa, carregam os dados na suite estatística, escolhem testes e recebem gráficos baixáveis, resultados e interpretação breve — com a base de dados da liga hospedada no Supabase.

## Core Value

Tornar a escolha, aplicação e interpretação de testes estatísticos (e mapas DataSUS) fácil, autoexplicativa e pronta para a aula prática da liga.

## Current Milestone: v3.0 Dados confiáveis + pesquisa dinâmica via Supabase

**Goal:** Tornar todo o produto (exceto meta-análise) correto e funcional, com os 330 agravos do DataSUS coletados, íntegros no Supabase e pesquisáveis dinamicamente do mapa até os testes estatísticos.

**Target features:**
- **Baseline verde:** typecheck limpo, suíte de testes passando, working tree commitado — pré-condição para verificar qualquer correção
- **Taxonomia canônica:** regerar a Lista Morb CID-10 a partir da fonte oficial (1 slug por código TabNet), migrar os ids no Supabase, e expor apelidos clínicos curados (ex.: "AVC" → infarto cerebral + AVC não especificado). Validação *fail-closed* que impede `id ↔ tabnetCode ↔ label` divergentes de voltar
- **Pipeline de coleta confiável:** ledger por agravo × medida × grão, retry com backoff, falha ruidosa (nunca gravar "OK · 0 linhas"), retomada idempotente, nunca apagar cache bruto antes de confirmar o upload
- **Coleta completa:** 4 medidas (Internações, Óbitos, Valor_total, Dias_permanência) × 330 agravos × grãos UF **e** município
- **Mapas dinâmicos:** choropleth ao vivo do Supabase para qualquer um dos 330 agravos, drill-down municipal sob demanda, cache e estados de carregamento/vazio honestos
- **Fluxo de pesquisa limpo:** mapa (território × tempo × agravo × grupo) → tabela montada → testes estatísticos, com proveniência preservada até o resultado
- **Varredura de bugs** em toda a superfície entregue (Estatística, Variáveis, Mapas) — meta-análise fora de escopo

**Build order:** baseline verde → taxonomia/integridade → pipeline confiável + coleta completa → mapas dinâmicos sobre Supabase → fluxo pesquisa→estatística → varredura de bugs e UAT

**Adiado deste milestone:** Fase 6 (Meta-análise) permanece planejada e não iniciada; volta em v3.1.

## Requirements

### Validated

<!-- Shipped in vibecoded MVP (v1.0 baseline) -->

- ✓ Calculadora modular com navegação por testes — v1.0
- ✓ t de Student com input de dados e resultados — v1.0
- ✓ Correlação Pearson/Spearman com gráficos Chart.js — v1.0
- ✓ Prais-Winsten para séries temporais — v1.0
- ✓ Branding LACIR (logo + header) e link Portal DATASUS — v1.0
- ✓ Stack Vite + JS modular + Chart.js (baseline a ser substituído) — v1.0
- ✓ Mapeamento de variáveis públicas de saúde (guia + catálogos em `trabalhos datasus/`) — v1.0 research artifact

<!-- Shipped in v2.0 (phases 1-5) -->

- ✓ Redesign React dark/teal com header Estatística | Meta-análise | Variáveis | Mapas — v2.0 Phase 1
- ✓ Fluxo compartilhado Dados → Configurar → Resultados + export PNG + leave warning — v2.0 Phase 1
- ✓ t de Student, Pearson/Spearman, Prais-Winsten migrados com paridade v1.0 — v2.0 Phase 2
- ✓ Qui-quadrado, ANOVA/Tukey, Kruskal/Dunn, Poisson, Binomial Negativa, Logística + nudges de pressupostos — v2.0 Phase 3
- ✓ Mapas como interface estatística: choropleth UF, drill-down, temporalidade, grupos/presets, multi-agravo — v2.0 Phase 4
- ✓ Catálogo de variáveis com proveniência obrigatória + handoff para Estatística/Mapas — v2.0 Phase 5

### Active

<!-- Scoped in REQUIREMENTS.md for v3.0 -->

- [ ] Baseline verde: typecheck limpo e suíte de testes passando como gate de CI
- [ ] Taxonomia canônica da Lista Morb CID-10 + apelidos clínicos, com validação fail-closed de `id ↔ tabnetCode ↔ label`
- [ ] Migração dos ids de agravo no Supabase (`sih_disease`, `sih_metric_uf`, `sih_metric_muni`) sem perder linhas
- [ ] Pipeline de coleta confiável: ledger, retry, falha ruidosa, retomada idempotente
- [ ] Coleta completa: 4 medidas × 330 agravos × grãos UF e município
- [ ] Mapas dinâmicos servidos pelo Supabase para os 330 agravos, com drill municipal sob demanda
- [ ] Fluxo mapa → tabela → teste estatístico limpo, com proveniência preservada
- [ ] Varredura de bugs em Estatística, Variáveis e Mapas
- [ ] Meta-análise didática (fixo/aleatório, forest, I², funnel, asymmetry) — **adiado para v3.1**

### Out of Scope

- **Meta-análise** — explicitamente fora deste milestone; Fase 6 permanece planejada para v3.1
- Login, contas de usuário, salvar projetos na nuvem — próximo ciclo (Supabase entra só como fonte de dados de pesquisa, com anon/RLS de leitura)
- Embutir JASP ou runtime R no browser — JASP é só referência de comportamento/cálculo
- Scraping runtime ao vivo do TABNET durante a aula (ToS/instabilidade) — coleta continua offline; o app lê o Supabase, nunca o TabNet
- Suite bayesiana completa ou módulos JASP avançados
- Escrita pelo cliente no Supabase — o app é somente-leitura; ingestão só via service role no pipeline offline

## Context

- Capacitação prática semestral na LACIR: aula teórica intercalada com exercícios; ligantes aprendem a extrair dados do DataSUS e aplicar/interpretar testes.
- MVP vibecodado (~1 ano): `index.html` + `assets/` + `tests/{t-student,correlacao,prais-winsten}` + `tests-manifest.json`.
- Referência open source: `jasp-desktop-development/` (ZIP do JASP) para fórmulas, fluxos e outputs esperados.
- Artefato de pesquisa: `trabalhos datasus/GUIA_MAPEAMENTO_DADOS_DISPONIVEIS.md` + builds/catálogos de TABNET, e-Gestor, Atlas, etc.
- UI: tema predominantemente dark com poucos detalhes em verde; preservar logo da liga (`logo lacir.png`).
- Componentes: shadcn MCP + registry cult-ui; mapas via componentes/registry shadcn map quando aplicável.

### Estado herdado do v2.0 (diagnóstico 2026-07-28)

O trabalho pós-Fase-5 foi vibecodado sem commit e chegou ao v3.0 com quatro defeitos conhecidos, capturados no commit de baseline `180e6e3`:

1. **Taxonomia corrompida** — 20 agravos em `scripts/catalog/diseases.json` têm `id`, `label` e `tabnetCode` desalinhados. `avc` aponta para o código 163 ("Outras doenças do olho e anexos"); `embolia_pulmonar` para 182; `varizes_mmii` para 185. Os dados coletados estão corretos **para o código consultado** — o que está errado é o nome. Contaminou `sql/*.sql`, o Supabase `sih_disease`, `src/features/catalog/diseases.lista.json`, os 10 packs em `public/data/catalog/packs/` e os rótulos em `variables.json`.
2. **Coleta incompleta** — apenas `Internações` cobre os 330 agravos (30.313 linhas UF / 1.099.403 município). `Óbitos`, `Valor_total` e `Dias_permanência` existem para 5 agravos (2.160 linhas UF). `taxa_mortalidade` é derivada de Óbitos, logo indisponível em ~98% do catálogo.
3. **Pipeline silencioso** — falhas de DNS foram registradas como sucesso (`OK <agravo>: 0 UF rows · 0 muni rows`), o upload gravou 0 linhas e o cache bruto foi apagado em seguida. Não há marcador `.done` nem ledger de retomada.
4. **Mapa não dinâmico** — o seletor lista os 330 agravos via `taxonomy.ts`, mas o choropleth lê apenas os 10 packs importados estaticamente em `catalogAnalysisData.ts`. O Supabase só é consultado no handoff (`ReviewAnalysisDialog` → `fetchHandoffMetricLookup`).

Além disso: 24 testes falhando em 9 arquivos (o default do `FlowSteps` mudou de `stepper` para `scroll`, removendo os botões de navegação que os testes acionam) e 2 erros de typecheck (`FlaskConical` não importado em `SidebarTestLink.tsx`; `MapAnalysisState` sem `sharedTime`/`periodScope` em `ReviewAnalysisDialog.test.tsx`).

### Infraestrutura Supabase

- Projeto `hmfbxqemububjyhdckrj` (org LACIR). Tabelas `sih_disease`, `sih_metric_uf`, `sih_metric_muni` com RLS de select para anon.
- App lê com `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; ingestão usa `SUPABASE_SERVICE_ROLE_KEY` apenas no pipeline offline.
- Contrato e esquema em `docs/SUPABASE-CATALOG.md`.

## Constraints

- **Supabase é a fonte de dados de pesquisa**: substitui o "client-only" do v2.0 para os dados do catálogo. O app permanece **somente-leitura** (anon + RLS); nenhuma credencial de serviço no bundle. A sessão de análise continua em memória do navegador.
- **Degradação honesta**: sem Supabase configurado ou offline, o app precisa dizer isso na interface — nunca pintar um mapa vazio como se fosse dado real.
- **Stack**: React + Vite + Tailwind + shadcn/ui + cult-ui; mapas com GeoJSON/TopoJSON client-side (assets offline permanecem bundled — só as métricas vêm da rede).
- **Didático**: Interpretação breve e autoexplicativa; priorizar clareza para estudantes de medicina sobre densidade estatística.
- **Brand**: Dark + verde pontual; logo LACIR preservada.
- **Performance**: Cálculos e mapas devem rodar no browser em datasets típicos de capacitação (não big data).
- **Referência JASP**: Usar como oráculo de comportamento; não portar a UI QML/R do JASP.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Reescrever em React + Vite + Tailwind + shadcn/cult-ui | cult-ui/shadcn exigem ecossistema React; redesign profundo justifica rewrite | ✓ Validado — v2.0 Phase 1 |
| Mapas = interface de análise estatística (não só research launcher) | Temporalidade + grupos de UF/presets + macrorregiões de saúde + multi-doença; didático | ✓ Validado — v2.0 Phase 4 |
| Variáveis scrapadas/curadas no site com referência obrigatória | Usuário analisa sem sites externos na aula; proveniência sempre visível | ✓ Validado — v2.0 Phase 5 |
| Reutilizar lógica/fórmulas do JASP (e do MVP) — não reinventar engines | `jasp-desktop-development/` e testes v1.0 são oráculo e fonte de algoritmos | ✓ Validado — v2.0 Phases 2-3 |
| ~~Mapas 100% client-side~~ → **Supabase como fonte de dados de pesquisa** | 330 agravos × UF+município (1.1M linhas) estouram o bundle Vite; a liga precisa de uma base compartilhada. Substitui a decisão "sem backend" do v2.0 | — Pending (decisão 2026-07-28) |
| Regerar taxonomia canônica a partir da Lista Morb oficial + apelidos clínicos | 20 agravos têm `id ↔ código ↔ rótulo` desalinhados; ids legados (avc, ait, varizes_mmii) ficaram como slots de códigos errados. Slug canônico por código é verificável; apelidos preservam os nomes didáticos que a liga usa | — Pending (decisão 2026-07-28) |
| Migrar ids no Supabase em vez de re-coletar os 20 | Os dados coletados estão corretos para o código consultado — só a nomenclatura está errada. Re-coletar descartaria 1.1M linhas válidas | — Pending (decisão 2026-07-28) |
| Coleta completa: 4 medidas × 330 agravos × UF **e** município | Taxa de mortalidade e custo são medidas centrais da capacitação; sem Óbitos elas ficam indisponíveis em 98% do catálogo | — Pending (decisão 2026-07-28) |
| Pipeline falha ruidosamente e nunca apaga cache antes de confirmar upload | A corrida overnight registrou falhas de DNS como `OK · 0 linhas` e apagou o bruto — perda silenciosa de dados | — Pending (decisão 2026-07-28) |
| App somente-leitura no Supabase (anon + RLS); service role só offline | Nenhum segredo de escrita no bundle Vite; ingestão é responsabilidade do pipeline | — Pending (decisão 2026-07-28) |
| Meta-análise adiada para v3.1 | Pedido explícito: primeiro garantir que o resto funcione sem bugs | — Pending (decisão 2026-07-28) |
| Baseline verde antes de qualquer correção | Com 24 testes vermelhos não há como distinguir regressão nova de dívida herdada | — Pending (decisão 2026-07-28) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-28 — milestone v3.0: dados confiáveis + pesquisa dinâmica via Supabase*
