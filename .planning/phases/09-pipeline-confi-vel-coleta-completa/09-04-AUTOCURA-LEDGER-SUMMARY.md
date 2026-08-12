---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 04-AUTOCURA-LEDGER
subsystem: infra
tags: [ledger, self-heal, collect, resumabilidade, pyarrow]

# Dependency graph
requires:
  - phase: 09-04 (COLETA-INCREMENTAL)
    provides: collect.py (collect_uf/collect_all/CollectLedger), ledger.py (FileLedger)
provides:
  - "collect.py: _self_heal_ghost_entries -- restaura para pendente de novo download toda
    entrada 'baixado' de uma UF INCOMPLETA cujo parquet sumiu do disco, antes de decidir o que
    baixar -- fecha o deadlock permanente que travava RO/PB/PI/RN"
  - "ledger.py: FileLedger.reset_missing -- único caminho que ignora de propósito a disciplina
    de não-rebaixamento do PIPE-03, só para uma divergência ledger/disco já confirmada"
  - "CollectLedger.self_heal_count/record_self_heal -- contador persistido por UF, guarda
    limitada (_MAX_SELF_HEALS_PER_UF=3) contra um loop de self-cura escondendo dano real"
affects: [09-09-particoes-storage, 09-10-upload-postgres, 09-13-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "self-cura escopada por invariante de estado (CollectLedger.status != agregado_reciclado)
      em vez de por padrão de dado -- o mesmo padrão ledger/disco é dano numa UF incompleta e
      design correto numa UF completa; só o estado da UF diferencia os dois"
    - "guarda numérica persistida (contador por UF) para transformar um self-heal que se repete
      numa UF de silêncio automático em falha visível e isolada (PIPE-06)"
    - "defesa em profundidade: a safety property original (_aggregate_uf recusa agregar com
      parquet ausente) nunca foi removida -- a self-cura só abre uma segunda chance de download,
      nunca contorna a checagem"

key-files:
  created: []
  modified:
    - pipeline/sih/src/sih_pipeline/collect.py
    - pipeline/sih/src/sih_pipeline/ledger.py
    - pipeline/sih/tests/test_collect.py
    - pipeline/sih/tests/test_ledger.py

key-decisions:
  - "reset_missing() é o único método que ignora a disciplina de não-rebaixamento do
    mark_failed/PIPE-03 -- só chamado depois que o chamador já confirmou a divergência contra o
    disco real, nunca para tratar uma falha espúria de rerun (essa continua protegida)"
  - "self-cura é condicionada SÓ ao estado do CollectLedger (não agregado_reciclado), nunca ao
    padrão de dado em si -- uma UF completa com o mesmo padrão fantasma fica sempre intocada"
  - "guarda de repetição por UF (_MAX_SELF_HEALS_PER_UF=3, contador persistido) -- decisão
    consciente de não deixar a self-cura rodar para sempre; na 4a vez a UF estoura, isolada, para
    investigação manual"

requirements-completed: []

# Metrics
duration: ~50min
completed: 2026-08-12
---

# Phase 9 Plan 04-AUTOCURA-LEDGER: Self-cura do deadlock ledger/disco em `collect.py` Summary

**`collect.py` agora se auto-cura de uma divergência ledger/disco que antes travava uma UF para sempre: uma entrada `baixado` sem parquet em disco é detectada e resetada ANTES da decisão de download — mas só para uma UF que ainda não terminou; uma UF `agregado_reciclado` com o mesmo padrão (esperado, por design) fica sempre intocada.**

## Contexto: por que este trabalho existe

Não havia `PLAN.md` formal — o brief operacional do usuário (2026-08-12) foi o spec. `collect_uf`
recusava (corretamente) agregar uma UF quando um arquivo estava `baixado` no `FileLedger` mas seu
parquet não existia em disco, mas não havia saída: o arquivo nunca voltava a `pending()` (excluído
por já estar `baixado`) e nunca conseguia agregar (parquet ausente). A UF ficava `falhou` para
sempre. Medido em produção em RO, PB, PI e RN — reparado à mão duas vezes, apagando 276 entradas do
ledger com um script ad-hoc. A primeira tentativa de reparo manual cometeu o erro que este trabalho
existe para não repetir em código: apagou também entradas fantasma de UFs já completas
(`agregado_reciclado`), que são o padrão ESPERADO depois da reciclagem, e forçou re-download em
massa sem necessidade nenhuma.

