import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { enterView } from '@/test/intersection';
import { intersectionObservers } from '@/test/setup';
import { RevealOnScroll } from './RevealOnScroll';

describe('RevealOnScroll', () => {
  it('keeps the content mounted and reachable before it enters the view', () => {
    render(
      <RevealOnScroll>
        <button type="button">Baixar todos</button>
      </RevealOnScroll>,
    );

    // Transparente, nunca desmontado: quem usa Ctrl+F ou leitor de tela
    // continua encontrando o bloco antes de a rolagem chegar nele.
    expect(screen.getByRole('button', { name: 'Baixar todos' })).toBeInTheDocument();
  });

  it('reveals the block once it enters the view, and keeps it revealed', async () => {
    const { container } = render(
      <RevealOnScroll>
        <p>Resultados</p>
      </RevealOnScroll>,
    );

    const block = container.firstElementChild as HTMLElement;
    expect(block.style.opacity).toBe('0');

    enterView();

    await waitFor(() => expect(block.style.opacity).toBe('1'));

    // `once`: uma vez revelado, nada o esconde de novo.
    enterView();
    expect(block.style.opacity).toBe('1');
  });

  it('disconnects its observer once the reveal is visible', async () => {
    const observerCountBeforeRender = intersectionObservers.length;

    render(
      <RevealOnScroll>
        <p>Resultados</p>
      </RevealOnScroll>,
    );

    await waitFor(() => {
      expect(intersectionObservers).toHaveLength(observerCountBeforeRender + 1);
      expect(intersectionObservers.at(-1)?.elements).toHaveLength(1);
    });

    enterView();

    await waitFor(() => expect(intersectionObservers.at(-1)?.elements).toHaveLength(0));
  });

  it('stops scheduling frames once the finite reveal has settled', () => {
    vi.useFakeTimers();
    const raf = vi.spyOn(window, 'requestAnimationFrame');

    try {
      render(
        <RevealOnScroll>
          <span>resultado</span>
        </RevealOnScroll>,
      );

      enterView();
      act(() => vi.advanceTimersByTime(1_000));
      const callsAtRest = raf.mock.calls.length;

      act(() => vi.advanceTimersByTime(1_000));

      expect(raf).toHaveBeenCalledTimes(callsAtRest);
    } finally {
      raf.mockRestore();
      vi.useRealTimers();
    }
  });
});
