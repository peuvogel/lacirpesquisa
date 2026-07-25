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
- Mapas client-side: Brasil por UF + intra-estado (municípios, mesorregiões, regiões de saúde) com heatmap e reconhecimento de nomes/siglas
- Painel de variáveis DataSUS/fontes públicas classificadas com links diretos
- Meta-análise por último: efeito fixo/aleatório + forest plot + I² + funnel plot + asymmetry básica
- Estado só no cache do navegador; sem login/backend neste milestone

**Build order:** Redesign/base → migrar testes atuais → novos testes → mapas → painel DataSUS → meta-análise

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
- [ ] Mapas Brasil/UF + intra-estado com heatmap
- [ ] Painel catálogo DataSUS/fontes com classificação de variáveis e links
- [ ] Meta-análise didática (fixo/aleatório, forest, I², funnel, asymmetry)
- [ ] Persistência apenas em memória/cache do navegador

### Out of Scope

- Backend / API server / banco de dados — deferred; milestone é 100% client-side
- Login, contas de usuário, salvar projetos na nuvem — próximo ciclo
- Embutir JASP ou runtime R no browser — JASP é só referência de comportamento/cálculo
- Download massivo automático de bases DataSUS — o painel mapeia e linka; coleta continua no TABNET/portais
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
| Meta-análise: fixo/aleatório + forest + I² + funnel + asymmetry básica | Suficiente para capacitação; suite JASP completa estoura escopo | — Pending |
| Incluir qui-quadrado neste milestone | Ensinado na capacitação; faltava no MVP | — Pending |
| Mapas intra-estado: municípios + mesorregiões + regiões de saúde | Ligantes fazem estudos estaduais (ex.: Bahia) com granularidade útil | — Pending |
| Meta-análise por último na ordem de build | Depende de base sólida de UI/testes/mapas | — Pending |
| Sem login/backend neste milestone | Foco em valor didático e entrega; auth depois | — Pending |

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
*Last updated: 2026-07-25 — milestone v2.0 started*
