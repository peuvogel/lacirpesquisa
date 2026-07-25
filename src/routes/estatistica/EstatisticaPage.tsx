import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CorrelacaoTest } from '@/features/tests/correlacao/CorrelacaoTest';
import { PraisWinstenTest } from '@/features/tests/prais-winsten/PraisWinstenTest';
import { TStudentTest } from '@/features/tests/t-student/TStudentTest';
import { isTestAvailable } from '@/features/tests/registry';
import { useSession } from '@/shared/session/SessionProvider';
import { LeaveWarningGuard } from './LeaveWarningGuard';
import { TesteDemo } from './demo/TesteDemo';
import { PortalDatasusLink } from './PortalDatasusLink';
import { QualTesteModal } from './QualTesteModal';
import { Sidebar } from './Sidebar';

export interface EstatisticaHandoffState {
  activeTestId?: string;
}

function renderActiveTest(activeTestId: string) {
  switch (activeTestId) {
    case 'demo':
      return <TesteDemo key={activeTestId} />;
    case 't-student':
      return <TStudentTest key={activeTestId} />;
    case 'correlacao':
      return <CorrelacaoTest key={activeTestId} />;
    case 'prais-winsten':
      return <PraisWinstenTest key={activeTestId} />;
    default:
      return null;
  }
}

// Deliberate two-column layout (D-05). Plan 01-10 mounts the active test
// module into #lacir-test-module-mount below — no placeholder copy here.
export function EstatisticaPage() {
  const { hasData } = useSession();
  const location = useLocation();
  const [activeTestId, setActiveTestId] = useState<string>('demo');
  const [qualTesteOpen, setQualTesteOpen] = useState(false);

  useEffect(() => {
    if (!hasData) return;

    const handoff = location.state as EstatisticaHandoffState | null;
    const handoffId = handoff?.activeTestId;
    if (handoffId && isTestAvailable(handoffId)) {
      setActiveTestId(handoffId);
    }
  }, [hasData, location.state]);

  function handleSelectTest(id: string) {
    if (isTestAvailable(id)) {
      setActiveTestId(id);
    }
  }

  return (
    <>
      <LeaveWarningGuard />
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
          {renderActiveTest(activeTestId)}
        </div>
      </section>
      <QualTesteModal
        open={qualTesteOpen}
        onOpenChange={setQualTesteOpen}
        onSelectTest={handleSelectTest}
      />
    </div>
    </>
  );
}
