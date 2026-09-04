import { expect } from 'vitest';
import { screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';

type User = ReturnType<typeof userEvent.setup>;

/**
 * Liga/desliga de coluna e de linha na prévia de dados. Substitui o antigo
 * `selectColumnType(..., 'ignorar')`: 'ignorar' saiu da roda de tipos e a
 * exclusão passou a ser este interruptor, que preserva o tipo escolhido.
 */
export function columnToggle(columnLabel: string): HTMLElement {
  return screen.getByRole('checkbox', { name: `Incluir coluna ${columnLabel} na análise` });
}

export function rowToggle(rowNumber: number): HTMLElement {
  return screen.getByRole('checkbox', { name: `Incluir linha ${rowNumber} na análise` });
}

export async function setColumnEnabled(
  user: User,
  columnLabel: string,
  enabled: boolean,
): Promise<void> {
  const toggle = columnToggle(columnLabel);
  if ((toggle as HTMLInputElement).checked !== enabled) await user.click(toggle);
  expect(toggle).toHaveProperty('checked', enabled);
}

export async function setRowEnabled(
  user: User,
  rowNumber: number,
  enabled: boolean,
): Promise<void> {
  const toggle = rowToggle(rowNumber);
  if ((toggle as HTMLInputElement).checked !== enabled) await user.click(toggle);
  expect(toggle).toHaveProperty('checked', enabled);
}
