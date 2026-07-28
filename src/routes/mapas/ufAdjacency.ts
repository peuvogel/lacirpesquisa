/**
 * Contiguous UF neighbors (land borders). Used for merge-hint border glow
 * when two selected states share an edge.
 */
export const UF_ADJACENCY: Record<string, readonly string[]> = {
  AC: ['AM', 'RO'],
  AL: ['BA', 'PE', 'SE'],
  AP: ['PA'],
  AM: ['AC', 'MT', 'PA', 'RO', 'RR'],
  BA: ['AL', 'ES', 'GO', 'MG', 'PE', 'PI', 'SE', 'TO'],
  CE: ['PB', 'PE', 'PI', 'RN'],
  DF: ['GO', 'MG'],
  ES: ['BA', 'MG', 'RJ'],
  GO: ['BA', 'DF', 'MG', 'MT', 'MS', 'TO'],
  MA: ['PA', 'PI', 'TO'],
  MT: ['AM', 'GO', 'MS', 'PA', 'RO', 'TO'],
  MS: ['GO', 'MT', 'MG', 'PR', 'SP'],
  MG: ['BA', 'DF', 'ES', 'GO', 'MS', 'RJ', 'SP'],
  PA: ['AP', 'AM', 'MA', 'MT', 'RR', 'TO'],
  PB: ['CE', 'PE', 'RN'],
  PR: ['MS', 'SC', 'SP'],
  PE: ['AL', 'BA', 'CE', 'PB', 'PI'],
  PI: ['BA', 'CE', 'MA', 'PE', 'TO'],
  RJ: ['ES', 'MG', 'SP'],
  RN: ['CE', 'PB'],
  RS: ['SC'],
  RO: ['AC', 'AM', 'MT'],
  RR: ['AM', 'PA'],
  SC: ['PR', 'RS'],
  SP: ['MG', 'MS', 'PR', 'RJ'],
  SE: ['AL', 'BA'],
  TO: ['BA', 'GO', 'MA', 'MT', 'PA', 'PI'],
};

/** True when both siglas are selected and share a land border. */
export function hasSelectedNeighbor(
  sigla: string,
  selected: ReadonlySet<string> | readonly string[],
): boolean {
  const set = selected instanceof Set ? selected : new Set(selected);
  if (!set.has(sigla)) return false;
  const neighbors = UF_ADJACENCY[sigla] ?? [];
  return neighbors.some((n) => set.has(n));
}
