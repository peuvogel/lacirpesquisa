import { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UseExampleButton } from '@/features/tests/shared/UseExampleButton';
import type { AlphaValue } from '@/features/tests/shared/AlphaSelector';
import { ResultsPanelWithCustomizer } from '@/shared/charts/ResultsPanelWithCustomizer';
import { deriveRecognizedColumnsFromTabular } from '@/shared/data-input/recognizedColumnsFromTabular';
import { useTabularInput } from '@/shared/data-input/useTabularInput';
import type { DatasusSession } from '@/shared/data-input/useDatasusWizard';
import { FlowSteps, type FlowStep } from '@/shared/flow/FlowSteps';
import { useSession } from '@/shared/session/SessionProvider';
import { ClearDataButton } from '@/routes/estatistica/ClearDataButton';
import { TabularInputPanel } from '@/routes/estatistica/TabularInputPanel';
import { DatasusWizardPanel } from '@/routes/estatistica/datasus/DatasusWizardPanel';
import { datasusNormalizedToTabular } from '@/routes/estatistica/demo/datasusToTabular';
import {
  TStudentConfigPanel,
  TStudentValidationAlert,
  type TStudentLoadedInput,
} from './TStudentConfigPanel';
import {
  buildDefaultDatasusKnobs,
} from './TStudentDatasusKnobs';
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
  deriveDatasusDataset,
  runAnalysis,
  toEngineOutput,
  validateSampleSize,
  type DatasusKnobState,
} from './tStudentEngine';
import { buildTStudentInterpretation } from './tStudentInterpretation';
import { datasusSourceFromPublic } from './tStudentDatasusUtils';

interface ConfirmedDataset {
  headers: string[];
  rows: string[][];
  sourceLabel: string;
  isDatasus: boolean;
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

const EMPTY_DATASUS_KNOBS: DatasusKnobState = {
  groupAKeys: [],
  groupBKeys: [],
  timeKeys: [],
};

export function TStudentTest() {
  const { dataset: sessionDataset, setDataset, setDatasusSession } = useSession();
  const tabular = useTabularInput(TABULAR_OPTIONS);
  const sourceLabelRef = useRef('colado');

  const [activeStep, setActiveStep] = useState<FlowStep>(() => initialStepFromSession(sessionDataset));
  const [loadedInput, setLoadedInput] = useState<TStudentLoadedInput | null>(() =>
    initialLoadedFromSession(sessionDataset),
  );
  const [confirmedDataset, setConfirmedDataset] = useState<ConfirmedDataset | null>(null);
  const [inputTab, setInputTab] = useState<'paste' | 'datasus'>('paste');
  const [mode, setMode] = useState<TStudentMode>('independent');
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
    setDatasusKnobs(buildDefaultDatasusKnobs(session));
    const confirmed = session.confirmedSources[0];
    if (!confirmed?.normalized?.ok) return;

    const converted = datasusNormalizedToTabular(confirmed.normalized);
    sourceLabelRef.current = 'assistente DATASUS';
    setLoadedInput({
      ...converted,
      recognizedColumns: deriveRecognizedColumnsFromTabular(
        converted.headers,
        converted.rows,
        TABULAR_OPTIONS,
      ),
      sourceLabel: 'assistente DATASUS',
    });
  }

  function handleModeChange(nextMode: TStudentMode) {
    if (nextMode === mode) return;
    if (confirmedDataset) {
      setConfirmedDataset(null);
      setShowSoftReset(true);
      if (activeStep === 'resultados') setActiveStep('configurar');
    }
    setDatasusKnobs(
      datasusSession ? buildDefaultDatasusKnobs(datasusSession) : EMPTY_DATASUS_KNOBS,
    );
    setMode(nextMode);
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

    if (confirmedDataset.isDatasus && datasusSession?.confirmedSources[0]) {
      const source = datasusSourceFromPublic(datasusSession.confirmedSources[0]);
      const derived = deriveDatasusDataset({
        mode,
        source,
        knobs: datasusKnobs,
      });
      if (!derived.ok || !derived.dataset) {
        validationErrors = derived.errors ?? ['Não foi possível derivar os grupos DATASUS.'];
      } else {
        validationErrors = validateSampleSize(mode, derived.dataset);
        if (!validationErrors.length) {
          const result = runAnalysis(mode, derived.dataset);
          engineOutput = toEngineOutput(derived.dataset, result);
        }
      }
    } else {
      const dataset = buildDatasetFromConfirmed({
        headers: confirmedDataset.headers,
        rows: confirmedDataset.rows,
        recognizedColumns: loadedInput.recognizedColumns,
        mode,
      });
      validationErrors = validateSampleSize(mode, dataset);
      if (!validationErrors.length) {
        const result = runAnalysis(mode, dataset);
        engineOutput = toEngineOutput(dataset, result);
      }
    }

    if (validationErrors.length) {
      return <TStudentValidationAlert message={validationErrors[0]} />;
    }

    if (!engineOutput) return null;

    const metrics = buildMetrics(engineOutput.result, engineOutput.labels);
    const interpretation = buildTStudentInterpretation(
      engineOutput.result,
      alphaNumber,
      engineOutput.labels,
      researchQuestion.trim().slice(0, MAX_RESEARCH_QUESTION_LENGTH),
    );

    return (
      <ResultsPanelWithCustomizer
        title="t de Student — resultados"
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
  }, [
    confirmedDataset,
    loadedInput,
    mode,
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
          <TStudentConfigPanel
            loadedInput={loadedInput}
            mode={mode}
            onModeChange={handleModeChange}
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
