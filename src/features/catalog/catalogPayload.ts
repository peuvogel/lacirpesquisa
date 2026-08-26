import type { CatalogEntry, Manifest, ManifestPackRef, PackFile, PackRow } from './types';

const VARIABLE_TYPES = new Set<CatalogEntry['variableType']>([
  'categorica',
  'numerica',
  'ordinal',
  'taxa',
  'contagem',
  'texto',
]);

const SAFE_PACK_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

type JsonRecord = Record<string, unknown>;

function invalid(message: string): never {
  throw new Error(`Catálogo inválido: ${message}`);
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    invalid(`${label} deve ser um objeto.`);
  }
  return value as JsonRecord;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    invalid(`${label} deve ser uma string não vazia.`);
  }
  return value;
}

function stringList(value: unknown, label: string, allowEmpty = false): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    invalid(`${label} deve ser ${allowEmpty ? 'um array' : 'um array não vazio'} de strings.`);
  }
  const strings = value.map((item, index) => requiredString(item, `${label}[${index}]`));
  if (new Set(strings).size !== strings.length) {
    invalid(`${label} não pode conter valores duplicados.`);
  }
  return strings;
}

function integerList(value: unknown, label: string): number[] {
  if (!Array.isArray(value)) invalid(`${label} deve ser um array de anos.`);
  return value.map((item, index) => {
    if (typeof item !== 'number' || !Number.isInteger(item)) {
      invalid(`${label}[${index}] deve ser um ano inteiro.`);
    }
    return item;
  });
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    invalid(`${label} deve ser um inteiro não negativo.`);
  }
  return value;
}

/** Pack IDs are used in a static path and must never be allowed to alter that path. */
export function assertValidPackId(value: unknown, label = 'packId'): string {
  const packId = requiredString(value, label);
  if (!SAFE_PACK_ID.test(packId)) {
    invalid(`${label} inválido: "${packId}".`);
  }
  return packId;
}

function validateManifestPackRef(value: unknown, index: number): ManifestPackRef {
  const label = `manifest.packs[${index}]`;
  const ref = asRecord(value, label);
  return {
    packId: assertValidPackId(ref.packId, `${label}.packId`),
    grain: requiredString(ref.grain, `${label}.grain`),
    sourceDir: requiredString(ref.sourceDir, `${label}.sourceDir`),
    rowCount: nonNegativeInteger(ref.rowCount, `${label}.rowCount`),
    years: integerList(ref.years, `${label}.years`),
    keys: stringList(ref.keys, `${label}.keys`),
  };
}

export function validateManifest(value: unknown): Manifest {
  const manifest = asRecord(value, 'manifest');
  if (!Array.isArray(manifest.packs)) invalid('manifest.packs deve ser um array.');
  const packs = manifest.packs.map(validateManifestPackRef);
  const packIds = packs.map((pack) => pack.packId);
  if (new Set(packIds).size !== packIds.length) {
    invalid('manifest.packs não pode conter packId duplicado.');
  }
  return {
    version: requiredString(manifest.version, 'manifest.version'),
    generatedAt: requiredString(manifest.generatedAt, 'manifest.generatedAt'),
    catalogEntryCount: nonNegativeInteger(manifest.catalogEntryCount, 'manifest.catalogEntryCount'),
    packs,
  };
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, label);
}

function optionalStringList(value: unknown, label: string): string[] | undefined {
  if (value === undefined) return undefined;
  return stringList(value, label, true);
}

function optionalIntegerList(value: unknown, label: string): number[] | undefined {
  if (value === undefined) return undefined;
  return integerList(value, label);
}

