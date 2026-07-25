import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { TerritoryRef } from '@/geo/types';
import { useSession } from '@/shared/session/SessionProvider';
import { BrazilMapCanvas } from './BrazilMapCanvas';
import { ChoroplethLegend } from './ChoroplethLegend';
import { buildUngroupedTerritories, GroupBar } from './GroupBar';
import { MapLegendHint } from './MapLegendHint';
import {
  createInitialMapAnalysisState,
  deriveFlatMapSelection,
  deriveSelectionSummary,
  useMapAnalysis,
} from './mapAnalysisState';
import { getDefaultMockVariableId, getMockMetricByUf } from './mockAnalysisData';
import { SelectionSummaryStrip } from './SelectionSummaryStrip';
import { TerritoryPastePanel } from './TerritoryPastePanel';
import { VariablePanel } from './VariablePanel';

type ContextPanelMode = 'explore' | 'paste' | 'group';

function collectGroupMembership(
  groups: ReturnType<typeof useMapAnalysis>['state']['groups'],
): Record<string, { groupIndex: number; groupName: string }> {
  const membership: Record<string, { groupIndex: number; groupName: string }> = {};
  groups.forEach((group, index) => {
    for (const t of group.territoryIds) {
      if (t.level === 'uf' && t.sigla) {
        membership[t.sigla] = { groupIndex: index, groupName: group.name };
      }
    }
  });
  return membership;
}

function territoriesToSiglas(territories: TerritoryRef[]): string[] {
  return territories
    .filter((t) => t.level === 'uf' && t.sigla)
    .map((t) => t.sigla!);
}

