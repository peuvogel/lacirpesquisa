# Pares descartados como oráculo (D-04)

Todo par (agravo × UF × ano) cujo valor re-raspado ao vivo do TabNet hoje não reproduz o valor guardado em `trabalhos datasus/outputs/coleta_sih_multi/` é descartado como oráculo — nunca depurado para bater. Gerado por script descartável (fora do repositório) em 2026-08-05T20:27:14Z, com uma repetição pontual em 2026-08-10T01:01Z (ver abaixo).

Tentados: 98 · Reproduzidos: 98 · Descartados: 0

**Nenhum par descartado.** Os 98 pares candidatos de AC/2019 reproduziram o valor guardado.

## Nota sobre a repetição de dois pares

A primeira passagem registrou 96 reproduzidos e 2 descartados. Os dois descartes **não eram divergências de valor** — eram `timed out` na requisição ao TabNet:

| Agravo | tabnetCode | Valor guardado | 1ª passagem | Repetição |
|---|---|---|---|---|
| `aborto_por_razoes_medicas` | 259 | 3 | `timed out` | 3 — reproduz |
| `outras_doencas_do_olho_e_anexos` | 163 | 35 | `timed out` | 35 — reproduz |

Os dois foram re-raspados uma única vez e reproduziram exatamente. A repetição foi feita porque um timeout de rede não é evidência sobre se o par reproduz: descartar por falha de transporte confundiria "dado não confiável" (o que o D-04 existe para detectar) com "rede não confiável" (ruído de execução). Se a repetição tivesse divergido, o par teria sido descartado pela razão correta — divergência de valor, não falha de requisição.

Nenhum valor foi ajustado, em nenhum momento, para fazer um par bater.

## Por que 98 e não 85

O `.planning/notes/2026-08-04-pysus-microdado-spike.md` §5 fala em "85 agravos comparáveis". Aquele número é o dos pares que o spike conseguiu comparar **contra a agregação do microdado**. Este oráculo é outra coisa: é o conjunto de pares do corpus legado cujo valor de `internacoes` em AC/2019 não está vazio e cujo `tabnetCode` resolve para um id canônico da taxonomia da Fase 8 — 98 deles.

Os dois conjuntos servem a propósitos distintos e não precisam coincidir: o oráculo aqui é o **lado TabNet** da comparação do SC-7, e é construído antes de existir qualquer agregação de microdado com que compará-lo.

## Como o mapeamento de id foi feito

Os diretórios de `coleta_sih_multi/` usam os ids **pré-migração** da Fase 8. Gravar um deles nesta fixture reintroduziria a corrupção de taxonomia que a Fase 8 acabou de matar (T-09-21). Por isso o mapeamento não é por nome de diretório: cada diretório tem seu `tabnetCode` lido de `metadata.json`, e é o `tabnetCode` que resolve para o id canônico em `scripts/catalog/diseases.json`. Um `tabnetCode` sem correspondência canônica seria descarte com razão escrita — não houve nenhum.
