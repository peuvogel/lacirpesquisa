import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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
  });

  it('flips hasData to true when a dataset is set', () => {
    const { result } = renderSession();
    act(() => {
      result.current.setDataset(sampleDataset);
    });
    expect(result.current.hasData).toBe(true);
    expect(result.current.dataset).toEqual(sampleDataset);
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
    });
    expect(result.current.hasData).toBe(true);

    act(() => {
      result.current.clearSession();
    });

    expect(result.current.dataset).toBeNull();
    expect(result.current.datasusSession).toBeNull();
    expect(result.current.mapSelection).toBeNull();
    expect(result.current.hasData).toBe(false);
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
