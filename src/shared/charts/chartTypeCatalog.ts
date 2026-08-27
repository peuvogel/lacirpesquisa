/**
 * Datawrapper-style chart type catalog (labels in Portuguese).
 * Tests map presets via `visualType`; unavailable types stay visible but disabled.
 */
export const CHART_TYPE_CATALOG = [
  { id: 'bar', label: 'Barras' },
  { id: 'stacked-bars', label: 'Barras empilhadas' },
  { id: 'grouped-bars', label: 'Barras agrupadas' },
  { id: 'split-bars', label: 'Barras divididas' },
  { id: 'bullet-bars', label: 'Barras bullet' },
  { id: 'column', label: 'Colunas' },
  { id: 'stacked-columns', label: 'Colunas empilhadas' },
  { id: 'grouped-columns', label: 'Colunas agrupadas' },
  { id: 'multiple-columns', label: 'Múltiplas colunas' },
  { id: 'lines', label: 'Linhas' },
  { id: 'multiple-lines', label: 'Múltiplas linhas' },
  { id: 'area', label: 'Área' },
  { id: 'scatter', label: 'Dispersão' },
  { id: 'dot', label: 'Pontos' },
  { id: 'range', label: 'Intervalo' },
  { id: 'box-plot', label: 'Boxplot' },
  { id: 'arrow', label: 'Setas' },
  { id: 'election-donut', label: 'Rosca eleitoral' },
  { id: 'pie', label: 'Pizza' },
  { id: 'multiple-pies', label: 'Múltiplas pizzas' },
  { id: 'donut', label: 'Rosca' },
  { id: 'multiple-donuts', label: 'Múltiplas roscas' },
  { id: 'table', label: 'Tabela' },
] as const;

export type ChartVisualType = (typeof CHART_TYPE_CATALOG)[number]['id'];

export function getChartTypeLabel(id: string): string {
  return CHART_TYPE_CATALOG.find((item) => item.id === id)?.label ?? id;
}
