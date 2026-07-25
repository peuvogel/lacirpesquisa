import { useCallback, useMemo, useReducer, useRef } from 'react';
import { parseDatasusText } from './datasusImporter';
import { normalizeDatasusSource, suggestTestsForSources } from './datasusNormalizer';
import { legacyStats, legacyUtils } from './legacyAdapters';
import type {
  DatasusDiagnosis,
  DatasusFormatType,
  DatasusMapping,
  DatasusParsedOk,
  DatasusSource,
  DatasusVariableType,
  NormalizedDatasusResult,
} from './types';

export const DATASUS_COLUMN_ROLES = [
  { value: 'primary-category', label: 'Dimensão principal' },
  { value: 'category', label: 'Categoria extra' },
  { value: 'time', label: 'Temporal' },
  { value: 'measure', label: 'Quantitativa' },
  { value: 'total', label: 'Total/agregado' },
  { value: 'ignore', label: 'Ignorar' },
] as const;

export const DATASUS_VARIABLE_TYPES = [
  { value: 'categorical', label: 'Categórica' },
  { value: 'temporal', label: 'Temporal' },
  { value: 'quantitative', label: 'Quantitativa' },
  { value: 'total', label: 'Total/agregado' },
  { value: 'metadata', label: 'Metadado' },
] as const;

export interface DatasusPublicSource {
  id: string;
  fileName: string;
  sourceKind?: string;
  confirmed: boolean;
  diagnosis: DatasusDiagnosis | undefined;
  mapping: DatasusMapping | null;
  normalized: NormalizedDatasusResult | undefined;
}

export interface DatasusSession {
  sources: DatasusPublicSource[];
  confirmedSources: DatasusPublicSource[];
  activeSourceId: string;
  suggestions: string[];
  status: { tone: 'status' | 'success' | 'error'; message: string };
}

export interface UseDatasusWizardOptions {
  onSessionChange?: (session: DatasusSession) => void;
}

interface InternalSource {
  id: string;
  fileName: string;
  rawText: string;
  sourceKind?: string;
  parsed: DatasusParsedOk;
  mapping: DatasusMapping;
  confirmed: boolean;
  normalized: NormalizedDatasusResult;
}

interface WizardState {
  nextId: number;
  sources: InternalSource[];
  activeSourceId: string;
  statusTone: 'status' | 'success' | 'error';
  statusMessage: string;
}

type WizardAction =
  | { type: 'REPLACE'; state: WizardState }
  | { type: 'PATCH'; patch: Partial<WizardState> };

const INITIAL_STATUS_MESSAGE = 'Importe um ou mais arquivos DATASUS para iniciar o assistente.';

function clonePlain<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function roleToType(role: string): DatasusVariableType {
  if (role === 'primary-category' || role === 'category') return 'categorical';
  if (role === 'time') return 'temporal';
  if (role === 'measure') return 'quantitative';
  if (role === 'total') return 'total';
  return 'metadata';
}

function publicSource(source: InternalSource): DatasusPublicSource {
  return {
    id: source.id,
    fileName: source.fileName,
    sourceKind: source.sourceKind,
    confirmed: source.confirmed,
    diagnosis: clonePlain(source.parsed.diagnosis),
    mapping: clonePlain(source.mapping),
    normalized: clonePlain(source.normalized),
  };
}

function toHookSource(source: InternalSource): DatasusSource {
  return {
    id: source.id,
    fileName: source.fileName,
    rawText: source.rawText,
    parsed: source.parsed,
    mapping: source.mapping,
    confirmed: source.confirmed,
    normalized: source.normalized,
  };
}

function buildSession(state: WizardState): DatasusSession {
  const hookSources = state.sources.map(toHookSource);
  const sources = state.sources.map(publicSource);
  const confirmedSources = sources.filter((source) => source.confirmed && source.normalized?.ok);
  const suggestedHookSources = confirmedSources.length
    ? hookSources.filter((source) => source.confirmed && source.normalized?.ok)
    : hookSources.filter((source) => source.normalized?.ok);

  return {
    sources,
    confirmedSources,
    activeSourceId: state.activeSourceId,
    suggestions: suggestTestsForSources(suggestedHookSources),
    status: {
      tone: state.statusTone,
      message: state.statusMessage,
    },
  };
}

