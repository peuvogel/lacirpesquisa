# Phase 8: Taxonomia canônica + integridade - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Nenhum agravo exibe dados de outra doença, e a validação impede que isso volte.

Entrega: taxonomia regenerada a partir da Lista Morb CID-10 oficial, migração dos ids de agravo no Supabase preservando as ~1,13M linhas, validação fail-closed que barra `id ↔ tabnetCode ↔ label` divergentes, camada de apelidos clínicos, e regeneração de todo artefato derivado a partir da fonte canônica.

Requisitos: TAX-01 … TAX-06.

Fora de escopo (fica para outras fases): coleta de dados e ledger (Fase 9), leitura ao vivo do Supabase pelo mapa (Fase 10), versionar a Edge Function `sih-ingest` no repo (Fase 9).

</domain>

<correction_to_canonical_ref>
## ⚠ Correção verificada: são 21 ids errados, não 20

`.planning/notes/2026-07-28-taxonomia-corrompida-ground-truth.md` documenta **20** ids corrompidos. O número correto é **21** — falta o código **180**:

| id atual (errado) | código | CID-10 | rótulo verdadeiro | slug canônico |
|---|---|---|---|---|
| `outras_doencas_arteriais` | 180 | I65-I69 | Outras doenças cerebrovasculares | `outras_doencas_cerebrovasculares` |

Apurado em 2026-08-03 simulando a regeneração sem `KNOWN_BY_CODE` sobre `scripts/catalog/diseases.json`. O dicionário `KNOWN_BY_CODE` tem exatamente 21 entradas e **todas as 21** produzem slug diferente de `slugify(label)`.

Dois fatos adicionais verificados na mesma simulação:
- **Zero colisões de slug** na regeneração dos 329 `lista_morb` — o caminho `id + '_' + code` do gerador (linha 82) nunca é exercitado.
- Os `lista_morb` cobrem os códigos **1–329 sem buracos**; `SKIP_CODES` (331/332/333) e o código 330 ficam fora sem motivo registrado.

A nota foi corrigida com emenda datada (D-15). Não confiar em nenhuma cópia que ainda diga 20.

</correction_to_canonical_ref>

<root_cause>
## Causa raiz localizada

`scripts/catalog/sync-lista-morb.mjs:15-37` — o dicionário `KNOWN_BY_CODE` mapeia código TabNet → id legado, escrito à mão para "preservar ids já scrapados". Cada uma das 21 entradas casou um id legado com o código errado. Na linha 81:

```javascript
let id = KNOWN_BY_CODE[code] ?? slugify(label, code);
```

Os 308 agravos que caem no `slugify` estão corretos. Os 21 do dicionário estão errados. Remover `KNOWN_BY_CODE` faz a taxonomia se autocorrigir.

</root_cause>

<decisions>
## Implementation Decisions

### Migração no Supabase (TAX-03, TAX-04)

