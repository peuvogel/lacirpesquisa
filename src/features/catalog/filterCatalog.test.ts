import { describe, expect, it } from 'vitest';
import { filterCatalog } from './filterCatalog';
import type { CatalogEntry } from './types';

function entry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'sih.embolia_e_trombose_arteriais.internacoes',
    label: 'Internações por embolia e trombose arteriais',
    variableType: 'contagem',
    domain: 'vascular',
    sourceSystem: 'SIH/SUS',
    sourceName: 'SIH TabNet',
    tableOrIndicator: 'sih/cnv/nibr.def',
    period: '2013–2025',
    officialUrl: 'https://tabnet.datasus.gov.br/cgi/deftohtm.exe?sih/cnv/nibr.def',
    methodologyNotes: 'Agregação UF×ano.',
    loadable: true,
    packId: 'sih.embolia_e_trombose_arteriais_uf',
    columnKey: 'internacoes_embolia_trombose_arteriais',
    ...overrides,
  };
}

const FIXTURES: CatalogEntry[] = [
  entry(),
  entry({
    id: 'cnes.medicos_vasculares_sus',
    label: 'Médicos vasculares no SUS (CNES)',
    variableType: 'contagem',
    domain: 'rh_sus',
    sourceSystem: 'CNES',
    tableOrIndicator: 'cnes/cnv/prid02br.def',
    columnKey: 'medicos_vasculares_sus',
  }),
  entry({
    id: 'sidra.populacao_residente',
    label: 'População residente',
    variableType: 'contagem',
    domain: 'populacao',
    sourceSystem: 'SIDRA/IBGE',
    loadable: true,
    columnKey: 'populacao',
  }),
  entry({
    id: 'ref.tabnet.sih_morbidade',
    label: 'Morbidade hospitalar (referência)',
    variableType: 'texto',
    domain: 'morbidade',
    sourceSystem: 'SIH/SUS',
    loadable: false,
    packId: undefined,
    columnKey: undefined,
  }),
  entry({
    id: 'sih.embolia_e_trombose_arteriais.taxa_mortalidade',
    label: 'Taxa de mortalidade hospitalar — embolia',
    variableType: 'taxa',
    domain: 'vascular',
    sourceSystem: 'SIH/SUS',
    columnKey: 'taxa_mortalidade_pct',
  }),
];

describe('filterCatalog', () => {
  it('returns all entries when query and filters are empty', () => {
    expect(filterCatalog(FIXTURES, {})).toHaveLength(FIXTURES.length);
    expect(filterCatalog(FIXTURES, { query: '  ' })).toHaveLength(FIXTURES.length);
  });

  it('searches case-insensitively on label, id and sourceSystem', () => {
    expect(filterCatalog(FIXTURES, { query: 'CNES' }).map((e) => e.id)).toEqual([
      'cnes.medicos_vasculares_sus',
    ]);
    expect(
      filterCatalog(FIXTURES, { query: 'embolia_e_trombose_arteriais.internacoes' }).map((e) => e.id),
    ).toEqual(['sih.embolia_e_trombose_arteriais.internacoes']);
    expect(filterCatalog(FIXTURES, { query: 'sidra' }).map((e) => e.id)).toEqual([
      'sidra.populacao_residente',
    ]);
    expect(filterCatalog(FIXTURES, { query: 'população' }).map((e) => e.id)).toEqual([
      'sidra.populacao_residente',
    ]);
  });

  it('filters by sourceSystem, variableType, domain and loadable', () => {
    expect(filterCatalog(FIXTURES, { sourceSystem: 'CNES' })).toHaveLength(1);
    expect(filterCatalog(FIXTURES, { variableType: 'taxa' }).map((e) => e.id)).toEqual([
      'sih.embolia_e_trombose_arteriais.taxa_mortalidade',
    ]);
    expect(filterCatalog(FIXTURES, { domain: 'rh_sus' })).toHaveLength(1);
    expect(filterCatalog(FIXTURES, { loadable: false }).map((e) => e.id)).toEqual([
      'ref.tabnet.sih_morbidade',
    ]);
    expect(filterCatalog(FIXTURES, { loadable: true })).toHaveLength(4);
  });

  it('combines search with filters', () => {
    const result = filterCatalog(FIXTURES, {
      query: 'embolia internacoes',
      variableType: 'contagem',
      loadable: true,
    });
    expect(result.map((e) => e.id)).toEqual(['sih.embolia_e_trombose_arteriais.internacoes']);
  });
});
