import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { fingerprintResearchDesign } from '@/features/research/researchDesign';
import type { GuidedAnalysisState, ResearchDesign } from '@/features/research/types';
import type { MapAnalysisState } from '@/routes/mapas/mapAnalysisState';
import {
  createTableDocument,
  isTableDocument,
  type TableDocument,
} from '@/shared/data-input/tableDocument';

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
}

export interface SessionApi extends SessionState {
  setDataset(dataset: SessionDataset | null): void;
  setDatasusSession(session: unknown | null): void;
  setMapSelection(selection: { ufs: string[]; variables: string[] } | null): void;
  setMapAnalysis(analysis: MapAnalysisState | null): void;
  setResearchDesign(design: ResearchDesign | null): void;
  setGuidedAnalysis(analysis: GuidedAnalysisState | null): void;
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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [dataset, setDatasetState] = useState<SessionDataset | null>(null);
  const [datasusSession, setDatasusSession] = useState<unknown | null>(null);
  const [mapSelection, setMapSelection] = useState<{ ufs: string[]; variables: string[] } | null>(
    null,
  );
  const [mapAnalysis, setMapAnalysis] = useState<MapAnalysisState | null>(null);
  const [researchDesign, setResearchDesignState] = useState<ResearchDesign | null>(null);
  const [guidedAnalysis, setGuidedAnalysis] = useState<GuidedAnalysisState | null>(null);
  const researchDesignRef = useRef<ResearchDesign | null>(null);

  const setDataset = useCallback((nextDataset: SessionDataset | null) => {
    setDatasetState(normalizeSessionDataset(nextDataset));
  }, []);

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
    setDataset(null);
    setDatasusSession(null);
    setMapSelection(null);
    setMapAnalysis(null);
    researchDesignRef.current = null;
    setResearchDesignState(null);
    setGuidedAnalysis(null);
  }, []);

  // hasData is derived on every render, never stored as its own state — the
  // leave-warning (plan 01-07) depends on this being current, not stale.
  // mapAnalysis alone does NOT set hasData (D-21 — dataset only on handoff).
  const hasData = dataset !== null || datasusSession !== null;

  const value = useMemo<SessionApi>(
    () => ({
      dataset,
      datasusSession,
      mapSelection,
      mapAnalysis,
      researchDesign,
      guidedAnalysis,
      hasData,
      setDataset,
      setDatasusSession,
      setMapSelection,
      setMapAnalysis,
      setResearchDesign,
      setGuidedAnalysis: setGuidedAnalysisForCurrentDesign,
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
      setResearchDesign,
      setGuidedAnalysisForCurrentDesign,
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
