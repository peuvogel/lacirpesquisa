# Phase 9: Pipeline confiável + coleta completa - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Phase Boundary

O estudante seleciona qualquer um dos 331 agravos e encontra as 4 medidas nos dois grãos — porque a fonte passa a ser o microdado SIH-RD, não a raspagem de tabela do TabNet.

Entrega: download determinístico do microdado SIH-RD via `pysus==1.0.1`, agregação local pela taxonomia canônica da Fase 8, ledger de duas camadas com falha ruidosa e retomada idempotente, reconciliação fechada contra o TabNet, substituição atômica do dado servido, e população como denominador.

Requisitos: PIPE-01 … PIPE-06, DATA-01 … DATA-04.

**Fora de escopo (fica para outras fases):** leitura ao vivo pelo mapa e o tri-estado honesto na interface (Fase 10); handoff mapa → teste estatístico (Fase 11); ensinar taxa padronizada por idade na interface (fase futura — esta fase só coleta o dado estratificado); meta-análise (v3.1).

</domain>

<scope_amendments>
## Emendas ao escopo do ROADMAP (decididas nesta discussão)

Três coisas que o ROADMAP não escreveu para a Fase 9 e que agora fazem parte dela. Registradas explicitamente para que o planner não as trate como descoberta nem como scope creep:

1. **Dimensão `local ∈ {ocorrencia, residencia}`** nos dois grãos (D-05, D-06). O SC-5 fala em "4 medidas × 331 agravos × UF e município"; agora são 4 medidas × 331 agravos × 2 grãos × **2 locais**.
2. **População IBGE/DATASUS**, total e estratificada por sexo e faixa etária, UF e município × ano (D-24). Não consta em nenhum requisito da Fase 9, mas sem denominador não existe "taxa por 100 mil habitantes" — e taxa é uso didático dominante da capacitação.
3. **O grão município deixa de morar no banco Postgres** e passa a ser servido do Supabase Storage (D-21). Isso altera a premissa da Fase 10 ("choropleth ao vivo do Supabase") para o grão municipal: UF continua sendo consulta SQL, município vira busca de partição. **A Fase 10 precisa saber disto antes de planejar.**

</scope_amendments>

<hard_constraint>
## Restrição dura: plano gratuito do Supabase, sem login, ~30 alunos

Declarada pelo usuário nesta discussão e vinculante para todo o desenho:

- **Não haverá pagamento pelo Supabase.** Plano gratuito: ~500 MB de banco, ~1 GB de Storage, ~5 GB/mês de egresso. O planner deve verificar os limites correntes — não assumir estes números.
- **Sem login.** O aluno entra, escolhe dado, pesquisa e segue a vida. Leitura anônima (anon + RLS) no banco e no bucket de Storage.
- **~30 alunos simultâneos** em aula prática, em wifi de qualidade incerta.
- **Dado bruto e agregados intermediários ficam na máquina do usuário**, fora do controle de versão. Só vai para a nuvem o que é essencial para a pesquisa.

**Medição ao vivo em 2026-08-04** (`pg_total_relation_size` no projeto `hmfbxqemububjyhdckrj`), que motivou D-21:

| Tabela | Total | Heap | Índices | Linhas |
|---|---|---|---|---|
| `sih_metric_muni` | **319 MB** | 152 MB | **167 MB** | 1.099.403 |
| `sih_metric_uf` | 8,2 MB | 3,9 MB | 4,3 MB | 30.313 |
| `sih_disease` | 136 kB | — | — | 331 |

**290 bytes por linha**, com os índices pesando mais que o dado — `disease_id` é texto longo repetido em dois índices. O projeto já ocupa ~327 MB do teto com **93 dos 331 agravos, uma medida útil e um local**. Projeção de cobertura completa: ~2,3M linhas só em ocorrência (~670 MB) e ~4,6M com residência (~1,35 GB). Mesmo com normalização agressiva (código `smallint`, nome de município em tabela à parte, inteiros no lugar de `numeric`), ~150 B/linha ainda dá ~700 MB. **O grão município completo não cabe no banco gratuito** — daí D-21.

