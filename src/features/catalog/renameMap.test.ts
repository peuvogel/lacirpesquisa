import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeRenameMap, renderRenameMap } from '../../../scripts/catalog/buildRenameMap.mjs';
import { generateFromSnapshot } from '../../../scripts/catalog/sync-lista-morb.mjs';

const FIXTURE_PATH = resolve(
  process.cwd(),
  'src/test/fixtures/taxonomy/diseases.pre-migracao.json',
);
const RENAME_MAP_PATH = resolve(process.cwd(), 'scripts/catalog/rename-map.json');

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
}

function loadCommittedMapText() {
  return readFileSync(RENAME_MAP_PATH, 'utf8');
}

function loadCommittedMap() {
  return JSON.parse(loadCommittedMapText());
}

function findByCode(renames: Array<{ tabnetCode: string }>, tabnetCode: string) {
  const entry = renames.find((r) => r.tabnetCode === tabnetCode);
  expect(entry, `rename para tabnetCode ${tabnetCode} nao encontrado`).toBeTruthy();
  return entry as { tabnetCode: string; old: string; canonical: string; label: string };
}

describe('rename map recomputation (D-12)', () => {
  it('recomputar da fixture congelada + regeneracao do snapshot devolve string byte-identica ao rename-map.json commitado', () => {
    const before = loadFixture();
    const { diseases: after } = generateFromSnapshot();
    const recomputed = renderRenameMap(computeRenameMap({ before, after }));
    expect(recomputed).toBe(loadCommittedMapText());
  });

  it('tem 21 renomeacoes, 1 adicao (codigo 330), 0 remocoes e 21 tombstones unicos', () => {
    const map = loadCommittedMap();
    expect(map.renames).toHaveLength(21);
    expect(map.added).toHaveLength(1);
    expect(map.added[0].tabnetCode).toBe('330');
    expect(map.removed).toHaveLength(0);
    expect(map.tombstones).toHaveLength(21);
    expect(new Set(map.tombstones).size).toBe(21);
  });

  it('os dois ciclos aparecem: 186/187 (hemorroidas <-> veias varicosas) e 173/182 (doencas reumaticas cronicas <-> embolia pulmonar <-> outras vasculares)', () => {
    const map = loadCommittedMap();
    const r186 = findByCode(map.renames, '186');
    const r187 = findByCode(map.renames, '187');
    const r173 = findByCode(map.renames, '173');
    const r182 = findByCode(map.renames, '182');

    expect(r186.old).toBe('hemorroidas');
    expect(r186.canonical).toBe('veias_varicosas_das_extremidades_inferiores');
    expect(r187.old).toBe('outras_doencas_veias');
    expect(r187.canonical).toBe('hemorroidas');

    expect(r173.old).toBe('doencas_reumaticas_cronicas');
    expect(r173.canonical).toBe('embolia_pulmonar');
    expect(r182.old).toBe('embolia_pulmonar');
    expect(r182.canonical).toBe('outras_doencas_vasculares_perifericas');
  });

  it('hemorroidas e embolia_pulmonar sao tombstones que tambem sao canonical de outro codigo (D-06)', () => {
    const map = loadCommittedMap();
    const canonicals = new Set(map.renames.map((r: { canonical: string }) => r.canonical));
    expect(map.tombstones).toContain('hemorroidas');
    expect(map.tombstones).toContain('embolia_pulmonar');
    expect(canonicals.has('hemorroidas')).toBe(true);
    expect(canonicals.has('embolia_pulmonar')).toBe(true);
  });

  it('lanca (nao devolve mapa parcial) se a regeneracao perder um tabnetCode presente na fixture', () => {
    const before = loadFixture();
    const after = before.slice(1);
    expect(() => computeRenameMap({ before, after })).toThrow(/perdido/);
  });

  it('lanca se dois codigos diferentes produzirem o mesmo id canonical (colisao)', () => {
    const before = loadFixture();
    const after = before.map(
      (d: { tabnetCode: string }, i: number) =>
        i < 2 ? { ...d, id: 'colisao_sintetica' } : d,
    );
    expect(() => computeRenameMap({ before, after })).toThrow(/dupl/);
  });
});
