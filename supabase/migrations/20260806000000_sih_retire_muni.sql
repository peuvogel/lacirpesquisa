-- 20260806000000_sih_retire_muni.sql
-- Fase 9 Plan 14 (D-20 — PIPE-01, PIPE-06, DATA-02) — gerado por
-- scripts/catalog/generateSihRetireMigration.mjs a partir de scripts/catalog/schema-v3.json.
-- NAO EDITAR A MAO: editar o gerador e regerar (sihRetireMigration.test.ts compara este
-- arquivo byte a byte contra a regeracao em memoria).
--
-- Aposenta sih_metric_muni (grao municipio, dado TabNet legado, 1.099.403 linhas) depois de
-- provado que as 27 particoes do Storage (bucket sih-municipio) ja servem o mesmo grao a
-- partir do microdado (D-20). O Supabase CLI ja envolve este arquivo numa transacao implicita
-- -- sem BEGIN/COMMIT aqui.
--
-- Nomes reais de indice/constraint conferidos ao vivo (psql \d sih_metric_muni) antes de
-- escrever este SQL -- nunca adivinhados (a mesma licao da Fase 8 que motivou esta instrucao no
-- plano). O DROP TABLE remove sozinho a PK (sih_metric_muni_pkey), o check
-- (sih_metric_muni_ano_check), a FK (sih_metric_muni_disease_id_fkey), RLS e a policy
-- (sih_metric_muni_select_anon) -- so o indice secundario precisa de DROP INDEX explicito.

-- Retrato "antes" de sih_disease e sih_metric_uf -- as duas tabelas que a prova de integridade
-- ao final confere que sobreviveram intactas ao DROP de sih_metric_muni.
create temporary table __antes_sih_disease on commit drop as
select count(*) as n from sih_disease;

create temporary table __antes_sih_metric_uf on commit drop as
select count(*) as n from sih_metric_uf;

-- (1) indice secundario de sih_metric_muni -- precisa sair antes da tabela (embora DROP TABLE
-- ja levasse ele junto; explicito para o plano de execucao ficar legivel passo a passo).
drop index if exists sih_metric_muni_disease_uf_ano;

-- (2) a tabela inteira -- PK, check, FK, RLS e policy saem juntos, atomicamente.
drop table sih_metric_muni;

-- Prova de integridade (T-09-54) — aborta a transacao inteira (RAISE EXCEPTION) se o
-- DROP de sih_metric_muni tiver levado sih_disease ou sih_metric_uf junto. O ON DELETE CASCADE
-- de sih_disease so dispara quando uma LINHA de sih_disease e apagada, nunca quando uma TABELA
-- filha e dropada -- mas um erro de ordem (dropar sih_disease antes de sih_metric_muni, por
-- exemplo) apagaria sih_metric_uf em cascata sem erro visivel. Esta prova confere as DUAS
-- tabelas que precisam sobreviver intactas, com IS DISTINCT FROM (NULL conta como NULL, nunca
-- passa batido).
do $$
declare
  v_disease_antes bigint;
  v_disease_depois bigint;
  v_uf_antes bigint;
  v_uf_depois bigint;
begin
  select n into v_disease_antes from __antes_sih_disease;
  select n into v_uf_antes from __antes_sih_metric_uf;

  select count(*) into v_disease_depois from sih_disease;
  if v_disease_antes is distinct from v_disease_depois then
    raise exception 'sih_retire_muni: contagem de sih_disease mudou ao dropar sih_metric_muni (antes=%, depois=%)', v_disease_antes, v_disease_depois;
  end if;
  if v_disease_depois is distinct from 331 then
    raise exception 'sih_retire_muni: sih_disease tem % linha(s), esperado 331', v_disease_depois;
  end if;

  select count(*) into v_uf_depois from sih_metric_uf;
  if v_uf_antes is distinct from v_uf_depois then
    raise exception 'sih_retire_muni: contagem de sih_metric_uf mudou ao dropar sih_metric_muni (antes=%, depois=%)', v_uf_antes, v_uf_depois;
  end if;
  if v_uf_depois is distinct from 207664 then
    raise exception 'sih_retire_muni: sih_metric_uf tem % linha(s), esperado 207664', v_uf_depois;
  end if;
end $$;
