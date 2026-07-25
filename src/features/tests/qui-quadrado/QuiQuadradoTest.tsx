import { useEffect, useMemo, useRef, useState } from 'react';
import { UseExampleButton } from '@/features/tests/shared/UseExampleButton';
import { AssumptionNudgeStrip } from '@/features/tests/shared/AssumptionNudgeStrip';
import type { AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { ResultsPanelWithCustomizer } from '@/shared/charts/ResultsPanelWithCustomizer';
import { deriveRecognizedColumnsFromTabular } from '@/shared/data-input/recognizedColumnsFromTabular';
import { useTabularInput } from '@/shared/data-input/useTabularInput';
import { FlowSteps, type FlowStep } from '@/shared/flow/FlowSteps';
import { useSession } from '@/shared/session/SessionProvider';
import { ClearDataButton } from '@/routes/estatistica/ClearDataButton';
import { TabularInputPanel } from '@/routes/estatistica/TabularInputPanel';
import {
  QuiQuadradoConfigPanel,
  QuiQuadradoValidationAlert,
  type QuiQuadradoLoadedInput,
} from './QuiQuadradoConfigPanel';
import {
  exampleText,
  MAX_RESEARCH_QUESTION_LENGTH,
  TABULAR_OPTIONS,
} from './quiQuadradoConfig';
import {
  getDefaultQuiQuadradoChartPreset,
  quiQuadradoChartPresets,
  QUI_QUADRADO_CHART_ANNOTATIONS,
} from './quiQuadradoCharts';
import {
  buildDatasetFromConfirmed,
  buildMetrics,
  runAnalysis,
  toEngineOutput,
  validateColumnTypes,
  validateDataset,
} from './quiQuadradoEngine';
import { buildQuiQuadradoInterpretation } from './quiQuadradoInterpretation';

interface ConfirmedDataset {
  headers: string[];
  rows: string[][];
  sourceLabel: string;
  recognizedColumns: Record<string, number>;
}

function initialLoadedFromSession(
  sessionDataset: ReturnType<typeof useSession>['dataset'],
): QuiQuadradoLoadedInput | null {
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

export function QuiQuadradoTest() {
  const { dataset: sessionDataset, setDataset } = useSession();
  const tabular = useTabularInput(TABULAR_OPTIONS);
  const sourceLabelRef = useRef('colado');

  const [activeStep, setActiveStep] = useState<FlowStep>(() => initialStepFromSession(sessionDataset));
  const [loadedInput, setLoadedInput] = useState<QuiQuadradoLoadedInput | null>(() =>
    initialLoadedFromSession(sessionDataset),
  );
  const [confirmedDataset, setConfirmedDataset] = useState<ConfirmedDataset | null>(null);
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
    }
  }, [tabular.status, tabular.headers, tabular.bodyRows, tabular.recognizedColumns]);

  function handleUseExample() {
    sourceLabelRef.current = 'exemplo';
    tabular.setRawText(exampleText);
  }

  function handleRoleAdjust() {
    if (!confirmedDataset) return;
    setConfirmedDataset(null);
    setShowSoftReset(true);
    if (activeStep === 'resultados') setActiveStep('configurar');
  }

  function handleConfigureConfirm(confirmed: {
    headers: string[];
    rows: string[][];
    recognizedColumns: Record<string, number>;
  }) {
    const sourceLabel = loadedInput?.sourceLabel ?? 'colado';
    setConfirmedDataset({
      headers: confirmed.headers,
      rows: confirmed.rows,
      sourceLabel,
      recognizedColumns: confirmed.recognizedColumns,
    });
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
    const typeErrors = validateColumnTypes(
      confirmedDataset.headers,
      confirmedDataset.rows,
      confirmedDataset.recognizedColumns,
    );
    if (typeErrors.length) {
      return <QuiQuadradoValidationAlert message={typeErrors[0]} />;
    }

    const dataset = buildDatasetFromConfirmed({
      headers: confirmedDataset.headers,
      rows: confirmedDataset.rows,
      recognizedColumns: confirmedDataset.recognizedColumns,
    });
    const validationErrors = validateDataset(dataset);
    if (validationErrors.length) {
      return <QuiQuadradoValidationAlert message={validationErrors[0]} />;
    }

    const result = runAnalysis(dataset);
    const engineOutput = toEngineOutput(dataset, result);
    const metrics = buildMetrics(result, dataset);
    const interpretation = buildQuiQuadradoInterpretation(
      engineOutput,
      alphaNumber,
      researchQuestion.trim().slice(0, MAX_RESEARCH_QUESTION_LENGTH),
    );

    return (
      <>
        <AssumptionNudgeStrip nudges={engineOutput.nudges} />
        <ResultsPanelWithCustomizer
          title="Qui-quadrado: resultados"
          metrics={metrics}
          engineOutput={engineOutput}
          presets={quiQuadradoChartPresets}
          defaultPresetId={getDefaultQuiQuadradoChartPreset()}
          annotations={QUI_QUADRADO_CHART_ANNOTATIONS}
          interpretation={interpretation}
          exportFilename="qui-quadrado-lacirstat.png"
          actions={<ClearDataButton onCleared={handleClearData} />}
        />
      </>
    );
  }, [confirmedDataset, loadedInput, alpha, researchQuestion]);

  return (
    <FlowSteps
      active={activeStep}
      onStepChange={setActiveStep}
      canAdvance={canAdvance}
      dados={
        <div className="space-y-3">
          <UseExampleButton onClick={handleUseExample} />
          <TabularInputPanel {...tabular} showPreview={false} />
        </div>
      }
      configurar={
        loadedInput ? (
          <QuiQuadradoConfigPanel
            loadedInput={loadedInput}
            alpha={alpha}
            onAlphaChange={setAlpha}
            researchQuestion={researchQuestion}
            onResearchQuestionChange={setResearchQuestion}
            showSoftReset={showSoftReset}
            onRoleAdjust={handleRoleAdjust}
            onConfirm={handleConfigureConfirm}
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
