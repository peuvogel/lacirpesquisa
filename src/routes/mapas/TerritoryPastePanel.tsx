import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { loadMuniNameTable } from '@/geo/loadGeoAsset';
import { matchMunicipalityPaste, matchUfPaste, looksLikeMunicipalityIntent, isLikelyUfLine } from '@/geo/matchTerritoryLabels';
import type { TerritoryRef } from '@/geo/types';

const DEBOUNCE_MS = 300;
const TEXTAREA_ROWS = 8;

const monoStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-data)',
  lineHeight: 'var(--text-data--line-height)',
} as const;

export interface TerritoryPastePanelProps {
  onMatched: (siglas: string[]) => void;
  onMatchedTerritories?: (territories: TerritoryRef[]) => void;
  onClear?: () => void;
  initialText?: string;
  /** UF sigla when map is drilled — enables municipality matching (MAP-04). */
  activeUfScope?: string;
}

type PasteStatus = 'idle' | 'parsing' | 'report';

interface ParsedReport {
  matchedTerritories: TerritoryRef[];
  matchedSiglas: string[];
  unmatchedLines: string[];
  scopeRequired: boolean;
}

export function TerritoryPastePanel({
  onMatched,
  onMatchedTerritories,
  onClear,
  initialText = '',
  activeUfScope,
}: TerritoryPastePanelProps) {
  const [text, setText] = useState(initialText);
  const [status, setStatus] = useState<PasteStatus>('idle');
  const [report, setReport] = useState<ParsedReport>({
    matchedTerritories: [],
    matchedSiglas: [],
    unmatchedLines: [],
    scopeRequired: false,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parseText = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        setStatus('idle');
        setReport({
          matchedTerritories: [],
          matchedSiglas: [],
          unmatchedLines: [],
          scopeRequired: false,
        });
        onClear?.();
        return;
      }

      setStatus('parsing');

      try {
        let parsed: ParsedReport;

        if (activeUfScope) {
          const nameTable = await loadMuniNameTable(activeUfScope);
          const result = matchMunicipalityPaste(value, activeUfScope, nameTable);
          const territories = result.matched
            .filter((entry) => entry.status === 'matched')
            .map((entry) => entry.territory);
          parsed = {
            matchedTerritories: territories,
            matchedSiglas: territories.filter((t) => t.level === 'uf' && t.sigla).map((t) => t.sigla!),
            unmatchedLines: result.unmatched,
            scopeRequired: result.scopeRequired,
          };
        } else {
          const ufResult = matchUfPaste(value);
          const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          const needsScope = lines.some(
            (line) => !isLikelyUfLine(line) && looksLikeMunicipalityIntent(line),
          );
          const territories: TerritoryRef[] = ufResult.matched.map((uf) => ({
            level: 'uf',
            ibgeCode: uf.ibgeCode,
            sigla: uf.sigla,
            name: uf.name,
          }));
          parsed = {
            matchedTerritories: territories,
            matchedSiglas: ufResult.matched.map((entry) => entry.sigla),
            unmatchedLines: ufResult.unmatched,
            scopeRequired: needsScope,
          };
        }

        setReport(parsed);
        setStatus('report');

        if (parsed.matchedSiglas.length > 0) {
          onMatched(parsed.matchedSiglas);
        }
        if (parsed.matchedTerritories.length > 0) {
          onMatchedTerritories?.(parsed.matchedTerritories);
        }
      } catch {
        setReport({
          matchedTerritories: [],
          matchedSiglas: [],
          unmatchedLines: ['Erro ao carregar tabela de municípios para esta UF.'],
          scopeRequired: false,
        });
        setStatus('report');
      }
    },
    [activeUfScope, onClear, onMatched, onMatchedTerritories],
  );

  useEffect(() => {
    if (!initialText) return;
    void parseText(initialText);
  }, [initialText, parseText]);

  useEffect(() => {
    if (text.trim()) {
      void parseText(text);
    }
  }, [activeUfScope]); // eslint-disable-line react-hooks/exhaustive-deps -- re-parse when drill scope changes

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function scheduleParse(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void parseText(value);
    }, DEBOUNCE_MS);
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    setText(value);
    if (!value.trim()) {
      setStatus('idle');
      setReport({
        matchedTerritories: [],
        matchedSiglas: [],
        unmatchedLines: [],
        scopeRequired: false,
      });
      onClear?.();
      return;
    }
    setStatus('parsing');
    scheduleParse(value);
  }

  function handleBlur() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    void parseText(text);
  }

  const { matchedSiglas, matchedTerritories, unmatchedLines, scopeRequired } = report;
  const allUnmatched =
    status === 'report' && matchedTerritories.length === 0 && unmatchedLines.length > 0 && !scopeRequired;

  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-xl border border-border bg-surface p-6">
      <h2 className="font-sans text-lg font-bold text-text">Colar territórios</h2>
      <p className="mt-1 font-sans text-sm text-text-muted">
        Cole nomes de estados, municípios ou siglas — um por linha.
        {activeUfScope ? ` Municípios serão reconhecidos dentro de ${activeUfScope}.` : null}
      </p>

      <textarea
        aria-label="Cole territórios — um por linha"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        rows={TEXTAREA_ROWS}
        className="mt-4 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-sans text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={monoStyle}
      />

      {status === 'parsing' ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 rounded-lg border border-border px-3 py-2 text-sm text-text-muted"
        >
          Reconhecendo territórios…
        </div>
      ) : null}

      {status === 'report' ? (
        <div aria-live="polite" className="mt-4 space-y-4">
          {scopeRequired ? (
            <Alert variant="destructive">
              <AlertTitle>Selecione um estado no mapa primeiro</AlertTitle>
              <AlertDescription>
                Para colar municípios, explore um estado no mapa (duplo clique) ou cole apenas siglas de UF.
              </AlertDescription>
            </Alert>
          ) : null}

          {allUnmatched ? (
            <Alert variant="destructive">
              <AlertTitle>Não conseguimos reconhecer esses territórios</AlertTitle>
              <AlertDescription>
                <p>
                  Use siglas (BA, SP), nomes completos ou municípios com UF entre parênteses.
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer font-bold">Ver detalhes</summary>
                  <ul className="mt-1 list-disc pl-4" style={monoStyle}>
                    {unmatchedLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </details>
              </AlertDescription>
            </Alert>
          ) : null}

          {matchedTerritories.length > 0 ? (
            <div>
              <h3 className="font-sans text-sm font-medium text-text">
                Reconhecidos ({matchedTerritories.length})
              </h3>
              <ul className="mt-2 space-y-1" style={monoStyle}>
                {matchedTerritories.map((t) => (
                  <li
                    key={`${t.level}:${t.ibgeCode}`}
                    className={cn(
                      'inline-flex rounded-md border border-accent-border bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent',
                    )}
                  >
                    {t.level === 'municipio' ? `${t.name} (${t.ibgeCode})` : (t.sigla ?? t.name)}
                  </li>
                ))}
              </ul>
            </div>
          ) : matchedSiglas.length > 0 ? (
            <div>
              <h3 className="font-sans text-sm font-medium text-text">
                Reconhecidos ({matchedSiglas.length})
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2" style={monoStyle}>
                {matchedSiglas.map((sigla) => (
                  <li
                    key={sigla}
                    className={cn(
                      'rounded-md border border-accent-border bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent',
                    )}
                  >
                    {sigla}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!allUnmatched && unmatchedLines.length > 0 ? (
            <Alert variant="destructive">
              <AlertTitle>Não reconhecidos ({unmatchedLines.length})</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-disc pl-4" style={monoStyle}>
                  {unmatchedLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p className="mt-2 text-sm">
                  Confira a grafia ou use a sigla de dois caracteres (ex.: BA, SP).
                </p>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
