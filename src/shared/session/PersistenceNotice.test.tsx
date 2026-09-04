import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PersistenceNotice } from './PersistenceNotice';

describe('PersistenceNotice', () => {
  it('stays hidden while persistent storage is healthy', () => {
    const { container } = render(
      <PersistenceNotice mode="persistent" status="saved" message={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('announces memory mode with durable explanatory text', () => {
    render(<PersistenceNotice mode="memory" status="saved" message={null} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Modo temporário: os dados durarão somente nesta sessão.',
    );
  });

  it('announces a persistence failure assertively without showing success copy', () => {
    const message = 'A sessão salva era incompatível ou estava corrompida e não foi restaurada.';
    const { container, rerender } = render(
      <PersistenceNotice
        mode="persistent"
        status="error"
        message={message}
      />,
    );

    const notice = screen.getByRole('alert');
    expect(notice).toHaveAttribute('aria-live', 'assertive');
    expect(notice).toHaveTextContent(message);
    expect(screen.queryByText(/salv[ao] com sucesso/i)).not.toBeInTheDocument();

    rerender(<PersistenceNotice mode="persistent" status="saving" message={message} />);
    expect(screen.getByRole('alert')).toHaveTextContent(message);

    rerender(<PersistenceNotice mode="persistent" status="saved" message={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
