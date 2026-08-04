#!/usr/bin/env node
/**
 * Generate the rename migration (up), its rollback (down) and the post-migration
 * verification SQL from `rename-map.json` + `metricless-diseases.json` (D-01, D-03,
 * D-04, D-05, D-25). No SQL here is hand-transcribed — every VALUES list, every id, every
 * count comes from the two data files. The migration timestamp is a constant declared
 * below (not `new Date()`), so regenerating is deterministic and `renameMigration.test.ts`
 * can compare byte-for-byte against the committed files.
 *
 * Zero DDL (D-01): no ALTER TABLE anywhere. No ON UPDATE CASCADE (D-08) — the two-pass
 * rename never touches the FK definitions. The up file never issues a DELETE against
 * `sih_disease`: both FKs carry ON DELETE CASCADE in production (RESEARCH 4.1), so any
 * delete+reinsert of a parent row would silently wipe that agravo's metrics
 * (T-08-05-02) — the two passes only ever UPDATE the parent row's `id`.
 *
 * Usage: node scripts/catalog/generateRenameMigration.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './paths.mjs';

const RENAME_MAP_PATH = path.join(ROOT, 'scripts/catalog/rename-map.json');
const METRICLESS_PATH = path.join(ROOT, 'scripts/catalog/metricless-diseases.json');

/** Constant, not `Date.now()` — regenerating must reproduce this filename exactly. */
export const MIGRATION_TIMESTAMP = '20260804020000';

/**
 * Measured live via PostgREST (anon key, same route the app uses), 2026-08-03
 * (RESEARCH 3.2). `sih_disease` is +1 over the measured 330 for the code-330 INSERT
 * (D-25) — `sih_metric_uf`/`sih_metric_muni` are unchanged, code 330 has no coleta yet.
 */
export const VERIFY_COUNTS = {
  sih_disease: 331,
  sih_metric_uf: 30313,
  sih_metric_muni: 1099403,
};

export const UP_RELATIVE_PATH = `supabase/migrations/${MIGRATION_TIMESTAMP}_rename_disease_ids.sql`;
export const DOWN_RELATIVE_PATH = `supabase/rollback/${MIGRATION_TIMESTAMP}_rename_disease_ids_down.sql`;
export const VERIFY_RELATIVE_PATH = 'supabase/verify/contagens.sql';

/**
 * @param {unknown} value
 * @returns {string}
 */
function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

/**
 * Render the 21-row VALUES list shared by up and down — same pairs, same column order
 * (`old_id`, `canonical_id`) in both files. Which column is the "move-from" side and
 * which is "move-to" is decided by the caller (up: old->canonical, down: canonical->old);
 * the table itself never changes shape, so there is exactly one place these 21 pairs are
 * written out (per file).
 *
 * @param {Array<{ old: string, canonical: string }>} renames
 * @returns {string}
 */
function renderMapValues(renames) {
  return renames
    .map((r) => `  (${sqlString(r.old)}, ${sqlString(r.canonical)})`)
    .join(',\n');
}

/**
 * @param {string[]} ids
 * @returns {string}
 */
function renderMetriclessValues(ids) {
  return ids.map((id) => `  (${sqlString(id)})`).join(',\n');
}

/**
 * Render the D-04 integrity DO block. `direction` decides which snapshot needs
 * translating back into the common "old-id" reference frame for comparison: up
 * translates the *after* state (freshly canonical) back via `canonical_id -> old_id`;
 * down translates the *before* snapshot (still canonical at capture time) the same way,
 * because down's *after* state is already old-form once the two passes finish. Either
 * direction, the translation lookup itself is identical — only which side needs it flips.
 *
 * @param {{ direction: 'up' | 'down', tmpPrefix: string }} args
 * @returns {string}
 */
