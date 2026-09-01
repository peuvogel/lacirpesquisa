import { IMPORT_LIMITS, validateImportLimit, validateTableSize, validateXmlElementLimit } from './importLimits';
import type { ImportLimits } from './importLimits';
import type { ImportDiagnostic } from './importDiagnostics';
import type { ImportWarning, WorkbookTable } from './types';

interface ZipEntry { name: string; method: number; size: number; compressedSize: number; crc: number; start: number }
interface XlsxDateContext { date1904: boolean; dateStyleIndexes: ReadonlySet<number> }
const utf8 = new TextDecoder('utf-8', { fatal: true });

function requireRange(offset: number, length: number, end: number): void {
  if (!Number.isSafeInteger(offset) || offset < 0 || length < 0 || offset + length > end) {
    throw new Error('Offset fora dos limites da estrutura ZIP do arquivo XLSX.');
  }
}

function validateExtra(view: DataView, start: number, length: number): void {
  const end = start + length;
  for (let offset = start; offset < end;) {
    requireRange(offset, 4, end);
    if (view.getUint16(offset, true) === 1) throw new Error('ZIP64 não é suportado na importação XLSX.');
    const size = view.getUint16(offset + 2, true);
    requireRange(offset + 4, size, end);
    offset += 4 + size;
  }
}

/** Index the archive without expanding anything; all offsets and sizes are untrusted. */
function indexZip(buffer: ArrayBuffer): Map<string, ZipEntry> {
  const view = new DataView(buffer);
  let end = -1;
  for (let offset = view.byteLength - 22; offset >= Math.max(0, view.byteLength - 65557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === view.byteLength) { end = offset; break; }
  }
  if (end < 0) throw new Error('Não foi possível localizar a estrutura ZIP do arquivo XLSX.');
  const count = view.getUint16(end + 10, true), size = view.getUint32(end + 12, true), start = view.getUint32(end + 16, true);
  if (count === 0xffff || size === 0xffffffff || start === 0xffffffff || (end >= 20 && view.getUint32(end - 20, true) === 0x07064b50)) {
    throw new Error('ZIP64 não é suportado na importação XLSX.');
  }
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== count) {
    throw new Error('Arquivos ZIP divididos em volumes não são suportados.');
  }
  validateImportLimit('zipEntries', count);
  requireRange(start, size, end);
  if (start + size !== end) throw new Error('Estrutura da tabela central ZIP não suportada.');
  const entries = new Map<string, ZipEntry>(), spans: Array<[number, number]> = [];
  let offset = start, declaredTotal = 0;
  for (let index = 0; index < count; index++) {
    requireRange(offset, 46, end);
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('Cabeçalho central ZIP inválido.');
    const version = view.getUint16(offset + 6, true), flags = view.getUint16(offset + 8, true), method = view.getUint16(offset + 10, true);
    const crc = view.getUint32(offset + 16, true), compressedSize = view.getUint32(offset + 20, true), entrySize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true), extraLength = view.getUint16(offset + 30, true), commentLength = view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    if ([compressedSize, entrySize, local].includes(0xffffffff)) throw new Error('ZIP64 não é suportado na importação XLSX.');
    if (flags & 0x41) throw new Error('Arquivo XLSX criptografado não é suportado.');
    if (version > 20 || (flags & ~0x080e) || (method !== 0 && method !== 8) || (method === 0 && (flags & 6))) {
      throw new Error('Recurso ou método de compressão ZIP não suportado.');
    }
    if (view.getUint16(offset + 34, true)) throw new Error('Arquivos ZIP divididos em volumes não são suportados.');
    validateImportLimit('entryBytes', entrySize);
    declaredTotal += entrySize; validateImportLimit('totalBytes', declaredTotal);
    requireRange(offset + 46, nameLength + extraLength + commentLength, end);
    validateExtra(view, offset + 46 + nameLength, extraLength);
    const name = utf8.decode(new Uint8Array(buffer, offset + 46, nameLength));
    if (!name || /[\\\u0000:]/.test(name) || name.startsWith('/') || name.split('/').some((part) => part === '..' || part === '.')) throw new Error('Caminho interno XLSX não suportado.');
    if (entries.has(name)) throw new Error('Entrada ZIP duplicada no arquivo XLSX.');
    requireRange(local, 30, start);
    if (view.getUint32(local, true) !== 0x04034b50) throw new Error('Cabeçalho local ZIP inválido.');
    if (view.getUint16(local + 4, true) !== version || view.getUint16(local + 6, true) !== flags || view.getUint16(local + 8, true) !== method) throw new Error('Cabeçalhos ZIP inconsistentes.');
    const localNameLength = view.getUint16(local + 26, true), localExtraLength = view.getUint16(local + 28, true);
    requireRange(local + 30, localNameLength + localExtraLength, start);
    if (utf8.decode(new Uint8Array(buffer, local + 30, localNameLength)) !== name) throw new Error('Nome do cabeçalho local ZIP inconsistente.');
    validateExtra(view, local + 30 + localNameLength, localExtraLength);
    const descriptor = Boolean(flags & 8);
    for (const [position, expected] of [[14, crc], [18, compressedSize], [22, entrySize]]) {
      const actual = view.getUint32(local + position, true);
      if (actual !== expected && (!descriptor || actual !== 0)) throw new Error('Tamanhos ou CRC dos cabeçalhos ZIP inconsistentes.');
    }
    const dataStart = local + 30 + localNameLength + localExtraLength;
    requireRange(dataStart, compressedSize, start);
    let dataEnd = dataStart + compressedSize;
    if (descriptor) {
      requireRange(dataEnd, 12, start);
      if (view.getUint32(dataEnd, true) === 0x08074b50) dataEnd += 4;
      requireRange(dataEnd, 12, start);
      if (view.getUint32(dataEnd, true) !== crc || view.getUint32(dataEnd + 4, true) !== compressedSize || view.getUint32(dataEnd + 8, true) !== entrySize) throw new Error('Descritor de dados ZIP inválido.');
      dataEnd += 12;
    }
    if (method === 0 && compressedSize !== entrySize) throw new Error('Tamanho da entrada ZIP armazenada inconsistente.');
    spans.push([local, dataEnd]);
    entries.set(name, { name, method, size: entrySize, compressedSize, crc, start: dataStart });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== end) throw new Error('Tamanho da tabela central ZIP inconsistente.');
  spans.sort((a, b) => a[0] - b[0]);
  for (let index = 1; index < spans.length; index++) if (spans[index][0] < spans[index - 1][1]) throw new Error('Entradas ZIP sobrepostas não são suportadas.');
  return entries;
}

