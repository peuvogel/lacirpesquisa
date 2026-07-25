import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { getUfName } from './ufCodes';
import { MapasPage } from './MapasPage';

const DEBOUNCE_MS = 300;

function renderMapasPage() {
  return render(
    <MemoryRouter>
      <SessionProvider>
        <MapasPage />
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('MapasPage group workspace', () => {
  it('renders GroupBar and SelectionSummaryStrip above map', () => {
    renderMapasPage();

    expect(screen.getByRole('region', { name: 'Barra de grupos' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Resumo da seleção' })).toBeInTheDocument();
    expect(screen.getByText('Nada selecionado ainda')).toBeInTheDocument();
  });

  it('creating a group updates the summary strip', () => {
    renderMapasPage();

    fireEvent.click(screen.getByRole('button', { name: 'Norte' }));
    expect(screen.getByText(/7 território\(s\)/)).toBeInTheDocument();
  });
});

describe('MapasPage paste integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('toggles TerritoryPastePanel when Colar territórios is clicked', () => {
    renderMapasPage();

    expect(screen.getByRole('heading', { name: 'Explore o mapa do Brasil' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Colar territórios' }));
    expect(screen.getByRole('heading', { name: 'Colar territórios' })).toBeInTheDocument();
  });

  it('selects BA on the map when pasting Bahia', async () => {
    renderMapasPage();

    fireEvent.click(screen.getByRole('button', { name: 'Colar territórios' }));
    const textarea = screen.getByLabelText('Cole territórios — um por linha');

    fireEvent.change(textarea, { target: { value: 'Bahia' } });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(screen.getByRole('button', { name: getUfName('BA') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Reconhecidos (1)')).toBeInTheDocument();
    expect(screen.getAllByText('BA').length).toBeGreaterThan(0);
  });

  it('shows unmatched lines without blocking map interaction', async () => {
    renderMapasPage();

    fireEvent.click(screen.getByRole('button', { name: 'Colar territórios' }));
    const textarea = screen.getByLabelText('Cole territórios — um por linha');

    fireEvent.change(textarea, { target: { value: 'BA\nXYZ' } });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(screen.getByText('Não reconhecidos (1)')).toBeInTheDocument();
    expect(screen.getByText('XYZ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: getUfName('BA') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getAllByRole('button', { name: /Bahia|Acre|Amazonas/ }).length).toBeGreaterThan(0);
  });
});
