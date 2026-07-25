import { useSession } from '@/shared/session/SessionProvider';

// Deliberate two-column skeleton (D-05). Plan 01-07 fills the sidebar,
// registry, and "qual teste?" modal; plan 01-10 mounts the demo flow.
// The empty <aside>/<section> below are stable mount points, not
// placeholder copy a later plan must remember to delete.
export function EstatisticaPage() {
  const { hasData } = useSession();

  return (
    <div className="mx-auto flex max-w-[1520px] gap-8 px-6 py-8">
      <aside className="lacir-sidebar w-[300px] shrink-0" aria-label="Testes disponíveis" />
      <section className="lacir-estatistica-main flex-1" data-has-session-data={hasData}>
        <h1 className="font-sans text-display font-bold text-text">Estatística</h1>
      </section>
    </div>
  );
}
