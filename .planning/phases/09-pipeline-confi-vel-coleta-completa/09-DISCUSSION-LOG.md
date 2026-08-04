# Phase 9: Pipeline confiável + coleta completa - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-04
**Phase:** 9-pipeline-confi-vel-coleta-completa
**Areas discussed:** Gate da reconciliação +3,5%; Recorte do dado coletado; Forma do ledger + proveniência; Aposentadoria do caminho TabNet; Orçamento gratuito do Supabase (emergente)

---

## Gate da reconciliação (+3,5%)

### Sequência download → agregação → upload

| Opção | Descrição | Selecionada |
|---|---|---|
| Baixar já, subir só depois de fechar | Download é idempotente e independente do matcher; a reconciliação itera sobre o parquet local; o Supabase só recebe depois do SC-7 fechar | ✓ |
| Subir progressivamente conforme cada faixa fecha | App ganha agravos aos poucos; dois universos convivendo no banco durante a transição | |
| Subir tudo já, corrigir depois | Delta registrado como metadado; o número exibido mudaria depois sem o estudante saber | |

**Escolha:** Baixar já, subir só depois de fechar.
**Notas:** O reenquadramento (download ≠ upload) foi apresentado antes da pergunta e mudou o que "esperar a reconciliação" significa.

### Barra do SC-7

| Opção | Descrição | Selecionada |
|---|---|---|
| Exato ou razão escrita, sem banda | Cada um dos 85 pares bate exato ou tem razão escrita e faixa CID corrigida | ✓ |
| Banda de ±1% + razão só fora da banda | Passa quem cai na banda (hoje 31 de 85); aceita resíduo não explicado | |
| Exato nos 85, sem exceção | Delta zero em todos; inatingível se houver diferença metodológica legítima | |

**Escolha:** Exato ou razão escrita, sem banda.

### Amostra da reconciliação

| Opção | Descrição | Selecionada |
|---|---|---|
| AC/2019 para depurar + 1 UF grande para confirmar | Iteração rápida no AC, confirmação em SP ou MG sem redepurar | ✓ |
| Só AC/2019 | Mínimo literal do SC-7; categoria vazia no Acre passa verde por vacuidade | |
| Estratificada 3 UFs × 3 anos | Cobertura regional e temporal; limitada pelos CSVs velhos que sobreviveram | |

**Escolha:** AC/2019 para depurar + 1 UF grande para confirmar.

### Visibilidade da divergência residual

| Opção | Descrição | Selecionada |
|---|---|---|
| Visível na proveniência da métrica | A divergência viaja com o dado; o estudante consegue defender o número | ✓ |
| Só no repositório | Documento versionado; o app serve sem menção | |
| Visível só acima de um limiar | Reintroduziria uma banda pela porta dos fundos | |

**Escolha:** Visível na proveniência da métrica ativa.

### Confiança no oráculo (85 pares)

| Opção | Descrição | Selecionada |
|---|---|---|
| Re-raspar os 85 pares ao vivo do TabNet | Par que não reproduz é descartado como oráculo, não depurado | ✓ |
| Confiar nos CSVs que têm conteúdo | Assume que "tem conteúdo" implica "está certo" | |
| Re-raspar só os divergentes | Os 31 que batem exato nunca são auditados | |

**Escolha:** Re-raspar os 85 pares ao vivo antes de depurar contra eles.
**Notas:** Pergunta motivada por o oráculo do SC-7 vir do mesmo pipeline que a fase substitui (424 de 654 CSVs com 0 bytes).

### Edição de faixa CID (mapa congelado na Fase 8)

| Opção | Descrição | Selecionada |
|---|---|---|
| Camada de correção separada, com motivo por entrada | `lista-morb-cid.json` intocado; correções em segunda fonte, forma do D-11/D-14 da Fase 8 | ✓ |
| Editar o mapa direto, com invariante ampliado | Um arquivo só; apaga a distinção entre fonte oficial e decisão nossa | |
| Correção no matcher, mapa intocado | Regras em código — mesma forma do `KNOWN_BY_CODE` que produziu a corrupção dos 21 ids | |

**Escolha:** Camada de correção separada, com motivo escrito por entrada.

### Proteção contra regressão

