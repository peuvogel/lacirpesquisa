# Phase 9: Pipeline confiável + coleta completa - Research

**Researched:** 2026-08-04
**Domain:** Pipeline Python de coleta de microdado DATASUS (SIH-RD via PySUS), agregação local, upload transacional para Postgres/Supabase e distribuição de dados via Supabase Storage
**Confidence:** HIGH nas partes verificadas ao vivo nesta sessão (API do PySUS 1.0.1, estrutura do microdado, limites do Supabase, defeitos concretos encontrados) · MEDIUM nas partes de dimensionamento que dependem de medição futura (tamanho real das partições) · LOW apenas onde explicitamente marcado

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Gate da reconciliação (SC-7)**
- **D-01: Baixar já, subir só depois de fechar.** Download e agregação são etapas independentes: baixar os ~10 GB de parquet é idempotente e não depende do matcher CID; a agregação roda quantas vezes for preciso sobre o parquet local, de graça. A única etapa irreversível é o **upload** — é ela que espera a reconciliação fechar. O download pode começar no primeiro dia da fase.
- **D-02: Barra do SC-7 = exato **ou** razão escrita, sem banda de tolerância.** Cada um dos 85 pares ou bate exato, ou tem uma linha escrita dizendo por que diverge e qual faixa CID foi corrigida.
- **D-03: Amostra = AC/2019 para depurar + 1 UF grande (SP ou MG) para confirmar.**
- **D-04: O oráculo é re-raspado ao vivo antes de servir de referência.** Um par que não reproduz é descartado como oráculo, não depurado.
- **D-05: Correções de faixa CID vivem em camada separada, com motivo escrito por entrada.** `scripts/catalog/lista-morb-cid.json` continua sendo o que a fonte oficial diz — não editar. As correções vão para um segundo arquivo, mesma forma de "segunda fonte" do D-11/D-14 da Fase 8.
- **D-06: A reconciliação vira gate permanente.** Os 85 pares re-raspados viram fixture congelada e versionada; um teste agrega uma amostra e afirma que reproduz os valores esperados, dentro de `npm run gate`. O teste precisa de um recorte pequeno de parquet — nunca dos 10 GB.
- **D-07: Checkpoint humano em lote antes de qualquer upload.** Um checkpoint, não um por categoria.
- **D-08: A divergência residual é visível na proveniência da métrica.** A razão precisa ser persistida por categoria de forma legível pelas Fases 10 e 11 — ver D-20.

**Recorte do dado coletado**
- **D-09: Dimensão `local ∈ {ocorrencia, residencia}`, nos dois grãos.** Município por `MUNIC_MOV` (onde a internação aconteceu) e `MUNIC_RES` (onde o paciente mora); UF idem.
- **D-10: Ocorrência é o padrão do app e o único lado sujeito ao SC-7.** Residência fica disponível como escolha explícita, mas sem oráculo externo.
- **D-11: Janela 2013–2025.** 13 anos.

**Ledger e proveniência**
- **D-12: Duas camadas; só a de cobertura vai ao Supabase.** Camada 1 — ledger de arquivo, local, ao lado do parquet (4.212 linhas de `RD{UF}{AA}{MM}`). Camada 2 — `sih_collection_status` no Supabase, que o app lê.
- **D-13: Chave de `sih_collection_status` = (agravo, medida, grão, local, ano).** ≈ 331 × 4 × 2 × 2 × 13 ≈ 69 mil linhas. O `ano` é obrigatório: coleta parcial no tempo (2025 ainda incompleto no FTP, o que acontece todo ano) fica indistinguível de completa sem ele.
- **D-14: Zero verdadeiro = status `coletado` + linha de métrica ausente.** Se `nunca_tentado` ou `falhou`, é ausente. Rejeitado: materializar zeros explícitos ou coluna de status na própria linha de métrica.
- **D-15: `derived_at` e `cid_map_version` vivem no ledger** (SC-6/DATA-04), referenciados pelas métricas pela mesma chave.

**Aposentadoria do caminho TabNet**
- **D-16: Substituição total e atômica do dado vindo do TabNet.** Quando a reconciliação fechar, o dado do microdado substitui o do TabNet por inteiro, numa transação — nunca convivem.
- **D-17: Upload direto com service role, via Postgres.** `COPY` para tabela de staging + swap transacional. Consequência: a Edge Function `sih-ingest` é aposentada, `INGEST_SECRET` se resolve por remoção em vez de rotação. Exige a senha do banco, não só a service role key — pré-requisito operacional explícito.
- **D-18: Os três scrapers Python são aposentados; entra um raspador mínimo de reconciliação.** `coleta_sih_multi_disease.py`, `scrape_upload_sih.py` e `launch_overnight.py` saem do `package.json` e do uso. No lugar, uma ferramenta pequena e testada cujo único trabalho é buscar N valores pontuais do TabNet para a fixture do D-04/D-06 — sem upload, sem cache, sem `--skip-done`, sem segredo.
- **D-19: Corpus legado e uploader aposentados; os 10 packs regerados.** `scripts/catalog/uploadSihToSupabase.mjs` é deletado. Os 10 packs em `public/data/catalog/packs/` são regerados a partir do dado novo quando ele existir (TAX-06). O planner deve confirmar quais packs ainda têm consumidor vivo antes de mexer.

**Orçamento gratuito e onde cada coisa mora**
- **D-20: O grão município mora no Supabase Storage, particionado, não no banco.** Banco Postgres fica com: `sih_disease`, `sih_metric_uf` (os dois locais), `sih_collection_status` e as tabelas de população (D-24). Município vira arquivos comprimidos no Storage com leitura anônima, baixados sob demanda no drill — o mesmo padrão `fetch` same-origin + cache em memória que a Fase 5 estabeleceu em `loadCatalog`. Ganho colateral: mata o truncamento silencioso do PostgREST (MAPA-06) por construção.
- **D-21: Partição por UF — 27 arquivos.** Um drill baixa ~1–4 MB uma vez. **O tamanho real precisa ser medido na primeira agregação antes de travar** — as projeções são estimativas. Rejeitado: por UF × agravo (~8.900 arquivos).
- **D-22: Redis descartado.**
- **D-23: Nenhum agravo é cortado.** A preferência de agravos de relevância cirúrgica primeiro fica registrada como **ordem de coleta e de upload**, nunca como exclusão. O planner deve prever um checkpoint curto para essa ordem (julgamento clínico do usuário).
- **D-24: População IBGE/DATASUS, total e estratificada por sexo e faixa etária, no banco.** UF e município × ano. Total ≈ 73 mil linhas (~3 MB); estratificado, ~20× isso. **O planner deve verificar a disponibilidade e o nome exato do dataset de população em `pysus==1.0.1`** (tratar como hipótese a confirmar, não como fato) — ver `## Standard Stack` e `## Common Pitfalls` abaixo: esta pesquisa confirma a hipótese, com uma correção de rota importante.

### Claude's Discretion

- **Código 330 (`todas_as_outras_causas_externas`) passa a ter coleta.** É só uma faixa CID a mais na mesma passada (`W20-W64, W75-W99, X10-X39, X50-X59, Y10-Y89`). Consequência: `scripts/catalog/metricless-diseases.json` fica vazio.
- **`taxa_mortalidade` derivada do campo `MORTE` na agregação**, gravada na coluna que já existe no schema.
- **Formato das partições de Storage: JSON colunar (arrays paralelos) + gzip**, servido com `Content-Encoding: gzip` para o navegador descomprimir nativamente. Honra a decisão da Fase 5 de zero dependências novas nos módulos de catálogo. **Esta pesquisa encontrou um problema concreto com a parte "Content-Encoding" — ver `## Common Pitfalls`.**
- **Localização do parquet bruto (~10 GB) e dos agregados intermediários:** local, na pasta do usuário, fora do controle de versão e fora do bundle.
- **Onde o pipeline novo vive no repositório e a fronteira Python↔Node** não foram discutidos. Restrições que valem: PySUS força Python ≥3.10 (a máquina tem 3.11.15 e `uv`; o `python3` do sistema é 3.9.6 e **não serve**); a Fase 7 entregou `npm run gate` e a Fase 8 estabeleceu a disciplina de "gerado, nunca escrito à mão" com invariantes na suíte — o pipeline novo deve ser alcançável por essas garantias.
- **O critério de "fase pronta"** não foi discutido. O ROADMAP desacopla explicitamente: entregar o schema de `sih_collection_status` cedo destrava a Fase 10 enquanto a coleta longa roda.

### Deferred Ideas (OUT OF SCOPE)

- **Taxa padronizada por idade na interface** — a Fase 9 entrega o dado de população estratificado (D-24), mas ensinar padronização etária é fase futura.
- **Issue upstream no PySUS** sobre o índice de arquivos quebrado da 2.7.0. Fora do caminho crítico.
- **Estender a janela para 2008–2025** — depois que 2013–2025 estiver servida e estável.
- **Migrar os 10 packs de Variáveis para o mesmo caminho de Storage/Supabase** — trabalho de outra fase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIPE-01 | Falha de rede/DNS/parse registrada como falha ruidosa, nunca sucesso com 0 linhas | `## Code Examples` (enumeração determinística + comparação de conjuntos) + `## Common Pitfalls` #10/#11 (comportamento real de `File.download()` sob falha) |
| PIPE-02 | Ledger consultável por (agravo × medida × grão) — refinado para +local +ano por D-13 — app lê | Schema já travado em D-12/D-13/D-14/D-15; `## Architecture Patterns` mostra onde cada camada mora |
| PIPE-03 | Retomável sem duplicar linhas | `## Common Pitfalls` #10 (mecânica real de resume por arquivo) + `## Architecture Patterns` (Camada 1 do ledger) |
| PIPE-04 | Cache bruto só descartado após upload confirmado | `## Validation Architecture` (prova de SC-4) |
| PIPE-05 | Operador verifica que a coleta capturou o que afirma | Camada 1 do ledger (hash + contagem) + `## Common Pitfalls` sobre PostgREST `max-rows` para auditoria via API |
| PIPE-06 | Coleta respeita a fonte remota e sobrevive a execuções longas sem supervisão | `## Common Pitfalls` #11 (isolamento de falha por arquivo) + throttling herdado do scraper aposentado |
| DATA-01 | 4 medidas coletadas para os 331 agravos, grão UF | `## Code Examples` (matcher + agregação), `lista-morb-cid.json` como entrada |
| DATA-02 | 4 medidas coletadas para os 331 agravos, grão município | Idem + D-20/D-21 (Storage particionado) |
| DATA-03 | `taxa_mortalidade` derivável em todo o catálogo | Campo `MORTE` confirmado ao vivo nesta pesquisa (0/1, sem nulos na amostra) |
| DATA-04 | Cada métrica carrega a data em que foi coletada | D-15 (`derived_at`/`cid_map_version` no ledger) |
</phase_requirements>

