import { NavLink } from 'react-router-dom';
import { LogoLockup } from './LogoLockup';

// Locked order and labels (D-01). No version badge (D-02). No Portal DATASUS
// link here — that lives inside the Estatística route (D-03, plan 01-07).
export const NAV_ITEMS = [
  { to: '/', label: 'Estatística' },
  { to: '/meta-analise', label: 'Meta-análise' },
  { to: '/variaveis', label: 'Variáveis' },
  { to: '/mapas', label: 'Mapas' },
] as const;

const BLUR_CHROME = {
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
} as const;

export function Header() {
  return (
    <header
      className="lacir-header-grain sticky top-0 z-50 w-full border-b border-border-strong bg-bg/75"
      style={BLUR_CHROME}
    >
      <div className="mx-auto flex h-16 max-w-[1520px] items-center gap-3 px-3 sm:gap-6 sm:px-6">
        <NavLink to="/" end aria-label="LACIR: página inicial">
          <LogoLockup />
        </NavLink>
        <nav
          aria-label="Navegação principal"
          className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto overscroll-x-contain sm:flex-none sm:gap-6"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `shrink-0 font-sans text-label font-bold border-b-2 py-1 transition-colors ${
                  isActive
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text hover:text-accent'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
