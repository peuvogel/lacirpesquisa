import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { intersectionObservers } from '@/test/setup';

vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');
  return { ...actual, useReducedMotion: () => true };
});

import { RevealOnScroll } from './RevealOnScroll';

describe('RevealOnScroll reduced motion', () => {
  it('shows the block straight away, without waiting for any scrolling', () => {
    const { container } = render(
      <RevealOnScroll>
        <p>Resultados</p>
      </RevealOnScroll>,
    );

    const block = container.firstElementChild as HTMLElement;
    expect(block.style.opacity === '' || block.style.opacity === '1').toBe(true);
  });

  it('does not observe or schedule animation frames', () => {
    vi.useFakeTimers();
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const observerCountBeforeRender = intersectionObservers.length;

    try {
      const { container } = render(
        <RevealOnScroll>
          <p>Resultados</p>
        </RevealOnScroll>,
      );

      act(() => vi.advanceTimersByTime(1_000));

      const block = container.firstElementChild as HTMLElement;
      expect(block.style.opacity === '' || block.style.opacity === '1').toBe(true);
      expect(intersectionObservers).toHaveLength(observerCountBeforeRender);
      expect(raf).not.toHaveBeenCalled();
    } finally {
      raf.mockRestore();
      vi.useRealTimers();
    }
  });
});
