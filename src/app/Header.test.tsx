import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from './Header';
import { resolvePublicAssetUrl } from './LogoLockup';

function renderHeader(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
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
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/meta-analise',
      '/variaveis',
      '/mapas',
    ]);
  });

  it('marks the current release route and navigates through the header', () => {
    renderHeader('/meta-analise');
    const metaLink = screen.getByRole('link', { name: 'Meta-análise' });
    const mapasLink = screen.getByRole('link', { name: 'Mapas' });

    expect(metaLink).toHaveAttribute('aria-current', 'page');
    expect(mapasLink).not.toHaveAttribute('aria-current');

    fireEvent.click(mapasLink);

    expect(metaLink).not.toHaveAttribute('aria-current');
    expect(mapasLink).toHaveAttribute('aria-current', 'page');
  });

  it('exposes the nav with accessible name Navegação principal', () => {
    renderHeader();
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
  });

  it('renders the logo with alt text Logo LACIR', () => {
    renderHeader();
    expect(screen.getByAltText('Logo LACIR')).toBeInTheDocument();
  });

  it('contains navigation at phone widths instead of widening the document', () => {
    renderHeader();
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    const logoText = screen.getByText('LACIR').parentElement;

    expect(nav).toHaveClass('min-w-0', 'overflow-x-auto');
    expect(logoText).toHaveClass('hidden', 'sm:flex');
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
