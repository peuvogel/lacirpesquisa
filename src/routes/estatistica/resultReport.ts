import type { ResultMetric } from './ResultMetricCard';

export function formatResultReport(
  title: string,
  metrics: readonly ResultMetric[],
  interpretation: readonly string[],
): string {
  const metricBlocks = metrics.map(({ label, value, hint }) =>
    [`${label}: ${value}`, hint].filter(Boolean).join('\n'),
  );
  const interpretationBlocks = interpretation.filter((paragraph) => paragraph.trim().length > 0);
  const lines = [title];

  if (metricBlocks.length > 0) {
    lines.push('', 'Resultados');
    for (const [index, block] of metricBlocks.entries()) {
      lines.push(block);
      if (index < metricBlocks.length - 1) lines.push('');
    }
  }

  if (interpretationBlocks.length > 0) {
    lines.push('', 'Interpretação');
    for (const [index, paragraph] of interpretationBlocks.entries()) {
      lines.push(paragraph);
      if (index < interpretationBlocks.length - 1) lines.push('');
    }
  }

  return lines.join('\n');
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
  }
}
