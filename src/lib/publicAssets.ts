/** Resolve an asset relative to Vite's deployment base without duplicating slashes. */
export function resolvePublicAssetUrl(baseUrl: string, assetPath: string): string {
  const normalizedBase = baseUrl ? `${baseUrl.replace(/\/+$/, '')}/` : '/';
  const normalizedAssetPath = assetPath.replace(/^\/+/, '');

  return `${normalizedBase}${normalizedAssetPath}`;
}
