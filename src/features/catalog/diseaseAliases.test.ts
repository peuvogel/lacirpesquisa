import { describe, expect, it } from 'vitest';
import diseasesLista from './diseases.lista.json';
import {
  ALIASES,
  foldAccents,
  labelMatchesQuery,
  matchDiseases,
  resolveAliasTerm,
  withDiseaseAliases,
  type DiseaseLike,
  type DiseaseWithPack,
} from './diseaseAliases';

/** The real 331-label corpus (post-flip canonical taxonomy) — the bateria medida (RESEARCH §6.2) runs against this, not a fixture. */
const DISEASES = diseasesLista as DiseaseLike[];

/** Same corpus, typed with the `packId` field `diseases.lista.json` already carries — needed only by `withDiseaseAliases`. */
const DISEASES_WITH_PACK = diseasesLista as DiseaseWithPack[];

function byId(id: string): DiseaseLike {
  const found = DISEASES.find((d) => d.id === id);
  if (!found) throw new Error(`fixture inválida: id "${id}" não existe em diseases.lista.json`);
  return found;
}

describe('foldAccents', () => {
  it('remove acentos e caixa para permitir comparação neutra', () => {
    expect(foldAccents('Arteroesclerose')).toBe('arteroesclerose');
    expect(foldAccents('Insuficiência cardíaca')).toBe('insuficiencia cardiaca');
  });
});

describe('labelMatchesQuery — regra automática (AND entre tokens + piso de fuzzy)', () => {
  it('"embolia pulmonar" casa exatamente 1 agravo, o código 173', () => {
    const matches = DISEASES.filter((d) => labelMatchesQuery(d.label, 'embolia pulmonar'));
    expect(matches).toHaveLength(1);
    expect(matches[0]?.tabnetCode).toBe('173');
  });

  it('"insuficiencia cardiaca" casa exatamente 1, código 175', () => {
    const matches = DISEASES.filter((d) => labelMatchesQuery(d.label, 'insuficiencia cardiaca'));
    expect(matches).toHaveLength(1);
    expect(matches[0]?.tabnetCode).toBe('175');
  });

  it('"aterosclerose" casa o código 181, cujo rótulo oficial é "Arteroesclerose" (D-17)', () => {
    const matches = DISEASES.filter((d) => labelMatchesQuery(d.label, 'aterosclerose'));
    expect(matches.map((d) => d.tabnetCode)).toContain('181');
    expect(byId('arteroesclerose').label).toBe('Arteroesclerose');
  });

  it('controle: "diabetes" casa o esperado (Diabetes mellitus, 124)', () => {
    const matches = DISEASES.filter((d) => labelMatchesQuery(d.label, 'diabetes'));
    expect(matches.map((d) => d.tabnetCode)).toContain('124');
  });

  it('controle: "pneumonia" casa o esperado (Pneumonia, 193)', () => {
    const matches = DISEASES.filter((d) => labelMatchesQuery(d.label, 'pneumonia'));
    expect(matches.map((d) => d.tabnetCode)).toContain('193');
  });

  it('piso de 6 caracteres: dois tokens de 3 caracteres a distância 2 não casam', () => {
    // "cat" -> "cop": substituir 'a'->'o' e 't'->'p', distância 2, ambos com 3 caracteres.
    expect(labelMatchesQuery('cop', 'cat')).toBe(false);
  });

  it('piso de 6 caracteres: dois tokens de 7 caracteres a distância 2 casam', () => {
    // "abcdefg" -> "abxdyfg": duas substituições, distância 2, ambos com 7 caracteres.
    expect(labelMatchesQuery('abxdyfg', 'abcdefg')).toBe(true);
  });
});

describe('resolveAliasTerm — casamento exato do termo curado', () => {
  it('resolve "avc" para a entrada curada com 4 categorias (escopo cerebrovascular amplo, Task 3)', () => {
    const entry = resolveAliasTerm('avc', ALIASES);
    expect(entry).not.toBeNull();
    expect(entry?.categorias).toHaveLength(4);
  });

  it('não dispara por substring dentro de uma busca maior', () => {
    expect(resolveAliasTerm('sobre avc', ALIASES)).toBeNull();
  });
});

