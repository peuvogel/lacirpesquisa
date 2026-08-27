import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ResearchAccordionPanel } from './ResearchAccordionPanel';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <ResearchAccordionPanel
      open={open}
      onOpenChange={setOpen}
      step="Grupo 1"
      title="Bahia e Sergipe"
      summary="2 estados · 2019 a 2024"
      subtitle="Configuração independente"
    >
      <p>Conteúdo do grupo</p>
    </ResearchAccordionPanel>
  );
}

describe('ResearchAccordionPanel', () => {
  it('uses the shared measured collapsible and toggles with Enter', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: /Bahia e Sergipe/ });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    trigger.focus();
    await user.keyboard('{Enter}');

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Conteúdo do grupo').closest('[data-slot="collapsible-content"]'))
      .toHaveAttribute('data-motion', 'animated');
  });
});
