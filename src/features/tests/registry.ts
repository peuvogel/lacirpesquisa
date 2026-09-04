/**
 * Single source of truth for every test id/title/subtitle/group/status in
 * the app (01-RESEARCH.md Pattern 1). Both the Estatística Sidebar and the
 * "Qual teste usar?" modal roadmap render this exact array — never a
 * component-local copy — so the two surfaces cannot silently disagree about
 * what is available (01-RESEARCH.md Pitfall 4, D-14).
 *
 * Evolved from the legacy `tests-manifest.json` shape: `path`/dynamic-import
 * fields are dropped entirely. Vite's static import graph replaces the old
 * fetch-then-import() machinery — modules are keyed on `id`.
 */

export type TestStatus = 'available' | 'em-breve';

export interface TestRegistryEntry {
  /** kebab-case, stable, used as the selection key */
  id: string;
  title: string;
  /** one didactic sentence in plain Portuguese */
  subtitle: string;
  /** concrete situation the test answers, rendered as "Ex: …" */
  example?: string;
  /** sidebar/roadmap grouping label */
  group: string;
  status: TestStatus;
  /** roadmap phase that ships it (1, 2, or 3) — informational only */
  phase: number;
}

export const TEST_REGISTRY = [
  {
    id: 't-student',
    title: 't de Student',
    subtitle: 'Comparação simples para saber se a diferença entre dois grupos é real.',
    example: 'Ex: a taxa média de internação por asma foi diferente entre o Nordeste e o Sudeste em 2023?',
    group: 'Comparação de médias',
    status: 'available',
    phase: 2,
  },
  {
    id: 'mann-whitney',
    title: 'Mann–Whitney',
    subtitle: 'Compare a ordenação e a distribuição dos valores entre dois grupos independentes.',
    example: 'Ex: o tempo de espera por consulta foi maior na rede pública do que na privada, mesmo com poucos municípios e valores muito desiguais?',
    group: 'Comparações',
    status: 'available',
    phase: 3,
  },
  {
    id: 'correlacao',
    title: 'Correlação de Pearson / Spearman',
    subtitle: 'Veja de forma simples se duas coisas estão relacionadas e se caminham juntas.',
    example: 'Ex: municípios com maior cobertura de Atenção Básica têm menor mortalidade infantil?',
    group: 'Associação',
    status: 'available',
    phase: 2,
  },
  {
    id: 'prais-winsten',
    title: 'Prais-Winsten',
    subtitle: 'Descubra se os números estão subindo, descendo ou estáveis ao longo do tempo.',
    example: 'Ex: a mortalidade por câncer de colo do útero no estado caiu, subiu ou ficou estável de 2010 a 2023?',
    group: 'Séries temporais',
    status: 'available',
    phase: 2,
  },
  {
    id: 'qui-quadrado',
    title: 'Qui-quadrado de independência',
    subtitle: 'Descubra se duas variáveis categóricas estão associadas ou se a diferença é só acaso.',
    example: 'Ex: a proporção de desfechos graves difere entre pacientes vacinados e não vacinados?',
    group: 'Frequências e proporções',
    status: 'available',
    phase: 3,
  },
  {
    id: 'anova-tukey',
    title: 'ANOVA de uma via com Tukey',
    subtitle: 'Compare três ou mais grupos de uma vez e veja exatamente quais pares diferem entre si.',
    example: 'Ex: o peso ao nascer difere entre as cinco regiões do país e, se difere, entre quais delas exatamente?',
    group: 'Comparação de médias',
    status: 'available',
    phase: 3,
  },
  {
    id: 'kruskal-dunn',
    title: 'Kruskal-Wallis com Dunn',
    subtitle: 'Compare três ou mais grupos sem exigir distribuição normal, com comparações par a par.',
    example: 'Ex: o número de leitos por mil habitantes difere entre as regiões, sabendo que a distribuição é bem torta?',
    group: 'Comparação de médias',
    status: 'available',
    phase: 3,
  },
  {
    id: 'poisson',
    title: 'Regressão de Poisson',
    subtitle: 'Modele contagens de eventos e veja quais fatores influenciam a frequência com que acontecem.',
    example: 'Ex: quantos casos de dengue a mais um município espera ter a cada 10 mil habitantes por grau de temperatura média?',
    group: 'Regressões e GLM',
    status: 'available',
    phase: 3,
  },
  {
    id: 'binomial-negativa',
    title: 'Regressão Binomial Negativa',
    subtitle: 'Modele contagens de eventos quando a variabilidade nos dados é maior do que o esperado.',
    example: 'Ex: mesma pergunta da dengue, mas quando alguns municípios têm surtos enormes e outros quase nenhum caso.',
    group: 'Regressões e GLM',
    status: 'available',
    phase: 3,
  },
  {
    id: 'logistica',
    title: 'Regressão Logística',
    subtitle: 'Estime a chance de um desfecho sim-ou-não a partir de vários fatores ao mesmo tempo.',
    example: 'Ex: qual a chance de um paciente evoluir para óbito conforme a idade, o sexo e a comorbidade?',
    group: 'Regressões e GLM',
    status: 'available',
    phase: 3,
  },
] as const satisfies readonly TestRegistryEntry[];

/**
 * Union of every registry id, derived from TEST_REGISTRY itself (D-11) —
 * an id can never drift from the array it comes from.
 */
export type TestId = (typeof TEST_REGISTRY)[number]['id'];

export function getTestById(id: TestId): TestRegistryEntry;
export function getTestById(id: string): TestRegistryEntry | undefined;
export function getTestById(id: string): TestRegistryEntry | undefined {
  return TEST_REGISTRY.find((entry) => entry.id === id);
}

/**
 * Type guard, not just a boolean check — narrows `string` to `TestId` at
 * every runtime boundary (location.state handoff, cross-test navigation)
 * so `setActiveTestId(id)` keeps compiling without a cast (07-RESEARCH.md
 * Pitfall 5). Runtime behavior is unchanged.
 */
export function isTestAvailable(id: string): id is TestId {
  return TEST_REGISTRY.some((entry) => entry.id === id && entry.status === 'available');
}

/** Sidebar/modal badge copy. */
export function getTestBadgeLabel(entry: TestRegistryEntry): string {
  if (entry.status === 'em-breve') return 'Em breve';
  return 'Disponível';
}
