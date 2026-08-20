---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 17-SWAP-DT-INTER
subsystem: database
tags: [python, psycopg, postgres, copy, supabase, postgrest, storage, sql-codegen, production, dt-inter, rls]

# Dependency graph
requires:
  - phase: 09-15-DT-INTER
    provides: "agregação chaveada por DT_INTER e os 27 agregados/{uf}.parquet da recoleta nacional -- o insumo desta substituição"
  - phase: 09-16-PARIDADE
    provides: "a paridade provada contra um TabNet bem-formado -- a razão para confiar no dado que subiu aqui"
  - phase: 09-10
    provides: "upload.py/partitions.py e a disciplina staging -> swap -> recount -> release_cache, reaproveitados SEM nenhuma alteração de código"
  - phase: 09-13
    provides: "generateSihPacks.mjs -- os 10 packs derivados de sih_metric_uf, refeitos aqui DEPOIS do swap"
provides:
  - "A TERCEIRA substituição de produção executada e provada: sih_metric_uf trocou a base de contagem de ANO_CMPT para DT_INTER, 207.664 -> 207.965 linhas, 331 agravos mantidos"
  - "As 27 partições de município regeneradas por DT_INTER e reenviadas ao Storage (131,50 MB, SP=19,37 MB)"
  - "Os 10 packs regenerados a partir do sih_metric_uf já trocado -- o site serve DT_INTER"
  - "ESPERADO_SIH_METRIC_UF sincronizado nos DOIS geradores que o cravam (swap-verify e retire-migration)"
  - "MEDIÇÃO do efeito do swap: 84,7% das chaves comuns mudam de valor, +1,85% de internações nacionais"
  - "PROVA de que o resíduo de 3 linhas com UF_ZI malformado não se reproduz neste dataset"
  - "Três achados registrados: colisão de literal em 2 testes, 16 linhas de proveniência velha, GRANT de TRUNCATE para anon"
affects: [09-14, qualquer fase de UI que leia os packs, o upload de população]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A parte reversível antes da irreversível: partições ao Storage primeiro, swap do Postgres depois -- sem dependência de ordem, mas se as partições falharem o irreversível ainda não aconteceu"
    - "Um número cravado à mão precisa de um teste que trave a igualdade entre TODOS os lugares que o cravam -- o segundo gerador só apareceu porque sihRetireMigration.test.ts existia"
    - "Prova de recusa de escrita nunca deve ser feita escrevendo em cima de dado real: o catálogo de policies responde a mesma pergunta sem arriscar nada"
    - "Um literal de teste que volta a coincidir com o valor que ele existia para excluir perde o poder de discriminar -- e isso tem de ficar escrito, não corrigido em silêncio"

