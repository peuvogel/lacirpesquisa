import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ChartOverlayIconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick'> {
  onClick: () => void;
  label: string;
  className?: string;
  children: ReactNode;
}

/** Compact icon control for chart overlays (edit / download). */
export const ChartOverlayIconButton = forwardRef<HTMLButtonElement, ChartOverlayIconButtonProps>(function ChartOverlayIconButton({
  onClick,
  label,
  className,
  children,
  ...buttonProps
}, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn('lacir-dl-btn', className)}
      {...buttonProps}
    >
      <span className="lacir-dl-btn__icon" aria-hidden="true">
        {children}
      </span>
    </button>
  );
});

export function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('lacir-dl-btn__svg lacir-dl-btn__svg--stroke', className)}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
