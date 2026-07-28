import { listMesoMembership, municipalityIdsForMeso } from '@/geo/mesoMembership';
import { municipioTerritory } from '@/geo/municipioNames';
import {
  REGION_PRESETS,
  resolvePresetTerritories,
  type RegionPresetId,
} from '@/geo/territoryCatalog';
import type { TerritoryRef } from '@/geo/types';
import { UF_LIST } from './ufCodes';
import {
  createInitialMapAnalysisState,
  MAX_GROUPS,
  MAX_TERRITORIES_PER_GROUP,
  type MapAnalysisGroup,
  type MapAnalysisState,
} from './mapAnalysisState';

export type GroupSelectionPresetId =
  | 'regioes'
  | 'ufs'
  | 'ba-mesos'
  | 'ba-munis'
  | 'salvador-metro';

export interface GroupSelectionPresetDef {
  id: GroupSelectionPresetId;
  label: string;
  hint: string;
  /** Approximate group count for the menu subtitle. */
  groupCount: number;
}

export const GROUP_SELECTION_PRESETS: readonly GroupSelectionPresetDef[] = [
  {
    id: 'regioes',
    label: '5 regiões',
    hint: 'Norte, Nordeste, Centro-Oeste, Sudeste e Sul — um grupo cada',
    groupCount: 5,
  },
  {
    id: 'ufs',
    label: '27 estados',
    hint: 'Cada UF vira um grupo (até o limite do workspace)',
    groupCount: 27,
  },
  {
    id: 'ba-mesos',
    label: 'Mesos da Bahia',
    hint: 'Cada mesorregião da BA como um grupo',
    groupCount: 7,
  },
  {
    id: 'ba-munis',
    label: 'Municípios da BA',
    hint: 'Um grupo com os municípios da Bahia',
    groupCount: 1,
  },
  {
    id: 'salvador-metro',
    label: 'Metro Salvador',
    hint: 'Municípios da mesorregião metropolitana de Salvador',
    groupCount: 1,
  },
] as const;

interface GroupSpec {
  name: string;
  territories: TerritoryRef[];
}

function ufTerritories(siglas: readonly string[]): TerritoryRef[] {
  return siglas.map((sigla) => {
    const uf = UF_LIST.find((u) => u.sigla === sigla);
    return {
      level: 'uf' as const,
      ibgeCode: uf?.ibgeCode ?? sigla,
      sigla,
      name: uf?.name ?? sigla,
    };
  });
}

function muniTerritories(ids: readonly string[], ufSigla: string): TerritoryRef[] {
  return ids
    .slice(0, MAX_TERRITORIES_PER_GROUP)
    .map((id) => municipioTerritory(id, ufSigla));
}

function buildSpecs(presetId: GroupSelectionPresetId): GroupSpec[] {
  switch (presetId) {
    case 'regioes':
      return (Object.keys(REGION_PRESETS) as RegionPresetId[]).map((id) => {
        const preset = REGION_PRESETS[id];
        return {
          name: preset.label,
          territories: resolvePresetTerritories(id),
        };
      });
    case 'ufs':
      return UF_LIST.slice(0, MAX_GROUPS).map((uf) => ({
        name: uf.sigla,
        territories: ufTerritories([uf.sigla]),
      }));
    case 'ba-mesos': {
      const mesos = listMesoMembership()
        .filter((m) => m.ufSigla === 'BA')
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
      return mesos.slice(0, MAX_GROUPS).map((meso) => ({
        name: meso.label.replace(/\s*\(BA\)\s*$/, ''),
        territories: muniTerritories(meso.municipalityIds, 'BA'),
      }));
    }
    case 'ba-munis': {
      const ids = listMesoMembership()
        .filter((m) => m.ufSigla === 'BA')
        .flatMap((m) => m.municipalityIds);
      const unique = [...new Set(ids)];
      return [
        {
          name: 'Municípios da Bahia',
          territories: muniTerritories(unique, 'BA'),
        },
      ];
    }
    case 'salvador-metro': {
      const ids = municipalityIdsForMeso('2905');
      return [
        {
          name: 'Metropolitana de Salvador',
          territories: muniTerritories(ids, 'BA'),
        },
      ];
    }
    default:
      return [];
  }
}

function specsToGroups(presetId: GroupSelectionPresetId, specs: GroupSpec[]): MapAnalysisGroup[] {
  return specs.slice(0, MAX_GROUPS).map((spec, index) => ({
    id: `preset-${presetId}-${index + 1}`,
    name: spec.name,
    territoryIds: spec.territories.slice(0, MAX_TERRITORIES_PER_GROUP),
    time: { mode: 'point' as const },
    variableIds: [],
  }));
}

const BA_MAP_VIEW = {
  level: 'municipio' as const,
  parentCode: 'BA',
  ufIbge: '29',
};

/** Build a full analysis state that replaces current groups with the preset. */
export function buildPresetMapState(presetId: GroupSelectionPresetId): MapAnalysisState {
  const groups = specsToGroups(presetId, buildSpecs(presetId));
  const base = createInitialMapAnalysisState();
  const zoomsToBa =
    presetId === 'ba-mesos' || presetId === 'ba-munis' || presetId === 'salvador-metro';
  return {
    ...base,
    groups,
    activeGroupId: groups[0]?.id ?? null,
    mapView: zoomsToBa ? BA_MAP_VIEW : base.mapView,
  };
}
