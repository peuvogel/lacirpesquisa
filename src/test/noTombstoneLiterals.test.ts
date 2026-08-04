import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CYCLE_CANONICAL_IDS, findTombstoneHits } from '../../scripts/catalog/tombstones.mjs';
import { SCOPE_EXCLUDE_RELATIVE_PATHS } from '../../scripts/catalog/applyRenameMap.mjs';

/**
 * Invariante F (D-23): guarda estrutural — nenhum id-tombstone (um dos 21 ids
 * corrompidos renomeados pela Fase 8, ver `scripts/catalog/rename-map.json`) pode
 * sobreviver como literal ancorado em qualquer arquivo versionado sob `src/`,
 * `scripts/` ou `public/`. Usa `findTombstoneHits` de `tombstones.mjs` — a mesma
 * funcao que `applyRenameMap.mjs` usou para reescrever — porque compartilhar a funcao
 * e o que garante que varredura e reescrita nunca discordem sobre o que conta como
 * tombstone (uma varredura com regra propria poderia dar verde sobre um arquivo que o
 * motor nunca tocou).
 *
 * Fora do escopo (nao passado para `git ls-files`, nao um "fora da regra"):
 * `.planning/` (documentacao historica, precisa continuar citando os ids antigos),
 * `trabalhos datasus/` (341 diretorios de coleta + scripts Python — D-22, Fase 9),
 * `docs/`, `supabase/` (a migracao e o rollback sao literalmente a lista dos 21 pares).
 */
const ROOT = process.cwd();

/**
 * Allowlist de arquivo — exatamente 4 caminhos, cada um com motivo (D-23).
 */
const ALLOWLIST_RELATIVE_PATHS = new Set<string>([
  // O unico local legitimo para um id-tombstone existir por escrito: o mapa
  // old->canonical em si (D-23). Sem esta entrada o arquivo que alimenta tanto o motor
  // de renomeacao quanto este teste reprovaria a si mesmo.
  'scripts/catalog/rename-map.json',
  // TAX-02/D-24: fixture congelada do estado corrompido pre-migracao — precisa conter
  // os 21 ids antigos para provar que o invariante A os pegaria (nao da pra ver isso
  // "ao vivo" ja que renomeacao+invariante entram no mesmo commit). Ja tem prova
  // propria — igualdade byte a byte com o `diseases.json` pre-flip — em
  // `renameMap.test.ts`.
  'src/test/fixtures/taxonomy/diseases.pre-migracao.json',
  // Este proprio arquivo de teste: nao contem nenhum literal de tombstone hoje (deriva
  // tudo de `rename-map.json` via `tombstones.mjs`), mas fica na allowlist por
  // precaucao — o caso de teste que planta um tombstone abaixo escreve um id-tombstone
  // real dentro de um arquivo temporario, e se algum dia esse padrao mudar para escrever
  // dentro deste proprio arquivo, a varredura nao deve reprovar a si mesma por isso.
  'src/test/noTombstoneLiterals.test.ts',
  // TAX-05/D-19 (08-07): dicionario curado de apelidos clinicos. Duas das quatro
  // entradas ("avc", "ait") sao, por coincidencia de string, tambem dois dos 21
  // ids-tombstone — mas aqui a string vive dentro de `termos` (indice de busca), nunca
  // como `id`/identidade de agravo (D-19: "o apelido vive so no indice de busca").
  // Diferente do defeito que F existe para pegar (um id-tombstone reaparecendo como
  // identidade viva de um agravo), a superficie de risco equivalente aqui — a entrada
  // apontar para o codigo/rotulo errado — ja e coberta por um mecanismo dedicado, o
  // invariante E (`checkAliases` em `validate.mjs`), que amarra cada `tabnetCode`
  // citado ao `label` canonico por maquina. Mesma classe de exclusao de
  // `renameMap.test.ts`/`tombstones.test.ts`: literal presente por razao legitima e
  // verificada, nao por acidente.
  'src/features/catalog/aliases.json',
]);

