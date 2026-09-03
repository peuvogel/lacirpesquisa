# Prontidão do site, GitHub Pages e entrega offline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a área Estatística confiável para uma capacitação com mais de 30 participantes, publicada com gate no GitHub Pages e também como um único HTML autônomo que funciona por `file:` sem internet.

**Architecture:** Um manifesto de release compartilhado governa as quatro rotas e dois adaptadores de distribuição: Browser Router e assets versionados para Pages, Hash Router e recursos embutidos para o HTML offline. O núcleo estatístico, a entrada tabular, os contratos de sessão e a interface permanecem únicos; verificadores estruturais, testes numéricos e Playwright impedem divergência, rede indevida e publicação parcial.

**Tech Stack:** TypeScript 5.9, React 19, React Router 7, Vite 8, Vitest 4, Testing Library, IndexedDB/fake-indexeddb, Chart.js 4, Node.js 24, GitHub Actions/Pages e Playwright com Chromium, Firefox e WebKit.

**Spec:** `docs/superpowers/specs/2026-09-03-site-readiness-github-pages-offline-design.md`

## Global Constraints

- A fonte de verdade é a árvore local da branch `codex/results-interactions`, inclusive toda alteração modificada ou não rastreada que já pertence ao usuário.
- Nunca executar `git reset`, `git checkout --`, `git clean`, stash automático ou formatação ampla; todo staging usa caminhos explícitos e, em arquivo previamente alterado, somente hunks desta iniciativa.
- A área Estatística mantém exatamente os 10 fluxos registrados: t de Student, ANOVA com Tukey, Mann–Whitney, Kruskal–Wallis com Dunn, correlação, qui-quadrado, Poisson, binomial negativa, logística e Prais–Winsten.
- `/meta-analise`, `/variaveis` e `/mapas` exibem no `main` somente o texto literal `Em breve`; não montam telas, catálogos, clientes, efeitos ou dados funcionais dessas áreas e não prometem data.
- O código histórico de Meta-análise, Variáveis e Mapas permanece no repositório, mas fora do grafo e da pasta do release ativo.
- Cálculos, tabelas, resultados e identificadores permanecem no dispositivo; o release ativo não inicializa Supabase, não injeta URL/chave e não faz requisições de API.
- Alpha canônico é decimal no intervalo fechado `0.001` a `0.1`; `0.001`, `0.01`, `0.05` e `0.1` aparecem respectivamente como `0,1%`, `1%`, `5%` e `10%` e chegam inalterados ao motor e ao snapshot.
- Limites de importação permanecem: arquivo `10 MiB`, texto `5.000.000` caracteres, `10.000` linhas, `128` colunas, `200.000` células, `32` abas, `2.048` entradas ZIP, `16 MiB` por entrada e `64 MiB` descompactados.
- XLSX exige `DecompressionStream`; o piso é Chrome/Edge 103, Firefox 113 e Safari 16.4. Navegadores abaixo dele continuam aceitando CSV/TXT e recebem orientação acionável.
- Pages usa o base path exato `/lacirpesquisa/`; o offline usa hash routing e produz `bioestatistica-lacir-offline.html`.
- O HTML offline é um arquivo isolado, sem source map, CDN, fonte remota, API, service worker ou arquivo vizinho; CSP bloqueia conexões, frames e objetos.
- Orçamento do primeiro carregamento Pages: no máximo `1.572.864` bytes transferidos com cache vazio. Orçamento do HTML offline: no máximo `2.621.440` bytes sem compressão externa.
- Capacidade: `30` navegações frias concorrentes, zero HTTP `4xx/5xx` e percentil 95 até a primeira rota utilizável em no máximo `10 s` na rede do treinamento ou em perfil igual/pior.
- Viewports obrigatórios: `360x800`, `390x844`, `768x1024` e `1440x900`; sem overflow horizontal da página, inclusive com zoom de `200%`.
- Alvos interativos medem pelo menos `24x24` pixels CSS, salvo exceções normativas WCAG 2.2; ações essenciais de toque medem `44x44` pixels CSS.
- WCAG 2.2 AA, axe sem violação crítica ou séria, foco visível, operação completa por teclado e equivalentes a hover/cor/movimento são bloqueadores de release.
- Um trace de `30 s` em repouso não registra tarefa longa `>50 ms` causada por animação; a inspeção usa CPU `4×` e mede memória após `20` trocas de teste.
- As duas versões estáveis mais recentes de Chrome, Edge, Firefox e Safari no momento do release são o suporte funcional; a automação cobre Chromium, Firefox e WebKit.
- Pages e offline são gerados do mesmo SHA, exibem a mesma versão e produzem os mesmos valores, dentro das tolerâncias golden versionadas.
- Vulnerabilidade crítica ou alta alcançável, segredo no artefato, defeito P0/P1, gate falho ou dependência de rede offline bloqueia publicação.
- Publicação exige autorização específica depois de todos os gates; a implementação deste plano não transforma push em autorização.

---

## Coerência das oito fases

As oito fases permanecem em um único plano. Alpha, persistência, importação, motores, interface e E2E alimentam as mesmas duas saídas; separar Pages ou offline antes de estabilizar o núcleo duplicaria contratos e permitiria resultados divergentes. O workflow só pode consumir builds que já passaram pelo mesmo gate, e capacidade, contingência e rollback só são verificáveis depois dos dois artefatos; por isso nenhum subsistema forma um projeto independente testável sem depender das fases anteriores.

## Protocolo obrigatório de preservação por tarefa

Antes de editar, o executor cria um diretório temporário fora do repositório e registra o baseline:

```bash
LACIR_BASELINE_DIR="$(mktemp -d /tmp/lacir-readiness.XXXXXX)"
git branch --show-current > "$LACIR_BASELINE_DIR/branch.txt"
git rev-parse HEAD > "$LACIR_BASELINE_DIR/head.txt"
git status --short > "$LACIR_BASELINE_DIR/status.txt"
git diff --binary > "$LACIR_BASELINE_DIR/worktree.patch"
git ls-files --others --exclude-standard > "$LACIR_BASELINE_DIR/untracked.txt"
git diff --cached --binary > "$LACIR_BASELINE_DIR/index.patch"
```

Para cada caminho da tarefa, executar `git diff -- <caminho>` antes da edição. Se houver mudança preexistente, editar de forma aditiva, revisar `git diff -- <caminho>` e usar `git add -p -- <caminho>`; se um hunk misturar trabalho do usuário e desta iniciativa sem separação segura, parar e pedir decisão. Antes de cada commit:

```bash
git diff --cached --name-status
git diff --cached --check
git diff --cached
```

O primeiro comando deve listar somente os caminhos declarados na tarefa, o segundo deve sair com código `0` e o terceiro deve conter somente a mudança descrita. Depois do commit, `git status --short` deve manter todas as alterações não relacionadas presentes no baseline.

## File Structure

### Novos arquivos de contrato e runtime

- `release/release-manifest.json`: fonte compartilhada de rotas, base path, nome do artefato e orçamentos em bytes.
- `src/release/releaseManifest.ts`: validação tipada do manifesto para router, cabeçalho e testes.
- `src/release/releaseManifest.test.ts`: invariantes das quatro rotas e dos dois modos de distribuição.
- `src/release/ReleaseMetadata.tsx`: versão/SHA/data legíveis na interface e em atributos de smoke.
- `src/release/ReleaseMetadata.test.tsx`: contrato acessível dos metadados.
- `src/features/tests/shared/alpha.ts`: representação decimal canônica, validação e conversão percentual.
- `src/features/tests/shared/alpha.test.ts`: fronteiras, round-trip e rejeição de valor inválido.
- `src/shared/session/PersistenceNotice.tsx`: aviso persistente e acessível de modo em memória/erro.
- `src/shared/session/PersistenceNotice.test.tsx`: estados, live region e copy exata.
- `src/shared/session/StatisticsSessionProvider.tsx`: sessão/persistência exclusiva do módulo ativo, sem imports de Mapas/Variáveis.
- `src/shared/session/StatisticsSessionProvider.test.tsx`: API ativa e ausência de slices indisponíveis.
- `src/routes/estatistica/AnalysisErrorBoundary.tsx`: contenção de exceção inesperada por motor.
- `src/routes/estatistica/AnalysisErrorBoundary.test.tsx`: preservação do restante do fluxo e nova tentativa.
- `src/shared/clipboard/localClipboard.ts`: Clipboard API e fallback manual tipado.
- `src/shared/clipboard/localClipboard.test.ts`: sucesso, permissão negada e ausência da API.

### Novos arquivos de build, auditoria e QA

- `scripts/release/release-metadata.mjs` e `scripts/release/release-metadata.test.mjs`: metadados determinísticos do commit.
- `scripts/release/create-pages-entrypoints.mjs` e `scripts/release/create-pages-entrypoints.test.mjs`: entradas estáticas das quatro rotas e fallback 404.
- `scripts/release/inline-offline.mjs` e `scripts/release/inline-offline.test.mjs`: incorporação de JS, CSS, favicon e CSP no arquivo único.
- `scripts/release/validate-pages.mjs` e `scripts/release/validate-pages.test.mjs`: base path, rotas, assets, SHA e orçamento Pages.
- `scripts/release/validate-offline.mjs` e `scripts/release/validate-offline.test.mjs`: arquivo único, CSP, recursos, rede, source maps, SHA e bytes.
- `scripts/release/audit-release.mjs` e `scripts/release/audit-release.test.mjs`: endpoints, Supabase, segredos e recursos remotos nos artefatos.
- `scripts/release/write-checksum.mjs` e `scripts/release/write-checksum.test.mjs`: SHA-256 do HTML offline.
- `playwright.config.ts`: projetos Chromium, Firefox e WebKit, web server Pages e execução `file:` offline.
- `e2e/fixtures/statisticsFlows.ts`: dados/seletores dos dez fluxos sem duplicar fórmulas.
- `src/test/fixtures/tests/mann-whitney-exemplo.txt`: input de navegador ausente, idêntico ao input do golden versionado.
- `e2e/pages-navigation.spec.ts`, `e2e/statistics-flows.spec.ts`, `e2e/persistence-errors.spec.ts`, `e2e/accessibility-responsive.spec.ts`, `e2e/offline.spec.ts`, `e2e/production-smoke.spec.ts` e `e2e/capacity.spec.ts`: browser QA e capacidade.
- `src/test/fixtures/jasp/t-student-exemplo.golden.json`, `src/test/fixtures/jasp/correlacao-exemplo.golden.json` e `src/test/fixtures/jasp/prais-exemplo.golden.json`: referências externas ausentes.
- `src/test/fixtures/jasp/README.md`: origem, versão, comando e tolerância de todos os golden.
- `docs/runbooks/site-release.md`: browsers, CSV de contingência, persistência, checksum, publicação, smoke e rollback.
- `docs/qa/site-readiness/defects.md`, `docs/qa/site-readiness/browser-matrix.md`, `docs/qa/site-readiness/performance.md` e `docs/qa/site-readiness/capacity.md`: evidências versionadas e aceite P0/P1.

### Arquivos centrais modificados

- `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.node.json`, `src/vite-env.d.ts` e `.gitignore`: scripts reprodutíveis, Playwright, dois builds e saídas ignoradas.
- `src/main.tsx`, `src/app/router.tsx`, `src/app/router.test.tsx`, `src/app/AppShell.tsx`, `src/app/Header.tsx`, `src/app/Header.test.tsx`, `src/app/RouteError.tsx` e `src/routes/ComingSoonPage.tsx`: manifesto, roteadores, título, foco, fallback e placeholders.
- `src/shared/session/SessionProvider.tsx`, `src/shared/session/sessionStorage.ts` e seus testes: `testSlots`, fila, geração, restauração, modo em memória e alterações não salvas.
- `src/features/tests/shared/AlphaSelector.tsx`, seus testes e os dez componentes `*Test.tsx`: alpha decimal único da UI ao motor.
- `src/shared/data-input/importLimits.ts`, `src/shared/data-input/parseTabular.ts`, `src/shared/data-input/useTabularInput.ts`, `src/shared/data-input/xlsxReader.ts`, `src/routes/estatistica/TabularInputPanel.tsx` e testes correspondentes: erros acionáveis e limites seguros.
- Os dez arquivos `*Engine.test.ts` em `src/features/tests/**`: golden externo, tolerâncias numéricas e resultados principais.
- `src/routes/estatistica/EstatisticaPage.tsx`, `src/routes/estatistica/ResultsPanel.tsx`, `src/routes/estatistica/CopyResultsButton.tsx`, `src/shared/charts/useChartExport.ts`, `src/shared/flow/RevealOnScroll.tsx`, `src/app/theme.css` e `src/index.css`: contenção, fallback, acessibilidade, responsividade e repouso.
- `.github/workflows/ci.yml` (verificado sem mudança) e `.github/workflows/pages.yml` (modificado): gate reproduzível, builds pelo mesmo SHA, artefatos e deploy autorizado.

---

## Fase 1 — Baseline e regressões dos bloqueadores

### Task 1: Manifesto de release e contratos de rota

**Files:**
- Create: `release/release-manifest.json`
- Create: `src/release/releaseManifest.ts`
- Create: `src/release/releaseManifest.test.ts`

**Interfaces:**
- Consumes: nenhuma API da aplicação; somente o JSON versionado.
- Produces:

```ts
export type ReleaseRouteId = 'estatistica' | 'meta-analise' | 'variaveis' | 'mapas';
export type ReleaseAvailability = 'active' | 'coming-soon';

export interface ReleaseRoute {
  id: ReleaseRouteId;
  path: '/' | '/meta-analise' | '/variaveis' | '/mapas';
  label: 'Estatística' | 'Meta-análise' | 'Variáveis' | 'Mapas';
  documentTitle: string;
  availability: ReleaseAvailability;
}

export interface ReleaseManifest {
  pagesBase: '/lacirpesquisa/';
  offlineFilename: 'bioestatistica-lacir-offline.html';
  pagesBudgetBytes: 1572864;
  offlineBudgetBytes: 2621440;
  routes: readonly ReleaseRoute[];
}

export const COMING_SOON_COPY = 'Em breve' as const;
export const RELEASE_MANIFEST: ReleaseManifest;
export function findReleaseRoute(pathname: string): ReleaseRoute | null;
```

- [ ] **Step 1: Registrar o baseline e confirmar a unidade do plano**

Execute o protocolo global com os três caminhos desta tarefa. Acrescente em `docs/qa/site-readiness/defects.md` somente quando esse arquivo for criado na Task 18; nesta tarefa, o resultado esperado é manter a evidência em `$LACIR_BASELINE_DIR` e confirmar que as oito fases dependem do mesmo manifesto, do mesmo núcleo e do mesmo SHA.

- [ ] **Step 2: Escrever os testes vermelhos do manifesto**

```ts
import { describe, expect, it } from 'vitest';
import { COMING_SOON_COPY, RELEASE_MANIFEST, findReleaseRoute } from './releaseManifest';

describe('release manifest', () => {
  it('locks the public routes and availability', () => {
    expect(RELEASE_MANIFEST.routes.map(({ path, availability }) => ({ path, availability }))).toEqual([
      { path: '/', availability: 'active' },
      { path: '/meta-analise', availability: 'coming-soon' },
      { path: '/variaveis', availability: 'coming-soon' },
      { path: '/mapas', availability: 'coming-soon' },
    ]);
    expect(COMING_SOON_COPY).toBe('Em breve');
  });

  it('locks distribution names and byte budgets', () => {
    expect(RELEASE_MANIFEST).toMatchObject({
      pagesBase: '/lacirpesquisa/',
      offlineFilename: 'bioestatistica-lacir-offline.html',
      pagesBudgetBytes: 1_572_864,
      offlineBudgetBytes: 2_621_440,
    });
  });

  it('normalizes a known route without accepting unknown paths', () => {
    expect(findReleaseRoute('/lacirpesquisa/mapas/')?.id).toBe('mapas');
    expect(findReleaseRoute('/rota-inexistente')).toBeNull();
  });
});
```