function updateCrc(crc: number, bytes: Uint8Array): number {
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return crc;
}

function xmlReader(buffer: ArrayBuffer, entries: Map<string, ZipEntry>) {
  let producedTotal = 0;
  return async (path: string): Promise<string> => {
    const entry = entries.get(path);
    if (!entry) throw new Error(`Estrutura XLSX incompleta: entrada XML necessária ausente (${path}).`);
    const compressed = new Uint8Array(buffer, entry.start, entry.compressedSize);
    let inputOffset = 0;
    // Backpressure and small compressed chunks let JS enforce output limits promptly.
    let stream: ReadableStream<Uint8Array<ArrayBuffer>> = new ReadableStream({
      pull(controller) {
        if (inputOffset === compressed.length) { controller.close(); return; }
        const end = Math.min(inputOffset + 4096, compressed.length);
        controller.enqueue(compressed.subarray(inputOffset, end));
        inputOffset = end;
      },
    }, { highWaterMark: 0 });
    if (entry.method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não possui suporte à descompactação XLSX (DecompressionStream).');
      try { stream = stream.pipeThrough(new DecompressionStream('deflate-raw')); }
      catch { throw new Error('Este navegador não suporta a descompactação XLSX deflate-raw.'); }
    }
    const reader = stream.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
    const parts: string[] = [];
    let produced = 0, crc = 0xffffffff;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        produced += value.byteLength; producedTotal += value.byteLength;
        validateImportLimit('entryBytes', produced);
        validateImportLimit('totalBytes', producedTotal);
        crc = updateCrc(crc, value);
        parts.push(decoder.decode(value, { stream: true }));
      }
      if (produced !== entry.size || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) throw new Error('Tamanho ou CRC da entrada XLSX descompactada inconsistente.');
      parts.push(decoder.decode());
      return parts.join('');
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      if (error instanceof Error && /limite|XLSX/.test(error.message)) throw error;
      throw new Error('Não foi possível descompactar ou decodificar a entrada XML do XLSX.');
    } finally { reader.releaseLock(); }
  };
}

