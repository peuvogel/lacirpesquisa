# Phase 7: Baseline verde - Research

**Researched:** 2026-07-28
**Domain:** Saúde de suíte de testes (Vitest 4 + Testing Library), TypeScript union types derivados, git hooks sem dependência (`core.hooksPath`), GitHub Actions para um repositório sem remote ainda
**Confidence:** HIGH — quase todo achado abaixo foi reproduzido neste repositório (typecheck, `vitest run`, hooks de teste em `/private/tmp`, `tsc --noEmit` isolado) ou confirmado via API oficial do GitHub/npm docs. Onde a confiança é menor, está marcado explicitamente.

## Summary

As 18 decisões de `07-CONTEXT.md` já fecham o quê fazer; esta pesquisa foca no **como**, com mecânica verificada linha a linha no código atual. Três achados mudam a forma de execução em relação ao que o ROADMAP/CONTEXT sugeriam:

1. **O stub de canvas em `src/test/setup.ts` já existe — e é a própria causa dos 190 avisos.** O padrão atual "detecta-então-condicionalmente-stuba" chama o método real do jsdom (`getContext`/`toDataURL`, ambos "not implemented") uma vez por arquivo de teste só para decidir se precisa stubar. Essa chamada de sondagem é o que imprime o aviso — 95 arquivos × 2 chamadas = 190, contagem batida exatamente com o `npx vitest run` reproduzido nesta sessão. A correção não é "adicionar" um stub; é parar de sondar com o método real antes de substituí-lo.
2. **Retipar `activeTestId`/`TEST_ICONS` a partir de `TEST_REGISTRY` (D-11/D-14) quebra a linha que hoje funciona** (`TEST_ICONS[entry.id] ?? FlaskConical` em `SidebarTestLink.tsx:53`) se feito ingenuamente — indexar um `Record<TestId, LucideIcon>` com uma chave `string` genérica é erro de tipo (`TS7053`), reproduzido neste ambiente. E `setActiveTestId(id)` deixa de compilar dentro de `handleSelectTest`/`handleCrossTestHandoff` a menos que `isTestAvailable` vire um *type guard* (`id is TestId`), não apenas um `boolean`. Os dois pontos têm padrão comprovado (seção Code Examples) que preserva exatamente o comportamento runtime atual.
3. **Node local (v25.9.0) já está fora de suporte** (Node 25 chegou a EOL em 01/06/2026, [CITED]). Pinar o workflow do CI na versão local seria pinar numa runtime morta. A recomendação é Node 24 (Active LTS, EOL abril/2028), que também satisfaz o mínimo do Vite 8 (20.19+/22.12+).

Fora isso, a reescrita dos 23 testes é mecânica e uniforme: todos os 9 arquivos seguem o mesmo padrão de `render` + `vi.mock('chart.js')` + `vi.useFakeTimers({ shouldAdvanceTime: true })`, e o botão real "Analisar dados" (produção, em `ColumnPreviewTable.tsx:218-220`, não um artefato de teste) é o marcador de carga de dados em todos eles.

**Primary recommendation:** Execute a fase na ordem sugerida pelo CONTEXT (typecheck → remoção do stepper → helper + reescrita dos 23 → landing/router → ruído do console → gate), mas trate a correção do stub de canvas como uma reescrita completa de `src/test/setup.ts` (não um incremento), e trate a tipagem de `TEST_ICONS`/`activeTestId` como dois sub-passos amarrados (o `Record` exaustivo *e* o *type guard*), não um só.

## Architectural Responsibility Map

Fase 7 é majoritariamente ferramental (testes, git, CI), não uma feature de runtime — a maioria das linhas do mapa de 5 camadas não se aplica. Ainda assim, mapeando o que existe:

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fluxo Dados → Configurar → Resultados (`FlowSteps`, layout `scroll`) | Browser / Client | — | Componente React puro, sem servidor; renderização condicional local baseada em `canAdvance` |
| Seleção de teste ativo / ícone no sidebar (`TEST_REGISTRY`, `activeTestId`, `SidebarTestLink`) | Browser / Client | — | Estado local de `EstatisticaPage`, nenhuma chamada de rede envolvida |
| Suíte de testes (Vitest + Testing Library + jsdom) | *(fora do modelo de 5 camadas)* | — | Infraestrutura de desenvolvimento, roda em Node, simula o Browser/Client via jsdom — não é uma camada de produção |
| Gate local (`.githooks/pre-commit`, `.githooks/pre-push`) | *(fora do modelo de 5 camadas)* | — | Executa no ambiente git do desenvolvedor, nunca é servido nem entregue ao usuário final |
| Gate remoto (`.github/workflows/ci.yml`) | *(fora do modelo de 5 camadas)* | — | Executa no runner do GitHub Actions; nenhuma camada da aplicação (Browser/API/DB) participa |

Nenhuma capacidade desta fase toca API/Backend, CDN/Static ou Database/Storage — coerente com a nota do CONTEXT: "A Fase 7 não muda comportamento de produção".

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QA-01 | `npm run typecheck` passa sem erros | Os 2 erros reproduzidos nesta sessão (`SidebarTestLink.tsx:53`, `ReviewAnalysisDialog.test.tsx:67`) têm causa raiz confirmada por leitura direta de `mapAnalysisState.ts` e `registry.ts`; padrões de correção verificados por `tsc` isolado (seção Code Examples) |
| QA-02 | A suíte de testes passa integralmente, e passar é pré-condição de commit | `npx vitest run` reproduzido: 24 falhas / 652 passando, 9 de 95 arquivos — mesma contagem do ground truth do CONTEXT; mecânica exata dos 23+1 falhas documentada (seção Common Pitfalls); gate local via `.githooks/pre-commit` verificado mecanicamente nesta sessão (executável, `core.hooksPath`, `--no-verify`, diretório ausente) |
| QA-03 | Nenhum teste fica vermelho "conhecido" — uma falha nova é distinguível de dívida herdada | Gate de 3 gatilhos (`npm run gate` em pre-commit/pre-push/Actions) impede reentrada de vermelho; mecânica de composição sem duplicar `tsc` verificada (seção Architecture Patterns) |
| QA-04 | Registrar um teste novo sem ícone próprio não derruba o sidebar | Padrão `Record<TestId, LucideIcon>` exaustivo + *type guard* + fallback runtime via cast controlado verificado por `tsc` isolado nesta sessão (3 experimentos, ver Code Examples); estratégia de teste que contorna a exaustividade do tipo documentada (Validation Architecture) |
</phase_requirements>

## Standard Stack

Esta fase **não instala nenhum pacote npm novo** — D-08, D-15 e D-16 do CONTEXT proíbem explicitamente (herdado da regra "zero dependências novas" da Fase 5). As únicas peças novas são arquivos versionados (`.githooks/*`, `.github/workflows/ci.yml`) e duas GitHub Actions de terceiros oficiais (não são pacotes npm, são Actions do marketplace, primeira-parte GitHub).

### Ferramentas existentes relevantes (já no projeto, versões confirmadas)