function setSourceNormalized(source: InternalSource): void {
  source.normalized = normalizeDatasusSource(toHookSource(source), legacyUtils, legacyStats);
}

function reparseSource(source: InternalSource, headerRowIndex: number | null = null): void {
  const parsed = parseDatasusText({
    text: source.rawText,
    fileName: source.fileName,
    utils: legacyUtils,
    stats: legacyStats,
    headerRowIndex,
  });

  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  source.parsed = parsed;
  source.mapping = clonePlain(parsed.initialMapping);
  source.confirmed = false;
  setSourceNormalized(source);
}

function createInitialState(): WizardState {
  return {
    nextId: 1,
    sources: [],
    activeSourceId: '',
    statusTone: 'status',
    statusMessage: INITIAL_STATUS_MESSAGE,
  };
}

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  if (action.type === 'REPLACE') return action.state;
  return { ...state, ...action.patch };
}

function cloneSource(source: InternalSource): InternalSource {
  return clonePlain(source);
}

function findSource(state: WizardState, id: string): InternalSource | undefined {
  return state.sources.find((source) => source.id === id);
}

function replaceSource(state: WizardState, updated: InternalSource): WizardState {
  return {
    ...state,
    sources: state.sources.map((source) => (source.id === updated.id ? updated : source)),
  };
}

export function headerSelectOptions(source: InternalSource | DatasusSource): Array<{ rowIndex: number; preview: string }> {
  const parsed = source.parsed;
  if (!parsed || !parsed.ok) return [];

  const topCandidates = parsed.headerCandidates.slice(0, 12).map((candidate) => candidate.rowIndex);
  const previewLines = parsed.lines.slice(0, 20).map((line) => line.index);
  const uniqueLineIndexes = [...new Set([...topCandidates, ...previewLines, parsed.headerRowIndex])].sort(
    (left, right) => left - right,
  );

  return uniqueLineIndexes.map((lineIndex) => {
    const line = parsed.lines.find((item) => item.index === lineIndex);
    return {
      rowIndex: lineIndex,
      preview: line?.clean || line?.raw || `Linha ${lineIndex + 1}`,
    };
  });
}

