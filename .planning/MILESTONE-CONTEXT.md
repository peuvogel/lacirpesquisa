# Milestone Context — Produção por DT_INTER

> **ATUALIZACAO 2026-08-18: as quatro "Target features" abaixo JA FORAM EXECUTADAS** pelo
> `09-17-SWAP-DT-INTER` (ad-hoc, dentro da v3.0, sem criar milestone novo). Producao serve
> `DT_INTER` desde `2026-08-18T18:23Z`: `sih_metric_uf` = 207.965 linhas / 331 agravos, as 27
> particoes reenviadas ao Storage, os 10 packs refeitos depois do swap, e a prova pelo caminho
> anonimo obtida (135/135 pares exatos). Ver
> `.planning/phases/09-pipeline-confi-vel-coleta-completa/09-17-SWAP-DT-INTER-SUMMARY.md`.
>
> **A "Decisao pendente do operador" no fim deste arquivo continua ABERTA e continua sendo dele.**
> O trabalho foi feito pela saida 1 (fase nova dentro da v3.0), que era a recomendada e nao
> destroi nada -- mas as Fases 10, 11 e 12 seguem nunca construidas e `phase_archive_path`
> continua `null`, entao `/gsd:new-milestone` continua PERIGOSO (o passo 6 chama `phases.clear`,
> que e `fs.rmSync` sem copia).
>
> O que este arquivo ainda descreve de forma util: as restricoes duras, as pendencias herdadas do
> 09-15 e as tres saidas da decisao. O que ele descreve de forma DESATUALIZADA: "Producao NAO foi
> recarregada" (linha abaixo) e o estado das target features.

> Escrito em 2026-08-18 para ser consumido por `/gsd:new-milestone`, que apaga este arquivo
> depois de usá-lo. **Leia antes a seção "Decisão pendente do operador"** — este milestone não
> pode ser criado sem resolver o que fazer com a v3.0, que está a 50% e com três fases nunca
> construídas.

## Goal

Levar a produção (Supabase) do dado contado por competência de faturamento para o dado contado
por data de internação, já coletado e provado em disco, e fazer o site servir isso.

## Target features

1. **Substituição atômica de `sih_metric_uf` com o dado por `DT_INTER`** — `upload.py` novo sobre
   os 27 agregados já em disco, com a mesma disciplina das duas substituições anteriores
   (staging → swap → contagens conferidas contra produção real).
2. **Regeneração e reenvio das 27 partições de município** ao bucket `sih-municipio` do Storage,
   respeitando o teto de 50 MB por objeto.
3. **Regeneração dos derivados do catálogo** — os 10 packs e `variables.json` saem de
   `sih_metric_uf`/`sih_collection_status` via PostgREST (`catalog:build`), então precisam ser
   refeitos *depois* do swap.
4. **Prova end-to-end pelo caminho anônimo real** — PostgREST + Storage com a chave `anon`, como
   o navegador do aluno faz, não só SQL direto.

## Contexto travado (medido, não suposto)

**A coleta está PRONTA e é o insumo deste milestone:**

```
27/27 UFs  agregado_reciclado, zero falhas
4.347 arquivos no ledger — 161 por UF, min = max nas 27
13.558.229 linhas agregadas
~/.lacir/sih-cache/agregados/*.parquet — 27 arquivos, 161 MB
```

**Produção NÃO foi recarregada** — decisão explícita do brief anterior, não esquecimento. O
Supabase serve hoje o dataset de 2026-08-13: `sih_metric_uf` com 207.664 linhas, 331 agravos,
2013-2025, contado por `ANO_CMPT`.

**O que muda com `DT_INTER`** (achado central do 09-15, ver `09-15-DT-INTER-SUMMARY.md`): o
resíduo do SC-7 nunca existiu — era artefato de comparar agregado por competência contra um
oráculo truncado a uma competência. Alinhadas as pontas, o gate vai de
`exato=34/explicado=61/inexplicado=3` para `exato=98/explicado=0/inexplicado=0`, com delta
exatamente zero em 98/98 pares e **sem nenhuma correção de faixa CID nova**.

