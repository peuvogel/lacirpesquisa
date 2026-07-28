# Phase 7: Baseline verde - Mapa de Padrões

**Mapeado:** 2026-07-28
**Arquivos analisados:** 32 (8 arquivos de produção/teste editados individualmente + 10 call sites de `FlowSteps` + 9 arquivos de teste a reescrever + 5 arquivos novos)
**Analogs found:** 27 / 32 (5 sem análogo — infraestrutura de gate, ver seção dedicada)

**Nota de método:** Fase 7 é majoritariamente auto-edição (o "análogo" de um arquivo de produção é o próprio arquivo, guiado pelas 18 decisões travadas em `07-CONTEXT.md` e pelos padrões verificados em `07-RESEARCH.md`). Onde existe um arquivo *irmão* real no repo — os 4 oracles de `src/test/`, `ClearDataButton.test.tsx`/`Sidebar.test.tsx`, e os 2 módulos de teste que já usam o idioma-alvo (`TStudentTest.test.tsx`, `CorrelacaoTest.test.tsx`) — este documento aponta para ele com linha exata.

## File Classification

| Arquivo (novo/modificado) | Papel | Fluxo de dados | Análogo mais próximo | Qualidade |
|---|---|---|---|---|
| `src/shared/flow/FlowSteps.tsx` | component | transform | ele mesmo (remoção guiada por D-02) | auto-edição |
| `src/shared/flow/FlowSteps.test.tsx` | test | event-driven | ele mesmo (D-03) | auto-edição |
| `src/features/tests/registry.ts` | model/config | CRUD (leitura) | ele mesmo + `07-RESEARCH.md` Pattern 2 (verificado por `tsc`) | auto-edição, padrão externo verificado |
| `src/routes/estatistica/SidebarTestLink.tsx` | component | transform | ele mesmo + `07-RESEARCH.md` Pattern 2 (`iconFor`) | auto-edição, padrão externo verificado |
| `src/routes/estatistica/SidebarTestLink.test.tsx` (NOVO) | test | event-driven | `src/routes/estatistica/ClearDataButton.test.tsx`, `src/routes/estatistica/Sidebar.test.tsx` | role-match forte |
| `src/routes/estatistica/EstatisticaPage.tsx` | controller/page | event-driven | ele mesmo + `07-RESEARCH.md` Pattern 2 (type guard) | auto-edição, padrão externo verificado |
| `src/app/router.test.tsx` | test | request-response | ele mesmo; hooks existentes em `EstatisticaPage.tsx` (`data-active-test-id`) e `Header.tsx` (link "Estatística") | auto-edição, hooks reais identificados |
| `src/routes/mapas/ReviewAnalysisDialog.test.tsx` | test | CRUD (fixture) | `src/routes/mapas/mapAnalysisState.ts:199` (`createInitialMapAnalysisState`) | exato — fábrica de produção |
| `src/test/setup.ts` | config (test infra) | event-driven | ele mesmo + `07-RESEARCH.md` Code Examples (stub incondicional) | auto-edição, padrão externo verificado |
| `src/test/flowHelpers.ts` (NOVO, nome discricionário) | utility (test helper) | event-driven | `src/test/legacyStatsOracle.ts`, `src/test/tStudentModuleOracle.ts`, `src/test/praisModuleOracle.ts`, `src/test/correlacaoModuleOracle.ts` (estilo/local/export) + `07-RESEARCH.md` Pattern 1 (conteúdo) | role-match (estilo) + verificado (conteúdo) |
| 10 call sites de `FlowSteps` (ver lista abaixo) | component | transform | eles mesmos (remoção mecânica de `onStepChange`/`layout`) | auto-edição |
| 8 módulos de teste com stepper (ver lista abaixo) + `TesteDemo.test.tsx` | test | event-driven | `src/features/tests/poisson/PoissonTest.test.tsx` (representante, 4 falhas) | exato entre si (idioma idêntico) |
| `TStudentTest.test.tsx` / `CorrelacaoTest.test.tsx` (referência, não tocados) | test | event-driven | já implementam informalmente o idioma-alvo pós-D-02 | referência "como deveria ficar" |
| `.githooks/pre-commit` (NOVO) | config/script (git hook) | event-driven | nenhum no repo | sem análogo — ver seção dedicada |
| `.githooks/pre-push` (NOVO) | config/script (git hook) | event-driven | nenhum no repo | sem análogo — ver seção dedicada |
| `.github/workflows/ci.yml` (NOVO) | config (pipeline CI) | event-driven | nenhum no repo | sem análogo — ver seção dedicada |

---

## Pattern Assignments

### `src/shared/flow/FlowSteps.tsx` (component, transform)

