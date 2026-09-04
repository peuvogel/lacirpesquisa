import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ParticleText } from './ParticleText';

describe('ParticleText', () => {
  it('survives an environment without ResizeObserver, which is this very test run', () => {
    // Sem o observer não há amostragem: o título tem de continuar legível como
    // texto comum, e não sumir junto com o efeito.
    const { container } = render(<ParticleText text="Breve em 2027.1" />);

    expect(screen.getByText('Breve em 2027.1')).toBeInTheDocument();
    expect(screen.getByText('Breve em 2027.1').className).not.toContain('sr-only');
    expect(container.querySelector('[data-particles]')).toHaveAttribute('data-particles', 'off');
  });

  it('keeps the canvas out of the accessibility tree', () => {
    const { container } = render(<ParticleText text="Breve em 2027.1" />);

    expect(container.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is phrasing content, so it can carry a real heading', () => {
    render(
      <h2>
        <ParticleText text="Breve em 2027.1" />
      </h2>,
    );

    expect(screen.getByRole('heading', { name: 'Breve em 2027.1' })).toBeInTheDocument();
  });

  it('takes the height from the caller instead of inventing one', () => {
    const { container } = render(<ParticleText text="Breve em 2027.1" className="h-40" />);

    expect(container.querySelector('[data-particles]')!.className).toContain('h-40');
  });
});
