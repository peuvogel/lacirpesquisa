/**
 * Differential parity suite: every assertion below runs the ported
 * `parseTabular.ts` and the untouched legacy `tabular-data-input.js` over
 * the exact same input and asserts identical output. This is the guard
 * against 01-RESEARCH.md Pitfall 3 (types "cleanup" silently regressing
 * D-09's messy-DataSUS tolerance).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as port from './parseTabular';
// eslint-disable-next-line import/extensions -- differential parity import of the untouched legacy module
import * as legacy from '../../../assets/js/tabular-data-input.js';
import { legacyStats } from './legacyAdapters';
import type { TabularInputOptions } from './types';

const fixtureDir = join(__dirname, '../../test/fixtures/tabnet');

function readFixture(name: string): string {
  return readFileSync(join(fixtureDir, name), 'utf8');
}

const semicolonMetadataOptions: TabularInputOptions = {
  aliases: {
    uf: ['Unidade da Federação'],
    internacoes: ['Internações'],
    valor: ['Valor total'],
    taxa: ['Taxa de mortalidade'],
  },
  requiredKeys: ['uf', 'internacoes'],
  numericKeys: ['internacoes', 'valor', 'taxa'],
  expectedFormatLabel: 'Unidade da Federação; Internações; Valor total; Taxa de mortalidade',
};

const tabMojibakeOptions: TabularInputOptions = {
  aliases: {
    municipio: ['MunicÃ­pio'],
    regiao: ['RegiÃ£o'],
    populacao: ['PopulaÃ§Ã£o'],
    obitos: ['Ãbitos'],
  },
  requiredKeys: ['municipio', 'populacao'],
  numericKeys: ['populacao', 'obitos'],
  expectedFormatLabel: 'Município; Região; População; Óbitos',
};

const commaAmbiguousOptions: TabularInputOptions = {
  aliases: {
    municipio: ['Município'],
    taxa: ['Taxa por 100k'],
    situacao: ['Situação'],
  },
  requiredKeys: ['municipio', 'taxa'],
  numericKeys: ['taxa'],
  expectedFormatLabel: 'Município; Taxa por 100k; Situação',
};

const fixtureCases: Array<{ file: string; options: TabularInputOptions }> = [
  { file: 'tabnet-semicolon-metadata.txt', options: semicolonMetadataOptions },
  { file: 'tabnet-tab-mojibake.txt', options: tabMojibakeOptions },
  { file: 'tabnet-comma-ambiguous.txt', options: commaAmbiguousOptions },
];

describe('readTabularPasteState differential parity (real TABNET fixtures)', () => {
  fixtureCases.forEach(({ file, options }) => {
    it(`matches legacy output for ${file}`, () => {
      const text = readFixture(file);
      expect(port.readTabularPasteState(text, legacyStats, options)).toEqual(
        legacy.readTabularPasteState(text, legacyStats, options),
      );
    });
  });
});

const numericSamples = [
  '1.234,56',
  '1,5',
  '0,5',
  '1.5',
  '1 234,56',
  '10%',
  '-3,2',
  '',
  '-',
  '—',
  '1.234.567,89',
  '12,5',
  '8,75',
  'abc',
  '1.000',
];

describe('normalizeNumericSource differential parity', () => {
  numericSamples.forEach((raw) => {
    it(`matches legacy output for ${JSON.stringify(raw)}`, () => {
      expect(port.normalizeNumericSource(raw)).toEqual(legacy.normalizeNumericSource(raw));
    });
  });
});

describe('detectDelimiter differential parity', () => {
  numericSamples.forEach((raw) => {
    it(`matches legacy output for lines built from ${JSON.stringify(raw)}`, () => {
      const lines = ['Categoria;Valor', `A;${raw}`, `B;${raw}`];
      expect(port.detectDelimiter(lines)).toEqual(legacy.detectDelimiter(lines));
    });
  });
});

describe('parseDelimitedRows differential parity', () => {
  numericSamples.forEach((raw) => {
    it(`matches legacy output for text built from ${JSON.stringify(raw)}`, () => {
      const text = `Categoria;Valor\nA;${raw}\nB;${raw}`;
      expect(port.parseDelimitedRows(text)).toEqual(legacy.parseDelimitedRows(text));
    });
  });
});

describe('readTabularPasteState direct behavior (not just parity)', () => {
  it('detects the real header row past leading metadata/título/período lines', () => {
    const text = readFixture('tabnet-semicolon-metadata.txt');
    const result = port.readTabularPasteState(text, legacyStats, semicolonMetadataOptions);

    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.headerRowIndex).toBeGreaterThan(0);
      expect(result.headers).toContain('Unidade da Federação');
      expect(result.bodyRows.length).toBeGreaterThan(0);
      expect(result.decimalCommaDetected).toBe(true);
    }
  });

  it('returns a friendly Portuguese error with non-empty details for unrecognizable input', () => {
    const singleWordOptions: TabularInputOptions = {
      aliases: { nome: ['Nome'], valor: ['Valor'] },
      requiredKeys: ['nome', 'valor'],
      expectedFormatLabel: 'Nome; Valor',
    };
    const result = port.readTabularPasteState('palavraisolada', legacyStats, singleWordOptions);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.message).toMatch(/[a-zà-ú]/i);
      expect(result.message).toContain('conteudo colado');
    }
  });
});