**Análogo:** o próprio arquivo — D-02 pede limpeza cirúrgica, não reescrita. Estado atual lido integralmente (117 linhas):

**O que sai** (com âncoras exatas do arquivo atual):
```typescript
// linha 2 — import morto após a remoção do ramo stepper
import { Check } from 'lucide-react';

// linhas 9-13 — usado só dentro do ramo stepper removido
export const FLOW_STEP_LABELS: Record<FlowStep, string> = {
  dados: 'Dados',
  configurar: 'Configurar',
  resultados: 'Resultados',
};

// linha 17 — prop nunca invocada no ramo scroll (D-02)
onStepChange: (step: FlowStep) => void;

// linhas 22-26 — prop layout inteira
/**
 * `scroll` (default): single-page flow — paste/config on top, results below.
 * `stepper`: legacy exclusive mount of one step at a time.
 */
layout?: 'scroll' | 'stepper';

// linha 44 — override só existia para a nav do stepper
const effectiveCanAdvance: Record<FlowStep, boolean> = { ...canAdvance, dados: true };

// linhas 56-94 — bloco inteiro do ramo stepper
if (layout === 'stepper') { /* ... nav + <section>{content}</section> */ }
```

**O que fica** (vira o corpo inteiro da função, sem `if`/branch):
```typescript
// linhas 96-116 do arquivo atual — hoje é o ramo "else" implícito, passa a
// ser o único corpo. Trocar effectiveCanAdvance por canAdvance direto (a
// entrada dados:true nunca era lida aqui — só a nav do stepper a consultava).
const showConfig = canAdvance.configurar;
const showResults = canAdvance.resultados || active === 'resultados';

return (
  <div className="space-y-10">
    <section aria-label="Dados e configuração" className="space-y-4">
      {showConfig ? configurar : dados}
    </section>
    {showResults ? (
      <section
        ref={resultsRef}
        aria-label="Resultados"
        id="lacir-flow-results"
        className="scroll-mt-6 space-y-4 border-t border-border pt-8"
      >
        {resultados}
      </section>
    ) : null}
  </div>
);
```
O `useEffect` de `scrollIntoView` (linhas 47-54) simplifica também: `if (layout !== 'scroll') return;` some junto com o parâmetro `layout` do array de dependências.

`FlowStepsProps` final (D-02): apenas `active`, `canAdvance`, `dados`, `configurar`, `resultados` — sem `onStepChange`, sem `layout`.

---

### `src/shared/flow/FlowSteps.test.tsx` (test, event-driven)

**Análogo:** o próprio arquivo. O `describe('FlowSteps scroll layout', ...)` já existente (linhas 105-140, lido integralmente) é o molde a seguir para os 3 casos novos de D-03 — mesma forma (`render` direto, sem `userEvent`, `canAdvance` inline):

```typescript
// padrão a copiar para os 3 casos novos (linhas 124-139 do arquivo atual)
it('shows results below when resultados can advance', () => {
  render(
    <FlowSteps
      active="resultados"
      canAdvance={baseCanAdvance}
      dados={<p>Dados</p>}
      configurar={<p>Configurar</p>}
      resultados={<p>Resultados</p>}
    />,
  );
  expect(screen.getByText('Configurar')).toBeInTheDocument();
  expect(screen.getByText('Resultados')).toBeInTheDocument();
});
```
Remover: `describe('FlowSteps stepper layout', ...)` inteiro (linhas 8-103), toda prop `layout="scroll"`/`layout="stepper"` nas chamadas restantes, e todo `onStepChange`.

Casos novos exigidos por D-03 (mesma forma acima, trocando asserções):
1. resultados aparece com `active === 'resultados'` mesmo com `canAdvance.resultados === false` — testa a condição `active === 'resultados'` do `showResults` isoladamente do `canAdvance`.
2. a seção tem `aria-label="Resultados"` e `id="lacir-flow-results"` — via `screen.getByRole('region', { name: 'Resultados' })` + `.toHaveAttribute('id', 'lacir-flow-results')` (mesma técnica `role="region"` verificada em `07-RESEARCH.md` Code Examples).
3. `scrollIntoView` dispara ao chegar em resultados — mock `Element.prototype.scrollIntoView = vi.fn()` (mesmo padrão já usado em `ReviewAnalysisDialog.test.tsx:118`, `Element.prototype.scrollIntoView = vi.fn();`) e assert `toHaveBeenCalled()`.

---

### `src/features/tests/registry.ts` (model, CRUD leitura)

**Análogo:** o próprio arquivo + padrão externo verificado em `07-RESEARCH.md` (3 experimentos `tsc --noEmit --strict` isolados, descartados após validação).

