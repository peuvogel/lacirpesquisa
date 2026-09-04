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

  it('returns null and does not render didactic section', () => {
    const { container } = render(
      <DidacticCards cards={[{ title: 'Quando usar', body: 'Use com grupos independentes.' }]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
