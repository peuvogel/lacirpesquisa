---
phase: 09-pipeline-confi-vel-coleta-completa
plan: 09-FIX-RESIDENCIA
subsystem: infra
tags: [pyarrow, pipeline, parquet, agregacao, territorio, sc-7]

# Dependency graph
requires:
  - phase: 09-09-ADAPTACAO-AGREGADOS
    provides: "linhas_da_uf(uf, index) -- prioriza cache_path('agregados/{uf}.parquet'), cai
      para parquet bruto isolado; registrou (mas não corrigiu) o defeito de seleção por arquivo
      em vez de por território que esta correção resolve"
provides:
  - "partitions.py::construir_indice_territorial(index) -- índice das 27 UFs construído numa
    passada só sobre todas as fontes disponíveis (agregado persistido + fallback bruto isolado),
    dono de cada linha decidido pelo território (_uf_dona), somando (_somar_rows) quando a mesma
    chave aparece em mais de uma fonte -- O(27), nunca O(27²)"
  - "partitions.py::linhas_da_uf(uf, index) -- mesma assinatura, agora correta: seleciona por
    território dono, gathering de QUALQUER fonte disponível, nunca só 'o arquivo desta UF'"
  - "reconcile.py::main() adaptado -- reaproveita construir_indice_territorial (mesmo custo O(27)),
    checa dado reconciliável (grao=uf/local=ocorrencia) em vez de 'qualquer linha' antes de
    decidir se uma UF entra na comparação SC-7"
  - "prova ao vivo (leitura apenas, cache real inalterado) contra os 9 agregados reais coletados
    até o momento: contaminação removida (0 linhas de outro dono), subcontagem recuperada (ex.:
    AC ganha 432 linhas de residência própria antes presas em DF/RN/RO/TO/AL/AP/RR/SE; SP, ainda
    não coletada, já mostra 7.298 linhas de residência recuperadas de UFs já coletadas)"
affects: [09-10-upload-postgres, 09-12-audit, 09-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "seleção por dono do território (código IBGE da própria linha), nunca por arquivo de
      origem -- _uf_dona deriva a UF dona tanto do grão UF quanto do grão município, sem
      depender de qual arquivo RD{x}* produziu a linha"
    - "índice construído uma vez, consultado muitas vezes -- construir_indice_territorial lê
      cada fonte (agregado ou bruto) exatamente uma vez para as 27 UFs candidatas (O(27)); quem
      precisa de várias UFs na mesma execução (main() --todas, laço de reconcile.py) chama essa
      função diretamente em vez de linhas_da_uf em laço (que recomputaria o índice inteiro a
      cada UF, O(27²))"
    - "soma explícita (nunca sobrescrita) quando a mesma chave (disease_id, grao, local,
      territorio_codigo, ano) aparece em mais de uma fonte -- cada fonte já soma DENTRO de si
      mesma (aggregate_parquet_dir), então somar ENTRE fontes é a leitura correta: descreve
      internações de pacientes diferentes que só coincidem em território/categoria/ano"
    - "taxa_mortalidade sempre recalculada sobre totais somados, nunca somada ela mesma --
      reaproveita aggregate._taxa_mortalidade (fonte única) em vez de duplicar a fórmula"
    - "gate de dado reconciliável (reconcile.py) restrito ao grão/local realmente comparado
      (D-10: grao=uf/local=ocorrencia), não mais 'tem qualquer linha' -- uma UF só com
      residência contribuída por outra UF continua 'sem dado' para fins de SC-7"

key-files:
  created:
    - .planning/phases/09-pipeline-confi-vel-coleta-completa/09-09-FIX-RESIDENCIA-SUMMARY.md
  modified:
    - pipeline/sih/src/sih_pipeline/partitions.py
    - pipeline/sih/tests/test_partitions.py
    - pipeline/sih/src/sih_pipeline/reconcile.py
    - pipeline/sih/tests/test_reconcile.py

