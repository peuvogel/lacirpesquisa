import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlphaSelector } from './AlphaSelector';
import { ModeChoiceCard } from './ModeChoiceCard';
import { SoftResetAlert } from './SoftResetAlert';

describe('shared Configurar components', () => {
  it('ModeChoiceCard renders radiogroup with UI-SPEC copy and aria-checked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ModeChoiceCard
        groupLabel="Tipo de comparação"
        value="independent"
        onChange={onChange}
        options={[
          {
            id: 'independent',
            title: 't independente (Welch)',
            description: 'Compare dois grupos distintos. Cada grupo pode ter tamanhos diferentes.',
          },
          {
            id: 'paired',
            title: 't pareado',
            description: 'Compare as mesmas unidades nas duas colunas, na mesma ordem.',
          },
        ]}
      />,
    );

    const group = screen.getByRole('radiogroup', { name: 'Tipo de comparação' });
    expect(group).toBeInTheDocument();

    const independent = screen.getByRole('radio', { name: /t independente \(Welch\)/ });
    const paired = screen.getByRole('radio', { name: /t pareado/ });

    expect(independent).toHaveAttribute('aria-checked', 'true');
    expect(paired).toHaveAttribute('aria-checked', 'false');

    await user.click(paired);
    expect(onChange).toHaveBeenCalledWith('paired');
  });

  it('AlphaSelector renders UI-SPEC label and default 5% option', () => {
    const onChange = vi.fn();

    render(<AlphaSelector value="0.05" onChange={onChange} />);

    expect(screen.getByText('Nível de significância (α)')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('SoftResetAlert renders UI-SPEC copy with status role', () => {
    render(<SoftResetAlert />);

    const alert = screen.getByRole('status');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('Modo alterado.')).toBeInTheDocument();
    expect(
      screen.getByText(/Mantivemos os dados colados, mas limpamos as configurações específicas deste modo/),
    ).toBeInTheDocument();
  });
});
