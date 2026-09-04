import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
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
  type SessionTestSlot,
} from './sessionStorage';

export type PersistenceMode = 'persistent' | 'memory';

export interface SessionDataset {
  headers: string[];
  rows: string[][];
  sourceLabel: string;
  confirmedAt: number;
  table?: TableDocument;
}

export interface StatisticsSessionState {
  dataset: SessionDataset | null;
  datasusSession: unknown | null;
  visualPreferences: Record<string, unknown>;
  testSlots: Record<string, SessionTestSlot>;
  hasData: boolean;
  persistenceMode: PersistenceMode;
  persistenceReady: boolean;
  persistenceStatus: 'restoring' | 'saving' | 'saved' | 'error';
  persistenceError: string | null;
  hasUnsavedChanges: boolean;
}

export interface StatisticsSessionApi extends StatisticsSessionState {
  setDataset(dataset: SessionDataset | null): void;
  setDatasusSession(session: unknown | null): void;
  setVisualPreferences(preferences: Record<string, unknown>): void;
  switchTest(fromTestId: string, toTestId: string): void;
  setTestSlotMeta(testId: string, meta: {
    confirmedRevision?: number;
    settings?: Record<string, unknown>;
  }): void;
  clearSession(): void;
}

export interface StatisticsSessionProviderProps {
  children: ReactNode;
  storage?: SessionStorageAdapter;
}

const StatisticsSessionContext = createContext<StatisticsSessionApi | null>(null);
const NEVER_PERSISTED = Symbol('never-persisted');

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