**A corrida de coleta nacional estava rodando ao vivo durante toda esta sessão** (PID 53483,
reiniciada pelo operador após o reparo manual) — nenhum comando tocou `~/.lacir/sih-cache/`; a
edição dos `.py` é segura porque o processo já carregou seus módulos (o efeito só aparece na
próxima corrida). Verificado vivo antes, durante e depois de cada commit.

## Performance

- **Duração:** ~50 min
- **Commits:** 2 (fix ledger.py + test, feat collect.py + testes)
- **Arquivos modificados:** 4 (0 criados, 4 modificados)
- **Testes novos:** 9 em `test_collect.py` (26 no total, de 20 antes) + 1 em `test_ledger.py` (9
  no total, de 8 antes)

## Accomplishments

- `_self_heal_ghost_entries` (novo, `collect.py`): roda no início de `collect_uf`, antes de
  qualquer decisão de download. Para uma UF cujo `CollectLedger.status` **não** é
  `agregado_reciclado`, confere cada entrada `baixado` da UF contra o disco real; a que estiver
  ausente é resetada via `FileLedger.reset_missing`, voltando a ser elegível para `pending()` e,
  portanto, para o download normal re-buscar.
- `FileLedger.reset_missing` (novo, mínimo, `ledger.py`): único método que ignora de propósito a
  disciplina de não-rebaixamento do `mark_failed`/PIPE-03 — só usado quando o chamador já
  confirmou a divergência contra o disco real, nunca para uma falha espúria de rerun (essa
  continua protegida, provado por teste em `test_ledger.py`).
- **UF `agregado_reciclado` com o mesmo padrão fantasma fica sempre intocada** — a checagem de
  estado (`collect_ledger.status(uf) == ESTADO_AGREGADO_RECICLADO`) é a PRIMEIRA coisa que
  `_self_heal_ghost_entries` avalia; devolve `0` sem tocar em nada. Provado por teste round-trip
  real em disco (carrega o `FileLedger` antes/depois e compara a entrada inteira, byte a byte).
- **Guarda limitada contra loop de self-cura**: `CollectLedger.self_heal_count`/`record_self_heal`
  mantêm um contador persistido por UF; na `_MAX_SELF_HEALS_PER_UF + 1`-ésima vez que a mesma UF
  precisaria de self-cura, `_self_heal_ghost_entries` levanta em vez de curar de novo — a UF fica
  `falhou`, isolada (PIPE-06), sinalizando que algo além de uma interrupção pontual está
  destruindo parquet fora do `FileLedger`.
- **Safety property original preservada, nunca enfraquecida**: `_aggregate_uf` não mudou uma
  linha. Provado por dois testes: (1) self-cura dispara mas o redownload não consegue repor o
  arquivo — a UF ainda falha de forma limpa, nenhum parquet agregado é escrito; (2) `collect_uf`
  chamada diretamente numa UF `agregado_reciclado` com fantasma (fora do laço normal de
  `collect_all`, que a pularia de saída) ainda recusa agregar, com a mesma mensagem de erro
  original ("ledger e disco divergem").

## Task Commits

1. **`FileLedger.reset_missing` + teste** — `947e3af` (fix)
2. **`_self_heal_ghost_entries` + `CollectLedger.self_heal_count`/`record_self_heal` + 9 testes +
   fix de `mark_baixado_pendente_agregacao`** — `e0198f9` (feat)

**Plan metadata:** commit deste SUMMARY + STATE.md (a seguir)

## Files Modified

