import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SpecularButton } from './SpecularButton';

describe('SpecularButton', () => {
  it('is a plain button to the accessibility tree', () => {
    render(<SpecularButton>Analisar dados</SpecularButton>);

    const button = screen.getByRole('button', { name: 'Analisar dados' });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('type', 'button');
  });

  it('survives an environment without WebGL, which is this very test run', () => {
    // O setup devolve null em getContext fora do 2d e não há ResizeObserver:
    // o efeito precisa se abster sem derrubar a árvore.
    const { container } = render(<SpecularButton>Analisar dados</SpecularButton>);

    expect(screen.getByRole('button', { name: 'Analisar dados' })).toBeInTheDocument();
    expect(container.querySelector('canvas')).toBeNull();
    // A borda estática entra no lugar do brilho, para o botão não sumir.
    expect(screen.getByRole('button', { name: 'Analisar dados' }))
      .toHaveAttribute('data-specular', 'off');
  });

  it('carries tone and size to the DOM, so the fallback border can follow', () => {
    render(<SpecularButton tone="accent" size="lg">Analisar dados</SpecularButton>);

    const button = screen.getByRole('button', { name: 'Analisar dados' });
    expect(button).toHaveAttribute('data-tone', 'accent');
    expect(button).toHaveAttribute('data-size', 'lg');
    expect(button.className).toContain('specular-button--lg');
  });

  it('defaults to the neutral tone at the app button size', () => {
    render(<SpecularButton>Analisar dados</SpecularButton>);

    const button = screen.getByRole('button', { name: 'Analisar dados' });
    expect(button).toHaveAttribute('data-tone', 'neutral');
    expect(button).toHaveAttribute('data-size', 'md');
    expect(button.className).not.toContain('specular-button--lg');
  });

  it('does not fire onClick while disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<SpecularButton disabled onClick={onClick}>Analisar dados</SpecularButton>);

    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Analisar dados' })).toBeDisabled();
  });

  it('fires onClick when enabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<SpecularButton onClick={onClick}>Analisar dados</SpecularButton>);

    await user.click(screen.getByRole('button', { name: 'Analisar dados' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
