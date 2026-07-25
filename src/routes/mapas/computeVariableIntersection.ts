export interface PartialVariable {
  variable: string;
  missingFrom: string[];
}

export interface VariableAvailability {
  intersection: string[];
  partial: PartialVariable[];
}

/**
 * Derives intersection-first variable availability for locked UF selections (D-22).
 * Intersection order follows the first selected UF's declaration order.
 */
export function computeVariableIntersection(
  selectedUFs: string[],
  variablesByUF: Record<string, string[]>,
): VariableAvailability {
  if (selectedUFs.length === 0) {
    return { intersection: [], partial: [] };
  }

  const lists = selectedUFs.map((uf) => new Set(variablesByUF[uf] ?? []));
  const [first, ...rest] = lists;
  const intersection = [...first].filter((variable) => rest.every((set) => set.has(variable)));

  const allVars = new Set(lists.flatMap((set) => [...set]));
  const partial = [...allVars]
    .filter((variable) => !intersection.includes(variable))
    .map((variable) => ({
      variable,
      missingFrom: selectedUFs.filter((uf) => !(variablesByUF[uf] ?? []).includes(variable)),
    }));

  return { intersection, partial };
}
