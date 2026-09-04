import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlphaSelector } from './AlphaSelector';
import { parseAlpha } from './alpha';
import { AssumptionNudgeInfo } from './AssumptionNudgeInfo';
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

  it('ModeChoiceCard keeps mode descriptions out of the radios and inside the info popover', async () => {
    const user = userEvent.setup();

    render(
      <ModeChoiceCard
        groupLabel="Tipo de comparação"
        value="independent"
        onChange={vi.fn()}
        options={[
          {
            id: 'independent',
            title: 't independente (Welch)',
            description: 'Compare dois grupos distintos.',
          },
          {
            id: 'paired',
            title: 't pareado',
            description: 'Compare as mesmas unidades nas duas colunas, na mesma ordem.',
          },
        ]}
      />,
    );

    expect(screen.queryByText('Compare dois grupos distintos.')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Compare as mesmas unidades nas duas colunas, na mesma ordem.'),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Sobre as opções de tipo de comparação' }),
    );

    expect(await screen.findByText('Compare dois grupos distintos.')).toBeInTheDocument();
    expect(
      screen.getByText('Compare as mesmas unidades nas duas colunas, na mesma ordem.'),
    ).toBeInTheDocument();
  });

  it('ModeChoiceCard moves between modes with arrow keys', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ModeChoiceCard
        groupLabel="Tipo de comparação"
        value="independent"
        onChange={onChange}
        options={[
          { id: 'independent', title: 't independente (Welch)', description: 'A.' },
          { id: 'paired', title: 't pareado', description: 'B.' },
        ]}
      />,
    );

    const independent = screen.getByRole('radio', { name: /t independente \(Welch\)/ });
    const paired = screen.getByRole('radio', { name: /t pareado/ });

    expect(independent).toHaveAttribute('tabindex', '0');
    expect(paired).toHaveAttribute('tabindex', '-1');

    independent.focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('paired');

    onChange.mockClear();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('independent');
  });

  it('AlphaSelector renders UI-SPEC label and inline WheelPicker listbox', () => {
    const onChange = vi.fn();

    render(<AlphaSelector value={parseAlpha(0.05)} onChange={onChange} />);

    expect(screen.getByText('Nível de significância (α)')).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: /nível de significância/i })).toBeInTheDocument();
  });

  it('SoftResetAlert renders UI-SPEC copy with status role', () => {
    render(<SoftResetAlert />);

    const alert = screen.getByRole('status');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('Análise anterior invalidada.')).toBeInTheDocument();
    expect(
      screen.getByText(/Os dados ou a configuração foram alterados/),
    ).toBeInTheDocument();
  });
});

describe('AssumptionNudgeInfo', () => {
  it('keeps the assumptions one click away and flags warnings on the trigger', async () => {
    const user = userEvent.setup();
    render(
      <AssumptionNudgeInfo
        nudges={[
          { severity: 'info', message: 'Teste não paramétrico. Use quando a normalidade falhar.' },
          { severity: 'warning', message: 'Contagens esperadas baixas. Interprete com cautela.' },
        ]}
      />,
    );

    // Havendo aviso, o gatilho avisa por si — nada de ressalva escondida atrás
    // de um ícone neutro.
    const trigger = screen.getByRole('button', { name: 'Pressupostos e avisos deste teste' });
    expect(trigger).toHaveAttribute('data-severity', 'warning');

    await user.click(trigger);
    expect(await screen.findByText(/Contagens esperadas baixas/)).toBeInTheDocument();
    expect(screen.getByText(/Teste não paramétrico/)).toBeInTheDocument();
  });

  it('calls the trigger "Pressupostos" when every nudge is informative', () => {
    render(<AssumptionNudgeInfo nudges={[{ severity: 'info', message: 'Compara postos.' }]} />);
    const trigger = screen.getByRole('button', { name: 'Pressupostos deste teste' });
    expect(trigger).toHaveAttribute('data-severity', 'info');
  });

  it('fires onNavigateTest when CTA is clicked', async () => {
    const user = userEvent.setup();
    const onNavigateTest = vi.fn();

    render(
      <AssumptionNudgeInfo
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

    await user.click(screen.getByRole('button', { name: 'Pressupostos e avisos deste teste' }));
    await user.click(await screen.findByRole('button', { name: 'Abrir Binomial Negativa' }));
    expect(onNavigateTest).toHaveBeenCalledWith('binomial-negativa');
  });

  it('renders nothing when nudges array is empty', () => {
    const { container } = render(<AssumptionNudgeInfo nudges={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
