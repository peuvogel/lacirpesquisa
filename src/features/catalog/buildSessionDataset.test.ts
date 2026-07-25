import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertCompatibleSelection,
  buildSessionDataset,
} from './buildSessionDataset';
import type { CatalogEntry, PackFile } from './types';

const CATALOG_ROOT = resolve(process.cwd(), 'public/data/catalog');

function readPack(packId: string): PackFile {
  return JSON.parse(
    readFileSync(resolve(CATALOG_ROOT, `packs/${packId}.json`), 'utf8'),
  ) as PackFile;
}

function loadable(
  overrides: Partial<CatalogEntry> & Pick<CatalogEntry, 'id' | 'label' | 'columnKey' | 'packId'>,
): CatalogEntry {
  return {
    variableType: 'contagem',
    domain: 'vascular',
    sourceSystem: 'SIH/SUS',
    sourceName: 'SIH TabNet',
    tableOrIndicator: 'sih/cnv/nibr.def',
    period: '2013–2025',
    officialUrl: 'https://example.com',
    methodologyNotes: 'Fixture.',
    loadable: true,
    ...overrides,
  };
}

const EMBOLIA = readPack('sih.embolia_trombose_uf');
const AMPUTACAO = readPack('sih.amputacao_mmii_uf');

const PACKS: Record<string, PackFile> = {
  [EMBOLIA.packId]: EMBOLIA,
  [AMPUTACAO.packId]: AMPUTACAO,
};

const INTERNACOES_EMBOLIA = loadable({
  id: 'sih.embolia_trombose.internacoes',
  label: 'Internações embolia/trombose',
  packId: 'sih.embolia_trombose_uf',
  columnKey: 'internacoes_embolia_trombose_arteriais',
  tableOrIndicator: 'sih/cnv/nibr.def',
});

const TAXA_EMBOLIA = loadable({
  id: 'sih.embolia_trombose.taxa_internacao_100k',
  label: 'Taxa internação embolia/100k',
  variableType: 'taxa',
  packId: 'sih.embolia_trombose_uf',
  columnKey: 'taxa_internacao_por_100k',
  tableOrIndicator: 'sih/cnv/nibr.def',
});

const INTERNACOES_AMPUTACAO = loadable({
  id: 'sih.amputacao_mmii.internacoes',
  label: 'Internações amputação MMII',
  packId: 'sih.amputacao_mmii_uf',
  columnKey: 'internacoes_amputacao_mmii',
  tableOrIndicator: 'sih/cnv/qibr.def',
});

describe('assertCompatibleSelection', () => {
  it('rejects non-loadable selection', () => {
    const refOnly: CatalogEntry = {
      ...INTERNACOES_EMBOLIA,
      loadable: false,
      packId: undefined,
      columnKey: undefined,
    };
    expect(() => assertCompatibleSelection([refOnly], PACKS)).toThrow(
      /carregáveis|Estatística/i,
    );
  });

  it('rejects incompatible grain (missing uf_codigo/ano keys)', () => {
    const badPack: PackFile = {
      packId: 'bad.muni',
      grain: 'municipio',
      keys: ['mun_codigo', 'ano'],
      metricKeys: ['valor'],
      rows: [{ uf_codigo: '11', uf: 'RO', ano: 2013, valor: 1 }],
    };
    const badEntry = loadable({
      id: 'bad.valor',
      label: 'Valor incompatível',
      packId: 'bad.muni',
      columnKey: 'valor',
    });
    expect(() =>
      assertCompatibleSelection([INTERNACOES_EMBOLIA, badEntry], {
        ...PACKS,
        'bad.muni': badPack,
      }),
    ).toThrow(/compatível|uf_codigo|ano/i);
  });
});

describe('buildSessionDataset', () => {
  it('builds tidy UF×ano rows for same-pack multi-select with n/d for nulls', () => {
    const confirmedAt = 1_700_000_000_000;
    const dataset = buildSessionDataset([INTERNACOES_EMBOLIA, TAXA_EMBOLIA], PACKS, confirmedAt);

    expect(dataset.headers).toEqual([
      'uf_codigo',
      'uf',
      'ano',
      'Internações embolia/trombose',
      'Taxa internação embolia/100k',
    ]);
    expect(dataset.rows.length).toBe(EMBOLIA.rows.length);
    expect(dataset.confirmedAt).toBe(confirmedAt);
    expect(dataset.sourceLabel).toContain('Catálogo LACIR');
    expect(dataset.sourceLabel).toContain('SIH/SUS');
    expect(dataset.sourceLabel).toContain('sih/cnv/nibr.def');
    expect(dataset.sourceLabel).toContain('2013–2025');

    const nullRow = EMBOLIA.rows.find((r) => r.taxa_internacao_por_100k === null);
    expect(nullRow).toBeDefined();
    const built = dataset.rows.find(
      (r) => r[0] === String(nullRow!.uf_codigo) && r[2] === String(nullRow!.ano),
    );
    expect(built).toBeDefined();
    expect(built![4]).toBe('n/d');
    expect(built![3]).toBe(String(nullRow!.internacoes_embolia_trombose_arteriais));
  });

  it('allows cross-pack join for embolia + amputação on uf_codigo+ano', () => {
    const dataset = buildSessionDataset(
      [INTERNACOES_EMBOLIA, INTERNACOES_AMPUTACAO],
      PACKS,
      Date.now(),
    );
    expect(dataset.headers).toEqual([
      'uf_codigo',
      'uf',
      'ano',
      'Internações embolia/trombose',
      'Internações amputação MMII',
    ]);
    expect(dataset.rows.length).toBe(EMBOLIA.rows.length);

    const first = EMBOLIA.rows[0]!;
    const amp = AMPUTACAO.rows.find(
      (r) => r.uf_codigo === first.uf_codigo && r.ano === first.ano,
    );
    expect(amp).toBeDefined();
    const row = dataset.rows[0]!;
    expect(row[0]).toBe(String(first.uf_codigo));
    expect(row[3]).toBe(String(first.internacoes_embolia_trombose_arteriais));
    expect(row[4]).toBe(String(amp!.internacoes_amputacao_mmii));
  });

  it('throws PT error for non-loadable selection', () => {
    expect(() =>
      buildSessionDataset(
        [
          {
            ...INTERNACOES_EMBOLIA,
            loadable: false,
          },
        ],
        PACKS,
      ),
    ).toThrow(/carregáveis|Estatística/i);
  });
});