## Summary

O spike (`2026-08-04-pysus-microdado-spike.md`) já resolveu a pergunta "qual fonte usar" — `pysus==1.0.1` contra o FTP do DATASUS. Esta pesquisa foi além, executando código real contra o FTP ao vivo (não apenas lendo a API): baixou e decodificou um arquivo SIH-RD completo, listou os diretórios de população do IBGE/DATASUS, e rodou uma análise estrutural sobre o próprio `lista-morb-cid.json` do repositório. O resultado muda três coisas concretas que o planner precisa saber antes de desenhar tarefas:

**Primeiro**, a hipótese do D-24 sobre população estratificada está confirmada, mas a rota que o usuário supôs (`pysus.online_data.IBGE.get_population(source='POP')`) está quebrada por um bug de correspondência de substring na própria biblioteca, e a fonte que ele indicava (`POP`) nem cobre 2013–2025. A fonte correta — verificada ao vivo, granularidade de município, idade em ano único e sexo — chama-se `POPSVS` e **não está registrada** na classe de conveniência do PySUS; o pipeline precisa acessá-la pelas primitivas `Directory`/`File` diretamente.

**Segundo**, decodificar um arquivo real revelou que campos numéricos centrais (`VAL_TOT`, `DIAS_PERM`) saem do PySUS como strings com padding de espaço, e que a função de tipagem automática da biblioteca (`parse_dftypes`) é escrita para o SINAN, não para o SIH — ela não corrige nada disso. Qualquer agregação que confie na tipagem "de fábrica" do PySUS vai falhar silenciosamente ou lançar um erro obscuro na soma.

**Terceiro**, uma análise estática do `lista-morb-cid.json` (rodada nesta sessão, reproduzível) encontrou dois pares de códigos que apontam para o mesmo CID-10 exato (`75`/`76` → `B92`; `142`/`274` → `G02`) — uma pista concreta e imediatamente acionável para o trabalho de depuração do SC-7, que a pesquisa anterior não tinha.

Fora essas três descobertas, a pesquisa confirma com alta confiança a forma de baixar (`SIH().load()` + `get_files()` + `download()`), a forma de decodificar (DBC→DBF→parquet, streaming em chunks de 30 mil registros, conversão automática e determinística), os limites reais do plano gratuito do Supabase (500 MB banco / 1 GB Storage / 5 GB egresso + 5 GB egresso cacheado — não 10 GB como um agregador de terceiros afirmou), e um detalhe operacional que muda o desenho do D-17: a conexão direta do Postgres no plano gratuito é só IPv6, e `COPY` precisa do **Session Pooler** (porta 5432 do host de pooler), não da conexão direta nem do Transaction Pooler (que quebra o protocolo `COPY`).

