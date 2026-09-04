import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
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
import { useStatisticsSession } from '@/shared/session/StatisticsSessionProvider';
import { PersistenceNotice } from '@/shared/session/PersistenceNotice';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AnimatedTestTitle } from './AnimatedTestTitle';
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
  const {
    hasData,
    switchTest,
    setTestSlotMeta,
    persistenceMode,
    persistenceStatus,
    persistenceError,
  } = useStatisticsSession();
  const reduceMotion = useReducedMotion();
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
    if (!isTestAvailable(id) || id === activeTestId) return;
    // Cada teste guarda os seus: sair arquiva a tabela atual e entrar publica a
    // que aquele teste tinha. O encaminhamento pelos resultados é outro caminho
    // (handleCrossTestHandoff), que leva a tabela junto.
    switchTest(activeTestId, id);
    setHandoffRecognizedColumns(undefined);
    setActiveTestId(id);
  }

  // Trocar de teste recomeça a leitura do topo, em vez de abrir o novo teste na
  // altura em que o anterior estava rolado.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.scrollTo !== 'function') return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [activeTestId]);

  function handleCrossTestHandoff(testId: string, recognizedColumns?: Record<string, number>) {
    if (!isTestAvailable(testId) || testId === activeTestId) return;
    // Encaminhamento leva a tabela: arquiva no destino antes de trocar.
    setTestSlotMeta(testId, {});
    switchTest(activeTestId, testId);
    setActiveTestId(testId);
    if (recognizedColumns) {
      setHandoffRecognizedColumns(recognizedColumns);
    }
  }

  const activeTest = getTestById(activeTestId);

  return (
    <>
      <LeaveWarningGuard />
      <PersistenceNotice
        mode={persistenceMode}
        status={persistenceStatus}
        message={persistenceError}
      />
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
          <div className="mb-6 flex items-center gap-3">
            <AnimatedTestTitle
              key={activeTestId}
              title={activeTest.title}
              className="font-sans text-display font-bold text-text"
            />
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`Informações sobre ${activeTest.title}`}
                  className="group inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-transparent text-white transition-opacity hover:opacity-70 focus-visible:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info
                    className="size-3.5 transition-transform group-hover:scale-110 group-focus-visible:scale-110"
                    aria-hidden
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-80 space-y-2 rounded-xl border border-border bg-popover/95 p-4 shadow-lg backdrop-blur-md"
                align="start"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {activeTest.group}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">{activeTest.title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{activeTest.subtitle}</p>
                {activeTest.example ? (
                  <p className="mt-2 text-xs leading-relaxed text-foreground">{activeTest.example}</p>
                ) : null}
              </PopoverContent>
            </Popover>
          </div>
          {/* A caixa do teste entra junto com o título, keyed para replay na troca. */}
          <motion.div
            key={activeTestId}
            id="lacir-test-module-mount"
            data-active-test-id={activeTestId}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: 'easeOut' }}
          >
            {renderActiveTest({
              activeTestId,
              handoffRecognizedColumns,
              onCrossTestHandoff: handleCrossTestHandoff,
            })}
          </motion.div>
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
