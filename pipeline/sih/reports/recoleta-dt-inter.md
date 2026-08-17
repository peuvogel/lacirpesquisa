# Recoleta nacional por `DT_INTER` — estado medido

*Atualizado: 2026-08-17. Fonte: `~/.lacir/sih-cache/agregados/collect_state.json` (o ledger da
corrida real), não projeção.*

## Situação em uma linha

**A recoleta está PARADA em 15 das 27 UFs, e o que a parou é disco, não código.** A guarda de
disco recusou a próxima UF exatamente como foi desenhada para fazer. Nada foi contornado, nenhum
arquivo do operador foi apagado, e a guarda **não** foi afrouxada.

## Andamento

Ordem `UF_ORDER` (menor → maior volume): DF · RR · AP · SE · AC · AL · TO · RO · RN · PB · PI ·
AM · ES · **MS** · MT · PE · | RJ · CE · PA · GO · MA · SC · PR · RS · BA · MG · SP

| Situação | UFs | n |
|---|---|---|
| `agregado_reciclado` (concluídas) | DF, RR, AP, SE, AC, AL, TO, RO, RN, PB, PI, AM, ES, MT, PE | **15** |
| `falhou` (retomável) | MS | 1 |
| `nunca_iniciado` (bloqueadas por disco) | RJ, CE, PA, GO, MA, SC, PR, RS, BA, MG, SP | 11 |

**Cobertura honesta:** 2.415 de 4.347 arquivos (55,6%) — mas apenas **18,9% do volume nacional**
(soma de `RAZAO_LINHAS_VS_AC` das concluídas ÷ total). As 11 que faltam incluem SP, MG, BA e RS,
que sozinhas são mais da metade do país. **Nenhuma conclusão nacional pode ser tirada deste
recorte**, e nada neste relatório afirma uma.

### MS — a única falha que não é disco

```
collect: MS ainda tem 71 arquivo(s) pendente(s) após download_all --
ex.: ['RDMS1809', 'RDMS1810', 'RDMS1811', 'RDMS1812', 'RDMS1901']
(PIPE-06 isolou a falha por arquivo; esta UF fica 'falhou' e será retomada na próxima corrida.)
```

90 dos 161 arquivos de MS estão baixados e **preservados** em `~/.lacir/sih-cache/parquet/`
(71 MB). A retomada por UF os reaproveita; não foram apagados.

## O que a corrida mediu (15 UFs, dado real)

| Medida | Valor |
|---|---|
| Arquivos baixados e agregados | 2.415 |
| Linhas agregadas persistidas | 3.340.594 |
| AIH `IDENT='1'` processadas | **35.455.908** |
| **Descartes de `DT_INTER`** | **0** |
| Descartes de CID | 2.881 |
| Descartes de município (ocorrência + residência) | 0 |
| Internações fora da janela D-11 (2026, dos arquivos de cauda) | 1.290.482 |

**Zero descarte de `DT_INTER` em 35,4 milhões de AIH reais.** A guarda
`_MAX_TAXA_DESCARTE_DT_INTER` (0,1%) nunca chegou perto de disparar — o baseline que ela supunha
se confirmou na corrida, não só nas amostras do 09-15.

## Defasagem de faturamento — a medição que sustenta tudo

`ANO_CMPT - ano(DT_INTER)`, sobre as mesmas 35.455.908 AIH:

| Defasagem | Registros | % |
|---|---|---|
| 0 anos (faturada no ano da internação) | 33.187.451 | 93,6020% |
| **1 ano** (faturada no ano seguinte) | **2.268.456** | **6,3980%** |
| **2 anos** | **1** | 0,0000028% |

Duas leituras, e a segunda corrige o 09-15:

1. **~6,4% das internações são faturadas no ano seguinte.** É exatamente essa massa que a consulta
   padrão do TabNet (12 arquivos de um ano) não enxerga — ver `paridade-AC-2019-sc7.md`. Não é
   ruído: é a ordem de grandeza da diferença que um aluno vai ver na tela.

2. **A defasagem passou de 1 ano — uma vez.** O `09-15-DT-INTER-SUMMARY.md` afirma, com base em
   ~2,2 milhões de registros amostrados, que *"a defasagem **nunca passou de 1 ano**"*. Com 16×
   mais dado, isso é **falso**: existe **1 registro em RO com defasagem 2**. A afirmação correta
   é *"≤ 1 ano em 35.455.907 de 35.455.908 (99,999997%)"*.

   O efeito prático é conhecido e minúsculo, mas precisa ser dito em vez de arredondado: a
   consulta bem-formada com `janela=1` (24 competências) deixa de fora esse único registro. Uma
   `janela=2` o pegaria, ao custo de 12 requisições a mais por par. **A escolha de `janela=1` é
   deliberada e agora tem numerador e denominador**, em vez de se apoiar numa absoluta que o dado
   não sustenta.