Estado atual (lido integralmente, 116 linhas):
```typescript
// linha 28 — hoje array solto, sem satisfies
export const TEST_REGISTRY: readonly TestRegistryEntry[] = [ /* 9 entradas */ ];

// linhas 103-109 — hoje aceitam string genérico
export function getTestById(id: string): TestRegistryEntry | undefined {
  return TEST_REGISTRY.find((entry) => entry.id === id);
}
export function isTestAvailable(id: string): boolean {
  return getTestById(id)?.status === 'available';
}
```

Padrão-alvo verificado (D-11, D-14 — `07-RESEARCH.md` Pattern 2):
```typescript
export const TEST_REGISTRY = [
  { id: 't-student', title: 'T de Student', /* ... */, status: 'available' },
  // ...9 entradas, sem mudar nenhum valor
] as const satisfies readonly TestRegistryEntry[];

export type TestId = (typeof TEST_REGISTRY)[number]['id'];

// isTestAvailable vira type guard — muda só a assinatura, zero mudança de
// comportamento runtime (Pitfall 5 do RESEARCH: sem isso, setActiveTestId(id)
// para de compilar em EstatisticaPage.tsx)
export function isTestAvailable(id: string): id is TestId {
  return TEST_REGISTRY.some((entry) => entry.id === id && entry.status === 'available');
}
```
`getTestById` continua com assinatura `(id: string)` — é a fronteira de runtime para ids vindos de fora (handoff, `location.state`).

---

### `src/routes/estatistica/SidebarTestLink.tsx:53` (component, transform) — QA-04 / D-14

**Análogo:** o próprio arquivo + padrão externo verificado (Pitfall 4 do RESEARCH: indexar `Record<TestId,...>` com `entry.id: string` solto quebra com `TS7053`).

Estado atual (lido integralmente):
```typescript
// linhas 16-26 — hoje Record<string, ...>, sem 't-student'... espera, TEM
// 't-student' etc., mas a CHAVE do tipo é string genérico:
const TEST_ICONS: Record<string, LucideIcon> = {
  't-student': GitCompareArrows,
  correlacao: ChartScatter,
  'prais-winsten': TrendingUp,
  'qui-quadrado': Grid3x3,
  'anova-tukey': BarChart3,
  'kruskal-dunn': BarChart3,
  poisson: Sigma,
  'binomial-negativa': Sigma,
  logistica: Binary,
};

// linha 53 — FlaskConical usado sem import (o erro de typecheck QA-04 aponta aqui)
const Icon = TEST_ICONS[entry.id] ?? FlaskConical;
```

Padrão-alvo (D-14 — mesma forma da D-11, `07-RESEARCH.md` Pattern 2):
```typescript
import { FlaskConical, /* ...ícones existentes... */ } from 'lucide-react';
import type { TestId } from '@/features/tests/registry';

const TEST_ICONS: Record<TestId, LucideIcon> = {
  't-student': GitCompareArrows,
  correlacao: ChartScatter,
  // ...faltar uma chave aqui é erro de compilação (TS2741) — é o "typecheck
  // pega no cadastro" que D-14 pede.
};

function iconFor(id: string): LucideIcon {
  return (TEST_ICONS as Partial<Record<string, LucideIcon>>)[id] ?? FlaskConical;
}
// no componente (linha 53 atual): const Icon = iconFor(entry.id);
```
`SidebarTestLinkProps.entry: TestRegistryEntry` continua com `id: string` solto de propósito (Pitfall 4) — é isso que permite o teste QA-04 construir uma entry fora do `TEST_REGISTRY` real sem violar tipo.

---

### `src/routes/estatistica/SidebarTestLink.test.tsx` (NOVO — QA-04)

**Análogo primário:** `src/routes/estatistica/ClearDataButton.test.tsx` (forma de `render` isolado, sem router).
**Análogo secundário:** `src/routes/estatistica/Sidebar.test.tsx` (já testa `SidebarTestLink` indiretamente via `Sidebar`, mesmo padrão de `getByRole('button', { name: ... })`).

`SidebarTestLink` não usa `useSession` nem `react-router` — o `render` não precisa de nenhum provider, ao contrário de `ClearDataButton` (que precisa de `SessionProvider`). Copiar a *forma* do `ClearDataButton.test.tsx`, não os providers:

```typescript
// forma a copiar de ClearDataButton.test.tsx:85-92 (render mínimo + getByRole)
it('renders the exact trigger copy', () => {
  render(
    <SessionProvider>
      <ClearDataButton />
    </SessionProvider>,
  );
  expect(screen.getByRole('button', { name: 'Limpar dados' })).toBeInTheDocument();
});
```

