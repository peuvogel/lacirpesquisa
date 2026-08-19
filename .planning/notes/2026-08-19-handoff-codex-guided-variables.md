# Handoff para as sessões `codex/guided-variables-*`

**Para:** quem estiver tocando `codex/guided-variables-flow` e `codex/guided-variables-technical`
**De:** a sessão que fechou a Fase 9 (09-14, 09-17, 09-18) em 2026-08-18/19
**Por quê:** vocês partiram de `cffdac9` (2026-08-13) e estão **35 commits atrás**. Três coisas
grandes mudaram debaixo de vocês, e uma delas quebra código que está no seu branch.

---

## TL;DR

1. **Produção conta por `DT_INTER` agora**, não por `ANO_CMPT`. Os números mudaram — 84,7% deles.
2. **`sih_metric_muni` foi DROPADA.** O grão município só existe no Storage. Isso torna o
   `loadMunicipioPartition.ts` de vocês *o único caminho*, e quebra `fetchHandoffMetrics.ts`.
3. **Os packs têm valores novos** e um campo novo, `divergenciaRazao`, que já está renderizado no
   mapa — e é o pedaço que provavelmente vai conflitar com vocês.

Nada aqui pede que vocês desfaçam trabalho. Dois itens ficaram deliberadamente **sem conserto**
porque são de vocês; estão na seção "O que sobrou para vocês".

---

## 1. Os números mudaram (09-17)

A base de contagem trocou de competência de faturamento (`ANO_CMPT`) para data de internação
(`DT_INTER`). `sih_metric_uf` foi de 207.664 para 207.965 linhas — mas a contagem de linhas
engana: **84,7% das 207.024 chaves comuns mudaram de VALOR**.

| Medida | Antes | Depois |
|---|---|---|
| internações (nacional) | 308.872.790 | **314.597.534** (+1,85%) |
| óbitos | 14.221.282 | 14.440.086 (+1,54%) |

**Se vocês têm valor cravado em teste, ele quebrou.** Exemplo real que já corrigimos:
`embolia_e_trombose_arteriais` SP/2019 foi de **5709 para 5660**.

> ⚠️ **Armadilha registrada:** 5660 é *exatamente* o literal TabNet-era que dois testes travavam
> ANTES da Fase 9 (commit `a4356f2`), trocado para 5709 em `03ef66a` justamente para excluí-lo.
> Por `DT_INTER` o número voltou por coincidência. Se vocês virem um teste esperando 5660, ele
> pode estar certo pelo motivo errado. O literal sozinho **não distingue mais** pack de corpus
> legado — quem distingue é o `toBe(expected)` que lê o pack e o `not.toBe(898000)`.

## 2. `sih_metric_muni` não existe mais (09-14)

Dropada em 2026-08-19 pela migração `20260806000000_sih_retire_muni`. O banco caiu de 430 MB para
**112 MB**. O grão município agora vive só no Storage: 27 objetos `v1/{UF}.json.gz`, bucket
público `sih-municipio`, **12.404.039 linhas**, todas por `DT_INTER`.

Isso **promove o trabalho de vocês**: `loadMunicipioPartition.ts` deixou de ser uma alternativa e
virou o único caminho.

> Detalhe do formato que custou tempo aqui: `dados` é lista de **colunas**, não de linhas.
> `len(dados)` devolve 9 (o número de colunas); as linhas são `len(dados[0])`. Contei errado na
> primeira tentativa. Está documentado em `docs/SUPABASE-CATALOG.md`.

## 3. A razão de divergência (09-18)

Fechamos a metade que faltava do critério do operador — *"quando o aluno puxar TabNet e site lado
a lado, ou batem, ou a diferença está justificada"*. A paridade já estava provada (134/134 exatos
contra um TabNet bem-formado); **a justificativa não estava em lugar nenhum**.

A frase agora percorre uma cadeia com **fonte única**:

```
paridade.py::RAZAO_DIVERGENCIA_JANELA_CURTA
   → upload.py  (grava em sih_collection_status.divergencia_razao)
   → generateSihPacks.mjs  (lê do banco, emite no pack)
   → pack JSON: campo `divergenciaRazao`
   → getDivergenciaRazao()  →  <SihDivergenceNote />
```

**Não digitem essa frase em TypeScript.** Ela existe em um lugar só, de propósito: copiá-la para
o front cria duas fontes que derivam em silêncio. Se precisarem mudar o texto, mudem em
`paridade.py`, rodem `npm run pipeline:upload -- --proveniencia` e `npm run catalog:sih-packs`.