- [ ] **Step 3: Executar o teste e confirmar RED**

Run: `npm exec vitest run -- src/release/releaseManifest.test.ts`

Expected: FAIL porque `src/release/releaseManifest.ts` ainda não existe.

- [ ] **Step 4: Criar o JSON e a validação tipada mínima**

`release/release-manifest.json` deve conter exatamente quatro objetos na ordem do teste, os quatro valores de distribuição e `documentTitle` no formato `<Rótulo> — Bioestatística LACIR`. Em `releaseManifest.ts`, importe o JSON, valide unicidade de `id`/`path`, o único status `active` e os literais de orçamento antes de exportar. `findReleaseRoute` remove `/lacirpesquisa`, query, hash e barra final antes da comparação.

```ts
const KNOWN_PATHS = new Set(['/', '/meta-analise', '/variaveis', '/mapas']);

function assertManifest(value: unknown): asserts value is ReleaseManifest {
  const candidate = value as Partial<ReleaseManifest>;
  if (
    candidate.pagesBase !== '/lacirpesquisa/'
    || candidate.offlineFilename !== 'bioestatistica-lacir-offline.html'
    || candidate.pagesBudgetBytes !== 1_572_864
    || candidate.offlineBudgetBytes !== 2_621_440
    || !Array.isArray(candidate.routes)
    || candidate.routes.length !== 4
    || candidate.routes.filter((route) => route.availability === 'active').length !== 1
    || candidate.routes.some((route) => !KNOWN_PATHS.has(route.path))
  ) throw new Error('Manifesto de release inválido.');
}
```

- [ ] **Step 5: Verificar o contrato isolado**

Run: `npm exec vitest run -- src/release/releaseManifest.test.ts`

Expected: PASS. Os testes existentes do router permanecem inalterados; a regressão RED da rota entra junto da correção na Task 4.

- [ ] **Step 6: Commit do contrato**

```bash
git add release/release-manifest.json src/release/releaseManifest.ts src/release/releaseManifest.test.ts
git commit -m "test(release): lock readiness contracts"
```

---

## Fase 2 — Correções de alpha, persistência e integridade básica

### Task 2: Alpha decimal da interface ao motor

**Files:**
- Create: `src/features/tests/shared/alpha.ts`
- Create: `src/features/tests/shared/alpha.test.ts`
- Create: `src/features/tests/shared/AlphaSelector.test.tsx`
- Modify: `src/features/tests/shared/AlphaSelector.tsx`
- Modify: `src/features/tests/t-student/TStudentTest.tsx`
- Modify: `src/features/tests/anova-tukey/AnovaTukeyTest.tsx`
- Modify: `src/features/tests/mann-whitney/MannWhitneyTest.tsx`
- Modify: `src/features/tests/kruskal-dunn/KruskalDunnTest.tsx`
- Modify: `src/features/tests/correlacao/CorrelacaoTest.tsx`
- Modify: `src/features/tests/qui-quadrado/QuiQuadradoTest.tsx`
- Modify: `src/features/tests/poisson/PoissonTest.tsx`
- Modify: `src/features/tests/binomial-negativa/BinomialNegativaTest.tsx`
- Modify: `src/features/tests/logistica/LogisticaTest.tsx`
- Modify: `src/features/tests/prais-winsten/PraisWinstenTest.tsx`
- Modify: `src/features/tests/t-student/TStudentTest.test.tsx`
- Modify: `src/features/tests/anova-tukey/AnovaTukeyTest.test.tsx`
- Modify: `src/features/tests/mann-whitney/MannWhitneyTest.test.tsx`
- Modify: `src/features/tests/kruskal-dunn/KruskalDunnTest.test.tsx`
- Modify: `src/features/tests/correlacao/CorrelacaoTest.test.tsx`
- Modify: `src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx`
- Modify: `src/features/tests/poisson/PoissonTest.test.tsx`
- Modify: `src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx`
- Modify: `src/features/tests/logistica/LogisticaTest.test.tsx`
- Modify: `src/features/tests/prais-winsten/PraisWinstenTest.test.tsx`

**Interfaces:**
- Consumes: `WheelPicker` com `WheelOption.value: string` percentual.
- Produces:

```ts
export type AlphaValue = number & { readonly __alphaValue: unique symbol };
export const MIN_ALPHA = 0.001;
export const MAX_ALPHA = 0.1;
export const DEFAULT_ALPHA: AlphaValue;
export function parseAlpha(value: unknown, fallback?: AlphaValue): AlphaValue;
export function alphaToPercent(alpha: AlphaValue): number;
export function percentToAlpha(percent: number): AlphaValue;
export function formatAlphaPercent(alpha: AlphaValue): string;
```

- [ ] **Step 1: Registrar baseline dos 23 caminhos e separar hunks preexistentes**

Execute o protocolo global. Esses componentes já podem conter trabalho local; capture `git diff -- <caminho>` individualmente e marque no registro temporário quais arquivos exigem `git add -p`.

- [ ] **Step 2: Escrever regressões RED das quatro fronteiras e do defeito confirmado**

```ts
it.each([
  [0.001, '0,1%'],
  [0.01, '1%'],
  [0.05, '5%'],
  [0.1, '10%'],
] as const)('round-trips alpha %s as %s', (decimal, label) => {
  const alpha = parseAlpha(decimal);
  expect(formatAlphaPercent(alpha)).toBe(label);
  expect(percentToAlpha(alphaToPercent(alpha))).toBe(decimal);
});

it('shows decimal 0.1 as 10%, never 0.1%', () => {
  render(<AlphaSelector value={parseAlpha(0.1)} onChange={vi.fn()} />);
  expect(screen.getByText(/10%/)).toBeInTheDocument();
  expect(screen.queryByText(/0,1%/)).not.toBeInTheDocument();
});

it('round-trips every wheel step and does not change alpha when only lock state changes', async () => {
  for (let step = 1; step <= 100; step += 1) {
    const percent = step / 10;
    expect(alphaToPercent(percentToAlpha(percent))).toBeCloseTo(percent, 12);
  }
  const onChange = vi.fn();
  render(<AlphaSelector value={parseAlpha(0.05)} onChange={onChange} />);
  await user.click(screen.getByRole('button', { name: /desbloquear/i }));
  await user.click(screen.getByRole('button', { name: /bloquear/i }));
  expect(onChange).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Executar e confirmar RED**

Run: `npm exec vitest run -- src/features/tests/shared/alpha.test.ts src/features/tests/shared/AlphaSelector.test.tsx`

Expected: FAIL pela ausência de `alpha.ts` e pela normalização atual de `0.1` para `0,1%`.

- [ ] **Step 4: Implementar o contrato decimal mínimo**

```ts
export function parseAlpha(value: unknown, fallback = DEFAULT_ALPHA): AlphaValue {
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(numeric) && numeric >= MIN_ALPHA && numeric <= MAX_ALPHA
    ? numeric as AlphaValue
    : fallback;
}

export function alphaToPercent(alpha: AlphaValue): number {
  return alpha * 100;
}

export function percentToAlpha(percent: number): AlphaValue {
  return parseAlpha(percent / 100);
}
```

`AlphaSelector` gera opções percentuais `0.1` a `10.0`, converte o `value` somente com `alphaToPercent`, chama `onChange(percentToAlpha(Number(option)))` e apresenta `formatAlphaPercent(value)`. A opção destacada de `5%` usa `value === '5.0'`, não `0.5`.

- [ ] **Step 5: Migrar os dez estados sem converter duas vezes**

Em cada `*Test.tsx`, use a mesma forma:

```ts
const [alpha, setAlphaState] = useState<AlphaValue>(() =>
  parseAlpha(analysisTable.settings.alpha),
);

function setAlpha(next: AlphaValue) {
  setAlphaState(next);
  analysisTable.setSettings({ alpha: next });
}

const alphaNumber = alpha;
```

Remova `Number(alpha)` e casts diretos de `settings.alpha`. Acrescente em cada teste de componente uma asserção de que configuração `0.1` chama o motor/interpretação com `0.1` e mostra `10%`.

- [ ] **Step 6: Verificar unidade e os dez consumidores**

Run:

```bash
npm exec vitest run -- \
  src/features/tests/shared/alpha.test.ts \
  src/features/tests/shared/AlphaSelector.test.tsx \
  src/features/tests/t-student/TStudentTest.test.tsx \
  src/features/tests/anova-tukey/AnovaTukeyTest.test.tsx \
  src/features/tests/mann-whitney/MannWhitneyTest.test.tsx \
  src/features/tests/kruskal-dunn/KruskalDunnTest.test.tsx \
  src/features/tests/correlacao/CorrelacaoTest.test.tsx \
  src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx \
  src/features/tests/poisson/PoissonTest.test.tsx \
  src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx \
  src/features/tests/logistica/LogisticaTest.test.tsx \
  src/features/tests/prais-winsten/PraisWinstenTest.test.tsx
```

Expected: PASS, incluindo os quatro round-trips e os dez fluxos com o mesmo decimal.

- [ ] **Step 7: Typecheck focado pelo compilador do projeto**

Run: `npm run typecheck`

Expected: código `0`; nenhum `AlphaValue` string permanece nos consumidores.

- [ ] **Step 8: Commit da correção de alpha**

Use `git add -p` nos arquivos que estavam alterados no baseline e adicione os três arquivos novos por caminho explícito. Confirme que nenhum hunk adjacente entrou.

```bash
git add \
  src/features/tests/shared/alpha.ts \
  src/features/tests/shared/alpha.test.ts \
  src/features/tests/shared/AlphaSelector.test.tsx
git add -p -- \
  src/features/tests/shared/AlphaSelector.tsx \
  src/features/tests/t-student/TStudentTest.tsx \
  src/features/tests/anova-tukey/AnovaTukeyTest.tsx \
  src/features/tests/mann-whitney/MannWhitneyTest.tsx \
  src/features/tests/kruskal-dunn/KruskalDunnTest.tsx \
  src/features/tests/correlacao/CorrelacaoTest.tsx \
  src/features/tests/qui-quadrado/QuiQuadradoTest.tsx \
  src/features/tests/poisson/PoissonTest.tsx \
  src/features/tests/binomial-negativa/BinomialNegativaTest.tsx \
  src/features/tests/logistica/LogisticaTest.tsx \
  src/features/tests/prais-winsten/PraisWinstenTest.tsx \
  src/features/tests/t-student/TStudentTest.test.tsx \
  src/features/tests/anova-tukey/AnovaTukeyTest.test.tsx \
  src/features/tests/mann-whitney/MannWhitneyTest.test.tsx \
  src/features/tests/kruskal-dunn/KruskalDunnTest.test.tsx \
  src/features/tests/correlacao/CorrelacaoTest.test.tsx \
  src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx \
  src/features/tests/poisson/PoissonTest.test.tsx \
  src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx \
  src/features/tests/logistica/LogisticaTest.test.tsx \
  src/features/tests/prais-winsten/PraisWinstenTest.test.tsx
git commit -m "fix(stats): keep significance alpha decimal"
```

### Task 3: Persistência de testSlots, fila e modo em memória

**Files:**
- Create: `src/shared/session/StatisticsSessionProvider.tsx`
- Create: `src/shared/session/StatisticsSessionProvider.test.tsx`
- Modify: `src/shared/session/SessionProvider.tsx`
- Modify: `src/shared/session/sessionStorage.ts`
- Modify: `src/shared/session/SessionPersistence.test.tsx`
- Modify: `src/shared/session/SessionProvider.test.tsx`
- Modify: `src/shared/session/sessionStorage.test.ts`
- Create: `src/shared/session/PersistenceNotice.tsx`
- Create: `src/shared/session/PersistenceNotice.test.tsx`
- Modify: `src/routes/estatistica/EstatisticaPage.tsx`

**Interfaces:**
- Consumes: `SessionStorageAdapter.read/write/clear` e `SessionSnapshot.testSlots` de `src/shared/session/sessionStorage.ts`.
- Produces:

```ts
import type { ReactElement, ReactNode } from 'react';
import type { TableDocument } from '@/shared/data-input/tableDocument';
import type { SessionStorageAdapter, SessionTestSlot } from './sessionStorage';

export type PersistenceMode = 'persistent' | 'memory';

export interface SessionDataset {
  headers: string[];
  rows: string[][];
  sourceLabel: string;
  confirmedAt: number;
  table?: TableDocument;
}

export interface StatisticsSessionState {
  dataset: SessionDataset | null;
  datasusSession: unknown | null;
  visualPreferences: Record<string, unknown>;
  testSlots: Record<string, SessionTestSlot>;
  hasData: boolean;
  persistenceMode: PersistenceMode;
  persistenceReady: boolean;
  persistenceStatus: 'restoring' | 'saving' | 'saved' | 'error';
  persistenceError: string | null;
  hasUnsavedChanges: boolean;
}

export interface StatisticsSessionApi extends StatisticsSessionState {
  setDataset(dataset: SessionDataset | null): void;
  setDatasusSession(session: unknown | null): void;
  setVisualPreferences(preferences: Record<string, unknown>): void;
  switchTest(fromTestId: string, toTestId: string): void;
  setTestSlotMeta(testId: string, meta: {
    confirmedRevision?: number;
    settings?: Record<string, unknown>;
  }): void;
  clearSession(): void;
}

export interface StatisticsSessionProviderProps {
  children: ReactNode;
  storage?: SessionStorageAdapter;
}

export function StatisticsSessionProvider(props: StatisticsSessionProviderProps): ReactElement;
export function useStatisticsSession(): StatisticsSessionApi;

export interface PersistenceNoticeProps {
  mode: PersistenceMode;
  status: StatisticsSessionState['persistenceStatus'];
  message: string | null;
}
```

- [ ] **Step 1: Registrar baseline e preservar os quatro arquivos já modificados**

Execute o protocolo global. Para cada arquivo modificado, salve também `git diff -U80 -- <caminho>` no diretório temporário para separar mudanças de sessão existentes dos novos refs de persistência.

- [ ] **Step 2: Escrever regressões RED para testSlots e alterações não salvas**

```tsx
it('persists an isolated testSlots settings change and restores alpha 0.1', async () => {
  const storage = createStorage();
  const first = renderSession(storage);
  await waitFor(() => expect(first.result.current.persistenceReady).toBe(true));
  act(() => first.result.current.setDataset(sampleDataset()));
  await waitFor(() => expect(first.result.current.persistenceStatus).toBe('saved'));
  act(() => first.result.current.setTestSlotMeta('t-student', { settings: { alpha: 0.1 } }));
  expect(first.result.current.hasUnsavedChanges).toBe(true);
  await waitFor(() => expect(first.result.current.persistenceStatus).toBe('saved'));
  first.unmount();

  const restored = renderSession(storage);
  await waitFor(() => expect(restored.result.current.persistenceReady).toBe(true));
  expect(restored.result.current.testSlots['t-student']?.settings?.alpha).toBe(0.1);
});
```

Acrescente casos com duas writes deferidas, `clearSession()` entre elas, `QuotaExceededError`, `indexedDB` ausente e snapshot inválido. A asserção final de concorrência deve provar que somente a geração mais nova permanece legível.

- [ ] **Step 3: Executar e confirmar RED**

Run: `npm exec vitest run -- src/shared/session/SessionPersistence.test.tsx src/shared/session/SessionProvider.test.tsx src/shared/session/sessionStorage.test.ts`

Expected: FAIL porque `lastPersistedDatasetRef`/`lastPersistedPreferencesRef` não incluem identidade de `testSlots`, então mudança isolada pode ser classificada como já persistida.

- [ ] **Step 4: Incluir testSlots no snapshot corrente e no dirty check**

Adicionar `lastPersistedTestSlotsRef` em todos os pontos equivalentes aos refs existentes: inicialização, hidratação, sucesso de write, limpeza e falha. O guard do efeito e `hasUnsavedChanges` comparam os três ramos:

```ts
const persistedCurrentState = persistenceStatus === 'saved'
  && dataset === lastPersistedDatasetRef.current
  && visualPreferences === lastPersistedPreferencesRef.current
  && testSlots === lastPersistedTestSlotsRef.current;

