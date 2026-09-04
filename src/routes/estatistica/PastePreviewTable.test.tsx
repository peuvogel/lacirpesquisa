import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { PastePreviewTable } from './PastePreviewTable';

const headers = ['Ano', 'Casos', 'Regiao'];
const bodyRows = [
  ['2019', '120', 'Norte'],
  ['2020', '135', 'Norte'],
  ['2021', '150', 'Sul'],
  ['2022', '164', 'Sul'],
  ['2023', '171', 'Sudeste'],
  ['2024', '158', 'Sudeste'],
];

describe('PastePreviewTable', () => {
  it('shows the headers with the type detected for each column', () => {
    render(<PastePreviewTable headers={headers} bodyRows={bodyRows} />);

    const table = screen.getByRole('table');
    expect(within(table).getByText('Ano')).toBeInTheDocument();
    // Mesma detecção da prévia grande: ano é tempo, contagem é numérica.
    expect(within(table).getByText('Tempo')).toBeInTheDocument();
    expect(within(table).getByText('Numérica')).toBeInTheDocument();
    expect(within(table).getByText('Categórica')).toBeInTheDocument();
  });

  it('stops at the first rows and says how many there are in total', () => {
    render(<PastePreviewTable headers={headers} bodyRows={bodyRows} />);

    expect(screen.getAllByRole('row')).toHaveLength(6); // cabeçalho + 5 linhas
    expect(screen.getByText(/Mostrando 5 de 6 linhas · 3 colunas/)).toBeInTheDocument();
  });

  it('is a reading surface, not an editing one', () => {
    render(<PastePreviewTable headers={headers} bodyRows={bodyRows} />);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('fills in a name for a column that came without a header, and tolerates short rows', () => {
    render(<PastePreviewTable headers={['Ano', '']} bodyRows={[['2019']]} />);

    expect(screen.getByText('Coluna 2')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 1 de 1 linha · 2 colunas')).toBeInTheDocument();
  });

  it('renders nothing when there are no columns to show', () => {
    const { container } = render(<PastePreviewTable headers={[]} bodyRows={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
