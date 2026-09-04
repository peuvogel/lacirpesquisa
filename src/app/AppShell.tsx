import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { findReleaseRoute } from '@/release/releaseManifest';
import { Header } from './Header';

export function AppShell() {
  const { pathname } = useLocation();
  const releaseRoute = findReleaseRoute(pathname);
  const mainRef = useRef<HTMLElement>(null);
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    if (releaseRoute) document.title = releaseRoute.documentTitle;

    if (previousPathnameRef.current !== pathname) {
      mainRef.current?.focus();
    }
    previousPathnameRef.current = pathname;
  }, [pathname, releaseRoute]);

  return (
    <>
      <Header />
      <main ref={mainRef} tabIndex={-1}>
        {/* Keyed on pathname so the entry animation replays per route change,
            not on every re-render (D-15: data areas stay still). */}
        <div
          key={pathname}
          className={releaseRoute?.availability === 'active' ? 'lacir-route-enter' : undefined}
        >
          <Outlet />
        </div>
      </main>
    </>
  );
}