key-files:
  created:
    - .planning/phases/09-pipeline-confi-vel-coleta-completa/09-17-SWAP-DT-INTER-SUMMARY.md
  modified:
    - scripts/catalog/generateSihSwapVerify.mjs
    - scripts/catalog/generateSihRetireMigration.mjs
    - supabase/verify/sih-swap-contagens.sql
    - supabase/verify/sih-retire.sql
    - supabase/migrations/20260806000000_sih_retire_muni.sql
    - public/data/catalog/packs/*.json
    - src/features/catalog/sihSwapVerify.test.ts
    - src/features/catalog/catalogAnalysisData.test.ts
    - src/routes/mapas/assembleHandoffTable.test.ts

# Metrics
duration: ~55min de parede (pré-voo, partições, swap, proveniência, packs, gate, commits)
completed: 2026-08-18
commits: 4
---

# Phase 9 Plan 17-SWAP-DT-INTER: Produção passa a contar por data de internação Summary

Nenhuma coleta foi executada. Este plano só levou ao ar o que o 09-15 já tinha em disco e o
09-16 já tinha provado.

## O resultado, em uma tabela

| Prova de aceite | Resultado |
|---|---|
| `sih-swap-contagens.sql` contra produção real | **exit 0**, nenhum dos 5 `RAISE EXCEPTION` disparou |
| Tabelas `*_staging` órfãs | **nenhuma** |
| `db_size` | **430 MB** (era 424; teto 500, folga de 70 MB) |
| Agravo ponta a ponta pelo PostgREST **anônimo** | `amputacao_mmii` AC/2019 = **66**, batendo agregado local = produção = pack |
| Amostra ampliada (5 agravos × 27 UFs) | **135 pares exatos, 0 divergências** |
| Leitura anônima | PostgREST **200**, Storage **200** |
| Escrita anônima | PostgREST **401** |
| `npm run gate` | **verde** — 319 testes Python, 839 vitest, build OK |

## Estado antes e depois (medido em produção, nunca assumido)

| Item | Antes (ANO_CMPT) | Depois (DT_INTER) | Delta |
|---|---|---|---|
| `sih_metric_uf` | 207.664 | **207.965** | +301 |
| Agravos distintos | 331 | 331 | 0 |
| Anos / UFs | 2013-2025 / 27 | 2013-2025 / 27 | 0 |
| `local=ocorrencia` | 103.619 | 103.767 | +148 |
| `local=residencia` | 104.045 | 104.198 | +153 |
| internações (soma) | 308.872.790 | **314.597.534** | **+5.724.744 (+1,85%)** |
| óbitos (soma) | 14.221.282 | 14.440.086 | +218.804 (+1,54%) |
| dias de permanência | 1.528.258.660 | 1.555.490.984 | +27.232.324 (+1,78%) |
| valor total | 441.409.833.703 | 450.072.935.542 | +8.663.101.839 (+1,96%) |
| `sih_collection_status` grão uf | 33.560 | 33.584 | +24 |
| `sih_metric_muni` | 1.099.403 | 1.099.403 | 0 (intocada) |
| Partições no Storage | 130,05 MB / SP 19,36 | **131,50 MB / SP 19,37** | 2,6× sob o teto de 50 MB |

## O achado que justifica o milestone inteiro

**A contagem de linhas mal se move. Os valores mudam quase todos.** +301 linhas parece ruído; o
que de fato acontece é que **84,7% das 207.024 chaves comuns mudam de valor** (104.749 sobem,
70.521 descem, só 15,3% ficam idênticas).

Todo ano sobe, entre **+0,63% (2019)** e **+3,69% (2024)** — nenhum ano perde dado, que é
exatamente o esperado quando se para de truncar admissões na borda da competência.

640 chaves somem e 941 entram, todas em agravos raros (sarampo, malária, filariose, raiva,
tuberculoses de sítio incomum): 750 internações saem, 1.295 entram.

O caso que fecha a história: **`amputacao_mmii` AC/2019 servia 50 e agora serve 66** — e 66 é
exatamente o que o oráculo `qibr.def` do TabNet diz. O achado central do 09-15 deixou de ser um
número em relatório e virou o que o navegador do aluno recebe.

## A ordem escolhida, e por quê

O brief do operador pedia swap (passo 3) antes das partições (passo 4). As duas substituições
anteriores fizeram o contrário, e o `09-10-SUMMARY.md` diz o porquê: *"Nenhuma dependência de
ordem com o swap (tabelas diferentes, destinos diferentes — Storage vs Postgres); feito antes por
ser a parte reversível/aditiva."*

Levado ao operador no checkpoint, com a medição de que nenhuma das duas ordens quebra nada —
`release_cache`, no fim do swap, só apaga `parquet/{nome}.parquet` bruto (diretório já vazio,
no-op) e **nunca** toca `agregados/`, que alimenta os passos seguintes. O operador escolheu
inverter. Partições primeiro, swap depois.

## O resíduo de 3 linhas NÃO se reproduz

A segunda substituição precisou explicar por que produção tinha 207.664 contra 207.667 chaves
únicas nos agregados: 3 linhas de grão UF com `UF_ZI` malformado (`'02'`, `'00'`, `'  '`),
descartadas silenciosamente por `partitions._uf_dona`.

Medido nesta corrida, não presumido: as chaves únicas `(disease_id, local, territorio_codigo,
ano)` de grão UF nos 27 agregados são **207.965, ZERO com `territorio_codigo` inválido**.
Produção e agregado batem exatos, sem resto. A guarda de `_uf_dona` continua de pé — a malformação
era real e pode voltar quando o DATASUS republicar competências — mas não tem o que descartar
neste dataset.

## Duas coisas que o roteiro do operador não previa

### 1. O passo de verificação não sairia 0 como escrito

`ESPERADO_SIH_METRIC_UF` é constante **cravada à mão** em `generateSihSwapVerify.mjs`, não
derivada de produção (derivar seria circular: o verify passaria sempre). Rodar
`catalog:sih-swap-verify` sozinho regeneraria o mesmo 207664 e o verify **falharia** contra as
207.965 novas — direção segura, mas o roteiro afirmava que sairia 0. Editada para 207965 antes de
regenerar, que é o único caminho previsto pelo próprio cabeçalho do gerador.

`CID_MAP_VERSION_DA_CORRIDA` **não muda**: `lista-morb-cid.json`/`cid-corrections.json` não
mudaram, e a base de contagem é o eixo de data em `aggregate.py`, que não entra nesse hash —
conferido ao vivo contra `sih_collection_status`.

### 2. Havia uma SEGUNDA constante cravada

`generateSihRetireMigration.mjs` também carrega `ESPERADO_SIH_METRIC_UF = 207664`, separado. A
migration do 09-14 (que dropa `sih_metric_muni`) usa esse número num `RAISE EXCEPTION` para provar
que a DROP não teve efeito colateral sobre a tabela irmã — e **essa migration ainda não rodou**.
Deixá-la em 207664 seria plantar uma falha para disparar depois, com a causa já esquecida.

Achado por `sihRetireMigration.test.ts`, que trava exatamente a igualdade entre os dois geradores.
O teste fez o trabalho dele: a divergência apareceu no gate, não em produção.

## Achados registrados (não escondidos, não contornados)

### A. Colisão de literal que enfraquece dois testes

`embolia_e_trombose_arteriais` SP/2019/ocorrência foi de **5709 para 5660**. Conferido na cadeia
inteira antes de trocar — agregado local = produção lida pelo PostgREST anônimo = pack — então o
valor está certo.

O problema: **5660 é exatamente o literal que esses dois testes travavam antes da Fase 9**
(commit `a4356f2`, valor TabNet-era), trocado para 5709 em `03ef66a` justamente para excluí-lo.
Contado por `DT_INTER` o número voltou por coincidência. O comentário antigo dizia *"5709 é o
valor medido, não 5660 (o valor TabNet-era)"* — apontá-lo para 5660 sem dizer nada inverteria o
sentido do próprio comentário.

**Consequência real:** este literal, sozinho, NÃO distingue mais as duas fontes. Uma regressão que
voltasse a ler o corpus legado passaria por ele. O que ainda distingue: em
`catalogAnalysisData.test.ts`, o `toBe(expected)` que lê o pack direto; nos dois, o
`not.toBe(898000)` da fórmula didática `UF_WEIGHT`. Registrado no comentário de cada teste.

Os testes **não** foram reestruturados — é decisão de design do operador, não do executor.

### B. 16 linhas de proveniência velha sobreviveram ao swap

`sih_collection_status` é **upsert, nunca truncado** (o swap trunca só `sih_metric_uf`). 16 linhas
com `derived_at` de 2026-08-13 ficaram para trás: `tetano_neonatal`/2025 e
`tifo_exantematico`/2018 — 2 combinações × 2 locais × 4 medidas, casos raríssimos cujo único
registro mudou de ano ao passar para `DT_INTER`. Declaram `coletado` para combinações que não têm
mais dado.

Não derrubam o verify porque a checagem de proveniência é **unidirecional**
(`sih_metric_uf` → `collection_status`), sem a recíproca. Não afetam o site, que lê
`sih_metric_uf`. Comportamento pré-existente das três substituições, agora **medido**.

### C. A role `anon` tem GRANT de TRUNCATE

Inspeção de RLS mostrou que `anon` carrega `DELETE, INSERT, REFERENCES, SELECT, TRIGGER,
TRUNCATE, UPDATE` em `sih_metric_uf` (default do Supabase). RLS bloqueia DELETE/INSERT/UPDATE — a
única policy é `sih_metric_uf_select_anon` — mas **TRUNCATE não é sujeito a RLS**. Hoje é
inalcançável porque o PostgREST não expõe o verbo, mas o GRANT não deveria estar lá. Item de
endurecimento, não buraco ativo.

## Uma prova que foi tentada errado, e corrigida

A primeira sonda de "escrita anônima recusada no Storage" tentou **sobrescrever e apagar
`AC.json.gz`** — uma partição real recém-enviada. Foi bloqueada antes de executar, e com razão:
arriscava destruir dado de produção para produzir um número de relatório.

Refeita pelo catálogo, que responde a mesma pergunta sem tocar em nada: RLS ligada em
`storage.objects` com **zero policies** → `anon` não escreve nem apaga objeto nenhum. O bucket é
`public=true` (daí a leitura anônima 200) com `file_size_limit` de exatamente 52.428.800 bytes.

Registro honesto: **o `403` que o brief esperava não foi obtido**. O `400` observado numa tentativa
anterior era requisição multipart malformada do executor, não sinal de autorização, e não vale
como prova. O que prova é o catálogo.

Nota correlata: o DELETE anônimo no PostgREST devolve **204**, não 401 — ambíguo por construção,
porque RLS sem policy de DELETE não gera erro, apenas afeta 0 linhas. Resolvido pelo catálogo
(única policy é de SELECT) e pela contagem intacta em 207.965 depois da sonda.

## Task Commits

- `1eabd3e` — `feat(09-17)`: a terceira substituição + `ESPERADO_SIH_METRIC_UF=207965` + verify regenerado
- `ad51e4b` — `fix(09-17)`: sincroniza a segunda constante cravada (retire-migration) com a contagem nova
- `737bf38` — `feat(09-17)`: regenera os 10 packs a partir do `sih_metric_uf` já trocado
- `3f1cbbf` — `test(09-17)`: valor travado dos packs + registro da colisão de literal

`npm run gate` verde em todos (pre-commit hook roda o gate completo a cada commit).

## Invariantes preservados

- `upload.py` e `partitions.py` reaproveitados **sem nenhuma alteração de código**, terceira corrida seguida.
- `sih_metric_muni` intocada (1.099.403) — segue sendo o 09-14 quem a remove.
- População **não** subiu: a restrição de ordem do 09-06 continua valendo, e o grão município ainda não foi evacuado do Postgres.
- `src/routes/variaveis/` e `src/features/catalog/` só tocados após conferir os dois worktrees `codex/guided-variables-*` contra o merge-base: **nenhum dos dois toca os arquivos editados**, e o trabalho não commitado deles está todo em `src/routes/variaveis/`.
- `/gsd:new-milestone` **não** executado — a decisão sobre a v3.0 continua aberta e é do operador.

## Next Phase Readiness

- **09-14 (remover `sih_metric_muni`)** está desbloqueado por dado: os 331 agravos têm linha em `sih_metric_uf`, as 27 partições estão no Storage e a migration já carrega a contagem certa (207965). Evacuar o grão município libera 319 MB e só então a população cabe sob o teto.
- **Os 3 achados acima** entram como bloqueios abertos no `STATE.md` — nenhum impede o 09-14.

## Self-Check: PASSED

Todas as provas de aceite do brief foram obtidas contra produção real, exceto o `403` de escrita
anônima no Storage, substituído por prova de catálogo e declarado como tal acima.
