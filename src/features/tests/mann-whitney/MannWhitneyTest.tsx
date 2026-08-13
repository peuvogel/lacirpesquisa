import { useEffect, useMemo, useRef, useState } from 'react';
import type { AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { UseExampleButton } from '@/features/tests/shared/UseExampleButton';
import { ClearDataButton } from '@/routes/estatistica/ClearDataButton';
import { TabularInputPanel } from '@/routes/estatistica/TabularInputPanel';
import { ResultsPanelWithCustomizer } from '@/shared/charts/ResultsPanelWithCustomizer';
import { deriveRecognizedColumnsFromTabular } from '@/shared/data-input/recognizedColumnsFromTabular';
import { useTabularInput } from '@/shared/data-input/useTabularInput';
import { FlowSteps, type FlowStep } from '@/shared/flow/FlowSteps';
import { useSession } from '@/shared/session/SessionProvider';
import {
  MannWhitneyConfigPanel,
  MannWhitneyValidationAlert,
  type MannWhitneyLoadedInput,
} from './MannWhitneyConfigPanel';
import {
  exampleText,
  MAX_RESEARCH_QUESTION_LENGTH,
  TABULAR_OPTIONS,
} from './mannWhitneyConfig';
import {
  MANN_WHITNEY_CHART_ANNOTATIONS,
  mannWhitneyChartPresets,
} from './mannWhitneyCharts';
import {
  buildDatasetFromConfirmed,
  buildMetrics,
  runAnalysis,
  toEngineOutput,
  validateDataset,
} from './mannWhitneyEngine';
import { buildMannWhitneyInterpretation } from './mannWhitneyInterpretation';

interface ConfirmedDataset {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
  sourceLabel: string;
}

function initialLoadedFromSession(dataset: ReturnType<typeof useSession>['dataset']): MannWhitneyLoadedInput | null {
  if (!dataset) return null;
  return {
    headers: dataset.headers,
    rows: dataset.rows,
    recognizedColumns: deriveRecognizedColumnsFromTabular(dataset.headers, dataset.rows, TABULAR_OPTIONS),
    sourceLabel: dataset.sourceLabel,
  };
}

export function MannWhitneyTest() {
  const { dataset: sessionDataset, setDataset } = useSession();
  const tabular = useTabularInput(TABULAR_OPTIONS);
  const sourceLabelRef = useRef('colado');
  const [activeStep, setActiveStep] = useState<FlowStep>(() => sessionDataset ? 'configurar' : 'dados');
  const [loadedInput, setLoadedInput] = useState<MannWhitneyLoadedInput | null>(() => initialLoadedFromSession(sessionDataset));
  const [confirmedDataset, setConfirmedDataset] = useState<ConfirmedDataset | null>(null);
  const [alpha, setAlpha] = useState<AlphaValue>('0.05');
  const [researchQuestion, setResearchQuestion] = useState('');
  const [showSoftReset, setShowSoftReset] = useState(false);
  const [independenceConfirmed, setIndependenceConfirmed] = useState(false);

  useEffect(() => {
    if (tabular.status !== 'loaded') return;
    setLoadedInput({
      headers: tabular.headers,
      rows: tabular.bodyRows,
      recognizedColumns: tabular.recognizedColumns,
      sourceLabel: sourceLabelRef.current,
    });
    setIndependenceConfirmed(false);
    setActiveStep((step) => step === 'dados' ? 'configurar' : step);
  }, [tabular.status, tabular.headers, tabular.bodyRows, tabular.recognizedColumns]);

  function handleUseExample() {
    sourceLabelRef.current = 'exemplo';
    tabular.setRawText(exampleText);
  }

  function handleConfirm(confirmed: {
    headers: string[];
    rows: string[][];
    recognizedColumns: Record<string, number>;
  }) {
    const sourceLabel = loadedInput?.sourceLabel ?? 'colado';
    setConfirmedDataset({ ...confirmed, sourceLabel });
    setShowSoftReset(false);
    setDataset({ ...confirmed, sourceLabel, confirmedAt: Date.now() });
    setActiveStep('resultados');
  }

  function handleRoleAdjust() {
    if (!confirmedDataset) return;
    setConfirmedDataset(null);
    setShowSoftReset(true);
    setIndependenceConfirmed(false);
    setActiveStep('configurar');
  }

  function handleClearData() {
    tabular.reset();
    setLoadedInput(null);
    setConfirmedDataset(null);
    setShowSoftReset(false);
    setIndependenceConfirmed(false);
    setActiveStep('dados');
    sourceLabelRef.current = 'colado';
  }

  const canAdvance = useMemo(() => ({
    dados: true,
    configurar: Boolean(loadedInput),
    resultados: Boolean(confirmedDataset),
  }), [loadedInput, confirmedDataset]);

  const resultsContent = useMemo(() => {
    if (!confirmedDataset || !loadedInput) return null;
    const dataset = buildDatasetFromConfirmed(confirmedDataset);
    const errors = validateDataset(dataset);
    if (errors.length > 0) return <MannWhitneyValidationAlert message={errors[0]!} />;
    const result = runAnalysis(dataset);
    const output = toEngineOutput(dataset, result);
    const interpretation = buildMannWhitneyInterpretation(
      result,
      Number(alpha),
      dataset.labels,
      researchQuestion.trim().slice(0, MAX_RESEARCH_QUESTION_LENGTH),
    );
    return (
      <ResultsPanelWithCustomizer
        title="Mann–Whitney: resultados"
        metrics={buildMetrics(result, dataset.labels)}
        engineOutput={output}
        presets={mannWhitneyChartPresets}
        defaultPresetId="rank-dot"
        annotations={MANN_WHITNEY_CHART_ANNOTATIONS}
        interpretation={interpretation}
        exportFilename="mann-whitney-lacirstat.png"
        actions={<ClearDataButton onCleared={handleClearData} />}
      />
    );
  }, [confirmedDataset, loadedInput, alpha, researchQuestion]);

  return (
    <FlowSteps
      active={activeStep}
      canAdvance={canAdvance}
      dados={(
        <div className="space-y-3">
          <UseExampleButton onClick={handleUseExample} />
          <TabularInputPanel {...tabular} showPreview={false} />
        </div>
      )}
      configurar={loadedInput ? (
        <MannWhitneyConfigPanel
          loadedInput={loadedInput}
          alpha={alpha}
          onAlphaChange={setAlpha}
          researchQuestion={researchQuestion}
          onResearchQuestionChange={setResearchQuestion}
          showSoftReset={showSoftReset}
          independenceConfirmed={independenceConfirmed}
          onIndependenceConfirmedChange={setIndependenceConfirmed}
          onRoleAdjust={handleRoleAdjust}
          onConfirm={handleConfirm}
        />
      ) : <p className="text-sm text-muted-foreground">Carregue os dados para continuar.</p>}
      resultados={resultsContent ?? (
        <p className="text-sm text-muted-foreground">Confirme a tabela para ver U, efeito e gráfico de postos.</p>
      )}
    />
  );
}