- `pipeline/sih/src/sih_pipeline/collect.py` — `_self_heal_ghost_entries`,
  `CollectLedger.self_heal_count`/`record_self_heal`, `_MAX_SELF_HEALS_PER_UF`, chamada em
  `collect_uf`, docstring do módulo ampliada ("Self-cura do ledger"), `summary()` ganha
  `self_heals_total`
- `pipeline/sih/src/sih_pipeline/ledger.py` — `FileLedger.reset_missing` (método novo, mínimo)
- `pipeline/sih/tests/test_collect.py` — 9 testes novos (self-cura, regressão de UF completa,
  defesa em profundidade, guarda de repetição, isolamento por UF) + 1 assert adicionado ao teste
  de caminho feliz existente
- `pipeline/sih/tests/test_ledger.py` — 1 teste novo (`reset_missing` ignora a guarda de
  `mark_failed`)

## Decisions Made

1. **`reset_missing` em vez de reaproveitar `mark_failed`.** `mark_failed` recusa
   corretamente rebaixar um arquivo `baixado` (PIPE-03) — é o comportamento certo contra falha
   espúria de rerun. A self-cura é um caso deliberadamente diferente: o chamador já confirmou a
   divergência contra o disco real. Reaproveitar `mark_failed` exigiria enfraquecer sua guarda
   para todo mundo; um método novo, mínimo, com essa exceção nomeada e documentada, preserva o
   contrato original intacto para todos os outros chamadores.

2. **Self-cura condicionada só ao estado da UF, nunca ao padrão de dado.** O padrão "arquivo
   `baixado` sem parquet em disco" é IDÊNTICO nos dois casos (UF incompleta com dano real vs. UF
   completa com reciclagem esperada) — só o `CollectLedger.status(uf)` diferencia. Checar isso
   PRIMEIRO, antes de examinar qualquer arquivo individual, é o que impede a self-cura de repetir
   o erro da primeira tentativa de reparo manual (apagar entradas de UF já completa).

3. **Guarda de repetição por UF, não global.** Um contador por UF (`self_heals`, persistido no
   `CollectLedger`) — não um contador único da corrida inteira — porque o sintoma relevante é
   "esta UF específica continua perdendo parquet", não "a corrida teve N self-curas no total"
   (27 UFs cada uma self-curando uma vez é normal numa corrida longa; a MESMA UF self-curando 4
   vezes é o sinal de problema).

4. **`_self_heal_ghost_entries` roda dentro de `collect_uf`, não em `collect_all`.** `collect_uf`
   já é chamada diretamente por outros pontos (testes, potencialmente scripts futuros) — colocar
   a self-cura lá garante que qualquer chamador de `collect_uf` recebe a proteção, não só quem
   passa por `collect_all`. O teste de defesa em profundidade prova que mesmo uma chamada direta
   fora do fluxo normal continua segura.

## Deviations from Plan

Não havia `PLAN.md` formal — o brief operacional era o spec. Um desvio encontrado durante o TDD:

### Auto-fixed Issues

**1. [Rule 1 - Bug] `mark_baixado_pendente_agregacao` apagava o contador de self-cura recém-gravado**
- **Encontrado durante:** escrita do primeiro teste de self-cura (`test_collect_uf_incompleta_self_cura_fantasma_e_conclui`) — `self_heal_count("AC")` voltava `0` depois de uma corrida que, pelo log em stderr, claramente tinha self-curado.
- **Problema:** `mark_baixado_pendente_agregacao` fazia `self._ufs[uf] = {...}` — substituição TOTAL da entrada da UF no `CollectLedger`, não um merge. `_self_heal_ghost_entries` grava `self_heals` na mesma chamada de `collect_uf`, ANTES dessa linha rodar; a substituição total apagava o contador silenciosamente a cada vez que uma UF precisasse de self-cura, quebrando a guarda de repetição sem nenhum sintoma visível (o self-heal continuaria "funcionando", só a guarda nunca dispararia).
- **Fix:** trocado para `setdefault` + `update`, o mesmo padrão que `mark_agregado_reciclado` já usava — preserva qualquer campo de auditoria pré-existente na entrada (agora `self_heals`, potencialmente outros no futuro) em vez de descartar tudo.
- **Testes que capturaram isso:** os dois testes de self-cura bem-sucedida (`test_collect_uf_incompleta_self_cura_fantasma_e_conclui`, `test_collect_all_self_cura_uma_uf_e_isola_da_proxima`) — falharam antes do fix, passam depois.
- **Arquivo modificado:** `pipeline/sih/src/sih_pipeline/collect.py`
- **Commit:** `e0198f9` (mesmo commit da feature — o bug só existe por causa dela, corrigido antes de qualquer commit chegar a existir com o contador quebrado)

