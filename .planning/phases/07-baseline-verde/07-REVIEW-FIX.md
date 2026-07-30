---
phase: 07-baseline-verde
fixed_at: 2026-07-30T11:35:00Z
review_path: .planning/phases/07-baseline-verde/07-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-07-30
**Source review:** `.planning/phases/07-baseline-verde/07-REVIEW.md`
**Iteration:** 1
**Scope:** `critical_warning` — WR-01 a WR-07. IN-01/IN-02/IN-03 ficaram fora de escopo por instrução e **não** foram tocados.

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Gate status

Comando: `npm run gate` (= `npm run test:run && npm run build`; `test:run` = `catalog:validate && vitest run`).

Executado duas vezes ao final, com saída real:

| Onde | Exit code | Resultado |
|------|-----------|-----------|
| worktree isolado (`/tmp/sv-07-reviewfix-YydgAv`) | **0** | 97 arquivos, 682 testes passando; build OK |
| repositório principal, após fast-forward | **0** | `catalog:validate OK — provenance gate passed`; 97 arquivos, 682 testes passando; `✓ built in 832ms` |

Além disso, o hook `pre-commit` do próprio projeto rodou o gate completo em **cada um dos 7 commits** — nenhum foi criado com a suíte vermelha.

Contagem de testes: baseline 681 → 682. O +1 é o teste-guarda adicionado em WR-07, não um teste removido/pulado. Nenhum teste foi deletado, marcado como `skip` ou afrouxado.

Ressalva honesta: o build emite o aviso pré-existente `Some chunks are larger than 500 kB after minification` (chunk `index` ~2,58 MB). Ele já existia antes destes fixes, não é erro e não afeta o exit code — apenas não foi introduzido nem resolvido aqui.

## Fixed Issues

### WR-01: Asserção condicional torna o teste do CTA Kruskal potencialmente vazio

**Files modified:** `src/features/tests/anova-tukey/AnovaTukeyTest.test.tsx`
**Commit:** `56c0563`
**Applied fix:** adaptado — a sugestão literal da revisão não funcionava.

A revisão sugeria apenas trocar `queryByRole` condicional por `findByRole` incondicional. Apliquei isso primeiro e **o teste falhou**: com `exampleText`, o botão do CTA nunca existe. Verificando `computeAssumptionNudges` (`anovaEngine.ts:161-225`) contra o dataset de exemplo:

- `k = 3` → não dispara o nudge de "apenas dois grupos";
- `n` = 5/5/5 → `maxN/minN = 1`, não `> 3`;
- `sd` ≈ 1,29 / 1,39 / 1,65 → `maxSd/minSd ≈ 1,28`, não `> 2`;
- média ≈ mediana nos três grupos → sem `skewHint`.

Ou seja: `exampleText` não produz **nenhum** nudge. O teste era 100% vazio — o bloco `if` nunca executava e a única asserção do teste jamais rodava. Trocar só a query transformaria um falso-verde em falha permanente, o que não é conserto.

Fix aplicado: dataset `heteroscedasticText` colado via `user.paste` na textarea real de produção, com desvios-padrão deliberadamente díspares (sd_C ≈ 11,2 contra sd_A ≈ 0,16 → razão ≈ 70), que dispara o nudge de heterogeneidade de variâncias — o único que carrega o CTA. A asserção agora é incondicional via `findByRole({ name: 'Abrir Kruskal-Wallis + Dunn' })`. O comentário no arquivo registra por que `exampleText` não serve, para ninguém "simplificar" de volta.

**Verificação:** provado nos dois sentidos — com `exampleText` + `findByRole` o teste falha (alcançabilidade da asserção era zero); com o novo dataset, passa.

### WR-02: `renderActiveTest` despacha por `string`, não por `TestId`

**Files modified:** `src/routes/estatistica/EstatisticaPage.tsx`
**Commit:** `05d2477`
**Applied fix:** conforme sugerido. `RenderActiveTestProps.activeTestId` passa de `string` para `TestId`, e o `default: return null` silencioso vira `const exhaustive: never = activeTestId; return exhaustive;`.

**Verificação:** negativa e positiva. `tsc --noEmit` limpo (exit 0) com os 9 `case`s. Removendo temporariamente o `case 'logistica'`, o compilador falha com exatamente o efeito desejado:

```
src/routes/estatistica/EstatisticaPage.tsx(87,13): error TS2322: Type '"logistica"' is not assignable to type 'never'.
```

Um décimo id em `TEST_REGISTRY` sem `case` agora quebra o build em vez de renderizar tela vazia em runtime.

### WR-03: `prepare` engole qualquer falha ao instalar os hooks

**Files modified:** `package.json`
**Commit:** `b316b23`
**Applied fix:** adotada a primeira opção da revisão (avisar), não a segunda (falhar duro), com o aviso direcionado a **stderr**.

Escolha deliberada: `prepare` também roda onde não existe `.git` utilizável (instalação por tarball, build Docker que copia só o source). Remover o `|| true` quebraria `npm ci` nesses casos por um motivo alheio à instalação do hook. O problema apontado é a *silêncio*, e o aviso em stderr resolve isso sem introduzir uma falha nova.

