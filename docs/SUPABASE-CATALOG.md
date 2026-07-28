# Supabase catalog backend (LACIR)

## Why

Bundling ~330 Lista Morb diseases × UF × município in the Vite client exhausts memory.
The didactic app should keep **metadata + small UF series** local (or fetched lean), and
put **município grain + full measure matrix** in Supabase.

Project: `hmfbxqemububjyhdckrj` (org LACIR).

## Current local progress (checkpoint · 2026-07-25 ~23:45)

| Item | Status |
|------|--------|
| Disease taxonomy (Lista Morb CID-10) | 330 in `diseases.json` **and** seeded in Supabase `sih_disease` |
| Catalog UF packs in `public/data/catalog/packs` | 10 vascular (keep lean in Vite) |
| Scrape UF+muni CSVs | ~9+ in `coleta_sih_multi` (Internações-first pass running) |
| Supabase tables | `sih_disease`, `sih_metric_uf`, `sih_metric_muni` (+ RLS select for anon) |
| MCP | `.cursor/mcp.json` + user MCP → project `hmfbxqemububjyhdckrj` |
| Skills | `npx skills add supabase/agent-skills` installed under `.agents/skills/` |

## Target schema (v1)

```sql
-- Disease / procedure dictionary (TabNet codes)
create table if not exists sih_disease (
  id text primary key,
  label text not null,
  filter_kind text not null check (filter_kind in ('lista_morb','procedimento')),
  tabnet_code text not null,
  def_path text not null default 'sih/cnv/nibr.def'
);

-- UF × ano × disease metrics (choropleth / group analysis)
create table if not exists sih_metric_uf (
  disease_id text references sih_disease(id),
  uf_codigo char(2) not null,
  uf char(2) not null,
  ano int not null,
  internacoes numeric,
  obitos numeric,
  valor_total numeric,
  dias_permanencia numeric,
  taxa_mortalidade numeric,
  primary key (disease_id, uf_codigo, ano)
);

-- Município × ano × disease (map drill-down; load on demand)
create table if not exists sih_metric_muni (
  disease_id text references sih_disease(id),
  municipio_codigo char(6) not null, -- TabNet 6-digit
  municipio_nome text,
  uf_codigo char(2) not null,
  ano int not null,
  internacoes numeric,
  obitos numeric,
  valor_total numeric,
  dias_permanencia numeric,
  taxa_mortalidade numeric,
  primary key (disease_id, municipio_codigo, ano)
);

create index if not exists sih_metric_muni_uf_ano
  on sih_metric_muni (disease_id, uf_codigo, ano);
```

## App contract

1. **Mapas disease picker** — list from `sih_disease` (or keep static JSON; tiny).
2. **UF choropleth / groups** — `sih_metric_uf` filtered by disease + period.
3. **UF drill → municípios** — fetch `sih_metric_muni` for one disease × one UF × years.
4. **Place context** (população, CNES) — keep existing packs or move later.

## Overnight ingest (scrape → Edge Function → delete raw)

```bash
# Resilient loop: Internações for all diseases, then other measures.
# Uploads via Edge Function `sih-ingest` (no service role in the Vite app).
# Keeps disk light by deleting TabNet HTML after each upload.
npm run scrape:overnight
# logs: trabalhos datasus/outputs/coleta_sih_multi/overnight_scrape_upload.log
```

App handoff Mapas → Estatística reads `sih_metric_uf` / `sih_metric_muni` with the anon key
(`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `.env.local`).

```bash
# Scrape only (local CSVs):
npm run scrape:sih-multi -- --measure Internações

# After CSVs exist, upsert into Supabase (needs service role in env):
export SUPABASE_URL=https://hmfbxqemububjyhdckrj.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...   # Dashboard → Settings → API
node scripts/catalog/uploadSihToSupabase.mjs
```

Do **not** import full muni packs into `catalogAnalysisData.ts` — fetch muni from Supabase on UF drill-down.
