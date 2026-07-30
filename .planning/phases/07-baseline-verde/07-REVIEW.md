---
phase: 07-baseline-verde
reviewed: 2026-07-29T00:00:00Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - .githooks/pre-commit
  - .githooks/pre-push
  - .github/workflows/ci.yml
  - package.json
  - src/app/router.test.tsx
  - src/features/tests/anova-tukey/AnovaTukeyTest.test.tsx
  - src/features/tests/anova-tukey/AnovaTukeyTest.tsx
  - src/features/tests/binomial-negativa/BinomialNegativaTest.test.tsx
  - src/features/tests/binomial-negativa/BinomialNegativaTest.tsx
  - src/features/tests/correlacao/CorrelacaoTest.tsx
  - src/features/tests/kruskal-dunn/KruskalDunnTest.test.tsx
  - src/features/tests/kruskal-dunn/KruskalDunnTest.tsx
  - src/features/tests/logistica/LogisticaTest.test.tsx
  - src/features/tests/logistica/LogisticaTest.tsx
  - src/features/tests/poisson/PoissonTest.test.tsx
  - src/features/tests/poisson/PoissonTest.tsx
  - src/features/tests/prais-winsten/PraisWinstenTest.test.tsx
  - src/features/tests/prais-winsten/PraisWinstenTest.tsx
  - src/features/tests/qui-quadrado/QuiQuadradoTest.test.tsx
  - src/features/tests/qui-quadrado/QuiQuadradoTest.tsx
  - src/features/tests/registry.test.ts
  - src/features/tests/registry.ts
  - src/features/tests/t-student/TStudentTest.tsx
  - src/routes/estatistica/EstatisticaPage.tsx
  - src/routes/estatistica/SidebarTestLink.test.tsx
  - src/routes/estatistica/SidebarTestLink.tsx
  - src/routes/estatistica/demo/TesteDemo.test.tsx
  - src/routes/estatistica/demo/TesteDemo.tsx
  - src/routes/mapas/ReviewAnalysisDialog.test.tsx
  - src/shared/flow/FlowSteps.test.tsx
  - src/shared/flow/FlowSteps.tsx
  - src/test/flowHelpers.test.tsx
  - src/test/flowHelpers.ts
  - src/test/setup.ts
findings:
  critical: 0
  warning: 7
  info: 3
  total: 10
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-07-29
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

## Summary

Revisão adversarial dos 34 arquivos da Fase 7 ("Baseline verde"): hooks de git,
CI, o novo `TestId`/type guard do registry, o stub de canvas em `setup.ts`, o
helper `runToResultados` e os 9 arquivos de teste reescritos do idioma
`stepper` para o layout `scroll`.

Nenhum problema **Critical** foi encontrado — nem nos hooks, nem nos arquivos
de produção revisados. Em particular, as duas áreas apontadas como
"o pior defeito possível desta fase" foram verificadas ativamente e
**confirmadas corretas**:

- `.githooks/pre-commit` usa `git diff --cached --name-only` sem
  `--diff-filter`, então uma deleção pura de um arquivo em `src/` aparece na
  lista de staged e força `npm run gate` a rodar — o buraco que motivou o
  comentário D-18 está de fato fechado. A checagem `! echo "$staged" | grep -qv
  '^\.planning/'` opera linha a linha sobre a string inteira (sem
  word-splitting via `for`), então nomes de arquivo com espaços não escapam da
  lógica. Não encontrei nenhuma entrada que produza um "false skip" além da
  limitação de rename já documentada inline (fora do escopo desta revisão,
  por instrução explícita).
- `isTestAvailable` em `src/features/tests/registry.ts:121-123` é um type
  guard que de fato valida contra `TEST_REGISTRY` em tempo de execução
  (`TEST_REGISTRY.some(...)`), não uma asserção não verificada. O fallback de
  ícone em `SidebarTestLink.tsx:36-38` (`iconFor`) também tem um caminho de
  runtime testado (`SidebarTestLink.test.tsx:22-33`) para um id ausente do
  mapa `TEST_ICONS`.

