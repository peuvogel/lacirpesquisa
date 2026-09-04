import { COMING_SOON_COPY } from '@/release/releaseManifest';

export function ComingSoonPage() {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] place-items-center px-4">
      <h1 className="font-sans text-display font-bold text-text">{COMING_SOON_COPY}</h1>
    </div>
  );
}
