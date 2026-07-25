import { describe, expect, it } from 'vitest';
import type { Topology } from 'topojson-specification';
import muniTopoJson from './topo/muni-29.json';
import {
  filterFeaturesByUfPrefix,
  fitExtentToFeatures,
  projectFeaturesToPaths,
  projectTopoToPaths,
  topoToFeatures,
} from './projectGeoToSvg';

const muniTopo = muniTopoJson as unknown as Topology;

describe('projectGeoToSvg', () => {
  it('decodes topo to features', () => {
    const features = topoToFeatures(muniTopo);
    expect(features.length).toBeGreaterThan(100);
  });

  it('projects features to SVG paths with d strings and codarea ids', () => {
    const paths = projectTopoToPaths(muniTopo);
    expect(paths.length).toBeGreaterThan(100);
    paths.forEach((p) => {
      expect(typeof p.d).toBe('string');
      expect(p.d.length).toBeGreaterThan(0);
      expect(p.id).toMatch(/^\d+$/);
    });
  });

  it('fitExtentToFeatures returns a projection for drill viewBox', () => {
    const features = topoToFeatures(muniTopo);
    const projection = fitExtentToFeatures(features);
    expect(typeof projection).toBe('function');
  });

  it('filterFeaturesByUfPrefix scopes meso features to UF', () => {
    const features = topoToFeatures(muniTopo);
    const filtered = filterFeaturesByUfPrefix(features, '29');
    expect(filtered.length).toBe(features.length);
    const other = filterFeaturesByUfPrefix(features, '35');
    expect(other.length).toBe(0);
  });

  it('projectFeaturesToPaths accepts custom extent', () => {
    const features = topoToFeatures(muniTopo);
    const paths = projectFeaturesToPaths(features, [
      [0, 0],
      [400, 300],
    ]);
    expect(paths.length).toBeGreaterThan(100);
  });
});
