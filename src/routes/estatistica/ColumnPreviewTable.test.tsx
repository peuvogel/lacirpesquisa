import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TABULAR_OPTIONS as tStudentOptions } from '@/features/tests/t-student/tStudentConfig';
import { TABULAR_OPTIONS as praisOptions } from '@/features/tests/prais-winsten/praisConfig';
import { createTableDocument, type TableDocument } from '@/shared/data-input/tableDocument';
import type { TabularImportSummary } from '@/shared/data-input/importDiagnostics';
import { ColumnPreviewTable } from './ColumnPreviewTable';
import { RoleBindingPanel } from '@/features/tests/shared/RoleBindingPanel';
import { expectColumnType, selectColumnType } from '@/test/columnTypeWheel';
import { setColumnEnabled, setRowEnabled } from '@/test/columnToggle';

const headers = ['Município', 'Taxa'];
const bodyRows = Array.from({ length: 10 }, (_, index) => [`Cidade ${index + 1}`, String(index + 1)]);

/** A exclusão nasce travada; quem for apagar precisa abrir o cadeado antes. */
async function unlockDeletion(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Destravar exclusão de linhas e colunas' }));
}

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
        <>
          <ColumnPreviewTable
            document={document}
            testId="correlacao"
            tabularOptions={{ aliases: { variavel_x: ['Região'], variavel_y: ['Valor'] }, requiredKeys: ['variavel_x', 'variavel_y'], numericKeys: ['variavel_y'] }}
            onDocumentChange={setDocument}
            onConfirm={onConfirm}
          />
          <RoleBindingPanel
          document={document}
          testId="correlacao"
          tabularOptions={{ aliases: { variavel_x: ['Região'], variavel_y: ['Valor'] }, requiredKeys: ['variavel_x', 'variavel_y'], numericKeys: ['variavel_y'] }}
          onDocumentChange={setDocument}
          />
        </>
      );
    }

    render(<Harness />);
    await selectColumnType(user, 'Região', 'categorica');
    await user.click(screen.getByRole('button', { name: 'Próxima página' }));
    const cell = screen.getByLabelText('Linha 51, coluna 1');
    await user.clear(cell);
    await user.type(cell, 'SP');
    expectColumnType('Região', 'categorica');
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

    // Sem a gaveta do resumo, os avisos do documento aparecem direto na seção.
    expect(screen.getByRole('region', { name: 'Avisos da importação' })).toBeInTheDocument();
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
        <>
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
          <RoleBindingPanel
          document={document}
          testId="correlacao"
          tabularOptions={{
            aliases: { variavel_x: ['Valor'], variavel_y: ['Valor'] },
            requiredKeys: ['variavel_x', 'variavel_y'],
            numericKeys: ['variavel_x', 'variavel_y'],
            positionFallback: { keysByIndex: ['variavel_x', 'variavel_y'] },
          }}
          onDocumentChange={setDocument}
          />
        </>
      );
    }

    render(<Harness />);
    expect(screen.getAllByRole('option', { name: 'Valor · coluna 1' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: 'Valor · coluna 2' }).length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByLabelText('Vincular Variável X'), 'doc-1-col-2');
    expect(screen.getByLabelText('Vincular Variável X')).toHaveValue('doc-1-col-2');
    expect(screen.getByLabelText('Vincular Variável Y')).toHaveValue('');
    expect(screen.getByText(/Vincule todos os papéis obrigatórios/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analisar dados' })).toBeDisabled();

    await user.clear(screen.getByLabelText('Nome da coluna 2'));
    await user.type(screen.getByLabelText('Nome da coluna 2'), 'Desfecho');
    expect(screen.getByLabelText('Vincular Variável X')).toHaveValue('doc-1-col-2');
    // A escolha à mão é o que acende o caminho de volta à detecção automática.
    expect(
      screen.getByRole('button', { name: 'Restaurar papéis para a detecção automática' }),
    ).toBeEnabled();
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
        <>
          <ColumnPreviewTable
            document={document}
            testId="t-student"
            tabularOptions={tStudentOptions}
            onDocumentChange={setDocument}
            onConfirm={() => {}}
          />
          <RoleBindingPanel
          document={document}
          testId="t-student"
          tabularOptions={tStudentOptions}
          onDocumentChange={setDocument}
          />
        </>
      );
    }

    render(<Harness />);
    expect(screen.getByLabelText('Vincular Grupo B')).toHaveValue('doc-1-col-2');

    await user.selectOptions(screen.getByLabelText('Vincular Grupo B'), '');

    expect(screen.getByLabelText('Vincular Grupo B')).toHaveValue('');
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

    expectColumnType('Semestre', 'tempo');
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
        <>
          <ColumnPreviewTable
            document={document}
            testId="prais-winsten"
            tabularOptions={praisOptions}
            onDocumentChange={setDocument}
            onConfirm={() => {}}
          />
          <RoleBindingPanel
          document={document}
          testId="prais-winsten"
          tabularOptions={praisOptions}
          onDocumentChange={setDocument}
          />
        </>
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
        <>
          <ColumnPreviewTable
            document={document}
            testId="prais-winsten"
            tabularOptions={praisOptions}
            onDocumentChange={setDocument}
            onConfirm={() => {}}
          />
          <RoleBindingPanel
          document={document}
          testId="prais-winsten"
          tabularOptions={praisOptions}
          onDocumentChange={setDocument}
          />
        </>
      );
    }

    render(<Harness />);
    await selectColumnType(user, 'Semestre', 'categorica');
    await user.selectOptions(screen.getByLabelText('Vincular Tempo'), 'doc-time-col-2');

    expectColumnType('Semestre', 'categorica');
    expect(screen.getByLabelText('Vincular Tempo')).toHaveValue('doc-time-col-2');
    expect(
      screen.getByRole('button', { name: 'Restaurar papéis para a detecção automática' }),
    ).toBeEnabled();
  });

  it('keeps a manually chosen type over the detected one in the compatibility preview', async () => {
    const user = userEvent.setup();
    render(
      <ColumnPreviewTable
        headers={headers}
        bodyRows={bodyRows}
        recognizedColumns={{ municipio: 0, taxa: 1 }}
        onConfirm={() => {}}
      />,
    );

    expectColumnType('Taxa', 'numerica');

    await selectColumnType(user, 'Taxa', 'categorica');

    expectColumnType('Taxa', 'categorica');
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

    await setColumnEnabled(user, 'variavel_x', false);
    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));

    const payload = onConfirm.mock.calls[0][0];
    expect(payload.recognizedColumns.variavel_x).toBeUndefined();
    expect(payload.recognizedColumns.variavel_y).toBe(2);
  });

  it('adds, removes and switches rows off through the control column', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [document, setDocument] = useState(() => createTableDocument(
        ['Grupo', 'Valor'],
        [['A', '1'], ['B', '2']],
        'colado',
        () => 'doc-edit',
      ));
      return (
        <ColumnPreviewTable
          document={document}
          testId="correlacao"
          onDocumentChange={setDocument}
          onConfirm={() => {}}
        />
      );
    }

    render(<Harness />);
    expect(screen.getAllByRole('row')).toHaveLength(3); // cabeçalho + 2 linhas

    await user.click(screen.getByRole('button', { name: 'Adicionar linha' }));
    expect(screen.getAllByRole('row')).toHaveLength(4);

    await unlockDeletion(user);

    await user.click(screen.getByRole('checkbox', { name: 'Incluir linha 1 na análise' }));
    expect(screen.getByRole('checkbox', { name: 'Incluir linha 1 na análise' })).not.toBeChecked();

    // A linha sai com transição: o documento só muda quando ela termina.
    await user.click(screen.getByRole('button', { name: /^Excluir linha 3\b/ }));
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(3);
    });
    // A linha desligada continua sendo a primeira: os índices não deslocaram.
    expect(screen.getByRole('checkbox', { name: 'Incluir linha 1 na análise' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Incluir linha 2 na análise' })).toBeChecked();
  });

  it('keeps deletions behind the padlock, and lets them through once unlocked', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [document, setDocument] = useState(() => createTableDocument(
        ['Grupo', 'Valor'],
        [['A', '1'], ['B', '2']],
        'colado',
        () => 'doc-lock',
      ));
      return (
        <ColumnPreviewTable
          document={document}
          testId="correlacao"
          onDocumentChange={setDocument}
          onConfirm={() => {}}
        />
      );
    }

    render(<Harness />);
    expect(screen.getAllByRole('row')).toHaveLength(3); // cabeçalho + 2 linhas
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);

    // Travado: a lixeira continua à mão, mas não corta nada.
    await user.click(screen.getByRole('button', { name: /^Excluir linha 1\b/ }));
    await user.click(screen.getByRole('button', { name: 'Excluir coluna Grupo' }));
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Destravar exclusão de linhas e colunas' }));

    await user.click(screen.getByRole('button', { name: /^Excluir linha 1\b/ }));
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(2);
    });

    // E dá para travar de novo, voltando à proteção.
    await user.click(screen.getByRole('button', { name: 'Travar exclusão de linhas e colunas' }));
    await user.click(screen.getByRole('button', { name: 'Excluir coluna Grupo' }));
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
  });

  it('greys out the whole row and the whole column that leave the analysis', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [document, setDocument] = useState(() => createTableDocument(
        ['Grupo', 'Valor'],
        [['A', '1'], ['B', '2']],
        'colado',
        () => 'doc-disabled',
      ));
      return (
        <ColumnPreviewTable
          document={document}
          testId="correlacao"
          onDocumentChange={setDocument}
          onConfirm={() => {}}
        />
      );
    }

    const cell = (row: number, column: number) =>
      screen.getByLabelText(`Linha ${row}, coluna ${column}`).closest('td');

    render(<Harness />);
    expect(cell(1, 1)).not.toHaveAttribute('data-disabled');

    await setRowEnabled(user, 1, false);
    // A linha inteira sai de cena — é o que o CSS pinta de cinza, fundo incluso.
    expect(cell(1, 1)).toHaveAttribute('data-disabled', 'true');
    expect(cell(1, 2)).toHaveAttribute('data-disabled', 'true');
    expect(cell(2, 1)).not.toHaveAttribute('data-disabled');

    await setColumnEnabled(user, 'Valor', false);
    // A coluna desmarcada apaga o corpo da tabela, e não só o cabeçalho.
    expect(cell(2, 2)).toHaveAttribute('data-disabled', 'true');
    expect(cell(2, 1)).not.toHaveAttribute('data-disabled');
    expect(screen.getByRole('columnheader', { name: /Valor/ })).toHaveAttribute('data-disabled', 'true');
  });

  it('adds and removes columns', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [document, setDocument] = useState(() => createTableDocument(
        ['Grupo', 'Valor'],
        [['A', '1']],
        'colado',
        () => 'doc-cols',
      ));
      return (
        <ColumnPreviewTable
          document={document}
          testId="correlacao"
          onDocumentChange={setDocument}
          onConfirm={() => {}}
        />
      );
    }

    render(<Harness />);
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Adicionar coluna' }));
    expect(screen.getAllByRole('columnheader')).toHaveLength(3);

    await unlockDeletion(user);

    // A coluna sai com transição: o documento só muda quando ela termina.
    await user.click(screen.getByRole('button', { name: 'Excluir coluna Grupo' }));
    await waitFor(() => {
      expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    });
    expect(screen.queryByRole('button', { name: 'Excluir coluna Grupo' })).not.toBeInTheDocument();
  });

  it('keeps the type wheel locked until the column is unlocked', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [document, setDocument] = useState(() => createTableDocument(
        ['Grupo', 'Valor'],
        [['A', '1'], ['B', '2']],
        'colado',
        () => 'doc-lock',
      ));
      return (
        <ColumnPreviewTable
          document={document}
          testId="correlacao"
          onDocumentChange={setDocument}
          onConfirm={() => {}}
        />
      );
    }

    render(<Harness />);
    const wheel = screen.getByRole('listbox', { name: 'Tipo da coluna Valor' });
    expect(wheel).toHaveAttribute('tabindex', '-1');

    await user.click(screen.getByRole('button', { name: 'Destravar o tipo da coluna Valor' }));
    expect(screen.getByRole('listbox', { name: 'Tipo da coluna Valor' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'Travar o tipo da coluna Valor' })).toBeInTheDocument();
  });

  it('keeps the reset control mounted and only enables it after an adjustment', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [document, setDocument] = useState(() => createTableDocument(
        ['Grupo', 'Valor'],
        [['A', '1'], ['B', '2']],
        'colado',
        () => 'doc-reset',
      ));
      return (
        <ColumnPreviewTable
          document={document}
          testId="correlacao"
          onDocumentChange={setDocument}
          onConfirm={() => {}}
        />
      );
    }

    render(<Harness />);
    const reset = () => screen.getByRole('button', { name: 'Redefinir tipos das colunas' });

    // Montado desde sempre: aparecer e sumir empurraria o bloco.
    expect(reset()).toBeDisabled();

    await selectColumnType(user, 'Valor', 'categorica');
    expect(reset()).toBeEnabled();

    await user.click(reset());
    expectColumnType('Valor', 'numerica');
    expect(reset()).toBeDisabled();
  });

  it('reveals the row controls only on hover, without a control column', () => {
    function Harness() {
      const [document, setDocument] = useState(() => createTableDocument(
        ['Grupo', 'Valor'],
        [['A', '1']],
        'colado',
        () => 'doc-hover',
      ));
      return (
        <ColumnPreviewTable
          document={document}
          testId="correlacao"
          onDocumentChange={setDocument}
          onConfirm={() => {}}
        />
      );
    }

    const { container } = render(<Harness />);

    // Duas colunas de dados e nenhuma de controle.
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(container.querySelectorAll('tbody tr td')).toHaveLength(2);

    // Os controles seguem na árvore acessível, só revelados por opacidade.
    const toggle = screen.getByRole('checkbox', { name: 'Incluir linha 1 na análise' });
    // O check agora mora num <label>; o que esconde é o agrupador acima dele.
    expect(toggle.closest('.opacity-0')).not.toBeNull();
    expect(screen.getByRole('button', { name: /^Excluir linha 1\b/ })).toBeInTheDocument();
  });

  it('restores a deleted column with Ctrl+Z, but not while typing in a cell', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [document, setDocument] = useState(() => createTableDocument(
        ['Grupo', 'Valor'],
        [['A', '1']],
        'colado',
        () => 'doc-undo',
      ));
      const historyRef = useRef<TableDocument[]>([]);
      return (
        <ColumnPreviewTable
          document={document}
          testId="correlacao"
          onDocumentChange={(next) => {
            historyRef.current.push(document);
            setDocument(next);
          }}
          onUndo={() => {
            const previous = historyRef.current.pop();
            if (previous) setDocument(previous);
          }}
          onConfirm={() => {}}
        />
      );
    }

    render(<Harness />);
    await unlockDeletion(user);
    await user.click(screen.getByRole('button', { name: 'Excluir coluna Grupo' }));
    await waitFor(() => {
      expect(screen.getAllByRole('columnheader')).toHaveLength(1);
    });

    await user.keyboard('{Control>}z{/Control}');
    await waitFor(() => {
      expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    });

    // Dentro de uma célula o atalho pertence ao campo, não à tabela.
    await user.click(screen.getByRole('button', { name: 'Excluir coluna Grupo' }));
    await waitFor(() => {
      expect(screen.getAllByRole('columnheader')).toHaveLength(1);
    });
    screen.getByLabelText('Linha 1, coluna 1').focus();
    await user.keyboard('{Control>}z{/Control}');
    expect(screen.getAllByRole('columnheader')).toHaveLength(1);
  });

  it('marks the whole row while the trash button is the target', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [document, setDocument] = useState(() => createTableDocument(
        ['Grupo', 'Valor'],
        [['Nordeste', '1']],
        'colado',
        () => 'doc-rowmark',
      ));
      return (
        <ColumnPreviewTable
          document={document}
          testId="correlacao"
          onDocumentChange={setDocument}
          onConfirm={() => {}}
        />
      );
    }

    const { container } = render(<Harness />);
    const row = container.querySelector('tbody tr')!;
    expect(row).not.toHaveAttribute('data-removing');

    // O rótulo nomeia a linha pelo primeiro valor, para o alvo ser inequívoco.
    await user.hover(screen.getByRole('button', { name: 'Excluir linha 1 (Nordeste)' }));
    expect(row).toHaveAttribute('data-removing', 'true');
  });

  it('highlights the whole row from the checkbox, in neutral rather than red', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [document, setDocument] = useState(() => createTableDocument(
        ['Grupo', 'Valor'],
        [['Nordeste', '1']],
        'colado',
        () => 'doc-rowhover',
      ));
      return (
        <ColumnPreviewTable
          document={document}
          testId="correlacao"
          onDocumentChange={setDocument}
          onConfirm={() => {}}
        />
      );
    }

    const { container } = render(<Harness />);
    const row = container.querySelector('tbody tr')!;

    await user.hover(screen.getByRole('checkbox', { name: 'Incluir linha 1 na análise' }));
    // O check inclui/exclui: destaca a linha, mas não anuncia exclusão.
    expect(row).toHaveAttribute('data-row-hover', 'true');
    expect(row).not.toHaveAttribute('data-removing');

    await user.hover(screen.getByRole('button', { name: 'Excluir linha 1 (Nordeste)' }));
    expect(row).toHaveAttribute('data-removing', 'true');
  });

  it('gives the cell input square corners', () => {
    function Harness() {
      const [document, setDocument] = useState(() => createTableDocument(
        ['Grupo', 'Valor'],
        [['A', '1']],
        'colado',
        () => 'doc-square',
      ));
      return (
        <ColumnPreviewTable
          document={document}
          testId="correlacao"
          onDocumentChange={setDocument}
          onConfirm={() => {}}
        />
      );
    }

    render(<Harness />);
    const cell = screen.getByLabelText('Linha 1, coluna 1');
    expect(cell).toHaveClass('rounded-none');
    expect(cell).not.toHaveClass('rounded-md');
  });
});
