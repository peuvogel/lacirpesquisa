import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComingSoonPage } from './ComingSoonPage';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ComingSoonPage', () => {
  it('renders the literal placeholder as its only copy', () => {
    const { container } = render(<ComingSoonPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Em breve' })).toBeInTheDocument();
    expect(container).toHaveTextContent(/^Em breve$/);
    expect(screen.queryByText(/Mapas|Variáveis|Meta-análise|2027/)).not.toBeInTheDocument();
  });

  it('has no controls, images, canvas, motion marker, or sticker', () => {
    const { container } = render(<ComingSoonPage />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(container.querySelector('canvas, img, [data-motion], .lacir-sticker')).toBeNull();
  });

  it('does not read from or write to browser storage', () => {
    const localStorageAccess = vi.spyOn(globalThis, 'localStorage', 'get');
    const sessionStorageAccess = vi.spyOn(globalThis, 'sessionStorage', 'get');
    const localGet = vi.spyOn(Storage.prototype, 'getItem');
    const localSet = vi.spyOn(Storage.prototype, 'setItem');
    const localRemove = vi.spyOn(Storage.prototype, 'removeItem');

    render(<ComingSoonPage />);

    expect(localStorageAccess).not.toHaveBeenCalled();
    expect(sessionStorageAccess).not.toHaveBeenCalled();
    expect(localGet).not.toHaveBeenCalled();
    expect(localSet).not.toHaveBeenCalled();
    expect(localRemove).not.toHaveBeenCalled();
  });
});
