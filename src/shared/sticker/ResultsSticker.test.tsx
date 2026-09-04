import { afterEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { ResultsSticker } from './ResultsSticker';
import { resetSticker, revealSticker } from './stickerStore';

afterEach(() => {
  resetSticker();
});

describe('stickerStore', () => {
  it('starts hidden and reveals only once', () => {
    const { container, rerender } = render(<ResultsSticker />);
    expect(container.querySelector('.lacir-sticker')).toBeNull();

    revealSticker();
    rerender(<ResultsSticker />);
    expect(container.querySelector('.lacir-sticker')).not.toBeNull();

    // Revelar de novo é inócuo — uma vez colado, fica.
    revealSticker();
    rerender(<ResultsSticker />);
    expect(container.querySelectorAll('.lacir-sticker')).toHaveLength(1);
  });
});

describe('ResultsSticker', () => {
  it('renders nothing before the results come into view', () => {
    const { container } = render(<ResultsSticker />);
    expect(container).toBeEmptyDOMElement();
  });

  it('paints the LACIR logo on a non-blocking fixed layer once revealed', () => {
    revealSticker();
    const { container } = render(<ResultsSticker />);

    const layer = container.firstElementChild;
    expect(layer).toHaveClass('pointer-events-none', 'fixed');
    // A camada cobre a tela inteira, então não pode roubar cliques da página.
    expect(layer).toHaveAttribute('aria-hidden');

    const logos = container.querySelectorAll('img');
    // Face + verso (flap) usam a mesma arte.
    expect(logos).toHaveLength(2);
    for (const logo of logos) {
      expect(logo.getAttribute('src')).toContain('logo-lacir.png');
      expect(logo).toHaveAttribute('alt', '');
    }
  });

  it('keeps the sticker draggable and decorative', () => {
    revealSticker();
    const { container } = render(<ResultsSticker />);

    expect(container.querySelector('.lacir-sticker')).not.toBeNull();
    expect(container.querySelector('.lacir-sticker-container')).not.toBeNull();
    // O verso só existe para o efeito de descolar.
    expect(container.querySelector('.lacir-sticker-flap')).toHaveAttribute('aria-hidden');
  });
});
