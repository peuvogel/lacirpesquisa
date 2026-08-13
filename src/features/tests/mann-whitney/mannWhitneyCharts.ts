import type { ChartData, ChartOptions } from 'chart.js';
import type { ChartPreset } from '@/shared/charts/useChartCustomizer';
import { BASE_OPTS, COLORS, mergeChartOptions } from '@/shared/charts/chartTheme';
import { fmtP } from '@/shared/format';
import { MANN_WHITNEY_ANNOTATIONS } from './mannWhitneyConfig';
import type { MannWhitneyEngineOutput } from './mannWhitneyEngine';

export const MANN_WHITNEY_CHART_ANNOTATIONS = MANN_WHITNEY_ANNOTATIONS;

function rankData(output: MannWhitneyEngineOutput): ChartData {
  return {
    datasets: [
      {
        label: output.labels[0],
        data: output.result.rankedValues
          .filter((item) => item.group === 'A')
          .map((item) => ({ x: item.rank, y: 1 + ((item.originalIndex % 7) - 3) * 0.035 })),
        backgroundColor: COLORS.primarySolid,
        pointRadius: 5,
      },
      {
        label: output.labels[1],
        data: output.result.rankedValues
          .filter((item) => item.group === 'B')
          .map((item) => ({ x: item.rank, y: ((item.originalIndex % 7) - 3) * 0.035 })),
        backgroundColor: COLORS.blueSolid,
        pointRadius: 5,
      },
    ],
  };
}

function rankOptions(output: MannWhitneyEngineOutput): ChartOptions {
  return mergeChartOptions(BASE_OPTS, {
    plugins: {
      title: { display: true, text: 'Postos por grupo' },
      annotation: {
        annotations: {
          showPValue: {
            type: 'label',
            xValue: output.result.rankedValues.length / 2,
            yValue: 1.25,
            content: `p = ${fmtP(output.result.pValue)}`,
            backgroundColor: 'rgba(255,255,255,0.9)',
            color: COLORS.label,
          },
        },
      },
    },
    scales: {
      x: { title: { display: true, text: 'Posto no conjunto combinado' } },
      y: {
        min: -0.5,
        max: 1.5,
        ticks: {
          stepSize: 1,
          callback: (value) => Number(value) === 1 ? output.labels[0] : Number(value) === 0 ? output.labels[1] : '',
        },
      },
    },
  } as ChartOptions);
}

export const mannWhitneyChartPresets: ChartPreset<MannWhitneyEngineOutput>[] = [
  {
    id: 'rank-dot',
    label: 'Postos por grupo',
    visualType: 'dot',
    buildChart: (output) => ({
      type: 'scatter',
      data: rankData(output),
      options: rankOptions(output),
      ariaLabel: 'Postos por grupo',
    }),
    defaultAxisLabels: { x: 'Posto no conjunto combinado', y: 'Grupo' },
    annotationKeys: ['showPValue'],
  },
];
