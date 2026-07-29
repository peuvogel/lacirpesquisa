import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTestById, type TestRegistryEntry } from '@/features/tests/registry';
import { SidebarTestLink } from './SidebarTestLink';

// Constructed outside TEST_REGISTRY on purpose — this deliberately bypasses
// the exhaustive TestId type (Pattern 2, 07-RESEARCH.md) to prove the
// runtime fallback in `iconFor` still works for an entry with no dedicated
// icon. `TestRegistryEntry.id` stays a plain `string` exactly so this
// object can exist without violating the registry's own type.
const entrySemIcone: TestRegistryEntry = {
  id: 'novo-teste-sem-icone',
  title: 'Novo teste sem ícone',
  subtitle: 'Ainda sem ícone dedicado',
  group: 'Grupo experimental',
  status: 'available',
  phase: 99,
};

describe('SidebarTestLink', () => {
  it('renders a registry entry with no matching icon without throwing (QA-04)', () => {
    let renderResult: ReturnType<typeof render> | undefined;

    expect(() => {
      renderResult = render(
        <SidebarTestLink entry={entrySemIcone} active={false} onSelect={() => {}} dense />,
      );
    }).not.toThrow();

    expect(screen.getByRole('button', { name: 'Novo teste sem ícone' })).toBeInTheDocument();
    expect(renderResult!.container.querySelector('svg')).not.toBeNull();
  });

  it('renders a real registry entry with its dedicated icon', () => {
    const entry = getTestById('t-student');

    render(<SidebarTestLink entry={entry} active={false} onSelect={() => {}} dense />);

    expect(screen.getByRole('button', { name: 't de Student' })).toBeInTheDocument();
  });

  it('calls onSelect with the entry id when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const entry = getTestById('t-student');

    render(<SidebarTestLink entry={entry} active={false} onSelect={onSelect} dense />);

    await user.click(screen.getByRole('button', { name: 't de Student' }));

    expect(onSelect).toHaveBeenCalledWith('t-student');
  });
});
