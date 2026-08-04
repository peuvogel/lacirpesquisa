import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  checkColumnMapKeys,
  checkPartition,
  checkRegeneration,
  checkSlugConsistency,
} from '../../../scripts/catalog/validate.mjs';
import { generateFromSnapshot } from '../../../scripts/catalog/sync-lista-morb.mjs';
import { loadSnapshot } from '../../../scripts/catalog/listaMorbSource.mjs';

/**
 * Prova de TAX-02: os invariantes A, B, D e a extensao D2 rodando contra a taxonomia
 * pre-migracao (fixture congelada na 08-02) e contra a taxonomia canonica regenerada.
 * Nenhuma lista de ids e transcrita a mao — a lista esperada dos 21 corrompidos vem de
 * `rename-map.json`, a allowlist do invariante A vem de `extra-diseases.json`, tudo mais
 * vem de `generateFromSnapshot()`. As unicas strings literais permitidas sao `avc`,
 * `outras_doencas_do_olho_e_anexos`, `amputacao_mmii` e o codigo `330` — citadas
 * nominalmente por TAX-02 e D-25.
 */

const RENAME_MAP_PATH = resolve(process.cwd(), 'scripts/catalog/rename-map.json');
const EXTRA_DISEASES_PATH = resolve(process.cwd(), 'scripts/catalog/extra-diseases.json');
const EXCLUSIONS_PATH = resolve(process.cwd(), 'scripts/catalog/exclusions.json');
const FIXTURE_PATH = resolve(
  process.cwd(),
  'src/test/fixtures/taxonomy/diseases.pre-migracao.json',
);

function loadRenameMap() {
  return JSON.parse(readFileSync(RENAME_MAP_PATH, 'utf8'));
}

function loadExtraDiseases() {
  return JSON.parse(readFileSync(EXTRA_DISEASES_PATH, 'utf8'));
}

function loadExclusions() {
  return JSON.parse(readFileSync(EXCLUSIONS_PATH, 'utf8'));
}

function loadPreMigrationFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
}

/** Allowlist do invariante A: ids de `extra-diseases.json` cujo `reason` nao e vazio — nunca literal. */
function allowlistFromExtras(extras: Array<{ id: string; reason?: string }>) {
  return new Set(
    extras.filter((e) => typeof e.reason === 'string' && e.reason.trim().length > 0).map((e) => e.id),
  );
}

describe('invariante A — consistencia de slug (D-10, TAX-02)', () => {
  it('acusa exatamente os 21 registros que o rename-map.json lista como tombstones, contra a fixture pre-migracao', () => {
    const fixture = loadPreMigrationFixture();
    const allowlist = allowlistFromExtras(loadExtraDiseases());

    const errors = checkSlugConsistency(fixture, allowlist);
    expect(errors).toHaveLength(21);

    const citedIds = new Set(errors.map((msg: string) => msg.split(':')[0].trim()));
    const expectedTombstones = new Set(loadRenameMap().tombstones as string[]);
    expect(citedIds).toEqual(expectedTombstones);
  });

  it('a mensagem do id avc cita o slug esperado outras_doencas_do_olho_e_anexos — a formulacao literal de TAX-02', () => {
    const fixture = loadPreMigrationFixture();
    const allowlist = allowlistFromExtras(loadExtraDiseases());

    const errors = checkSlugConsistency(fixture, allowlist);
    const avcMessage = errors.find((msg: string) => msg.startsWith('avc:'));

    expect(avcMessage).toBeTruthy();
    expect(avcMessage).toContain('outras_doencas_do_olho_e_anexos');
  });

  it('nao acusa nada contra a taxonomia canonica regenerada, com a mesma allowlist', () => {
    const { diseases } = generateFromSnapshot();
    const allowlist = allowlistFromExtras(loadExtraDiseases());

    expect(checkSlugConsistency(diseases, allowlist)).toEqual([]);
  });

  it('sem allowlist, acusa exatamente uma entrada — amputacao_mmii — provando que a allowlist e necessaria e de uma entrada so', () => {
    const { diseases } = generateFromSnapshot();

    const errors = checkSlugConsistency(diseases, new Set());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('amputacao_mmii');
  });
});

