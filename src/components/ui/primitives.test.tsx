import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './button';
import { Badge } from './badge';
import { Dialog, DialogContent, DialogTitle } from './dialog';

describe('shadcn primitives', () => {
  it('renders Button with its text child', () => {
    render(<Button>Analisar dados</Button>);
    expect(screen.getByRole('button', { name: 'Analisar dados' })).toBeInTheDocument();
  });

  it('renders Badge with its text child', () => {
    render(<Badge>Disponível</Badge>);
    expect(screen.getByText('Disponível')).toBeInTheDocument();
  });

  it('renders an open Dialog with DialogContent + DialogTitle', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Qual teste usar?</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText('Qual teste usar?')).toBeInTheDocument();
  });
});