**Primary recommendation:** Um pipeline Python isolado (`uv`-gerenciado, Python 3.11, novo diretório dedicado fora de `scripts/catalog/` e de `trabalhos datasus/`) que (1) enumera os 4.212 arquivos esperados via `pysus.ftp.databases.sih.SIH` antes de baixar qualquer coisa, (2) baixa e decodifica arquivo por arquivo com tratamento de exceção por arquivo (nunca em lote), (3) agrega lendo os diretórios parquet diretamente com `pyarrow` (nunca via `ParquetSet.to_dataframe()`, que usa a tipagem errada), (4) escreve População (`POPSVS`, não `POP`/`POPTCU`), e (5) faz upload via `COPY` sobre o Session Pooler do Postgres. A ponte com o mundo Node é estreita e única: um teste de reconciliação dentro de `npm run gate` que invoca o pipeline Python real via `uv run` contra uma fixture parquet pequena (medida nesta pesquisa: ~140 KB para o ano inteiro de AC/2019).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Enumerar arquivos esperados (SC-1) | Python Collection Pipeline | — | Lista determinística antes de baixar; `SIH.get_files()` roda nesta camada, verificado ao vivo nesta pesquisa |
| Download SIH microdado (.dbc) | Python Collection Pipeline | External Source (FTP DATASUS, sem TLS) | FTP só fala com Python (`pysus`); Node nunca toca a rede do DATASUS |
| Decodificar DBC→DBF→Parquet | Python Collection Pipeline | — | `pyreaddbc`/`dbfread` são extensões Python nativas, sem equivalente Node/JS |
| Matcher CID→categoria + agregação | Python Collection Pipeline | — | Mesma linguagem que o spike validou; um port paralelo em TS duplicaria a lógica e criaria risco de divergência (o "key insight" de Don't Hand-Roll abaixo) |
| Camada 1 do ledger (por arquivo) | Python Collection Pipeline | Filesystem local do operador | Nunca depende de rede (D-12) — é o que sobrevive a uma interrupção de dias |
| Camada 2 do ledger (`sih_collection_status`) | Postgres/Supabase DB | Python Collection Pipeline (escreve via COPY) | App lê via PostgREST anon (Fase 10); Python escreve via Session Pooler + service role |
| Upload COPY + swap transacional | Postgres/Supabase DB | Python Collection Pipeline (driver `psycopg`) | D-17; exige conexão privilegiada, nunca a chave anon nem o bundle |
| Métricas grão UF | Postgres/Supabase DB | Browser/Client (leitura anon) | Cabe no teto gratuito por construção (D-20) |
| Métricas grão município | Supabase Storage/CDN | Browser/Client (fetch sob demanda) | Não cabe no banco gratuito (D-20/D-21) — medido nesta pesquisa como plausível dentro do teto de Storage, a confirmar |
| Partições JSON+gzip (geração) | Python Collection Pipeline | — | Mesmo processo que já tem os dados agregados em memória; gerar em Node exigiria reler o Postgres para os mesmos números |
| Upload das partições ao bucket | Python Collection Pipeline | Supabase Storage/CDN | PUT HTTP simples com `service_role`; ver `## Common Pitfalls` sobre `Content-Encoding` |
| 10 packs de Variáveis (regeneração) | Node Build (`scripts/catalog`) | Postgres/Supabase DB (fonte, via PostgREST) | TAX-06 — mesma disciplina "gerado, nunca escrito à mão" já estabelecida na Fase 8 |
| Reconciliação (gate permanente) | CI/Test (`npm run gate`) | Python Collection Pipeline (matcher real via `uv run`) | D-06 — precisa exercitar o matcher real sobre fixture pequena, não uma reimplementação em TS |
| Raspador mínimo de reconciliação (oráculo) | Python Collection Pipeline (script isolado, D-18) | External Source (TabNet, ponto único e manual) | Nunca em runtime do app; roda a pedido do operador para atualizar a fixture |
| Leitura do ledger/métrica pelo estudante | Browser/Client | Postgres/Supabase DB + Storage | Fase 10 é quem consome; a Fase 9 só entrega o schema e os dados |

## Standard Stack

### Core (Python, `uv`-gerenciado)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pysus` | `1.0.1` (pin exato) | Enumerar e baixar SIH-RD e a base de população do FTP DATASUS; decodifica DBC→DBF→parquet | Decisão já travada pelo spike — a 2.x quebra o índice de arquivos (ver spike §1). Verificado nesta pesquisa: `pip index versions pysus` confirma 1.0.1 no PyPI; `slopcheck` OK; instalado e exercitado ao vivo contra o FTP real nesta sessão [VERIFIED: PyPI + execução ao vivo] |
| `pyarrow` | `25.0.0` (transitivo de `pysus`, sem pin adicional necessário) | Ler os diretórios `.parquet` gerados pelo `pysus` com projeção de coluna, para agregação sem carregar as 113 colunas de cada arquivo | Já é dependência obrigatória do `pysus 1.0.1` (`Requires-Dist: pyarrow (>=11.0.0)`) — usar diretamente evita adicionar `polars` só para o mesmo trabalho. Confirmado ao vivo: `pyarrow.parquet.write_to_dataset` é o que o próprio `pysus` usa para escrever os arquivos que serão lidos de volta [VERIFIED: leitura do código-fonte instalado + execução ao vivo] |
| `psycopg` | `3.3.4` | Conexão Postgres nativa para `COPY` + swap transacional (D-17) | Sucessor mantido do `psycopg2`, suporta `COPY` via `cursor.copy()` com API de streaming; `slopcheck` OK; verificado no PyPI [VERIFIED: PyPI + slopcheck] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dbfread` | `2.0.7` (transitivo) | Leitura de DBF em streaming (30 mil registros por chunk) | Já usado internamente pelo `pysus` — não é preciso chamar diretamente, mas o pipeline pode reusar o mesmo padrão de streaming para o `POPSVS` (arquivos maiores, ~25 MB de DBF por ano) |
| `pyreaddbc` | `2.0.4` (transitivo) | Decodificação nativa DBC→DBF (extensão C) | Idem — chamado internamente por `pysus.data.dbc_to_dbf` |
| `uv` | `0.11.8` (já instalado na máquina) | Gerenciador de ambiente/dependências Python | Substitui `pip`/`venv` manual; `.python-version` fixa 3.11, `uv.lock` versionado garante reprodutibilidade — já confirmado disponível nesta máquina |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pyarrow` para leitura/agregação | `polars` (`scan_parquet`, lazy) | Ergonomia melhor para agregações complexas (`group_by` expressivo), mas é uma dependência **nova** que `pysus` não traz; `pyarrow` já vem de graça. Recomendação: começar com `pyarrow.dataset` + `pandas` só para a fase final de `groupby`; migrar para `polars` só se a ergonomia virar gargalo real |
| `psycopg` (COPY nativo) | `supabase-py` (cliente oficial) | `supabase-py` fala PostgREST/Storage, não Postgres direto — não tem um caminho de `COPY` de verdade; adicionaria uma dependência sem resolver o D-17. Mantém-se útil **só** para o upload das partições de Storage (chamada HTTP simples), onde `urllib.request`/`requests` já bastam |
| `Content-Encoding: gzip` do servidor | `DecompressionStream('gzip')` no cliente | Ver `## Common Pitfalls` — o servidor (via `supabase-js`) não suporta setar o cabeçalho hoje; a descompressão no cliente é a alternativa verificada e sem dependência nova |

**Installation:**
```bash
# Na raiz do novo diretório do pipeline (proposto: pipeline/sih/)
uv init --python 3.11
uv add "pysus==1.0.1" "psycopg[binary]==3.3.4"
# pyarrow, pandas, fastparquet, dbfread, pyreaddbc entram transitivamente via pysus
```

**Version verification:** confirmado ao vivo nesta sessão via `pip index versions pysus` (1.0.1 disponível, latest é 2.7.0 — o pin é intencional, não um esquecimento de atualização) e `pip index versions psycopg` (3.3.4 latest). `uv pip list` dentro de um venv de teste confirmou a árvore completa de dependências transitivas do `pysus==1.0.1`.

## Package Legitimacy Audit

| Package | Registry | Age/Popularidade | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `pysus` | PyPI | Projeto acadêmico (`AlertaDengue/PySUS`), múltiplas releases desde ~2018 | github.com/AlertaDengue/PySUS (não linkado nos metadados do PyPI — sinalizado `NO_REPO` pelo `slopcheck`, mas o repositório existe e é o mesmo já citado no spike) | `OK` (com flag informativo `NO_REPO`) | Approved — já era decisão travada; esta pesquisa reconfirma via `slopcheck` + execução real |
| `pyarrow` | PyPI | Projeto Apache, alta adoção | github.com/apache/arrow | `OK` | Approved |
| `psycopg` | PyPI | Sucessor oficial do psycopg2, mantido pela mesma comunidade | github.com/psycopg/psycopg | `OK` | Approved |
| `polars` | PyPI | Alta adoção, mencionado só como alternativa (não instalado) | github.com/pola-rs/polars | `OK` | Não recomendado como padrão — ver Alternatives Considered |
| `duckdb` | PyPI | Verificado por completude (não recomendado nesta pesquisa) | github.com/duckdb/duckdb | `OK` | Não usado — mencionado apenas para registro de que foi considerado e descartado (pyarrow já resolve sem dependência extra) |

**Packages removed due to slopcheck [SLOP] verdict:** nenhum.
**Packages flagged as suspicious [SUS]:** nenhum. `pysus` recebeu apenas o sinal informativo `NO_REPO` (metadados do PyPI não linkam o repositório-fonte) — mitigado por esta pesquisa ter executado o código instalado diretamente e confirmado que corresponde à descrição do spike (mesmos `ftp.databases.sih`, `ftp.databases.ibge_datasus`, mesma estrutura de `Database`/`Directory`/`File`).

`slopcheck` estava disponível nesta sessão (instalado via `uvx slopcheck`) — nenhum pacote fica com o fallback `[ASSUMED]` por indisponibilidade da ferramenta.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │   FTP DATASUS (ftp.datasus.gov.br, sem TLS)  │
                    │   /SIHSUS/200801_/Dados  +  /IBGE/POPSVS     │
                    └───────────────────┬───────────────────────────┘
                                        │ (1) listar diretório real via FTP LIST
                                        │     -> nomes de arquivo determinísticos
                                        ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │  PYTHON COLLECTION PIPELINE (uv, Python 3.11, roda na máquina      │
   │  do operador — dias, sem supervisão)                              │
   │                                                                     │
   │  enumerate.py                                                      │
   │    computa RD{UF}{AA}{MM} esperado (27×12×13=4212) e IBGE/POPSVS   │
   │    (2013-2025), compara contra SIH().get_files() -> ausência       │
   │    vira falha ruidosa (SC-1) ANTES de qualquer download            │
   │        │                                                            │
   │        ▼                                                            │
   │  download.py  ──(2) por arquivo, try/except individual──▶ ledger  │
   │    File.download() -> .dbc -> .dbf -> .parquet (dir)               │  Camada 1
   │    hash + contagem de registros gravados no ledger local           │  (JSON/SQLite
   │        │                                                            │   local, ao
   │        ▼                                                            │   lado do
   │  aggregate.py                                                      │   parquet)
   │    pyarrow.dataset ler SÓ as colunas necessárias                   │
   │    (DIAG_PRINC, MUNIC_MOV, MUNIC_RES, MORTE, VAL_TOT, DIAS_PERM)   │
   │    -> matcher CID (lista-morb-cid.json + correções D-05)           │
   │    -> agrega por (agravo, medida, grão, local, ano)                │
   │        │                                                            │
   │        ▼                                                            │
   │  reconcile.py  ◀── oráculo TabNet (raspador mínimo D-18, manual) ──┤
   │    compara amostra agregada x 85 pares re-raspados                 │
   │    escreve corrections.json (D-05) com razão por entrada           │
   │    [CHECKPOINT HUMANO D-07 — aprova em lote antes do upload]       │
   │        │                                                            │
   │        ▼                                                            │
   │  upload.py                                                         │
   │    COPY para staging + swap transacional (psycopg, Session Pooler) │
   │    re-lê contagem via PostgREST -> só ENTÃO libera exclusão do     │
   │    cache bruto correspondente (PIPE-04/SC-4)                       │
   │        │                                                            │
   │        ▼                                                            │
   │  partitions.py                                                     │
   │    lê agregados por UF, escreve JSON colunar + gzip                │
   │    faz PUT no Storage bucket (service role)                        │
   └──────────┬───────────────────────────────────────┬─────────────────┘
              │ escreve via COPY (Session Pooler,      │ PUT via REST (service role)
              │ IPv4, porta 5432)                       │
              ▼                                         ▼
   ┌─────────────────────────┐              ┌─────────────────────────────┐
   │ Postgres (Supabase)      │              │ Supabase Storage (bucket     │
   │  sih_disease              │              │ público, leitura anônima)   │
   │  sih_metric_uf (+local)   │              │  {uf}.json.gz (27 arquivos) │
   │  sih_collection_status    │              │  27 partições de município  │
   │  sih_population_uf/muni   │              └──────────────┬──────────────┘
   └──────────┬─────────────────┘                              │
              │ leitura anon (PostgREST)                        │ fetch same-origin
              ▼                                                 ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │  Browser / Client (Vite React app — Fase 10 consome isto)         │
   │  loadCatalog-style fetch + cache em memória (padrão já da Fase 5) │
   └───────────────────────────────────────────────────────────────────┘

   ┌───────────────────────────────────────────────────────────────────┐
   │  NODE BUILD (scripts/catalog/*.mjs) — só entra depois do upload:   │
   │  regenera os 10 packs de public/data/catalog/packs/ lendo Postgres │
   │  via PostgREST (mesmo padrão de generateDiseaseSeeds.mjs)          │
   └───────────────────────────────────────────────────────────────────┘

   ┌───────────────────────────────────────────────────────────────────┐
   │  npm run gate (rápido, todo commit)                                 │
   │  vitest ──▶ shell out `uv run pytest` num pacote Python pequeno     │
   │             que roda o matcher REAL contra a fixture AC/2019        │
   │             (~140 KB parquet, commitado) e compara com o subset     │
   │             congelado dos 85 pares que AC sozinho reproduz          │
   └───────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
pipeline/sih/                    # novo, fora de scripts/catalog e de "trabalhos datasus"
├── pyproject.toml                # uv-gerenciado, Python >=3.10,<3.14 (mesma faixa do pysus)
├── uv.lock                       # versionado, mesma disciplina do package-lock.json
├── .python-version               # "3.11"
├── src/sih_pipeline/
│   ├── enumerate.py               # lista esperada determinística (SC-1)
│   ├── download.py                # loop por arquivo, exceção isolada por arquivo
│   ├── ledger.py                  # Camada 1 (local) — schema compartilhado com upload.py
│   ├── matcher.py                 # porta do cidmatch.py do spike, com testes
│   ├── corrections.py             # lê lista-morb-cid.json + correções D-05, motivo escrito
│   ├── aggregate.py                # pyarrow.dataset -> agregados por chave D-13
│   ├── population.py              # POPSVS (não POP/POPTCU) — ver Common Pitfalls
│   ├── reconcile.py                # compara agregado x fixture/oráculo re-raspado
│   ├── oracle_scrape.py            # raspador mínimo D-18 (porta de post_tabnet/parse_prn_table)
│   ├── upload.py                   # COPY + staging swap via psycopg (Session Pooler)
│   └── partitions.py               # JSON colunar + gzip -> Storage
├── tests/
│   ├── fixtures/rdac1901_2019.parquet   # ~140 KB, ano inteiro AC/2019, só colunas usadas
│   ├── fixtures/oracle_ac_2019.json     # subset dos 85 pares que AC sozinho prova (D-04/D-06)
│   └── test_reconcile_gate.py           # é isto que `npm run gate` invoca via `uv run pytest`
└── README.md                        # documenta o pin de pysus==1.0.1 e o porquê (spike §1-2)
```

### Pattern 1: Enumeração antes de download (SC-1)
**What:** computar a lista completa de arquivos esperados por regra determinística, e só então perguntar ao FTP o que existe — a diferença de conjuntos é a falha.
**When to use:** sempre, antes de qualquer chamada de download em lote.
**Example:**
```python
# Fonte: execução ao vivo nesta pesquisa contra ftp.datasus.gov.br, 2026-08-04
from pysus.ftp.databases.sih import SIH
from pysus.ftp import Directory

UFS = ["RO","AC","AM","RR","PA","AP","TO","MA","PI","CE","RN","PB","PE","AL",
       "SE","BA","MG","ES","RJ","SP","PR","SC","RS","MS","MT","GO","DF"]
YEARS = range(2013, 2026)

s = SIH()
# Carregar SÓ o diretório pós-2007 -- não precisamos do pré-2007, e evita uma
# listagem FTP extra e irrelevante para a janela D-11 (2013-2025).
s.load(directories=[Directory("/dissemin/publicos/SIHSUS/200801_/Dados")])

expected = {
    f"RD{uf}{year % 100:02d}{month:02d}"
    for uf in UFS for year in YEARS for month in range(1, 13)
}  # 27 * 13 * 12 = 4212, confere com D-11/SC-1

actual_files = s.get_files("RD", uf=UFS, year=list(YEARS))
actual = {f.name for f in actual_files}  # f.name já vem sem extensão

missing = expected - actual
if missing:
    # PIPE-01/SC-1: saída não-zero, nunca "OK · 0 linhas"
    raise SystemExit(
        f"FALHA: {len(missing)} arquivo(s) SIH-RD ausentes no FTP: {sorted(missing)[:10]}..."
    )
```

### Pattern 2: Download por arquivo com isolamento de falha (PIPE-06)
**What:** nunca usar `Database.download(files=[...])` (o método de conveniência em lote) para uma corrida de dias — uma exceção em UM arquivo aborta os restantes, porque o laço interno não tem `try/except` por item.
**When to use:** todo o loop principal de coleta.
**Example:**
```python
# Fonte: leitura do código-fonte instalado de pysus==1.0.1 (pysus/ftp/__init__.py,
# classe Database.download) + comportamento verificado ao vivo nesta pesquisa
for file in files_to_download:
    try:
        data = file.download(local_dir=str(cache_dir))  # File.download, não Database.download
        row_count = count_parquet_rows(data.path)
        ledger.mark_collected(file.name, row_count=row_count, sha256=hash_dbc_bytes)
    except Exception as exc:
        # dbf_to_parquet já limpa o .dbf/.parquet parcial e relança em struct.error;
        # outras exceções (rede, disco) também sobem daqui -- captura por arquivo,
        # nunca deixa a exceção propagar e matar o restante da corrida (PIPE-06).
        ledger.mark_failed(file.name, reason=str(exc))
        continue
```

### Pattern 3: Agregação por leitura direta do parquet, sem `ParquetSet.to_dataframe()`
**What:** ler os diretórios `.parquet` que o `pysus` já escreveu usando `pyarrow` diretamente, com projeção de coluna e casting explícito — nunca confiar em `ParquetSet.to_dataframe()`/`parse_dftypes()`.
**When to use:** toda a etapa de agregação.
**Example:**
```python
# Fonte: execução ao vivo nesta pesquisa; ParquetSet.to_dataframe() lida em
# pysus/data/local.py; parse_dftypes() lida em pysus/data/__init__.py
import pyarrow.dataset as ds
import pyarrow.compute as pc

NEEDED_COLUMNS = ["DIAG_PRINC", "MUNIC_MOV", "MUNIC_RES", "MORTE", "VAL_TOT", "DIAS_PERM"]

dataset = ds.dataset(str(parquet_dir), format="parquet")  # o diretório que File.download() produziu
table = dataset.to_table(columns=NEEDED_COLUMNS)  # projeção de coluna: não lê as outras 107

# VAL_TOT/DIAS_PERM chegam como string com padding de espaço (' 459.40', '    2')
# -- cast explícito é obrigatório, não opcional. parse_dftypes() do pysus NÃO
# resolve isto (é escrito para colunas do SINAN: DT_NOTIFIC/DT_SIN_PRI/CODMUNRES/SEXO).
val_tot = pc.cast(
    pc.utf8_trim_whitespace(table["VAL_TOT"]), "float64"
)
dias_perm = pc.cast(
    pc.utf8_trim_whitespace(table["DIAS_PERM"]), "int64"
)
morte = table["MORTE"]  # já vem Int64 (0/1), não precisa de cast
```

### Pattern 4: `COPY` via Session Pooler (D-17)
**What:** a conexão direta do Postgres no plano gratuito do Supabase é só IPv6; `COPY` funciona confiavelmente pelo **Session Pooler** (porta 5432 do host `*.pooler.supabase.com`), não pela conexão direta (arriscada se a rede do operador não tiver saída IPv6) nem pelo Transaction Pooler (porta 6543, quebra o protocolo `COPY`).
**When to use:** todo upload do D-17.
**Example:**
```python
# Fonte: docs.supabase.com/guides/database/connecting-to-postgres (fetch nesta
# pesquisa) + troubleshooting/supavisor-faq. String de conexão real fica em
# variável de ambiente offline, NUNCA commitada (mesma disciplina de .env.local).
import psycopg

# Session Pooler: postgres://postgres.<project-ref>@aws-<region>.pooler.supabase.com:5432/postgres
conn = psycopg.connect(os.environ["SIH_PIPELINE_DB_URL"])  # Session Pooler, não Direct, não Transaction
with conn.cursor() as cur:
    with cur.copy("COPY sih_metric_uf_staging (disease_id, uf_codigo, ano, local, internacoes, obitos, valor_total, dias_permanencia, taxa_mortalidade) FROM STDIN") as copy:
        for row in aggregated_rows:
            copy.write_row(row)
    cur.execute("BEGIN; ... swap staging <-> live ...; COMMIT;")
```

### Pattern 5: Leitura de população — `POPSVS`, não `POP`/`POPTCU`/`get_population()`
**What:** a fonte correta para D-24 (município × sexo × idade em ano único) precisa ser acessada pelas primitivas de baixo nível — a classe de conveniência `IBGEDATASUS` não a registra.
**Example:**
```python
# Fonte: execução ao vivo nesta pesquisa contra ftp.datasus.gov.br, 2026-08-04.
# NÃO usar pysus.online_data.IBGE.get_population(source='POP') -- ver Common Pitfalls.
from pysus.ftp import Directory

popsvs_dir = Directory("/dissemin/publicos/IBGE/POPSVS")
files = {f.name: f for f in popsvs_dir.content}  # POPSBR00 .. POPSBR25 (26 arquivos, 2000-2025)

for year in range(2013, 2026):
    f = files[f"POPSBR{year % 100:02d}"]
    data = f.download(local_dir=str(cache_dir))  # .zip -> caminho bruto (não decodifica sozinho)
    # data é uma string de caminho para o .zip; extrair e ler com dbfread, como
    # pysus.online_data.IBGE._unzip_to_dataframe faz internamente -- mas SEM
    # passar por get_population(), que resolve o diretório errado.
```

### Anti-Patterns to Avoid
- **Chamar `pysus.online_data.SIH`/`pysus.online_data.IBGE` para qualquer coisa além de leitura exploratória interativa:** os módulos de conveniência fazem `SIH().load()`/`IBGEDATASUS().load()` **no import**, disparando uma listagem FTP ao vivo como efeito colateral de `import`. Isso quebra testabilidade (um teste que importa o módulo tenta rede) e adiciona latência desnecessária no caminho de produção. Usar as classes de baixo nível (`pysus.ftp.databases.sih.SIH`, `pysus.ftp.databases.ibge_datasus.IBGEDATASUS`) com `.load(directories=[...])` explícito e escopado.
- **Confiar em `IBGEDATASUS.get_files(source=...)`:** tem um bug de correspondência por substring que resolve `source='POP'` para o diretório `POPTCU` (ver Common Pitfalls). Acessar `Directory` diretamente.
- **Usar `ParquetSet.to_dataframe()` como se fizesse a tipagem certa para SIH:** `parse_dftypes()` é hardcoded para colunas do SINAN.
- **Usar a conexão direta do Postgres (porta 5432, host `db.*.supabase.co`) para `COPY` sem confirmar IPv6 na rede do operador:** prefira o Session Pooler por padrão.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Decodificação DBC→DBF | Parser binário customizado do formato `.dbc` (compactação proprietária DATASUS) | `pyreaddbc` (via `pysus`) | Extensão C já testada pela comunidade PySUS/AlertaDengue há anos; o formato tem detalhes de codificação (latin-1, campos packed-decimal) fáceis de errar |
| Enumeração de arquivos FTP | Parser de `FTP LIST` customizado | `pysus.ftp.Directory`/`File` (1.0.1) | Verificado ao vivo nesta pesquisa: correto, determinístico, reproduz exatamente o padrão `RD{UF}{AA}{MM}` |
| Matching CID→categoria | Novo matcher do zero | Portar/reusar a lógica já validada no spike (`cidmatch.py`) | Já testada contra dado real (0,016% de miss); reescrever arrisca reintroduzir o próprio defeito que o SC-7 existe para caçar |
| Carga em massa no Postgres | `INSERT` linha a linha via ORM/cliente HTTP | `COPY` (psycopg) + staging + swap transacional | Ordens de grandeza mais rápido — é a razão explícita do D-17; milhões de `INSERT`s via PostgREST estourariam tempo e cota de computação do plano gratuito |
| Descompressão gzip no navegador | Biblioteca npm (`pako`, etc.) | `DecompressionStream('gzip')` nativo | Zero dependência nova, Baseline amplamente disponível desde maio de 2023 — honra o precedente "zero deps novas" da Fase 5 |
| Raspagem pontual do oráculo | Framework de scraping novo | Portar `post_tabnet`/`parse_prn_table` de `coleta_sih_multi_disease.py` (D-18) | Já provados contra a resposta real do TabNet; D-18 pede uma ferramenta mínima, não uma reescrita |
| Geração de migração/seed SQL | SQL escrito à mão para as novas tabelas (`sih_collection_status`, população) | Mesmo padrão de `generateRenameMigration.mjs`: gerar a partir de dado versionado, com teste que impede edição manual | É a disciplina já estabelecida na Fase 8 (`renameMigration.test.ts`) — replicar, não reinventar |

**Key insight:** o domínio inteiro desta fase gira em torno de "não duplicar a mesma lógica em dois lugares que podem divergir" — o matcher CID já existe uma vez (no spike, em Python); a disciplina de dado-com-motivo já existe (D-05, imitando `extra-diseases.json`); o padrão de geração de SQL já existe (Fase 8). O trabalho novo real é a canalização (pipeline Python + ledger + upload), não os algoritmos.

## Runtime State Inventory

Não aplicável — esta fase não é rename/refactor/migração de dado existente. É substituição de fonte (D-16), tratada como corte atômico único (a Edge Function `sih-ingest` e o `INGEST_SECRET` são aposentados por remoção, não por migração de estado — ver D-17 e a tabela de riscos do ROADMAP).

## Common Pitfalls

### Pitfall 1: Campos numéricos do SIH chegam como string com padding
**What goes wrong:** `VAL_TOT` e `DIAS_PERM` (e potencialmente outros campos numéricos do DBF) chegam do `pysus` como strings com espaços de preenchimento (`'        459.40'`, `'    2'`), não como `float`/`int`.
**Why it happens:** `dbf_to_parquet()` grava os valores decodificados do DBF praticamente crus (`decode_column` só trata bytes→string, não faz cast numérico); `parse_dftypes()`, chamado por `ParquetSet.to_dataframe()`, só sabe converter `DT_NOTIFIC`/`DT_SIN_PRI`/`CODMUNRES`/`SEXO` — colunas do SINAN, não do SIH.
**How to avoid:** ler o parquet diretamente com `pyarrow`, projetando só as colunas necessárias, e fazer `utf8_trim_whitespace` + `cast` explícito antes de qualquer soma (ver Pattern 3).
**Warning signs:** uma soma de `VAL_TOT` que lança `TypeError`, ou — pior — que silenciosamente vira concatenação de string em vez de soma numérica, dependendo de como a agregação é escrita.
**Confidence:** HIGH — reproduzido ao vivo, arquivo real (`RDAC1901.dbc`) baixado e decodificado nesta sessão.

### Pitfall 2: `parse_dftypes()` é enviesado para o SINAN
**What goes wrong:** qualquer pipeline que use `ParquetSet.to_dataframe()` como "a forma oficial de ler os dados" herda uma função de tipagem escrita para outro sistema de informação (SINAN), não para o SIH.
**Why it happens:** o `pysus` é uma biblioteca multi-sistema (SIH, SIM, SINASC, SINAN, CNES, PNI...); `parse_dftypes()` fica em um módulo compartilhado mas seu conteúdo não é.
**How to avoid:** não depender de tipagem "de fábrica" nenhuma vinda do `pysus` para colunas do SIH — o pipeline deve declarar seu próprio schema de cast (Pattern 3).
**Confidence:** HIGH — leitura direta do código-fonte instalado, `pysus/data/__init__.py::parse_dftypes`.

### Pitfall 3: `IBGEDATASUS.get_files(source='POP')` resolve para o diretório errado
**What goes wrong:** chamar `IBGEDATASUS().load().get_files(source='POP')` retorna o conteúdo do diretório `POPTCU`, não do diretório `POP`.
**Why it happens:** o código de `get_files()` testa `source in dir.path` (substring), iterando pelas 4 `Directory` registradas (`POP`, `censo`, `POPTCU`, `projpop`) sem interromper no primeiro match. Como `"POP" in "/dissemin/publicos/IBGE/POPTCU"` também é verdadeiro, e `POPTCU` vem depois de `POP` na tupla `paths`, a última correspondência (POPTCU) sobrescreve a primeira.
**How to avoid:** nunca chamar `get_files(source=...)`/`get_population(source=...)` para este caso; usar `Directory('/dissemin/publicos/IBGE/<NOME_EXATO>')` diretamente, como no Pattern 5.
**Warning signs:** os arquivos retornados para `source='POP'` e `source='POPTCU'` são idênticos (foi assim que o bug foi encontrado nesta pesquisa — comparando as duas listas).
**Confidence:** HIGH — reproduzido ao vivo duas vezes nesta sessão (via `get_files()` e via `Directory` direto, confirmando a divergência).

### Pitfall 4: A fonte `POP` (a que o docstring anuncia como "1992–presente, estratificada por idade e sexo") não cobre 2013–2025
**What goes wrong:** o diretório `/dissemin/publicos/IBGE/POP` — que é o que a documentação do `pysus` descreve como a série certa para D-24 — na prática só tem arquivos até `POPBR12.zip` (2012). Não há dado 2013–2025 ali.
**Why it happens:** desatualização da fonte no FTP do DATASUS (fora do controle do `pysus` ou desta pesquisa) — o docstring do módulo não reflete o estado real do diretório.
**How to avoid:** não confiar no docstring; usar `POPSVS` (ver próximo pitfall) para a janela 2013–2025.
**Confidence:** HIGH — listagem completa do diretório obtida ao vivo nesta sessão (33 arquivos, o mais recente é `POPBR12.zip`).

### Pitfall 5: A fonte correta para D-24 é `POPSVS`, e não está registrada em `IBGEDATASUS.paths`
**What goes wrong:** nenhuma das três fontes que o `pysus 1.0.1` expõe pela classe de conveniência (`POP`, `POPTCU`, `projpop`) entrega, ao mesmo tempo, granularidade de **município** E estratificação por **sexo e idade**: `POP` está desatualizada (pitfall acima), `POPTCU` é só total por município (sem sexo/idade), `projpop` é estratificada mas só **UF** (não município).
**How to avoid:** o diretório `/dissemin/publicos/IBGE/POPSVS` — que existe no FTP e **não está em `IBGEDATASUS.paths`** — tem exatamente o que falta: `POPSBR{AA}.zip` → `.dbf` com colunas `COD_MUN` (7 dígitos), `ANO`, `SEXO` (`'1'`/`'2'`), `IDADE` (`'000'`–`'080'`, ano único, `080` = "80 anos ou mais"), `POP`. Cobre 2000–2025 (26 arquivos), fechando 2013–2025 sem lacuna. Acessar via `Directory('/dissemin/publicos/IBGE/POPSVS')` diretamente (Pattern 5). O nome `POPSVS` = população-base da Secretaria de Vigilância em Saúde — a mesma base institucional usada como denominador padrão em cálculos de taxa hospitalar/mortalidade do SUS, o que a torna metodologicamente mais alinhada ao numerador SIH do que `POPTCU` (população para repasse fiscal/TCU) `[ASSUMED: interpretação institucional do nome POPSVS — ver Assumptions Log A3]`.
**Confidence:** HIGH para a estrutura de dados (baixada e decodificada ao vivo: 902.340 registros para 2019 = 5.570 municípios × 81 idades × 2 sexos, exato). MEDIUM para a recomendação de qual fonte é a "certa" institucionalmente — ver Assumptions Log.

### Pitfall 6: UF (D-24) deve ser derivada de `POPSVS`, não misturada com `projpop`
**What goes wrong:** usar `projpop` (que É estratificada por sexo/idade em nível de UF) como a fonte de UF e `POPSVS` como fonte de município criaria dois números de "população total" possivelmente divergentes para a mesma UF/ano (metodologias de estimativa diferentes entre bases do IBGE/DATASUS).
**How to avoid:** derivar UF por agregação de `POPSVS` (soma dos municípios cujo `COD_MUN` começa com o código de UF de 2 dígitos), garantindo que UF e município sempre somem de forma consistente — o mesmo princípio de fonte única que motivou D-20.
**Confidence:** MEDIUM — recomendação de desenho, não um fato observável diretamente.

### Pitfall 7: Codificação de `SEXO` diverge entre SIH e população
**What goes wrong:** o SIH (AIH) usa `SEXO ∈ {1, 3}` (observado ao vivo nesta pesquisa: 1.222 registros `SEXO=1`, 2.062 `SEXO=3`, zero `SEXO=2`); `POPSVS` usa `SEXO ∈ {1, 2}`. Um join ingênuo entre numerador (SIH) e denominador (população) por valor bruto de `SEXO` alinharia errado o sexo feminino.
**How to avoid:** normalizar `SEXO` para um código canônico (`'M'`/`'F'`) no momento da agregação, em ambas as fontes, documentado num único lugar.
**Confidence:** HIGH para os valores observados (`{1,3}` no SIH, `{1,2}` no POPSVS, ambos medidos ao vivo). MEDIUM para a interpretação exata de "1=Masculino" em cada fonte — ver Assumptions Log (convenção DATASUS padrão, não confirmada contra um dicionário de dados oficial nesta sessão).

### Pitfall 8: Retomada é por arquivo, não por byte — e isso é uma boa notícia
**What goes wrong (aparente):** `File.download()` escreve diretamente no caminho final (`open(filepath, "wb")`), sem arquivo temporário + rename atômico. Um crash no meio do download deixaria um `.dbc` corrompido.
**What actually happens:** a checagem de "já existe" em `File.download()` só olha para `.parquet`, `.dbf` ou sem extensão — nunca para um `.dbc` parcial. Então, na próxima execução, o arquivo é baixado **de novo do zero** (o `open(..., "wb")` trunca o parcial anterior). Não há corrupção silenciosa: ou o arquivo está completo (decodifica), ou é re-baixado inteiro.
**How to leverage:** a granularidade real de "retomada sem duplicar" (PIPE-03) é o **arquivo `RD{UF}{AA}{MM}` inteiro** — exatamente o grão que a Camada 1 do ledger (D-12) já assume. O ledger não precisa (e não deve) tentar rastrear progresso dentro de um arquivo.
**Confidence:** HIGH — leitura direta do código-fonte instalado (`pysus/ftp/__init__.py::File.download`).

### Pitfall 9: Um arquivo corrompido derruba o lote inteiro se usado o método de conveniência
**What goes wrong:** `dbf_to_parquet()` captura `struct.error` (DBF corrompido), limpa os artefatos parciais e **relança** a exceção. `Database.download(files=[...])` (o método em lote) não tem `try/except` por item no laço — uma exceção em um arquivo aborta os restantes da chamada.
**How to avoid:** nunca chamar o método de lote para a corrida principal; chamar `File.download()` individualmente, com `try/except` por arquivo, gravando falha no ledger e seguindo em frente (PIPE-06) — ver Pattern 2.
**Confidence:** HIGH — leitura direta do código-fonte instalado.

### Pitfall 10: Dados de competências recentes chegam e são revisados por meses
**What goes wrong:** ao medir ao vivo nesta pesquisa (2026-08-04), os 12 meses de 2025 para AC já estavam **todos presentes**, mas com datas de modificação escalonadas de fevereiro a julho de 2026 — ou seja, o arquivo de dezembro/2025 só foi publicado ~7 meses depois. Isso confirma o mecanismo por trás do D-13 ("2025 ainda incompleto... o que acontece todo ano"), mas com uma correção: **no momento desta pesquisa, 2025 já está completo** — o ano "incompleto" é sempre o mais próximo do presente no momento da coleta, não necessariamente 2025.
**How to avoid:** o desenho já correto do D-13 (chave do ledger inclui `ano`, e a lista esperada é computada antes de baixar) lida com isso corretamente **desde que a checagem de completude rode no momento real da coleta**, não assuma de antemão qual ano está incompleto.
**Extra nuance:** o FTP já tinha arquivos de 2026 (Jan–Mar) no momento desta pesquisa — o filtro de janela 2013–2025 (D-11) precisa ser um filtro explícito do pipeline, não uma suposição sobre o que "existe" no FTP.
**Confidence:** HIGH — medido ao vivo, com timestamps reais.

### Pitfall 11: `Content-Encoding: gzip` não é suportado pelo SDK de upload do Supabase Storage hoje
**What goes wrong:** a ideia registrada em "Claude's Discretion" (JSON colunar + gzip, servido com `Content-Encoding: gzip` para descompressão nativa do navegador) depende de poder setar esse cabeçalho no upload. `supabase-js`'s `storage.from(bucket).upload()` **não suporta** `contentEncoding` como opção — é uma issue aberta (`supabase/supabase-js#1883`, aberta 2025-11-21, ainda sem PR mesclado no momento desta pesquisa).
**How to avoid:** não depender do `Content-Encoding` do servidor. Fazer o upload do `.json.gz` como um blob opaco (`Content-Type: application/octet-stream` ou similar) e descomprimir explicitamente no cliente com `DecompressionStream('gzip')` (Web API nativa, Baseline amplamente disponível desde maio de 2023 — funciona em todos os browsers relevantes para uma sala de aula em 2026). Isso também é mais robusto: não depende de nenhum comportamento de CDN/cache do Supabase em relação a `Content-Encoding`.
**Open question:** o endpoint S3-compatível do Supabase Storage (que fala o protocolo S3 genérico, que TEM suporte nativo a `Content-Encoding` como metadado de objeto) pode ser um caminho alternativo não testado nesta pesquisa — ver `## Open Questions (RESOLVED)`.
**Confidence:** HIGH para a limitação do SDK JS (issue verificada ao vivo). LOW/não verificado para o caminho S3.

### Pitfall 12: Conexão direta do Postgres no plano gratuito é só IPv6
**What goes wrong:** a string de conexão "Direct" do Supabase (`db.<ref>.supabase.co:5432`) resolve para um endereço IPv6 no plano gratuito (o add-on de IPv4 dedicado é pago — e o hard constraint desta fase proíbe qualquer pagamento). Se a rede do operador (casa, universidade) não tiver saída IPv6 funcional, a conexão falha com "Network is unreachable".
**How to avoid:** usar o **Session Pooler** (`aws-<region>.pooler.supabase.com:5432`) para o `COPY` do D-17 — é IPv4-compatível E suporta `COPY` (diferente do Transaction Pooler, porta 6543, que quebra o protocolo `COPY`). Ver Pattern 4.
**Confidence:** HIGH — confirmado via documentação oficial do Supabase (fetch nesta pesquisa) e cruzado com múltiplas fontes secundárias concordantes.

### Pitfall 13: `PostgREST` limita a 1000 linhas por página por padrão
**What goes wrong:** qualquer leitura via API (inclusive uma ferramenta de auditoria do operador para PIPE-05, ou o app da Fase 10) que não pagine explicitamente recebe só as primeiras 1000 linhas, com HTTP 200 — o mesmo defeito já documentado em MAPA-06/`content-range: 0-999/6481`.
**How to avoid:** qualquer leitura em massa de `sih_collection_status` (~69 mil linhas) ou `sih_metric_uf` (~232 mil linhas com os 2 locais) via PostgREST precisa paginar com `.range()`/cabeçalho `Range`, ou o limite do projeto precisa ser elevado no Dashboard (Settings → API → Max Rows) — mas subir o limite sozinho não resolve para tabelas maiores que o novo teto, então paginação continua sendo a solução correta.
**Confidence:** HIGH — já era conhecido do ROADMAP (MAPA-06); confirmado novamente via documentação oficial nesta pesquisa (`db-max-rows`, default 1000).

### Pitfall 14: FTP do DATASUS é texto plano, sem TLS
**What goes wrong:** `ftplib.FTP` (usado internamente pelo `pysus`) conecta em `ftp.datasus.gov.br` sem criptografia. Um atacante na posição de rede poderia, em tese, adulterar os bytes do `.dbc` em trânsito.
**How to avoid:** não é um problema resolvível pelo pipeline (o servidor não oferece FTPS) — a mitigação prática é a própria Camada 1 do ledger (hash + contagem de registros), que detecta corrupção grosseira, combinada com o fato de que o dado é público e não-sensível (sem PII — confirmado: as 113 colunas do arquivo real baixado nesta pesquisa não incluem nome, CPF ou qualquer identificador direto de paciente). Registrar esta limitação explicitamente em vez de fingir que não existe.
**Confidence:** HIGH — protocolo confirmado pela leitura do código-fonte (`FTP("ftp.datasus.gov.br")`, sem wrapper TLS).

## Code Examples

### Matcher CID — as cinco formas de valor (referência, já validada no spike)
```python
# Fonte: .planning/notes/2026-08-04-pysus-microdado-spike.md §4 (já implementado e
# testado no spike; reproduzir a mesma lógica, não reinventar)
def match_category(diag_princ: str, cid_map: dict[str, str]) -> str | None:
    """diag_princ: DIAG_PRINC bruto (3 ou 4 caracteres, sem ponto)."""
    diag4 = diag_princ  # ex: "A183" -> comparar como "A18.3"
    diag3 = diag_princ[:3]
    for code, value in cid_map.items():
        for token in value.split(","):
            token = token.strip()
            if "-" in token:
                start, end = [t.strip() for t in token.split("-")]
            else:
                start = end = token
            if "." in start:
                # forma 4-char (exata ou faixa) -- comparar contra diag4 formatado com ponto
                diag4_dotted = f"{diag3}.{diag_princ[3]}" if len(diag_princ) == 4 else None
                if diag4_dotted and start <= diag4_dotted <= end:
                    return code
            else:
                # forma 3-char (simples ou faixa) -- cobre TODOS os subcódigos
                if start <= diag3 <= end:
                    return code
    return None
```

### Overlap check — a ferramenta de diagnóstico estrutural usada nesta pesquisa
```python
# Reproduzível: rodar contra scripts/catalog/lista-morb-cid.json a qualquer momento
# (achado nesta pesquisa: 2 pares de códigos colidem -- ver Pitfall/Finding abaixo)
import json

d = json.load(open("scripts/catalog/lista-morb-cid.json"))

def parse_token(tok):
    tok = tok.strip()
    start, end = ([t.strip() for t in tok.split("-")] if "-" in tok else (tok, tok))
    kind = "4" if "." in start else "3"
    return kind, start, end

def bounds(tok):
    kind, start, end = tok
    return (start, end + "~") if kind == "3" else (start, end)

def overlap(a, b):
    (loA, hiA), (loB, hiB) = bounds(a), bounds(b)
    return not (hiA < loB or hiB < loA)

entries = {c: [parse_token(p) for p in v.split(",")] for c, v in d.items()}
codes = list(entries)
for i in range(len(codes)):
    for j in range(i + 1, len(codes)):
        for t1 in entries[codes[i]]:
            for t2 in entries[codes[j]]:
                if overlap(t1, t2):
                    print(codes[i], t1, "<->", codes[j], t2)
# Saída medida nesta sessão:
#   75 ('3', 'B92', 'B92') <-> 76 ('3', 'B92', 'B92')
#   142 ('3', 'G02', 'G02') <-> 274 ('3', 'G02', 'G02')
```

### Cliente — descompressão gzip nativa (substitui `Content-Encoding` do servidor)
```typescript
// Fonte: MDN Compression Streams API (Baseline amplamente disponível desde mai/2023)
// Usar no mesmo padrão fetch same-origin + cache em memória que loadCatalog já estabelece
async function fetchGzippedPartition(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.body) throw new Error(`sem corpo de resposta: ${url}`);
  const decompressed = response.body.pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(decompressed).text();
  return JSON.parse(text);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Raspagem TabNet agravo-a-agravo (`coleta_sih_multi_disease.py`), uma requisição HTTP por (agravo × medida) | Download único do microdado SIH-RD via `pysus==1.0.1`, agregação local | Decidido no spike de 2026-08-04, confirmado nesta pesquisa | 424 de 654 CSVs com 0 bytes vira, em princípio, um único download determinístico e verificável antes de subir qualquer coisa |
| `pysus` 2.x (índice de arquivos quebrado, retorna RJ/SP sob o nome de RD) | `pysus==1.0.1` pinado explicitamente | Decisão travada no spike, reconfirmada ao vivo nesta pesquisa (2.7.0 é a `latest` no PyPI — o pin é deliberado) | Sem o pin, uma atualização automática de dependência reintroduziria o defeito silenciosamente |
| Edge Function `sih-ingest` + `INGEST_SECRET` em texto plano | `COPY` direto via Postgres (Session Pooler), sem Edge Function | D-17 | Elimina a superfície do segredo por remoção, não por rotação |
| Upload HTTP linha a linha / em lotes pequenos | `COPY` para staging + swap transacional | D-17 | Ordens de grandeza mais rápido; atomicidade "de graça" |

**Deprecated/outdated:**
- `pysus.online_data.SIH`/`pysus.online_data.IBGE` (módulos de conveniência) para uso em pipeline de produção — mantêm efeito colateral de rede no import e (para IBGE) um bug de resolução de diretório.
- `scripts/catalog/uploadSihToSupabase.mjs`, `trabalhos datasus/scripts/{coleta_sih_multi_disease,scrape_upload_sih,launch_overnight}.py` — todos aposentados por D-18/D-19.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Interpretação de que `SEXO=1` significa "Masculino" tanto no SIH (AIH) quanto no `POPSVS`, e que `SEXO=3` no SIH e `SEXO=2` no `POPSVS` significam "Feminino" | Pitfall 7 | Se a convenção for diferente do assumido, o denominador de taxa por sexo fica trocado — silenciosamente, porque ambos os valores são códigos numéricos válidos em ambas as fontes |
| A2 | Interpretação de que `IDADE='080'` no `POPSVS` é um bin aberto ("80 anos ou mais"), não um valor discreto | Pitfall 5 | Afeta apenas o desenho de faixas etárias agregadas (fase futura, fora do escopo desta fase) — risco baixo dado que D-24 só armazena, não ensina padronização etária |
| A3 | Interpretação de que `POPSVS` (nome = população-base da Secretaria de Vigilância em Saúde) é a fonte institucionalmente mais alinhada como denominador de taxas hospitalares/mortalidade do SUS, em vez de `POPTCU` | Pitfall 5, Standard Stack | Se `POPTCU` for na verdade a base que o TabNet usa para as taxas que a Fase 9 tenta reconciliar, o denominador ficaria sistematicamente diferente do que o TabNet usaria — vale uma confirmação humana antes de travar como fonte única (D-24 já pede isso: "hipótese a confirmar") |
| A4 | CID-10 B91 = sequelas de poliomielite, B92 = sequelas de hanseníase (usado para interpretar o achado de sobreposição código 75/76) | Common Pitfalls / SC-7 debugging leads (abaixo) | Se a memória de treinamento estiver errada sobre o código B91 exato, a pista fica menos específica — mas o achado estrutural em si (75 e 76 apontam para o mesmo valor `B92` em `lista-morb-cid.json`, o que é uma inconsistência independentemente de qual é o código "correto") continua válido e verificado |
| A5 | Estimativas de tamanho de partição por UF de Storage (Storage Partition Sizing, abaixo) são um cálculo aproximado, não uma medição | Storage Partition Sizing | Se a estimativa subestimar o tamanho real (ex.: SP muito maior que os ~15-20% assumidos da linha de base), uma partição pode passar do limite de 50 MB por objeto do plano gratuito — por isso D-21 já exige medição real antes de travar, e esta pesquisa reforça essa exigência com a math explícita |

## Open Questions (RESOLVED)

As três perguntas abertas desta pesquisa foram **resolvidas durante o planejamento da Fase 9**. Cada
uma carrega abaixo um marcador `RESOLVED:` nomeando o plano que a resolve e como. Nenhuma delas
permanece como pendência de pesquisa.

1. **O endpoint S3-compatível do Supabase Storage aceita `Content-Encoding` como metadado nativo de objeto (via `aws s3 cp --content-encoding gzip` ou `PutObject`)?**
   - What we know: o SDK `supabase-js` não suporta isso (issue aberta, confirmada). A documentação de autenticação S3 do Supabase não menciona metadados de objeto explicitamente.
   - What's unclear: se o servidor de Storage (que implementa o protocolo S3 de forma bastante completa) preserva e ecoa esse cabeçalho.
   - Recommendation: não é bloqueante — a recomendação primária (`DecompressionStream` no cliente) já resolve o problema sem depender disso. Só vale testar se, no futuro, quiser eliminar a descompressão explícita no cliente.
   - **RESOLVED** pelo plano `09-09`: o consumidor `src/features/catalog/loadMunicipioPartition.ts` descomprime com `DecompressionStream('gzip')` no cliente, e os critérios de aceitação da Task 1 e da Task 3 proíbem tanto depender de `Content-Encoding` do servidor quanto acrescentar dependência npm de descompressão (`pako`/`fflate`/`jszip`). O endpoint S3-compatível deixa de ser caminho necessário e fica registrado como possibilidade futura, não como pendência desta fase.

2. **Qual é exatamente a semântica de exclusão nas categorias "resto de..." do `nibr.def` do TabNet, além dos dois pares de duplicata exata encontrados nesta pesquisa?**
   - What we know: a análise estrutural encontrou apenas 2 pares de sobreposição exata (75/76→B92; 142/274→G02) — não é o suficiente para explicar sozinho um viés sistemático de +3,45% mediano em dezenas de categorias divergentes.
   - What's unclear: o mecanismo por trás da maioria das divergências (obstétrico +15%, apêndice +15%, diabetes +14%) continua sem uma causa estrutural estática identificada — pode ser o efeito de competência×processamento (já parcialmente medido no spike, reduz mas não elimina), ou outra semântica do `.def` não visível na renderização HTML plana que `lista-morb-cid.json` capturou.
   - Recommendation: o planner deve tratar os 2 achados desta pesquisa como as duas primeiras entradas concretas da tabela de correções do D-05, e usar o procedimento de depuração AC/2019 (D-03) para o restante — ver `## Validation Architecture` para o desenho do gate que precisa acompanhar essa depuração.
   - **RESOLVED** pelos planos `09-08` e `09-11`: a Task 2 do `09-08` abre `scripts/catalog/cid-corrections.json` justamente com os dois pares de sobreposição exata (75/76→B92 e 142/274→G02) e depura o restante categoria a categoria contra AC/2019, registrando no relatório inclusive as hipóteses descartadas por medição; o `09-11` confirma o resultado numa UF grande e dá saída explícita ao que resistir (aprovar, devolver uma vez ao `09-08`, ou registrar como divergência não explicada honesta com as hipóteses descartadas listadas). A semântica do `.def` deixa de ser bloqueio de pesquisa e vira trabalho de depuração produtora de evidência, com gate permanente no `09-11` Task 3.

3. **O agregado por UF (D-24) deve vir de somar `POPSVS` por prefixo de `COD_MUN`, ou existe uma tabela oficial de totais por UF que já é o que o TabNet usa como denominador de taxa?**
   - What we know: `projpop` (`PROJUF*.dbf`) já vem pronto por UF, estratificado por sexo/idade — mas é uma fonte diferente de `POPSVS`.
   - What's unclear: se os dois convergem numericamente ou não.
   - Recommendation: preferir agregação de `POPSVS` por consistência interna (Pitfall 6); medir a diferença contra `projpop` como checagem de sanidade durante a implementação, não como bloqueio de pesquisa.
   - **RESOLVED** pelo plano `09-06`: a Task 1 agrega a UF a partir do próprio `POPSVS` por prefixo de `COD_MUN` (consistência interna, Pitfall 6, com teste que afirma que UF é igual à soma dos seus municípios), e a Task 2 mede a diferença percentual `POPSVS` × `POPTCU` para ao menos uma UF/ano e a apresenta ao usuário no checkpoint de decisão que confirma a fonte única do denominador — o D-24 tratado como hipótese a confirmar, exatamente como pedido.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Python ≥3.10,<3.14 | `pysus==1.0.1` (Requires-Python) | ✓ (via `python3.11`, não o `python3` do sistema) | 3.11.15 | — (obrigatório; `python3` do sistema em 3.9.6 não serve, já documentado no CONTEXT) |
| `uv` | Gerenciamento de ambiente/dependências Python | ✓ | 0.11.8 | — |
| Acesso de rede ao FTP `ftp.datasus.gov.br` (porta 21, sem TLS) | Download SIH-RD e população | ✓ (confirmado ao vivo nesta pesquisa — download real de `RDAC1901.dbc`, `POPTBR19.zip`, `POPSBR19.zip` bem-sucedidos) | — | — |
| `slopcheck` (via `uvx`) | Auditoria de legitimidade de pacote | ✓ | instalado sob demanda nesta sessão | — |
| Conexão IPv6 de saída na rede do operador (para a conexão "Direct" do Postgres) | D-17, **se** usada a conexão direta | Não verificável a partir deste ambiente de pesquisa (depende da rede real do operador no dia da execução) | — | Usar o **Session Pooler** (IPv4) em vez da conexão Direta — ver Pitfall 12; recomendado como padrão, não como fallback condicional |
| Senha do banco Postgres (não apenas a `service_role` key) | D-17 (`COPY`) | Pré-requisito operacional já sinalizado no D-17 do CONTEXT — não verificável nesta pesquisa | — | Bloqueante se ausente — precisa ser buscada no Dashboard antes da execução do upload |
| Docker (para eventual ensaio local de migração, seguindo o padrão da Fase 8) | Opcional — só se o planner quiser repetir o padrão de ensaio local da 08-08 para as novas tabelas | Não testado nesta pesquisa | — | As novas tabelas (`sih_collection_status`, população) são aditivas (não tocam `sih_metric_uf`/`sih_metric_muni` em ciclos de renomeação como a Fase 8 fez) — o risco de um ensaio local dedicado é bem menor; o planner pode decidir que não é necessário |

**Missing dependencies with no fallback:**
- Senha do banco Postgres — pré-requisito operacional que precisa ser resolvido antes da Task de upload, não uma decisão de arquitetura.

**Missing dependencies with fallback:**
- Conexão IPv6 direta — o Session Pooler é o caminho recomendado por padrão (não é preciso testar IPv6 primeiro e cair para o pooler; ir direto ao pooler evita a dependência).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (Node) | `vitest` (já em uso — `^4.1.10`) |
| Framework (Python, novo) | `pytest` (a adicionar via `uv add --dev pytest`) |
| Config file | `vitest` já configurado; `pyproject.toml` do novo `pipeline/sih/` precisa de seção `[tool.pytest.ini_options]` |
| Quick run command | `npm run test:run` (encadeia `catalog:validate` + `vitest run`; a Task do planner precisa adicionar o passo `uv run pytest` a este encadeamento) |
| Full suite command | `npm run gate` (`test:run` + `build`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| PIPE-01/SC-1 | Ausência de arquivo esperado é falha ruidosa (saída não-zero) | unit (Python) | `uv run pytest tests/test_enumerate.py::test_missing_file_raises -x` | ❌ Wave 0 |
| PIPE-03/SC-3 | Reexecutar após interrupção não duplica linhas | integration (Python, contra fixture local) | `uv run pytest tests/test_ledger.py::test_resume_no_duplicate -x` | ❌ Wave 0 |
| PIPE-04/SC-4 | Cache só é apagado após contagem re-lida do Supabase conferir | integration (Python, contra staging local ou mock de conexão) | `uv run pytest tests/test_upload.py::test_cache_deleted_only_after_row_count_match -x` | ❌ Wave 0 |
| DATA-03 | `taxa_mortalidade` derivável a partir de `MORTE` | unit (Python) | `uv run pytest tests/test_aggregate.py::test_taxa_mortalidade_from_morte -x` | ❌ Wave 0 |
| SC-7 | Reconciliação de amostra reproduz o subset do oráculo que AC/2019 sozinho prova | **gate permanente**, invocado por `npm run gate` | `uv run pytest tests/test_reconcile_gate.py -x` (chamado de dentro de um script npm) | ❌ Wave 0 — é o gate central desta fase (D-06) |
| PIPE-02 (schema) | `sih_collection_status` existe e é lido pelo app com a chave anon | integration (Node, contra Supabase real ou mock) | teste `vitest` equivalente ao padrão já usado para `sih_metric_uf` na Fase 8 | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:run` (Node) — o passo Python (`uv run pytest`) deve ser rápido o bastante (fixture de ~140 KB, não os 10 GB) para entrar no mesmo encadeamento sem alongar o loop de commit.
- **Per wave merge:** `npm run gate` completo.
- **Phase gate:** suíte completa verde antes de `/gsd:verify-work`; adicionalmente, a corrida real de coleta (dias, fora do gate) precisa terminar e ter sua contagem final auditada manualmente (PIPE-05) antes do checkpoint de upload (D-07).

### Como cada critério de sucesso é PROVADO (não apenas afirmado)

**SC-1 (falha ruidosa por arquivo ausente):** um teste que monta uma lista esperada fixa (ex.: 3 UFs × 2 meses) e passa para a função de comparação um conjunto "atual" com um item faltando de propósito — a asserção é que a função levanta exceção/retorna código de saída não-zero, **nunca** que ela retorna silenciosamente "0 ausentes". Não depende de rede: a chamada real ao FTP (`SIH.get_files()`) é testada separadamente, uma vez, manualmente (não é candidata a teste automatizado de `gate`, porque dependeria de rede).

**SC-3 (retomada idempotente, sem duplicar linhas):** um teste de integração que (1) roda o `upload.py`/`COPY` uma vez contra um Postgres de teste (local via Docker, seguindo o padrão já estabelecido na Fase 8 08-08, ou uma tabela de staging descartável no mesmo projeto de teste), (2) interrompe a simulação a meio caminho (mata o processo ou simula uma exceção), (3) reexecuta do zero, e (4) afirma que a contagem final de linhas é igual à contagem esperada — nem a mais, nem a menos. A garantia estrutural que sustenta isso é o `staging + swap` do D-17: o `swap` só acontece depois que o `COPY` inteiro terminou sem erro, então uma interrupção nunca deixa a tabela viva em estado parcial — o teste prova exatamente essa propriedade.

**SC-4 (cache só apagado após contagem re-lida conferir):** um teste que usa um mock/stub da chamada PostgREST de contagem, force-a a retornar um número **diferente** do esperado, e afirma que a função de limpeza de cache **não** é chamada nesse caminho — só é chamada no caminho onde o mock retorna o número certo. É um teste de contrato (a ordem das chamadas), não um teste de rede real.

**SC-7 (reconciliação com o TabNet) como gate permanente e barato:** este é o desenho central do D-06, detalhado nesta pesquisa (`## Architecture Patterns`, Pattern 6 implícito na estrutura de diretórios):
1. **Fixture de entrada:** `tests/fixtures/rdac1901_2019.parquet` — o ano inteiro de AC/2019 (12 meses), só com as colunas necessárias (`DIAG_PRINC`, `MUNIC_MOV`, `MORTE`, `VAL_TOT`, `DIAS_PERM`). Medido nesta pesquisa: um único mês (RDAC1901) decodifica para 11,5 KB de parquet; um ano inteiro fica na faixa de ~140–250 KB — trivial de commitar no git, ordens de grandeza abaixo dos 10 GB totais.
2. **Fixture de oráculo:** `tests/fixtures/oracle_ac_2019.json` — **apenas o subconjunto dos 85 pares que AC/2019 sozinho pode reproduzir** (os pares cuja UF é AC), re-raspado ao vivo do TabNet por D-04 antes de ser confiado. Os pares da UF grande usada para confirmar (D-03: SP ou MG) **não** entram nesta fixture — essa confirmação acontece uma vez, manualmente, durante a execução da fase, não dentro do gate rápido (um ano inteiro de SP mede ~16 MB só o `.dbc` de um mês, grande demais para um fixture de gate leve).
3. **O teste:** roda o matcher real + camada de correções (D-05) sobre a fixture, agrega, e compara contra o oráculo — exato ou com razão registrada (D-02), nunca banda de tolerância.
4. **A ponte Node→Python:** um script npm novo (proposto: `pipeline:reconcile-gate`) que faz `uv run pytest tests/test_reconcile_gate.py` dentro de `pipeline/sih/`, encadeado em `test:run`/`gate` do jeito que `catalog:validate` já é hoje. CI (`.github/workflows/ci.yml`) precisa instalar `uv` (ação oficial `astral-sh/setup-uv`, pinada por SHA de commit — mesma disciplina já em uso no workflow atual) antes do passo `npm run gate`.

**Fixture do oráculo, dado D-04 (o oráculo é re-raspado ao vivo antes de ser confiado):** o fixture congelado não é o CSV antigo do pipeline aposentado — é o resultado de rodar o raspador mínimo (D-18) uma vez, manualmente, contra o TabNet real, filtrando para os pares onde UF=AC. Cada entrada carrega: código do agravo, ano, valor TabNet, data da raspagem. Qualquer refresh futuro do oráculo é um comando explícito e documentado (`uv run python -m sih_pipeline.oracle_scrape --uf AC --year 2019`), nunca parte do `gate` automático — honra o padrão "snapshot versionado em vez de fetch() ao vivo" já estabelecido na Fase 8 D-09.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|---------------------|
| V2 Authentication | Não | App permanece sem login (fora de escopo do milestone); N/A |
| V3 Session Management | Não | N/A |
| V4 Access Control | Sim | RLS `select`-only para `anon` nas tabelas novas (`sih_collection_status`, tabelas de população) e no bucket de Storage (bucket "Public" para leitura, sem policy de escrita para `anon`/`authenticated`); toda escrita (COPY, upload de partição) usa `service_role`/senha do banco, nunca a chave anon |
| V5 Input Validation | Sim | Enumeração determinística (Pattern 1) valida a existência do arquivo antes de processar; cast explícito de campos numéricos (Pattern 3) evita que um valor malformado do DBF vire silenciosamente `NaN`/string concatenada; o raspador mínimo do oráculo (D-18) precisa validar a forma da resposta HTML do TabNet antes de confiar no `<PRE>` extraído (o parser já existente, `parse_prn_table`, levanta `RuntimeError` se o bloco `<PRE>` não existir — reusar esse comportamento) |
| V6 Stored Cryptography | Não diretamente | Nenhum segredo de usuário é armazenado por esta fase; a senha do banco/`service_role` key vivem só em variável de ambiente local do operador, nunca no repositório (mesma disciplina de `.env.local`, já no `.gitignore`) |
| V8 Data Protection | Sim (dado público, mas verificar) | Confirmado nesta pesquisa: as 113 colunas de um arquivo SIH-RD real não incluem nome, CPF ou qualquer identificador direto de paciente — é dado agregável sem risco de PII direta. Vale registrar essa confirmação explicitamente na documentação da fase, já que a pergunta "este dado tem PII?" é razoável de se fazer sobre um sistema hospitalar |
| V12 Files and Resources | Sim | O pipeline Python precisa de um guard de path equivalente ao `corpusPath()`/`assertNotTombstone` já estabelecido em `scripts/catalog/paths.mjs` — qualquer escrita de arquivo (parquet cache, ledger local) deve ficar dentro de um diretório permitido, nunca resolver caminho a partir de entrada não confiável |
| V13 API and Web Service | Sim | Endpoints PostgREST (anon) e Storage (leitura pública) — paginação obrigatória para não cair no truncamento silencioso de 1000 linhas (Pitfall 13); nenhuma escrita exposta a `anon`/`authenticated` |
| V14 Configuration | Sim | Segredos (senha do banco, `service_role` key) só em variável de ambiente offline; `INGEST_SECRET` é removido (não rotacionado) por D-17; nova entrada no `.gitignore` para artefatos do pipeline Python (`pipeline/sih/.venv/`, caches de parquet, se algum ficar temporariamente dentro do repo por engano) |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Adulteração de `.dbc` em trânsito (FTP sem TLS) | Tampering | Ledger com hash + contagem de registros (D-12) detecta corrupção grosseira; dado é público/não-sensível, então o risco residual é aceito e documentado (Pitfall 14), não "resolvido" |
| Injeção via resposta HTML do TabNet no raspador de oráculo | Tampering/Injection | Nunca concatenar texto raspado direto em SQL; usar o mesmo padrão de escape (`sqlString()`) já em `generateRenameMigration.mjs` se algum valor raspado vira SQL gerado |
| Exaustão de conexões/egresso do plano gratuito por leitura não-paginada | Denial of Service (contra o próprio projeto) | Paginação obrigatória (Pitfall 13); throttling gentil já herdado do scraper aposentado (`REQUEST_DELAY_SEC`) para o raspador mínimo de oráculo, que ainda fala com o TabNet |
| Vazamento de segredo (senha do banco / `service_role` key) no bundle ou no git | Elevation of Privilege | Nunca em `VITE_*` (só entra no bundle); `.gitignore` cobre `.env`/`.env.local`; D-17 já resolve o `INGEST_SECRET` por remoção |
| Bucket de Storage mal configurado permitindo escrita anônima | Elevation of Privilege | Bucket "Public" afeta só leitura; confirmar explicitamente (via `supabase db advisors` ou policy manual) que não existe policy de `insert`/`update`/`delete` para `anon`/`authenticated` em `storage.objects` para este bucket |

## Sources

### Primary (HIGH confidence — execução ao vivo nesta sessão)
- `pysus==1.0.1` instalado via `uv` e exercitado ao vivo contra `ftp.datasus.gov.br`: listagem de diretórios (`SIH`, `IBGEDATASUS`), download real de `RDAC1901.dbc` (decodificado até parquet, 3.284 registros × 113 colunas), download real de `POPTBR19.zip`/`POPSBR19.zip` (decodificados via `dbfread`)
- Leitura direta do código-fonte instalado: `pysus/ftp/__init__.py`, `pysus/ftp/databases/sih.py`, `pysus/ftp/databases/ibge_datasus.py`, `pysus/online_data/{SIH,IBGE}.py`, `pysus/data/__init__.py`, `pysus/data/local.py`
- Análise estática reproduzível de `scripts/catalog/lista-morb-cid.json` (script Python incluído em `## Code Examples`)
- `pip index versions pysus` / `pip index versions psycopg` — PyPI, versões confirmadas
- `uvx slopcheck scan` — auditoria de legitimidade de pacote rodada nesta sessão

### Secondary (MEDIUM-HIGH confidence — documentação oficial, fetch nesta sessão)
- [Supabase Pricing](https://supabase.com/pricing) — limites do plano gratuito: 500 MB banco, 1 GB Storage, 5 GB egresso + 5 GB egresso cacheado
- [Supabase Docs — Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres) — conexão Direct é IPv6 no plano gratuito; strings de conexão de cada modo
- [Supabase Docs — Supavisor FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI) — Session Mode (porta 5432) é IPv4-compatível
- [GitHub — supabase/supabase-js#1883](https://github.com/supabase/supabase-js/issues/1883) — `contentEncoding` não suportado no `upload()`, issue aberta em 2025-11-21
- [MDN — Compression Streams API / DecompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API) — Baseline amplamente disponível desde maio de 2023

### Tertiary (LOW confidence — agregadores de terceiros, cruzados com fontes primárias onde possível)
- Diversos blogs de "Supabase pricing 2026" trazidos pela busca — usados apenas para triangular, nunca como fonte final; onde divergiram da documentação oficial (ex.: um agregador afirmou "10 GB de egresso", a página oficial de pricing diz "5 GB egresso + 5 GB egresso cacheado" — tratados como buckets separados, não somados livremente), a documentação oficial prevaleceu

## Metadata

**Confidence breakdown:**
- Standard stack (Python/pysus/psycopg/pyarrow): HIGH — versões confirmadas no PyPI, API exercitada ao vivo contra o FTP real
- Arquitetura (fronteira Python↔Node, ledger, upload): HIGH para os componentes já travados pelo CONTEXT (D-12 a D-20); MEDIUM para a proposta de estrutura de diretório e para o desenho do gate de reconciliação (é uma recomendação de pesquisa, o planner decide a forma final)
- Pitfalls: HIGH para os 9 achados verificados por execução direta nesta sessão (Pitfalls 1–3, 5, 7–10, 12); MEDIUM para os que dependem de documentação de terceiros sem teste direto (Pitfall 11 quanto ao caminho S3 alternativo)
- Dimensionamento de Storage (D-21): MEDIUM/estimativa — a própria CONTEXT já exige medição real antes de travar; esta pesquisa só refina a matemática do teto, não substitui a medição

**Research date:** 2026-08-04
**Valid until:** 30 dias para as partes de infraestrutura Supabase (limites de plano podem mudar); indefinido para os achados estruturais sobre `lista-morb-cid.json` e o comportamento do código-fonte do `pysus==1.0.1` instalado (só mudam se a versão pinada mudar, o que é uma decisão explícita, não passiva)
