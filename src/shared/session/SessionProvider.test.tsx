import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createInitialMapAnalysisState } from '@/routes/mapas/mapAnalysisState';
import { fingerprintResearchDesign } from '@/features/research/researchDesign';
import type { GuidedAnalysisState, ResearchDesign } from '@/features/research/types';
import { SessionProvider, useSession, type SessionDataset } from './SessionProvider';

function renderSession() {
  return renderHook(() => useSession(), {
    wrapper: ({ children }) => <SessionProvider>{children}</SessionProvider>,
  });
}

const sampleDataset: SessionDataset = {
  headers: ['UF', 'Valor'],
  rows: [['BA', '10']],
  sourceLabel: 'colado',
  confirmedAt: Date.now(),
};

const sampleDesign: ResearchDesign = {
  groups: [{ id: 'g1', name: 'Grupo 1', territories: [{ id: '29', label: 'Bahia' }] }],
  geography: 'uf',
  locationBasis: 'ocorrencia',
  diseaseIds: ['embolia_e_trombose_arteriais'],
  period: { scope: 'shared', time: { mode: 'point', point: '2020' } },
};

const guidedResults: GuidedAnalysisState = {
  design: sampleDesign,
  selectedVariableIds: ['internacoes'],
  scenario: null,
  eligibility: [],
  resultsFingerprint: fingerprintResearchDesign(sampleDesign),
};

describe('SessionProvider / useSession', () => {
  let storageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // localStorage and sessionStorage share Storage.prototype in jsdom, so one
    // spy on the shared prototype method covers both APIs.
    storageSpy = vi.spyOn(Storage.prototype, 'setItem');
  });

  afterEach(() => {
    storageSpy.mockRestore();
  });

  it('starts with hasData false and all slices null', () => {
    const { result } = renderSession();
    expect(result.current.hasData).toBe(false);
    expect(result.current.dataset).toBeNull();
    expect(result.current.datasusSession).toBeNull();
    expect(result.current.mapSelection).toBeNull();
    expect(result.current.mapAnalysis).toBeNull();
  });

  it('composes active persistence state with the historical session slices', () => {
    const { result } = renderSession();

    expect(result.current).toMatchObject({
      testSlots: {},
      persistenceMode: 'persistent',
      mapSelection: null,
      mapAnalysis: null,
      researchDesign: null,
      guidedAnalysis: null,
    });
  });

  it('flips hasData to true when a dataset is set', () => {
    const { result } = renderSession();
    act(() => {
      result.current.setDataset(sampleDataset);
    });
    expect(result.current.hasData).toBe(true);
    expect(result.current.dataset).toMatchObject(sampleDataset);
    expect(result.current.dataset?.table).toBeDefined();
  });

  it('normalizes a legacy handoff to one stable TableDocument at the provider boundary', () => {
    const { result } = renderSession();
    act(() => result.current.setDataset(sampleDataset));
    const firstTable = result.current.dataset!.table;
    act(() => result.current.setDataset({ ...result.current.dataset!, rows: [['SP', '11']] }));

    expect(firstTable).toBeDefined();
    expect(result.current.dataset!.table).toBe(firstTable);
    expect(result.current.dataset!.headers).toEqual(['UF', 'Valor']);
  });

  it('flips hasData to true when a datasusSession is set alone', () => {
    const { result } = renderSession();
    act(() => {
      result.current.setDatasusSession({ confirmedSources: [] });
    });
    expect(result.current.hasData).toBe(true);
  });

  it('clearSession resets everything to null and hasData to false', () => {
    const { result } = renderSession();
    act(() => {
      result.current.setDataset(sampleDataset);
      result.current.setDatasusSession({ confirmedSources: [] });
      result.current.setMapSelection({ ufs: ['BA'], variables: ['obitos'] });
      result.current.setMapAnalysis(createInitialMapAnalysisState());
      result.current.setResearchDesign(sampleDesign);
      result.current.setGuidedAnalysis(guidedResults);
    });
    expect(result.current.hasData).toBe(true);

    act(() => {
      result.current.clearSession();
    });

    expect(result.current.dataset).toBeNull();
    expect(result.current.datasusSession).toBeNull();
    expect(result.current.mapSelection).toBeNull();
    expect(result.current.mapAnalysis).toBeNull();
    expect(result.current.researchDesign).toBeNull();
    expect(result.current.guidedAnalysis).toBeNull();
    expect(result.current.hasData).toBe(false);
  });

  it('setMapAnalysis persists without flipping hasData (D-21)', () => {
    const { result } = renderSession();
    const analysis = createInitialMapAnalysisState();
    act(() => {
      result.current.setMapAnalysis(analysis);
    });
    expect(result.current.mapAnalysis).toEqual(analysis);
    expect(result.current.hasData).toBe(false);
  });

  it('discards guided results when the research design fingerprint changes', () => {
    const { result } = renderSession();
    act(() => {
      result.current.setResearchDesign(sampleDesign);
      result.current.setGuidedAnalysis(guidedResults);
    });

    act(() => {
      result.current.setResearchDesign({
        ...sampleDesign,
        period: { scope: 'shared', time: { mode: 'point', point: '2021' } },
      });
    });

    expect(result.current.researchDesign?.period).toEqual({
      scope: 'shared',
      time: { mode: 'point', point: '2021' },
    });
    expect(result.current.guidedAnalysis).toBeNull();
  });

  it('rejects guided analysis that belongs to a different research design', () => {
    const { result } = renderSession();
    const otherDesign: ResearchDesign = {
      ...sampleDesign,
      period: { scope: 'shared', time: { mode: 'point', point: '2021' } },
    };

    act(() => {
      result.current.setResearchDesign(sampleDesign);
      result.current.setGuidedAnalysis({ ...guidedResults, design: otherDesign });
    });

    expect(result.current.guidedAnalysis).toBeNull();
  });

  it('preserves guided analysis when a semantically equivalent design is reassigned', () => {
    const { result } = renderSession();
    act(() => {
      result.current.setResearchDesign(sampleDesign);
      result.current.setGuidedAnalysis(guidedResults);
      result.current.setResearchDesign({
        ...sampleDesign,
        diseaseIds: [...sampleDesign.diseaseIds].reverse(),
      });
    });

    expect(result.current.guidedAnalysis).toEqual(guidedResults);
  });

  it('throws a descriptive error when used outside a provider', () => {
    expect(() => renderHook(() => useSession())).toThrow(
      'useSession must be used within a SessionProvider',
    );
  });

  it('never touches localStorage or sessionStorage', () => {
    const { result } = renderSession();
    act(() => {
      result.current.setDataset(sampleDataset);
      result.current.setDatasusSession({ confirmedSources: [] });
      result.current.setMapSelection({ ufs: ['BA'], variables: ['obitos'] });
      result.current.clearSession();
    });
    expect(storageSpy).not.toHaveBeenCalled();
  });
});
