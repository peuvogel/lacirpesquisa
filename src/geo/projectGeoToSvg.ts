import { geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Topology } from 'topojson-specification';

export interface ProjectedPath {
  id: string;
  d: string;
  properties: Record<string, unknown>;
}

export type SvgExtent = [[number, number], [number, number]];

export const DEFAULT_SVG_EXTENT: SvgExtent = [
  [0, 0],
  [800, 600],
];

function objectKey(topo: Topology): string {
  return Object.keys(topo.objects)[0]!;
}

/** Decode TopoJSON to GeoJSON FeatureCollection. */
export function topoToFeatures(topo: Topology): Feature[] {
  const key = objectKey(topo);
  const collection = feature(topo, topo.objects[key]!) as FeatureCollection;
  return collection.features;
}

/** Fit a Mercator projection to features within an SVG extent (drill-down viewBox). */
export function fitExtentToFeatures(
  features: Feature<Geometry>[],
  extent: SvgExtent = DEFAULT_SVG_EXTENT,
): GeoProjection {
  const projection = geoMercator();
  if (features.length > 0) {
    projection.fitExtent(extent, { type: 'FeatureCollection', features } as FeatureCollection);
  }
  return projection;
}

/** Filter features whose codarea starts with a UF IBGE prefix (meso drill scoping). */
export function filterFeaturesByUfPrefix(features: Feature[], ufIbge: string): Feature[] {
  return features.filter((feat) => {
    const codarea = String((feat.properties as Record<string, unknown> | null)?.codarea ?? '');
    return codarea.startsWith(ufIbge);
  });
}

/** Project GeoJSON features to SVG path strings. */
export function projectFeaturesToPaths(
  features: Feature<Geometry>[],
  extent: SvgExtent = DEFAULT_SVG_EXTENT,
): ProjectedPath[] {
  const projection = fitExtentToFeatures(features, extent);
  const pathGen = geoPath(projection);

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
