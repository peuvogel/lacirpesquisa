import { describe, expect, it } from 'vitest';
import {
  checkSnapshotIntegrity,
  loadSnapshot,
  parseListaMorbOptions,
} from '../../../scripts/catalog/listaMorbSource.mjs';

describe('snapshot integrity (D-13, invariante C)', () => {
  it('checkSnapshotIntegrity() devolve array vazio contra o snapshot commitado', () => {
    expect(checkSnapshotIntegrity()).toEqual([]);
  });

  it('parseListaMorbOptions decodifica entidades HTML e colapsa espacos', () => {
    const html = `
      <select name="SLista_Morb__CID-10">
        <option value="1">Cora&ccedil;&atilde;o   e    vasos</option>
        <option value="2">Outra doen&ccedil;a</option>
      </select>
    `;
    const options = parseListaMorbOptions(html);
    expect(options).toEqual([
      { code: '1', label: 'Coração e vasos' },
      { code: '2', label: 'Outra doença' },
    ]);
  });

  it('o extrato commitado tem 334 opcoes, TODAS_AS_CATEGORIAS__ primeiro, codigos 1..333 sem buraco', () => {
    const { extract } = loadSnapshot();
    expect(extract.options).toHaveLength(334);
    expect(extract.options[0].code).toBe('TODAS_AS_CATEGORIAS__');

    const realCodes = extract.options
      .slice(1)
      .map((o: { code: string }) => Number(o.code))
      .sort((a: number, b: number) => a - b);
    const expectedCodes = Array.from({ length: 333 }, (_, i) => i + 1);
    expect(realCodes).toEqual(expectedCodes);
  });
});
