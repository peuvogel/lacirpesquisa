import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { fingerprintResearchDesign } from '@/features/research/researchDesign';
import type { GuidedAnalysisState, ResearchDesign } from '@/features/research/types';
import type { MapAnalysisState } from '@/routes/mapas/mapAnalysisState';
import {
  createTableDocument,
  isTableDocument,
  type TableDocument,
} from '@/shared/data-input/tableDocument';
import {
  SessionSnapshotValidationError,
  createIndexedDbSessionStorage,
  isSerializableVisualPreferences,
  type SessionSnapshot,
  type SessionStorageAdapter,
} from './sessionStorage';

export interface SessionDataset {
  headers: string[];
  rows: string[][];
  sourceLabel: string; // e.g. 'colado', 'planilha.xlsx', 'assistente DATASUS'
  confirmedAt: number; // Date.now()
  /** Stable editable representation; absent only on legacy handoffs before the provider normalizes them. */
  table?: TableDocument;
}

export interface SessionState {
  dataset: SessionDataset | null;
  datasusSession: unknown | null; // buildSession() output from the wizard (plan 01-08)
  /** @deprecated Prefer mapAnalysis — kept for Phase 1 backward compat during migration. */
  mapSelection: { ufs: string[]; variables: string[] } | null; // plan 01-09/01-11
  mapAnalysis: MapAnalysisState | null; // Phase 4 groups×time×variables
  researchDesign: ResearchDesign | null;
  guidedAnalysis: GuidedAnalysisState | null;
  hasData: boolean; // derived: dataset !== null || datasusSession !== null
  visualPreferences: Record<string, unknown>;
  persistenceReady: boolean;
  persistenceStatus: 'restoring' | 'off' | 'saving' | 'saved' | 'error';
  persistenceError: string | null;
  hasUnsavedChanges: boolean;
}

export interface SessionApi extends SessionState {
  setDataset(dataset: SessionDataset | null): void;
  setDatasusSession(session: unknown | null): void;
  setMapSelection(selection: { ufs: string[]; variables: string[] } | null): void;
  setMapAnalysis(analysis: MapAnalysisState | null): void;
  setResearchDesign(design: ResearchDesign | null): void;
  setGuidedAnalysis(analysis: GuidedAnalysisState | null): void;
  setVisualPreferences(preferences: Record<string, unknown>): void;
  clearSession(): void;
}

const SessionContext = createContext<SessionApi | null>(null);

/**
 * Legacy producers still send headers/rows. Normalize exactly when they cross
 * the provider boundary so all subsequent table edits retain the same IDs.
 */
export function normalizeSessionDataset(dataset: SessionDataset | null): SessionDataset | null {
  if (!dataset) return null;
  if (isTableDocument(dataset.table)) {
    return {
      ...dataset,
      headers: dataset.table.columns.map((column) => column.name),
      rows: dataset.table.rows,
      sourceLabel: dataset.table.sourceLabel,
      table: dataset.table,
    };
  }
  const table = createTableDocument(dataset.headers, dataset.rows, dataset.sourceLabel);
  return { ...dataset, table };
}

export interface SessionProviderProps {
  children: ReactNode;
  storage?: SessionStorageAdapter;
}

const NEVER_PERSISTED = Symbol('never-persisted');

function persistenceErrorMessage(operation: 'read' | 'write' | 'clear', error: unknown): string {
  if (operation === 'read' && error instanceof SessionSnapshotValidationError) {
    return 'A sessão salva era incompatível ou estava corrompida e não foi restaurada.';
  }
  if (operation === 'write' && error instanceof DOMException && error.name === 'QuotaExceededError') {
    return 'O armazenamento deste navegador está cheio; os dados continuam disponíveis apenas nesta sessão.';
  }
  if (operation === 'clear') {
    return 'Não foi possível remover a sessão salva deste navegador. Tente novamente antes de sair.';
  }
  if (operation === 'write') {
    return 'Não foi possível salvar no armazenamento deste navegador; os dados continuam nesta sessão.';
  }
  return 'Não foi possível acessar o armazenamento deste navegador. A aplicação continuará somente em memória.';
}

