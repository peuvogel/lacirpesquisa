import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  HEALTH_MACRO_PRESETS,
  REGION_PRESETS,
  resolveHealthMacroTerritories,
  resolvePresetTerritories,
  type RegionPresetId,
} from '@/geo/territoryCatalog';
import type { TerritoryRef } from '@/geo/types';

export interface PresetRegionPillsProps {
  disabled?: boolean;
  onApplyPreset: (territories: TerritoryRef[], label: string) => void;
  onHighlightPreset?: (territories: TerritoryRef[]) => void;
  className?: string;
}

export function PresetRegionPills({
  disabled = false,
  onApplyPreset,
  onHighlightPreset,
  className,
}: PresetRegionPillsProps) {
  const regionEntries = Object.values(REGION_PRESETS);

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        {regionEntries.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            className="h-8 rounded-lg border-accent-border bg-elevated px-3 font-sans text-xs font-bold"
            onMouseEnter={() =>
              onHighlightPreset?.(resolvePresetTerritories(preset.id as RegionPresetId))
            }
            onFocus={() =>
              onHighlightPreset?.(resolvePresetTerritories(preset.id as RegionPresetId))
            }
            onClick={() =>
              onApplyPreset(
                resolvePresetTerritories(preset.id as RegionPresetId),
                preset.label,
              )
            }
          >
            {preset.label}
          </Button>
        ))}

        {HEALTH_MACRO_PRESETS.map((preset) => (
          <Tooltip key={preset.id}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                className="h-8 rounded-lg border-accent-border bg-elevated px-3 font-sans text-xs font-bold"
                onMouseEnter={() =>
                  onHighlightPreset?.(resolveHealthMacroTerritories(preset.id))
                }
                onFocus={() =>
                  onHighlightPreset?.(resolveHealthMacroTerritories(preset.id))
                }
                onClick={() =>
                  onApplyPreset(resolveHealthMacroTerritories(preset.id), preset.label)
                }
              >
                {preset.label}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{preset.tooltip}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
