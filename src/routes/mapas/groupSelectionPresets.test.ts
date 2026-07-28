import { describe, expect, it } from 'vitest';
import { buildPresetMapState } from './groupSelectionPresets';

describe('buildPresetMapState', () => {
  it('builds one group per grande região', () => {
    const state = buildPresetMapState('regioes');
    expect(state.groups).toHaveLength(5);
    expect(state.groups.map((g) => g.name)).toEqual([
      'Norte',
      'Nordeste',
      'Centro-Oeste',
      'Sudeste',
      'Sul',
    ]);
    expect(state.activeGroupId).toBe(state.groups[0]!.id);
  });

  it('builds one group per UF', () => {
    const state = buildPresetMapState('ufs');
    expect(state.groups).toHaveLength(27);
    expect(state.groups[0]!.territoryIds[0]?.sigla).toBeTruthy();
  });

  it('builds Bahia mesoregion groups when membership is available', () => {
    const state = buildPresetMapState('ba-mesos');
    expect(state.groups.length).toBeGreaterThan(0);
    expect(state.groups.every((g) => g.territoryIds.every((t) => t.level === 'municipio'))).toBe(
      true,
    );
    expect(state.mapView).toEqual({ level: 'municipio', parentCode: 'BA', ufIbge: '29' });
  });

  it('builds a single Bahia municipalities group', () => {
    const state = buildPresetMapState('ba-munis');
    expect(state.groups).toHaveLength(1);
    expect(state.groups[0]!.name).toMatch(/Bahia/i);
    expect(state.groups[0]!.territoryIds.length).toBeGreaterThan(10);
    expect(state.mapView.parentCode).toBe('BA');
  });
});
