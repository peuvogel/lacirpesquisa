import { describe, expect, it } from 'vitest';
import { IMPORT_LIMITS, validateImportLimit, validateTableSize, validateXmlElementLimit } from './importLimits';

describe('import resource boundaries', () => {
  it.each([
    ['fileBytes', /arquivo.*MiB/i], ['textCharacters', /texto.*caracteres/i],
    ['dataRows', /linhas/i], ['columns', /colunas/i], ['cells', /células/i],
    ['sheets', /abas/i], ['zipEntries', /entradas/i],
    ['entryBytes', /entrada.*MiB/i], ['totalBytes', /total.*MiB/i],
  ] as const)('accepts the %s boundary and rejects one above before allocation', (key, message) => {
    const profile = { ...IMPORT_LIMITS, [key]: 3 };
    expect(() => validateImportLimit(key, 3, profile)).not.toThrow();
    expect(() => validateImportLimit(key, 4, profile)).toThrow(message);
    expect(() => validateImportLimit(key, -1, profile)).toThrow(/inválid/i);
    expect(() => validateImportLimit(key, Infinity, profile)).toThrow(/inválid/i);
  });

  it('counts padded cells, including the header, before constructing a matrix', () => {
    const profile = { ...IMPORT_LIMITS, dataRows: 3, columns: 3, cells: 12 };
    expect(() => validateTableSize(3, 3, profile)).not.toThrow();
    expect(() => validateTableSize(3, 3, { ...profile, cells: 11 })).toThrow(/células/);
    expect(() => validateTableSize(4, 1, profile)).toThrow(/linhas/);
    expect(() => validateTableSize(1, 4, profile)).toThrow(/colunas/);
  });

  it('derives the XML element ceiling from existing sheet, row and cell budgets', () => {
    const profile = { ...IMPORT_LIMITS, sheets: 1, dataRows: 2, cells: 3 };
    expect(() => validateXmlElementLimit(21, profile)).not.toThrow();
    expect(() => validateXmlElementLimit(22, profile)).toThrow(/estrutura XML.*21.*elementos/i);
  });
});