function nodes(node: Document | Element, name: string): Element[] {
  return Array.from(node.getElementsByTagNameNS('*', name));
}

function xmlAttribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(tag);
  return match?.[1] ?? match?.[2];
}

function scanXmlOpenElements(text: string, onElement: (name: string, tag: string) => void): void {
  let offset = 0, depth = 0;
  while (offset < text.length) {
    const start = text.indexOf('<', offset);
    if (start < 0) break;
    if (text.startsWith('<!--', start)) {
      const end = text.indexOf('-->', start + 4);
      if (end < 0) throw new Error('Estrutura XML interna do XLSX inválida.');
      offset = end + 3;
      continue;
    }
    if (text.startsWith('<![CDATA[', start)) {
      const end = text.indexOf(']]>', start + 9);
      if (end < 0) throw new Error('Estrutura XML interna do XLSX inválida.');
      offset = end + 3;
      continue;
    }
    if (text.startsWith('<?', start)) {
      const end = text.indexOf('?>', start + 2);
      if (end < 0) throw new Error('Estrutura XML interna do XLSX inválida.');
      offset = end + 2;
      continue;
    }
    if (text[start + 1] === '/') {
      const end = text.indexOf('>', start + 2);
      if (end < 0 || --depth < 0) throw new Error('Estrutura XML interna do XLSX inválida.');
      offset = end + 1;
      continue;
    }
    if (text[start + 1] === '!') throw new Error('Estrutura XML interna do XLSX não suportada.');
    let nameEnd = start + 1;
    while (nameEnd < text.length && !/[\s/>]/.test(text[nameEnd])) nameEnd++;
    const name = text.slice(start + 1, nameEnd);
    if (!name) throw new Error('Estrutura XML interna do XLSX inválida.');
    let end = nameEnd, quote = '';
    for (; end < text.length; end++) {
      const char = text[end];
      if (quote) { if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    if (end >= text.length || quote) throw new Error('Estrutura XML interna do XLSX inválida.');
    const tag = text.slice(start, end + 1);
    onElement(name, tag);
    if (!/\/\s*>$/.test(tag)) depth++;
    offset = end + 1;
  }
  if (depth !== 0) throw new Error('Estrutura XML interna do XLSX inválida.');
}

function localName(name: string): string {
  return name.slice(name.lastIndexOf(':') + 1);
}

function cellPosition(ref: string, limits: ImportLimits = IMPORT_LIMITS): { row: number; column: number } {
  const match = /^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(ref);
  if (!match) throw new Error('Referência de célula XLSX inválida.');
  let column = 0;
  for (const char of match[1]) column = column * 26 + char.charCodeAt(0) - 64;
  const row = Number(match[2]);
  validateImportLimit('columns', column, limits); validateImportLimit('dataRows', row - 1, limits);
  return { row, column: column - 1 };
}

/** Pure lexical preflight: bound all elements and worksheet dimensions before DOMParser allocation. */
export function preflightXml(text: string, root: string, limits: ImportLimits = IMPORT_LIMITS, previous = { rows: 0, cells: 0 }): void {
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(text)) throw new Error('DTD e entidades não são suportados no XML do XLSX.');
  const counts = { row: 0, c: 0, si: 0, sheet: 0 };
  let elements = 0, first = true, maxRow = 0, columns = 0;
  const validateWorksheetBudget = () => {
    const dataRows = Math.max(0, maxRow - 1);
    validateTableSize(dataRows, columns, limits);
    validateImportLimit('dataRows', previous.rows + dataRows, limits);
    validateImportLimit('cells', previous.cells + maxRow * columns, limits);
  };
  scanXmlOpenElements(text, (qualifiedName, tag) => {
    const name = localName(qualifiedName);
    if (first) {
      first = false;
      if (name !== root) throw new Error('Não foi possível interpretar a estrutura XML interna do XLSX.');
    }
    validateXmlElementLimit(++elements, limits);
    if (name === 'sheet' || name === 'row' || name === 'c' || name === 'si') {
      const counted = name as keyof typeof counts;
      counts[counted]++;
      if (counted === 'sheet') validateImportLimit('sheets', counts[counted], limits);
      else if (counted === 'row') validateImportLimit('dataRows', Math.max(0, counts[counted] - 1), limits);
      else validateImportLimit('cells', counts[counted], limits);
    }
    if (root !== 'worksheet') return;
    if (name === 'row') {
      const reference = xmlAttribute(tag, 'r');
      const row = reference === undefined ? maxRow + 1 : (/^[1-9]\d{0,6}$/.test(reference) ? Number(reference) : NaN);
      if (!Number.isSafeInteger(row) || row <= maxRow) throw new Error('Referência de linha XLSX inválida.');
      maxRow = row;
      validateWorksheetBudget();
    } else if (name === 'c') {
      const reference = xmlAttribute(tag, 'r') || '';
      const position = cellPosition(reference, limits);
      columns = Math.max(columns, position.column + 1);
      validateWorksheetBudget();
    }
  });
  if (first) throw new Error('Não foi possível interpretar a estrutura XML interna do XLSX.');
}

function parseXml(text: string, root: string, previous?: { rows: number; cells: number }): Document {
  preflightXml(text, root, IMPORT_LIMITS, previous);
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.documentElement?.localName !== root || nodes(document, 'parsererror').length) throw new Error('Não foi possível interpretar a estrutura XML interna do XLSX.');
  return document;
}

