-- 20260806000000_sih_retire_muni_down.sql
-- Fase 9 Plan 14 — reversao do up, gerada por scripts/catalog/generateSihRetireMigration.mjs a
-- partir de scripts/catalog/schema-v3.json. NAO EDITAR A MAO. Fica FORA de
-- supabase/migrations/ de proposito: supabase db push aplica tudo que estiver em migrations/, e
-- este script aplicado por engano recriaria sih_metric_muni vazia por cima de um estado que ja
-- nao a espera.
--
-- Recria sih_metric_muni EXATAMENTE como documentado em docs/SUPABASE-CATALOG.md (o DDL real,
-- capturado ao vivo por supabase db dump -s public) mais o indice secundario -- VAZIA: os
-- 1.099.403 dados TabNet legados que esta tabela carregava nao sao recuperaveis por este
-- rollback (nao ha copia deles em nenhum outro lugar do sistema; o grao municipio pos-migracao
-- vive no Storage, particionado, com o dado do microdado, nao o do TabNet). Sem BEGIN/COMMIT
-- (roda via psql/CLI, envolvida manualmente numa transacao quando aplicada).

create table sih_metric_muni (
  disease_id text not null,
  municipio_codigo char(6) not null,
  municipio_nome text,
  uf_codigo char(2) not null,
  ano int not null check (ano >= 1990 and ano <= 2100),
  internacoes numeric,
  obitos numeric,
  valor_total numeric,
  dias_permanencia numeric,
  taxa_mortalidade numeric,
  constraint sih_metric_muni_pkey primary key (disease_id, municipio_codigo, ano),
  constraint sih_metric_muni_disease_id_fkey foreign key (disease_id)
    references sih_disease(id) on delete cascade
);

create index sih_metric_muni_disease_uf_ano
  on sih_metric_muni (disease_id, uf_codigo, ano);

alter table sih_metric_muni enable row level security;
create policy sih_metric_muni_select_anon on sih_metric_muni for select to anon, authenticated using (true);
