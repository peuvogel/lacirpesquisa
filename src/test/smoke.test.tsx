import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App smoke test', () => {
  it('renders the LACIR heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Bioestatística LACIR' })).toBeInTheDocument();
  });

  it('loads the canvas stub from test setup', () => {
    const canvas = document.createElement('canvas');
    expect(canvas.toDataURL()).toBe('data:image/png;base64,stub');
  });
});
