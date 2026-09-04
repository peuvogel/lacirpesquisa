// ─── Projeção Geométrica da Roda 3D ──────────────────────────────────────────
export type WheelGeometry = {
  radius: number;
  stepDeg: number;
  perspective: number;
};

/** Deslocamento vertical (px a partir do centro) da face a `k` passos */
export function faceOffsetPx(k: number, geo: WheelGeometry): number {
  const theta = (k * geo.stepDeg * Math.PI) / 180;
  const flat = geo.radius * Math.sin(theta);
  const depth = geo.perspective + geo.radius * (1 - Math.cos(theta));
  if (depth <= 0) return flat;
  return (flat * geo.perspective) / depth;
}

/** Descobre qual opção desenhada em 3D está mais próxima da coordenada do clique */
export function faceIndexAt(
  offsetPx: number,
  progress: number,
  count: number,
  geo: WheelGeometry
): number {
  let best = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < count; i++) {
    const k = i - progress;
    if (Math.abs(k * geo.stepDeg) >= 90) continue;
    const distance = Math.abs(faceOffsetPx(k, geo) - offsetPx);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}
