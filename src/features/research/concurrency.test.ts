import { describe, expect, it } from 'vitest';
import type { ResearchSupabaseClient } from './supabaseResearchRepository';
import { createResearchRepository } from './supabaseResearchRepository';
import type { ResearchDesign } from './types';
import { VARIABLE_PROFILES } from './variableProfiles';
import { buildGuidedResearchData, buildGuidedSelectionModel } from '@/routes/variaveis/useGuidedResearch';

interface QueryResult {
  data: unknown[] | null;
  error: { message: string; code?: string } | null;
}

class StaticQuery implements PromiseLike<QueryResult> {
  private rangeValue: [number, number] | null = null;

  constructor(
    private readonly rows: unknown[],
    private readonly onRequest: () => void,
  ) {}

  select() { return this; }
  in() { return this; }
  eq() { return this; }
  order() { return this; }
  abortSignal() { return this; }
  range(from: number, to: number) {
    this.rangeValue = [from, to];
    return this;
  }
  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    this.onRequest();
    const [from, to] = this.rangeValue ?? [0, this.rows.length - 1];
    return Promise.resolve({ data: this.rows.slice(from, to + 1), error: null }).then(onfulfilled, onrejected);
  }
}

class ClassClientTransport implements ResearchSupabaseClient {
  readonly calls: Record<string, number> = {};

  constructor(private readonly rowsByTable: Record<string, unknown[]>) {}

  from(table: string) {
    return {
      select: () => new StaticQuery(this.rowsByTable[table] ?? [], () => {
        this.calls[table] = (this.calls[table] ?? 0) + 1;
      }),
    };
  }

  totalCalls(): number {
    return Object.values(this.calls).reduce((sum, count) => sum + count, 0);
  }
}

const design: ResearchDesign = {
  groups: [
    {
      id: 'nordeste',
      name: 'Nordeste',
      territories: [{ id: '29', label: 'Bahia' }, { id: '28', label: 'Sergipe' }, { id: '27', label: 'Alagoas' }],
    },
    {
      id: 'sudeste',
      name: 'Sudeste',
      territories: [{ id: '35', label: 'São Paulo' }, { id: '33', label: 'Rio de Janeiro' }, { id: '31', label: 'Minas Gerais' }],
    },
  ],
  geography: 'uf',
  locationBasis: 'ocorrencia',
  diseaseIds: ['doenca_teste'],
  period: { scope: 'shared', time: { mode: 'point', point: '2025' } },
};

function transportRows() {
  const territories = design.groups.flatMap((group) => group.territories);
  return {
    sih_metric_uf: territories.map((territory, index) => ({
      disease_id: 'doenca_teste',
      uf_codigo: territory.id,
      ano: 2025,
      local: 'ocorrencia',
      internacoes: 100 + index * 15,
      obitos: 4 + index,
      valor_total: 25_000 + index * 1_000,
      dias_permanencia: 500 + index * 25,
      taxa_mortalidade: (4 + index) / (100 + index * 15) * 100,
    })),
    sih_collection_status: ['internacoes', 'obitos', 'valor_total', 'dias_permanencia'].map((medida) => ({
      disease_id: 'doenca_teste', medida, grao: 'uf', local: 'ocorrencia', ano: 2025,
      status: 'coletado', derived_at: '2026-08-13T00:00:00Z', cid_map_version: 'v1',
    })),
    sih_population_total_uf: territories.map((territory, index) => ({
      uf_codigo: territory.id, ano: 2025, populacao: 1_000_000 + index * 50_000,
    })),
  };
}

describe('class-load concurrency', () => {
  it('serves 40 independent clients with bounded batched requests and no refetch per checkbox', async () => {
    const clients = Array.from({ length: 40 }, () => new ClassClientTransport(transportRows()));
    const snapshots = await Promise.all(clients.map((client) =>
      createResearchRepository({ supabase: client }).load(design, VARIABLE_PROFILES)));

    expect(snapshots).toHaveLength(40);
    for (const [index, snapshot] of snapshots.entries()) {
      expect(snapshot.cells).toHaveLength(6 * 1 * 6);
      const client = clients[index]!;
      expect(client.calls).toEqual({
        sih_metric_uf: 1,
        sih_collection_status: 1,
        sih_population_total_uf: 1,
      });
      const callsBeforeCheckboxes = client.totalCalls();
      const data = buildGuidedResearchData(design, snapshot);
      for (const variableIds of [
        ['internacoes'],
        ['internacoes', 'taxa_mortalidade'],
        ['taxa_internacao_100k'],
      ]) {
        buildGuidedSelectionModel(data, {
          goal: 'compare', variableIds, trendTestIds: [], testIds: [], primaryTestId: null, roleAssignments: {},
        });
      }
      expect(client.totalCalls()).toBe(callsBeforeCheckboxes);
    }
  });
});
