import { useEffect, useMemo, useState, useRef } from 'react';
import { AssumptionNudgeInfo } from '@/features/tests/shared/AssumptionNudgeInfo';
import { parseAlpha, type AlphaValue } from '@/features/tests/shared/alpha';
import { ResultsPanelWithCustomizer } from '@/shared/charts/ResultsPanelWithCustomizer';
import { deriveRecognizedColumnsFromTabular } from '@/shared/data-input/recognizedColumnsFromTabular';
import { useAnalysisTable } from '@/shared/data-input/useAnalysisTable';
import { FlowSteps, type FlowStep } from '@/shared/flow/FlowSteps';
import { fmtNumber, fmtP } from '@/shared/format';
import { useStatisticsSession } from '@/shared/session/StatisticsSessionProvider';
import type { PairwiseRow } from '@/shared/stats/statsEngine';
import { ClearDataButton } from '@/routes/estatistica/ClearDataButton';
import { TabularInputPanel } from '@/routes/estatistica/TabularInputPanel';
import {
  KruskalConfigPanel,
  KruskalValidationAlert,
  type KruskalLoadedInput,
} from './KruskalConfigPanel';
import {
  exampleText,
  TABULAR_OPTIONS,
} from './kruskalConfig';
import {
  KRUSKAL_CHART_ANNOTATIONS,
  buildKruskalChartPresetsForOutput,
  getDefaultKruskalChartPreset,
} from './kruskalCharts';
import {
  buildDatasetFromConfirmed,
  buildMetrics,
  runAnalysis,
  toEngineOutput,
  validateDataset,
} from './kruskalEngine';
import { buildKruskalInterpretation } from './kruskalInterpretation';

interface ConfirmedDataset {
  headers: string[];
  rows: string[][];
  sourceLabel: string;
  recognizedColumns: Record<string, number>;
}

export interface KruskalDunnTestProps {
  onNavigateTest?: (testId: string) => void;
  handoffRecognizedColumns?: Record<string, number>;
}

function initialLoadedFromSession(
  sessionDataset: ReturnType<typeof useStatisticsSession>['dataset'],
  handoffRecognizedColumns?: Record<string, number>,
): KruskalLoadedInput | null {
  if (!sessionDataset) return null;
  return {
    headers: sessionDataset.headers,
    rows: sessionDataset.rows,
    recognizedColumns:
      handoffRecognizedColumns ??
      deriveRecognizedColumnsFromTabular(
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

function PairwiseResultsTable({ rows }: { rows: PairwiseRow[] }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma comparação par a par disponível para estes grupos.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse font-mono text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-3 py-2 text-left font-bold text-foreground">Contraste</th>
            <th className="px-3 py-2 text-left font-bold text-foreground">Estatística (z)</th>
            <th className="px-3 py-2 text-left font-bold text-foreground">p ajustado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.contrast} className="border-b border-border/60">
              <td className="px-3 py-2 text-foreground">{row.contrast}</td>
              <td className="px-3 py-2 text-foreground">{fmtNumber(row.statistic, 3)}</td>
              <td className="px-3 py-2 text-foreground">{fmtP(row.pAdj)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KruskalDunnTest({
  onNavigateTest,
  handoffRecognizedColumns,
}: KruskalDunnTestProps) {
  const { dataset: sessionDataset } = useStatisticsSession();
  const analysisTable = useAnalysisTable('kruskal-dunn', { tabularOptions: TABULAR_OPTIONS, handoffRecognizedColumns });
  const tabular = analysisTable.tabular;

  const [activeStep, setActiveStep] = useState<FlowStep>(() => initialStepFromSession(sessionDataset));
  const [loadedInput, setLoadedInput] = useState<KruskalLoadedInput | null>(() =>
    initialLoadedFromSession(sessionDataset, handoffRecognizedColumns),
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
    onNavigateTest?.(testId);
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
    });
    const validationErrors = validateDataset(dataset);
    if (validationErrors.length) {
      return <KruskalValidationAlert message={validationErrors[0]} />;
    }

    const result = runAnalysis(dataset);
    const engineOutput = toEngineOutput(dataset, result);
    const metrics = buildMetrics(result, dataset);
    const interpretation = buildKruskalInterpretation(
      result,
      alphaNumber,
      dataset.headers,
      dataset.groupOrder.length,
    );
    const chartPresets = buildKruskalChartPresetsForOutput(engineOutput);

    return (
      <div className="space-y-6">
        <section className="space-y-3" aria-labelledby="kruskal-pairwise-heading">
          {/* Os pressupostos moram no "i" do cabeçalho: como tarja, eles
              empurravam a tabela par a par para fora da tela. */}
          <div className="flex items-center gap-2">
            <h2 id="kruskal-pairwise-heading" className="text-lg font-bold text-foreground">
              Comparações par a par
            </h2>
            <AssumptionNudgeInfo
              nudges={engineOutput.nudges}
              onNavigateTest={handleCrossTestHandoff}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Pós-hoc Dunn (Holm), ordenado por p ajustado crescente.
          </p>
          <PairwiseResultsTable rows={engineOutput.pairwise} />
        </section>
        <ResultsPanelWithCustomizer
          title="Resultados"
          metrics={metrics}
          engineOutput={engineOutput}
          presets={chartPresets}
          defaultPresetId={getDefaultKruskalChartPreset()}
          preferenceScopeId="kruskal-dunn"
          annotations={KRUSKAL_CHART_ANNOTATIONS}
          interpretation={interpretation}
          exportFilename="kruskal-dunn-lacirstat.png"
          actions={<ClearDataButton onCleared={handleClearData} />}
        />
      </div>
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
          <KruskalConfigPanel
            loadedInput={loadedInput}
            alpha={alpha}
            onAlphaChange={setAlpha}
            showSoftReset={showSoftReset}
            onRoleAdjust={handleRoleAdjust}
            onConfirm={handleConfigureConfirm}
            document={analysisTable.table ?? undefined} testId="kruskal-dunn"
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
            Confirme a tabela em Configurar para ver métricas, comparações par a par e gráficos.
          </p>
        )
      }
    />
  );
}
