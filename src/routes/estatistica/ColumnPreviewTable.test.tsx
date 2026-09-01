import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TABULAR_OPTIONS as tStudentOptions } from '@/features/tests/t-student/tStudentConfig';
import { TABULAR_OPTIONS as praisOptions } from '@/features/tests/prais-winsten/praisConfig';
import { createTableDocument, type TableDocument } from '@/shared/data-input/tableDocument';
import type { TabularImportSummary } from '@/shared/data-input/importDiagnostics';
import { ColumnPreviewTable } from './ColumnPreviewTable';

const headers = ['Município', 'Taxa'];
const bodyRows = Array.from({ length: 10 }, (_, index) => [`Cidade ${index + 1}`, String(index + 1)]);

describe('ColumnPreviewTable', () => {
  it('keeps a manual type while editing row 51 and confirms all document rows', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    function Harness() {
      const [document, setDocument] = useState<TableDocument>(() => createTableDocument(
        ['Região', 'Valor'],
        Array.from({ length: 51 }, (_, index) => [`UF ${index + 1}`, String(index + 1)]),
        'colado',
        () => 'doc-1',
      ));
      return (
        <ColumnPreviewTable
          document={document}
          testId="correlacao"
          tabularOptions={{ aliases: { variavel_x: ['Região'], variavel_y: ['Valor'] }, requiredKeys: ['variavel_x', 'variavel_y'], numericKeys: ['variavel_y'] }}
          onDocumentChange={setDocument}
          onConfirm={onConfirm}
        />
      );
    }

    render(<Harness />);
    await user.selectOptions(screen.getByLabelText('Tipo da coluna Região'), 'categorica');
    await user.click(screen.getByRole('button', { name: 'Próxima página' }));
    const cell = screen.getByLabelText('Linha 51, coluna 1');
    await user.clear(cell);
    await user.type(cell, 'SP');
    expect(screen.getByLabelText('Tipo da coluna Região')).toHaveValue('categorica');
    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ rows: expect.arrayContaining([['SP', '51']]) }));
    expect(onConfirm.mock.calls[0][0].rows).toHaveLength(51);
  });

  it('uses document import warnings in preference to the legacy warning prop', async () => {
    const user = userEvent.setup();
    const summary: TabularImportSummary = {
      sourceType: 'file', fileName: 'dados.xlsx', tableName: 'Dados', sheetNames: ['Dados'], formatLabel: 'XLSX', delimiter: '',
      rowCount: 1, columnCount: 2, headerRowNumber: 1, recognitionMode: 'aliases', recognitionDetails: [], diagnostics: [],
      importWarnings: [{ code: 'unusable-cell', message: 'Aviso do documento.', cellReference: 'B2', rowNumber: 2, columnIndex: 1 }],
    };
    const document = createTableDocument(['Grupo', 'Valor'], [['A', '1']], 'dados.xlsx', () => 'doc-warnings', summary);

    render(
      <ColumnPreviewTable
        document={document}
        importWarnings={[{ code: 'unusable-cell', message: 'Aviso legado.', cellReference: 'A2', rowNumber: 2, columnIndex: 0 }]}
        onConfirm={() => {}}
      />,
    );

    await user.click(screen.getByText('Ver avisos da importação'));
    expect(screen.getByText(/Aviso do documento/)).toBeInTheDocument();
    expect(screen.queryByText('Aviso legado.')).not.toBeInTheDocument();
  });

  it('disambiguates duplicate headers and keeps a manual role binding after a rename', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [document, setDocument] = useState<TableDocument>(() => createTableDocument(
        ['Valor', 'Valor'],
        [['1', '2']],
        'colado',
        () => 'doc-1',
      ));
      return (
        <ColumnPreviewTable
          document={document}
          testId="correlacao"
          tabularOptions={{
            aliases: { variavel_x: ['Valor'], variavel_y: ['Valor'] },
            requiredKeys: ['variavel_x', 'variavel_y'],
            numericKeys: ['variavel_x', 'variavel_y'],
            positionFallback: { keysByIndex: ['variavel_x', 'variavel_y'] },
          }}
          onDocumentChange={setDocument}
          onConfirm={() => {}}
        />
      );
    }

    render(<Harness />);
    expect(screen.getAllByRole('option', { name: 'Valor · coluna 1' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: 'Valor · coluna 2' }).length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByLabelText('Vincular X'), 'doc-1-col-2');
    expect(screen.getByLabelText('Vincular X')).toHaveValue('doc-1-col-2');
    expect(screen.getByLabelText('Vincular Y')).toHaveValue('');
    expect(screen.getByText(/Vincule todos os papéis obrigatórios/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analisar dados' })).toBeDisabled();

    await user.clear(screen.getByLabelText('Nome da coluna 2'));
    await user.type(screen.getByLabelText('Nome da coluna 2'), 'Desfecho');
    expect(screen.getByLabelText('Vincular X')).toHaveValue('doc-1-col-2');
    expect(screen.getByText('definido por você')).toBeInTheDocument();
  });

  it('lets the user reject an automatic role suggestion', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [document, setDocument] = useState<TableDocument>(() => createTableDocument(
        ['Grupo A', 'Grupo B'],
        [['1', '2'], ['3', '4']],
        'exemplo',
        () => 'doc-1',
      ));
      return (
        <ColumnPreviewTable
          document={document}
          testId="t-student"
          tabularOptions={tStudentOptions}
          onDocumentChange={setDocument}
          onConfirm={() => {}}
        />
      );
    }

    render(<Harness />);
    expect(screen.getByLabelText('Vincular grupo B')).toHaveValue('doc-1-col-2');

    await user.selectOptions(screen.getByLabelText('Vincular grupo B'), '');

    expect(screen.getByLabelText('Vincular grupo B')).toHaveValue('');
    expect(screen.getByText(/Vincule todos os papéis obrigatórios/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analisar dados' })).toBeDisabled();
  });

  it('renders headers, up to 8 preview rows, and the total-count caption', () => {
    render(
      <ColumnPreviewTable
        headers={headers}
        bodyRows={bodyRows}
        recognizedColumns={{ municipio: 0, taxa: 1 }}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByDisplayValue('Município')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Taxa')).toBeInTheDocument();
    // 1 header row + 8 preview body rows.
    expect(screen.getAllByRole('row')).toHaveLength(9);
    expect(screen.getByText(/Mostrando 8 de 10 linhas/)).toBeInTheDocument();
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

  it('does not classify malformed dotted tokens as numeric in the compatibility preview', () => {
    render(
      <ColumnPreviewTable
        headers={['Grupo', 'Valor']}
        bodyRows={[['A', '1.2.3'], ['B', '2.3.4']]}
        recognizedColumns={{}}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Analisar dados' })).toBeDisabled();
  });

  it('classifies semantic semester values as temporal in the compatibility preview', () => {
    render(
      <ColumnPreviewTable
        headers={['Semestre', 'Valor']}
        bodyRows={[['2024-S1', '10'], ['2024-S2', '11']]}
        recognizedColumns={{}}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByLabelText('Tipo da coluna Semestre')).toHaveValue('tempo');
  });

  it('shows unsupported temporal tokens as invalid rows before confirmation', () => {
    function Harness() {
      const [document, setDocument] = useState<TableDocument>(() => createTableDocument(
        ['Semestre', 'Valor'],
        [['2024-S1', '10'], ['2024-X9', '11']],
        'colado',
        () => 'doc-time',
      ));
      return (
        <ColumnPreviewTable
          document={document}
          testId="prais-winsten"
          tabularOptions={praisOptions}
          onDocumentChange={setDocument}
          onConfirm={() => {}}
        />
      );
    }

    render(<Harness />);
    expect(screen.getByRole('region', { name: 'Validade das linhas' })).toHaveTextContent(
      '1 válidas · 0 incompletas · 1 inválidas',
    );
  });

  it('keeps explicit temporal type and role choices over automatic suggestions', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [document, setDocument] = useState<TableDocument>(() => createTableDocument(
        ['Semestre', 'Valor'],
        [['2024-S1', '10'], ['2024-S2', '11']],
        'colado',
        () => 'doc-time',
      ));
      return (
        <ColumnPreviewTable
          document={document}
          testId="prais-winsten"
          tabularOptions={praisOptions}
          onDocumentChange={setDocument}
          onConfirm={() => {}}
        />
      );
    }

    render(<Harness />);
    await user.selectOptions(screen.getByLabelText('Tipo da coluna Semestre'), 'categorica');
    await user.selectOptions(screen.getByLabelText('Vincular tempo'), 'doc-time-col-2');

    expect(screen.getByLabelText('Tipo da coluna Semestre')).toHaveValue('categorica');
    expect(screen.getByText('tipo ajustado por você')).toBeInTheDocument();
    expect(screen.getByLabelText('Vincular tempo')).toHaveValue('doc-time-col-2');
    expect(screen.getAllByText('definido por você')).not.toHaveLength(0);
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

    const select = screen.getByLabelText('Tipo da coluna Taxa');
    await user.selectOptions(select, 'categorica');

    expect(screen.getByText('tipo ajustado por você')).toBeInTheDocument();
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

    await user.selectOptions(screen.getByLabelText('Tipo da coluna variavel_x'), 'ignorar');
    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));

    const payload = onConfirm.mock.calls[0][0];
    expect(payload.recognizedColumns.variavel_x).toBeUndefined();
    expect(payload.recognizedColumns.variavel_y).toBe(2);
  });
});
