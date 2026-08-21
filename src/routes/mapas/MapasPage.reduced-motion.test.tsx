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
  it('uses immediate scrolling for both newly opened progressive steps', async () => {
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
    const questionStep = screen.getByTestId('map-question-step');
    await waitFor(() => expect(document.activeElement).toBe(questionStep));
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });

    scrollSpy.mockClear();
    fireEvent.click(screen.getByRole('checkbox', { name: /Embolia e trombose arteriais/i }));
    fireEvent.click(screen.getByRole('button', { name: /Mesmo intervalo em todos os grupos/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Descrever' }));
    fireEvent.click(screen.getByRole('button', { name: 'Começar análise' }));

    const analysisStep = await screen.findByRole('group', { name: 'Análise do recorte' });
    await waitFor(() => expect(document.activeElement).toBe(analysisStep));
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });
});
