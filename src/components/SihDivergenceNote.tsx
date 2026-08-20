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
