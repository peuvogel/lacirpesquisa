import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyResultsButton } from './CopyResultsButton';

const metrics = [{ label: 'Média de Grupo A', value: '4,90' }] as const;
const interpretation = ['Observou-se diferença entre os grupos.'] as const;

function renderButton() {
  return render(
    <CopyResultsButton
      title="t de Student: resultados"
      metrics={metrics}
      interpretation={interpretation}
    />,
  );
}

describe('CopyResultsButton', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('morphs the button itself into a green Copiado state with a check', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const { container } = renderButton();

    expect(container.querySelector('.lucide-check')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Copiar tudo' }));

    const button = await screen.findByRole('button', { name: 'Copiado' });
    expect(writeText).toHaveBeenCalledTimes(1);
    // O aviso mora no botão, não num parágrafo ao lado.
    expect(button).toHaveAttribute('data-copied', 'true');
    expect(container.querySelector('.lucide-check')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Copiar tudo' })).not.toBeInTheDocument();
  });

  it('announces the copy through a status region for screen readers', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderButton();

    await user.click(screen.getByRole('button', { name: 'Copiar tudo' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Copiado');
  });

  it('goes back to Copiar tudo on its own once the success window closes', async () => {
    // shouldAdvanceTime mantém o relógio real correndo, então as animações do
    // motion continuam progredindo enquanto o timeout de sucesso é adiantado.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const { container } = renderButton();

    await user.click(screen.getByRole('button', { name: 'Copiar tudo' }));
    await screen.findByRole('button', { name: 'Copiado' });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copiar tudo' })).toBeInTheDocument();
    });
    // O check saiu junto com o rótulo.
    await waitFor(() => {
      expect(container.querySelector('.lucide-check')).toBeNull();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps the button copyable and reports the failure when the clipboard is unavailable', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    vi.mocked(document.execCommand).mockReturnValue(false);
    renderButton();

    const button = screen.getByRole('button', { name: 'Copiar tudo' });
    await user.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível copiar');
    expect(screen.getByRole('button', { name: 'Copiar tudo' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
