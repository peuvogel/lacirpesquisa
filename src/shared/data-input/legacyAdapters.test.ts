import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeImportedText, parseNumber } from './legacyAdapters';

describe('legacyAdapters.parseNumber', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['1,5', 1.5],
    ['1.5', 1.5],
    ['—', null],
    ['', null],
    ['abc', null],
    ['12%', null],
  ])('parseNumber(%j) -> %j', (input, expected) => {
    expect(parseNumber(input)).toBe(expected);
  });

  it('returns null, not NaN and not 0, for unparsable values', () => {
    expect(parseNumber('—')).not.toBeNaN();
    expect(parseNumber('—')).not.toBe(0);
    expect(parseNumber('—')).toBeNull();
  });
});

describe('legacyAdapters.normalizeImportedText', () => {
  it('repairs the mojibake TABNET fixture headers into proper NFC Portuguese', () => {
    const fixturePath = join(
      __dirname,
      '../../test/fixtures/tabnet/tabnet-tab-mojibake.txt',
    );
    const raw = readFileSync(fixturePath, 'utf8');
    const headerLine = raw.split('\n')[0];
    const labels = headerLine.split('\t').map((label) => normalizeImportedText(label));

    expect(labels).toEqual(['Município', 'Região', 'População', 'Óbitos']);
    labels.forEach((label) => {
      expect(label).toBe(label.normalize('NFC'));
    });
  });
});
