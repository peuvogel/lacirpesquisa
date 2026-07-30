---
status: partial
phase: 07-baseline-verde
source: [07-VERIFICATION.md]
started: 2026-07-30T00:07:06Z
updated: 2026-07-30T00:07:06Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Confirmar que o workflow do GitHub Actions (`gate`) bloqueia merge de verdade

expected: Depois de criar o remote no GitHub, fazer o primeiro push, abrir um PR e marcar `gate` como required status check em Settings → Branches, um PR com suíte vermelha ou typecheck sujo deve ficar bloqueado para merge.
why_human: Requer conta/repositório remoto no GitHub e configuração de branch protection — infraestrutura que não existe neste repositório hoje (`git remote -v` vazio). Não é algo que grep ou execução local consiga provar.
result: [pending]

**Nota:** o `.github/workflows/ci.yml` está versionado e correto (job único `gate`, Node 24, `npm ci && npm run gate`, dispara em `push` e `pull_request` para `main`). O que falta é operacional, não código. Enquanto não houver remote, quem protege o dia a dia é o `pre-commit` local — que **já foi provado bloqueante**.

### 2. Confirmar que `core.hooksPath` sobrevive a um clone novo

expected: Clonar o repositório em um diretório temporário, rodar `npm install` e confirmar que `git config core.hooksPath` devolve `.githooks`.
why_human: `core.hooksPath` é configuração local do git e nunca viaja com o clone; só o script `prepare` do npm a recria. Provar isso exige um clone físico novo, fora do escopo de uma verificação sobre o próprio working tree.
result: [pending]

**Por que isso importa:** se o bootstrap do `prepare` não funcionar, o gate fica silenciosamente inerte para qualquer pessoa que clone o repositório — um portão que parece instalado e não bloqueia nada. É exatamente a forma de defeito que este milestone existe para eliminar, então vale conferir de fato em vez de assumir.

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
