import { Chart } from 'chart.js';
import Annotation from 'chartjs-plugin-annotation';

let registered = false;

/** Registers chartjs-plugin-annotation once for the app lifetime. */
export function ensureChartAnnotationsRegistered(): void {
  if (registered) return;
  Chart.register(Annotation);
  registered = true;
}
