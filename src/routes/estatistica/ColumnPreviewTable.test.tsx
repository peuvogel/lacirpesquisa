import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TABULAR_OPTIONS as tStudentOptions } from '@/features/tests/t-student/tStudentConfig';
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

    expect(onConfirm).toHaveBeenCalledWith({
      headers,
      rows: bodyRows,
      recognizedColumns: {},
    });
    expect(onConfirm.mock.calls[0][0].rows.length).toBe(10);
  });

  it('emits role-aware recognizedColumns on confirm when tabularOptions is set', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const tStudentHeaders = ['Identificador', 'Medida A', 'Medida B'];
    const tStudentRows = [
      ['UF1', '12,3', '45,2'],
      ['UF2', '14,1', '43,8'],
      ['UF3', '10,9', '48,0'],
    ];

    render(
      <ColumnPreviewTable
        headers={tStudentHeaders}
        bodyRows={tStudentRows}
        recognizedColumns={{}}
        tabularOptions={tStudentOptions}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        recognizedColumns: expect.objectContaining({
          grupo_a: 1,
          grupo_b: 2,
        }),
      }),
    );
  });

  it('removes ignored columns from recognizedColumns on confirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const correlacaoHeaders = ['id', 'variavel_x', 'variavel_y'];
    const correlacaoRows = [
      ['UF1', '12,3', '45,2'],
      ['UF2', '14,1', '43,8'],
    ];

    render(
      <ColumnPreviewTable
        headers={correlacaoHeaders}
        bodyRows={correlacaoRows}
        recognizedColumns={{ id: 0, variavel_x: 1, variavel_y: 2 }}
        tabularOptions={{
          aliases: {
            id: ['id'],
            variavel_x: ['variavel_x'],
            variavel_y: ['variavel_y'],
          },
          requiredKeys: ['variavel_x', 'variavel_y'],
          numericKeys: ['variavel_x', 'variavel_y'],
          positionFallback: {
            keysByIndex: ['id', 'variavel_x', 'variavel_y'],
            minColumns: 3,
            requiredKeys: ['variavel_x', 'variavel_y'],
          },
        }}
        onConfirm={onConfirm}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Papel da coluna variavel_x'), 'ignorar');
    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));

    const payload = onConfirm.mock.calls[0][0];
    expect(payload.recognizedColumns.variavel_x).toBeUndefined();
    expect(payload.recognizedColumns.variavel_y).toBe(2);
  });
});
