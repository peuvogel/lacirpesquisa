import { geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Topology } from 'topojson-specification';

export interface ProjectedPath {
  id: string;
  d: string;
  properties: Record<string, unknown>;
}

function objectKey(topo: Topology): string {
  return Object.keys(topo.objects)[0]!;
}

/** Decode TopoJSON to GeoJSON FeatureCollection. */
export function topoToFeatures(topo: Topology): Feature[] {
  const key = objectKey(topo);
  const collection = feature(topo, topo.objects[key]!) as FeatureCollection;
  return collection.features;
}

/** Project GeoJSON features to SVG path strings. */
export function projectFeaturesToPaths(
  features: Feature<Geometry>[],
  bounds?: [[number, number], [number, number]],
): ProjectedPath[] {
  const projection: GeoProjection = geoMercator();
  const pathGen = geoPath(projection);

  if (bounds) {
    projection.fitExtent(
      [
        [0, 0],
        [800, 600],
      ],
      { type: 'FeatureCollection', features } as FeatureCollection,
    );
  } else if (features.length > 0) {
    projection.fitExtent(
      [
        [0, 0],
        [800, 600],
      ],
      { type: 'FeatureCollection', features } as FeatureCollection,
    );
  }

  return features.map((feat) => {
    const props = (feat.properties ?? {}) as Record<string, unknown>;
    const id = String(props.codarea ?? props.id ?? props.name ?? '');
    return {
      id,
      d: pathGen(feat) ?? '',
      properties: props,
    };
  });
}

/** Load TopoJSON and project to SVG paths in one step. */
export function projectTopoToPaths(topo: Topology): ProjectedPath[] {
  const features = topoToFeatures(topo);
  return projectFeaturesToPaths(features);
}