export function SessionProvider({ children, storage }: SessionProviderProps) {
  const [dataset, setDatasetState] = useState<SessionDataset | null>(null);
  const [datasusSession, setDatasusSession] = useState<unknown | null>(null);
  const [mapSelection, setMapSelection] = useState<{ ufs: string[]; variables: string[] } | null>(
    null,
  );
  const [mapAnalysis, setMapAnalysis] = useState<MapAnalysisState | null>(null);
  const [researchDesign, setResearchDesignState] = useState<ResearchDesign | null>(null);
  const [guidedAnalysis, setGuidedAnalysis] = useState<GuidedAnalysisState | null>(null);
  const [visualPreferences, setVisualPreferencesState] = useState<Record<string, unknown>>({});
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<SessionState['persistenceStatus']>('restoring');
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const researchDesignRef = useRef<ResearchDesign | null>(null);
  const persistenceWritableRef = useRef(false);
  const persistenceReadyRef = useRef(false);
  const persistenceGenerationRef = useRef(0);
  const persistenceSequenceRef = useRef(0);
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const restorationPromiseRef = useRef<Promise<SessionSnapshot | null> | null>(null);
  const mutatedBeforeRestoreRef = useRef(false);
  const storageRef = useRef<SessionStorageAdapter | null>(null);
  const lastPersistedDatasetRef = useRef<SessionDataset | null | typeof NEVER_PERSISTED>(NEVER_PERSISTED);
  const lastPersistedPreferencesRef = useRef<Record<string, unknown> | typeof NEVER_PERSISTED>(NEVER_PERSISTED);
  if (!storageRef.current) storageRef.current = storage ?? createIndexedDbSessionStorage();

  const setDataset = useCallback((nextDataset: SessionDataset | null) => {
    if (!restorationPromiseRef.current || !persistenceReadyRef.current) {
      mutatedBeforeRestoreRef.current = true;
    }
    setDatasetState(normalizeSessionDataset(nextDataset));
  }, []);

  const setVisualPreferences = useCallback((preferences: Record<string, unknown>) => {
    if (!isSerializableVisualPreferences(preferences)) {
      setPersistenceStatus('error');
      setPersistenceError('As preferências visuais contêm um valor que não pode ser salvo com segurança.');
      return;
    }
    if (!restorationPromiseRef.current || !persistenceReadyRef.current) {
      mutatedBeforeRestoreRef.current = true;
    }
    setVisualPreferencesState(preferences);
  }, []);

  const scheduleWrite = useCallback((
    nextDataset: SessionDataset | null,
    nextPreferences: Record<string, unknown>,
  ) => {
    const generation = persistenceGenerationRef.current;
    const sequence = ++persistenceSequenceRef.current;
    setPersistenceStatus('saving');
    setPersistenceError(null);
    const operation = persistenceQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (
          generation !== persistenceGenerationRef.current
          || !persistenceWritableRef.current
        ) return;
        const snapshot: SessionSnapshot = {
          version: 1,
          savedAt: Date.now(),
          dataset: nextDataset,
          visualPreferences: nextPreferences,
        };
        await storageRef.current!.write(snapshot);
        if (generation !== persistenceGenerationRef.current) return;
        lastPersistedDatasetRef.current = nextDataset;
        lastPersistedPreferencesRef.current = nextPreferences;
        if (sequence === persistenceSequenceRef.current) {
          setPersistenceStatus('saved');
          setPersistenceError(null);
        }
      })
      .catch((error: unknown) => {
        if (
          generation === persistenceGenerationRef.current
          && sequence === persistenceSequenceRef.current
        ) {
          setPersistenceStatus('error');
          setPersistenceError(persistenceErrorMessage('write', error));
        }
      });
    persistenceQueueRef.current = operation;
  }, []);

  const clearPersistedSession = useCallback(() => {
    const generation = ++persistenceGenerationRef.current;
    const sequence = ++persistenceSequenceRef.current;
    const emptyVisualPreferences: Record<string, unknown> = {};
    lastPersistedDatasetRef.current = null;
    lastPersistedPreferencesRef.current = emptyVisualPreferences;
    setDatasetState(null);
    setVisualPreferencesState(emptyVisualPreferences);
    setPersistenceStatus('saving');
    setPersistenceError(null);
    const operation = persistenceQueueRef.current
      .catch(() => undefined)
      .then(() => storageRef.current!.clear())
      .then(() => {
        if (
          generation !== persistenceGenerationRef.current
          || sequence !== persistenceSequenceRef.current
        ) return;
        setPersistenceStatus('saved');
        setPersistenceError(null);
      })
      .catch((error: unknown) => {
        if (
          generation === persistenceGenerationRef.current
          && sequence === persistenceSequenceRef.current
        ) {
          setPersistenceStatus('error');
          setPersistenceError(persistenceErrorMessage('clear', error));
        }
    });
    persistenceQueueRef.current = operation;
  }, []);

  useEffect(() => {
    let active = true;
    const generation = persistenceGenerationRef.current;
    if (!restorationPromiseRef.current) {
      restorationPromiseRef.current = storageRef.current!.read();
    }
    void restorationPromiseRef.current
      .then((snapshot) => {
        if (!active) return;
        persistenceReadyRef.current = true;
        persistenceWritableRef.current = true;
        setPersistenceReady(true);
        if (generation !== persistenceGenerationRef.current) return;
        if (mutatedBeforeRestoreRef.current) {
          setPersistenceStatus('saving');
          return;
        }
        if (!snapshot) {
          lastPersistedDatasetRef.current = dataset;
          lastPersistedPreferencesRef.current = visualPreferences;
          setPersistenceStatus('saved');
          setPersistenceError(null);
          return;
        }
        const restoredDataset = normalizeSessionDataset(snapshot.dataset);
        lastPersistedDatasetRef.current = restoredDataset;
        lastPersistedPreferencesRef.current = snapshot.visualPreferences;
        setDatasetState(restoredDataset);
        setVisualPreferencesState(snapshot.visualPreferences);
        setPersistenceStatus('saved');
        setPersistenceError(null);
      })
      .catch(async (error: unknown) => {
        let failedOperation: 'read' | 'clear' = 'read';
        if (!active) return;
        if (error instanceof SessionSnapshotValidationError) {
          try {
            await storageRef.current!.clear();
            if (!active) return;
            persistenceReadyRef.current = true;
            persistenceWritableRef.current = true;
            setPersistenceReady(true);
            if (generation !== persistenceGenerationRef.current) return;
            if (mutatedBeforeRestoreRef.current) {
              setPersistenceStatus('saving');
              return;
            }
            lastPersistedDatasetRef.current = dataset;
            lastPersistedPreferencesRef.current = visualPreferences;
            setPersistenceStatus('saved');
            setPersistenceError(null);
            return;
          } catch (clearError) {
            error = clearError;
            failedOperation = 'clear';
          }
        }
        if (!active) return;
        persistenceReadyRef.current = true;
        persistenceWritableRef.current = false;
        setPersistenceReady(true);
        if (generation !== persistenceGenerationRef.current) return;
        setPersistenceStatus('error');
        setPersistenceError(persistenceErrorMessage(failedOperation, error));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!persistenceReady || !persistenceWritableRef.current) return;
    if (
      dataset === lastPersistedDatasetRef.current
      && visualPreferences === lastPersistedPreferencesRef.current
    ) return;
    scheduleWrite(dataset, visualPreferences);
  }, [dataset, persistenceReady, scheduleWrite, visualPreferences]);

  const setResearchDesign = useCallback((design: ResearchDesign | null) => {
    researchDesignRef.current = design;
    setResearchDesignState((current) => {
      const currentFingerprint = current ? fingerprintResearchDesign(current) : null;
      const nextFingerprint = design ? fingerprintResearchDesign(design) : null;
      if (currentFingerprint !== nextFingerprint) setGuidedAnalysis(null);
      return design;
    });
  }, []);

  const setGuidedAnalysisForCurrentDesign = useCallback((analysis: GuidedAnalysisState | null) => {
    const currentDesign = researchDesignRef.current;
    if (
      !analysis ||
      !analysis.design ||
      !currentDesign ||
      fingerprintResearchDesign(analysis.design) !== fingerprintResearchDesign(currentDesign)
    ) {
      setGuidedAnalysis(null);
      return;
    }
    setGuidedAnalysis(analysis);
  }, []);

  const clearSession = useCallback(() => {
    clearPersistedSession();
    setDatasusSession(null);
    setMapSelection(null);
    setMapAnalysis(null);
    researchDesignRef.current = null;
    setResearchDesignState(null);
    setGuidedAnalysis(null);
  }, [clearPersistedSession]);

  // hasData is derived on every render, never stored as its own state — the
  // leave-warning (plan 01-07) depends on this being current, not stale.
  // mapAnalysis alone does NOT set hasData (D-21 — dataset only on handoff).
  const hasData = dataset !== null || datasusSession !== null;
  const hasPersistedCurrentDataset = persistenceStatus === 'saved'
    && dataset === lastPersistedDatasetRef.current
    && visualPreferences === lastPersistedPreferencesRef.current;
  const hasUnsavedChanges = datasusSession !== null
    || (dataset !== null && !hasPersistedCurrentDataset);

  const value = useMemo<SessionApi>(
    () => ({
      dataset,
      datasusSession,
      mapSelection,
      mapAnalysis,
      researchDesign,
      guidedAnalysis,
      hasData,
      visualPreferences,
      persistenceReady,
      persistenceStatus,
      persistenceError,
      hasUnsavedChanges,
      setDataset,
      setDatasusSession,
      setMapSelection,
      setMapAnalysis,
      setResearchDesign,
      setGuidedAnalysis: setGuidedAnalysisForCurrentDesign,
      setVisualPreferences,
      clearSession,
    }),
    [
      dataset,
      datasusSession,
      mapSelection,
      mapAnalysis,
      researchDesign,
      guidedAnalysis,
      hasData,
      visualPreferences,
      persistenceReady,
      persistenceStatus,
      persistenceError,
      hasUnsavedChanges,
      setResearchDesign,
      setGuidedAnalysisForCurrentDesign,
      setVisualPreferences,
      clearSession,
    ],
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
