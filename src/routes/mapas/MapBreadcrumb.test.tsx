import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapBreadcrumb } from './MapBreadcrumb';

describe('MapBreadcrumb', () => {
  it('shows Brasil as current at UF level', () => {
    render(<MapBreadcrumb mapView={{ level: 'uf' }} onNavigate={() => {}} />);
    expect(screen.getByText('Brasil')).toBeInTheDocument();
    expect(screen.queryByText(/Bahia/)).not.toBeInTheDocument();
  });

  it('shows Brasil → Bahia (BA) when drilled', () => {
    render(
      <MapBreadcrumb
        mapView={{ level: 'municipio', parentCode: 'BA', ufIbge: '29' }}
        onNavigate={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Brasil' })).toBeInTheDocument();
    expect(screen.getByText('Bahia (BA)')).toBeInTheDocument();
  });

  it('navigates back to Brasil on click', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <MapBreadcrumb
        mapView={{ level: 'municipio', parentCode: 'BA', ufIbge: '29' }}
        onNavigate={onNavigate}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Brasil' }));
    expect(onNavigate).toHaveBeenCalledWith({ level: 'uf' });
  });

  it('switches geography level tabs', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <MapBreadcrumb
        mapView={{ level: 'municipio', parentCode: 'BA', ufIbge: '29' }}
        onNavigate={onNavigate}
      />,
    );
    await user.click(screen.getByRole('tab', { name: 'Macrorregião de saúde' }));
    expect(onNavigate).toHaveBeenCalledWith({
      level: 'health-macro',
      parentCode: 'BA',
      ufIbge: '29',
    });
  });
});
