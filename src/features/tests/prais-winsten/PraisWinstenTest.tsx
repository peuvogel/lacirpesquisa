import { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  PraisWinstenConfigPanel,
  PraisWinstenValidationAlert,
  type PraisWinstenLoadedInput,
} from './PraisWinstenConfigPanel';
import {
  defaultQuestion,
  exampleText,
  MAX_RESEARCH_QUESTION_LENGTH,
  TABULAR_OPTIONS,
} from './praisConfig';
import {
  getDefaultPraisPresetId,
  PRAIS_RESIDUAL_ANNOTATIONS,
  PRAIS_TREND_ANNOTATIONS,
  praisResidualPresets,
  praisTrendPresets,
} from './praisCharts';
import {
  buildDatasetFromConfirmed,
  buildMetrics,
  runAnalysis,
  validateSeries,
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
  const { dataset: sessionDataset, setDataset } = useSession();
  const tabular = useTabularInput(TABULAR_OPTIONS);
  const sourceLabelRef = useRef('colado');

  const [activeStep, setActiveStep] = useState<FlowStep>(() => initialStepFromSession(sessionDataset));
  const [loadedInput, setLoadedInput] = useState<PraisWinstenLoadedInput | null>(() =>
    initialLoadedFromSession(sessionDataset),
  );
  const [confirmedDataset, setConfirmedDataset] = useState<ConfirmedDataset | null>(null);
  const [alpha, setAlpha] = useState<AlphaValue>('0.05');
  const [researchQuestion, setResearchQuestion] = useState(defaultQuestion);
  const [chartTab, setChartTab] = useState<'trend' | 'residual'>('trend');

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

    const dataset = buildDatasetFromConfirmed({
      headers: confirmedDataset.headers,
      rows: confirmedDataset.rows,
      recognizedColumns: confirmedDataset.recognizedColumns,
    });

    const validationErrors = validateSeries(dataset);
    if (validationErrors.length) {
      return <PraisWinstenValidationAlert message={validationErrors[0]} />;
    }

    const output = runAnalysis(dataset);
    const alphaNumber = Number(alpha);
    const metrics = buildMetrics(output.model, dataset);
    const interpretation = buildPraisInterpretation(
      output,
      alphaNumber,
      researchQuestion.trim().slice(0, MAX_RESEARCH_QUESTION_LENGTH),
    );

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
          <TabsContent value="trend" className="mt-4">
            <ResultsPanelWithCustomizer
              key="trend"
              title="Prais-Winsten — resultados"
              presets={praisTrendPresets}
              defaultPresetId={getDefaultPraisPresetId('trend')}
              annotations={PRAIS_TREND_ANNOTATIONS}
              {...panelProps}
            />
          </TabsContent>
          <TabsContent value="residual" className="mt-4">
            <ResultsPanelWithCustomizer
              key="residual"
              title="Prais-Winsten — resíduos"
              presets={praisResidualPresets}
              defaultPresetId={getDefaultPraisPresetId('residual')}
              annotations={PRAIS_RESIDUAL_ANNOTATIONS}
              {...panelProps}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }, [confirmedDataset, loadedInput, alpha, researchQuestion, chartTab]);

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
          <PraisWinstenConfigPanel
            loadedInput={loadedInput}
            alpha={alpha}
            onAlphaChange={setAlpha}
            researchQuestion={researchQuestion}
            onResearchQuestionChange={setResearchQuestion}
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
