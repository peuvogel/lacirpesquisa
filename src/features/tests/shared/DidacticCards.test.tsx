import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DidacticCards } from './DidacticCards';

function installReducedMotion(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('DidacticCards', () => {
  beforeEach(() => installReducedMotion(false));

  it('opens and closes from the keyboard with explicit expanded state', async () => {
    const user = userEvent.setup();
    render(<DidacticCards cards={[{ title: 'Quando usar', body: 'Use com grupos independentes.' }]} />);
    const trigger = screen.getByRole('button', { name: 'Quando usar' });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    trigger.focus();
    await user.keyboard('{Enter}');

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const content = screen.getByText('Use com grupos independentes.').closest(
      '[data-slot="collapsible-content"]',
    );
    expect(content).toHaveAttribute('data-motion', 'animated');

    await user.keyboard(' ');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('disables nonessential content animation when reduced motion is requested', async () => {
    installReducedMotion(true);
    const user = userEvent.setup();
    render(<DidacticCards cards={[{ title: 'Cuidado', body: 'Revise os pressupostos.' }]} />);

    await user.click(screen.getByRole('button', { name: 'Cuidado' }));
    const content = screen.getByText('Revise os pressupostos.').closest(
      '[data-slot="collapsible-content"]',
    );
    expect(content).toHaveAttribute('data-motion', 'reduced');
    expect(content).toHaveStyle({ animationDuration: '0ms' });
  });
});
