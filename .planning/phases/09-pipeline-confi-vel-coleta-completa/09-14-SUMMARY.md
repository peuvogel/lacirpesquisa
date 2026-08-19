---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 14
subsystem: database
tags: [postgres, supabase, storage, ddl, migration, rls, seguranca, documentacao, pytest]

# Dependency graph
requires:
  - phase: 09-13
    provides: "os 10 packs derivados de sih_metric_uf -- o consumidor que prova que o app não precisa de sih_metric_muni"
  - phase: 09-09
    provides: "partitions.py -- as 27 partições do Storage que passam a ser a única fonte do grão município"
  - phase: 09-17-SWAP-DT-INTER
    provides: "sih_metric_uf com 207.965 linhas por DT_INTER -- a contagem que o RAISE EXCEPTION desta migração confere"
provides:
  - "sih_metric_muni REMOVIDA de produção: o banco caiu de 430 MB para 112 MB (318 MB liberados, folga de 388 MB sob o teto)"
  - "O caminho TabNet morto por remoção: uploader, três scrapers, Edge Function sih-ingest e INGEST_SECRET"
  - "test_suite_integrity.py -- gate anti-esqueleto (2 casos) + contrato da CLI, os três provados nominais"
  - "docs/SUPABASE-CATALOG.md reescrito para o schema v3 real, capturado ao vivo"
  - "Backup verificado de produção pré-DROP em ~/.lacir/backup-pre-09-14/"
