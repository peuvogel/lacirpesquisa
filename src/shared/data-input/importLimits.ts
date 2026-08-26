/** Fixed browser resource budgets. Never truncate an import to make it fit. */
export const IMPORT_LIMITS = Object.freeze({
  fileBytes: 10 * 1024 * 1024,
  textCharacters: 5_000_000,
  dataRows: 10_000,
  columns: 128,
  cells: 200_000,
  sheets: 32,
  zipEntries: 2_048,
  entryBytes: 16 * 1024 * 1024,
  totalBytes: 64 * 1024 * 1024,
});

export type ImportLimits = Readonly<Record<keyof typeof IMPORT_LIMITS, number>>;
type LimitKey = keyof ImportLimits;
const labels: Record<LimitKey, string> = {
  fileBytes: 'arquivo', textCharacters: 'texto colado', dataRows: 'linhas de dados',
  columns: 'colunas', cells: 'células (incluindo cabeçalho e preenchimento)',
  sheets: 'abas', zipEntries: 'entradas ZIP', entryBytes: 'entrada XLSX descompactada',
  totalBytes: 'total XLSX descompactado',
};

/** A profile is injectable only into pure validators, never into import entrypoints. */
export function validateImportLimit(key: LimitKey, count: number, limits: ImportLimits = IMPORT_LIMITS): void {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error(`Tamanho inválido para ${labels[key]}.`);
  if (count <= limits[key]) return;
  const byteLimit = key === 'fileBytes' || key === 'entryBytes' || key === 'totalBytes';
  const maximum = byteLimit ? `${limits[key] / (1024 * 1024)} MiB` : limits[key].toLocaleString('pt-BR');
  if (byteLimit) throw new Error(`O ${labels[key]} excede o limite de ${maximum}.`);
  const unit = key === 'textCharacters' ? 'caracteres' : labels[key];
  throw new Error(`O ${labels[key]} excede o limite de ${maximum} ${unit}.`);
}

/** Includes the header and rectangular padding, not just populated source cells. */
export function validateTableSize(dataRows: number, columns: number, limits: ImportLimits = IMPORT_LIMITS): void {
  validateImportLimit('dataRows', dataRows, limits);
  validateImportLimit('columns', columns, limits);
  validateImportLimit('cells', (dataRows + 1) * columns, limits);
}
