import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PACK_IDS, buildPack } from '../../../scripts/catalog/generateSihPacks.mjs';
import { assertNotTombstone } from '../../../scripts/catalog/tombstones.mjs';

/**
 * Prova offline da regeneração dos 10 packs (T-09-47/TAX-06) — molde de
 * `loadMunicipioPartition.test.ts` (D-09): nunca toca rede/PostgREST em `npm run gate`. `buildPack`
 * é pura; os testes reconstroem o CONTEXTO (linhas cruas + status + colunas congeladas) a partir
 * dos 10 arquivos já commitados (escritos por uma corrida real de `generateSihPacks.mjs` contra a
 * produção, ver 09-13-SUMMARY.md) e chamam `buildPack` de novo, comparando byte a byte.
 *
 * Isto prova reprodutibilidade determinística de `buildPack` E funciona como guarda
 * anti-adulteração para os campos DERIVADOS (`taxa_mortalidade`/`_pct`, `letalidade_calculada_pct`,
 * `media_permanencia_calculada`, `taxa_internacao_*_por_100k`): como `buildPack` recalcula esses
 * campos a partir de internações/óbitos/dias/população em vez de copiá-los do arquivo, uma edição
 * manual que deixasse um desses campos inconsistente com o resto da linha faria este teste falhar.
 * Os campos passthrough crus (internações/óbitos/valor_total/dias_permanência e as colunas
 * congeladas de CNES/população) não têm essa mesma garantia dentro deste teste offline — a
 * correção deles contra a fonte servida é provada pela corrida de rede real registrada no SUMMARY,
 * não por este arquivo.
 */

const PACK_ROOT = resolve(process.cwd(), 'public/data/catalog/packs');

type RawFields = {
  internacoes: string;
  obitos: string;
  diasPermanencia: string | null;
  valorTotal: string | null;
};

/** Nome de coluna cru por pack -- os 2 packs legados usam nomes com sufixo de doença; os outros
 * 8 usam os nomes genéricos que `sih_metric_uf` já carrega. */
const RAW_FIELDS: Record<string, RawFields> = {
  'sih.embolia_e_trombose_arteriais_uf': {
    internacoes: 'internacoes_embolia_trombose_arteriais',
    obitos: 'obitos_embolia_trombose_arteriais',
    diasPermanencia: 'dias_permanencia_embolia_trombose_arteriais',
    valorTotal: 'valor_total',
  },
  'sih.amputacao_mmii_uf': {
    internacoes: 'internacoes_amputacao_mmii',
    obitos: 'obitos_amputacao_mmii',
    diasPermanencia: null,
    valorTotal: null,
  },
};

function rawFieldsFor(packId: string): RawFields {
  return (
    RAW_FIELDS[packId] ?? {
      internacoes: 'internacoes',
      obitos: 'obitos',
      diasPermanencia: 'dias_permanencia',
      valorTotal: 'valor_total',
    }
  );
}

function diseaseIdFromPackId(packId: string): string {
  return packId.replace(/^sih\./, '').replace(/_uf$/, '');
}

function readCommittedPack(packId: string): {
  packId: string;
  grain: string;
  keys: string[];
  metricKeys: string[];
  derivedAt: string;
  cidMapVersion: string;
  rows: Array<Record<string, string | number | null>>;
  raw: string;
} {
  const raw = readFileSync(resolve(PACK_ROOT, `${packId}.json`), 'utf8');
  return { ...JSON.parse(raw), raw };
}

/** Reconstrói o contexto que `generateSihPacks.mjs::main()` teria buscado da rede, a partir do
 * pack já commitado (offline, D-09) -- os 10 diseases desta fase têm cobertura nacional completa
 * aprovada (09-12), então toda célula ausente do pack real é zero verdadeiro (status `coletado`),
 * nunca ausência genuína; o caso de ausência genuína (`null`) é coberto por um caso sintético
 * separado abaixo. */
function reconstructContext(packId: string) {
  const committed = readCommittedPack(packId);
  const diseaseId = diseaseIdFromPackId(packId);
  const fields = rawFieldsFor(packId);

  const metricRowsByUfAno = new Map<string, { internacoes: number; obitos: number; valor_total: number; dias_permanencia: number }>();
  const statusByDiseaseMedidaAno = new Map<string, string>();
  const frozenByUfAno = new Map<
    string,
    { medicos_vasculares_sus: number | null; populacao: number | null; medicos_vasculares_por_100k: number | null }
  >();

  for (const row of committed.rows) {
    const key = `${row.uf_codigo}|${row.ano}`;
    const internacoes = row[fields.internacoes] as number | null;
    // Toda medida deste agravo está `coletado` nacionalmente (cobertura completa aprovada) --
    // uma célula sem linha correspondente é zero verdadeiro, nunca ausência.
    for (const medida of ['internacoes', 'obitos', 'valor_total', 'dias_permanencia']) {
      statusByDiseaseMedidaAno.set(`${diseaseId}|${medida}|${row.ano}`, 'coletado');
    }
    if (internacoes !== null && internacoes !== 0) {
      metricRowsByUfAno.set(`${diseaseId}|${row.uf_codigo}|${row.ano}`, {
        internacoes,
        obitos: row[fields.obitos] as number,
        valor_total: (fields.valorTotal ? row[fields.valorTotal] : null) as number,
        dias_permanencia: (fields.diasPermanencia ? row[fields.diasPermanencia] : null) as number,
      });
    }
    if (RAW_FIELDS[packId]) {
      frozenByUfAno.set(key, {
        medicos_vasculares_sus: row.medicos_vasculares_sus as number | null,
        populacao: row.populacao as number | null,
        medicos_vasculares_por_100k: row.medicos_vasculares_por_100k as number | null,
      });
    }
  }

  return {
    committed,
    diseaseId,
    ctx: {
      metricRowsByUfAno,
      statusByDiseaseMedidaAno,
      frozenByUfAno: RAW_FIELDS[packId] ? frozenByUfAno : undefined,
      derivedAt: committed.derivedAt,
      cidMapVersion: committed.cidMapVersion,
    },
  };
}