function renderIntegrityDoBlock({ direction, tmpPrefix }) {
  const isUp = direction === 'up';
  const diseaseCountCheck = isUp
    ? `v_disease_depois is distinct from v_disease_antes + 1`
    : `v_disease_depois is distinct from v_disease_antes - 1`;
  const diseaseCountMsg = isUp
    ? `'D-04: contagem de sih_disease nao e antes+1 (antes=%, depois=%)'`
    : `'D-04: contagem de sih_disease nao e antes-1 (antes=%, depois=%)'`;

  // (1) soma agregada por agravo x medida, traduzida pelo mapa, identica antes/depois.
  const aggJoin = isUp
    ? `left join __rename_map m on m.old_id = a.disease_id\n  left join (\n    select disease_id, count(*) as n, sum(internacoes) as internacoes, sum(obitos) as obitos,\n           sum(valor_total) as valor_total, sum(dias_permanencia) as dias_permanencia\n    from %TABLE%\n    group by disease_id\n  ) d on d.disease_id = coalesce(m.canonical_id, a.disease_id)`
    : `left join __rename_map m on m.canonical_id = a.disease_id\n  left join (\n    select disease_id, count(*) as n, sum(internacoes) as internacoes, sum(obitos) as obitos,\n           sum(valor_total) as valor_total, sum(dias_permanencia) as dias_permanencia\n    from %TABLE%\n    group by disease_id\n  ) d on d.disease_id = coalesce(m.old_id, a.disease_id)`;

  const aggCheck = (table, snapshot, varName) => `
  select a.disease_id into ${varName}
  from ${snapshot} a
  ${aggJoin.replaceAll('%TABLE%', table)}
  where a.n is distinct from d.n
     or a.internacoes is distinct from d.internacoes
     or a.obitos is distinct from d.obitos
     or a.valor_total is distinct from d.valor_total
     or a.dias_permanencia is distinct from d.dias_permanencia
  limit 1;

  if ${varName} is not null then
    raise exception 'D-04: soma agregada de ${table} divergiu para o agravo % apos a renomeacao', ${varName};
  end if;`;

  // (6) conjunto de agravos orfaos de metrica nao cresce alem do registrado (D-25 corrigido).
  const orphanCheck = isUp
    ? `
  with depois_traduzido as (
    select coalesce(m.old_id, dd.id) as disease_id
    from sih_disease dd
    left join __rename_map m on m.canonical_id = dd.id
    where dd.id not in (select distinct disease_id from sih_metric_uf)
  ),
  esperado as (
    select disease_id from __antes_orfaos_uf
    union
    select disease_id from __metricless_esperado
  ),
  diff as (
    (select disease_id from depois_traduzido except select disease_id from esperado)
    union
    (select disease_id from esperado except select disease_id from depois_traduzido)
  )
  select string_agg(disease_id, ', ') into v_orfaos_extra from diff;`
    : `
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
  select string_agg(disease_id, ', ') into v_orfaos_extra from diff;`;

  return `-- Prova de integridade (D-04) — aborta a transacao inteira (RAISE EXCEPTION) se
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
${aggCheck('sih_metric_uf', '__antes_uf', 'v_bad_uf')}
${aggCheck('sih_metric_muni', '__antes_muni', 'v_bad_muni')}

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

  -- (3) count(*) de sih_disease e exatamente o anterior ${isUp ? 'mais' : 'menos'} 1.
  select n into v_disease_antes from __antes_disease;
  select count(*) into v_disease_depois from sih_disease;
  if ${diseaseCountCheck} then
    raise exception ${diseaseCountMsg}, v_disease_antes, v_disease_depois;
  end if;

  -- (4) nenhum id em nenhuma das tres tabelas ainda comeca com ${tmpPrefix}. Usa left()
  -- em vez de LIKE '${tmpPrefix}%' de proposito: LIKE trataria cada "_" do prefixo como
  -- coringa de um caractere qualquer (nao um "_" literal) a menos que escapado, e
  -- left()=texto evita essa ambiguidade por construcao.
  select count(*) into v_leftover from (
    select id as x from sih_disease where left(id, ${tmpPrefix.length}) = ${sqlString(tmpPrefix)}
    union all
    select disease_id from sih_metric_uf where left(disease_id, ${tmpPrefix.length}) = ${sqlString(tmpPrefix)}
    union all
    select disease_id from sih_metric_muni where left(disease_id, ${tmpPrefix.length}) = ${sqlString(tmpPrefix)}
  ) t;
  if v_leftover > 0 then
    raise exception 'D-04: % id(s) ainda com prefixo ${tmpPrefix} apos a migracao', v_leftover;
  end if;

  -- (5) todo id-alvo do mapa existe em sih_disease.
  select string_agg(m.${isUp ? 'canonical_id' : 'old_id'}, ', ') into v_alvo_ausente
  from __rename_map m
  where not exists (select 1 from sih_disease dd where dd.id = m.${isUp ? 'canonical_id' : 'old_id'});
  if v_alvo_ausente is not null then
    raise exception 'D-04: id(s) alvo do mapa nao encontrados em sih_disease: %', v_alvo_ausente;
  end if;

  -- (6) o conjunto de agravos sem nenhuma linha em sih_metric_uf, traduzido pelo mapa
  -- para o mesmo referencial (id antigo), so pode ${isUp ? 'crescer pelos ids registrados em metricless-diseases.json' : 'encolher pelos ids removidos nesta reversao'} —
  -- nunca em silencio (D-25 corrigido por medicao: 237 dos 330 agravos ja hoje nao tem
  -- linha em sih_metric_uf, entao a checagem nao pode afirmar "exatamente um").
${orphanCheck}
  if v_orfaos_extra is not null then
    raise exception 'D-04/D-25: conjunto de agravos orfaos de metrica divergiu do esperado: %', v_orfaos_extra;
  end if;
end $$;`;
}

