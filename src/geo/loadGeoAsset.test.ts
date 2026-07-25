import { describe, expect, it } from 'vitest';
import { loadGeoAsset, loadMuniNameTable, loadMuniTopo, loadMesoTopo } from './loadGeoAsset';
import { projectTopoToPaths } from './projectGeoToSvg';

describe('loadGeoAsset', () => {
  it('loads muni-29 fixture via dynamic import without fetch', async () => {
    const topo = await loadMuniTopo('29');
    expect(topo.type).toBe('Topology');
    expect(Object.keys(topo.objects).length).toBeGreaterThan(0);
  });

  it('loads meso sample fixture', async () => {
    const topo = await loadMesoTopo();
    expect(topo.type).toBe('Topology');
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
});

describe('projectGeoToSvg integration', () => {
  it('projects fixture topo to paths with count > 0', async () => {
    const topo = await loadMuniTopo('29');
    const paths = projectTopoToPaths(topo);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0]!.d.length).toBeGreaterThan(0);
  });
});
