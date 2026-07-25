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

  it('does not render t de Student as a button and ignores clicks on its row', async () => {
    const user = userEvent.setup();
    const { onSelectTest } = renderSidebar();

    expect(screen.queryByRole('button', { name: /t de Student/i })).not.toBeInTheDocument();
    const row = screen.getByText('t de Student').closest('[aria-disabled="true"]');
    expect(row).not.toBeNull();
    if (row) {
      await user.click(row);
    }
    expect(onSelectTest).not.toHaveBeenCalled();
  });

  it('shows Disponível for demo and Em breve for unavailable rows', () => {
    renderSidebar();
    const demoRow = screen.getByText('Teste demo').closest('button');
    expect(demoRow).not.toBeNull();
    expect(demoRow).toHaveTextContent('Disponível');

    const studentRow = screen.getByText('t de Student').closest('[aria-disabled="true"]');
    expect(studentRow).not.toBeNull();
    expect(studentRow).toHaveTextContent('Em breve');
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
