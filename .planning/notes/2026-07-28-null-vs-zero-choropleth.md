# Null, zero e "sem dado" são o mesmo pixel hoje

**Apurado em** 2026-07-28 por leitura direta de `src/routes/mapas/BrazilMapCanvas.tsx` e `src/geo/choroplethScale.ts`.
**Consome isto:** Fase 10 (mapas dinâmicos) e Fase 12 (varredura). Levantado pela pesquisa de FEATURES e confirmado à mão.

## O defeito

`SURFACE_FILL` em `BrazilMapCanvas.tsx:80` é `'#18181b'`. `TEAL_STEPS[0]` em `choroplethScale.ts:4` é `'#18181b'`. São o mesmo hex. Uma UF **sem dado nenhum** e uma UF **no balde mais baixo da escala** pintam idêntico.

Não é só colisão de cor — a conflação acontece em três camadas independentes:

**1. O guard deixa `null` passar.** Em `BrazilMapCanvas.tsx:525`:

```ts
} else if (scale && metric !== undefined) {
  fill = scale(metric);
}
```

`metric !== undefined` é verdadeiro para `null`. Então `scale(null)` é chamado, d3 normaliza `null` para 0, `t = 0`, e o resultado é `TEAL_STEPS[0]` — o mesmo `#18181b` do "sem dado". Só `undefined` cai no ramo de ausência.

**2. `null` vira 0 no domínio.** Em `createChoroplethScale`:

```ts
const min = Math.min(...values);
```

`Math.min` coage `null` para `0`. Um único município sem dado puxa o piso do domínio para zero e **distorce todos os cinco baldes** — os valores reais ficam comprimidos no topo da escala.

**3. A legenda herda a distorção.** `legendBreaks` recalcula `Math.min(...values)` do mesmo jeito, então o rótulo "Baixo" passa a descrever um mínimo que não existe no dado.

## Por que isso é grave aqui

`obitos` é null em ~98% das linhas do catálogo (só 5 dos 330 agravos têm Óbitos coletado — ver `2026-07-28-taxonomia-corrompida-ground-truth.md`). O caminho com `null` não é uma borda rara: é o caso comum. E `taxa_mortalidade` deriva de `obitos`, então herda tudo.

Epidemiologicamente, "nenhum caso notificado" e "nenhum dado coletado" são afirmações diferentes sobre o mundo. Um município sem vigilância implantada e um município sem óbitos aparecem hoje como a mesma coisa para o estudante — e, pior, o `null` coagido a 0 entra na tabela montada e vai para o teste estatístico, onde enviesa silenciosamente toda média, taxa e coeficiente de regressão a jusante.

## O que precisa mudar

- Distinguir `undefined` (não buscado), `null` (buscado, sem dado) e `0` (zero verdadeiro) em todo o caminho de dados — não colapsar os três em "falsy".
- `SURFACE_FILL` precisa ser visualmente distinto de qualquer degrau da escala. A convenção cartográfica usual é hachura/textura ou um cinza fora da rampa de cor, com entrada própria na legenda ("sem dado").
- `createChoroplethScale` e `legendBreaks` precisam filtrar não-numéricos antes de calcular min/max, em vez de deixar `Math.min` coagir.
- A tabela montada em `assembleHandoffTable.ts` precisa preservar o `null` até o teste, e o módulo estatístico precisa decidir explicitamente o que fazer com ele (excluir o caso, ou falhar alto) — nunca imputar 0 em silêncio.

## Teste de regressão

Afirmar que `SURFACE_FILL` não é igual a nenhum valor de `TEAL_STEPS`, e que `createChoroplethScale([null, 5, 10])` produz o mesmo domínio de `createChoroplethScale([5, 10])`. Ambos falham hoje.
