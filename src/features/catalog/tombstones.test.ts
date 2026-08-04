import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertNotTombstone,
  CANONICAL_BY_OLD,
  findTombstoneHits,
  TOMBSTONES,
  tombstonePatterns,
} from '../../../scripts/catalog/tombstones.mjs';
import { renderSeedChunks } from '../../../scripts/catalog/generateDiseaseSeeds.mjs';
import { generateFromSnapshot } from '../../../scripts/catalog/sync-lista-morb.mjs';

const SQL_DIR = resolve(process.cwd(), 'scripts/catalog/sql');

function loadCommittedSql(index: number): string {
  return readFileSync(resolve(SQL_DIR, `${index}.sql`), 'utf8');
}

/** The two verified rename cycles (186↔187 hemorroidas, 173↔182 embolia_pulmonar, D-06)
 * make their canonical id textually identical to a *different* tombstone. In the
 * canonical taxonomy's own SQL, `'hemorroidas'`/`'embolia_pulmonar'` legitimately
 * identify tabnetCode 187/173 — that correct reappearance is not a leftover. */
const CYCLE_CANONICAL_IDS = new Set(Object.values(CANONICAL_BY_OLD).filter((c) => TOMBSTONES.includes(c)));

describe('generateDiseaseSeeds — fidelidade byte a byte (TAX-06)', () => {
  it('renderSeedChunks(taxonomia canonica, 80) reproduz os 5 sql/*.sql commitados byte a byte', () => {
    // Pos-flip (08-06/D-24): os cinco sql/*.sql commitados sao gerados da taxonomia
    // CANONICA (generateFromSnapshot()), nao mais da fixture pre-migracao — essa
    // comparacao era a prova de fidelidade quando os seeds commitados ainda refletiam
    // o estado corrompido (08-04, antes do flip). Comparar contra a fixture aqui
    // testaria um dado que os seeds commitados deliberadamente pararam de conter.
    const { diseases } = generateFromSnapshot();
    const chunks = renderSeedChunks(diseases, 80);
    expect(chunks).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(chunks[i]).toBe(loadCommittedSql(i));
    }
  });

  it('renderSeedChunks(taxonomia canonica, 80) produz 5 chunks somando 331 linhas de valores, ultima entrada amputacao_mmii', () => {
    const { diseases } = generateFromSnapshot();
    const chunks = renderSeedChunks(diseases, 80);
    expect(chunks).toHaveLength(5);

    const valueLineCounts = chunks.map((chunk) => chunk.split('\n').filter((l) => l.startsWith('(')).length);
    expect(valueLineCounts).toEqual([80, 80, 80, 80, 11]);
    expect(valueLineCounts.reduce((a, b) => a + b, 0)).toBe(331);

    const lastChunkLines = chunks[4]!.split('\n');
    const lastValueLine = lastChunkLines[lastChunkLines.length - 2]; // before the "on conflict" closer
    expect(lastValueLine).toContain("'amputacao_mmii'");
    expect(lastValueLine?.endsWith(',')).toBe(false);
  });

  it('nenhum chunk gerado contem qualquer tombstone (fora da reaparicao canonica dos dois ciclos)', () => {
    expect(CYCLE_CANONICAL_IDS).toEqual(new Set(['hemorroidas', 'embolia_pulmonar']));

    const { diseases } = generateFromSnapshot();
    const chunks = renderSeedChunks(diseases, 80);
    for (const chunk of chunks) {
      const realLeftovers = findTombstoneHits(chunk).filter((h) => !CYCLE_CANONICAL_IDS.has(h.id));
      expect(realLeftovers).toEqual([]);
    }
  });
});

describe('tombstonePatterns — ancoragem (D-06/D-22)', () => {
  it('nao casa nas tres formas legadas que ficam intocadas (camada distinta de disease.id)', () => {
    const legacyForms = [
      "'internacoes_embolia_trombose_arteriais'", // nome de coluna do CSV legado (parseCsv.mjs)
      "'outputs/coleta_embolia_trombose_uf'", // nome de diretorio do corpus (paths.mjs, D-22)
      "'base_embolia_trombose_arteriais_uf_2013_2025.csv'", // nome de arquivo do CSV historico
    ];
    for (const text of legacyForms) {
      expect(findTombstoneHits(text, ['embolia_trombose'])).toEqual([]);
    }
  });

  it('casa nas tres formas de agravo: packId, prefixo de variavel e id nu entre aspas', () => {
    expect(findTombstoneHits("sih.avc_uf", ['avc'])).toHaveLength(1);
    expect(findTombstoneHits("sih.avc.internacoes", ['avc'])).toHaveLength(1);
    expect(findTombstoneHits("'avc'", ['avc'])).toHaveLength(1);
    expect(findTombstoneHits('"avc"', ['avc'])).toHaveLength(1);

    const packIdHit = findTombstoneHits('sih.avc_uf', ['avc'])[0];
    expect(packIdHit?.form).toBe('packId');
    const prefixHit = findTombstoneHits('sih.avc.internacoes', ['avc'])[0];
    expect(prefixHit?.form).toBe('variableIdPrefix');
    const bareHit = findTombstoneHits("'avc'", ['avc'])[0];
    expect(bareHit?.form).toBe('bareQuoted');
  });

  it('tombstonePatterns(oldId) devolve exatamente os tres padroes nomeados', () => {
    const patterns = tombstonePatterns('avc');
    expect(patterns.map((p) => p.name).sort()).toEqual(['bareQuoted', 'packId', 'variableIdPrefix']);
  });
});

describe('assertNotTombstone — guarda de escrita (D-06)', () => {
  it('lanca para os dois ids de ciclo (hemorroidas e embolia_pulmonar), citando o canonico', () => {
    expect(() => assertNotTombstone('hemorroidas', 'teste')).toThrow(
      /veias_varicosas_das_extremidades_inferiores/,
    );
    expect(() => assertNotTombstone('embolia_pulmonar', 'teste')).toThrow(
      /outras_doencas_vasculares_perifericas/,
    );
  });

  it('nao lanca para amputacao_mmii (nunca foi id antigo de nada)', () => {
    expect(() => assertNotTombstone('amputacao_mmii', 'teste')).not.toThrow();
  });
});
