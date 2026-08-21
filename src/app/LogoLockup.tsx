export function resolvePublicAssetUrl(baseUrl: string, assetPath: string) {
  const normalizedBase = baseUrl
    ? `${baseUrl.replace(/\/+$/, '')}/`
    : '/';
  const normalizedAssetPath = assetPath.replace(/^\/+/, '');

  return `${normalizedBase}${normalizedAssetPath}`;
}

export function LogoLockup() {
  return (
    <span className="flex items-center gap-3">
      <img
        src={resolvePublicAssetUrl(import.meta.env.BASE_URL, 'logo-lacir.png')}
        alt="Logo LACIR"
        style={{ height: 32, width: 'auto', objectFit: 'contain' }}
      />
      <span className="flex flex-col leading-tight">
        <span className="font-sans text-label font-bold uppercase tracking-wide text-accent">
          LACIR
        </span>
        <span className="font-sans text-label font-normal text-text-muted">
          Bioestatística
        </span>
      </span>
    </span>
  );
}
