import { expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';

type User = ReturnType<typeof userEvent.setup>;

/**
 * Helpers para os controles que usam o WheelPicker (role="listbox").
 *
 * `user.selectOptions` e `toHaveValue` só valem para <select> nativo. Cada
 * <li role="option"> da roda tem onClick próprio, que não depende de geometria
 * — por isso o clique funciona em jsdom, onde todo getBoundingClientRect é zero.
 */
export function wheelByLabel(ariaLabel: string): HTMLElement {
  return screen.getByRole('listbox', { name: ariaLabel });
}

export function findWheelByLabel(ariaLabel: string): Promise<HTMLElement> {
  return screen.findByRole('listbox', { name: ariaLabel });
}

export async function selectWheelOption(
  user: User,
  ariaLabel: string,
  optionLabel: string,
): Promise<void> {
  await user.click(within(wheelByLabel(ariaLabel)).getByRole('option', { name: optionLabel }));
}

export function expectWheelOption(ariaLabel: string, optionLabel: string): void {
  expect(
    within(wheelByLabel(ariaLabel)).getByRole('option', { name: optionLabel }),
  ).toHaveAttribute('aria-selected', 'true');
}
