import type { GeoLevel, MapViewState } from '@/geo/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getUfName } from './ufCodes';

const DRILL_LEVELS: { level: Exclude<GeoLevel, 'uf'>; label: string }[] = [
  { level: 'municipio', label: 'Município' },
  { level: 'meso', label: 'Mesorregião' },
  { level: 'health-macro', label: 'Macrorregião de saúde' },
];

export interface MapBreadcrumbProps {
  mapView: MapViewState;
  onNavigate: (view: MapViewState) => void;
  className?: string;
}

/**
 * Brasil → UF → geography level navigation (MAP-03 / UI-SPEC Key Screen 7).
 */
export function MapBreadcrumb({ mapView, onNavigate, className }: MapBreadcrumbProps) {
  const isBrazil = mapView.level === 'uf';
  const ufSigla = mapView.parentCode;
  const ufIbge = mapView.ufIbge;

  function goBrazil() {
    onNavigate({ level: 'uf' });
  }

  function setDrillLevel(level: Exclude<GeoLevel, 'uf'>) {
    if (!ufSigla || !ufIbge) return;
    onNavigate({ level, parentCode: ufSigla, ufIbge });
  }

  return (
    <nav aria-label="Navegação do mapa" className={cn('flex flex-wrap items-center gap-2', className)}>
      {isBrazil ? (
        <span className="font-sans text-sm font-bold text-text">Brasil</span>
      ) : (
        <>
          <button
            type="button"
            onClick={goBrazil}
            className="font-sans text-sm text-accent underline-offset-2 hover:underline"
          >
            Brasil
          </button>
          <span className="text-text-muted" aria-hidden="true">
            →
          </span>
          <span className="font-sans text-sm font-bold text-text">
            {getUfName(ufSigla ?? '')} ({ufSigla})
          </span>
        </>
      )}

      {!isBrazil ? (
        <div
          className="ml-2 flex flex-wrap gap-1 rounded-lg border border-border p-1"
          role="tablist"
          aria-label="Nível geográfico"
        >
          {DRILL_LEVELS.map(({ level, label }) => (
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
