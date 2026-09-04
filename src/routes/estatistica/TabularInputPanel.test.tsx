import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    expect(screen.getAllByText(/CSV, TSV, TXT ou XLSX/)).toHaveLength(2);
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
    expect(screen.getByLabelText(TEXTAREA_LABEL)).toBeInTheDocument();
    expect(screen.getByLabelText('Selecionar arquivo de dados (.csv, .txt, .tsv, .xlsx)')).toBeInTheDocument();
  });

  it('turns the pasted text into a table inside the box itself', async () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText(TEXTAREA_LABEL), {
      target: { value: 'Município,Taxa por 100k,Situação\nSão Paulo,12.5,Alerta\nRio,8.75,Estável' },
    });

    const preview = await screen.findByRole('group', { name: 'Prévia dos dados colados' });
    // Dentro da mesma caixa tracejada da textarea, e não num cartão à parte:
    // é o que responde "os dados entraram nas colunas certas?" sem sair daqui.
    expect(preview.closest('[data-dropzone="true"]')).not.toBeNull();
    expect(within(preview).getByText('Município')).toBeInTheDocument();
    expect(within(preview).getByText('São Paulo')).toBeInTheDocument();
    expect(within(preview).getByText(/Mostrando 2 de 2 linhas · 3 colunas/)).toBeInTheDocument();
  });

  it('shows no in-box preview while the box is still empty', () => {
    render(<Harness />);

    expect(screen.queryByRole('group', { name: 'Prévia dos dados colados' })).not.toBeInTheDocument();
  });

  it('acknowledges a parsed table without rendering the preview', async () => {
    function PreviewDisabledHarness() {
      const hook = useTabularInput(options);
      return <TabularInputPanel {...hook} showPreview={false} />;
    }

    render(<PreviewDisabledHarness />);
    fireEvent.change(screen.getByLabelText(TEXTAREA_LABEL), {
      target: { value: 'Município;Taxa por 100k;Situação\nBA;NA;Alerta' },
    });

    // Sair do estado 'idle' (o cabeçalho some) prova que o parse concluiu.
    await waitFor(() => {
      expect(screen.queryByText('Cole ou envie seus dados')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Analisar dados' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(TEXTAREA_LABEL)).toBeInTheDocument();
  });

  it('keeps example and clear actions reachable after load', async () => {
    const user = userEvent.setup();
    const onExample = vi.fn();
    const onClear = vi.fn();
    function ActionHarness() {
      const hook = useTabularInput(options);
      return <TabularInputPanel {...hook} onUseExample={onExample} onClear={onClear} />;
    }
    render(<ActionHarness />);
    fireEvent.change(screen.getByLabelText(TEXTAREA_LABEL), { target: { value: 'Município;Taxa por 100k\nBA;10' } });
    await screen.findByRole('button', { name: 'Analisar dados' });
    await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
    // "Apagar" é o botão do próprio painel; "Limpar tabela" pertence ao
    // ColumnPreviewTable e também chama onClear, o que mascarava o alvo.
    await user.click(screen.getByRole('button', { name: 'Apagar' }));
    expect(onExample).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('centers the table actions over the textarea and keeps them after load', async () => {
    function ActionHarness() {
      const hook = useTabularInput(options);
      return <TabularInputPanel {...hook} onUseExample={vi.fn()} onClear={vi.fn()} />;
    }
    render(<ActionHarness />);

    const group = screen.getByRole('group', { name: 'Ações da tabela' });
    for (const name of ['Colar dados', 'Apagar', 'Usar exemplo']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }

    fireEvent.change(screen.getByLabelText(TEXTAREA_LABEL), { target: { value: 'Município;Taxa por 100k\nBA;10' } });
    await screen.findByRole('button', { name: 'Analisar dados' });

    // Persistem mesmo com dados carregados.
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Colar dados' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apagar' })).toBeInTheDocument();
  });

  it('hides the actions while the textarea is focused and restores them on blur', () => {
    function ActionHarness() {
      const hook = useTabularInput(options);
      return <TabularInputPanel {...hook} onUseExample={vi.fn()} onClear={vi.fn()} />;
    }
    render(<ActionHarness />);

    const textarea = screen.getByLabelText(TEXTAREA_LABEL);
    const overlay = screen.getByRole('group', { name: 'Ações da tabela' }).parentElement;

    expect(overlay).not.toHaveAttribute('data-editing');

    fireEvent.focus(textarea);
    expect(overlay).toHaveAttribute('data-editing', 'true');
    // Continuam montados — só invisíveis — para não sumirem da árvore acessível.
    expect(screen.getByRole('button', { name: 'Colar dados' })).toBeInTheDocument();

    fireEvent.blur(textarea);
    expect(overlay).not.toHaveAttribute('data-editing');
  });

  it('treats typing as editing and only a real paste as replacing the data', () => {
    const onRawTextChange = vi.fn();
    const setRawText = vi.fn();

    function TypingHarness() {
      const hook = useTabularInput(options);
      return (
        <TabularInputPanel {...hook} setRawText={setRawText} onRawTextChange={onRawTextChange} />
      );
    }
    render(<TypingHarness />);
    const textarea = screen.getByLabelText(TEXTAREA_LABEL);

    // Digitar (Enter incluído) é edição do próprio texto: não pode acionar o
    // fluxo de "Substituir dados", que perguntaria a cada tecla.
    fireEvent.change(textarea, { target: { value: 'Município;Taxa\n' } });
    expect(setRawText).toHaveBeenCalledWith('Município;Taxa\n');
    expect(onRawTextChange).not.toHaveBeenCalled();

    // Colar troca a tabela inteira e continua passando pelo guarda.
    fireEvent.paste(textarea);
    fireEvent.change(textarea, { target: { value: 'Município;Taxa\nBA;10' } });
    expect(onRawTextChange).toHaveBeenCalledWith('Município;Taxa\nBA;10');
    expect(setRawText).toHaveBeenCalledTimes(1);
  });

  it('pastes clipboard contents through the raw-text callback', async () => {
    const user = userEvent.setup();
    const onRawTextChange = vi.fn();
    const readText = vi.fn().mockResolvedValue('Município;Taxa\nBA;10');
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText },
      configurable: true,
    });

    function ActionHarness() {
      const hook = useTabularInput(options);
      return <TabularInputPanel {...hook} onRawTextChange={onRawTextChange} />;
    }
    render(<ActionHarness />);

    await user.click(screen.getByRole('button', { name: 'Colar dados' }));

    expect(readText).toHaveBeenCalledTimes(1);
    expect(onRawTextChange).toHaveBeenCalledWith('Município;Taxa\nBA;10');

    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('falls back to focusing the textarea when the clipboard is unavailable', async () => {
    const user = userEvent.setup();
    const onRawTextChange = vi.fn();

    function ActionHarness() {
      const hook = useTabularInput(options);
      return <TabularInputPanel {...hook} onRawTextChange={onRawTextChange} />;
    }
    render(<ActionHarness />);

    await user.click(screen.getByRole('button', { name: 'Colar dados' }));

    expect(onRawTextChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText(TEXTAREA_LABEL)).toHaveFocus();
  });

  it('uses an accessible confirmation dialog before discarding edited data', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    function DialogHarness() {
      const hook = useTabularInput(options);
      return (
        <TabularInputPanel
          {...hook}
          pendingAction="Substituir dados"
          onConfirmPendingAction={onConfirm}
          onCancelPendingAction={onCancel}
        />
      );
    }

    render(<DialogHarness />);
    expect(screen.getByRole('dialog', { name: 'Substituir dados' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Manter tabela' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Descartar alterações' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
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
    expect(screen.getByText(/não encontramos colunas compatíveis/i)).toBeInTheDocument();

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
    // A caixa inteira (textarea + rodapé de upload) é a zona de soltura.
    const dropzone = screen
      .getByLabelText('Selecionar arquivo de dados (.csv, .txt, .tsv, .xlsx)')
      .closest('[data-dropzone]');
    expect(dropzone).not.toBeNull();
    expect(dropzone).not.toHaveAttribute('data-drag-over');

    fireEvent.dragOver(dropzone as HTMLElement);
    expect(dropzone).toHaveAttribute('data-drag-over', 'true');

    fireEvent.dragLeave(dropzone as HTMLElement);
    expect(dropzone).not.toHaveAttribute('data-drag-over');
  });
});
