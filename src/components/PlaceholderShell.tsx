import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';

export interface PlaceholderShellProps {
  title: string;
  children?: ReactNode;
}

// Reused verbatim by Meta-análise and Variáveis (D-06) so their "Em breve"
// copy cannot drift apart. Real layout shell, no interactive controls.
export function PlaceholderShell({ title, children }: PlaceholderShellProps) {
  return (
    <div className="mx-auto max-w-[1520px] px-6 py-8">
      <h1 className="font-sans text-display font-bold text-text">{title}</h1>
      <div className="flex justify-center pt-16">
        <EmptyState
          heading="Em breve"
          body="Este módulo chega em uma próxima fase da LACIR. Enquanto isso, explore a Estatística ou os Mapas."
        >
          {children}
        </EmptyState>
      </div>
    </div>
  );
}