Caso QA-04 concreto (já verificado por `tsc` no `07-RESEARCH.md`, seção Validation Architecture — construir a entry fora do `TEST_REGISTRY` real):
```typescript
import { render, screen } from '@testing-library/react';
import { SidebarTestLink } from './SidebarTestLink';
import type { TestRegistryEntry } from '@/features/tests/registry';

it('renders a registry entry with no matching icon without throwing (QA-04)', () => {
  const entrySemIcone: TestRegistryEntry = {
    id: 'novo-teste-sem-icone',
    title: 'Novo teste',
    subtitle: 'Ainda sem ícone dedicado',
    group: 'Grupo experimental',
    status: 'available',
    phase: 99,
  };

  expect(() =>
    render(<SidebarTestLink entry={entrySemIcone} active={false} onSelect={() => {}} />),
  ).not.toThrow();

  expect(screen.getByRole('button', { name: entrySemIcone.title })).toBeInTheDocument();
});
```
`Sidebar.test.tsx:7-21` mostra o padrão de `renderX(overrides)` com retorno de mocks (`onSelectTest`, `onOpenQualTeste`) — útil se `SidebarTestLink.test.tsx` acabar precisando de múltiplos casos com overrides parciais de props.

---

### `src/routes/estatistica/EstatisticaPage.tsx:89,122` (controller/page, event-driven) — D-09/D-10/D-11

**Análogo:** o próprio arquivo + padrão externo verificado (Pitfall 5 do RESEARCH).

Estado atual (lido integralmente, 157 linhas):
```typescript
// linha 89 — string genérico, default já é 't-student' (D-10 confirma: fica assim)
const [activeTestId, setActiveTestId] = useState<string>('t-student');

// linhas 100-102 e 108-119 — os 3 pontos que setActiveTestId(id) com id
// vindo de fora (location.state, clique de sidebar, handoff de outro teste)
if (handoffId && isTestAvailable(handoffId)) {
  setActiveTestId(handoffId);
}
// ...
function handleSelectTest(id: string) {
  if (isTestAvailable(id)) {
    setActiveTestId(id);
  }
}
function handleCrossTestHandoff(testId: string, recognizedColumns?: Record<string, number>) {
  if (!isTestAvailable(testId)) return;
  setActiveTestId(testId);
  // ...
}

// linha 122 — fallback a eliminar por tipagem (D-11)
const pageTitle = getTestById(activeTestId)?.title ?? 'Estatística';
```

Padrão-alvo (D-11):
```typescript
import type { TestId } from '@/features/tests/registry';

const [activeTestId, setActiveTestId] = useState<TestId>('t-student');
// ...
// dentro de cada if (isTestAvailable(id)) { ... } — id já estreita para
// TestId automaticamente, porque isTestAvailable virou `id is TestId`
// (ver Pattern Assignment de registry.ts acima). setActiveTestId(id) volta
// a compilar sem cast.

const pageTitle = getTestById(activeTestId)?.title;
// getTestById(activeTestId: TestId) sempre encontra uma entry real — o
// `?? 'Estatística'` deixa de ser necessário; se o campo pageTitle continuar
// tipado como string | undefined por causa da assinatura solta de
// getTestById(id: string), considerar `getTestById(activeTestId)!.title` ou
// uma variante de getTestById que aceite TestId — decisão de implementação,
// não travada pelo CONTEXT.
```
Hook já existente para `router.test.tsx` D-12(b) usar como prova do teste padrão: `data-active-test-id={activeTestId}` no `<div id="lacir-test-module-mount">` (linha 141).

---

### `src/app/router.test.tsx:40` (test, request-response) — D-09/D-12

**Análogo:** o próprio arquivo (39 linhas, lido integralmente) + hooks reais expostos por outros arquivos já lidos.

Teste atual (quebrado, o único dos 24 com causa distinta):
```typescript
// linhas 40-43 do arquivo atual
it('renders the Estatística heading at / (landing route, D-04)', () => {
  renderAt('/');
  expect(screen.getByRole('heading', { name: 'Estatística' })).toBeInTheDocument();
});
```
Hoje o heading real em `/` é `pageTitle` (`EstatisticaPage.tsx:138`), que passa a ser sempre o título do teste ativo (`t de Student` por padrão) — nunca mais o literal "Estatística" (D-09 explica a causa raiz: o fallback só disparava porque `'demo'` não estava no registry).

