# Bioestatística LACIR

## What This Is

Plataforma didática de bioestatística da LACIR (Liga Acadêmica) para capacitação prática semestral. Ligantes colam dados (ex.: extraídos do DataSUS), escolhem testes estatísticos e recebem gráficos baixáveis, resultados e interpretação breve — sem backend, tudo no cache do navegador.

## Core Value

Tornar a escolha, aplicação e interpretação de testes estatísticos (e mapas DataSUS) fácil, autoexplicativa e pronta para a aula prática da liga.

## Current Milestone: v2.0 Suite estatística + mapas DataSUS

**Goal:** Redesignar o site em React (dark + verde), ampliar a suite de testes e entregar mapas + painel DataSUS — tudo client-side.

**Target features:**
- Redesign dark com detalhes verdes, logo LACIR, UX em abas (React + Vite + Tailwind + shadcn/cult-ui)
- Migrar testes atuais: t de Student, Pearson/Spearman, Prais-Winsten
- Adicionar: qui-quadrado, Poisson, Binomial Negativa, Regressão Logística, ANOVA, Kruskal-Wallis
- **Variáveis no site (scrape/pipeline):** coletar e disponibilizar as variáveis de saúde pública no próprio produto para o usuário analisar sem depender de sites externos na hora da aula — **sempre com referência/proveniência** (fonte, sistema, tabela, período, link/citação)
- **Mapas = interface de análise estatística** (não só launcher): temporalidade, agrupamento de UFs (presets região + macrorregiões de saúde), seleção múltipla de agravos/doenças, território × tempo × grupo → testes didáticos e intuitivos
- Mapas client-side: Brasil por UF + intra-estado (municípios, mesorregiões, regiões/macrorregiões de saúde) com heatmap
- Meta-análise por último: efeito fixo/aleatório + forest plot + I² + funnel plot + asymmetry básica
- Análises e sessão no browser; scrape é pipeline de dados (build/assets), não runtime TABNET na aula

**Build order:** Redesign/base → migrar testes atuais → novos testes → mapas (interface estatística) → variáveis scrapadas + catálogo com referências → meta-análise

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

### Active

<!-- Scoped in REQUIREMENTS.md for v2.0 -->

- [ ] Redesign React dark/verde com abas e UX didática
- [ ] Suite estatística ampliada (qui-quadrado + GLM/contagem + logística + ANOVA/Kruskal)
- [ ] Mapas como interface de testes: temporalidade, presets regionais, macrorregiões de saúde, multi-doença
- [ ] Pipeline de scrape/curadoria das variáveis no site + catálogo com referência obrigatória em cada variável
- [ ] Meta-análise didática (fixo/aleatório, forest, I², funnel, asymmetry)
- [ ] Persistência de sessão de análise apenas em memória/cache do navegador

### Out of Scope

- Backend / API server / banco de dados de sessão — deferred; análises continuam client-side
- Login, contas de usuário, salvar projetos na nuvem — próximo ciclo
- Embutir JASP ou runtime R no browser — JASP é só referência de comportamento/cálculo
- Scraping runtime ao vivo do TABNET durante a aula (ToS/instabilidade) — scrape é offline/pipeline com assets versionados + referências
- Suite bayesiana completa ou módulos JASP avançados além do escopo de meta-análise definido

## Context

- Capacitação prática semestral na LACIR: aula teórica intercalada com exercícios; ligantes aprendem a extrair dados do DataSUS e aplicar/interpretar testes.
- MVP vibecodado (~1 ano): `index.html` + `assets/` + `tests/{t-student,correlacao,prais-winsten}` + `tests-manifest.json`.
- Referência open source: `jasp-desktop-development/` (ZIP do JASP) para fórmulas, fluxos e outputs esperados.
- Artefato de pesquisa: `trabalhos datasus/GUIA_MAPEAMENTO_DADOS_DISPONIVEIS.md` + builds/catálogos de TABNET, e-Gestor, Atlas, etc.
- UI: tema predominantemente dark com poucos detalhes em verde; preservar logo da liga (`logo lacir.png`).
- Componentes: shadcn MCP + registry cult-ui; mapas via componentes/registry shadcn map quando aplicável.
- Qui-quadrado é ensinado na capacitação mas ainda não existe no MVP — incluir neste milestone.

## Constraints

- **Client-only**: Sem backend neste milestone — dados e estado no cache do navegador; refresh perde o trabalho.
- **Stack**: React + Vite + Tailwind + shadcn/ui + cult-ui; mapas com GeoJSON client-side.
- **Didático**: Interpretação breve e autoexplicativa; priorizar clareza para estudantes de medicina sobre densidade estatística.
- **Brand**: Dark + verde pontual; logo LACIR preservada.
- **Performance**: Cálculos e mapas devem rodar no browser em datasets típicos de capacitação (não big data).
- **Referência JASP**: Usar como oráculo de comportamento; não portar a UI QML/R do JASP.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Reescrever em React + Vite + Tailwind + shadcn/cult-ui | cult-ui/shadcn exigem ecossistema React; redesign profundo justifica rewrite | — Pending |
| Mapas 100% client-side (GeoJSON + parser de UF/siglas/nomes) | Sem backend; “API” = módulo JS interno | — Pending |
| Mapas = interface de análise estatística (não só research launcher) | Temporalidade + grupos de UF/presets + macrorregiões de saúde + multi-doença; didático | — Pending (decisão 2026-07-25) |
| Variáveis scrapadas/curadas no site com referência obrigatória | Usuário analisa sem sites externos na aula; proveniência sempre visível | — Pending (decisão 2026-07-25) |
| Scrape via pipeline/assets versionados (não runtime TABNET) | Evita ToS/instabilidade em aula; dados + metadados de fonte no bundle | — Pending (decisão 2026-07-25) |
| Meta-análise: fixo/aleatório + forest + I² + funnel + asymmetry básica | Suficiente para capacitação; suite JASP completa estoura escopo | — Pending |
| Incluir qui-quadrado neste milestone | Ensinado na capacitação; faltava no MVP | — Pending |
| Mapas intra-estado: municípios + mesorregiões + regiões/macrorregiões de saúde | Ligantes fazem estudos estaduais (ex.: Bahia) com granularidade útil | — Pending |
| Meta-análise por último na ordem de build | Depende de base sólida de UI/testes/mapas | — Pending |
| Sem login/backend de sessão neste milestone | Foco em valor didático e entrega; auth depois | — Pending |
| Reutilizar lógica/fórmulas do JASP (e do MVP) — não reinventar engines | `jasp-desktop-development/` e testes v1.0 são oráculo e fonte de algoritmos; esforço do milestone vai para UI didática, interpretação PT e UX | — Pending |

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
*Last updated: 2026-07-25 — pivot: variáveis scrapadas + mapa como interface estatística*
