# Catalog pipeline (Phase 5 / CAT-05)

Offline normalize of tracked `trabalhos datasus/` coletas into versioned assets under `public/data/catalog/`.

## Commands

```bash
npm run catalog:build      # CSV + metadata → manifest / variables / packs
npm run catalog:validate   # D-05 schema + orphan + pack column checks (plan 05-02)
```

Zero new npm dependencies — Node ESM + stdlib only.

## Package-first path (D-03)

1. Prefer packaging the already-validated CSVs in:
   - `trabalhos datasus/outputs/coleta_embolia_trombose_uf/`
   - `trabalhos datasus/outputs/coleta_vascular_amputacao/`
2. Run `npm run catalog:build` and commit `public/data/catalog/*`.
3. Re-scrape only if validation fails or you explicitly refresh sources.

## Regenerate coletas (optional)

`BASE_DIR` in both `coleta_*.py` scripts resolves to the repo’s `trabalhos datasus/` folder (`Path(__file__).resolve().parents[1]`).

```bash
python3 "trabalhos datasus/scripts/coleta_embolia_trombose_municipio_uf.py"
python3 "trabalhos datasus/scripts/coleta_vascular_amputacao.py"
npm run catalog:build
```

Requires network access to TABNET/SIDRA. Not needed when packaged CSVs already validate.

## Known gaps

- **2023 population:** SIDRA denominator rule leaves 2023 without official pop → rates/densities must stay JSON `null` (UI: `n/d`). Do not invent values.
- **lacir_projetos:** reference-only (no pack) — spreadsheet is not tidy UF×ano.
- Text columns (`lista_morb_cid10`, `metodo_sih`, `populacao_fonte`, `cnes_competencia`, `procedimento_sih`) are not loadables; notes fold into provenance.

## Layout

| Path | Role |
|------|------|
| `paths.mjs` | Repo root + allowlisted corpus paths |
| `parseCsv.mjs` | UTF-8 BOM strip; empty → `null` |
| `columnMap.json` | packId → columnKey → CatalogEntry seeds |
| `reference-seed.json` | Curated `loadable: false` rows (complete D-05) |
| `build.mjs` | Atomic write to `public/data/catalog/` |
