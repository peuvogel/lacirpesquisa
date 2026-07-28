import { cn } from '@/lib/utils';

export interface DownloadPngButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
  /** Wider labeled chip for footer actions. */
  wide?: boolean;
}

/**
 * Compact chart overlay download (icon). Use `wide` for labeled footer CTA.
 */
export function DownloadPngButton({
  onClick,
  label = 'Download',
  className,
  wide = false,
}: DownloadPngButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn('lacir-dl-btn', wide && 'lacir-dl-btn--wide', className)}
    >
      <span className="lacir-dl-btn__text">{label}</span>
      <span className="lacir-dl-btn__icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 35 35" className="lacir-dl-btn__svg">
          <path d="M17.5,22.131a1.249,1.249,0,0,1-1.25-1.25V2.187a1.25,1.25,0,0,1,2.5,0V20.881A1.25,1.25,0,0,1,17.5,22.131Z" />
          <path d="M17.5,22.693a3.189,3.189,0,0,1-2.262-.936L8.487,15.006a1.249,1.249,0,0,1,1.767-1.767l6.751,6.751a.7.7,0,0,0,.99,0l6.751-6.751a1.25,1.25,0,0,1,1.768,1.767l-6.752,6.751A3.191,3.191,0,0,1,17.5,22.693Z" />
          <path d="M31.436,34.063H3.564A3.318,3.318,0,0,1,.25,30.749V22.011a1.25,1.25,0,0,1,2.5,0v8.738a.815.815,0,0,0,.814.814H31.436a.815.815,0,0,0,.814-.814V22.011a1.25,1.25,0,1,1,2.5,0v8.738A3.318,3.318,0,0,1,31.436,34.063Z" />
        </svg>
      </span>
    </button>
  );
}
