import { useEffect, useMemo, useState } from 'react';
import { AssumptionNudgeStrip } from '@/features/tests/shared/AssumptionNudgeStrip';
import type { AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { ResultsPanelWithCustomizer } from '@/shared/charts/ResultsPanelWithCustomizer';
import { deriveRecognizedColumnsFromTabular } from '@/shared/data-input/recognizedColumnsFromTabular';
import { useAnalysisTable } from '@/shared/data-input/useAnalysisTable';
import { FlowSteps, type FlowStep } from '@/shared/flow/FlowSteps';
import { useSession } from '@/shared/session/SessionProvider';
import { ClearDataButton } from '@/routes/estatistica/ClearDataButton';
import { TabularInputPanel } from '@/routes/estatistica/TabularInputPanel';
import {
  BinomialNegativaConfigPanel,
  BinomialNegativaValidationAlert,
  type BinomialNegativaLoadedInput,
} from './BinomialNegativaConfigPanel';
import {
  exampleText,
  TABULAR_OPTIONS,
} from './binomialNegativaConfig';
import {
  BINOMIAL_NEGATIVA_CHART_ANNOTATIONS,
  binomialNegativaChartPresets,
  getDefaultBinomialNegativaChartPreset,
} from './binomialNegativaCharts';
import {
  buildDatasetFromConfirmed,
  buildMetrics,
  runAnalysis,
  sanitizeRecognizedColumns,
  toEngineOutput,
  validateColumnTypes,
  validateDataset,
} from './binomialNegativaEngine';
import { buildBinomialNegativaInterpretation } from './binomialNegativaInterpretation';

interface ConfirmedDataset {
  headers: string[];
  rows: string[][];
  sourceLabel: string;
  recognizedColumns: Record<string, number>;
}

export interface BinomialNegativaTestProps {
  handoffRecognizedColumns?: Record<string, number>;
}

function initialLoadedFromSession(
  sessionDataset: ReturnType<typeof useSession>['dataset'],
  handoffRecognizedColumns?: Record<string, number>,
): BinomialNegativaLoadedInput | null {
  if (!sessionDataset) return null;
  const recognizedColumns = handoffRecognizedColumns
    ? sanitizeRecognizedColumns(sessionDataset.headers, handoffRecognizedColumns)
    : deriveRecognizedColumnsFromTabular(
        sessionDataset.headers,
        sessionDataset.rows,
        TABULAR_OPTIONS,
      );
  return {
    headers: sessionDataset.headers,
    rows: sessionDataset.rows,
    recognizedColumns,
    sourceLabel: sessionDataset.sourceLabel,
  };
}

function initialStepFromSession(sessionDataset: ReturnType<typeof useSession>['dataset']): FlowStep {
  return sessionDataset ? 'configurar' : 'dados';
}

export function BinomialNegativaTest({ handoffRecognizedColumns }: BinomialNegativaTestProps) {
  const { dataset: sessionDataset } = useSession();
  const analysisTable = useAnalysisTable('binomial-negativa', { tabularOptions: TABULAR_OPTIONS, handoffRecognizedColumns });
  const tabular = analysisTable.tabular;

  const [activeStep, setActiveStep] = useState<FlowStep>(() => initialStepFromSession(sessionDataset));
  const [loadedInput, setLoadedInput] = useState<BinomialNegativaLoadedInput | null>(() =>
    initialLoadedFromSession(sessionDataset, handoffRecognizedColumns),
  );
  const [confirmedDataset, setConfirmedDataset] = useState<ConfirmedDataset | null>(null);
  const [alpha, setAlpha] = useState<AlphaValue>('0.05');
  const [showSoftReset, setShowSoftReset] = useState(false);

  useEffect(() => {
    if (!analysisTable.loadedInput) {
      setLoadedInput(null);
      setActiveStep('dados');
      return;
    }
    setLoadedInput(analysisTable.loadedInput);
  }, [analysisTable.loadedInput]);

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

    const alphaNumber = Number(alpha);
    const typeErrors = validateColumnTypes(
      confirmedDataset.headers,
      confirmedDataset.rows,
      confirmedDataset.recognizedColumns,
    );
    if (typeErrors.length) {
      return <BinomialNegativaValidationAlert message={typeErrors[0]} />;
    }

    const dataset = buildDatasetFromConfirmed({
      headers: confirmedDataset.headers,
      rows: confirmedDataset.rows,
      recognizedColumns: confirmedDataset.recognizedColumns,
    });
    const validationErrors = validateDataset(dataset);
    if (validationErrors.length) {
      return <BinomialNegativaValidationAlert message={validationErrors[0]} />;
    }

    const result = runAnalysis(dataset);
    const engineOutput = toEngineOutput(dataset, result);
    const metrics = buildMetrics(result, dataset);
    const interpretation = buildBinomialNegativaInterpretation(engineOutput, alphaNumber);

    return (
      <>
        <AssumptionNudgeStrip nudges={engineOutput.nudges} />
        <ResultsPanelWithCustomizer
          title="Regressão Binomial Negativa: resultados"
          metrics={metrics}
          engineOutput={engineOutput}
          presets={binomialNegativaChartPresets}
          defaultPresetId={getDefaultBinomialNegativaChartPreset()}
          preferenceScopeId="binomial-negativa"
          annotations={BINOMIAL_NEGATIVA_CHART_ANNOTATIONS}
          interpretation={interpretation}
          exportFilename="binomial-negativa-lacirstat.png"
          actions={<ClearDataButton onCleared={handleClearData} />}
        />
      </>
    );
  }, [confirmedDataset, loadedInput, alpha]);

  return (
    <FlowSteps
      active={activeStep}
      canAdvance={canAdvance}
      dados={
        <div className="space-y-4">
          <TabularInputPanel
            {...tabular}
            showPreview={false}
            showImportSummary={false}
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
          <BinomialNegativaConfigPanel
            loadedInput={loadedInput}
            alpha={alpha}
            onAlphaChange={setAlpha}
            showSoftReset={showSoftReset}
            onRoleAdjust={handleRoleAdjust}
            onConfirm={handleConfigureConfirm}
            document={analysisTable.table ?? undefined} testId="binomial-negativa"
            onDocumentChange={analysisTable.setDocument}
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