</hard_constraint>

<decisions>
## Implementation Decisions

### Gate da reconciliação (SC-7)

- **D-01: Baixar já, subir só depois de fechar.** Download e agregação são etapas independentes: baixar os ~10 GB de parquet é idempotente e não depende do matcher CID; a agregação roda quantas vezes for preciso sobre o parquet local, de graça. A única etapa irreversível é o **upload** — é ela que espera a reconciliação fechar. O download pode começar no primeiro dia da fase.
- **D-02: Barra do SC-7 = exato **ou** razão escrita, sem banda de tolerância.** Cada um dos 85 pares ou bate exato, ou tem uma linha escrita dizendo por que diverge e qual faixa CID foi corrigida. Um delta de 1,2% (anemia) exige a mesma explicação que um de 15% (apêndice). Rejeitado: banda de ±1% — a mediana de +3,45% indica mecanismo sistemático, não ruído, e uma banda esconderia justamente o mecanismo. Rejeitado: exato nos 85 sem exceção — se houver diferença metodológica legítima no `.def`, a barra fica inatingível sem que nada esteja errado.
- **D-03: Amostra = AC/2019 para depurar + 1 UF grande (SP ou MG) para confirmar.** Depurar categoria a categoria no AC/2019 (44.589 registros, iteração rápida) e confirmar a correção contra uma UF grande sem redepurar. UF grande exercita categorias que um estado de 900 mil habitantes nunca exercita — uma categoria vazia no AC passaria verde por vacuidade.
- **D-04: O oráculo é re-raspado ao vivo antes de servir de referência.** Os 85 pares vieram do pipeline que esta fase substitui (424 de 654 CSVs com 0 bytes). Antes de depurar contra eles, buscar os 85 valores direto do TabNet hoje e conferir contra o CSV guardado; **um par que não reproduz é descartado como oráculo, não depurado**. Sem isso, ajustaríamos faixa CID para casar com número que a coleta velha inventou. É raspagem pontual de 85 valores, não a coleta que a fase aposenta.
- **D-05: Correções de faixa CID vivem em camada separada, com motivo escrito por entrada.** `scripts/catalog/lista-morb-cid.json` continua sendo o que a fonte oficial diz — evidência arquivada, invariantes B/C da Fase 8 intactos. As correções vão para um segundo arquivo, mesma forma de "segunda fonte" do D-11/D-14 da Fase 8: código, faixa antiga, faixa nova, razão escrita, par de reconciliação que a motivou. O matcher lê os dois. Rejeitado: editar o mapa direto (apaga a distinção entre "o que a fonte diz" e "o que decidimos", e o invariante de fidelidade à fonte deixa de provar). Rejeitado: exceções como regras de precedência no código do matcher — é exatamente a forma do `KNOWN_BY_CODE` que produziu a corrupção dos 21 ids.
- **D-06: A reconciliação vira gate permanente.** Os 85 pares re-raspados viram fixture congelada e versionada; um teste agrega uma amostra e afirma que reproduz os valores esperados, dentro de `npm run gate`. Uma mudança futura no matcher ou na camada de correção que desloque número falha na suíte, não em produção. O teste precisa de um recorte pequeno de parquet — nunca dos 10 GB.
- **D-07: Checkpoint humano em lote antes de qualquer upload.** O agente depura, escreve as razões e apresenta a tabela completa (código, faixa antiga, faixa nova, delta antes/depois, razão) para aprovação de uma vez. Um checkpoint, não um por categoria. Precedente: a 08-07 pegou um erro clínico real (`ait` mapeado para I65-I69 em vez de G45) exatamente assim, e a 08-CONTEXT registra que `KNOWN_BY_CODE` também passou por revisão — 21 linhas plausíveis, nenhuma conferida.
- **D-08: A divergência residual é visível na proveniência da métrica.** Onde restar divergência com razão escrita, a proveniência da métrica ativa diz "agregado do microdado SIH-RD; diverge do TabNet em +X% — [razão]". Coerente com a proveniência obrigatória da Fase 5 e com MAPA-10. O estudante que citar o número no trabalho consegue defendê-lo. Consequência para o planner: a razão precisa ser **persistida por categoria de forma legível pelas Fases 10 e 11** — ver D-20.

