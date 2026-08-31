import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnovaTukeyTest } from '@/features/tests/anova-tukey/AnovaTukeyTest';
import { BinomialNegativaTest } from '@/features/tests/binomial-negativa/BinomialNegativaTest';
import { CorrelacaoTest } from '@/features/tests/correlacao/CorrelacaoTest';
import { KruskalDunnTest } from '@/features/tests/kruskal-dunn/KruskalDunnTest';
import { LogisticaTest } from '@/features/tests/logistica/LogisticaTest';
import { MannWhitneyTest } from '@/features/tests/mann-whitney/MannWhitneyTest';
import { PoissonTest } from '@/features/tests/poisson/PoissonTest';
import { PraisWinstenTest } from '@/features/tests/prais-winsten/PraisWinstenTest';
import { QuiQuadradoTest } from '@/features/tests/qui-quadrado/QuiQuadradoTest';
import { TStudentTest } from '@/features/tests/t-student/TStudentTest';
import { getTestById, isTestAvailable, type TestId } from '@/features/tests/registry';
import { useSession } from '@/shared/session/SessionProvider';
import { LeaveWarningGuard } from './LeaveWarningGuard';
import { QualTesteModal } from './QualTesteModal';
import { Sidebar } from './Sidebar';

export interface EstatisticaHandoffState {
  activeTestId?: string;
  recognizedColumns?: Record<string, number>;
}

interface RenderActiveTestProps {
  /**
   * `TestId`, não `string`: junto com o `default` exaustivo abaixo, isso faz
   * o TypeScript recusar a compilação assim que um novo id entrar em
   * `TEST_REGISTRY` sem um `case` correspondente aqui — a mesma garantia que
   * `TEST_ICONS` já tem em SidebarTestLink.tsx. Com `string`, o id novo
   * caía no `default` e o módulo simplesmente não renderizava, sem erro.
   */
  activeTestId: TestId;
  handoffRecognizedColumns?: Record<string, number>;
  onCrossTestHandoff: (testId: string, recognizedColumns?: Record<string, number>) => void;
}

function renderActiveTest({
  activeTestId,
  handoffRecognizedColumns,
  onCrossTestHandoff,
}: RenderActiveTestProps) {
  switch (activeTestId) {
    case 't-student':
      return <TStudentTest key={activeTestId} />;
    case 'mann-whitney':
      return <MannWhitneyTest key={activeTestId} />;
    case 'correlacao':
      return <CorrelacaoTest key={activeTestId} />;
    case 'prais-winsten':
      return <PraisWinstenTest key={activeTestId} />;
    case 'qui-quadrado':
      return <QuiQuadradoTest key={activeTestId} />;
    case 'anova-tukey':
      return (
        <AnovaTukeyTest
          key={activeTestId}
          onNavigateTest={(testId, recognizedColumns) =>
            onCrossTestHandoff(testId, recognizedColumns)
          }
        />
      );
    case 'kruskal-dunn':
      return (
        <KruskalDunnTest
          key={activeTestId}
          handoffRecognizedColumns={handoffRecognizedColumns}
          onNavigateTest={(testId) => onCrossTestHandoff(testId)}
        />
      );
    case 'poisson':
      return (
        <PoissonTest
          key={activeTestId}
          onNavigateTest={(testId, recognizedColumns) =>
            onCrossTestHandoff(testId, recognizedColumns)
          }
        />
      );
    case 'binomial-negativa':
      return (
        <BinomialNegativaTest
          key={activeTestId}
          handoffRecognizedColumns={handoffRecognizedColumns}
        />
      );
    case 'logistica':
      return <LogisticaTest key={activeTestId} />;
    default: {
      // Erro de compilação (TS2322) se um id de TEST_REGISTRY ficar sem
      // `case` acima — a ausência vira falha de build, não tela vazia.
      const exhaustive: never = activeTestId;
      return exhaustive;
    }
  }
}

// Deliberate two-column layout (D-05). Plan 01-10 mounts the active test
// module into #lacir-test-module-mount below — no placeholder copy here.
export function EstatisticaPage() {
  const { hasData } = useSession();
  const location = useLocation();
  const [activeTestId, setActiveTestId] = useState<TestId>('t-student');
  const [handoffRecognizedColumns, setHandoffRecognizedColumns] = useState<
    Record<string, number> | undefined
  >();
  const [qualTesteOpen, setQualTesteOpen] = useState(false);

  useEffect(() => {
    if (!hasData) return;

    const handoff = location.state as EstatisticaHandoffState | null;
    const handoffId = handoff?.activeTestId;
    if (handoffId && isTestAvailable(handoffId)) {
      setActiveTestId(handoffId);
    }
    if (handoff?.recognizedColumns) {
      setHandoffRecognizedColumns(handoff.recognizedColumns);
    }
  }, [hasData, location.state]);

  function handleSelectTest(id: string) {
    if (isTestAvailable(id)) {
      setActiveTestId(id);
    }
  }

  function handleCrossTestHandoff(testId: string, recognizedColumns?: Record<string, number>) {
    if (!isTestAvailable(testId)) return;
    setActiveTestId(testId);
    if (recognizedColumns) {
      setHandoffRecognizedColumns(recognizedColumns);
    }
  }

  const pageTitle = getTestById(activeTestId).title;

  return (
    <>
      <LeaveWarningGuard />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] min-w-0 max-w-[1600px] gap-0">
        <Sidebar
          activeTestId={activeTestId}
          onSelectTest={handleSelectTest}
          onOpenQualTeste={() => setQualTesteOpen(true)}
        />
        <section
          className="lacir-estatistica-main min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8"
          data-has-session-data={hasData}
        >
          <div className="mb-6">
            <h1 className="font-sans text-display font-bold text-text">{pageTitle}</h1>
          </div>
          <div id="lacir-test-module-mount" data-active-test-id={activeTestId}>
            {renderActiveTest({
              activeTestId,
              handoffRecognizedColumns,
              onCrossTestHandoff: handleCrossTestHandoff,
            })}
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