key-decisions:
  - "Chaves repetidas entre fontes são SOMADAS, nunca uma sobrescrevendo a outra -- decidido
    explicitamente e provado por teste (test_linhas_da_uf_soma_mesma_chave_vinda_de_fontes_diferentes):
    a mesma chave (disease_id, grao, local, territorio_codigo, ano) vinda de arquivos diferentes
    descreve pacientes DIFERENTES que só coincidem em território/categoria/ano (ex.: um residente
    do AC internado no próprio AC e outro residente do AC internado no DF); escolher uma e
    descartar a outra perderia internações reais. Nunca é a mesma internação duas vezes porque
    aggregate_parquet_dir já soma por chave DENTRO de um único arquivo antes de linhas_da_uf ver
    o resultado."
  - "Custo resolvido com um índice construído uma vez (construir_indice_territorial), não com
    cache/memoização entre chamadas -- memoização por cache_root() quebraria os testes que
    persistem um agregado NO MEIO do teste e esperam a leitura seguinte refletir a mudança (ex.:
    test_linhas_da_uf_prioriza_agregado_persistido_quando_existe). main() de partitions.py e
    reconcile.py constroem o índice uma vez por execução e reaproveitam; linhas_da_uf isolada
    recomputa a cada chamada (correto e barato para uma UF, O(27))."
  - "reconcile.py precisou de um ajuste além de trocar linhas_da_uf por
    construir_indice_territorial: o gate de 'UF tem dado' passou a checar especificamente
    grao=uf/local=ocorrencia (o único grão/local que D-10 compara), não mais 'tem qualquer
    linha' -- depois da correção de território, uma UF pode aparecer no índice só por
    residência CONTRIBUÍDA por outra UF já coletada, sem ter, ela mesma, nenhuma ocorrência
    coletada. Sem o ajuste, essa UF viraria 'inexplicado' por engano em vez do diagnóstico
    correto 'sem dado, coleta ainda não chegou'."
  - "SC-7 verificado (não assumido) intocado: medição ao vivo contra a fixture real de AC/2019,
    via reconcile.py main() com fallback bruto isolado, reproduz exato=34/explicado=61/inexplicado=3
    -- byte a byte igual ao gate congelado e ao valor medido ANTES desta correção. Grão
    UF/local=ocorrencia sempre vem do próprio arquivo RD{uf}* onde a internação ocorreu (nunca
    duplicado nem removido por esta correção, que só afeta seleção/soma de território), então a
    correção de residência estruturalmente não pode mover este número."

patterns-established:
  - "Pattern: um índice territorial construído uma vez (construir_indice_territorial) é o ponto
    único que resolve 'quais linhas pertencem a esta UF' para QUALQUER consumidor futuro
    (upload.py do 09-10, audit.py do 09-12) -- reaproveitar em vez de reimplementar a seleção
    por dono, e nunca chamar linhas_da_uf em laço sobre múltiplas UFs na mesma execução."

requirements-completed: []

# Metrics
duration: ~1h40min (sessão ativa, sem interrupção)
completed: 2026-08-11
---

# Phase 9 Plan 09-FIX-RESIDENCIA: linhas_da_uf seleciona por território dono, não por arquivo de origem Summary

**`partitions.py::linhas_da_uf`/`construir_indice_territorial` corrigem o defeito registrado (mas não corrigido) pela 09-09-ADAPTACAO-AGREGADOS: uma UF passa a ser "toda linha, de QUALQUER fonte, cujo território pertence a ela" — nunca "tudo que está no arquivo dela" — com custo O(27) (não O(27²)), soma explícita entre fontes na mesma chave, e SC-7 verificado ao vivo (não assumido) byte-idêntico antes/depois (`exato=34, explicado=61, inexplicado=3`).**

## Contexto: por que este trabalho existe

