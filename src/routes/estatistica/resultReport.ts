import type { ResultMetric } from './ResultMetricCard';

export function formatResultReport(
  title: string,
  metrics: readonly ResultMetric[],
  interpretation: readonly string[],
): string {
  const metricBlocks = metrics.map(({ label, value, hint }) =>
    [`${label}: ${value}`, hint].filter(Boolean).join('\n'),
  );
  return [
    title,
    '',
    'Resultados',
    metricBlocks.join('\n\n'),
    '',
    'Interpretação',
    interpretation.join('\n\n'),
  ].join('\n');
}

export async function copyTextToClipboard(text: string): Promise<void> {
  const browserNavigator = globalThis.navigator;
  if (browserNavigator?.clipboard?.writeText) {
    try {
      await browserNavigator.clipboard.writeText(text);
      return;
    } catch {
      // Continue into the local textarea fallback.
    }
  }

  const browserDocument = globalThis.document;
  const previousActiveElement =
    browserDocument.activeElement instanceof HTMLElement ? browserDocument.activeElement : null;
  const textarea = browserDocument.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  browserDocument.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    const copied =
      typeof browserDocument.execCommand === 'function'
      && browserDocument.execCommand('copy');
    if (!copied) {
      throw new Error('clipboard unavailable');
    }
  } finally {
    textarea.remove();
    if (previousActiveElement?.isConnected) {
      previousActiveElement.focus();
    }
  }
}
