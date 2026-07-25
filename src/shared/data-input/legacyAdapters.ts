/**
 * Typed port of the minimal legacy `utils`/`Stats` surface the ported
 * parsers (`parseTabular.ts`, `datasusImporter.ts`, `datasusNormalizer.ts`)
 * call into. Ported verbatim from `assets/js/app.js`:
 *   - mojibake-repair chain: lines 44-84 (`hasLikelyMojibake`,
 *     `scoreDecodedText`, `latin1ToUtf8`, `repairMojibake`,
 *     `normalizeImportedText`, `normalizeImportedLabel`)
 *   - `readFileText`: lines 150-176
 *   - `Stats.parseNumber` / `Stats.mean`: lines 241-264
 *
 * Only `this.`-style method calls are converted to direct local function
 * calls and type annotations are added — no regex, threshold, or scoring
 * constant is changed (`scoreDecodedText`'s good + 2*commonPortuguese - 5*bad
 * weighting is tuned, not stylistic).
 */

import type { LegacyStatsAdapter, LegacyUtilsAdapter } from './types';

export function hasLikelyMojibake(text: string): boolean {
  return /(?:\uFFFD|ï¿½|Ã.|Â.|â[\u0080-\u00BF]?)/.test(String(text || ''));
}

export function scoreDecodedText(text: string): number {
  const source = String(text || '');
  const bad = (source.match(/\uFFFD|ï¿½|Ã.|Â.|â[\u0080-\u00BF]?/g) || []).length;
  const good = (source.match(/[\u00C0-\u017F]/g) || []).length;
  const commonPortuguese = (source.match(/[ãõçáéíóúâêôàü]/gi) || []).length;
  return good + (commonPortuguese * 2) - (bad * 5);
}

export function latin1ToUtf8(text: string): string {
  const bytes = Uint8Array.from(String(text || ''), (char) => char.charCodeAt(0) & 0xFF);
  return new TextDecoder('utf-8').decode(bytes);
}

export function repairMojibake(text: string): string {
  let best = String(text || '');
  let bestScore = scoreDecodedText(best);
  let current = best;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!hasLikelyMojibake(current)) break;
    const candidate = latin1ToUtf8(current);
    if (!candidate || candidate === current) break;
    const candidateScore = scoreDecodedText(candidate);
    if (candidateScore < bestScore) break;
    best = candidate;
    bestScore = candidateScore;
    current = candidate;
  }

  return best;
}

export function normalizeImportedText(text: string): string {
  const normalized = repairMojibake(String(text || ''))
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n');

  return normalized.normalize('NFC');
}

export function normalizeImportedLabel(value: string): string {
  return normalizeImportedText(value).replace(/\s+/g, ' ').trim();
}

export async function readFileText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const candidates: string[] = [];

  try {
    candidates.push(new TextDecoder('utf-8').decode(buffer));
  } catch {
    // Ignore and keep fallback decoders below.
  }

  for (const encoding of ['windows-1252', 'iso-8859-1']) {
    try {
      candidates.push(new TextDecoder(encoding).decode(buffer));
    } catch {
      // Ignore unsupported decoder on this runtime.
    }
  }

  if (!candidates.length) {
    candidates.push(new TextDecoder().decode(buffer));
  }

  return candidates
    .map((candidate) => normalizeImportedText(candidate))
    .sort((a, b) => scoreDecodedText(b) - scoreDecodedText(a))[0];
}

export function parseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;

  let source = String(raw).trim();
  if (!source) return null;

  source = source.replace(/\s+/g, '');
  if (source.includes(',') && source.includes('.')) {
    if (source.lastIndexOf(',') > source.lastIndexOf('.')) {
      source = source.replace(/\./g, '').replace(',', '.');
    } else {
      source = source.replace(/,/g, '');
    }
  } else if (source.includes(',') && !source.includes('.')) {
    source = source.replace(',', '.');
  }

  const value = Number(source);
  return Number.isFinite(value) ? value : null;
}

export function mean(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

export const legacyUtils: LegacyUtilsAdapter = {
  readFileText,
  normalizeImportedText,
  normalizeImportedLabel,
};

export const legacyStats: LegacyStatsAdapter = {
  parseNumber,
  mean,
};
