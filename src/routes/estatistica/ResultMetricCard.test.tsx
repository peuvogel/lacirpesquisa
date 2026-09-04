import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { metricHelp } from './metricHelp';
import { ResultMetricCard } from './ResultMetricCard';

describe('ResultMetricCard', () => {
  it('explains the variable behind the number, with an example', async () => {
    const user = userEvent.setup();
    render(
      <ResultMetricCard metric={{ label: 'p-valor', value: '0,004', helpKey: 'p-valor' }} />,
    );

    await user.click(screen.getByRole('button', { name: 'O que é p-valor' }));

    const help = metricHelp('p-valor');
    expect(await screen.findByText(help.what)).toBeInTheDocument();
    expect(screen.getByText('Exemplo:')).toBeInTheDocument();
    expect(screen.getByText(help.example)).toBeInTheDocument();
  });

  it('names the button after the card, so several cards stay distinguishable', () => {
    render(
      <>
        <ResultMetricCard metric={{ label: 'Média de Grupo A', value: '4,90', helpKey: 'media-grupo' }} />
        <ResultMetricCard metric={{ label: 'Média de Grupo B', value: '6,04', helpKey: 'media-grupo' }} />
      </>,
    );

    expect(screen.getByRole('button', { name: 'O que é Média de Grupo A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'O que é Média de Grupo B' })).toBeInTheDocument();
  });

  it('keeps the card bare when the metric has no glossary entry', () => {
    render(<ResultMetricCard metric={{ label: 'Método', value: 'Pearson', hint: 'Associação linear' }} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Associação linear')).toBeInTheDocument();
  });
});