/**
 * @param {{ renames: Array<{tabnetCode:string, old:string, canonical:string, label:string}>, added: Array<{tabnetCode:string,id:string,label:string,filterKind:string,def:string}>, metricless: Record<string,string> }} data
 * @returns {string}
 */
export function renderUpMigration({ renames, added, metricless }) {
  const novo = added[0];
  const metriclessIds = Object.keys(metricless);

  return `-- ${MIGRATION_TIMESTAMP}_rename_disease_ids.sql
-- Fase 8 Plan 5 (TAX-03, TAX-04) — gerado por scripts/catalog/generateRenameMigration.mjs
-- a partir de scripts/catalog/rename-map.json + scripts/catalog/metricless-diseases.json.
-- NAO EDITAR A MAO: editar o mapa e regerar (renameMigration.test.ts compara este arquivo
-- byte a byte contra a regeracao em memoria).
--
-- Zero DDL (D-01): nenhum ALTER TABLE. Sem ON UPDATE CASCADE (D-08) — nenhuma FK e tocada
-- aqui. As duas passadas abaixo nunca fazem DELETE em sih_disease: ambas as FKs
-- (sih_metric_uf_disease_id_fkey, sih_metric_muni_disease_id_fkey) tem ON DELETE CASCADE
-- em producao (RESEARCH 4.1) — apagar e reinserir a linha pai apagaria em cascata todas as
-- metricas daquele agravo, sem erro (T-08-05-02). O Supabase CLI ja envolve este arquivo
-- numa transacao implicita — sem BEGIN/COMMIT aqui.
--
-- Padrao de duas passadas com id temporario, uma unica statement por passada agrupando
-- as tres tabelas com CTEs de escrita: reproduzido empiricamente contra um Postgres 17
-- real, incluindo os dois ciclos de renomeacao (RESEARCH 4.2). A checagem de FK
-- NOT DEFERRABLE acontece ao fim do statement inteiro, entao pai e filhas "andam juntos"
-- sem violar a FK em nenhum momento intermediario.

-- Retrato "antes" — soma agregada por agravo x medida (D-04).
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

-- Retrato "antes" dos agravos sem nenhuma linha em sih_metric_uf (D-25 corrigido por
-- medicao: 237 dos 330 ja hoje nao tem — o invariante e sobre o *conjunto* nao crescer
-- alem do registrado, nunca "exatamente um").
create temporary table __antes_orfaos_uf on commit drop as
select id as disease_id
from sih_disease
where id not in (select distinct disease_id from sih_metric_uf);

-- Excecoes registradas de agravo sem metrica (D-25/metricless-diseases.json) — nunca uma
-- allowlist silenciosa embutida em codigo.
create temporary table __metricless_esperado (disease_id text primary key) on commit drop;
insert into __metricless_esperado (disease_id) values
${renderMetriclessValues(metriclessIds)};

-- Mapa das ${renames.length} renomeacoes (rename-map.json), fonte unica das duas passadas.
create temporary table __rename_map (old_id text primary key, canonical_id text not null) on commit drop;
insert into __rename_map (old_id, canonical_id) values
${renderMapValues(renames)};

-- Passada 1 de 2 — mover os ${renames.length} ids para forma temporaria __mig_<id> (D-01).
with upd_disease as (
  update sih_disease d set id = '__mig_' || d.id
  from __rename_map m where d.id = m.old_id
  returning d.id
),
upd_uf as (
  update sih_metric_uf u set disease_id = '__mig_' || u.disease_id
  from __rename_map m where u.disease_id = m.old_id
  returning u.disease_id
),
upd_muni as (
  update sih_metric_muni mu set disease_id = '__mig_' || mu.disease_id
  from __rename_map m where mu.disease_id = m.old_id
  returning mu.disease_id
)
select (select count(*) from upd_disease) as n_disease,
       (select count(*) from upd_uf) as n_uf,
       (select count(*) from upd_muni) as n_muni;

-- Passada 2 de 2 — mover de __mig_<id> para o id canonico (D-01). E este statement que
-- resolve os dois ciclos (186<->187, 173<->182) corretamente: nao ha colisao possivel
-- contra um id __mig_ que ja mudou de novo, porque a passada 1 inteira ja terminou.
with upd_disease as (
  update sih_disease d set id = m.canonical_id
  from __rename_map m where d.id = '__mig_' || m.old_id
  returning d.id
),
upd_uf as (
  update sih_metric_uf u set disease_id = m.canonical_id
  from __rename_map m where u.disease_id = '__mig_' || m.old_id
  returning u.disease_id
),
upd_muni as (
  update sih_metric_muni mu set disease_id = m.canonical_id
  from __rename_map m where mu.disease_id = '__mig_' || m.old_id
  returning mu.disease_id
)
select (select count(*) from upd_disease) as n_disease,
       (select count(*) from upd_uf) as n_uf,
       (select count(*) from upd_muni) as n_muni;

-- Terceira operacao, mesma transacao — INSERT do agravo novo (D-25, codigo ${novo.tabnetCode}).
-- Sem linha filha hoje: nao aciona nenhuma checagem de FK, statement simples de uma
-- tabela so (RESEARCH 4.5).
insert into sih_disease (id, label, filter_kind, tabnet_code, def_path)
values (${sqlString(novo.id)}, ${sqlString(novo.label)}, ${sqlString(novo.filterKind)}, ${sqlString(novo.tabnetCode)}, ${sqlString(novo.def)});

${renderIntegrityDoBlock({ direction: 'up', tmpPrefix: '__mig_' })}
`;
}

