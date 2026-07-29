import { useEffect, useState } from 'react';
import { configure, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FlowSteps } from '@/shared/flow/FlowSteps';
import { runToResultados } from './flowHelpers';

// Encurta o timeout padrão do findByRole (1000ms) só neste arquivo, para o
// caso de rejeição (nenhum módulo de produção é tocado por essa mudança —
// vitest isola configuração de @testing-library/dom por arquivo de teste).
configure({ asyncUtilTimeout: 150 });

/**
 * Componente-fixture local, sem nenhum import de módulo de produção além de
 * FlowSteps (para o `id`/`aria-label` da seção Resultados serem os reais).
 * Simula o carregamento assíncrono do dado: o botão "Analisar dados" só
 * monta depois de um tick (via canAdvance.configurar), tal como
 * ColumnPreviewTable faz na aplicação real.
 */
function Fixture({ advancesToResultados = true }: { advancesToResultados?: boolean }) {
  const [configurarReady, setConfigurarReady] = useState(false);
  const [resultadosReady, setResultadosReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setConfigurarReady(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const active = resultadosReady ? 'resultados' : configurarReady ? 'configurar' : 'dados';

  return (
    <FlowSteps
      active={active}
      onStepChange={() => {}}
      canAdvance={{ dados: true, configurar: configurarReady, resultados: resultadosReady }}
      dados={<p>Cole os dados aqui</p>}
      configurar={
        <button
          type="button"
          onClick={() => {
            if (advancesToResultados) setResultadosReady(true);
          }}
        >
          Analisar dados
        </button>
      }
      resultados={<p>Conteúdo de resultados</p>}
    />
  );
}

describe('runToResultados', () => {
  it('espera o botão "Analisar dados" aparecer, clica nele e resolve com a região Resultados', async () => {
    const user = userEvent.setup();
    render(<Fixture />);

    const region = await runToResultados(user);

    expect(region).toHaveAttribute('aria-label', 'Resultados');
    expect(screen.getByText('Conteúdo de resultados')).toBeInTheDocument();
  });

  it('o elemento devolvido tem id igual a lacir-flow-results', async () => {
    const user = userEvent.setup();
    render(<Fixture />);

    const region = await runToResultados(user);

    expect(region).toHaveAttribute('id', 'lacir-flow-results');
  });

  it('rejeita por timeout se a região Resultados nunca montar', async () => {
    const user = userEvent.setup();
    render(<Fixture advancesToResultados={false} />);

    await expect(runToResultados(user)).rejects.toThrow();
  });
});
