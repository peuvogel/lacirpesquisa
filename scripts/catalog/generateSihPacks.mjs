#!/usr/bin/env node
/**
 * catalog:sih-packs — regera os 10 packs de `public/data/catalog/packs/` a partir da fonte
 * servida (`sih_metric_uf`/`sih_collection_status` via PostgREST, chave anon), no molde de
 * `generateDiseaseSeeds.mjs` (gerado, nunca escrito à mão — TAX-06). D-19/09-13.
 *
 * Consumidores vivos confirmados (grep -rn 'catalog/packs' src scripts, ver 09-13-SUMMARY.md):
 * só `src/features/catalog/catalogAnalysisData.ts` (10 imports estáticos, não tocado por este
 * gerador) e `catalogAnalysisData.test.ts`/`applyRenameMap.mjs`/`syncPackImports.mjs`/
 * `collection-order.json` (leitura/ferramenta, não consumidor de runtime).
 *
 * Leitura paginada pelo cabeçalho `Range`, conferida contra `content-range` até cobrir o total
 * anunciado (T-09-11/RESEARCH Pitfall 13) — molde de `pipeline/sih/src/sih_pipeline/audit.py`
 * `_fetch_all_paginated`/`upload.py::recount_via_postgrest`, portado para Node porque este
 * gerador roda em build-time JS, não no pipeline Python.
 *
 * Usage:
 *   node scripts/catalog/generateSihPacks.mjs [--dry-run]
 */
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ROOT } from './paths.mjs';
import { assertNotTombstone } from './tombstones.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKS_DIR = path.join(ROOT, 'public/data/catalog/packs');
const ENV_LOCAL_PATH = path.join(ROOT, '.env.local');
const PAGE_SIZE = 1000;
const GRAIN = 'uf_ano';
const KEYS = ['uf_codigo', 'uf', 'ano'];
const YEARS = Array.from({ length: 2025 - 2013 + 1 }, (_, i) => 2013 + i);

/** Ordem oficial IBGE (mesma ordem de `enumerate.py::UFS`/os packs legados já commitados). */
const UF_ORDER = [
  ['11', 'RO'], ['12', 'AC'], ['13', 'AM'], ['14', 'RR'], ['15', 'PA'], ['16', 'AP'], ['17', 'TO'],
  ['21', 'MA'], ['22', 'PI'], ['23', 'CE'], ['24', 'RN'], ['25', 'PB'], ['26', 'PE'], ['27', 'AL'],
  ['28', 'SE'], ['29', 'BA'], ['31', 'MG'], ['32', 'ES'], ['33', 'RJ'], ['35', 'SP'], ['41', 'PR'],
  ['42', 'SC'], ['43', 'RS'], ['50', 'MS'], ['51', 'MT'], ['52', 'GO'], ['53', 'DF'],
];

/** Nome IBGE por sigla de UF — estático, oficial, sem ambiguidade (mesmo nível de "dado
 * literal" que `enumerate.py::UFS`). `sih_metric_uf.uf_nome` está NULL em produção para toda
 * linha (achado desta task, gap pré-existente de `upload.py`, fora do `file_scope` desta plan
 * corrigir na origem) — sem esta tabela local, os 10 packs perderiam o nome por extenso que os
 * arquivos legados já commitados carregavam, puramente por um gap upstream não relacionado ao
 * dado em si. */
const UF_NOME = {
  RO: 'Rondônia', AC: 'Acre', AM: 'Amazonas', RR: 'Roraima', PA: 'Pará', AP: 'Amapá', TO: 'Tocantins',
  MA: 'Maranhão', PI: 'Piauí', CE: 'Ceará', RN: 'Rio Grande do Norte', PB: 'Paraíba', PE: 'Pernambuco',
  AL: 'Alagoas', SE: 'Sergipe', BA: 'Bahia', MG: 'Minas Gerais', ES: 'Espírito Santo', RJ: 'Rio de Janeiro',
  SP: 'São Paulo', PR: 'Paraná', SC: 'Santa Catarina', RS: 'Rio Grande do Sul', MS: 'Mato Grosso do Sul',
  MT: 'Mato Grosso', GO: 'Goiás', DF: 'Distrito Federal',
};

