import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTabularInput } from '@/shared/data-input/useTabularInput';
import type { TabularInputOptions } from '@/shared/data-input/types';
import { TabularInputPanel } from './TabularInputPanel';

const options: TabularInputOptions = {
  aliases: {
    municipio: ['Município'],
    taxa: ['Taxa por 100k'],
    situacao: ['Situação'],
  },
  requiredKeys: ['municipio', 'taxa'],
  numericKeys: ['taxa'],
  expectedFormatLabel: 'Município; Taxa por 100k; Situação',
};

/**
 * TabularInputPanel is purely presentational — it receives the
 * useTabularInput result as props. This harness wires a real hook instance
 * so the tests exercise the actual paste → parse → render pipeline end to
 * end (required for the T-01-XSS regression assertion).
 */
function Harness() {
  const hook = useTabularInput(options);
  return <TabularInputPanel {...hook} />;
}

const TEXTAREA_LABEL = 'Cole aqui os dados copiados do DataSUS/TABNET';

describe('TabularInputPanel', () => {
  it('renders the empty-state heading and body copy before any input', () => {
    render(<Harness />);
    expect(screen.getByText('Cole ou envie seus dados')).toBeInTheDocument();
  });

  it('renders the preview area (not the error alert) after pasting a recognizable table', async () => {
    render(<Harness />);
    const textarea = screen.getByLabelText(TEXTAREA_LABEL);

    fireEvent.change(textarea, {
      target: { value: 'Município,Taxa por 100k,Situação\nSão Paulo,12.5,Alerta\nRio,8.75,Estável' },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Analisar dados' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders a destructive Alert with the Portuguese copy and a working Ver detalhes disclosure for junk text', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const textarea = screen.getByLabelText(TEXTAREA_LABEL);

    fireEvent.change(textarea, { target: { value: 'palavraisolada' } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Não conseguimos reconhecer esses dados')).toBeInTheDocument();

    const disclosure = screen.getByText('Ver detalhes');
    expect(disclosure).toBeInTheDocument();
    await user.click(disclosure);
    expect(screen.getByText(/Use o modelo/)).toBeInTheDocument();
  });

  it('renders a pasted script-like cell as inert literal text  -  no element is created, nothing executes (T-01-XSS)', async () => {
    render(<Harness />);
    const textarea = screen.getByLabelText(TEXTAREA_LABEL);

    fireEvent.change(textarea, {
      target: { value: 'Município,Taxa por 100k,Situação\n<img src=x onerror=alert(1)>,12.5,Alerta' },
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    });
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelectorAll('script')).toHaveLength(0);
  });

  it('toggles a drag-over highlight while a file is dragged over the dropzone', () => {
    render(<Harness />);
    const dropzone = screen.getByLabelText('Selecionar arquivo de dados (.csv, .txt, .tsv, .xlsx)').closest('label');
    expect(dropzone).not.toBeNull();
    expect(dropzone).not.toHaveAttribute('data-drag-over');

    fireEvent.dragOver(dropzone as HTMLElement);
    expect(dropzone).toHaveAttribute('data-drag-over', 'true');

    fireEvent.dragLeave(dropzone as HTMLElement);
    expect(dropzone).not.toHaveAttribute('data-drag-over');
  });
});