Não havia `PLAN.md` formal — o brief operacional do usuário foi o spec, na mesma linha do
09-04-COLETA-INCREMENTAL e do 09-09-ADAPTACAO-AGREGADOS. A 09-09-ADAPTACAO-AGREGADOS fechou o
handoff aberto pelo `collect.py` (ler o agregado persistido em vez do parquet reciclado), mas sua
própria docstring já registrava um defeito real, deliberadamente não corrigido naquele momento:
`linhas_da_uf(uf, index)` selecionava linhas por qual ARQUIVO elas moram (`agregados/{uf}.parquet`
ou o bruto isolado dessa UF), nunca por qual TERRITÓRIO elas descrevem. O `local` do schema v3 tem
dois valores — `ocorrencia` (onde o paciente foi tratado) e `residencia` (onde o paciente MORA,
D-09) — e pacientes viajam: o arquivo de uma UF X carrega território de outras UFs (contaminação)
e a residência PRÓPRIA de X, capturada dentro do arquivo de outra UF Y, nunca chegava ao resultado
de X (subcontagem). Medido no brief: SE/2019 tem 1.066 códigos de território distintos no próprio
agregado (SE é só uma fração deles); AC tinha 11 registros de residência presos no bruto de SP.

## Performance

- **Duração (sessão ativa):** ~1h40min, sem interrupção
- **Commits:** 2 (fix `partitions.py`+testes, fix `reconcile.py`+testes)
- **Arquivos modificados:** 4 (2 de código, 2 de teste)
- **Testes novos:** 9 (7 em `test_partitions.py`, 2 em `test_reconcile.py`) — suíte completa do
  pipeline foi de 154 para 163 testes, todos verdes; `npm run gate` verde (784 JS/TS + 163 Python
  + build)

## Accomplishments

- **`partitions.py::construir_indice_territorial(index) -> dict[str, tuple[list[Row], str]]`** —
  a função central desta correção. Lê cada fonte disponível (agregado persistido com prioridade,
  fallback bruto isolado para UFs ainda não coletadas) **exatamente uma vez** para as 27 UFs
  candidatas (`_todas_fontes_disponiveis`), decide a UF dona de cada linha pelo código IBGE em si
  (`_uf_dona`: grão UF usa o código de 2 dígitos direto, grão município usa `uf_de_municipio`),
  e soma (`_somar_rows`) quando a mesma chave `(disease_id, grao, local, territorio_codigo, ano)`
  aparece em mais de uma fonte — nunca sobrescreve. Custo O(27) leituras totais para as 27 UFs,
  nunca O(27²) (ler cada fonte uma vez por UF pedida daria até 729 leituras).
- **`partitions.py::linhas_da_uf(uf, index)` mantida com a MESMA assinatura**, agora correta:
  devolve `construir_indice_territorial(index).get(uf, ([], "bruto"))`. Chamada isolada (uma UF)
  continua O(27) e correta; quem precisa de várias UFs na mesma execução chama
  `construir_indice_territorial` diretamente uma vez (feito em `main()` de `partitions.py` com
  `--todas`, e em `reconcile.py`).
- **`reconcile.py::main()` adaptado** para reaproveitar `construir_indice_territorial` (mesmo
  custo O(27)) em vez de `linhas_da_uf` em laço, E ajustado para checar dado especificamente
  reconciliável (`grao=uf`/`local=ocorrencia`, D-10) antes de decidir se uma UF entra na
  comparação — achado real durante a implementação: sem esse ajuste, uma UF cuja única presença
  no índice territorial fosse residência contribuída por outra UF já coletada apareceria como
  "inexplicado" (comparação que nunca teve como ser feita) em vez do diagnóstico correto "sem
  dado, coleta ainda não chegou".
