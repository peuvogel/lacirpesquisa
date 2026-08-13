import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ResearchDataSnapshot } from '@/features/research/supabaseResearchRepository';
import type { ResearchDesign } from '@/features/research/types';
import {
  buildGuidedResearchData,
  buildGuidedSelectionModel,
  useGuidedResearch,
} from './useGuidedResearch';

const design: ResearchDesign = {
  groups: [
    {
      id: 'a',
      name: 'Grupo A',
      territories: [
        { id: '29', label: 'Bahia' },
        { id: '28', label: 'Sergipe' },
        { id: '27', label: 'Alagoas' },
      ],
    },
    {
      id: 'b',
      name: 'Grupo B',
      territories: [
        { id: '35', label: 'São Paulo' },
        { id: '33', label: 'Rio de Janeiro' },
        { id: '31', label: 'Minas Gerais' },
      ],
    },
  ],
  geography: 'uf',
  locationBasis: 'ocorrencia',
  diseaseIds: ['doenca_teste'],
  period: { scope: 'shared', time: { mode: 'point', point: '2025' } },
};

function snapshot(missingTerritory?: string): ResearchDataSnapshot {
  const territories = design.groups.flatMap((group) =>
    group.territories.map((territory) => ({ ...territory, groupId: group.id })),
  );
  return {
    fingerprint: 'snapshot:fixture',
    errors: [],
    cells: territories.flatMap((territory, index) => {
      const missing = territory.id === missingTerritory;
      const internacoes = 100 + index * 10;
      const obitos = 2 + index;
      return [
        {
          diseaseId: 'doenca_teste', territoryId: territory.id, groupId: territory.groupId,
          periodKey: '2025', variableId: 'internacoes', rawValue: missing ? null : internacoes,
          sourceStatus: missing ? 'missing' as const : 'observed' as const,
        },
        {
          diseaseId: 'doenca_teste', territoryId: territory.id, groupId: territory.groupId,
          periodKey: '2025', variableId: 'obitos', rawValue: missing ? null : obitos,
          sourceStatus: missing ? 'missing' as const : 'observed' as const,
        },
        {
          diseaseId: 'doenca_teste', territoryId: territory.id, groupId: territory.groupId,
          periodKey: '2025', variableId: 'populacao', rawValue: 1_000_000 + index * 25_000,
          sourceStatus: 'observed' as const,
        },
        {
          diseaseId: 'doenca_teste', territoryId: territory.id, groupId: territory.groupId,
          periodKey: '2025', variableId: 'valor_total', rawValue: null,
          sourceStatus: 'missing' as const,
        },
        {
          diseaseId: 'doenca_teste', territoryId: territory.id, groupId: territory.groupId,
          periodKey: '2025', variableId: 'dias_permanencia', rawValue: 300 + index * 20,
          sourceStatus: 'observed' as const,
        },
      ];
    }),
  };
}

