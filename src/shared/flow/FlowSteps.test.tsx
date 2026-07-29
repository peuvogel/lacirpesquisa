import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlowSteps } from './FlowSteps';

const baseCanAdvance = { dados: true, configurar: true, resultados: true };

describe('FlowSteps', () => {
  it('shows configurar instead of dados when config can advance', () => {
    render(
      <FlowSteps
        active="dados"
        canAdvance={{ dados: true, configurar: true, resultados: false }}
        dados={<p>Conteúdo Dados</p>}
        configurar={<p>Conteúdo Configurar</p>}
        resultados={<p>Conteúdo Resultados</p>}
      />,
    );

    expect(screen.queryByText('Conteúdo Dados')).not.toBeInTheDocument();
    expect(screen.getByText('Conteúdo Configurar')).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo Resultados')).not.toBeInTheDocument();
  });

  it('shows results below when resultados can advance', () => {
    render(
      <FlowSteps
        active="resultados"
        canAdvance={baseCanAdvance}
        dados={<p>Dados</p>}
        configurar={<p>Configurar</p>}
        resultados={<p>Resultados</p>}
      />,
    );

    expect(screen.getByText('Configurar')).toBeInTheDocument();
    expect(screen.getByText('Resultados')).toBeInTheDocument();
  });

  it('shows resultados content when active is resultados even if canAdvance.resultados is false', () => {
    render(
      <FlowSteps
        active="resultados"
        canAdvance={{ dados: true, configurar: true, resultados: false }}
        dados={<p>Dados</p>}
        configurar={<p>Configurar</p>}
        resultados={<p>Conteúdo Resultados</p>}
      />,
    );

    expect(screen.getByText('Conteúdo Resultados')).toBeInTheDocument();
  });

  it('exposes the resultados section as an accessible region with the scroll anchor id', () => {
    render(
      <FlowSteps
        active="resultados"
        canAdvance={baseCanAdvance}
        dados={<p>Dados</p>}
        configurar={<p>Configurar</p>}
        resultados={<p>Resultados</p>}
      />,
    );

    const region = screen.getByRole('region', { name: 'Resultados' });
    expect(region).toHaveAttribute('id', 'lacir-flow-results');
  });

  it('scrolls the resultados section into view when it becomes reachable', () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    render(
      <FlowSteps
        active="resultados"
        canAdvance={baseCanAdvance}
        dados={<p>Dados</p>}
        configurar={<p>Configurar</p>}
        resultados={<p>Resultados</p>}
      />,
    );

    expect(scrollIntoViewMock).toHaveBeenCalled();
  });
});