### Recorte do dado coletado

- **D-09: Dimensão `local ∈ {ocorrencia, residencia}`, nos dois grãos.** Município por `MUNIC_MOV` (onde a internação aconteceu) **e** `MUNIC_RES` (onde o paciente mora); UF idem. Saem da mesma passada do microdado, sem download extra. Motivo didático: ocorrência mede carga assistencial (município-polo infla), residência é o numerador certo quando o estudante divide por população — e dividir por população é exatamente o que uma aula de bioestatística faz.
- **D-10: Ocorrência é o padrão do app e o único lado sujeito ao SC-7.** É o que o TabNet publica, o que os 85 pares medem, e o que o estudante reencontra se conferir. Residência fica disponível como escolha explícita, agregada pelo mesmo matcher já validado, mas **sem oráculo externo** — não existe TabNet de residência comparável no `nibr.def`. Isso mantém o SC-7 um gate real e atingível.
- **D-11: Janela 2013–2025.** 13 anos: série suficiente para Prais-Winsten e para as comparações da capacitação, e o mesmo recorte das linhas já no banco (comparação direta possível). ~10 GB de download, conforme o spike estimou. Estender depois é rodar o pipeline com outro range — a arquitetura não muda.

### Ledger e proveniência

> **Reenquadramento que o planner precisa carregar.** No TabNet, a unidade de trabalho *era* (agravo × medida) — uma requisição por combinação, cada uma podendo voltar vazia. No microdado, **um arquivo entrega todos os agravos e todas as medidas de uma vez**. A unidade de download vira o arquivo (`RD{UF}{AA}{MM}` — 27 × 12 × 13 = 4.212 arquivos), e a cobertura por agravo passa a ser *consequência* da agregação, não do download. É por isso que o ledger tem duas camadas.

- **D-12: Duas camadas; só a de cobertura vai ao Supabase.**
  - **Camada 1 — ledger de arquivo, local, ao lado do parquet.** 4.212 linhas de `RD{UF}{AA}{MM}` com baixado/falhou/nunca-tentado, hash e contagem de registros. É o que entrega retomada idempotente (PIPE-03) e falha ruidosa por arquivo ausente (SC-1/PIPE-01).
  - **Camada 2 — `sih_collection_status` no Supabase.** A cobertura que o app lê (PIPE-02).
  - Rejeitado: ledger de arquivo no Supabase — uma corrida de várias horas passaria a depender da rede para saber o que já baixou, exatamente na propriedade que deveria protegê-la.
- **D-13: Chave de `sih_collection_status` = (agravo, medida, grão, local, ano).** ≈ 331 × 4 × 2 × 2 × 13 ≈ 69 mil linhas, triviais para o PostgREST. Supera o PIPE-02 (que escreveu "agravo × medida × grão") por refinamento, não o contradiz. O `ano` é obrigatório: sem ele, uma coleta parcial no tempo — 2025 ainda incompleto no FTP do DATASUS, o que acontece todo ano — fica indistinguível de completa, e o mapa de 2025 pintaria buraco como zero. O mapa é sempre consultado com um ano fixado.
- **D-14: Zero verdadeiro = status `coletado` + linha de métrica ausente.** Se o ledger diz `coletado` para (agravo, medida, grão, local, ano) e não existe linha para um território, isso é **zero verdadeiro** — ninguém internou. Se diz `nunca_tentado` ou `falhou`, é **ausente**. O ledger vira a função que interpreta a ausência de linha, e a Fase 10 recebe uma regra única para MAPA-03/MAPA-04 em vez de heurística. Rejeitado: materializar zeros explícitos (331 × 5.570 × 13 × 2 ≈ 48 milhões de linhas, quase todas zero). Rejeitado: coluna de status na própria linha de métrica — linha que não existe não carrega coluna nenhuma, então não resolve o caso que motiva a regra.
- **D-15: `derived_at` e `cid_map_version` vivem no ledger** (SC-6/DATA-04), referenciados pelas métricas pela mesma chave que o app já vai consultar para saber se é zero real. Zero coluna nova em milhões de linhas, e um reprocessamento não precisa reescrever as métricas só para trocar um carimbo.