/** Os 10 packs que `catalogAnalysisData.ts` importa hoje — id derivado do diretório atual,
 * conferido contra os imports (não inventado). */
export const PACK_IDS = [
  'sih.embolia_e_trombose_arteriais_uf',
  'sih.amputacao_mmii_uf',
  'sih.acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem_uf',
  'sih.flebite_tromboflebite_embolia_e_trombose_venosa_uf',
  'sih.infarto_cerebral_uf',
  'sih.laringite_e_traqueite_agudas_uf',
  'sih.otite_media_e_outr_transt_ouvido_medio_apof_mast_uf',
  'sih.outras_doencas_das_arterias_arteriolas_e_capilares_uf',
  'sih.outras_doencas_do_olho_e_anexos_uf',
  'sih.outras_doencas_vasculares_perifericas_uf',
];

/** `sih.<id>_uf` -> disease_id canônico (scripts/catalog/diseases.json). */
function diseaseIdFromPackId(packId) {
  return packId.replace(/^sih\./, '').replace(/_uf$/, '');
}

const GENERIC_METRIC_KEYS = ['internacoes', 'obitos', 'valor_total', 'dias_permanencia', 'taxa_mortalidade'];

/** Colunas de junção CNES/população (medicos_vasculares_sus/populacao/medicos_vasculares_por_100k):
 * escrapadas uma vez do CNES/SIDRA na Fase 5, fonte inteiramente alheia ao pipeline SIH-RD desta
 * fase (D-19 aposenta o corpus de 654 CSVs multi-doença, não o CNES/SIDRA). Congeladas a partir do
 * pack já commitado — carregadas ANTES deste gerador sobrescrever o arquivo. Documentado como
 * decisão explícita no SUMMARY, não escondido.
 */
const FROZEN_JOIN_KEYS = ['medicos_vasculares_sus', 'populacao', 'medicos_vasculares_por_100k'];

/** Definição dos 2 packs legados (nomes de coluna com o sufixo da doença + colunas derivadas
 * pós-agregação, no molde do que `trabalhos datasus/outputs/coleta_*` já escreviam). */
const LEGACY_PACK_DEFS = {
  'sih.embolia_e_trombose_arteriais_uf': {
    metricKeys: [
      ...FROZEN_JOIN_KEYS,
      'internacoes_embolia_trombose_arteriais',
      'obitos_embolia_trombose_arteriais',
      'dias_permanencia_embolia_trombose_arteriais',
      'taxa_mortalidade_pct',
      'media_permanencia_calculada',
      'taxa_internacao_por_100k',
      'valor_total',
    ],
    internacoesKey: 'internacoes_embolia_trombose_arteriais',
    obitosKey: 'obitos_embolia_trombose_arteriais',
    diasPermanenciaKey: 'dias_permanencia_embolia_trombose_arteriais',
    valorTotalKey: 'valor_total',
    taxaMortalidadeKey: 'taxa_mortalidade_pct',
    mediaPermanenciaKey: 'media_permanencia_calculada',
    taxaInternacaoKey: 'taxa_internacao_por_100k',
  },
  'sih.amputacao_mmii_uf': {
    metricKeys: [
      'internacoes_amputacao_mmii',
      'obitos_amputacao_mmii',
      'taxa_mortalidade_sih_pct',
      'letalidade_calculada_pct',
      'taxa_internacao_amputacao_mmii_por_100k',
      ...FROZEN_JOIN_KEYS,
    ],
    internacoesKey: 'internacoes_amputacao_mmii',
    obitosKey: 'obitos_amputacao_mmii',
    diasPermanenciaKey: null,
    valorTotalKey: null,
    taxaMortalidadeKey: 'taxa_mortalidade_sih_pct',
    letalidadeKey: 'letalidade_calculada_pct',
    taxaInternacaoKey: 'taxa_internacao_amputacao_mmii_por_100k',
  },
};

// ---------------------------------------------------------------------------
// .env.local — só as duas chaves VITE_SUPABASE_* (a mesma dupla anon que o browser usa).
// Nunca .env.pipeline (D-17, service_role) — este gerador só lê, nunca escreve produção.
// Valores nunca impressos.
// ---------------------------------------------------------------------------

