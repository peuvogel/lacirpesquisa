import { useEffect, useMemo, useState } from 'react';
import type { AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { ResultsPanelWithCustomizer } from '@/shared/charts/ResultsPanelWithCustomizer';
import { deriveRecognizedColumnsFromTabular } from '@/shared/data-input/recognizedColumnsFromTabular';
import { useAnalysisTable } from '@/shared/data-input/useAnalysisTable';
import { FlowSteps, type FlowStep } from '@/shared/flow/FlowSteps';
import { useSession } from '@/shared/session/SessionProvider';
import { ClearDataButton } from '@/routes/estatistica/ClearDataButton';
import { TabularInputPanel } from '@/routes/estatistica/TabularInputPanel';
import {
  CorrelacaoConfigPanel,
  CorrelacaoValidationAlert,
  type CorrelacaoLoadedInput,
} from './CorrelacaoConfigPanel';
import {
  exampleText,
  MAX_RESEARCH_QUESTION_LENGTH,
  TABULAR_OPTIONS,
  type CorrelacaoMethod,
} from './correlacaoConfig';
import {
  buildCorrelacaoChartPresets,
  CORRELACAO_CHART_ANNOTATIONS,
  getDefaultCorrelacaoChartPreset,
} from './correlacaoCharts';
import {
  buildDatasetFromConfirmed,
  buildMetrics,
  toEngineOutput,
  validatePairs,
} from './correlacaoEngine';
import { buildCorrelacaoInterpretation } from './correlacaoInterpretation';

interface ConfirmedDataset {
  headers: string[];
  rows: string[][];
  sourceLabel: string;
  recognizedColumns: Record<string, number>;
}

function initialLoadedFromSession(
  sessionDataset: ReturnType<typeof useSession>['dataset'],
): CorrelacaoLoadedInput | null {
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

export function CorrelacaoTest() {
  const { dataset: sessionDataset } = useSession();
  const analysisTable = useAnalysisTable('correlacao', { tabularOptions: TABULAR_OPTIONS });
  const tabular = analysisTable.tabular;

  const [activeStep, setActiveStep] = useState<FlowStep>(() => initialStepFromSession(sessionDataset));
  const [loadedInput, setLoadedInput] = useState<CorrelacaoLoadedInput | null>(() =>
    initialLoadedFromSession(sessionDataset),
  );
  const [confirmedDataset, setConfirmedDataset] = useState<ConfirmedDataset | null>(null);
  const [method, setMethod] = useState<CorrelacaoMethod>('pearson');
  const [alpha, setAlpha] = useState<AlphaValue>('0.05');
  const [researchQuestion, setResearchQuestion] = useState('');
  const [showSoftReset, setShowSoftReset] = useState(false);

  useEffect(() => {
    if (!analysisTable.loadedInput) {
      setLoadedInput(null);
      setActiveStep('dados');
      return;
    }
    setLoadedInput(analysisTable.loadedInput);
    setActiveStep((step) => (step === 'dados' ? 'configurar' : step));
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

  function handleMethodChange(nextMethod: CorrelacaoMethod) {
    if (nextMethod === method) return;
    if (confirmedDataset) {
      setConfirmedDataset(null);
      setShowSoftReset(true);
      if (activeStep === 'resultados') setActiveStep('configurar');
    }
    setMethod(nextMethod);
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
    const dataset = buildDatasetFromConfirmed({
      headers: confirmedDataset.headers,
      rows: confirmedDataset.rows,
      recognizedColumns: confirmedDataset.recognizedColumns,
      method,
    });
    const validationErrors = validatePairs(dataset);
    if (validationErrors.length) {
      return <CorrelacaoValidationAlert message={validationErrors[0]!} />;
    }

    const engineOutput = toEngineOutput(dataset, method);
    const metrics = buildMetrics(engineOutput.result, method, engineOutput.headers);
    const interpretation = buildCorrelacaoInterpretation(
      engineOutput,
      alphaNumber,
      researchQuestion.trim().slice(0, MAX_RESEARCH_QUESTION_LENGTH),
    );

    return (
      <ResultsPanelWithCustomizer
        key={`correlacao-${method}`}
        title="Correlação: resultados"
        metrics={metrics}
        engineOutput={engineOutput}
        presets={buildCorrelacaoChartPresets(
          method,
          engineOutput.outlierFlags.some(Boolean),
        )}
        defaultPresetId={getDefaultCorrelacaoChartPreset(method)}
        preferenceScopeId={`correlacao-${method}`}
        annotations={CORRELACAO_CHART_ANNOTATIONS}
        interpretation={interpretation}
        exportFilename="correlacao-lacirstat.png"
        actions={<ClearDataButton onCleared={handleClearData} />}
      />
    );
  }, [confirmedDataset, loadedInput, method, alpha, researchQuestion]);

  return (
    <FlowSteps
      active={activeStep}
      canAdvance={canAdvance}
      dados={
        <div className="space-y-3">
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
          <CorrelacaoConfigPanel
            loadedInput={loadedInput}
            method={method}
            onMethodChange={handleMethodChange}
            alpha={alpha}
            onAlphaChange={setAlpha}
            researchQuestion={researchQuestion}
            onResearchQuestionChange={setResearchQuestion}
            showSoftReset={showSoftReset}
            onConfirm={handleConfigureConfirm}
            document={analysisTable.table ?? undefined} testId="correlacao"
            onDocumentChange={analysisTable.setDocument}
            importWarnings={analysisTable.importWarnings}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Cole os dados acima para continuar.</p>
        )
      }
      resultados={
        resultsContent ?? (
          <p className="text-sm text-muted-foreground">
            Confirme a tabela para ver métricas, gráfico e interpretação.
          </p>
        )
      }
    />
  );
}