### Aposentadoria do caminho TabNet

- **D-16: Substituição total e atômica do dado vindo do TabNet.** Quando a reconciliação fechar, o dado do microdado substitui o do TabNet por inteiro, numa transação — nunca convivem. Motivo: uma série com 2013–2020 raspado e 2021–2025 agregado tem um degrau de ~+3,5% no meio que o Prais-Winsten leria como tendência real. As linhas velhas também não têm valor para a dimensão `local`. Rejeitado: migrar as antigas para `local='ocorrencia'` e completar o resto — herdaria como verdade exatamente o corpus que a fase declarou não confiável.
- **D-17: Upload direto com service role, via Postgres.** `COPY` para tabela de staging + swap transacional. Ordens de grandeza mais rápido que HTTP, e entrega a atomicidade do D-16 de graça. **Consequência: a Edge Function `sih-ingest` é aposentada, e o `INGEST_SECRET = "lacir-sih-ingest-2026"` se resolve por remoção em vez de rotação.** Exige a senha do banco (a mesma que a Fase 8 precisou para o `pg_dump`), não só a service role key — o planner deve tratar isso como pré-requisito operacional explícito. Isso substitui o trabalho de "versionar a Edge Function no repo" que a 08-CONTEXT D-07 deixou para a Fase 9.
- **D-18: Os três scrapers Python são aposentados; entra um raspador mínimo de reconciliação.** `coleta_sih_multi_disease.py` (548 linhas), `scrape_upload_sih.py` e `launch_overnight.py` saem do `package.json` e do uso. No lugar, uma ferramenta pequena e testada cujo único trabalho é buscar N valores pontuais do TabNet para a fixture do D-04/D-06 — sem upload, sem cache, sem `--skip-done`, sem segredo. Rejeitado: manter `coleta_sih_multi_disease.py` como fonte do oráculo — o oráculo do SC-7 passaria a depender da base que produziu 424 CSVs de 0 bytes registrando sucesso. Rejeitado: transcrever os 85 valores à mão — é a forma do `KNOWN_BY_CODE`.
- **D-19: Corpus legado e uploader aposentados; os 10 packs regerados.** Os 654 CSVs de `trabalhos datasus/outputs/coleta_sih_multi/` viram arquivo histórico e param de ser entrada de build. **`scripts/catalog/uploadSihToSupabase.mjs` é deletado — o CR-04 do `08-REVIEW.md` morre por remoção, sem exempt-list nova.** Os 10 packs em `public/data/catalog/packs/`, que a tela Variáveis ainda lê, são **regerados a partir do dado novo** quando ele existir, mantendo TAX-06 (derivado sempre gerado, nunca mantido à mão). O planner deve confirmar quais packs ainda têm consumidor vivo antes de mexer. Isso também dissolve a proibição de rodar `catalog:build` registrada no handoff da 08-10 — não por re-chavear o corpus, mas por aposentá-lo.

### Orçamento gratuito e onde cada coisa mora