- **D-01:** Renomeação em **duas passadas com ids temporários**, numa transação única. Passada 1 move os 21 ids para `__mig_<id>`; passada 2 para o slug canônico. Zero DDL — funciona com as constraints atuais, e os dois ciclos de renomeação deixam de existir por construção. Aplica-se às três tabelas (`sih_disease`, `sih_metric_uf`, `sih_metric_muni`).
- **D-02:** Ensaio obrigatório em **Postgres local restaurado de `pg_dump` da produção**, antes de tocar em prod. É o único ensaio que exercita PK/FK/RLS reais e mede o custo dos ~1,13M updates. (Nota operacional: `pg_dump` exige a senha do banco, não a `SUPABASE_SERVICE_ROLE_KEY`.)
- **D-03:** "Reversível" (TAX-04) significa **script `--down` testado**, não restauração manual. O mapa `old → canonical` versionado no repo é a fonte única das duas direções. O ensaio local roda up → verifica → down → verifica retorno ao estado inicial.
- **D-04:** Prova de integridade = **soma agregada por agravo × medida**: `COUNT(*)` mais `SUM` de `internacoes`, `obitos`, `valor_total`, `dias_permanencia`, agrupados por `disease_id`, comparados antes (sob o id antigo) e depois (sob o canônico, traduzido pelo mapa). Contagem sozinha **não** detecta embaralhamento entre os 21 — as três contagens ficariam idênticas e a integridade referencial passaria.
- **D-05:** O SQL vive **versionado em `supabase/migrations/`** com timestamp (convenção Supabase CLI). O mesmo arquivo aplica idêntico no Postgres local do ensaio e em prod. Adota estrutura `supabase/` que o projeto ainda não tem.
- **D-06:** Os 21 ids antigos viram **tombstones permanentes** no mapa versionado. Todo ponto de entrada (upload, build de packs, validação) rejeita ruidosamente um id que conste como `old` — **mesmo que ele exista hoje como id canônico de outra doença**. Motivo: os dois ciclos fazem `hemorroidas` deixar de ser o código 186 e virar o 187, e `embolia_pulmonar` deixar de ser o 182 e virar o 173. Um id antigo passa pela FK sem erro e grava no agravo errado. A FK sozinha **não** cobre isso.
- **D-07:** A Edge Function `sih-ingest` é **apenas auditada** nesta fase: ler o fonte pelo dashboard/MCP e verificar se há id de agravo fixado em código ou tabela de tradução interna. Se houver, corrigir junto com a migração (faz parte do raio de contaminação). Versionar o fonte no repo com testes continua sendo trabalho da Fase 9.
- **D-08:** **Não** adicionar `ON UPDATE CASCADE` às FKs, apesar da anotação do ROADMAP. Depois desta fase, renomear `disease_id` deixa de ser operação esperada — CASCADE tornaria mais fácil fazer em silêncio exatamente o que a fase existe para tornar difícil. Evita também DDL em tabela de 1,1M linhas que o D-01 não exige.

### Fonte da taxonomia (TAX-01, TAX-02, TAX-06)

- **D-09:** Taxonomia gerada de um **snapshot versionado**, não de `fetch()` ao vivo. `sync-lista-morb.mjs:12,67` hoje faz requisição HTTP ao TabNet a cada execução — isso torna `catalog:validate` (encadeado em `pretest`/`test:run`/`gate`) dependente da rede, e o TabNet já derrubou a coleta overnight por falha de DNS. Atualizar a fonte vira comando explícito (`--refresh`) cujo diff passa por revisão no PR.
- **D-10:** Dois invariantes fail-closed, ambos obrigatórios:
  - **(A) semântico** — `slugify(label) === id`, com allowlist explícita e justificada (`amputacao_mmii` é procedimento, sem entrada na Lista Morb). Pega gerador errado: falha hoje nos 21.
  - **(B) regeneração** — regerar do snapshot produz byte-idêntico o arquivo commitado. Pega edição à mão e derivado dessincronizado (TAX-06).
  - Nenhum cobre o outro: com só B, um gerador errado reproduz o bug byte a byte e passa verde; com só A, uma edição à mão internamente consistente passa.