| Ferramenta | Versão instalada | Papel nesta fase | Fonte |
|---|---|---|---|
| `vitest` | 4.1.10 | Runner da suíte; reporter `basic` foi **removido** na v4 (confirmado via `npx vitest run --help`: reporters disponíveis são `default, agent, minimal, blob, verbose, dot, json, tap, tap-flat, junit, tree, hanging-process, github-actions`) | [VERIFIED: `npx vitest --version` + `--help` nesta sessão] |
| `@testing-library/react` | 16.3.2 | `render`, `screen`, `findByRole`/`waitFor` | [VERIFIED: package.json] |
| `@testing-library/dom` (transitivo) | 10.4.1 | Resolução de `role` implícito (`<section aria-label>` → `role="region"`) | [VERIFIED: `node_modules/@testing-library/dom/package.json` + teste ad-hoc nesta sessão, ver Code Examples |
| `typescript` | ~5.9 (pin do package.json) | `satisfies`, `as const`, type guards — todos suportados desde TS 4.9 | [VERIFIED: `tsc --noEmit` isolado rodou os padrões sem erro de sintaxe] |
| `vite` | 8.1.5 | `vite build`; exige Node 20.19+ ou 22.12+ | [CITED: vite.dev/blog/announcing-vite8 via busca] |
| `node` (local) | v25.9.0 | **Já em EOL (01/06/2026)** — não usar como pin do CI | [CITED: nodejs.org/en/about/eol, herodevs.com — ver State of the Art] |
| `git` | 2.39.5 | `core.hooksPath` requer git ≥ 2.9 (2016); `--diff-filter` é plumbing estável desde sempre | [VERIFIED: `git --version` nesta sessão] |

### GitHub Actions de terceiros (não-npm, avaliadas como dependência de supply chain)

| Action | Major atual | Verificado via | Nota |
|---|---|---|---|
| `actions/checkout` | v7 (v7.0.1) | [VERIFIED: `curl https://api.github.com/repos/actions/checkout/tags`, primeira entrada `v7.0.1`] | Primeira-parte GitHub, altíssima confiança; runner mínimo v2.327.1+ (já garantido pelo GitHub-hosted runner) |
| `actions/setup-node` | v7 (v7.0.0) | [VERIFIED: `curl https://api.github.com/repos/actions/setup-node/tags`, primeira entrada `v7.0.0`] | Idem; suporta `node-version: 24`, `cache: 'npm'` |

**Instalação:** nenhuma. Nenhum `npm install` de pacote novo é necessário para esta fase.

**Verificação de versão:** as duas tags acima foram confirmadas via `GET /repos/{owner}/{repo}/tags` da API do GitHub (não apenas busca na web, que citou v5/v6 desatualizadamente) — a API é a fonte de verdade, WebSearch é ruído de treinamento defasado aqui.

## Package Legitimacy Audit

**Não aplicável.** Esta fase não instala nenhum pacote npm — D-08 (stub de canvas sem `canvas` package), D-15/D-16 (gate sem husky) são decisões travadas exatamente para evitar isso. As duas GitHub Actions usadas (`actions/checkout@v7`, `actions/setup-node@v7`) são mantidas pela organização `actions` do próprio GitHub (primeira-parte, não third-party de marketplace) — risco de supply chain mínimo, mas ainda assim recomenda-se fixar por tag major (`@v7`), não por branch (`@main`), e considerar pin por SHA de commit como endurecimento opcional (ver Security Domain).

## Architecture Patterns

### Diagrama: fluxo scroll (pós-D-01/D-02) vs. gate de 3 gatilhos

```
Fluxo de dados (produção, inalterado nesta fase — só os testes mudam)
──────────────────────────────────────────────────────────────────────
  [Colar/Usar exemplo] → useTabularInput → canAdvance.configurar=true
              │
              ▼
  <section aria-label="Dados e configuração">   (sempre montada 1x;
      mostra `dados` até canAdvance.configurar,      alterna conteúdo,
      depois mostra `configurar` PARA SEMPRE)          nunca desmonta)
              │
   [clique "Analisar dados" em ColumnPreviewTable]
              │
              ▼
  <section aria-label="Resultados" id="lacir-flow-results">
      (só monta quando canAdvance.resultados || active==='resultados';
       scrollIntoView dispara 1x ao montar)
──────────────────────────────────────────────────────────────────────

Gate (nova infraestrutura desta fase — dev-local e CI, nunca produção)
──────────────────────────────────────────────────────────────────────
  git commit ──► core.hooksPath=.githooks ──► .githooks/pre-commit
                                                   │
                     staged só sob .planning/? ──sim──► skip (D-18)
                                                   │não
                                                   ▼
                                            npm run gate (typecheck
                                            equivalente + test:run +
                                            build) ── falha ──► commit
                                                              abortado
  git push ──► .githooks/pre-push ──► npm run gate (sempre, sem D-18)
  push ao GitHub ──► .github/workflows/ci.yml ──► npm run gate
                                            (única fonte que de fato
                                             bloqueia merge — E só
                                             depois de branch protection
                                             configurada, ver Pitfalls)
──────────────────────────────────────────────────────────────────────
```

### Recommended Project Structure (arquivos tocados/criados nesta fase)

```
.githooks/
├── pre-commit           # NOVO — checa staged-only-.planning (D-18), senão roda `npm run gate`
└── pre-push              # NOVO — roda `npm run gate` sempre, sem exceção
.github/
└── workflows/
    └── ci.yml             # NOVO — roda `npm run gate` em push/pull_request
src/test/
├── setup.ts               # REESCRITO — stub de canvas incondicional (não mais sondagem)
├── flowHelpers.ts          # NOVO (nome exato é discricionário) — helper Dados→Resultados
├── legacyStatsOracle.ts    # existente, não tocado
├── praisModuleOracle.ts    # existente, não tocado
├── correlacaoModuleOracle.ts # existente, não tocado
└── tStudentModuleOracle.ts # existente, não tocado
src/shared/flow/
├── FlowSteps.tsx           # EDITADO — remove ramo stepper, layout prop, onStepChange, FLOW_STEP_LABELS, Check import, effectiveCanAdvance
└── FlowSteps.test.tsx      # EDITADO — remove 5 testes stepper, adiciona 3 novos casos scroll (D-03)
src/features/tests/registry.ts  # EDITADO — as const satisfies + export type TestId
src/routes/estatistica/
├── SidebarTestLink.tsx     # EDITADO — TEST_ICONS: Record<TestId,...> + lookup helper com fallback
└── EstatisticaPage.tsx     # EDITADO — activeTestId: TestId; pageTitle sem `?? 'Estatística'`
src/app/router.test.tsx     # EDITADO — assevera landing (D-04 herdada) e default t-student separadamente
src/routes/mapas/ReviewAnalysisDialog.test.tsx  # EDITADO — fixture espalha createInitialMapAnalysisState()
```

### Pattern 1: helper de fluxo compartilhado (D-06/D-07)

**What:** uma função em `src/test/` que encapsula os 3 passos reais de produção (usar exemplo/colar → esperar "Analisar dados" → clicar → esperar região "Resultados"), substituindo os 5 passos antigos do stepper em 23 testes.

**When to use:** todo teste que hoje clica `Configurar`/`Resultados` via nav e/ou lê `aria-current="step"`.

**Example (idioma verificado nesta sessão — `role="region"` resolvido empiricamente, ver seção seguinte):**
```typescript
// src/test/flowHelpers.ts (nome discricionário — CONTEXT deixa em aberto)
import { screen, type ByRoleMatcher } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/**
 * Aciona só interações reais de produção: clica no botão que dispara o
 * carregamento (ex.: "Usar exemplo"), espera o botão real "Analisar dados"
 * aparecer (prova de que canAdvance.configurar virou true), clica nele, e
 * espera a região "Resultados" (prova de canAdvance.resultados).
 * Nunca lê aria-current nem clica em nav — essas coisas não existem no
 * layout scroll (D-01/D-02).
 */
export async function runToResultados(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Analisar dados' }));
  return screen.findByRole('region', { name: 'Resultados' });
}
```

**Nuance importante encontrada nesta sessão:** nem todos os 23 testes cabem 1:1 nesse helper. Pelo menos um caso por módulo ("shows soft reset alert...") **reabre** a configuração *depois* de chegar em Resultados — no stepper antigo isso exigia um segundo clique em "Configurar" (nav); no scroll, a seção `aria-label="Dados e configuração"` **nunca desmonta** depois que os dados carregam (`showConfig` fica `true` para sempre), então o segundo clique em "Configurar" precisa simplesmente **sumir** — o `<select>` de papel de coluna já está visível na tela, sem navegação nenhuma. Confirmado por grep: não existe nenhum botão "Configurar" em produção fora do próprio `FlowSteps.tsx` (que está sendo removido) — `screen.getByRole('button', {name:'Configurar'})` não encontraria nada depois da D-02.

Também há um caso estrutural diferente: `TesteDemo.test.tsx` tem o teste `'keeps Resultados locked until a dataset is confirmed'`, que hoje lê um botão "Resultados" desabilitado. No scroll layout não existe botão desabilitado — a seção Resultados simplesmente **não é montada**. A asserção equivalente é `expect(screen.queryByRole('region', { name: 'Resultados' })).not.toBeInTheDocument()`, não uma chamada ao helper de sucesso.

### Pattern 2: tipo derivado do registry + guarda de runtime (D-11/D-14)

**What:** `TEST_REGISTRY` (array de objetos) vira a fonte do tipo `TestId` (união literal), fechando o buraco do fallback `?? 'Estatística'` e do ícone ausente, **sem duplicar a lista de ids em nenhum outro lugar**.

**Verificado nesta sessão com 3 experimentos isolados de `tsc --noEmit --strict`** (arquivos descartados após o teste, não fazem parte do commit):

```typescript
// src/features/tests/registry.ts — mudança na declaração
export const TEST_REGISTRY = [
  { id: 't-student', title: 'T de Student', /* ... */, status: 'available' },
  // ...9 entradas
] as const satisfies readonly TestRegistryEntry[];
//   ^^^^^^^^^^^^^^^^ preserva os literais ('t-student', 'available', ...)
//                     E valida contra a forma de TestRegistryEntry ao mesmo tempo.
//                     `satisfies` existe desde TS 4.9 — TS ~5.9 do projeto suporta.

export type TestId = (typeof TEST_REGISTRY)[number]['id'];
// = 't-student' | 'correlacao' | 'prais-winsten' | ... (união de 9 literais)

// isTestAvailable/getTestById continuam aceitando `string` genérico — são a
// fronteira de runtime para ids vindos de fora (location.state, handoff do
// mapa). MAS isTestAvailable precisa virar type guard, senão
// `setActiveTestId(id)` não compila em EstatisticaPage (verificado: erro
// TS2345 "string não é atribuível a TestId" sem essa mudança).
export function isTestAvailable(id: string): id is TestId {
  return TEST_REGISTRY.some((entry) => entry.id === id && entry.status === 'available');
}
```

```typescript
// src/routes/estatistica/SidebarTestLink.tsx — TEST_ICONS exaustivo + lookup seguro
const TEST_ICONS: Record<TestId, LucideIcon> = {
  't-student': GitCompareArrows,
  correlacao: ChartScatter,
  // ... faltar uma chave aqui é ERRO DE COMPILAÇÃO (TS2741), verificado nesta sessão.
};

// Indexar TEST_ICONS[entry.id] direto NÃO compila mais — entry: TestRegistryEntry
// tem `id: string` genérico (é um componente reutilizável/testável isoladamente,
// não deveria depender do union TestId). O cast é o ponto exato onde o fallback
// de runtime do QA-04 continua vivo e testável:
function iconFor(id: string): LucideIcon {
  return (TEST_ICONS as Partial<Record<string, LucideIcon>>)[id] ?? FlaskConical;
}
// ... no componente: const Icon = iconFor(entry.id);
```

**Por que o fallback de runtime continua fazendo sentido mesmo com o tipo exaustivo:** `TestId` é derivado de `TEST_REGISTRY`, então adicionar um 10º id ao registry *automaticamente* obriga `TEST_ICONS` a ganhar a 10ª chave (erro de compilação se esquecer — é exatamente o que QA-04 pede). Mas `SidebarTestLink` recebe `entry: TestRegistryEntry` como prop solta, com `id: string` — um teste pode construir esse objeto diretamente (sem passar pelo `TEST_REGISTRY` real) com um id que não existe em `TEST_ICONS`, exercitando o fallback sem precisar violar o tipo do registry real. Essa é a técnica que a suíte de QA-04 deve usar (ver Validation Architecture).

### Pattern 3: `.githooks/` sem dependência + bootstrap via `prepare`

**What:** hooks versionados ativados por `core.hooksPath`, mais um script `prepare` que configura isso automaticamente após `npm install`/`npm ci`.

**Mecânica confirmada empiricamente nesta sessão** (repositório de teste descartável em `/private/tmp`):
- `core.hooksPath` é config **local** (`.git/config`), nunca versionada — um clone novo tem `git config core.hooksPath` vazio mesmo com `.githooks/pre-commit` presente e executável no checkout. Confirmado com clone real.
- Hook sem bit executável é **silenciosamente ignorado** — git imprime só um hint (`hint: The '.githooks/pre-commit' hook was ignored because it's not set as executable.`) e o commit **prossegue normalmente**. Não é uma falha ruidosa.
- `core.hooksPath` apontando para um diretório **inexistente** não produz warning nenhum — commit prossegue silenciosamente como se hooks não existissem.
- O bit executável **é rastreado pelo git** (modo `100755` vs `100644` no índice) e sobrevive a um `git clone` normal em POSIX (macOS/Linux) — confirmado.
- `--no-verify` bypassa `pre-commit`/`pre-push` normalmente (comportamento padrão do git, sem novidade).

```jsonc
// package.json — bootstrap idiomático (defensivo: nunca falha o install)
{
  "scripts": {
    "prepare": "git config core.hooksPath .githooks || true"
  }
}
```
`prepare` roda tanto em `npm install` (sem argumentos) quanto em `npm ci` [CITED: docs.npmjs.com/cli/v11/using-npm/scripts] — cobre tanto o clone local do desenvolvedor quanto o `npm ci` do CI (nesse último caso é um no-op inofensivo, já que o Actions não commita/faz push através de hooks git). O `|| true` evita que um ambiente sem `.git` — improvável aqui, mas defensivo — derrube todo o `npm install`.

```bash
#!/usr/bin/env bash
# .githooks/pre-commit
set -euo pipefail

# D-18: pula o gate quando TODO o staged está sob .planning/ — sem isso,
# usar --diff-filter=ACMR (que exclui deletions) faria um `git rm` de um
# arquivo em src/ passar despercebido como "só doc" (verificado nesta sessão:
# uma deleção pura de src/foo.ts fica INVISÍVEL para --name-only quando
# filtrado por ACMR). Por isso o filtro abaixo NÃO usa --diff-filter.
staged=$(git diff --cached --name-only)
if [ -n "$staged" ] && ! echo "$staged" | grep -qv '^\.planning/'; then
  echo "pre-commit: staged é só .planning/ — pulando gate (D-18)."
  exit 0
fi

npm run gate
```

```bash
#!/usr/bin/env bash
# .githooks/pre-push — roda sempre, sem exceção (D-18)
set -euo pipefail
npm run gate
```

**Pitfall de path verificado nesta sessão:** o caminho absoluto deste repositório (`/Users/pedroalmeida/Desktop/Bioestatística LACIR`) contém um **espaço** (entre "Bioestatística" e "LACIR") — real e concreto, não hipotético. A acentuação em si (`í` = `c3 ad` em UTF-8, verificado via `xxd`) está em forma **precomposta (NFC)** neste filesystem, não decomposta (NFD) — então o medo original de "combining accent" não se confirma nesta máquina. O que importa de verdade: `git diff --cached --name-only` sempre devolve caminhos **relativos à raiz do repo** (nunca o prefixo absoluto), então o espaço/acento no caminho absoluto não afeta o parsing desse comando — só afetaria se o hook usasse `$(pwd)` ou `$0` sem aspas em algum outro lugar. Os hooks acima não fazem isso; se um plano futuro adicionar `cd`/`dirname "$0"`, deve manter aspas duplas.

**Edge case de rename documentado (não crítico, mas real):** `git diff --cached --name-only` mostra **só o caminho de destino** de um rename, nunca a origem (confirmado com `git mv`). Um rename hipotético que move um arquivo de `src/` para dentro de `.planning/` ficaria mascarado como "só doc" pelo destino, mesmo vindo de fora. Cenário raro neste projeto (não há fluxo que mova código para `.planning/`), mas vale documentar como limitação conhecida do D-18 em vez de fingir que não existe.

### Pattern 4: composição do `npm run gate` sem rodar `tsc` duas vezes (D-17)

**What:** `build` já roda `tsc -b` (que produz os mesmos erros que `tsc --noEmit`, confirmado nesta sessão rodando `npm run build` com os 2 erros atuais — para exatamente nos mesmos dois). Duas composições válidas, ambas evitando duplicação:

```jsonc
// Opção A (recomendada — DRY total, zero texto de comando duplicado)
{
  "scripts": {
    "gate": "npm run test:run && npm run build"
  }
}
```
`test:run` já encadeia `catalog:validate && vitest run` (existente, D-10 da Fase 5); `build` já é `tsc -b && vite build` (existente). `gate` não duplica nenhum comando — reusa os dois scripts como estão. Trade-off: `tsc -b` só roda *depois* dos ~18,7s de `vitest run`, então um erro de tipo trivial só aparece depois da suíte inteira.

```jsonc
// Opção B (fail-fast — typecheck primeiro, mas inline; risco de os dois
// scripts divergirem com o tempo se `build` mudar sem atualizar `gate`)
{
  "scripts": {
    "gate": "tsc -b && npm run test:run && vite build"
  }
}
```

Ambas cumprem D-17 (nenhuma roda `tsc` duas vezes) e cobrem exatamente "typecheck + test:run + build". A escolha é discricionária (CONTEXT.md marca isso explicitamente); a Opção A é a mais alinhada ao princípio "uma definição" que o próprio D-16 aplica ao gate como um todo — aplicado recursivamente, evita duplicar o *corpo* de `build` dentro de `gate`.

**Tempo total esperado:** `vitest run` mede 14,8–18,7s nesta máquina (duas medições nesta sessão); `catalog:validate` é ~0,04s; `tsc -b`/`vite build` não foram medidos limpos (o build está vermelho hoje), mas a ordem de grandeza usual do Vite para um projeto deste porte é de poucos segundos — consistente com a estimativa de "~25-30s por commit" já registrada em D-18.

### Anti-Patterns to Avoid

- **Sondar o método real do jsdom para decidir se precisa de stub:** é exatamente o padrão hoje em `src/test/setup.ts` (`needsGetContextStub`/`needsToDataURLStub` chamam o método real dentro de um `try`) — o jsdom não *lança* exceção para "not implemented" em `HTMLCanvasElement.getContext`/`toDataURL`, ele **imprime no console e retorna** (por isso o `try/catch` nunca pega nada, e o aviso já foi impresso antes do `if` decidir estabar). Substitua por stub incondicional (Code Examples).
- **Retipar `TEST_ICONS`/`activeTestId` sem tocar `isTestAvailable`:** compila até você tentar `setActiveTestId(id)` num branch guardado por `isTestAvailable(id)` — o guard precisa ser declarado como `id is TestId`, não como retorno `boolean` solto.
- **`--diff-filter=ACMR` sem incluir `D`:** exclui deletions do `--name-only`, fazendo o D-18 tratar silenciosamente a deleção de um arquivo fora de `.planning/` como "só doc" (reproduzido nesta sessão).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rodar um script antes de commit/push | Um "runner" de hooks customizado, ou reintroduzir husky | `core.hooksPath` + `.githooks/` versionado (nativo do git ≥2.9) | Husky é dependência nova (proibida); `core.hooksPath` é built-in do git desde 2016, documentado, e já suficiente para os 3 gatilhos (D-15/D-16) |
| Canvas/Chart.js em jsdom | Instalar o pacote `canvas` ou reimplementar um mock de contexto 2D completo | Stub mínimo `getContext`/`toDataURL` em `src/test/setup.ts`, incondicional — os testes já mockam `chart.js` inteiro via `vi.hoisted`, então o stub nunca precisa desenhar nada de verdade | Zero dependência nova (D-08); nenhum teste depende de pixel real, todos mockam Chart.js |
| União de tipo para ids de teste | Manter uma segunda lista de ids `type TestId = 't-student' \| 'correlacao' \| ...` escrita à mão, paralela a `TEST_REGISTRY` | `as const satisfies` + `(typeof TEST_REGISTRY)[number]['id']` | Duas listas paralelas é exatamente o padrão que já quebrou 2x nesta fase (`FlaskConical` sem entrada, `'demo'` fora do registry) — uma lista derivada não pode divergir da fonte |
| "Esperar o React terminar" em testes assíncronos | `setTimeout`/`await new Promise(r => setTimeout(r, N))` manual para dar tempo ao React de re-renderizar | `findByRole`/`waitFor` (já usado no projeto) combinado com `vi.useFakeTimers({shouldAdvanceTime:true})` + `userEvent.setup({advanceTimers})` (já usado em todos os 9 arquivos) | O projeto já resolveu esse problema para os passos que hoje passam — o helper novo só precisa seguir o mesmo idioma, não inventar um novo |

**Key insight:** todo problema desta fase já tem uma ferramenta nativa (git, TypeScript, Testing Library) resolvendo-o — a dívida acumulou porque essas ferramentas nativas não estavam conectadas (hooks nunca ativados, tipo nunca derivado, stub sondando em vez de substituir), não porque falte uma lib nova.

## Common Pitfalls

### Pitfall 1: hook presente mas inerte (silêncio, não erro)
**What goes wrong:** `.githooks/pre-commit` existe, está correto, mas não roda — e nada avisa (exceto o caso "não executável", que ao menos imprime um hint).
**Why it happens:** três causas verificadas nesta sessão: (a) clone novo sem `npm install` rodado ainda (prepare nunca ativou `core.hooksPath`); (b) `git config core.hooksPath` apontando para diretório inexistente (typo, rename) — zero warning; (c) bit executável perdido (raro em POSIX, mas hooks copiados por ferramentas que não preservam modo podem perder o bit).
**How to avoid:** não depender só do hook local — é exatamente por isso que D-15 exige os dois lugares (`.githooks/` **e** `.github/workflows/ci.yml`); o CI não pode ficar "silenciosamente inerte" da mesma forma, porque roda sempre que há push, independente de configuração local.
**Warning signs:** um commit "vermelho" (typecheck ou teste quebrado) que passou sem erro nenhum do gate — sinal de que o hook não rodou.

### Pitfall 2: `--diff-filter=ACMR` mascara deleções
**What goes wrong:** um `git rm src/algumaCoisa.ts` staged sozinho (sem nenhum outro arquivo) resulta em `git diff --cached --name-only --diff-filter=ACMR` **vazio** — o hook D-18 leria isso como "staged só .planning/" e pularia o gate.
**Why it happens:** `--diff-filter=ACMR` inclui Added/Copied/Modified/Renamed mas **exclui Deleted** por padrão — reproduzido nesta sessão com um `git rm` isolado.
**How to avoid:** não usar `--diff-filter` no comando do D-18 (deixe o filtro default, que inclui tudo) — só use `--diff-filter` explícito se a intenção for algo mais estreito, e nesse caso inclua `D`.
**Warning signs:** um PR/commit que remove um arquivo de produção sem nunca acionar o gate localmente.

### Pitfall 3: sondar o canvas real imprime o próprio aviso que você queria evitar
**What goes wrong:** o padrão atual em `setup.ts` (`needsGetContextStub`) chama `proto.getContext.call(...)` com o método **real, não substituído ainda** do jsdom, só para decidir se aplica o stub. O jsdom não lança exceção para "not implemented" nesses dois métodos — ele imprime via `console.error` e retorna um valor (então o `try/catch` do código atual nunca pega nada, e o aviso já foi emitido antes de qualquer decisão).
**Why it happens:** confusão entre "not implemented lança exceção" (verdade para alguns métodos do jsdom) e "not implemented loga e retorna" (verdade para `HTMLCanvasElement.getContext`/`toDataURL` especificamente) — verificado nesta sessão: contagem de avisos bate exatamente com `95 arquivos × 2 chamadas de sondagem` (190).
**How to avoid:** substituir o método incondicionalmente, sem chamar o original primeiro (Code Examples).
**Warning signs:** contagem de avisos igual a `2 × número de arquivos de teste` — assinatura específica desse bug, não de canvas sendo usado de verdade (todos os testes mockam `chart.js`, confirmado por grep nesta sessão: 13/13 arquivos que importam `chart.js` também o mockam).

### Pitfall 4: retipar `TEST_ICONS` quebra a própria linha que motivou a fase
**What goes wrong:** trocar `Record<string, LucideIcon>` por `Record<TestId, LucideIcon>` e manter `TEST_ICONS[entry.id]` sem ajuste produz `TS7053: Element implicitly has an 'any' type because expression of type 'string' can't be used to index type 'Record<TestId, LucideIcon>'` — reproduzido nesta sessão.
**Why it happens:** `entry: TestRegistryEntry` (prop do componente) tem `id: string` genérico por design — não deveria depender do union `TestId` só para ser renderizável isoladamente em teste.
**How to avoid:** o lookup passa por uma função helper com cast controlado (`iconFor`, ver Code Examples) — a declaração do objeto continua exaustiva (pega erro de compilação se faltar ícone), a leitura continua tolerante a ids desconhecidos em runtime.
**Warning signs:** erro `TS7053` ou `TS2345` aparecendo em `SidebarTestLink.tsx` durante a implementação de D-14.

### Pitfall 5: `setActiveTestId(id)` para de compilar silenciosamente ao apertar o tipo
**What goes wrong:** depois de `useState<TestId>('t-student')`, qualquer chamada `setActiveTestId(id)` onde `id: string` (não narrowed) vira erro `TS2345`.
**Why it happens:** `isTestAvailable(id: string): boolean` (forma atual) não dá ao compilador nenhuma informação para estreitar `string` → `TestId` depois do `if`.
**How to avoid:** `isTestAvailable(id: string): id is TestId` — muda só a assinatura de tipo, zero mudança de comportamento runtime; TypeScript passa a estreitar corretamente dentro do `if (isTestAvailable(id)) { ... }` e também no padrão de early-return (`if (!isTestAvailable(id)) return; ...`), confirmado nesta sessão.
**Warning signs:** `TS2345` apontando para `setActiveTestId(handoffId)` ou `setActiveTestId(testId)` em `EstatisticaPage.tsx`.

### Pitfall 6: "arquivo de CI existe" ≠ "bloqueia merge"
**What goes wrong:** o plano/execução declara SC#5 ("gate bloqueia merge") satisfeito só por commitar `.github/workflows/ci.yml`.
**Why it happens:** GitHub só permite selecionar um status check como **obrigatório** (branch protection / required status checks) depois que esse check **já rodou pelo menos uma vez** no branch protegido — e branch protection em si é uma configuração manual (UI ou `gh api`) que só existe depois que o repositório tem um remote no GitHub. Este repositório **não tem remote hoje**.
**How to avoid:** documentar honestamente os dois estágios: (1) esta fase entrega o workflow versionado, correto e testável localmente via `act`-like reasoning; (2) "bloqueia merge de verdade" só se completa depois que alguém: cria o repo remoto, faz o primeiro push, deixa o workflow rodar uma vez no branch padrão, e então configura branch protection apontando para o nome do job. Isso é trabalho fora do controle do código desta fase — é operação de conta GitHub.
**Warning signs:** nenhum — é uma limitação estrutural, não um bug; só precisa estar documentada para não virar uma falsa sensação de segurança.

### Pitfall 7: Node 25 (local) é uma escolha de pin ruim para o CI
**What goes wrong:** copiar a versão do Node local (`node --version` → v25.9.0) para `actions/setup-node@v7` com `node-version: 25`.
**Why it happens:** Node 25 é release ímpar (modelo antigo, pré-mudança de outubro/2026) — atingiu EOL em 01/06/2026, quase 2 meses antes da data desta pesquisa.
**How to avoid:** usar Node 24 (`Krypton`, Active LTS até abril/2028) — satisfaz o mínimo do Vite 8 com folga.
**Warning signs:** nenhum imediato (o CI rodaria normalmente numa imagem com Node 25 ainda disponível no runner por um tempo), mas é dívida técnica silenciosa — o runner vai parar de oferecer essa versão eventualmente.

## Code Examples

### Stub de canvas incondicional (substitui o padrão de sondagem)

```typescript
// src/test/setup.ts — trecho do stub, reescrito
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// jsdom não implementa canvas de verdade. Os métodos "not implemented" do
// jsdom LOGAM no console e retornam (não lançam) — por isso sondar o método
// real antes de decidir se stuba é o que produz os 190 avisos: a própria
// sondagem já dispara o log. Substitua incondicionalmente, sem chamar o
// original primeiro. Todo teste que usa Chart.js já mocka `chart.js`
// inteiro via vi.hoisted, então este stub nunca precisa desenhar nada real.
const proto = HTMLCanvasElement.prototype;
const noop = () => {};
const contextStub = new Proxy({}, { get: () => noop });

proto.getContext = (() => contextStub) as unknown as typeof proto.getContext;
proto.toDataURL = (() => 'data:image/png;base64,stub') as typeof proto.toDataURL;
```

### `role="region"` para `<section aria-label>` — verificado empiricamente nesta sessão

```typescript
// Reproduzido com @testing-library/react 16.3.2 + @testing-library/dom 10.4.1
// + aria-query 5.3.0 (as versões exatas deste projeto):
render(
  <div>
    <section aria-label="Dados e configuração">A</section>
    <section aria-label="Resultados">B</section>
  </div>,
);
screen.getByRole('region', { name: 'Resultados' });          // passa
screen.getByRole('region', { name: 'Dados e configuração' }); // passa, sem ambiguidade
```
Confirma a premissa de D-07: `<section>` com nome acessível (`aria-label`) resolve para `role="region"` neste ambiente exato — sem marcação só-para-teste.

### Type guard + registry derivado + fallback de ícone (os 3 juntos, testados nesta sessão)

Ver Pattern 2 acima — os três trechos (`as const satisfies`, `id is TestId`, `iconFor` com cast) foram cada um verificado isoladamente com `tsc --noEmit --strict` contra as mesmas flags do `tsconfig.json` deste projeto (`target ES2022`, `moduleResolution bundler`, `strict`).

### Workflow mínimo de CI (Node 24, cache npm, `npm ci` + `npm run gate`)

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: 'npm'
      - run: npm ci
      - run: npm run gate
```
`node-version: 24` evita pinar numa runtime já em EOL (Pitfall 7). `cache: 'npm'` usa `package-lock.json` (presente e versionado) como chave de cache — built-in do `actions/setup-node`, sem step de `actions/cache` manual. `npm ci` (não `npm install`) para reprodutibilidade, e dispara o `prepare` script normalmente (inofensivo em CI, ver Pattern 3).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `layout="stepper"` como default do `FlowSteps`, com nav clicável | `layout="scroll"` como única forma (stepper removido) | Nesta fase (D-01/D-02) | 10 call sites perdem `onStepChange`/`layout`; `FLOW_STEP_LABELS` e `Check` (lucide) saem |
| Sondar `HTMLCanvasElement.getContext` real para decidir se stuba | Stub incondicional, nunca chama o original | Nesta fase (D-08) | 190 avisos → 0, sem custo de performance perceptível (stub é `noop`) |
| `TEST_ICONS: Record<string, LucideIcon>` (aceita qualquer string) | `Record<TestId, LucideIcon>` exaustivo + `iconFor()` com fallback tolerante | Nesta fase (D-14) | Faltar ícone num id novo do registry vira erro de compilação, não bug silencioso em produção |
| `activeTestId: string`, `pageTitle = getTestById(id)?.title ?? 'Estatística'` | `activeTestId: TestId`, sem fallback (id inexistente é erro de tipo) | Nesta fase (D-11) | Fallback "inalcançável" (a mesma categoria do `FlaskConical`) deixa de existir por construção |
| Node 25 (Current, não-LTS) como implícito no ambiente local | Node 24 (Active LTS) recomendado para pin do CI | Node 25 EOL em 01/06/2026 [CITED] | Evita CI dependente de uma runtime já sem patches de segurança |
| `actions/checkout@v4`/`setup-node@v4` (conhecimento de treinamento defasado) | `actions/checkout@v7`, `actions/setup-node@v7` (confirmado via API do GitHub nesta sessão) | v5 dessas actions migrou para runtime node24 em 2026; v6/v7 seguiram | Usar tags antigas na v4 ainda funciona (não quebram), mas ficam progressivamente mais distantes do runtime atual do Actions |

**Deprecated/outdated:**
- Reporter `basic` do Vitest: removido na v4 (o projeto já está em v4.1.10, então isso só importa se algum script futuro tentar `--reporter=basic`).
- `husky`: não usado neste projeto e propositalmente evitado (D-15) — mencionado aqui só para registrar que a alternativa nativa (`core.hooksPath`) foi a escolha deliberada, não uma omissão.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | O branch padrão do repositório remoto, quando criado, se chamará `main` (usado como gatilho do `ci.yml`) | Code Examples (workflow) | Se o remoto usar outro nome de branch padrão, o workflow não dispara até o `on:` ser ajustado — baixo custo de correção, um `push`/`pull_request` a mais no `branches:` |
| A2 | Os warnings de `act(...)` (21) desaparecem em sua maioria/totalidade como efeito colateral de trocar `waitFor(() => getByRole('button',{name:'Resultados'}))` (que falha e re-tenta até timeout) por `findByRole('region', {name:'Resultados'})` (que resolve rápido quando existe) | Common Pitfalls / Pattern 1 | Se algum warning persistir, é sinal de uma atualização de estado assíncrona genuinamente fora de um `user.click`/`findBy*` — precisa de `act()` explícito pontual; risco baixo (raciocínio ancorado no código real, mas não comprovado por reprodução do estado *pós*-rewrite, que ainda não existe) |
| A3 | O tempo total de `npm run gate` fica na faixa de ~25-40s nesta máquina | Pattern 4 | Estimativa combina uma medição real (`vitest run` 14,8-18,7s) com uma extrapolação não medida (`tsc -b` + `vite build`, hoje vermelhos) — se ficar muito acima disso, D-18 (pular gate em commit só-doc) fica ainda mais importante, mas não muda a mecânica de nenhuma decisão |
| A4 | Runner do GitHub Actions recomendado é `ubuntu-latest` (não especificado em nenhuma decisão do CONTEXT) | Code Examples (workflow) | Decisão de baixíssimo risco — projeto é puro Node/Vite, sem dependência de SO; `ubuntu-latest` é o padrão de fato do ecossistema |

**Se esta tabela parecer pequena:** é porque a maioria dos achados desta pesquisa foi verificada por reprodução direta neste repositório (comandos rodados nesta sessão) ou por consulta à API/documentação oficial, não por conhecimento de treinamento não verificado.

## Open Questions

1. **Opção A vs. B de composição do `gate` (Pattern 4)**
   - What we know: ambas evitam rodar `tsc` duas vezes; ambas cobrem typecheck+test+build.
   - What's unclear: se o time prefere fail-fast (B, com risco de duplicação textual futura) ou DRY total (A, com typecheck só depois da suíte).
   - Recommendation: Opção A por padrão — CONTEXT.md deixa isso como discricionário do executor; nenhuma das duas viola D-17.

2. **Pin por SHA das GitHub Actions (endurecimento de supply chain)**
   - What we know: `actions/checkout`/`setup-node` são primeira-parte GitHub, risco baixo; pin por tag major (`@v7`) já é prática comum.
   - What's unclear: se o projeto quer o endurecimento extra de pin por commit SHA (mais seguro contra um major tag ser recomprometido, mas exige atualização manual mais frequente).
   - Recommendation: tag major (`@v7`) é suficiente para este projeto (baixo risco, sem segredos de produção no bundle) — não vale a fricção operacional extra agora; revisitar se o projeto crescer em superfície de CI.

3. **Nome/assinatura exata do helper de teste**
   - Já marcado como discricionário no CONTEXT — não é uma lacuna de pesquisa, é uma decisão do executor. `runToResultados(user)` (Pattern 1) é uma sugestão concreta e testável, não uma prescrição.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Rodar toda a suíte/build local | ✓ | v25.9.0 (local; **não recomendado como pin do CI** — ver Pitfall 7) | usar Node 24 no CI |
| npm | Scripts, `npm ci` | ✓ | 11.12.1 | — |
| git | Hooks, `--diff-filter`, `core.hooksPath` | ✓ | 2.39.5 (≥ 2.9 necessário para `core.hooksPath`) | — |
| vitest (via npx) | Suíte de testes | ✓ | 4.1.10 (reporter `basic` removido, não usado hoje) | — |
| gh (GitHub CLI) | Nenhum uso necessário na implementação desta fase | ✓ | 2.93.0 | — (só usado nesta pesquisa para consultar tags via API pública, não requerido pela fase) |
| Remote GitHub do projeto | "Bloquear merge" de fato (SC#5, parte 2) | ✗ | — | Nenhum — é uma etapa fora do escopo de código; documentar como limitação honesta (Pitfall 6), não bloqueante para os outros 4 critérios de sucesso |

**Missing dependencies with no fallback:**
- Remote GitHub configurado + branch protection — não bloqueia a fase (o workflow ainda deve ser entregue correto e versionado), mas SC#5 só se completa integralmente depois dessa etapa manual, fora do controle do código.

**Missing dependencies with fallback:**
- Nenhuma outra.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`environment: 'jsdom'`, `globals: true`, config em `vite.config.ts` bloco `test`) |
| Config file | `vite.config.ts` (não há `vitest.config.*` separado) |
| Setup file | `src/test/setup.ts` (roda antes de cada arquivo de teste) |
| Quick run command | `npx vitest run <caminho-do-arquivo>` (ex.: `npx vitest run src/shared/flow/FlowSteps.test.tsx`) |
| Full suite command | `npm run test:run` (= `catalog:validate && vitest run`, ~15-19s medidos nesta sessão) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QA-01 | `tsc --noEmit` termina sem erro | typecheck | `npm run typecheck` | ✅ script já existe |
| QA-02 | Suíte inteira passa, sem falha conhecida | unit/integration (Vitest+RTL) | `npm run test:run` | ✅ script já existe; 24 falhas atuais em 9 arquivos precisam ser reescritas, não puladas |
| QA-03 | Passar é pré-condição de commit; falha nova é distinguível de dívida | integration (git hook) | commit de teste deliberadamente vermelho contra `.githooks/pre-commit` ativo, espera exit ≠ 0 e nenhum commit criado | ❌ Wave 0 — hooks ainda não existem |
| QA-04 | Registrar teste sem ícone não derruba o sidebar | unit (component, `SidebarTestLink` isolado) | `npx vitest run src/routes/estatistica/SidebarTestLink.test.tsx` (arquivo novo) | ❌ Wave 0 — não existe teste dedicado a `SidebarTestLink` hoje |
| SC#3 (23 testes no layout scroll) | 23 testes reescritos cobrem a mesma jornada Dados→Configurar→Resultados | integration (RTL) | `npm run test:run` (mesmos 9 arquivos, reescritos) | 🔶 arquivos existem, precisam reescrita completa dos casos afetados |
| SC#5 (gate bloqueia merge) | pre-commit/pre-push locais + workflow do Actions, todos chamando `npm run gate` | manual + integration | local: simular commit/push vermelho contra os hooks (ver acima); remoto: só verificável após push real + configuração de branch protection (fora do escopo de código, ver Pitfall 6) | ❌ Wave 0 para a parte local; parte remota é humana/operacional |

### Sampling Rate

- **Per task commit:** `npx vitest run <arquivo(s) tocados>` + `npm run typecheck` (rápido, feedback imediato durante a reescrita dos 9 arquivos)
- **Per wave merge:** `npm run test:run` (suíte completa, ~15-19s) + `npm run typecheck`
- **Phase gate:** `npm run gate` completo (typecheck-equivalente + test:run + build) verde, **e** prova mecânica de que o hook local bloqueia (não apenas existe) antes de `/gsd:verify-work`

### Como provar "suíte verde E silenciosa" (D-08)

```bash
# 1. Verde: nenhuma falha
npx vitest run 2>&1 | tee /tmp/vitest-out.txt
grep -c "failed" /tmp/vitest-out.txt   # deve refletir "0 failed" no sumário

# 2. Silenciosa: zero avisos de canvas E zero avisos de act()
grep -c "Not implemented: HTMLCanvasElement" /tmp/vitest-out.txt   # espera: 0
grep -c "was not wrapped in act" /tmp/vitest-out.txt               # espera: 0
```
Essa é literalmente a mesma técnica usada nesta pesquisa para confirmar a contagem de 190/21 no estado atual — reaplicar depois da correção com a expectativa invertida (0/0).

### Como provar que o gate de fato bloqueia (não só existe)

```bash
# Cenário 1 — pre-commit bloqueia um typecheck sujo
echo "const x: number = 'oops';" >> src/algumArquivoQualquer.ts
git add src/algumArquivoQualquer.ts
git commit -m "deveria falhar"
echo "exit code esperado: != 0, e nenhum commit novo em git log"
git checkout -- src/algumArquivoQualquer.ts   # limpa o experimento

# Cenário 2 — pre-commit PULA em commit só-.planning (D-18)
echo "nota" >> .planning/notes/scratch.md
git add .planning/notes/scratch.md
git commit -m "só doc, deveria ser instantâneo"
# confirma que o gate completo (15-19s+) NÃO rodou — commit deve ser quase imediato
git reset --soft HEAD~1 && git restore --staged .planning/notes/scratch.md
rm .planning/notes/scratch.md

# Cenário 3 — pre-push roda mesmo com --no-verify no commit (D-18 só vale pro pre-commit)
# (requer um remote de teste local, ex. `git init --bare /tmp/remote-test.git`,
#  fora do escopo de reprodução nesta pesquisa, mas mecânica idêntica ao Cenário 1)
```

### Como provar QA-04 concretamente (ícone ausente não derruba o sidebar)

```typescript
// src/routes/estatistica/SidebarTestLink.test.tsx (arquivo novo, Wave 0)
import { render, screen } from '@testing-library/react';
import { SidebarTestLink } from './SidebarTestLink';
import type { TestRegistryEntry } from '@/features/tests/registry';

it('renders a registry entry with no matching icon without throwing (QA-04)', () => {
  // Construído fora de TEST_REGISTRY de propósito — contorna a exaustividade
  // do tipo TestId (que é por design, ver Pattern 2) para provar o fallback
  // de runtime que TEST_ICONS sozinho não cobre mais.
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

  // FlaskConical deve estar presente como fallback visual (aria-hidden, então
  // via presença do próprio botão/role, não do ícone em si).
  expect(screen.getByRole('button', { name: entrySemIcone.title })).toBeInTheDocument();
});
```

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` (`.planning/config.json`). Fase 7 não introduz nenhuma superfície nova de autenticação, sessão, entrada de usuário ou criptografia — é infraestrutura de desenvolvimento (testes, git, CI). A maioria das categorias ASVS não se aplica.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não | nenhuma superfície de auth tocada nesta fase |
| V3 Session Management | não | idem |
| V4 Access Control | não | idem |
| V5 Input Validation | não diretamente | os testes reescritos continuam validando o mesmo `useTabularInput`/parsing já existente, sem mudança de comportamento (CONTEXT: "Fase 7 não muda comportamento de produção") |
| V6 Cryptography | não | idem |
| *(fora do catálogo ASVS padrão, mas relevante)* — segurança de supply chain de CI | **sim** | fixar GitHub Actions por tag major de organização verificada (`actions/*`), nunca por branch móvel (`@main`); considerar pin por SHA como endurecimento futuro (Open Questions #2) |

### Known Threat Patterns for este contexto (dev tooling / CI)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Action de terceiro comprometida via tag flutuante | Tampering | Fixar por tag major versionada de organização confiável (`actions/checkout@v7`, não `@main`); ambas confirmadas nesta sessão como mantidas por `github.com/actions` |
| Hook local mal-intencionado herdado de um clone não confiável | Tampering | `core.hooksPath` só aponta para `.githooks/` **dentro do repositório versionado** — não há hooks externos ao repo sendo executados; `prepare` script é auditável no `package.json` |
| Segredo em texto plano exposto por push futuro (`INGEST_SECRET`, ver ROADMAP "Riscos") | Information Disclosure | **Fora do escopo desta fase** — CONTEXT.md marca explicitamente como Fase 9; esta fase só cria o diretório `.githooks/` onde uma futura varredura de segredo pré-push poderia morrer, sem implementá-la agora |

Nenhum item acima bloqueia a fase em `security_block_on: "high"` — não há achado de severidade alta nesta pesquisa; o item de supply chain de Actions é uma recomendação de boa prática (tag major, já a prática padrão do ecossistema), não uma vulnerabilidade identificada.

## Sources

### Primary (HIGH confidence — reproduzido nesta sessão neste repositório)

- `npm run typecheck`, `npx vitest run`, `npm run build` rodados diretamente — confirmam os 2 erros de tipo e as 24 falhas do ground truth, byte a byte
- `tsc --noEmit --strict` isolado, 4 experimentos ad-hoc (union derivado, type guard, `Record` exaustivo + fallback, `@ts-expect-error`) — todos descartados após verificação, não fazem parte do commit
- Testes de mecânica de git hooks (`core.hooksPath`, bit executável, `--diff-filter`, rename, diretório ausente) em repositório descartável sob `/private/tmp` — não neste repositório de produção
- Teste ad-hoc de `role="region"` com `@testing-library/react`/`dom` exatas deste projeto
- Leitura direta de código-fonte: `FlowSteps.tsx`, `FlowSteps.test.tsx`, `SidebarTestLink.tsx`, `registry.ts`, `EstatisticaPage.tsx`, `router.test.tsx`, `ReviewAnalysisDialog.test.tsx`, `mapAnalysisState.ts`, `ColumnPreviewTable.tsx`, `src/test/setup.ts`, `vite.config.ts`, `tsconfig.json`, `package.json`, os 9 arquivos de teste listados no CONTEXT
- `GET https://api.github.com/repos/actions/checkout/tags` e `.../actions/setup-node/tags` — confirmam `@v7` como major atual de ambas as Actions

### Secondary (MEDIUM confidence — WebSearch/WebFetch verificado contra fonte oficial)

- [Node.js — End-Of-Life](https://nodejs.org/en/about/eol) e [Node.js Version Support: EOL Dates (HeroDevs, julho/2026)](https://www.herodevs.com/blog-posts/node-js-end-of-life-dates-you-should-be-aware-of) — Node 25 EOL 01/06/2026, Node 24 Active LTS até abril/2028
- [Vite 8.0 Released](https://vite.dev/blog/announcing-vite8) — mínimo Node 20.19+/22.12+
- README oficial (`raw.githubusercontent.com/actions/setup-node/v7/README.md`) — sintaxe exata de `with:` (`node-version`, `cache`, `package-manager-cache`)
- [Troubleshooting required status checks (GitHub Docs, via WebSearch)](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks) — confirma que um check só pode virar "required" depois de já ter rodado no branch protegido

### Tertiary (LOW confidence — nenhum item desta pesquisa ficou sem verificação cruzada)

- Nenhum.

## Metadata

**Confidence breakdown:**
- Mecânica de git hooks / gate: HIGH — testado empiricamente em repositório descartável, comportamento reproduzido, não é conhecimento de treinamento
- Padrões de TypeScript (union derivado, type guard, Record exaustivo): HIGH — cada um verificado com `tsc --noEmit --strict` contra as flags exatas deste projeto
- Causa raiz dos 190 avisos de canvas: HIGH — contagem bate exatamente (190 = 95 arquivos × 2), lida diretamente do código de `setup.ts`
- Node 25 EOL / recomendação Node 24 para CI: MEDIUM-HIGH — múltiplas fontes concordam (nodejs.org, HeroDevs), mas depende de uma busca web datada da "data atual" da sessão (julho/2026), não de verificação local
- Hipótese de que os 21 avisos de `act()` desaparecem com a reescrita: MEDIUM — raciocínio ancorado no código real, mas não comprovado por reprodução pós-rewrite (marcado A2 em Assumptions Log)
- Mecânica de branch protection / "bloqueia merge": MEDIUM — WebSearch cross-referenciado com múltiplas discussões da comunidade GitHub, consistente entre si, mas não testado neste repositório (sem remote)

**Research date:** 2026-07-28
**Valid until:** ~30 dias para a mecânica de TypeScript/git/Vitest (estável); ~7-14 dias para as recomendações de versão do Node/GitHub Actions no CI (ecossistema de release rápido — Node 26 vira LTS em outubro/2026, o que pode mudar a recomendação de pin antes do fim do milestone v3.0)
