import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TEST_REGISTRY } from '@/features/tests/registry';
import { Sidebar } from './Sidebar';

function renderSidebar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const onSelectTest = vi.fn();
  const onOpenQualTeste = vi.fn();

  render(
    <Sidebar
      activeTestId="demo"
      onSelectTest={onSelectTest}
      onOpenQualTeste={onOpenQualTeste}
      {...overrides}
    />,
  );

  return { onSelectTest, onOpenQualTeste };
}

describe('Sidebar', () => {
  it('renders all ten registry titles grouped in the list', () => {
    renderSidebar();
    for (const entry of TEST_REGISTRY) {
      expect(screen.getByText(entry.title)).toBeInTheDocument();
    }
  });

  it('calls onSelectTest when Teste demo is clicked', async () => {
    const user = userEvent.setup();
    const { onSelectTest } = renderSidebar();

    await user.click(screen.getByRole('button', { name: /Teste demo/i }));

    expect(onSelectTest).toHaveBeenCalledWith('demo');
  });

  it('calls onSelectTest when t de Student is clicked', async () => {
    const user = userEvent.setup();
    const { onSelectTest } = renderSidebar();

    await user.click(screen.getByRole('button', { name: /t de Student/i }));

    expect(onSelectTest).toHaveBeenCalledWith('t-student');
  });

  it('calls onSelectTest when qui-quadrado is clicked', async () => {
    const user = userEvent.setup();
    const { onSelectTest } = renderSidebar();

    await user.click(screen.getByRole('button', { name: /Qui-quadrado/i }));

    expect(onSelectTest).toHaveBeenCalledWith('qui-quadrado');
  });

  it('calls onSelectTest when ANOVA de uma via is clicked', async () => {
    const user = userEvent.setup();
    const { onSelectTest } = renderSidebar();

    await user.click(screen.getByRole('button', { name: /ANOVA de uma via/i }));

    expect(onSelectTest).toHaveBeenCalledWith('anova-tukey');
  });

  it('calls onSelectTest when Kruskal-Wallis is clicked', async () => {
    const user = userEvent.setup();
    const { onSelectTest } = renderSidebar();

    await user.click(screen.getByRole('button', { name: /Kruskal-Wallis/i }));

    expect(onSelectTest).toHaveBeenCalledWith('kruskal-dunn');
  });

  it('does not render poisson as a button and ignores clicks on its row', async () => {
    const user = userEvent.setup();
    const { onSelectTest } = renderSidebar();

    expect(screen.queryByRole('button', { name: /Regressão de Poisson/i })).not.toBeInTheDocument();
    const row = screen.getByText('Regressão de Poisson').closest('[aria-disabled="true"]');
    expect(row).not.toBeNull();
    if (row) {
      await user.click(row);
    }
    expect(onSelectTest).not.toHaveBeenCalled();
  });

  it('shows category and title only  -  no didactic subtitle in the sidebar list', () => {
    renderSidebar();
    const studentRow = screen.getByText('t de Student').closest('button');
    expect(studentRow).not.toBeNull();
    expect(studentRow).not.toHaveTextContent('Comparação simples');
    expect(studentRow).not.toHaveTextContent('Disponível');

    expect(screen.getByText('Comparação de médias')).toBeInTheDocument();
    expect(screen.queryByText(/Prova de conceito do fluxo/i)).not.toBeInTheDocument();
  });

  it('calls onOpenQualTeste when Qual teste usar? is clicked', async () => {
    const user = userEvent.setup();
    const { onOpenQualTeste } = renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Qual teste usar?' }));

    expect(onOpenQualTeste).toHaveBeenCalledTimes(1);
  });

  it('toggles aria-expanded and accessible name on the collapse button', async () => {
    const user = userEvent.setup();
    renderSidebar();

    const toggle = screen.getByRole('button', { name: 'Recolher lista de testes' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAccessibleName('Expandir lista de testes');
  });
});