- **D-11:** `scripts/catalog/lista-morb-cid.json` é **re-keyado por `tabnetCode`** e tratado como **segunda fonte de entrada**, não artefato derivado. Hoje é chaveado por id e **nada o gera** — só `sync-lista-morb.mjs:104` o lê. Com os ids mudando, o `?? null` da linha 114 zeraria o `cid` dos 21 em silêncio. Invariantes novos: todo `lista_morb` tem `cid` não-nulo; todo código do mapa existe no snapshot.
- **D-12:** O mapa `old → canonical` é **computado do diff** entre o `diseases.json` atual e a regeneração do snapshot, chaveado por **código TabNet**, depois **congelado e commitado** como `rename-map.json`. Um teste garante que recomputar dá exatamente o mesmo. Foi esse método que encontrou o 21º id que a nota não tinha. Nunca transcrito à mão.
- **D-13:** O snapshot guarda **HTML bruto + extrato código→rótulo**, amarrados por um terceiro invariante **(C)** `parse(html) === extrato`. O HTML é evidência arquivada (prova o que a fonte dizia na data); o extrato é o que a geração lê e o que aparece revisável no diff do `--refresh`.
- **D-14:** As exclusões saem do código e viram **dado com motivo escrito** por código (o researcher determina o que 330–333 realmente são ao capturar o snapshot); `amputacao_mmii` vira `extra-diseases.json`, mesma forma de "segunda fonte" do D-11. Invariante **(D)** de partição completa: todo código do snapshot ou entra na taxonomia, ou tem motivo registrado. Um código novo no TabNet falha alto em vez de entrar/sair em silêncio.
- **D-15:** Corrigir `.planning/notes/2026-07-28-taxonomia-corrompida-ground-truth.md` para 21 linhas com emenda datada, preservando o histórico do que se apurou em 28/07. *(Aplicado nesta sessão.)*
- **D-16:** `scripts/catalog/diseases.json` **e** `src/features/catalog/diseases.lista.json` seguem **ambos commitados**, e o invariante (B) passa a cobrir os dois. Mantém a renomeação visível no diff do PR e não introduz dependência de script no `dev`/`build`.
- **D-25:** O código TabNet **330 ("Todas as outras causas externas") entra na taxonomia como agravo canônico.** Decidido pelo usuário em 2026-08-03, **contra a recomendação do researcher** (que propunha excluí-lo para preservar a contagem 330). É categoria clínica genuína da Lista Morb CID-10 — item `1.103` da tabela oficial `mxcid10lm.htm`, CID `W20-W64, W75-W99, X10-X39, X50-X59, Y10-Y89`, confirmado por duas fontes DATASUS independentes. Hoje ele sai da taxonomia **por acidente**: o filtro `/^todas/i.test(label)` em `sync-lista-morb.mjs:80`, escrito para descartar a pseudo-opção "Todas as categorias", captura o 330 porque o rótulo verdadeiro dele também começa com "Todas". Ele **não** está em `SKIP_CODES`.

  Consequências que o planner precisa carregar:
  - O filtro vira **checagem estrita no código** (`code === 'TODAS_AS_CATEGORIAS__'`), nunca no rótulo. Essa correção vale de qualquer forma — um match de string frágil contra o rótulo de uma categoria real é a mesma classe de defeito que o `KNOWN_BY_CODE`.
  - `sih_disease` passa a **331 linhas**. `sih_metric_uf` (30.313) e `sih_metric_muni` (1.099.403) **não mudam** — o 330 não tem dado coletado.
  - A migração deixa de ser só renomeação: passa a incluir o **`INSERT` do agravo novo**, dentro da mesma transação e igualmente reversível pelo `--down` (D-03).
  - **Amendar a redação** de TAX-01/TAX-03 em `REQUIREMENTS.md`, dos Success Criteria 1/3/5 do `ROADMAP.md` e da contagem em `PROJECT.md`: de 330 para **331 agravos**, registrando que 330 segue sendo o número de agravos **com dado coletado**. É edição de documento de projeto, dentro do escopo desta fase por consequência direta desta decisão.
  - ~~O invariante de partição **(D)** e a prova de integridade do **D-04** precisam admitir **explicitamente um agravo canônico sem métrica** … Um segundo agravo sem métrica aparecendo no futuro deve falhar alto.~~ **CORRIGIDO em 2026-08-03 — a premissa era factualmente falsa.** Medição ao vivo durante o planejamento: **237 dos 330 agravos já hoje têm zero linhas em `sih_metric_uf`** (só 93 têm dado). O código 330 não seria "o único sem métrica" — seria o 238º. Um invariante afirmando "exatamente um" falharia contra o banco real no primeiro `run`.

    **Forma corrigida, que preserva a intenção:** o conjunto de agravos órfãos (sem métrica) **não pode crescer** além do registrado em `metricless-diseases.json`. Isso ainda pega os dois modos de falha que importam — (a) agravo novo entrando sem coleta e sem registro, (b) renomeação que orfana um agravo que *tinha* dado — sem afirmar nada falso sobre o estado atual do banco. O registro continua sendo dado com motivo escrito (forma do D-14), nunca allowlist silenciosa nem exceção embutida em código.

    *Nota de proveniência:* a redação original ("exatamente um") foi escrita pelo orquestrador por inferência a partir do enquadramento do researcher e **não foi verificada contra o banco**. O planner mediu e corrigiu. É exatamente a classe de erro que esta fase existe para tornar impossível — uma afirmação plausível, revisada, e errada.
  - 331/332/333 continuam excluídos, agora com motivo registrado: "marcador de qualidade do dado (AIH sem CID / anterior à CID-10 / CID inexistente), não é categoria clínica".

