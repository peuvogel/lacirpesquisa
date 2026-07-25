import { BrazilMapCanvas } from './BrazilMapCanvas';

export interface BrazilMockMapProps {
  hoveredUF: string | null;
  selectedUFs: string[];
  highlightedUFs?: string[];
  groupMembership?: Record<string, { groupIndex: number; groupName: string }>;
  onHoverUF: (uf: string | null) => void;
  onToggleUF: (uf: string) => void;
}

/**
 * Inline SVG Brazil-by-UF map (D-20–D-23). Browser SVG hit-testing drives
 * hover/click — no point-in-polygon math (01-RESEARCH.md § Don't Hand-Roll).
 * Geometry is committed as data (`brazilUfPaths.ts`) and rendered as real
 * `<path>` elements, never via `dangerouslySetInnerHTML` (T-01-SVG).
 *
 * @deprecated Wave 3 — use BrazilMapCanvas with choroplethValues instead.
 */
export function BrazilMockMap(props: BrazilMockMapProps) {
  return (
    <BrazilMapCanvas
      {...props}
      choroplethValues={{}}
      activeVariableId={null}
    />
  );
}

