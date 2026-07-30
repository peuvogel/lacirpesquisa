---
phase: 07-baseline-verde
verified: 2026-07-30T00:07:06Z
status: human_needed
score: 9/9 must-haves verified (SC#5 verificado no código; 2 itens de infraestrutura pendentes de decisão humana)
overrides_applied: 0
human_verification:
  - test: "Confirmar que o workflow do GitHub Actions (`gate`) bloqueia merge de verdade"
    expected: "Depois de criar o remote no GitHub, fazer o primeiro push, abrir um PR e marcar `gate` como required status check em Settings → Branches, um PR com suíte vermelha ou typecheck sujo deve ficar bloqueado para merge"
    why_human: "Requer conta/repositório remoto no GitHub e configuração de branch protection — infraestrutura que não existe neste repositório hoje (`git remote -v` vazio). Não é algo que grep ou execução local consiga provar."
  - test: "Confirmar que `core.hooksPath` sobrevive a um clone novo"
    expected: "Clonar o repositório em um diretório temporário, rodar `npm install` e confirmar que `git config core.hooksPath` devolve `.githooks`"
    why_human: "`core.hooksPath` é configuração local do git e nunca viaja com o clone; só o script `prepare` do npm a recria. Provar isso exige um clone físico novo, fora do escopo de uma verificação sobre o próprio working tree."
---

# Phase 7: Baseline verde — Verification Report

**Phase Goal:** O desenvolvedor consegue distinguir uma regressão nova de dívida herdada — a suíte volta a ser sinal
**Verified:** 2026-07-30T00:07:06Z
**Status:** human_needed
**Re-verification:** No — verificação inicial

## Goal Achievement

Todas as medições abaixo foram feitas por execução direta neste verificador (não herdadas de SUMMARY.md), com a working tree limpa (`git status --porcelain` vazio) na branch `gsd/v3.0-dados-confiaveis-supabase`, HEAD em `ba48055`.

```
npm run typecheck  → exit 0
npx vitest run     → exit 0, 681 passed / 681 total, 97 arquivos, 0 skipped
npm run build      → exit 0
grep -c "Not implemented: HTMLCanvasElement" <saída da suíte> → 0
grep -c "was not wrapped in act" <saída da suíte>             → 0
grep -rn "it.skip|it.todo|xit(|describe.skip|test.skip|.failing(" src → nenhum resultado
git diff --stat package-lock.json → vazio
grep -rc "stepper" src/ → nenhuma ocorrência
git config core.hooksPath → .githooks
git ls-files -s .githooks/ → pre-commit 100755, pre-push 100755
```

Essas medições reproduzem, de forma independente, o que o orquestrador mediu imediatamente antes de despachar este verificador — nenhum número foi aceito por citação do SUMMARY.md.

### Observable Truths

| # | Truth (Success Criteria do ROADMAP) | Status | Evidence |
|---|---|---|---|
| 1 | `npm run typecheck` termina sem erros | ✓ VERIFIED | Executado neste verificador: exit 0, zero erros |
| 2 | `npm run test:run` passa integralmente, sem teste marcado como falha conhecida | ✓ VERIFIED | `npx vitest run`: 681/681 em 97 arquivos, 0 skipped; `grep -rn "it.skip\|it.todo\|xit(\|describe.skip\|test.skip\|.failing("  src` sem resultado; `npm run build` (que `gate` também executa) exit 0 |
| 3 | Os 24 testes que dirigiam o fluxo pelo stepper agora exercitam o layout `scroll`, cobrindo a mesma jornada Dados → Configurar → Resultados | ✓ VERIFIED | Ver seção "SC#3 — inspeção linha a linha" abaixo. Os 9 arquivos foram lidos por completo; todas as asserções didáticas (`'O que isso significa?'`, `'Baixar todos'`, `assumption-nudge-strip`, nudges de superdispersão/eventos raros, alertas de soft-reset `'Modo alterado.'`, handoffs de CTA cross-teste, abas de gráfico do Prais-Winsten) sobreviveram verbatim |
| 4 | Registrar um teste novo sem ícone próprio não derruba o sidebar | ✓ VERIFIED | `SidebarTestLink.test.tsx` constrói `entrySemIcone` com `id: 'novo-teste-sem-icone'` **fora** de `TEST_REGISTRY`/`TEST_ICONS` e prova runtime: `render(...)` não lança, `getByRole('button', {name: 'Novo teste sem ícone'})` presente, `<svg>` (o fallback `FlaskConical`) renderizado. `TEST_ICONS: Record<TestId, LucideIcon>` é exaustivo por tipo (cadastrar um 10º teste sem entrada vira `TS2741`) |
| 5 | Um gate de CI bloqueia merge com teste vermelho ou typecheck sujo | ⚠ VERIFIED com ressalva honesta (ver Human Verification) | Código 100% entregue e provado bloqueante localmente: `npm run gate` = `test:run && build` (cobre typecheck via `tsc -b`, sem duplicar `tsc`); `.githooks/pre-commit`/`pre-push` versionados, modo `100755`, `core.hooksPath` ativo; `.github/workflows/ci.yml` correto e sintaticamente válido. **Mas** o repositório não tem remote (`git remote -v` vazio) — "bloqueia merge" de fato depende de infraestrutura de GitHub que ainda não existe. 07-07-SUMMARY.md e 07-VALIDATION.md disclosuram isso explicitamente ("Pendente e operacional... Nenhum dos dois é código"), sem superclaim |

**Score:** 5/5 truths do ROADMAP verificadas (SC#5 com ressalva honestamente documentada, tratada como human-verification, não como gap)

### Requisitos QA (frontmatter dos planos)

| Requirement | Descrição (REQUIREMENTS.md) | Status | Evidence |
|---|---|---|---|
| QA-01 | `npm run typecheck` passa sem erros | ✓ SATISFIED | Confirmado por execução direta |
| QA-02 | A suíte de testes passa integralmente, e passar é pré-condição de commit | ✓ SATISFIED | 681/681 verde; `pre-commit`/`pre-push` chamam `npm run gate` (que inclui `test:run`), provado bloqueante nos 3 cenários do 07-07-SUMMARY.md |
| QA-03 | Nenhum teste fica vermelho "conhecido" — uma falha nova é distinguível de dívida herdada | ✓ SATISFIED | Zero `it.skip`/`it.todo`/`xit`/`.failing(` em `src/`; zero teste comentado; a suíte inteira está verde, não "verde com exceções conhecidas" |
| QA-04 | Registrar um teste novo sem ícone próprio não derruba o sidebar | ✓ SATISFIED | Ver truth #4 acima — prova de runtime, não só de tipo |

Todos os 4 IDs (`QA-01..QA-04`) declarados no frontmatter dos planos (07-01, 07-06, 07-07) batem com os 4 IDs listados em `.planning/REQUIREMENTS.md` §"Baseline / Saúde do código", todos marcados `[x]`. Nenhum requisito órfão encontrado — não há nenhum ID QA-0x em REQUIREMENTS.md que não apareça em algum plano desta fase.

### SC#3 — inspeção linha a linha (ponto de maior risco de fraude)

Lidos por completo (não apenas grepados) os 9 arquivos reescritos. Resumo por arquivo, com contagem de casos preservada e asserção didática confirmada presente:

| Arquivo | `it(` (antes → depois) | Asserção didática que sobreviveu | Observação |
|---|---|---|---|
| `AnovaTukeyTest.test.tsx` | 3 → 3 | `'Comparações par a par'`, `columnheader 'Contraste'/'p ajustado'`, CTA `onNavigateTest('kruskal-dunn', ...)`, `'Modo alterado.'` | usa `runToResultados` nos 3 casos |
| `KruskalDunnTest.test.tsx` | 3 → 3 | `assumption-nudge-strip` com texto de ranks, `'Comparações par a par'`, `'Modo alterado.'` | idem |
| `LogisticaTest.test.tsx` | 3 → 3 | `OR (dose)`, nudge `/eventos raros/i`, `'Modo alterado.'` | idem |
| `BinomialNegativaTest.test.tsx` | 3 → 3 | `assumption-nudge-strip`, `θ (dispersão)` (escopado com `within(resultados)` após ambiguidade real descoberta durante a execução), handoff de sessão do Poisson, `'Modo alterado.'` | única correção pontual: escopo de query, não perda de asserção |
| `PoissonTest.test.tsx` | 4 → 4 | nudge `/superdispersão/i`, CTA `onNavigateTest('binomial-negativa', {contagem, preditor})`, `'Modo alterado.'` sem 2º clique em 'Configurar' | soft reset traduzido fielmente |
| `PraisWinstenTest.test.tsx` | 3 → 3 | preview da série (`'Prévia da série temporal'`, `'120,4'`), abas `'Tendência'`/`'Resíduos'` + `'Prais-Winsten: resíduos'` | único caso que não usa o helper (preview vive antes da confirmação), justificado e correto |
| `QuiQuadradoTest.test.tsx` | 2 → 2 | `'Pressupostos'` (escopado com `within(resultados)`), `'Modo alterado.'` | mesma classe de correção do Binomial Negativa |
| `TesteDemo.test.tsx` | 3 → 3 | `'keeps Resultados locked...'` traduzido por `queryByRole('region',...).not.toBeInTheDocument()` — ausência de região prova "travado" no layout scroll | não usa o helper, por desenho |
| `router.test.tsx` | 5 → 6 | rota (`#lacir-test-module-mount` + botão `'Qual teste usar?'`) e teste padrão (`data-active-test-id='t-student'` + heading `'t de Student'`) separados em 2 casos independentes | +1 caso líquido (D-12) |

Zero ocorrência de `aria-current` ou `name: 'Configurar'` nos 9 arquivos de módulo/demo. `grep -c "runToResultados"` confirma o helper compartilhado em uso nos 8 dos 9 arquivos que chegam a Resultados (Prais-Winsten preview e TesteDemo "travado" são as duas exceções estruturais documentadas em D-07, e ambas foram implementadas exatamente como travado, não contornadas).

**Aritmética da contagem de testes fechada:** 676 (ground truth) + 3 novos (`SidebarTestLink.test.tsx`) + 3 novos (`flowHelpers.test.tsx`) − 2 líquidos (`FlowSteps.test.tsx`: 7 → 5) + 1 líquido (`router.test.tsx`: 5 → 6, split de D-12) = **681**, batendo exatamente com o número medido (`681 passed / 681 total`). Nenhuma divergência não explicada.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/features/tests/registry.ts` | `TestId` derivado via `as const satisfies`, `isTestAvailable` como type guard | ✓ VERIFIED | Lido por completo; `TEST_REGISTRY` fechado com `as const satisfies readonly TestRegistryEntry[]`, `export type TestId = (typeof TEST_REGISTRY)[number]['id']`, `getTestById` sobrecarregado, `isTestAvailable(id): id is TestId` |
| `src/routes/estatistica/SidebarTestLink.tsx` | `TEST_ICONS` exaustivo + `iconFor` com fallback de runtime | ✓ VERIFIED | `Record<TestId, LucideIcon>` com 9 chaves; `iconFor` faz cast controlado com fallback `FlaskConical` |
| `src/routes/estatistica/SidebarTestLink.test.tsx` | Prova executável de QA-04 | ✓ VERIFIED | Entry construída fora do registry, 3 casos, todos passando |
| `src/routes/estatistica/EstatisticaPage.tsx` | `activeTestId` tipado, sem fallback de título | ✓ VERIFIED | `useState<TestId>('t-student')`, `getTestById(activeTestId).title` sem `??` |
| `src/routes/mapas/ReviewAnalysisDialog.test.tsx` | Fixture herda `createInitialMapAnalysisState()` | ✓ VERIFIED | `{ ...createInitialMapAnalysisState(), groups, activeGroupId: 'g1', mapView: {level:'uf'}, provenance: 'catalog' }` |
| `src/test/flowHelpers.ts` | Helper `runToResultados`, 3 passos | ✓ VERIFIED | Corpo com exatamente `click('Analisar dados')` + `findByRole('region', {name:'Resultados'})`; zero `aria-current`/`Configurar`/`advanceTimersByTime`/`setTimeout` no arquivo |
| `src/test/setup.ts` | Stub incondicional de canvas | ✓ VERIFIED | `proto.getContext =` / `proto.toDataURL =` sem sondagem prévia; 0 avisos medidos |
| `src/shared/flow/FlowSteps.tsx` | Único caminho de render (scroll) | ✓ VERIFIED | Sem `if`, sem prop `layout`, sem `onStepChange`, sem `FLOW_STEP_LABELS`, sem `effectiveCanAdvance`, sem import de `Check`; `FlowStepsProps` com exatamente 5 campos |
| `src/shared/flow/FlowSteps.test.tsx` | 5+ casos vivos sobre scroll | ✓ VERIFIED | Exatamente 5 casos: os 3 exigidos por D-03 (resultados com `canAdvance.resultados===false`, region+id, `scrollIntoView`) mais os 2 preexistentes |
| `.githooks/pre-commit` / `pre-push` | Gatilho local, `npm run gate` | ✓ VERIFIED | Ambos chamam `npm run gate`; pre-commit tem exceção D-18 sem `--diff-filter`; pre-push sem exceção; modo `100755` no índice |
| `.github/workflows/ci.yml` | Gatilho remoto | ✓ VERIFIED (código) | `actions/checkout@v7`, `actions/setup-node@v7`, `node-version: 24`, job `gate`, `npm run gate`; sintaxe YAML válida; nenhuma tag `@main`/`@master` |
| `package.json` | Scripts `gate`/`prepare` | ✓ VERIFIED | `"gate": "npm run test:run && npm run build"` (sem `tsc` duplicado), `"prepare": "git config core.hooksPath .githooks \|\| true"`, `devDependencies` sem `husky` |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| 9 arquivos de teste de módulo | `src/test/flowHelpers.ts` | `import { runToResultados } from '@/test/flowHelpers'` | ✓ WIRED | Confirmado por leitura em 8/9 arquivos (o 9º, `TesteDemo.test.tsx`, usa o helper só no caso que chega em Resultados) |
| `router.test.tsx` | `EstatisticaPage.tsx` | `#lacir-test-module-mount[data-active-test-id]` | ✓ WIRED | Landmark real, presente em produção (`EstatisticaPage.tsx:141`), consumido nos 2 novos casos |
| `.githooks/pre-commit` / `pre-push` | `package.json` | `npm run gate` | ✓ WIRED | `grep -c "npm run gate"` = 1 em cada hook |
| `.github/workflows/ci.yml` | `package.json` | `npm run gate` | ✓ WIRED | Último passo do job `gate` |
| git | `.githooks/` | `core.hooksPath` | ✓ WIRED | `git config core.hooksPath` → `.githooks` neste working tree; script `prepare` reproduz em clone novo (não re-executado neste verificador — ver Human Verification) |
| `SidebarTestLink.tsx` | `registry.ts` | `import type { TestId }` | ✓ WIRED | Confirmado |
| `EstatisticaPage.tsx` | `registry.ts` | `isTestAvailable` como type guard | ✓ WIRED | Usado nos 3 call sites de `setActiveTestId` guardados |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Typecheck limpo | `npm run typecheck` | exit 0 | ✓ PASS |
| Suíte inteira verde e silenciosa | `npx vitest run` | 681/681, 0 skipped, 0 avisos canvas/act | ✓ PASS |
| Build completo (inclui `tsc -b` + `vite build`) | `npm run build` | exit 0 | ✓ PASS |
| Zero dependência npm nova | `git diff --stat package-lock.json` | vazio | ✓ PASS |
| Zero vestígio de `stepper` em `src/` | `grep -rc "stepper" src/` | nenhuma ocorrência | ✓ PASS |
| Hooks ativos e executáveis | `git config core.hooksPath` + `git ls-files -s .githooks/` | `.githooks`; `100755`/`100755` | ✓ PASS |
| Gate local bloqueia commit vermelho / push vermelho / pula `.planning/`-only | 3 cenários (comando+bare local) | Executados pelo orquestrador imediatamente antes deste verificador, com limpeza confirmada (`git status --porcelain` vazio, sem remote residual) | ✓ PASS (medição do orquestrador, não citação de SUMMARY — não re-executado aqui por ser destrutivo/já provado) |

Nenhum spot-check exigiu servidor externo; todos completaram em segundos.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| QA-01 | 07-01, 07-07 | typecheck limpo | ✓ SATISFIED | Ver truths #1 |
| QA-02 | 07-02 a 07-07 | suíte 100% verde, passar é pré-condição de commit | ✓ SATISFIED | Ver truths #2, #3; gate wired em pre-commit/pre-push |
| QA-03 | 07-06, 07-07 | nenhum teste vermelho "conhecido" | ✓ SATISFIED | Zero skip/todo/xit em `src/`; zero marcador de dívida não referenciado nos arquivos tocados pela fase |
| QA-04 | 07-01 | ícone faltante não derruba sidebar | ✓ SATISFIED | Ver truths #4 |

Nenhum requisito órfão.

### Anti-Patterns Found

Varredura em todos os arquivos declarados como `key-files` pelos 7 SUMMARYs (35 arquivos de produção/teste + 3 arquivos de infraestrutura do gate):

- `TBD`/`FIXME`/`XXX`: 0 ocorrências reais. Um falso-positivo isolado: `.githooks/pre-commit:4` contém a palavra portuguesa "TODO" (= "inteiro/todo o staged"), não o marcador de dívida em inglês — confirmado pelo contexto da frase ("...quando TODO o staged está sob .planning/...").
- `TODO`/`HACK`/`PLACEHOLDER`/"coming soon"/"not yet implemented": 0 ocorrências.
- `console.error` engolindo saída ou suprimindo aviso: não encontrado (proibido explicitamente pelos critérios de aceite de 07-06 e verificado ausente).

Nenhum item 🛑 Blocker, nenhum ⚠️ Warning de anti-padrão de código.

### Human Verification Required

### 1. Actions bloqueia merge de fato

**Test:** Depois de criar o repositório remoto no GitHub, fazer o primeiro push, abrir um Pull Request e marcar o check `gate` como required status check em Settings → Branches.
**Expected:** Um PR com suíte vermelha ou `npm run typecheck`/`npm run build` sujo deve ficar bloqueado para merge; o check `gate` deve aparecer como obrigatório.
**Why human:** Depende de infraestrutura de conta GitHub (remote + branch protection) que não existe neste repositório hoje — `git remote -v` está vazio. Nada que grep ou execução local possa provar; é o único item genuinamente pendente do SC#5, e está honestamente documentado como tal em `07-07-SUMMARY.md` e `07-VALIDATION.md`, não escondido atrás de uma alegação de "concluído".

### 2. `core.hooksPath` sobrevive a um clone novo

**Test:** Clonar o repositório em um diretório temporário, rodar `npm install`, e confirmar `git config core.hooksPath`.
**Expected:** Deve devolver `.githooks`, provando que o script `prepare` reconfigura a config local (que nunca viaja com o clone) automaticamente.
**Why human:** `core.hooksPath` é config local do git — testar isso exige um clone físico separado deste working tree, fora do escopo do que este verificador pode fazer sem alterar o ambiente do usuário.

Estes dois itens são exatamente os dois que `07-VALIDATION.md` §"Manual-Only Verifications" já registrava como pendentes intencionalmente, dependentes de infraestrutura inexistente — não são lacunas de implementação, são checagens operacionais que só fazem sentido depois que o repositório ganhar um remote real. Não foram tratados como gaps.

### Gaps Summary

Nenhum gap encontrado. Os 5 critérios de sucesso do ROADMAP e os 4 requisitos QA-01..QA-04 estão implementados e comprovados por execução direta neste verificador — não por citação de SUMMARY.md. A única ressalva (SC#5 — bloqueio de merge real) é uma limitação de infraestrutura honestamente disclosurada pelo próprio time de execução (07-07-SUMMARY.md, 07-VALIDATION.md), consistente com o "não fingir uma ausência como um valor" que é o tema do milestone inteiro — o gate está provado bloqueante localmente (3 cenários executados com prova de exit code, não apenas descritos), e o que falta é estritamente configuração de conta GitHub, não código.

Status `human_needed` reflete exatamente essa situação: nenhum truth falhou, mas dois itens exigem verificação humana fora do alcance de grep/execução local antes de considerar a Fase 7 inteiramente fechada em produção.

---

_Verified: 2026-07-30T00:07:06Z_
_Verifier: Claude (gsd-verifier)_
