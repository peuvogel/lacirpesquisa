---
phase: 9
slug: pipeline-confi-vel-coleta-completa
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-04
---

# Phase 9 — Validation Strategy

> Contrato de validação da fase, para amostragem de feedback durante a execução.
> Derivado de `09-RESEARCH.md` §"Validation Architecture". O planner preenche o
> Per-Task Verification Map ao criar os PLAN.md.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Node)** | `vitest` ^4.1.10 — já em uso |
| **Framework (Python)** | `pytest` — **novo**, a adicionar via `uv add --dev pytest` no pipeline Python |
| **Config file** | `vitest` já configurado; o `pyproject.toml` do novo diretório do pipeline precisa de `[tool.pytest.ini_options]` |
| **Quick run command** | `npm run test:run` (encadeia `catalog:validate` + `vitest run`; a ponte `uv run pytest` precisa entrar neste encadeamento) |
| **Full suite command** | `npm run gate` (`test:run` + `build`) |
| **Estimated runtime** | Alvo: manter o passo Python em segundos — a fixture de reconciliação mede ~140–250 KB de parquet, nunca os 10 GB |

---

## Sampling Rate

- **After every task commit:** `npm run test:run`
- **After every plan wave:** `npm run gate`
- **Before `/gsd:verify-work`:** suíte completa verde
- **Max feedback latency:** ~60 s (o passo Python não pode alongar o loop de commit)

**Fora do gate automatizado:** a corrida real de coleta (dias) e a auditoria manual da
contagem final (PIPE-05) acontecem antes do checkpoint humano de upload (D-07). Não são
candidatas a `npm run gate` — dependem de rede e de horas de execução.

---

## Per-Task Verification Map

> **A preencher pelo planner.** Uma linha por task, referenciando o Test Map abaixo.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(pendente — preenchido durante o planejamento)_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → Test Map (de `09-RESEARCH.md`)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PIPE-01 / SC-1 | Ausência de arquivo esperado é falha ruidosa (saída não-zero), nunca `OK · 0 linhas` | unit (Python) | `uv run pytest tests/test_enumerate.py::test_missing_file_raises -x` | ❌ Wave 0 |
| PIPE-03 / SC-3 | Reexecutar após interrupção não duplica linhas | integration (Python) | `uv run pytest tests/test_ledger.py::test_resume_no_duplicate -x` | ❌ Wave 0 |
| PIPE-04 / SC-4 | Cache só é apagado após a contagem re-lida do Supabase conferir | integration (Python, mock de contagem) | `uv run pytest tests/test_upload.py::test_cache_deleted_only_after_row_count_match -x` | ❌ Wave 0 |
| DATA-03 | `taxa_mortalidade` derivável do campo `MORTE` | unit (Python) | `uv run pytest tests/test_aggregate.py::test_taxa_mortalidade_from_morte -x` | ❌ Wave 0 |
| SC-7 / D-06 | Reconciliação reproduz o subset do oráculo que AC/2019 prova — **gate permanente** | gate (Python via npm) | `uv run pytest tests/test_reconcile_gate.py -x`, encadeado em `test:run` | ❌ Wave 0 |
| PIPE-02 | `sih_collection_status` existe e é lido pelo app com a chave anon | integration (Node) | `vitest`, padrão já usado para `sih_metric_uf` na Fase 8 | ❌ Wave 0 |

---

## Como cada critério de sucesso é PROVADO

| SC | Prova (não asserção) |
|----|----------------------|
| **SC-1** | Teste monta lista esperada fixa (ex.: 3 UFs × 2 meses), passa um conjunto "atual" com um item faltando de propósito; asserção é que a função levanta exceção / retorna saída não-zero — **nunca** que retorna silenciosamente "0 ausentes". A chamada real de rede (`SIH.get_files()`) é exercitada uma vez, manualmente, fora do gate. |
| **SC-2** | `sih_collection_status` legível pela chave anon com os três estados distinguíveis (`coletado` / `falhou` / `nunca_tentado`) — teste `vitest` no padrão da Fase 8. |
| **SC-3** | Teste de integração: roda o `COPY` uma vez, interrompe no meio (mata processo / simula exceção), reexecuta do zero, afirma contagem final **igual** à esperada — nem a mais, nem a menos. A garantia estrutural é o `staging + swap` do D-17: o swap só ocorre após o `COPY` inteiro terminar. |
| **SC-4** | Teste de contrato com stub da contagem PostgREST: forçado a devolver número **diferente** do esperado, a função de limpeza de cache **não** pode ser chamada; só é chamada no caminho onde a contagem confere. Verifica ordem de chamadas, não rede real. |
| **SC-5** | Cobertura auditada por consulta ao ledger: 331 agravos × 4 medidas × 2 grãos × 2 locais, com contagem re-lida da fonte servida. |
| **SC-6** | `derived_at` e `cid_map_version` presentes no ledger (D-15) e alcançáveis pela mesma chave que o app consulta. |
| **SC-7** | Fixture de entrada `rdac1901_2019.parquet` (ano inteiro de AC/2019, só as colunas necessárias — medido: ~140–250 KB) + fixture de oráculo `oracle_ac_2019.json` (só os pares cuja UF é AC, **re-raspados ao vivo** por D-04 antes de serem confiados). O teste roda o matcher real + camada de correções (D-05), agrega, e compara: exato ou com razão registrada (D-02) — nunca banda de tolerância. |