const hasUnsavedChanges = datasusSession !== null
  || ((dataset !== null
    || Object.keys(testSlots).length > 0
    || Object.keys(visualPreferences).length > 0)
    && !persistedCurrentState);
```

Extraia dataset, `datasusSession`, preferências, `testSlots` e toda a fila para `StatisticsSessionProvider`; ele não pode importar `features/research`, `routes/mapas`, `routes/variaveis` ou Supabase. O `SessionProvider` histórico passa a compor esse provider com um contexto separado para `mapSelection`, `mapAnalysis`, `researchDesign` e `guidedAnalysis`, preservando as APIs das telas históricas sem levá-las ao entrypoint de release.

`StatisticsSessionProvider.tsx` importa `ReactElement`/`ReactNode` de `react` e `SessionStorageAdapter`/`SessionTestSlot` de `sessionStorage.ts`. `SessionProvider.tsx` reexporta `SessionDataset`, `StatisticsSessionProviderProps`, `normalizeSessionDataset`, `StatisticsSessionState` e `StatisticsSessionApi` do arquivo novo e mantém `SessionProviderProps` como alias compatível, para os consumidores históricos continuarem compilando. `sessionStorage.ts` troca somente o import de tipo de `SessionDataset` para `StatisticsSessionProvider`; nenhum ciclo de runtime é permitido.

`setTestSlotMeta` e `switchTest` marcam `mutatedBeforeRestoreRef.current = true` quando a hidratação ainda não terminou, impedindo snapshot antigo de sobrescrever a escolha corrente. A fila continua serializada. Cada write captura `generation` e `sequence`; write ou clear obsoleto não atualiza refs/status. `clearSession()` incrementa a geração antes de zerar estado.

- [ ] **Step 5: Expor modo real sem prometer persistência**

Ao falhar leitura/abertura/clear irrecuperável, definir `persistenceMode: 'memory'`; em write falha, manter estado em memória, modo `memory`, status `error` e mensagem existente. Nunca mudar para `saved` enquanto `persistenceWritableRef` estiver falso.

```tsx
export function PersistenceNotice({ mode, status, message }: PersistenceNoticeProps) {
  if (mode === 'persistent' && status !== 'error') return null;
  return (
    <p
      role={status === 'error' ? 'alert' : 'status'}
      aria-live={status === 'error' ? 'assertive' : 'polite'}
      className="lacir-persistence-notice"
    >
      {message ?? 'Modo temporário: os dados durarão somente nesta sessão.'}
    </p>
  );
}
```

Monte o aviso no topo de `EstatisticaPage`, fora do componente de cada teste, para persistir durante trocas entre os dez testes e permanecer acessível. Não o renderize nas três rotas fechadas: nelas, o `main` continua contendo somente `Em breve`. O teste exige texto, não apenas cor, e não permite mensagem de sucesso depois da falha.

- [ ] **Step 6: Verificar persistência e aviso**

Run: `npm exec vitest run -- src/shared/session/StatisticsSessionProvider.test.tsx src/shared/session/SessionPersistence.test.tsx src/shared/session/SessionProvider.test.tsx src/shared/session/sessionStorage.test.ts src/shared/session/PersistenceNotice.test.tsx`

Expected: PASS com restauração de `0.1`, latest-write-wins, clear invalidando write antiga e modo em memória visível.

- [ ] **Step 7: Commit da integridade de sessão**

```bash
git add src/shared/session/StatisticsSessionProvider.tsx src/shared/session/StatisticsSessionProvider.test.tsx src/shared/session/PersistenceNotice.tsx src/shared/session/PersistenceNotice.test.tsx
git add -p -- src/shared/session/SessionProvider.tsx src/shared/session/sessionStorage.ts src/shared/session/SessionPersistence.test.tsx src/shared/session/SessionProvider.test.tsx src/shared/session/sessionStorage.test.ts src/routes/estatistica/EstatisticaPage.tsx
git commit -m "fix(session): persist test settings safely"
```

---

## Fase 3 — Fechamento dos módulos indisponíveis e custo em repouso

### Task 4: Router por distribuição e placeholder literal

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/app/router.test.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/app/Header.tsx`
- Modify: `src/app/Header.test.tsx`
- Modify: `src/routes/ComingSoonPage.tsx`
- Modify: `src/routes/ComingSoonPage.test.tsx`
- Modify: `src/app/RouteError.tsx`

**Interfaces:**
- Consumes: `RELEASE_MANIFEST`, `ReleaseRoute`, `COMING_SOON_COPY` da Task 1.
- Produces:

```ts
export type DistributionMode = 'pages' | 'offline';

export interface AppRouterOptions {
  distribution: DistributionMode;
  baseUrl: string;
}

export function createAppRouter(options: AppRouterOptions): ReturnType<typeof createBrowserRouter>;
export const appRouteChildren: RouteObject[];
export function resolveRouterBasename(baseUrl: string): string;
```

- [ ] **Step 1: Registrar baseline dos nove caminhos**

Execute o protocolo global. `AppShell.tsx`, `router.tsx`, `router.test.tsx` e `ComingSoonPage.tsx` já podem conter trabalho do usuário; use staging interativo nesses caminhos.

- [ ] **Step 2: Completar os testes RED de placeholder e roteamento**

```tsx
it.each(['/meta-analise', '/variaveis', '/mapas'])('%s has only literal copy in main', (path) => {
  renderAt(path);
  const main = screen.getByRole('main');
  expect(main).toHaveTextContent(/^Em breve$/);
  expect(within(main).queryAllByRole('button')).toHaveLength(0);
  expect(main.querySelector('canvas, img, [data-motion], .lacir-sticker')).toBeNull();
});

it('uses a hash router for the offline distribution', () => {
  const router = createAppRouter({ distribution: 'offline', baseUrl: './' });
  expect(router.basename).toBe('/');
});
```

Em `ComingSoonPage.test.tsx`, remova mocks de `ParticleText` e `StickerPeel`; exija apenas um heading/texto `Em breve` e nenhum efeito ou acesso a storage.

- [ ] **Step 3: Executar e confirmar RED**

Run: `npm exec vitest run -- src/app/router.test.tsx src/routes/ComingSoonPage.test.tsx src/app/Header.test.tsx`

Expected: FAIL porque o componente atual mostra nome, `Breve em 2027.1`, partículas e sticker, e existe apenas Browser Router.

- [ ] **Step 4: Tornar o placeholder estático e sem props**

```tsx
import { COMING_SOON_COPY } from '@/release/releaseManifest';

export function ComingSoonPage() {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] place-items-center px-4">
      <h1 className="font-sans text-display font-bold text-text">{COMING_SOON_COPY}</h1>
    </div>
  );
}
```

O nome do módulo permanece somente no item de navegação ativo e em `document.title`. Remova `title`, `stickerId`, `localStorage`, imports de partículas/sticker e data de lançamento.

- [ ] **Step 5: Construir filhos de rota pelo manifesto, com imports estáticos permitidos**

O arquivo `router.tsx` importa apenas `EstatisticaPage`, `ComingSoonPage`, `AppShell` e `RouteError`. Não importa `routes/mapas`, `routes/variaveis`, `routes/meta-analise`, `features/catalog` ou `features/research`.

```tsx
export const appRouteChildren: RouteObject[] = RELEASE_MANIFEST.routes.map((route) => ({
  path: route.path,
  element: route.availability === 'active' ? <EstatisticaPage /> : <ComingSoonPage />,
}));

export function createAppRouter({ distribution, baseUrl }: AppRouterOptions) {
  const routes = [{ element: <AppShell />, errorElement: <RouteError />, children: appRouteChildren }];
  return distribution === 'offline'
    ? createHashRouter(routes)
    : createBrowserRouter(routes, { basename: resolveRouterBasename(baseUrl) });
}
```

`main.tsx` escolhe `offline` somente quando `import.meta.env.MODE === 'offline'`. `AppShell` usa `findReleaseRoute(location.pathname)` para atualizar `document.title` e move foco programaticamente para `main` em troca de rota sem interferir em navegação dentro da mesma página.

- [ ] **Step 6: Garantir fallback seguro**

`RouteError` deve renderizar heading, mensagem e link interno para Estatística nos dois routers. O teste abre `/rota-que-nao-existe` em memória e exige conteúdo utilizável, sem stack trace.

- [ ] **Step 7: Verificar rotas**

Run: `npm exec vitest run -- src/app/router.test.tsx src/routes/ComingSoonPage.test.tsx src/app/Header.test.tsx`

Expected: PASS para raiz, três placeholders, URL Pages direta, hash offline, título e rota desconhecida.

- [ ] **Step 8: Commit de roteamento e placeholders**

```bash
git add -p -- src/main.tsx src/app/router.tsx src/app/router.test.tsx src/app/AppShell.tsx src/app/Header.tsx src/app/Header.test.tsx src/routes/ComingSoonPage.tsx src/routes/ComingSoonPage.test.tsx src/app/RouteError.tsx
git commit -m "feat(release): isolate unavailable routes"
```

### Task 5: Grafo ativo sem módulos fechados e sem loop visual em repouso

**Files:**
- Modify: `src/app/AppShell.tsx`
- Modify: `src/main.tsx`
- Modify: `src/routes/estatistica/EstatisticaPage.tsx`
- Modify: `src/routes/estatistica/ClearDataButton.tsx`
- Modify: `src/routes/estatistica/LeaveWarningGuard.tsx`
- Modify: `src/shared/data-input/useAnalysisTable.ts`
- Modify: `src/shared/charts/ResultsPanelWithCustomizer.tsx`
- Modify: `src/features/tests/t-student/TStudentTest.tsx`
- Modify: `src/features/tests/anova-tukey/AnovaTukeyTest.tsx`
- Modify: `src/features/tests/mann-whitney/MannWhitneyTest.tsx`
- Modify: `src/features/tests/kruskal-dunn/KruskalDunnTest.tsx`
- Modify: `src/features/tests/correlacao/CorrelacaoTest.tsx`
- Modify: `src/features/tests/qui-quadrado/QuiQuadradoTest.tsx`
- Modify: `src/features/tests/poisson/PoissonTest.tsx`
- Modify: `src/features/tests/binomial-negativa/BinomialNegativaTest.tsx`
- Modify: `src/features/tests/logistica/LogisticaTest.tsx`
- Modify: `src/features/tests/prais-winsten/PraisWinstenTest.tsx`
- Modify: `src/shared/flow/RevealOnScroll.tsx`
- Modify: `src/shared/flow/RevealOnScroll.test.tsx`
- Modify: `src/shared/flow/RevealOnScroll.reduced-motion.test.tsx`
- Modify: `src/app/theme.css`
- Create: `scripts/release/audit-release.mjs`
- Create: `scripts/release/audit-release.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: diretório de build indicado por CLI e manifesto da Task 1.
- Produces:

```js
/** @typedef {{ code: string, file: string, detail: string }} ReleaseAuditFinding */
/** @typedef {{ mode?: 'pages' | 'offline' }} ReleaseAuditOptions */
/**
 * @param {string} directory
 * @param {ReleaseAuditOptions} options
 * @returns {Promise<{ files: string[], findings: ReleaseAuditFinding[] }>}
 */
export async function auditReleaseDirectory(
  directory,
  options = /** @type {ReleaseAuditOptions} */ ({}),
) {}
/**
 * @param {{ files: string[], findings: ReleaseAuditFinding[] }} report
 * @returns {void}
 */
export function assertReleaseAudit(report) {}
```

- [ ] **Step 1: Registrar baseline e caracterizar imports proibidos**

Execute o protocolo global. Confirme com `rg -n` que `ComingSoonPage` e `AppShell` ainda importam efeitos antes desta tarefa e salve a saída no baseline temporário.

- [ ] **Step 2: Escrever testes RED para repouso e auditoria**

```ts
it('stops scheduling frames once the reveal is visible', () => {
  const raf = vi.spyOn(window, 'requestAnimationFrame');
  render(<RevealOnScroll><span>resultado</span></RevealOnScroll>);
  act(() => intersectionCallback([{ isIntersecting: true }]));
  const callsAtRest = raf.mock.calls.length;
  act(() => vi.advanceTimersByTime(1_000));
  expect(raf).toHaveBeenCalledTimes(callsAtRest);
});
```

```js
it('rejects closed-module and Supabase markers', async () => {
  await writeFixture('assets/app.js', 'createClient("https://x.supabase.co")');
  const report = await auditReleaseDirectory(fixtureDir);
  assert.deepEqual(report.findings.map((item) => item.code), ['forbidden-runtime-marker']);
});
```

Marcadores proibidos: `@supabase/supabase-js`, `supabase.co`, `/rest/v1`, `/data/catalog`, `MapasPage`, `VariaveisPage`, `MetaAnalisePage`, `fingerprintResearchDesign`, `mapSelection`, `guidedAnalysis`, `ParticleText`, `StickerPeel`, `requestAnimationFrame(loop)` em chunk de placeholder.

- [ ] **Step 3: Executar e confirmar RED**

Run: `npm exec vitest run -- src/shared/flow/RevealOnScroll.test.tsx src/shared/flow/RevealOnScroll.reduced-motion.test.tsx && node --test scripts/release/audit-release.test.mjs`

Expected: FAIL pela ausência do auditor; qualquer loop permanente caracterizado também deve falhar.

- [ ] **Step 4: Remover efeitos supérfluos do release ativo**

Remova `ResultsSticker` de `AppShell`. Em `EstatisticaPage`, mantenha transição finita apenas quando movimento reduzido estiver desligado. `RevealOnScroll` deve desconectar seu observer após revelar, renderizar estado final imediatamente com movimento reduzido e nunca iniciar RAF contínuo. CSS de hover recebe equivalente `:focus-visible`; `@media (prefers-reduced-motion: reduce)` desliga `animation` e `transition` não essenciais.

Troque `main.tsx` para montar `StatisticsSessionProvider` e mude os imports de `useSession` para `useStatisticsSession` em `EstatisticaPage`, `ClearDataButton`, `LeaveWarningGuard`, `useAnalysisTable`, `ResultsPanelWithCustomizer` e nos dez `*Test.tsx`. Não altere imports das rotas históricas: elas continuam consumindo o provider composto antigo, que não é alcançado pelo entrypoint.

- [ ] **Step 5: Implementar o auditor por bytes do artefato**

O auditor percorre recursivamente somente arquivos regulares de `dist`/`dist-offline`, lê `.html`, `.js`, `.css`, `.json` e falha com arquivo e marcador. URLs `data:`/`blob:` e `https://www.w3.org/2000/svg` dentro de markup interno são tratadas separadamente; qualquer outro `http://` ou `https://` no artefato ativo é finding.

