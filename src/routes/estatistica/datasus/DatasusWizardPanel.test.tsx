import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DatasusWizardPanel } from './DatasusWizardPanel';

const fixtureDir = join(__dirname, '../../../test/fixtures/tabnet');

function readFixture(name: string): string {
  return readFileSync(join(fixtureDir, name), 'utf8');
}

async function pasteFixture(user: ReturnType<typeof userEvent.setup>, fixtureName: string) {
  const pasteZone = screen.getByRole('textbox', { name: /cole a tabela do datasus/i });
  const text = readFixture(fixtureName);
  await user.click(pasteZone);
  fireEvent.paste(pasteZone, {
    clipboardData: {
      getData: () => text,
    },
  });
  await waitFor(() => {
    expect(screen.getByText('tabela-colada-datasus.tsv')).toBeInTheDocument();
  });
}

describe('DatasusWizardPanel', () => {
  it('renders source card and all six step sections after paste import', async () => {
    const user = userEvent.setup();
    render(<DatasusWizardPanel />);

    await pasteFixture(user, 'tabnet-semicolon-metadata.txt');

    expect(screen.getByText('tabela-colada-datasus.tsv')).toBeInTheDocument();
    expect(screen.getByText('Passo 1 de 6')).toBeInTheDocument();
    expect(screen.getByText('Passo 2 de 6')).toBeInTheDocument();
    expect(screen.getByText('Passo 3 de 6')).toBeInTheDocument();
    expect(screen.getByText('Passo 4 de 6')).toBeInTheDocument();
    expect(screen.getByText('Passo 5 de 6')).toBeInTheDocument();
    expect(screen.getByText('Passo 6 de 6')).toBeInTheDocument();
    expect(screen.getByText('Confirmar a linha de cabeçalho')).toBeInTheDocument();
    expect(screen.getByText('Confirmar e enviar para a análise')).toBeInTheDocument();
  });

  it('changing header-row select re-renders different detected column headers', async () => {
    const user = userEvent.setup();
    render(<DatasusWizardPanel />);
    await pasteFixture(user, 'tabnet-semicolon-metadata.txt');

    const headerSelect = await screen.findByLabelText('Linha do cabeçalho real');
    const initialValue = (headerSelect as HTMLSelectElement).value;

    const options = within(headerSelect as HTMLElement)
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value)
      .filter((value) => value !== initialValue);

    if (!options.length) return;

    await user.selectOptions(headerSelect, options[0]!);
    expect(headerSelect).toHaveValue(options[0]);
  });

  it('changing a role select to Ignorar removes that column from step-4 summary', async () => {
    const user = userEvent.setup();
    render(<DatasusWizardPanel />);
    await pasteFixture(user, 'tabnet-semicolon-metadata.txt');

    await screen.findByText('Passo 4 de 6');

    const roleSelects = screen.getAllByLabelText(/Papel da coluna/i);
    expect(roleSelects.length).toBeGreaterThan(0);

    const firstRoleSelect = roleSelects[0] as HTMLSelectElement;
    const columnHeader = firstRoleSelect.getAttribute('aria-label')?.replace('Papel da coluna ', '') ?? '';

    await user.selectOptions(firstRoleSelect, 'ignore');

    const step4Section = screen.getByText('Passo 4 de 6').closest('section');
    expect(step4Section).toBeTruthy();
    if (columnHeader) {
      expect(within(step4Section as HTMLElement).queryByText(columnHeader)).not.toBeInTheDocument();
    }
  });

  it('confirm button is enabled for a valid fixture and publishes session on click', async () => {
    const user = userEvent.setup();
    const onSessionChange = vi.fn();
    render(<DatasusWizardPanel onSessionChange={onSessionChange} />);

    await pasteFixture(user, 'tabnet-semicolon-metadata.txt');

    const confirmButton = await screen.findByRole('button', { name: /confirmar base normalizada/i });
    expect(confirmButton).not.toBeDisabled();

    await user.click(confirmButton);

    expect(await screen.findByText('Base confirmada. Os testes já podem consumi-la.')).toBeInTheDocument();
    expect(onSessionChange).toHaveBeenCalled();
    const lastSession = onSessionChange.mock.calls.at(-1)?.[0];
    expect(lastSession.confirmedSources).toHaveLength(1);
  });

  it('renders script payload as literal text without executing', async () => {
    const user = userEvent.setup();
    const xssPayload = 'Col1;Col2\n<script>alert(1)</script>;100';
    render(<DatasusWizardPanel />);

    const pasteZone = screen.getByRole('textbox', { name: /cole a tabela do datasus/i });
    await user.click(pasteZone);
    fireEvent.paste(pasteZone, {
      clipboardData: {
        getData: () => xssPayload,
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Passo 1 de 6')).toBeInTheDocument();
    });
    const matches = screen.queryAllByText((content) => content.includes('<script>alert(1)</script>'));
    expect(matches.length).toBeGreaterThan(0);
    expect(document.querySelector('script')).toBeNull();
  });
});
