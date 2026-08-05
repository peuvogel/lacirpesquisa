---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 02
subsystem: infra
tags: [uv, python, pysus, psycopg, pytest, ci, package.json, asvs-v12]

# Dependency graph
requires:
  - phase: 09-01
    provides: ".gitignore cobrindo .venv/cache/reports*.log do pipeline (D-17)"
provides:
  - "Projeto uv em pipeline/sih/ com pysus==1.0.1 e psycopg[binary]==3.3.4 pinados exatos"
  - "Guarda de caminho ASVS V12 (paths.py) — cache_root/cache_path/ledger_path/reports_path/repo_root"
  - "Dez esqueletos de teste com dono declarado por plano (09-04 a 09-11)"
  - "npm run gate fail-closed sobre a suíte Python (pretest/test:run encadeiam pipeline:test)"
  - "CI instala uv (astral-sh/setup-uv pinado por SHA) antes de npm ci"
  - "Contrato fixo dos scripts pipeline:* e catalog:sih-* que os planos 09-03..09-14 implementam"
affects: [09-04, 09-05, 09-06, 09-07, 09-08, 09-09, 09-10, 09-11, 09-12, 09-14]

# Tech tracking
tech-stack:
  added: ["uv (gerenciador de projeto Python)", "pysus==1.0.1", "psycopg[binary]==3.3.4", "pytest>=8,<9", "astral-sh/setup-uv (CI)"]
  patterns:
    - "Guarda de caminho ASVS V12 em Python espelhando corpusPath()/paths.mjs: rejeita absoluto, traversal (início e meio), string vazia, prefixo fora do allowlist, com asserção final de resolve() contra a raiz (defesa contra symlink)"
    - "Encadeamento fail-closed A && B em pretest/test:run/gate — nunca ||"
    - "Actions de CI pinadas por SHA de commit resolvido ao vivo via gh api, nunca tag móvel"
    - "Esqueleto de teste com dono declarado: docstring + pytest.skip(allow_module_level=True) até o plano dono preencher"

key-files:
  created:
    - pipeline/sih/pyproject.toml
    - pipeline/sih/.python-version
    - pipeline/sih/uv.lock
    - pipeline/sih/README.md
    - pipeline/sih/src/sih_pipeline/__init__.py
    - pipeline/sih/src/sih_pipeline/paths.py
    - pipeline/sih/tests/conftest.py
    - pipeline/sih/tests/test_paths.py
    - pipeline/sih/tests/test_enumerate.py
    - pipeline/sih/tests/test_ledger.py
    - pipeline/sih/tests/test_matcher.py
    - pipeline/sih/tests/test_aggregate.py
    - pipeline/sih/tests/test_oracle_scrape.py
    - pipeline/sih/tests/test_population.py
    - pipeline/sih/tests/test_reconcile.py
    - pipeline/sih/tests/test_partitions.py
    - pipeline/sih/tests/test_upload.py
    - pipeline/sih/tests/test_reconcile_gate.py
  modified:
    - package.json
    - .github/workflows/ci.yml

key-decisions:
  - "pysus pinado exatamente em 1.0.1 (nunca >=/~=) — a 2.x devolve arquivos RJ/SP sob o nome do grupo RD pedido, defeito medido no spike 2026-08-04"
  - "cli.py (despachante dos subcomandos pipeline:*) tem dono único: plano 09-04 — nenhum outro plano da fase o edita"
  - "astral-sh/setup-uv pinado por SHA de commit (c771a70e6277c0a99b617c7a806ffedaca235ff9, tag v9.0.0) resolvido ao vivo via gh api, não hardcoded"

patterns-established:
  - "paths.py: todo módulo futuro do pipeline que escreve arquivo usa cache_path()/ledger_path()/reports_path(), nunca monta caminho manualmente"
  - "Scripts pipeline:* apontam para sih_pipeline.cli (dono 09-04); até o cli.py existir, qualquer chamada falha alto — nenhum script npm desta família pode sair 0 sem implementação real"

requirements-completed: []  # PIPE-01/PIPE-03/PIPE-04/DATA-03 declarados no plano mas NÃO completos — Wave 0 só cria os stubs; comportamento real entregue em 09-04/09-07/09-10 (ver "Nota sobre REQUIREMENTS.md" abaixo)

# Metrics
duration: ~12min
completed: 2026-08-05
---

# Phase 09 Plan 02: Pipeline Python (Onda 0) + guarda de caminho + ponte CI Summary