Os problemas reais encontrados são todos de nível **Warning** ou **Info**:
uma asserção de teste que pode silenciosamente não executar (vira "vacuous"),
uma lacuna de exhaustividade em `EstatisticaPage.tsx` que existe ao lado de um
padrão exaustivo bem feito no mesmo módulo, dois pontos de hardening de CI, o
script `prepare` engolindo falhas de instalação do hook, o stub de canvas
sendo mais permissivo que o DOM real, um teste que muta um prototype global
sem limpar, e dois imports não usados.

## Warnings

### WR-01: Asserção condicional torna o teste do CTA Kruskal potencialmente vazio

**File:** `src/features/tests/anova-tukey/AnovaTukeyTest.test.tsx:93-112`
**Issue:** O teste `'calls onNavigateTest for Kruskal CTA when nudge is shown'`
localiza o botão com `screen.queryByRole('button', { name: /Kruskal/i })` e só
executa o clique e a única asserção real do teste (
`expect(onNavigateTest).toHaveBeenCalledWith(...)`) dentro de
`if (kruskalButton) { ... }`. Se o dataset de exemplo do ANOVA não disparar o
nudge de sugestão do Kruskal-Wallis (ex.: dados de exemplo passam no
pressuposto de normalidade), `kruskalButton` é `null`, o bloco inteiro é
pulado, e o teste termina como "passou" sem nunca ter exercitado o
comportamento que seu próprio nome promete verificar. Isso é exatamente o
padrão de "assertion vazia" que a Fase 7 tentou eliminar ao reescrever os
outros 9 arquivos — aqui ele sobrevive num teste novo.
**Fix:**
```tsx
await waitFor(() => {
  expect(screen.getByText('Comparações par a par')).toBeInTheDocument();
});

const kruskalButton = await screen.findByRole('button', { name: /Kruskal/i });
await user.click(kruskalButton);
expect(onNavigateTest).toHaveBeenCalledWith('kruskal-dunn', expect.any(Object));
```
Trocar `queryByRole` condicional por `findByRole` incondicional faz o teste
falhar ruidosamente se o nudge não aparecer, em vez de silenciosamente não
provar nada.

### WR-02: `renderActiveTest` despacha por `string`, não por `TestId` — perde a exaustividade que `TEST_ICONS` garante

**File:** `src/routes/estatistica/EstatisticaPage.tsx:24-82`
**Issue:** `RenderActiveTestProps.activeTestId` é tipado como `string` (linha
26) e o `switch` em `renderActiveTest` (linhas 35-82) tem um
`default: return null;` silencioso. Hoje os 9 `case`s cobrem exatamente os 9
ids de `TEST_REGISTRY`, mas nada no compilador garante isso: ao contrário de
`TEST_ICONS` em `SidebarTestLink.tsx:17-27`, cujo comentário afirma
explicitamente "forgetting a key ... is a compile error (TS2741)", aqui um
décimo teste adicionado ao registry sem atualizar este `switch` compila
normalmente e, em runtime, simplesmente não renderiza nada — sem erro, sem
aviso — exatamente o tipo de "ausência que parece um valor" que esta fase
levantou como o problema central. `activeTestId` (estado do componente) já é
tipado como `TestId` (linha 89), então a interface do parâmetro deveria
acompanhar.
**Fix:**
```tsx
interface RenderActiveTestProps {
  activeTestId: TestId;
  // ...
}

function renderActiveTest({ activeTestId, ... }: RenderActiveTestProps) {
  switch (activeTestId) {
    // ...9 cases...
    default: {
      const _exhaustive: never = activeTestId;
      return _exhaustive;
    }
  }
}
```
Isso faz o TypeScript recusar a compilação assim que um novo id em
`TEST_REGISTRY` não tiver um `case` correspondente, como já acontece com
`TEST_ICONS`.

