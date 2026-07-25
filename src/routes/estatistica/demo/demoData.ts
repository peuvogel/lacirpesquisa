/**
 * Sample dataset for the Phase 1 Teste demo stub (D-11). Follows the v1.0
 * t-student template convention: two group columns worth of data collapsed
 * into a long `{ grupo, medida }` table suitable for descriptive summaries.
 */

export const DEMO_HEADERS = ['Grupo', 'Tempo de internação (dias)'] as const;

/** Structured rows in the same `{ headers, rows }` shape as a confirmed preview. */
export const DEMO_ROWS: string[][] = [
  ['Grupo A', '5,2'],
  ['Grupo A', '6,1'],
  ['Grupo A', '4,8'],
  ['Grupo A', '7,3'],
  ['Grupo A', '5,9'],
  ['Grupo A', '6,5'],
  ['Grupo A', '4,2'],
  ['Grupo A', '8,1'],
  ['Grupo A', '5,5'],
  ['Grupo A', '6,8'],
  ['Grupo A', '7,0'],
  ['Grupo A', '5,1'],
  ['Grupo B', '4,1'],
  ['Grupo B', '3,8'],
  ['Grupo B', '5,0'],
  ['Grupo B', '4,5'],
  ['Grupo B', '3,2'],
  ['Grupo B', '4,9'],
  ['Grupo B', '5,5'],
  ['Grupo B', '3,6'],
  ['Grupo B', '4,3'],
  ['Grupo B', '5,2'],
  ['Grupo B', '4,0'],
  ['Grupo B', '3,9'],
];

export const DEMO_DATASET = {
  headers: [...DEMO_HEADERS],
  rows: DEMO_ROWS.map((row) => [...row]),
};

/** Semicolon-delimited text fed through setRawText so the real parser runs. */
export const DEMO_DELIMITED_TEXT = [
  DEMO_HEADERS.join(';'),
  ...DEMO_ROWS.map((row) => row.join(';')),
].join('\n');
