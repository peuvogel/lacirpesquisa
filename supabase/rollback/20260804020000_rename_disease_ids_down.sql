-- 20260804020000_rename_disease_ids_down.sql
-- Fase 8 Plan 5 (TAX-04) — reversao do up, gerada por
-- scripts/catalog/generateRenameMigration.mjs a partir dos mesmos dois arquivos de dado.
-- NAO EDITAR A MAO. Fica FORA de supabase/migrations/ de proposito: supabase db push
-- aplica tudo que estiver em migrations/, e este script aplicado por engano desfaria a
-- migracao em producao (T-08-05-03).
--
-- Mesma tecnica do up na direcao inversa: canonico -> __down_<id> -> antigo. Zero DDL,
-- sem BEGIN/COMMIT (roda via psql/CLI, envolvida manualmente numa transacao quando
-- aplicada no ensaio ou em producao). "Reversivel" (D-03) e este script testado, nao
-- restauracao manual — o ensaio local (08-08) roda up -> verifica -> down -> verifica
-- retorno ao estado inicial.

-- Retrato "antes" (estado pos-up, ids canonicos) — soma agregada por agravo x medida.
create temporary table __antes_uf on commit drop as
select disease_id,
       count(*) as n,
       sum(internacoes) as internacoes,
       sum(obitos) as obitos,
       sum(valor_total) as valor_total,
       sum(dias_permanencia) as dias_permanencia
from sih_metric_uf
group by disease_id;

create temporary table __antes_muni on commit drop as
select disease_id,
       count(*) as n,
       sum(internacoes) as internacoes,
       sum(obitos) as obitos,
       sum(valor_total) as valor_total,
       sum(dias_permanencia) as dias_permanencia
from sih_metric_muni
group by disease_id;

create temporary table __antes_disease on commit drop as
select count(*) as n from sih_disease;

-- Mapa das 21 renomeacoes (rename-map.json) — mesmas 21 duplas do up,
-- old_id/canonical_id continuam significando a mesma coisa; e a direcao do movimento nas
-- passadas abaixo que inverte, nao o mapa.
create temporary table __rename_map (old_id text primary key, canonical_id text not null) on commit drop;
insert into __rename_map (old_id, canonical_id) values
  ('avc', 'outras_doencas_do_olho_e_anexos'),
  ('ait', 'otite_media_e_outr_transt_ouvido_medio_apof_mast'),
  ('febre_reumatica', 'outras_doencas_isquemicas_do_coracao'),
  ('doencas_reumaticas_cronicas', 'embolia_pulmonar'),
  ('outras_doencas_coracao', 'transtornos_de_conducao_e_arritmias_cardiacas'),
  ('hipertensao', 'insuficiencia_cardiaca'),
  ('angina_pectoris', 'outras_doencas_do_coracao'),
  ('infarto_agudo', 'hemorragia_intracraniana'),
  ('doencas_arterias', 'infarto_cerebral'),
  ('aneurisma_aorta', 'acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem'),
  ('outras_doencas_arteriais', 'outras_doencas_cerebrovasculares'),
  ('aterosclerose', 'arteroesclerose'),
  ('embolia_pulmonar', 'outras_doencas_vasculares_perifericas'),
  ('embolia_trombose', 'embolia_e_trombose_arteriais'),
  ('flebites_tromboflebites', 'outras_doencas_das_arterias_arteriolas_e_capilares'),
  ('varizes_mmii', 'flebite_tromboflebite_embolia_e_trombose_venosa'),
  ('hemorroidas', 'veias_varicosas_das_extremidades_inferiores'),
  ('outras_doencas_veias', 'hemorroidas'),
  ('linfedema', 'outras_doencas_do_aparelho_circulatorio'),
  ('hipotensao', 'faringite_aguda_e_amigdalite_aguda'),
  ('outras_doencas_vasculares', 'laringite_e_traqueite_agudas');

-- Retrato "antes" dos agravos sem nenhuma linha em sih_metric_uf, ja traduzido para o
-- referencial de id antigo (captura ocorre antes de qualquer mutacao, com os ids ainda
-- em forma canonica) — para comparar em pe de igualdade com o estado final, ja em forma
-- antiga, no bloco de integridade abaixo.
create temporary table __antes_orfaos_uf on commit drop as
select coalesce(m.old_id, dd.id) as disease_id
from sih_disease dd
left join __rename_map m on m.canonical_id = dd.id
where dd.id not in (select distinct disease_id from sih_metric_uf);