## Restrições duras

- **Teto de 500 MB do plano gratuito.** A população só pode entrar *depois* de o grão município
  ser evacuado para o Storage — se o `COPY` da população rodar antes, o combinado mede ~472 MB
  contra o teto. Ver `pipeline/sih/reports/populacao-dimensionamento.md` §5-6.
- **`supabase --linked` não funciona** (sem `SUPABASE_ACCESS_TOKEN`). Contorno provado:
  `--db-url "$SIH_PIPELINE_DB_URL"`.
- **`psql` fora do PATH:** `export PATH="$(brew --prefix libpq)/bin:$PATH"`.
- **Dois worktrees de outra sessão** mexem no fluxo de seleção de variável —
  `codex/guided-variables-flow` e `codex/guided-variables-technical`. Conferir antes de tocar
  `src/routes/variaveis/` ou `src/features/catalog/`.

## Pendências herdadas do 09-15-DT-INTER (candidatas a escopo)

- **`oracle_scrape.py` produz oráculo truncado.** Submete ao TabNet só as 12 competências do ano
  pedido, então nunca mede um ano de atendimento completo. Consertar permitiria reconciliar o ano
  de admissão completo também no eixo CID.
- **~61 entradas inertes em `cid-divergencias.json`.** Descrevem um resíduo que, medido
  corretamente, não existe. Nenhuma é consultada hoje. Uma explicação que não explica mais nada
  não pode continuar de pé.
- **O DATASUS re-publica competências já fechadas.** Medido: `RDDF1708` e `RDPR2004` servidos
  hoje têm contagem diferente da fatia arquivada em 2026-08-12, e zero dos defeitos que as
  fixtures de regressão capturam.
- **3 linhas de grão UF com `UF_ZI` malformado** (`'02'`, `'00'`, `'  '`) descartadas
  silenciosamente por `partitions._uf_dona` — mesma classe do 09-04-FIX-MUNICIPIO-BRANCO, escala
  menor, nunca corrigida.
- **Paginação PostgREST sem `order=` explícito não é estável** entre requisições. Corrigido no
  gerador de packs (09-13), mas `audit.py` e `upload.py` usam o mesmo padrão e não foram
  corrigidos.

## Provas de aceite

- `sih-swap-contagens.sql` regenerado sai 0 contra produção real.
- Nenhuma tabela `*_staging` órfã; `db_size` sob o teto.
- Um agravo conferido ponta a ponta pelo PostgREST anônimo, batendo com o agregado local.
- Leitura anônima 200; escrita anônima recusada (401 PostgREST, 403 Storage).
- `npm run gate` verde no commit de cada etapa.

## Decisão pendente do operador

**Este arquivo não cria o milestone. Falta uma decisão que é sua:**

A v3.0 está `executing` a 50% — Fase 09 quase fechada, e as Fases **10 (Mapas dinâmicos sobre
Supabase)**, **11 (Fluxo pesquisa → estatística)** e **12 (Varredura de bugs + UAT)** nunca foram
construídas. Não existe milestone completo (`latest_completed_milestone: null`), então não existe
destino de arquivamento (`phase_archive_path: null`), e o passo 6 do `/gsd:new-milestone` chama
`phases.clear`, que é `fs.rmSync(recursive, force)` — **apagaria as 8 pastas e 222 arquivos de
planejamento sem cópia**.

Três saídas, em ordem de menor dano:

1. **Fase nova na v3.0** (recomendado) — o upload é a cauda natural da Fase 09. `/gsd:phase` insere
   uma fase sem tocar em nada. As Fases 10-12 seguem de pé.
2. **Fechar a v3.0 primeiro** — `/gsd:complete-milestone` arquiva a v3.0 (criando o
   `phase_archive_path` que hoje não existe) e só então `/gsd:new-milestone` roda em segurança.
   Exige aceitar que 10, 11 e 12 ficam fora da v3.0 ou migram para o milestone novo.
3. **Milestone novo agora** — só com as pastas de fase salvas antes (`git` já as versiona, mas a
   árvore de trabalho perderia tudo até um `checkout`).
