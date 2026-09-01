import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { ResultsPanelWithCustomizer } from '@/shared/charts/ResultsPanelWithCustomizer';
import { deriveRecognizedColumnsFromTabular } from '@/shared/data-input/recognizedColumnsFromTabular';
import type { TemporalMode } from '@/shared/data-input/temporalPeriods';
import { useAnalysisTable } from '@/shared/data-input/useAnalysisTable';
import { FlowSteps, type FlowStep } from '@/shared/flow/FlowSteps';
import { useSession } from '@/shared/session/SessionProvider';
import { ClearDataButton } from '@/routes/estatistica/ClearDataButton';
import { TabularInputPanel } from '@/routes/estatistica/TabularInputPanel';
import {
  PraisWinstenConfigPanel,
  PraisWinstenValidationAlert,
  type PraisWinstenLoadedInput,
} from './PraisWinstenConfigPanel';
import {
  exampleText,
  TABULAR_OPTIONS,
} from './praisConfig';
import {
  buildPraisTrendPresets,
  getDefaultPraisPresetId,
  PRAIS_RESIDUAL_ANNOTATIONS,
  PRAIS_TREND_ANNOTATIONS,
  praisResidualPresets,
} from './praisCharts';
import {
  buildDatasetFromConfirmed,
  buildMetrics,
  runAnalysis,
  validateSeriesIssues,
} from './praisEngine';
import { buildPraisInterpretation } from './praisInterpretation';

interface ConfirmedDataset {
  headers: string[];
  rows: string[][];
  sourceLabel: string;
  recognizedColumns: Record<string, number>;
}

function initialLoadedFromSession(
  sessionDataset: ReturnType<typeof useSession>['dataset'],
): PraisWinstenLoadedInput | null {
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

export function PraisWinstenTest() {
  const { dataset: sessionDataset } = useSession();
  const analysisTable = useAnalysisTable('prais-winsten', { tabularOptions: TABULAR_OPTIONS });
  const tabular = analysisTable.tabular;

  const [activeStep, setActiveStep] = useState<FlowStep>(() => initialStepFromSession(sessionDataset));
  const [loadedInput, setLoadedInput] = useState<PraisWinstenLoadedInput | null>(() =>
    initialLoadedFromSession(sessionDataset),
  );
  const [confirmedDataset, setConfirmedDataset] = useState<ConfirmedDataset | null>(null);
  const [alpha, setAlpha] = useState<AlphaValue>('0.05');
  const [temporalMode, setTemporalMode] = useState<TemporalMode>('auto');
  const [chartTab, setChartTab] = useState<'trend' | 'residual'>('trend');
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

  function handleTemporalModeChange(mode: TemporalMode) {
    setTemporalMode(mode);
    if (confirmedDataset) setShowSoftReset(true);
    setConfirmedDataset(null);
    setActiveStep('configurar');
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

    const dataset = buildDatasetFromConfirmed({
      headers: confirmedDataset.headers,
      rows: confirmedDataset.rows,
      recognizedColumns: confirmedDataset.recognizedColumns,
      temporalMode,
    });

    const issues = validateSeriesIssues(dataset);
    if (issues.some((issue) => issue.severity === 'error')) {
      return <PraisWinstenValidationAlert issues={issues} />;
    }

    const output = runAnalysis(dataset);
    const alphaNumber = Number(alpha);
    const metrics = buildMetrics(output.model, dataset);
    const interpretation = buildPraisInterpretation(output, alphaNumber);

    const panelProps = {
      metrics,
      engineOutput: output,
      interpretation,
      exportFilename: 'prais-winsten-lacirstat.png' as const,
      actions: <ClearDataButton onCleared={handleClearData} />,
    };

    return (
      <div className="space-y-4">
        <Tabs value={chartTab} onValueChange={(value) => setChartTab(value as 'trend' | 'residual')}>
          <TabsList aria-label="Gráficos Prais-Winsten">
            <TabsTrigger value="trend">Tendência</TabsTrigger>
            <TabsTrigger value="residual">Resíduos</TabsTrigger>
          </TabsList>
          <p className="mt-3 text-sm text-muted-foreground">
            As opções abaixo afetam o gráfico selecionado.
          </p>
          <PraisWinstenValidationAlert issues={issues} />
          <TabsContent value="trend" className="mt-4">
            <ResultsPanelWithCustomizer
              key="trend"
              title="Prais-Winsten: resultados"
              presets={buildPraisTrendPresets(output.model.scale === 'log')}
              defaultPresetId={getDefaultPraisPresetId('trend')}
              preferenceScopeId="prais-winsten-trend"
              annotations={PRAIS_TREND_ANNOTATIONS}
              {...panelProps}
            />
          </TabsContent>
          <TabsContent value="residual" className="mt-4">
            <ResultsPanelWithCustomizer
              key="residual"
              title="Prais-Winsten: resíduos"
              presets={praisResidualPresets}
              defaultPresetId={getDefaultPraisPresetId('residual')}
              preferenceScopeId="prais-winsten-residual"
              annotations={PRAIS_RESIDUAL_ANNOTATIONS}
              {...panelProps}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }, [confirmedDataset, loadedInput, alpha, chartTab, temporalMode]);

  const resultsBlocked = resultsContent?.type === PraisWinstenValidationAlert;

  return (
    <FlowSteps
      active={activeStep}
      canAdvance={canAdvance}
      resultadosAriaLabel={resultsBlocked ? null : undefined}
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
          <PraisWinstenConfigPanel
            loadedInput={loadedInput}
            alpha={alpha}
            onAlphaChange={setAlpha}
            temporalMode={temporalMode}
            onTemporalModeChange={handleTemporalModeChange}
            showSoftReset={showSoftReset}
            onConfirm={handleConfigureConfirm}
            document={analysisTable.table ?? undefined} testId="prais-winsten"
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
            Confirme a tabela em Configurar para ver métricas, gráfico e interpretação.
          </p>
        )
      }
    />
  );
}