Adicionar scripts:

```json
{
  "scripts": {
    "test:release-audit": "node --test scripts/release/audit-release.test.mjs",
    "audit:release": "node scripts/release/audit-release.mjs"
  }
}
```

- [ ] **Step 6: Verificar componentes e auditor**

Run: `npm exec vitest run -- src/shared/flow/RevealOnScroll.test.tsx src/shared/flow/RevealOnScroll.reduced-motion.test.tsx && npm run test:release-audit`

Expected: PASS; o fixture inseguro falha no teste controlado e o fixture limpo retorna zero findings.

- [ ] **Step 7: Commit de isolamento e repouso**

```bash
git add scripts/release/audit-release.mjs scripts/release/audit-release.test.mjs
git add -p -- \
  src/app/AppShell.tsx \
  src/main.tsx \
  src/routes/estatistica/EstatisticaPage.tsx \
  src/routes/estatistica/ClearDataButton.tsx \
  src/routes/estatistica/LeaveWarningGuard.tsx \
  src/shared/data-input/useAnalysisTable.ts \
  src/shared/charts/ResultsPanelWithCustomizer.tsx \
  src/features/tests/t-student/TStudentTest.tsx \
  src/features/tests/anova-tukey/AnovaTukeyTest.tsx \
  src/features/tests/mann-whitney/MannWhitneyTest.tsx \
  src/features/tests/kruskal-dunn/KruskalDunnTest.tsx \
  src/features/tests/correlacao/CorrelacaoTest.tsx \
  src/features/tests/qui-quadrado/QuiQuadradoTest.tsx \
  src/features/tests/poisson/PoissonTest.tsx \
  src/features/tests/binomial-negativa/BinomialNegativaTest.tsx \
  src/features/tests/logistica/LogisticaTest.tsx \
  src/features/tests/prais-winsten/PraisWinstenTest.tsx \
  src/shared/flow/RevealOnScroll.tsx \
  src/shared/flow/RevealOnScroll.test.tsx \
  src/shared/flow/RevealOnScroll.reduced-motion.test.tsx \
  src/app/theme.css \
  package.json
git commit -m "perf(release): remove idle visual work"
```

---

## Fase 4 — Revisão funcional, estatística e de experiência

### Task 6: Contenção de motores e preservação do fluxo

**Files:**
- Create: `src/routes/estatistica/AnalysisErrorBoundary.tsx`
- Create: `src/routes/estatistica/AnalysisErrorBoundary.test.tsx`
- Modify: `src/routes/estatistica/EstatisticaPage.tsx`
- Modify: `src/routes/estatistica/EstatisticaPage.test.tsx`
- Modify: `src/features/tests/shared/RoleBindingPanel.tsx`
- Modify: `src/features/tests/shared/RoleBindingPanel.test.tsx`
- Modify: `src/features/tests/t-student/TStudentTest.test.tsx`
- Modify: `src/features/tests/anova-tukey/AnovaTukeyTest.test.tsx`
- Modify: `src/features/tests/mann-whitney/MannWhitneyTest.test.tsx`
- Modify: `src/features/tests/kruskal-dunn/KruskalDunnTest.test.tsx`
- Modify: `src/features/tests/correlacao/CorrelacaoTest.test.tsx`
- Modify: `src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx`
- Modify: `src/features/tests/poisson/PoissonTest.test.tsx`
- Modify: `src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx`
- Modify: `src/features/tests/logistica/LogisticaTest.test.tsx`
- Modify: `src/features/tests/prais-winsten/PraisWinstenTest.test.tsx`

**Interfaces:**
- Consumes: filho React correspondente ao teste ativo.
- Produces:

```ts
import type { ReactNode } from 'react';
import type { TestId } from '@/features/tests/registry';

export interface AnalysisErrorBoundaryProps {
  resetKey: string;
  children: ReactNode;
}

interface AnalysisErrorBoundaryState {
  error: Error | null;
}

interface InvalidInputScreenState {
  error: HTMLElement;
  invalidControl: HTMLElement;
  input: HTMLTextAreaElement;
  originalText: string;
  results: HTMLElement | null;
}

async function renderInvalidSupportedInput(testId: TestId): Promise<InvalidInputScreenState>;
```

- [ ] **Step 1: Registrar baseline e escrever o teste RED**

```tsx
it('contains an unexpected engine render failure and preserves navigation', async () => {
  render(<AppWithThrowingTest />);
  expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível concluir este cálculo');
  expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: /dados/i })).toHaveValue(expect.stringContaining('grupo'));
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it.each(TEST_REGISTRY.map(({ id }) => id))('%s keeps input after a domain validation error', async (testId) => {
  const screenState = await renderInvalidSupportedInput(testId);
  expect(screenState.error).toHaveAttribute('role', 'alert');
  expect(screenState.error).toHaveAttribute('id');
  expect(screenState.invalidControl).toHaveAttribute('aria-describedby', screenState.error.id);
  expect(screenState.input).toHaveValue(screenState.originalText);
  expect(screenState.results).toBeNull();
});
```

- [ ] **Step 2: Executar e confirmar RED**

Run:

```bash
npm exec vitest run -- \
  src/routes/estatistica/AnalysisErrorBoundary.test.tsx \
  src/routes/estatistica/EstatisticaPage.test.tsx \
  src/features/tests/shared/RoleBindingPanel.test.tsx \
  src/features/tests/t-student/TStudentTest.test.tsx \
  src/features/tests/anova-tukey/AnovaTukeyTest.test.tsx \
  src/features/tests/mann-whitney/MannWhitneyTest.test.tsx \
  src/features/tests/kruskal-dunn/KruskalDunnTest.test.tsx \
  src/features/tests/correlacao/CorrelacaoTest.test.tsx \
  src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx \
  src/features/tests/poisson/PoissonTest.test.tsx \
  src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx \
  src/features/tests/logistica/LogisticaTest.test.tsx \
  src/features/tests/prais-winsten/PraisWinstenTest.test.tsx
```

Expected: FAIL porque uma exceção do filho alcança o `RouteError` e substitui a página.

- [ ] **Step 3: Implementar boundary por módulo**

Use class component, pois React ainda exige `getDerivedStateFromError`/`componentDidCatch`. O fallback mantém tabela/configuração fora do boundary e substitui somente resultados ou o mount do teste quando não for possível granularizar. `resetKey` e o botão zeram `error`; não limpe `SessionProvider`.

```tsx
static getDerivedStateFromError(error: Error): AnalysisErrorBoundaryState {
  return { error };
}

componentDidUpdate(previous: AnalysisErrorBoundaryProps) {
  if (previous.resetKey !== this.props.resetKey && this.state.error) {
    this.setState({ error: null });
  }
}
```

- [ ] **Step 4: Vincular erros de domínio ao controle corrigível**

`RoleBindingPanel` recebe/gera um id estável por papel e aplica `aria-invalid="true"` e `aria-describedby=<id-do-erro>` quando falta coluna ou o tipo é incompatível. Em cada teste, capture erro retornado por `validateDataset`/`validateSampleSize` antes de chamar o motor, renderize junto do grupo de configuração e preserve `analysisTable.table`, bindings, settings e texto importado. Somente exceção inesperada chega ao boundary.

- [ ] **Step 5: Verificar boundary, validação e troca entre os dez testes**

Run the same exact-path Vitest command from Step 2.

Expected: PASS, sem página branca e sem perda do dataset ao tentar novamente ou trocar teste.

- [ ] **Step 6: Commit da contenção**

```bash
git add src/routes/estatistica/AnalysisErrorBoundary.tsx src/routes/estatistica/AnalysisErrorBoundary.test.tsx
git add -p -- \
  src/routes/estatistica/EstatisticaPage.tsx \
  src/routes/estatistica/EstatisticaPage.test.tsx \
  src/features/tests/shared/RoleBindingPanel.tsx \
  src/features/tests/shared/RoleBindingPanel.test.tsx \
  src/features/tests/t-student/TStudentTest.test.tsx \
  src/features/tests/anova-tukey/AnovaTukeyTest.test.tsx \
  src/features/tests/mann-whitney/MannWhitneyTest.test.tsx \
  src/features/tests/kruskal-dunn/KruskalDunnTest.test.tsx \
  src/features/tests/correlacao/CorrelacaoTest.test.tsx \
  src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx \
  src/features/tests/poisson/PoissonTest.test.tsx \
  src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx \
  src/features/tests/logistica/LogisticaTest.test.tsx \
  src/features/tests/prais-winsten/PraisWinstenTest.test.tsx
git commit -m "fix(stats): contain analysis failures"
```

### Task 7: Clipboard e exportação recuperáveis

**Files:**
- Create: `src/shared/clipboard/localClipboard.ts`
- Create: `src/shared/clipboard/localClipboard.test.ts`
- Modify: `src/routes/estatistica/CopyResultsButton.tsx`
- Modify: `src/routes/estatistica/CopyResultsButton.test.tsx`
- Modify: `src/shared/charts/useChartExport.ts`
- Modify: `src/shared/charts/useChartExport.test.ts`
- Modify: `src/routes/estatistica/ResultsPanel.tsx`
- Create: `src/routes/estatistica/ResultsPanel.test.tsx`

**Interfaces:**
- Consumes: texto formatado do resultado e canvas já renderizado.
- Produces:

```ts
export type ClipboardResult =
  | { status: 'copied' }
  | { status: 'manual'; text: string; reason: 'unavailable' | 'denied' | 'failed' };

export async function copyLocalText(text: string): Promise<ClipboardResult>;

export type PngExportResult =
  | { status: 'downloaded'; filename: string }
  | { status: 'failed'; message: string };

export function exportCanvasPng(canvas: HTMLCanvasElement, filename?: string): PngExportResult;
```

- [ ] **Step 1: Registrar baseline e escrever falhas RED**

```tsx
it('offers manual selection when clipboard permission is denied', async () => {
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new DOMException('denied'));
  render(<CopyResultsButton {...props} />);
  await user.click(screen.getByRole('button', { name: 'Copiar tudo' }));
  expect(screen.getByRole('textbox', { name: 'Resultado para cópia manual' })).toHaveValue(
    expect.stringContaining(props.title),
  );
});

it('keeps results visible after canvas export failure', async () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => { throw new Error('canvas'); });
  render(<ResultsPanel {...props} />);
  await user.click(screen.getByRole('button', { name: /baixar gráfico/i }));
  expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível gerar o PNG');
  expect(screen.getByRole('heading', { name: 'Resultados' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Executar e confirmar RED**

Run: `npm exec vitest run -- src/shared/clipboard/localClipboard.test.ts src/routes/estatistica/CopyResultsButton.test.tsx src/shared/charts/useChartExport.test.ts src/routes/estatistica/ResultsPanel.test.tsx`

Expected: FAIL pela ausência do contrato manual e porque exportação retorna apenas boolean/undefined.

- [ ] **Step 3: Implementar fallback local explícito**

`copyLocalText` usa `navigator.clipboard.writeText` somente quando existe; qualquer falha retorna o texto sem apagá-lo. `CopyResultsButton` abre uma região com `<textarea readOnly>` selecionável, instrução `Selecione o texto e use Ctrl+C ou ⌘C` e botão de fechar. Nenhum timer remove erro antes de a pessoa lê-lo.

`exportCanvasPng` restaura `devicePixelRatio` em `finally`, retorna mensagem fixa em falha e nunca desmonta gráficos. `ResultsPanel` mostra `role="alert"` e permite repetir.

- [ ] **Step 4: Verificar clipboard/export**

Run: `npm exec vitest run -- src/shared/clipboard/localClipboard.test.ts src/routes/estatistica/CopyResultsButton.test.tsx src/shared/charts/useChartExport.test.ts src/routes/estatistica/ResultsPanel.test.tsx`

Expected: PASS em Clipboard API, `file:`/permissão negada, cópia manual, PNG e falha repetível.

- [ ] **Step 5: Commit dos fallbacks locais**

```bash
git add src/shared/clipboard/localClipboard.ts src/shared/clipboard/localClipboard.test.ts
git add src/routes/estatistica/ResultsPanel.test.tsx
git add -p -- src/routes/estatistica/CopyResultsButton.tsx src/routes/estatistica/CopyResultsButton.test.tsx src/shared/charts/useChartExport.ts src/shared/charts/useChartExport.test.ts src/routes/estatistica/ResultsPanel.tsx
git commit -m "fix(results): preserve output on local API failures"
```

### Task 8: Importação segura com mensagens acionáveis

**Files:**
- Modify: `src/shared/data-input/importLimits.ts`
- Modify: `src/shared/data-input/importLimits.test.ts`
- Modify: `src/shared/data-input/parseTabular.ts`
- Modify: `src/shared/data-input/parseTabular.test.ts`
- Modify: `src/shared/data-input/useTabularInput.ts`
- Modify: `src/shared/data-input/useTabularInput.test.ts`
- Modify: `src/shared/data-input/xlsxReader.ts`
- Modify: `src/shared/data-input/xlsxReader.test.ts`
- Modify: `src/routes/estatistica/TabularInputPanel.tsx`
- Modify: `src/routes/estatistica/TabularInputPanel.test.tsx`
- Modify: `src/routes/estatistica/ColumnPreviewTable.tsx`
- Modify: `src/routes/estatistica/ColumnPreviewTable.test.tsx`

**Interfaces:**
- Consumes: `IMPORT_LIMITS` existente e `TabularInputError`.
- Produces:

```ts
import type { RenderResult } from '@testing-library/react';

export type TabularErrorCode =
  | 'file-too-large' | 'text-too-large' | 'table-too-large'
  | 'zip64' | 'encrypted-xlsx' | 'external-relationship'
  | 'unsafe-xml' | 'xlsx-decompression-unavailable' | 'invalid-file';

export interface TabularInputError {
  code: TabularErrorCode;
  message: string;
  details: string[];
  recovery: string;
  fileName: string;
}

