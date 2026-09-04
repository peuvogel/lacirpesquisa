import { useEffect, useMemo, useState, useRef } from 'react';
import { AssumptionNudgeInfo } from '@/features/tests/shared/AssumptionNudgeInfo';
import { parseAlpha, type AlphaValue } from '@/features/tests/shared/alpha';
import { ResultsPanelWithCustomizer } from '@/shared/charts/ResultsPanelWithCustomizer';
import { deriveRecognizedColumnsFromTabular } from '@/shared/data-input/recognizedColumnsFromTabular';
import { useAnalysisTable } from '@/shared/data-input/useAnalysisTable';
import { FlowSteps, type FlowStep } from '@/shared/flow/FlowSteps';
import { fmtNumber, fmtP, fmtSigned } from '@/shared/format';
import { useStatisticsSession } from '@/shared/session/StatisticsSessionProvider';
import type { PairwiseRow } from '@/shared/stats/statsEngine';
import { ClearDataButton } from '@/routes/estatistica/ClearDataButton';
import { RevealOnScroll } from '@/shared/flow/RevealOnScroll';
import { TabularInputPanel } from '@/routes/estatistica/TabularInputPanel';
import {
  AnovaConfigPanel,
  AnovaValidationAlert,
  type AnovaLoadedInput,
} from './AnovaConfigPanel';
import {
  exampleText,
  TABULAR_OPTIONS,
} from './anovaConfig';
import {
  ANOVA_CHART_ANNOTATIONS,
  buildAnovaChartPresetsForOutput,
  getDefaultAnovaChartPreset,
} from './anovaCharts';
import {
  buildDatasetFromConfirmed,
  buildMetrics,
  runAnalysis,
  toEngineOutput,
  validateDataset,
} from './anovaEngine';
import { buildAnovaInterpretation } from './anovaInterpretation';

interface ConfirmedDataset {
  headers: string[];
  rows: string[][];
  sourceLabel: string;
  recognizedColumns: Record<string, number>;
}

export interface AnovaTukeyTestProps {
  onNavigateTest?: (testId: string, recognizedColumns?: Record<string, number>) => void;
}

function initialLoadedFromSession(
  sessionDataset: ReturnType<typeof useStatisticsSession>['dataset'],
): AnovaLoadedInput | null {
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

function formatCi(ci: [number, number] | undefined): string {
  if (!ci || !ci.every(Number.isFinite)) return 'n/d';
  return `${fmtSigned(ci[0], 2)} a ${fmtSigned(ci[1], 2)}`;
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
            <th className="px-3 py-2 text-left font-bold text-foreground">Estatística</th>
            <th className="px-3 py-2 text-left font-bold text-foreground">p ajustado</th>
            <th className="px-3 py-2 text-left font-bold text-foreground">IC95%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.contrast} className="border-b border-border/60">
              <td className="px-3 py-2 text-foreground">{row.contrast}</td>
              <td className="px-3 py-2 text-foreground">{fmtNumber(row.statistic, 3)}</td>
              <td className="px-3 py-2 text-foreground">{fmtP(row.pAdj)}</td>
              <td className="px-3 py-2 text-foreground">{formatCi(row.ci)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AnovaTukeyTest({ onNavigateTest }: AnovaTukeyTestProps) {
  const { dataset: sessionDataset } = useStatisticsSession();
  const analysisTable = useAnalysisTable('anova-tukey', { tabularOptions: TABULAR_OPTIONS });
  const tabular = analysisTable.tabular;

  const [activeStep, setActiveStep] = useState<FlowStep>(() => initialStepFromSession(sessionDataset));
  const [loadedInput, setLoadedInput] = useState<AnovaLoadedInput | null>(() =>
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
    if (testId !== 'kruskal-dunn') return;
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
    const dataset = buildDatasetFromConfirmed({
      headers: confirmedDataset.headers,
      rows: confirmedDataset.rows,
      recognizedColumns: confirmedDataset.recognizedColumns,
    });
    const validationErrors = validateDataset(dataset);
    if (validationErrors.length) {
      return <AnovaValidationAlert message={validationErrors[0]} />;
    }

    const result = runAnalysis(dataset);
    const engineOutput = toEngineOutput(dataset, result);
    const metrics = buildMetrics(result, dataset);
    const interpretation = buildAnovaInterpretation(
      result,
      alphaNumber,
      dataset.headers,
      dataset.groupOrder.length,
    );
    const chartPresets = buildAnovaChartPresetsForOutput(engineOutput);

    return (
      <div className="space-y-6">
        {/* A tabela par a par vem antes do painel e é alta: entra na rolagem
            como qualquer outro bloco de resultado. */}
        <RevealOnScroll>
        <section className="space-y-3" aria-labelledby="anova-pairwise-heading">
          {/* Os pressupostos moram no "i" do cabeçalho: como tarja, eles
              empurravam a tabela par a par para fora da tela. */}
          <div className="flex items-center gap-2">
            <h2 id="anova-pairwise-heading" className="text-lg font-bold text-foreground">
              Comparações par a par
            </h2>
            <AssumptionNudgeInfo
              nudges={engineOutput.nudges}
              onNavigateTest={handleCrossTestHandoff}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Pós-hoc Tukey HSD, ordenado por p ajustado crescente.
          </p>
          <PairwiseResultsTable rows={engineOutput.pairwise} />
        </section>
        </RevealOnScroll>
        <ResultsPanelWithCustomizer
          title="Resultados"
          metrics={metrics}
          engineOutput={engineOutput}
          presets={chartPresets}
          defaultPresetId={getDefaultAnovaChartPreset()}
          preferenceScopeId="anova-tukey"
          annotations={ANOVA_CHART_ANNOTATIONS}
          interpretation={interpretation}
          exportFilename="anova-tukey-lacirstat.png"
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
          <AnovaConfigPanel
            loadedInput={loadedInput}
            alpha={alpha}
            onAlphaChange={setAlpha}
            showSoftReset={showSoftReset}
            onRoleAdjust={handleRoleAdjust}
            onConfirm={handleConfigureConfirm}
            document={analysisTable.table ?? undefined} testId="anova-tukey"
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