### WR-03: `prepare` engole qualquer falha ao instalar os hooks, sem aviso

**File:** `package.json:15`
**Issue:** `"prepare": "git config core.hooksPath .githooks || true"` — o
`|| true` faz esse script sempre "ter sucesso", mesmo que o `git config` falhe
(permissão negada, `.git` ausente/corrompido, worktree incomum, etc.). Nesse
caso, `core.hooksPath` nunca é configurado, `.githooks/pre-commit` e
`.githooks/pre-push` nunca rodam para aquele clone, e não há nenhum sinal
disso para quem instalou — o gate local fica desligado silenciosamente. Dado
que o tema central desta fase é "hook que falha aberto é o pior defeito
possível", este é o único ponto onde isso pode de fato acontecer (ainda que
apenas localmente — o CI continua cobrindo pushes/PRs).
**Fix:**
```json
"prepare": "git config core.hooksPath .githooks || echo 'AVISO: não foi possível configurar core.hooksPath — hooks locais desativados'"
```
ou, mais estrito, deixar o `npm install` falhar (remover o `|| true`) para que
a ausência dos hooks seja visível imediatamente em vez de descoberta depois.

### WR-04: workflow de CI sem bloco `permissions` explícito

**File:** `.github/workflows/ci.yml:1-17`
**Issue:** O workflow não declara `permissions:`, então o `GITHUB_TOKEN`
concedido ao job herda o escopo padrão do repositório/organização em vez do
mínimo necessário (este job não escreve em nada — só faz checkout, build e
teste). Isso é uma lacuna de hardening: qualquer step futuro adicionado aqui
(ou uma dependência de terceiros comprometida) herdaria permissões mais
amplas do que o necessário por padrão.
**Fix:**
```yaml
permissions:
  contents: read
```
no nível do workflow (ou do job `gate`).

### WR-05: actions de terceiros fixadas em tags mutáveis (`@v7`), não em SHA de commit

**File:** `.github/workflows/ci.yml:11-12`
**Issue:** `actions/checkout@v7` e `actions/setup-node@v7` são tags de major
version, que podem ser re-apontadas pelo mantenedor da action (ou por um
atacante, em caso de comprometimento da conta/repositório da action) para
outro commit sem qualquer mudança neste repositório. Isso é uma superfície de
cadeia de suprimentos clássica em CI: o conteúdo que roda no runner não é
determinado apenas pelo que está versionado aqui.
**Fix:** Fixar por SHA de commit com a versão como comentário, ex.:
```yaml
- uses: actions/checkout@<sha-do-commit-v7.x.x> # v7.x.x
- uses: actions/setup-node@<sha-do-commit-v7.x.x> # v7.x.x
```
e manter os SHAs atualizados via Dependabot/Renovate configurado para essas
actions.

### WR-06: stub de canvas em `setup.ts` ignora o `contextId`, mais permissivo que o DOM real

**File:** `src/test/setup.ts:19-24`
**Issue:** `proto.getContext = (() => contextStub) as unknown as typeof
proto.getContext;` retorna o mesmo stub truthy **para qualquer argumento**,
incluindo `getContext('webgl')`, `getContext('bitmaprenderer')` ou até um
contextId inválido. No jsdom/browser real, `getContext` com um id não
suportado retorna `null`. Qualquer código de produção que faça checagem
defensiva (`const ctx = canvas.getContext('2d'); if (!ctx) { ...fallback... }`)
nunca vai exercitar o branch de fallback sob teste, porque `ctx` é sempre
truthy aqui — um bug nesse fallback passaria despercebido pela suíte. Isso é
uma lacuna distinta do problema de warning no console que motivou a
substituição (documentado no comentário do próprio arquivo), e não está
coberta por ele.
**Fix:**
```ts
proto.getContext = ((contextId: string) =>
  contextId === '2d' ? contextStub : null) as unknown as typeof proto.getContext;
```
Isso preserva o objetivo original (nenhum warning, nenhuma tentativa de
desenhar de verdade) e ainda deixa o branch `if (!ctx)` testável para
contextIds não suportados.

