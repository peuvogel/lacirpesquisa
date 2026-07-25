import { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UseExampleButton } from '@/features/tests/shared/UseExampleButton';
import type { AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { ResultsPanelWithCustomizer } from '@/shared/charts/ResultsPanelWithCustomizer';
import { useTabularInput } from '@/shared/data-input/useTabularInput';
import type { DatasusSession } from '@/shared/data-input/useDatasusWizard';
import { FlowSteps, type FlowStep } from '@/shared/flow/FlowSteps';
import { useSession } from '@/shared/session/SessionProvider';
import { ClearDataButton } from '@/routes/estatistica/ClearDataButton';
import { TabularInputPanel } from '@/routes/estatistica/TabularInputPanel';
import { DatasusWizardPanel } from '@/routes/estatistica/datasus/DatasusWizardPanel';
import { datasusNormalizedToTabular } from '@/routes/estatistica/demo/datasusToTabular';
import {
  CorrelacaoConfigPanel,
  CorrelacaoValidationAlert,
  type CorrelacaoLoadedInput,
} from './CorrelacaoConfigPanel';
import { buildDefaultCorrelacaoDatasusKnobs } from './CorrelacaoDatasusKnobs';
import {
  exampleText,
  MAX_RESEARCH_QUESTION_LENGTH,
  TABULAR_OPTIONS,
  type CorrelacaoMethod,
} from './correlacaoConfig';
import {
  correlacaoChartPresets,
  CORRELACAO_CHART_ANNOTATIONS,
  getDefaultCorrelacaoChartPreset,
} from './correlacaoCharts';
import {
  buildDatasetFromConfirmed,
  buildMetrics,
  deriveDatasusDataset,
  toEngineOutput,
  validatePairs,
  type DatasusKnobState,
} from './correlacaoEngine';
import { buildCorrelacaoInterpretation } from './correlacaoInterpretation';
import { datasusSourcesFromSession } from './correlacaoDatasusUtils';

interface ConfirmedDataset {
  headers: string[];
  rows: string[][];
  sourceLabel: string;
  isDatasus: boolean;
}

function initialLoadedFromSession(
  sessionDataset: ReturnType<typeof useSession>['dataset'],
): CorrelacaoLoadedInput | null {
  if (!sessionDataset) return null;
  return {
    headers: sessionDataset.headers,
    rows: sessionDataset.rows,
    recognizedColumns: {},
    sourceLabel: sessionDataset.sourceLabel,
  };
}

function initialStepFromSession(sessionDataset: ReturnType<typeof useSession>['dataset']): FlowStep {
  return sessionDataset ? 'configurar' : 'dados';
}

const EMPTY_DATASUS_KNOBS: DatasusKnobState = {
  xSourceId: '',
  ySourceId: '',
  xMetricKey: '',
  yMetricKey: '',
  timeKey: '',
};

export function CorrelacaoTest() {
  const { dataset: sessionDataset, setDataset, setDatasusSession } = useSession();
  const tabular = useTabularInput(TABULAR_OPTIONS);
  const sourceLabelRef = useRef('colado');

  const [activeStep, setActiveStep] = useState<FlowStep>(() => initialStepFromSession(sessionDataset));
  const [loadedInput, setLoadedInput] = useState<CorrelacaoLoadedInput | null>(() =>
    initialLoadedFromSession(sessionDataset),
  );
  const [confirmedDataset, setConfirmedDataset] = useState<ConfirmedDataset | null>(null);
  const [inputTab, setInputTab] = useState<'paste' | 'datasus'>('paste');
  const [method, setMethod] = useState<CorrelacaoMethod>('pearson');
  const [alpha, setAlpha] = useState<AlphaValue>('0.05');
  const [researchQuestion, setResearchQuestion] = useState('');
  const [datasusSession, setLocalDatasusSession] = useState<DatasusSession | null>(null);
  const [datasusKnobs, setDatasusKnobs] = useState<DatasusKnobState>(EMPTY_DATASUS_KNOBS);
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

  function handleDatasusSessionChange(session: DatasusSession) {
    setDatasusSession(session);
    setLocalDatasusSession(session);
    setDatasusKnobs(buildDefaultCorrelacaoDatasusKnobs(session));
    const confirmed = session.confirmedSources[0];
    if (!confirmed?.normalized?.ok) return;

    const converted = datasusNormalizedToTabular(confirmed.normalized);
    sourceLabelRef.current = 'assistente DATASUS';
    setLoadedInput({
      ...converted,
      recognizedColumns: {},
      sourceLabel: 'assistente DATASUS',
    });
  }

  function handleMethodChange(nextMethod: CorrelacaoMethod) {
    if (nextMethod === method) return;
    if (confirmedDataset) {
      setConfirmedDataset(null);
      setShowSoftReset(true);
      if (activeStep === 'resultados') setActiveStep('configurar');
    }
    setDatasusKnobs(
      datasusSession ? buildDefaultCorrelacaoDatasusKnobs(datasusSession) : EMPTY_DATASUS_KNOBS,
    );
    setMethod(nextMethod);
  }

  function handleConfigureConfirm(confirmed: { headers: string[]; rows: string[][] }) {
    const sourceLabel = loadedInput?.sourceLabel ?? 'colado';
    const isDatasus = sourceLabel.toLowerCase().includes('datasus');
    const nextDataset: ConfirmedDataset = {
      headers: confirmed.headers,
      rows: confirmed.rows,
      sourceLabel,
      isDatasus,
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
    setLocalDatasusSession(null);
    setDatasusSession(null);
    setDatasusKnobs(EMPTY_DATASUS_KNOBS);
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
    let validationErrors: string[] = [];
    let engineOutput = null;

    if (confirmedDataset.isDatasus && datasusSession) {
      const sources = datasusSourcesFromSession(datasusSession);
      const xSource = sources.find((source) => source.id === datasusKnobs.xSourceId) ?? sources[0];
      const ySource = sources.find((source) => source.id === datasusKnobs.ySourceId) ?? sources[0];

      if (!xSource || !ySource) {
        validationErrors = ['Confirme uma base DATASUS para montar a correlação.'];
      } else {
        const derived = deriveDatasusDataset({
          xSource,
          ySource,
          knobs: datasusKnobs,
        });
        if (!derived.ok || !derived.dataset) {
          validationErrors = derived.errors ?? ['Não foi possível derivar os pares DATASUS.'];
        } else {
          const dataset = { ...derived.dataset, method };
          validationErrors = validatePairs(dataset);
          if (!validationErrors.length) {
            engineOutput = toEngineOutput(dataset, method);
          }
        }
      }
    } else {
      const dataset = buildDatasetFromConfirmed({
        headers: confirmedDataset.headers,
        rows: confirmedDataset.rows,
        recognizedColumns: loadedInput.recognizedColumns,
        method,
      });
      validationErrors = validatePairs(dataset);
      if (!validationErrors.length) {
        engineOutput = toEngineOutput(dataset, method);
      }
    }

    if (validationErrors.length) {
      return <CorrelacaoValidationAlert message={validationErrors[0]} />;
    }

    if (!engineOutput) return null;

    const metrics = buildMetrics(engineOutput.result, method, engineOutput.headers);
    const interpretation = buildCorrelacaoInterpretation(
      engineOutput,
      alphaNumber,
      researchQuestion.trim().slice(0, MAX_RESEARCH_QUESTION_LENGTH),
    );

    return (
      <ResultsPanelWithCustomizer
        title="Correlação — resultados"
        metrics={metrics}
        engineOutput={engineOutput}
        presets={correlacaoChartPresets}
        defaultPresetId={getDefaultCorrelacaoChartPreset(method)}
        annotations={CORRELACAO_CHART_ANNOTATIONS}
        interpretation={interpretation}
        exportFilename="correlacao-lacirstat.png"
        actions={<ClearDataButton onCleared={handleClearData} />}
      />
    );
  }, [
    confirmedDataset,
    loadedInput,
    method,
    alpha,
    researchQuestion,
    datasusSession,
    datasusKnobs,
  ]);

  return (
    <FlowSteps
      active={activeStep}
      onStepChange={setActiveStep}
      canAdvance={canAdvance}
      dados={
        <div className="space-y-4">
          <Tabs value={inputTab} onValueChange={(value) => setInputTab(value as 'paste' | 'datasus')}>
            <TabsList>
              <TabsTrigger value="paste">Colar ou enviar</TabsTrigger>
              <TabsTrigger value="datasus">Assistente DATASUS</TabsTrigger>
            </TabsList>
            <TabsContent value="paste" className="mt-4 space-y-3">
              <UseExampleButton onClick={handleUseExample} />
              <TabularInputPanel {...tabular} showPreview={false} />
            </TabsContent>
            <TabsContent value="datasus" className="mt-4">
              <DatasusWizardPanel onSessionChange={handleDatasusSessionChange} />
            </TabsContent>
          </Tabs>
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
            researchQuestion={researchQuestion}
            onResearchQuestionChange={setResearchQuestion}
            showSoftReset={showSoftReset}
            isDatasus={loadedInput.sourceLabel.toLowerCase().includes('datasus')}
            datasusSession={datasusSession}
            datasusKnobs={datasusKnobs}
            onDatasusKnobsChange={setDatasusKnobs}
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