**Verificação:** ambos os caminhos exercitados. Sucesso → silencioso, exit 0. Em diretório sem git → `fatal: not in a git directory` seguido do `AVISO: ... hooks locais (pre-commit/pre-push) NAO estao ativos neste clone ...` em stderr, exit 0. JSON do `package.json` revalidado com `JSON.parse`.

### WR-04: workflow de CI sem bloco `permissions` explícito

**Files modified:** `.github/workflows/ci.yml`
**Commit:** `cb2f9b2`
**Applied fix:** conforme sugerido — `permissions: contents: read` no nível do workflow.

**Verificação:** YAML reparseado com `js-yaml`; `permissions` resolve para `{"contents":"read"}`.

### WR-05: actions de terceiros fixadas em tags mutáveis

**Files modified:** `.github/workflows/ci.yml`
**Commit:** `68f1a84`
**Applied fix:** aplicado com SHAs **reais e verificados** — não inventados.

Instrução era pular se não fosse possível confirmar os SHAs em fonte confiável. Foi possível: consultei a API do GitHub diretamente nos repositórios upstream (`gh api repos/actions/{checkout,setup-node}/git/refs/tags`), e depois confirmei que cada SHA resolve para um objeto de commit real:

| Action | Tag | SHA | Commit upstream |
|--------|-----|-----|-----------------|
| `actions/checkout` | `v7` → `v7.0.1` | `3d3c42e5aac5ba805825da76410c181273ba90b1` | `prep v7.0.1 release (#2531)`, 2026-07-17 |
| `actions/setup-node` | `v7` → `v7.0.0` | `820762786026740c76f36085b0efc47a31fe5020` | `Migrate to ESM and upgrade dependencies (#1574)`, 2026-07-14 |

Versão registrada em comentário ao lado de cada SHA. **Não** configurei Dependabot/Renovate (a revisão sugere como acompanhamento) — fica como item em aberto, senão os SHAs envelhecem sem ninguém notar.

**Verificação:** YAML reparseado; os dois `uses` resolvem para as strings com SHA.

### WR-06: stub de canvas ignora o `contextId`

**Files modified:** `src/test/setup.ts`
**Commit:** `c576fcc`
**Applied fix:** conforme sugerido — `contextId === '2d' ? contextStub : null`.

**Verificação:** `tsc --noEmit` exit 0; suíte completa verde (97 arquivos / 681 testes naquele momento). Confirmado por busca que nenhum código de produção chama `getContext` diretamente — as únicas ocorrências em `src/` são o próprio `setup.ts`, então restringir ao `'2d'` não podia quebrar consumidor existente.

### WR-07: teste muta `Element.prototype.scrollIntoView` sem restaurar

**Files modified:** `src/shared/flow/FlowSteps.test.tsx`
**Commit:** `4eddc6a`
**Applied fix:** adotada a primeira opção da revisão (try/finally), **não** a segunda (`vi.spyOn`), porque a segunda é impossível aqui.

Verifiquei em runtime sob jsdom: `typeof Element.prototype.scrollIntoView === 'undefined'` e `hasOwnProperty(...) === false` — jsdom não implementa o método, a propriedade nem existe. `vi.spyOn(Element.prototype, 'scrollIntoView')` lançaria "is not a function". (Nota lateral: por isso `ReviewAnalysisDialog.test.tsx:118-122`, citado na revisão como exemplo de `spyOn`, na verdade também faz atribuição direta — `vi.restoreAllMocks()` não desfaz atribuição direta. Fora do escopo desta correção, mas registrado.)

Fix aplicado: captura de `Object.getOwnPropertyDescriptor` antes, e em `finally` ou restaura o descriptor original ou faz `delete` — restaurando a *ausência* real do jsdom, não uma propriedade com valor `undefined`. Adicionei também um teste-guarda que roda depois do mutante no mesmo `describe` e assevera `hasOwnProperty === false`.

**Verificação:** negativa e positiva. Com o `finally` no lugar, 6/6 testes passam. Removendo o `finally`, o teste-guarda falha (`× leaves Element.prototype.scrollIntoView unpatched for subsequent tests`) — ou seja, o guarda realmente detecta a regressão que existe para prevenir, não é decorativo.

## Skipped Issues

Nenhuma. Todos os 7 findings em escopo foram corrigidos.

## Notas para revisão humana

Três fixes divergiram da sugestão literal da revisão porque a sugestão não funcionava como escrita. Vale conferência:

1. **WR-01** — mudança de comportamento do teste, não só da query. O teste agora usa um dataset próprio em vez de `exampleText`. Confirme que exercitar o CTA com dados heterocedásticos (em vez do dataset de exemplo) é a intenção; a alternativa seria mudar `exampleText` para disparar o nudge, o que afetaria a UX do botão "Usar exemplo" e por isso não fiz.
2. **WR-03** — escolhi avisar em vez de falhar o `npm install`. Se a preferência do projeto for falhar duro, é trocar o `|| echo ... 1>&2` por nada.
3. **WR-05** — os SHAs são reais e conferidos hoje, mas ficam estáticos: sem Dependabot/Renovate configurado, ninguém será avisado de patches de segurança nessas actions.

Fora de escopo e ainda abertos: IN-01, IN-02, IN-03 do 07-REVIEW.md.

---

_Fixed: 2026-07-30_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