- **D-20: O grão município mora no Supabase Storage, particionado, não no banco.** Banco Postgres fica com: `sih_disease`, `sih_metric_uf` (os dois locais — ~232 mil linhas, ~28 MB), `sih_collection_status` (~69 mil linhas) e as tabelas de população (D-24). Município vira arquivos comprimidos no Storage com leitura anônima, baixados sob demanda no drill — o mesmo padrão `fetch` same-origin + cache em memória que a Fase 5 estabeleceu em `loadCatalog`. **Ganho colateral: mata o truncamento silencioso do PostgREST (MAPA-06) por construção — arquivo não pagina.** A divergência registrada do D-08 viaja junto do ledger, que continua no banco.
- **D-21: Partição por UF — 27 arquivos.** Um drill baixa ~1–4 MB uma vez e a partir daí toda exploração naquela UF é instantânea e offline: trocar agravo, trocar ano, trocar medida, comparar múltiplos agravos, montar série temporal municipal para Prais-Winsten. É o recorte que mais entrega possibilidades por download. **O tamanho real precisa ser medido na primeira agregação antes de travar** — as projeções acima são estimativas. Rejeitado: por UF × agravo (~8.900 arquivos) — cada troca de agravo vira rede de novo, pior justamente na exploração didática, que é trocar agravo o tempo todo.
- **D-22: Redis descartado.** Avaliado a pedido do usuário. Não resolve: cache em memória não reduz o armazenamento da fonte de verdade, que é o gargalo; não está no plano gratuito do Supabase (exigiria um Upstash à parte — mais um serviço, mais uma credencial, mais um modo de falha); e o dado é estático e somente-leitura, caso em que o cache HTTP do navegador e o cache em memória da Fase 5 fazem o mesmo trabalho de graça.
- **D-23: Nenhum agravo é cortado.** O usuário ofereceu abrir mão de agravos de baixa relevância cirúrgica para preservar anos. **Não é necessário** — o que forçava a escolha era o teto de 500 MB do banco, e o D-20 remove essa pressão; a cobertura completa cabe. A preferência fica registrada como **ordem de coleta e de upload** (agravos de relevância cirúrgica primeiro), para o app ficar útil cedo enquanto a corrida longa termina — nunca como exclusão. *Quem define a lista de relevância cirúrgica é julgamento clínico do usuário, não do agente — o planner deve prever um checkpoint curto para isso, na forma do checkpoint clínico da 08-07.*
- **D-24: População IBGE/DATASUS, total e estratificada por sexo e faixa etária, no banco.** UF e município × ano. Total ≈ 73 mil linhas (~3 MB); estratificado, ~20× isso — ainda pequeno o bastante para o banco, e não vai para Storage. Usar a série IBGE/DATASUS (a mesma que o TabNet usa como denominador) mantém a coerência com o numerador. **Fronteira: a Fase 9 coleta e armazena o dado estratificado; ensinar taxa padronizada por idade na interface é fase futura** — senão esta fase vira uma aula de padronização em vez de um pipeline. O planner deve verificar a disponibilidade e o nome exato do dataset de população em `pysus==1.0.1` (o usuário afirma que é acessível por lá; tratar como hipótese a confirmar, não como fato).

### Claude's Discretion

Itens que o usuário deixou passar ou não especificou. Registrados como discrição, não escondidos:

- **Código 330 (`todas_as_outras_causas_externas`) passa a ter coleta.** O handoff da 08-10 deixou isso explicitamente como decisão da Fase 9. Com microdado, coletá-lo é gratuito — é só uma faixa CID a mais na mesma passada (`W20-W64, W75-W99, X10-X39, X50-X59, Y10-Y89`). Consequência: `scripts/catalog/metricless-diseases.json` fica vazio, e o invariante "o conjunto de órfãos não cresce" continua válido com zero membros. Os 331 agravos passam a ter dado, fechando a distinção "331 canônicos / 330 com dado" que a Fase 8 carregava.
- **`taxa_mortalidade` derivada do campo `MORTE` na agregação**, gravada na coluna que já existe no schema (não computada na leitura). O spike confirmou que `MORTE` está presente e completo — é o que torna DATA-03 alcançável em todo o catálogo em vez de nos 5 agravos atuais.
- **Formato das partições de Storage: JSON colunar (arrays paralelos) + gzip**, servido com `Content-Encoding: gzip` para o navegador descomprimir nativamente. Honra a decisão da Fase 5 de zero dependências novas nos módulos de catálogo — parquet no browser exigiria um leitor wasm.
- **Localização do parquet bruto (~10 GB) e dos agregados intermediários:** local, na pasta do usuário, fora do controle de versão e fora do bundle.
- **Onde o pipeline novo vive no repositório e a fronteira Python↔Node** não foram discutidos. Restrições que valem: PySUS força Python ≥3.10 (a máquina tem 3.11.15 e `uv`; o `python3` do sistema é 3.9.6 e **não serve**); a Fase 7 entregou `npm run gate` e a Fase 8 estabeleceu a disciplina de "gerado, nunca escrito à mão" com invariantes na suíte — o pipeline novo deve ser alcançável por essas garantias, não ficar fora delas como os scrapers de `trabalhos datasus/scripts/` ficaram.
- **O critério de "fase pronta"** não foi discutido. O ROADMAP desacopla explicitamente: entregar o schema de `sih_collection_status` cedo destrava a Fase 10 enquanto a coleta longa roda. O planner deve decidir se a fase fecha com o pipeline provado num recorte ou só com a coleta inteira carregada, e declarar essa escolha no plano.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fonte e decisão de troca de fonte
- `.planning/notes/2026-08-04-pysus-microdado-spike.md` — **O documento mais importante desta fase.** Veredito do spike: o defeito bloqueante do índice de arquivos do PySUS 2.7.0 (§1), por que pinar 1.0.1 (§2), campos do microdado disponíveis (§3), as cinco formas de valor do mapa CID e o matcher que as trata (§4), a medição completa da reconciliação com as hipóteses já descartadas (§5), e o estado real medido da coleta atual — 424 de 654 CSVs com 0 bytes (§6).
- `.planning/ROADMAP.md` §"Phase 9" — goal, 7 success criteria, e a nota que derruba a decisão anterior de "zero pacotes de terceiros / Python 3.9.6".
- `.planning/ROADMAP.md` §"Riscos conhecidos" — a linha do `INGEST_SECRET` (resolvida por D-17).

### Taxonomia e mapa CID (entradas da agregação)
- `scripts/catalog/lista-morb-cid.json` — mapa código TabNet → faixa CID, congelado na 08-01, re-keyado por `tabnetCode`. É a entrada do matcher. **Não editar** (D-05).
- `scripts/catalog/diseases.json` e `src/features/catalog/diseases.lista.json` — taxonomia canônica dos 331 agravos, ambos commitados e cobertos pelo invariante de regeneração (08-CONTEXT D-16).
- `scripts/catalog/validate.mjs` — invariantes fail-closed A/B/C/D/E da Fase 8. Correções de faixa CID (D-05) não podem quebrá-los.
- `scripts/catalog/metricless-diseases.json` — registro de agravos órfãos de métrica; fica vazio pela discrição sobre o código 330.
- `scripts/catalog/extra-diseases.json`, `scripts/catalog/exclusions.json` — a forma "dado com motivo escrito" que D-05 deve imitar.
- `.planning/phases/08-taxonomia-can-nica-integridade/08-CONTEXT.md` — D-06 (tombstones permanentes), D-07 (Edge Function auditada, versionamento adiado para cá — superado por D-17), D-09 a D-14 (disciplina de snapshot, invariantes, dado-com-motivo), D-25 (código 330).

