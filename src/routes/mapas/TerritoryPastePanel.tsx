import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { matchUfPaste } from '@/geo/matchTerritoryLabels';

const DEBOUNCE_MS = 300;
const TEXTAREA_ROWS = 8;

const monoStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-data)',
  lineHeight: 'var(--text-data--line-height)',
} as const;

export interface TerritoryPastePanelProps {
  onMatched: (siglas: string[]) => void;
  onClear?: () => void;
  initialText?: string;
}

type PasteStatus = 'idle' | 'parsing' | 'report';

export function TerritoryPastePanel({
  onMatched,
  onClear,
  initialText = '',
}: TerritoryPastePanelProps) {
  const [text, setText] = useState(initialText);
  const [status, setStatus] = useState<PasteStatus>('idle');
  const [matchedSiglas, setMatchedSiglas] = useState<string[]>([]);
  const [unmatchedLines, setUnmatchedLines] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parseText = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        setStatus('idle');
        setMatchedSiglas([]);
        setUnmatchedLines([]);
        onClear?.();
        return;
      }

      setStatus('parsing');

      const result = matchUfPaste(value);
      const siglas = result.matched.map((entry) => entry.sigla);

      setMatchedSiglas(siglas);
      setUnmatchedLines(result.unmatched);
      setStatus('report');

      if (siglas.length > 0) {
        onMatched(siglas);
      }
    },
    [onClear, onMatched],
  );

  useEffect(() => {
    if (!initialText) return;
    parseText(initialText);
  }, [initialText, parseText]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function scheduleParse(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => parseText(value), DEBOUNCE_MS);
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    setText(value);
    if (!value.trim()) {
      setStatus('idle');
      setMatchedSiglas([]);
      setUnmatchedLines([]);
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
    parseText(text);
  }

  const allUnmatched = status === 'report' && matchedSiglas.length === 0 && unmatchedLines.length > 0;

  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-xl border border-border bg-surface p-6">
      <h2 className="font-sans text-lg font-bold text-text">Colar territórios</h2>
      <p className="mt-1 font-sans text-sm text-text-muted">
        Cole nomes de estados, municípios ou siglas — um por linha.
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

          {matchedSiglas.length > 0 ? (
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