### WR-07: teste muta `Element.prototype.scrollIntoView` globalmente sem restaurar

**File:** `src/shared/flow/FlowSteps.test.tsx:69-70`
**Issue:**
```tsx
const scrollIntoViewMock = vi.fn();
Element.prototype.scrollIntoView = scrollIntoViewMock;
```
é atribuído diretamente dentro do `it(...)`, sem `vi.spyOn` e sem
`afterEach`/`mockRestore` para desfazer a mutação. Hoje isso é inofensivo
porque é o último teste do arquivo (e o Vitest, com `isolate` no padrão,
não vaza isso para outros arquivos), mas é uma dependência de ordem
silenciosa: qualquer teste adicionado depois deste no mesmo `describe` herda
o mock em vez do comportamento real do jsdom, sem nenhum sinal de que isso
está acontecendo.
**Fix:**
```tsx
it('scrolls the resultados section into view when it becomes reachable', () => {
  const scrollIntoViewMock = vi.fn();
  const original = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = scrollIntoViewMock;
  try {
    render(/* ... */);
    expect(scrollIntoViewMock).toHaveBeenCalled();
  } finally {
    Element.prototype.scrollIntoView = original;
  }
});
```
ou usar `vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() =>
{})` combinado com `afterEach(() => vi.restoreAllMocks())`, como já é feito em
`ReviewAnalysisDialog.test.tsx:118-122`.

## Info

### IN-01: import `fireEvent` não utilizado

**File:** `src/routes/estatistica/demo/TesteDemo.test.tsx:2`
**Issue:** `import { fireEvent, render, screen } from '@testing-library/react';`
— `fireEvent` não é referenciado em nenhum outro ponto do arquivo (confirmado
via busca textual; ocorre exatamente uma vez, na própria linha de import).
**Fix:** Remover `fireEvent` do import.

### IN-02: import `fireEvent` não utilizado

**File:** `src/routes/mapas/ReviewAnalysisDialog.test.tsx:2`
**Issue:** Mesmo padrão do IN-01: `fireEvent` é importado e nunca usado no
restante do arquivo.
**Fix:** Remover `fireEvent` do import.

### IN-03: escopo de asserção inconsistente entre testes-irmãos de "runs exemplo flow"

**File:** `src/features/tests/anova-tukey/AnovaTukeyTest.test.tsx:62-76`,
`src/features/tests/kruskal-dunn/KruskalDunnTest.test.tsx:62-76`
**Issue:** Estes dois arquivos descartam o retorno de
`await runToResultados(user)` e fazem as asserções seguintes com
`screen.getByText(...)`/`screen.getByRole(...)` não escopadas, enquanto os
testes equivalentes em `BinomialNegativaTest.test.tsx:82-90` e
`QuiQuadradoTest.test.tsx:62-67` capturam a região (`const resultados = await
runToResultados(user)`) e escopam pelo menos uma asserção-chave com
`within(resultados)`. Não encontrei evidência de colisão de texto real hoje
(os textos verificados — "Comparações par a par", cabeçalhos de coluna,
`#chart-type-heatmap` — são específicos o bastante para não aparecerem no
painel de configuração), mas a inconsistência de padrão entre arquivos
irmãos, reescritos na mesma leva, é o tipo de deriva que facilita uma futura
colisão silenciosa passar despercebida em revisão.
**Fix:** Capturar `resultados` e escopar como nos outros dois arquivos:
```tsx
const resultados = await runToResultados(user);
// ...
expect(within(resultados).getByText('Comparações par a par')).toBeInTheDocument();
```

---

_Reviewed: 2026-07-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
