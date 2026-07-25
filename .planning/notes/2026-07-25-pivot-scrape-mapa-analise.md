# Pivot: variáveis no site + mapa como interface estatística

**Date:** 2026-07-25  
**Source:** user direction mid-milestone v2.0

## Decisions locked

1. **Scraping / curadoria de variáveis no produto** — o usuário deve conseguir analisar no site sem depender de TABNET/portais externos durante a aula.
2. **Referência obrigatória** — toda variável mostra de onde vem (fonte, sistema, tabela/indicador, período, URL/citação). Nunca dado órfão.
3. **Scrape = pipeline offline/versionado** (build-time assets), não scraping runtime ao vivo.
4. **Mapas = interface de testes estatísticos**, não só research launcher:
   - Temporalidade (período / comparação temporal)
   - Agrupar UFs + presets (Norte, Nordeste, Centro-Oeste, Sudeste, Sul)
   - Macrorregiões de saúde
   - Seleção múltipla de doenças/agravos
   - Combinação território × tempo × grupo × agravos → testes
   - UX o mais didática e intuitiva possível

## Docs updated

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md` (MAP-06..10, CAT-02 rewrite, CAT-04/05)
- `.planning/ROADMAP.md` (Phases 4–5 rewritten)
- `.planning/STATE.md` (decisions logged)

## Does not change now

- Phase 2 human UAT still next
- Phase 3 (novos testes) still before maps/catalog
