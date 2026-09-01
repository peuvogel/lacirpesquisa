import { deflateRawSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { legacyStats, legacyUtils, readFileText } from './legacyAdapters';
import { readTabularFileState, readWorkbookTablesFromFile } from './parseTabular';
import { preflightXml } from './xlsxReader';

// Real tiny ZIP fixtures, including the data descriptors emitted by Excel writers.
interface Entry { name: string; text: string; deflate?: boolean; descriptor?: boolean; flags?: number; declaredSize?: number }
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries: Entry[]): Uint8Array {
  const locals: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name), plain = Buffer.from(entry.text);
    const compressed = entry.deflate ? deflateRawSync(plain) : plain;
    const flags = (entry.flags ?? 0) | (entry.descriptor ? 8 : 0);
    const local = Buffer.alloc(30), directory = Buffer.alloc(46);
    const size = entry.declaredSize ?? plain.length, crc = crc32(plain);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6); local.writeUInt16LE(entry.deflate ? 8 : 0, 8);
    if (!entry.descriptor) { local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(size, 22); }
    local.writeUInt16LE(name.length, 26);
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(flags, 8); directory.writeUInt16LE(entry.deflate ? 8 : 0, 10);
    directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(compressed.length, 20); directory.writeUInt32LE(size, 24);
    directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(offset, 42);
    const descriptor = Buffer.alloc(entry.descriptor ? 16 : 0);
    if (entry.descriptor) { descriptor.writeUInt32LE(0x08074b50); descriptor.writeUInt32LE(crc, 4); descriptor.writeUInt32LE(compressed.length, 8); descriptor.writeUInt32LE(size, 12); }
    locals.push(local, name, compressed, descriptor); central.push(directory, name);
    offset += local.length + name.length + compressed.length + descriptor.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, directory, end]));
}
const worksheet = '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Valor</t></is></c></row><row r="2"><c r="A2"><v>7</v></c></row></sheetData></worksheet>';
function entries(sheet = worksheet): Entry[] {
  return [
    { name: 'xl/workbook.xml', text: '<workbook xmlns:r="urn:r"><sheets><sheet name="Dados" r:id="r1"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', text: '<Relationships><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', text: sheet },
  ];
}
function datedEntries({
  serial = '45292',
  date1904 = false,
  styleIndex = 1,
  formatId = 14,
  formatCode,
  formula,
}: {
  serial?: string;
  date1904?: boolean;
  styleIndex?: number | null;
  formatId?: number;
  formatCode?: string;
  formula?: string;
} = {}): Entry[] {
  const items = entries(
    '<worksheet><sheetData>'
      + '<row r="1"><c r="A1" t="inlineStr"><is><t>Data</t></is></c></row>'
      + `<row r="2"><c r="A2"${styleIndex === null ? '' : ` s="${styleIndex}"`}>${formula ? `<f>${formula}</f>` : ''}<v>${serial}</v></c></row>`
      + '</sheetData></worksheet>',
  );
  items[0].text = `<workbook xmlns:r="urn:r"><workbookPr${date1904 ? ' date1904="1"' : ''}/><sheets><sheet name="Dados" r:id="r1"/></sheets></workbook>`;
  items[1].text = items[1].text.replace(
    '</Relationships>',
    '<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  );
  items.push({
    name: 'xl/styles.xml',
    text: '<styleSheet>'
      + (formatCode === undefined ? '' : `<numFmts count="1"><numFmt numFmtId="${formatId}" formatCode="${formatCode}"/></numFmts>`)
      + `<cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="${formatId}" applyNumberFormat="1"/></cellXfs>`
      + '</styleSheet>',
  });
  return items;
}
function file(bytes: Uint8Array): File { return new File([bytes as BlobPart], 'dados.xlsx'); }
function read(items: Entry[]) { return readWorkbookTablesFromFile(file(zip(items)), legacyUtils); }

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('bounded XLSX import', () => {
  it('converts a styled date in the 1900 date system and aggregates conversion metadata', async () => {
    const items = datedEntries();
    items[2].text = items[2].text.replace(
      '</sheetData>',
      '<row r="3"><c r="A3" s="1"><v>45293</v></c></row></sheetData>',
    );
    const result = await read(items);
    expect(result.tables[0]).toMatchObject({
      rows: [['Data'], ['2024-01-01'], ['2024-01-02']],
      importDiagnostics: [{ code: 'excel_dates_converted', severity: 'info', message: expect.stringContaining('2') }],
    });
    expect(result.tables[0].importDiagnostics).toHaveLength(1);
  });

  it('converts a styled date in the 1904 date system using UTC calendar arithmetic', async () => {
    expect((await read(datedEntries({ serial: '1', date1904: true }))).tables[0].rows).toEqual([
      ['Data'], ['1904-01-02'],
    ]);
  });

  it('does not fabricate Excel serial 60 as 1900-02-29', async () => {
    expect((await read(datedEntries({ serial: '60' }))).tables[0]).toMatchObject({
      rows: [['Data'], ['']],
      importWarnings: [{ code: 'unusable-cell', cellReference: 'A2' }],
    });
  });

  it.each([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])(
    'recognizes built-in date format %s',
    async (formatId) => {
      expect((await read(datedEntries({ formatId }))).tables[0].rows[1][0]).toBe('2024-01-01');
    },
  );

  it.each([
    ['yyyy-mm-dd', true],
    ['[Red][&gt;=0]dd\\-mm\\-yyyy', true],
    ['mm/yyyy', true],
    ['&quot;day&quot; 0', false],
    ['\\d 0', false],
    ['[Red][&gt;=0]0', false],
    ['[h]:mm', false],
    ['0.00E+00', false],
    ['0%', false],
    ['0', false],
  ])('classifies custom number format %s conservatively', async (formatCode, converts) => {
    const table = (await read(datedEntries({ formatId: 164, formatCode }))).tables[0];
    expect(table.rows[1][0]).toBe(converts ? '2024-01-01' : '45292');
    expect(table.importDiagnostics ?? []).toHaveLength(converts ? 1 : 0);
  });

  it.each([
    ['fractional styled serial', '45292.5', '45292.5', false],
    ['negative styled serial', '-1', '', true],
  ])('handles %s without inventing a date', async (_name, serial, expected, warns) => {
    const table = (await read(datedEntries({ serial }))).tables[0];
    expect(table.rows[1][0]).toBe(expected);
    expect(table.importWarnings ?? []).toHaveLength(warns ? 1 : 0);
    expect(table.importDiagnostics ?? []).toHaveLength(0);
  });

  it('preserves an unstyled Excel serial even when the archive contains an unused styles part', async () => {
    const items = datedEntries({ styleIndex: null });
    items[1].text = items[1].text.replace(/<Relationship Id="styles"[^>]+\/>/, '');
    expect((await read(items)).tables[0]).toMatchObject({ rows: [['Data'], ['45292']] });
  });

  it.each([
    ['external', 'TargetMode="External" Target="https://example.invalid/styles.xml"', /externo/i],
    ['path traversal', 'Target="../styles.xml"', /caminho/i],
  ])('rejects an unsafe %s styles relationship', async (_name, replacement, message) => {
    const items = datedEntries();
    items[1].text = items[1].text.replace('Target="styles.xml"', replacement);
    await expect(read(items)).rejects.toThrow(message);
  });

  it('converts only the cached value of a styled formula and never evaluates it', async () => {
    const result = await readTabularFileState(file(zip(datedEntries({ formula: 'DATE(2024,1,1)' }))), legacyUtils, legacyStats, {
      aliases: { data: ['Data'] }, requiredKeys: ['data'], temporalKeys: ['data'],
    });
    expect(result).toMatchObject({ status: 'loaded', bodyRows: [['2024-01-01']] });
    if (result.status === 'loaded') {
      expect(result.summary.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'excel_dates_converted' }),
      ]));
      expect(result.summary.diagnostics).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'possible_excel_serial' }),
      ]));
    }
  });

  it('rejects legacy xls before reading binary contents', async () => {
    const legacy = new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0])], 'dados.xls');
    const readBuffer = vi.spyOn(legacy, 'arrayBuffer');
    const readText = vi.spyOn(legacy, 'text');
    await expect(readWorkbookTablesFromFile(legacy, legacyUtils)).rejects.toThrow(
      'Formato .xls não suportado. Salve o arquivo como .xlsx ou CSV e tente novamente.',
    );
    expect(readBuffer).not.toHaveBeenCalled();
    expect(readText).not.toHaveBeenCalled();
  });

  it('rejects another unsupported suffix before reading contents', async () => {
    const unsupported = new File(['conteúdo'], 'dados.pdf');
    const readBuffer = vi.spyOn(unsupported, 'arrayBuffer');
    const readText = vi.spyOn(unsupported, 'text');
    await expect(readWorkbookTablesFromFile(unsupported, legacyUtils)).rejects.toThrow(
      'Formato .pdf não suportado. Salve o arquivo como .xlsx ou CSV e tente novamente.',
    );
    expect(readBuffer).not.toHaveBeenCalled();
    expect(readText).not.toHaveBeenCalled();
  });

  it.each([false, true])('reads real stored/deflated XML (deflate=%s) with data descriptors', async (deflate) => {
    const result = await read(entries().map((entry) => ({ ...entry, deflate, descriptor: true })));
    expect(result.tables[0]).toMatchObject({ name: 'Dados', rows: [['Valor'], ['7']] });
  });

  it.each(['xlsx', 'csv'])('rejects oversized %s before calling file IO', async (extension) => {
    const oversized = new File(['x'], `grande.${extension}`);
    Object.defineProperty(oversized, 'size', { value: 10 * 1024 * 1024 + 1 });
    const readBuffer = vi.spyOn(oversized, 'arrayBuffer');
    await expect(readWorkbookTablesFromFile(oversized, legacyUtils)).rejects.toThrow(/10.*MiB/);
    await expect(readFileText(oversized)).rejects.toThrow(/10.*MiB/);
    expect(readBuffer).not.toHaveBeenCalled();
  });

  it.each(['plain', 'TABNET decimal-comma'])('keeps the file and paste budgets distinct for %s input', async (format) => {
    const content = format === 'plain' ? 'A\n' + 'x'.repeat(5_000_001) : 'Nome,Valor,Grupo\n' + 'x'.repeat(5_000_001) + ',1,5,A';
    const result = await readWorkbookTablesFromFile(new File([content], 'grande.csv'), legacyUtils);
    expect(result.tables[0].rows[1][0].length).toBe(5_000_001);
  });

  it.each([
    ['central offset', (view: DataView) => view.setUint32(view.byteLength - 6, 0xffffff00, true), /offset|limites|estrutura/i],
    ['local offset', (view: DataView) => { const central = view.getUint32(view.byteLength - 6, true); view.setUint32(central + 42, 0xffffff00, true); }, /offset|limites|estrutura/i],
    ['local signature', (view: DataView) => view.setUint32(0, 0), /cabeçalho/i],
    ['ZIP64', (view: DataView) => view.setUint16(view.byteLength - 12, 0xffff, true), /ZIP64/i],
    ['too many ZIP entries', (view: DataView) => { view.setUint16(view.byteLength - 14, 2049, true); view.setUint16(view.byteLength - 12, 2049, true); }, /2[. ]?048.*entradas/i],
    ['multipart', (view: DataView) => view.setUint16(view.byteLength - 18, 1, true), /volumes/i],
  ] as const)('rejects %s before dereferencing archive data', async (_name, mutate, message) => {
    const bytes = zip(entries()); mutate(new DataView(bytes.buffer));
    await expect(readWorkbookTablesFromFile(file(bytes), legacyUtils)).rejects.toThrow(message);
  });

  it('rejects encrypted entries', async () => {
    await expect(read(entries().map((entry) => ({ ...entry, flags: 1 })))).rejects.toThrow(/criptograf/i);
  });

  it('rejects declared expansion limits, including unused entries', async () => {
    await expect(read([...entries(), { name: 'unused.bin', text: '', deflate: true, declaredSize: 16 * 1024 * 1024 + 1 }])).rejects.toThrow(/16.*MiB/);
    await expect(read([...entries(), ...Array.from({ length: 4 }, (_, i) => ({ name: `unused${i}.bin`, text: '', deflate: true, declaredSize: 16 * 1024 * 1024 }))])).rejects.toThrow(/64.*MiB/);
  });

  it('does not inflate unrelated archive entries', async () => {
    // Wrong actual output size makes this entry fail if an eager reader expands it.
    const result = await read([...entries(), { name: 'xl/media/image.png', text: 'not XML', deflate: true, declaredSize: 99 }]);
    expect(result.tables[0].rows).toEqual([['Valor'], ['7']]);
  });

  it.each([
    ['invalid cell', worksheet.replace('A2', 'A0'), /referência/i],
    ['wrong row', worksheet.replace('A2', 'A3'), /referência/i],
    ['column limit', worksheet.replace('A2', 'DY2'), /128.*colunas/],
    ['row limit', worksheet.replace('r="2"', 'r="10002"').replace('A2', 'A10002'), /10[. ]?000.*linhas/],
    ['padded cell limit', worksheet.replace('r="2"', 'r="10001"').replace('A2', 'T10001'), /200[. ]?000.*células/],
    ['DTD', '<!DOCTYPE worksheet [<!ENTITY x "unsafe">]>' + worksheet, /DTD|entidades/i],
    ['invalid XML', '<worksheet>', /XML/i],
  ])('rejects %s explicitly', async (_name, sheet, message) => {
    await expect(read(entries(sheet))).rejects.toThrow(message);
  });

  it('rejects excess worksheets before reading their contents', async () => {
    const items = entries();
    items[0].text = '<workbook xmlns:r="urn:r"><sheets>' + '<sheet name="A" r:id="r1"/>'.repeat(33) + '</sheets></workbook>';
    await expect(read(items)).rejects.toThrow(/32.*abas/);
  });

  it('counts non-ASCII XML namespace prefixes before allocating the XML document', async () => {
    const items = entries();
    items[0].text = '<workbook xmlns:á="urn:x" xmlns:r="urn:r"><sheets>' + '<á:sheet name="A" r:id="r1"/>'.repeat(33) + '</sheets></workbook>';
    const parse = vi.spyOn(DOMParser.prototype, 'parseFromString');
    await expect(read(items)).rejects.toThrow(/32.*abas/);
    expect(parse).not.toHaveBeenCalled();
  });

  it('bounds all XML elements with an injected profile before DOM allocation', () => {
    const limits = { fileBytes: 10, textCharacters: 10, dataRows: 2, columns: 2, cells: 3, sheets: 1, zipEntries: 1, entryBytes: 10, totalBytes: 10 };
    expect(() => preflightXml('<worksheet>' + '<unknown/>'.repeat(20) + '</worksheet>', 'worksheet', limits)).not.toThrow();
    expect(() => preflightXml('<worksheet>' + '<unknown/>'.repeat(21) + '</worksheet>', 'worksheet', limits)).toThrow(/estrutura XML.*21.*elementos/i);
  });

  it('rejects malformed dimension ranges before splitting the reference', async () => {
    await expect(read(entries(worksheet.replace('<sheetData>', '<dimension ref="A1:A2:A3"/><sheetData>')))).rejects.toThrow(/referência|dimensão/i);
  });

  it('never fetches an external worksheet relationship', async () => {
    const items = entries();
    items[1].text = items[1].text.replace('Target="worksheets/sheet1.xml"', 'TargetMode="External" Target="https://example.invalid/data.xml"');
    const fetch = vi.fn(() => { throw new Error('must not fetch'); }); vi.stubGlobal('fetch', fetch);
    await expect(read(items)).rejects.toThrow(/externo/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves cached formulas and marks missing/error cells without converting to zero', async () => {
    const sheet = '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Valor</t></is></c><c r="B1" t="inlineStr"><is><t>Grupo</t></is></c></row><row r="2"><c r="A2"><f>3+4</f><v>7</v></c><c r="B2" t="inlineStr"><is><t>A</t></is></c></row><row r="3"><c r="A3"><f>WEBSERVICE("https://example.invalid")</f></c><c r="B3" t="inlineStr"><is><t>B</t></is></c></row><row r="4"><c r="A4" t="e"><v>#DIV/0!</v></c><c r="B4" t="inlineStr"><is><t>C</t></is></c></row></sheetData></worksheet>';
    const result = await readTabularFileState(file(zip(entries(sheet))), legacyUtils, legacyStats, { aliases: { value: ['Valor'] }, requiredKeys: ['value'] });
    expect(result).toMatchObject({ status: 'loaded', bodyRows: [['7', 'A'], ['', 'B'], ['', 'C']], importWarnings: [
      { code: 'formula-without-cache', cellReference: 'A3', rowNumber: 3, columnIndex: 0 },
      { code: 'unusable-cell', cellReference: 'A4', rowNumber: 4, columnIndex: 0 },
    ] });
  });

  it('counts actual streamed output and cancels before accumulating an oversized entry', async () => {
    let emitted = 0, cancelled = false;
    // Reuse one 64 KiB chunk: exercise output accounting without an exhaustion payload.
    const chunk = new Uint8Array(64 * 1024);
    vi.stubGlobal('DecompressionStream', class {
      writable = new WritableStream();
      readable = new ReadableStream({
        pull(controller) { emitted++; controller.enqueue(chunk); },
        cancel() { cancelled = true; },
      }, { highWaterMark: 0 });
    });
    await expect(read(entries().map((entry) => ({ ...entry, deflate: true })))).rejects.toThrow(/16.*MiB/);
    expect(cancelled).toBe(true);
    expect(emitted).toBe(257);
  });

  it('keeps a row with only an uncached formula as missing in the editable table', async () => {
    const sheet = worksheet.replace('<v>7</v>', '<f>1+2</f>');
    const result = await readTabularFileState(file(zip(entries(sheet))), legacyUtils, legacyStats);
    expect(result).toMatchObject({ status: 'loaded', bodyRows: [['']], importWarnings: [{ cellReference: 'A2' }] });
  });

  it('rejects cumulative workbook rows before allocating the next worksheet matrix', async () => {
    const items = entries(worksheet.replace('r="2"', 'r="6001"').replace('A2', 'A6001'));
    items[0].text = items[0].text.replace('</sheets>', '<sheet name="Second" r:id="r2"/></sheets>');
    items[1].text = items[1].text.replace('</Relationships>', '<Relationship Id="r2" Target="worksheets/sheet2.xml"/></Relationships>');
    items.push({ name: 'xl/worksheets/sheet2.xml', text: items[2].text });
    const parse = vi.spyOn(DOMParser.prototype, 'parseFromString');
    await expect(read(items)).rejects.toThrow(/10[. ]?000.*linhas/);
    expect(parse).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['invalid shared string', '<c r="A2" t="s"><v>99</v></c>'],
    ['missing boolean', '<c r="A2" t="b"/>'],
    ['nonfinite numeric', '<c r="A2"><v>Infinity</v></c>'],
  ])('reports %s as missing instead of a manufactured value', async (_name, cell) => {
    const result = await read(entries(worksheet.replace('<c r="A2"><v>7</v></c>', cell)));
    expect(result.tables[0]).toMatchObject({ rows: [['Valor'], ['']], importWarnings: [{ code: 'unusable-cell', cellReference: 'A2' }] });
  });

  it('reads shared strings and preserves rich text, escaped XML and newlines', async () => {
    const items = entries(worksheet.replace('<c r="A2"><v>7</v></c>', '<c r="A2" t="s"><v>0</v></c>'));
    items.push({ name: 'xl/sharedStrings.xml', text: '<sst><si><r><t>  A &amp; B\n</t></r><r><t>C  </t></r></si></sst>', deflate: true });
    expect((await read(items)).tables[0].rows).toEqual([['Valor'], ['  A & B\nC  ']]);
  });

  it('does not decode an unused shared-string part', async () => {
    const result = await read([...entries(), { name: 'xl/sharedStrings.xml', text: 'not needed XML', deflate: true }]);
    expect(result.tables[0].rows).toEqual([['Valor'], ['7']]);
  });

  it('rejects a tampered CRC and a broken data descriptor', async () => {
    const crcBytes = zip(entries());
    crcBytes[30 + 'xl/workbook.xml'.length + 1] ^= 1;
    await expect(readWorkbookTablesFromFile(file(crcBytes), legacyUtils)).rejects.toThrow(/CRC/);
    const descriptorBytes = zip(entries().map((entry) => ({ ...entry, descriptor: true })));
    descriptorBytes[30 + 'xl/workbook.xml'.length + Buffer.byteLength(entries()[0].text) + 4] ^= 1;
    await expect(readWorkbookTablesFromFile(file(descriptorBytes), legacyUtils)).rejects.toThrow(/descritor/i);
  });
});
