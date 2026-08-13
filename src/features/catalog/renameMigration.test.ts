import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MIGRATION_TIMESTAMP,
  VERIFY_COUNTS,
  renderDownMigration,
  renderUpMigration,
  renderVerifySql,
} from '../../../scripts/catalog/generateRenameMigration.mjs';

const RENAME_MAP_PATH = resolve(process.cwd(), 'scripts/catalog/rename-map.json');
const UP_PATH = resolve(
  process.cwd(),
  `supabase/migrations/${MIGRATION_TIMESTAMP}_rename_disease_ids.sql`,
);
const DOWN_PATH = resolve(
  process.cwd(),
  `supabase/rollback/${MIGRATION_TIMESTAMP}_rename_disease_ids_down.sql`,
);
const VERIFY_PATH = resolve(process.cwd(), 'supabase/verify/contagens.sql');

type Rename = { tabnetCode: string; old: string; canonical: string; label: string };
type Added = { tabnetCode: string; id: string; label: string; filterKind: string; def: string };

function loadRenameMap(): { renames: Rename[]; added: Added[] } {
  const map = JSON.parse(readFileSync(RENAME_MAP_PATH, 'utf8'));
  return { renames: map.renames, added: map.added };
}

/**
 * `scripts/catalog/metricless-diseases.json` no momento em que a migração Fase 8
 * (`{MIGRATION_TIMESTAMP}_rename_disease_ids.sql` + rollback/verify, já aplicada em produção,
 * 08-10) foi gerada e commitada — o único membro era o código 330. A 09-13/D-19 esvazia o
 * arquivo *vivo* (código 330 passou a ter coleta), mas os três arquivos SQL aqui comparados são
 * fato histórico imutável, a mesma disciplina de `rename-map.json`/`SCOPE_EXCLUDE_RELATIVE_PATHS`
 * (08-06 SUMMARY): reler o arquivo vivo faria esta suíte reivindicar que uma migração já aplicada
 * mudaria de conteúdo, o que nunca é verdade para SQL já rodado contra produção. Congelado aqui,
 * não lido do disco.
 */
function loadMetricless(): Record<string, string> {
  return {
    todas_as_outras_causas_externas:
      "Código TabNet 330 entra na taxonomia canônica por decisão D-25 sem nenhuma coleta associada — nenhuma linha em sih_metric_uf/sih_metric_muni referencia este id. A cobertura de coleta deste agravo é decisão da Fase 9. Este registro é a exceção deliberada admitida pelo invariante de completude: o conjunto de agravos órfãos de métrica não pode crescer além do que estiver aqui registrado (delta de crescimento, D-25 corrigido por medição — 237 dos 330 agravos hoje já não têm linha em sih_metric_uf, não é 'exatamente um').",
  };
}

function loadData() {
  const { renames, added } = loadRenameMap();
  return { renames, added, metricless: loadMetricless() };
}

function stripComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