## O bloqueio: disco

Livre em `/System/Volumes/Data` no momento desta medição: **372 MB** (o volume APFS está a 99,8%).

A projeção da guarda (`BYTES_PER_RATIO_UNIT_SEED` = 68,8 MB por unidade de razão, + margem de
500 MB) para as UFs que faltam:

| UF | projeção | + margem | cabe em 372 MB? |
|---|---|---|---|
| MS | 304 MB | 804 MB | não |
| RJ | 517 MB | 1.017 MB | não |
| CE | 573 MB | 1.073 MB | não |
| PA | 592 MB | 1.092 MB | não |
| GO | 628 MB | 1.128 MB | não |
| MA | 647 MB | 1.147 MB | não |
| SC | 712 MB | 1.212 MB | não |
| PR | 920 MB | 1.420 MB | não |
| RS | 1.122 MB | 1.622 MB | não |
| BA | 1.179 MB | 1.679 MB | não |
| MG | 1.833 MB | 2.333 MB | não |
| **SP** | 2.008 MB | **2.508 MB** | não |

**É preciso liberar ~2,1 GB para a corrida fechar** (o pico é SP; como o bruto é reciclado a cada
UF, o requisito é o pico por UF, não a soma).

### Por que o pico por UF não pode ser reduzido por engenharia

A tentação óbvia é agregar a UF em pedaços (por ano de competência) e reciclar o bruto entre eles,
derrubando o pico por ~13×. **Isso quebraria a correção que esta fase inteira fez.** Está escrito
no próprio `collect.py::_aggregate_uf`:

> A visão isolada precisa conter TODAS as competências da UF, não uma por vez. Com o `ano` vindo
> de `DT_INTER`, um ano de internação é montado a partir de mais de um ano de competência: a cauda
> de dezembro/2019 vive nos arquivos de 2020. Agregar competência a competência somaria cada ano
> em pedaços e nunca fecharia.

O pico de ~2,5 GB é, portanto, **irredutível** enquanto a agregação for por data de internação.

### O que liberaria o espaço (decisão do OPERADOR, não executada aqui)

Nada abaixo foi apagado. São caches regeneráveis de aplicativos do operador — fora do escopo de
arquivo deste trabalho, e apagar dado de terceiros para destravar a própria corrida não é uma
decisão que um agente toma sozinho:

| Caminho | Tamanho | Natureza |
|---|---|---|
| `~/.cache/codex-runtimes` | 1,5 GB | runtimes baixados sob demanda, regeneráveis |
| `~/Library/Caches/com.todesktop.230313mzl4w4u92.ShipIt` | 1,2 GB | cache de auto-update, regenerável |
| `~/Library/Caches/net.whatsapp.WhatsApp` | 885 MB | cache de app |
| `~/Library/Caches/Codex` | 427 MB | cache de app |
| `~/.cache/uv` | 257 MB | cache de pacotes Python (o `.venv` já está construído) |

Os dois primeiros juntos (2,7 GB) destravam a corrida inteira, incluindo SP.

**Artefatos do próprio pipeline que NÃO devem ser apagados para abrir espaço**, e por quê:

- `~/.lacir/sih-cache/agregados-pre-dt-inter/` (159 MB) — os 27 agregados da era `ANO_CMPT`. É a
  única cópia local do que está em produção hoje; é o ponto de retorno se o upload novo der errado.
- `~/.lacir/sih-cache/populacao/` (358 MB) — insumo de `partitions.py`/`upload.py`; apagá-lo troca
  disco por horas de re-download no passo seguinte.
- `~/.lacir/sih-cache/parquet/RDMS*` (71 MB) — os 90 arquivos já baixados de MS; apagá-los só
  faz a retomada re-baixar o que já está aqui.

## Como retomar

```bash
# depois de liberar ~2,1 GB
npm run pipeline:collect
```

A retomada é por UF e **não re-baixa nada já concluído**: as 15 `agregado_reciclado` são puladas
de saída, MS reaproveita seus 90 arquivos, e a corrida segue de RJ até SP.
