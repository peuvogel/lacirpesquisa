import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TEST_REGISTRY } from '@/features/tests/registry';
import { Sidebar } from './Sidebar';

const indexCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../index.css'),
  'utf-8',
);

function renderSidebar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const onSelectTest = vi.fn();
  const onOpenQualTeste = vi.fn();

  render(
    <Sidebar
      activeTestId="t-student"
      onSelectTest={onSelectTest}
      onOpenQualTeste={onOpenQualTeste}
      {...overrides}
    />,
  );

  return { onSelectTest, onOpenQualTeste };
}

describe('Sidebar', () => {
  it('renders all registry titles grouped in the list', () => {
    renderSidebar();
    for (const entry of TEST_REGISTRY) {
      expect(screen.getByText(entry.title)).toBeInTheDocument();
    }
  });

  it('does not render the removed Teste demo', () => {
    renderSidebar();
    expect(screen.queryByText(/Teste demo/i)).not.toBeInTheDocument();
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

  it('calls onSelectTest when poisson is clicked', async () => {
    const user = userEvent.setup();
    const { onSelectTest } = renderSidebar();

    await user.click(screen.getByRole('button', { name: /Regressão de Poisson/i }));

    expect(onSelectTest).toHaveBeenCalledWith('poisson');
  });

  it('calls onSelectTest when binomial negativa is clicked', async () => {
    const user = userEvent.setup();
    const { onSelectTest } = renderSidebar();

    await user.click(screen.getByRole('button', { name: /Regressão Binomial Negativa/i }));

    expect(onSelectTest).toHaveBeenCalledWith('binomial-negativa');
  });

  it('calls onSelectTest when logistica is clicked', async () => {
    const user = userEvent.setup();
    const { onSelectTest } = renderSidebar();

    await user.click(screen.getByRole('button', { name: /Regressão Logística/i }));

    expect(onSelectTest).toHaveBeenCalledWith('logistica');
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

  it('does not render Qual teste usar? button', () => {
    renderSidebar();

    expect(screen.queryByRole('button', { name: 'Qual teste usar?' })).not.toBeInTheDocument();
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

  it('stays below the app header while only the test list scrolls', () => {
    renderSidebar();

    const sidebar = screen.getByRole('complementary', { name: 'Testes disponíveis' });
    const list = screen.getByRole('navigation', { name: 'Lista de testes' });
    expect(sidebar).toHaveClass('sticky', 'top-16', 'self-start', 'h-[calc(100dvh-4rem)]');
    expect(sidebar).toHaveClass('overflow-hidden');
    expect(list).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
  });

  it('disables the width transition when reduced motion is requested', () => {
    renderSidebar();

    expect(screen.getByRole('complementary', { name: 'Testes disponíveis' })).toHaveClass(
      'motion-reduce:transition-none',
    );
  });

  it('marks the sidebar for the mobile expanded overlay layout', () => {
    renderSidebar();

    expect(screen.getByRole('complementary', { name: 'Testes disponíveis' })).toHaveClass(
      'lacir-stat-sidebar',
    );
  });

  it('keeps the narrow expanded sidebar as a fixed non-overflowing overlay', () => {
    const mobileOverlay = indexCss.match(
      /@media\s*\(max-width:\s*980px\)[\s\S]*?\.lacir-stat-sidebar\[data-state='expanded'\][\s\S]*?\}/,
    )?.[0];

    expect(mobileOverlay).toBeDefined();
    expect(mobileOverlay).toContain(".lacir-stat-sidebar[data-state='expanded']");
    expect(mobileOverlay).toMatch(/position:\s*fixed/);
    expect(mobileOverlay).toMatch(/top:\s*4rem/);
    expect(mobileOverlay).toMatch(/z-index:\s*40/);
    expect(mobileOverlay).toMatch(/max-width:\s*100vw/);
  });
});
