import { getDivergenciaRazao } from '@/features/catalog/catalogAnalysisData';
import { catalogIdFor, parseCatalogId } from '@/features/catalog/taxonomy';

/**
 * Nota curta que explica, ao lado do número, por que ele difere de uma consulta padrão do TabNet.
 *
 * O critério do operador para esta fase é "quando o aluno puxar TabNet e site lado a lado, ou os
 * dois batem, ou a diferença está justificada". A paridade está provada (134/134 exatos contra um
 * TabNet bem-formado); esta nota é a outra metade — a justificativa para a consulta INGÊNUA, que é
 * a que o aluno faz por padrão e que mostra menos.
 *
 * Não recebe texto por prop literal: o `razao` chega do pack, que o recebe de
 * `sih_collection_status`, que o recebe de `paridade.py`. Uma fonte só, do Python até a tela.
 *
 * Renderiza `null` quando não há razão — "quando houver", nunca uma caixa vazia ocupando espaço.
 */
export function SihDivergenceNote({ razao }: { razao?: string | null }) {
  if (!razao) return null;

  return (
    <p className="mt-2 max-w-prose font-sans text-xs leading-relaxed text-text-muted">
      <span className="font-semibold text-accent">Por que difere do TabNet: </span>
      {razao}
    </p>
  );
}

/**
 * Reúne as razões vindas dos packs para uma superfície e evita repetir a mesma explicação quando
 * mais de uma variável aponta para ela. A frase continua a fluir do pack pelo helper, sem cópia.
 */
export function SihDivergenceNotes({
  variableIds,
  diseaseIds = [],
}: {
  variableIds: readonly string[];
  diseaseIds?: readonly string[];
}) {
  // Derived analysis profiles do not all have their own catalog column. The divergence reason is
  // pack-level, so a generic profile resolves through the pack's guaranteed admissions entry.
  const provenanceIds = variableIds.flatMap((variableId) => parseCatalogId(variableId)
    ? [variableId]
    : diseaseIds.map((diseaseId) => catalogIdFor('internacoes', diseaseId)));
  const razoes = [...new Set(provenanceIds
    .map((variableId) => getDivergenciaRazao(variableId))
    .filter((razao): razao is string => Boolean(razao)))];

  if (razoes.length === 0) return null;

  return <>{razoes.map((razao) => <SihDivergenceNote key={razao} razao={razao} />)}</>;
}