export function StatisticsSessionProvider({
  children,
  storage,
}: StatisticsSessionProviderProps): ReactElement {
  const [dataset, setDatasetState] = useState<SessionDataset | null>(null);
  const [datasusSession, setDatasusSession] = useState<unknown | null>(null);
  const [visualPreferences, setVisualPreferencesState] = useState<Record<string, unknown>>({});
  const [testSlots, setTestSlots] = useState<Record<string, SessionTestSlot>>({});
  const [persistenceMode, setPersistenceMode] = useState<PersistenceMode>('persistent');
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<
    StatisticsSessionState['persistenceStatus']
  >('restoring');
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [persistenceWriteSignal, setPersistenceWriteSignal] = useState(0);

  const datasetRef = useRef<SessionDataset | null>(null);
  datasetRef.current = dataset;
  const testSlotsRef = useRef<Record<string, SessionTestSlot>>({});
  testSlotsRef.current = testSlots;
  const mountedRef = useRef(true);
  const persistenceWritableRef = useRef(false);
  const persistenceReadyRef = useRef(false);
  const persistenceGenerationRef = useRef(0);
  const restorationGenerationRef = useRef(persistenceGenerationRef.current);
  const persistenceSequenceRef = useRef(0);
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const restorationPromiseRef = useRef<Promise<SessionSnapshot | null> | null>(null);
  const mutatedBeforeRestoreRef = useRef(false);
  const recoverablePersistenceWarningRef = useRef<string | null>(null);
  const storageRef = useRef<SessionStorageAdapter | null>(null);
  const lastPersistedDatasetRef = useRef<
    SessionDataset | null | typeof NEVER_PERSISTED
  >(NEVER_PERSISTED);
  const lastPersistedPreferencesRef = useRef<
    Record<string, unknown> | typeof NEVER_PERSISTED
  >(NEVER_PERSISTED);
  const lastPersistedTestSlotsRef = useRef<
    Record<string, SessionTestSlot> | typeof NEVER_PERSISTED
  >(NEVER_PERSISTED);

  if (!storageRef.current) storageRef.current = storage ?? createIndexedDbSessionStorage();

  const enablePersistenceWrites = useCallback(() => {
    persistenceWritableRef.current = true;
    if (mountedRef.current) setPersistenceWriteSignal((signal) => signal + 1);
  }, []);

  const markMutationBeforeRestore = useCallback(() => {
    if (!restorationPromiseRef.current || !persistenceReadyRef.current) {
      mutatedBeforeRestoreRef.current = true;
    }
  }, []);

  const setDataset = useCallback((nextDataset: SessionDataset | null) => {
    markMutationBeforeRestore();
    setDatasetState(normalizeSessionDataset(nextDataset));
  }, [markMutationBeforeRestore]);

  const switchTest = useCallback((fromTestId: string, toTestId: string) => {
    if (fromTestId === toTestId) return;
    markMutationBeforeRestore();
    const current = datasetRef.current;
    const next = { ...testSlotsRef.current };
    if (current) next[fromTestId] = { ...(next[fromTestId] ?? {}), dataset: current };
    else delete next[fromTestId];
    testSlotsRef.current = next;
    setTestSlots(next);
    setDatasetState(normalizeSessionDataset(next[toTestId]?.dataset ?? null));
  }, [markMutationBeforeRestore]);

  const setTestSlotMeta = useCallback((
    testId: string,
    meta: { confirmedRevision?: number; settings?: Record<string, unknown> },
  ) => {
    const current = datasetRef.current;
    if (!current) return;
    markMutationBeforeRestore();
    const next = {
      ...testSlotsRef.current,
      [testId]: { ...(testSlotsRef.current[testId] ?? {}), dataset: current, ...meta },
    };
    testSlotsRef.current = next;
    setTestSlots(next);
  }, [markMutationBeforeRestore]);

  const setVisualPreferences = useCallback((preferences: Record<string, unknown>) => {
    if (!isSerializableVisualPreferences(preferences)) {
      setPersistenceStatus('error');
      setPersistenceError('As preferências visuais contêm um valor que não pode ser salvo com segurança.');
      return;
    }
    markMutationBeforeRestore();
    setVisualPreferencesState(preferences);
  }, [markMutationBeforeRestore]);

  const scheduleWrite = useCallback((
    nextDataset: SessionDataset | null,
    nextPreferences: Record<string, unknown>,
    nextTestSlots: Record<string, SessionTestSlot>,
  ) => {
    const generation = persistenceGenerationRef.current;
    const sequence = ++persistenceSequenceRef.current;
    setPersistenceStatus('saving');
    const operation = persistenceQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (
          !mountedRef.current
          || generation !== persistenceGenerationRef.current
          || sequence !== persistenceSequenceRef.current
          || !persistenceWritableRef.current
        ) return;
        const snapshot: SessionSnapshot = {
          version: 1,
          savedAt: Date.now(),
          dataset: nextDataset,
          visualPreferences: nextPreferences,
          ...(Object.keys(nextTestSlots).length ? { testSlots: nextTestSlots } : {}),
        };
        await storageRef.current!.write(snapshot);
        if (
          !mountedRef.current
          || generation !== persistenceGenerationRef.current
          || sequence !== persistenceSequenceRef.current
          || !persistenceWritableRef.current
        ) return;
        lastPersistedDatasetRef.current = nextDataset;
        lastPersistedPreferencesRef.current = nextPreferences;
        lastPersistedTestSlotsRef.current = nextTestSlots;
        recoverablePersistenceWarningRef.current = null;
        setPersistenceStatus('saved');
        setPersistenceError(null);
        setPersistenceWriteSignal((signal) => signal + 1);
      })
      .catch((error: unknown) => {
        if (
          !mountedRef.current
          || generation !== persistenceGenerationRef.current
          || sequence !== persistenceSequenceRef.current
        ) return;
        persistenceWritableRef.current = false;
        recoverablePersistenceWarningRef.current = null;
        setPersistenceMode('memory');
        setPersistenceStatus('error');
        setPersistenceError(persistenceErrorMessage('write', error));
      });
    persistenceQueueRef.current = operation;
  }, []);

  const clearPersistedSession = useCallback(() => {
    const generation = ++persistenceGenerationRef.current;
    const sequence = ++persistenceSequenceRef.current;
    const emptyVisualPreferences: Record<string, unknown> = {};
    const emptyTestSlots: Record<string, SessionTestSlot> = {};
    lastPersistedDatasetRef.current = null;
    lastPersistedPreferencesRef.current = emptyVisualPreferences;
    lastPersistedTestSlotsRef.current = emptyTestSlots;
    setDatasetState(null);
    setTestSlots(emptyTestSlots);
    testSlotsRef.current = emptyTestSlots;
    setVisualPreferencesState(emptyVisualPreferences);
    persistenceWritableRef.current = false;
    setPersistenceStatus('saving');
    setPersistenceError(recoverablePersistenceWarningRef.current);
    const operation = persistenceQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (
          !mountedRef.current
          || generation !== persistenceGenerationRef.current
          || sequence !== persistenceSequenceRef.current
        ) return false;
        await storageRef.current!.clear();
        return true;
      })
      .then((cleared) => {
        if (!cleared || !mountedRef.current) return;
        if (
          generation !== persistenceGenerationRef.current
          || sequence !== persistenceSequenceRef.current
        ) return;
        persistenceReadyRef.current = true;
        enablePersistenceWrites();
        setPersistenceMode('persistent');
        setPersistenceReady(true);
        const warning = recoverablePersistenceWarningRef.current;
        setPersistenceStatus(warning ? 'error' : 'saved');
        setPersistenceError(warning);
      })
      .catch((error: unknown) => {
        if (
          mountedRef.current
          && generation === persistenceGenerationRef.current
          && sequence === persistenceSequenceRef.current
        ) {
          persistenceReadyRef.current = true;
          persistenceWritableRef.current = false;
          recoverablePersistenceWarningRef.current = null;
          setPersistenceMode('memory');
          setPersistenceReady(true);
          setPersistenceStatus('error');
          setPersistenceError(persistenceErrorMessage('clear', error));
        }
      });
    persistenceQueueRef.current = operation;
  }, [enablePersistenceWrites]);

  useEffect(() => {
    let active = true;
    mountedRef.current = true;
    const generation = restorationGenerationRef.current;
    if (!restorationPromiseRef.current) {
      restorationPromiseRef.current = storageRef.current!.read();
    }
    void restorationPromiseRef.current
      .then((snapshot) => {
        if (!active || generation !== persistenceGenerationRef.current) return;
        persistenceReadyRef.current = true;
        enablePersistenceWrites();
        setPersistenceMode('persistent');
        setPersistenceReady(true);
        if (mutatedBeforeRestoreRef.current) {
          setPersistenceStatus('saving');
          return;
        }
        if (!snapshot) {
          lastPersistedDatasetRef.current = dataset;
          lastPersistedPreferencesRef.current = visualPreferences;
          lastPersistedTestSlotsRef.current = testSlots;
          setPersistenceStatus('saved');
          setPersistenceError(null);
          return;
        }
        const restoredDataset = normalizeSessionDataset(snapshot.dataset);
        const restoredTestSlots = snapshot.testSlots ?? {};
        lastPersistedDatasetRef.current = restoredDataset;
        lastPersistedPreferencesRef.current = snapshot.visualPreferences;
        lastPersistedTestSlotsRef.current = restoredTestSlots;
        setDatasetState(restoredDataset);
        setTestSlots(restoredTestSlots);
        testSlotsRef.current = restoredTestSlots;
        setVisualPreferencesState(snapshot.visualPreferences);
        setPersistenceStatus('saved');
        setPersistenceError(null);
      })
      .catch(async (error: unknown) => {
        if (!active || generation !== persistenceGenerationRef.current) return;
        if (error instanceof SessionSnapshotValidationError) {
          const recoverySequence = ++persistenceSequenceRef.current;
          const recoveryOperation = persistenceQueueRef.current
            .catch(() => undefined)
            .then(async () => {
              if (
                !active
                || !mountedRef.current
                || generation !== persistenceGenerationRef.current
                || recoverySequence !== persistenceSequenceRef.current
              ) return false;
              await storageRef.current!.clear();
              return true;
            })
            .then((cleared) => {
              if (
                !cleared
                || !active
                || !mountedRef.current
                || generation !== persistenceGenerationRef.current
                || recoverySequence !== persistenceSequenceRef.current
              ) return;
              persistenceReadyRef.current = true;
              enablePersistenceWrites();
              setPersistenceMode('persistent');
              setPersistenceReady(true);
              const warning = persistenceErrorMessage('read', error);
              recoverablePersistenceWarningRef.current = warning;
              setPersistenceError(warning);
              if (mutatedBeforeRestoreRef.current) {
                setPersistenceStatus('saving');
                return;
              }
              lastPersistedDatasetRef.current = dataset;
              lastPersistedPreferencesRef.current = visualPreferences;
              lastPersistedTestSlotsRef.current = testSlots;
              setPersistenceStatus('error');
            })
            .catch((clearError: unknown) => {
              if (
                !active
                || !mountedRef.current
                || generation !== persistenceGenerationRef.current
                || recoverySequence !== persistenceSequenceRef.current
              ) return;
              persistenceReadyRef.current = true;
              persistenceWritableRef.current = false;
              recoverablePersistenceWarningRef.current = null;
              setPersistenceMode('memory');
              setPersistenceReady(true);
              setPersistenceStatus('error');
              setPersistenceError(persistenceErrorMessage('clear', clearError));
            });
          persistenceQueueRef.current = recoveryOperation;
          await recoveryOperation;
          return;
        }
        if (!active || generation !== persistenceGenerationRef.current) return;
        persistenceReadyRef.current = true;
        persistenceWritableRef.current = false;
        recoverablePersistenceWarningRef.current = null;
        setPersistenceMode('memory');
        setPersistenceReady(true);
        setPersistenceStatus('error');
        setPersistenceError(persistenceErrorMessage('read', error));
      });
    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, [enablePersistenceWrites]);

  useEffect(() => {
    if (!persistenceReady || !persistenceWritableRef.current) return;
    if (
      dataset === lastPersistedDatasetRef.current
      && visualPreferences === lastPersistedPreferencesRef.current
      && testSlots === lastPersistedTestSlotsRef.current
    ) return;
    scheduleWrite(dataset, visualPreferences, testSlots);
  }, [
    dataset,
    persistenceReady,
    persistenceWriteSignal,
    scheduleWrite,
    testSlots,
    visualPreferences,
  ]);

  const clearSession = useCallback(() => {
    clearPersistedSession();
    setDatasusSession(null);
  }, [clearPersistedSession]);

  const hasData = dataset !== null || datasusSession !== null;
  const persistedCurrentState = persistenceStatus === 'saved'
    && dataset === lastPersistedDatasetRef.current
    && visualPreferences === lastPersistedPreferencesRef.current
    && testSlots === lastPersistedTestSlotsRef.current;
  const hasUnsavedChanges = datasusSession !== null
    || ((dataset !== null
      || Object.keys(testSlots).length > 0
      || Object.keys(visualPreferences).length > 0)
      && !persistedCurrentState);

  const value = useMemo<StatisticsSessionApi>(() => ({
    dataset,
    datasusSession,
    visualPreferences,
    testSlots,
    hasData,
    persistenceMode,
    persistenceReady,
    persistenceStatus,
    persistenceError,
    hasUnsavedChanges,
    setDataset,
    setDatasusSession,
    setVisualPreferences,
    switchTest,
    setTestSlotMeta,
    clearSession,
  }), [
    dataset,
    datasusSession,
    visualPreferences,
    testSlots,
    hasData,
    persistenceMode,
    persistenceReady,
    persistenceStatus,
    persistenceError,
    hasUnsavedChanges,
    setDataset,
    setVisualPreferences,
    switchTest,
    setTestSlotMeta,
    clearSession,
  ]);

  return (
    <StatisticsSessionContext.Provider value={value}>
      {children}
    </StatisticsSessionContext.Provider>
  );
}

export function useStatisticsSession(): StatisticsSessionApi {
  const context = useContext(StatisticsSessionContext);
  if (!context) {
    throw new Error(
      'useStatisticsSession must be used within a StatisticsSessionProvider',
    );
  }
  return context;
}
