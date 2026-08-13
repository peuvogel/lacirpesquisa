import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapPrimaryActionBar } from './MapPrimaryActionBar';

function renderActionBar(canReview = false) {
  const onReview = vi.fn();
  render(
    <MapPrimaryActionBar
      canReview={canReview}
      onReview={onReview}
      onPasteTerritories={vi.fn()}
      onClearMap={vi.fn()}
      clearConfirmOpen={false}
      onClearConfirmOpenChange={vi.fn()}
      onConfirmClear={vi.fn()}
    />,
  );
  return { onReview };
}

describe('MapPrimaryActionBar', () => {
  it('starts the inline analysis only after the map cut is complete', async () => {
    const user = userEvent.setup();
    const { onReview } = renderActionBar(true);

    await user.click(screen.getByRole('button', { name: 'Começar análise' }));

    expect(onReview).toHaveBeenCalledOnce();
  });
});
