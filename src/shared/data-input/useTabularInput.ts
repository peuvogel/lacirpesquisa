import { useCallback, useEffect, useRef, useState } from 'react';
import { legacyStats, legacyUtils } from './legacyAdapters';
import { readTabularFileState, readTabularPasteState } from './parseTabular';
import type { RecognizedColumn, TabularInputOptions } from './types';

const PASTE_DEBOUNCE_MS = 150;

/** UI-SPEC § Empty/Error/Loading — "File read failure (corrupt/oversized XLSX)" copy. */
const FILE_READ_ERROR_MESSAGE = 'Não foi possível ler este arquivo. Tente novamente ou cole os dados diretamente.';

export type TabularInputStatus = 'idle' | 'parsing' | 'loaded' | 'error';

export interface TabularInputError {
  message: string;
  details: string[];
}

export interface TabularInputState {
  status: TabularInputStatus;
  headers: string[];
  bodyRows: string[][];
  /** Domain key → column index, flattened from the parser's RecognizedColumn shape. */
  recognizedColumns: Record<string, number>;
  error: TabularInputError | null;
  rawText: string;
}

export interface UseTabularInputResult extends TabularInputState {
  setRawText: (text: string) => void;
  setFile: (file: File) => Promise<void>;
  reset: () => void;
}

const IDLE_RESULT_FIELDS: Omit<TabularInputState, 'rawText'> = {
  status: 'idle',
  headers: [],
  bodyRows: [],
  recognizedColumns: {},
  error: null,
};

function toIndexMap(recognizedColumns: Record<string, RecognizedColumn>): Record<string, number> {
  return Object.fromEntries(Object.entries(recognizedColumns).map(([key, column]) => [key, column.index]));
}

/**
 * React state wrapper over the ported parsers (01-03), returning
 * idle/parsing/loaded/error transitions per 01-RESEARCH.md Pattern 3.
 * `setFile`'s own try/catch (T-01-DoS) is defense in depth: readTabularFileState
 * already resolves every anticipated failure into a friendly error state, but
 * a React error boundary cannot catch a rejection thrown inside an async event
 * handler, so this call site guarantees the route never crashes.
 */
export function useTabularInput(options: TabularInputOptions = {}): UseTabularInputResult {
  const [state, setState] = useState<TabularInputState>({ ...IDLE_RESULT_FIELDS, rawText: '' });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(
    () => () => {
      requestRef.current += 1;
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    },
    [],
  );

  const commitPasteResult = useCallback((text: string, requestId: number) => {
    if (requestId !== requestRef.current) return;

    const result = readTabularPasteState(text, legacyStats, optionsRef.current);
    if (requestId !== requestRef.current) return;

    if (result.status === 'loaded') {
      setState({
        status: 'loaded',
        headers: result.headers,
        bodyRows: result.bodyRows,
        recognizedColumns: toIndexMap(result.recognizedColumns),
        error: null,
        rawText: text,
      });
    } else {
      // Parser's { message, details } shape flows straight into the hook's
      // error field with no reshaping (01-PATTERNS.md § Friendly parse-error shape).
      setState({
        status: 'error',
        headers: [],
        bodyRows: [],
        recognizedColumns: {},
        error: { message: result.message, details: result.details },
        rawText: text,
      });
    }
  }, []);

  const setRawText = useCallback(
    (text: string) => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      const requestId = ++requestRef.current;

      if (!text.trim()) {
        // A cleared textarea is not a failure — it resets to idle immediately.
        setState({ ...IDLE_RESULT_FIELDS, rawText: text });
        return;
      }

      setState({ ...IDLE_RESULT_FIELDS, status: 'parsing', rawText: text });

      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        commitPasteResult(text, requestId);
      }, PASTE_DEBOUNCE_MS);
    },
    [commitPasteResult],
  );

  const setFile = useCallback(async (file: File) => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const requestId = ++requestRef.current;
    setState({ ...IDLE_RESULT_FIELDS, status: 'parsing', rawText: '' });

    try {
      const result = await readTabularFileState(file, legacyUtils, legacyStats, optionsRef.current);
      // Guard against stale async results: only the most recently *started*
      // setFile call may commit state, so a slow big XLSX can never clobber
      // a newer, faster result.
      if (requestId !== requestRef.current) return;

      if (result.status === 'loaded') {
        setState({
          status: 'loaded',
          headers: result.headers,
          bodyRows: result.bodyRows,
          recognizedColumns: toIndexMap(result.recognizedColumns),
          error: null,
          rawText: '',
        });
      } else {
        setState({
          status: 'error',
          headers: [],
          bodyRows: [],
          recognizedColumns: {},
          error: { message: result.message, details: result.details },
          rawText: '',
        });
      }
    } catch (caught) {
      if (requestId !== requestRef.current) return;
      const reason = caught instanceof Error ? caught.message : String(caught);
      setState({
        status: 'error',
        headers: [],
        bodyRows: [],
        recognizedColumns: {},
        error: { message: FILE_READ_ERROR_MESSAGE, details: [reason] },
        rawText: '',
      });
    }
  }, []);

  const reset = useCallback(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    requestRef.current += 1;
    setState({ ...IDLE_RESULT_FIELDS, rawText: '' });
  }, []);

  return { ...state, setRawText, setFile, reset };
}