function readEnvLocal() {
  if (!fs.existsSync(ENV_LOCAL_PATH)) {
    throw new Error(`generateSihPacks: ${ENV_LOCAL_PATH} não encontrado — precisa de VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY`);
  }
  const text = fs.readFileSync(ENV_LOCAL_PATH, 'utf8');
  /** @type {Record<string,string>} */
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('generateSihPacks: VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes em .env.local');
  }
  return { url: url.replace(/\/+$/, ''), anonKey };
}

/**
 * Extrai o total anunciado de `content-range: 0-999/6481` — levanta se ausente/malformado
 * (falhar alto, nunca assumir um total). Mesmo contrato de `upload._parse_content_range_total`.
 * @param {Response} res
 */
function parseContentRangeTotal(res) {
  const value = res.headers.get('content-range');
  if (!value) {
    throw new Error('generateSihPacks: resposta sem cabeçalho content-range — não há como saber o total anunciado (Pitfall 13).');
  }
  const total = value.split('/')[1];
  const n = Number(total);
  if (!Number.isFinite(n)) {
    throw new Error(`generateSihPacks: content-range malformado: ${value}`);
  }
  return n;
}

/**
 * Lê TODAS as linhas de `tabela` via PostgREST, paginando pelo cabeçalho `Range` — segue lendo
 * página a página até cobrir o total anunciado em `content-range`; se a soma do que foi lido não
 * bater com o total anunciado, ou o total mudar no meio da leitura, levanta — nunca reporta uma
 * cobertura que não foi de fato lida (T-09-11/Pitfall 13, o mesmo defeito "1000 de N linhas com
 * HTTP 200" que este milestone existe para matar).
 *
 * @param {{ url: string, anonKey: string }} creds
 * @param {string} tabela
 * @param {{ select: string, filters?: Record<string,string> }} query
 * @param {typeof fetch} [fetchImpl]
 */
