import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadGeoAsset,
  loadHealthMacroTopo,
  loadMuniNameTable,
  loadMuniTopo,
  loadMesoTopo,
} from './loadGeoAsset';
import { projectTopoToPaths } from './projectGeoToSvg';

describe('loadGeoAsset', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads muni-29 fixture via dynamic import without fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const topo = await loadMuniTopo('29');
    expect(topo.type).toBe('Topology');
    expect(Object.keys(topo.objects).length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('loads meso sample fixture without fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const topo = await loadMesoTopo();
    expect(topo.type).toBe('Topology');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('loads health-macro sample fixture distinct from meso', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const [meso, health] = await Promise.all([loadMesoTopo(), loadHealthMacroTopo()]);
    expect(health.type).toBe('Topology');
    expect(Object.keys(meso.objects)[0]).not.toBe(Object.keys(health.objects)[0]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('loads BA name table', async () => {
    const table = await loadMuniNameTable('BA');
    expect(table.length).toBeGreaterThan(0);
    expect(table[0]).toHaveProperty('id');
    expect(table[0]).toHaveProperty('nome');
  });

  it('unified loader resolves muni kind', async () => {
    const topo = await loadGeoAsset('muni', '29');
    expect((topo as { type: string }).type).toBe('Topology');
  });

  it('throws for unknown UF muni', async () => {
    await expect(loadMuniTopo('99')).rejects.toThrow(/Sem malha municipal/);
  });

  it('throws for UF without committed asset', async () => {
    await expect(loadMuniTopo('35')).rejects.toThrow(/Sem malha municipal/);
  });
});

describe('projectGeoToSvg integration', () => {
  it('projects fixture topo to paths with count > 100 for BA', async () => {
    const topo = await loadMuniTopo('29');
    const paths = projectTopoToPaths(topo);
    expect(paths.length).toBeGreaterThan(100);
    expect(paths[0]!.d.length).toBeGreaterThan(0);
    expect(paths[0]!.id).toMatch(/^\d+$/);
    expect(paths[0]!.properties.codarea).toBeDefined();
  });
});