describe('invariante B — regeneracao byte-identica (D-10/D-16)', () => {
  it('nao acusa nada quando os textos gerados sao comparados contra eles mesmos', () => {
    const generated = generateFromSnapshot();
    const committed = { diseasesText: generated.diseasesText, listaText: generated.listaText };

    expect(checkRegeneration(committed, generated)).toEqual([]);
  });

  it('pega mutacao de um caractere no texto de diseases.json', () => {
    const generated = generateFromSnapshot();
    const mutated = `${generated.diseasesText.slice(0, 10)}X${generated.diseasesText.slice(11)}`;

    const errors = checkRegeneration(
      { diseasesText: mutated, listaText: generated.listaText },
      generated,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('diseases.json');
  });

  it('pega mutacao de um caractere no texto de diseases.lista.json', () => {
    const generated = generateFromSnapshot();
    const mutated = `${generated.listaText.slice(0, 5)}X${generated.listaText.slice(6)}`;

    const errors = checkRegeneration(
      { diseasesText: generated.diseasesText, listaText: mutated },
      generated,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('diseases.lista.json');
  });

  it('pega troca de formatacao — runtime reserializado com indentacao de 2 espacos em vez de minificado', () => {
    const generated = generateFromSnapshot();
    const reindented = `${JSON.stringify(generated.runtime, null, 2)}\n`;

    const errors = checkRegeneration(
      { diseasesText: generated.diseasesText, listaText: reindented },
      generated,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('diseases.lista.json');
  });
});

describe('invariante D — particao completa (D-14)', () => {
  it('nao acusa nada contra snapshot, exclusions.json, taxonomia canonica e extra-diseases.json reais', () => {
    const { extract } = loadSnapshot();
    const exclusions = loadExclusions();
    const extras = loadExtraDiseases();
    const { diseases } = generateFromSnapshot();

    const errors = checkPartition({ options: extract.options, exclusions, diseases, extras });
    expect(errors).toEqual([]);
  });

  it('acusa o tabnetCode 330 contra a taxonomia pre-migracao — o segundo bug da linha 80 (D-25)', () => {
    const { extract } = loadSnapshot();
    const exclusions = loadExclusions();
    const extras = loadExtraDiseases();
    const fixture = loadPreMigrationFixture();

    const errors = checkPartition({ options: extract.options, exclusions, diseases: fixture, extras });
    expect(errors.some((msg: string) => msg.includes('330'))).toBe(true);
  });

  it('acusa o codigo 331 quando um exclusions sintetico remove a chave 331', () => {
    const { extract } = loadSnapshot();
    const { '331': _omittedReason, ...exclusionsWithout331 } = loadExclusions();
    const extras = loadExtraDiseases();
    const { diseases } = generateFromSnapshot();

    const errors = checkPartition({
      options: extract.options,
      exclusions: exclusionsWithout331,
      diseases,
      extras,
    });
    expect(errors.some((msg: string) => msg.includes('331'))).toBe(true);
  });

  it('acusa um codigo novo inexistente adicionado ao snapshot — codigo novo no TabNet falha alto, nao entra/sai em silencio', () => {
    const { extract } = loadSnapshot();
    const exclusions = loadExclusions();
    const extras = loadExtraDiseases();
    const { diseases } = generateFromSnapshot();
    const syntheticOptions = [...extract.options, { code: '9999', label: 'Categoria sintetica de teste' }];

    const errors = checkPartition({ options: syntheticOptions, exclusions, diseases, extras });
    expect(errors.some((msg: string) => msg.includes('9999'))).toBe(true);
  });
});

describe('extensao D2 — columnMap.json (D-23 estendido para dado)', () => {
  const sampleDiseases = [
    { id: 'doenca_a', label: 'Doenca A', filterKind: 'lista_morb', tabnetCode: '1', def: 'sih/cnv/nibr.def' },
    { id: 'doenca_b', label: 'Doenca B', filterKind: 'lista_morb', tabnetCode: '2', def: 'sih/cnv/nibr.def' },
  ];

  type SyntheticColumnMap = Record<string, Record<string, { id: string; label: string }>>;

  function validColumnMap(): SyntheticColumnMap {
    return {
      'sih.doenca_a_uf': {
        internacoes: { id: 'sih.doenca_a.internacoes', label: 'Internações — Doenca A' },
      },
      'sih.doenca_b_uf': {
        internacoes: { id: 'sih.doenca_b.internacoes', label: 'Internações — Doenca B' },
      },
    };
  }

  it('nao acusa nada contra um columnMap valido e completo', () => {
    expect(checkColumnMapKeys(validColumnMap(), sampleDiseases)).toEqual([]);
  });

  it('acusa chave tombstone — id de nivel 1 sem agravo correspondente em diseases', () => {
    const columnMap: SyntheticColumnMap = validColumnMap();
    columnMap['sih.doenca_fantasma_uf'] = {
      internacoes: { id: 'sih.doenca_fantasma.internacoes', label: 'Internações — Fantasma' },
    };

    const errors = checkColumnMapKeys(columnMap, sampleDiseases);
    expect(errors.some((msg: string) => msg.includes('doenca_fantasma'))).toBe(true);
  });

  it('acusa agravo lista_morb sem chave', () => {
    const columnMap: SyntheticColumnMap = validColumnMap();
    delete columnMap['sih.doenca_b_uf'];

    const errors = checkColumnMapKeys(columnMap, sampleDiseases);
    expect(errors.some((msg: string) => msg.includes('doenca_b'))).toBe(true);
  });

  it('acusa rotulo de outra doenca na folha internacoes — o caso que pega os rotulos clinicos enganosos', () => {
    const columnMap = validColumnMap();
    columnMap['sih.doenca_a_uf'].internacoes.label = 'Internações — Doenca B';

    const errors = checkColumnMapKeys(columnMap, sampleDiseases);
    expect(errors.some((msg: string) => msg.includes('doenca_a') && msg.toLowerCase().includes('label'))).toBe(
      true,
    );
  });
});