### Apelidos clínicos (TAX-05)

> **Achado que motiva a área.** `MeasureDiseasePicker.tsx:53-60` casa a busca contra `disease.label`, `disease.id` e `disease.cid`. Hoje "avc" acha o agravo porque o **id literalmente é `avc`**. Depois da canonização, os ids do AVC verdadeiro viram `hemorragia_intracraniana`, `infarto_cerebral` e `acid_vascular_cerebr_nao_espec_hemorrag_ou_isquem` — nenhum contém a substring "avc", e os rótulos também não. **Sem apelidos, buscar "AVC" depois da migração retorna zero.** TAX-05 é o que impede a canonização de piorar a busca.

Medição feita em 2026-08-03 sobre os rótulos reais (busca por substring no label):

| Termo | Espera | Acha hoje |
|---|---|---|
| `embolia pulmonar` | 173 | 173 ✓ |
| `hemorroidas` | 187 | 187 ✓ |
| `insuficiencia cardiaca` | 175 | 175 ✓ |
| `avc` | 177, 178, 179 | — |
| `ait` | 180 | — |
| `tvp` | 185 | — |
| `varizes` | 186 | — |
| `aterosclerose` | 181 | — |

- **D-17:** Abordagem **híbrida**: automático onde a regra alcança, dicionário mínimo onde não alcança.
  - **Automático (sem manutenção):** dobra de acento, casamento por token, e fuzzy com distância ≤ 2. Isso sozinho resolve `aterosclerose` → **"Arteroesclerose"** (o DataSUS grafa assim; distância de edição 2) e variantes de grafia em geral.
  - **Curado (dicionário de sinônimos, ~4-6 entradas):** apenas sinônimos verdadeiros que nenhuma regra sobre CID ou rótulo alcança — `avc`, `tvp`, `ait` (siglas ausentes do texto oficial) e `varizes` (sinônimo de "veias varicosas").
  - Medido e descartado: uma regra de sigla por iniciais acha **zero** dos 10 termos testados — "Acid vascular cerebr não espec hemorrág ou isquêm" tem cinco palavras significativas e gera `avchi`, não `avc`.
- **D-18:** Um apelido que resolve para N categorias mostra **as N como linhas normais**, com uma tira explicativa acima: *"AVC corresponde a 3 categorias da Lista Morb CID-10 — selecione as que quiser comparar ou somar."* O picker já é multi-seleção (`selectedDiseaseSet`/`onToggleDisease`). Rejeitado: uma linha agregada "AVC (3 categorias)" — criaria pseudo-entidade inexistente no dado e tomaria em silêncio uma decisão estatística pelo estudante.
- **D-19:** O apelido vive **só no índice de busca**. O rótulo exibido, selecionado e copiado é **sempre o oficial** da Lista Morb — o mesmo que o estudante reencontra no TabNet e cita no trabalho. Nenhum badge, nenhum rótulo dependente do caminho de busca.
- **D-20:** Cada entrada do dicionário cita **código E rótulo esperado**, e a validação afirma que o rótulo atual daquele código bate — invariante **(E)**. O dicionário é uma tabela escrita à mão que mapeia termo → códigos, ou seja, exatamente a forma do `KNOWN_BY_CODE` que produziu o bug original. Revisão humana não basta: `KNOWN_BY_CODE` também passou por revisão — 21 linhas plausíveis, nenhuma conferida contra o rótulo real.

### Alcance da renomeação (TAX-06)

Alcance medido em 2026-08-03:

| Artefato | Situação |
|---|---|
| `public/data/catalog/packs/` | 10 packs, **9 com nome errado** (só `sih.amputacao_mmii_uf.json` correto) |
| `src/features/catalog/catalogAnalysisData.ts:9-18` | os 10 importados **estaticamente por nome de arquivo** |
| `catalogAnalysisData.ts:30-35` | `VARIABLE_ID_ALIASES` aponta `mock.internacoes`/`mock.obitos` → `sih.embolia_trombose.*` (id errado) |
| `public/data/catalog/variables.json` | 71 entradas, **50 afetadas** (inclui `cnes.*`/`sidra.*`, que carregam `packId: sih.embolia_trombose_uf`) |
| literais em `src/` | `'embolia_trombose'` em **8 arquivos de teste** + `taxonomy.ts:218` — único dos 21 que vazou para o código |
| `trabalhos datasus/outputs/coleta_sih_multi/` | **341 diretórios** nomeados por id |

- **D-21:** Packs, os 10 imports estáticos e as 50 entradas de `variables.json` são **renomeados agora**, apesar de a Fase 10 substituir os packs por leitura ao vivo do Supabase. Único caminho que mantém o D-06 intacto: se um pack guardar id-tombstone, `catalog:validate` falha, como projetado. A alternativa exigiria abrir exceção no guarda-corpo justamente para a classe de artefato contaminada.
- **D-22:** Os **341 diretórios de coleta ficam como estão** — trabalho da Fase 9, que vai redefinir a relação diretório ↔ agravo ao introduzir o ledger. Enquanto isso o D-06 garante que ninguém leia um diretório legado em silêncio: falha alto, que é o comportamento correto e o que a Fase 9 quer encontrar.
- **D-23:** Além de renomear as ocorrências, adicionar **guarda estrutural varrendo o repositório** — invariante **(F)**: um teste percorre os arquivos versionados e falha se qualquer id-tombstone aparecer como literal, com `rename-map.json` como único local legítimo. É o D-06 estendido do runtime para o código-fonte, e segue a decisão da Fase 7 de que *"a guarda contra recorrência é a ausência estrutural da API, não uma convenção documentada"*. Pega também o que esta varredura não enxergou.
- **D-24:** Renomeação e invariantes entram no **mesmo commit**. O gate (`catalog:validate && vitest run && build`) nunca fica vermelho e o invariante nasce fail-closed, sem allowlist. Rejeitada a allowlist temporária dos 21: seria anotação de "falha conhecida", que a Fase 7 proibiu explicitamente em QA-03, e mascararia um 22º id caso existisse. O commit é grande mas quase todo **gerado** — `rename-map.json` (D-12) dirige a renomeação, então o que precisa de revisão humana é o mapa, não as 50 linhas de `variables.json`.
  - **Consequência para o planner:** com renomeação e invariante no mesmo commit, o invariante nunca é visto falhando contra o bug real. TAX-02 pede explicitamente que *"o bug `avc` → 163 seria barrado"* — isso vira um teste que roda o invariante contra a **taxonomia pré-migração como fixture**, não contra o estado do repo.

### Claude's Discretion

- Formato exato dos arquivos de dado novos (`rename-map.json`, `aliases.json`, `exclusions.json`, `extra-diseases.json`) — os previews no DISCUSSION-LOG são ilustrativos, não normativos.
- Onde exatamente os seis invariantes moram entre `scripts/catalog/validate.mjs` (CLI, já encadeado em `pretest`) e a suíte vitest — a nota de ground truth pede que valham nos dois, a divisão fica com o planner.
- Algoritmo de fuzzy (Levenshtein, Damerau, trigrama) e o limiar exato, desde que resolva `aterosclerose` → `Arteroesclerose`.
- Ordem interna das ondas de execução dentro da fase.
- Se `VARIABLE_ID_ALIASES` (`mock.*` → catálogo) sobrevive à fase ou já pode morrer — depende do que a Fase 10 fará com ele.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Ground truth do defeito
- `.planning/notes/2026-07-28-taxonomia-corrompida-ground-truth.md` — tabela de renomeação verificada, ciclos, alcance da contaminação. **Corrigida em 2026-08-03: são 21 ids, não 20** (ver `<correction_to_canonical_ref>` acima).
- `.planning/notes/2026-07-28-null-vs-zero-choropleth.md` — contexto do defeito irmão (Fase 10), útil para não confundir os dois.