| Opção | Descrição | Selecionada |
|---|---|---|
| Fixture congelada + teste na suíte | Entra no `npm run gate`; mudança futura que desloque número falha na suíte | ✓ |
| Relatório versionado, sem teste | Mais barato; nada impede que um ajuste posterior desfaça em silêncio | |
| Comando CLI dedicado, fora do gate | Só protege quem lembrar de rodar | |

**Escolha:** Fixture congelada + teste na suíte.

### Checkpoint humano para correções de faixa CID

| Opção | Descrição | Selecionada |
|---|---|---|
| Um checkpoint para o lote de correções | Tabela completa apresentada de uma vez, antes de qualquer upload | ✓ |
| Não — razão escrita e revisão no PR bastam | `KNOWN_BY_CODE` também passou por revisão | |
| Sim, só para as divergências grandes | O tamanho do desvio não prediz o tamanho do erro clínico | |

**Escolha:** Um checkpoint humano em lote.
**Notas:** Precedente citado: a 08-07 pegou o `ait` mapeado para I65-I69 em vez de G45 num checkpoint equivalente.

---

## Recorte do dado coletado

### Grão município: ocorrência ou residência

| Opção | Descrição | Selecionada |
|---|---|---|
| MUNIC_MOV — compatibilidade com o `nibr.def` | Mantém os 85 pares como oráculo e as linhas atuais comparáveis | |
| MUNIC_RES — epidemiologicamente correto para taxas | Denominador certo ao dividir por população; quebra a comparação com o oráculo | |
| Os dois, como medidas separadas | Saem da mesma passada; ensina a distinção; dobra as linhas municipais | ✓ |

**Escolha:** Os dois, como dimensão separada.
**Notas:** Escolha mais ambiciosa que a recomendada. Consequência de schema levantada e fechada na pergunta seguinte.

### Alcance da dimensão

| Opção | Descrição | Selecionada |
|---|---|---|
| Os dois grãos, mesma dimensão | UF e município ambos ganham `local`; um conceito só para as Fases 10 e 11 | ✓ |
| Só município | UF fica em ocorrência; os dois mapas passariam a medir coisas diferentes sem dizer | |
| Só município, UF derivada da escolha | Coerência por construção; perde o `UF_ZI` e introduz um terceiro número | |

**Escolha:** Os dois grãos, mesma dimensão.

### Padrão do app e alvo do SC-7

| Opção | Descrição | Selecionada |
|---|---|---|
| Ocorrência é padrão e único reconciliado | É o que o TabNet publica e o que os 85 pares medem; o SC-7 continua atingível | ✓ |
| Residência é o padrão | O número padrão seria o que não tem oráculo | |
| Sem padrão — escolha obrigatória | Atrito em toda entrada no Mapas; contra o "clique morto nunca" do MAPA-01 | |

**Escolha:** Ocorrência é padrão e o único lado sujeito ao SC-7.

### Janela temporal

| Opção | Descrição | Selecionada |
|---|---|---|
| Manter 2013–2025 | 13 anos; mesmo recorte das linhas atuais; ~10 GB | ✓ |
| Estender para 2008–2025 | 18 anos; ~14 GB; layouts antigos não exercitados pelo spike | |
| Recorte curto 2019–2025 | Fecha a fase mais rápido; seria regressão visível para o estudante | |

**Escolha:** Manter 2013–2025.

---

## Forma do ledger + proveniência

### Camadas

| Opção | Descrição | Selecionada |
|---|---|---|
| Duas camadas, só a de cobertura no Supabase | Ledger de arquivo local (4.212 linhas) + `sih_collection_status` no banco | ✓ |
| Uma camada só no Supabase | Uma corrida de horas ficaria refém da rede para saber o que já baixou | |
| Duas camadas, ambas no Supabase | Auditoria remota; mesma dependência de rede, mais detalhe operacional num banco público | |

**Escolha:** Duas camadas, só a de cobertura no Supabase.
**Notas:** Precedido do reenquadramento de que, no microdado, a unidade de download é o arquivo e não (agravo × medida).

### Chave de `sih_collection_status`