**Projeto `uv` em `pipeline/sih/` com `pysus==1.0.1` pinado, guarda de caminho ASVS V12 testado contra 9 casos (incluindo traversal no meio do caminho), dez esqueletos de teste Wave 0 com dono declarado, e `npm run gate` fail-closed sobre a suíte Python local e no CI.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3/3 completos
- **Files modified:** 20 (18 criados em `pipeline/sih/`, 2 modificados na raiz)

## Accomplishments

- Ambiente Python reprodutível: `uv sync --frozen` instala `pysus==1.0.1` + `psycopg[binary]==3.3.4` em Python 3.11, com `uv.lock` versionado
- Guarda de caminho equivalente Python de `corpusPath()` (`scripts/catalog/paths.mjs`), provado contra 9 comportamentos incluindo traversal no meio do caminho (`parquet/../../fora`) e defesa contra symlink via `resolve()`
- Dez arquivos de teste (`test_enumerate.py` .. `test_reconcile_gate.py`) existem com dono fixo por plano, satisfazendo `09-VALIDATION.md` §"Wave 0 Requirements" para que os `<automated>` dos planos 09-04 a 09-11 já apontem para arquivo existente
- `pretest`/`test:run` encadeiam `npm run pipeline:test` com `&&` antes do `vitest run` — uma falha da suíte Python derruba `npm run gate`, local e no CI (`astral-sh/setup-uv` pinado por SHA instalado antes de `npm ci`)
- Contrato fixo de 14 scripts `pipeline:*`/`catalog:sih-*` declarado em `package.json`, cada um com plano dono nominal — nenhum aponta para subcomando inexistente sem dizer quem o entrega

## Task Commits

Cada task foi commitada atomicamente (Task 2 seguiu TDD por ter `tdd="true"`):

1. **Task 1: Projeto uv em pipeline/sih/ com pysus==1.0.1 pinado** - `9a888c5` (feat)
2. **Task 2 (RED): teste falho do guard de caminho** - `3e2a869` (test)
2. **Task 2 (GREEN): paths.py + conftest.py + 10 esqueletos** - `dffb6ea` (feat)
3. **Task 3: ponte Node→Python fail-closed + uv no CI** - `59a9b93` (feat)

_TDD: RED (`3e2a869`) confirmado falhando com `ModuleNotFoundError: No module named 'sih_pipeline.paths'` antes de `paths.py` existir; GREEN (`dffb6ea`) com os 9 testes de `test_paths.py` passando._

## TDD Gate Compliance

Task 2 (`tdd="true"`): commit `test(...)` (`3e2a869`) precede o commit `feat(...)` (`dffb6ea`) no histórico — gate RED→GREEN respeitado. Sem commit `refactor(...)` — não foi necessário.

## Files Created/Modified

- `pipeline/sih/pyproject.toml` — projeto uv, `pysus==1.0.1`/`psycopg[binary]==3.3.4` pinados exatos, dev-dep `pytest`, `[tool.pytest.ini_options]`
- `pipeline/sih/.python-version` — `3.11`
- `pipeline/sih/uv.lock` — lockfile versionado
- `pipeline/sih/README.md` — documenta o defeito medido do índice de arquivos da `pysus` 2.x e proíbe atualizar sem reproduzir o teste do spike
- `pipeline/sih/src/sih_pipeline/__init__.py` — pacote vazio (`__all__ = []`)
- `pipeline/sih/src/sih_pipeline/paths.py` — `cache_root()`, `cache_path()`, `ledger_path()`, `reports_path()`, `repo_root()`
- `pipeline/sih/tests/conftest.py` — fixture `cache_dir(tmp_path, monkeypatch)`, sem tocar rede
- `pipeline/sih/tests/test_paths.py` — 9 testes do guard de caminho
- `pipeline/sih/tests/test_{enumerate,ledger,matcher,aggregate,oracle_scrape,population,reconcile,partitions,upload,reconcile_gate}.py` — esqueletos com dono declarado (09-04 a 09-11)
- `package.json` — `pretest`/`test:run` encadeiam `pipeline:test`; família completa `pipeline:*`/`catalog:sih-*` declarada
- `.github/workflows/ci.yml` — `astral-sh/setup-uv@c771a70e...` (v9.0.0) inserido entre `setup-node` e `npm ci`

## Decisions Made