function validateCatalogEntry(value: unknown, index: number): CatalogEntry {
  const label = `variables[${index}]`;
  const entry = asRecord(value, label);
  const variableType = requiredString(entry.variableType, `${label}.variableType`);
  if (!VARIABLE_TYPES.has(variableType as CatalogEntry['variableType'])) {
    invalid(`${label}.variableType é inválido: "${variableType}".`);
  }
  const officialUrl = requiredString(entry.officialUrl, `${label}.officialUrl`);
  if (!/^https?:\/\//i.test(officialUrl)) {
    invalid(`${label}.officialUrl deve ser uma URL http(s) absoluta.`);
  }
  if (typeof entry.loadable !== 'boolean') {
    invalid(`${label}.loadable deve ser booleano.`);
  }

  const packId = optionalString(entry.packId, `${label}.packId`);
  const columnKey = optionalString(entry.columnKey, `${label}.columnKey`);
  if (entry.loadable && (!packId || !columnKey)) {
    invalid(`${label} loadable exige packId e columnKey.`);
  }
  if (packId) assertValidPackId(packId, `${label}.packId`);

  return {
    id: requiredString(entry.id, `${label}.id`),
    label: requiredString(entry.label, `${label}.label`),
    variableType: variableType as CatalogEntry['variableType'],
    domain: requiredString(entry.domain, `${label}.domain`),
    sourceSystem: requiredString(entry.sourceSystem, `${label}.sourceSystem`),
    sourceName: requiredString(entry.sourceName, `${label}.sourceName`),
    tableOrIndicator: requiredString(entry.tableOrIndicator, `${label}.tableOrIndicator`),
    period: requiredString(entry.period, `${label}.period`),
    officialUrl,
    methodologyNotes: requiredString(entry.methodologyNotes, `${label}.methodologyNotes`),
    loadable: entry.loadable,
    ...(packId ? { packId } : {}),
    ...(columnKey ? { columnKey } : {}),
    ...(optionalString(entry.unit, `${label}.unit`) ? { unit: optionalString(entry.unit, `${label}.unit`) } : {}),
    ...(optionalString(entry.grain, `${label}.grain`) ? { grain: optionalString(entry.grain, `${label}.grain`) } : {}),
    ...(optionalStringList(entry.aliases, `${label}.aliases`) ? { aliases: optionalStringList(entry.aliases, `${label}.aliases`) } : {}),
    ...(optionalIntegerList(entry.yearsAvailable, `${label}.yearsAvailable`) ? { yearsAvailable: optionalIntegerList(entry.yearsAvailable, `${label}.yearsAvailable`) } : {}),
    ...(optionalIntegerList(entry.nullYears, `${label}.nullYears`) ? { nullYears: optionalIntegerList(entry.nullYears, `${label}.nullYears`) } : {}),
  };
}

export function validateCatalogEntries(value: unknown): CatalogEntry[] {
  if (!Array.isArray(value)) invalid('variables deve ser um array.');
  const entries = value.map(validateCatalogEntry);
  const ids = entries.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) invalid('variables não pode conter id duplicado.');
  return entries;
}

function validatePackRow(value: unknown, index: number, pack: Pick<PackFile, 'keys' | 'metricKeys'>): PackRow {
  const label = `pack.rows[${index}]`;
  const row = asRecord(value, label);
  for (const [key, rowValue] of Object.entries(row)) {
    if (
      rowValue !== undefined
      && rowValue !== null
      && typeof rowValue !== 'string'
      && (typeof rowValue !== 'number' || !Number.isFinite(rowValue))
    ) {
      invalid(`${label}.${key} deve ser string, número finito, null ou undefined.`);
    }
  }
  for (const key of pack.keys) {
    if (!(key in row) || row[key] == null) invalid(`${label}.${key} é obrigatório.`);
    const rowValue = row[key];
    if (typeof rowValue !== 'string' && typeof rowValue !== 'number') {
      invalid(`${label}.${key} deve ser string ou número.`);
    }
  }
  if (typeof row.uf_codigo !== 'string' || row.uf_codigo.trim() === '') {
    invalid(`${label}.uf_codigo deve ser uma string não vazia.`);
  }
  if (typeof row.uf !== 'string' || row.uf.trim() === '') {
    invalid(`${label}.uf deve ser uma string não vazia.`);
  }
  if (!Number.isInteger(row.ano)) invalid(`${label}.ano deve ser um ano inteiro.`);
  for (const metricKey of pack.metricKeys) {
    const metric = row[metricKey];
    if (metric !== null && (typeof metric !== 'number' || !Number.isFinite(metric))) {
      invalid(`${label}.${metricKey} deve ser número finito ou null.`);
    }
  }
  return row as PackRow;
}

