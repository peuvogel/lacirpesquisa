import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { municipalityIdsForMeso } from '@/geo/mesoMembership';
import { MESO_PRESETS } from '@/geo/mesoPresets';
import {
  REGION_PRESETS,
  resolvePresetTerritories,
  type RegionPresetId,
} from '@/geo/territoryCatalog';
import { getUfName } from './ufCodes';

type LayerId = 'regioes' | 'mesorregioes';

const LAYERS: { id: LayerId; label: string }[] = [
  { id: 'regioes', label: 'Regiões' },
  { id: 'mesorregioes', label: 'Mesorregiões' },
];

export interface PresetTerritoryCarouselProps {
  selectedUFs: readonly string[];
  selectedMunicipioIds: readonly string[];
  onToggleRegion: (presetId: RegionPresetId, checked: boolean) => void;
  onToggleMeso: (mesoId: string, mesoCode: string, checked: boolean) => void;
  onPreviewRegion?: (siglas: string[] | null) => void;
  /**
   * When set (UF zoom), only mesorregiões of this state are listed.
   * Panel hides if the UF has no meso membership data.
   */
  focusUfSigla?: string | null;
  /** When false, panel is not shown. */
  visible?: boolean;
  className?: string;
}

function mesoLabelForScope(label: string, focusUfSigla: string | null | undefined): string {
  if (!focusUfSigla) return label;
  const suffix = ` (${focusUfSigla})`;
  return label.endsWith(suffix) ? label.slice(0, -suffix.length) : label;
}

/**
 * Compact vertical preset stack — lower-left of the Brazil map.
 * In UF zoom, becomes a mesorregião picker for that state.
 */
export function PresetTerritoryCarousel({
  selectedUFs,
  selectedMunicipioIds,
  onToggleRegion,
  onToggleMeso,
  onPreviewRegion,
  focusUfSigla = null,
  visible = true,
  className,
}: PresetTerritoryCarouselProps) {
  const reduceMotion = useReducedMotion();
  const scoped = Boolean(focusUfSigla);
  const [layer, setLayer] = useState<LayerId>('regioes');
  const [open, setOpen] = useState(true);
  const selectedUf = useMemo(() => new Set(selectedUFs), [selectedUFs]);
  const selectedMunis = useMemo(() => new Set(selectedMunicipioIds), [selectedMunicipioIds]);
  const regionEntries = Object.values(REGION_PRESETS);

  const mesoEntries = useMemo(() => {
    if (!focusUfSigla) return MESO_PRESETS;
    return MESO_PRESETS.filter((meso) => meso.ufSiglas.includes(focusUfSigla));
  }, [focusUfSigla]);

  useEffect(() => {
    if (scoped) setLayer('mesorregioes');
  }, [scoped, focusUfSigla]);

  if (!visible) return null;
  if (scoped && mesoEntries.length === 0) return null;

  const title = scoped
    ? `Mesos · ${getUfName(focusUfSigla!) || focusUfSigla}`
    : 'Regiões / Mesos';

  const activeLayer = scoped ? 'mesorregioes' : layer;

  return (
    <motion.div
      aria-label={scoped ? `Mesorregiões de ${focusUfSigla}` : 'Presets territoriais'}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
      className={cn(
        'pointer-events-auto absolute bottom-3 left-3 z-20 flex w-[11.25rem] flex-col rounded-xl border border-white/10 bg-elevated/95 shadow-lg isolate',
        className,
      )}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left font-sans text-[11px] font-bold tracking-wide text-text hover:bg-surface/80"
        aria-expanded={open}
      >
        <span className="truncate">{title}</span>
        <span className="text-text-muted" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open ? (
        <div className="flex max-h-[min(42vh,16rem)] flex-col border-t border-white/8 px-2 pb-2 pt-1.5">
          {!scoped ? (
            <div className="mb-1 flex gap-0.5" role="tablist" aria-label="Camada territorial">
              {LAYERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={layer === item.id}
                  onClick={() => setLayer(item.id)}
                  className={cn(
                    'flex-1 rounded-md px-1.5 py-1 font-sans text-[10px] font-bold tracking-wide transition-colors',
                    layer === item.id
                      ? 'bg-accent-soft text-accent'
                      : 'text-text-muted hover:bg-surface hover:text-text',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="mb-1 px-0.5 font-sans text-[10px] text-text-muted">
              Selecione mesorregiões deste estado
            </p>
          )}

          <div
            className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-0.5"
            role="list"
          >
            {activeLayer === 'regioes'
              ? regionEntries.map((preset) => {
                  const siglas = resolvePresetTerritories(preset.id as RegionPresetId)
                    .map((t) => t.sigla!)
                    .filter(Boolean);
                  const checked = siglas.length > 0 && siglas.every((s) => selectedUf.has(s));
                  const partial = !checked && siglas.some((s) => selectedUf.has(s));
                  const nextChecked = !(checked || partial);
                  return (
                    <label
                      key={preset.id}
                      role="listitem"
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 font-sans text-xs transition-colors hover:bg-accent-soft/60',
                        checked || partial ? 'text-accent' : 'text-text',
                      )}
                      onMouseEnter={() => onPreviewRegion?.(siglas)}
                      onMouseLeave={() => onPreviewRegion?.(null)}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        ref={(el) => {
                          if (el) el.indeterminate = partial;
                        }}
                        onChange={() =>
                          onToggleRegion(preset.id as RegionPresetId, nextChecked)
                        }
                        className="size-3.5 shrink-0 accent-[var(--color-accent)]"
                      />
                      <span className="leading-tight">{preset.label}</span>
                    </label>
                  );
                })
              : mesoEntries.map((meso) => {
                  const muniIds = municipalityIdsForMeso(meso.mesoCode);
                  const checked =
                    muniIds.length > 0 && muniIds.every((id) => selectedMunis.has(id));
                  const partial = !checked && muniIds.some((id) => selectedMunis.has(id));
                  const nextChecked = !(checked || partial);
                  const label = mesoLabelForScope(meso.label, focusUfSigla);
                  return (
                    <label
                      key={meso.id}
                      role="listitem"
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 font-sans text-xs transition-colors hover:bg-accent-soft/60',
                        checked || partial ? 'text-accent' : 'text-text',
                        muniIds.length === 0 && 'opacity-50',
                      )}
                      onMouseEnter={() => onPreviewRegion?.([...meso.ufSiglas])}
                      onMouseLeave={() => onPreviewRegion?.(null)}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={muniIds.length === 0}
                        ref={(el) => {
                          if (el) el.indeterminate = partial;
                        }}
                        onChange={() => onToggleMeso(meso.id, meso.mesoCode, nextChecked)}
                        className="size-3.5 shrink-0 accent-[var(--color-accent)]"
                      />
                      <span className="leading-tight">{label}</span>
                    </label>
                  );
                })}
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
