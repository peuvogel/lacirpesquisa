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
});