Em produção: 67.136 linhas com razão; 32 nulas (proveniência velha sem dado — corretas assim).

---

## O conflito que vocês vão encontrar

Wirei em `src/routes/mapas/MapasPage.tsx`, que **vocês dois também modificam**. Deixei o diff no
mínimo possível — dois imports e um elemento. Se der conflito, **descartem o meu lado e
reapliquem isto**:

```diff
 import { MapLegendHint } from './MapLegendHint';
+import { SihDivergenceNote } from '@/components/SihDivergenceNote';

 import {
   getCatalogLabel,
+  getDivergenciaRazao,
   getMetricByUf,
```

```diff
           />
+          <SihDivergenceNote
+            razao={activeVariableId ? getDivergenciaRazao(activeVariableId) : null}
+          />
           {!hasInteracted ? <MapLegendHint /> : null}
```

Vai logo depois de `<ChoroplethLegend />`, porque a explicação precisa estar do lado do número.

**Os arquivos com a lógica não conflitam** — conferi contra o merge-base de vocês:

| Arquivo | Estado |
|---|---|
| `src/components/SihDivergenceNote.tsx` + `.test.tsx` | **novos**, ninguém toca |
| `src/features/catalog/catalogAnalysisData.ts` | livre nos dois worktrees |
| `src/features/catalog/types.ts` | livre nos dois worktrees |
| `scripts/catalog/generateSihPacks.mjs` | livre nos dois worktrees |
| `src/routes/mapas/MapasPage.tsx` | ⚠️ **vocês dois modificam** |

---

## O que sobrou para vocês

### A. `fetchHandoffMetrics.ts` está quebrado — e é território de vocês

`src/features/catalog/fetchHandoffMetrics.ts:143` ainda faz
`supabase.from('sih_metric_muni')`. Com a tabela dropada o PostgREST devolve **404**, o código faz
`console.warn` + `continue`, e o lookup devolve **`null` para toda métrica de município**.

Degrada sem quebrar — mas é **truncamento silencioso**, exatamente o que a Fase 10 do ROADMAP
proíbe e o que o D-14 existe para tornar distinguível. **Nenhum teste cobre esse ramo**, por isso
o gate ficou verde o tempo todo.

O conserto é usar `loadMunicipioPartition.ts` — que é justamente o arquivo que vocês estão
mexendo. Por isso não toquei: eu criaria conflito no exato ponto em que vocês trabalham.

> Atenuante honesto: **antes** da DROP esse ramo servia o corpus TabNet **legado** enquanto o mapa
> já servia `DT_INTER` pelo Storage — handoff e mapa discordavam em silêncio. A DROP trocou
> "número errado calado" por "nenhum número calado". Menos pior, ainda errado.

### B. A razão só aparece no mapa

Wirei em uma superfície. Ela provavelmente também cabe em:

- `ReviewAnalysisDialog.tsx` / `ReviewAnalysisDataDialog.tsx` — onde o aluno confere os números
  antes de rodar o teste. É indiscutivelmente o lugar de maior valor, e é de vocês.
- `GuidedResultsSection.tsx` — junto do resultado.
- `VariableDetailPanel.tsx` — na ficha da variável.

O componente já aceita `razao?: string | null` e renderiza `null` quando não há — é só passar
`getDivergenciaRazao(variableId)`.

---

## Como conferir que vocês estão no mundo novo

```sh
export PATH="$(brew --prefix libpq)/bin:$PATH"
set -a; . ./.env.pipeline; set +a

# sih_metric_muni tem de NAO existir; sih_metric_uf tem de dar 207965
psql "$SIH_PIPELINE_DB_URL" -c "select to_regclass('public.sih_metric_muni'), (select count(*) from sih_metric_uf);"

# a razao tem de estar no pack
python3 -c "import json;print(json.load(open('public/data/catalog/packs/sih.infarto_cerebral_uf.json'))['divergenciaRazao'])"

npm run gate   # 844 testes, verde em 2026-08-19
```

Leitura de fundo, se der tempo: `docs/SUPABASE-CATALOG.md` foi reescrito do zero para o schema v3
real (capturado ao vivo, não de memória) e explica onde cada grão mora, a regra D-14 de zero
verdadeiro vs ausente, e o formato colunar das partições.
