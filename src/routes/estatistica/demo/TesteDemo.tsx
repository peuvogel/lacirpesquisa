import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChartData } from 'chart.js';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BASE_OPTS, COLORS } from '@/shared/charts/chartTheme';
import { useTabularInput } from '@/shared/data-input/useTabularInput';
import type { TabularInputOptions } from '@/shared/data-input/types';
import type { DatasusSession } from '@/shared/data-input/useDatasusWizard';
import { FlowSteps, type FlowStep } from '@/shared/flow/FlowSteps';
import { fmtNumber } from '@/shared/format';
import { useSession } from '@/shared/session/SessionProvider';
import { ColumnPreviewTable } from '../ColumnPreviewTable';
import { ClearDataButton } from '../ClearDataButton';
import { ResultsPanel } from '../ResultsPanel';
import { TabularInputPanel } from '../TabularInputPanel';
import { DatasusWizardPanel } from '../datasus/DatasusWizardPanel';
import { DEMO_DELIMITED_TEXT } from './demoData';
import { datasusNormalizedToTabular } from './datasusToTabular';
import { buildDemoInterpretation, pickAnalysisColumns, summarizeGroups } from './demoStats';

const TABULAR_OPTIONS: TabularInputOptions = {
  aliases: {
    grupo: ['Grupo'],
    valor: ['Tempo de internação (dias)', 'Tempo de internacao (dias)'],
  },
  requiredKeys: ['grupo', 'valor'],
  numericKeys: ['valor'],
  expectedFormatLabel: 'Grupo; Tempo de internação (dias)',
};

interface LoadedInput {
  headers: string[];
  rows: string[][];
  recognizedColumns: Record<string, number>;
  sourceLabel: string;
}

interface ConfirmedDataset {
  headers: string[];
  rows: string[][];
  sourceLabel: string;
}

function initialLoadedFromSession(sessionDataset: ReturnType<typeof useSession>['dataset']): LoadedInput | null {
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

export function TesteDemo() {
  const { dataset: sessionDataset, setDataset, setDatasusSession } = useSession();
  const tabular = useTabularInput(TABULAR_OPTIONS);
  const sourceLabelRef = useRef('colado');

  const [activeStep, setActiveStep] = useState<FlowStep>(() => initialStepFromSession(sessionDataset));
  const [loadedInput, setLoadedInput] = useState<LoadedInput | null>(() => initialLoadedFromSession(sessionDataset));
  const [confirmedDataset, setConfirmedDataset] = useState<ConfirmedDataset | null>(null);
  const [inputTab, setInputTab] = useState<'paste' | 'datasus'>('paste');

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

  function handleUseSampleData() {
    sourceLabelRef.current = 'dados de exemplo';
    tabular.setRawText(DEMO_DELIMITED_TEXT);
  }

  function handleDatasusSessionChange(session: DatasusSession) {
    setDatasusSession(session);
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

  function handleConfigureConfirm(confirmed: { headers: string[]; rows: string[][] }) {
    const sourceLabel = loadedInput?.sourceLabel ?? 'colado';
    const nextDataset: ConfirmedDataset = {
      headers: confirmed.headers,
      rows: confirmed.rows,
      sourceLabel,
    };
    setConfirmedDataset(nextDataset);
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
    if (!confirmedDataset) return null;

    const { groupIndex, valueIndex, note } = pickAnalysisColumns(
      confirmedDataset.headers,
      confirmedDataset.rows,
    );
    const summaries = summarizeGroups(confirmedDataset.rows, groupIndex, valueIndex);
    const interpretation = buildDemoInterpretation(summaries);

    const chartData: ChartData<'bar'> = {
      labels: summaries.map((summary) => summary.label),
      datasets: [
        {
          label: confirmedDataset.headers[valueIndex] || 'Média',
          data: summaries.map((summary) => summary.mean),
          backgroundColor: COLORS.primary,
          borderColor: COLORS.primary,
          borderWidth: 1,
        },
      ],
    };

    const metrics = summaries.flatMap((summary) => [
      {
        label: `${summary.label}: n`,
        value: String(summary.n),
      },
      {
        label: `${summary.label}: média`,
        value: fmtNumber(summary.mean),
        hint: `DP = ${fmtNumber(summary.sd)}`,
      },
    ]);

    return (
      <div className="space-y-4">
        {note ? <p className="text-sm text-warning">{note}</p> : null}
        <ResultsPanel
        title="Resumo descritivo (Teste demo)"
        metrics={metrics}
        chart={{
          type: 'bar',
          data: chartData,
          options: BASE_OPTS,
          ariaLabel: 'Gráfico de barras com a média de tempo de internação por grupo',
        }}
        interpretation={interpretation}
        exportFilename="teste-demo-lacirstat.png"
        actions={<ClearDataButton onCleared={handleClearData} />}
        />
      </div>
    );
  }, [confirmedDataset]);

  return (
    <FlowSteps
      active={activeStep}
      canAdvance={canAdvance}
      dados={
        <div className="space-y-4">
          <Tabs value={inputTab} onValueChange={(value) => setInputTab(value as 'paste' | 'datasus')}>
            <TabsList>
              <TabsTrigger value="paste">Colar ou enviar</TabsTrigger>
              <TabsTrigger value="datasus">Assistente DATASUS</TabsTrigger>
            </TabsList>
            <TabsContent value="paste" className="mt-4 space-y-3">
              <div>
                <Button type="button" variant="outline" onClick={handleUseSampleData}>
                  Usar exemplo
                </Button>
              </div>
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
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">Revise as colunas antes de analisar</h2>
            <p className="text-sm text-muted-foreground">
              Confirme os papéis detectados. Fonte: {loadedInput.sourceLabel}.
            </p>
            <ColumnPreviewTable
              headers={loadedInput.headers}
              bodyRows={loadedInput.rows}
              recognizedColumns={loadedInput.recognizedColumns}
              onConfirm={handleConfigureConfirm}
            />
          </div>
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
