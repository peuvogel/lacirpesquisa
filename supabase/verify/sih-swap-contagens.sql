-- sih-swap-contagens.sql
-- Fase 9 Plan 10 (D-16, PIPE-02/03/04) -- gerado por
-- scripts/catalog/generateSihSwapVerify.mjs a partir de scripts/catalog/schema-v3.json.
-- NAO EDITAR A MAO: editar ESPERADO_SIH_METRIC_UF/CID_MAP_VERSION_DA_CORRIDA no gerador (com o
-- valor medido na corrida real, nunca adivinhado) e regerar
-- (sihSwapVerify.test.ts compara este arquivo byte a byte contra a regeracao em memoria).
--
-- Roda manualmente APOS o swap real (supabase db query --linked -f, ou --db-url quando
-- SUPABASE_ACCESS_TOKEN nao estiver disponivel) -- fica FORA de supabase/migrations/, entao
-- supabase db push nunca aplica isto.
--
-- D-16: a substituicao do TabNet pelo microdado e total e atomica -- nenhum estado intermediario
-- e aceitavel. As cinco provas abaixo, cada uma com RAISE EXCEPTION, sao a diferenca entre
-- "confiamos que o swap funcionou" e "provamos que funcionou".

-- (1) sih_metric_uf tem EXATAMENTE a contagem que o agregado da corrida produziu -- o numero e
-- parametro passado a este verify (ESPERADO_SIH_METRIC_UF no gerador), medido na corrida via
-- recount_via_postgrest (upload.py), nunca adivinhado. NULL (o default antes da corrida real)
-- nunca bate contra um count(*), entao este bloco falha alto por construcao ate ser preenchido.
do $$
declare
  v_uf bigint;
begin
  select count(*) into v_uf from sih_metric_uf;
  if v_uf is distinct from 207131 then
    raise exception 'sih-swap-contagens: sih_metric_uf tem % linha(s), esperado % (medido na corrida, nunca adivinhado -- D-16)', v_uf, 207131;
  end if;
end $$;

-- (2) todo valor de local em sih_metric_uf pertence ao conjunto declarado em schema-v3.json, E
-- existem linhas dos DOIS valores -- D-09 so esta cumprido se residencia existir de verdade, nao
-- so ocorrencia (o que a fonte TabNet aposentada nunca teve).
do $$
declare
  v_local_invalido bigint;
  v_tem_ocorrencia bigint;
  v_tem_residencia bigint;
begin
  select count(*) into v_local_invalido
  from sih_metric_uf
  where local not in ('ocorrencia', 'residencia');
  if v_local_invalido > 0 then
    raise exception 'sih-swap-contagens: % linha(s) de sih_metric_uf com local fora de {ocorrencia, residencia} (schema-v3.json)', v_local_invalido;
  end if;

  select count(*) into v_tem_ocorrencia from sih_metric_uf where local = 'ocorrencia';
  if v_tem_ocorrencia = 0 then
    raise exception 'sih-swap-contagens: nenhuma linha com local = %  -- D-09 nao cumprido', 'ocorrencia';
  end if;

  select count(*) into v_tem_residencia from sih_metric_uf where local = 'residencia';
  if v_tem_residencia = 0 then
    raise exception 'sih-swap-contagens: nenhuma linha com local = %  -- D-09 nao cumprido (residencia precisa existir de verdade)', 'residencia';
  end if;
end $$;

-- (3) nenhuma linha sobrevive com a assinatura da fonte antiga (TabNet) -- forma concreta: todo
-- (disease_id, uf_codigo, ano, local) de sih_metric_uf tem uma entrada correspondente em
-- sih_collection_status com status = 'coletado' E cid_map_version igual ao da corrida (parametro
-- CID_MAP_VERSION_DA_CORRIDA no gerador). Uma linha remanescente do TabNet nao teria essa entrada
-- -- e exatamente essa ausencia que esta prova detecta.
do $$
declare
  v_orfao bigint;
begin
  select count(*) into v_orfao
  from sih_metric_uf m
  where not exists (
    select 1
    from sih_collection_status s
    where s.disease_id = m.disease_id
      and s.grao = 'uf'
      and s.local = m.local
      and s.ano = m.ano
      and s.status = 'coletado'
      and s.cid_map_version = '5395d9513343b9e14b3303341b0b20fc44c7e1ffe77615dd60f43ff7e778963f'
  );
  if v_orfao > 0 then
    raise exception 'sih-swap-contagens: % linha(s) de sih_metric_uf sem sih_collection_status coletado correspondente (cid_map_version %) -- possivel remanescente da fonte TabNet antiga (D-16)', v_orfao, '5395d9513343b9e14b3303341b0b20fc44c7e1ffe77615dd60f43ff7e778963f';
  end if;
end $$;

-- (4) integridade referencial pos-swap: nenhuma linha de sih_metric_uf tem disease_id ausente de
-- sih_disease. A FK (ON DELETE CASCADE) ja deveria garantir isto -- esta prova confere de novo,
-- explicitamente, depois do TRUNCATE+INSERT do swap.
do $$
declare
  v_orfao_disease bigint;
begin
  select count(*) into v_orfao_disease
  from sih_metric_uf m
  where not exists (select 1 from sih_disease d where d.id = m.disease_id);
  if v_orfao_disease > 0 then
    raise exception 'sih-swap-contagens: % linha(s) de sih_metric_uf com disease_id ausente de sih_disease apos o swap', v_orfao_disease;
  end if;
end $$;

-- (5) sih_collection_status nao tem nenhuma linha 'coletado' com derived_at ou cid_map_version
-- nulos -- o check constraint da 09-03 ja recusaria a escrita, esta prova confere que nenhuma
-- linha escapou por um caminho que a contorne.
do $$
declare
  v_sem_proveniencia bigint;
begin
  select count(*) into v_sem_proveniencia
  from sih_collection_status
  where status = 'coletado' and (derived_at is null or cid_map_version is null);
  if v_sem_proveniencia > 0 then
    raise exception 'sih-swap-contagens: % linha(s) de sih_collection_status coletado sem derived_at/cid_map_version (D-15)', v_sem_proveniencia;
  end if;
end $$;

-- Inspecao manual (espirito da ultima query de contagens.sql): agravos de sih_disease sem
-- nenhuma linha em sih_metric_uf. Esperado VAZIO depois desta fase -- o codigo 330
-- (todas_as_outras_causas_externas) passou a ter coleta (D-25/09-CONTEXT "Claude's Discretion"),
-- entao nenhum dos 331 agravos deveria ficar orfao de metrica.
select d.id, d.label
from sih_disease d
where d.id not in (select distinct disease_id from sih_metric_uf);
