# Supabase catalog backend (LACIR)

## Why

Bundling ~330 Lista Morb diseases × UF × município in the Vite client exhausts memory.
The didactic app should keep **metadata + small UF series** local (or fetched lean), and
put **município grain + full measure matrix** in Supabase.

Project: `hmfbxqemububjyhdckrj` (org LACIR).

## Current local progress (checkpoint · 2026-08-04, Fase 8 Plan 10)

| Item | Status |
|------|--------|
| Disease taxonomy (Lista Morb CID-10) | **331** agravos canônicos em `sih_disease` — 330 com dado coletado + 1 (`todas_as_outras_causas_externas`, código 330) sem coleta, D-25. Ids migrados em produção pela Fase 8 (`supabase db push`, 2026-08-04) |
| Catalog UF packs in `public/data/catalog/packs` | 10 vascular (keep lean in Vite) |
| Scrape UF+muni CSVs | ~9+ in `coleta_sih_multi` (Internações-first pass running); os 341 diretórios ainda usam os ids pré-migração (D-22) — ver Fase 9 handoff no SUMMARY da 08-10 |
| Supabase tables | `sih_disease`, `sih_metric_uf`, `sih_metric_muni` (+ RLS select for anon) |
| MCP | `.cursor/mcp.json` + user MCP → project `hmfbxqemububjyhdckrj` |
| Skills | `npx skills add supabase/agent-skills` installed under `.agents/skills/` |

## Real schema (v2 — capturado ao vivo por `supabase db dump -s public`, aplicado desde a Fase 8)

Este é o schema **como ele realmente é** em produção (`supabase/migrations/20260804015329_remote_schema.sql`),
não uma intenção documentada antecipadamente. Diverge do "Target schema (v1)" original em pontos que já
custaram tempo de investigação nesta fase — ver notas inline.

```sql
-- Disease / procedure dictionary (TabNet codes) — 331 linhas (330 com dado coletado, D-25)
create table if not exists sih_disease (
  id text not null,
  label text not null,
  filter_kind text not null check (filter_kind in ('lista_morb','procedimento')),
  tabnet_code text not null,
  def_path text not null default 'sih/cnv/nibr.def',
  created_at timestamptz not null default now(),  -- não documentado antes da Fase 8
  constraint sih_disease_pkey primary key (id)
);

-- UF × ano × disease metrics (choropleth / group analysis)
create table if not exists sih_metric_uf (
  disease_id text not null,
  uf_codigo char(2) not null,
  uf char(2) not null,
  uf_nome text,
  ano int not null check (ano >= 1990 and ano <= 2100),
  internacoes numeric,
  obitos numeric,
  valor_total numeric,
  dias_permanencia numeric,
  taxa_mortalidade numeric,
  constraint sih_metric_uf_pkey primary key (disease_id, uf_codigo, ano),
  -- ON DELETE CASCADE: apagar uma linha de sih_disease apaga em cascata TODAS as métricas
  -- daquele agravo nesta tabela, sem erro. Nenhuma estratégia futura de "apagar e reinserir"
  -- pode ignorar isso. Sem ON UPDATE CASCADE (deliberado, D-08): renomear um id não propaga
  -- por FK — é por isso que a migração da Fase 8 usa UPDATE explícito nas três tabelas em vez
  -- de contar com a FK para mover as linhas filhas.
  constraint sih_metric_uf_disease_id_fkey foreign key (disease_id)
    references sih_disease(id) on delete cascade
);

create index if not exists sih_metric_uf_disease_ano
  on sih_metric_uf (disease_id, ano);

-- Município × ano × disease (map drill-down; load on demand)
create table if not exists sih_metric_muni (
  disease_id text not null,
  municipio_codigo char(6) not null, -- TabNet 6-digit
  municipio_nome text,
  uf_codigo char(2) not null,
  ano int not null check (ano >= 1990 and ano <= 2100),
  internacoes numeric,
  obitos numeric,
  valor_total numeric,
  dias_permanencia numeric,
  taxa_mortalidade numeric,
  constraint sih_metric_muni_pkey primary key (disease_id, municipio_codigo, ano),
  -- Mesma ressalva de ON DELETE CASCADE / ausência de ON UPDATE (D-08) de sih_metric_uf acima.
  constraint sih_metric_muni_disease_id_fkey foreign key (disease_id)
    references sih_disease(id) on delete cascade
);

-- Nome real é sih_metric_muni_disease_uf_ano (o doc antigo omitia o segmento
-- "_disease" e o ROADMAP dava este índice como "intenção não confirmada" —
-- ele existe e está aplicado em produção, confirmado ao vivo na Fase 8 Plan 10).
create index if not exists sih_metric_muni_disease_uf_ano
  on sih_metric_muni (disease_id, uf_codigo, ano);

-- RLS habilitada nas três tabelas, com policy de SELECT para anon e authenticated
-- (sih_disease_select_anon, sih_metric_uf_select_anon, sih_metric_muni_select_anon).
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

## `supabase/` directory structure (introduzido na Fase 8)

O projeto está `link`ado (`supabase link --project-ref hmfbxqemububjyhdckrj`) e versiona três
diretórios com responsabilidades deliberadamente separadas:

| Diretório | O que guarda | `supabase db push` aplica? |
|---|---|---|
| `supabase/migrations/` | Migrações reais, aplicadas em ordem de timestamp — hoje o baseline (`<ts0>_remote_schema.sql`, schema real capturado por `db dump`) e a migração de renomeação dos 21 ids (`<ts1>_rename_disease_ids.sql`) | **Sim** — é o único diretório que `db push` varre |
| `supabase/rollback/` | O `--down` de cada migração aplicada, testado ponta a ponta no ensaio (Fase 8 Plan 8) antes de qualquer aplicação real | **Não**, de propósito — fica fora de `migrations/` para nunca ser varrido por engano. Aplicar exige rodar o SQL manualmente (SQL Editor do dashboard ou `supabase db query --linked -f`), numa única execução |
| `supabase/verify/` | Verificações pós-migração (`contagens.sql`): contagens absolutas com `RAISE EXCEPTION` em divergência, mais a lista de agravos sem métrica fora do registro conhecido | **Não** — mesma razão de `rollback/`; roda-se manualmente depois de um `db push` |

Os três arquivos de `migrations/` e `rollback/` para a renomeação de ids são **gerados**, não
escritos à mão, por `scripts/catalog/generateRenameMigration.mjs` a partir de
`scripts/catalog/rename-map.json` + `scripts/catalog/metricless-diseases.json` —
`src/features/catalog/renameMigration.test.ts` impede edição manual do SQL commitado.