| Opção | Descrição | Selecionada |
|---|---|---|
| (agravo, medida, grão, local, ano) | ~69 mil linhas; distingue coleta parcial no tempo de completa | ✓ |
| (agravo, medida, grão, local) | Literal ao PIPE-02; 2025 incompleto ficaria indistinguível de completo | |
| (agravo, grão, local, ano) | As 4 medidas nunca divergem no novo pipeline; perde a expressão "esta medida falhou" | |

**Escolha:** (agravo, medida, grão, local, ano).

### Zero verdadeiro vs. ausente

| Opção | Descrição | Selecionada |
|---|---|---|
| Status por combinação + linha de métrica ausente = zero real | O ledger vira a função que interpreta a ausência de linha | ✓ |
| Materializar zeros explícitos | ~48 milhões de linhas, quase todas zero | |
| Coluna de status na própria linha de métrica | Linha que não existe não carrega coluna — não resolve o caso que motiva a regra | |

**Escolha:** Status `coletado` + linha ausente = zero real.

### Onde vivem `derived_at` e `cid_map_version`

| Opção | Descrição | Selecionada |
|---|---|---|
| No ledger, referenciado pelas métricas | Zero coluna nova em milhões de linhas; mesma chave que o app já consulta | ✓ |
| Colunas nas próprias `sih_metric_*` | Dois campos idênticos repetidos em milhões de linhas | |
| Tabela de `run` separada | Auditoria histórica entre corridas; um join a mais para exibir uma data | |

**Escolha:** No ledger.

---

## Aposentadoria do caminho TabNet

### Destino das 1,1M linhas vindas do TabNet

| Opção | Descrição | Selecionada |
|---|---|---|
| Substituição total, atomicamente | Nunca convivem; evita degrau de +3,5% no meio da série temporal | ✓ |
| Conviver, com coluna de fonte | Nenhuma janela sem dado; séries mistas por construção | |
| Migrar as antigas para `local='ocorrencia'` e completar | Aproveita 1,1M linhas; herdaria como verdade o corpus declarado não confiável | |

**Escolha:** Substituição total e atômica.

### Caminho de upload

| Opção | Descrição | Selecionada |
|---|---|---|
| Direto com service role, via Postgres (`COPY` + staging + swap) | Aposenta a Edge Function e resolve o `INGEST_SECRET` por remoção; exige a senha do banco | ✓ |
| Manter a Edge Function, versionada e com segredo rotacionado | Nenhuma credencial forte na máquina do operador; lento para milhões de linhas | |
| PostgREST com service role key | Uma credencial só; sem transação entre requisições, logo sem substituição atômica | |

**Escolha:** COPY direto com service role.

### Destino dos scrapers Python

| Opção | Descrição | Selecionada |
|---|---|---|
| Aposentar os três; extrair um raspador mínimo de reconciliação | Ferramenta pequena e testada, sem upload/cache/segredo | ✓ |
| Manter `coleta_sih_multi_disease.py` como fonte do oráculo | Reusa o parser; o oráculo passaria a depender da base que gerou 424 CSVs vazios | |
| Aposentar os três e conferir o oráculo à mão | 85 valores transcritos à mão — a forma do `KNOWN_BY_CODE` | |

**Escolha:** Aposentar os três; raspador mínimo no lugar.

### Corpus legado, uploader (CR-04) e `catalog:build`

| Opção | Descrição | Selecionada |
|---|---|---|
| Aposentar o corpus e o uploader; re-chavear só os 10 packs | CR-04 morre por remoção; packs regerados a partir do dado novo (TAX-06) | ✓ |
| Re-chavear o corpus inteiro | Trabalho de migração num corpus que a fase substitui, 65% dele vazio | |
| Congelar tudo e decidir depois da coleta | Fase 10 começaria com uma proibição documentada e um uploader quebrado no repo | |

**Escolha:** Aposentar corpus e uploader; regerar os 10 packs.

---

## Orçamento gratuito do Supabase (área emergente)

> Área não prevista no início: surgiu quando o usuário declarou, ao ser perguntado sobre continuar,
> que não pagará pelo Supabase, que o app é para ~30 alunos sem login, e que dado bruto pode ficar
> local. A medição ao vivo das tabelas (319 MB em `sih_metric_muni` para 1.099.403 linhas, com 93 de
> 331 agravos) tornou a restrição decisiva e reabriu onde o grão município mora.