export function useDatasusWizard(options: UseDatasusWizardOptions = {}) {
  const [state, dispatch] = useReducer(wizardReducer, undefined, createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const onSessionChangeRef = useRef(options.onSessionChange);
  onSessionChangeRef.current = options.onSessionChange;

  const notify = useCallback((nextState: WizardState) => {
    onSessionChangeRef.current?.(buildSession(nextState));
  }, []);

  const commit = useCallback(
    (nextState: WizardState) => {
      dispatch({ type: 'REPLACE', state: nextState });
      notify(nextState);
    },
    [notify],
  );

  const session = useMemo(() => buildSession(state), [state]);

  const activeSource = useMemo(() => {
    const found = state.sources.find((source) => source.id === state.activeSourceId);
    return found ?? state.sources[0] ?? null;
  }, [state.sources, state.activeSourceId]);

  const addTextSources = useCallback(
    async (
      sources: { rawText: string; fileName?: string; sourceKind?: string }[],
      successMessage = 'Fonte DATASUS carregada.',
    ) => {
      const current = stateRef.current;
      let nextId = current.nextId;
      const nextSources = [...current.sources];
      const failures: string[] = [];
      let loadedCount = 0;
      let activeSourceId = current.activeSourceId;

      sources.forEach((item) => {
        const source: InternalSource = {
          id: `datasus-source-${nextId + 1}`,
          fileName: item.fileName || `fonte-datasus-${nextId + 1}.txt`,
          rawText: item.rawText || '',
          sourceKind: item.sourceKind || 'example',
          parsed: {} as DatasusParsedOk,
          mapping: {} as DatasusMapping,
          confirmed: false,
          normalized: { ok: false, errors: [], records: [], schema: {} as never, summary: {} as never },
        };

        try {
          nextId += 1;
          reparseSource(source);
          nextSources.push(source);
          loadedCount += 1;
          if (!activeSourceId) activeSourceId = source.id;
        } catch (error) {
          console.error(`[useDatasusWizard] Falha ao preparar ${source.fileName}.`, error);
          failures.push(
            `${source.fileName}: ${error instanceof Error ? error.message : 'Nao foi possivel interpretar a fonte DATASUS.'}`,
          );
        }
      });

      let statusTone: WizardState['statusTone'] = current.statusTone;
      let statusMessage = current.statusMessage;

      if (loadedCount && failures.length) {
        activeSourceId = activeSourceId || nextSources[0]?.id || '';
        statusTone = 'status';
        statusMessage = `${successMessage} Alguns itens precisaram de revisão: ${failures.join(' | ')}`;
      } else if (loadedCount) {
        activeSourceId = activeSourceId || nextSources[0]?.id || '';
        statusTone = 'success';
        statusMessage = successMessage;
      } else if (failures.length) {
        statusTone = 'error';
        statusMessage = failures.join(' | ');
      }

      commit({
        ...current,
        nextId,
        sources: nextSources,
        activeSourceId,
        statusTone,
        statusMessage,
      });
    },
    [commit],
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const current = stateRef.current;

      const loaded = await Promise.all(
        fileArray.map(async (file) => {
          try {
            const text = await legacyUtils.readFileText(file);
            return {
              ok: true as const,
              fileName: file.name,
              rawText: text,
              sourceKind: 'upload' as const,
            };
          } catch {
            return {
              ok: false as const,
              fileName: file.name,
              error: 'Nao foi possivel ler o arquivo selecionado.',
            };
          }
        }),
      );

      const failures = loaded.filter((item) => !item.ok);
      let nextId = current.nextId;
      const nextSources = [...current.sources];
      const addedSources: InternalSource[] = [];

      loaded
        .filter((item): item is Extract<(typeof loaded)[number], { ok: true }> => item.ok)
        .forEach((item) => {
          const source: InternalSource = {
            id: `datasus-source-${nextId + 1}`,
            fileName: item.fileName,
            rawText: item.rawText,
            sourceKind: item.sourceKind,
            parsed: {} as DatasusParsedOk,
            mapping: {} as DatasusMapping,
            confirmed: false,
            normalized: { ok: false, errors: [], records: [], schema: {} as never, summary: {} as never },
          };

          try {
            nextId += 1;
            reparseSource(source);
            nextSources.push(source);
            addedSources.push(source);
          } catch (error) {
            console.error(`[useDatasusWizard] Falha ao interpretar ${item.fileName}.`, error);
            failures.push({
              ok: false,
              fileName: item.fileName,
              error: error instanceof Error ? error.message : 'Nao foi possivel interpretar o arquivo DATASUS.',
            });
          }
        });

      let activeSourceId = current.activeSourceId;
      if (addedSources.length) {
        activeSourceId = addedSources[0].id;
      }

      let statusTone: WizardState['statusTone'] = current.statusTone;
      let statusMessage = current.statusMessage;

      if (addedSources.length && failures.length) {
        statusTone = 'status';
        statusMessage = `${addedSources.length} arquivo(s) DATASUS carregado(s). Alguns itens precisaram de revisão: ${failures.map((item) => `${item.fileName}: ${item.error}`).join(' | ')}`;
      } else if (addedSources.length) {
        statusTone = 'success';
        statusMessage = `${addedSources.length} arquivo(s) DATASUS carregado(s). Revise o mapeamento antes de confirmar.`;
      } else if (failures.length) {
        statusTone = 'error';
        statusMessage = failures.map((item) => `${item.fileName}: ${item.error}`).join(' | ');
      }

      commit({
        ...current,
        nextId,
        sources: nextSources,
        activeSourceId,
        statusTone,
        statusMessage,
      });
    },
    [commit],
  );

  const selectSource = useCallback(
    (id: string) => {
      commit({ ...stateRef.current, activeSourceId: id });
    },
    [commit],
  );

  const removeSource = useCallback(
    (id: string) => {
      const current = stateRef.current;
      const nextSources = current.sources.filter((source) => source.id !== id);
      let activeSourceId = current.activeSourceId;
      if (activeSourceId === id) {
        activeSourceId = nextSources[0]?.id || '';
      }

      commit({
        ...current,
        sources: nextSources,
        activeSourceId,
        statusTone: nextSources.length ? current.statusTone : 'status',
        statusMessage: nextSources.length ? current.statusMessage : INITIAL_STATUS_MESSAGE,
      });
    },
    [commit],
  );

  const setHeaderRow = useCallback(
    (id: string, headerRowIndex: number) => {
      const current = stateRef.current;
      const existing = findSource(current, id);
      if (!existing) return;

      const source = cloneSource(existing);
      reparseSource(source, headerRowIndex);

      commit({
        ...replaceSource(current, source),
        statusTone: 'status',
        statusMessage: `Cabecalho atualizado para a linha ${source.parsed.headerRowIndex + 1}.`,
      });
    },
    [commit],
  );

  const setFormat = useCallback(
    (id: string, format: string) => {
      const current = stateRef.current;
      const existing = findSource(current, id);
      if (!existing) return;

      const source = cloneSource(existing);
      source.mapping.formatType = format as DatasusFormatType;
      source.confirmed = false;
      setSourceNormalized(source);

      commit({
        ...replaceSource(current, source),
        statusTone: 'status',
        statusMessage: `Formato ajustado manualmente para ${source.mapping.formatType}.`,
      });
    },
    [commit],
  );

  const setColumnRole = useCallback(
    (id: string, columnIndex: number, role: string) => {
      const current = stateRef.current;
      const existing = findSource(current, id);
      if (!existing) return;

      const source = cloneSource(existing);
      const targetColumn = source.mapping.columns.find((column) => column.index === columnIndex);
      if (!targetColumn) return;

      if (role === 'primary-category') {
        source.mapping.columns.forEach((column) => {
          if (column.role === 'primary-category') column.role = 'category';
        });
      }

      targetColumn.role = role as InternalSource['mapping']['columns'][number]['role'];
      targetColumn.variableType = roleToType(targetColumn.role);
      source.confirmed = false;
      setSourceNormalized(source);

      commit({
        ...replaceSource(current, source),
        statusTone: 'status',
        statusMessage: `Papel da coluna ${targetColumn.header} atualizado.`,
      });
    },
    [commit],
  );

  const setColumnType = useCallback(
    (id: string, columnIndex: number, variableType: string) => {
      const current = stateRef.current;
      const existing = findSource(current, id);
      if (!existing) return;

      const source = cloneSource(existing);
      const targetColumn = source.mapping.columns.find((column) => column.index === columnIndex);
      if (!targetColumn) return;

      targetColumn.variableType = variableType as DatasusVariableType;
      source.confirmed = false;
      setSourceNormalized(source);

      commit({
        ...replaceSource(current, source),
        statusTone: 'status',
        statusMessage: `Tipo da coluna ${targetColumn.header} atualizado.`,
      });
    },
    [commit],
  );

  const confirmSource = useCallback(
    (id: string) => {
      const current = stateRef.current;
      const existing = findSource(current, id);
      if (!existing || !existing.normalized?.ok) return;

      const source = cloneSource(existing);
      source.confirmed = true;

      commit({
        ...replaceSource(current, source),
        statusTone: 'success',
        statusMessage: `${source.fileName} foi confirmado como base DATASUS normalizada.`,
      });
    },
    [commit],
  );

  const reset = useCallback(() => {
    const nextState = createInitialState();
    commit(nextState);
  }, [commit]);

  return {
    sources: state.sources.map(toHookSource),
    activeSource: activeSource ? toHookSource(activeSource) : null,
    activeSourceId: state.activeSourceId,
    status: { tone: state.statusTone, message: state.statusMessage },
    session,
    addFiles,
    addTextSources,
    selectSource,
    removeSource,
    setHeaderRow,
    setFormat,
    setColumnRole,
    setColumnType,
    confirmSource,
    reset,
  };
}
