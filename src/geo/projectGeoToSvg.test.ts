import { describe, expect, it } from 'vitest';
import type { Topology } from 'topojson-specification';
import muniTopoJson from './topo/muni-29.json';
import { projectTopoToPaths, topoToFeatures } from './projectGeoToSvg';

const muniTopo = muniTopoJson as unknown as Topology;

describe('projectGeoToSvg', () => {
  it('decodes topo to features', () => {
    const features = topoToFeatures(muniTopo);
    expect(features.length).toBeGreaterThan(0);
  });

  it('projects features to SVG paths with d strings', () => {
    const paths = projectTopoToPaths(muniTopo);
    expect(paths.length).toBeGreaterThan(0);
    paths.forEach((p) => {
      expect(typeof p.d).toBe('string');
      expect(p.d.length).toBeGreaterThan(0);
    });
  });
});
