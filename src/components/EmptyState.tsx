import type { ReactNode } from 'react';

export interface EmptyStateProps {
  heading: string;
  body: string;
  children?: ReactNode;
}

export function EmptyState({ heading, body, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="font-sans text-heading font-bold text-text">{heading}</h2>
      <p className="mt-2 max-w-md font-sans text-body font-normal text-text-muted">{body}</p>
      {children}
    </div>
  );
}
