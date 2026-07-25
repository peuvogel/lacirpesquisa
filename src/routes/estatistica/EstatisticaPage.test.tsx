import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  SessionProvider,
  useSession,
  type SessionDataset,
} from '@/shared/session/SessionProvider';
import { EstatisticaPage } from './EstatisticaPage';

function SeedSession({
  dataset,
  children,
}: {
  dataset: SessionDataset;
  children: React.ReactNode;
}) {
  const { setDataset } = useSession();
  useEffect(() => {
    setDataset(dataset);
  }, [dataset, setDataset]);
  return <>{children}</>;
}

function renderPage(initialEntries: Array<string | { pathname: string; state?: unknown }> = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SessionProvider>
        <EstatisticaPage />
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('EstatisticaPage', () => {
  it('defaults to Teste demo on cold start', () => {
    renderPage();
    const mount = document.getElementById('lacir-test-module-mount');
    expect(mount).toHaveAttribute('data-active-test-id', 'demo');
    expect(screen.getByRole('button', { name: 'Usar exemplo' })).toBeInTheDocument();
  });

  it('mounts t de Student when selected from the sidebar', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /t de Student/i }));

    const mount = document.getElementById('lacir-test-module-mount');
    expect(mount).toHaveAttribute('data-active-test-id', 't-student');
    expect(screen.getByRole('heading', { name: 'Cole ou envie seus dados' })).toBeInTheDocument();
  });

  it('applies handoff test id when session data is present', async () => {
    const dataset: SessionDataset = {
      headers: ['Grupo', 'Valor'],
      rows: [['A', '1'], ['B', '2']],
      sourceLabel: 'Mapas — SP, BA',
      confirmedAt: Date.now(),
    };

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/',
            state: { activeTestId: 'correlacao' },
          },
        ]}
      >
        <SessionProvider>
          <SeedSession dataset={dataset}>
            <EstatisticaPage />
          </SeedSession>
        </SessionProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const mount = document.getElementById('lacir-test-module-mount');
      expect(mount).toHaveAttribute('data-active-test-id', 'correlacao');
    });

    expect(screen.getByRole('button', { name: 'Configurar' })).toHaveAttribute('aria-current', 'step');
  });
});
