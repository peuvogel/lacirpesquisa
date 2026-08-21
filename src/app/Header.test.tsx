import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from './Header';
import { resolvePublicAssetUrl } from './LogoLockup';

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );
}

describe('Header', () => {
  it('renders all four nav labels with correct accents/hyphenation, in order', () => {
    renderHeader();
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Estatística',
      'Meta-análise',
      'Variáveis',
      'Mapas',
    ]);
  });

  it('exposes the nav with accessible name Navegação principal', () => {
    renderHeader();
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
  });

  it('renders the logo with alt text Logo LACIR', () => {
    renderHeader();
    expect(screen.getByAltText('Logo LACIR')).toBeInTheDocument();
  });

  it('scopes the logo to the configured application base path', () => {
    expect(resolvePublicAssetUrl('/', 'logo-lacir.png')).toBe('/logo-lacir.png');
    expect(resolvePublicAssetUrl('/lacirpesquisa/', 'logo-lacir.png')).toBe(
      '/lacirpesquisa/logo-lacir.png',
    );
  });

  it('never renders a version/beta badge (D-02)', () => {
    renderHeader();
    expect(screen.queryByText(/beta|v1\.0|versão/i)).not.toBeInTheDocument();
  });

  it('never renders a DATASUS link in the header (D-03)', () => {
    renderHeader();
    const links = screen.queryAllByRole('link', { name: /datasus/i });
    expect(links).toHaveLength(0);
  });
});
