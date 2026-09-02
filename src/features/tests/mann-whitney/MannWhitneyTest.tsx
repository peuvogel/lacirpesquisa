import { useEffect, useMemo, useRef, useState } from 'react';
import type { AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { ClearDataButton } from '@/routes/estatistica/ClearDataButton';
import { TabularInputPanel } from '@/routes/estatistica/TabularInputPanel';
import { ResultsPanelWithCustomizer } from '@/shared/charts/ResultsPanelWithCustomizer';
import { deriveRecognizedColumnsFromTabular } from '@/shared/data-input/recognizedColumnsFromTabular';
import { useAnalysisTable } from '@/shared/data-input/useAnalysisTable';
import { prepareGroupedSamples } from '@/shared/data-input/groupedSamples';
import type { TableDocument } from '@/shared/data-input/tableDocument';
import { FlowSteps, type FlowStep } from '@/shared/flow/FlowSteps';
import { useSession } from '@/shared/session/SessionProvider';
import {
  MannWhitneyConfigPanel,
  MannWhitneyIssueList,
  MannWhitneyValidationAlert,
  type MannWhitneyLoadedInput,
} from './MannWhitneyConfigPanel';
import {
  exampleText,
  getMannWhitneyTabularOptions,
  LONG_TABULAR_OPTIONS,
  type MannWhitneyFormat,
} from './mannWhitneyConfig';
import {
  MANN_WHITNEY_CHART_ANNOTATIONS,
  mannWhitneyChartPresets,
} from './mannWhitneyCharts';
import {
  buildDatasetFromPrepared,
  buildMetrics,
  runAnalysis,
  toEngineOutput,
  validateDatasetIssues,
} from './mannWhitneyEngine';
import { buildMannWhitneyInterpretation } from './mannWhitneyInterpretation';

interface ConfirmedDataset {
  document: TableDocument;
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
  sourceLabel: string;
}

const LONG_GROUP_HEADERS = new Set(
  ['grupo', ...(LONG_TABULAR_OPTIONS.aliases?.grupo ?? [])]
    .map((header) => header.trim().toLocaleLowerCase('pt-BR').replace(/[_-]+/g, ' ')),
);

function inferMannWhitneyFormat(document: TableDocument): MannWhitneyFormat {
  const columns = document.columns.filter((column) => column.type !== 'ignorar');
  if (columns.length !== 2) return 'long';
  const hasNamedGroupColumn = columns.some((column) => (
    LONG_GROUP_HEADERS.has(column.name.trim().toLocaleLowerCase('pt-BR').replace(/[_-]+/g, ' '))
  ));
  if (hasNamedGroupColumn) return 'long';
  return columns.every((column) => column.type === 'numerica') ? 'wide' : 'long';
}

function initialLoadedFromSession(
  dataset: ReturnType<typeof useSession>['dataset'],
  format: MannWhitneyFormat,
): MannWhitneyLoadedInput | null {
  if (!dataset) return null;
  const options = getMannWhitneyTabularOptions(format);
  return {
    headers: dataset.headers,
    rows: dataset.rows,
    recognizedColumns: deriveRecognizedColumnsFromTabular(dataset.headers, dataset.rows, options),
    sourceLabel: dataset.sourceLabel,
  };
}

export function MannWhitneyTest() {
  const { dataset: sessionDataset } = useSession();
  const [format, setFormat] = useState<MannWhitneyFormat>('long');
  const tabularOptions = getMannWhitneyTabularOptions(format);
  const analysisTable = useAnalysisTable('mann-whitney', { tabularOptions });
  const tabular = analysisTable.tabular;
  const [activeStep, setActiveStep] = useState<FlowStep>(() => sessionDataset ? 'configurar' : 'dados');
  const [loadedInput, setLoadedInput] = useState<MannWhitneyLoadedInput | null>(() => initialLoadedFromSession(sessionDataset, 'long'));
  const [confirmedDataset, setConfirmedDataset] = useState<ConfirmedDataset | null>(null);
  const [alpha, setAlpha] = useState<AlphaValue>('0.05');
  const [showSoftReset, setShowSoftReset] = useState(false);
  const [independenceConfirmed, setIndependenceConfirmed] = useState(false);
  const formatTableIdRef = useRef<string | null>(null);

  useEffect(() => {
    const table = analysisTable.table;
    if (!table) {
      formatTableIdRef.current = null;
      return;
    }
    if (formatTableIdRef.current === table.id) return;
    formatTableIdRef.current = table.id;
    setFormat(inferMannWhitneyFormat(table));
  }, [analysisTable.table]);

  useEffect(() => {
    if (!analysisTable.loadedInput) {
      setLoadedInput(null);
      setActiveStep('dados');
      return;
    }
    setLoadedInput(analysisTable.loadedInput);
    setActiveStep((step) => step === 'dados' ? 'configurar' : step);
  }, [analysisTable.loadedInput]);

  useEffect(() => {
    setIndependenceConfirmed(false);
  }, [analysisTable.table?.id]);

  useEffect(() => {
    if (analysisTable.confirmed || !confirmedDataset) return;
    setConfirmedDataset(null);
    setShowSoftReset(true);
    setIndependenceConfirmed(false);
    setActiveStep((step) => (step === 'resultados' ? 'configurar' : step));
  }, [analysisTable.confirmed, confirmedDataset]);

  function handleUseExample() {
    analysisTable.useExample(exampleText);
  }

  function handleConfirm(confirmed: {
    headers: string[];
    rows: string[][];
    recognizedColumns: Record<string, number>;
  }) {
    const next = analysisTable.confirm();
    if (!next) return;
    setConfirmedDataset(next);
    setShowSoftReset(false);
    setActiveStep('resultados');
  }

  function handleFormatChange(nextFormat: MannWhitneyFormat) {
    if (nextFormat === format) return;
    if (confirmedDataset) {
      setConfirmedDataset(null);
      setShowSoftReset(true);
      setActiveStep('configurar');
    }
    setFormat(nextFormat);
  }

  function handleRoleAdjust() {
    if (!confirmedDataset) return;
    setConfirmedDataset(null);
    setShowSoftReset(true);
    setIndependenceConfirmed(false);
    setActiveStep('configurar');
  }

  function handleClearData() {
    analysisTable.requestClear(() => {
      setLoadedInput(null);
      setConfirmedDataset(null);
      setShowSoftReset(false);
      setIndependenceConfirmed(false);
      setActiveStep('dados');
    });
  }

  const canAdvance = useMemo(() => ({
    dados: true,
    configurar: Boolean(loadedInput),
    resultados: Boolean(confirmedDataset),
  }), [loadedInput, confirmedDataset]);

  const preparation = useMemo(() => (
    analysisTable.table
      ? prepareGroupedSamples(
        analysisTable.table,
        'mann-whitney',
        format,
        analysisTable.recognizedColumns,
      )
      : null
  ), [analysisTable.recognizedColumns, analysisTable.table, format]);

  const resultsContent = useMemo(() => {
    if (!confirmedDataset || !loadedInput) return null;
    const prepared = prepareGroupedSamples(
      confirmedDataset.document,
      'mann-whitney',
      format,
      confirmedDataset.recognizedColumns,
    );
    const outcomeIndex = confirmedDataset.recognizedColumns.desfecho;
    const groupIndex = confirmedDataset.recognizedColumns.grupo;
    const dataset = buildDatasetFromPrepared(prepared, {
      outcome: format === 'wide'
        ? prepared.groups.map((group) => group.label).join(' / ') || 'valores'
        : confirmedDataset.headers[outcomeIndex] || 'desfecho',
      group: format === 'wide'
        ? 'colunas separadas'
        : confirmedDataset.headers[groupIndex] || 'grupo',
    });
    const issues = validateDatasetIssues(dataset);
    const blocking = issues.filter((issue) => issue.severity === 'error');
    if (blocking.length > 0) return <MannWhitneyIssueList issues={issues} />;
    let result;
    try {
      result = runAnalysis(dataset);
    } catch {
      return (
        <MannWhitneyValidationAlert message="O cálculo não pôde ser concluído com estes dados. Revise os grupos, os valores e tente novamente." />
      );
    }
    const output = toEngineOutput(dataset, result);
    const interpretation = buildMannWhitneyInterpretation(result, Number(alpha), dataset.labels);
    return (
      <ResultsPanelWithCustomizer
        title="Mann–Whitney: resultados"
        metrics={buildMetrics(result, dataset.labels)}
        engineOutput={output}
        presets={mannWhitneyChartPresets}
        defaultPresetId="rank-dot"
        preferenceScopeId="mann-whitney"
        annotations={MANN_WHITNEY_CHART_ANNOTATIONS}
        interpretation={interpretation}
        exportFilename="mann-whitney-lacirstat.png"
        actions={<ClearDataButton onCleared={handleClearData} />}
      />
    );
  }, [confirmedDataset, loadedInput, alpha, format]);

  return (
    <FlowSteps
      active={activeStep}
      canAdvance={canAdvance}
      dados={(
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
      )}
      configurar={loadedInput ? (
        <MannWhitneyConfigPanel
          loadedInput={loadedInput}
          alpha={alpha}
          onAlphaChange={setAlpha}
          showSoftReset={showSoftReset}
          format={format}
          onFormatChange={handleFormatChange}
          preparation={preparation}
          independenceConfirmed={independenceConfirmed}
          onIndependenceConfirmedChange={setIndependenceConfirmed}
          onRoleAdjust={handleRoleAdjust}
          onConfirm={handleConfirm}
          document={analysisTable.table ?? undefined}
          testId="mann-whitney"
          onDocumentChange={analysisTable.setDocument}
          importWarnings={analysisTable.importWarnings}
        />
      ) : <p className="text-sm text-muted-foreground">Carregue os dados para continuar.</p>}
      resultados={resultsContent ?? (
        <p className="text-sm text-muted-foreground">Confirme a tabela para ver U, efeito e gráfico de postos.</p>
      )}
    />
  );
}