### Redis

**Sugerido pelo usuário, descartado com justificativa.** Cache em memória não reduz o armazenamento da fonte de verdade, que é o gargalo; não está no plano gratuito do Supabase (exigiria um Upstash à parte); e o dado é estático e read-only, caso em que o cache HTTP do navegador e o cache em memória da Fase 5 fazem o mesmo trabalho sem custo.

### Onde mora o grão município

| Opção | Descrição | Selecionada |
|---|---|---|
| Supabase Storage, particionado por UF | Banco fica com UF + ledger; município vira arquivo comprimido sob demanda; mata o truncamento do PostgREST por construção | ✓ |
| Tudo no banco, município só em ocorrência | ~350 MB de 500 MB; perde a dimensão residência justo onde ela mais muda o número | |
| Tudo no banco, município com janela curta | ~270 MB; série municipal curta demais para Prais-Winsten | |

**Escolha:** Supabase Storage, particionado.

### Recorte das partições

| Opção | Descrição | Selecionada |
|---|---|---|
| Por UF — 27 arquivos | ~1–4 MB por drill; toda exploração naquela UF fica instantânea e offline depois | ✓ |
| Por UF × agravo — ~8.900 arquivos | Primeiro pixel mais rápido; cada troca de agravo vira rede de novo | |
| Por UF, com quebra por ano acima de um limite | Garante download pequeno; duas formas de partição convivendo | |

**Escolha:** Por UF.
**Notas:** Recomendação revisada durante a discussão — a estimativa inicial de ~10 MB para SP caiu para ~3–4 MB comprimidos ao refinar o cálculo, o que mudou a recomendação de "por UF × agravo" para "por UF". O tamanho real deve ser medido na primeira agregação antes de travar.

### Cortar agravos de baixa relevância cirúrgica

**Oferecido pelo usuário** ("prefiro perder agravos, como agravos inúteis não tão relacionados com cirurgia geral, do que perder anos"). **Não exercido:** o que forçava a escolha era o teto de 500 MB do banco, e mover o município para Storage removeu a pressão — a cobertura completa cabe. A preferência foi registrada como **ordem de coleta e upload**, não como exclusão.

### População

| Opção | Descrição | Selecionada |
|---|---|---|
| Total por território × ano, UF e município | ~73 mil linhas; habilita taxa por 100 mil em qualquer agravo/território/ano | |
| Total + estratificação por sexo e faixa etária | Habilita taxa padronizada por idade; ~20× mais linhas, ainda pequeno | ✓ |
| Só por UF × ano | 351 linhas; drill municipal ficaria sem denominador | |

**Escolha:** Total + estratificação por sexo e faixa etária.
**Notas:** Adição ao escopo que o ROADMAP escreveu para a Fase 9 — aceita e marcada como tal no CONTEXT.md. Fronteira registrada: a Fase 9 coleta e armazena o dado estratificado; ensinar taxa padronizada por idade na interface é fase futura.

---

## Claude's Discretion

Itens que o usuário passou adiante ou não especificou:

- **Código 330 (`todas_as_outras_causas_externas`) passa a ter coleta** — o handoff da 08-10 deixou isso explicitamente como decisão da Fase 9; com microdado é gratuito. `metricless-diseases.json` fica vazio.
- **`taxa_mortalidade` derivada do campo `MORTE`** na agregação, gravada na coluna existente.
- **Formato das partições de Storage: JSON colunar + gzip** — honra a decisão da Fase 5 de zero dependências novas nos módulos de catálogo.
- **Localização do parquet bruto (~10 GB) e agregados intermediários** — local, fora do controle de versão.
- **Onde o pipeline novo vive no repositório e a fronteira Python↔Node** — não perguntado; restrições registradas no CONTEXT.
- **Critério de "fase pronta"** — não perguntado; o planner decide e declara no plano.

## Deferred Ideas

- Taxa padronizada por idade na interface — fase futura.
- Issue upstream no PySUS sobre o índice de arquivos quebrado da 2.7.0.
- Estender a janela para 2008–2025 depois que 2013–2025 estiver estável.
- Unificar o caminho de dado de Variáveis (10 packs estáticos) com o de Mapas.
