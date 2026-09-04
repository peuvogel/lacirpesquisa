import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AlphaSelector } from './AlphaSelector';
import { alphaToPercent, parseAlpha, percentToAlpha } from './alpha';

describe('AlphaSelector', () => {
  it('shows decimal 0.1 as 10%, never 0.1%', () => {
    render(<AlphaSelector value={parseAlpha(0.1)} onChange={vi.fn()} />);

    expect(screen.getByText(/10%/)).toBeInTheDocument();
    expect(screen.queryByText(/0,1%/)).not.toBeInTheDocument();
  });

  it('round-trips every wheel step and does not change alpha when only lock state changes', async () => {
    for (let step = 1; step <= 100; step += 1) {
      const percent = step / 10;
      expect(alphaToPercent(percentToAlpha(percent))).toBeCloseTo(percent, 12);
    }

    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AlphaSelector value={parseAlpha(0.05)} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /desbloquear/i }));
    await user.click(screen.getByRole('button', { name: /bloquear/i }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
