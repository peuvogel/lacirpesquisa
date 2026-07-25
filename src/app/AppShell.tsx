import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';

export function AppShell() {
  const { pathname } = useLocation();

  return (
    <>
      <Header />
      <main>
        {/* Keyed on pathname so the entry animation replays per route change,
            not on every re-render (D-15: data areas stay still). */}
        <div key={pathname} className="lacir-route-enter">
          <Outlet />
        </div>
      </main>
    </>
  );
}