-- Excecoes registradas de agravo sem metrica (D-25/metricless-diseases.json) — o id novo
-- desaparece de sih_disease nesta reversao, entao deixa de contar como orfao esperado.
create temporary table __metricless_esperado (disease_id text primary key) on commit drop;
insert into __metricless_esperado (disease_id) values
  ('todas_as_outras_causas_externas');

-- Passada 1 de 2 — mover os 21 ids canonicos para forma temporaria __down_<id>.
with upd_disease as (
  update sih_disease d set id = '__down_' || d.id
  from __rename_map m where d.id = m.canonical_id
  returning d.id
),
upd_uf as (
  update sih_metric_uf u set disease_id = '__down_' || u.disease_id
  from __rename_map m where u.disease_id = m.canonical_id
  returning u.disease_id
),
upd_muni as (
  update sih_metric_muni mu set disease_id = '__down_' || mu.disease_id
  from __rename_map m where mu.disease_id = m.canonical_id
  returning mu.disease_id
)
select (select count(*) from upd_disease) as n_disease,
       (select count(*) from upd_uf) as n_uf,
       (select count(*) from upd_muni) as n_muni;

-- Passada 2 de 2 — mover de __down_<id> para o id antigo. Resolve os dois ciclos
-- (186<->187, 173<->182) na direcao inversa pela mesma razao do up: a passada 1 inteira
-- ja terminou antes desta comecar.
with upd_disease as (
  update sih_disease d set id = m.old_id
  from __rename_map m where d.id = '__down_' || m.canonical_id
  returning d.id
),
upd_uf as (
  update sih_metric_uf u set disease_id = m.old_id
  from __rename_map m where u.disease_id = '__down_' || m.canonical_id
  returning u.disease_id
),
upd_muni as (
  update sih_metric_muni mu set disease_id = m.old_id
  from __rename_map m where mu.disease_id = '__down_' || m.canonical_id
  returning mu.disease_id
)
select (select count(*) from upd_disease) as n_disease,
       (select count(*) from upd_uf) as n_uf,
       (select count(*) from upd_muni) as n_muni;

-- Terceira operacao, mesma transacao — DELETE do agravo inserido pelo up (D-25, codigo
-- 330). Sem linha filha (nunca teve coleta): ON DELETE CASCADE nao apaga nada em
-- cascata aqui, mas nao e por isso que este DELETE e seguro em geral — e porque este
-- agravo especifico nunca teve metrica.
delete from sih_disease where id = 'todas_as_outras_causas_externas';

-- Prova de integridade (D-04) — aborta a transacao inteira (RAISE EXCEPTION) se
-- qualquer checagem falhar. Comparacao com IS DISTINCT FROM, nao "=", para que NULL
-- conte como NULL e nao passe batido.
do $$
declare
  v_bad_uf text;
  v_bad_muni text;
  v_total_uf_antes bigint;
  v_total_uf_depois bigint;
  v_total_muni_antes bigint;
  v_total_muni_depois bigint;
  v_disease_antes bigint;
  v_disease_depois bigint;
  v_leftover bigint;
  v_alvo_ausente text;
  v_orfaos_extra text;
