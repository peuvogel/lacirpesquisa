#!/usr/bin/env node
/**
 * Gera a migração de aposentadoria de `sih_metric_muni` (up), seu rollback (down) e o verify
 * pós-migração a partir de `schema-v3.json` (D-20 — PIPE-01, PIPE-06, DATA-02). Mesmo padrão dos
 * geradores irmãos (`generateSihSchemaMigration.mjs`, `generateSihSwapVerify.mjs`): nenhum SQL é
 * escrito à mão, o timestamp é uma constante literal (não `new Date()`), e
 * `sihRetireMigration.test.ts` regenera os três arquivos em memória e compara byte a byte contra
 * os arquivos commitados.
 *
 * Diferença estrutural dos dois geradores anteriores: este é o único que DROPA em vez de criar.
 * Os nomes reais de índice/constraint (`sih_metric_muni_disease_uf_ano`,
 * `sih_metric_muni_pkey`, `sih_metric_muni_disease_id_fkey`, `sih_metric_muni_ano_check`,
 * policy `sih_metric_muni_select_anon`) foram conferidos ao vivo contra produção via
 * `psql \d sih_metric_muni` antes de escrever este gerador — nunca adivinhados (a lição da
 * Fase 8 que o plano cita). `docs/SUPABASE-CATALOG.md` já documentava os mesmos nomes; a
 * consulta ao vivo confirmou que o doc não tinha ficado desatualizado.
 *
 * `ESPERADO_SIH_METRIC_UF`/`ESPERADO_SIH_DISEASE` nascem preenchidos (ao contrário do
 * `generateSihSwapVerify.mjs`, que nasceu com `null` porque a corrida ainda não tinha
 * terminado) — a coleta e a auditoria (09-10/09-12) já mediram os números finais antes deste
 * plano começar. Mesmo assim seguem o mesmo princípio: valor medido contra produção real,
 * editado aqui e regenerado — nunca escrito direto no `.sql` commitado.
 *
 * Usage: node scripts/catalog/generateSihRetireMigration.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './paths.mjs';

const SCHEMA_PATH = path.join(ROOT, 'scripts/catalog/schema-v3.json');

/** Constante, não `Date.now()` — regenerar precisa reproduzir este nome de arquivo exatamente. */
export const MIGRATION_TIMESTAMP = '20260806000000';

export const UP_RELATIVE_PATH = `supabase/migrations/${MIGRATION_TIMESTAMP}_sih_retire_muni.sql`;
export const DOWN_RELATIVE_PATH = `supabase/rollback/${MIGRATION_TIMESTAMP}_sih_retire_muni_down.sql`;
export const VERIFY_RELATIVE_PATH = 'supabase/verify/sih-retire.sql';

/** As cinco tabelas do schema v3 (09-03) que precisam sobreviver à aposentadoria, com RLS ligada. */
const SIH_V3_TABLES = [
  'sih_collection_status',
  'sih_population_total_uf',
  'sih_population_total_muni',
  'sih_population_uf',
  'sih_population_muni',
];

/**
 * Contagem REAL de `sih_disease` — 331 agravos canônicos, estável desde a Fase 8 (D-25),
 * reconfirmada ao vivo por esta execução (`select count(*) from sih_disease`).
 */
export const ESPERADO_SIH_DISEASE = 331;

/**
 * Contagem REAL de `sih_metric_uf` pós segunda substituição de produção (09-10-SEGUNDA-
 * SUBSTITUICAO/09-12) — o mesmo número que `generateSihSwapVerify.mjs::ESPERADO_SIH_METRIC_UF`
 * já baked, reconfirmado ao vivo por esta execução antes de gerar este arquivo. `sih_metric_uf`
 * não é tocada por esta migração (só `sih_metric_muni` sai do banco); esta contagem prova que a
 * DROP de `sih_metric_muni` não teve efeito colateral sobre a tabela irmã.
 */
export const ESPERADO_SIH_METRIC_UF = 207664;

/**
 * @param {unknown} value
 * @returns {string}
 */
function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

/**
 * @param {string[]} values
 * @returns {string}
 */
function renderInList(values) {
  return values.map((v) => sqlString(v)).join(', ');
}

/**
 * @param {{ esperadoSihDisease: number, esperadoSihMetricUf: number }} params
 * @returns {string}
 */
function renderUpIntegrityDoBlock({ esperadoSihDisease, esperadoSihMetricUf }) {
  return `-- Prova de integridade (T-09-54) — aborta a transacao inteira (RAISE EXCEPTION) se o
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
  if v_disease_depois is distinct from ${esperadoSihDisease} then
    raise exception 'sih_retire_muni: sih_disease tem % linha(s), esperado ${esperadoSihDisease}', v_disease_depois;
  end if;

  select count(*) into v_uf_depois from sih_metric_uf;
  if v_uf_antes is distinct from v_uf_depois then
    raise exception 'sih_retire_muni: contagem de sih_metric_uf mudou ao dropar sih_metric_muni (antes=%, depois=%)', v_uf_antes, v_uf_depois;
  end if;
  if v_uf_depois is distinct from ${esperadoSihMetricUf} then
    raise exception 'sih_retire_muni: sih_metric_uf tem % linha(s), esperado ${esperadoSihMetricUf}', v_uf_depois;
  end if;
end $$;`;
}