### Planejamento
- `.planning/PROJECT.md` — decisões travadas: migrar ids em vez de re-coletar; app somente-leitura no Supabase; service role só offline.
- `.planning/REQUIREMENTS.md` — TAX-01 … TAX-06.
- `.planning/ROADMAP.md` — Fase 8: goal, 6 critérios de sucesso, notas e a tabela de Riscos conhecidos.
- `.planning/phases/05-variaveis-no-site-scrape-referencias/05-CONTEXT.md` — D-05/D-06 (proveniência obrigatória) e D-08/D-10 (pipeline em `scripts/catalog/`, `catalog:validate` no gate) que esta fase estende.
- `.planning/phases/07-baseline-verde/07-CONTEXT.md` — o gate que não pode ficar vermelho; a decisão de guarda estrutural sobre convenção documentada.

### Pipeline de catálogo (o que muda)
- `scripts/catalog/sync-lista-morb.mjs` — **causa raiz** em `KNOWN_BY_CODE` (linhas 15-37) e `fetch()` ao vivo (linhas 12, 67). O `slugify` (41-50) é o gerador canônico a preservar.
- `scripts/catalog/validate.mjs` — ponto fail-closed existente, já encadeado em `pretest`/`test:run`. Hoje valida **só** proveniência de `variables.json`; recebe os seis invariantes novos.
- `scripts/catalog/lista-morb-cid.json` — 329 pares mantidos à mão, chaveados por id, sem gerador. Re-keyar por `tabnetCode` (D-11).
- `scripts/catalog/diseases.json` — saída do gerador, fonte dos demais.
- `scripts/catalog/build.mjs`, `scripts/catalog/rebuildAfterScrape.mjs`, `scripts/catalog/syncPackImports.mjs` — cadeia de regeneração dos derivados.
- `scripts/catalog/uploadSihToSupabase.mjs` — ponto de entrada de escrita; recebe a checagem de tombstone (D-06).
- `scripts/catalog/sql/0.sql` … `4.sql` — seeds do `sih_disease`, regerados da taxonomia canônica.

### Supabase
- `docs/SUPABASE-CATALOG.md` — esquema alvo das três tabelas, PKs compostas, FKs, índice `sih_metric_muni_uf_ano`, contrato do app. **Ressalva do ROADMAP:** consultar `pg_constraint` para os nomes reais das constraints antes de escrever SQL; nunca adivinhar. O índice está documentado como intenção, não confirmado aplicado.