---

**Total de desvios:** 1 auto-corrigido (Rule 1 — bug de persistência capturado pelo próprio TDD
antes de qualquer commit, nunca chegou a existir em código versionado quebrado).

## Issues Encountered

Nenhum bloqueio. A corrida de coleta real permaneceu viva (PID 53483) durante toda a sessão,
verificada antes de cada leitura, depois de cada edição e depois de cada commit (o pre-commit hook
roda `npm run gate`, que inclui build de produção — verificado que o processo sobrevive mesmo a
essa carga).

## User Setup Required

None — nenhuma configuração de serviço externo, nenhuma variável de ambiente nova. O efeito da
correção só aparece na PRÓXIMA vez que `collect.py` for iniciado (a corrida atual já carregou os
módulos antigos em memória, como o brief antecipava) — não é preciso reiniciar a corrida atual
para validar isto; os testes offline já provam o comportamento.

## Next Phase Readiness

**O que está pronto:**
- Qualquer UF que travar `falhou` por esta mesma classe de divergência ledger/disco (como
  RO/PB/PI/RN travaram) vai se auto-curar na próxima vez que a corrida processá-la — sem
  intervenção manual, sem script ad-hoc, sem risco de apagar entradas de UF já completa.
- O log de self-cura (`collect: {uf} self-curou N entrada(s) ... (self-cura nº K/3 desta UF)`) dá
  visibilidade countable a cada ocorrência — se aparecer com frequência incomum numa UF
  específica, é sinal de investigar a causa raiz real (disco cheio, processo concorrente) antes
  que a guarda de 3 tentativas estoure essa UF.

**O que NÃO foi tocado (fora de escopo, por design):**
- `download.py`, `aggregate.py`, `partitions.py`, `reconcile.py`, `upload.py`, `supabase/` — nenhum
  desses arquivos foi lido para além do necessário para confirmar que `download_all(only=...)`
  recebe a lista completa de arquivos da UF (não só os faltantes) e decide sozinho o que baixar via
  `ledger.pending(expected)`, o que é o que torna a self-cura suficiente sem precisar calcular
  `faltantes` de novo antes de chamar `download_fn`.
- A corrida de coleta real em andamento não foi reiniciada nem interrompida — o operador decide
  quando aplicar esta correção (reiniciando o processo na próxima janela de manutenção, ou
  deixando a corrida atual terminar e usando isto só se uma UF nova travar).

## Self-Check: PASSED

- FOUND: `pipeline/sih/src/sih_pipeline/collect.py` (modificado)
- FOUND: `pipeline/sih/src/sih_pipeline/ledger.py` (modificado)
- FOUND: `pipeline/sih/tests/test_collect.py` (modificado, 26 testes)
- FOUND: `pipeline/sih/tests/test_ledger.py` (modificado, 9 testes)
- FOUND commit `947e3af` (fix: `FileLedger.reset_missing`)
- FOUND commit `e0198f9` (feat: self-cura em `collect.py`)
- CONFIRMADO: `uv run pytest` (231 passed, 1 skipped) e `npm run gate` (796 testes JS/TS + build)
  verdes depois de cada commit
- CONFIRMADO: processo da corrida real de coleta (PID 53483) vivo antes, durante e depois de toda
  a sessão, incluindo depois de cada `npm run gate` disparado pelo pre-commit hook

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-12*