- **Contaminação removida e subcontagem recuperada, provado por teste sintético e ao vivo:**
  - Sintético (`test_linhas_da_uf_nao_inclui_territorio_de_outra_uf_mesmo_estando_no_proprio_arquivo`):
    a fixture real de AC/2019 (2.000/44.589 registros com `MUNIC_RES` fora do AC) não vaza mais
    território de outra UF no resultado de `linhas_da_uf("AC")`.
  - Sintético (`test_linhas_da_uf_recupera_residencia_propria_presa_em_outra_uf_undercount`): uma
    linha de residência do AC persistida no agregado de SP aparece no resultado de
    `linhas_da_uf("AC")` e NUNCA no de `linhas_da_uf("SP")`.
  - **Ao vivo, contra os 9 agregados reais já coletados no momento desta correção** (AC, AL, AP,
    DF, RN, RO, RR, SE, TO — cópia de leitura, cache real `~/.lacir/sih-cache/` inalterado,
    confirmado por `ls` antes/depois): AC ganhou **432 linhas de residência própria** antes presas
    em DF (a maior contribuinte — DF é polo de referência: **862 dos 145.095 registros do próprio
    agregado do DF pertenciam a OUTRAS UFs**, não ao DF), RN, RO, TO, AL, AP, RR e SE; SE ganhou
    155; contaminação removida do próprio agregado de cada UF: AC 12.834/73.699 (17,4%), SE
    19.834/154.641 (12,8%), DF 101.771/145.095 (70,1% — DF é majoritariamente residência de fora).
    Mais notável: **SP, ainda NÃO coletada, já aparece com 7.298 linhas de residência recuperadas**
    das 9 UFs já coletadas (mesma mecânica para MG=15.609, BA=18.450, CE=4.255, PA=15.542) — a
    completude de residência cresce mesmo antes de uma UF ser processada por `collect.py`.
- **SC-7 verificado (não assumido) intocado:** rodado ao vivo (`reconcile.py main(["--uf","AC"])`,
  fallback bruto isolado, fixture real congelada `rdac_2019.parquet`) ANTES e DEPOIS desta
  correção — `exato=34, explicado=61, inexplicado=3` byte a byte igual nos dois momentos, e igual
  ao gate permanente (`test_reconcile_gate.py`, que nunca passou por `linhas_da_uf`/`main()` e
  portanto era estruturalmente impossível de mover por esta correção). Raciocínio: só
  `grao=uf`/`local=ocorrencia` entra na reconciliação (D-10), e essas linhas sempre vêm do próprio
  arquivo `RD{uf}*` onde a internação ocorreu — a correção de território/residência nunca as
  duplica nem as remove.
- **Nenhum trabalho já entregue precisou de correção retroativa.** `upload.py` (09-10) e
  `audit.py` (09-12) ainda não existem (nada consumiu `linhas_da_uf` em produção real além de
  `partitions.py --uf`/`--todas`, que ainda não rodou contra o corpus completo, e
  `reconcile.py`, cujo único caminho de produção real usado até hoje — a confirmação de SP/2019
  do 09-11 — filtra `grao=uf`/`local=ocorrencia`, estruturalmente imune ao defeito de território
  como acabou de ser provado). O achado de contaminação/subcontagem registrado no
  `09-09-ADAPTACAO-AGREGADOS-SUMMARY.md` (fora do escopo daquela plan, resolvido aqui) e no
  `09-09-SUMMARY.md` original (medição do AC via `partitions.py --uf AC --upload`, 14/156
  arquivos-mês locais, Task 2 daquela plan) descrevem uma medição feita ANTES da correção — os
  números ali continuam corretos como registro histórico do que foi medido naquele momento, não
  precisam de correção retroativa porque nenhum deles afirma ser a medição final/completa
  (ambos já rotulavam a medição como parcial/projeção).

## Task Commits

1. **`partitions.py::construir_indice_territorial`/`_uf_dona`/`_somar_rows`/`linhas_da_uf`
   corrigida + 7 testes** — `b1ed60c` (fix)
2. **`reconcile.py::main()` adaptado (índice territorial + gate de dado reconciliável) + 2
   testes** — `236a496` (fix)

**Plan metadata:** este commit (SUMMARY + STATE.md)

