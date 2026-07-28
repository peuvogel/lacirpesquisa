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

  it('recommends t de Student as selectable after numérico + dois grupos independentes', async () => {
    const user = userEvent.setup();
    const { onSelectTest } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Numérico contínuo' }));
    await user.click(screen.getByRole('button', { name: 'Dois grupos independentes' }));

    const recommendationHeading = screen.getByText('Recomendação');
    expect(recommendationHeading).toBeInTheDocument();

    const recommendationSection = recommendationHeading.parentElement;
    expect(recommendationSection).not.toBeNull();
    expect(recommendationSection).toHaveTextContent('t de Student');
    expect(recommendationSection).toHaveTextContent('Disponível');

    const recommendationButton = recommendationSection!.querySelector('button');
    expect(recommendationButton).not.toBeNull();
    await user.click(recommendationButton!);

    expect(onSelectTest).toHaveBeenCalledWith('t-student');
  });

  it('lists all registry titles in the roadmap section', async () => {
    renderModal();
    for (const entry of TEST_REGISTRY) {
      expect(screen.getAllByText(entry.title).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('shows Disponível for Wave A classical tests in the roadmap', () => {
    renderModal();

    for (const id of ['qui-quadrado', 'anova-tukey', 'kruskal-dunn'] as const) {
      const entry = TEST_REGISTRY.find((item) => item.id === id);
      expect(entry).toBeDefined();
      const titleNodes = screen.getAllByText(entry!.title);
      const roadmapButton = titleNodes.find((node) => node.closest('button'));
      expect(roadmapButton?.closest('button')).not.toBeNull();
      expect(roadmapButton!.closest('button')!.parentElement).toHaveTextContent('Disponível');
    }
  });

  it('shows Disponível for Wave B GLM tests in the roadmap', () => {
    renderModal();

    for (const id of ['poisson', 'binomial-negativa', 'logistica'] as const) {
      const entry = TEST_REGISTRY.find((item) => item.id === id);
      expect(entry).toBeDefined();
      const titleNodes = screen.getAllByText(entry!.title);
      const roadmapButton = titleNodes.find((node) => node.closest('button'));
      expect(roadmapButton?.closest('button')).not.toBeNull();
      expect(roadmapButton!.closest('button')!.parentElement).toHaveTextContent('Disponível');
    }
  });

  it('calls onSelectTest(t-student) and closes via Usar t de Student', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onSelectTest } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Numérico contínuo' }));
    await user.click(screen.getByRole('button', { name: 'Dois grupos independentes' }));
    await user.click(screen.getByRole('button', { name: 'Usar t de Student' }));

    expect(onSelectTest).toHaveBeenCalledWith('t-student');
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
