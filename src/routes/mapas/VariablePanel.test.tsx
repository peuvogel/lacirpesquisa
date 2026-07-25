import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VariablePanel } from './VariablePanel';

const EMPTY_HEADING = 'Explore o mapa do Brasil';
const EMPTY_BODY =
  'Passe o mouse sobre um estado para ver o que está disponível. Clique para selecionar um ou mais estados e formar grupos de análise.';

describe('VariablePanel', () => {
  it('lists hovered UF variables when nothing is locked', () => {
    render(
      <VariablePanel
        hoveredUF="SP"
        selectedUFs={[]}
        selectedVariables={[]}
        onToggleVariable={() => {}}
        onClearSelection={() => {}}
        onIniciarPesquisa={() => {}}
      />,
    );

    expect(screen.getByText('Visualizando:')).toBeInTheDocument();
    expect(screen.getByText('SP')).toBeInTheDocument();
    expect(screen.getByLabelText('Internações por causa')).toBeInTheDocument();
    expect(screen.queryByText(/Não existe em/i)).not.toBeInTheDocument();
  });

  it('keeps locked selection when hovering a different UF (D-21)', () => {
    render(
      <VariablePanel
        hoveredUF="RJ"
        selectedUFs={['SP', 'BA']}
        selectedVariables={[]}
        onToggleVariable={() => {}}
        onClearSelection={() => {}}
        onIniciarPesquisa={() => {}}
      />,
    );

    expect(screen.getByText('Estados selecionados:')).toBeInTheDocument();
    expect(screen.getByText('SP')).toBeInTheDocument();
    expect(screen.getByText('BA')).toBeInTheDocument();
    expect(screen.queryByText('RJ')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Não existe em BA/).length).toBeGreaterThan(0);
  });

  it('renders shared variables before partial ones with missing-UF text', () => {
    render(
      <VariablePanel
        hoveredUF={null}
        selectedUFs={['SP', 'BA']}
        selectedVariables={[]}
        onToggleVariable={() => {}}
        onClearSelection={() => {}}
        onIniciarPesquisa={() => {}}
      />,
    );

    const list = screen.getByRole('list', { name: 'Variáveis disponíveis' });
    const labels = Array.from(list.querySelectorAll('label')).map((label) => label.textContent);

    const partialIndex = labels.findIndex((text) => text?.includes('Não existe em BA'));
    const sharedIndex = labels.findIndex((text) => text === 'Internações por causa');
    expect(sharedIndex).toBeGreaterThanOrEqual(0);
    expect(partialIndex).toBeGreaterThan(sharedIndex);
    expect(labels.some((text) => text?.includes('Amputações de membros inferiores'))).toBe(true);
    expect(labels.some((text) => text?.includes('Não existe em BA'))).toBe(true);
  });

  it('calls onToggleVariable when a checkbox is toggled', async () => {
    const user = userEvent.setup();
    const onToggleVariable = vi.fn();

    render(
      <VariablePanel
        hoveredUF="SP"
        selectedUFs={[]}
        selectedVariables={[]}
        onToggleVariable={onToggleVariable}
        onClearSelection={() => {}}
        onIniciarPesquisa={() => {}}
      />,
    );

    await user.click(screen.getByLabelText('Internações por causa'));
    expect(onToggleVariable).toHaveBeenCalledWith('Internações por causa');
  });

  it('renders the Mapas empty-state copy when nothing is hovered or selected', () => {
    render(
      <VariablePanel
        hoveredUF={null}
        selectedUFs={[]}
        selectedVariables={[]}
        onToggleVariable={() => {}}
        onClearSelection={() => {}}
        onIniciarPesquisa={() => {}}
      />,
    );

    expect(screen.getByRole('heading', { name: EMPTY_HEADING })).toBeInTheDocument();
    expect(screen.getByText(EMPTY_BODY)).toBeInTheDocument();
  });

  it('disables Iniciar pesquisa with zero variables and enables it with one', () => {
    const { rerender } = render(
      <VariablePanel
        hoveredUF="SP"
        selectedUFs={[]}
        selectedVariables={[]}
        onToggleVariable={() => {}}
        onClearSelection={() => {}}
        onIniciarPesquisa={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Iniciar pesquisa' })).toBeDisabled();

    rerender(
      <VariablePanel
        hoveredUF="SP"
        selectedUFs={[]}
        selectedVariables={['Internações por causa']}
        onToggleVariable={() => {}}
        onClearSelection={() => {}}
        onIniciarPesquisa={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Iniciar pesquisa' })).toBeEnabled();
  });
});