**Fixture do oráculo (D-04):** não é o CSV antigo do pipeline aposentado — é o resultado
de rodar o raspador mínimo (D-18) uma vez, manualmente, contra o TabNet real, filtrado
para UF=AC. Cada entrada carrega código do agravo, ano, valor TabNet e data da raspagem.
Refresh futuro é comando explícito e documentado, **nunca** parte do `gate` — honra o
padrão "snapshot versionado em vez de `fetch()` ao vivo" (Fase 8 D-09).

**Confirmação da UF grande (D-03):** SP ou MG confirma a correção uma vez, manualmente,
durante a execução da fase. **Não** entra na fixture do gate — um mês de SP mede ~16 MB
só o `.dbc`, grande demais para um gate leve.

---

## Wave 0 Requirements

- [ ] `pyproject.toml` do pipeline Python com `[tool.pytest.ini_options]` + `uv add --dev pytest`
- [ ] `tests/conftest.py` — fixtures compartilhadas do lado Python
- [ ] `tests/fixtures/rdac1901_2019.parquet` — ano inteiro de AC/2019, colunas mínimas (`DIAG_PRINC`, `MUNIC_MOV`, `MUNIC_RES`, `MORTE`, `VAL_TOT`, `DIAS_PERM`)
- [ ] `tests/fixtures/oracle_ac_2019.json` — oráculo re-raspado ao vivo (D-04), só pares UF=AC
- [ ] `tests/test_enumerate.py`, `tests/test_ledger.py`, `tests/test_upload.py`, `tests/test_aggregate.py`, `tests/test_reconcile_gate.py` — stubs
- [ ] Ponte Node→Python: script npm (proposto `pipeline:reconcile-gate`) encadeado em `test:run`, do jeito que `catalog:validate` já é
- [ ] CI: instalar `uv` (`astral-sh/setup-uv`, **pinada por SHA de commit**, mesma disciplina do workflow atual) antes do passo `npm run gate`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Enumeração real contra o FTP do DATASUS | PIPE-01 | Depende de rede; não pode entrar no `gate` | Rodar a enumeração para um recorte pequeno e conferir a contagem esperada de arquivos |
| Corrida completa de coleta e contagem final | PIPE-05 | Dias de execução, ~10 GB | Auditar a contagem final do ledger antes do checkpoint de upload |
| Confirmação da correção CID contra UF grande | SC-7 / D-03 | Fixture grande demais para o gate | Rodar a agregação contra SP ou MG uma vez, sem redepurar |
| Checkpoint clínico das correções de faixa CID | SC-7 / D-07 | Julgamento clínico humano | Apresentar a tabela completa (código, faixa antiga, faixa nova, delta antes/depois, razão) de uma vez |
| Ordem de coleta por relevância cirúrgica | D-23 | Julgamento clínico do usuário | Checkpoint curto, no formato do checkpoint clínico da 08-07 |
| Medição real do tamanho das 27 partições de UF | D-21 | Só existe após a primeira agregação | Medir antes de travar o formato de partição |

---

## Validation Sign-Off

- [x] Todas as tasks têm verify `<automated>` ou dependência de Wave 0
- [x] Continuidade de amostragem: não há 3 tasks consecutivas sem verify automatizado
- [x] Wave 0 cobre todas as referências MISSING — entregue pelo plano `09-02` (Onda 1)
- [x] Sem flags de watch-mode
- [x] Latência de feedback < 60 s — `npm run gate` foi retirado de todo `<verify><automated>` na revisão 1
- [x] `nyquist_compliant: true` no frontmatter

**Approval:** approved 2026-08-05 — `gsd-plan-checker` retornou `VERIFICATION PASSED` sobre os 14 planos
(0 blockers), confirmando verify automatizado em todas as 40+ tasks e Onda 0 completa.
