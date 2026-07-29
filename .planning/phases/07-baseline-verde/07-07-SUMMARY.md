---
plan: 07-07
phase: 07-baseline-verde
status: complete
requirements: [QA-01, QA-02, QA-03]
decisions: [D-15, D-16, D-17, D-18]
tasks_completed: 3
tasks_total: 3
completed: 2026-07-29
---

# 07-07: `npm run gate` + `.githooks/` + CI — Summary

## O que foi construído

O portão que impede o vermelho de voltar durante as Fases 8–12, em três gatilhos com **uma** definição.

### `npm run gate` (D-16, D-17)

```
"gate": "npm run test:run && npm run build"
```

Uma composição, chamada por `pre-commit`, `pre-push` e pelo workflow do Actions — nenhum dos três pode divergir dos outros. Cobre os três verificadores que a D-17 pede **sem rodar `tsc` duas vezes**: `test:run` já encadeia `catalog:validate && vitest run`, e `build` já roda `tsc -b`, que produz os mesmos erros que `tsc --noEmit` (confirmado neste projeto: ambos acusaram exatamente os 2 erros do baseline).

### `.githooks/` versionado + `core.hooksPath` (D-15, D-18)

- `.githooks/pre-commit` — roda o gate, **exceto** quando todo o conteúdo staged está sob `.planning/`
- `.githooks/pre-push` — roda o gate **sempre**, sem exceção
- `package.json` ganhou `"prepare": "git config core.hooksPath .githooks || true"` como bootstrap

Ambos os hooks estão com modo `100755` rastreado pelo git (`git ls-files -s .githooks/`), o que importa porque um hook sem bit de execução é **silenciosamente ignorado**.

**Zero dependência npm nova** — nada de husky, `package-lock.json` intocado. É por isso que os hooks são arquivos simples mais `core.hooksPath`, e não um gerenciador.

### `.github/workflows/ci.yml` (D-15)

Job único `gate` em `ubuntu-latest`, `actions/checkout@v7` + `actions/setup-node@v7`, **Node 24** (a pesquisa apurou que o Node 25 local já está EOL), cache npm, `npm ci` e `npm run gate`. Dispara em `push` e `pull_request` para `main`.

## A armadilha do filtro que a D-18 evita

O jeito natural de detectar "commit só de documentação" seria `git diff --cached --name-only --diff-filter=ACMR`. **Está errado** e o hook documenta o porquê inline: restringir a Added/Copied/Modified/Renamed exclui Deleted, então um `git rm` de um arquivo em `src/` ficaria **invisível** para o `--name-only` e o commit passaria pelo gate disfarçado de "só doc". O hook usa o filtro default do git, que enxerga todas as mudanças.

Uma limitação real ficou **registrada em vez de disfarçada**: `--name-only` mostra só o destino de um rename, então mover um arquivo de `src/` para `.planning/` seria mascarado como "só doc". Cenário raro neste projeto, anotado no próprio hook.

## Provas de bloqueio — executadas, não descritas

Os três cenários foram rodados de verdade e limpos por completo depois.

| Cenário | Comando | Resultado |
|---|---|---|
| **1. pre-commit bloqueia código quebrado** | `git commit` com `src/gate-probe.ts` de tipo inválido | exit **1**, **nenhum commit criado** (HEAD inalterado). Recusado no `tsc -b` do build, depois de a suíte passar 681/681 |
| **2. pre-commit pula commit só-`.planning/`** | `git commit` de `.planning/notes/gate-probe.md` | exit **0** em **0s**, com a mensagem `pre-commit: staged é só .planning/ — pulando gate (D-18)`. O gate não rodou |
| **3. pre-push bloqueia push vermelho** | `git push` de commit quebrado contra `git init --bare /tmp/remote-test.git` | exit **1**, e `git ls-remote` devolveu **zero refs** — nada chegou ao bare |

O cenário 3 usou `git commit --no-verify` para encenar o commit quebrado. Esse é o **único** `--no-verify` sancionado neste plano: o alvo da prova é o pre-push, não o pre-commit, então o commit precisa existir para ser empurrado.

Limpeza confirmada ao final: `git status --porcelain` vazio, `git remote -v` vazio, `/tmp/remote-test.git` removido, nenhum arquivo de sonda em `src/`.

## SC#5: o que foi entregue e o que continua pendente

**Honestidade explícita, porque o tema deste milestone é justamente uma ausência que se parece com um valor.**

- **Entregue em código:** o gate existe, está ativo localmente, e está *provado bloqueante* — não apenas presente.
- **Pendente e operacional:** o `ci.yml` **não bloqueia merge por si só**. Isso exige (a) um remote no GitHub, que este repositório ainda não tem, e (b) branch protection com o check `gate` marcado como required. Nenhum dos dois é código.

Enquanto não houver remote, o `pre-push` é inerte por falta de destino — o que de fato protege o dia a dia é o `pre-commit`. Um `ci.yml` versionado sem remote é um arquivo correto e inativo, não um portão.

## Verificações humanas que permanecem

1. **Actions bloqueia merge de fato** — quando existir remote: push da branch, abrir PR, confirmar que `gate` aparece como required status check e que um PR vermelho fica travado.
2. **`core.hooksPath` sobrevive a um clone novo** — `core.hooksPath` é config **local** e nunca viaja no clone. Clonar em diretório temporário, rodar `npm install`, confirmar que `git config core.hooksPath` devolve `.githooks`. Sem esse bootstrap funcionando, o gate silenciosamente não faz nada para quem clonar.

## Efeito prático no dia a dia

Commits que tocam código passam a custar o tempo do gate (suíte ~19s + build). Commits que só tocam `.planning/` continuam instantâneos — foi exatamente a razão da D-18, dado o volume de commits de documentação que o fluxo GSD produz.

## Commits

- `b52d527` — feat(07-07): add npm run gate and prepare hooksPath bootstrap
- `53b9ae6` — feat(07-07): add versioned pre-commit and pre-push git hooks
- `4e3a83b` — feat(07-07): add CI workflow and activate local gate

## Nota de execução

O agente executor foi cortado por erro de API depois de completar e commitar as 3 tasks, mas antes de escrever este SUMMARY. As três provas de bloqueio foram então re-executadas pelo orquestrador, não herdadas do relato do agente — o estado registrado acima é medido, não relatado.

## Self-Check: PASSED

- `npm run typecheck` → exit 0
- `npx vitest run` → exit 0, 681/681 em 97 arquivos
- `npm run build` → exit 0
- Avisos de canvas 0, avisos de `act(...)` 0
- `git diff --stat package-lock.json` → vazio
- `git ls-files -s .githooks/` → ambos `100755`
- `git config core.hooksPath` → `.githooks`
- Três cenários de bloqueio: provados, com limpeza completa
