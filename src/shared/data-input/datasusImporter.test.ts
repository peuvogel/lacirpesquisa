/**
 * Differential parity suite for the DataSUS ingest chain: parse → header
 * detection → normalization. Runs the ported `datasusImporter.ts` /
 * `datasusNormalizer.ts` against the untouched legacy
 * `datasus-importer.js` / `datasus-normalizer.js` over the same three real
 * TABNET fixtures used by `parseTabular.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as portImporter from './datasusImporter';
import * as portNormalizer from './datasusNormalizer';
// eslint-disable-next-line import/extensions -- differential parity import of the untouched legacy modules
import * as legacyImporter from '../../../assets/js/datasus-importer.js';
// eslint-disable-next-line import/extensions
import * as legacyNormalizer from '../../../assets/js/datasus-normalizer.js';
import { legacyStats, legacyUtils } from './legacyAdapters';
import type { DatasusParsedOk, DatasusSource } from './types';

const fixtureDir = join(__dirname, '../../test/fixtures/tabnet');
const fixtureFiles = [
  'tabnet-semicolon-metadata.txt',
  'tabnet-tab-mojibake.txt',
  'tabnet-comma-ambiguous.txt',
];

function readFixture(name: string): string {
  return readFileSync(join(fixtureDir, name), 'utf8');
}

function buildSource(fixtureFile: string): { source: DatasusSource; parsed: DatasusParsedOk } {
  const text = readFixture(fixtureFile);
  const parsed = portImporter.parseDatasusText({
    text,
    fileName: fixtureFile,
    utils: legacyUtils,
    stats: legacyStats,
  });

  if (!parsed.ok) {
    throw new Error(`Fixture ${fixtureFile} failed to parse: ${parsed.error}`);
  }

  return {
    source: {
      id: `${fixtureFile}-source`,
      fileName: fixtureFile,
      rawText: text,
      parsed,
      mapping: parsed.initialMapping,
      confirmed: true,
    },
    parsed,
  };
}

describe('parseDatasusText differential parity (real TABNET fixtures)', () => {
  fixtureFiles.forEach((file) => {
    it(`matches legacy output for ${file}`, () => {
      const text = readFixture(file);
      const options = { text, fileName: file, utils: legacyUtils, stats: legacyStats };
      expect(portImporter.parseDatasusText(options)).toEqual(legacyImporter.parseDatasusText(options));
    });
  });
});

describe('buildHeaderCandidates differential parity (real TABNET fixtures)', () => {
  fixtureFiles.forEach((file) => {
    it(`matches legacy output for ${file}`, () => {
      const { parsed } = buildSource(file);
      expect(portImporter.buildHeaderCandidates(parsed.rowMatrix, legacyUtils, legacyStats)).toEqual(
        legacyImporter.buildHeaderCandidates(parsed.rowMatrix, legacyUtils, legacyStats),
      );
    });
  });
});

describe('normalizeDatasusSource differential parity (real TABNET fixtures)', () => {
  fixtureFiles.forEach((file) => {
    it(`matches legacy output for ${file}`, () => {
      const { source } = buildSource(file);
      expect(portNormalizer.normalizeDatasusSource(source, legacyUtils, legacyStats)).toEqual(
        legacyNormalizer.normalizeDatasusSource(source, legacyUtils, legacyStats),
      );
    });
  });
});

describe('DataSUS ingest chain direct behavior (not just parity)', () => {
  it('detects a header row past leading metadata lines (headerRowIndex > 0)', () => {
    const { parsed } = buildSource('tabnet-semicolon-metadata.txt');
    expect(parsed.headerRowIndex).toBeGreaterThan(0);
    expect(parsed.headers).toContain('Unidade da Federação');
  });

  it('flags the "Total" row via isTotalLikeToken', () => {
    expect(portImporter.isTotalLikeToken('Total')).toBe(true);
    expect(portImporter.isTotalLikeToken('Total geral')).toBe(true);
    expect(portImporter.isTotalLikeToken('Rondônia')).toBe(false);

    const { parsed } = buildSource('tabnet-semicolon-metadata.txt');
    expect(parsed.diagnosis.totalRowCount).toBeGreaterThan(0);
  });

  it('normalizes the metadata fixture into records with a positive summary count', () => {
    const { source } = buildSource('tabnet-semicolon-metadata.txt');
    const normalized = portNormalizer.normalizeDatasusSource(source, legacyUtils, legacyStats);

    expect(normalized.ok).toBe(true);
    expect(normalized.summary.recordCount).toBeGreaterThan(0);
    expect(normalized.schema.categories.length).toBeGreaterThan(0);
  });
});
