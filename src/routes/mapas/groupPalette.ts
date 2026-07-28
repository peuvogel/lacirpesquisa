/** Distinct colors per analysis group (fill + stroke + glow). */
export interface GroupColor {
  fill: string;
  stroke: string;
  glow: string;
  chip: string;
}

export const GROUP_PALETTE: readonly GroupColor[] = [
  { fill: 'rgba(32, 153, 120, 0.38)', stroke: '#209978', glow: 'rgba(32, 153, 120, 0.55)', chip: 'border-[#209978] bg-[rgba(32,153,120,0.15)] text-[#7ddec0]' },
  { fill: 'rgba(59, 130, 246, 0.38)', stroke: '#3b82f6', glow: 'rgba(59, 130, 246, 0.55)', chip: 'border-[#3b82f6] bg-[rgba(59,130,246,0.15)] text-[#93c5fd]' },
  { fill: 'rgba(245, 158, 11, 0.38)', stroke: '#f59e0b', glow: 'rgba(245, 158, 11, 0.55)', chip: 'border-[#f59e0b] bg-[rgba(245,158,11,0.15)] text-[#fcd34d]' },
  { fill: 'rgba(236, 72, 153, 0.35)', stroke: '#ec4899', glow: 'rgba(236, 72, 153, 0.5)', chip: 'border-[#ec4899] bg-[rgba(236,72,153,0.15)] text-[#f9a8d4]' },
  { fill: 'rgba(168, 85, 247, 0.35)', stroke: '#a855f7', glow: 'rgba(168, 85, 247, 0.5)', chip: 'border-[#a855f7] bg-[rgba(168,85,247,0.15)] text-[#d8b4fe]' },
  { fill: 'rgba(20, 184, 166, 0.38)', stroke: '#14b8a6', glow: 'rgba(20, 184, 166, 0.55)', chip: 'border-[#14b8a6] bg-[rgba(20,184,166,0.15)] text-[#5eead4]' },
  { fill: 'rgba(249, 115, 22, 0.38)', stroke: '#f97316', glow: 'rgba(249, 115, 22, 0.55)', chip: 'border-[#f97316] bg-[rgba(249,115,22,0.15)] text-[#fdba74]' },
  { fill: 'rgba(14, 165, 233, 0.38)', stroke: '#0ea5e9', glow: 'rgba(14, 165, 233, 0.55)', chip: 'border-[#0ea5e9] bg-[rgba(14,165,233,0.15)] text-[#7dd3fc]' },
  { fill: 'rgba(132, 204, 22, 0.38)', stroke: '#84cc16', glow: 'rgba(132, 204, 22, 0.55)', chip: 'border-[#84cc16] bg-[rgba(132,204,22,0.15)] text-[#bef264]' },
  { fill: 'rgba(244, 63, 94, 0.35)', stroke: '#f43f5e', glow: 'rgba(244, 63, 94, 0.5)', chip: 'border-[#f43f5e] bg-[rgba(244,63,94,0.15)] text-[#fda4af]' },
] as const;

export function groupColor(index: number): GroupColor {
  return GROUP_PALETTE[index % GROUP_PALETTE.length]!;
}

function strokeRgb(index: number): { r: number; g: number; b: number } {
  const hex = groupColor(index).stroke.replace('#', '');
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

/** Soft hover fill for the pending / active selection group. */
export function groupHoverFill(index: number): string {
  const { r, g, b } = strokeRgb(index);
  return `rgba(${r}, ${g}, ${b}, 0.28)`;
}

/** Fill for territories selected into the next (or active) group. */
export function groupSelectionFill(index: number): string {
  const { r, g, b } = strokeRgb(index);
  return `rgba(${r}, ${g}, ${b}, 0.45)`;
}

/** Stronger fill for selected municípios overlays. */
export function groupMuniSelectionFill(index: number): string {
  const { r, g, b } = strokeRgb(index);
  return `rgba(${r}, ${g}, ${b}, 0.55)`;
}

/** Very soft muni mesh tint while hovering a UF. */
export function groupMuniHoverFill(index: number): string {
  const { r, g, b } = strokeRgb(index);
  return `rgba(${r}, ${g}, ${b}, 0.08)`;
}