### Supabase: schema, migrações, contrato
- `docs/SUPABASE-CATALOG.md` — schema real v2 capturado ao vivo (`ON DELETE CASCADE`, ausência deliberada de `ON UPDATE CASCADE`, nomes reais de constraint e índice), estrutura de `supabase/{migrations,rollback,verify}` e o contrato do app. **Precisa ser atualizado por esta fase** — a dimensão `local`, o ledger, a mudança do município para Storage e as tabelas de população mudam o contrato.
- `supabase/migrations/20260804015329_remote_schema.sql` — baseline do schema real.
- `supabase/verify/contagens.sql` — padrão de verificação pós-migração com `RAISE EXCEPTION`, a imitar.
- `scripts/catalog/generateRenameMigration.mjs` + `src/features/catalog/renameMigration.test.ts` — o padrão "SQL gerado, nunca escrito à mão, com teste que impede edição manual". Migrações desta fase devem seguir a mesma forma.

### Achados da Fase 8 que caem aqui
- `.planning/phases/08-taxonomia-can-nica-integridade/08-REVIEW.md` §CR-04 — o defeito do `uploadSihToSupabase.mjs`; resolvido por deleção (D-19), não por correção.
- `.planning/phases/08-taxonomia-can-nica-integridade/08-10-SUMMARY.md` §"Handoff to Fase 9" — os 5 itens entregues a esta fase (corpus com ids legados, `manifest.json`, proibição de `catalog:build`, `INGEST_SECRET`, cobertura do código 330). D-19, D-17 e a discrição sobre o 330 os endereçam todos.
- `scripts/catalog/paths.mjs` §`PACK_SOURCES` + `CYCLE_CANONICAL_IDS` — a guarda correta contra tombstones, que o uploader não tinha.

### Código a aposentar
- `trabalhos datasus/scripts/coleta_sih_multi_disease.py` — 548 linhas; `YEARS = range(2013, 2026)` na linha 38 é a origem da janela do D-11; o parser de PRN/DBF é a referência para o raspador mínimo do D-18.
- `trabalhos datasus/scripts/scrape_upload_sih.py:33` — o `INGEST_SECRET` em texto plano.
- `scripts/catalog/uploadSihToSupabase.mjs` — a deletar (D-19).

### Requisitos
- `.planning/REQUIREMENTS.md` §"Pipeline de coleta" (PIPE-01…06) e §"Cobertura de dados" (DATA-01…04).
- `.planning/REQUIREMENTS.md` §"Mapas dinâmicos" (MAPA-01…10) — não é escopo desta fase, mas D-14 e D-20 existem para tornar MAPA-03/04/06 alcançáveis.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`loadCatalog` / `fetch('/data/catalog/...')` same-origin + cache em memória** (Fase 5, 05-03): o padrão exato que D-20/D-21 precisam para o município vindo de Storage. Não inventar caminho novo.
- **`scripts/catalog/paths.mjs`** — resolução de caminhos com `assertNotTombstone` e a exceção `CYCLE_CANONICAL_IDS`. É a guarda que o uploader deletado não tinha.
- **`scripts/catalog/generateRenameMigration.mjs`** — padrão de geração de SQL a partir de dado versionado, com teste que impede edição manual. As migrações desta fase (dimensão `local`, ledger, população) devem nascer assim.
- **`supabase/verify/contagens.sql`** — verificação pós-migração com contagens absolutas e `RAISE EXCEPTION`; a substituição atômica do D-16 precisa da mesma prova.
- **Parser de PRN/DBF do TabNet** em `coleta_sih_multi_disease.py` — fonte de referência para o raspador mínimo do D-18, mesmo com o script sendo aposentado.

