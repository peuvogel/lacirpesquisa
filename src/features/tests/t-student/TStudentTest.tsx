import { useEffect, useMemo, useRef, useState } from 'react';
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
  TStudentConfigPanel,
  TStudentValidationAlert,
  type TStudentLoadedInput,
} from './TStudentConfigPanel';
import {
  exampleText,
  MAX_RESEARCH_QUESTION_LENGTH,
  TABULAR_OPTIONS,
  type TStudentMode,
} from './tStudentConfig';
import {
  getDefaultTStudentChartPreset,
  tStudentChartPresets,
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
  const { dataset: sessionDataset, setDataset } = useSession();
  const tabular = useTabularInput(TABULAR_OPTIONS);
  const sourceLabelRef = useRef('colado');

  const [activeStep, setActiveStep] = useState<FlowStep>(() => initialStepFromSession(sessionDataset));
  const [loadedInput, setLoadedInput] = useState<TStudentLoadedInput | null>(() =>
    initialLoadedFromSession(sessionDataset),
  );
  const [confirmedDataset, setConfirmedDataset] = useState<ConfirmedDataset | null>(null);
  const [mode, setMode] = useState<TStudentMode>('independent');
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
      setActiveStep((step) => (step === 'dados' ? 'configurar' : step));
    }
  }, [tabular.status, tabular.headers, tabular.bodyRows, tabular.recognizedColumns]);

  function handleUseExample() {
    sourceLabelRef.current = 'exemplo';
    tabular.setRawText(exampleText);
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
    const nextDataset: ConfirmedDataset = {
      headers: confirmed.headers,
      rows: confirmed.rows,
      sourceLabel,
      recognizedColumns: confirmed.recognizedColumns,
    };
    setConfirmedDataset(nextDataset);
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
    const interpretation = buildTStudentInterpretation(
      engineOutput.result,
      alphaNumber,
      engineOutput.labels,
      researchQuestion.trim().slice(0, MAX_RESEARCH_QUESTION_LENGTH),
    );

    return (
      <ResultsPanelWithCustomizer
        title="t de Student: resultados"
        metrics={metrics}
        engineOutput={engineOutput}
        presets={tStudentChartPresets}
        defaultPresetId={getDefaultTStudentChartPreset(mode, engineOutput.result, engineOutput.labels)}
        annotations={T_STUDENT_CHART_ANNOTATIONS}
        interpretation={interpretation}
        exportFilename="t-student-lacirstat.png"
        actions={<ClearDataButton onCleared={handleClearData} />}
      />
    );
  }, [confirmedDataset, loadedInput, mode, alpha, researchQuestion]);

  return (
    <FlowSteps
      active={activeStep}
      canAdvance={canAdvance}
      dados={
        <div className="space-y-3">
          <UseExampleButton onClick={handleUseExample} />
          <TabularInputPanel {...tabular} showPreview={false} />
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
            researchQuestion={researchQuestion}
            onResearchQuestionChange={setResearchQuestion}
            showSoftReset={showSoftReset}
            onConfirm={handleConfigureConfirm}
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
