import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlowSteps } from './FlowSteps';

const baseCanAdvance = { dados: true, configurar: true, resultados: true };

describe('FlowSteps', () => {
  it('keeps the data slot reachable while configuration is visible', () => {
    render(
      <FlowSteps
        active="configurar"
        canAdvance={{ dados: true, configurar: true, resultados: false }}
        dados={<p>Trocar dados</p>}
        configurar={<p>Configuração da análise</p>}
        resultados={<p>Resultados</p>}
      />,
    );

    expect(screen.getByText('Trocar dados')).toBeInTheDocument();
    expect(screen.getByText('Configuração da análise')).toBeInTheDocument();
  });
  it('shows both dados and configurar when config can advance', () => {
    render(
      <FlowSteps
        active="dados"
        canAdvance={{ dados: true, configurar: true, resultados: false }}
        dados={<p>Conteúdo Dados</p>}
        configurar={<p>Conteúdo Configurar</p>}
        resultados={<p>Conteúdo Resultados</p>}
      />,
    );

    expect(screen.getByText('Conteúdo Dados')).toBeInTheDocument();
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
    // jsdom nao implementa scrollIntoView: a propriedade nem chega a existir
    // em Element.prototype (typeof === 'undefined', hasOwnProperty === false),
    // entao vi.spyOn() lancaria "is not a function" e nao serve aqui. A
    // atribuicao direta e necessaria — mas precisa ser desfeita no finally,
    // senao qualquer teste adicionado depois deste no mesmo describe herda o
    // mock em vez do comportamento real, sem nenhum sinal disso.
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    try {
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
    } finally {
      if (original) {
        Object.defineProperty(Element.prototype, 'scrollIntoView', original);
      } else {
        // Restaura a ausencia real do jsdom, nao uma propriedade com valor
        // undefined.
        delete (Element.prototype as Partial<Element>).scrollIntoView;
      }
    }
  });

  it('leaves Element.prototype.scrollIntoView unpatched for subsequent tests', () => {
    expect(Object.prototype.hasOwnProperty.call(Element.prototype, 'scrollIntoView')).toBe(false);
  });
});
