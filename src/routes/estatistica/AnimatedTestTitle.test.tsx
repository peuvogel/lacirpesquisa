import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AnimatedTestTitle } from './AnimatedTestTitle';

describe('AnimatedTestTitle', () => {
  it('exposes the whole title as the heading name despite the per-letter split', () => {
    render(<AnimatedTestTitle title="Teste t de Student" />);

    // O nome acessível precisa ser a frase inteira, não letra a letra.
    expect(screen.getByRole('heading', { name: 'Teste t de Student' })).toBeInTheDocument();
  });

  it('hides the animated letters from assistive tech', () => {
    const { container } = render(<AnimatedTestTitle title="ANOVA" />);

    const letters = container.querySelector('[aria-hidden]');
    expect(letters).not.toBeNull();
    expect(letters!.textContent).toBe('ANOVA');
    expect(container.querySelector('.sr-only')).toHaveTextContent('ANOVA');
  });
});