- **pysus pinado em `1.0.1` exato** — a `2.x` (latest no PyPI) devolve arquivos `RJ`/`SP` sob o nome do grupo `RD` pedido; README documenta o porquê e proíbe atualização silenciosa (spike 2026-08-04 §1-2)
- **`cli.py` tem dono único (plano 09-04)** — `package.json` declara o contrato dos 9 subcomandos `sih_pipeline.cli`, mas nenhum outro plano da fase edita o despachante; até o `main()` existir, o subcomando sai com código 2 nomeando o plano dono, nunca 0 fingindo sucesso
- **SHA do `astral-sh/setup-uv` resolvido ao vivo via `gh api`** (não hardcoded/adivinhado) — `c771a70e6277c0a99b617c7a806ffedaca235ff9` corresponde à tag `v9.0.0` (tag leve, sem necessidade de dereferenciar)

## Deviations from Plan

None - plan executado exatamente como escrito. A única diferença de superfície é que `uv add --dev pytest` (Task 2) reformatou `pyproject.toml` (`dev = [...]` de uma linha para multi-linha) sem mudar a dependência já declarada na Task 1 — cosmético, sem efeito funcional, commitado junto da Task 2 por ser o mesmo arquivo já sob escopo do plano.

## Known Stubs

Os dez esqueletos de teste em `pipeline/sih/tests/` são stubs **intencionais e documentados**, exigidos pelo próprio `09-VALIDATION.md` §"Wave 0 Requirements" — cada um contém `pytest.skip("preenchido pelo plano 09-NN", allow_module_level=True)` e é preenchido pelo plano dono correspondente:

| Arquivo | Requisito | Plano dono |
|---|---|---|
| `test_enumerate.py` | PIPE-01/SC-1 | 09-04 |
| `test_ledger.py` | PIPE-03/SC-3 | 09-04 |
| `test_oracle_scrape.py` | D-18/D-04 | 09-05 |
| `test_population.py` | D-24 | 09-06 |
| `test_matcher.py` | matcher CID | 09-07 |
| `test_aggregate.py` | DATA-03 | 09-07 |
| `test_reconcile.py` | SC-7/D-02 | 09-08 |
| `test_partitions.py` | D-20/D-21 | 09-09 |
| `test_upload.py` | PIPE-04/SC-4 | 09-10 |
| `test_reconcile_gate.py` | SC-7/D-06 | 09-11 |

O plano `09-14` fecha um gate que falha se algum `allow_module_level=True` sobreviver ao fim da fase. Os 9 scripts `pipeline:enumerate`/`download`/`aggregate`/`population`/`reconcile`/`partitions`/`upload`/`oracle-scrape`/`audit` também apontam para `sih_pipeline.cli`, que só nasce no plano `09-04` — até lá, chamá-los sai com código 2 nomeando o plano dono (não é stub silencioso: falha alto).

**Nota sobre REQUIREMENTS.md:** este plano declara `requirements: [PIPE-01, PIPE-03, PIPE-04, DATA-03]`
no frontmatter, mas **não** foram marcados `[x]` em `.planning/REQUIREMENTS.md` — a própria
`09-VALIDATION.md` §"Requirement → Test Map" lista o `<automated>` desses quatro requisitos como
"❌ Wave 0" (os testes reais nascem em `09-04`/`09-07`/`09-10`; aqui eles só existem como stub
`pytest.skip`). Marcar como `Complete` agora seria falso — a checkbox correta é apagada quando o
plano dono de cada requisito (não este) entregar o comportamento real e o teste passar de verdade.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária nesta plan (a credencial Postgres/Supabase do pipeline é tratada no `09-01`, já pausado em checkpoint humano).

## Next Phase Readiness

- `pipeline/sih/` está pronto para os planos 09-03 a 09-14 escreverem contra o contrato fixo de `paths.py` e dos scripts `pipeline:*`
- `npm run gate` verificado verde localmente (762 testes Vitest + 9 testes pytest + build) — a suíte Python está dentro das garantias da Fase 7, não fora delas
- Plano `09-01` permanece pausado em checkpoint humano (Task 1, credencial D-17) — não bloqueia este plano, que declarou `depends_on: []`

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-05*

## Self-Check: PASSED

Todos os 21 arquivos listados em Files Created/Modified existem no disco; todos os 4 hashes de
commit (`9a888c5`, `3e2a869`, `dffb6ea`, `59a9b93`) existem em `git log --oneline --all`.
