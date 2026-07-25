// The 27 Brazilian federative units (26 states + Distrito Federal), keyed by
// the official IBGE two-digit UF code. This table is the crosswalk between
// the IBGE Malhas SVG (`brazilUfPaths.ts`, paths carry `id="<ibgeCode>"`)
// and the sigla/name used everywhere else in the Mapas UI (D-20–D-23).
export interface UfEntry {
  sigla: string;
  name: string;
  ibgeCode: string;
}

export const UF_LIST: readonly UfEntry[] = [
  { sigla: 'RO', name: 'Rondônia', ibgeCode: '11' },
  { sigla: 'AC', name: 'Acre', ibgeCode: '12' },
  { sigla: 'AM', name: 'Amazonas', ibgeCode: '13' },
  { sigla: 'RR', name: 'Roraima', ibgeCode: '14' },
  { sigla: 'PA', name: 'Pará', ibgeCode: '15' },
  { sigla: 'AP', name: 'Amapá', ibgeCode: '16' },
  { sigla: 'TO', name: 'Tocantins', ibgeCode: '17' },
  { sigla: 'MA', name: 'Maranhão', ibgeCode: '21' },
  { sigla: 'PI', name: 'Piauí', ibgeCode: '22' },
  { sigla: 'CE', name: 'Ceará', ibgeCode: '23' },
  { sigla: 'RN', name: 'Rio Grande do Norte', ibgeCode: '24' },
  { sigla: 'PB', name: 'Paraíba', ibgeCode: '25' },
  { sigla: 'PE', name: 'Pernambuco', ibgeCode: '26' },
  { sigla: 'AL', name: 'Alagoas', ibgeCode: '27' },
  { sigla: 'SE', name: 'Sergipe', ibgeCode: '28' },
  { sigla: 'BA', name: 'Bahia', ibgeCode: '29' },
  { sigla: 'MG', name: 'Minas Gerais', ibgeCode: '31' },
  { sigla: 'ES', name: 'Espírito Santo', ibgeCode: '32' },
  { sigla: 'RJ', name: 'Rio de Janeiro', ibgeCode: '33' },
  { sigla: 'SP', name: 'São Paulo', ibgeCode: '35' },
  { sigla: 'PR', name: 'Paraná', ibgeCode: '41' },
  { sigla: 'SC', name: 'Santa Catarina', ibgeCode: '42' },
  { sigla: 'RS', name: 'Rio Grande do Sul', ibgeCode: '43' },
  { sigla: 'MS', name: 'Mato Grosso do Sul', ibgeCode: '50' },
  { sigla: 'MT', name: 'Mato Grosso', ibgeCode: '51' },
  { sigla: 'GO', name: 'Goiás', ibgeCode: '52' },
  { sigla: 'DF', name: 'Distrito Federal', ibgeCode: '53' },
];

const NAME_BY_SIGLA: Record<string, string> = Object.fromEntries(UF_LIST.map((uf) => [uf.sigla, uf.name]));

export function getUfName(sigla: string): string {
  return NAME_BY_SIGLA[sigla] ?? sigla;
}
