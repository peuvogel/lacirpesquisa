import { describe, expect, it } from 'vitest';
import {
  checkCatalog,
  checkEntry,
} from '../../../scripts/catalog/validate.mjs';

/** Minimal catalog entry fixture (D-05 complete, reference-only). */
function baseEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sih.demo.internacoes',
    label: 'Internações demo',
    variableType: 'contagem',
    domain: 'vascular',
    sourceSystem: 'SIH/SUS',
    sourceName: 'SIH TabNet',
    tableOrIndicator: 'sih/cnv/nibr.def',
    period: '2013–2025',
    officialUrl: 'https://tabnet.datasus.gov.br/cgi/deftohtm.exe?sih/cnv/nibr.def',
    methodologyNotes: 'Agregação UF×ano a partir de município.',
    loadable: false,
    ...overrides,
  };
}

function miniPack(overrides: Record<string, unknown> = {}) {
  return {
    packId: 'sih.demo',
    grain: 'uf_ano',
    keys: ['uf_codigo', 'uf', 'ano'],
    metricKeys: ['internacoes'],
    rows: [
      {
        uf_codigo: '11',
        uf: 'RO',
        ano: 2013,
        internacoes: 10,
      },
    ],
    ...overrides,
  };
}

describe('checkEntry (D-05 / D-06)', () => {
  it('rejects missing officialUrl', () => {
    const entry = baseEntry({ officialUrl: '' });
    const errors = checkEntry(entry, {});
    expect(errors.some((e: string) => /officialUrl/i.test(e))).toBe(true);
  });

  it('rejects empty methodologyNotes', () => {
    const entry = baseEntry({ methodologyNotes: '   ' });
    const errors = checkEntry(entry, {});
    expect(errors.some((e: string) => /methodologyNotes/i.test(e))).toBe(true);
  });

  it('rejects officialUrl that is not absolute http(s)', () => {
    const entry = baseEntry({ officialUrl: 'ftp://example.com/x' });
    const errors = checkEntry(entry, {});
    expect(errors.some((e: string) => /officialUrl/i.test(e))).toBe(true);
  });

  it('rejects loadable:true without packId/columnKey', () => {
    const entry = baseEntry({ loadable: true });
    const errors = checkEntry(entry, {});
    expect(errors.some((e: string) => /packId|columnKey|loadable/i.test(e))).toBe(
      true,
    );
  });

  it('rejects loadable columnKey absent from pack', () => {
    const pack = miniPack();
    const entry = baseEntry({
      loadable: true,
      packId: 'sih.demo',
      columnKey: 'missing_column',
    });
    const errors = checkEntry(entry, { 'sih.demo': pack });
    expect(
      errors.some((e: string) => /columnKey|missing_column|metricKeys/i.test(e)),
    ).toBe(true);
  });

  it('accepts a complete reference-only entry', () => {
    expect(checkEntry(baseEntry(), {})).toEqual([]);
  });

  it('accepts loadable entry when pack column exists', () => {
    const pack = miniPack();
    const entry = baseEntry({
      loadable: true,
      packId: 'sih.demo',
      columnKey: 'internacoes',
    });
    expect(checkEntry(entry, { 'sih.demo': pack })).toEqual([]);
  });
});

describe('checkCatalog', () => {
  it('rejects duplicate catalog ids', () => {
    const a = baseEntry();
    const b = baseEntry({ label: 'Cópia' });
    const result = checkCatalog({
      variables: [a, b],
      packsById: {},
    });
    expect(result.errors.some((e: string) => /duplicate|duplicad/i.test(e))).toBe(
      true,
    );
  });

  it('fails closed when any entry is an orphan', () => {
    const orphan = baseEntry({ id: 'orphan.x', officialUrl: '' });
    const result = checkCatalog({
      variables: [orphan],
      packsById: {},
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('passes a valid mini catalog', () => {
    const pack = miniPack();
    const entry = baseEntry({
      loadable: true,
      packId: 'sih.demo',
      columnKey: 'internacoes',
    });
    const result = checkCatalog({
      variables: [entry],
      packsById: { 'sih.demo': pack },
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when shared CNES/pop values diverge across packs', () => {
    const sharedKey = 'populacao';
    const packA = miniPack({
      packId: 'pack.a',
      metricKeys: [sharedKey],
      rows: [{ uf_codigo: '11', uf: 'RO', ano: 2013, populacao: 100 }],
    });
    const packB = miniPack({
      packId: 'pack.b',
      metricKeys: [sharedKey],
      rows: [{ uf_codigo: '11', uf: 'RO', ano: 2013, populacao: 999 }],
    });
    const result = checkCatalog({
      variables: [baseEntry()],
      packsById: { 'pack.a': packA, 'pack.b': packB },
      sharedMetricKeys: [sharedKey],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e: string) => /populacao|diverg/i.test(e))).toBe(
      true,
    );
  });
});
