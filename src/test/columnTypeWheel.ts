import type userEvent from '@testing-library/user-event';

import { columnRoleLabel } from '@/shared/data-input/columnRoles';
import type { TabularColumnRole } from '@/shared/data-input/recognizedColumnsFromTabular';
import { screen } from '@testing-library/react';

import { expectWheelOption, findWheelByLabel, selectWheelOption } from './wheelPicker';

type User = ReturnType<typeof userEvent.setup>;

const label = (columnLabel: string) => `Tipo da coluna ${columnLabel}`;

/**
 * A roda de tipo nasce travada, então o percurso real é destravar e só então
 * girar. O cadeado só existe no cabeçalho da prévia; onde não houver, segue direto.
 */
export async function selectColumnType(
  user: User,
  columnLabel: string,
  role: TabularColumnRole,
): Promise<void> {
  const unlock = screen.queryByRole('button', { name: `Destravar o tipo da coluna ${columnLabel}` });
  if (unlock) await user.click(unlock);
  await selectWheelOption(user, label(columnLabel), columnRoleLabel(role));
}

export function expectColumnType(columnLabel: string, role: TabularColumnRole): void {
  expectWheelOption(label(columnLabel), columnRoleLabel(role));
}

export function findColumnTypeWheel(columnLabel: string): Promise<HTMLElement> {
  return findWheelByLabel(label(columnLabel));
}