describe('guided research orchestration', () => {
  it('derives concise complete/partial/none availability from the real snapshot', () => {
    const data = buildGuidedResearchData(design, snapshot('28'));
    const internacoes = data.variables.find((variable) => variable.id === 'internacoes');
    const valorTotal = data.variables.find((variable) => variable.id === 'valor_total');

    expect(internacoes).toMatchObject({ availability: 'partial' });
    expect(internacoes?.availabilityReason).toMatch(/Sergipe.*2025/i);
    expect(valorTotal).toMatchObject({ availability: 'none' });
    expect(valorTotal?.availabilityReason).toMatch(/Nenhum valor utilizável/i);
  });

  it('keeps IBGE territory ids out of years and caps large availability explanations', () => {
    const rangeDesign: ResearchDesign = {
      ...design,
      groups: [{
        id: 'nordeste',
        name: 'Nordeste',
        territories: [
          { id: '21', label: 'Maranhão' },
          { id: '22', label: 'Piauí' },
          { id: '23', label: 'Ceará' },
          { id: '24', label: 'Rio Grande do Norte' },
        ],
      }],
      period: { scope: 'shared', time: { mode: 'range', start: '2013', end: '2025' } },
    };
    const cells = rangeDesign.groups[0]!.territories.flatMap((territory) =>
      Array.from({ length: 13 }, (_, index) => ({
        diseaseId: 'doenca_teste',
        territoryId: territory.id,
        groupId: 'nordeste',
        periodKey: String(2013 + index),
        variableId: 'valor_total',
        rawValue: null,
        sourceStatus: 'not_applicable' as const,
      })),
    );

    const data = buildGuidedResearchData(rangeDesign, {
      fingerprint: 'snapshot:large-absence',
      errors: [],
      cells,
    });
    const reason = data.variables.find((variable) => variable.id === 'valor_total')?.availabilityReason ?? '';

    expect(reason).toContain('Maranhão');
    expect(reason).not.toContain('20Maranhão');
    expect(reason.match(/Maranhão/g)).toHaveLength(1);
    expect(reason).toMatch(/Piauí e mais 2 territórios/i);
    expect(reason).toContain('de 2013 a 2025');
    expect(reason.length).toBeLessThan(280);
  });

  it('builds observed profiles and fail-closed test decisions for selected variables', () => {
    const data = buildGuidedResearchData(design, snapshot());
    const model = buildGuidedSelectionModel(data, {
      goal: 'compare',
      variableIds: ['taxa_mortalidade'],
      testIds: [],
      primaryTestId: null,
      roleAssignments: {},
    });

    expect(model.profilesByVariableId.taxa_mortalidade).toMatchObject({
      kind: 'rate',
      coverage: { expected: 6, available: 6, used: 6, missing: 0 },
    });
    expect(model.profilesByVariableId.taxa_mortalidade?.distribution.histogram).not.toHaveLength(0);
    expect(model.eligibility.find((item) => item.id === 'mann-whitney')).not.toMatchObject({
      status: 'ineligible',
    });
    expect(model.eligibility.find((item) => item.id === 'logistica')).toMatchObject({
      status: 'ineligible',
    });
  });

  it('derives a valid death/non-death table before releasing chi-square', () => {
    const data = buildGuidedResearchData(design, snapshot());
    const model = buildGuidedSelectionModel(data, {
      goal: 'compare',
      variableIds: ['desfecho_hospitalar'],
      testIds: [],
      primaryTestId: null,
      roleAssignments: {},
    });

    expect(model.eligibility.find((item) => item.id === 'qui-quadrado')).toMatchObject({
      status: 'eligible',
    });
  });

  it('loads once per research fingerprint and never refetches on checkbox changes', async () => {
    const loader = vi.fn(async () => snapshot());
    const initialSelection = {
      goal: 'compare' as const,
      variableIds: [] as string[],
      testIds: [] as string[],
      primaryTestId: null,
      roleAssignments: {},
    };
    const { result, rerender } = renderHook(
      ({ variableIds }) => useGuidedResearch(design, { ...initialSelection, variableIds }, { loader }),
      { initialProps: { variableIds: [] as string[] } },
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ variableIds: ['internacoes'] });
    rerender({ variableIds: ['internacoes', 'taxa_mortalidade'] });
    await act(async () => Promise.resolve());

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reuses the same load for a semantically equivalent design object', async () => {
    const loader = vi.fn(async () => snapshot());
    const selection = {
      goal: 'describe' as const,
      variableIds: [] as string[],
      testIds: [] as string[],
      primaryTestId: null,
      roleAssignments: {},
    };
    const { result, rerender } = renderHook(
      ({ currentDesign }) => useGuidedResearch(currentDesign, selection, { loader }),
      { initialProps: { currentDesign: design } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({
      currentDesign: {
        ...design,
        groups: design.groups.map((group) => ({ ...group, territories: [...group.territories] })),
      },
    });
    await act(async () => Promise.resolve());

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('hides the previous snapshot synchronously when the research fingerprint changes', async () => {
    let resolveSecond: ((value: ResearchDataSnapshot) => void) | undefined;
    const loader = vi.fn((currentDesign: ResearchDesign) => {
      if (currentDesign.period.scope === 'shared' && currentDesign.period.time.mode === 'point'
        && currentDesign.period.time.point === '2026') {
        return new Promise<ResearchDataSnapshot>((resolve) => { resolveSecond = resolve; });
      }
      return Promise.resolve(snapshot());
    });
    const selection = {
      goal: 'describe' as const,
      variableIds: [] as string[],
      testIds: [] as string[],
      primaryTestId: null,
      roleAssignments: {},
    };
    const { result, rerender } = renderHook(
      ({ currentDesign }) => useGuidedResearch(currentDesign, selection, { loader }),
      { initialProps: { currentDesign: design } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const nextDesign: ResearchDesign = {
      ...design,
      period: { scope: 'shared', time: { mode: 'point', point: '2026' } },
    };
    rerender({ currentDesign: nextDesign });

    expect(result.current.status).toBe('loading');
    expect(result.current.variables).toBeUndefined();
    await act(async () => { resolveSecond?.(snapshot()); });
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });
});
