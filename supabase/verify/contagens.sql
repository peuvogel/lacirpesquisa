-- contagens.sql
-- Fase 8 Plan 5 (TAX-03) — gerado por scripts/catalog/generateRenameMigration.mjs a partir
-- de scripts/catalog/rename-map.json + scripts/catalog/metricless-diseases.json.
-- NAO EDITAR A MAO.
--
-- Roda manualmente apos a migracao (ensaio local 08-08, producao 08-10) — fica FORA de
-- supabase/migrations/, entao supabase db push nunca aplica isto.
--
-- Contagens absolutas medidas ao vivo por PostgREST (chave anon, mesma rota do app),
-- 2026-08-03 (RESEARCH 3.2): sih_disease = 331 (330 medidos + 1 pelo INSERT do codigo 330,
-- D-25), sih_metric_uf = 30313, sih_metric_muni = 1099403 (nenhuma das duas muda —
-- o codigo 330 nao tem dado coletado).
do $$
declare
  v_disease bigint;
  v_uf bigint;
  v_muni bigint;
begin
  select count(*) into v_disease from sih_disease;
  if v_disease is distinct from 331 then
    raise exception 'contagens: sih_disease tem % linhas, esperado 331', v_disease;
  end if;

  select count(*) into v_uf from sih_metric_uf;
  if v_uf is distinct from 30313 then
    raise exception 'contagens: sih_metric_uf tem % linhas, esperado 30313', v_uf;
  end if;

  select count(*) into v_muni from sih_metric_muni;
  if v_muni is distinct from 1099403 then
    raise exception 'contagens: sih_metric_muni tem % linhas, esperado 1099403', v_muni;
  end if;
end $$;

-- Agravos sem nenhuma linha em sih_metric_uf que NAO estao registrados como excecao
-- conhecida (metricless-diseases.json) — inspecionar manualmente no ensaio. Qualquer
-- linha aqui e uma regressao nao registrada (D-25 corrigido por medicao: o conjunto de
-- orfaos de metrica so pode ser o medido antes da migracao mais estas excecoes).
select d.id, d.label
from sih_disease d
where d.id not in (select distinct disease_id from sih_metric_uf)
  and d.id not in ('todas_as_outras_causas_externas');
