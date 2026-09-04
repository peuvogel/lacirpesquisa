/**
 * Rótulos e ajuda didática dos papéis da análise.
 *
 * A ajuda é resolvida por `${testId}:${role}` e cai para o papel genérico —
 * assim só se escreve texto específico onde o mesmo papel muda de sentido
 * entre testes (variavel_y na correlação vs. no Prais-Winsten, por exemplo).
 */
const ROLE_LABELS: Record<string, string> = {
  desfecho: 'Desfecho',
  desfecho_binario: 'Desfecho binário',
  grupo: 'Grupo',
  grupo_a: 'Grupo A',
  grupo_b: 'Grupo B',
  variavel_x: 'Variável X',
  variavel_y: 'Variável Y',
  tempo: 'Tempo',
  id: 'Identificador',
  unidade: 'Unidade',
  exposicao: 'Exposição',
  offset_exposure: 'Exposição (offset)',
  preditor: 'Preditor',
  contagem: 'Contagem',
  resposta: 'Resposta',
  categoria_a: 'Categoria A',
  categoria_b: 'Categoria B',
  observacao_opcional: 'Observação',
};

export function roleLabel(role: string): string {
  if (ROLE_LABELS[role]) return ROLE_LABELS[role];
  const words = role.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const GENERIC_HELP: Record<string, string> = {
  desfecho: 'A medida numérica que você quer comparar entre os grupos.',
  desfecho_binario: 'O resultado de cada linha, com apenas duas possibilidades (por exemplo, sim/não).',
  grupo: 'A coluna que diz a qual grupo cada linha pertence.',
  grupo_a: 'Os valores do primeiro grupo, um por linha.',
  grupo_b: 'Os valores do segundo grupo, um por linha.',
  variavel_x: 'A primeira variável quantitativa do par.',
  variavel_y: 'A segunda variável quantitativa do par.',
  tempo: 'O período de cada observação: ano, semestre, trimestre ou mês.',
  id: 'Identifica a linha. Não entra na conta.',
  unidade: 'Identifica a linha, como o município ou o estado. Não entra na conta.',
  exposicao: 'O tamanho da população ou o tempo de observação de cada linha.',
  offset_exposure: 'População ou tempo de observação. Converte a contagem em taxa.',
  preditor: 'A variável explicativa cujo efeito será estimado.',
  contagem: 'Quantos eventos foram observados em cada linha. Números inteiros.',
  resposta: 'O valor observado em cada linha.',
  categoria_a: 'A primeira variável categórica a ser cruzada.',
  categoria_b: 'A segunda variável categórica a ser cruzada.',
  observacao_opcional: 'Texto livre para anotações. Não entra na conta.',
};

const TEST_HELP: Record<string, string> = {
  't-student:grupo_a': 'Os valores do primeiro grupo. Cada coluna guarda um grupo inteiro.',
  't-student:grupo_b': 'Os valores do segundo grupo, a serem comparados com os do grupo A.',
  'correlacao:variavel_x': 'Uma das duas variáveis quantitativas. A ordem não altera o resultado.',
  'correlacao:variavel_y': 'A outra variável quantitativa. O teste mede se as duas andam juntas.',
  'prais-winsten:variavel_y': 'A série de valores acompanhada ao longo do tempo, como uma taxa anual.',
  'prais-winsten:tempo': 'A coluna que ordena a série. Define a periodicidade da tendência.',
  'anova-tukey:grupo': 'A coluna categórica com três ou mais grupos a comparar.',
  'kruskal-dunn:grupo': 'A coluna categórica com os grupos a comparar, sem exigir normalidade.',
  'mann-whitney:grupo': 'A coluna categórica que separa exatamente dois grupos.',
  'logistica:preditor': 'A variável cujo efeito sobre a chance do desfecho será estimado.',
  'poisson:contagem': 'O número de casos de cada linha. O modelo assume contagens inteiras.',
  'binomial-negativa:contagem': 'O número de casos. Este modelo tolera contagens muito dispersas.',
  'qui-quadrado:categoria_a': 'A variável das linhas da tabela de contingência.',
  'qui-quadrado:categoria_b': 'A variável das colunas da tabela de contingência.',
};

export function roleHelp(testId: string, role: string): string {
  return TEST_HELP[`${testId}:${role}`] ?? GENERIC_HELP[role] ?? 'Escolha a coluna que cumpre este papel.';
}

/**
 * Um exemplo concreto por papel: nome de coluna plausível e os primeiros
 * valores. A definição diz o que o papel é; o exemplo mostra como ele se
 * parece na tabela colada, que é o que tira a dúvida de verdade.
 */
const GENERIC_EXAMPLES: Record<string, string> = {
  desfecho: 'ex.: "Óbitos" — 12, 18, 9',
  desfecho_binario: 'ex.: "Internou" — sim, não, sim',
  grupo: 'ex.: "Região" — Norte, Nordeste, Sul',
  grupo_a: 'ex.: "Antes" — 128, 134, 121',
  grupo_b: 'ex.: "Depois" — 119, 122, 117',
  variavel_x: 'ex.: "Cobertura da ESF (%)" — 62,4 · 71,0 · 88,3',
  variavel_y: 'ex.: "Taxa de internação" — 8,1 · 6,7 · 4,9',
  tempo: 'ex.: "Ano" — 2019, 2020, 2021',
  id: 'ex.: "Código IBGE" — 3550308, 3304557',
  unidade: 'ex.: "Município" — Rio Branco, Feijó, Tarauacá',
  exposicao: 'ex.: "População" — 12400, 8900, 15200',
  offset_exposure: 'ex.: "População" — 12400, 8900 (vira casos por 100 mil)',
  preditor: 'ex.: "Idade" — 67, 45, 72',
  contagem: 'ex.: "Casos" — 120, 135, 150',
  resposta: 'ex.: "Valor médio da AIH" — 1240,50 · 980,00',
  categoria_a: 'ex.: "Sexo" — feminino, masculino',
  categoria_b: 'ex.: "Desfecho" — alta, óbito',
  observacao_opcional: 'ex.: "Nota" — revisado em 2024',
};

const TEST_EXAMPLES: Record<string, string> = {
  't-student:grupo_a': 'ex.: coluna "Grupo A" inteira — 128, 134, 121',
  't-student:grupo_b': 'ex.: coluna "Grupo B" inteira — 119, 122, 117',
  'correlacao:variavel_x': 'ex.: "Cobertura vacinal (%)" — 78,2 · 85,0 · 91,4',
  'correlacao:variavel_y': 'ex.: "Casos de sarampo" — 14, 6, 2',
  'prais-winsten:variavel_y': 'ex.: "Taxa por 100 mil" — 8,1 · 7,4 · 6,9',
  'prais-winsten:tempo': 'ex.: "Ano" — 2015, 2016, 2017 (sem pular períodos)',
  'anova-tukey:grupo': 'ex.: "Região" — Norte, Nordeste, Sul (três ou mais)',
  'kruskal-dunn:grupo': 'ex.: "Porte do município" — pequeno, médio, grande',
  'mann-whitney:grupo': 'ex.: "Zona" — urbana, rural (exatamente duas)',
  'logistica:preditor': 'ex.: "Idade" — 67, 45, 72',
  'poisson:contagem': 'ex.: "Casos de dengue" — 120, 135, 150',
  'binomial-negativa:contagem': 'ex.: "Casos" — 3, 240, 12 (bem desiguais)',
  'qui-quadrado:categoria_a': 'ex.: "Sexo" — feminino, masculino (linhas)',
  'qui-quadrado:categoria_b': 'ex.: "Desfecho" — alta, óbito (colunas)',
};

export function roleExample(testId: string, role: string): string | undefined {
  return TEST_EXAMPLES[`${testId}:${role}`] ?? GENERIC_EXAMPLES[role];
}
