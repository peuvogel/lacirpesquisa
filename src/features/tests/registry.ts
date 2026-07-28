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
  /** sidebar/roadmap grouping label */
  group: string;
  status: TestStatus;
  /** roadmap phase that ships it (1, 2, or 3) — informational only */
  phase: number;
}

export const TEST_REGISTRY: readonly TestRegistryEntry[] = [
  {
    id: 't-student',
    title: 't de Student',
    subtitle: 'Comparação simples para saber se a diferença entre dois grupos é real.',
    group: 'Comparação de médias',
    status: 'available',
    phase: 2,
  },
  {
    id: 'correlacao',
    title: 'Correlação de Pearson / Spearman',
    subtitle: 'Veja de forma simples se duas coisas estão relacionadas e se caminham juntas.',
    group: 'Associação',
    status: 'available',
    phase: 2,
  },
  {
    id: 'prais-winsten',
    title: 'Prais-Winsten',
    subtitle: 'Descubra se os números estão subindo, descendo ou estáveis ao longo do tempo.',
    group: 'Séries temporais',
    status: 'available',
    phase: 2,
  },
  {
    id: 'qui-quadrado',
    title: 'Qui-quadrado de independência',
    subtitle: 'Descubra se duas variáveis categóricas estão associadas ou se a diferença é só acaso.',
    group: 'Frequências e proporções',
    status: 'available',
    phase: 3,
  },
  {
    id: 'anova-tukey',
    title: 'ANOVA de uma via com Tukey',
    subtitle: 'Compare três ou mais grupos de uma vez e veja exatamente quais pares diferem entre si.',
    group: 'Comparação de médias',
    status: 'available',
    phase: 3,
  },
  {
    id: 'kruskal-dunn',
    title: 'Kruskal-Wallis com Dunn',
    subtitle: 'Compare três ou mais grupos sem exigir distribuição normal, com comparações par a par.',
    group: 'Comparação de médias',
    status: 'available',
    phase: 3,
  },
  {
    id: 'poisson',
    title: 'Regressão de Poisson',
    subtitle: 'Modele contagens de eventos e veja quais fatores influenciam a frequência com que acontecem.',
    group: 'Regressões e GLM',
    status: 'available',
    phase: 3,
  },
  {
    id: 'binomial-negativa',
    title: 'Regressão Binomial Negativa',
    subtitle: 'Modele contagens de eventos quando a variabilidade nos dados é maior do que o esperado.',
    group: 'Regressões e GLM',
    status: 'available',
    phase: 3,
  },
  {
    id: 'logistica',
    title: 'Regressão Logística',
    subtitle: 'Estime a chance de um desfecho sim-ou-não a partir de vários fatores ao mesmo tempo.',
    group: 'Regressões e GLM',
    status: 'available',
    phase: 3,
  },
];

export function getTestById(id: string): TestRegistryEntry | undefined {
  return TEST_REGISTRY.find((entry) => entry.id === id);
}

export function isTestAvailable(id: string): boolean {
  return getTestById(id)?.status === 'available';
}

/** Sidebar/modal badge copy. */
export function getTestBadgeLabel(entry: TestRegistryEntry): string {
  if (entry.status === 'em-breve') return 'Em breve';
  return 'Disponível';
}
