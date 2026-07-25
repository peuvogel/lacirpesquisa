import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlowSteps } from './FlowSteps';

const baseCanAdvance = { dados: true, configurar: true, resultados: true };

describe('FlowSteps', () => {
  it('renders only the active step content', () => {
    render(
      <FlowSteps
        active="dados"
        onStepChange={() => {}}
        canAdvance={baseCanAdvance}
        dados={<p>Conteúdo Dados</p>}
        configurar={<p>Conteúdo Configurar</p>}
        resultados={<p>Conteúdo Resultados</p>}
      />,
    );

    expect(screen.getByText('Conteúdo Dados')).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo Configurar')).not.toBeInTheDocument();
    expect(screen.queryByText('Conteúdo Resultados')).not.toBeInTheDocument();
  });

  it('marks the active step with aria-current="step"', () => {
    render(
      <FlowSteps
        active="configurar"
        onStepChange={() => {}}
        canAdvance={baseCanAdvance}
        dados={<p>Dados</p>}
        configurar={<p>Configurar</p>}
        resultados={<p>Resultados</p>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Configurar' })).toHaveAttribute('aria-current', 'step');
  });

  it('disables a step whose canAdvance entry is false, marks aria-disabled, and ignores clicks on it', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    render(
      <FlowSteps
        active="dados"
        onStepChange={onStepChange}
        canAdvance={{ ...baseCanAdvance, resultados: false }}
        dados={<p>Dados</p>}
        configurar={<p>Configurar</p>}
        resultados={<p>Resultados</p>}
      />,
    );

    const resultadosButton = screen.getByRole('button', { name: 'Resultados' });
    expect(resultadosButton).toBeDisabled();
    expect(resultadosButton).toHaveAttribute('aria-disabled', 'true');

    await user.click(resultadosButton);
    expect(onStepChange).not.toHaveBeenCalled();
  });

  it('calls onStepChange with the step id when an enabled step is clicked', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    render(
      <FlowSteps
        active="dados"
        onStepChange={onStepChange}
        canAdvance={baseCanAdvance}
        dados={<p>Dados</p>}
        configurar={<p>Configurar</p>}
        resultados={<p>Resultados</p>}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Configurar' }));
    expect(onStepChange).toHaveBeenCalledWith('configurar');
  });

  it('exposes the accessible nav name "Etapas"', () => {
    render(
      <FlowSteps
        active="dados"
        onStepChange={() => {}}
        canAdvance={baseCanAdvance}
        dados={<p>Dados</p>}
        configurar={<p>Configurar</p>}
        resultados={<p>Resultados</p>}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Etapas' })).toBeInTheDocument();
  });

  it('keeps dados reachable and enabled even when the caller passes canAdvance.dados: false', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    render(
      <FlowSteps
        active="configurar"
        onStepChange={onStepChange}
        canAdvance={{ ...baseCanAdvance, dados: false }}
        dados={<p>Dados</p>}
        configurar={<p>Configurar</p>}
        resultados={<p>Resultados</p>}
      />,
    );

    const dadosButton = screen.getByRole('button', { name: 'Dados' });
    expect(dadosButton).not.toBeDisabled();
    expect(dadosButton).not.toHaveAttribute('aria-disabled', 'true');

    await user.click(dadosButton);
    expect(onStepChange).toHaveBeenCalledWith('dados');
  });
});