export function validatePackFile(value: unknown): PackFile {
  const pack = asRecord(value, 'pack');
  const keys = stringList(pack.keys, 'pack.keys');
  const metricKeys = stringList(pack.metricKeys, 'pack.metricKeys');
  if (metricKeys.some((key) => keys.includes(key))) {
    invalid('pack.metricKeys não pode repetir uma chave de identidade.');
  }
  if (!Array.isArray(pack.rows)) invalid('pack.rows deve ser um array.');
  const shape = { keys, metricKeys };
  const rows = pack.rows.map((row, index) => validatePackRow(row, index, shape));
  const divergenciaRazao = pack.divergenciaRazao;
  if (divergenciaRazao !== undefined && divergenciaRazao !== null && typeof divergenciaRazao !== 'string') {
    invalid('pack.divergenciaRazao deve ser string ou null.');
  }
  return {
    packId: assertValidPackId(pack.packId, 'pack.packId'),
    grain: requiredString(pack.grain, 'pack.grain'),
    keys,
    metricKeys,
    ...(optionalString(pack.derivedAt, 'pack.derivedAt') ? { derivedAt: optionalString(pack.derivedAt, 'pack.derivedAt') } : {}),
    ...(optionalString(pack.cidMapVersion, 'pack.cidMapVersion') ? { cidMapVersion: optionalString(pack.cidMapVersion, 'pack.cidMapVersion') } : {}),
    ...(divergenciaRazao !== undefined ? { divergenciaRazao } : {}),
    rows,
  };
}

/** Validate the cross-file invariants before a payload becomes observable to the UI. */
export function validateLoadedCatalog(
  manifest: Manifest,
  variables: CatalogEntry[],
  packs: Record<string, PackFile>,
): void {
  if (variables.length !== manifest.catalogEntryCount) {
    invalid(`manifest.catalogEntryCount (${manifest.catalogEntryCount}) difere de variables (${variables.length}).`);
  }
  for (const ref of manifest.packs) {
    const pack = packs[ref.packId];
    if (!pack) invalid(`pack "${ref.packId}" ausente.`);
    if (pack.packId !== ref.packId) invalid(`pack "${ref.packId}" declarou packId "${pack.packId}".`);
    if (pack.grain !== ref.grain) invalid(`pack "${ref.packId}" tem grain divergente.`);
    if (pack.rows.length !== ref.rowCount) invalid(`pack "${ref.packId}" tem rowCount divergente.`);
    if (pack.keys.length !== ref.keys.length || pack.keys.some((key, index) => key !== ref.keys[index])) {
      invalid(`pack "${ref.packId}" tem keys divergentes do manifest.`);
    }
    const packYears = new Set(pack.rows.map((row) => row.ano));
    if (packYears.size !== ref.years.length || ref.years.some((year) => !packYears.has(year))) {
      invalid(`pack "${ref.packId}" tem years divergentes do manifest.`);
    }
  }
  for (const entry of variables) {
    if (!entry.loadable) continue;
    const pack = packs[entry.packId!];
    if (!pack) invalid(`variables "${entry.id}" referencia pack inexistente "${entry.packId}".`);
    if (!pack.metricKeys.includes(entry.columnKey!)) {
      invalid(`variables "${entry.id}" referencia columnKey ausente "${entry.columnKey}".`);
    }
  }
}
