import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColumnPreviewTable } from './ColumnPreviewTable';

const headers = ['Município', 'Taxa'];
const bodyRows = Array.from({ length: 10 }, (_, index) => [`Cidade ${index + 1}`, String(index + 1)]);

describe('ColumnPreviewTable', () => {
  it('renders headers, up to 8 preview rows, and the total-count caption', () => {
    render(
      <ColumnPreviewTable
        headers={headers}
        bodyRows={bodyRows}
        recognizedColumns={{ municipio: 0, taxa: 1 }}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByText('Município')).toBeInTheDocument();
    expect(screen.getByText('Taxa')).toBeInTheDocument();
    // 1 header row + 8 preview body rows.
    expect(screen.getAllByRole('row')).toHaveLength(9);
    expect(screen.getByText('Mostrando 8 de 10 linhas')).toBeInTheDocument();
  });

  it('disables the confirm CTA for a single-column input', () => {
    render(
      <ColumnPreviewTable
        headers={['Só uma coluna']}
        bodyRows={[['1'], ['2']]}
        recognizedColumns={{}}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Analisar dados' })).toBeDisabled();
  });

  it('enables the confirm CTA for a valid two-column input with a numeric column', () => {
    render(
      <ColumnPreviewTable
        headers={headers}
        bodyRows={bodyRows}
        recognizedColumns={{ municipio: 0, taxa: 1 }}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Analisar dados' })).toBeEnabled();
  });

  it('marks a role select as "ajustado" once the user changes it away from the detected value', async () => {
    const user = userEvent.setup();
    render(
      <ColumnPreviewTable
        headers={headers}
        bodyRows={bodyRows}
        recognizedColumns={{ municipio: 0, taxa: 1 }}
        onConfirm={() => {}}
      />,
    );

    expect(screen.queryByText('ajustado')).not.toBeInTheDocument();

    const select = screen.getByLabelText('Papel da coluna Taxa');
    await user.selectOptions(select, 'categorica');

    expect(screen.getByText('ajustado')).toBeInTheDocument();
  });

  it('calls onConfirm with the full row set (not just the preview slice)', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ColumnPreviewTable headers={headers} bodyRows={bodyRows} recognizedColumns={{}} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));

    expect(onConfirm).toHaveBeenCalledWith({ headers, rows: bodyRows });
    expect(onConfirm.mock.calls[0][0].rows.length).toBe(10);
  });
});