begin
  -- (1) soma agregada por agravo x medida (count + sum de internacoes/obitos/valor_total/
  -- dias_permanencia) identica antes e depois, traduzida pelo mapa. Contagem sozinha nao
  -- detecta embaralhamento entre os 21 agravos — as tres contagens ficariam identicas e a
  -- integridade referencial passaria mesmo com os dados trocados entre agravos.

  select a.disease_id into v_bad_uf
  from __antes_uf a
  left join __rename_map m on m.canonical_id = a.disease_id
  left join (
    select disease_id, count(*) as n, sum(internacoes) as internacoes, sum(obitos) as obitos,
           sum(valor_total) as valor_total, sum(dias_permanencia) as dias_permanencia
    from sih_metric_uf
    group by disease_id
  ) d on d.disease_id = coalesce(m.old_id, a.disease_id)
  where a.n is distinct from d.n
     or a.internacoes is distinct from d.internacoes
     or a.obitos is distinct from d.obitos
     or a.valor_total is distinct from d.valor_total
     or a.dias_permanencia is distinct from d.dias_permanencia
  limit 1;

  if v_bad_uf is not null then
    raise exception 'D-04: soma agregada de sih_metric_uf divergiu para o agravo % apos a renomeacao', v_bad_uf;
  end if;

  select a.disease_id into v_bad_muni
  from __antes_muni a
  left join __rename_map m on m.canonical_id = a.disease_id
  left join (
    select disease_id, count(*) as n, sum(internacoes) as internacoes, sum(obitos) as obitos,
           sum(valor_total) as valor_total, sum(dias_permanencia) as dias_permanencia
    from sih_metric_muni
    group by disease_id
  ) d on d.disease_id = coalesce(m.old_id, a.disease_id)
  where a.n is distinct from d.n
     or a.internacoes is distinct from d.internacoes
     or a.obitos is distinct from d.obitos
     or a.valor_total is distinct from d.valor_total
     or a.dias_permanencia is distinct from d.dias_permanencia
  limit 1;

  if v_bad_muni is not null then
    raise exception 'D-04: soma agregada de sih_metric_muni divergiu para o agravo % apos a renomeacao', v_bad_muni;
  end if;

  -- (2) total de linhas de sih_metric_uf e sih_metric_muni nao mudou.
  select coalesce(sum(n), 0) into v_total_uf_antes from __antes_uf;
  select count(*) into v_total_uf_depois from sih_metric_uf;
  if v_total_uf_antes is distinct from v_total_uf_depois then
    raise exception 'D-04: total de linhas de sih_metric_uf mudou (antes=%, depois=%)', v_total_uf_antes, v_total_uf_depois;
  end if;

  select coalesce(sum(n), 0) into v_total_muni_antes from __antes_muni;
  select count(*) into v_total_muni_depois from sih_metric_muni;
  if v_total_muni_antes is distinct from v_total_muni_depois then
    raise exception 'D-04: total de linhas de sih_metric_muni mudou (antes=%, depois=%)', v_total_muni_antes, v_total_muni_depois;
  end if;

  -- (3) count(*) de sih_disease e exatamente o anterior menos 1.
  select n into v_disease_antes from __antes_disease;
  select count(*) into v_disease_depois from sih_disease;
  if v_disease_depois is distinct from v_disease_antes - 1 then
    raise exception 'D-04: contagem de sih_disease nao e antes-1 (antes=%, depois=%)', v_disease_antes, v_disease_depois;
  end if;

  -- (4) nenhum id em nenhuma das tres tabelas ainda comeca com __down_. Usa left()
  -- em vez de LIKE '__down_%' de proposito: LIKE trataria cada "_" do prefixo como
  -- coringa de um caractere qualquer (nao um "_" literal) a menos que escapado, e
  -- left()=texto evita essa ambiguidade por construcao.
  select count(*) into v_leftover from (
    select id as x from sih_disease where left(id, 7) = '__down_'
    union all
    select disease_id from sih_metric_uf where left(disease_id, 7) = '__down_'
    union all
    select disease_id from sih_metric_muni where left(disease_id, 7) = '__down_'
  ) t;
  if v_leftover > 0 then
    raise exception 'D-04: % id(s) ainda com prefixo __down_ apos a migracao', v_leftover;
  end if;

  -- (5) todo id-alvo do mapa existe em sih_disease.
  select string_agg(m.old_id, ', ') into v_alvo_ausente
  from __rename_map m
  where not exists (select 1 from sih_disease dd where dd.id = m.old_id);
  if v_alvo_ausente is not null then
    raise exception 'D-04: id(s) alvo do mapa nao encontrados em sih_disease: %', v_alvo_ausente;
  end if;

  -- (6) o conjunto de agravos sem nenhuma linha em sih_metric_uf, traduzido pelo mapa
  -- para o mesmo referencial (id antigo), so pode encolher pelos ids removidos nesta reversao —
  -- nunca em silencio (D-25 corrigido por medicao: 237 dos 330 agravos ja hoje nao tem
  -- linha em sih_metric_uf, entao a checagem nao pode afirmar "exatamente um").

  with depois as (
    select dd.id as disease_id
    from sih_disease dd
    where dd.id not in (select distinct disease_id from sih_metric_uf)
  ),
  esperado as (
    select disease_id from __antes_orfaos_uf
    except
    select disease_id from __metricless_esperado
  ),
  diff as (
    (select disease_id from depois except select disease_id from esperado)
    union
    (select disease_id from esperado except select disease_id from depois)
  )
  select string_agg(disease_id, ', ') into v_orfaos_extra from diff;
  if v_orfaos_extra is not null then
    raise exception 'D-04/D-25: conjunto de agravos orfaos de metrica divergiu do esperado: %', v_orfaos_extra;
  end if;
end $$;