/**
 * @param {{ renames: Array<{tabnetCode:string, old:string, canonical:string, label:string}>, added: Array<{tabnetCode:string,id:string,label:string,filterKind:string,def:string}>, metricless: Record<string,string> }} data
 * @returns {string}
 */
export function renderDownMigration({ renames, added, metricless }) {
  const novo = added[0];
  const metriclessIds = Object.keys(metricless);

  return `-- ${MIGRATION_TIMESTAMP}_rename_disease_ids_down.sql
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

-- Mapa das ${renames.length} renomeacoes (rename-map.json) — mesmas ${renames.length} duplas do up,
-- old_id/canonical_id continuam significando a mesma coisa; e a direcao do movimento nas
-- passadas abaixo que inverte, nao o mapa.
create temporary table __rename_map (old_id text primary key, canonical_id text not null) on commit drop;
insert into __rename_map (old_id, canonical_id) values
${renderMapValues(renames)};

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
${renderMetriclessValues(metriclessIds)};

-- Passada 1 de 2 — mover os ${renames.length} ids canonicos para forma temporaria __down_<id>.
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
-- ${novo.tabnetCode}). Sem linha filha (nunca teve coleta): ON DELETE CASCADE nao apaga nada em
-- cascata aqui, mas nao e por isso que este DELETE e seguro em geral — e porque este
-- agravo especifico nunca teve metrica.
delete from sih_disease where id = ${sqlString(novo.id)};

${renderIntegrityDoBlock({ direction: 'down', tmpPrefix: '__down_' })}
`;
}