const BUILT_IN_DATE_FORMATS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22,
  45, 46, 47,
]);

function customFormatIsCalendarDate(formatCode: string): boolean {
  let hasCalendarToken = false;
  let state: 'plain' | 'quoted' | 'bracket' = 'plain';
  for (let index = 0; index < formatCode.length; index++) {
    const character = formatCode[index];
    if (state === 'quoted') {
      if (character === '\\') {
        if (index + 1 >= formatCode.length) return false;
        index++;
      } else if (character === '"') {
        if (formatCode[index + 1] === '"') index++;
        else state = 'plain';
      }
      continue;
    }
    if (state === 'bracket') {
      if (character === '\\') {
        if (index + 1 >= formatCode.length) return false;
        index++;
      } else if (character === '[') return false;
      else if (character === ']') state = 'plain';
      continue;
    }
    if (character === '"') { state = 'quoted'; continue; }
    if (character === '[') { state = 'bracket'; continue; }
    if (character === ']') return false;
    if (character === '\\' || character === '_' || character === '*') {
      if (index + 1 >= formatCode.length) return false;
      index++;
      continue;
    }
    if (/[yd]/i.test(character)) hasCalendarToken = true;
  }
  return state === 'plain' && hasCalendarToken;
}

function readDateStyleIndexes(document: Document): ReadonlySet<number> {
  const customDateFormats = new Set<number>();
  for (const format of nodes(document, 'numFmt')) {
    const id = format.getAttribute('numFmtId') || '';
    const code = format.getAttribute('formatCode');
    if (/^\d+$/.test(id) && code !== null && customFormatIsCalendarDate(code)) customDateFormats.add(Number(id));
  }
  const cellXfs = nodes(document, 'cellXfs')[0];
  if (!cellXfs) return new Set();
  const dateStyleIndexes = new Set<number>();
  Array.from(cellXfs.children).filter((child) => child.localName === 'xf').forEach((style, index) => {
    const rawId = style.getAttribute('numFmtId') || '0';
    if (!/^\d+$/.test(rawId)) return;
    const id = Number(rawId);
    if (BUILT_IN_DATE_FORMATS.has(id) || customDateFormats.has(id)) dateStyleIndexes.add(index);
  });
  return dateStyleIndexes;
}

