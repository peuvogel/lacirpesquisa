import { useEffect, useMemo, useRef, useState } from 'react';
import { parseAlpha, type AlphaValue } from '@/features/tests/shared/alpha';
import { ClearDataButton } from '@/routes/estatistica/ClearDataButton';
import { TabularInputPanel } from '@/routes/estatistica/TabularInputPanel';
import { ResultsPanelWithCustomizer } from '@/shared/charts/ResultsPanelWithCustomizer';
import { deriveRecognizedColumnsFromTabular } from '@/shared/data-input/recognizedColumnsFromTabular';
import { useAnalysisTable } from '@/shared/data-input/useAnalysisTable';
import { prepareGroupedSamples } from '@/shared/data-input/groupedSamples';
import {
  clearTableRoleBindings,
  isColumnActive,
  isRowEnabled,
  setTableRoleBinding,
  type TableDocument,
} from '@/shared/data-input/tableDocument';
import { FlowSteps, type FlowStep } from '@/shared/flow/FlowSteps';
import { useStatisticsSession } from '@/shared/session/StatisticsSessionProvider';
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

function isContextHeader(header: string): boolean {
  const normalized = header.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  return /^(?:ano|mes|data|periodo)(?:\b|_)/.test(normalized);
}

function isTotalLabel(label: string): boolean {
  return /^total(?: geral)?$/i.test(label.trim());
}

function inferWideColumns(document: TableDocument) {
  const columns = document.columns.filter(isColumnActive);
  const hasNamedGroupColumn = columns.some((column) => (
    LONG_GROUP_HEADERS.has(column.name.trim().toLocaleLowerCase('pt-BR').replace(/[_-]+/g, ' '))
  ));
  if (hasNamedGroupColumn) return null;
  const samples = columns.filter((column) => !isContextHeader(column.name) && !isTotalLabel(column.name));
  return samples.length === 2 && samples.every((column) => column.type === 'numerica') ? samples : null;
}

function withFormatBindings(document: TableDocument, format: MannWhitneyFormat): TableDocument {
  let next = clearTableRoleBindings(document, 'mann-whitney');
  const samples = format === 'wide' ? inferWideColumns(next) : null;
  if (samples) {
    next = setTableRoleBinding(next, 'mann-whitney', 'grupo_a', samples[0]!.id);
    next = setTableRoleBinding(next, 'mann-whitney', 'grupo_b', samples[1]!.id);
  }
  return next;
}

function prepareSamples(document: TableDocument, format: MannWhitneyFormat, recognizedColumns: Record<string, number>) {
  const contextIndex = format === 'wide'
    ? document.columns.findIndex((column) => isContextHeader(column.name)) : -1;
  if (contextIndex < 0) return prepareGroupedSamples(document, 'mann-whitney', format, recognizedColumns);
  const footerIndex = document.rows.findIndex((row) => /^(?:fonte\s*:|notas?\s*:)/i.test(row[contextIndex]?.trim() ?? '')
    && row.every((cell, index) => index === contextIndex || !cell.trim()));
  const samplesOnly = {
    ...document,
    rowsEnabled: document.rows.map((row, index) => isRowEnabled(document, index)
      && !isTotalLabel(row[contextIndex] ?? '') && (footerIndex < 0 || index < footerIndex)),
  };
  return prepareGroupedSamples(samplesOnly, 'mann-whitney', format, recognizedColumns);
}

function initialLoadedFromSession(
  dataset: ReturnType<typeof useStatisticsSession>['dataset'],
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
  const { dataset: sessionDataset, testSlots } = useStatisticsSession();
  // Lido direto da sessão, não de analysisTable.settings: o formato alimenta as
  // opções tabulares que o próprio hook recebe, então não pode depender dele.
  const [format, setFormatState] = useState<MannWhitneyFormat>(
    () => (testSlots['mann-whitney']?.settings?.format as MannWhitneyFormat) ?? 'long',
  );
  const tabularOptions = getMannWhitneyTabularOptions(format);
  const analysisTable = useAnalysisTable('mann-whitney', { tabularOptions });

  function setFormat(next: MannWhitneyFormat) {
    setFormatState(next);
    analysisTable.setSettings({ format: next });
  }
  const tabular = analysisTable.tabular;
  const [activeStep, setActiveStep] = useState<FlowStep>(() => sessionDataset ? 'configurar' : 'dados');
  const [loadedInput, setLoadedInput] = useState<MannWhitneyLoadedInput | null>(() => initialLoadedFromSession(sessionDataset, 'long'));
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
  const [independenceConfirmed, setIndependenceConfirmedState] = useState(
    () => analysisTable.settings.independenceConfirmed === true,
  );

  function setIndependenceConfirmed(next: boolean) {
    setIndependenceConfirmedState(next);
    analysisTable.setSettings({ independenceConfirmed: next });
  }
  const formatTableIdRef = useRef<string | null>(null);

  useEffect(() => {
    const table = analysisTable.table;
    if (!table) {
      formatTableIdRef.current = null;
      return;
    }
    if (formatTableIdRef.current === table.id) return;
    formatTableIdRef.current = table.id;
    const explicitRoles = Object.keys(table.bindings['mann-whitney'] ?? {});
    const savedFormat = testSlots['mann-whitney']?.settings?.format;
    const nextFormat = explicitRoles.length
      ? savedFormat === 'wide' || savedFormat === 'long' ? savedFormat
        : explicitRoles.some((role) => role === 'grupo_a' || role === 'grupo_b') ? 'wide' : 'long'
      : inferWideColumns(table) ? 'wide' : 'long';
    setFormat(nextFormat);
    if (!explicitRoles.length && nextFormat === 'wide') analysisTable.setDocument(withFormatBindings(table, nextFormat));
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
    if (analysisTable.table) analysisTable.setDocument(withFormatBindings(analysisTable.table, nextFormat));
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
      ? prepareSamples(
        analysisTable.table,
        format,
        analysisTable.recognizedColumns,
      )
      : null
  ), [analysisTable.recognizedColumns, analysisTable.table, format]);

  const resultsContent = useMemo(() => {
    if (!confirmedDataset || !loadedInput) return null;
    const prepared = prepareSamples(
      confirmedDataset.document,
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
    const interpretation = buildMannWhitneyInterpretation(result, alpha, dataset.labels);
    return (
      <ResultsPanelWithCustomizer
        title="Resultados"
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
            onUndo={analysisTable.undo}
          importWarnings={analysisTable.importWarnings}
        />
      ) : <p className="text-sm text-muted-foreground">Carregue os dados para continuar.</p>}
      resultados={resultsContent ?? (
        <p className="text-sm text-muted-foreground">Confirme a tabela para ver U, efeito e gráfico de postos.</p>
      )}
    />
  );
}
