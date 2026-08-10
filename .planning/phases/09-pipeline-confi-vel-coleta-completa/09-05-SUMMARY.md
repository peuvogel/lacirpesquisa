---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 05
subsystem: testing
tags: [tabnet, datasus, scraping, oraculo, sc-7, fixture, d-04]

# Dependency graph
requires:
  - phase: 09-pipeline-confi-vel-coleta-completa
    provides: "09-02 — projeto uv, guard de caminho ASVS V12 e o stub tests/test_oracle_scrape.py que esta plan preenche"
provides:
  - "oracle_scrape.py — raspador mínimo do TabNet (post_tabnet, parse_prn_table, scrape_pairs), com REQUEST_DELAY_SEC=1.5 herdado do scraper aposentado"
  - "tests/fixtures/oracle_tabnet.json — 98 pares (agravo × AC × 2019) re-raspados ao vivo e conferidos contra o CSV guardado"
  - "tests/fixtures/tabnet_prn_sample.html — captura real do TabNet que torna os testes reproduzíveis offline"
  - "reports/oracle-descartados.md — o registro escrito do D-04"
affects: [09-08, 09-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Oráculo é dado re-raspado ao vivo e conferido, nunca dado herdado — o corpus legado não pode validar a si mesmo (D-04)"
    - "Mapeamento de agravo por tabnetCode lido do metadata.json, nunca por nome de diretório — os diretórios do corpus usam ids pré-migração (T-09-21)"
    - "Todo teste do raspador mocka post_tabnet — o gate nunca toca rede; o refresh do oráculo é comando explícito (Fase 8 D-09)"

key-files:
  created:
    - pipeline/sih/src/sih_pipeline/oracle_scrape.py
    - pipeline/sih/tests/fixtures/oracle_tabnet.json
    - pipeline/sih/tests/fixtures/tabnet_prn_sample.html
    - pipeline/sih/reports/oracle-descartados.md
  modified:
    - pipeline/sih/tests/test_oracle_scrape.py

key-decisions:
  - "Dois pares que falharam por timeout foram re-raspados uma vez antes de virar descarte — timeout de rede não é evidência sobre reprodução, e descartar por falha de transporte confundiria dado não confiável com rede não confiável"
  - "98 pares, não os 85 do spike: são conjuntos diferentes com propósitos diferentes, e a diferença está registrada no relatório"
  - "O driver da re-raspagem é script descartável fora do repositório (padrão da 08-01), não código do pacote — o pacote só ganha o raspador, não a orquestração de uma corrida pontual"

patterns-established:
  - "Registro de descarte D-04 explica também o que NÃO foi descartado e por quê, quando o número diverge de uma expectativa anterior documentada"

requirements-completed: [PIPE-05]

# Metrics
duration: ~4h de relógio (majoritariamente esperando infraestrutura; ~15 min de trabalho efetivo + ~2,5 min de raspagem)
completed: 2026-08-05
---

# Phase 09 Plan 05: Oráculo TabNet Summary

**Raspador mínimo do TabNet com testes que não tocam rede, e um oráculo de 98 pares AC/2019 re-raspados ao vivo em que 98 reproduziram exatamente o valor guardado — zero descartes**

## Performance

- **Duração:** ~4 h de relógio, das quais quase tudo foi indisponibilidade da API; o trabalho efetivo foram ~15 min mais ~2,5 min de raspagem (98 requisições a 1,5 s)
- **Tasks:** 2/2
- **Arquivos criados:** 4

## Accomplishments

- `oracle_scrape.py` (149 linhas) — `post_tabnet`, `parse_prn_table`, `_sum_uf_ano`, `scrape_pairs`, e CLI `oracle-scrape`
- 10 testes cobrindo o raspador, **todos mockando `post_tabnet`** — o gate nunca toca a rede (T-09-22)
- `RuntimeError` quando não há bloco `<PRE>` e quando o bloco não produz linha de dado (T-09-03)
- Oráculo com **98 pares**, todos com `valorTabnet === valorCsvGuardado`, todos com id canônico da Fase 8
- `oracle-descartados.md` registra que nenhum par foi descartado, e explica a repetição dos dois timeouts

## Task Commits

1. **Task 1: Raspador mínimo do oráculo TabNet (D-18)** — `8cbb2ff` (test, RED, 10 testes) → `0433b23` (feat, GREEN)
2. **Task 2: Re-raspar os pares ao vivo e descartar o que não reproduz (D-04)** — `fe9e5d4` (feat)

## Resultado medido da re-raspagem

| Métrica | Valor |
|---|---|
| Tentados | 98 |
| Reproduzidos | **98** |
| Descartados | **0** |
| Soma fecha (`tentados == reproduzidos + descartados`) | ✓ |
| Piso do plano (≥ 40 reproduzidos) | ✓ com folga de 58 |
| Entradas com `uf=AC` e `ano=2019` | 98 (é o recorte inteiro) |
| Ids fora da taxonomia canônica | 0 |
| `tabnetCode` sem correspondência canônica | 0 |

Verificação: o `node -e` do plano sai 0 (`oraculo OK: 98 pares`); `uv run pytest tests/test_oracle_scrape.py -q` passa os 10 testes sem rede; `npm run gate` verde (33 pytest + 774 Vitest + build).

## Decisions Made

- **Repetição dos dois timeouts.** A primeira passagem deu 96 reproduzidos e 2 descartados, e os 2 descartes eram `timed out`, não divergência de valor. Foram re-raspados **uma vez** e reproduziram exatamente (3 e 35). A razão está escrita no relatório: um timeout de transporte não diz nada sobre se o par reproduz; descartar por ele confundiria "dado não confiável" — que é o que o D-04 existe para detectar — com "rede não confiável", que é ruído de execução. Se a repetição tivesse divergido, o par teria sido descartado pela razão correta.
- **98 pares e não 85.** O spike (§5) fala em "85 agravos comparáveis", mas aquele é o conjunto comparável **contra a agregação do microdado**. Este oráculo é o lado TabNet da comparação do SC-7 e é construído antes de existir qualquer agregação: são os pares do corpus legado com `internacoes` não vazio em AC/2019 cujo `tabnetCode` resolve para id canônico. Os conjuntos não precisam coincidir, e a diferença ficou registrada em vez de silenciada.
- **Mapeamento por `tabnetCode`, não por nome de diretório.** Os diretórios de `coleta_sih_multi/` usam ids pré-migração da Fase 8. O `tabnetCode` vem do `metadata.json` de cada diretório e resolve para o id canônico via `diseases.json`. Esta escolha é o que impede a fixture de reintroduzir a taxonomia corrompida que a Fase 8 matou (T-09-21).
- **Driver descartável.** A orquestração da re-raspagem ficou em script fora do repositório (mesmo padrão da 08-01). O pacote ganhou o raspador; a corrida pontual não vira código mantido.

## Deviations from Plan

### 1. Executado inline pelo orquestrador, não por agente executor

- **Problema:** Esta plan foi morta **seis vezes** por falhas de infraestrutura da API da Anthropic — limite de uso, `529 Overloaded`, indisponibilidade do classificador de segurança, `connection closed mid-response` (×2) e um watchdog de stream. Duas tentativas seguidas na Task 2 renderam zero progresso.
- **Correção:** O orquestrador passou a execução inline, que é o fallback documentado do `execute-phase.md` quando o `Agent` está indisponível. A raspagem em si foi lançada com `nohup`, destacada do stream — que era exatamente o que vinha sendo interrompido.
- **Impacto:** Nenhum no resultado. Todos os critérios de aceitação do plano foram atendidos e verificados.

### 2. Trabalho de um agente morto foi recuperado, não refeito

- **Achado:** Ao inspecionar o scratchpad, o driver de re-raspagem de uma tentativa anterior estava lá, com log mostrando 46 dos 98 pares já processados (resultados não persistidos).
- **Decisão:** O script recuperado foi **reusado em vez de reescrito** — e essa foi a escolha certa por um motivo concreto: o driver que o orquestrador tinha começado a escrever casava agravo por nome de diretório (o id legado), enquanto o recuperado lia o `tabnetCode` do `metadata.json`. O plano avisa explicitamente contra o primeiro caminho (T-09-21). Descartar o trabalho do agente morto teria custado a correção.

---

**Total de desvios:** 2, ambos de processo — nenhum de escopo, nenhum critério relaxado.

## Issues Encountered

- **Seis interrupções de infraestrutura** nesta plan. Nenhuma corrompeu estado: a árvore ficou limpa em todas, e a Task 1 sobreviveu commitada porque o ciclo TDD foi commitado assim que verificado.
- **Dois timeouts do TabNet** em 98 requisições (≈2%) — resolvidos por uma repetição, documentados em vez de escondidos.

## User Setup Required

Nenhum. Esta plan não usa credencial.

## Next Phase Readiness

- **09-08 destravado.** O gate do SC-7 tem seu lado TabNet: 98 pares AC/2019 com valor confiável e auditável (`valorCsvGuardado` guardado ao lado de `valorTabnet` em cada entrada).
- **09-11** usa o mesmo oráculo para a confirmação em UF grande, e vai precisar de `oracle_ac_2019.json` derivado deste.
- **Atenção:** o oráculo é AC/2019 apenas. A confirmação em SP ou MG do 09-11 exigirá uma raspagem adicional — o `oracle_scrape.py` já suporta (`--uf`/`--ano`), mas os pares precisarão ser re-raspados para aquela UF.

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-05*