/**
 * `renameMap.test.ts` (08-02) e `tombstones.test.ts` (08-04) tambem retem ids-tombstone
 * como literais — nao por acidente, mas porque suas asseroes descrevem fatos historicos
 * imutaveis sobre o conteudo do proprio `rename-map.json` (ex.: "o campo `old` do rename
 * do tabnetCode 186 e um id-tombstone especifico"), nao uma referencia viva a identidade
 * de um agravo hoje. `applyRenameMap.mjs` ja exclui exatamente esses dois arquivos do seu
 * proprio escopo de reescrita pela mesma razao (`SCOPE_EXCLUDE_RELATIVE_PATHS`) — importar
 * esse conjunto aqui, em vez de retranscrever os dois caminhos a mao, mantem a disciplina
 * de nunca hand-transcrever uma lista de ids/arquivos (D-12) e garante que os dois
 * allowlists (motor de reescrita e varredura) nunca divirjam por engano.
 */
const ALLOWLIST = new Set<string>([...ALLOWLIST_RELATIVE_PATHS, ...SCOPE_EXCLUDE_RELATIVE_PATHS]);

interface TombstoneFinding {
  file: string;
  id: string;
  form: string;
  offset: number;
  matched: string;
}

function listScannedFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '--', 'src', 'scripts', 'public'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return out.split('\n').filter(Boolean);
}

/**
 * Scan `files` (repo-relative paths) for anchored tombstone literals, excluding the
 * allowlist and the two verified-cycle canonical reappearances (`hemorroidas`/
 * `embolia_pulmonar` legitimately identify a *different*, still-valid agravo today —
 * D-06/08-PATTERNS; the same exclusion `applyRenameMap.mjs`'s leftover count and
 * `--check` mode apply).
 */
function scanForTombstones(files: string[]): TombstoneFinding[] {
  const findings: TombstoneFinding[] = [];
  for (const file of files) {
    if (ALLOWLIST.has(file)) continue;
    let text: string;
    try {
      text = readFileSync(resolve(ROOT, file), 'utf8');
    } catch {
      continue;
    }
    for (const hit of findTombstoneHits(text)) {
      if (CYCLE_CANONICAL_IDS.has(hit.id)) continue;
      findings.push({ file, ...hit });
    }
  }
  return findings;
}

describe('invariante F — nenhum id-tombstone como literal fora da allowlist (D-23)', () => {
  it('a allowlist declarada neste arquivo tem exatamente 4 caminhos', () => {
    expect(ALLOWLIST_RELATIVE_PATHS.size).toBe(4);
  });

  it('a varredura visita mais de 200 arquivos versionados sob src/, scripts/ e public/', () => {
    const files = listScannedFiles();
    expect(files.length).toBeGreaterThan(200);
  });

  it('nenhum arquivo versionado (fora da allowlist) contem um id-tombstone em forma ancorada', () => {
    const findings = scanForTombstones(listScannedFiles());
    if (findings.length > 0) {
      const preview = findings
        .slice(0, 25)
        .map((f) => `${f.file}: id="${f.id}" forma=${f.form} offset=${f.offset} texto="${f.matched}"`)
        .join('\n');
      throw new Error(
        `invariante F FAILED — ${findings.length} id-tombstone(s) fora da allowlist:\n${preview}`,
      );
    }
    expect(findings).toEqual([]);
  });

  it('a funcao de varredura detecta um id-tombstone plantado (prova de que o teste nao passaria olhando para nada)', () => {
    const plantedRelative = `src/test/.tmp-tombstone-plant-${process.pid}-${Date.now()}.ts`;
    const plantedAbs = resolve(ROOT, plantedRelative);
    writeFileSync(plantedAbs, "export const legacyPackId = 'sih.avc_uf';\n");
    try {
      const findings = scanForTombstones([plantedRelative]);
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ file: plantedRelative, id: 'avc', form: 'packId' });
    } finally {
      rmSync(plantedAbs, { force: true });
    }
  });
});
