import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { MESO_PRESETS } from '@/geo/mesoPresets';
import {
  REGION_PRESETS,
  resolvePresetTerritories,
  type RegionPresetId,
} from '@/geo/territoryCatalog';

export interface PresetRegionCheckboxesProps {
  selectedUFs: readonly string[];
  onToggleRegion: (presetId: RegionPresetId, checked: boolean) => void;
  onToggleMeso?: (mesoId: string, ufSiglas: readonly string[], checked: boolean) => void;
  onPreviewRegion?: (siglas: string[] | null) => void;
  className?: string;
}

/**
 * Regional + mesorregião presets — bottom-left of the map.
 */
export function PresetRegionCheckboxes({
  selectedUFs,
  onToggleRegion,
  onToggleMeso,
  onPreviewRegion,
  className,
}: PresetRegionCheckboxesProps) {
  const reduceMotion = useReducedMotion();
  const selected = new Set(selectedUFs);
  const regionEntries = Object.values(REGION_PRESETS);

  return (
    <motion.fieldset
      aria-label="Presets territoriais"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      className={cn(
        'pointer-events-auto absolute bottom-3 left-3 z-10 flex max-h-[55%] max-w-[12.5rem] flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-elevated/95 p-2.5 shadow-lg',
        className,
      )}
    >
      <legend className="px-0.5 font-sans text-[10px] font-bold uppercase tracking-wide text-text-muted">
        Regiões
      </legend>
      {regionEntries.map((preset) => {
        const siglas = resolvePresetTerritories(preset.id as RegionPresetId)
          .map((t) => t.sigla!)
          .filter(Boolean);
        const checked = siglas.length > 0 && siglas.every((s) => selected.has(s));
        const partial = !checked && siglas.some((s) => selected.has(s));

        return (
          <label
            key={preset.id}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 font-sans text-xs text-text transition-colors hover:bg-accent-soft/60',
              checked && 'text-accent',
            )}
            onMouseEnter={() => onPreviewRegion?.(siglas)}
            onMouseLeave={() => onPreviewRegion?.(null)}
          >
            <input
              type="checkbox"
              checked={checked}
              ref={(el) => {
                if (el) el.indeterminate = partial;
              }}
              onChange={(event) =>
                onToggleRegion(preset.id as RegionPresetId, event.target.checked)
              }
              className="size-3.5 accent-[var(--color-accent)]"
            />
            <span className="leading-tight">{preset.label}</span>
          </label>
        );
      })}

      <p className="mt-1 px-0.5 font-sans text-[10px] font-bold uppercase tracking-wide text-text-muted">
        Mesorregiões
      </p>
      {MESO_PRESETS.map((meso) => {
        const checked =
          meso.ufSiglas.length > 0 && meso.ufSiglas.every((s) => selected.has(s));
        return (
          <label
            key={meso.id}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 font-sans text-xs text-text transition-colors hover:bg-accent-soft/60',
              checked && 'text-accent',
            )}
            onMouseEnter={() => onPreviewRegion?.([...meso.ufSiglas])}
            onMouseLeave={() => onPreviewRegion?.(null)}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => {
                onToggleMeso?.(meso.id, meso.ufSiglas, event.target.checked);
              }}
              className="size-3.5 accent-[var(--color-accent)]"
            />
            <span className="leading-tight">{meso.label}</span>
          </label>
        );
      })}
    </motion.fieldset>
  );
}