**Landmark real e estável para D-12(a)** ("`/` renderiza a Estatística"), independente de qual teste está ativo — dois candidatos concretos já existentes no código, sem marcação nova:
```typescript
// Header.tsx:7 — link de navegação, presente em toda rota, mas só ativo/alvo em '/'
{ to: '/', label: 'Estatística' }
// screen.getByRole('link', { name: 'Estatística' }) prova a rota, não a página

// EstatisticaPage.tsx:141 — atributo já existente, específico da página
<div id="lacir-test-module-mount" data-active-test-id={activeTestId}>
```
D-12(a) — landmark específico de `EstatisticaPage` (não do link de nav, que aparece em toda rota): `document.querySelector('#lacir-test-module-mount')` ou `screen.getByRole('button', { name: 'Qual teste usar?' })` (renderizado só por `EstatisticaPage`/`Sidebar`, confirmado em `Sidebar.test.tsx:114`).

D-12(b) — teste padrão é `t-student`: `expect(screen.getByRole('heading', { name: 't de Student' })).toBeInTheDocument();` ou lendo `data-active-test-id="t-student"` no nó acima — qualquer um prova o *comportamento atual* de forma que quebra sozinho se o default mudar, distinguível de (a).

---

### `src/routes/mapas/ReviewAnalysisDialog.test.tsx:67` (test, CRUD fixture) — D-13

**Análogo:** exato — a própria fábrica de produção, `src/routes/mapas/mapAnalysisState.ts:199-208`:
```typescript
export function createInitialMapAnalysisState(): MapAnalysisState {
  return {
    groups: [],
    activeGroupId: null,
    mapView: { level: 'uf' as GeoLevel },
    provenance: 'catalog',
    sharedTime: { mode: 'point' },
    periodScope: 'shared',
  };
}
```
Fixture quebrada hoje (`ReviewAnalysisDialog.test.tsx:67-72`, dentro de `renderDialog`):
```typescript
const summary = deriveSelectionSummary({
  groups,
  activeGroupId: 'g1',
  mapView: { level: 'uf' },
  provenance: 'catalog',
});
```
Erro reproduzido: `TS2345 ... missing sharedTime, periodScope`.

Correção (D-13, import já necessário — adicionar `createInitialMapAnalysisState` ao import existente de `mapAnalysisState` na linha 7-8 do arquivo):
```typescript
const summary = deriveSelectionSummary({
  ...createInitialMapAnalysisState(),
  groups,
  activeGroupId: 'g1',
  mapView: { level: 'uf' },
  provenance: 'catalog',
});
```

---

### `src/test/setup.ts` (config/test infra, event-driven) — D-08

**Análogo:** o próprio arquivo, reescrito por completo (não incremento) + padrão verificado no `07-RESEARCH.md` (contagem de 190 avisos bate exatamente com `95 arquivos × 2 sondagens`).

Estado atual (lido integralmente, 45 linhas) — o padrão a **remover inteiro**:
```typescript
// linhas 14-31 — sonda o método REAL antes de decidir se stuba; a sondagem
// em si já imprime o aviso "Not implemented: HTMLCanvasElement.getContext"
const needsGetContextStub = (() => {
  try {
    return !proto.getContext.call(document.createElement('canvas'), '2d');
  } catch {
    return true;
  }
})();
if (needsGetContextStub) { /* stub */ }
// mesmo padrão repetido para toDataURL, linhas 33-44
```

Padrão-alvo (D-08, verificado nesta sessão de pesquisa — `07-RESEARCH.md` Code Examples):
```typescript
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// Substituir incondicionalmente, sem chamar o original primeiro — todo teste
// que usa Chart.js já mocka `chart.js` inteiro via vi.hoisted (ver Shared
// Patterns abaixo), então este stub nunca precisa desenhar nada real.
const proto = HTMLCanvasElement.prototype;
const noop = () => {};
const contextStub = new Proxy({}, { get: () => noop });

proto.getContext = (() => contextStub) as unknown as typeof proto.getContext;
proto.toDataURL = (() => 'data:image/png;base64,stub') as typeof proto.toDataURL;
```
Sem `npm install` novo (D-08 herda a regra de zero dependência da Fase 5) — nada de pacote `canvas`.

---

### `src/test/flowHelpers.ts` (NOVO — helper compartilhado, D-06/D-07)

**Análogo de estilo/casa (D-06 pede isto explicitamente):** os 4 oracles existentes em `src/test/` definem o *contrato de convenção* que o novo arquivo deve seguir — local (`src/test/`), export nomeado (nunca default), consumido via alias `@/test/<nome>` pelos arquivos de teste.