### App (consumidores dos ids)
- `src/features/catalog/diseases.lista.json` — cópia no bundle, gerada (D-16).
- `src/features/catalog/taxonomy.ts` — `DISEASES`, `catalogIdFor`/`parseCatalogId`, literal `'embolia_trombose'` na linha 218.
- `src/features/catalog/catalogAnalysisData.ts` — 10 imports estáticos por nome de arquivo (9-18), `VARIABLE_ID_ALIASES` (30-35).
- `src/routes/mapas/MeasureDiseasePicker.tsx` — `diseaseMatches`/`normalizeCidQuery` (49-60), o ponto onde a busca por apelido entra.
- `src/routes/variaveis/VariableList.tsx` — segundo consumidor da taxonomia; confirmar se a busca por apelido também vale ali.
- `public/data/catalog/variables.json` — 50 de 71 entradas afetadas; **é onde moram os rótulos que o estudante lê**.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/catalog/validate.mjs` — já é fail-closed, já exporta funções puras (`checkEntry`, `checkCatalog`) consumíveis por CLI **e** vitest, e já está encadeado em `pretest`/`test:run`. Os seis invariantes novos entram nesse molde; nenhuma infraestrutura de validação precisa ser criada.
- `slugify()` em `sync-lista-morb.mjs:41-50` — o gerador canônico correto. Já produz o slug certo para 308 dos 329; só o `KNOWN_BY_CODE` o contorna.
- `MeasureDiseasePicker.diseaseMatches` — ponto único de busca de agravo no Mapas; a camada de apelido pluga ali sem tocar no restante do picker.
- Multi-seleção já existente no picker (`selectedDiseaseSet`, `onToggleDisease`) — o D-18 não precisa de UI nova além da tira.
- `npm run gate` (Fase 7) = `catalog:validate && vitest run && build`, com `.githooks/` ativos — a rede de segurança da renomeação já existe.

### Established Patterns
- **Zero dependências novas** no pipeline de catálogo (Fase 5, D-08/plano 05-03). O fuzzy do D-17 deve ser implementado à mão, não via biblioteca.
- Validação pura exportada de `validate.mjs` para CLI e vitest compartilharem uma regra só (Fase 5).
- PT-BR didático na interface; `n/d` para ausente, nunca travessão.
- Guarda estrutural sobre convenção documentada (Fase 7, 07-03).
- Artefatos derivados commitados, não gerados no build.

### Integration Points
- `sih_disease.id` é PK `text`; `disease_id` é FK **e** parte da PK composta em `sih_metric_uf` (30.313 linhas) e `sih_metric_muni` (1.099.403 linhas). Sem `ON UPDATE CASCADE`.
- Dois ciclos de renomeação verificados: `hemorroidas` ↔ `outras_doencas_veias` (186/187) e `doencas_reumaticas_cronicas` ↔ `embolia_pulmonar` (173/182).
- `packId` é derivado do id (`sih.${id}_uf` em `sync-lista-morb.mjs:115`) — renomear o agravo renomeia o pack, o arquivo e o import.
- O projeto **não tem** diretório `supabase/` nem o Supabase CLI; o D-05 introduz ambos.
- Repositório **sem remote** e sem config de deploy (só `.github/workflows/ci.yml` da Fase 7) — não há janela de release entre banco e bundle.

</code_context>

<specifics>
## Specific Ideas

- Usuário preferiu derivação automática de apelidos sempre que a regra alcançar, aceitando o dicionário curado apenas para o resíduo que nenhuma regra cobre (D-17). Manter esse viés: antes de propor curadoria manual em qualquer ponto desta fase, verificar se uma regra resolve.
- A ordem "computar do diff, depois congelar" (D-12) foi escolhida sobre transcrição manual em resposta direta ao 21º id que a nota não tinha. O princípio se generaliza: nesta fase, listas de ids não se escrevem à mão.
- `INGEST_SECRET = "lacir-sih-ingest-2026"` em texto plano em `scrape_upload_sih.py:33` — o ROADMAP aloca a rotação à Fase 9. Não é escopo aqui, mas a auditoria da Edge Function (D-07) passa perto; se a chave aparecer, registrar sem corrigir.

</specifics>

<deferred>
## Deferred Ideas

- **Chavear o pipeline de coleta por `tabnetCode` em vez de por slug** — considerado no D-06 e não escolhido. Ataca a raiz (o código nunca esteve errado) mas encosta no território da Fase 9, que vai reescrever o pipeline. Reavaliar ao planejar a Fase 9.
- **Versionar a Edge Function `sih-ingest` em `supabase/functions/`** — Fase 9 (item do ROADMAP). O D-05 já introduz a estrutura `supabase/` que isso vai usar.
- **Renomear os 341 diretórios de `coleta_sih_multi/`** — Fase 9, junto com o ledger (D-22).
- **Puxar os intervalos CID para dentro do snapshot**, eliminando `lista-morb-cid.json` como fonte mantida à mão — depende de a fonte oficial expor os intervalos. Se o researcher descobrir que expõe ao capturar o snapshot (D-13), vale reabrir; senão, o D-11 permanece.
- **Busca fuzzy também sobre o campo CID** e cobertura do dicionário de apelidos em `VariableList.tsx` além do picker de Mapas — levantados e não discutidos; decidir no planejamento.
- **Agregar N categorias num total ("somar as 3 do AVC")** — o D-18 expõe as N e deixa a soma para a seleção múltipla existente. Um agregador de verdade é decisão estatística e pede fase própria.

</deferred>

---

*Phase: 08-taxonomia-canonica-integridade*
*Context gathered: 2026-08-03*
