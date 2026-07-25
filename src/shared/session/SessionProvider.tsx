import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface SessionDataset {
  headers: string[];
  rows: string[][];
  sourceLabel: string; // e.g. 'colado', 'planilha.xlsx', 'assistente DATASUS'
  confirmedAt: number; // Date.now()
}

export interface SessionState {
  dataset: SessionDataset | null;
  datasusSession: unknown | null; // buildSession() output from the wizard (plan 01-08)
  mapSelection: { ufs: string[]; variables: string[] } | null; // plan 01-09/01-11
  hasData: boolean; // derived: dataset !== null || datasusSession !== null
}

export interface SessionApi extends SessionState {
  setDataset(dataset: SessionDataset | null): void;
  setDatasusSession(session: unknown | null): void;
  setMapSelection(selection: { ufs: string[]; variables: string[] } | null): void;
  clearSession(): void;
}

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<SessionDataset | null>(null);
  const [datasusSession, setDatasusSession] = useState<unknown | null>(null);
  const [mapSelection, setMapSelection] = useState<{ ufs: string[]; variables: string[] } | null>(null);

  const clearSession = useCallback(() => {
    setDataset(null);
    setDatasusSession(null);
    setMapSelection(null);
  }, []);

  // hasData is derived on every render, never stored as its own state — the
  // leave-warning (plan 01-07) depends on this being current, not stale.
  const hasData = dataset !== null || datasusSession !== null;

  const value = useMemo<SessionApi>(
    () => ({
      dataset,
      datasusSession,
      mapSelection,
      hasData,
      setDataset,
      setDatasusSession,
      setMapSelection,
      clearSession,
    }),
    [dataset, datasusSession, mapSelection, hasData, clearSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
