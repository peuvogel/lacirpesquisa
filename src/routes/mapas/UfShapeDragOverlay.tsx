import { useMemo } from 'react';
import { BRAZIL_UF_GROUP_TRANSFORM, BRAZIL_UF_PATHS } from './brazilUfPaths';

export interface UfShapeDragOverlayProps {
  siglas: readonly string[];
  /** 0 = far from group strip (large), 1 = over drop target (small). */
  proximity: number;
  /** Pending group stroke color. */
  accentStroke?: string;
}

const START_SIZE = 300;
const END_SIZE = 72;

function bboxForPaths(paths: readonly { d: string }[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  if (typeof document === 'undefined' || paths.length === 0) return null;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText =
    'position:absolute;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden';
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', BRAZIL_UF_GROUP_TRANSFORM);
  for (const entry of paths) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', entry.d);
    g.appendChild(path);
  }
  svg.appendChild(g);
  document.body.appendChild(svg);
  const box = g.getBBox();
  document.body.removeChild(svg);

  if (!Number.isFinite(box.width) || box.width <= 0 || box.height <= 0) return null;
  const pad = Math.max(box.width, box.height) * 0.14;
  return {
    x: box.x - pad,
    y: box.y - pad,
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  };
}

/**
 * Drag ghost: cropped UF contours that start large and shrink toward the Grupos strip.
 */
export function UfShapeDragOverlay({
  siglas,
  proximity,
  accentStroke = '#209978',
}: UfShapeDragOverlayProps) {
  const siglaKey = siglas.join(',');
  const { paths, bbox } = useMemo(() => {
    const selected = new Set(siglaKey.split(',').filter(Boolean));
    const nextPaths = BRAZIL_UF_PATHS.filter((p) => selected.has(p.sigla));
    return { paths: nextPaths, bbox: bboxForPaths(nextPaths) };
  }, [siglaKey]);

  if (paths.length === 0 || !bbox) return null;

  const t = Math.min(1, Math.max(0, proximity));
  // Ease so shrink accelerates near the strip.
  const eased = t * t * (3 - 2 * t);
  const size = START_SIZE - eased * (START_SIZE - END_SIZE);
  const opacity = 0.95 - eased * 0.12;
  const fill = accentStroke.length === 7 ? `${accentStroke}99` : accentStroke;

  return (
    <div
      aria-hidden
      className="pointer-events-none"
      style={{
        width: size,
        height: size,
        opacity,
        transition: 'width 80ms linear, height 80ms linear, opacity 80ms linear',
      }}
    >
      <svg
        viewBox={`${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`}
        className="h-full w-full overflow-visible drop-shadow-[0_10px_28px_rgba(0,0,0,0.5)]"
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={BRAZIL_UF_GROUP_TRANSFORM}>
          {paths.map(({ sigla, d }) => (
            <path
              key={sigla}
              d={d}
              fill={fill}
              stroke={accentStroke}
              strokeWidth={2.2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
