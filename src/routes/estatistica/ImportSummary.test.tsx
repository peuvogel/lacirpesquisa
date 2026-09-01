import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TabularImportSummary } from '@/shared/data-input/importDiagnostics';
import { ImportSummary } from './ImportSummary';

const summaryWithWarnings: TabularImportSummary = {
  sourceType: 'file',
  fileName: 'dados.xlsx',
  tableName: 'Dados',
  sheetNames: ['Dados', 'Notas'],
  formatLabel: 'XLSX',
  delimiter: '',
  rowCount: 12,
  columnCount: 3,
  headerRowNumber: 1,
  recognitionMode: 'aliases',
  recognitionDetails: [],
  diagnostics: [{ code: 'duplicate_headers', severity: 'warning', message: 'Foram encontrados cabeçalhos duplicados.' }],
  importWarnings: [],
};

function makeSummary(overrides: Partial<TabularImportSummary> = {}): TabularImportSummary {
  return { ...summaryWithWarnings, diagnostics: [], importWarnings: [], ...overrides };
}

describe('ImportSummary', () => {
  it('renders accessible provenance and reveals warnings on demand', async () => {
    const user = userEvent.setup();
    render(<ImportSummary summary={summaryWithWarnings} />);

    expect(screen.getByRole('region', { name: 'Resumo da importação' })).toHaveTextContent('dados.xlsx');
    expect(screen.getByText(/Aba Dados/i)).toBeInTheDocument();
    expect(screen.getByText(/12 linhas.*3 colunas/i)).toBeInTheDocument();

    await user.click(screen.getByText('Ver avisos da importação'));
    expect(screen.getByText(/cabeçalhos duplicados/i)).toBeInTheDocument();
  });

  it('reveals recognition details and diagnostic rows accessibly without duplicate messages', async () => {
    const user = userEvent.setup();
    render(<ImportSummary summary={makeSummary({
      recognitionDetails: ['Coluna 1 foi vinculada a Desfecho pela posição.'],
      diagnostics: [{
        code: 'missing_tokens',
        severity: 'warning',
        message: 'Foram identificados marcadores de ausência.',
        rowNumbers: [2, 7],
      }],
    })} />);

    await user.click(screen.getByText('Ver avisos da importação'));
    const disclosure = screen.getByRole('list', { name: 'Detalhes da importação' });
    expect(disclosure).toHaveTextContent('Coluna 1 foi vinculada a Desfecho pela posição.');
    expect(disclosure).toHaveTextContent('Foram identificados marcadores de ausência. Linhas: 2, 7.');
    expect(screen.getAllByText(/Foram identificados marcadores de ausência/)).toHaveLength(1);
  });

  it('describes pasted singular data without inventing a worksheet or invisible separator', () => {
    render(<ImportSummary summary={makeSummary({
      sourceType: 'paste',
      fileName: '',
      tableName: 'Tabela principal',
      sheetNames: [],
      formatLabel: 'TSV',
      delimiter: '\t',
      rowCount: 1,
      columnCount: 1,
    })} />);

    const summary = screen.getByRole('region', { name: 'Resumo da importação' });
    expect(summary).toHaveTextContent('Dados colados');
    expect(summary).toHaveTextContent('1 linha · 1 coluna · TSV · separador: tabulação');
    expect(summary).not.toHaveTextContent(/Aba/);
  });

  it('shows an XLSX worksheet only when the imported sheet is available', () => {
    render(<ImportSummary summary={makeSummary({
      sourceType: 'file',
      formatLabel: 'XLSX',
      sheetNames: ['Dados'],
      tableName: 'Dados',
      delimiter: '',
      rowCount: 2,
      columnCount: 2,
    })} />);

    const summary = screen.getByRole('region', { name: 'Resumo da importação' });
    expect(summary).toHaveTextContent('Arquivo dados.xlsx · Aba Dados · 2 linhas · 2 colunas · XLSX');
    expect(summary).not.toHaveTextContent('sem separador');
  });

  it.each([
    ['U+0085', '\u0085', 'separador: “U+0085”'],
    ['U+200B', '\u200B', 'separador: “U+200B”'],
    ['multi-code-point delimiter with a control', ',\u200B', 'separador: “,U+200B”'],
    ['printable Unicode delimiter', '§', 'separador: “§”'],
  ])('renders %s delimiters without injecting invisible formatting', (_label, delimiter, expected) => {
    render(<ImportSummary summary={makeSummary({ delimiter })} />);

    expect(screen.getByRole('region', { name: 'Resumo da importação' })).toHaveTextContent(expected);
  });
});