_Nota: sem gate RED/GREEN formal separado por commit (mesmo padrão do 09-09-ADAPTACAO-AGREGADOS
para trabalho ad-hoc sem `PLAN.md` — brief `priority=high`, não `type: tdd`). Test-first foi
verificado de verdade nesta sessão: os testes novos foram escritos primeiro e confirmados
genuinamente RED contra o código não corrigido — o módulo inteiro falhava até em IMPORTAR
(`ImportError: cannot import name 'construir_indice_territorial'`), prova mais forte que uma
simples asserção falhando — antes de qualquer linha de implementação ser restaurada; implementação
e teste foram commitados juntos, ambos verdes, pelo mesmo motivo documentado na 09-09-ADAPTACAO
(o hook `pre-commit` roda `npm run gate` sobre a árvore de trabalho inteira, não sobre o stage,
então um commit "só teste" com a implementação ausente do disco derrubaria o hook mesmo depois de
provado RED em sessão)._

## Files Created/Modified

- `pipeline/sih/src/sih_pipeline/partitions.py` — `_uf_dona`, `_somar_rows`,
  `_todas_fontes_disponiveis`, `construir_indice_territorial`, `linhas_da_uf` reescrita, `main()`
  usando o índice construído uma vez
- `pipeline/sih/tests/test_partitions.py` — 7 testes novos (30 no total); `_persistir_agregado_realista`
  e `_escrever_parquet_bruto_sp_sintetico` adicionados; 4 testes existentes ajustados para
  persistir conteúdo BRUTO não filtrado (o que `collect.py` realmente grava), não o resultado já
  filtrado de `linhas_da_uf` — simulação mais fiel da produção real
- `pipeline/sih/src/sih_pipeline/reconcile.py` — `main()` reescrito: `construir_indice_territorial`
  em vez de `linhas_da_uf` em laço, gate de dado reconciliável restrito a
  `grao=uf`/`local=ocorrencia`
- `pipeline/sih/tests/test_reconcile.py` — 2 testes novos (18 no total)
- `.planning/phases/09-pipeline-confi-vel-coleta-completa/09-09-FIX-RESIDENCIA-SUMMARY.md` (este
  arquivo)

## Decisions Made

Ver `key-decisions` no frontmatter para o raciocínio completo. Resumo:

1. **Chaves repetidas entre fontes são SOMADAS**, nunca uma sobrescrevendo a outra — provado por
   teste dedicado, com `taxa_mortalidade` sempre recalculada sobre os totais (nunca somada ela
   mesma).
2. **Custo resolvido com um índice construído uma vez** (`construir_indice_territorial`), não com
   memoização entre chamadas (que quebraria testes que persistem um agregado NO MEIO da execução
   e esperam a leitura seguinte refletir a mudança).
3. **`reconcile.py` precisou de um ajuste no gate de "tem dado"** — restrito a
   `grao=uf`/`local=ocorrencia` (D-10), não "tem qualquer linha" — achado real durante a
   implementação, não previsto no brief original.
4. **SC-7 verificado ao vivo, não assumido** — medição real antes/depois desta correção confirma
   `exato=34/explicado=61/inexplicado=3` byte a byte igual.

## Deviations from Plan

Não havia `PLAN.md` formal (o brief operacional era o spec). Um desvio real, coberto pela Rule 1
(bug):

### Auto-fixed Issues

**1. [Rule 1 - Bug] `reconcile.py:main()` tratava "tem qualquer linha" como "tem dado
reconciliável"**
- **Found during:** implementação do índice territorial, antes de qualquer commit — ao trocar
  `linhas_da_uf` por `construir_indice_territorial` em `reconcile.py`, o teste
  `test_main_mistura_uf_com_dado_e_uf_sem_dado_reconcilia_so_a_disponivel` (já existente, da
  09-09-ADAPTACAO-AGREGADOS) passou a falhar: RO deixou de aparecer como "sem dado" porque a
  fixture real de AC tem residência presa apontando para RO (`MUNIC_RES` prefixo `11`) — agora
  corretamente atribuída a RO pela correção de território, mas RO continua sem NENHUMA linha de
  ocorrência própria.
