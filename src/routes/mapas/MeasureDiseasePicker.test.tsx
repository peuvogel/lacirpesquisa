import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MeasureDiseasePicker } from './MeasureDiseasePicker';
import { ALIASES } from '@/features/catalog/diseaseAliases';
import { DISEASES } from '@/features/catalog/taxonomy';

/**
 * TAX-05 — busca por apelido plugada no seletor de Mapas (D-17/D-18/D-19).
 *
 * Nenhum rótulo é digitado à mão aqui: tudo vem de `aliases.json` (via `ALIASES`) e
 * `diseases.lista.json` (via `DISEASES`), lido pelos mesmos módulos que o componente usa —
 * se o dicionário mudar (como mudou no checkpoint humano da 08-07: avc passou de 3 para 4
 * categorias, ait de 180 para 150), estes testes acompanham sem edição.
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function aliasEntry(term: string) {
  const entry = ALIASES.find((e) => e.termos.includes(term));
  if (!entry) throw new Error(`fixture inválida: termo "${term}" não está em aliases.json`);
  return entry;
}

function diseaseByTabnetCode(tabnetCode: string) {
  const disease = DISEASES.find((d) => d.tabnetCode === tabnetCode);
  if (!disease) {
    throw new Error(`fixture inválida: tabnetCode ${tabnetCode} não existe em DISEASES`);
  }
  return disease;
}

function officialLabelsFor(term: string): string[] {
  return aliasEntry(term).categorias.map((c) => diseaseByTabnetCode(c.tabnetCode).label);
}

function renderPicker(onToggleDisease = vi.fn()) {
  const utils = render(
    <MeasureDiseasePicker selectedVariableIds={[]} onToggleDisease={onToggleDisease} diseasesOnly />,
  );
  return { ...utils, onToggleDisease };
}

async function typeQuery(user: ReturnType<typeof userEvent.setup>, query: string) {
  const input = screen.getByRole('searchbox', { name: 'Buscar doença' });
  await user.clear(input);
  await user.type(input, query);
}

describe('MeasureDiseasePicker — busca por apelido (TAX-05)', () => {
  it('"avc" mostra as categorias oficiais curadas em aliases.json, uma linha normal por categoria', async () => {
    const user = userEvent.setup();
    renderPicker();
    await typeQuery(user, 'avc');

    const expectedLabels = officialLabelsFor('avc');
    const list = screen.getByRole('list');
    for (const label of expectedLabels) {
      expect(within(list).getByText(label)).toBeInTheDocument();
    }
    expect(within(list).getAllByRole('checkbox')).toHaveLength(expectedLabels.length);
  });

  it('a tira do D-18 aparece citando o número certo de categorias para "avc"', async () => {
    const user = userEvent.setup();
    renderPicker();
    await typeQuery(user, 'avc');

    const count = aliasEntry('avc').categorias.length;
    const strip = screen.getByRole('status');
    expect(strip).toHaveTextContent(new RegExp(`AVC corresponde a ${count} categorias`, 'i'));
  });

  it('clicar num checkbox de "avc" chama onToggleDisease com o id canônico, nunca com o termo "avc"', async () => {
    const user = userEvent.setup();
    const { onToggleDisease } = renderPicker();
    await typeQuery(user, 'avc');

    const expectedIds = new Set(
      aliasEntry('avc').categorias.map((c) => diseaseByTabnetCode(c.tabnetCode).id),
    );
    const list = screen.getByRole('list');
    const [firstCheckbox] = within(list).getAllByRole('checkbox');
    await user.click(firstCheckbox!);

    expect(onToggleDisease).toHaveBeenCalledTimes(1);
    const calledWith = onToggleDisease.mock.calls[0]?.[0];
    expect(expectedIds.has(calledWith)).toBe(true);
    expect(calledWith).not.toBe('avc');
  });

  it('"infarto cerebral" acha a mesma linha que "avc", com texto idêntico (prova de D-19)', async () => {
    const targetDisease = diseaseByTabnetCode('178'); // Infarto cerebral — physical pack, pos-flip id
    const nameRe = new RegExp(escapeRegExp(targetDisease.label));

    const user1 = userEvent.setup();
    const render1 = render(
      <MeasureDiseasePicker selectedVariableIds={[]} onToggleDisease={vi.fn()} diseasesOnly />,
    );
    await user1.type(
      within(render1.container).getByRole('searchbox', { name: 'Buscar doença' }),
      'avc',
    );
    const rowViaAvc = within(render1.container)
      .getByRole('checkbox', { name: nameRe })
      .closest('li');
    const textViaAvc = rowViaAvc?.textContent ?? '';
    render1.unmount();

    const user2 = userEvent.setup();
    const render2 = render(
      <MeasureDiseasePicker selectedVariableIds={[]} onToggleDisease={vi.fn()} diseasesOnly />,
    );
    await user2.type(
      within(render2.container).getByRole('searchbox', { name: 'Buscar doença' }),
      'infarto cerebral',
    );
    const rowViaLabel = within(render2.container)
      .getByRole('checkbox', { name: nameRe })
      .closest('li');
    const textViaLabel = rowViaLabel?.textContent ?? '';
    render2.unmount();

    expect(textViaAvc).not.toBe('');
    expect(textViaLabel).toBe(textViaAvc);
  });

  it('nenhuma linha da lista contém o texto "avc" fora do campo de busca — sem badge de apelido (D-19)', async () => {
    const user = userEvent.setup();
    renderPicker();
    await typeQuery(user, 'avc');

    const list = screen.getByRole('list');
    expect(within(list).queryByText(/avc/i)).not.toBeInTheDocument();
  });

  it('"tvp" mostra 1 categoria e a tira aparece no singular', async () => {
    const user = userEvent.setup();
    renderPicker();
    await typeQuery(user, 'tvp');

    const expectedLabels = officialLabelsFor('tvp');
    expect(expectedLabels).toHaveLength(1);
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('checkbox')).toHaveLength(1);
    expect(within(list).getByText(expectedLabels[0]!)).toBeInTheDocument();

    const strip = screen.getByRole('status');
    expect(strip).toHaveTextContent(/TVP corresponde a 1 categoria/i);
    expect(strip).toHaveTextContent(expectedLabels[0]!);
  });

  it('"aterosclerose" acha a linha oficial "Arteroesclerose" sem entrada curada (D-17)', async () => {
    expect(ALIASES.some((e) => e.termos.includes('aterosclerose'))).toBe(false);

    const user = userEvent.setup();
    renderPicker();
    await typeQuery(user, 'aterosclerose');

    const list = screen.getByRole('list');
    expect(within(list).getByText('Arteroesclerose')).toBeInTheDocument();
    // Regra automática, não apelido curado — nenhuma tira aparece.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('termo sem nenhum resultado mostra "0 resultado(s)" e nenhuma tira', async () => {
    const user = userEvent.setup();
    renderPicker();
    await typeQuery(user, 'zzzznadaaqui');

    expect(screen.getByText('0 resultado(s)')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('"pneumonia" (regra automática, sem apelido curado) não renderiza tira', async () => {
    const user = userEvent.setup();
    renderPicker();
    await typeQuery(user, 'pneumonia');

    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('checkbox').length).toBeGreaterThan(0);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
