import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { useEffect } from 'react';
import { AppShell } from '@/app/AppShell';
import { RouteError } from '@/app/RouteError';
import { appRouteChildren } from '@/app/router';
import {
  SessionProvider,
  useSession,
  type SessionDataset,
} from '@/shared/session/SessionProvider';
import { ClearDataButton } from './ClearDataButton';

const CONFIRM_BODY =
  'Limpar os dados desta análise? Essa ação apaga o que foi colado ou importado nesta sessão e não pode ser desfeita.';

const sampleDataset: SessionDataset = {
  headers: ['UF', 'Valor'],
  rows: [['BA', '10']],
  sourceLabel: 'colado',
  confirmedAt: Date.now(),
};

const activeBeforeUnloadListeners = new Set<EventListener>();

function countBeforeUnloadListeners(): number {
  return activeBeforeUnloadListeners.size;
}

function SessionSeed({ dataset }: { dataset: SessionDataset }) {
  const { setDataset } = useSession();
  useEffect(() => {
    setDataset(dataset);
  }, [dataset, setDataset]);
  return null;
}

function HasDataProbe() {
  const { hasData } = useSession();
  return <div data-testid="has-data">{String(hasData)}</div>;
}

function buildRouter(initialPath: string) {
  return createMemoryRouter(
    [
      {
        element: <AppShell />,
        errorElement: <RouteError />,
        children: appRouteChildren,
      },
    ],
    { initialEntries: [initialPath] },
  );
}

describe('ClearDataButton', () => {
  beforeEach(() => {
    activeBeforeUnloadListeners.clear();
    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'beforeunload' && typeof listener === 'function') {
        activeBeforeUnloadListeners.add(listener);
      }
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type, listener) => {
      if (type === 'beforeunload' && typeof listener === 'function') {
        activeBeforeUnloadListeners.delete(listener);
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the exact trigger copy', () => {
    render(
      <SessionProvider>
        <ClearDataButton />
      </SessionProvider>,
    );
    expect(screen.getByRole('button', { name: 'Limpar tabela' })).toBeInTheDocument();
  });

  it('opens the dialog with exact body copy and action labels', async () => {
    const user = userEvent.setup();
    render(
      <SessionProvider>
        <ClearDataButton />
      </SessionProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Limpar tabela' }));

    expect(screen.getByText(CONFIRM_BODY)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sim, limpar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('closes without clearing when Cancelar is clicked', async () => {
    const user = userEvent.setup();

    render(
      <SessionProvider>
        <SessionSeed dataset={sampleDataset} />
        <HasDataProbe />
        <ClearDataButton />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('has-data')).toHaveTextContent('true');
    });

    await user.click(screen.getByRole('button', { name: 'Limpar tabela' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByTestId('has-data')).toHaveTextContent('true');
    expect(screen.queryByText(CONFIRM_BODY)).not.toBeInTheDocument();
  });

  it('calls clearSession and onCleared exactly once on confirm', async () => {
    const user = userEvent.setup();
    const onCleared = vi.fn();

    render(
      <SessionProvider>
        <SessionSeed dataset={sampleDataset} />
        <HasDataProbe />
        <ClearDataButton onCleared={onCleared} />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('has-data')).toHaveTextContent('true');
    });

    await user.click(screen.getByRole('button', { name: 'Limpar tabela' }));
    await user.click(screen.getByRole('button', { name: 'Sim, limpar' }));

    expect(onCleared).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByTestId('has-data')).toHaveTextContent('false');
    });
  });

  it('removes the beforeunload listener after navigating away from Estatística', async () => {
    const router = buildRouter('/');

    render(
      <SessionProvider>
        <SessionSeed dataset={sampleDataset} />
        <RouterProvider router={router} />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(countBeforeUnloadListeners()).toBe(1);
    });

    await act(async () => {
      await router.navigate('/mapas');
    });

    await waitFor(() => {
      expect(countBeforeUnloadListeners()).toBe(0);
    });
  });
});
