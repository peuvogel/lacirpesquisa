"""Agregação por (agravo, medida, grão, local, ano de INTERNAÇÃO) — DATA-01/DATA-02/DATA-03.

**O `ano` sai de `DT_INTER`, nunca de `ANO_CMPT` (09-15-DT-INTER, 2026-08-17, decisão do
operador em base epidemiológica).** Até esta correção, tudo em produção agregava por `ANO_CMPT`,
que é a competência em que a AIH foi FATURADA — um artefato administrativo, não um evento
clínico. `DT_INTER` é a data em que o paciente foi internado. A troca não é cosmética: ela é o
que faz as três coisas que este projeto existe para ensinar pararem de estar erradas.

1. **Taxa por 100 mil habitantes.** Agregar por competência casa internações de 2018 (faturadas
   em 2019) contra o denominador populacional de 2019 — numerador e denominador passam a medir
   anos diferentes. Medido em AC: 3.493 dos 44.563 registros `IDENT='1'` da competência 2019
   (7,84%) são internações de 2018.
2. **Série temporal (Prais-Winsten).** A defasagem de faturamento não é ruído branco: é um
   ATRASO sistemático, que desloca picos e enviesa a TENDÊNCIA, não só a variância — exatamente
   a estatística que a capacitação ensina a estimar.
3. **Sazonalidade.** Uma internação de dezembro faturada em janeiro cai no ano errado. Medido:
   a competência de janeiro é o mês em que a defasagem é MÁXIMA (58,70% dos registros de
   `RDAC2501` são internações de 2024; 29,60% em `RDSP2601`).

A defasagem foi medida ao vivo, nunca suposta (dado real, 2026-08-17) — ver
`enumerate.py` (docstring do módulo) para a tabela completa por mês de competência e para a
janela de coleta que ela obriga. Resumo do que importa aqui: a defasagem é sempre POSITIVA
(`DT_INTER` nunca é posterior à competência), decai por um fator de ~4 a ~8 por mês, e **nunca
passou de 1 ano** em nenhum dos ~1,5 milhão de registros medidos (AC competências 2019/2020/2025
e SP competências 2026-01..06).

Consequência estrutural que o código precisa carregar: **um ano de internação é montado a partir
de MAIS DE UM ano de arquivos de competência.** O ano de admissão Y vive nos arquivos de
competência Y (a maior parte) E nos de Y+1 (a cauda). Por isso `aggregate_parquet_dir` nunca
pode assumir que "o arquivo é de 2019, logo o dado é de 2019" — cada registro carrega o próprio
ano, e registros do MESMO arquivo caem em anos diferentes.

Reconciliação que prova a mudança, sobre dado real (AC, `PROC_REA=0408050012`/`amputacao_mmii`,
o eixo independente do CID — ver `_PROC_REA_AMPUTACAO_MMII` abaixo): por `ANO_CMPT` a agregação
media 50 internações em 2019 contra 66 do oráculo TabNet (que tabula por data de atendimento,
não por competência) — **-24,2%**. Por `DT_INTER`, com a competência de 2020 incluída na leitura,
o mesmo código fecha em 65-66. O erro nunca esteve no mapeamento SIGTAP nem no matcher CID:
estava em medir uma coisa (faturamento) e comparar com outra (atendimento).

`DT_INTER` chega como string `YYYYMMDD` (medido: `'20241210'`, tipo `string`, comprimento 8 em
100% dos ~1,5 milhão de registros reais inspecionados) — nunca uma data nativa do parquet.
`_ano_de_dt_inter` valida a estrutura e devolve só o ANO; ver a docstring dessa função para a
semântica exata de valor ausente/malformado e `_MAX_TAXA_DESCARTE_DT_INTER` para a guarda de
taxa que impede um descarte silencioso.

`ANO_CMPT` continua sendo lido e castado (não foi removido de `NEEDED_COLUMNS`) por duas razões
concretas, nenhuma delas inércia: (1) `download._valida_registros_alinhados` roda exatamente os
mesmos casts desta agregação, por arquivo, para pegar registro desalinhado de `.dbc` corrompido
no DOWNLOAD em vez de na agregação da UF inteira horas depois (FIX-DBC-CORROMPIDO) — tirar
`ANO_CMPT` daqui apagaria essa guarda; (2) é o que permite MEDIR a defasagem
(`ANO_CMPT - ano(DT_INTER)`) durante a própria corrida, em vez de voltar a supor que ela é curta
(ver `stats` em `aggregate_parquet_dir`).

---


Lê os diretórios/arquivos `.parquet` já decodificados pelo `pysus` (ou a fixture congelada de
gate) via `pyarrow.dataset`, projetando SÓ `NEEDED_COLUMNS` (RESEARCH Pattern 3) — nunca a rota
de conveniência de alto nível do `pysus` para ler o parquet de volta como dataframe, que é
enviesada para o SINAN, não para o SIH (RESEARCH Pitfall 2, 09-PATTERNS.md §aggregate.py).

`VAL_TOT`/`DIAS_PERM` chegam como string com padding de espaço (Pitfall 1, `'        459.40'`,
`'    2'`) — `utf8_trim_whitespace` + `cast` explícitos são obrigatórios antes de qualquer soma.

Desvio medido do RESEARCH: a pesquisa assumiu que `MORTE` já chega `Int64` e não precisa de
cast. Medido ao vivo nesta plan (arquivo real `RDAC1901.parquet`, decodificado por
`pysus==1.0.1`): `MORTE` chega como STRING (`'0'`/`'1'`), igual a `VAL_TOT`/`DIAS_PERM`. O código
abaixo trata os dois casos possíveis (string ou inteiro) e levanta `TypeError` para qualquer
outro tipo — nunca assume, sempre verifica (é exatamente a disciplina que o plano já pedia:
"o código precisa **verificar** o tipo e falhar alto se ele mudar, em vez de assumir").

Correção 2026-08-10 (achado 09-08-INVESTIGACAO, decisão do operador): `IDENT` (tipo de AIH) só
conta `'1'` (AIH normal/nova admissão) em `internacoes`. `IDENT='5'` é renovação MENSAL de
faturamento de uma internação de longa permanência — a MESMA hospitalização, não uma nova —
contá-la infla categorias crônicas (demência, Parkinson, Alzheimer, formas graves de
tuberculose) em ordens de grandeza sem afetar condições agudas. Ver
`pipeline/sih/reports/reconciliacao-sc7.md` §"Investigação nova, 2026-08-10" para a medição
completa (deltas SP/2019 colapsam de +45%/+108%/+665% para +3,7%/+21,1% ao filtrar só
`IDENT='1'`).

A janela de anos (D-11, `schema-v3.json` `anoMin`/`anoMax`) e os valores canônicos de `grao`/
`local`/`medidas` vêm do próprio `schema-v3.json` — nunca reescritos como literal solto aqui, a
mesma disciplina de fonte única que `codigos.py` aplica a UF/município.

Recuperação de `amputacao_mmii` (09-XX-PROCEDIMENTO, 2026-08-12, brief avulso do coordenador,
sem PLAN.md formal). `amputacao_mmii` é o único agravo de `scripts/catalog/extra-diseases.json`
(Fase 8) com `filterKind: "procedimento"` — vem de `sih/cnv/qibr.def` (procedimentos
hospitalares SIH), fora da Lista Morb CID-10 que `match_category`/`matcher.py` cobrem. Por isso
nunca casa por `DIAG_PRINC`: casa por `PROC_REA` (procedimento realizado, código SIGTAP de 10
dígitos, campo oficial e ESTÁVEL do SIH-RD), um SEGUNDO eixo de classificação, independente do
eixo CID e testado em paralelo a ele para CADA registro (um mesmo registro pode contribuir para
as duas classificações ao mesmo tempo — nenhuma delas isenta ou substitui a outra). Ver
`_PROC_REA_AMPUTACAO_MMII` abaixo para a medição completa que estabeleceu o código certo.

Correção de valor numérico vazio (09-04-FIX-AGREGACAO-VAZIO, 2026-08-12, brief avulso do
coordenador, sem PLAN.md formal). A recoleta nacional falhou em DF e RR com `Failed to parse
string: '' as a scalar of type double` (`~/.lacir/sih-cache/agregados/collect_state.json`,
campo `reason`). O brief levantou como hipótese que fosse regressão do eixo de procedimento
acima (`9f8545c`) — **verificado, não confirmado**: rodei a versão de `aggregate_parquet_dir`
de ANTES de `9f8545c` contra o mesmo arquivo real (`RDDF1708.parquet`, competência 2017-08) e
ela quebra IDÊNTICO. A causa real é preexistente e ortogonal ao eixo de procedimento: os quatro
casts eager abaixo (`VAL_TOT`→float64, `DIAS_PERM`/`ANO_CMPT`→int64, `MORTE` via `_cast_morte`)
sempre rodaram sobre a COLUNA INTEIRA, ANTES de qualquer filtro por registro (`IDENT`, janela de
ano) — nunca tinham sido medidos contra um arquivo real que contivesse string vazia nesses
campos especificamente, só padding de espaço (Pitfall 1 acima).

Medido ao vivo contra as 27 UFs em cache (`~/.lacir/sih-cache/parquet/`), duas classes bem
distintas de registro produzem string vazia nesses quatro campos, cada uma com uma origem e um
tratamento diferente:

1. **Registro corrompido do DBC** (medido em `DF/RDDF1708.parquet`: 46 de 2.292 registros).
   `IDENT`, `ANO_CMPT`, `DIAG_PRINC`, `MUNIC_RES` **e** os quatro campos numéricos vêm TODOS
   vazios juntos — não é uma AIH real com um campo faltando, é uma linha inteira sem dado
   utilizável (bytes desalinhados na decodificação do `.dbc`, mesma classe de achado do
   `09-04-FIX-DOWNLOAD-VAZIO`, mas na CONVERSÃO, não no download). Como `IDENT` também vem
   vazio (`!= '1'`), estes registros já eram excluídos pelo filtro de `IDENT` existente — o
   problema NUNCA foi a classificação deles, foi o cast eager travar antes do laço conseguir
   filtrá-los.
2. **AIH real com campo de faturamento/óbito não preenchido** (medido em `RR/RDRR1811.parquet`,
   `RR/RDRR1907.parquet`, `RR/RDRR2208.parquet`, `DF/RDDF1708.parquet`: no total, 2 registros de
   RR com `VAL_TOT` vazio, e 2 (DF) + 5 (RR) com `DIAS_PERM`/`MORTE` vazios — sempre o par
   junto, nunca um sem o outro). `IDENT='1'`, `ANO_CMPT` dentro da janela D-11 — é uma internação
   genuína, só o campo billing específico não foi preenchido nesta competência.

A correção (`_blank_to_null`, abaixo) troca SÓ a string exatamente vazia (após
`utf8_trim_whitespace`) por `null` explícito antes do `pc.cast` — nunca um coerce cego: qualquer
outro valor não numérico continua propagando sem alteração e ainda estourando `ArrowInvalid` no
cast seguinte (medido: nenhum registro `IDENT='1'` de DF/RR tem valor não vazio e não numérico
nestes quatro campos — se algum dia existir, a correção NÃO o esconde). Para a classe 1
(registro corrompido), o `null` em `ANO_CMPT` cai no mesmo `continue` que já existia para "fora
da janela D-11" — o registro nunca chega ao filtro de `IDENT` nem à classificação, exatamente
como antes desta correção teria acontecido SE o cast não tivesse quebrado primeiro. Para a
classe 2 (AIH real), a semântica de cada medida é decidida e documentada onde as contribuições
são somadas no laço principal, abaixo — resumo: `internacoes` sempre conta (o AIH existiu),
`valor_total`/`dias_permanencia` somam só a contribuição CONHECIDA (ausência não é zero, mas uma
soma corrente não tem representação de "parcialmente desconhecido" — o agregado SUBESTIMA nesses
poucos registros, nunca superestima), e `MORTE` vazio NUNCA conta como óbito (inventar uma morte
sem evidência no dado-fonte inflaria `taxa_mortalidade` sem base real).

Preservação do eixo CID: `rdac_2019.parquet` (a fixture congelada usada pelo gate SC-7 e pela
maioria dos testes deste módulo) não tem NENHUM campo vazio nestes quatro campos (medido:
0/44.589 em cada um) — esta correção nunca altera o valor computado sobre essa fixture, prova
em `test_cid_output_identico_byte_a_byte_apos_correcao_de_vazio` (hash SHA-256 de toda a saída).

Correção de município em branco (09-04-FIX-MUNICIPIO-BRANCO, 2026-08-12, brief avulso do
coordenador, sem PLAN.md formal). A recoleta nacional falhou em PR com `municipio6: comprimento
inválido (esperado 6 ou 7 dígitos): ''` — risco lateral já PREVISTO (e deliberadamente não
corrigido, por estar fora do `file_scope` daquela plan) pelo SUMMARY de
09-04-FIX-AGREGACAO-VAZIO: "se uma futura UF tiver um registro... E MUNIC_MOV/MUNIC_RES vazio ou
malformado, a agregação dessa UF quebraria". A previsão se confirmou; DF/RR simplesmente não
continham o caso.

Medido nacionalmente contra as 27 UFs em cache (`~/.lacir/sih-cache/parquet/`, ~86 milhões de
registros brutos, 11 UFs falhas — BA/CE/ES/GO/MA/MT/PA/PE/PR/RJ/RS): dois números bem
diferentes, dependendo do que se mede:

1. **Raw scan (sem filtro de IDENT/ano/match)**: `MUNIC_MOV`/`MUNIC_RES` em branco ou malformado
   aparece em taxas de 0,003% a 0,4% por UF — mas HETEROGÊNEO, concentrado em clusters de até
   ~90% de um ÚNICO arquivo/mês (ex.: `RDGO1902.parquet` 50,7%, `RDMT1608.parquet` 89,2%,
   `RDMA1806.parquet` 52,9%) — a assinatura de CORRUPÇÃO SISTEMÁTICA (bytes desalinhados na
   decodificação do `.dbc`), não de dado real esparso. Inspecionado ao vivo: nesses clusters,
   `IDENT`/`DIAG_PRINC`/`CNES` vêm TODOS corrompidos JUNTO com `MUNIC_MOV` — a MESMA classe
   "registro corrompido do DBC" já documentada acima (seção "Correção de valor numérico vazio"),
   já excluída pelo filtro de `IDENT` ANTES de alcançar `municipio6()`.
2. **População que de fato alcança este ponto do laço** (`IDENT='1'`, ano válido, alguma doença
   casada — a MESMA população usada por `_MAX_TAXA_DESCARTE`): dos 82.091.610 registros medidos,
   só 8 têm `MUNIC_MOV` ou `MUNIC_RES` em branco/malformado (0,00001%) — espalhados em 7 arquivos
   de 6 UFs diferentes (CE/GO/MA×2/MT×2/PE/PR), nunca mais de 2 no mesmo arquivo. Dado real
   esparso, não corrupção — confirma a leitura de que o raw scan mede principalmente ruído já
   filtrado antes de chegar aqui.

Inspecionados os 8 registros reais um a um: em TODOS, `MUNIC_RES` veio válido e `UF_ZI` veio
válido — o único campo problemático era `MUNIC_MOV` (branco em 6, malformado com comprimento
certo mas caractere não numérico em 2 — `'01510.'`, `'     8'`/`'51059.'`). Decisão de semântica
por grão, medida e não suposta:

- **Grão MUNICÍPIO nunca é recuperável** quando o próprio campo (`MUNIC_MOV` ou `MUNIC_RES`) vem
  em branco/malformado — não há como inferir qual dos milhares de municípios seria o certo.
  Excluir o registro desse grão/local é a única opção honesta.
- **Grão UF de OCORRÊNCIA (`MUNIC_MOV`) PODE ser recuperado via `UF_ZI`** — campo oficial e
  ESTÁVEL do SIH-RD para a UF do estabelecimento hospitalar, medido idêntico a `MUNIC_MOV[:2]`
  em TODO registro válido de uma amostra de milhares — e válido nos 8 registros reais afetados.
  Descartar esses registros do grão UF também (quando a UF É conhecível via `UF_ZI`) subcontaria
  silenciosamente — por isso `_territorio_ocorrencia` usa `UF_ZI` como fallback SÓ para o grão
  UF, nunca para o grão município.
- **Grão UF de RESIDÊNCIA (`MUNIC_RES`) NÃO tem fallback** — o SIH-RD não publica um campo
  equivalente a `UF_ZI` para a UF de residência do paciente (`UF_ZI` é documentadamente a UF do
  ESTABELECIMENTO, não do paciente); usá-lo aqui juntaria endereço do hospital com residência do
  paciente, um erro de atribuição pior que o descarte. `_territorio_residencia` nunca tenta.

Descarte contado e taxa-guardada (mesma disciplina de `_MAX_TAXA_DESCARTE`/T-09-30, NUNCA um
catch-and-ignore silencioso): `_MAX_TAXA_DESCARTE_MUNICIPIO` (0,01%) levanta `ValueError` se a
taxa medida no arquivo/UF agregado exceder o limiar — ver a constante abaixo para a medição
completa que o justifica. `codigos.municipio6` também foi endurecida (Rule 1) para rejeitar
código do comprimento CERTO mas com caractere não numérico — antes desta correção, esse caso
passava pela checagem de comprimento sem levantar, silenciosamente corrompendo
`sih_metric_muni.municipio_codigo`; agora recebe o MESMO tratamento do branco (contado, nunca
propagado). `municipio6_ou_none` (também em `codigos.py`) é o único ponto do pipeline que trata
essa condição como dado esperado em vez de erro — `municipio6` continua levantando para todo o
resto (`population.py`).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, NamedTuple

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.dataset as ds

from sih_pipeline.codigos import UF_POR_CODIGO, municipio6_ou_none, uf_de_municipio
from sih_pipeline.corrections import apply_corrections, load_corrections
from sih_pipeline.matcher import CidIndex, build_index, load_cid_map, match_category
from sih_pipeline.paths import cache_path, repo_root

NEEDED_COLUMNS = [
    "DIAG_PRINC",
    "MUNIC_MOV",
    "MUNIC_RES",
    "MORTE",
    "VAL_TOT",
    "DIAS_PERM",
    "ANO_CMPT",
    "DT_INTER",
    "IDENT",
    "PROC_REA",
]

# `UF_ZI` (fallback de UF quando MUNIC_MOV vem em branco/malformado, ver
# "Correção de município em branco" abaixo) é OPCIONAL, não um `NEEDED_COLUMNS` -- todo parquet
# REAL do SIH-RD tem essa coluna (medido: presente em toda UF em cache), mas parquet sintético
# mínimo já existente em outros módulos (ex.: `partitions.py`, fora do file_scope desta
# correção) não a projeta. Exigi-la sem exceção quebraria esses consumidores por um campo que
# nem usam (`MUNIC_MOV` sempre válido lá) -- lida via checagem de schema em
# `aggregate_parquet_dir`, nunca via um segundo `dataset.to_table` (preserva "numa passada só").
_COLUNA_UF_ZI = "UF_ZI"

# IDENT='1' é a única AIH que conta como internação nova -- ver docstring do módulo.
_IDENT_AIH_NORMAL = "1"

# --- Ano de INTERNAÇÃO (DT_INTER) -----------------------------------------------------------
#
# Faixa de plausibilidade estrutural de `DT_INTER`. NÃO é a janela de publicação (essa é
# ANO_MIN/ANO_MAX, do schema-v3.json, e uma data fora DELA é registro legítimo fora do recorte,
# nunca um defeito). Esta faixa existe só para separar "ano real, ainda que fora do recorte" de
# "lixo que por acaso tem 8 dígitos" (ex.: `'00000000'`, `'99999999'`, bytes desalinhados que
# formam um número). Deliberadamente LARGA -- a série SIH-RD do FTP começa em 2008-01 e uma
# internação de longa permanência pode ter DT_INTER anterior ao primeiro arquivo da série;
# apertar esta faixa transformaria uma internação antiga e legítima em descarte, que é
# exatamente o erro que a guarda abaixo existe para evitar.
_ANO_DT_INTER_MIN_PLAUSIVEL = 1990
_ANO_DT_INTER_MAX_PLAUSIVEL = 2100

# Taxa de descarte (`IDENT='1'` com `DT_INTER` ausente ou malformado) acima da qual a agregação
# levanta -- MESMO limiar de `_MAX_TAXA_DESCARTE` (0,1%), por decisão explícita: um registro sem
# data de internação utilizável é uma internação REAL que o pipeline não consegue localizar no
# tempo, a mesma classe de perda de informação que um DIAG_PRINC sem categoria, e merece a mesma
# barra. NUNCA um descarte silencioso (T-09-30).
#
# Baseline MEDIDO antes de fixar este limiar (2026-08-17, dado real, nunca suposto): ZERO
# registros `IDENT='1'` com `DT_INTER` ausente ou malformado em 1.540.000+ registros de 30
# arquivos -- AC competências 2019 (12 arquivos), 2020 (12) e 2025 (12), e SP competências
# 2026-01..06 (6 arquivos, ~1,45 milhão de registros). `DT_INTER` veio string de comprimento 8 em
# 100% deles. O limiar tem, portanto, margem enorme sobre o baseline; ele não está calibrado para
# tolerar defeito esparso (não há nenhum a tolerar), e sim para disparar cedo contra corrupção
# SISTEMÁTICA, que no `.dbc` do SIH-RD aparece em clusters de ~50% a ~90% de um único arquivo/mês
# (medido em RDGO1902/RDMT1608/RDMA1806, ver "Correção de município em branco" abaixo) -- ordens
# de grandeza acima desta barra.
#
# Denominador = população `IDENT='1'` (não o total de registros do arquivo), porque o filtro de
# IDENT roda ANTES: a classe "registro corrompido do DBC" (documentada abaixo) tem `IDENT` vazio
# junto com todo o resto e já é excluída antes de chegar aqui -- contá-la no denominador inflaria
# artificialmente a base e afrouxaria a guarda justamente nos arquivos mais corrompidos.
_MAX_TAXA_DESCARTE_DT_INTER = 0.001

# Taxa de descarte (DIAG_PRINC sem categoria) acima da qual a agregação levanta -- T-09-30,
# spike mediu 0,016% em 44.589 registros de AC/2019.
_MAX_TAXA_DESCARTE = 0.001

# Taxa de descarte (MUNIC_MOV/MUNIC_RES em branco ou malformado, sem UF derivável) acima da
# qual a agregação levanta -- 09-04-FIX-MUNICIPIO-BRANCO. Medido nacionalmente contra as 27 UFs
# em cache (~86 milhões de registros brutos, 11 UFs falhas): dos 82.091.610 registros que
# alcançam este ponto do laço (IDENT='1', ano válido, alguma doença casada -- a MESMA população
# usada por `_MAX_TAXA_DESCARTE`), só 8 têm MUNIC_MOV ou MUNIC_RES em branco/malformado
# (0,00001%) -- dado real esparso, não corrupção sistemática (ver docstring do módulo, seção
# "Correção de município em branco", para a medição completa). O limiar abaixo tem ~1000x de
# margem sobre esse baseline medido -- MUITO mais apertado que `_MAX_TAXA_DESCARTE` (0,1%)
# porque município em branco é uma classe de defeito ~10.000x mais rara que DIAG_PRINC sem
# categoria: reusar o mesmo limiar por conveniência toleraria uma corrupção bem maior antes de
# falhar alto. Clusters de corrupção real medidos no raw scan (sem os filtros de IDENT/ano/match
# acima) chegam a ~90% de um único arquivo/mês -- bem acima deste limiar, então qualquer
# vazamento futuro desses registros para além do filtro de IDENT ainda dispara o gate cedo.
_MAX_TAXA_DESCARTE_MUNICIPIO = 0.0001

# --- Eixo de PROCEDIMENTO (amputacao_mmii, filterKind="procedimento") -----------------------
#
# `scripts/catalog/extra-diseases.json` (Fase 8) registra `amputacao_mmii` com `tabnetCode`
# "3331" e `def: "sih/cnv/qibr.def"`. Esse `tabnetCode` NÃO é o código SIGTAP do procedimento —
# é o ÍNDICE POSICIONAL da opção dentro do `<select name="SProcedimento" MULTIPLE>` do
# formulário TabNet de `qibr.def` (medido ao vivo, 2026-08-12: 5.695 opções, cada uma
# `"<índice>" -> "<código SIGTAP de 10 dígitos> <descrição>"`, ordenadas pelo próprio código
# SIGTAP). Esse índice DERIVA quando o DATASUS insere um procedimento SIGTAP novo no meio da
# lista — medido, não suposto:
#
#   - O HTML cru de um script legado
#     (`trabalhos datasus/outputs/coleta_vascular_amputacao/raw_sih_internacoes_amputacao_mmii.html`,
#     raspado 2026-06-17) usou `SProcedimento=3331` e o TabNet ecoou de volta "Procedimento:
#     0408050012 AMPUTACAO / DESARTICULACAO DE MEMBROS INFERIORES" na própria resposta —
#     correto NAQUELE dia.
#   - Re-raspado ao vivo em 2026-08-12 (~2 meses depois): o índice 3331 passou a apontar para
#     "0408040351 TRATAMENTO DE ARTICULACAO COXO-FEMORAL C/ IMOBILIZACAO GESSADA" (procedimento
#     totalmente diferente), e "0408050012 AMPUTACAO / DESARTICULACAO DE MEMBROS INFERIORES"
#     migrou para o índice 3332.
#
# Por isso esta agregação casa por `PROC_REA` (o código SIGTAP, campo oficial e ESTÁVEL do
# SIH-RD), nunca por um índice posicional do TabNet re-derivado a cada corrida — mesma
# disciplina de fonte autoritativa + medição empírica (nunca suposição) das colisões de faixa
# CID 9/15/77 do 09-08-INVESTIGACAO, aplicada aqui a um eixo diferente do TabNet.
#
# Reconciliado ao vivo (2026-08-12) contra dado real de AC/2019 (12 arquivos RDAC1901..1912,
# 44.589 registros): `PROC_REA=="0408050012" AND IDENT='1' AND ANO_CMPT=2019` mede 50
# internações. O oráculo TabNet (`Ano_atendimento=2019`, coluna por `DT_INTER`, não `ANO_CMPT`)
# mede 66 — a mesma ordem de grandeza do resíduo de competência de processamento já documentado
# em todo o SC-7 (`ANO_CMPT` vs `DT_INTER`), não um erro de mapeamento: medido que 45 dos 50
# registros de `ANO_CMPT=2019` têm `DT_INTER` em 2019 (5 são competência atrasada de admissões de
# 2018), e que só os 2 primeiros meses de 2020 (RDAC2001+RDAC2002) já somam 20 registros
# adicionais com `PROC_REA` casado, `IDENT='1'` e `DT_INTER=2019` — 45+20=65, a 1 unidade do
# oráculo (66), sem nenhum ajuste de código. Ver o SUMMARY desta plan
# (`09-XX-PROCEDIMENTO-SUMMARY.md`) para o relato completo, incluindo a reconciliação nacional.
_PROC_REA_AMPUTACAO_MMII = "0408050012"


def _load_procedure_disease_map() -> dict[str, str]:
    """`PROC_REA` (código SIGTAP) -> `disease_id`, para os agravos com `filterKind:
    "procedimento"` em `scripts/catalog/extra-diseases.json` (Fase 8) — hoje só
    `amputacao_mmii`. O `disease_id` sempre vem do próprio catálogo (nunca um literal solto
    aqui, mesma disciplina de `_load_disease_ids`) e é conferido contra
    `scripts/catalog/diseases.json` — mas o CÓDIGO SIGTAP correto (a chave do dict devolvido)
    nunca pode vir do `tabnetCode` do catálogo (índice posicional do TabNet, provado instável
    acima); vem só de uma constante medida e documentada nesta seção. Levanta `KeyError` se o
    catálogo algum dia registrar um agravo `filterKind: "procedimento"` sem `disease_id`
    conhecido ou sem código SIGTAP medido — falha alta em vez de ignorar silenciosamente um
    agravo novo (mesma disciplina de `_load_disease_ids`)."""
    path = repo_root() / "scripts" / "catalog" / "extra-diseases.json"
    with path.open("r", encoding="utf-8") as fh:
        entries = json.load(fh)

    known_disease_ids = set(_load_disease_ids().values())
    # Códigos SIGTAP medidos/documentados acima -- NUNCA derivados do tabnetCode do catálogo.
    proc_rea_by_disease_id = {"amputacao_mmii": _PROC_REA_AMPUTACAO_MMII}

    out: dict[str, str] = {}
    for entry in entries:
        if entry.get("filterKind") != "procedimento":
            continue
        disease_id = entry["id"]
        if disease_id not in known_disease_ids:
            raise KeyError(
                f"aggregate: extra-diseases.json tem {disease_id!r} (filterKind=procedimento) "
                "sem disease_id correspondente em scripts/catalog/diseases.json -- taxonomia "
                "dessincronizada."
            )
        proc_rea = proc_rea_by_disease_id.get(disease_id)
        if proc_rea is None:
            raise KeyError(
                f"aggregate: extra-diseases.json tem {disease_id!r} (filterKind=procedimento) "
                "sem código SIGTAP medido/documentado em _load_procedure_disease_map -- nunca "
                "inferir do tabnetCode (índice posicional instável do TabNet, ver docstring)."
            )
        out[proc_rea] = disease_id
    return out


def _load_schema_v3() -> dict[str, Any]:
    path = repo_root() / "scripts" / "catalog" / "schema-v3.json"
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


_SCHEMA = _load_schema_v3()
GRAO_UF, GRAO_MUNICIPIO = _SCHEMA["graos"]
LOCAL_OCORRENCIA, LOCAL_RESIDENCIA = _SCHEMA["locais"]
ANO_MIN: int = _SCHEMA["anoMin"]
ANO_MAX: int = _SCHEMA["anoMax"]


def _load_disease_ids() -> dict[str, str]:
    """`tabnetCode -> disease_id`, lido de `scripts/catalog/diseases.json` — NUNCA
    `slugify(label)` local (a origem do defeito de ids duplicados da Fase 8)."""
    path = repo_root() / "scripts" / "catalog" / "diseases.json"
    with path.open("r", encoding="utf-8") as fh:
        entries = json.load(fh)
    return {entry["tabnetCode"]: entry["id"] for entry in entries}


class Row(NamedTuple):
    disease_id: str
    grao: str
    local: str
    territorio_codigo: str
    ano: int
    internacoes: int
    obitos: int
    valor_total: float
    dias_permanencia: int
    taxa_mortalidade: float | None


def _taxa_mortalidade(*, obitos: int, internacoes: int) -> float | None:
    """`obitos / internacoes` quando `internacoes > 0`; `None` (NUNCA `0`) quando `internacoes
    == 0` — ausência não é zero (T-09-30, a razão de existir desta função separada)."""
    if internacoes <= 0:
        return None
    return obitos / internacoes


def _ano_de_dt_inter(valor: str | int | None) -> int | None:
    """Ano da data de INTERNAÇÃO (`DT_INTER`, string `YYYYMMDD`), ou `None` quando o valor é
    ausente/malformado — a fonte do `ano` de toda linha agregada (09-15-DT-INTER, ver docstring
    do módulo).

    **Semântica explícita e documentada, nunca um `try/except` mudo.** Devolve `None`
    (= descarte contado e taxa-guardado por `_MAX_TAXA_DESCARTE_DT_INTER`, jamais um registro
    sumindo em silêncio) para: `null`; string vazia ou só espaço (a mesma classe "registro
    corrompido do DBC" de `_blank_to_null`); comprimento diferente de 8; qualquer caractere não
    numérico (mesmo endurecimento que `codigos.municipio6` recebeu — comprimento certo com lixo
    dentro nunca pode passar); mês fora de 1-12; dia fora de 1-31; e ano fora da faixa de
    plausibilidade estrutural (`_ANO_DT_INTER_MIN_PLAUSIVEL`..`_ANO_DT_INTER_MAX_PLAUSIVEL`).

    **O que deliberadamente NÃO é descarte, e por quê:**

    - **Data inexistente no calendário** (`20250230`, 30 de fevereiro) — validado só o INTERVALO
      do dia (1-31), nunca o calendário real (`datetime.date`, que rejeitaria). A única coisa que
      esta função precisa extrair é o ANO, e o ano de `20250230` é inequivocamente 2025: recusar
      o registro por causa do dia jogaria fora uma internação REAL por um erro de digitação num
      campo que a agregação nem usa. Ausência não é zero, e um dia errado não é um ano errado.
    - **Ano válido mas fora da janela de publicação** (`ANO_MIN`..`ANO_MAX`, do `schema-v3.json`)
      — devolvido normalmente aqui; quem descarta é o laço principal, e como "fora da janela",
      NUNCA como descarte. A distinção é essencial: os arquivos de competência 2026 (a cauda que
      fecha o ano de admissão 2025, ver `enumerate.py`) são majoritariamente compostos de
      internações de 2026, que estão CORRETAMENTE fora do recorte. Contá-las como descarte faria
      a guarda de taxa estourar em toda UF por dado perfeitamente saudável — e, pior, esconderia
      o defeito real que ela existe para pegar.
    """
    if valor is None:
        return None
    texto = str(valor).strip()
    if len(texto) != 8 or not texto.isdigit():
        return None
    ano = int(texto[0:4])
    mes = int(texto[4:6])
    dia = int(texto[6:8])
    if not (1 <= mes <= 12) or not (1 <= dia <= 31):
        return None
    if not (_ANO_DT_INTER_MIN_PLAUSIVEL <= ano <= _ANO_DT_INTER_MAX_PLAUSIVEL):
        return None
    return ano


def _uf_de_uf_zi(uf_zi: str | int | None) -> str | None:
    """2 primeiros dígitos de `UF_ZI`, só se formarem uma UF conhecida (`UF_POR_CODIGO`) —
    nunca inventa uma UF a partir de lixo. Ver docstring do módulo, seção "Correção de
    município em branco", para a medição que justifica usar `UF_ZI` como fallback."""
    if uf_zi is None:
        return None
    prefixo = str(uf_zi).strip()[:2]
    return prefixo if prefixo in UF_POR_CODIGO else None


def _territorio_ocorrencia(
    munic_mov: str | int | None, uf_zi: str | int | None
) -> tuple[str | None, str | None]:
    """`(municipio6, uf)` de OCORRÊNCIA a partir de `MUNIC_MOV`, com `UF_ZI` como fallback SÓ
    para o grão UF quando `MUNIC_MOV` vem em branco/malformado — ver docstring do módulo, seção
    "Correção de município em branco". O grão MUNICÍPIO nunca é recuperável nesse caso (não há
    como inferir qual município seria o certo); o grão UF PODE ser, via `UF_ZI` (campo oficial e
    ESTÁVEL do SIH-RD para a UF do estabelecimento, medido idêntico a `MUNIC_MOV[:2]` em todo
    registro válido da amostra nacional). Se `UF_ZI` TAMBÉM vier inválido, devolve `(None,
    None)` — nunca inventa uma UF sem nenhum campo confiável."""
    mov6 = municipio6_ou_none(munic_mov)
    if mov6 is not None:
        return mov6, uf_de_municipio(mov6)
    return None, _uf_de_uf_zi(uf_zi)


def _territorio_residencia(munic_res: str | int | None) -> tuple[str | None, str | None]:
    """`(municipio6, uf)` de RESIDÊNCIA a partir de `MUNIC_RES` — SEM fallback: o SIH-RD não
    publica um campo equivalente a `UF_ZI` para a UF de residência do paciente (`UF_ZI` é
    documentadamente a UF do ESTABELECIMENTO/hospital, não do paciente) — usá-lo aqui juntaria
    endereço do hospital com residência do paciente, um erro de atribuição pior que o descarte.
    Quando `MUNIC_RES` vem em branco/malformado, os DOIS grãos (município e UF) de residência
    ficam indisponíveis para este registro — nunca um fallback inventado."""
    res6 = municipio6_ou_none(munic_res)
    if res6 is None:
        return None, None
    return res6, uf_de_municipio(res6)


def _blank_to_null(col: pa.Array | pa.ChunkedArray) -> pa.Array | pa.ChunkedArray:
    """Troca string vazia (após `utf8_trim_whitespace`) por `null` explícito — NUNCA um coerce
    cego (ver docstring do módulo, seção "Correção de valor numérico vazio"): só o caso
    EXATAMENTE vazio vira `null`; qualquer outro valor não numérico continua propagado sem
    alteração e ainda estoura em `ArrowInvalid` no `pc.cast` seguinte (RESEARCH Pitfall 1
    continua valendo — corrupção real de dado tem que falhar alto, nunca virar `null`
    silencioso). `null` pré-existente é preservado (nunca virava string vazia para começar)."""
    trimmed = pc.utf8_trim_whitespace(col)
    vazio = pc.equal(trimmed, "")
    return pc.if_else(vazio, pa.scalar(None, type=trimmed.type), trimmed)


def _cast_morte(morte_col: pa.Array | pa.ChunkedArray) -> pa.Array | pa.ChunkedArray:
    """Normaliza `MORTE` para `int64`, verificando o tipo real em vez de assumir (ver docstring
    do módulo — desvio medido do RESEARCH). Levanta `TypeError` para qualquer tipo que não seja
    string nem inteiro, para que uma mudança futura de schema do `pysus` falhe alto. `MORTE`
    vazio (após trim) vira `null` via `_blank_to_null` antes do cast — tratado como "não é óbito"
    no laço principal, nunca inferido como morte sem evidência no dado-fonte."""
    if pa.types.is_string(morte_col.type) or pa.types.is_large_string(morte_col.type):
        return pc.cast(_blank_to_null(morte_col), "int64")
    if pa.types.is_integer(morte_col.type):
        return pc.cast(morte_col, "int64")
    raise TypeError(
        f"aggregate: MORTE com tipo inesperado {morte_col.type!r} — o pysus mudou o schema "
        "desta coluna; verificar antes de prosseguir (RESEARCH Pitfall 2)."
    )


def aggregate_parquet_dir(
    path: str | Path, index: CidIndex, *, stats: dict[str, Any] | None = None
) -> list[Row]:
    """Lê `path` (diretório ou arquivo `.parquet`, real ou fixture) numa passada só e agrega
    por `(disease_id, grao, local, territorio_codigo, ano)`, onde `ano` é o ano da DATA DE
    INTERNAÇÃO (`DT_INTER`), nunca o da competência de faturamento (`ANO_CMPT`) — ver docstring
    do módulo para a medição epidemiológica que motiva isso.

    Como um ano de internação é montado a partir de mais de um ano de competência (a defasagem
    medida chega a 1 ano), `path` normalmente contém arquivos de VÁRIAS competências e registros
    do MESMO arquivo caem em anos de saída diferentes — nunca há uma correspondência
    arquivo→ano.

    `stats` (opcional, preenchido no lugar quando um dict é passado) devolve o que a agregação
    MEDIU nesta passada, sem inflar o schema de `Row` nem exigir uma segunda leitura: `total`,
    `total_ident_1`, `descartes_cid`, `descartes_dt_inter`, `fora_da_janela`, os dois descartes
    de município, e `lag` — o histograma de `ANO_CMPT - ano(DT_INTER)`, que é o que permite
    reMEDIR a defasagem a cada corrida em vez de voltar a supor que ela é curta. `collect.py`
    persiste isso por UF no `CollectLedger`.

    Cada registro válido (`IDENT='1'` E ano de internação dentro da janela D-11) é testado contra DOIS eixos de
    classificação INDEPENDENTES — `DIAG_PRINC` casado pelo matcher CID (`match_category`,
    330 agravos da Lista Morb) e `PROC_REA` casado pelo mapa de procedimento
    (`_load_procedure_disease_map`, hoje só `amputacao_mmii`, ver docstring do módulo) — e
    contribui para EXATAMENTE 4 linhas de saída POR `disease_id` casado (não por registro): um
    registro que casa só CID gera 4 linhas; só procedimento, 4 linhas; os DOIS, 8 linhas (4 para
    cada `disease_id`, nenhum eixo isenta ou substitui o outro). As 4 linhas de cada
    `disease_id` são `(uf, ocorrencia)`, `(uf, residencia)`, `(municipio, ocorrencia)`,
    `(municipio, residencia)` — `MUNIC_MOV` alimenta ocorrência, `MUNIC_RES` alimenta residência
    (D-09), e o grão UF é derivado do grão município via `uf_de_municipio`, nunca lido de uma
    coluna separada.

    Registros com `IDENT` diferente de `'1'` (achado 09-08-INVESTIGACAO, 2026-08-10: `'5'` é
    renovação de faturamento da MESMA internação de longa permanência, não uma nova admissão)
    são excluídos ANTES de qualquer um dos dois eixos — nunca contados como descarte, porque não
    é falha de categorização, é exclusão semântica deliberada da medida `internacoes`, aplicada
    igualmente aos dois eixos (mesmo `continue` único no laço).

    **Ordem dos dois primeiros filtros (`IDENT` antes do ano), mudada nesta correção e por quê.**
    Antes, o filtro de ano vinha primeiro; a ordem era indiferente para o resultado (os dois
    precisam passar de qualquer jeito) e continua sendo — o conjunto que chega à classificação é
    idêntico, e portanto `_MAX_TAXA_DESCARTE` mede exatamente o que sempre mediu. O que a ordem
    muda é o DENOMINADOR da guarda nova de `DT_INTER`: a classe "registro corrompido do DBC"
    (documentada abaixo) tem `IDENT`, `ANO_CMPT`, `DIAG_PRINC`, `MUNIC_*` **e** `DT_INTER` todos
    vazios juntos — não é uma AIH com um campo faltando, é uma linha sem dado nenhum. Filtrar
    `IDENT` primeiro faz `descartes_dt_inter` contar só AIH REAL sem data utilizável, que é o
    defeito que importa; contá-la depois transformaria toda corrupção de `.dbc` já conhecida e já
    excluída num falso positivo da guarda nova.

    Registros `IDENT='1'` cujo `DT_INTER` é ausente ou malformado (ver `_ano_de_dt_inter`) são
    contados como descarte próprio e, acima de `_MAX_TAXA_DESCARTE_DT_INTER` (0,1% da população
    `IDENT='1'`), a função levanta `ValueError` — nunca sumem em silêncio. Registros cujo
    `DT_INTER` é válido mas cai fora da janela D-11 (`ANO_MIN`..`ANO_MAX`) são contados à parte
    (`fora_da_janela`) e NÃO são descarte: os arquivos de competência 2026 (a cauda que fecha o
    ano de admissão 2025) são feitos majoritariamente de internações de 2026, corretamente fora
    do recorte.

    Registros cujo `DIAG_PRINC` não casa em nenhuma categoria CID são contados como descarte
    (SÓ o eixo CID — o eixo de procedimento nunca isenta nem contribui para este contador,
    são medidas independentes); acima de `_MAX_TAXA_DESCARTE` (0,1%) a função levanta
    `ValueError` (T-09-30).

    Registros cujo `MUNIC_MOV`/`MUNIC_RES` vêm em branco ou malformados (comprimento errado OU
    não numérico — ver `codigos.municipio6`) têm o grão MUNICÍPIO correspondente (ocorrência
    para `MUNIC_MOV`, residência para `MUNIC_RES`) ausente da saída para aquele registro —
    NUNCA uma `ValueError` que derruba a UF inteira (09-04-FIX-MUNICIPIO-BRANCO). O grão UF de
    OCORRÊNCIA ainda pode ser recuperado via `UF_ZI` quando `MUNIC_MOV` for o único campo
    inválido (ver `_territorio_ocorrencia`); o grão UF de RESIDÊNCIA não tem fallback (ver
    `_territorio_residencia`). Contado como descarte de município (independente do descarte de
    `DIAG_PRINC` acima — medidas distintas); acima de `_MAX_TAXA_DESCARTE_MUNICIPIO` (0,01%) a
    função levanta `ValueError`.
    """
    dataset = ds.dataset(str(path), format="parquet")
    # UF_ZI entra na MESMA projeção só quando a fonte a tem (checagem de schema, nunca um
    # segundo `to_table` -- preserva "numa passada só", ver `_COLUNA_UF_ZI` acima).
    tem_uf_zi = _COLUNA_UF_ZI in dataset.schema.names
    colunas = NEEDED_COLUMNS + [_COLUNA_UF_ZI] if tem_uf_zi else NEEDED_COLUMNS
    table = dataset.to_table(columns=colunas)

    # `_blank_to_null` (ver docstring do módulo) troca só string vazia por `null` -- qualquer
    # outro valor não numérico continua estourando `ArrowInvalid` aqui, igual a antes desta
    # correção.
    val_tot = pc.cast(_blank_to_null(table["VAL_TOT"]), "float64").to_pylist()
    dias_perm = pc.cast(_blank_to_null(table["DIAS_PERM"]), "int64").to_pylist()
    morte = _cast_morte(table["MORTE"]).to_pylist()
    ano_cmpt = pc.cast(_blank_to_null(table["ANO_CMPT"]), "int64").to_pylist()
    # `DT_INTER` NUNCA recebe cast eager (ao contrário das 4 colunas acima): a validação é por
    # registro, em `_ano_de_dt_inter`. Um cast vetorizado transformaria UM valor malformado num
    # `ArrowInvalid` que derruba a agregação da UF inteira -- exatamente a classe de falha que o
    # FIX-DBC-CORROMPIDO/FIX-AGREGACAO-VAZIO passaram esta fase inteira consertando. A guarda
    # aqui é de TAXA (`_MAX_TAXA_DESCARTE_DT_INTER`), não de primeiro-valor-ruim.
    dt_inter = pc.utf8_trim_whitespace(table["DT_INTER"]).to_pylist()
    ident = pc.utf8_trim_whitespace(table["IDENT"]).to_pylist()
    proc_rea = pc.utf8_trim_whitespace(table["PROC_REA"]).to_pylist()
    diag_princ = table["DIAG_PRINC"].to_pylist()
    munic_mov = table["MUNIC_MOV"].to_pylist()
    munic_res = table["MUNIC_RES"].to_pylist()
    # Sem UF_ZI na fonte (parquet sintético mínimo de outro módulo, nunca dado real do SIH-RD),
    # o fallback de `_territorio_ocorrencia` simplesmente nunca resgata nada -- comportamento
    # correto e já coberto pelo gate de taxa de descarte (nunca um `None` tratado como válido).
    uf_zi = table[_COLUNA_UF_ZI].to_pylist() if tem_uf_zi else [None] * len(diag_princ)

    disease_ids = _load_disease_ids()
    procedure_map = _load_procedure_disease_map()

    acumulador: dict[tuple[str, str, str, str, int], dict[str, float | int]] = {}
    total = len(diag_princ)
    descartes = 0
    descartes_municipio_ocorrencia = 0
    descartes_municipio_residencia = 0
    total_ident_1 = 0
    descartes_dt_inter = 0
    fora_da_janela = 0
    lag_competencia: dict[int, int] = {}

    for i in range(total):
        # IDENT primeiro, ano depois -- ver docstring desta função, "Ordem dos dois primeiros
        # filtros". O conjunto que chega à classificação é idêntico ao de antes desta correção;
        # o que a ordem protege é o denominador da guarda de DT_INTER.
        if ident[i] != _IDENT_AIH_NORMAL:
            continue
        total_ident_1 += 1

        ano = _ano_de_dt_inter(dt_inter[i])
        if ano is None:
            # AIH real (IDENT='1') sem data de internação utilizável -- a internação existiu mas
            # o pipeline não consegue localizá-la no tempo. Contada e taxa-guardada abaixo,
            # NUNCA descartada em silêncio (T-09-30).
            descartes_dt_inter += 1
            continue

        # Defasagem de faturamento MEDIDA nesta passada (competência - internação), não suposta.
        # Calculada ANTES do filtro de janela de propósito: é justamente a massa de fora da
        # janela (internações de 2012 nos arquivos de 2013, de 2026 nos de 2026) que revela se a
        # cauda de competência escolhida em `enumerate.py` continua sendo suficiente.
        cmpt = ano_cmpt[i]
        if cmpt is not None:
            lag = cmpt - ano
            lag_competencia[lag] = lag_competencia.get(lag, 0) + 1

        if not (ANO_MIN <= ano <= ANO_MAX):
            # Internação real, fora do recorte de publicação (D-11). NÃO é descarte -- ver
            # `_ano_de_dt_inter` para por que confundir os dois quebraria a guarda de taxa.
            fora_da_janela += 1
            continue

        disease_ids_casados: list[str] = []

        tabnet_code = match_category(diag_princ[i], index)
        if tabnet_code is None:
            descartes += 1
        else:
            disease_id = disease_ids.get(tabnet_code)
            if disease_id is None:
                raise KeyError(
                    f"aggregate: tabnetCode {tabnet_code!r} (devolvido pelo matcher) sem "
                    "disease_id correspondente em scripts/catalog/diseases.json — taxonomia "
                    "dessincronizada do mapa CID."
                )
            disease_ids_casados.append(disease_id)

        procedure_disease_id = procedure_map.get(proc_rea[i])
        if procedure_disease_id is not None:
            disease_ids_casados.append(procedure_disease_id)

        if not disease_ids_casados:
            continue

        mov6, mov_uf = _territorio_ocorrencia(munic_mov[i], uf_zi[i])
        res6, res_uf = _territorio_residencia(munic_res[i])
        if mov6 is None:
            descartes_municipio_ocorrencia += 1
        if res6 is None:
            descartes_municipio_residencia += 1

        # `VAL_TOT`/`DIAS_PERM`/`MORTE` vazios (após `_blank_to_null`/`_cast_morte`) chegam como
        # `None` aqui -- AIH real (`IDENT='1'`, `ANO_CMPT` na janela), só o campo de
        # faturamento/óbito não foi preenchido nesta competência (achado desta correção, ver
        # docstring do módulo). AUSÊNCIA NÃO É ZERO, mas `valor_total`/`dias_permanencia` são
        # SOMAS correntes sem representação de "parcialmente desconhecido": a internação sempre
        # CONTA (`internacoes` não muda), e a contribuição desconhecida vira 0 na soma -- o
        # agregado SUBESTIMA o total real nesses poucos registros, nunca o contrário. `MORTE`
        # vazio NUNCA é tratado como óbito -- inventar uma morte sem nenhuma evidência no
        # dado-fonte inflaria `taxa_mortalidade` sem base real, o erro mais grave possível para
        # uma medida pública de saúde.
        val = val_tot[i]
        dias = dias_perm[i]
        obito = morte[i]
        val_contribuicao = val if val is not None else 0.0
        dias_contribuicao = dias if dias is not None else 0
        obito_contribuicao = obito if obito is not None else 0

        for disease_id in disease_ids_casados:
            for grao, local, territorio in (
                (GRAO_UF, LOCAL_OCORRENCIA, mov_uf),
                (GRAO_UF, LOCAL_RESIDENCIA, res_uf),
                (GRAO_MUNICIPIO, LOCAL_OCORRENCIA, mov6),
                (GRAO_MUNICIPIO, LOCAL_RESIDENCIA, res6),
            ):
                # `territorio` é `None` quando nem o campo original nem o fallback (só existe
                # para UF de ocorrência, via UF_ZI) conseguiram localizar o registro nesse
                # grão/local -- ver `_territorio_ocorrencia`/`_territorio_residencia`. Nunca
                # inventa um território: a linha correspondente simplesmente não é gerada para
                # este registro (descarte já contado acima).
                if territorio is None:
                    continue
                chave = (disease_id, grao, local, territorio, ano)
                entrada = acumulador.setdefault(
                    chave,
                    {"internacoes": 0, "obitos": 0, "valor_total": 0.0, "dias_permanencia": 0},
                )
                entrada["internacoes"] += 1
                entrada["obitos"] += obito_contribuicao
                entrada["valor_total"] += val_contribuicao
                entrada["dias_permanencia"] += dias_contribuicao

    if stats is not None:
        stats.update(
            {
                "total": total,
                "total_ident_1": total_ident_1,
                "descartes_cid": descartes,
                "descartes_dt_inter": descartes_dt_inter,
                "fora_da_janela": fora_da_janela,
                "descartes_municipio_ocorrencia": descartes_municipio_ocorrencia,
                "descartes_municipio_residencia": descartes_municipio_residencia,
                # chaves como string para sobreviver a um round-trip por JSON (`collect.py`
                # persiste isto no CollectLedger) sem virar `{"0": ...}` só às vezes.
                "lag": {str(k): v for k, v in sorted(lag_competencia.items())},
            }
        )

    # Guarda de DT_INTER: denominador é a população IDENT='1', não o total do arquivo -- ver
    # `_MAX_TAXA_DESCARTE_DT_INTER` para a medição (baseline zero em 1,54 milhão de registros
    # reais) e para por que o denominador tem que ser este.
    if total_ident_1 > 0:
        taxa_descarte_dt_inter = descartes_dt_inter / total_ident_1
        if taxa_descarte_dt_inter > _MAX_TAXA_DESCARTE_DT_INTER:
            raise ValueError(
                f"aggregate: taxa de descarte (DT_INTER ausente ou malformado em AIH IDENT='1') "
                f"{descartes_dt_inter}/{total_ident_1} ({taxa_descarte_dt_inter:.4%}) acima do "
                f"limite {_MAX_TAXA_DESCARTE_DT_INTER:.1%} -- 09-15-DT-INTER. Sem data de "
                "internação utilizável não existe ano de internação, e inventar um (cair de "
                "volta em ANO_CMPT) reintroduziria exatamente o viés de competência que esta "
                "agregação existe para eliminar."
            )

    if total > 0:
        taxa_descarte = descartes / total
        if taxa_descarte > _MAX_TAXA_DESCARTE:
            raise ValueError(
                f"aggregate: taxa de descarte (DIAG_PRINC sem categoria) {descartes}/{total} "
                f"({taxa_descarte:.4%}) acima do limite {_MAX_TAXA_DESCARTE:.1%} (T-09-30)"
            )

        descartes_municipio = descartes_municipio_ocorrencia + descartes_municipio_residencia
        taxa_descarte_municipio = descartes_municipio / total
        if taxa_descarte_municipio > _MAX_TAXA_DESCARTE_MUNICIPIO:
            raise ValueError(
                f"aggregate: taxa de descarte (MUNIC_MOV/MUNIC_RES em branco ou malformado) "
                f"{descartes_municipio}/{total} ({taxa_descarte_municipio:.6%}) acima do limite "
                f"{_MAX_TAXA_DESCARTE_MUNICIPIO:.4%} (ocorrência={descartes_municipio_ocorrencia}, "
                f"residência={descartes_municipio_residencia}) — 09-04-FIX-MUNICIPIO-BRANCO"
            )

    linhas: list[Row] = []
    for (disease_id, grao, local, territorio, ano), valores in acumulador.items():
        internacoes = int(valores["internacoes"])
        obitos = int(valores["obitos"])
        linhas.append(
            Row(
                disease_id=disease_id,
                grao=grao,
                local=local,
                territorio_codigo=territorio,
                ano=ano,
                internacoes=internacoes,
                obitos=obitos,
                valor_total=float(valores["valor_total"]),
                dias_permanencia=int(valores["dias_permanencia"]),
                taxa_mortalidade=_taxa_mortalidade(obitos=obitos, internacoes=internacoes),
            )
        )

    return linhas


def aggregate_years(
    parquet_root: str | Path,
    index: CidIndex,
    *,
    anos: list[int] | None = None,
    stats: dict[str, Any] | None = None,
) -> list[Row]:
    """Agrega `parquet_root` (o cache de parquet inteiro, ou um subconjunto) e filtra por
    `anos` (anos de INTERNAÇÃO) quando informado — wrapper fino sobre `aggregate_parquet_dir`,
    sem segunda leitura da tabela (o filtro roda sobre as `Row` já computadas, D-01: agregação é
    de graça). `stats` é repassado sem alteração (ver `aggregate_parquet_dir`)."""
    linhas = aggregate_parquet_dir(parquet_root, index, stats=stats)
    if anos is None:
        return linhas
    anos_set = set(anos)
    return [linha for linha in linhas if linha.ano in anos_set]


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="sih_pipeline.aggregate")
    parser.add_argument("--ano", type=int, default=None, help="filtra por um único ano")
    parser.add_argument("--uf", type=str, default=None, help="filtra por sigla de UF")
    parser.add_argument(
        "--dry-run", action="store_true", help="agrega e reporta, sem escrever nada em disco"
    )
    args = parser.parse_args(argv)

    cid_map = apply_corrections(load_cid_map(), load_corrections())
    index = build_index(cid_map)

    parquet_root = cache_path("parquet")
    if not parquet_root.exists() or not any(parquet_root.iterdir()):
        print("aggregate: nenhum parquet em cache_path('parquet') — nada a agregar")
        return 0

    anos = [args.ano] if args.ano is not None else None
    linhas = aggregate_years(parquet_root, index, anos=anos)

    if args.uf:
        linhas = [
            linha
            for linha in linhas
            if (linha.grao == GRAO_UF and linha.territorio_codigo == args.uf)
            or (linha.grao == GRAO_MUNICIPIO and uf_de_municipio(linha.territorio_codigo) == args.uf)
        ]

    print(f"aggregate: {len(linhas)} linha(s) agregada(s)")

    if args.dry_run:
        print("aggregate: --dry-run, nada escrito")
        return 0

    # Escrita persistente dos agregados (T-09-08: sempre via cache_path, nunca fora do cache)
    # fica a cargo dos consumidores dedicados (partitions.py/09-09, upload.py/09-10) — esta
    # plan entrega a função de agregação, não o pipeline de escrita completo.
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