describe('sihPacks (09-13, D-19, TAX-06)', () => {
  it.each(PACK_IDS)('%s: regenera em memória e bate byte a byte com o arquivo commitado', (packId) => {
    const { committed, diseaseId, ctx } = reconstructContext(packId);
    const regenerated = buildPack(packId, diseaseId, ctx);
    expect(`${JSON.stringify(regenerated, null, 2)}\n`).toBe(committed.raw);
  });

  it.each(PACK_IDS)('%s: derivedAt e cidMapVersion não vazios', (packId) => {
    const committed = readCommittedPack(packId);
    expect(typeof committed.derivedAt).toBe('string');
    expect(committed.derivedAt.length).toBeGreaterThan(0);
    expect(typeof committed.cidMapVersion).toBe('string');
    expect(committed.cidMapVersion.length).toBeGreaterThan(0);
  });

  it.each(PACK_IDS)('%s: cobre a janela 2013-2025 e as 27 UFs (351 linhas)', (packId) => {
    const committed = readCommittedPack(packId);
    expect(committed.rows).toHaveLength(351);
    const years = [...new Set(committed.rows.map((r) => r.ano))].sort((a, b) => (a as number) - (b as number));
    expect(years[0]).toBe(2013);
    expect(years[years.length - 1]).toBe(2025);
    expect(years).toHaveLength(13);
    const ufs = new Set(committed.rows.map((r) => r.uf));
    expect(ufs.size).toBe(27);
  });

  it('nenhum pack contém um disease_id que seja tombstone da Fase 8', () => {
    for (const packId of PACK_IDS) {
      const diseaseId = diseaseIdFromPackId(packId);
      expect(() => assertNotTombstone(diseaseId, 'sihPacks.test.ts')).not.toThrow();
    }
  });

  it('metricless-diseases.json é um array vazio (código 330 passou a ter coleta, D-25)', () => {
    const raw = readFileSync(
      resolve(process.cwd(), 'scripts/catalog/metricless-diseases.json'),
      'utf8',
    );
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(0);
  });

  it('ausência viaja como null nos packs, nunca como 0 (D-14/T-09-30) -- os 3 estados', () => {
    const pack = buildPack('sih.infarto_cerebral_uf', 'infarto_cerebral', {
      metricRowsByUfAno: new Map(),
      statusByDiseaseMedidaAno: new Map([
        ['infarto_cerebral|internacoes|2013', 'coletado'],
        ['infarto_cerebral|internacoes|2014', 'falhou'],
        // 2015 sem entrada nenhuma -- nunca_tentado/ausência de linha no ledger de cobertura
      ]),
      derivedAt: '2026-01-01T00:00:00Z',
      cidMapVersion: 'teste',
    });

    const row2013 = pack.rows.find((r) => r.uf_codigo === '11' && r.ano === 2013)!;
    const row2014 = pack.rows.find((r) => r.uf_codigo === '11' && r.ano === 2014)!;
    const row2015 = pack.rows.find((r) => r.uf_codigo === '11' && r.ano === 2015)!;

    // status coletado + linha ausente = zero verdadeiro (D-14) -- 0, não null.
    expect(row2013.internacoes).toBe(0);
    expect(row2013.taxa_mortalidade).toBeNull();

    // status falhou = ausência genuína -- null, nunca coagido a 0 (T-09-30).
    expect(row2014.internacoes).toBeNull();
    expect(row2014.internacoes).not.toBe(0);

    // sem nenhuma entrada de status = mesma ausência genuína.
    expect(row2015.internacoes).toBeNull();
    expect(row2015.internacoes).not.toBe(0);
  });

  it('regenerar duas vezes com o mesmo contexto produz o mesmo objeto (buildPack é determinística)', () => {
    const { diseaseId, ctx } = reconstructContext('sih.infarto_cerebral_uf');
    const a = buildPack('sih.infarto_cerebral_uf', diseaseId, ctx);
    const b = buildPack('sih.infarto_cerebral_uf', diseaseId, ctx);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
