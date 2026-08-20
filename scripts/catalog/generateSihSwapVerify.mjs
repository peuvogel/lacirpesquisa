#!/usr/bin/env node
/**
 * Gera o verify pós-swap do D-16 (`supabase/verify/sih-swap-contagens.sql`) a partir de
 * `schema-v3.json` -- mesmo padrão "SQL gerado, nunca escrito à mão" de
 * `generateRenameMigration.mjs`/`generateSihSchemaMigration.mjs` (Fase 8/09-03): o arquivo
 * commitado é regenerado em memória e comparado byte a byte (`sihSwapVerify.test.ts`).
 *
 * Fica FORA de `supabase/migrations/` de propósito -- `supabase db push` só varre `migrations/`,
 * e este verify nunca deve ser aplicado como migração (mesma disciplina de `contagens.sql`/
 * `sih-v3-schema.sql`).
 *
 * Diferença estrutural do padrão anterior: `generateRenameMigration.mjs` baked `VERIFY_COUNTS`
 * como um objeto medido UMA VEZ contra uma produção já estável (as 21 renomeações não mudam mais
 * de contagem). Este verify prova o swap do D-16, cuja contagem-alvo só existe DEPOIS que as 27
 * UFs terminarem de coletar (ver hard gate do 09-10-SUMMARY.md) -- não há número real disponível
 * hoje para baked. `ESPERADO_SIH_METRIC_UF`/`CID_MAP_VERSION_DA_CORRIDA` abaixo nascem `null` de
 * propósito: renderizados em `is distinct from`, um `null` nunca bate contra um `count(*)` (que
 * nunca é `null`), então o verify FALHA ALTO por padrão -- rodá-lo sem preencher a contagem/versão
 * REAL medida na corrida (nunca adivinhada) não pode passar por engano. Preencher as duas
 * constantes com o valor medido por `upload.py`/`recount_via_postgrest` e regenerar é o único
 * jeito de o verify sair 0 contra produção real (mesma disciplina de "editar o dado, nunca o SQL
 * gerado, e regerar" que `VERIFY_COUNTS`/`SIH_METRIC_UF_ROWS` já estabeleceram).
 *
 * Usage: node scripts/catalog/generateSihSwapVerify.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './paths.mjs';

const SCHEMA_PATH = path.join(ROOT, 'scripts/catalog/schema-v3.json');

export const VERIFY_RELATIVE_PATH = 'supabase/verify/sih-swap-contagens.sql';

/**
 * Contagem REAL de `sih_metric_uf` pós-swap e a `cid_map_version` da corrida que produziu essa
 * contagem.
 *
 * TERCEIRA SUBSTITUIÇÃO (2026-08-18, ad-hoc sem PLAN.md formal): a troca da BASE DE CONTAGEM, de
 * competência de faturamento (`ANO_CMPT`) para data de internação (`DT_INTER`), sobre os 27
 * `agregados/{uf}.parquet` da recoleta nacional (27/27 `agregado_reciclado`, 4.347 arquivos,
 * 13.558.229 linhas). `upload.py` copiou 207965 linhas para staging, o swap trocou a tabela viva,
 * e `recount_via_postgrest` releu exatamente 207965 linhas via PostgREST paginado (nem uma a
 * mais, nem a menos) -- 103767 de local=ocorrencia + 104198 de local=residencia, reconferido de
 * novo, de forma independente, direto contra o Postgres de produção.
 *
 * A contagem de LINHAS mal se move (207664 -> 207965, +301, os mesmos 331 agravos e os mesmos
 * 13 anos), mas os VALORES mudam em 84,7% das 207024 chaves comuns: +5.724.744 internações
 * (+1,85%), +218.804 óbitos (+1,54%) no total nacional, todo ano subindo entre +0,63% (2019) e
 * +3,69% (2024). É o efeito esperado de parar de truncar admissões na borda da competência --
 * ver `09-15-DT-INTER-SUMMARY.md`.
 *
 * `cid_map_version` permanece O MESMO hash das duas corridas anteriores
 * (`lista-morb-cid.json`/`cid-corrections.json` não mudaram -- a base de contagem é o eixo de
 * data em `aggregate.py`, que não entra neste hash) -- confirmado ao vivo por `cid_map_version()`
 * e por consulta direta a `sih_collection_status` antes e depois do swap.
 *
 * O resíduo de 3 linhas que a segunda substituição precisou explicar (207667 chaves nos
 * agregados contra 207664 em produção, por `UF_ZI` malformado -- '02', '00', '  ' -- descartado
 * silenciosamente por `partitions._uf_dona`) NÃO se reproduz aqui: as chaves únicas
 * `(disease_id, local, territorio_codigo, ano)` de grão UF nos 27 agregados são 207965, ZERO
 * delas com `territorio_codigo` fora dos 27 códigos válidos -- medido, não presumido. Produção e
 * agregado batem exatos, sem resto. A guarda de `_uf_dona` continua de pé (a malformação era
 * real e pode voltar quando o DATASUS republicar competências); ela simplesmente não tem nada a
 * descartar neste dataset.
 */
