/**
 * Differential parity suite: every assertion below runs the ported
 * `parseTabular.ts` and the untouched legacy `tabular-data-input.js` over
 * the exact same input and asserts identical output. This is the guard
 * against 01-RESEARCH.md Pitfall 3 (types "cleanup" silently regressing
 * D-09's messy-DataSUS tolerance).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import * as port from './parseTabular';
// eslint-disable-next-line import/extensions -- differential parity import of the untouched legacy module
import * as legacy from '../../../assets/js/tabular-data-input.js';
import { TABULAR_OPTIONS as ANOVA_OPTIONS } from '../../features/tests/anova-tukey/anovaConfig';
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

describe('readTabularPasteState preserves legacy values while normalizing imported matrices', () => {
  fixtureCases.forEach(({ file, options }) => {
    it(`keeps legacy values visible for ${file}`, () => {
      const text = readFixture(file);
      const actual = port.readTabularPasteState(text, legacyStats, options);
      const expected = legacy.readTabularPasteState(text, legacyStats, options);

      expect(actual.status).toBe(expected.status);
      if (actual.status === 'loaded' && expected.status === 'loaded') {
        const { summary: _summary, headers: actualHeaders, bodyRows: actualRows, ...actualFlat } = actual;
        const expectedLoaded = expected as typeof actual;
        const { headers: expectedHeaders, bodyRows: expectedRows, ...expectedFlat } = expectedLoaded;
        expect(actualFlat).toEqual(expectedFlat);
        expect(actualHeaders).toEqual(expectedHeaders);
        expect(actualRows).toHaveLength(expectedRows.length);
        actualRows.forEach((row, index) => {
          expect(row).toHaveLength(actualHeaders.length);
          expect(row.slice(0, expectedRows[index]!.length)).toEqual(expectedRows[index]);
        });
      }
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
  it('preserves quoted delimiters, escaped quotes, spaces and embedded newlines', () => {
    expect(port.parseDelimitedRows('Nome,Valor\n"  A; B, ""C""  ",2\n"duas\nlinhas",3').rows).toEqual([
      ['Nome', 'Valor'], ['  A; B, "C"  ', '2'], ['duas\nlinhas', '3'],
    ]);
  });

  it('parses ordinary numeric comma-separated columns separately', () => {
    expect(port.parseDelimitedRows('A,B,C\n1,2,3\n4,5,6').rows).toEqual([
      ['A', 'B', 'C'], ['1', '2', '3'], ['4', '5', '6'],
    ]);
  });

  it('opens a syntactically valid unmapped table for editing', () => {
    const result = port.readTabularPasteState('Pessoa;Medida\nAna;2\nBia;3', legacyStats, semicolonMetadataOptions);
    expect(result).toMatchObject({ status: 'loaded', headers: ['Pessoa', 'Medida'], bodyRows: [['Ana', '2'], ['Bia', '3']], recognizedColumns: {} });
  });

  it('keeps extra pasted cells editable by synthesizing their headers', () => {
    const result = port.readTabularPasteState('A;B\n1;2;extra\n3', legacyStats);

    expect(result).toMatchObject({
      status: 'loaded',
      headers: ['A', 'B', 'Coluna 3'],
      bodyRows: [['1', '2', 'extra'], ['3', '', '']],
    });
    if (result.status === 'loaded') {
      expect(result.summary).toBeDefined();
      expect(result.summary!.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'extra_cells', rowNumbers: [1] }),
        expect.objectContaining({ code: 'short_rows', rowNumbers: [2] }),
      ]));
    }
  });

  it('records numeric import diagnostics without treating categorical missing-like labels as missing', () => {
    const result = port.readTabularPasteState('desfecho;grupo\n1,25;NA\n2.3;N/A\nNA;NULL', legacyStats, ANOVA_OPTIONS);

    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.summary).toBeDefined();
      expect(result.summary!.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'mixed_numeric_format' }),
        expect.objectContaining({ code: 'missing_tokens', rowNumbers: [3] }),
      ]));
      expect(result.summary!.diagnostics.find((item) => item.code === 'missing_tokens')?.message).toContain('desfecho');
    }
  });

  it('scans missing tokens in recognized temporal columns', () => {
    const result = port.readTabularPasteState('periodo;grupo\n2024;A\nNA;B', legacyStats, {
      aliases: { periodo: ['periodo'], grupo: ['grupo'] },
      requiredKeys: ['periodo', 'grupo'],
      temporalKeys: ['periodo'],
    });

    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.summary).toBeDefined();
      expect(result.summary!.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'missing_tokens', rowNumbers: [2] }),
      ]));
    }
  });

  it('keeps duplicate columns stable while explicitly mapping the first match', () => {
    const result = port.readTabularPasteState('desfecho;desfecho;grupo\n1;99;A\n2;98;B', legacyStats, ANOVA_OPTIONS);

    expect(result).toMatchObject({
      status: 'loaded',
      headers: ['desfecho', 'desfecho', 'grupo'],
      recognizedColumns: { desfecho: { index: 0 }, grupo: { index: 2 } },
    });
    if (result.status === 'loaded') {
      expect(result.summary).toBeDefined();
      expect(result.summary!.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'duplicate_headers', message: expect.stringMatching(/desfecho.*coluna 1.*desfecho.*coluna 2/i) }),
      ]));
    }
  });

  it('accepts non-empty categorical roles in a validated positional fallback', () => {
    const result = port.readTabularPasteState('T1;T2\n1;A\n2;B', legacyStats, {
      aliases: {
        desfecho: ['Desfecho'],
        grupo: ['Grupo'],
      },
      requiredKeys: ['desfecho', 'grupo'],
      numericKeys: ['desfecho'],
      expectedFormatLabel: 'Desfecho; Grupo',
      positionFallback: {
        minColumns: 2,
        requiredKeys: ['desfecho', 'grupo'],
        keysByIndex: ['desfecho', 'grupo'],
      },
    });

    expect(result).toMatchObject({
      status: 'loaded',
      recognizedColumns: {
        desfecho: { index: 0, detection: 'position' },
        grupo: { index: 1, detection: 'position' },
      },
      recognitionMode: 'position',
    });
  });

  it('rejects excess columns before row padding and excess data rows before splitting all lines', () => {
    expect(() => port.parseDelimitedRows('x;'.repeat(128) + 'x')).toThrow(/128.*colunas/);
    expect(() => port.parseDelimitedRows('A\n' + 'x\n'.repeat(10_001))).toThrow(/10[. ]?000.*linhas/);
  });

  it('rejects the prospective 10,001st logical row before slicing its content', () => {
    const finalRow = `"${'z'.repeat(100_000)}\ncontinua"`;
    const text = 'A\n' + 'x\n'.repeat(10_000) + finalRow;
    const finalRowStart = text.length - finalRow.length;
    const slice = vi.spyOn(String.prototype, 'slice');

    try {
      expect(() => port.parseDelimitedRows(text)).toThrow(/10[. ]?000.*linhas/);
      expect(slice.mock.calls.map(([start]) => start)).not.toContain(finalRowStart);
    } finally {
      slice.mockRestore();
    }
  });

  it('rejects pasted text beyond the character limit and unterminated quoted cells', () => {
    expect(() => port.parseDelimitedRows(' '.repeat(5_000_001))).toThrow(/5[. ]?000[. ]?000.*caracteres/);
    expect(() => port.parseDelimitedRows('A;B\n"incompleto;2')).toThrow(/aspas/i);
  });

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
