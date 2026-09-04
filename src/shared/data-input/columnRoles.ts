import type { TabularColumnRole } from './recognizedColumnsFromTabular';

export interface ColumnRoleOption {
  value: TabularColumnRole;
  label: string;
  /** Aplicado pelo visor do WheelPicker — dá a cada tipo a sua cor. */
  className: string;
}

/**
 * Vocabulário de tipos de variável da prévia de dados, com a cor de cada um.
 *
 * Vive fora do ColumnPreviewTable porque rótulo e cor são compartilhados com os
 * helpers de teste. Não confundir com os vínculos de análise (desfecho, grupo,
 * variavel_x…), que são outro vocabulário.
 */
/**
 * Array mutável de propósito: o WheelPicker recebe `options` por referência e
 * `[...spread]` a cada render criaria identidade nova, realimentando o laço de
 * scroll do componente.
 */
/**
 * 'ignorar' continua no type union e na persistência (snapshots antigos podem
 * tê-lo), mas saiu da roda: excluir uma coluna da análise agora é o interruptor
 * do cabeçalho, que preserva o tipo escolhido.
 */
export const COLUMN_ROLE_OPTIONS: ColumnRoleOption[] = [
  { value: 'numerica', label: 'Numérica', className: 'font-bold text-type-numerica' },
  { value: 'categorica', label: 'Categórica', className: 'font-bold text-type-categorica' },
  { value: 'tempo', label: 'Tempo', className: 'font-bold text-type-tempo' },
];

export function columnRoleLabel(role: TabularColumnRole): string {
  return COLUMN_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}