export const ESPERADO_SIH_METRIC_UF = 207965;
export const CID_MAP_VERSION_DA_CORRIDA =
  '5395d9513343b9e14b3303341b0b20fc44c7e1ffe77615dd60f43ff7e778963f';

/** Grão que `sih_metric_uf` representa -- primeiro valor de `schema-v3.json` `graos` (D-13). */
const GRAO_UF = 'uf';

/**
 * @param {unknown} value
 * @returns {string}
 */
function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

/**
 * Renderiza `value` como literal SQL -- `null` vira o literal `NULL` (nunca a string `'null'`),
 * number vira o número cru, string vira `sqlString`. É o único lugar que decide essa forma, para
 * que `ESPERADO_SIH_METRIC_UF`/`CID_MAP_VERSION_DA_CORRIDA` não precisem de tratamento especial
 * nos dois pontos onde são usados.
 *
 * @param {string | number | null} value
 * @returns {string}
 */
function sqlLiteral(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return sqlString(value);
}

/**
 * @param {string[]} values
 * @returns {string}
 */
function renderInList(values) {
  return values.map((v) => sqlString(v)).join(', ');
}

/**
 * @param {{ locais: string[], graos: string[] }} schema
 * @param {{ esperadoSihMetricUf: number | null, cidMapVersaoCorrida: string | null }} params
 * @returns {string}
 */
export function renderVerifySql(schema, params = {}) {
  const { locais } = schema;
  const esperado = params.esperadoSihMetricUf ?? ESPERADO_SIH_METRIC_UF;
  const versaoCorrida = params.cidMapVersaoCorrida ?? CID_MAP_VERSION_DA_CORRIDA;

  const [localOcorrencia, localResidencia] = locais;

  return `-- sih-swap-contagens.sql
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
  if v_uf is distinct from ${sqlLiteral(esperado)} then
    raise exception 'sih-swap-contagens: sih_metric_uf tem % linha(s), esperado % (medido na corrida, nunca adivinhado -- D-16)', v_uf, ${sqlLiteral(esperado)};
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
  where local not in (${renderInList(locais)});
  if v_local_invalido > 0 then
    raise exception 'sih-swap-contagens: % linha(s) de sih_metric_uf com local fora de {${locais.join(', ')}} (schema-v3.json)', v_local_invalido;
  end if;

  select count(*) into v_tem_ocorrencia from sih_metric_uf where local = ${sqlString(localOcorrencia)};
  if v_tem_ocorrencia = 0 then
    raise exception 'sih-swap-contagens: nenhuma linha com local = %  -- D-09 nao cumprido', ${sqlString(localOcorrencia)};
  end if;

  select count(*) into v_tem_residencia from sih_metric_uf where local = ${sqlString(localResidencia)};
  if v_tem_residencia = 0 then
    raise exception 'sih-swap-contagens: nenhuma linha com local = %  -- D-09 nao cumprido (residencia precisa existir de verdade)', ${sqlString(localResidencia)};
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
      and s.grao = ${sqlString(GRAO_UF)}
      and s.local = m.local
      and s.ano = m.ano
      and s.status = 'coletado'
      and s.cid_map_version = ${sqlLiteral(versaoCorrida)}
  );
  if v_orfao > 0 then
    raise exception 'sih-swap-contagens: % linha(s) de sih_metric_uf sem sih_collection_status coletado correspondente (cid_map_version %) -- possivel remanescente da fonte TabNet antiga (D-16)', v_orfao, ${sqlLiteral(versaoCorrida)};
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
`;
}

function loadSchema() {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

function main() {
  const schema = loadSchema();
  const verifyPath = path.join(ROOT, VERIFY_RELATIVE_PATH);

  fs.mkdirSync(path.dirname(verifyPath), { recursive: true });
  fs.writeFileSync(verifyPath, renderVerifySql(schema));

  console.log(`generateSihSwapVerify: schema-v3.json -> ${VERIFY_RELATIVE_PATH}`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main();
}
