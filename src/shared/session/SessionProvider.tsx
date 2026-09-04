import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { fingerprintResearchDesign } from '@/features/research/researchDesign';
import type { GuidedAnalysisState, ResearchDesign } from '@/features/research/types';
import type { MapAnalysisState } from '@/routes/mapas/mapAnalysisState';
import {
  StatisticsSessionProvider,
  useStatisticsSession,
  type StatisticsSessionApi,
  type StatisticsSessionProviderProps,
  type StatisticsSessionState,
} from './StatisticsSessionProvider';

export {
  normalizeSessionDataset,
  type SessionDataset,
  type StatisticsSessionApi,
  type StatisticsSessionProviderProps,
  type StatisticsSessionState,
} from './StatisticsSessionProvider';

export interface SessionState extends StatisticsSessionState {
  /** @deprecated Prefer mapAnalysis — kept for Phase 1 backward compat during migration. */
  mapSelection: { ufs: string[]; variables: string[] } | null;
  mapAnalysis: MapAnalysisState | null;
  researchDesign: ResearchDesign | null;
  guidedAnalysis: GuidedAnalysisState | null;
}

export interface SessionApi extends StatisticsSessionApi, SessionState {
  setMapSelection(selection: { ufs: string[]; variables: string[] } | null): void;
  setMapAnalysis(analysis: MapAnalysisState | null): void;
  setResearchDesign(design: ResearchDesign | null): void;
  setGuidedAnalysis(analysis: GuidedAnalysisState | null): void;
  clearSession(): void;
}

export type SessionProviderProps = StatisticsSessionProviderProps;

const SessionContext = createContext<SessionApi | null>(null);

function HistoricalSessionContextProvider({ children }: { children: ReactNode }): ReactElement {
  const statistics = useStatisticsSession();
  const [mapSelection, setMapSelection] = useState<{
    ufs: string[];
    variables: string[];
  } | null>(null);
  const [mapAnalysis, setMapAnalysis] = useState<MapAnalysisState | null>(null);
  const [researchDesign, setResearchDesignState] = useState<ResearchDesign | null>(null);
  const [guidedAnalysis, setGuidedAnalysis] = useState<GuidedAnalysisState | null>(null);
  const researchDesignRef = useRef<ResearchDesign | null>(null);

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
    statistics.clearSession();
    setMapSelection(null);
    setMapAnalysis(null);
    researchDesignRef.current = null;
    setResearchDesignState(null);
    setGuidedAnalysis(null);
  }, [statistics]);

  const value = useMemo<SessionApi>(() => ({
    ...statistics,
    mapSelection,
    mapAnalysis,
    researchDesign,
    guidedAnalysis,
    setMapSelection,
    setMapAnalysis,
    setResearchDesign,
    setGuidedAnalysis: setGuidedAnalysisForCurrentDesign,
    clearSession,
  }), [
    statistics,
    mapSelection,
    mapAnalysis,
    researchDesign,
    guidedAnalysis,
    setResearchDesign,
    setGuidedAnalysisForCurrentDesign,
    clearSession,
  ]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function SessionProvider({ children, storage }: SessionProviderProps): ReactElement {
  return (
    <StatisticsSessionProvider storage={storage}>
      <HistoricalSessionContextProvider>{children}</HistoricalSessionContextProvider>
    </StatisticsSessionProvider>
  );
}

export function useSession(): SessionApi {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
