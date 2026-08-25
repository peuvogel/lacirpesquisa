import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/shared/session/SessionProvider';

vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');
  return { ...actual, useReducedMotion: () => true };
});

import { MapasPage } from './MapasPage';

describe('MapasPage reduced motion', () => {
  it('uses immediate scrolling when group configuration and analysis open', async () => {
    const scrollSpy = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollSpy,
    });
    render(
      <MemoryRouter initialEntries={['/mapas']}>
        <SessionProvider>
          <MapasPage />
        </SessionProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Bahia' }));
    expect(scrollSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Criar Grupo 1' }));
    const configStep = screen.getByTestId('map-group-config-step');
    await waitFor(() => expect(document.activeElement).toBe(configStep));
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });

    scrollSpy.mockClear();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar doença' }), {
      target: { value: 'Embolia e trombose arteriais' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /Embolia e trombose arteriais/i }));
    fireEvent.click(screen.getByRole('button', { name: 'TX INTERNAÇÃO' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir análise descritiva' }));

    const analysisStep = await screen.findByRole('group', { name: 'Análise do recorte' });
    await waitFor(() => expect(document.activeElement).toBe(analysisStep));
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });
});
