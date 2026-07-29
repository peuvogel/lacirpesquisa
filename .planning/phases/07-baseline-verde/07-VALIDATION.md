---
phase: 07
slug: baseline-verde
status: planned
nyquist_compliant: true
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
| 07-01 T3 | 07-01 | 1 | QA-01 | — | N/A | typecheck | `npm run typecheck` | ✅ script existe | ⬜ pending |
| 07-01 T2 | 07-01 | 1 | QA-04 | — | N/A | unit | `npx vitest run src/routes/estatistica/SidebarTestLink.test.tsx` | ❌ W0 — arquivo novo | ⬜ pending |
| 07-04 T1-T2 / 07-05 T1-T2 | 07-04, 07-05 | 3 | QA-02 | — | N/A | unit/integration | `npm run test:run` | 🔶 9 arquivos precisam reescrita | ⬜ pending |
| 07-04 T1-T2 / 07-05 T1-T2 | 07-04, 07-05 | 3 | QA-02 (SC#3) | — | N/A | integration (RTL) | `npm run test:run` — mesma jornada Dados→Configurar→Resultados nos 9 arquivos | 🔶 arquivos existem | ⬜ pending |
| 07-02 T2 / 07-06 T2 | 07-02, 07-06 | 1 e 4 | QA-02 (D-08, silêncio) | — | N/A | log assertion | `npx vitest run 2>&1 \| grep -c "Not implemented: HTMLCanvasElement"` → 0; `grep -c "was not wrapped in act"` → 0 | ✅ setup.ts existe (contém o probe defeituoso) | ⬜ pending |
| 07-07 T3 | 07-07 | 5 | QA-03 / SC#5 | T-07-07-03, T-07-07-04 | Hook não pode ser burlado silenciosamente; `--no-verify` é bypass conhecido e documentado | integration (git hook) | commit deliberadamente vermelho contra `.githooks/pre-commit` ativo → exit ≠ 0 e nenhum commit criado | ❌ W0 — hooks não existem | ⬜ pending |
| 07-07 T3 | 07-07 | 5 | QA-03 (D-18) | — | N/A | integration (git hook) | commit tocando só `.planning/` → completa em < 2s, sem rodar o gate | ❌ W0 | ⬜ pending |
| 07-07 T3 | 07-07 | 5 | SC#5 | T-07-07-03 | `pre-push` roda sempre — a exceção de D-18 vale só para o pre-commit | integration (git hook) | push vermelho contra bare local (`git init --bare /tmp/remote-test.git`) → exit ≠ 0 e `git ls-remote` sem refs | ❌ W0 — hooks não existem | ⬜ pending |

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

**Promovido a roteirizado (não é mais manual):** "`pre-push` bloqueia push vermelho" saiu desta tabela — não precisa de remote no GitHub nem de julgamento humano, só de um bare local (`git init --bare /tmp/remote-test.git`). Virou cenário 3 da Task 3 do `07-07-PLAN.md`, com critério de aceite por código de saída.

---

## Validation Sign-Off

Marcado só o que é verificável **em tempo de planejamento**. As duas caixas restantes só podem ser marcadas depois da execução, com prova em mão — marcar antes seria exatamente o tipo de check não merecido que este milestone existe para eliminar.

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — 16 tasks nos 7 planos, 16 blocos `<automated>`
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (SidebarTestLink.test.tsx, helper de fluxo, .githooks/, correção do stub)
- [x] No watch-mode flags (`vitest run`, nunca `vitest` interativo)
- [x] Feedback latency < 25s — suíte completa medida em 18,7s (2026-07-28); os comandos por task são de arquivo único, portanto mais rápidos
- [x] Suíte provada verde **e silenciosa** — medido pelo orquestrador em 2026-07-29: `npx vitest run` exit 0, 681/681 em 97 arquivos; `grep -c "Not implemented: HTMLCanvasElement"` → 0 (eram 190); `grep -c "was not wrapped in act"` → 0 (eram 21); zero testes pulados em `src/`
- [x] Gate provado bloqueante, não apenas presente — os 3 cenários foram **executados**, não descritos: (1) commit com erro de tipo → exit 1, nenhum commit criado; (2) commit só-`.planning/` → exit 0 em 0s, gate pulado (D-18); (3) push vermelho contra bare local → exit 1, `git ls-remote` sem refs. Limpeza completa confirmada
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-29 — as duas caixas de execução fecharam com prova medida.

**Ressalva que permanece aberta (não é lacuna de validação, é escopo operacional):** o `ci.yml` está versionado e correto, mas não bloqueia merge por si só — isso exige remote no GitHub mais branch protection com o check `gate` como required. As duas verificações da tabela "Manual-Only Verifications" acima seguem pendentes por depender de infraestrutura que não existe no repositório hoje.