- **Issue:** `main()` usava `if not linhas_uf: ufs_sem_dado.append(uf)` — correto quando "ter
  dado" e "ter dado reconciliável" eram a mesma coisa (antes desta correção, uma UF só aparecia no
  resultado se tivesse SEU PRÓPRIO arquivo, que sempre incluía ocorrência). Depois da correção de
  território, essas duas condições podem divergir: uma UF pode ter dado (residência contribuída
  por outra UF) sem ter dado reconciliável (ocorrência própria).
- **Fix:** o gate passou a checar `any(l.grao == GRAO_UF and l.local == LOCAL_OCORRENCIA for l in
  linhas_uf)` em vez de `linhas_uf` truthy.
- **Files modified:** `pipeline/sih/src/sih_pipeline/reconcile.py`,
  `pipeline/sih/tests/test_reconcile.py` (2 testes novos provam o comportamento correto)
- **Verification:** suíte completa de `reconcile.py` (18 testes) e `test_reconcile_gate.py` (5
  testes) verdes; medição ao vivo confirma SC-7 (`exato=34/explicado=61/inexplicado=3`) intocado.
- **Committed in:** `236a496`

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug de diagnóstico, não de dado: nenhum número de
reconciliação mudou, só a mensagem para UFs sem dado ocorrência ficou correta de novo)
**Impact on plan:** Necessário para reconcile.py continuar distinguindo corretamente "UF sem
coleta própria ainda" de "divergência real sem explicação" depois da correção de território. Sem
escopo adicional além do que a correção de `linhas_da_uf` já exigia de `reconcile.py`.

## Issues Encountered

- **Fixtures de teste existentes simulavam um cenário que nunca acontece em produção.** Quatro
  testes de `test_partitions.py` (herdados da 09-09-ADAPTACAO-AGREGADOS) persistiam, como "o
  agregado que `collect.py` gravaria", o resultado JÁ FILTRADO de `linhas_da_uf` — mas
  `collect.py` (módulo vivo, intocado) sempre grava a agregação BRUTA e não filtrada do arquivo
  isolado da UF; a filtragem por dono é responsabilidade de `linhas_da_uf` na LEITURA, não de
  `collect.py` na escrita. Corrigido com um novo helper (`_persistir_agregado_realista`) que
  persiste via `_linhas_do_parquet_bruto_isolado` direto, igual à produção real — os 4 testes
  continuavam passando com o padrão antigo (a diferença só aparece com uma segunda fonte
  contaminante presente), mas a correção deixa os testes fiéis ao comportamento real do sistema.
- **Um teste existente (`test_main_todas_mistura_agregado_bruto_e_uf_nao_coletada`) copiava bytes
  reais do AC sob um nome de arquivo de SP** (`RDSP1901.parquet` com conteúdo idêntico ao
  `RDAC1901.parquet`) para simular "SP em trânsito". Sob a correção de território (dono decidido
  pelo CONTEÚDO, nunca pelo nome do arquivo), isso teria feito o "SP" resultante ser, na
  verdade, uma segunda cópia do AC — dobrando as contagens do AC por soma de chave. Corrigido com
  um parquet bruto sintético GENUÍNO para SP (`_escrever_parquet_bruto_sp_sintetico`, um registro
  real com `MUNIC_MOV`/`MUNIC_RES` de SP).
- **Dois testes existentes usavam "RO" como a UF "sem dado nenhum"** — mas a fixture real de AC
  tem `MUNIC_RES` apontando para RO (prefixo `11`), então RO deixou de estar "sem dado" depois da
  correção (comportamento CORRETO, é exatamente o que a correção existe para produzir). Medido ao
  vivo qual UF está genuinamente ausente da fixture (`MUNIC_MOV`/`MUNIC_RES`, nenhum grão/local):
  TO/PI/AL/SE/ES. Os dois testes foram trocados para usar TO, com o raciocínio documentado inline
  para que a próxima pessoa não reintroduza RO por engano.

