import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AssumptionNudgeStrip } from '@/features/tests/shared/AssumptionNudgeStrip';
import { UseExampleButton } from '@/features/tests/shared/UseExampleButton';
import type { AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { ResultsPanelWithCustomizer } from '@/shared/charts/ResultsPanelWithCustomizer';
import { deriveRecognizedColumnsFromTabular } from '@/shared/data-input/recognizedColumnsFromTabular';
import { useTabularInput } from '@/shared/data-input/useTabularInput';
import { FlowSteps, type FlowStep } from '@/shared/flow/FlowSteps';
import { useSession } from '@/shared/session/SessionProvider';
import { ClearDataButton } from '@/routes/estatistica/ClearDataButton';
import { TabularInputPanel } from '@/routes/estatistica/TabularInputPanel';
import {
  PoissonConfigPanel,
  PoissonValidationAlert,
  type PoissonLoadedInput,
} from './PoissonConfigPanel';
import {
  exampleText,
  MAX_RESEARCH_QUESTION_LENGTH,
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
  sessionDataset: ReturnType<typeof useSession>['dataset'],
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

function initialStepFromSession(sessionDataset: ReturnType<typeof useSession>['dataset']): FlowStep {
  return sessionDataset ? 'configurar' : 'dados';
}

export function PoissonTest({ onNavigateTest }: PoissonTestProps) {
  const { dataset: sessionDataset, setDataset } = useSession();
  const tabular = useTabularInput(TABULAR_OPTIONS);
  const sourceLabelRef = useRef('colado');

  const [activeStep, setActiveStep] = useState<FlowStep>(() => initialStepFromSession(sessionDataset));
  const [loadedInput, setLoadedInput] = useState<PoissonLoadedInput | null>(() =>
    initialLoadedFromSession(sessionDataset),
  );
  const [confirmedDataset, setConfirmedDataset] = useState<ConfirmedDataset | null>(null);
  const [alpha, setAlpha] = useState<AlphaValue>('0.05');
  const [researchQuestion, setResearchQuestion] = useState('');
  const [showSoftReset, setShowSoftReset] = useState(false);

  useEffect(() => {
    if (tabular.status === 'loaded') {
      setLoadedInput({
        headers: tabular.headers,
        rows: tabular.bodyRows,
        recognizedColumns: tabular.recognizedColumns,
        sourceLabel: sourceLabelRef.current,
      });
    }
  }, [tabular.status, tabular.headers, tabular.bodyRows, tabular.recognizedColumns]);

  function handleUseExample() {
    sourceLabelRef.current = 'exemplo';
    tabular.setRawText(exampleText);
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
    setConfirmedDataset({
      headers: confirmed.headers,
      rows: confirmed.rows,
      sourceLabel,
      recognizedColumns: confirmed.recognizedColumns,
    });
    setShowSoftReset(false);
    setDataset({
      headers: confirmed.headers,
      rows: confirmed.rows,
      sourceLabel,
      confirmedAt: Date.now(),
    });
    setActiveStep('resultados');
  }

  function handleClearData() {
    tabular.reset();
    setLoadedInput(null);
    setConfirmedDataset(null);
    setShowSoftReset(false);
    setActiveStep('dados');
    sourceLabelRef.current = 'colado';
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

    const alphaNumber = Number(alpha);
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
    const interpretation = buildPoissonInterpretation(
      engineOutput,
      alphaNumber,
      researchQuestion.trim().slice(0, MAX_RESEARCH_QUESTION_LENGTH),
    );
    const showNbHandoff =
      result.overdispersionRatio > OVERDISPERSION_THRESHOLD && Boolean(onNavigateTest);

    return (
      <>
        <AssumptionNudgeStrip
          nudges={engineOutput.nudges}
          onNavigateTest={onNavigateTest ? handleCrossTestHandoff : undefined}
        />
        <ResultsPanelWithCustomizer
          title="Regressão de Poisson: resultados"
          metrics={metrics}
          engineOutput={engineOutput}
          presets={poissonChartPresets}
          defaultPresetId={getDefaultPoissonChartPreset()}
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
  }, [confirmedDataset, loadedInput, alpha, researchQuestion, onNavigateTest]);

  return (
    <FlowSteps
      active={activeStep}
      canAdvance={canAdvance}
      dados={
        <div className="space-y-4">
          <UseExampleButton onClick={handleUseExample} />
          <TabularInputPanel {...tabular} showPreview={false} />
        </div>
      }
      configurar={
        loadedInput ? (
          <PoissonConfigPanel
            loadedInput={loadedInput}
            alpha={alpha}
            onAlphaChange={setAlpha}
            researchQuestion={researchQuestion}
            onResearchQuestionChange={setResearchQuestion}
            showSoftReset={showSoftReset}
            onRoleAdjust={handleRoleAdjust}
            onConfirm={handleConfigureConfirm}
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
