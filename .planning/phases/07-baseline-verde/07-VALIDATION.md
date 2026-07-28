---
phase: 07
slug: baseline-verde
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-28
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `07-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (`environment: 'jsdom'`, `globals: true`) |
| **Config file** | `vite.config.ts` (bloco `test` — não há `vitest.config.*` separado) |
| **Setup file** | `src/test/setup.ts` (roda antes de cada arquivo de teste) |
| **Quick run command** | `npx vitest run <caminho-do-arquivo>` |
| **Full suite command** | `npm run test:run` (= `catalog:validate && vitest run`) |
| **Estimated runtime** | ~19 segundos (18,7s medidos em 2026-07-28) |

**Nota de runtime:** `--reporter=basic` foi **removido no Vitest 4** e falha com erro de startup. Usar o reporter padrão.

---

## Sampling Rate

- **After every task commit:** `npx vitest run <arquivo(s) tocados>` + `npm run typecheck`
- **After every plan wave:** `npm run test:run` + `npm run typecheck` (suíte completa, ~19s)
- **Before `/gsd:verify-work`:** `npm run gate` inteiro verde **e** prova mecânica de que o hook local bloqueia — não basta o hook existir
- **Max feedback latency:** 25 segundos

---

## Per-Task Verification Map

Task IDs são preenchidos durante o planejamento; as linhas abaixo fixam o comando de verificação por requisito.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | QA-01 | — | N/A | typecheck | `npm run typecheck` | ✅ script existe | ⬜ pending |
| TBD | TBD | 1 | QA-04 | — | N/A | unit | `npx vitest run src/routes/estatistica/SidebarTestLink.test.tsx` | ❌ W0 — arquivo novo | ⬜ pending |
| TBD | TBD | 1–2 | QA-02 | — | N/A | unit/integration | `npm run test:run` | 🔶 9 arquivos precisam reescrita | ⬜ pending |
| TBD | TBD | 1–2 | QA-02 (SC#3) | — | N/A | integration (RTL) | `npm run test:run` — mesma jornada Dados→Configurar→Resultados nos 9 arquivos | 🔶 arquivos existem | ⬜ pending |
| TBD | TBD | 2 | QA-02 (D-08, silêncio) | — | N/A | log assertion | `npx vitest run 2>&1 \| grep -c "Not implemented: HTMLCanvasElement"` → 0; `grep -c "was not wrapped in act"` → 0 | ✅ setup.ts existe (contém o probe defeituoso) | ⬜ pending |
| TBD | TBD | 3 | QA-03 / SC#5 | T-07-01 | Hook não pode ser burlado silenciosamente; `--no-verify` é bypass conhecido e documentado | integration (git hook) | commit deliberadamente vermelho contra `.githooks/pre-commit` ativo → exit ≠ 0 e nenhum commit criado | ❌ W0 — hooks não existem | ⬜ pending |
| TBD | TBD | 3 | QA-03 (D-18) | — | N/A | integration (git hook) | commit tocando só `.planning/` → completa em < 2s, sem rodar o gate | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/routes/estatistica/SidebarTestLink.test.tsx` — arquivo novo; hoje não existe teste dedicado a `SidebarTestLink` (QA-04)
- [ ] `src/test/` helper de fluxo compartilhado (D-06/D-07) — infraestrutura de que os 9 arquivos reescritos dependem
- [ ] `.githooks/pre-commit` e `.githooks/pre-push` + ativação de `core.hooksPath` (QA-03, SC#5)
- [ ] Correção do stub de canvas em `src/test/setup.ts` — **já existe, mas é a causa dos 190 avisos**: o probe testa os métodos não implementados do jsdom para decidir se stuba, e o próprio probe emite o aviso. A correção é substituição incondicional, não adição.

*Framework já instalado — nenhuma instalação de framework é necessária, e nenhuma dependência npm nova é permitida (D-08/D-15).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| O workflow do Actions bloqueia merge de fato | SC#5 | Requer remote no GitHub **e** branch protection com required status check — configuração operacional, não código. O repositório não tem remote hoje. | Quando existir remote: push da branch, abrir PR, confirmar que o check `gate` aparece como required e que um PR vermelho fica bloqueado. Até lá, o `ci.yml` é verificável só por lint de sintaxe. |
| `core.hooksPath` sobrevive a um clone novo | QA-03 | `core.hooksPath` é config **local** — nunca viaja com o clone. Precisa de bootstrap (ex.: script `prepare` do npm). | Clonar o repo em diretório temporário, rodar `npm install`, confirmar `git config core.hooksPath` → `.githooks`. |
| `pre-push` bloqueia push vermelho | SC#5 | Sem remote, `git push` não acontece. | Criar remote de teste (`git init --bare /tmp/remote-test.git`), adicionar, tentar push com suíte vermelha, esperar exit ≠ 0. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (SidebarTestLink.test.tsx, helper de fluxo, .githooks/, correção do stub)
- [ ] No watch-mode flags (`vitest run`, nunca `vitest` interativo)
- [ ] Feedback latency < 25s
- [ ] Suíte provada verde **e silenciosa** (0 avisos de canvas, 0 de act)
- [ ] Gate provado bloqueante, não apenas presente
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
