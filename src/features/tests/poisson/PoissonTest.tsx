import { useEffect, useMemo, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { AssumptionNudgeInfo } from '@/features/tests/shared/AssumptionNudgeInfo';
import { parseAlpha, type AlphaValue } from '@/features/tests/shared/alpha';
import { ResultsPanelWithCustomizer } from '@/shared/charts/ResultsPanelWithCustomizer';
import { deriveRecognizedColumnsFromTabular } from '@/shared/data-input/recognizedColumnsFromTabular';
import { useAnalysisTable } from '@/shared/data-input/useAnalysisTable';
import { FlowSteps, type FlowStep } from '@/shared/flow/FlowSteps';
import { useStatisticsSession } from '@/shared/session/StatisticsSessionProvider';
import { ClearDataButton } from '@/routes/estatistica/ClearDataButton';
import { TabularInputPanel } from '@/routes/estatistica/TabularInputPanel';
import {
  PoissonConfigPanel,
  PoissonValidationAlert,
  type PoissonLoadedInput,
} from './PoissonConfigPanel';
import {
  exampleText,
  NB_HANDOFF_TEST_ID,
  TABULAR_OPTIONS,
} from './poissonConfig';
import {
  getDefaultPoissonChartPreset,
  poissonChartPresets,
  POISSON_CHART_ANNOTATIONS,
} from './poissonCharts';
import {
  buildDatasetFromConfirmed,
  buildMetrics,
  OVERDISPERSION_THRESHOLD,
  runAnalysis,
  toEngineOutput,
  validateColumnTypes,
  validateDataset,
} from './poissonEngine';
import { buildPoissonInterpretation } from './poissonInterpretation';

interface ConfirmedDataset {
  headers: string[];
  rows: string[][];
  sourceLabel: string;
  recognizedColumns: Record<string, number>;
}

export interface PoissonTestProps {
  onNavigateTest?: (testId: string, recognizedColumns?: Record<string, number>) => void;
}

function initialLoadedFromSession(
  sessionDataset: ReturnType<typeof useStatisticsSession>['dataset'],
): PoissonLoadedInput | null {
  if (!sessionDataset) return null;
  return {
    headers: sessionDataset.headers,
    rows: sessionDataset.rows,
    recognizedColumns: deriveRecognizedColumnsFromTabular(
      sessionDataset.headers,
      sessionDataset.rows,
      TABULAR_OPTIONS,
    ),
    sourceLabel: sessionDataset.sourceLabel,
  };
}

function initialStepFromSession(
  sessionDataset: ReturnType<typeof useStatisticsSession>['dataset'],
): FlowStep {
  return sessionDataset ? 'configurar' : 'dados';
}

export function PoissonTest({ onNavigateTest }: PoissonTestProps) {
  const { dataset: sessionDataset } = useStatisticsSession();
  const analysisTable = useAnalysisTable('poisson', { tabularOptions: TABULAR_OPTIONS });
  const tabular = analysisTable.tabular;

  const [activeStep, setActiveStep] = useState<FlowStep>(() => initialStepFromSession(sessionDataset));
  const [loadedInput, setLoadedInput] = useState<PoissonLoadedInput | null>(() =>
    initialLoadedFromSession(sessionDataset),
  );
  const [confirmedDataset, setConfirmedDataset] = useState<ConfirmedDataset | null>(null);
  const [alpha, setAlphaState] = useState<AlphaValue>(() =>
    parseAlpha(analysisTable.settings.alpha),
  );
  const alphaChangedLocallyRef = useRef(false);
  useEffect(() => {
    if (!alphaChangedLocallyRef.current) setAlphaState(parseAlpha(analysisTable.settings.alpha));
  }, [analysisTable.settings.alpha]);

  // A configuração viaja com a tabela: voltar ao teste e recalcular com um alfa
  // diferente do que foi confirmado mostraria números de outro ajuste.
  function setAlpha(next: AlphaValue) {
    alphaChangedLocallyRef.current = true;
    setAlphaState(next);
    analysisTable.setSettings({ alpha: next });
  }
  const [showSoftReset, setShowSoftReset] = useState(false);

  useEffect(() => {
    if (!analysisTable.loadedInput) {
      setLoadedInput(null);
      setActiveStep('dados');
      return;
    }
    setLoadedInput(analysisTable.loadedInput);
  }, [analysisTable.loadedInput]);

  // Espelho do efeito abaixo: ao voltar ao teste, o resultado reconstruído pela
  // sessão é adotado uma única vez, para cair direto nos resultados. Sem o
  // guarda, ele reverteria toda invalidação local (trocar modo, α, período).
  const adoptedConfirmedRef = useRef(false);
  useEffect(() => {
    if (adoptedConfirmedRef.current) return;
    // Confirmar manualmente também consome a chance de adoção: sem isto, a
    // próxima invalidação local seria revertida pelo confirmado da sessão.
    if (confirmedDataset) {
      adoptedConfirmedRef.current = true;
      return;
    }
    if (!analysisTable.confirmed) return;
    adoptedConfirmedRef.current = true;
    setConfirmedDataset(analysisTable.confirmed);
    setActiveStep('resultados');
  }, [analysisTable.confirmed, confirmedDataset]);

  useEffect(() => {
    if (analysisTable.confirmed || !confirmedDataset) return;
    setConfirmedDataset(null);
    setShowSoftReset(true);
    setActiveStep((step) => (step === 'resultados' ? 'configurar' : step));
  }, [analysisTable.confirmed, confirmedDataset]);

  function handleUseExample() {
    analysisTable.useExample(exampleText);
  }

  function handleRoleAdjust() {
    if (!confirmedDataset) return;
    setConfirmedDataset(null);
    setShowSoftReset(true);
    if (activeStep === 'resultados') setActiveStep('configurar');
  }

  function handleCrossTestHandoff(testId: string) {
    if (testId !== NB_HANDOFF_TEST_ID) return;
    const recognizedColumns =
      confirmedDataset?.recognizedColumns ?? loadedInput?.recognizedColumns;
    onNavigateTest?.(testId, recognizedColumns);
  }

  function handleConfigureConfirm(confirmed: {
    headers: string[];
    rows: string[][];
    recognizedColumns: Record<string, number>;
  }) {
    const sourceLabel = loadedInput?.sourceLabel ?? 'colado';
    setConfirmedDataset(analysisTable.confirm() ?? { ...confirmed, sourceLabel });
    setShowSoftReset(false);
    setActiveStep('resultados');
  }

  function handleClearData() {
    analysisTable.requestClear(() => {
      setLoadedInput(null);
      setConfirmedDataset(null);
      setShowSoftReset(false);
      setActiveStep('dados');
    });
  }

  const canAdvance = useMemo(
    () => ({
      dados: true,
      configurar: Boolean(loadedInput),
      resultados: Boolean(confirmedDataset),
    }),
    [loadedInput, confirmedDataset],
  );

  const resultsContent = useMemo(() => {
    if (!confirmedDataset || !loadedInput) return null;

    const alphaNumber = alpha;
    const typeErrors = validateColumnTypes(
      confirmedDataset.headers,
      confirmedDataset.rows,
      confirmedDataset.recognizedColumns,
    );
    if (typeErrors.length) {
      return <PoissonValidationAlert message={typeErrors[0]} />;
    }

    const dataset = buildDatasetFromConfirmed({
      headers: confirmedDataset.headers,
      rows: confirmedDataset.rows,
      recognizedColumns: confirmedDataset.recognizedColumns,
    });
    const validationErrors = validateDataset(dataset);
    if (validationErrors.length) {
      return <PoissonValidationAlert message={validationErrors[0]} />;
    }

    const result = runAnalysis(dataset);
    const engineOutput = toEngineOutput(dataset, result);
    const metrics = buildMetrics(result, dataset);
    const interpretation = buildPoissonInterpretation(engineOutput, alphaNumber);
    const showNbHandoff =
      result.overdispersionRatio > OVERDISPERSION_THRESHOLD && Boolean(onNavigateTest);

    return (
      <>
        <ResultsPanelWithCustomizer
          title="Resultados"
          titleInfo={(
            <AssumptionNudgeInfo
              nudges={engineOutput.nudges}
              onNavigateTest={onNavigateTest ? handleCrossTestHandoff : undefined}
            />
          )}
          metrics={metrics}
          engineOutput={engineOutput}
          presets={poissonChartPresets}
          defaultPresetId={getDefaultPoissonChartPreset()}
          preferenceScopeId="poisson"
          annotations={POISSON_CHART_ANNOTATIONS}
          interpretation={interpretation}
          exportFilename="poisson-lacirstat.png"
          actions={
            <>
              {showNbHandoff ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCrossTestHandoff(NB_HANDOFF_TEST_ID)}
                >
                  Abrir Binomial Negativa
                </Button>
              ) : null}
              <ClearDataButton onCleared={handleClearData} />
            </>
          }
        />
      </>
    );
  }, [confirmedDataset, loadedInput, alpha, onNavigateTest]);

  return (
    <FlowSteps
      active={activeStep}
      canAdvance={canAdvance}
      dados={
        <div className="space-y-4">
          <TabularInputPanel
            {...tabular}
            showPreview={false}
            onUseExample={handleUseExample}
            onClear={handleClearData}
            onRawTextChange={analysisTable.requestPaste}
            onFileSelect={analysisTable.requestFile}
            pendingAction={analysisTable.pendingAction}
            onConfirmPendingAction={analysisTable.confirmPendingAction}
            onCancelPendingAction={analysisTable.cancelPendingAction}
          />
        </div>
      }
      configurar={
        loadedInput ? (
          <PoissonConfigPanel
            loadedInput={loadedInput}
            alpha={alpha}
            onAlphaChange={setAlpha}
            showSoftReset={showSoftReset}
            onRoleAdjust={handleRoleAdjust}
            onConfirm={handleConfigureConfirm}
            document={analysisTable.table ?? undefined} testId="poisson"
            onDocumentChange={analysisTable.setDocument}
            onUndo={analysisTable.undo}
            importWarnings={analysisTable.importWarnings}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Carregue dados na etapa Dados para continuar.</p>
        )
      }
      resultados={
        resultsContent ?? (
          <p className="text-sm text-muted-foreground">
            Confirme a tabela em Configurar para ver métricas, avisos de pressupostos e gráficos.
          </p>
        )
      }
    />
  );
}