affects: [upload de população (agora cabe), Fase 10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deleção como entrega: um segredo se resolve por REMOÇÃO quando não sobra nada que o leia -- rotacionar seria manter o risco vivo com valor novo"
    - "A prova de que uma DROP não teve efeito colateral mora DENTRO da própria migração (retrato antes em tabela temporária + RAISE EXCEPTION), não num check posterior que alguém pode esquecer de rodar"
    - "Um gate precisa ser provado NOMINAL plantando a falha que ele deveria pegar -- verde não prova que sabe falhar"
    - "Contar linhas de um formato colunar por len(dados) devolve COLUNAS, não linhas"

key-files:
  created:
    - pipeline/sih/tests/test_suite_integrity.py
    - .planning/phases/09-pipeline-confi-vel-coleta-completa/09-14-SUMMARY.md
  modified:
    - docs/SUPABASE-CATALOG.md
  deleted_previously:
    - scripts/catalog/uploadSihToSupabase.mjs
    - trabalhos datasus/scripts/coleta_sih_multi_disease.py
    - trabalhos datasus/scripts/scrape_upload_sih.py
    - trabalhos datasus/scripts/launch_overnight.py

# Metrics
duration: 3 sessões (2026-08-16 construção e bloqueio, 2026-08-19 backup + desbloqueio + fechamento)
completed: 2026-08-19
commits: 7
---

# Phase 9 Plan 14: Aposentar o caminho TabNet por remoção Summary

Esta é a plan em que **deleções são entregas**. Nada aqui é limpeza cosmética: cada remoção fecha
um risco nominal do ROADMAP.

## O resultado, em uma tabela

| Prova | Antes | Depois |
|---|---|---|
| `sih_metric_muni` | 1.099.403 linhas, 319 MB | **não existe** (`to_regclass` → null) |
| Índice `sih_metric_muni_disease_uf_ano` | existia | não existe |
| **`db_size`** | **430 MB** | **112 MB** (−318 MB; folga sob o teto vai de 70 para 388 MB) |
| `sih_metric_uf` | 207.965 | 207.965 (intacta) |
| `sih_disease` | 331 | 331 (intacta) |
| `sih_collection_status` | 67.168 | 67.168 (intacta) |
| `supabase/verify/sih-retire.sql` contra produção | — | **exit 0** |
| Migração `20260806000000` | só local | **aplicada no Remote** |
| Tabelas `*_staging` órfãs | — | nenhuma |

## Pré-condição do D-20, provada antes de dropar

A DROP só era legítima depois de provado que o Storage já serve o mesmo grão. Medido nesta
sessão, contra as partições **novas por `DT_INTER`** (as provas de 16/08 eram das antigas):

- **27/27 partições responderam HTTP 200 a `GET` anônimo** (chave `anon`, não `service_role`)
- **12.404.039 linhas** de grão município no total — idêntico ao dry-run independente do
  `upload.py --municipio`, por dois caminhos que não se conversam
- Geografia batendo com a realidade: SP 645 municípios, MG 853, AC 22, RR 15

### O critério literal do plano era insatisfazível — e isso está registrado, não contornado

O plano pedia que *"a contagem total de linhas municipais dentro delas seja igual à contagem de
`sih_metric_muni` no banco"*. São **12.404.039 contra 1.099.403** — 11,3× mais. Não é falha: são
datasets diferentes, microdado por `DT_INTER` contra o corpus TabNet legado. Igualdade numérica
seria evidência de que a evacuação *não* trouxe cobertura nova.

Lido como **prova de cobertura**, que foi como a sessão de 16/08 já o tratava. Registrado aqui em
vez de silenciosamente reinterpretado.

## A segurança da DROP mora dentro da própria migração

`20260806000000_sih_retire_muni.sql` tira um retrato de `sih_disease` e `sih_metric_uf` em tabelas
temporárias **antes** de dropar, e termina num `DO $$` que aborta a transação inteira com
`RAISE EXCEPTION` se qualquer uma das duas tiver mudado de contagem, ou se não fecharem em 331 e
207.965. O `ON DELETE CASCADE` de `sih_disease` só dispara ao apagar uma LINHA, nunca ao dropar
uma tabela filha — mas um erro de ordem levaria as métricas junto **sem erro visível**, e é
exatamente essa armadilha que o bloco fecha.

Ensaiada ponta a ponta num Postgres local antes de tocar produção (16/08): caminho de falha com
contagem corrompida abortando, caminho feliz, e rollback recriando a tabela byte-idêntica.

## O bloqueio, e como foi resolvido sem ser burlado

Em **16/08** e de novo em **19/08**, `supabase db push` contra produção foi **bloqueado pelo
classificador de segurança do sandbox** (DDL destrutiva em produção). Nas duas vezes o agente
**não tentou contornar via `psql` direto** — seria burlar exatamente a mesma proteção.

Resolvido pelo caminho certo: o operador pediu backup, o backup foi feito e verificado, e o
operador rodou o comando ele mesmo. A proteção fez o trabalho dela — parar um agente de executar
DDL destrutiva sem decisão humana explícita.

### O backup, verificado e não só gerado

`~/.lacir/backup-pre-09-14/` — `producao-completo.dump` (12 MB, `-Fc -Z9`, 8 tabelas com DDL e
dados), `sih_metric_muni.csv.gz` (6,3 MB, CSV puro do corpus que morre), `SHA256SUMS`,
`MANIFESTO.md`.

Verificado de verdade: `pg_restore -f /dev/null` descomprimiu o arquivo inteiro (prova de que não
está truncado), e as contagens foram lidas **de dentro do dump** — muni 1.099.403, uf 207.965,
status 67.168, disease 331, todas batendo com produção. O CSV soma **5287** para
`embolia_e_trombose_arteriais` SP/2019, o mesmo valor legado medido no banco antes da DROP.

**Não verificado, e declarado no manifesto:** restauração real num Postgres vazio.

## O segredo morreu por remoção, não por rotação

Edge Function `sih-ingest` e `INGEST_SECRET` **não aparecem mais** em
`supabase functions list` / `supabase secrets list` — só as chaves gerenciadas pelo próprio
Supabase restam. Os três scrapers e o uploader Node não existem mais no repositório, e nenhum
script `scrape:*` sobrevive no `package.json`.

Varredura por **valor** de segredo no working tree rastreado (não por nome): zero JWT `eyJ...`,
zero token `sb_secret_`/`sbp_`, zero credencial `service_role` literal, nenhum `.env` rastreado
pelo git (os três estão no `.gitignore`).

Duas ocorrências do **nome** `INGEST_SECRET` sobrevivem de propósito, nenhuma com valor:

1. `docs/SUPABASE-CATALOG.md` — nota de histórico dizendo que foi removido, explicitamente
   permitida pela ação do plano.
2. `pipeline/sih/tests/test_oracle_scrape.py:85` — uma asserção **negativa** de que o módulo
   `oracle_scrape` não contém a string. É a guarda que impede a volta; removê-la para satisfazer
   um `grep` literal enfraqueceria exatamente o que o critério quer proteger.

O critério de aceite pedia `git grep INGEST_SECRET -- ':!.planning'` sem retorno. Registrado como
divergência deliberada, com o motivo, em vez de satisfeito ao pé da letra.

## Gate de integridade da suíte, provado nominal

`pipeline/sih/tests/test_suite_integrity.py` fecha as duas promessas que a Onda 0 do `09-02`
deixou abertas:

- **Anti-esqueleto em dois casos**, porque há duas formas: o módulo que ainda declara
  `pytest.skip(allow_module_level=True)`, e o que já perdeu o skip mas ficou **sem teste nenhum**
  dentro (esse passa despercebido pelo primeiro e conta como arquivo verde afirmando nada). O
  segundo conta testes por AST, não por importação.
- **Contrato da CLI**: todo script `pipeline:*` que invoca `sih_pipeline.cli` nomeia um subcomando
  registrado, e os 10 subcomandos resolvem para um `main` chamável. Mais uma guarda do próprio
  gate, que falha se a regex parar de casar (senão os dois casos passariam vazios).

**Os três provados NOMINAIS**, não só verdes: esqueleto plantado → falhou; módulo vazio plantado →
falhou; script npm órfão plantado → falhou. Sondas removidas, `package.json` restaurado limpo.

Estado medido: `allow_module_level` já não existia em nenhum dos 17 arquivos de teste, e os 10
subcomandos já resolviam. **O gate não consertou nada — ele impede a volta.**

## A doc passou a descrever o que existe

`docs/SUPABASE-CATALOG.md` descrevia o schema v2 e um caminho de ingest morto há meses. Reescrita
a partir de `pg_dump --schema-only` **ao vivo**, depois da DROP — as 7 tabelas, PKs, CHECKs, FKs,
2 índices e 7 policies de RLS são o que o banco tem.

O que ela passou a dizer e não dizia: onde cada grão mora e por quê; que `sih_metric_uf` conta por
`DT_INTER`; a regra D-14 de zero verdadeiro vs ausente apontando para a função pura de `audit.py`;
o formato colunar das partições **com o aviso de que `len(dados)` devolve colunas, não linhas**
(erro que esta própria sessão cometeu ao contar as partições, e por isso vale escrito); que
`tabnet_code` é índice posicional instável para procedimento; que os packs precisam ser regerados
depois de cada swap; e que as contagens dos `verify` são cravadas à mão em **dois** geradores que
precisam ser editados juntos.

## Task Commits

- `a30c308` — gerador da migração de aposentadoria (16/08)
- `d4a05d3` — remove `scrape:sih-multi`/`scrape:overnight` do `package.json`
- `4bf6c6d` — remove `overnight_watchdog.sh`, órfão do caminho aposentado
- `32a72ee` — registra o bloqueio da DDL pelo classificador (16/08)
- `e58faf7` — gate de integridade da suíte, anti-esqueleto + contrato da CLI
- `8da19f3` — reconfirma o bloqueio e registra o backup verificado
- `9e583ac` — reescreve `docs/SUPABASE-CATALOG.md` para o v3 real

`npm run gate` verde em todos os commits de código.

## Next Phase Readiness

- **A população agora cabe.** Era a restrição de ordem do 09-06: o combinado media ~472 MB contra
  o teto de 500 MB se a população entrasse antes da evacuação. Com o banco em 112 MB e os ~146 MB
  medidos da população, o total projetado fica em ~258 MB. A restrição está **satisfeita**, não
  contornada.
- **Fase 10 (Mapas dinâmicos sobre Supabase)** é o próximo destino real: o grão município só existe
  no Storage agora, então o drill municipal do mapa passa obrigatoriamente pelas partições e pelo
  `DecompressionStream` — o contrato está documentado.
- Os três achados abertos do `09-17` seguem abertos e nenhum bloqueia a Fase 10.

## Self-Check: PASSED

Todos os critérios de aceite das três tasks foram verificados contra produção real ou por script,
com uma divergência deliberada registrada acima (as duas ocorrências do nome `INGEST_SECRET`).