/**
 * @param {{ anoMin: number, anoMax: number }} schema
 * @returns {string}
 */
export function renderUpMigration(schema) {
  void schema;

  return `-- ${MIGRATION_TIMESTAMP}_sih_retire_muni.sql
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
-- Nomes reais de indice/constraint conferidos ao vivo (psql \\d sih_metric_muni) antes de
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

${renderUpIntegrityDoBlock({ esperadoSihDisease: ESPERADO_SIH_DISEASE, esperadoSihMetricUf: ESPERADO_SIH_METRIC_UF })}
`;
}

/**
 * @param {{ anoMin: number, anoMax: number }} schema
 * @returns {string}
 */
export function renderDownMigration(schema) {
  void schema;

  return `-- ${MIGRATION_TIMESTAMP}_sih_retire_muni_down.sql
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
`;
}

/**
 * @param {{}} schema
 * @returns {string}
 */
export function renderVerifySql(schema) {
  void schema;

  return `-- sih-retire.sql
-- Fase 9 Plan 14 (D-20 — PIPE-01, PIPE-06, DATA-02) — gerado por
-- scripts/catalog/generateSihRetireMigration.mjs a partir de scripts/catalog/schema-v3.json.
-- NAO EDITAR A MAO.
--
-- Roda manualmente apos a migracao (supabase db push) -- fica FORA de supabase/migrations/,
-- entao supabase db push nunca aplica isto.
do $$
declare
  tbl text;
  v_muni regclass;
  v_disease bigint;
  v_uf bigint;
  v_rowsecurity boolean;
begin
  -- (1) sih_metric_muni ausente de information_schema.tables (to_regclass devolve null para
  -- objeto inexistente -- forma mais barata que consultar information_schema.tables direto).
  select to_regclass('public.sih_metric_muni') into v_muni;
  if v_muni is not null then
    raise exception 'sih-retire: sih_metric_muni ainda existe (to_regclass = %), esperado null', v_muni;
  end if;

  -- (2) sih_disease com a contagem final da Fase 8 (D-25) -- prova que o DROP nao levou nada
  -- junto por engano via ON DELETE CASCADE em ordem errada.
  select count(*) into v_disease from sih_disease;
  if v_disease is distinct from ${ESPERADO_SIH_DISEASE} then
    raise exception 'sih-retire: sih_disease tem % linha(s), esperado ${ESPERADO_SIH_DISEASE}', v_disease;
  end if;

  -- (3) sih_metric_uf com a contagem final registrada na 09-12 (segunda substituicao de
  -- producao) -- a tabela irma de sih_metric_muni, que este DROP nao deveria tocar.
  select count(*) into v_uf from sih_metric_uf;
  if v_uf is distinct from ${ESPERADO_SIH_METRIC_UF} then
    raise exception 'sih-retire: sih_metric_uf tem % linha(s), esperado ${ESPERADO_SIH_METRIC_UF}', v_uf;
  end if;

  -- (4) as cinco tabelas do schema v3 (09-03) sobrevivem, todas com RLS ligada -- a
  -- aposentadoria de sih_metric_muni nao pode ter efeito colateral sobre elas.
  foreach tbl in array array[${renderInList(SIH_V3_TABLES)}]
  loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = tbl
    ) then
      raise exception 'sih-retire: tabela % nao existe (deveria sobreviver ao DROP de sih_metric_muni)', tbl;
    end if;

    select rowsecurity into v_rowsecurity
    from pg_tables where schemaname = 'public' and tablename = tbl;
    if v_rowsecurity is distinct from true then
      raise exception 'sih-retire: tabela % nao tem row level security habilitada', tbl;
    end if;
  end loop;
end $$;
`;
}

function loadSchema() {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

function main() {
  const schema = loadSchema();

  const upPath = path.join(ROOT, UP_RELATIVE_PATH);
  const downPath = path.join(ROOT, DOWN_RELATIVE_PATH);
  const verifyPath = path.join(ROOT, VERIFY_RELATIVE_PATH);

  fs.mkdirSync(path.dirname(upPath), { recursive: true });
  fs.mkdirSync(path.dirname(downPath), { recursive: true });
  fs.mkdirSync(path.dirname(verifyPath), { recursive: true });

  fs.writeFileSync(upPath, renderUpMigration(schema));
  fs.writeFileSync(downPath, renderDownMigration(schema));
  fs.writeFileSync(verifyPath, renderVerifySql(schema));

  console.log(
    `generateSihRetireMigration: schema-v3.json -> ${UP_RELATIVE_PATH}, ${DOWN_RELATIVE_PATH}, ${VERIFY_RELATIVE_PATH}`,
  );
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main();
}
