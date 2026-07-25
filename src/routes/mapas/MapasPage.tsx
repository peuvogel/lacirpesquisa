import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/shared/session/SessionProvider';
import { createInitialMapAnalysisState } from './mapAnalysisState';
import { BrazilMockMap } from './BrazilMockMap';
import { computeVariableIntersection } from './computeVariableIntersection';
import { MapLegendHint } from './MapLegendHint';
import { MOCK_VARIABLES_BY_UF } from './mockVariablesByUF';
import { IniciarPesquisaModal } from './IniciarPesquisaModal';
import { TerritoryPastePanel } from './TerritoryPastePanel';
import { VariablePanel } from './VariablePanel';

type ContextPanelMode = 'explore' | 'paste' | 'group';

export function MapasPage() {
  const { setMapSelection, setMapAnalysis, mapAnalysis } = useSession();
  const [hoveredUF, setHoveredUF] = useState<string | null>(null);
  const [selectedUFs, setSelectedUFs] = useState<string[]>([]);
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [pesquisaOpen, setPesquisaOpen] = useState(false);
  const [contextPanelMode, setContextPanelMode] = useState<ContextPanelMode>('explore');

  const markInteracted = useCallback(() => {
    setHasInteracted(true);
  }, []);

  const handleHoverUF = useCallback(
    (uf: string | null) => {
      if (uf !== null) {
        markInteracted();
      }
      setHoveredUF(uf);
    },
    [markInteracted],
  );

  const handleToggleUF = useCallback(
    (uf: string) => {
      markInteracted();
      setSelectedUFs((current) =>
        current.includes(uf) ? current.filter((sigla) => sigla !== uf) : [...current, uf],
      );
    },
    [markInteracted],
  );

  const handleToggleVariable = useCallback(
    (variable: string) => {
      markInteracted();
      setSelectedVariables((current) =>
        current.includes(variable)
          ? current.filter((name) => name !== variable)
          : [...current, variable],
      );
    },
    [markInteracted],
  );

  const handlePasteMatched = useCallback(
    (siglas: string[]) => {
      markInteracted();
      setSelectedUFs((current) => {
        const merged = [...current];
        for (const sigla of siglas) {
          if (!merged.includes(sigla)) merged.push(sigla);
        }
        return merged;
      });

      const base = mapAnalysis ?? createInitialMapAnalysisState();
      const provenance: 'paste' | 'hybrid' =
        mapAnalysis?.provenance === 'mock' || mapAnalysis?.provenance === 'hybrid'
          ? 'hybrid'
          : 'paste';
      setMapAnalysis({ ...base, provenance });
    },
    [mapAnalysis, markInteracted, setMapAnalysis],
  );

  const clearSelection = useCallback(() => {
    setSelectedUFs([]);
    setSelectedVariables([]);
    setHoveredUF(null);
  }, []);

  const togglePasteMode = useCallback(() => {
    setContextPanelMode((mode) => (mode === 'paste' ? 'explore' : 'paste'));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearSelection]);

  useEffect(() => {
    if (selectedUFs.length === 0) {
      return;
    }

    const { intersection, partial } = computeVariableIntersection(
      selectedUFs,
      MOCK_VARIABLES_BY_UF,
    );
    const available = new Set([...intersection, ...partial.map((entry) => entry.variable)]);

    setSelectedVariables((current) => current.filter((variable) => available.has(variable)));
  }, [selectedUFs]);

  useEffect(() => {
    if (selectedUFs.length === 0 && selectedVariables.length === 0) {
      setMapSelection(null);
      return;
    }

    setMapSelection({ ufs: selectedUFs, variables: selectedVariables });
  }, [selectedUFs, selectedVariables, setMapSelection]);

  return (
    <div className="mx-auto max-w-[1520px] px-6 py-8">
      <h1 className="font-sans text-display font-bold text-text">Mapas</h1>
      <div className="mt-6 flex gap-8">
        <section className="lacir-mapas-map w-[60%]" aria-label="Mapa do Brasil">
          <BrazilMockMap
            hoveredUF={hoveredUF}
            selectedUFs={selectedUFs}
            onHoverUF={handleHoverUF}
            onToggleUF={handleToggleUF}
          />
          {!hasInteracted ? <MapLegendHint /> : null}
        </section>
        <aside className="lacir-mapas-panel w-[40%]" aria-label="Painel contextual">
          <div className="mb-3">
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
              selectedUFs={selectedUFs}
              selectedVariables={selectedVariables}
              onToggleVariable={handleToggleVariable}
              onClearSelection={clearSelection}
              onIniciarPesquisa={() => setPesquisaOpen(true)}
            />
          )}
        </aside>
      </div>
      <IniciarPesquisaModal
        open={pesquisaOpen}
        onOpenChange={setPesquisaOpen}
        selectedUFs={selectedUFs}
        selectedVariables={selectedVariables}
      />
    </div>
  );
}