function excelSerialToIso(serial: number, date1904: boolean): string | null {
  if (!Number.isInteger(serial) || serial < 0) return null;
  if (!date1904 && serial === 60) return null;
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
  const adjusted = date1904 ? serial : serial - (serial > 60 ? 1 : 0);
  const date = new Date(epoch + adjusted * 86_400_000);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

async function readWorksheet(
  text: string,
  getShared: () => Promise<string[]>,
  name: string,
  previous: { rows: number; cells: number },
  dateContext: XlsxDateContext,
): Promise<WorkbookTable> {
  const document = parseXml(text, 'worksheet', previous);
  const shared = nodes(document, 'c').some((cell) => cell.getAttribute('t') === 's') ? await getShared() : [];
  const dimensions = nodes(document, 'dimension')[0]?.getAttribute('ref');
  if (dimensions) {
    const range = /^([A-Z]{1,3}[1-9]\d{0,6})(?::([A-Z]{1,3}[1-9]\d{0,6}))?$/.exec(dimensions);
    if (!range) throw new Error('Referência de dimensão XLSX inválida.');
    cellPosition(range[1]);
    if (range[2]) cellPosition(range[2]);
  }
  const sparse = new Map<number, Map<number, string>>(), importWarnings: ImportWarning[] = [];
  let maxRow = 0, columns = 0, convertedDates = 0;
  const validateSize = () => {
    validateTableSize(Math.max(0, maxRow - 1), columns);
    validateImportLimit('dataRows', previous.rows + Math.max(0, maxRow - 1));
    validateImportLimit('cells', previous.cells + maxRow * columns);
  };
  for (const rowNode of nodes(document, 'row')) {
    const rowString = rowNode.getAttribute('r') ?? String(maxRow + 1);
    if (!/^[1-9]\d{0,6}$/.test(rowString)) throw new Error('Referência de linha XLSX inválida.');
    const row = Number(rowString);
    if (row <= maxRow) throw new Error('Referências de linhas XLSX duplicadas ou fora de ordem.');
    validateImportLimit('dataRows', row - 1);
    maxRow = row;
    const cells = new Map<number, string>();
    for (const cell of nodes(rowNode, 'c')) {
      const reference = cell.getAttribute('r') || '';
      const position = cellPosition(reference);
      if (position.row !== row || cells.has(position.column)) throw new Error('Referência de célula XLSX inconsistente ou duplicada.');
      columns = Math.max(columns, position.column + 1);
      validateSize();
      const type = cell.getAttribute('t') || 'n', formula = nodes(cell, 'f').length > 0;
      const value = nodes(cell, 'v')[0]?.textContent ?? '';
      let raw = value, unusable = false;
      if (!['n', 's', 'b', 'inlineStr', 'str', 'e', 'd'].includes(type)) throw new Error('Tipo de célula XLSX não suportado.');
      if (type === 'inlineStr') raw = nodes(cell, 't').map((part) => part.textContent || '').join('');
      else if (type === 's') { const index = /^\d+$/.test(value) ? Number(value) : -1; raw = shared[index] ?? ''; unusable = index < 0 || index >= shared.length; }
      else if (type === 'b') { raw = value === '1' ? 'TRUE' : value === '0' ? 'FALSE' : ''; unusable = !raw; }
      else if (type === 'e' || (type === 'n' && value !== '' && !Number.isFinite(Number(value)))) { raw = ''; unusable = true; }
      if (formula && value === '') { raw = ''; unusable = true; }
      const styleIndex = cell.getAttribute('s') || '';
      if (!unusable && type === 'n' && value !== '' && /^\d+$/.test(styleIndex) && dateContext.dateStyleIndexes.has(Number(styleIndex))) {
        const serial = Number(value);
        if (serial < 0) { raw = ''; unusable = true; }
        else if (Number.isInteger(serial)) {
          const iso = excelSerialToIso(serial, dateContext.date1904);
          if (iso) { raw = iso; convertedDates++; }
          else { raw = ''; unusable = true; }
        }
      }
      if (unusable) importWarnings.push({
        code: formula && value === '' ? 'formula-without-cache' : 'unusable-cell',
        cellReference: reference, rowNumber: row, columnIndex: position.column,
        message: formula && value === '' ? `A célula ${reference} contém fórmula sem valor em cache; foi mantida ausente.` : `A célula ${reference} não contém valor utilizável; foi mantida ausente.`,
      });
      cells.set(position.column, raw);
    }
    validateSize();
    sparse.set(row, cells);
  }
  validateSize();
  const rows = Array.from({ length: maxRow }, (_, index) => Array.from({ length: columns }, (_, column) => sparse.get(index + 1)?.get(column) ?? ''));
  const importDiagnostics: ImportDiagnostic[] = convertedDates ? [{
    code: 'excel_dates_converted',
    severity: 'info',
    message: `${convertedDates} data(s) formatada(s) no Excel foram convertidas para o padrão AAAA-MM-DD.`,
  }] : [];
  return {
    name,
    rows,
    ...(importWarnings.length ? { importWarnings } : {}),
    ...(importDiagnostics.length ? { importDiagnostics } : {}),
  };
}

function relationshipPath(target: string): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('//')) throw new Error('Relacionamento externo XLSX não é suportado.');
  const path = target.startsWith('/xl/') ? target.slice(1) : `xl/${target}`;
  if (/[\\?#\u0000]/.test(path) || path.split('/').some((part) => !part || part === '..' || part === '.')) throw new Error('Caminho de relacionamento XLSX não suportado.');
  return path;
}

/** Local-only OOXML reader: reads cached values, never evaluates formulas or fetches relationships. */
export async function readXlsxTables(file: File): Promise<WorkbookTable[]> {
  validateImportLimit('fileBytes', file.size);
  const buffer = await file.arrayBuffer();
  validateImportLimit('fileBytes', buffer.byteLength);
  const entries = indexZip(buffer), readXml = xmlReader(buffer, entries);
  const workbook = parseXml(await readXml('xl/workbook.xml'), 'workbook');
  const sheets = nodes(workbook, 'sheet'); validateImportLimit('sheets', sheets.length);
  const relationships = parseXml(await readXml('xl/_rels/workbook.xml.rels'), 'Relationships');
  const relations = new Map<string, Element>();
  for (const relation of nodes(relationships, 'Relationship')) {
    const id = relation.getAttribute('Id');
    if (!id || relations.has(id)) throw new Error('Relacionamento XLSX inválido ou duplicado.');
    relations.set(id, relation);
  }
  const date1904Value = nodes(workbook, 'workbookPr')[0]?.getAttribute('date1904')?.toLowerCase();
  const styleRelations = Array.from(relations.values()).filter((relation) => relation.getAttribute('Type')?.endsWith('/styles'));
  if (styleRelations.length > 1) throw new Error('Relacionamento de estilos XLSX inválido ou duplicado.');
  let dateStyleIndexes: ReadonlySet<number> = new Set();
  if (styleRelations.length === 1) {
    const relation = styleRelations[0];
    if (relation.getAttribute('TargetMode') === 'External') throw new Error('Relacionamento externo XLSX não é suportado.');
    const path = relationshipPath(relation.getAttribute('Target') || '');
    dateStyleIndexes = readDateStyleIndexes(parseXml(await readXml(path), 'styleSheet'));
  }
  const dateContext: XlsxDateContext = { date1904: date1904Value === '1' || date1904Value === 'true', dateStyleIndexes };
  let shared: string[] | undefined;
  const getShared = async () => {
    if (!shared) shared = entries.has('xl/sharedStrings.xml')
      ? nodes(parseXml(await readXml('xl/sharedStrings.xml'), 'sst'), 'si').map((item) => nodes(item, 't').map((part) => part.textContent || '').join(''))
      : [];
    return shared;
  };
  const tables: WorkbookTable[] = [], sheetPaths = new Set<string>();
  const totals = { rows: 0, cells: 0 };
  for (const sheet of sheets) {
    const relation = relations.get(sheet.getAttribute('r:id') || sheet.getAttribute('id') || '');
    if (!relation) throw new Error('Relacionamento da aba XLSX ausente.');
    if (relation.getAttribute('TargetMode') === 'External') throw new Error('Relacionamento externo XLSX não é suportado.');
    const type = relation.getAttribute('Type');
    if (type && !type.endsWith('/worksheet')) throw new Error('Tipo de aba XLSX não suportado.');
    const path = relationshipPath(relation.getAttribute('Target') || '');
    if (sheetPaths.has(path)) throw new Error('Referência de aba XLSX duplicada.');
    sheetPaths.add(path);
    const table = await readWorksheet(await readXml(path), getShared, sheet.getAttribute('name') || 'Planilha', totals, dateContext);
    totals.cells += table.rows.length * (table.rows[0]?.length ?? 0);
    totals.rows += Math.max(0, table.rows.length - 1);
    tables.push(table);
  }
  return tables;
}