export function MapasPage() {
  const { setMapSelection, setMapAnalysis, mapAnalysis } = useSession();
  const { state, dispatch, derived } = useMapAnalysis(mapAnalysis ?? undefined);

  const [hoveredUF, setHoveredUF] = useState<string | null>(null);
  const [selectedUFs, setSelectedUFs] = useState<string[]>([]);
  const [highlightedUFs, setHighlightedUFs] = useState<string[]>([]);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [contextPanelMode, setContextPanelMode] = useState<ContextPanelMode>('explore');
  const [clearAllOpen, setClearAllOpen] = useState(false);

  const activeVariableId = getDefaultMockVariableId();
  const choroplethValues = useMemo(() => getMockMetricByUf(activeVariableId), [activeVariableId]);

  const ungroupedTerritories = useMemo(
    () => buildUngroupedTerritories(selectedUFs, state.groups),
    [selectedUFs, state.groups],
  );

  const summary = useMemo(
    () => deriveSelectionSummary(state, ungroupedTerritories),
    [state, ungroupedTerritories],
  );

  const groupMembership = useMemo(() => collectGroupMembership(state.groups), [state.groups]);

  const activeGroupHighlight = useMemo(() => {
    if (!state.activeGroupId) return [];
    const group = state.groups.find((g) => g.id === state.activeGroupId);
    return group ? territoriesToSiglas(group.territoryIds) : [];
  }, [state.activeGroupId, state.groups]);

  const mapHighlightedUFs = useMemo(
    () => [...new Set([...highlightedUFs, ...activeGroupHighlight])],
    [highlightedUFs, activeGroupHighlight],
  );

  const markInteracted = useCallback(() => {
    setHasInteracted(true);
  }, []);

  const handleHoverUF = useCallback(
    (uf: string | null) => {
      if (uf !== null) markInteracted();
      setHoveredUF(uf);
    },
    [markInteracted],
  );

  const handleToggleUF = useCallback(
    (uf: string) => {
      markInteracted();
      if (groupMembership[uf]) {
        const group = state.groups.find((g) =>
          g.territoryIds.some((t) => t.level === 'uf' && t.sigla === uf),
        );
        if (group) dispatch({ type: 'SET_ACTIVE_GROUP', groupId: group.id });
        return;
      }
      setSelectedUFs((current) =>
        current.includes(uf) ? current.filter((sigla) => sigla !== uf) : [...current, uf],
      );
    },
    [dispatch, groupMembership, markInteracted, state.groups],
  );

  const handleGroupCreated = useCallback((siglas: string[]) => {
    setSelectedUFs((current) => current.filter((sigla) => !siglas.includes(sigla)));
    setHighlightedUFs([]);
  }, []);

  const handleHighlightTerritories = useCallback((territories: TerritoryRef[]) => {
    setHighlightedUFs(territoriesToSiglas(territories));
  }, []);

  const handlePasteMatched = useCallback(
    (siglas: string[]) => {
      markInteracted();
      setSelectedUFs((current) => {
        const merged = [...current];
        for (const sigla of siglas) {
          if (!merged.includes(sigla) && !groupMembership[sigla]) merged.push(sigla);
        }
        return merged;
      });
    },
    [groupMembership, markInteracted],
  );

  const clearUngroupedSelection = useCallback(() => {
    setSelectedUFs([]);
    setHoveredUF(null);
    setHighlightedUFs([]);
  }, []);

  const clearAllWork = useCallback(() => {
    dispatch({ type: 'REPLACE_STATE', state: createInitialMapAnalysisState() });
    setSelectedUFs([]);
    setHighlightedUFs([]);
    setHoveredUF(null);
    setContextPanelMode('explore');
    setClearAllOpen(false);
  }, [dispatch]);

  const togglePasteMode = useCallback(() => {
    setContextPanelMode((mode) => (mode === 'paste' ? 'explore' : 'paste'));
  }, []);

  useEffect(() => {
    setMapAnalysis(state);
  }, [state, setMapAnalysis]);

  useEffect(() => {
    const flat = deriveFlatMapSelection(state);
    if (flat) {
      setMapSelection(flat);
      return;
    }
    if (selectedUFs.length > 0) {
      setMapSelection({ ufs: selectedUFs, variables: [] });
      return;
    }
    setMapSelection(null);
  }, [selectedUFs, setMapSelection, state]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (event.shiftKey && state.groups.length > 0) {
        event.preventDefault();
        setClearAllOpen(true);
        return;
      }

      clearUngroupedSelection();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearUngroupedSelection, state.groups.length]);

  const flatSelection = deriveFlatMapSelection(state);
  const panelSelectedUFs =
    selectedUFs.length > 0 ? selectedUFs : activeGroupHighlight.length > 0 ? activeGroupHighlight : [];

  return (
    <div className="mx-auto max-w-[1520px] px-6 py-8">
      <h1 className="font-sans text-display font-bold text-text">Mapas</h1>

      <GroupBar
        className="mt-6"
        state={state}
        dispatch={dispatch}
        ungroupedTerritories={ungroupedTerritories}
        onGroupCreated={handleGroupCreated}
        onHighlightTerritories={handleHighlightTerritories}
      />

      <SelectionSummaryStrip className="mt-4" summary={summary} />

      <div className="mt-8 flex gap-8">
        <section className="lacir-mapas-map w-[58%]" aria-label="Mapa do Brasil">
          <BrazilMapCanvas
            hoveredUF={hoveredUF}
            selectedUFs={selectedUFs}
            highlightedUFs={mapHighlightedUFs}
            groupMembership={groupMembership}
            onHoverUF={handleHoverUF}
            onToggleUF={handleToggleUF}
            choroplethValues={choroplethValues}
            activeVariableId={activeVariableId}
          />
          <ChoroplethLegend
            values={Object.values(choroplethValues)}
            activeVariableId={activeVariableId}
          />
          {!hasInteracted ? <MapLegendHint /> : null}
        </section>

        <aside className="lacir-mapas-panel flex w-[42%] flex-col" aria-label="Painel contextual">
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant={contextPanelMode === 'paste' ? 'default' : 'outline'}
              size="sm"
              onClick={togglePasteMode}
            >
              Colar territórios
            </Button>
          </div>

          {contextPanelMode === 'paste' ? (
            <TerritoryPastePanel onMatched={handlePasteMatched} />
          ) : (
            <VariablePanel
              hoveredUF={hoveredUF}
              selectedUFs={panelSelectedUFs}
              selectedVariables={flatSelection?.variables ?? []}
              onToggleVariable={() => undefined}
              onClearSelection={clearUngroupedSelection}
              onIniciarPesquisa={() => undefined}
            />
          )}

          <div
            className="mt-auto border-t border-border pt-4"
            aria-label="Ações principais"
          >
            <Button type="button" disabled={!derived.canReview} className="w-full">
              Revisar e analisar
            </Button>
            {!derived.canReview ? (
              <p className="mt-2 font-sans text-xs text-text-muted">
                Complete período e variáveis em todos os grupos antes de revisar.
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      <Dialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <DialogContent showCloseButton={false} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Limpar mapa</DialogTitle>
            <DialogDescription>
              Apagar grupos, seleções e dados colados desta sessão? Não dá para desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setClearAllOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={clearAllWork}>
              Sim, apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