```typescript
// src/test/praisModuleOracle.ts:5 — export nomeado direto, sem classe/estado
export function buildLegacyPraisInterpretation(/* ... */): string { /* ... */ }

// src/test/legacyStatsOracle.ts:18, src/test/tStudentModuleOracle.ts:42 —
// variante com cache de módulo (`let cached = null; ... if (cached) return cached;`)
export function loadLegacyStatsOracle(): LegacyStatsOracle { /* ... */ }
```
Import real, do jeito que os arquivos de teste já consomem hoje (grep confirmado em 6 arquivos):
```typescript
// src/features/tests/prais-winsten/praisInterpretation.test.ts:7
import { buildLegacyPraisInterpretation } from '@/test/praisModuleOracle';
// src/features/tests/t-student/tStudentInterpretation.test.ts:8
import { loadTStudentModuleOracle } from '@/test/tStudentModuleOracle';
```
`vite.config.ts:9-10` confirma o alias: `resolve.alias['@'] = path.resolve(__dirname, './src')` — `@/test/flowHelpers` resolve para `src/test/flowHelpers.ts` sem configuração extra.

**Conteúdo (D-07 — verificado nesta sessão de pesquisa, `07-RESEARCH.md` Pattern 1, `role="region"` confirmado empiricamente com as versões exatas deste projeto):**
```typescript
// src/test/flowHelpers.ts (nome discricionário)
import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/**
 * Aciona só interações reais de produção: espera o botão real "Analisar
 * dados" aparecer (prova de que canAdvance.configurar virou true — o botão
 * só existe depois que a seção configurar monta, ColumnPreviewTable.tsx:218-
 * 220), clica nele, e espera a região "Resultados" (prova de
 * canAdvance.resultados). Nunca lê aria-current nem clica em nav — não
 * existem mais no layout scroll pós-D-01/D-02.
 */
export async function runToResultados(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Analisar dados' }));
  return screen.findByRole('region', { name: 'Resultados' });
}
```
Este helper **não** cobre dois casos estruturais reais (ambos documentados em `07-RESEARCH.md` Pattern 1 e confirmados por leitura direta abaixo) — cada um dos 9 arquivos precisa lidar com eles fora do helper, não dentro dele:
1. o caso "soft reset" que reabre configurar depois de já estar em Resultados (ver `PoissonTest.test.tsx:146-168` abaixo) — o segundo clique em "Configurar" simplesmente some, o `<select>` já está na tela.
2. `TesteDemo.test.tsx`'s `'keeps Resultados locked until a dataset is confirmed'` — no scroll layout a asserção vira `expect(screen.queryByRole('region', { name: 'Resultados' })).not.toBeInTheDocument()`, não uma chamada ao helper.

---

### Os 9 arquivos de teste a reescrever (test, event-driven) — 23 casos, D-06/D-07

**Representante escolhido:** `src/features/tests/poisson/PoissonTest.test.tsx` (4 falhas — cobre tanto o caminho "Usar exemplo" quanto colagem crua, e é o único dos 9 com o caso "soft reset" completo). Lido integralmente (169 linhas).

**Esqueleto compartilhado verbatim (idêntico nos 9 arquivos, confirmado por grep em todos)** — o que **fica** sem mudança:
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { PoissonTest } from './PoissonTest';

const { ChartMock, destroySpy } = vi.hoisted(() => {
  const destroySpy = vi.fn();
  const ChartConstructorSpy = vi.fn().mockImplementation(function ChartConstructorMock() {
    return { destroy: destroySpy, update: vi.fn(), config: { options: {} }, data: {} };
  });
  const ChartMock = ChartConstructorSpy as unknown as typeof ChartConstructorSpy & {
    register: ReturnType<typeof vi.fn>;
  };
  ChartMock.register = vi.fn();
  return { ChartMock, destroySpy };
});

vi.mock('chart.js', () => ({ /* Chart, controllers, scales, plugins — todos {} exceto Chart */ }));

function renderPoisson(/* ...props específicas do módulo... */) {
  return render(
    <SessionProvider>
      <PoissonTest /* ... */ />
    </SessionProvider>,
  );
}

describe('PoissonTest', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ChartMock.mockClear();
    destroySpy.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  // ...it(...) blocks
});
```

**O que muda em cada `it(...)` (D-07 — 3 passos no lugar de 5):**
```typescript
// ANTES (PoissonTest.test.tsx:72-84, quebrado hoje)
await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
await vi.advanceTimersByTimeAsync(200);
await waitFor(() => {
  expect(screen.getByRole('button', { name: 'Configurar' })).not.toBeDisabled();
});
await user.click(screen.getByRole('button', { name: 'Configurar' }));
await user.click(screen.getByRole('button', { name: 'Analisar dados' }));
await waitFor(() => {
  expect(screen.getByRole('button', { name: 'Resultados' })).toHaveAttribute('aria-current', 'step');
});

