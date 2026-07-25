// Phase 1 mock — replaced by the real catalog in Phase 4. Hand-authored fixture with
// deliberate gaps to exercise partial-availability alerts (D-22). Not derived from
// trabalhos datasus/ scraper output (01-RESEARCH.md § Anti-Patterns).

import { UF_LIST } from './ufCodes';

const BASE_VARIABLES = [
  'Internações por causa',
  'Óbitos hospitalares',
  'Taxa de mortalidade infantil',
  'Cobertura de atenção primária',
  'Amputações de membros inferiores',
  'Procedimentos ambulatoriais',
  'Mortalidade materna',
  'Leitos hospitalares',
  'Nascidos vivos',
  'Consultas de atenção básica',
] as const;

/** Variables deliberately omitted from specific UFs so partial alerts are testable. */
const OMIT_BY_UF: Partial<Record<string, readonly string[]>> = {
  BA: ['Amputações de membros inferiores', 'Mortalidade materna', 'Leitos hospitalares'],
  PE: ['Amputações de membros inferiores', 'Consultas de atenção básica'],
  CE: ['Procedimentos ambulatoriais', 'Nascidos vivos'],
  AM: ['Mortalidade materna'],
  RS: ['Taxa de mortalidade infantil', 'Cobertura de atenção primária'],
  DF: ['Amputações de membros inferiores'],
};

export const MOCK_VARIABLES_BY_UF: Record<string, string[]> = Object.fromEntries(
  UF_LIST.map(({ sigla }) => [
    sigla,
    BASE_VARIABLES.filter((variable) => !(OMIT_BY_UF[sigla] ?? []).includes(variable)),
  ]),
);