/** Strips out only whole-line comments — mirrors the plan's `grep -v "^--"` acceptance check. */
function committedText(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('rename migration generation (D-01, D-03, D-04, D-05, D-25 — TAX-03, TAX-04)', () => {
  it('regenera o up em memoria e bate byte a byte, string com string, com o arquivo commitado', () => {
    const data = loadData();
    expect(renderUpMigration(data)).toBe(committedText(UP_PATH));
  });

  it('regenera o down em memoria e bate byte a byte, string com string, com o arquivo commitado', () => {
    const data = loadData();
    expect(renderDownMigration(data)).toBe(committedText(DOWN_PATH));
  });

  it('regenera o verify em memoria e bate byte a byte, string com string, com o arquivo commitado', () => {
    const data = loadData();
    expect(renderVerifySql({ counts: VERIFY_COUNTS, metricless: data.metricless })).toBe(
      committedText(VERIFY_PATH),
    );
  });

  it('o up nao contem ALTER TABLE, ON UPDATE CASCADE nem BEGIN; fora de comentario', () => {
    const data = loadData();
    const semantic = stripComments(renderUpMigration(data)).toLowerCase();
    expect(semantic).not.toContain('alter table');
    expect(semantic).not.toContain('on update cascade');
    expect(/^begin;/m.test(semantic)).toBe(false);
  });

  it('o down nao contem ALTER TABLE, ON UPDATE CASCADE nem BEGIN; fora de comentario', () => {
    const data = loadData();
    const semantic = stripComments(renderDownMigration(data)).toLowerCase();
    expect(semantic).not.toContain('alter table');
    expect(semantic).not.toContain('on update cascade');
    expect(/^begin;/m.test(semantic)).toBe(false);
  });

  it('o up contem os 21 pares do mapa temporario, cada old e cada canonical exatamente onde deveria (derivado de rename-map.json, nunca digitado)', () => {
    const { renames } = loadRenameMap();
    const upText = renderUpMigration(loadData());

    expect(renames).toHaveLength(21);
    for (const r of renames) {
      expect(upText).toContain(`  ('${r.old}', '${r.canonical}')`);
    }
  });

  it('o down contem os mesmos 21 pares do up no mesmo mapa temporario (derivado de rename-map.json, nunca digitado)', () => {
    const { renames } = loadRenameMap();
    const downText = renderDownMigration(loadData());

    for (const r of renames) {
      expect(downText).toContain(`  ('${r.old}', '${r.canonical}')`);
    }
  });

  it('o up contem o INSERT do id de "added" e o down contem o DELETE do mesmo id (derivado de rename-map.json)', () => {
    const { added } = loadRenameMap();
    expect(added).toHaveLength(1);
    const novo = added[0];

    const upText = renderUpMigration(loadData());
    const downText = renderDownMigration(loadData());

    expect(upText).toMatch(/insert into sih_disease/);
    expect(upText).toContain(`'${novo.id}'`);
    expect(upText).toContain(`'${novo.tabnetCode}'`);

    expect(downText).toContain(`delete from sih_disease where id = '${novo.id}';`);
  });

  it('up e down sao simetricos: a passada do down move exatamente na direcao inversa da passada do up, para o mesmo mapa de 21 pares', () => {
    const upText = renderUpMigration(loadData());
    const downText = renderDownMigration(loadData());

    // up: passada 1 casa por old_id e escreve o prefixo temporario; passada 2 escreve canonical_id.
    expect(upText).toMatch(
      /update sih_disease d set id = '__mig_' \|\| d\.id\n {2}from __rename_map m where d\.id = m\.old_id/,
    );
    expect(upText).toContain('update sih_disease d set id = m.canonical_id');

    // down: passada 1 casa por canonical_id e escreve o prefixo temporario; passada 2 escreve old_id —
    // exatamente invertido em relacao ao up, sobre o mesmo mapa (rename-map.json, os mesmos 21 pares).
    expect(downText).toMatch(
      /update sih_disease d set id = '__down_' \|\| d\.id\n {2}from __rename_map m where d\.id = m\.canonical_id/,
    );
    expect(downText).toContain('update sih_disease d set id = m.old_id');
  });

  it('a prova de integridade agrega as quatro medidas nominalmente (internacoes, obitos, valor_total, dias_permanencia) — contagem sozinha nao detecta embaralhamento entre os 21', () => {
    const upText = renderUpMigration(loadData());
    const downText = renderDownMigration(loadData());

    for (const text of [upText, downText]) {
      expect(text).toContain('sum(internacoes)');
      expect(text).toContain('sum(obitos)');
      expect(text).toContain('sum(valor_total)');
      expect(text).toContain('sum(dias_permanencia)');
      // As quatro precisam estar dentro da comparacao IS DISTINCT FROM da prova de
      // integridade, nao so na captura do retrato "antes" — senao a prova regride para
      // "so contagem" sem que nenhum teste perceba.
      expect(text).toMatch(/a\.internacoes is distinct from d\.internacoes/);
      expect(text).toMatch(/a\.obitos is distinct from d\.obitos/);
      expect(text).toMatch(/a\.valor_total is distinct from d\.valor_total/);
      expect(text).toMatch(/a\.dias_permanencia is distinct from d\.dias_permanencia/);
    }
  });

  it('o verify cita as tres contagens absolutas medidas ao vivo (331/30313/1099403) e a excecao registrada de agravo sem metrica', () => {
    const data = loadData();
    const verifyText = renderVerifySql({ counts: VERIFY_COUNTS, metricless: data.metricless });
    expect(VERIFY_COUNTS).toEqual({
      sih_disease: 331,
      sih_metric_uf: 30313,
      sih_metric_muni: 1099403,
    });
    expect(verifyText).toContain('331');
    expect(verifyText).toContain('30313');
    expect(verifyText).toContain('1099403');
    for (const id of Object.keys(data.metricless)) {
      expect(verifyText).toContain(`'${id}'`);
    }
  });

  it('rollback e verify nunca ficam sob supabase/migrations/ — supabase db push nunca os aplica por engano', () => {
    expect(DOWN_PATH).not.toContain('/supabase/migrations/');
    expect(VERIFY_PATH).not.toContain('/supabase/migrations/');
    expect(UP_PATH).toContain('/supabase/migrations/');
  });
});