// DEPOIS (via helper novo)
await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
await vi.advanceTimersByTimeAsync(200);
await runToResultados(user);
// ...asserções de conteúdo de Resultados continuam iguais (getByText, getByTestId etc.)
```
O `advanceTimersByTimeAsync(200)` do debounce de parse (D-07: "permanece onde já existe") fica **antes** do helper, não dentro dele — é específico do parse da colagem/exemplo, não do clique em "Analisar dados".

**Caso "soft reset" (o 4º caso do Poisson, `146-168`, não cabe no helper):**
```typescript
// ANTES
await user.click(screen.getByRole('button', { name: 'Configurar' })); // reabre
await user.selectOptions(screen.getByLabelText(/Papel da coluna contagem/i), 'ignorar');
expect(screen.getByText('Modo alterado.')).toBeInTheDocument();

// DEPOIS — o clique em "Configurar" some (não existe mais fora do FlowSteps
// removido, grep confirma zero botões "Configurar" em produção); o <select>
// já está visível porque a seção "Dados e configuração" nunca desmonta:
await user.selectOptions(screen.getByLabelText(/Papel da coluna contagem/i), 'ignorar');
expect(screen.getByText('Modo alterado.')).toBeInTheDocument();
```

**Referência do que "correto" já parece** — `src/features/tests/t-student/TStudentTest.test.tsx` e `src/features/tests/correlacao/CorrelacaoTest.test.tsx` **não estão na lista de quebrados** e já usam informalmente boa parte do idioma-alvo (clicam direto em "Analisar dados" sem passar por "Configurar" via nav, nunca leem `aria-current`):
```typescript
// TStudentTest.test.tsx:43-49 — já não navega por nav nem lê aria-current
async function loadExample(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Usar exemplo' }));
  await vi.advanceTimersByTimeAsync(200);
  await waitFor(() => {
    expect(screen.getByText('Tabela pronta para configurar')).toBeInTheDocument();
  });
}
// TStudentTest.test.tsx:78, 105 — clique direto, sem "Configurar"
await user.click(screen.getByRole('button', { name: 'Analisar dados' }));
```
Não usam o helper novo nem `findByRole('region', ...)` (foram escritos antes desta decisão) — não precisam ser tocados nesta fase, mas mostram que o comportamento de produção já suporta o idioma-alvo sem mudança de runtime.

**Lista dos 9 arquivos e contagem de falhas (do CONTEXT, ground truth):**
| Arquivo | Falhas |
|---|---|
| `src/features/tests/anova-tukey/AnovaTukeyTest.test.tsx` | 3 |
| `src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx` | 3 |
| `src/features/tests/kruskal-dunn/KruskalDunnTest.test.tsx` | 3 |
| `src/features/tests/logistica/LogisticaTest.test.tsx` | 3 |
| `src/features/tests/poisson/PoissonTest.test.tsx` (representante) | 4 |
| `src/features/tests/prais-winsten/PraisWinstenTest.test.tsx` | 3 |
| `src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx` | 2 |
| `src/routes/estatistica/demo/TesteDemo.test.tsx` | 2 (1 estrutural — ver flowHelpers.ts acima) |

Todos os 8 confirmados por grep com o idioma idêntico (`aria-current`, clique em `'Configurar'`, `useFakeTimers`, `SessionProvider`, `vi.hoisted`) nas mesmas linhas relativas.

---

### Os 10 call sites de `FlowSteps` (component, transform) — D-02

**Análogo:** eles mesmos — mudança mecânica idêntica em todos: remover a prop `onStepChange={...}` (e `layout={...}` onde presente) da chamada de `<FlowSteps ...>`. O `setActiveStep` interno de cada módulo (usado para outros fins, ex. reabrir/soft-reset) permanece — só deixa de ser repassado ao componente.

Arquivos:
- `src/features/tests/t-student/TStudentTest.tsx`
- `src/features/tests/correlacao/CorrelacaoTest.tsx`
- `src/features/tests/prais-winsten/PraisWinstenTest.tsx`
- `src/features/tests/qui-quadrado/QuiQuadradoTest.tsx`
- `src/features/tests/anova-tukey/AnovaTukeyTest.tsx`
- `src/features/tests/kruskal-dunn/KruskalDunnTest.tsx`
- `src/features/tests/poisson/PoissonTest.tsx`
- `src/features/tests/binomial-negativa/BinomialNegativaTest.tsx`
- `src/features/tests/logistica/LogisticaTest.tsx`
- `src/routes/estatistica/demo/TesteDemo.tsx`

---

## Shared Patterns

### Idioma de teste de módulo (`SessionProvider` + mock de `chart.js` + fake timers)
**Fonte:** qualquer um dos 9+2 arquivos em `src/features/tests/*/`, extraído verbatim de `src/features/tests/poisson/PoissonTest.test.tsx:1-66` (ver Pattern Assignment acima).
**Aplica a:** os 9 arquivos reescritos e o novo `src/test/flowHelpers.ts` (que precisa conviver com `vi.useFakeTimers({ shouldAdvanceTime: true })` + `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`, não reinventar espera).

### Convenção de helper compartilhado em `src/test/`
**Fonte:** `src/test/legacyStatsOracle.ts`, `src/test/praisModuleOracle.ts`, `src/test/correlacaoModuleOracle.ts`, `src/test/tStudentModuleOracle.ts` — export nomeado, importado via alias `@/test/<nome>` (confirmado em 6 arquivos de teste diferentes via grep).
**Aplica a:** `src/test/flowHelpers.ts`.

### `role="region"` de `<section aria-label>` sem marcação extra
**Fonte:** `07-RESEARCH.md` Code Examples — verificado empiricamente nesta sessão com as versões exatas do projeto (`@testing-library/react` 16.3.2, `@testing-library/dom` 10.4.1).
**Aplica a:** `flowHelpers.ts` (`findByRole('region', { name: 'Resultados' })`) e os 3 casos novos de `FlowSteps.test.tsx` (D-03).

### Composição de scripts npm por encadeamento
**Fonte:** `package.json:11-12` — `"pretest": "npm run catalog:validate"`, `"test:run": "npm run catalog:validate && vitest run"` (padrão já em uso, D-10 da Fase 5).
**Aplica a:** `npm run gate` (D-16/D-17) — `07-RESEARCH.md` Pattern 4 já mostra as duas composições válidas (`gate: "npm run test:run && npm run build"` recomendada), nenhuma duplica `tsc`.

### Zero dependência npm nova
**Fonte:** decisão herdada da Fase 5, reafirmada em D-08/D-15/D-16 do CONTEXT desta fase.
**Aplica a:** `setup.ts` (sem pacote `canvas`), `.githooks/` (sem husky).

---

## No Analog Found

Confirmado nesta sessão — nenhum arquivo do repositório serve de análogo estrutural para os 3 arquivos abaixo (planner deve usar `07-RESEARCH.md` Pattern 3/4/Code Examples como fonte primária):

| Arquivo | Papel | Fluxo de dados | Motivo |
|---|---|---|---|
| `.githooks/pre-commit` | config/script (git hook) | event-driven | Sem `.github/` (`ls` falhou), sem husky no `package.json`, `git config core.hooksPath` vazio (confirmado nesta sessão) — nenhuma infraestrutura de hook existe hoje |
| `.githooks/pre-push` | config/script (git hook) | event-driven | idem |
| `.github/workflows/ci.yml` | config (pipeline CI) | event-driven | Diretório `.github/` inexistente; repositório sem remote (`git remote -v` vazio, confirmado nesta sessão) |

**Superfície de integração real para os 3:** `package.json` scripts (`typecheck`, `test:run`, `build`, futuro `gate`) — os 3 arquivos novos só *chamam* `npm run gate`, não reimplementam nenhuma etapa (D-16, "uma definição, três gatilhos"). `07-RESEARCH.md` já traz os 3 arquivos prontos e verificados mecanicamente (Pattern 3, Pattern 4, Code Examples — workflow com `actions/checkout@v7`/`actions/setup-node@v7`, Node 24).

---

## Metadata

**Escopo da busca de análogos:** `src/` inteiro (component/test/model/config), `.github/`, `.githooks/`, `package.json`
**Arquivos lidos integralmente nesta sessão:** `FlowSteps.tsx`, `FlowSteps.test.tsx`, `SidebarTestLink.tsx`, `EstatisticaPage.tsx`, `registry.ts`, `setup.ts`, `router.test.tsx`, `ReviewAnalysisDialog.test.tsx` (trecho relevante), `mapAnalysisState.ts` (trecho da fábrica), `PoissonTest.test.tsx`, `TesteDemo.test.tsx`, `TStudentTest.test.tsx` (trecho), `ClearDataButton.test.tsx`, `Sidebar.test.tsx`, `tStudentModuleOracle.ts`, `legacyStatsOracle.ts`, `praisModuleOracle.ts` (trecho), `vite.config.ts` (trecho), `package.json` (scripts)
**Comandos de verificação rodados nesta sessão:** `npx tsc --noEmit` (confirma os 2 erros), `git config core.hooksPath` / `git remote -v` / `ls .github .githooks` (confirmam ausência de infraestrutura de gate)
**Data de extração:** 2026-07-28