/** Test helper that builds a TableDocument and renders ColumnPreviewTable. */
function renderPreview(rows: string[][]): RenderResult;
```

- [ ] **Step 1: Registrar baseline e escrever matriz RED de erros**

Antes dos casos de erro, congele os limites com uma asserção exata e acrescente testes de fronteira que aceitam o valor máximo e rejeitam máximo + 1 para cada campo:

```ts
expect(IMPORT_LIMITS).toEqual({
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
```

```ts
it.each([
  ['grande.xlsx', 'xlsx-decompression-unavailable', 'Use CSV ou TXT neste navegador'],
  ['zip64.xlsx', 'zip64', 'Exporte novamente como XLSX comum ou CSV'],
  ['externo.xlsx', 'external-relationship', 'Remova vínculos externos'],
  ['dados.csv', 'file-too-large', '10 MiB'],
] as const)('returns actionable error for %s', async (fileName, code, recovery) => {
  const state = await readUnsafeFixture(fileName);
  expect(state).toMatchObject({ status: 'error', error: { code, fileName, recovery: expect.stringContaining(recovery) } });
});
```

Mantenha regressões existentes para ZIP64, criptografia, DTD/ENTITY, path traversal, expansão, relação externa e fórmula sem cache; acrescente que nenhum caso chama `fetch`.

```tsx
it('renders imported markup and formulas as inert text', () => {
  renderPreview([['<img src=x onerror=alert(1)>', '=SUM(A1:A2)']]);
  expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  expect(screen.getByText('=SUM(A1:A2)')).toBeInTheDocument();
  expect(document.querySelector('img[src="x"]')).toBeNull();
});
```

- [ ] **Step 2: Executar e confirmar RED**

Run: `npm exec vitest run -- src/shared/data-input/importLimits.test.ts src/shared/data-input/parseTabular.test.ts src/shared/data-input/useTabularInput.test.ts src/shared/data-input/xlsxReader.test.ts src/routes/estatistica/TabularInputPanel.test.tsx src/routes/estatistica/ColumnPreviewTable.test.tsx`

Expected: FAIL porque o erro atual perde código, arquivo e recuperação em alguns caminhos.

- [ ] **Step 3: Propagar erro tipado sem substituir a sessão corrente**

Adicione `code`, `recovery` e `fileName` no ponto em que cada validação falha; `useTabularInput` só aplica o resultado quando `requestId` ainda é o mais recente. `TabularInputPanel` renderiza arquivo/limite/causa e recuperação em `role="alert"`. Uma falha de nova importação não chama `setDataset(null)`; a tabela confirmada anterior permanece.

Para `DecompressionStream` ausente, use exatamente:

```ts
{
  code: 'xlsx-decompression-unavailable',
  message: `Não foi possível abrir ${fileName} neste navegador.`,
  details: [],
  recovery: 'Use Chrome/Edge 103+, Firefox 113+, Safari 16.4+ ou converta o arquivo para CSV/TXT.',
  fileName,
}
```

- [ ] **Step 4: Verificar a matriz e concorrência de requests**

Run: `npm exec vitest run -- src/shared/data-input/importLimits.test.ts src/shared/data-input/parseTabular.test.ts src/shared/data-input/useTabularInput.test.ts src/shared/data-input/xlsxReader.test.ts src/routes/estatistica/TabularInputPanel.test.tsx src/routes/estatistica/ColumnPreviewTable.test.tsx`

Expected: PASS; a resposta antiga não vence `requestId`, nenhum arquivo inseguro é truncado/avaliado e a sessão anterior permanece.

- [ ] **Step 5: Commit de erros de importação**

```bash
git add -p -- src/shared/data-input/importLimits.ts src/shared/data-input/importLimits.test.ts src/shared/data-input/parseTabular.ts src/shared/data-input/parseTabular.test.ts src/shared/data-input/useTabularInput.ts src/shared/data-input/useTabularInput.test.ts src/shared/data-input/xlsxReader.ts src/shared/data-input/xlsxReader.test.ts src/routes/estatistica/TabularInputPanel.tsx src/routes/estatistica/TabularInputPanel.test.tsx src/routes/estatistica/ColumnPreviewTable.tsx src/routes/estatistica/ColumnPreviewTable.test.tsx
git commit -m "fix(import): surface safe recovery guidance"
```

### Task 9: Validação golden dos dez motores

**Files:**
- Create: `src/test/fixtures/jasp/README.md`
- Create: `src/test/fixtures/jasp/t-student-exemplo.golden.json`
- Create: `src/test/fixtures/jasp/correlacao-exemplo.golden.json`
- Create: `src/test/fixtures/jasp/prais-exemplo.golden.json`
- Modify: `src/test/fixtures/jasp/anova-tukey-exemplo.golden.json`
- Modify: `src/test/fixtures/jasp/binomial-negativa-exemplo.golden.json`
- Modify: `src/test/fixtures/jasp/kruskal-dunn-exemplo.golden.json`
- Modify: `src/test/fixtures/jasp/logistica-exemplo.golden.json`
- Modify: `src/test/fixtures/jasp/mann-whitney-exemplo.golden.json`
- Modify: `src/test/fixtures/jasp/poisson-exemplo.golden.json`
- Modify: `src/test/fixtures/jasp/qui-quadrado-exemplo.golden.json`
- Modify: `src/features/tests/t-student/tStudentEngine.test.ts`
- Modify: `src/features/tests/anova-tukey/anovaEngine.test.ts`
- Modify: `src/features/tests/mann-whitney/mannWhitneyEngine.test.ts`
- Modify: `src/features/tests/kruskal-dunn/kruskalEngine.test.ts`
- Modify: `src/features/tests/correlacao/correlacaoEngine.test.ts`
- Modify: `src/features/tests/qui-quadrado/quiQuadradoEngine.test.ts`
- Modify: `src/features/tests/poisson/poissonEngine.test.ts`
- Modify: `src/features/tests/binomial-negativa/binomialNegativaEngine.test.ts`
- Modify: `src/features/tests/logistica/logisticaEngine.test.ts`
- Modify: `src/features/tests/prais-winsten/praisEngine.test.ts`
- Modify: `scripts/oracle/generate-phase3-fixtures.R`

**Interfaces:**
- Consumes: exports existentes `runAnalysis`, `runCorrelation`, `runMannWhitney`, `runIndependentWelch`, `runPairedT` e `runPraisWinsten`; não altera assinatura de motor.
- Produces este contrato JSON em cada golden:

```ts
interface GoldenFixture {
  sourceSoftware: 'R' | 'JASP' | 'derivacao-manual-revisada';
  sourceVersion: string;
  generationCommand: string;
  inputFixture: string;
  tolerances: { absolute: number; relative: number; displayed: string };
  input: unknown;
  expected: Record<string, unknown>;
}
```

- [ ] **Step 1: Registrar baseline e inventariar cobertura atual**

Execute o protocolo global. Rode:

```bash
rg -n "golden parity|differential parity" \
  src/features/tests/t-student/tStudentEngine.test.ts \
  src/features/tests/anova-tukey/anovaEngine.test.ts \
  src/features/tests/mann-whitney/mannWhitneyEngine.test.ts \
  src/features/tests/kruskal-dunn/kruskalEngine.test.ts \
  src/features/tests/correlacao/correlacaoEngine.test.ts \
  src/features/tests/qui-quadrado/quiQuadradoEngine.test.ts \
  src/features/tests/poisson/poissonEngine.test.ts \
  src/features/tests/binomial-negativa/binomialNegativaEngine.test.ts \
  src/features/tests/logistica/logisticaEngine.test.ts \
  src/features/tests/prais-winsten/praisEngine.test.ts
```

Registre quais dos dez motores ainda dependem apenas do oracle legado interno.

- [ ] **Step 2: Escrever testes RED para proveniência e tolerância**

Cada teste lê seu golden e exige `sourceSoftware`, `sourceVersion`, `generationCommand`, `tolerances.absolute` e `tolerances.relative`. Use o helper local, repetido em cada arquivo para manter o teste autocontido:

```ts
function expectNumericClose(actual: number, expected: number, absolute: number, relative: number) {
  const allowed = Math.max(absolute, Math.abs(expected) * relative);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(allowed);
}
```

Para p-valores, estatísticas, intervalos e efeitos use `absolute: 1e-10`, `relative: 1e-8`; para coeficientes iterativos GLM/Prais use `absolute: 1e-8`, `relative: 1e-6`. A comparação formatada continua existindo, mas não substitui a comparação interna.

- [ ] **Step 3: Executar e confirmar RED**

Run:

```bash
npm exec vitest run -- \
  src/features/tests/t-student/tStudentEngine.test.ts \
  src/features/tests/anova-tukey/anovaEngine.test.ts \
  src/features/tests/mann-whitney/mannWhitneyEngine.test.ts \
  src/features/tests/kruskal-dunn/kruskalEngine.test.ts \
  src/features/tests/correlacao/correlacaoEngine.test.ts \
  src/features/tests/qui-quadrado/quiQuadradoEngine.test.ts \
  src/features/tests/poisson/poissonEngine.test.ts \
  src/features/tests/binomial-negativa/binomialNegativaEngine.test.ts \
  src/features/tests/logistica/logisticaEngine.test.ts \
  src/features/tests/prais-winsten/praisEngine.test.ts
```

Expected: FAIL nos três golden ausentes e nos sete metadados/tolerâncias ainda incompletos.

- [ ] **Step 4: Gerar e revisar referências fora dos motores**

Estenda `scripts/oracle/generate-phase3-fixtures.R` para produzir todos os campos calculáveis em R; registre no README a versão de R/pacotes ou JASP, comando exato e campos derivados manualmente. Não execute esse gerador em CI. Versione os resultados para teste sem rede.

Os dez testes devem cobrir, no mínimo:

- t de Student: `t`, `df`, `p`, diferença, IC e tamanho de efeito;
- ANOVA/Tukey: `F`, graus de liberdade, `p`, `eta2`, contraste, IC e `pAdj`;
- Mann–Whitney: `U`, `p`, superioridade e bisserial de postos, com ties;
- Kruskal/Dunn: `H`, graus de liberdade, `p`, contraste e `pAdj`;
- correlação: Pearson/Spearman, `n`, coeficiente, `p` e IC quando exposto;
- qui-quadrado: `chi2`, graus de liberdade, `p`, Cramér V e células esperadas;
- Poisson: betas, `p`, IRR, Pearson, graus de liberdade e offset;
- binomial negativa: betas, `theta`, `p`, IRR, Pearson e convergência;
- logística: betas, `p`, OR, IC e convergência;
- Prais–Winsten: beta, rho, `p`, APC/IC ou escala original, fitted e resíduos.

- [ ] **Step 5: Verificar os dez golden**

Run the same exact-path Vitest command from Step 3.

Expected: PASS com tolerâncias internas explícitas e origem externa versionada para todos os dez motores.

- [ ] **Step 6: Commit da validação estatística**

```bash
git add \
  src/test/fixtures/jasp/README.md \
  src/test/fixtures/jasp/t-student-exemplo.golden.json \
  src/test/fixtures/jasp/correlacao-exemplo.golden.json \
  src/test/fixtures/jasp/prais-exemplo.golden.json \
  src/test/fixtures/jasp/anova-tukey-exemplo.golden.json \
  src/test/fixtures/jasp/binomial-negativa-exemplo.golden.json \
  src/test/fixtures/jasp/kruskal-dunn-exemplo.golden.json \
  src/test/fixtures/jasp/logistica-exemplo.golden.json \
  src/test/fixtures/jasp/mann-whitney-exemplo.golden.json \
  src/test/fixtures/jasp/poisson-exemplo.golden.json \
  src/test/fixtures/jasp/qui-quadrado-exemplo.golden.json \
  scripts/oracle/generate-phase3-fixtures.R
git add -p -- \
  src/features/tests/t-student/tStudentEngine.test.ts \
  src/features/tests/anova-tukey/anovaEngine.test.ts \
  src/features/tests/mann-whitney/mannWhitneyEngine.test.ts \
  src/features/tests/kruskal-dunn/kruskalEngine.test.ts \
  src/features/tests/correlacao/correlacaoEngine.test.ts \
  src/features/tests/qui-quadrado/quiQuadradoEngine.test.ts \
  src/features/tests/poisson/poissonEngine.test.ts \
  src/features/tests/binomial-negativa/binomialNegativaEngine.test.ts \
  src/features/tests/logistica/logisticaEngine.test.ts \
  src/features/tests/prais-winsten/praisEngine.test.ts
git commit -m "test(stats): validate all engines against golden data"
```

### Task 10: Acessibilidade, responsividade e movimento reduzido

**Files:**
- Modify: `src/app/AppShell.tsx`
- Modify: `src/app/Header.tsx`
- Modify: `src/routes/estatistica/Sidebar.tsx`
- Modify: `src/routes/estatistica/Sidebar.test.tsx`
- Modify: `src/routes/estatistica/ColumnPreviewTable.tsx`
- Modify: `src/routes/estatistica/ColumnPreviewTable.test.tsx`
- Modify: `src/features/tests/shared/AlphaSelector.tsx`
- Modify: `src/components/ui/wheelPicker/WheelPicker.tsx`
- Modify: `src/components/ui/wheelPicker/wheel-picker.css`
- Modify: `src/app/theme.css`
- Modify: `src/index.css`
- Modify: `src/app/theme.contract.test.ts`

**Interfaces:**
- Consumes: semântica `listbox/option` do wheel, estado ativo do router e `prefers-reduced-motion`.
- Produces: landmarks únicos, skip link para `#main-content`, foco de rota, touch targets e layout sem overflow.

- [ ] **Step 1: Registrar baseline e escrever testes RED de semântica**

```tsx
it('exposes alpha as an operable listbox with active option', async () => {
  render(<AlphaSelector value={parseAlpha(0.05)} onChange={vi.fn()} />);
  const listbox = screen.getByRole('listbox', { name: 'Nível de significância (α)' });
  expect(listbox).toHaveAttribute('aria-activedescendant');
  expect(screen.getByRole('option', { name: '5%' })).toHaveAttribute('aria-selected', 'true');
  await user.keyboard('{ArrowUp}{Enter}');
});

it('provides one main landmark and a skip link', () => {
  renderAt('/');
  expect(screen.getAllByRole('main')).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute('href', '#main-content');
});
```

Acrescente testes de `aria-disabled`, live regions, foco visível e ausência de informação exclusiva por classe de cor.

- [ ] **Step 2: Executar e confirmar RED**

Run: `npm exec vitest run -- src/app/Header.test.tsx src/routes/estatistica/Sidebar.test.tsx src/routes/estatistica/ColumnPreviewTable.test.tsx src/features/tests/shared/AlphaSelector.test.tsx src/app/theme.contract.test.ts`

Expected: FAIL onde tamanho, semântica, foco ou movimento reduzido ainda não cumprem o contrato.

- [ ] **Step 3: Implementar semântica e foco**

`AppShell` renderiza skip link e `<main id="main-content" tabIndex={-1}>`. O header marca `aria-current="page"` via `NavLink`. `WheelPicker` mantém foco no listbox, identifica cada option por id estável, aceita setas/Home/End/Enter e anuncia percentual. Controles travados permanecem descobríveis e usam `aria-disabled="true"`; o botão de desbloqueio continua operável.

- [ ] **Step 4: Aplicar dimensões e contenção responsiva**

No CSS, estabeleça `min-inline-size/min-block-size: 24px` para controles e `44px` para importar, confirmar, executar, copiar, exportar e limpar. `html`, `body`, `#root`, shell e main usam `max-inline-size: 100%`; apenas wrappers de tabela/gráfico usam `overflow-x: auto`. A sidebar em `<768px` vira painel/toggle tocável e não reduz o main abaixo do viewport.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Verificar os contratos unitários**

Run: `npm exec vitest run -- src/app/Header.test.tsx src/routes/estatistica/Sidebar.test.tsx src/routes/estatistica/ColumnPreviewTable.test.tsx src/features/tests/shared/AlphaSelector.test.tsx src/app/theme.contract.test.ts`

Expected: PASS. A prova visual/real dos quatro viewports, zoom e touch ocorre na Task 15.

- [ ] **Step 6: Commit de acessibilidade responsiva**

```bash
git add -p -- src/app/AppShell.tsx src/app/Header.tsx src/routes/estatistica/Sidebar.tsx src/routes/estatistica/Sidebar.test.tsx src/routes/estatistica/ColumnPreviewTable.tsx src/routes/estatistica/ColumnPreviewTable.test.tsx src/features/tests/shared/AlphaSelector.tsx src/components/ui/wheelPicker/WheelPicker.tsx src/components/ui/wheelPicker/wheel-picker.css src/app/theme.css src/index.css src/app/theme.contract.test.ts
git commit -m "fix(ui): meet accessible responsive contracts"
```

---

## Fase 5 — Adaptadores e validação dos builds

### Task 11: Metadados determinísticos e build Pages com entradas estáticas

**Files:**
- Create: `scripts/release/release-metadata.mjs`
- Create: `scripts/release/release-metadata.test.mjs`
- Create: `scripts/release/create-pages-entrypoints.mjs`
- Create: `scripts/release/create-pages-entrypoints.test.mjs`
- Create: `src/release/ReleaseMetadata.tsx`
- Create: `src/release/ReleaseMetadata.test.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/app/LogoLockup.tsx`
- Modify: `src/app/viteConfig.test.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `vite.config.ts`
- Modify: `tsconfig.node.json`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `release/release-manifest.json`, `package.json`, `GITHUB_SHA`/Git local e `SOURCE_DATE_EPOCH`/timestamp do commit.
- Produces:

```js
/** @typedef {{ version: string, commit: string, builtAt: string }} ReleaseMetadata */
/** @typedef {{ env: Record<string, string | undefined>, cwd: string }} ReleaseMetadataOptions */
/** @typedef {{ pagesBasePath: string, routes: Array<{ path: string, documentTitle: string }> }} PagesManifest */
/**
 * @param {ReleaseMetadataOptions} options
 * @returns {ReleaseMetadata}
 */
export function resolveReleaseMetadata({ env, cwd }) {
}

/**
 * @param {{ distDir: string, manifest: PagesManifest }} options
 * @returns {Promise<string[]>}
 */
export async function createPagesEntrypoints({ distDir, manifest }) {
}
```

```ts
import type { ReactElement } from 'react';

export interface ReleaseMetadataValue {
  version: string;
  commit: string;
  builtAt: string;
}

export interface ReleaseMetadataProps {
  metadata?: ReleaseMetadataValue;
}

declare const __LACIR_RELEASE__: Readonly<ReleaseMetadataValue>;
export function ReleaseMetadata(props: ReleaseMetadataProps): ReactElement;
```

- [ ] **Step 1: Registrar baseline e proteger arquivos de configuração já alterados**

Execute o protocolo global. `package.json` e `package-lock.json` já possuem alterações locais; esta tarefa não adiciona dependência, portanto altere somente scripts em `package.json` e use `git add -p`.

- [ ] **Step 2: Escrever testes RED de metadados**

```js
it('uses the same explicit SHA and commit timestamp in every build', () => {
  const metadata = resolveReleaseMetadata({
    cwd: fixtureRepo,
    env: { GITHUB_SHA: 'a'.repeat(40), SOURCE_DATE_EPOCH: '1788300000', npm_package_version: '1.0.0' },
  });
  assert.deepEqual(metadata, {
    version: '1.0.0',
    commit: 'a'.repeat(40),
    builtAt: new Date(1_788_300_000_000).toISOString(),
  });
});
```

```tsx
it('renders support metadata and stable smoke attributes', () => {
  render(<ReleaseMetadata metadata={{ version: '1.0.0', commit: 'abc1234', builtAt: '2026-09-03T00:00:00.000Z' }} />);
  expect(screen.getByText(/versão 1.0.0.*abc1234/i)).toBeInTheDocument();
  expect(document.querySelector('[data-release-sha="abc1234"]')).not.toBeNull();
});
```

- [ ] **Step 3: Escrever teste RED das quatro entradas Pages**

```js
it('creates direct-load entries and a generic 404 fallback', async () => {
  const created = await createPagesEntrypoints({ distDir, manifest });
  assert.deepEqual(created.sort(), [
    '404.html', 'index.html', 'mapas/index.html', 'meta-analise/index.html', 'variaveis/index.html',
  ]);
  for (const relative of created) {
    const html = await readFile(join(distDir, relative), 'utf8');
    assert.match(html, /\/lacirpesquisa\/assets\//);
    assert.match(html, /data-release-sha=/);
  }
});
```

- [ ] **Step 4: Executar e confirmar RED**

Run: `node --test scripts/release/release-metadata.test.mjs scripts/release/create-pages-entrypoints.test.mjs && npm exec vitest run -- src/release/ReleaseMetadata.test.tsx`

Expected: FAIL porque scripts e componente ainda não existem.

- [ ] **Step 5: Implementar metadados determinísticos**

`resolveReleaseMetadata` aceita env injetável, valida SHA hexadecimal de 40 caracteres e timestamp inteiro; sem env usa `git rev-parse HEAD` e `git show -s --format=%ct HEAD`. Não usa relógio da máquina. `vite.config.ts` injeta o objeto com `define` e usa `base: '/lacirpesquisa/'` no mode `pages`.

`ReleaseMetadata` aparece no rodapé do shell com SHA curto legível, mas mantém SHA completo em `data-release-sha` e `data-release-version`. Um plugin `release-metadata-html` usa `transformIndexHtml` para injetar `<meta name="lacir-release-sha" content="<SHA>" data-release-sha="<SHA>">` no HTML antes das cópias de rota; por isso o teste estrutural da Step 3 encontra o SHA no arquivo estático sem executar React.

- [ ] **Step 6: Gerar entradas estáticas sem duplicar assets**

Nos modes `pages` e `offline`, configure `publicDir: false` para impedir que `public/data/catalog` seja copiado. Um plugin Vite local chamado `release-public-assets` é habilitado somente no mode `pages` e copia exclusivamente `public/logo-lacir.png` para o diretório de saída; no mode `development`, mantenha `publicDir: 'public'`. No mode `offline`, `vite.config.ts` lê esses mesmos bytes e define `__LACIR_LOGO_URL__` como `data:image/png;base64,...`; nos outros modes define a URL sob `BASE_URL`. `LogoLockup.tsx` usa exclusivamente essa constante. `src/vite-env.d.ts` declara a constante, e `src/app/viteConfig.test.ts` invoca a config com os três modes para provar whitelist, URL Pages e data URL offline.

```ts
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

function pagesPublicAssetsPlugin(outDir: string): Plugin {
  return {
    name: 'release-public-assets',
    closeBundle() {
      mkdirSync(resolve(outDir), { recursive: true });
      copyFileSync(resolve('public/logo-lacir.png'), resolve(outDir, 'logo-lacir.png'));
    },
  };
}
```

`createPagesEntrypoints` lê `dist/index.html`, injeta `documentTitle` correspondente e grava cópias em `meta-analise/index.html`, `variaveis/index.html`, `mapas/index.html` e `404.html`. Nenhuma cópia muda URLs de asset nem cria JS adicional.

Adicionar scripts:

```json
{
  "scripts": {
    "build:pages": "tsc -b && vite build --mode pages && node scripts/release/create-pages-entrypoints.mjs dist",
    "test:release-scripts": "node --test scripts/release/*.test.mjs"
  }
}
```

Ignore `dist-pages/`, `dist-offline-staging/`, `dist-offline/` e `playwright-report/`; não ignore checksums ou relatórios versionados dentro de `docs/qa`.

- [ ] **Step 7: Verificar scripts e build Pages**

Run: `node --test scripts/release/release-metadata.test.mjs scripts/release/create-pages-entrypoints.test.mjs && npm exec vitest run -- src/release/ReleaseMetadata.test.tsx src/app/viteConfig.test.ts && npm run build:pages`

Expected: PASS; `dist/index.html` e os quatro fallbacks contêm o mesmo SHA, e todos os assets usam `/lacirpesquisa/`.

- [ ] **Step 8: Commit do adaptador Pages**

```bash
git add scripts/release/release-metadata.mjs scripts/release/release-metadata.test.mjs scripts/release/create-pages-entrypoints.mjs scripts/release/create-pages-entrypoints.test.mjs src/release/ReleaseMetadata.tsx src/release/ReleaseMetadata.test.tsx
git add -p -- src/app/AppShell.tsx src/app/LogoLockup.tsx src/app/viteConfig.test.ts src/vite-env.d.ts vite.config.ts tsconfig.node.json package.json .gitignore
git commit -m "feat(release): build deterministic Pages entries"
```

### Task 12: Inliner offline, CSP e arquivo isolado

**Files:**
- Create: `scripts/release/inline-offline.mjs`
- Create: `scripts/release/inline-offline.test.mjs`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: `src/app/router.test.tsx`

**Interfaces:**
- Consumes: staging Vite com exatamente um JS, no máximo um CSS, favicon local, `public/logo-lacir.png` e `RELEASE_MANIFEST.offlineFilename`.
- Produces:

```js
export const OFFLINE_CSP = "default-src 'none'; base-uri 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; img-src data: blob:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'";

/** @typedef {{ offlineFilename: string, offlineBudgetBytes: number }} OfflineManifest */
/**
 * @param {{ stagingDir: string, outputDir: string, logoPath: string, manifest: OfflineManifest }} options
 * @returns {Promise<{ outputPath: string, bytes: number, sha: string }>}
 */
export async function inlineOfflineBuild({ stagingDir, outputDir, logoPath, manifest }) {}
```

- [ ] **Step 1: Registrar baseline e escrever teste RED do arquivo único**

```js
it('inlines every runtime resource and injects the locked CSP', async () => {
  const report = await inlineOfflineBuild({ stagingDir, outputDir, logoPath, manifest });
  assert.equal(basename(report.outputPath), 'bioestatistica-lacir-offline.html');
  assert.deepEqual(await readdir(outputDir), ['bioestatistica-lacir-offline.html']);
  const html = await readFile(report.outputPath, 'utf8');
  assert.match(html, new RegExp(escapeRegExp(OFFLINE_CSP)));
  assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)=["'](?!data:|blob:|#)/i);
  assert.doesNotMatch(html, /sourceMappingURL/);
});
```

- [ ] **Step 2: Executar e confirmar RED**

Run: `node --test scripts/release/inline-offline.test.mjs`

Expected: FAIL porque o inliner ainda não existe.

- [ ] **Step 3: Configurar Vite para um único chunk previsível**

No mode `offline`, use `base: './'`, `cssCodeSplit: false`, `sourcemap: false`, `assetsInlineLimit: Number.MAX_SAFE_INTEGER` e `rollupOptions.output.inlineDynamicImports: true`. O router já escolhe Hash Router pela Task 4. O staging vai para `dist-offline-staging`; o output final, para `dist-offline`.

```ts
build: mode === 'offline' ? {
  outDir: 'dist-offline-staging',
  cssCodeSplit: false,
  sourcemap: false,
  assetsInlineLimit: Number.MAX_SAFE_INTEGER,
  rollupOptions: { output: { inlineDynamicImports: true } },
} : pagesBuild,
```

- [ ] **Step 4: Implementar inlining fechado**

O script exige exatamente um `<script type="module" src>`, no máximo um stylesheet e favicon local/data. Lê bytes, substitui tags por `<script type="module">...</script>` e `<style>...</style>`, valida que o favicon local termina em `logo-lacir.png`, lê somente `logoPath` e o converte para `data:image/png;base64`. Também exige que o JS já contenha a data URL `__LACIR_LOGO_URL__` gerada na Task 11 e rejeita qualquer referência residual a `logo-lacir.png`. Injeta CSP como primeira policy do `<head>`, remove `crossorigin`, apaga qualquer `sourceMappingURL` e grava somente o filename do manifesto. Se a forma esperada não coincidir, lança erro; não tenta adivinhar tags adicionais.

- [ ] **Step 5: Adicionar build offline reproduzível**

```json
{
  "scripts": {
    "build:offline": "tsc -b && vite build --mode offline && node scripts/release/inline-offline.mjs dist-offline-staging dist-offline release/release-manifest.json public/logo-lacir.png"
  }
}
```

- [ ] **Step 6: Verificar inliner, hash router e build**

Run: `node --test scripts/release/inline-offline.test.mjs && npm exec vitest run -- src/app/router.test.tsx && npm run build:offline`

Expected: PASS; `find dist-offline -type f` retorna somente `dist-offline/bioestatistica-lacir-offline.html`, e o arquivo abre sem imports/chunks vizinhos.

- [ ] **Step 7: Commit do build offline**

```bash
git add scripts/release/inline-offline.mjs scripts/release/inline-offline.test.mjs
git add -p -- vite.config.ts package.json src/app/router.test.tsx
git commit -m "feat(release): build standalone offline HTML"
```

### Task 13: Validadores estruturais, orçamentos e checksum

**Files:**
- Create: `scripts/release/validate-pages.mjs`
- Create: `scripts/release/validate-pages.test.mjs`
- Create: `scripts/release/validate-offline.mjs`
- Create: `scripts/release/validate-offline.test.mjs`
- Create: `scripts/release/write-checksum.mjs`
- Create: `scripts/release/write-checksum.test.mjs`
- Modify: `scripts/release/audit-release.mjs`
- Modify: `scripts/release/audit-release.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `dist`, `dist-offline`, manifesto e metadados embutidos.
- Produces:

```js
/** @typedef {{ pagesBasePath: string, pagesBudgetBytes: number, offlineBudgetBytes: number, offlineFilename: string, routes: Array<{ path: string }> }} ValidationManifest */
/**
 * @param {string} directory
 * @param {ValidationManifest} manifest
 * @returns {Promise<{ transferredBytes: number, routes: string[], sha: string }>}
 */
export async function validatePagesBuild(directory, manifest) {}

/**
 * @param {string} file
 * @param {ValidationManifest} manifest
 * @returns {Promise<{ bytes: number, sha: string, requests: string[], csp: string }>}
 */
export async function validateOfflineBuild(file, manifest) {}

/**
 * @param {string} file
 * @param {string} outputFile
 * @returns {Promise<string>} lowercase hexadecimal
 */
export async function writeSha256(file, outputFile) {}
```

- [ ] **Step 1: Registrar baseline e escrever fixtures RED de violação**

```js
it('rejects Pages above 1.5 MiB and offline above 2,621,440 bytes', async () => {
  await assert.rejects(() => validatePagesBuild(oversizedPages, manifest), /1\.572\.864 bytes/);
  await assert.rejects(() => validateOfflineBuild(oversizedHtml, manifest), /2\.621\.440 bytes/);
});

it('rejects neighbor files, remote URLs and connect-capable CSP', async () => {
  await assert.rejects(() => validateOfflineBuild(unsafeHtml, manifest), /arquivo vizinho|connect-src|URL remota/);
});

it('writes a verifiable SHA-256 line', async () => {
  const digest = await writeSha256(htmlFile, checksumFile);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(await readFile(checksumFile, 'utf8'), `${digest}  bioestatistica-lacir-offline.html\n`);
});
```

- [ ] **Step 2: Executar e confirmar RED**

Run: `node --test scripts/release/validate-pages.test.mjs scripts/release/validate-offline.test.mjs scripts/release/write-checksum.test.mjs scripts/release/audit-release.test.mjs`

Expected: FAIL pela ausência dos validadores/checksum.

- [ ] **Step 3: Implementar validação Pages**

Exigir cinco HTML (`index`, três rotas, `404`), todos com base `/lacirpesquisa/`, mesmo SHA e assets existentes. Somar bytes de HTML/CSS/JS/fontes/imagens necessários à raiz uma vez por URL; falhar acima de `1_572_864`. Rejeitar arquivo em `public/data/catalog`, endpoint, source map, import perdido ou asset fora do base.

- [ ] **Step 4: Implementar validação offline**

Exigir um único arquivo regular, doctype, charset, viewport, root, script/style inline, hash navigation, SHA completo e CSP com `connect-src 'none'`, `frame-src 'none'`, `object-src 'none'`. Inspecionar `src`, `href`, CSS `url()`, `@import`, `fetch`, XHR, WebSocket, EventSource, `import()` de URL e `sourceMappingURL`. Falhar acima de `2_621_440` bytes.

- [ ] **Step 5: Ligar scripts de release**

```json
{
  "scripts": {
    "validate:pages": "node scripts/release/validate-pages.mjs dist && node scripts/release/audit-release.mjs dist",
    "validate:offline": "node scripts/release/validate-offline.mjs dist-offline/bioestatistica-lacir-offline.html && node scripts/release/audit-release.mjs dist-offline",
    "checksum:offline": "node scripts/release/write-checksum.mjs dist-offline/bioestatistica-lacir-offline.html dist-offline/bioestatistica-lacir-offline.html.sha256",
    "build:release": "npm run build:pages && npm run validate:pages && npm run build:offline && npm run validate:offline && npm run checksum:offline"
  }
}
```

O checksum é criado depois do teste de arquivo único; o diretório de artefato do workflow pode conter HTML e `.sha256`, mas o teste de isolamento copia somente o HTML.

- [ ] **Step 6: Verificar scripts e artefatos reais**

Run: `npm run test:release-scripts && npm run build:release`

Expected: código `0`; Pages ≤ `1.572.864` bytes, offline ≤ `2.621.440` bytes, mesmo SHA, zero marcador proibido e checksum de 64 hex.

- [ ] **Step 7: Commit dos gates estruturais**

```bash
git add scripts/release/validate-pages.mjs scripts/release/validate-pages.test.mjs scripts/release/validate-offline.mjs scripts/release/validate-offline.test.mjs scripts/release/write-checksum.mjs scripts/release/write-checksum.test.mjs
git add -p -- scripts/release/audit-release.mjs scripts/release/audit-release.test.mjs package.json
git commit -m "test(release): enforce artifact budgets and isolation"
```

---

## Fase 6 — Navegadores reais, workflow protegido e operação

### Task 14: Harness Playwright e fluxos reais dos dez testes

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `playwright.config.ts`
- Create: `e2e/fixtures/statisticsFlows.ts`
- Create: `src/test/fixtures/tests/mann-whitney-exemplo.txt`
- Create: `e2e/pages-navigation.spec.ts`
- Create: `e2e/statistics-flows.spec.ts`
- Create: `e2e/persistence-errors.spec.ts`

**Interfaces:**
- Consumes: build Pages local; `src/test/fixtures/tests/t-student-exemplo.txt`, `src/test/fixtures/tests/anova-tukey-exemplo.txt`, `src/test/fixtures/tests/mann-whitney-exemplo.txt`, `src/test/fixtures/tests/kruskal-dunn-exemplo.txt`, `src/test/fixtures/tests/correlacao-exemplo.txt`, `src/test/fixtures/tests/qui-quadrado-exemplo.txt`, `src/test/fixtures/tests/poisson-exemplo.txt`, `src/test/fixtures/tests/binomial-negativa-exemplo.txt`, `src/test/fixtures/tests/logistica-exemplo.txt` e `src/test/fixtures/tests/prais-exemplo.txt`; ids de `TEST_REGISTRY`; metadados de release.
- Produces:

```ts
import type { Page } from '@playwright/test';
import type { TestId } from '../../src/features/tests/registry';

export interface StatisticsFlowCase {
  testId: TestId;
  sidebarName: RegExp;
  fixturePath: string;
  resultHeading: RegExp;
  primaryMetricLabel: RegExp;
  expectedDisplay: RegExp;
}

export const STATISTICS_FLOW_CASES: readonly StatisticsFlowCase[];
export async function openStatisticsFlow(page: Page, flow: StatisticsFlowCase): Promise<void>;
export async function runLoadedExample(page: Page, flow: StatisticsFlowCase): Promise<void>;
```

- [ ] **Step 1: Registrar baseline e instalar dependência por lockfile**

Depois de preservar diffs de `package.json`/`package-lock.json`, execute `npm install --save-dev @playwright/test`. Não use `--force` nem atualize outras dependências. Inspecione o diff do lockfile e confirme que somente Playwright e suas dependências transitivas foram adicionados. Crie `src/test/fixtures/tests/mann-whitney-exemplo.txt` com o mesmo input versionado no golden Mann–Whitney da Task 9; o E2E não inventa uma segunda amostra.

- [ ] **Step 2: Escrever E2E RED de rotas e dez fluxos**

```ts
for (const flow of STATISTICS_FLOW_CASES) {
  test(`${flow.testId} completes with its supported example`, async ({ page }) => {
    await openStatisticsFlow(page, flow);
    await runLoadedExample(page, flow);
    await expect(page.getByRole('heading', { name: flow.resultHeading })).toBeVisible();
    await expect(page.getByText(flow.primaryMetricLabel)).toBeVisible();
    await expect(page.getByText(flow.expectedDisplay)).toBeVisible();
  });
}
```

`pages-navigation.spec.ts` abre raiz, URLs diretas e recarrega as três rotas fechadas. `persistence-errors.spec.ts` persiste alpha `0.1`, recarrega e confirma `10%`; em outro contexto bloqueia IndexedDB e exige aviso de modo temporário sem perder a tabela.

- [ ] **Step 3: Configurar três motores e executar RED**

Run: `npm run build:pages && npm exec playwright test e2e/pages-navigation.spec.ts e2e/statistics-flows.spec.ts e2e/persistence-errors.spec.ts --project=chromium`

Expected: FAIL nos seletores/fluxos ainda não cobertos pelo harness; não afrouxe assertions para obter verde.

- [ ] **Step 4: Implementar page helpers determinísticos**

Os helpers usam roles/labels, `setInputFiles` e botões reais; não chamam stores, motores ou setters React. Cada caso declara fixture e métrica esperada. Falha de console `error`, page error ou request fora da origem local falha o teste.

```ts
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:4173/lacirpesquisa/', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/lacirpesquisa/',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

Adicionar scripts:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:pages": "playwright test e2e/pages-navigation.spec.ts e2e/statistics-flows.spec.ts e2e/persistence-errors.spec.ts"
  }
}
```

- [ ] **Step 5: Verificar nos três motores**

Run: `npm run build:pages && npm run test:e2e:pages`

Expected: PASS em Chromium, Firefox e WebKit para quatro rotas, dez exemplos, alpha, persistência e fallback em memória; console sem erro inesperado.

- [ ] **Step 6: Commit do E2E funcional**

```bash
git add playwright.config.ts e2e/fixtures/statisticsFlows.ts src/test/fixtures/tests/mann-whitney-exemplo.txt e2e/pages-navigation.spec.ts e2e/statistics-flows.spec.ts e2e/persistence-errors.spec.ts
git add -p -- package.json package-lock.json
git commit -m "test(e2e): cover release routes and statistics flows"
```

### Task 15: E2E de acessibilidade, responsividade e offline sem rede

**Files:**
- Create: `e2e/accessibility-responsive.spec.ts`
- Create: `e2e/offline.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `STATISTICS_FLOW_CASES`, build Pages e HTML offline isolado.
- Produces: varredura axe, matriz de viewport, interceptação de rede e paridade de resultados.

- [ ] **Step 1: Registrar baseline e adicionar axe de forma reprodutível**

Execute `npm install --save-dev @axe-core/playwright` após registrar os diffs do package/lockfile. Confirme que nenhuma dependência de runtime foi adicionada.

- [ ] **Step 2: Escrever testes RED de acessibilidade e viewport**

```ts
for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test(`no page overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('has no serious or critical axe violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
});
```

Acrescente teclado completo, foco visível, zoom `200%`, emulação touch, reduced motion e medição DOM de alvos `24x24`/essenciais `44x44`.

Inspecione também todos os links externos renderizados: cada `a[target="_blank"]` deve usar protocolo `https:`, rótulo acessível que indique destino externo e `rel` contendo `noopener` e `noreferrer`. Importe uma célula `<img src=x onerror=alert(1)>` e uma fórmula `=SUM(A1:A2)`; ambas devem aparecer como texto, sem elemento injetado nem execução.

- [ ] **Step 3: Escrever teste RED offline decisivo**

Copie somente o HTML para um diretório temporário chamado `Capacitação LACIR área 1`, abra sua URL `file:`, conte toda tentativa de request e aborte-a:

```ts
const requests: string[] = [];
await context.route('**/*', async (route) => {
  const url = route.request().url();
  if (!url.startsWith('file:') && !url.startsWith('data:') && !url.startsWith('blob:')) {
    requests.push(url);
    await route.abort('internetdisconnected');
    return;
  }
  await route.continue();
});
expect(requests).toEqual([]);
```

Percorra hash das quatro rotas, importe CSV/TXT/TSV e XLSX, execute os dez exemplos e compare cada texto de métrica com o mesmo `expectedDisplay` de `STATISTICS_FLOW_CASES` que o spec Pages exige. Assim a paridade é transitiva contra a mesma referência versionada e o teste offline não depende de um servidor Pages vivo. Tente também clipboard/fallback, exporte PNG e simule IndexedDB indisponível.

Para que o job offline não dependa de `dist`, `playwright.config.ts` define `const offlineOnly = process.env.LACIR_E2E_MODE === 'offline'` e usa `webServer: offlineOnly ? undefined : pagesWebServer`. O spec offline sempre abre a URL `file:` absoluta preparada pelo próprio teste; não usa `baseURL`.

- [ ] **Step 4: Executar e confirmar RED**

Run: `npm run build:release && npm exec playwright test e2e/accessibility-responsive.spec.ts e2e/offline.spec.ts --project=chromium`

Expected: FAIL nas violações reais encontradas; cada correção volta à tarefa dona do componente e recebe teste unitário correspondente antes de atualizar o E2E.

- [ ] **Step 5: Fechar problemas sem exceção silenciosa**

Corrija CSS/semântica apenas nos arquivos listados na Task 10 e fallbacks apenas nos arquivos das Tasks 3/7/8. Não use `disableRules` no axe para violação crítica/séria; uma exceção normativa de target size deve registrar elemento e critério em `docs/qa/site-readiness/browser-matrix.md` na Task 18.

```json
{
  "scripts": {
    "test:e2e:accessibility": "playwright test e2e/accessibility-responsive.spec.ts",
    "test:e2e:offline": "LACIR_E2E_MODE=offline playwright test e2e/offline.spec.ts"
  }
}
```

- [ ] **Step 6: Verificar nos três motores**

Run: `npm run build:release && npm run test:e2e:accessibility && npm run test:e2e:offline`

Expected: PASS em Chromium, Firefox e WebKit, zero request externo, zero violação axe crítica/séria, sem overflow e com paridade dos dez resultados.

- [ ] **Step 7: Commit do E2E offline e acessível**

```bash
git add e2e/accessibility-responsive.spec.ts e2e/offline.spec.ts
git add -p -- playwright.config.ts package.json package-lock.json
git commit -m "test(e2e): verify accessible offline release"
```

### Task 16: Workflow Pages com gate interno e deploy autorizado

**Files:**
- Inspect without editing: `.github/workflows/ci.yml`
- Modify: `.github/workflows/pages.yml`
- Modify: `package.json`
- Create: `scripts/release/workflow-contract.test.mjs`
- Create: `e2e/production-smoke.spec.ts`
- Generated test output: `test-results/production-smoke.json`

**Interfaces:**
- Consumes: scripts `gate`, `build:pages`, `validate:pages`, `build:offline`, `validate:offline`, `checksum:offline` e input manual `publish`.
- Produces jobs `gate`, `build_pages`, `build_offline`, `deploy`, `production_smoke` ligados pelo mesmo SHA.

- [ ] **Step 1: Registrar baseline e escrever teste estrutural RED do workflow**

Crie um teste Node em `scripts/release/workflow-contract.test.mjs` que lê YAML como texto e exige jobs/needs/comandos exatos, sem adicionar parser:

```js
assert.match(pagesYaml, /gate:\s*[\s\S]*npm ci[\s\S]*npm run gate/);
assert.match(pagesYaml, /build_pages:\s*[\s\S]*needs:\s*gate/);
assert.match(pagesYaml, /build_offline:\s*[\s\S]*needs:\s*gate/);
assert.match(pagesYaml, /deploy:\s*[\s\S]*needs:\s*\[gate, build_pages, build_offline\]/);
assert.match(pagesYaml, /github\.event_name == 'workflow_dispatch'.*inputs\.publish == true/);
assert.doesNotMatch(pagesYaml, /VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY/);
```

- [ ] **Step 2: Executar e confirmar RED**

Run: `node --test scripts/release/workflow-contract.test.mjs`

Expected: FAIL porque `pages.yml` atual possui somente `build -> deploy`, publica em push e injeta secrets Supabase.

- [ ] **Step 3: Reestruturar o workflow existente**

Mantenha `.github/workflows/pages.yml`; não crie outro publicador. `push` em `main` executa gate/build/upload sem deploy. `workflow_dispatch` recebe boolean `publish` default `false` e `release_sha` obrigatório; checkout usa esse SHA. Todos os jobs usam Node 24, `npm ci` e actions pinadas por SHA.

Ordem:

```yaml
gate:
  # checkout SHA, setup Node/uv, npm ci, npm run gate, testes dos scripts e auditoria de dependências
build_pages:
  needs: gate
  # npm ci, build:pages, validate:pages, instala browsers Playwright, test:e2e:pages, test:e2e:accessibility, upload-pages-artifact
build_offline:
  needs: gate
  # npm ci, build:offline, validate:offline, checksum, instala browsers Playwright, test:e2e:offline, upload-artifact
deploy:
  needs: [gate, build_pages, build_offline]
  if: github.event_name == 'workflow_dispatch' && inputs.publish == true
  environment: github-pages
production_smoke:
  needs: deploy
  # confirma URL, SHA, rotas e um cálculo; falha gera incidente/rollback no runbook
```

Use `concurrency.group: pages` e `cancel-in-progress: false`. O deploy recebe somente artefato Pages completo; o offline é upload separado com SHA/checksum no nome/retention. Remova `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

- [ ] **Step 4: Implementar smoke de produção**

`e2e/production-smoke.spec.ts` exige `PRODUCTION_BASE_URL` e `EXPECTED_RELEASE_SHA`, abre raiz e três URLs diretas, confirma `data-release-sha`, captura `4xx/5xx`, rejeita requests de aplicação para API/Supabase e executa o exemplo t de Student.

O teste acumula `{ releaseSha, startedAt, finishedAt, routes, httpErrors, forbiddenRequests, calculation, status }` e, em `afterAll` protegido por `try/finally`, grava `test-results/production-smoke.json` mesmo quando uma asserção falha. O job `production_smoke` faz upload desse caminho com `if: always()`; campos de erro contêm URL/status/mensagem, nunca corpo de resposta ou dado importado.

```json
{
  "scripts": {
    "test:e2e:production": "playwright test e2e/production-smoke.spec.ts --project=chromium"
  }
}
```

- [ ] **Step 5: Verificar contrato e sintaxe local**

Run: `node --test scripts/release/workflow-contract.test.mjs && npm run typecheck`

Expected: PASS; deploy depende explicitamente dos três jobs, push não publica e nenhum secret Supabase aparece.

- [ ] **Step 6: Commit do workflow protegido**

```bash
git add scripts/release/workflow-contract.test.mjs e2e/production-smoke.spec.ts
git add -p -- .github/workflows/pages.yml package.json
git commit -m "ci(pages): gate both artifacts before authorized deploy"
```

---

## Fase 7 — Gate final, desempenho, capacidade e contingência

### Task 17: Desempenho em repouso e capacidade para 30 participantes

**Files:**
- Create: `e2e/performance.spec.ts`
- Create: `e2e/capacity.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `package.json`
- Create: `docs/qa/site-readiness/performance.md`
- Create: `docs/qa/site-readiness/capacity.md`

**Interfaces:**
- Consumes: build Pages validado e `CAPACITY_BASE_URL` apontando para a rede de ensaio.
- Produces:

```ts
import type { Page } from '@playwright/test';

export interface CapacitySample {
  client: number;
  usableMs: number;
  statuses: Array<{ url: string; status: number }>;
  transferredBytes: number;
}

export interface CapacityReport {
  clients: 30;
  p95UsableMs: number;
  httpErrorCount: number;
  samples: CapacitySample[];
}

export function percentile(values: readonly number[], fraction: number): number;
export async function sumPerformanceTransferSizes(page: Page): Promise<number>;
```

- [ ] **Step 1: Registrar baseline e escrever o teste RED de repouso**

No projeto Chromium, abra a rota Estatística, espere estabilizar e use CDP para CPU `4×`:

```ts
const session = await context.newCDPSession(page);
await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.evaluate(() => {
  (window as Window & { __lacirLongTasks?: number[] }).__lacirLongTasks = [];
  new PerformanceObserver((list) => {
    (window as Window & { __lacirLongTasks: number[] }).__lacirLongTasks.push(
      ...list.getEntries().map((entry) => entry.duration),
    );
  }).observe({ type: 'longtask', buffered: true });
});
await page.waitForTimeout(30_000);
expect(await page.evaluate(
  () => (window as Window & { __lacirLongTasks?: number[] }).__lacirLongTasks ?? [],
)).toEqual([]);
```

Conte callbacks de RAF por instrumentação instalada antes do app e exija que a contagem não cresça depois da estabilização. Alterne os dez testes duas vezes, force GC pelo CDP antes/depois e registre heap. Rode duas séries idênticas de 20 trocas; o heap retido após GC na segunda deve ser no máximo o da primeira mais `max(1 MiB, 5%)`. Se exceder, o teste falha e anexa as duas medições ao relatório.

- [ ] **Step 2: Escrever o teste RED de 30 clientes**

```ts
const samples = await Promise.all(Array.from({ length: 30 }, async (_, client) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const statuses: CapacitySample['statuses'] = [];
  page.on('response', (response) => statuses.push({ url: response.url(), status: response.status() }));
  const started = performance.now();
  await page.goto(process.env.CAPACITY_BASE_URL!, { waitUntil: 'domcontentloaded' });
  await page.locator('#lacir-test-module-mount').waitFor({ state: 'visible' });
  const usableMs = performance.now() - started;
  const transferredBytes = await sumPerformanceTransferSizes(page);
  await context.close();
  return { client, usableMs, statuses, transferredBytes };
}));

expect(samples.flatMap((sample) => sample.statuses).filter(({ status }) => status >= 400)).toEqual([]);
expect(percentile(samples.map(({ usableMs }) => usableMs), 0.95)).toBeLessThanOrEqual(10_000);
```

O helper `percentile(values, 0.95)` ordena crescentemente e usa índice `Math.ceil(values.length * 0.95) - 1`. `sumPerformanceTransferSizes` soma `PerformanceResourceTiming.transferSize` e o HTML de navegação. Uma segunda navegação no mesmo contexto confirma reuse de assets e registra `cache-control`/transferSize.

- [ ] **Step 3: Executar RED em preview controlado**

Run: `npm run build:pages && CAPACITY_BASE_URL=http://127.0.0.1:4173/lacirpesquisa/ npm exec playwright test e2e/performance.spec.ts e2e/capacity.spec.ts --project=chromium`

Expected: FAIL até instrumentação, scripts e limites estarem conectados; o preview local caracteriza o teste, não substitui o ensaio na rede da capacitação.

- [ ] **Step 4: Corrigir somente causas observadas**

Se houver RAF em repouso, identifique o componente pelo stack/trace e corrija o seu lifecycle com teste unitário na Task 5. Se bytes excederem o orçamento, use o relatório do `validate-pages` para remover dependência/asset proibido; não aumente `pagesBudgetBytes`. Se heap crescer após duas séries, remova listener/Chart/observer não desalocado e acrescente regressão no arquivo do componente.

- [ ] **Step 5: Rodar em rede equivalente ou pior e registrar ambiente**

Sirva o diretório Pages aprovado numa máquina da mesma rede, sem publicar, e rode 30 clientes de outra máquina. Exporte a URL completa como `LACIR_CAPACITY_URL` depois de registrá-la no relatório. `performance.md` registra hardware, SO/browser, CPU 4×, bytes raw/gzip/offline, trace de 30 s e memória após 20 trocas. `capacity.md` registra data, SSID/perfil de banda/latência, URL de ensaio, 30 amostras, p50/p95/máximo, 4xx/5xx, headers de cache e decisão de distribuir HTML antecipadamente.

- [ ] **Step 6: Verificar os limites objetivos**

Run: `CAPACITY_BASE_URL="$LACIR_CAPACITY_URL" npm exec playwright test e2e/performance.spec.ts e2e/capacity.spec.ts --project=chromium`

Expected: PASS com 30 clientes, `p95 ≤ 10.000 ms`, zero `4xx/5xx`, Pages ≤ `1.572.864` bytes e nenhum long task de animação `>50 ms` em 30 s.

- [ ] **Step 7: Commit das provas de desempenho/capacidade**

```bash
git add e2e/performance.spec.ts e2e/capacity.spec.ts docs/qa/site-readiness/performance.md docs/qa/site-readiness/capacity.md
git add -p -- playwright.config.ts package.json
git commit -m "test(release): prove workshop capacity budgets"
```

### Task 18: Matriz de QA, auditoria de segredos/dependências e runbook

**Files:**
- Create: `docs/qa/site-readiness/defects.md`
- Create: `docs/qa/site-readiness/browser-matrix.md`
- Create: `docs/runbooks/site-release.md`
- Modify: `README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: relatórios das Tasks 13–17, SHA/checksum e resultados do gate.
- Produces um registro com classificação `P0 | P1 | P2 | P3`, estado `aberto | aceito | corrigido`, evidência e rollback.

- [ ] **Step 1: Registrar baseline e criar estrutura de evidência sem resultados presumidos**

`defects.md` contém colunas `ID`, `Severidade`, `Fluxo`, `Reprodução`, `Estado`, `Commit da correção`, `Evidência`. `browser-matrix.md` contém navegador/versão, SO/máquina, Pages/offline, dez fluxos, teclado, leitor de tela, zoom/touch, rede bloqueada, console e resultado.

- [ ] **Step 2: Acrescentar scripts de auditoria e gate de release**

```json
{
  "scripts": {
    "audit:dependencies": "npm audit --omit=dev --audit-level=high",
    "gate:release": "npm run gate && npm run test:release-scripts && npm run build:release && npm run test:e2e:pages && npm run test:e2e:accessibility && npm run test:e2e:offline && npm run audit:dependencies"
  }
}
```

O relatório também registra `npm audit --json` completo e avalia alcançabilidade de qualquer finding de desenvolvimento. O auditor da Task 13 cobre segredos/endpoints no build. Rode os comandos abaixo, que mostram somente nomes de arquivo, e registre para cada resultado `bloqueia`, `não alcançável no release` ou `fixture pública`, com justificativa e caminho, sem copiar o valor encontrado:

```bash
git grep -Il -E 'SUPABASE_SERVICE_ROLE_KEY|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|github_pat_' -- .
git ls-files '.env*'
npm audit --json
```

- [ ] **Step 3: Escrever o runbook operacional completo**

`docs/runbooks/site-release.md` deve conter comandos e decisões exatas:

1. pré-requisitos Node 24, lockfile, browsers suportados e piso XLSX;
2. `npm ci`, `npm run gate:release` e interpretação de cada falha;
3. uso de CSV/TXT como contingência quando XLSX/DecompressionStream falhar;
4. explicação de IndexedDB, modo temporário e como copiar/exportar antes de fechar;
5. localização do HTML, cópia isolada, distribuição antecipada e `shasum -a 256 -c bioestatistica-lacir-offline.html.sha256`;
6. acionamento manual de `pages.yml` com `release_sha` e `publish=true`, seguido da aprovação do environment;
7. smoke de produção com URL/SHA esperado;
8. rollback acionando o mesmo workflow com o último SHA aprovado e repetindo smoke;
9. proibição de editar infraestrutura/artefato diretamente para corrigir falha;
10. contatos, local do relatório e classificação P0–P3.

- [ ] **Step 4: Executar o gate final da árvore**

Run: `npm ci && npm run gate:release`

Expected: código `0`; Vitest/gate/build, scripts Node, dois artefatos, auditoria, três motores Playwright, offline sem rede e dependências alcançáveis passam.

- [ ] **Step 5: Fazer inspeção humana obrigatória**

Em pelo menos duas máquinas, desligue Wi-Fi de fato, copie somente o HTML para caminho com espaços/acentos e execute rotas, XLSX/CSV, dez exemplos, copy/export e fallback de storage. Faça smoke com VoiceOver+Safari e NVDA+Firefox ou equivalentes documentados, teclado completo, touch, quatro viewports e zoom 200%. Registre versão, máquina, resultado e evidência em `browser-matrix.md`.

- [ ] **Step 6: Auditar defeitos e critérios de saída**

Exija zero `aberto` P0/P1. P2/P3 aceito deve ter justificativa, impacto, contorno, responsável e data de revisão. Confirme que Pages/offline mostram mesmo SHA, que os dez valores visíveis coincidem e que o diff final não remove nem incorpora mudança do baseline do usuário.

- [ ] **Step 7: Atualizar README e commit da operação**

O README aponta para o runbook, para o HTML nomeado e para a regra de autorização; não promete que o arquivo está publicado antes da Fase 8.

```bash
git add docs/qa/site-readiness/defects.md docs/qa/site-readiness/browser-matrix.md docs/runbooks/site-release.md
git add -p -- README.md package.json
git commit -m "docs(release): record readiness and rollback runbook"
```

- [ ] **Step 8: Verificar o commit candidato sem alterar a árvore**

Run:

```bash
LACIR_PLAN_BASELINE_SHA="$(git log -1 --format=%H -- docs/superpowers/plans/2026-09-03-site-readiness-github-pages-offline.md)"
git status --short
git log --oneline --decorate -12
git diff "$LACIR_PLAN_BASELINE_SHA"...HEAD --stat
git diff "$LACIR_PLAN_BASELINE_SHA"...HEAD --check
```

Expected: somente arquivos deliberados desta iniciativa aparecem no intervalo; todas as mudanças locais preexistentes continuam presentes fora dos commits e `diff --check` sai `0`.

---

## Fase 8 — Publicação autorizada, smoke e rollback

### Task 19: Hold point de publicação e verificação pós-deploy

**Files:**
- No source change before authorization.
- Generated workflow artifact: `production-smoke.json`
- Generated workflow artifact: `bioestatistica-lacir-offline.html`
- Generated workflow artifact: `bioestatistica-lacir-offline.html.sha256`

**Interfaces:**
- Consumes: SHA candidato aprovado, último SHA aprovado para rollback, environment `github-pages` e `PRODUCTION_BASE_URL`.
- Produces: deployment do artefato Pages, offline/checksum preservados e `production-smoke.json` com SHA/status/rotas/rede/cálculo.

- [ ] **Step 1: Parar e pedir autorização específica**

Apresente SHA candidato, resultado do `gate:release`, bytes Pages/offline, checksum, matriz de browsers, ensaio de 30 clientes, defeitos abertos e SHA de rollback. Pergunte explicitamente se o usuário autoriza publicar exatamente esse SHA. Sem resposta afirmativa, não acione workflow nem abra environment approval. Depois da autorização, exporte valores conferidos como `LACIR_RELEASE_SHA`, `LACIR_ROLLBACK_SHA` e `LACIR_PRODUCTION_URL`.

- [ ] **Step 2: Disparar somente o SHA autorizado**

Depois da autorização:

```bash
gh workflow run pages.yml --ref main -f release_sha="$LACIR_RELEASE_SHA" -f publish=true
```

O workflow valida que `release_sha` existe, está em `main` e coincide com os metadados dos dois builds. Aguarde gate/builds/environment/deploy; não reexecute somente o job de deploy com artefato parcial.

- [ ] **Step 3: Rodar smoke externo contra a URL publicada**

Run: `PRODUCTION_BASE_URL="$LACIR_PRODUCTION_URL" EXPECTED_RELEASE_SHA="$LACIR_RELEASE_SHA" npm run test:e2e:production`

Expected: PASS com raiz e três rotas diretas/reload, assets sob `/lacirpesquisa/`, zero request de API/Supabase, SHA exato e exemplo t de Student concluído. O job anexa `production-smoke.json` mesmo em falha.

- [ ] **Step 4: Verificar download offline publicado como artefato**

Baixe o artefato do mesmo workflow, confira o SHA-256, copie somente o HTML para outro diretório e execute o smoke `file:` com rede bloqueada. O SHA mostrado deve ser o candidato autorizado.

- [ ] **Step 5: Aplicar rollback em qualquer falha P0/P1 pós-deploy**

Se smoke, cálculo, rota, asset, rede ou SHA falhar, classifique o incidente e, após confirmar o SHA aprovado anterior, execute:

```bash
gh workflow run pages.yml --ref main -f release_sha="$LACIR_ROLLBACK_SHA" -f publish=true
```

Repita o smoke com `EXPECTED_RELEASE_SHA="$LACIR_ROLLBACK_SHA"`. Não edite Pages, HTML ou secrets diretamente. A correção volta ao início do plano com novo teste RED e novo SHA candidato.

- [ ] **Step 6: Encerrar o release somente com evidência**

Marque o deployment como aprovado somente quando o smoke externo, checksum offline e SHA coincidirem. Preserve logs, relatórios e artifacts do workflow pelo período configurado; comunique URL, SHA, checksum, browsers suportados, contingência offline e instrução de rollback.

---

## Matriz de cobertura da especificação

| Seção da especificação | Tarefas que a implementam/verificam |
|---|---|
| 1–3. Objetivo, escopo e invariantes | 1–5, 18–19 |
| 4–6. Arquitetura, componentes e fluxos | 1–8, 11–16 |
| 7. Alpha, persistência, deploy e repouso | 2–5, 16–17 |
| 8. Tratamento de erros | 3, 6–8, 14–15 |
| 9. Segurança, privacidade e dependências | 4–5, 8, 12–13, 16, 18 |
| 10. Concorrência e capacidade | 13, 17–19 |
| 11. Acessibilidade e responsividade | 10, 15, 18 |
| 12. Desempenho | 5, 10, 13, 17 |
| 13. GitHub Pages | 11, 13–14, 16, 18–19 |
| 14. HTML único offline | 12–15, 18–19 |
| 15. Testes e QA | 1–18 |
| 16. Preservação da árvore local | protocolo global e staging de cada tarefa |
| 17. Sequência única | fases 1–8 deste plano |
| 18. Critérios objetivos de aceite | 13–19 |
| 19. Gate de continuidade | este plano; implementação somente após nova escolha do usuário |

## Handoff de execução

Plan complete and saved to `docs/superpowers/plans/2026-09-03-site-readiness-github-pages-offline.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.

2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
