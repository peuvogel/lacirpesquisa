import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { TerritoryPastePanel } from './TerritoryPastePanel';

const TEXTAREA_LABEL = 'Cole territórios — um por linha';
const DEBOUNCE_MS = 300;

describe('TerritoryPastePanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders Colar territórios heading and helper copy', () => {
    render(<TerritoryPastePanel onMatched={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Colar territórios' })).toBeInTheDocument();
    expect(
      screen.getByText('Cole nomes de estados, municípios ou siglas — um por linha.'),
    ).toBeInTheDocument();
  });

  it('calls onMatched with deduped siglas after debounced paste', async () => {
    const onMatched = vi.fn();
    render(<TerritoryPastePanel onMatched={onMatched} />);
    const textarea = screen.getByLabelText(TEXTAREA_LABEL);

    fireEvent.change(textarea, { target: { value: 'BA\nPE' } });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(onMatched).toHaveBeenCalledWith(['BA', 'PE']);
    expect(screen.getByText('Reconhecidos (2)')).toBeInTheDocument();
  });

  it('lists unmatched lines under Não reconhecidos', async () => {
    render(<TerritoryPastePanel onMatched={() => {}} />);
    const textarea = screen.getByLabelText(TEXTAREA_LABEL);

    fireEvent.change(textarea, { target: { value: 'BA\nXYZ' } });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(screen.getByText('Reconhecidos (1)')).toBeInTheDocument();
    expect(screen.getByText('Não reconhecidos (1)')).toBeInTheDocument();
    expect(screen.getByText('XYZ')).toBeInTheDocument();
  });

  it('shows error Alert with Ver detalhes when nothing matches', async () => {
    render(<TerritoryPastePanel onMatched={() => {}} />);
    const textarea = screen.getByLabelText(TEXTAREA_LABEL);

    fireEvent.change(textarea, { target: { value: 'XYZ\nABC' } });

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(
      screen.getByText(/Não conseguimos reconhecer esses territórios/),
    ).toBeInTheDocument();

    const disclosure = screen.getByText('Ver detalhes');
    fireEvent.click(disclosure);
    expect(screen.getByText('XYZ')).toBeInTheDocument();
    expect(screen.getByText('ABC')).toBeInTheDocument();
  });

  it('parses immediately on blur without waiting for debounce', async () => {
    const onMatched = vi.fn();
    render(<TerritoryPastePanel onMatched={onMatched} />);
    const textarea = screen.getByLabelText(TEXTAREA_LABEL);

    fireEvent.change(textarea, { target: { value: 'BA' } });
    fireEvent.blur(textarea);

    expect(onMatched).toHaveBeenCalledWith(['BA']);
  });
});
