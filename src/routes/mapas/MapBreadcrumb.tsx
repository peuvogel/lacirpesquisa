import { healthMacrosAvailableForUf } from '@/geo/territoryCatalog';
import type { GeoLevel, MapViewState } from '@/geo/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getUfName } from './ufCodes';

const DRILL_LEVELS: { level: Exclude<GeoLevel, 'uf'>; label: string }[] = [
  { level: 'municipio', label: 'Municípios' },
  { level: 'meso', label: 'Mesorregiões' },
  { level: 'health-macro', label: 'Macrorregiões de saúde' },
];

export interface MapBreadcrumbProps {
  mapView: MapViewState;
  onNavigate: (view: MapViewState) => void;
  className?: string;
}

/**
 * Brasil → UF → nível geográfico (MAP-03).
 */
export function MapBreadcrumb({ mapView, onNavigate, className }: MapBreadcrumbProps) {
  const isBrazil = mapView.level === 'uf';
  const ufSigla = mapView.parentCode;
  const ufIbge = mapView.ufIbge;
  const drillTabs = DRILL_LEVELS.filter(
    (item) =>
      item.level !== 'health-macro' ||
      (ufIbge != null && healthMacrosAvailableForUf(ufIbge)),
  );
  const levelLabel =
    drillTabs.find((item) => item.level === mapView.level)?.label ?? mapView.level;

  function goBrazil() {
    onNavigate({ level: 'uf' });
  }

  function setDrillLevel(level: Exclude<GeoLevel, 'uf'>) {
    if (!ufSigla || !ufIbge) return;
    onNavigate({ level, parentCode: ufSigla, ufIbge });
  }

  return (
    <nav
      aria-label="Navegação do mapa"
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-xl border border-border bg-elevated/60 px-3 py-2',
        className,
      )}
    >
      {isBrazil ? (
        <ol className="flex flex-wrap items-center gap-1.5 font-sans text-sm">
          <li className="font-bold text-text">Brasil</li>
          <li className="text-text-muted" aria-hidden>
            /
          </li>
          <li className="text-text-muted">Unidades federativas</li>
        </ol>
      ) : (
        <ol className="flex flex-wrap items-center gap-1.5 font-sans text-sm">
          <li>
            <button
              type="button"
              onClick={goBrazil}
              className="font-medium text-accent underline-offset-2 hover:underline"
            >
              Brasil
            </button>
          </li>
          <li className="text-text-muted" aria-hidden>
            /
          </li>
          <li className="font-bold text-text">
            {getUfName(ufSigla ?? '')} ({ufSigla})
          </li>
          <li className="text-text-muted" aria-hidden>
            /
          </li>
          <li className="font-medium text-text">{levelLabel}</li>
        </ol>
      )}

      {!isBrazil ? (
        <div
          className="ml-auto flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1"
          role="tablist"
          aria-label="Nível geográfico"
        >
          {drillTabs.map(({ level, label }) => (
            <Button
              key={level}
              type="button"
              role="tab"
              aria-selected={mapView.level === level}
              size="sm"
              variant={mapView.level === level ? 'default' : 'ghost'}
              className="h-7 px-2 text-xs"
              onClick={() => setDrillLevel(level)}
            >
              {label}
            </Button>
          ))}
        </div>
      ) : null}
    </nav>
  );
}