export async function fetchAllPaginated(creds, tabela, { select, filters = {} }, fetchImpl = fetch) {
  const params = new URLSearchParams({ select, ...filters });
  const linhas = [];
  let totalAnunciado = null;
  let offset = 0;

  for (;;) {
    const res = await fetchImpl(`${creds.url}/rest/v1/${tabela}?${params.toString()}`, {
      headers: {
        apikey: creds.anonKey,
        Authorization: `Bearer ${creds.anonKey}`,
        'Range-Unit': 'items',
        Range: `${offset}-${offset + PAGE_SIZE - 1}`,
        Prefer: 'count=exact',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`generateSihPacks: ${tabela} respondeu ${res.status}: ${body}`);
    }
    const pagina = await res.json();
    const anunciado = parseContentRangeTotal(res);

    if (totalAnunciado === null) {
      totalAnunciado = anunciado;
    } else if (anunciado !== totalAnunciado) {
      throw new Error(
        `generateSihPacks: content-range mudou de total no meio da paginação de ${tabela} (${totalAnunciado} -> ${anunciado}) — dado mudando sob a leitura, abortando.`,
      );
    }

    linhas.push(...pagina);

    if (pagina.length < PAGE_SIZE || linhas.length >= totalAnunciado) break;
    offset += PAGE_SIZE;
  }

  if (totalAnunciado !== null && linhas.length !== totalAnunciado) {
    throw new Error(
      `generateSihPacks: leu ${linhas.length} de ${totalAnunciado} linha(s) anunciadas em content-range para ${tabela} — leitura truncada (Pitfall 13). Nunca reportar cobertura que não foi de fato lida.`,
    );
  }

  return linhas;
}

// ---------------------------------------------------------------------------
// buildPack -- pura, sem I/O. Recebe os dados já buscados (rede) ou já sintetizados (teste) e
// devolve o objeto do pack pronto para serializar. Testável offline (sihPacks.test.ts nunca
// stuba fetch nem toca rede — molde de loadMunicipioPartition.test.ts, D-09).
// ---------------------------------------------------------------------------

/**
 * @param {number} n
 * @param {number} [casas]
 */
function round(n, casas = 6) {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
}

/**
 * D-14: se a linha de `sih_metric_uf` existe para (disease,uf,ano,local=ocorrencia), usa o valor
 * medido. Se não existe, consulta o status de `sih_collection_status` (por medida, sem dimensão
 * de território — D-13) para decidir entre zero verdadeiro (status `coletado`: 0, alguém não
 * internou) e ausência genuína (status `falhou`/`nunca_tentado`/sem linha: `null`) — nunca coage
 * ausência a zero (T-09-30).
 *
 * @param {Map<string, number|null>} statusByDiseaseMedidaAno chave `${diseaseId}|${medida}|${ano}` -> status
 */
function resolveMedida(statusByDiseaseMedidaAno, diseaseId, medida, ano, valorMedido) {
  if (valorMedido !== undefined && valorMedido !== null) return valorMedido;
  const status = statusByDiseaseMedidaAno.get(`${diseaseId}|${medida}|${ano}`);
  return status === 'coletado' ? 0 : null;
}

/**
 * @param {string} packId
 * @param {string} diseaseId
 * @param {{
 *   metricRowsByUfAno: Map<string, { internacoes:number, obitos:number, valor_total:number, dias_permanencia:number }>,
 *   statusByDiseaseMedidaAno: Map<string, string>,
 *   frozenByUfAno?: Map<string, { medicos_vasculares_sus:number|null, populacao:number|null, medicos_vasculares_por_100k:number|null }>,
 *   derivedAt: string,
 *   cidMapVersion: string,
 *   divergenciaRazao?: string | null,
 * }} ctx
 */
export function buildPack(packId, diseaseId, ctx) {
  assertNotTombstone(diseaseId, `generateSihPacks.mjs buildPack(${packId})`);

  const legacy = LEGACY_PACK_DEFS[packId];
  const metricKeys = legacy ? legacy.metricKeys : GENERIC_METRIC_KEYS;
  const rows = [];

  for (const [ufCodigo, uf] of UF_ORDER) {
    for (const ano of YEARS) {
      const key = `${ufCodigo}|${ano}`;
      const medido = ctx.metricRowsByUfAno.get(`${diseaseId}|${key}`);

      const internacoes = resolveMedida(ctx.statusByDiseaseMedidaAno, diseaseId, 'internacoes', ano, medido?.internacoes);
      const obitos = resolveMedida(ctx.statusByDiseaseMedidaAno, diseaseId, 'obitos', ano, medido?.obitos);
      const valorTotal = resolveMedida(ctx.statusByDiseaseMedidaAno, diseaseId, 'valor_total', ano, medido?.valor_total);
      const diasPermanencia = resolveMedida(ctx.statusByDiseaseMedidaAno, diseaseId, 'dias_permanencia', ano, medido?.dias_permanencia);
      // taxa_mortalidade sai do banco como fração (0-1) — todo pack (legado ou genérico) publica
      // percentual (0-100), a mesma convenção que os 10 arquivos já commitados usam.
      const taxaMortalidadePct =
        internacoes == null || internacoes === 0 || obitos == null
          ? null
          : round((obitos / internacoes) * 100);

      /** @type {Record<string, string|number|null>} */
      const row = {
        uf_codigo: ufCodigo,
        uf,
        uf_nome: UF_NOME[uf] ?? null,
        ano,
      };

      if (!legacy) {
        row.internacoes = internacoes;
        row.obitos = obitos;
        row.valor_total = valorTotal;
        row.dias_permanencia = diasPermanencia;
        row.taxa_mortalidade = taxaMortalidadePct;
      } else {
        row[legacy.internacoesKey] = internacoes;
        row[legacy.obitosKey] = obitos;
        if (legacy.diasPermanenciaKey) row[legacy.diasPermanenciaKey] = diasPermanencia;
        if (legacy.valorTotalKey) row[legacy.valorTotalKey] = valorTotal;
        row[legacy.taxaMortalidadeKey] = taxaMortalidadePct;
        if (legacy.letalidadeKey) {
          // letalidade hospitalar = mesma fórmula/óbitos-por-internação da taxa de mortalidade
          // (rótulo histórico duplicado do pack legado de amputação — nunca duas fontes).
          row[legacy.letalidadeKey] = taxaMortalidadePct;
        }
        if (legacy.mediaPermanenciaKey) {
          row[legacy.mediaPermanenciaKey] =
            internacoes == null || internacoes === 0 || diasPermanencia == null
              ? null
              : round(diasPermanencia / internacoes);
        }

        const frozen = ctx.frozenByUfAno?.get(key);
        for (const k of FROZEN_JOIN_KEYS) {
          row[k] = frozen ? (frozen[k] ?? null) : null;
        }
        if (legacy.taxaInternacaoKey) {
          const populacao = frozen?.populacao ?? null;
          row[legacy.taxaInternacaoKey] =
            internacoes == null || !populacao ? null : round((internacoes / populacao) * 100000);
        }
      }

      rows.push(row);
    }
  }

  return {
    packId,
    grain: GRAIN,
    keys: KEYS,
    metricKeys,
    derivedAt: ctx.derivedAt,
    cidMapVersion: ctx.cidMapVersion,
    // Por que no pack e não numa constante no front: o texto nasce em paridade.py e é gravado em
    // sih_collection_status por upload.py. Copiá-lo para TypeScript criaria duas fontes que
    // derivam em silêncio. Vindo pelo pack, mudar a frase no Python e regerar basta.
    divergenciaRazao: ctx.divergenciaRazao ?? null,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Orquestração de rede -- busca sih_metric_uf/sih_collection_status para os 10 disease_ids,
// monta o contexto de cada pack e chama buildPack. Único ponto que toca `fetch`.
// ---------------------------------------------------------------------------

/**
 * @param {string[]} diseaseIds
 * @param {typeof fetch} [fetchImpl]
 */
async function fetchPackContext(diseaseIds, fetchImpl = fetch) {
  const creds = readEnvLocal();
  const idList = diseaseIds.join(',');

  const metricRows = await fetchAllPaginated(
    creds,
    'sih_metric_uf',
    {
      select: 'disease_id,uf_codigo,uf,uf_nome,ano,internacoes,obitos,valor_total,dias_permanencia,taxa_mortalidade',
      // order= é obrigatório para paginação estável -- ver nota "Achado real" no cabeçalho: sem
      // ordenação explícita, o Postgres/PostgREST não garante o mesmo corte de página entre duas
      // requisições Range da MESMA leitura, e uma linha pode sumir de uma página e reaparecer
      // duplicada em outra com o total anunciado permanecendo idêntico (Pitfall 13 na forma mais
      // traiçoeira: a checagem de content-range sozinha não pega isso). As colunas de order= são
      // exatamente a chave primária com `local` fixado pelo filtro -- ordem total, sem empate.
      filters: { disease_id: `in.(${idList})`, local: 'eq.ocorrencia', order: 'disease_id.asc,uf_codigo.asc,ano.asc' },
    },
    fetchImpl,
  );

  const statusRows = await fetchAllPaginated(
    creds,
    'sih_collection_status',
    {
      select: 'disease_id,medida,ano,status,derived_at,cid_map_version,divergencia_razao',
      filters: { disease_id: `in.(${idList})`, grao: 'eq.uf', local: 'eq.ocorrencia', order: 'disease_id.asc,medida.asc,ano.asc' },
    },
    fetchImpl,
  );

  const metricRowsByUfAno = new Map();
  for (const r of metricRows) {
    const key = `${r.disease_id}|${r.uf_codigo}|${r.ano}`;
    if (metricRowsByUfAno.has(key)) {
      throw new Error(
        `generateSihPacks: chave duplicada ${key} em sih_metric_uf -- paginação instável detectada (ver nota "Achado real" no cabeçalho deste arquivo). Abortando em vez de servir dado corrompido.`,
      );
    }
    metricRowsByUfAno.set(key, r);
  }

  const statusByDiseaseMedidaAno = new Map();
  const provenanceByDisease = new Map();
  for (const r of statusRows) {
    statusByDiseaseMedidaAno.set(`${r.disease_id}|${r.medida}|${r.ano}`, r.status);
    if (r.status === 'coletado' && r.derived_at && r.cid_map_version) {
      const prev = provenanceByDisease.get(r.disease_id);
      if (prev && (prev.derivedAt !== r.derived_at || prev.cidMapVersion !== r.cid_map_version)) {
        throw new Error(
          `generateSihPacks: proveniência inconsistente para ${r.disease_id} — sih_collection_status carrega mais de um (derived_at,cid_map_version) para o mesmo agravo (DATA-04 exige um só).`,
        );
      }
      // A razão de divergência viaja com a proveniência e sob a MESMA guarda: um agravo que
      // carregasse duas razões diferentes serviria explicações conflitantes para o mesmo número.
      if (prev && prev.divergenciaRazao !== (r.divergencia_razao ?? null)) {
        throw new Error(
          `generateSihPacks: divergencia_razao inconsistente para ${r.disease_id} — sih_collection_status carrega mais de uma razão para o mesmo agravo. Abortando em vez de servir explicação ambígua.`,
        );
      }
      if (!prev)
        provenanceByDisease.set(r.disease_id, {
          derivedAt: r.derived_at,
          cidMapVersion: r.cid_map_version,
          divergenciaRazao: r.divergencia_razao ?? null,
        });
    }
  }

  return { metricRowsByUfAno, statusByDiseaseMedidaAno, provenanceByDisease };
}

/** Lê os campos congelados de junção CNES/população do pack ATUALMENTE commitado, antes deste
 * gerador sobrescrevê-lo (frozen, ver `FROZEN_JOIN_KEYS`). */
function readFrozenJoinColumns(packId) {
  const packPath = path.join(PACKS_DIR, `${packId}.json`);
  if (!fs.existsSync(packPath)) return new Map();
  const current = JSON.parse(fs.readFileSync(packPath, 'utf8'));
  const map = new Map();
  for (const row of current.rows ?? []) {
    const key = `${row.uf_codigo}|${row.ano}`;
    map.set(key, {
      medicos_vasculares_sus: row.medicos_vasculares_sus ?? null,
      populacao: row.populacao ?? null,
      medicos_vasculares_por_100k: row.medicos_vasculares_por_100k ?? null,
    });
  }
  return map;
}

async function writePacksAtomically(packs) {
  const tmpRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'lacir-sih-packs-'));
  try {
    await fsPromises.mkdir(PACKS_DIR, { recursive: true });
    for (const [packId, pack] of Object.entries(packs)) {
      const tmpFile = path.join(tmpRoot, `${packId}.json`);
      await fsPromises.writeFile(tmpFile, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
      const dest = path.join(PACKS_DIR, `${packId}.json`);
      await fsPromises.rename(tmpFile, dest).catch(async () => {
        await fsPromises.copyFile(tmpFile, dest);
        await fsPromises.unlink(tmpFile);
      });
    }
  } finally {
    await fsPromises.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  }
}

export async function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes('--dry-run');
  const diseaseIds = PACK_IDS.map(diseaseIdFromPackId);
  for (const id of diseaseIds) assertNotTombstone(id, 'generateSihPacks.mjs PACK_IDS');

  const { metricRowsByUfAno, statusByDiseaseMedidaAno, provenanceByDisease } = await fetchPackContext(diseaseIds);

  const packs = {};
  for (const packId of PACK_IDS) {
    const diseaseId = diseaseIdFromPackId(packId);
    const provenance = provenanceByDisease.get(diseaseId);
    if (!provenance) {
      throw new Error(
        `generateSihPacks: nenhuma linha 'coletado' com proveniência em sih_collection_status para ${diseaseId} (grao=uf, local=ocorrencia) — pack não pode ser gerado sem derivedAt/cidMapVersion (DATA-04).`,
      );
    }
    const frozenByUfAno = LEGACY_PACK_DEFS[packId] ? readFrozenJoinColumns(packId) : undefined;
    packs[packId] = buildPack(packId, diseaseId, {
      metricRowsByUfAno,
      statusByDiseaseMedidaAno,
      frozenByUfAno,
      derivedAt: provenance.derivedAt,
      cidMapVersion: provenance.cidMapVersion,
      divergenciaRazao: provenance.divergenciaRazao,
    });
  }

  if (dryRun) {
    for (const packId of PACK_IDS) {
      console.log(`${packId}: rows=${packs[packId].rows.length} (dry-run, nada escrito)`);
    }
    return 0;
  }

  await writePacksAtomically(packs);
  for (const packId of PACK_IDS) {
    console.log(`${packId}: rows=${packs[packId].rows.length} escrito`);
  }
  return 0;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main()
    .then((code) => process.exit(code ?? 0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
