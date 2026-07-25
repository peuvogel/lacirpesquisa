import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TEST_REGISTRY } from '@/features/tests/registry';
import { QualTesteModal } from './QualTesteModal';

function renderModal(overrides: Partial<Parameters<typeof QualTesteModal>[0]> = {}) {
  const onOpenChange = vi.fn();
  const onSelectTest = vi.fn();

  render(
    <QualTesteModal
      open
      onOpenChange={onOpenChange}
      onSelectTest={onSelectTest}
      {...overrides}
    />,
  );

  return { onOpenChange, onSelectTest };
}

describe('QualTesteModal', () => {
  it('renders the modal title when open', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Qual teste usar?')).toBeInTheDocument();
  });

  it('recommends t de Student as inert after numérico + dois grupos independentes', async () => {
    const user = userEvent.setup();
    const { onSelectTest } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Numérico contínuo' }));
    await user.click(screen.getByRole('button', { name: 'Dois grupos independentes' }));

    const recommendationHeading = screen.getByText('Recomendação');
    expect(recommendationHeading).toBeInTheDocument();

    const recommendationSection = recommendationHeading.parentElement;
    expect(recommendationSection).not.toBeNull();
    expect(recommendationSection).toHaveTextContent('t de Student');
    expect(recommendationSection).toHaveTextContent('Em breve');
    expect(
      recommendationSection?.querySelector('[aria-disabled="true"]'),
    ).not.toBeNull();
    expect(screen.queryByRole('button', { name: /t de Student/i })).not.toBeInTheDocument();

    const recommendationRow = recommendationSection?.querySelector('[aria-disabled="true"]');
    if (recommendationRow) {
      await user.click(recommendationRow);
    }
    expect(onSelectTest).not.toHaveBeenCalled();
  });

  it('lists all ten registry titles in the roadmap section', async () => {
    renderModal();
    for (const entry of TEST_REGISTRY) {
      expect(screen.getAllByText(entry.title).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('calls onSelectTest(demo) and closes via Começar pelo Teste demo', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onSelectTest } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Numérico contínuo' }));
    await user.click(screen.getByRole('button', { name: 'Dois grupos independentes' }));
    await user.click(screen.getByRole('button', { name: 'Começar pelo Teste demo' }));

    expect(onSelectTest).toHaveBeenCalledWith('demo');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('returns to the previous question via Voltar', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Numérico contínuo' }));
    await user.click(screen.getByRole('button', { name: 'Dois grupos independentes' }));
    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(screen.getByText('Como os dados foram coletados?')).toBeInTheDocument();
    expect(screen.queryByText('Recomendação')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
