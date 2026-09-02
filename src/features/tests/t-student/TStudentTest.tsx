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
  TStudentConfigPanel,
  TStudentValidationAlert,
  type TStudentLoadedInput,
} from './TStudentConfigPanel';
import {
  exampleText,
  TABULAR_OPTIONS,
  type TStudentMode,
} from './tStudentConfig';
import {
  buildTStudentChartPresets,
  getDefaultTStudentChartPreset,
  T_STUDENT_CHART_ANNOTATIONS,
} from './tStudentCharts';
import {
  buildDatasetFromConfirmed,
  buildMetrics,
  runAnalysis,
  toEngineOutput,
  validateSampleSize,
} from './tStudentEngine';
import { buildTStudentInterpretation } from './tStudentInterpretation';

interface ConfirmedDataset {
  headers: string[];
  rows: string[][];
  sourceLabel: string;
  recognizedColumns: Record<string, number>;
}

function initialLoadedFromSession(
  sessionDataset: ReturnType<typeof useSession>['dataset'],
): TStudentLoadedInput | null {
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

export function TStudentTest() {
  const { dataset: sessionDataset } = useSession();
  const analysisTable = useAnalysisTable('t-student', { tabularOptions: TABULAR_OPTIONS });
  const tabular = analysisTable.tabular;

  const [activeStep, setActiveStep] = useState<FlowStep>(() => initialStepFromSession(sessionDataset));
  const [loadedInput, setLoadedInput] = useState<TStudentLoadedInput | null>(() =>
    initialLoadedFromSession(sessionDataset),
  );
  const [confirmedDataset, setConfirmedDataset] = useState<ConfirmedDataset | null>(null);
  const [mode, setMode] = useState<TStudentMode>('independent');
  const [alpha, setAlpha] = useState<AlphaValue>('0.05');
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

  function handleModeChange(nextMode: TStudentMode) {
    if (nextMode === mode) return;
    if (confirmedDataset) {
      setConfirmedDataset(null);
      setShowSoftReset(true);
      if (activeStep === 'resultados') setActiveStep('configurar');
    }
    setMode(nextMode);
  }

  function handleConfigureConfirm(confirmed: {
    headers: string[];
    rows: string[][];
    recognizedColumns: Record<string, number>;
  }) {
    const sourceLabel = loadedInput?.sourceLabel ?? 'colado';
    const nextDataset = analysisTable.confirm() ?? { ...confirmed, sourceLabel };
    setConfirmedDataset(nextDataset);
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
      mode,
    });
    const validationErrors = validateSampleSize(mode, dataset);
    if (validationErrors.length) {
      return <TStudentValidationAlert message={validationErrors[0]!} />;
    }

    const result = runAnalysis(mode, dataset);
    const engineOutput = toEngineOutput(dataset, result);
    const metrics = buildMetrics(engineOutput.result, engineOutput.labels);
    const interpretation = buildTStudentInterpretation(engineOutput.result, alphaNumber, engineOutput.labels);

    return (
      <ResultsPanelWithCustomizer
        title="t de Student: resultados"
        metrics={metrics}
        engineOutput={engineOutput}
        presets={buildTStudentChartPresets(mode)}
        defaultPresetId={getDefaultTStudentChartPreset(mode, engineOutput.result, engineOutput.labels)}
        preferenceScopeId={`t-student-${mode}`}
        annotations={T_STUDENT_CHART_ANNOTATIONS}
        interpretation={interpretation}
        exportFilename="t-student-lacirstat.png"
        actions={<ClearDataButton onCleared={handleClearData} />}
      />
    );
  }, [confirmedDataset, loadedInput, mode, alpha]);

  return (
    <FlowSteps
      active={activeStep}
      canAdvance={canAdvance}
      dados={
        <div className="space-y-3">
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
          <TStudentConfigPanel
            loadedInput={loadedInput}
            mode={mode}
            onModeChange={handleModeChange}
            alpha={alpha}
            onAlphaChange={setAlpha}
            showSoftReset={showSoftReset}
            onConfirm={handleConfigureConfirm}
            document={analysisTable.table ?? undefined}
            testId="t-student"
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
