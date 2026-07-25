import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlphaSelector } from './AlphaSelector';
import { AssumptionNudgeStrip } from './AssumptionNudgeStrip';
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

describe('AssumptionNudgeStrip', () => {
  it('renders info and warning nudges with distinct status alerts', () => {
    render(
      <AssumptionNudgeStrip
        nudges={[
          { severity: 'info', message: 'Teste não paramétrico — use quando a normalidade falhar.' },
          { severity: 'warning', message: 'Contagens esperadas baixas — interprete com cautela.' },
        ]}
      />,
    );

    expect(screen.getByTestId('assumption-nudge-strip')).toBeInTheDocument();
    const statuses = screen.getAllByRole('status');
    expect(statuses).toHaveLength(2);
    expect(screen.getByText(/Teste não paramétrico/)).toBeInTheDocument();
    expect(screen.getByText(/Contagens esperadas baixas/)).toBeInTheDocument();
  });

  it('fires onNavigateTest when CTA is clicked', async () => {
    const user = userEvent.setup();
    const onNavigateTest = vi.fn();

    render(
      <AssumptionNudgeStrip
        nudges={[
          {
            severity: 'warning',
            message: 'Superdispersão detectada.',
            cta: { label: 'Abrir Binomial Negativa', testId: 'binomial-negativa' },
          },
        ]}
        onNavigateTest={onNavigateTest}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Abrir Binomial Negativa' }));
    expect(onNavigateTest).toHaveBeenCalledWith('binomial-negativa');
  });

  it('renders nothing when nudges array is empty', () => {
    const { container } = render(<AssumptionNudgeStrip nudges={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