## User Setup Required

None — nenhuma configuração de serviço externo. Toda a verificação ao vivo rodou sobre cópias de
leitura (nunca escrita) do cache real, em diretório temporário — confirmado depois: `ls
~/.lacir/sih-cache/agregados/*.parquet` continua com os mesmos 9 arquivos (AC, AL, AP, DF, RN, RO,
RR, SE, TO) que existiam no início desta sessão, mais os que a corrida real acrescentou
naturalmente durante o trabalho (nenhuma escrita desta sessão).

## Next Phase Readiness

- **O defeito de território registrado pela 09-09-ADAPTACAO-AGREGADOS está corrigido.**
  `partitions.py`/`reconcile.py` agora selecionam por dono do território, gathering de qualquer
  fonte disponível, com custo O(27). O `09-10` (upload) pode depender de `partitions.py` produzir
  partições territorialmente corretas (sem contaminação, sem subcontagem de residência), inclusive
  para UFs que `collect.py` ainda não processou (a residência delas pode já estar parcialmente
  disponível via outras UFs já coletadas — medido ao vivo para SP/MG/BA/CE/PA).
- **`aggregate.py` continua com o mesmo defeito de leitura direta de `cache_path("parquet")`**
  (achado residual da 09-09-ADAPTACAO-AGREGADOS, não tocado aqui — fora do `file_scope`, dono
  declarado 09-07). Não corrigido nesta sessão; não bloqueante para o 09-10 (que consome
  `partitions.py`, não `aggregate.py` diretamente).
- **Corrida de coleta continua em andamento** (PID 8133/8135, verificado vivo ao final desta
  sessão, undisturbed durante todo o trabalho): 9/27 UFs completas no momento deste registro (AC,
  AL, AP, DF, RN, RO, RR, SE, TO).
- **Item de acompanhamento (herdado, agora resolvido pela mecânica desta correção, não pela
  ação):** o "achado da residência cross-UF" registrado como pendência no
  `09-09-ADAPTACAO-AGREGADOS-SUMMARY.md` ("a solução precisaria rodar DEPOIS que as 27 UFs
  completarem a coleta") não é mais verdade — a correção desta sessão recupera residência
  cross-UF de forma incremental e contínua, conforme cada UF é coletada, sem precisar esperar a
  corrida completar. A completude TOTAL de residência de uma UF ainda não coletada só existe
  quando TODAS as 27 UFs estiverem coletadas (uma UF pode ter pacientes tratados em qualquer uma
  das outras 26), mas a completude PARCIAL cresce a cada UF nova, nunca fica presa esperando o
  fim da corrida.

---
*Phase: 09-pipeline-confi-vel-coleta-completa*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: `pipeline/sih/src/sih_pipeline/partitions.py` (com `construir_indice_territorial`)
- FOUND: `pipeline/sih/src/sih_pipeline/reconcile.py` (com `main()` adaptado)
- FOUND: `pipeline/sih/tests/test_partitions.py` (30 testes)
- FOUND: `pipeline/sih/tests/test_reconcile.py` (18 testes)
- FOUND commit `b1ed60c` (fix: partitions.py + testes)
- FOUND commit `236a496` (fix: reconcile.py + testes)
- CONFIRMADO ao vivo: `uv run pytest -q` (163 testes) e `npm run gate` (784 JS/TS + 163 Python +
  build) verdes nesta sessão
- CONFIRMADO ao vivo: SC-7 (`exato=34/explicado=61/inexplicado=3`) byte a byte igual antes e
  depois desta correção, medido via `reconcile.py main(["--uf","AC"])` contra a fixture real
- CONFIRMADO ao vivo: contaminação removida e subcontagem recuperada contra os 9 agregados reais
  em cache (leitura apenas, `~/.lacir/sih-cache/` inalterado)
- CONFIRMADO ao vivo: processo de coleta (PID 8133/8135) vivo ao final desta sessão