### Established Patterns
- **Gerado, nunca escrito à mão** (TAX-06 / Fase 8): todo artefato derivado nasce de um gerador, com teste que prova a regeneração. Vale para as partições de Storage, os 10 packs regerados e o SQL de migração.
- **Dado com motivo escrito, nunca allowlist silenciosa** (Fase 8 D-14): a forma de `extra-diseases.json` / `exclusions.json` / `metricless-diseases.json`. A camada de correção CID do D-05 é o próximo membro dessa família.
- **Invariantes fail-closed na suíte, encadeados em `pretest`/`test:run`/`gate`** (Fases 7 e 8): `catalog:validate` roda antes de qualquer teste. A fixture de reconciliação do D-06 entra por aí.
- **Snapshot versionado em vez de `fetch()` ao vivo** (Fase 8 D-09): nada em caminho de validação depende da rede. Vale para a fixture do oráculo — re-raspar é comando explícito, não parte do `gate`.
- **Zero dependências npm novas nos módulos de catálogo** (Fase 5, 05-03): motiva o JSON colunar + gzip em vez de parquet no browser.

### Integration Points
- **`sih_metric_uf` / `sih_metric_muni`** — ganham a dimensão `local`; `sih_metric_muni` deixa o banco (D-20). Ambas têm `ON DELETE CASCADE` de `sih_disease` e **não** têm `ON UPDATE CASCADE` (Fase 8 D-08).
- **`sih_collection_status`** — tabela nova, lida pelo app com chave anon. É a dependência que destrava a Fase 10.
- **Bucket de Storage** — novo, leitura anônima, política de acesso a definir junto com o RLS existente.
- **`public/data/catalog/packs/`** — 10 packs lidos por Variáveis; a regerar a partir do dado novo (D-19).
- **`catalogAnalysisData.ts`** — importa os 10 packs estaticamente; é o que a Fase 10 substitui. Não mexer aqui.
- **`.env.local`** — hoje tem `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. O D-17 acrescenta a senha do banco como pré-requisito **offline**, jamais no bundle.

</code_context>

<specifics>
## Specific Ideas

- **"Ligante entra, escolhe dados, faz a pesquisa e segue a vida"** — a frase do usuário para o fluxo. Sem login, só internet. Qualquer desenho que exija conta, chave ou configuração do aluno está errado.
- **"O que deve ir pro Supabase é o essencial para fazer pesquisa científica boa"** — o critério de corte para o que sobe. Dado bruto e intermediários ficam na pasta do usuário.
- **"Prefiro perder agravos do que perder anos"** — prioridade declarada. Não foi preciso exercê-la (D-23), mas ela ordena a coleta e é o desempate se um limite aparecer.
- **~30 alunos, aula prática, wifi incerto** — a métrica de "funciona" é o tempo do primeiro pixel municipal com 30 pessoas drilhando ao mesmo tempo, não o throughput do pipeline.
- **PySUS 2.7.0 é uma armadilha ativa**, não só uma versão velha: ela devolve arquivos RJ (AIH rejeitada) e SP (um por procedimento) sob o nome do grupo pedido. Um pipeline que confiasse nela produziria número plausível e errado — o modo de falha exato que a fase existe para matar. O pin de `1.0.1` precisa vir com o porquê escrito ao lado, para ninguém "atualizar".

</specifics>

<deferred>
## Deferred Ideas

- **Taxa padronizada por idade na interface** — a Fase 9 entrega o dado de população estratificado por sexo e faixa etária (D-24), mas ensinar padronização etária ao estudante é conceito estatístico novo, com UI e interpretação próprias. Fase futura.
- **Issue upstream no PySUS** sobre o índice de arquivos quebrado da 2.7.0 (recomendação 4 do spike). Bom cidadão, fora do caminho crítico.
- **Estender a janela para 2008–2025** — a arquitetura não muda, é rodar o pipeline com outro range. Depois que a série 2013–2025 estiver servida e estável.
- **Migrar os 10 packs de Variáveis para o mesmo caminho de Storage/Supabase** — hoje são estáticos em `public/data/catalog/packs/`. D-19 só os regenera; unificar o caminho de dado de Variáveis com o de Mapas é trabalho de outra fase.

</deferred>

---

*Phase: 9-pipeline-confi-vel-coleta-completa*
*Context gathered: 2026-08-04*
