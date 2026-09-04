import { useEffect, useMemo, useState, useRef } from 'react';
import { parseAlpha, type AlphaValue } from '@/features/tests/shared/alpha';
import { ResultsPanelWithCustomizer } from '@/shared/charts/ResultsPanelWithCustomizer';
import { deriveRecognizedColumnsFromTabular } from '@/shared/data-input/recognizedColumnsFromTabular';
import { useAnalysisTable } from '@/shared/data-input/useAnalysisTable';
import { FlowSteps, type FlowStep } from '@/shared/flow/FlowSteps';
import { useStatisticsSession } from '@/shared/session/StatisticsSessionProvider';
import { ClearDataButton } from '@/routes/estatistica/ClearDataButton';
import { TabularInputPanel } from '@/routes/estatistica/TabularInputPanel';
import {
  CorrelacaoConfigPanel,
  CorrelacaoValidationAlert,
  type CorrelacaoLoadedInput,
} from './CorrelacaoConfigPanel';
import {
  exampleText,
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
  sessionDataset: ReturnType<typeof useStatisticsSession>['dataset'],
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

function initialStepFromSession(
  sessionDataset: ReturnType<typeof useStatisticsSession>['dataset'],
): FlowStep {
  return sessionDataset ? 'configurar' : 'dados';
}

export function CorrelacaoTest() {
  const { dataset: sessionDataset } = useStatisticsSession();
  const analysisTable = useAnalysisTable('correlacao', { tabularOptions: TABULAR_OPTIONS });
  const tabular = analysisTable.tabular;

  const [activeStep, setActiveStep] = useState<FlowStep>(() => initialStepFromSession(sessionDataset));
  const [loadedInput, setLoadedInput] = useState<CorrelacaoLoadedInput | null>(() =>
    initialLoadedFromSession(sessionDataset),
  );
  const [confirmedDataset, setConfirmedDataset] = useState<ConfirmedDataset | null>(null);
  const [method, setMethod] = useState<CorrelacaoMethod>('pearson');
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
    setActiveStep((step) => (step === 'dados' ? 'configurar' : step));
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

    const alphaNumber = alpha;
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
    const interpretation = buildCorrelacaoInterpretation(engineOutput, alphaNumber);

    return (
      <ResultsPanelWithCustomizer
        key={`correlacao-${method}`}
        title="Resultados"
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
  }, [confirmedDataset, loadedInput, method, alpha]);

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
            showSoftReset={showSoftReset}
            onConfirm={handleConfigureConfirm}
            document={analysisTable.table ?? undefined} testId="correlacao"
            onDocumentChange={analysisTable.setDocument}
            onUndo={analysisTable.undo}
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