describe('matchDiseases — dicionário curado + regra automática, unidos sem duplicar', () => {
  it('"avc" devolve exatamente os 4 códigos da entrada curada (177+178+179+180, escopo cerebrovascular amplo), com apelido acionado', () => {
    const result = matchDiseases(DISEASES, 'avc', ALIASES);
    expect(result.diseases.map((d) => d.tabnetCode).sort()).toEqual(['177', '178', '179', '180']);
    expect(result.aliasTerm).toBe('avc');
    expect(result.aliasCategoryCount).toBe(4);
  });

  it('"ait" devolve 1 código (150, G45 — corrigido no checkpoint humano da Task 3) via apelido', () => {
    const result = matchDiseases(DISEASES, 'ait', ALIASES);
    expect(result.diseases.map((d) => d.tabnetCode)).toEqual(['150']);
    expect(result.aliasTerm).toBe('ait');
    expect(result.aliasCategoryCount).toBe(1);
  });

  it('"tvp" devolve 1 código (185) via apelido', () => {
    const result = matchDiseases(DISEASES, 'tvp', ALIASES);
    expect(result.diseases.map((d) => d.tabnetCode)).toEqual(['185']);
    expect(result.aliasTerm).toBe('tvp');
    expect(result.aliasCategoryCount).toBe(1);
  });

  it('"varizes" inclui o código 186 no resultado (presença, não exclusividade — falso positivo residual de "raízes" é conhecido e aceito)', () => {
    const result = matchDiseases(DISEASES, 'varizes', ALIASES);
    expect(result.diseases.map((d) => d.tabnetCode)).toContain('186');
  });

  it('sem o dicionário, "avc" devolve zero agravos — prova central do TAX-05: sem apelidos a canonização quebraria a busca', () => {
    const result = matchDiseases(DISEASES, 'avc', []);
    expect(result.diseases).toHaveLength(0);
    expect(result.aliasTerm).toBeNull();
  });

  it('nenhum retorno de matchDiseases contém o termo de apelido como id (D-19)', () => {
    for (const entry of ALIASES) {
      for (const termo of entry.termos) {
        const result = matchDiseases(DISEASES, termo, ALIASES);
        expect(result.diseases.some((d) => d.id === termo)).toBe(false);
      }
    }
  });
});

/** Minimal shape exercised by `withDiseaseAliases` in these tests — mirrors `CatalogEntry`'s
 * own optional `packId`/`aliases` fields without importing that module. */
interface TestCatalogEntry {
  id: string;
  packId?: string;
  aliases?: string[];
}

describe('withDiseaseAliases — enriquece CatalogEntry.aliases em memória (TAX-05, busca de Variáveis)', () => {
  it('entrada cujo pack é do código 178 (uma das categorias de "avc") recebe os termos curados', () => {
    const entries = withDiseaseAliases<TestCatalogEntry>(
      [{ id: 'sih.infarto_cerebral.internacoes', packId: 'sih.infarto_cerebral_uf' }],
      DISEASES_WITH_PACK,
      ALIASES,
    );
    expect(entries[0]?.aliases).toContain('avc');
  });

  it('entrada de pack sem código curado (pneumonia, 193) não recebe nenhum termo', () => {
    const entries = withDiseaseAliases<TestCatalogEntry>(
      [{ id: 'sih.pneumonia.internacoes', packId: 'sih.pneumonia_uf' }],
      DISEASES_WITH_PACK,
      ALIASES,
    );
    expect(entries[0]?.aliases).toBeUndefined();
  });

  it('entrada que já tinha aliases preserva os antigos e ganha os novos', () => {
    const entries = withDiseaseAliases(
      [
        {
          id: 'sih.acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem.internacoes',
          packId: 'sih.acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem_uf',
          aliases: ['termo-pre-existente'],
        },
      ],
      DISEASES_WITH_PACK,
      ALIASES,
    );
    expect(entries[0]?.aliases).toContain('termo-pre-existente');
    expect(entries[0]?.aliases).toContain('avc');
  });

  it('entrada sem packId passa intacta (mesma referência, sem campo aliases criado)', () => {
    const original = { id: 'ref.sidra.9514', aliases: undefined };
    const entries = withDiseaseAliases([original], DISEASES_WITH_PACK, ALIASES);
    expect(entries[0]).toBe(original);
  });

  it('entrada com packId desconhecido (sem disease correspondente) passa intacta', () => {
    const original = { id: 'cnes.medicos_vasculares_sus', packId: 'sih.embolia_e_trombose_arteriais_uf_populacao' };
    const entries = withDiseaseAliases([original], DISEASES_WITH_PACK, ALIASES);
    expect(entries[0]).toBe(original);
  });
});