/**
 * @param {{ counts: { sih_disease: number, sih_metric_uf: number, sih_metric_muni: number }, metricless: Record<string,string> }} data
 * @returns {string}
 */
export function renderVerifySql({ counts, metricless }) {
  const metriclessIds = Object.keys(metricless);
  const exclusionList = metriclessIds.map((id) => sqlString(id)).join(', ');

  return `-- contagens.sql
-- Fase 8 Plan 5 (TAX-03) — gerado por scripts/catalog/generateRenameMigration.mjs a partir
-- de scripts/catalog/rename-map.json + scripts/catalog/metricless-diseases.json.
-- NAO EDITAR A MAO.
--
-- Roda manualmente apos a migracao (ensaio local 08-08, producao 08-10) — fica FORA de
-- supabase/migrations/, entao supabase db push nunca aplica isto.
--
-- Contagens absolutas medidas ao vivo por PostgREST (chave anon, mesma rota do app),
-- 2026-08-03 (RESEARCH 3.2): sih_disease = ${counts.sih_disease} (330 medidos + 1 pelo INSERT do codigo 330,
-- D-25), sih_metric_uf = ${counts.sih_metric_uf}, sih_metric_muni = ${counts.sih_metric_muni} (nenhuma das duas muda —
-- o codigo 330 nao tem dado coletado).
do $$
declare
  v_disease bigint;
  v_uf bigint;
  v_muni bigint;
begin
  select count(*) into v_disease from sih_disease;
  if v_disease is distinct from ${counts.sih_disease} then
    raise exception 'contagens: sih_disease tem % linhas, esperado ${counts.sih_disease}', v_disease;
  end if;

  select count(*) into v_uf from sih_metric_uf;
  if v_uf is distinct from ${counts.sih_metric_uf} then
    raise exception 'contagens: sih_metric_uf tem % linhas, esperado ${counts.sih_metric_uf}', v_uf;
  end if;

  select count(*) into v_muni from sih_metric_muni;
  if v_muni is distinct from ${counts.sih_metric_muni} then
    raise exception 'contagens: sih_metric_muni tem % linhas, esperado ${counts.sih_metric_muni}', v_muni;
  end if;
end $$;

-- Agravos sem nenhuma linha em sih_metric_uf que NAO estao registrados como excecao
-- conhecida (metricless-diseases.json) — inspecionar manualmente no ensaio. Qualquer
-- linha aqui e uma regressao nao registrada (D-25 corrigido por medicao: o conjunto de
-- orfaos de metrica so pode ser o medido antes da migracao mais estas excecoes).
select d.id, d.label
from sih_disease d
where d.id not in (select distinct disease_id from sih_metric_uf)
  and d.id not in (${exclusionList});
`;
}

function loadData() {
  const renameMap = JSON.parse(fs.readFileSync(RENAME_MAP_PATH, 'utf8'));
  const metricless = JSON.parse(fs.readFileSync(METRICLESS_PATH, 'utf8'));
  return { renames: renameMap.renames, added: renameMap.added, metricless };
}

function main() {
  const data = loadData();

  const upPath = path.join(ROOT, UP_RELATIVE_PATH);
  const downPath = path.join(ROOT, DOWN_RELATIVE_PATH);
  const verifyPath = path.join(ROOT, VERIFY_RELATIVE_PATH);

  fs.mkdirSync(path.dirname(upPath), { recursive: true });
  fs.mkdirSync(path.dirname(downPath), { recursive: true });
  fs.mkdirSync(path.dirname(verifyPath), { recursive: true });

  fs.writeFileSync(upPath, renderUpMigration(data));
  fs.writeFileSync(downPath, renderDownMigration(data));
  fs.writeFileSync(verifyPath, renderVerifySql({ counts: VERIFY_COUNTS, metricless: data.metricless }));

  console.log(
    `generateRenameMigration: ${data.renames.length} renames, ${data.added.length} added -> ${UP_RELATIVE_PATH}, ${DOWN_RELATIVE_PATH}, ${VERIFY_RELATIVE_PATH}`,
  );
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main();
}
