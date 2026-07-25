import { useState } from 'react';
import { isTestAvailable } from '@/features/tests/registry';
import { useSession } from '@/shared/session/SessionProvider';
import { TesteDemo } from './demo/TesteDemo';
import { PortalDatasusLink } from './PortalDatasusLink';
import { QualTesteModal } from './QualTesteModal';
import { Sidebar } from './Sidebar';

// Deliberate two-column layout (D-05). Plan 01-10 mounts the active test
// module into #lacir-test-module-mount below — no placeholder copy here.
export function EstatisticaPage() {
  const { hasData } = useSession();
  const [activeTestId, setActiveTestId] = useState<string>('demo');
  const [qualTesteOpen, setQualTesteOpen] = useState(false);

  function handleSelectTest(id: string) {
    if (isTestAvailable(id)) {
      setActiveTestId(id);
    }
  }

  return (
    <div className="mx-auto flex max-w-[1520px] gap-8 px-6 py-8">
      <Sidebar
        activeTestId={activeTestId}
        onSelectTest={handleSelectTest}
        onOpenQualTeste={() => setQualTesteOpen(true)}
      />
      <section className="lacir-estatistica-main flex-1" data-has-session-data={hasData}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-sans text-display font-bold text-text">Estatística</h1>
          <PortalDatasusLink />
        </div>
        <div id="lacir-test-module-mount" data-active-test-id={activeTestId}>
          {activeTestId === 'demo' ? <TesteDemo key={activeTestId} /> : null}
        </div>
      </section>
      <QualTesteModal
        open={qualTesteOpen}
        onOpenChange={setQualTesteOpen}
        onSelectTest={handleSelectTest}
      />
    </div>
  );
}
