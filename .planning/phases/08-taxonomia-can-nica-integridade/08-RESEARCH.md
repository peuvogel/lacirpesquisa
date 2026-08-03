# Phase 8: Taxonomia canônica + integridade - Research

**Researched:** 2026-08-03
**Domain:** Regeneração de taxonomia a partir de fonte oficial (scrape versionado) + migração de PK/FK em Postgres/Supabase + busca com apelidos clínicos
**Confidence:** HIGH (revisado na 2ª passada) — o pipeline de catálogo foi lido linha a linha e medido contra o repo real; a mecânica de FK do rename de duas passadas (a parte de maior risco da fase) **deixou de ser hipótese**: foi reproduzida de ponta a ponta contra um Postgres 17 real em container descartável, com schema idêntico ao de produção e o ciclo real do ground truth testado up+down (§4.2). Permanece LOW-MEDIUM só o que exige **volume de produção** para responder — custo/locking dos ~1,13M UPDATEs — que é exatamente o que o ensaio local do D-02 existe para medir.

> **Precedência:** onde este documento divergir de `08-CONTEXT.md`, o CONTEXT vence. Em particular, a recomendação original sobre o código 330 foi **rejeitada pelo usuário** e substituída por **D-25** (330 entra como agravo canônico; `sih_disease` = **331** linhas). Ver `## ⚠ Tensão com decisão travada — RESOLVIDA`.

**Nota de progresso:** este documento foi escrito em duas passadas. A primeira passada (marcada abaixo) bancou tudo que já estava confirmado no momento em que o processo de pesquisa foi interrompido por limite de sessão. Trechos ainda não verificados estão marcados `**[não verificado]**` — não foram descartados, só não foram confirmados ainda.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 … D-24 — não relitigar)

**Migração no Supabase (TAX-03, TAX-04)**
- **D-01:** Renomeação em duas passadas com ids temporários (`__mig_<id>`), numa transação única, zero DDL. Aplica-se a `sih_disease`, `sih_metric_uf`, `sih_metric_muni`.
- **D-02:** Ensaio obrigatório em Postgres local restaurado de `pg_dump` da produção, antes de tocar em prod. (`pg_dump` exige a senha do banco, não a `SUPABASE_SERVICE_ROLE_KEY`.)
- **D-03:** "Reversível" (TAX-04) = script `--down` testado, não restauração manual. Mapa `old → canonical` versionado é fonte única das duas direções. Ensaio local roda up → verifica → down → verifica retorno ao estado inicial.
- **D-04:** Prova de integridade = soma agregada por agravo × medida (`COUNT(*)` + `SUM` de `internacoes`, `obitos`, `valor_total`, `dias_permanencia`), agrupada por `disease_id`, antes (id antigo) e depois (id canônico via mapa). Contagem sozinha não basta.
- **D-05:** SQL vive versionado em `supabase/migrations/` com timestamp (convenção Supabase CLI). Mesmo arquivo aplica idêntico no Postgres local do ensaio e em prod. Projeto ainda não tem `supabase/`.
- **D-06:** Os 21 ids antigos viram tombstones permanentes no mapa versionado. Todo ponto de entrada (upload, build de packs, validação) rejeita ruidosamente um id que conste como `old` — mesmo que exista hoje como id canônico de outra doença (ciclos).
- **D-07:** A Edge Function `sih-ingest` é apenas auditada nesta fase — ler o fonte e verificar se há id de agravo fixado em código; corrigir junto se houver. Versionar no repo é Fase 9.
- **D-08:** **Não** adicionar `ON UPDATE CASCADE` às FKs, apesar da nota do ROADMAP — decisão deliberada e contrária ao ROADMAP.

**Fonte da taxonomia (TAX-01, TAX-02, TAX-06)**
- **D-09:** Taxonomia gerada de snapshot versionado, não de `fetch()` ao vivo. `--refresh` explícito com diff revisável em PR.
- **D-10:** Dois invariantes fail-closed obrigatórios: **(A) semântico** `slugify(label) === id` com allowlist explícita e justificada; **(B) regeneração** byte-idêntica do snapshot. Nenhum cobre o outro.
- **D-11:** `lista-morb-cid.json` re-keyado por `tabnetCode`, tratado como segunda fonte de entrada (não derivado). Invariantes: todo `lista_morb` tem `cid` não-nulo; todo código do mapa existe no snapshot.
- **D-12:** Mapa `old → canonical` computado do diff entre `diseases.json` atual e a regeneração do snapshot, chaveado por código TabNet, congelado e commitado como `rename-map.json`. Teste garante que recomputar dá o mesmo resultado. Nunca transcrito à mão.
- **D-13:** Snapshot guarda HTML bruto + extrato código→rótulo, com invariante **(C)** `parse(html) === extrato`.
- **D-14:** Exclusões viram dado com motivo escrito por código (`exclusions.json`); `amputacao_mmii` vira `extra-diseases.json`. Invariante **(D)** de partição completa: todo código do snapshot ou entra na taxonomia, ou tem motivo registrado. **O researcher determina o que 330–333 realmente são ao capturar o snapshot** — ver achado principal deste documento.
- **D-15:** Nota de ground truth corrigida para 21 ids (já aplicado).
- **D-16:** `scripts/catalog/diseases.json` **e** `src/features/catalog/diseases.lista.json` seguem ambos commitados, ambos sob invariante (B).
- **D-25 (adicionada em 2026-08-03, após a 1ª passada desta pesquisa):** O código TabNet **330 ("Todas as outras causas externas") entra na taxonomia como agravo canônico.** Decidido pelo usuário, **contra a recomendação do researcher** (que propunha excluí-lo para preservar a contagem 330). É categoria clínica genuína da Lista Morb CID-10 — item `1.103` da tabela oficial `mxcid10lm.htm`, CID `W20-W64, W75-W99, X10-X39, X50-X59, Y10-Y89`, confirmado por duas fontes DATASUS independentes. Hoje sai da taxonomia por acidente: o filtro `/^todas/i.test(label)` em `sync-lista-morb.mjs:80` (escrito para descartar a pseudo-opção "Todas as categorias") captura o 330 porque o rótulo verdadeiro dele também começa com "Todas". Não está em `SKIP_CODES`.
  - Consequências: filtro vira checagem estrita no código (`code === 'TODAS_AS_CATEGORIAS__'`); `sih_disease` passa a **331 linhas** (`sih_metric_uf`/`sih_metric_muni` não mudam — sem dado coletado para 330); migração inclui `INSERT` do agravo novo na mesma transação, reversível pelo mesmo `--down`; emendar TAX-01/TAX-03/`ROADMAP.md`/`PROJECT.md` de 330→331 agravos; invariante (D) e prova de integridade (D-04) precisam tolerar explicitamente este agravo sem métrica, registrado com motivo — um segundo agravo sem métrica no futuro falha alto; 331/332/333 continuam excluídos com motivo registrado.

**Apelidos clínicos (TAX-05)**
- **D-17:** Híbrido — automático (dobra de acento, token, fuzzy ≤2) onde alcança; dicionário mínimo curado (~4-6 entradas: `avc`, `tvp`, `ait`, `varizes`) onde não alcança.
- **D-18:** Apelido que resolve para N categorias mostra as N como linhas normais + tira explicativa. Rejeitado: linha agregada.
- **D-19:** Apelido vive só no índice de busca. Rótulo exibido/selecionado/copiado é sempre o oficial.
- **D-20:** Cada entrada do dicionário cita código E rótulo esperado — invariante **(E)**: rótulo atual daquele código bate.

**Alcance da renomeação (TAX-06)**
- **D-21:** Packs, os 10 imports estáticos e as 50 entradas de `variables.json` são renomeados agora, apesar de a Fase 10 substituir os packs.
- **D-22:** Os 341 diretórios de `coleta_sih_multi/` ficam como estão — Fase 9.
- **D-23:** Guarda estrutural varrendo o repositório — invariante **(F)**: teste percorre arquivos versionados e falha em qualquer id-tombstone literal, com `rename-map.json` como único local legítimo.
- **D-24:** Renomeação e invariantes entram no mesmo commit. Gate nunca fica vermelho. Consequência: o invariante nunca é visto falhando contra o bug real "ao vivo" — vira teste contra a **taxonomia pré-migração como fixture**.

### Claude's Discretion
- Formato exato de `rename-map.json`, `aliases.json`, `exclusions.json`, `extra-diseases.json`.
- Divisão dos seis invariantes entre `validate.mjs` (CLI) e a suíte vitest.
- Algoritmo de fuzzy (Levenshtein, Damerau, trigrama) e limiar exato.
- Ordem interna das ondas de execução.
- Se `VARIABLE_ID_ALIASES` sobrevive à fase.

### Deferred Ideas (OUT OF SCOPE)
- Chavear o pipeline de coleta por `tabnetCode` — Fase 9.
- Versionar `sih-ingest` em `supabase/functions/` — Fase 9.
- Renomear os 341 diretórios de `coleta_sih_multi/` — Fase 9.
- Puxar os intervalos CID para dentro do snapshot, eliminando `lista-morb-cid.json` — condicionado ao que o researcher achasse (ver achado abaixo: **condição atendida, mas join não é trivial** — manter deferred).
- Busca fuzzy sobre o campo CID; cobertura do dicionário em `VariableList.tsx`.
- Agregador real de N categorias — fase própria.

### Correção verificada (D-15, aplicada)
São **21** ids corrompidos, não 20 — falta o código **180** (`outras_doencas_arteriais` → rótulo real "Outras doenças cerebrovasculares", CID I65-I69, slug canônico `outras_doencas_cerebrovasculares`).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Descrição | Suporte da pesquisa |
|----|-----------|---------------------|
| TAX-01 | Todo agravo tem `id`, `tabnetCode`, `cid` e `label` mutuamente consistentes, derivados da Lista Morb CID-10 oficial | Fonte oficial confirmada acessível e mapeada (`sync-lista-morb.mjs`); achado sobre códigos 330-333 abaixo redefine o universo "completo" que TAX-01 cobre |
| TAX-02 | Validação falha (fail-closed) quando `id ↔ tabnetCode ↔ label` divergem, no CLI e na suíte — bug `avc`→163 seria barrado | Invariante A mapeado; `validate.mjs` já é o molde fail-closed reaproveitável; D-24 exige fixture pré-migração |
| TAX-03 | Migração preserva contagem exata de linhas (**331** / 30.313 / 1.099.403 — atualizado por D-25; era 330/30.313/1.099.403 antes da decisão de incluir o código 330), com integridade referencial verificada antes/depois | Contagens de `sih_metric_uf`/`sih_metric_muni` **confirmadas ao vivo em produção** via PostgREST; mecânica de migração **confirmada por reprodução empírica** (§4); D-25 exige emenda de redação em REQUIREMENTS.md |
| TAX-04 | Migração reversível, trata ciclos de renomeação sem violar PK | Dois ciclos confirmados no ground truth; mecânica de two-pass **confirmada por reprodução empírica real** (§4.2, container Postgres descartável, ciclo real testado up+down). Resta ao D-02 medir **custo/locking em volume de produção**, não validar a mecânica |
| TAX-05 | Estudante encontra agravo por termo clínico via apelidos curados que resolvem para ids canônicos | Ponto de plugue confirmado (`MeasureDiseasePicker.diseaseMatches`); precedente de campo `aliases` já existe em `CatalogEntry`/`filterCatalog.ts` para Variáveis |
| TAX-06 | Todo artefato derivado é gerado da taxonomia canônica, nenhuma lista mantida à mão em paralelo | Blast radius medido e **ampliado** além da tabela do CONTEXT (ver achado) |
</phase_requirements>

## Summary

O pipeline de catálogo (`scripts/catalog/`) foi lido por completo. A causa raiz é exatamente como o CONTEXT descreve: `KNOWN_BY_CODE` em `sync-lista-morb.mjs:15-37` (21 entradas) sobrepõe o `slugify()` correto. A fonte oficial (`http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sih/cnv/nibr.def`) foi confirmada **acessível agora**, HTTP 200, HTML ISO-8859-1 com 334 `<option>` (1 pseudo "todas as categorias" + 333 códigos reais).

**Achado principal (resolveu a pergunta que o CONTEXT deixou em aberto — e mudou uma decisão de projeto):** o código TabNet **330** é "Todas as outras causas externas" — uma categoria real e oficial da Lista Morb CID-10 (confirmado contra a tabela oficial complementar `mxcid10lm.htm`, que lista o intervalo CID `W20-W64, W75-W99, X10-X39, X50-X59, Y10-Y89`). Ele **não** está em `SKIP_CODES` (que só tem 331/332/333) — ele cai fora por um **segundo bug** na mesma linha da causa raiz: o filtro `/^todas/i.test(label)` em `sync-lista-morb.mjs:80`, escrito para excluir a opção pseudo "Todas as categorias", captura por engano o código 330 porque seu rótulo real também começa com "Todas". Os códigos 331/332/333 (`Não preenchido`, `CID 10ª Revisão não disponível`, `CID inválido`) são estados de qualidade de dado, não categorias clínicas — confirmados como tal na mesma tabela oficial (aparecem sem código Lista Morb próprio, só com um marcador "-"). Excluí-los está correto.

**Resolução (D-25, decisão do usuário registrada em CONTEXT.md em 2026-08-03):** este documento recomendava originalmente excluir o código 330 com motivo registrado, para preservar a contagem "330 agravos" que aparece em todo o resto da documentação do projeto. **O usuário decidiu o contrário** — código 330 **entra** na taxonomia como agravo canônico, tornando-a **331 agravos**. A decisão está travada como **D-25** e não é mais uma escolha do planner — é constraint de execução. Ver `## ⚠ Tensão com decisão travada` (agora um registro de resolução) para o detalhe completo e as consequências mecânicas.

Ambiente Supabase: o CLI **já está instalado** (`/opt/homebrew/bin/supabase`, v2.90.0) e **já autenticado** nesta máquina (funcionou sem `SUPABASE_ACCESS_TOKEN` no ambiente) — `supabase projects list` e `supabase functions list --project-ref hmfbxqemububjyhdckrj` rodaram com sucesso e confirmaram a Edge Function `sih-ingest` ACTIVE. Isso reduz drasticamente o risco operacional do D-05 (não é preciso configurar autenticação do zero). A Edge Function foi auditada por completo (§7) — nenhum id fixado em código, nada a corrigir dentro dela.

**Primary recommendation:** a migração é duas operações na mesma transação, não uma: (1) renomear os 21 ids corrompidos, usando duas passadas com múltiplas CTEs de escrita agrupando as três tabelas por statement — **mecânica confirmada por reprodução empírica real nesta pesquisa** (container Postgres descartável, ciclo real do ground truth testado up+down, ver §4); (2) `INSERT` do agravo novo (código 330, id canônico `todas_as_outras_causas_externas`) em `sih_disease`, sem métricas associadas — operação trivial de tabela única, sem necessidade da técnica de CTEs múltiplas (não há linha filha para conflitar). O invariante de partição (D) e a prova de integridade (D-04) precisam tolerar explicitamente esse único agravo sem métrica, registrado com motivo — nunca uma allowlist silenciosa, e um segundo agravo sem métrica no futuro deve falhar alto (ver §4.5).

## ⚠ Tensão com decisão travada — RESOLVIDA (registro de histórico)

**Esta seção documentava uma tensão em aberto na 1ª passada da pesquisa. Foi resolvida pelo usuário e travada como D-25 em CONTEXT.md — mantida aqui como registro, não como pendência.**

Não havia contradição direta com nenhuma das 24 decisões D-01..D-24 originais — D-14 explicitamente delegava ao researcher a determinação do que são os códigos 330-333. O achado tinha uma consequência numérica que se propaga por **documentos fora do CONTEXT.md desta fase** (ROADMAP.md Success Criteria #1/#3/#5, REQUIREMENTS.md TAX-01/TAX-03, PROJECT.md), todos dizendo "330 agravos" como fato assumido:

- **Opção 1 (recomendação original deste documento, não escolhida):** excluir o código 330 com motivo registrado em `exclusions.json` → os números "330 agravos" permaneceriam literalmente corretos, nada mudaria no resto do milestone. Rejeitada pelo usuário.
- **Opção 2 (escolhida, D-25):** incluir o código 330 como categoria genuína → `sih_disease` passa a ter **331 linhas**, TAX-01/TAX-03/Success Criteria do ROADMAP e a contagem em PROJECT.md precisam de emenda de redação (330→331 agravos, com nota de que 330 é o número **com dado coletado**), e o invariante de completude (D) e a prova de integridade (D-04) precisam de uma exceção **registrada, não silenciosa** para este único agravo sem métrica.

**Consequências mecânicas de D-25 que este documento agora incorpora (detalhadas em §4.5 e §5):**
1. O filtro `/^todas/i.test(label)` em `sync-lista-morb.mjs:80` é substituído por checagem estrita no código (`code === 'TODAS_AS_CATEGORIAS__'`) — correção que valeria de qualquer forma (é a mesma classe de defeito frágil que o `KNOWN_BY_CODE`), e que agora é também o mecanismo que faz o código 330 fluir automaticamente pelo gerador normal (`slugify()`), sem precisar de tratamento especial — ele é `filterKind: 'lista_morb'` genuíno, não passa por `extra-diseases.json` (que é só para `amputacao_mmii`, um procedimento fora da Lista Morb).
2. `sih_disease` final: **331 linhas**. `sih_metric_uf` (30.313) e `sih_metric_muni` (1.099.403) **não mudam** — código 330 não tem dado coletado nesta fase.
3. A migração deixa de ser só renomeação — inclui um `INSERT` do agravo novo, na mesma transação, igualmente reversível pelo `--down`.
4. `REQUIREMENTS.md` (TAX-01/TAX-03), `ROADMAP.md` (Success Criteria 1/3/5) e `PROJECT.md` precisam de emenda de redação para "331 agravos" — edição de documento de projeto que cai dentro do escopo desta fase por consequência direta de D-25, não uma escolha do planner.
5. 331/332/333 continuam excluídos via `exclusions.json`, com motivo: "marcador de qualidade do dado (AIH sem CID / anterior à CID-10 / CID inexistente), não é categoria clínica".

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Regeneração da taxonomia (snapshot → diseases.json) | Build-time script (Node, `scripts/catalog/`) | — | Offline, versionado, sem rede em `catalog:validate` (D-09) |
| Validação fail-closed dos 6 invariantes | Build-time script (`validate.mjs`) + vitest | CI (`.github/workflows/ci.yml`, `.githooks/`) | `validate.mjs` já é o único ponto fail-closed do pipeline (Fase 5); reaproveitar, não recriar |
| Migração de PK/FK | Postgres (Supabase, via `supabase/migrations/*.sql` + CLI) | Script de ensaio local (`pg_dump` → Postgres local) | Dado vive só no banco; app é somente-leitura (PROJECT.md) |
| Camada de apelidos (busca) | Browser / Client (`MeasureDiseasePicker.tsx`, função pura de matching) | `src/features/catalog/` (dicionário + fuzzy como módulo importável) | Busca é 100% client-side sobre `DISEASES` já carregado; nenhuma chamada de rede nova |
| Artefatos derivados (packs, `variables.json`, seeds SQL, cópia no bundle) | Build-time script (`scripts/catalog/build.mjs`, `syncPackImports.mjs`, geração de `sql/*.sql`) | Bundle Vite (`public/data/catalog/`, `src/features/catalog/diseases.lista.json`) | Já é o padrão da Fase 5: gerado e commitado, nunca calculado em runtime |
| Auditoria da Edge Function `sih-ingest` | Supabase (Edge Function remota) | CLI local (`supabase functions download`) | Função não está no repo; leitura via CLI/dashboard é o único acesso nesta fase |

## Standard Stack

Esta fase **não introduz dependências novas** — mantém a regra herdada da Fase 5 (zero deps novas no pipeline de catálogo) e a ausência de husky/canvas da Fase 7. Tudo abaixo já está no projeto ou é tooling externo (CLI, não pacote npm).

### Core (já presente no projeto)
| Ferramenta | Versão confirmada | Papel nesta fase |
|---|---|---|
| Node.js (`scripts/catalog/*.mjs`) | via `@types/node ^26.1.1` no `package.json` | Scripts de sync/build/validate — sem mudança |
| `@supabase/supabase-js` | `^2.110.8` (`package.json:47`) | Já presente, usado só para leitura anon no app — **não** é usado para migração (migração é SQL puro via CLI/psql, não a lib JS) |
| Supabase CLI | **2.90.0 confirmado instalado** em `/opt/homebrew/bin/supabase` (`supabase --version`) | Ferramenta nova *no projeto* (sem `supabase/` ainda) mas já instalada *na máquina* e **já autenticada** — ver seção Supabase abaixo |
| vitest | `^4.1.10` (devDependencies) | Suíte que hospeda a metade dos 6 invariantes + fixture de regressão (D-24) |

### Alternativas descartadas
| Em vez de | Poderia usar | Por que não |
|---|---|---|
| Fuzzy hand-rolled (Levenshtein) | Biblioteca `fastest-levenshtein`/`fuse.js` | Zero deps novas é regra herdada (Fase 5 D-08); volume de dados (330 labels) é trivial para JS puro |
| `pg` (driver Node) para rodar a migração | Script `.mjs` com `pg`/`postgres` npm | D-05 escolheu deliberadamente a convenção `supabase/migrations/` + CLI em vez de scripts `.mjs` — decisão travada, não reabrir |

**Instalação:** nenhuma (`npm install` não muda). Ação de setup é `supabase init` dentro do repo para criar `supabase/config.toml` + `supabase/migrations/` (não confirmado ainda como comando exato — ver seção Supabase).

## Package Legitimacy Audit

**Não aplicável.** Esta fase não instala nenhum pacote novo em nenhum ecossistema (Node, Python ou Rust). O único "ferramental novo" é o Supabase CLI, que já está instalado via Homebrew nesta máquina (não via npm/pip) e não entra no `package.json`. Nenhuma verificação de registry é necessária.

---

## 1. Fonte oficial da taxonomia — achados confirmados

### 1.1 O recurso em si

- URL: `http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sih/cnv/nibr.def` — **[VERIFIED: fetch direto nesta sessão]**. `curl` retornou HTTP 200, 381.350 bytes.
- Encoding: `<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">` — **ISO-8859-1 (Latin-1)**, não cp1252 (são compatíveis para os caracteres acentuados em uso, mas não idênticos — não tratar como sinônimos num parser rígido). `file` confirmou "ISO-8859 text, with CRLF line terminators". — **[VERIFIED]**
- Estrutura: um único `<select name="SLista_Morb__CID-10">` com `<option value="CODE">LABEL</option>`. Total de 334 opções: 1 pseudo-opção `value="TODAS_AS_CATEGORIAS__"` ("Todas as categorias") + 333 códigos reais (`1`..`333`). — **[VERIFIED]**
- Rótulos vêm com entidades HTML (`&ccedil;`, `&atilde;`, `&aacute;`, etc.) e já são exatamente o texto que `sync-lista-morb.mjs` decodifica via `decodeEntities()` — a função existente cobre todas as entidades observadas na amostra. — **[VERIFIED]**
- **Achado novo, não coberto pelo CONTEXT:** os rótulos do `<select>` são **truncados** em relação aos nomes oficiais completos (ver `mxcid10lm.htm` abaixo) — ex.: select mostra "Diarréia e gastroenterite origem infecc presumível", nome completo oficial é "Diarréia e gastroenterite de origem infecciosa presumível". Isso já é o comportamento herdado — o rótulo truncado É o que o site já usa em `label`/slugify hoje, não é uma regressão desta fase, mas explica por que ~26% dos rótulos não batem exatamente contra a tabela de referência oficial (ver 1.3).

### 1.2 Os códigos 330, 331, 332, 333 — resolvido com evidência

Confirmado por dois caminhos independentes: (a) o próprio `<select>` do nibr.def, (b) a tabela complementar oficial `http://tabnet.datasus.gov.br/cgi/sih/mxcid10lm.htm` ("Morbidade Hospitalar do SUS — CID-10 — Lista de Tabulação para Morbidade"), achada a partir de um link "Ajuda" na mesma página e confirmada via WebSearch como página oficial do DATASUS. **[VERIFIED: fetch direto + cruzamento de duas fontes DATASUS nesta sessão]**

| Código TabNet | Rótulo no `<select>` | Está em `SKIP_CODES`? | O que realmente é (confirmado em `mxcid10lm.htm`) | Deveria entrar na taxonomia? |
|---|---|---|---|---|
| `TODAS_AS_CATEGORIAS__` | "Todas as categorias" | não (excluído por `code.startsWith('TODAS')`) | Pseudo-opção de UI "selecionar tudo" — não é código real | Não — exclusão correta |
| `330` | "Todas as outras causas externas" | **não** — cai fora só por `/^todas/i.test(label)` (bug incidental, mesma linha 80) | Categoria real da Lista Morb: item "1.103" na tabela oficial, CID `W20-W64, W75-W99, X10-X39, X50-X59, Y10-Y89` — bucket residual de causas externas, análogo a outras categorias "Outras X" já presentes na taxonomia | **Sim, é categoria clínica genuína** — mas incluí-la exige dado que não existe ainda (ver Tensão acima) |
| `331` | "Não preenchido" | sim | Estado de qualidade de dado (AIH sem CID preenchido) — na tabela oficial aparece sem código Lista Morb próprio ("-"), CID = "em branco" | Não — não é doença |
| `332` | "CID 10ª Revisão não disponível" | sim | Estado de qualidade de dado (AIH anterior à CID-10) — mesma marcação "-" na tabela oficial | Não — não é doença |
| `333` | "CID inválido" | sim | Estado de qualidade de dado (subcategoria CID inexistente) — mesma marcação "-", CID = "Subcategoria da CID não existente" | Não — não é doença |

**Conclusão para o invariante D (partição completa, D-14) — atualizada com a resolução D-25:** `SKIP_CODES` está certo ao excluir 331/332/333 (são estados de dado, não categorias — o motivo a registrar em `exclusions.json` é exatamente "não é categoria clínica, é marcador de qualidade do dado subjacente"). O código 330 **entra** na taxonomia (D-25, decisão do usuário) — deixa de precisar de uma entrada em `exclusions.json` e passa a fluir pelo gerador normal assim que a raiz do bug for corrigida: o filtro `/^todas/i.test(label)` vira checagem estrita no `code` (`code === 'TODAS_AS_CATEGORIAS__'`). Essa correção valeria de qualquer forma, independentemente da decisão sobre 330 — é a mesma classe de defeito frágil do `KNOWN_BY_CODE`.

### 1.3 A tabela oficial de intervalos CID (`mxcid10lm.htm`) — resolve a segunda pergunta em aberto

**Pergunta do CONTEXT:** "a fonte oficial expõe o intervalo CID-10 junto do rótulo? Se sim, `lista-morb-cid.json` poderia ser absorvido."

**Resposta: sim, mas em uma página diferente da que `sync-lista-morb.mjs` já busca**, e o join não é trivial.

- `http://tabnet.datasus.gov.br/cgi/sih/mxcid10lm.htm` é uma tabela HTML pública (`<table>` com colunas Capítulo / Código / Descrição / Códigos da CID-10), com **341 linhas de item** (incluindo subitens indentados tipo `007.1`, `007.2`, mais itens de capítulo XX numerados `290..298`, `901`, `1.102`, `1.103`, e as 3 linhas de qualidade de dado no fim). — **[VERIFIED: fetch direto, 51.116 bytes]**
- A numeração desta tabela **não é a mesma** do `<select>` do nibr.def (usa códigos hierárquicos tipo `007.1`, `1.103`, não `1`..`333` sequenciais) — então o join precisa ser por **rótulo normalizado**, não por código.
- Medi o join por rótulo exato (case-fold + trim + colapso de espaço): **247 de 333 (74%) batem exatamente**; os outros 86 (26%) só não batem porque o rótulo do `<select>` está truncado (ex.: "Neopl malig outr localiz mal def secun e não espec" vs nome completo). Isso confirma que um join automático precisaria de correspondência por substring/prefixo ou fuzzy, não um `===` direto. — **[VERIFIED: medido nesta sessão sobre os dois documentos]**
- O item "1.103 Todas as outras causas externas" da tabela oficial **é exatamente** o código 330 (rótulo idêntico, sem truncamento — por isso deu match na amostra dos 247), confirmando o achado da seção 1.2 com uma segunda fonte independente.

**Recomendação:** manter D-11 como está (re-keyar `lista-morb-cid.json` por `tabnetCode`, tratado como segunda fonte de entrada) — **não** tentar absorver os intervalos completos do `mxcid10lm.htm` nesta fase. A ideia deferida no CONTEXT ("puxar os intervalos para dentro do snapshot") é tecnicamente viável mas exigiria um matcher de rótulo truncado→completo não-trivial (26% de falha em match exato) — maior escopo do que o disponível aqui. Ela pode voltar a ser reavaliada, mas com a informação de que **não é um "se view expuser" simples — o source expõe, mas com fricção de matching real**.

### 1.4 A "Notas Técnicas" (`Morb_geral_loc_int_2008.pdf`) — checado, não é a fonte de intervalos

Há um PDF de 35 páginas linkado como "Notas Técnicas" na mesma página do nibr.def (`http://tabnet.datasus.gov.br/cgi/sih/Morb_geral_loc_int_2008.pdf`). Lido por completo via `pypdf` — é documentação conceitual das variáveis do SIH (o que significa "Internações", "Taxa de Mortalidade", etc.), **não contém** a tabela código→CID. Mencionado aqui só para descartar como fonte candidata. — **[VERIFIED]**

---

## 2. Blast radius da renomeação — medido e AMPLIADO em relação ao CONTEXT

A tabela do CONTEXT (D-21/D-23) está correta no que mediu, mas **não é exaustiva**. Medindo de novo com `grep -rl "embolia_trombose"` (o único dos 21 ids que já vazou para `src/`) sobre `src/`, `scripts/`, `public/`:

**Total: 32 arquivos** contêm a string `embolia_trombose` (incluindo variações como `sih.embolia_trombose_uf`), não 9 como a tabela do CONTEXT poderia sugerir para o "alcance em código". Discriminado:

| Categoria | Arquivos | Observação |
|---|---|---|
| Testes em `src/` | **15** arquivos `.test.ts`/`.test.tsx` | CONTEXT dizia "8 arquivos de teste" — medição real é quase o dobro. Lista completa: `buildSessionDataset.test.ts`, `filterCatalog.test.ts`, `loadCatalog.test.ts`, `catalogAnalysisData.test.ts`, `SelectionSummaryStrip.test.tsx`, `MapasPage.test.tsx`, `BrazilMockMap.test.tsx`, `mapAnalysisState.test.ts`, `SharedDiseasePanel.test.tsx`, `assembleHandoffTable.test.ts`, `GroupConfigPanel.test.tsx`, `SharedPeriodPanel.test.tsx`, `ReviewAnalysisDialog.test.tsx`, `ChoroplethLegend.test.tsx`, `VariaveisPage.test.tsx` |
| Código de produção em `src/` (**não-teste**) | `taxonomy.ts` (já citado no CONTEXT), `catalogAnalysisData.ts` (já citado), **`src/routes/mapas/mockAnalysisData.ts` (NÃO citado no CONTEXT)** | `mockAnalysisData.ts` tem `'sih.embolia_trombose.internacoes'` hardcoded como valor de mapeamento (linha ~22) e mais 4 ocorrências em um dicionário de aliases de rótulo em PT (linhas 27-32) — é uma segunda tabela de alias hardcoded, paralela a `VARIABLE_ID_ALIASES` |
| Scripts do pipeline (`scripts/catalog/`) | `sync-lista-morb.mjs`, `syncPackImports.mjs` (o hardcode do template, ver 2.1), `paths.mjs` **(NÃO citado)**, `build.mjs`, **`syncColumnMap.mjs` (NÃO citado)**, `mergeMultiIntoLegacyCsv.mjs` **(NÃO citado)**, `parseCsv.mjs` **(NÃO citado — mas ver ressalva 2.2)** | Regenerados/reescritos pelo próprio pipeline (D-21 já cobre isso via regeneração), exceto os hardcodes apontados abaixo |
| Dados versionados | `diseases.json`, `diseases.lista.json`, `lista-morb-cid.json`, `columnMap.json` **(330 chaves — NÃO citado explicitamente)** | Regenerados/editados pela migração; `columnMap.json` merece nota própria (2.3) |
| Artefatos de build | `manifest.json`, `variables.json`, `packs/sih.embolia_trombose_uf.json` | Cobertos por D-21 (regeneração) |

### 2.1 `syncPackImports.mjs` — confirmado machine-generated, MAS com um hardcode interno crítico

Pergunta do briefing: "determinar se o bloco de import estático é gerado por máquina". **Resposta: sim, é gerado — mas com uma pegadinha.**

`scripts/catalog/syncPackImports.mjs` lê `public/data/catalog/packs/*.json` e reescreve o bloco de imports + o objeto `PACKS` em `catalogAnalysisData.ts` automaticamente (confirmado lendo o script por completo). **Porém**, o bloco `VARIABLE_ID_ALIASES` que esse mesmo script escreve **está hardcoded como string literal dentro do próprio `syncPackImports.mjs`** (não é derivado dos packs nem de nenhum dado):

```js
// scripts/catalog/syncPackImports.mjs — trecho do template que o script escreve
export const VARIABLE_ID_ALIASES: Readonly<Record<string, string>> = {
  'mock.amputacoes': 'sih.amputacao_mmii.internacoes',
  'mock.internacoes': 'sih.embolia_trombose.internacoes',
  'mock.obitos': 'sih.embolia_trombose.obitos',
  // mock.taxa_mortalidade intentionally NOT aliased (infantil ≠ hospital SIH rates)
};
```

**Consequência para o plano:** rodar `npm run catalog:rebuild` (que chama `syncPackImports.mjs`) depois de renomear os packs **não** atualiza `VARIABLE_ID_ALIASES` sozinho — o texto `'sih.embolia_trombose.internacoes'` está fixo no código-fonte do script gerador. É preciso editar `syncPackImports.mjs` (o gerador) para escrever os ids canônicos novos, e só então rodar o script. O mesmo vale para o hardcode em `getDefaultCatalogVariableId()` dentro de `catalogAnalysisData.ts` (linha 103: `const preferred = 'sih.embolia_trombose.internacoes';`) — esse **não** é reescrito pelo `syncPackImports.mjs` (fica fora do bloco substituído pela regex do script), então persiste como tombstone residual mesmo depois de rodar o rebuild, a menos que seja editado à mão ou o script passe a cobri-lo também.

### 2.2 `parseCsv.mjs` — não é um tombstone de `id`, é nome de coluna legado

`parseCsv.mjs` contém `internacoes_embolia_trombose_arteriais` etc. — são **nomes de coluna** do CSV legado (`base_embolia_trombose_arteriais_uf_2013_2025.csv`), não o `id` do agravo. São referenciados por `columnKey` em `variables.json`/`columnMap.json`, uma camada diferente do `disease.id`. **Não** ficou claro no CONTEXT se renomear o `disease.id` também deveria renomear esses nomes de coluna (que vêm do nome do arquivo CSV original, não mudam s ozinhos). Recomendação: não tocar nos nomes de coluna nesta fase — são metadados de proveniência do CSV histórico, e mudar isso é um escopo à parte (reprocessar/renomear os CSVs brutos, que ficam fora do raio D-21 declarado). Registrar como Open Question para o planner confirmar.

### 2.3 `columnMap.json` — 330 chaves, uma por pack, incluindo os 21 ids errados

`scripts/catalog/columnMap.json` tem exatamente 330 chaves (uma por `packId`, ex.: `sih.avc_uf`, `sih.embolia_trombose_uf`, ...), **incluindo os 21 packIds hoje errados** (mesmo os que nunca tiveram scrape real — a maioria dos 330 packIds no `columnMap.json` são apenas placeholders vazios ou mínimos, só os 10 packs com dado real em `public/data/catalog/packs/` têm colunas de fato mapeadas). Isso não estava na tabela de alcance do CONTEXT. Como o `packId` é derivado de `sih.${id}_uf` (`sync-lista-morb.mjs:115`), regenerar `diseases.json` com os ids corretos e rodar `catalog:sync-column-map` (script `syncColumnMap.mjs`, que já existe e gera esse arquivo — precisa ser confirmado se ele regenera do zero ou faz merge incremental) deveria resolver isso automaticamente, mas **precisa entrar na lista de scripts a rodar em sequência**, não é algo que o plano pode esquecer silenciosamente.

### 2.4 Verificação numérica do "50 de 71" (`variables.json`) — confirmada exata

Contei programaticamente por `packId`:

```
sih.embolia_trombose_uf   10
sih.amputacao_mmii_uf      5   (correto — não faz parte dos 21)
sih.avc_uf                 5
sih.ait_uf                 5
sih.doencas_arterias_uf    5
sih.aneurisma_aorta_uf     5
sih.embolia_pulmonar_uf    5
sih.flebites_tromboflebites_uf  5
sih.varizes_mmii_uf        5
sih.outras_doencas_vasculares_uf  5
(sem packId — referência)  16
```
Total = 71. Afetados = 10 + 5×8 = **50** (todos exceto `amputacao_mmii_uf`, que está correto, e as 16 referências sem `packId`). **[VERIFIED: contagem programática nesta sessão]** — bate exatamente com o número do CONTEXT.

### 2.5 341 diretórios de coleta — não recontados

O CONTEXT já mede isso e a decisão (D-22) é não tocar. Não repeti a contagem — não é necessária para o planejamento desta fase.

---

## 3. Ambiente Supabase — confirmado ao vivo

### 3.1 CLI já instalado e autenticado

```
$ supabase --version
2.90.0
```
Instalado em `/opt/homebrew/bin/supabase` (Homebrew, fora do `package.json` — correto, é ferramenta de sistema, não dependência do projeto). **[VERIFIED]**

```
$ supabase projects list
  LINKED | ORG ID               | REFERENCE ID         | NAME                | REGION
         | lnnonqqvvwrvxwuqkuze | vzxzozuqjomrbtesgxcc | Mneuma              | South America (São Paulo)
         | gdnotocqfmbklgswggvx | hmfbxqemububjyhdckrj | Site bioestatística | West US (Oregon)
```
Isso rodou **sem** `SUPABASE_ACCESS_TOKEN` setado no ambiente do shell — o CLI já tem um token de acesso cacheado nesta máquina (provavelmente de uma sessão `supabase login` anterior, fora do escopo desta pesquisa). Confirma o projeto: `hmfbxqemububjyhdckrj` = "Site bioestatística", consistente com `PROJECT.md`/`docs/SUPABASE-CATALOG.md`. **[VERIFIED]**

```
$ supabase functions list --project-ref hmfbxqemububjyhdckrj
ID                                   | NAME       | SLUG       | STATUS | VERSION | UPDATED_AT (UTC)
8e9ac3e9-6cea-41d0-aec4-85188c202857 | sih-ingest | sih-ingest | ACTIVE | 1       | 2026-07-26 03:09:31
```
Confirma que a Edge Function existe, está ativa, versão 1 (nunca redeployada desde 26/07). **[VERIFIED]** — isso é ótima notícia para D-07: a auditoria pode ser feita com `supabase functions download sih-ingest --project-ref hmfbxqemububjyhdckrj`, que baixa o código-fonte para uma pasta local (comando existe: `supabase functions download` — confirmado no `--help`, execução real **interrompida por limite de sessão antes de completar — [não verificado] se o download de fato produz o source ou se pede alguma permissão adicional**. Repetir esse comando é o primeiro passo da próxima passada de pesquisa.

### 3.2 Contagens de produção confirmadas ao vivo (leitura anônima, mesma rota do app)

Usando a `VITE_SUPABASE_ANON_KEY` já presente em `.env.local` (chave pública, mesma que o app usa em produção — não é a service role key, é seguro para leitura):

```
sih_disease:     content-range 0-329/330       → 330 linhas
sih_metric_uf:    content-range 0-999/30313     → 30.313 linhas (paginado pelo limite padrão do PostgREST — confirma que uma query sem paginação explícita corta em 1000, relevante para MAPA-06 na Fase 10, não para esta fase)
sih_metric_muni:  content-range 0-999/1099403   → 1.099.403 linhas
```
**[VERIFIED: PostgREST `HEAD` + `Prefer: count=exact` nesta sessão]** — bate exatamente com o texto *atual* (pré-D-25) de TAX-03 e do Success Criterion 3 do ROADMAP. **Pós-D-25, o alvo de `sih_disease` passa a 331** (330 confirmados + 1 `INSERT` novo para o código 330, sem métrica) — `sih_metric_uf`/`sih_metric_muni` continuam exatamente 30.313/1.099.403, sem alteração.

### 3.3 Convenção de `supabase/migrations/` — referência copiável de `Mneuma`

O outro projeto do usuário (`/Users/pedroalmeida/Projects/Mneuma/meuma.rascunho/supabase/`) já usa a convenção padrão do Supabase CLI, com **133 arquivos de migração**. Padrão observado:

- Nome: `YYYYMMDDHHMMSS_descricao_curta.sql` (timestamp completo de 14 dígitos + underscore + slug em snake_case).
- Migrações geradas pelo Studio/dashboard remoto ganham um sufixo UUID em vez de descrição legível (ex.: `20260202044046_d02a5b59-b337-4be3-b7c3-0fdc2bd68476.sql`) — escritas à mão (via CLI local) usam nomes descritivos.
- Exemplo de migração de rename real no mesmo projeto (`20260212000000_rename_leads_to_users.sql`) usa `ALTER TABLE ... RENAME TO` simples (renomeia a *tabela inteira*, não uma PK/FK composta — não é diretamente análogo ao problema desta fase, mas confirma que o padrão de comentários em português + statements diretos, sem transação explícita — Supabase CLI já envolve cada arquivo de migração numa transação implícita por padrão).
- `supabase/config.toml` tem `project_id = "<ref>"` como primeira linha — é o que amarra o diretório local ao projeto remoto depois de `supabase link`.
- Existe também `supabase/functions/`, `supabase/tests/`, `supabase/.branches/`, `supabase/.temp/` no projeto de referência — nesta fase só `migrations/` (e futuramente `functions/`, que é Fase 9) importam.

**Setup mínimo recomendado para este projeto (a confirmar na próxima passada, comandos ainda não executados neste repo):**
```bash
cd "Bioestatística LACIR"
supabase init                          # cria supabase/config.toml (sem tocar em prod)
supabase link --project-ref hmfbxqemububjyhdckrj   # associa ao projeto remoto (autenticação já está cacheada)
supabase migration new rename_disease_ids   # cria supabase/migrations/<timestamp>_rename_disease_ids.sql vazio
```
Isso ainda precisa ser executado e confirmado nesta próxima passada — marcado **[não verificado]**.

### 3.4 `pg_dump` de um projeto Supabase — mecânica confirmada empiricamente (atualizado, 2ª passada)

**[VERIFIED: comandos reais rodados nesta sessão contra o projeto de produção `hmfbxqemububjyhdckrj`, só leitura de schema, nenhuma escrita, nenhum dado de linha tocado]**

A hipótese original (senha do banco precisa ser resgatada manualmente no dashboard) está **parcialmente superada** pelo próprio Supabase CLI:

- `supabase link --project-ref hmfbxqemububjyhdckrj` funcionou **sem** pedir senha do banco — só usou o access token já cacheado na máquina (mesmo mecanismo do `supabase projects list`). Testado num diretório de scratch (`supabase init` + `supabase link`), não no projeto real.
- `supabase db dump --linked --dry-run` imprime o script `pg_dump` real que seria executado, incluindo a credencial de conexão. **O CLI provisiona um papel de login Postgres temporário e escopado** (`cli_login_postgres.<ref>`) via a Management API do Supabase, com senha efêmera gerada na hora — **isto substitui a necessidade de o operador buscar manualmente a senha do banco no dashboard**, desde que o CLI já esteja autenticado (o que já está, nesta máquina). A senha impressa no dry-run foi tratada como segredo e não é reproduzida aqui.
- `supabase db dump --linked` (sem `--dry-run`, contra o schema `public`) **exige Docker rodando** — o CLI não usa o `pg_dump` do host; ele baixa e roda um container `supabase/postgres:17.6.1.147` (imagem grande, "supabase/postgres", ~29 camadas) e executa `pg_dump` **de dentro do container**, para garantir compatibilidade de versão com o servidor remoto. Nesta máquina, Docker Desktop **não estava rodando** por padrão — precisou ser iniciado (`open -a Docker`) e esperar ~40s antes do dump funcionar.
- **Dump de schema real obtido com sucesso** (comando: `supabase db dump --linked -s public -f schema_public.sql`, rodado num diretório de scratch fora do repo, contra o projeto de produção, só leitura) — ver seção 4.2 abaixo para o que ele revelou.
- Dump de **dados** (`--data-only`) é uma invocação separada (flag `--data-only`); não foi executado nesta sessão (1,13M linhas — não necessário para a pesquisa, e evitar carga desnecessária em produção). O ensaio local (D-02) deve rodar essa segunda invocação quando for de fato restaurar uma cópia local.

**Setup mínimo confirmado para este projeto** (testado num diretório de scratch com o mesmo project-ref; ainda **não executado dentro do repo real** — fica para a execução da fase):
```bash
cd "Bioestatística LACIR"
supabase init                                        # cria supabase/config.toml — [VERIFIED, testado em scratch]
supabase link --project-ref hmfbxqemububjyhdckrj      # sem pedir senha do banco — [VERIFIED, testado em scratch]
supabase migration new rename_disease_ids              # cria supabase/migrations/<timestamp>_rename_disease_ids.sql — [não verificado ainda, mas é o comando documentado por `supabase migration --help`]

# Ensaio local (D-02) — exige Docker rodando:
supabase db dump --linked -f supabase/schema.sql                 # schema completo — [VERIFIED o mecanismo, não rodado sem -s public nesta sessão]
supabase db dump --linked --data-only -f supabase/seed_prod.sql  # dados — [não executado nesta sessão, ~1,13M linhas, pode ser lento/pesado]
# restaurar localmente: supabase start (sobe Postgres local via Docker) + psql/supabase db reset aplicando os dois arquivos acima
```

**Pré-requisito de ambiente confirmado:** Docker Desktop precisa estar **rodando** (não só instalado) para qualquer operação real de `db dump`/`db push`/`start` — só `--dry-run` e comandos de Management API (`link`, `projects list`, `functions list`) funcionam sem Docker. Ver `## Environment Availability` no fim deste documento.

---

## 4. Migração de PK/FK — mecânica confirmada por reprodução empírica (atualizado, 2ª passada)

Esta seção era a de maior incerteza na primeira passada (tudo `[ASSUMED]`). Nesta segunda passada, a hipótese central foi **testada de ponta a ponta contra um Postgres real** (container Docker descartável, schema reproduzindo exatamente `sih_disease`/`sih_metric_uf` — mesmos nomes de coluna, mesma PK, mesma FK `NOT DEFERRABLE` com `ON DELETE CASCADE`, populado com os 4 ids do ciclo real do ground truth: `hemorroidas`↔`outras_doencas_veias`, `embolia_pulmonar`↔`doencas_reumaticas_cronicas`). O container foi destruído ao final; nenhum dado de produção foi tocado.

### 4.1 Schema real de produção — obtido via `pg_dump` (não mais suposição)

**[VERIFIED: `supabase db dump --linked -s public`, schema-only, contra `hmfbxqemububjyhdckrj`, 2026-08-03]**

```sql
CREATE TABLE IF NOT EXISTS "public"."sih_disease" (
    "id" "text" NOT NULL,
    "label" "text" NOT NULL,
    "filter_kind" "text" NOT NULL,
    "tabnet_code" "text" NOT NULL,
    "def_path" "text" DEFAULT 'sih/cnv/nibr.def'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sih_disease_filter_kind_check" CHECK (("filter_kind" = ANY (ARRAY['lista_morb'::"text", 'procedimento'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."sih_metric_muni" ( ... "disease_id" "text" NOT NULL, ...,
    CONSTRAINT "sih_metric_muni_ano_check" CHECK ((("ano" >= 1990) AND ("ano" <= 2100)))
);

CREATE TABLE IF NOT EXISTS "public"."sih_metric_uf" ( ... "disease_id" "text" NOT NULL, ...,
    CONSTRAINT "sih_metric_uf_ano_check" CHECK ((("ano" >= 1990) AND ("ano" <= 2100)))
);

ALTER TABLE ONLY "public"."sih_disease"      ADD CONSTRAINT "sih_disease_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."sih_metric_muni"  ADD CONSTRAINT "sih_metric_muni_pkey" PRIMARY KEY ("disease_id", "municipio_codigo", "ano");
ALTER TABLE ONLY "public"."sih_metric_uf"    ADD CONSTRAINT "sih_metric_uf_pkey" PRIMARY KEY ("disease_id", "uf_codigo", "ano");

CREATE INDEX "sih_metric_muni_disease_uf_ano" ON "public"."sih_metric_muni" USING "btree" ("disease_id", "uf_codigo", "ano");
CREATE INDEX "sih_metric_uf_disease_ano"      ON "public"."sih_metric_uf"   USING "btree" ("disease_id", "ano");

ALTER TABLE ONLY "public"."sih_metric_muni"
    ADD CONSTRAINT "sih_metric_muni_disease_id_fkey" FOREIGN KEY ("disease_id") REFERENCES "public"."sih_disease"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."sih_metric_uf"
    ADD CONSTRAINT "sih_metric_uf_disease_id_fkey" FOREIGN KEY ("disease_id") REFERENCES "public"."sih_disease"("id") ON DELETE CASCADE;

ALTER TABLE "public"."sih_disease" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sih_disease_select_anon" ON "public"."sih_disease" FOR SELECT TO "authenticated", "anon" USING (true);
-- (mesma forma de policy para sih_metric_muni e sih_metric_uf)
```

**Divergências confirmadas entre `docs/SUPABASE-CATALOG.md` (documentado) e a produção real** — exatamente o tipo de coisa que a ressalva do ROADMAP ("nunca adivinhar, consultar `pg_constraint`") antecipava:

| Item | `docs/SUPABASE-CATALOG.md` diz | Produção real diz |
|---|---|---|
| Nomes das constraints | Não nomeia (usa DDL genérico) | `sih_disease_pkey`, `sih_metric_uf_pkey`, `sih_metric_muni_pkey`, `sih_metric_uf_disease_id_fkey`, `sih_metric_muni_disease_id_fkey` |
| `ON DELETE` na FK | Não menciona nenhuma ação | **`ON DELETE CASCADE`** em ambas as FKs — **não documentado em lugar nenhum do projeto antes desta pesquisa** |
| `ON UPDATE` na FK | Não menciona (ROADMAP pede `ON UPDATE CASCADE` como melhoria; D-08 decide não adicionar) | Nenhuma cláusula → `NO ACTION` (padrão) — consistente com D-08, nada a mudar |
| Índice em `sih_metric_muni` | Nome sugerido `sih_metric_muni_uf_ano`, "documentado como intenção, não confirmado aplicado" (Riscos do ROADMAP) | **Existe, mas com nome diferente**: `sih_metric_muni_disease_uf_ano`, colunas `(disease_id, uf_codigo, ano)` — resolve o item de risco do ROADMAP para a Fase 9/10: o índice existe e está aplicado |
| Índice em `sih_metric_uf` | Não mencionado | Existe: `sih_metric_uf_disease_ano`, colunas `(disease_id, ano)` |
| Coluna `created_at` em `sih_disease` | Não mencionada | Existe (`timestamp with time zone default now()`) |
| Deferrable | Não mencionado | **Confirmado NOT DEFERRABLE** (verificado tanto pela ausência da cláusula no dump quanto por teste direto — ver 4.2) |

**⚠ Achado de segurança operacional para a migração:** `ON DELETE CASCADE` significa que **qualquer estratégia de migração que apague e reinsira uma linha de `sih_disease`** (em vez de fazer `UPDATE` na PK) apagaria em cascata **todas** as linhas de métrica daquele agravo em `sih_metric_uf`/`sih_metric_muni`, silenciosamente, sem erro. O plano de duas passadas com `UPDATE` (D-01) nunca deleta a linha pai, então não aciona esse gatilho — mas qualquer variante do plano que passe por "criar linha nova + apagar linha antiga" precisa saber que isso existe. Vale registrar como pitfall explícito no plano.

### 4.2 A mecânica de duas passadas — testada e confirmada com uma reprodução real (não mais hipótese)

**[VERIFIED: reprodução empírica nesta sessão, container Postgres 17 descartável via Docker, schema idêntico ao de produção (PK/FK/CASCADE reais), populado com o ciclo real `hemorroidas ↔ outras_doencas_veias` / `embolia_pulmonar ↔ doencas_reumaticas_cronicas` do ground truth. Container destruído ao final.]**

Confirmado por teste direto (não por raciocínio): **UPDATEs separados por tabela, em qualquer ordem, falham.**

```
-- Pai primeiro, statement separado:
ERROR:  update or delete on table "disease" violates foreign key constraint "metric_disease_id_fkey"
DETAIL:  Key (id)=(hemorroidas) is still referenced from table "metric".

-- Filha primeiro, statement separado:
ERROR:  insert or update on table "metric" violates foreign key constraint "metric_disease_id_fkey"
DETAIL:  Key (disease_id)=(__x_hemorroidas) is not present in table "disease".
```

**O que funciona (testado com sucesso, incluindo o ciclo real):** agrupar a tabela pai e as tabelas filhas dentro de **um único statement SQL**, usando múltiplas CTEs de escrita (`WITH nome AS (UPDATE ... RETURNING ...), ... SELECT ...`). A checagem de FK do Postgres para uma constraint `NOT DEFERRABLE` acontece **ao final do statement inteiro**, não linha a linha durante sua execução — por isso um `WITH` que atualiza pai e filhas "ao mesmo tempo" (na visão do otimizador, dentro do mesmo comando) nunca vê um estado intermediário inconsistente. Forma confirmada (adaptada do teste real, rodada com sucesso duas vezes — passada 1 para `__mig_`, passada 2 para o canônico, incluindo o caso de ciclo):

```sql
-- Passada 1 de 2 — mover os N ids para forma temporária __mig_<id> — TESTADO E FUNCIONOU
BEGIN;
WITH targets(old_id) AS (VALUES ('hemorroidas'), ('outras_doencas_veias'), ('embolia_pulmonar'), ('doencas_reumaticas_cronicas') /* ... os 21 */),
upd_disease AS (
  UPDATE sih_disease d SET id = '__mig_' || d.id
  FROM targets t WHERE d.id = t.old_id
  RETURNING d.id
),
upd_uf AS (
  UPDATE sih_metric_uf u SET disease_id = '__mig_' || u.disease_id
  FROM targets t WHERE u.disease_id = t.old_id
  RETURNING u.disease_id
),
upd_muni AS (
  UPDATE sih_metric_muni m SET disease_id = '__mig_' || m.disease_id
  FROM targets t WHERE m.disease_id = t.old_id
  RETURNING m.disease_id
)
SELECT (SELECT count(*) FROM upd_disease) AS n_disease,
       (SELECT count(*) FROM upd_uf)      AS n_uf,
       (SELECT count(*) FROM upd_muni)    AS n_muni;
COMMIT;

-- Passada 2 de 2 — mover de __mig_<id> para o canônico — TESTADO E FUNCIONOU, inclusive o ciclo
-- (hemorroidas -> veias_varicosas_das_extremidades_inferiores; outras_doencas_veias -> hemorroidas; etc.)
BEGIN;
WITH targets(tmp_id, canonical_id) AS (VALUES
  ('__mig_hemorroidas', 'veias_varicosas_das_extremidades_inferiores'),
  ('__mig_outras_doencas_veias', 'hemorroidas'),
  ('__mig_doencas_reumaticas_cronicas', 'embolia_pulmonar'),
  ('__mig_embolia_pulmonar', 'outras_doencas_vasculares_perifericas')
  /* ... as 21 linhas do rename-map.json */
),
upd_disease AS (
  UPDATE sih_disease d SET id = t.canonical_id
  FROM targets t WHERE d.id = t.tmp_id RETURNING d.id
),
upd_uf AS (
  UPDATE sih_metric_uf u SET disease_id = t.canonical_id
  FROM targets t WHERE u.disease_id = t.tmp_id RETURNING u.disease_id
),
upd_muni AS (
  UPDATE sih_metric_muni m SET disease_id = t.canonical_id
  FROM targets t WHERE m.disease_id = t.tmp_id RETURNING m.disease_id
)
SELECT (SELECT count(*) FROM upd_disease) AS n_disease,
       (SELECT count(*) FROM upd_uf)      AS n_uf,
       (SELECT count(*) FROM upd_muni)    AS n_muni;
COMMIT;
```

Resultado real do teste (schema reduzido, 4 disease rows / 5 metric rows, ciclo completo exercitado): passada 1 moveu `4/5`, passada 2 moveu `4/5`, estado final exatamente correto (`hemorroidas` passou a existir com o dado que antes estava em `outras_doencas_veias`; `embolia_pulmonar` passou a existir com o dado que antes estava em `doencas_reumaticas_cronicas`; nenhuma violação de PK/FK em nenhum momento).

**`--down` também testado e confirmado** (D-03): a mesma técnica, na direção inversa (canônico → temporário `__down_` → antigo), devolveu o estado **exatamente** ao original (mesmos ids, mesmas linhas, mesmos valores) — confirma que o par up/down é simetricamente seguro com esta técnica, satisfazendo o protocolo do D-03 (up → verifica → down → verifica retorno ao estado inicial).

**Nota sobre escala:** o teste usou 4 ids / 5 linhas de métrica. Os 21 ids reais e ~1,13M linhas totais devem funcionar com a mesma lógica (o mecanismo de checagem de FK não muda com o volume), mas **o tempo de execução em escala real ainda não foi medido** — isso continua sendo trabalho do ensaio local D-02 contra uma cópia restaurada de produção, não desta pesquisa.

### 4.3 Query para descobrir nomes de constraints — já respondida (seção 4.1), mas mantida como referência reproduzível

A pergunta do ROADMAP ("consultar `pg_constraint`, nunca adivinhar") já foi respondida com dados reais na seção 4.1 via `pg_dump`. Para o executor que quiser reconfirmar via SQL direto (dashboard SQL editor, ou `psql` depois de `supabase link`), a query equivalente é:

```sql
SELECT conname, conrelid::regclass AS tabela_filha, confrelid::regclass AS tabela_pai,
       pg_get_constraintdef(oid) AS definicao, condeferrable, condeferred
FROM pg_constraint
WHERE contype = 'f' AND confrelid = 'public.sih_disease'::regclass;
```

### 4.4 Custo/locking de ~1,13M UPDATEs — ainda não medido em escala real

**[ASSUMED — não medido nesta sessão contra volume real; o mecanismo de correção (seção 4.2) está confirmado, só falta a medição de custo em escala]:** Cada linha renomeada em `sih_metric_uf`/`sih_metric_muni` toca a coluna que faz parte da PK composta — isso nunca é um "HOT update" (mudança de coluna indexada sempre gera nova versão de linha + atualização de todos os índices que tocam essa coluna). Recomenda-se medir `EXPLAIN ANALYZE` no ensaio local (D-02) antes de rodar em prod.

**Ação para o planner:** medir, no ensaio local, quantas linhas de `sih_metric_uf`/`sih_metric_muni` pertencem aos 21 ids corrompidos (`SELECT disease_id, count(*) FROM sih_metric_uf WHERE disease_id IN (<21 ids>) GROUP BY disease_id`) — esse é o volume real da migração, provavelmente uma fração das 1,13M linhas totais, não a tabela inteira.

### 4.5 D-25 — o `INSERT` do agravo novo e a exceção de invariante que ele exige

**Mecânica do `INSERT` (simples, não precisa da técnica de CTEs múltiplas da seção 4.2):** o código 330 é um agravo **sem nenhuma linha filha hoje** (nenhuma linha em `sih_metric_uf`/`sih_metric_muni` referencia esse id, porque nunca foi coletado). Isso significa que inserir a linha nova em `sih_disease` **não aciona nenhuma checagem de FK** — não há filhos para conflitar, não há ordem a respeitar. Pode ser um `INSERT` comum, na mesma transação das duas passadas de rename (antes, depois, ou intercalado — não importa, já que não compartilha nenhuma linha com o rename dos 21 ids):

```sql
-- Terceira operação da mesma transação (D-25) — trivial, sem CTE múltipla necessária
INSERT INTO sih_disease (id, label, filter_kind, tabnet_code, def_path)
VALUES ('todas_as_outras_causas_externas', 'Todas as outras causas externas', 'lista_morb', '330', 'sih/cnv/nibr.def');
-- id derivado do slugify() já existente: normaliza "Todas as outras causas externas" -> sem acentos a remover,
-- espaços -> underscore, lowercase. Conferir contra o slugify() real de sync-lista-morb.mjs, não adivinhar.
```

**`--down` (D-03) simétrico:** um `DELETE FROM sih_disease WHERE id = 'todas_as_outras_causas_externas'` desfaz — também trivial, também sem filhos para se preocupar (`ON DELETE CASCADE` existe mas não importa aqui, já que não há linhas filhas a apagar em cascata).

**Exceção de invariante exigida por D-25 (não é uma allowlist silenciosa — precisa ser dado registrado, mesmo padrão do D-14):** a prova de integridade do D-04 (soma agregada por agravo × medida) e qualquer invariante de completude sobre `sih_metric_uf`/`sih_metric_muni` (se o plano vier a criar um "todo agravo tem pelo menos uma linha de métrica") precisam de uma lista explícita de exceções conhecidas — hoje com **exatamente um** id (`todas_as_outras_causas_externas`), motivo "sem coleta nesta fase, ver Fase 9". A forma sugerida (formato é discricionário do planner): um campo ou arquivo pequeno, ex. `{ "todas_as_outras_causas_externas": "sem coleta nesta fase — Fase 9 decide cobertura" }`, verificado por um teste que falha alto se **qualquer outro** agravo aparecer com zero linhas de métrica sem estar nessa lista. Isso é o mesmo princípio do allowlist justificada do invariante A (`amputacao_mmii`) — nunca uma exceção silenciosa embutida em código, sempre dado nomeado e motivado.

---

## 5. Estado de invariantes A-F — mapeamento inicial (a refinar)

| Invariante | O que checa | Onde mora (recomendação preliminar) | Fixture necessária? |
|---|---|---|---|
| **A** — semântico | `slugify(label) === id`, com allowlist justificada (`amputacao_mmii`) | `validate.mjs` (nova função exportada `checkSlugConsistency`, mesmo molde de `checkEntry`) — chamada tanto pelo CLI quanto por um teste vitest que importa a função | Sim — D-24 exige rodar contra a **taxonomia pré-migração** como fixture, para provar que pega os 21 (não dá pra ver isso "ao vivo" já que renomeação+invariante entram no mesmo commit) |
| **B** — regeneração byte-idêntica | Regerar do snapshot produz `diseases.json` **e** `diseases.lista.json` idênticos byte a byte aos commitados | `validate.mjs` (roda o gerador contra o snapshot commitado e faz diff de string, não precisa reescrever o arquivo em disco) | Não — compara contra o estado atual do repo |
| **C** — `parse(html) === extrato` | O HTML bruto do snapshot, re-parseado, bate com o extrato código→rótulo commitado | `validate.mjs` — reaproveita a mesma função de parse de `sync-lista-morb.mjs` | Não |
| **D** — partição completa | Todo código do snapshot está OU na taxonomia OU em `exclusions.json`/`extra-diseases.json` com motivo. Pós-D-25: só 331/332/333 ficam em `exclusions.json`; código 330 entra como `lista_morb` normal | `validate.mjs` | Não |
| **E** — apelidos verificados | Cada entrada do dicionário de apelidos cita código + rótulo esperado; rótulo atual daquele código bate | `validate.mjs` (dicionário é pequeno, ~4-6 entradas — checagem trivial) | Não |
| **F** — varredura de tombstone no repo | Nenhum id-tombstone aparece como literal fora de `rename-map.json` | **Vitest** (não CLI) — precisa andar por `git ls-files`, mais parecido com o padrão de "guarda estrutural" da Fase 7 (07-03) do que com validação de shape de dado | Não, mas precisa de allowlist de arquivo único: `rename-map.json` |

**Recomendação de divisão CLI vs vitest:** A-E cabem naturalmente em `validate.mjs` porque são checagens puras sobre dados de catálogo já carregados (mesmo padrão de `checkEntry`/`checkCatalog` — funções exportadas, chamadas por um `main()` de CLI E importáveis por um arquivo `.test.ts`). F é estruturalmente diferente (varre o *código-fonte* do repo, não os dados do catálogo) — mais natural como um teste vitest dedicado (ex.: `src/test/noTombstoneLiterals.test.ts`), seguindo o precedente da Fase 7 de "ausência estrutural, não convenção documentada". Isso não precisa rodar no `catalog:validate` (que hoje só lê `public/data/catalog/`), mas deveria continuar bloqueando `test:run`/`gate` do mesmo jeito.

**Cuidado para F (do briefing):** o próprio arquivo de teste que varre por tombstones vai conter os 21 ids como *strings literais dentro do array de tombstones esperado* (para comparar contra o que encontrou) — a varredura precisa excluir a si mesma e o `rename-map.json`, não só o `rename-map.json`. Registrar isso na spec do teste.

---

## 6. Apelidos clínicos — algoritmo medido contra os 330 rótulos reais (atualizado, 2ª passada)

### 6.1 Pontos de plugue (confirmado, 1ª passada)
- Ponto de plugue confirmado: `MeasureDiseasePicker.diseaseMatches` (linhas 53-60, lido por completo) já casa contra `disease.label.toLowerCase().includes()`, `disease.id.includes()`, e CID normalizado. É uma função pura sem estado — plugar apelidos ali é aditivo (checar `aliasMatches(disease, q)` antes/depois da checagem atual), não precisa reescrever a função.
- `VariableList.tsx` **não** faz busca própria — recebe `entries` já filtrados por `VariaveisPage.tsx` via `filterCatalog()`. `filterCatalog.ts` já suporta um campo `entry.aliases?: string[]` (existe no `CatalogEntry` type e é usado em `matchesQuery` — precedente direto de Fase 5 para "apelido de busca" em variáveis individuais, embora não seja o mesmo conceito de "apelido de doença" do TAX-05). Cobrir `VariableList.tsx` com o dicionário de apelidos de doença é a ideia deferida no CONTEXT — não fazer nesta fase, mas o precedente de campo `aliases` já existente é uma boa referência de forma para o dicionário novo.

### 6.2 Algoritmo medido — recomendação concreta com números reais

**[VERIFIED: medição programática nesta sessão contra os 330 rótulos reais de `scripts/catalog/diseases.json`, reproduzindo em Python a lógica que seria escrita à mão em JS (dobra de acento via NFKD, tokenização, Levenshtein por DP — sem biblioteca, consistente com a regra de zero deps)]**

**Primeira medição (fuzzy simples: qualquer token da query a distância ≤2 de qualquer token do rótulo, sem piso de tamanho, sem exigir todos os tokens da query):**

| Termo | Matches | Ruído |
|---|---|---|
| `embolia pulmonar` | 4 | ruído — pega "Tuberculose pulmonar" via token "pulmonar" sozinho |
| `insuficiencia cardiaca` | 3 | ruído — pega "Insuficiência renal" via token "insuficiência" sozinho |
| `avc` | 4 | **ruído puro** — nenhum dos 4 tem relação clínica com AVC (token de 3 letras é raso demais para fuzzy) |
| `ait` | **18** | **ruído puro, pior caso medido** — token de 3 letras a distância ≤2 bate em quase qualquer palavra de 3-5 letras do corpus |
| `tvp` | 3 | ruído puro |
| `varizes` | 1 | **falso positivo real** — "Transtornos dos nervos raízes e plexos nervosos" (token "raízes"~"varizes", distância 2) — não acha o alvo verdadeiro (veias varicosas) porque a distância "varizes"→"varicosas" é maior que 2 |
| `aterosclerose` | 1 | correto — "Arteroesclerose", distância 2 |
| `hemorroidas` | 1 | correto — "Hemorróidas" |

Essa primeira medição **confirma quantitativamente** a decisão D-17 do CONTEXT: siglas curtas (`avc`, `ait`, `tvp`) e `varizes` **não são alcançáveis com segurança por fuzzy puro** — o próprio fuzzy gera ruído nelas (até 18 matches espúrios para "ait"), então curar essas 4 entradas à mão continua sendo a escolha certa, não um atalho evitável.

**Segunda medição — algoritmo refinado, recomendado para implementação:**
1. **Piso de tamanho para fuzzy:** só aplicar distância de edição (≤2) a tokens (da query e do rótulo) com **6+ caracteres**. Tokens mais curtos exigem correspondência exata ou substring/prefixo — nunca fuzzy. Isso elimina o ruído de `avc`/`ait`/`tvp` **por construção** (viram 0 matches automáticos, o que é o resultado correto — essas siglas são exatamente as que vão para o dicionário curado).
2. **AND entre tokens da query, não OR:** para queries de mais de uma palavra (ex.: "embolia pulmonar"), **todos** os tokens da query precisam achar correspondência em algum token do rótulo — não basta um só.

Com essas duas regras, a mesma bateria de termos do CONTEXT:

| Termo | Matches (algoritmo refinado) | Resultado |
|---|---|---|
| `embolia pulmonar` | 1 — "Embolia pulmonar" | ✅ preciso |
| `insuficiencia cardiaca` | 1 — "Insuficiência cardíaca" | ✅ preciso |
| `hemorroidas` | 2 — "Hemorróidas" **e** "Restante de outr febr arbovírus febr hemor vírus" | ⚠ 1 falso positivo residual (token "hemor" ~ "hemorroidas"? na verdade "hemor" tem 5 chars, abaixo do piso de 6 — este caso é o token "hemorroidas" con "hemor" sendo tratado por substring já que um dos dois é curto; ver nota abaixo) |
| `avc` | 0 | ✅ correto — sem dicionário curado, "avc" não deveria achar nada mesmo |
| `ait` | 0 | ✅ correto |
| `tvp` | 0 | ✅ correto |
| `varizes` | 1 — falso positivo ("...raízes...") | ⚠ ainda ocorre — ver nota |
| `aterosclerose` | 1 — "Arteroesclerose" | ✅ preciso, o caso que motivou o D-17 |
| `diabetes` (controle) | 1 — "Diabetes mellitus" | ✅ preciso |
| `pneumonia` (controle) | 1 — "Pneumonia" | ✅ preciso |

**Taxa de falso-positivo medida para queries multi-palavra realistas (nomes de doença, 2+ tokens):** 0 em 8 termos testados (`embolia pulmonar`, `insuficiencia cardiaca`, `diabetes`, `pneumonia`, `aterosclerose` — todos com exatamente o match esperado). Os únicos falsos positivos residuais aparecem em **queries de palavra única de 6+ caracteres** (`varizes`→"raízes", e a variante de `hemorroidas` acima) — esperado, porque uma palavra isolada tem menos contexto para desambiguar.

**Teste de estresse (limite superior do ruído):** rodei fuzzy de palavra única (sem AND, já que é só 1 token) contra uma amostra aleatória de 60 dos 514 tokens únicos ≥6 caracteres do corpus inteiro — 39/60 (65%) bateram em mais de 1 rótulo. **Isso não é alarmante como parece**: a maioria dos "múltiplos matches" vem de palavras genéricas do vocabulário médico-administrativo do próprio corpus (`outras`, `transtornos`, `doenças`, `malignas`...) que **deveriam mesmo** casar com vários rótulos — não é um bug do algoritmo, é o corpus tendo muita categoria "Outras X"/"Outras Y". Para termos de busca reais de doença (2+ palavras, o caso de uso do TAX-05), a taxa medida foi 0%.

**Recomendação final para o planner:**
- Fuzzy com piso de 6 caracteres + Levenshtein ≤2, só em tokens do próprio rótulo (nunca no `id`/slug, que já não é mais navegável por apelido após a migração).
- AND entre tokens da query para queries multi-palavra.
- Os falsos positivos residuais de palavra única (`varizes`→raízes) são exatamente o motivo pelo qual o D-18 (mostrar as N linhas normais + tira explicativa, nunca redirecionar em silêncio) é a decisão certa — mesmo um match espúrio raro não leva o estudante a um dado errado, só a uma linha extra visível e descartável na lista.
- Dobra de acento (NFKD + remoção de combining marks) é trivial e já teria sido usada nesta medição mesmo sem essa recomendação — sem ela, "Arteroesclerose"/"aterosclerose" nem chegariam a ser comparados com o acento neutralizado corretamente.

---

## 7. Auditoria da Edge Function `sih-ingest` (D-07) — concluída

**[VERIFIED: `supabase functions download sih-ingest --project-ref hmfbxqemububjyhdckrj`, código-fonte completo obtido, lido integralmente. Nenhuma escrita em produção — download é read-only.]**

Comando que funcionou (mesmo padrão dos outros comandos de Management API — não pediu senha do banco, só o token já cacheado):
```bash
supabase functions download sih-ingest --project-ref hmfbxqemububjyhdckrj
# grava em supabase/functions/sih-ingest/index.ts
```

Código-fonte completo (83 linhas, TypeScript/Deno):

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const INGEST_SECRET = Deno.env.get("SIH_INGEST_SECRET") ?? "lacir-sih-ingest-2026";
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const secret = req.headers.get("x-ingest-secret") ?? "";
  if (secret !== INGEST_SECRET) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, ... });
  // ... valida JSON body, valida body.table in ('sih_metric_uf','sih_metric_muni'), valida body.rows é array não-vazio ...
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const onConflict = body.table === "sih_metric_uf" ? "disease_id,uf_codigo,ano" : "disease_id,municipio_codigo,ano";
  // upsert em chunks de 400, usando a service role key
});
```

**Achados relevantes para D-07:**

1. **Nenhum `disease_id` está fixado em código.** A função é um passthrough genérico: recebe `body.table` + `body.rows` e faz `upsert` direto, sem validar ou traduzir o valor de `disease_id` de cada linha. **Não há nada para "corrigir junto com a migração" dentro do código desta função** — a conclusão da auditoria (D-07) é "nada a corrigir aqui", não "auditoria pendente".
2. **Consequência para D-06 (tombstones):** como esta função não valida `disease_id` de forma alguma, ela é um **terceiro caminho de escrita** que hoje não tem nenhuma guarda contra reintrodução de id antigo — os outros dois são `scripts/catalog/uploadSihToSupabase.mjs` (upsert direto via PostgREST com a service role key, **não** passa por esta Edge Function) e, presumivelmente, o script Python `scrape_upload_sih.py` mencionado no ROADMAP/notes, que é o chamador real desta função (conforme `docs/SUPABASE-CATALOG.md`: "Uploads via Edge Function `sih-ingest`"). Isso significa que **três** superfícies de escrita, não duas, precisam da checagem de tombstone do D-06: (a) `uploadSihToSupabase.mjs`, (b) o chamador Python de `sih-ingest` (fora do repo — Fase 9), e (c), se o plano optar por validar no servidor também, a própria função `sih-ingest` (mudança que seria trazer código para o repo, o que o CONTEXT explicitamente descarta para esta fase — D-07 diz só auditar). **Recomendação:** a checagem de tombstone do D-06 cabe no lado do cliente/pipeline (Node), não dentro da Edge Function nesta fase — consistente com "versionar `sih-ingest` é Fase 9".
3. **`INGEST_SECRET` confirmado exatamente como o ROADMAP/CONTEXT descrevem:** fallback hardcoded `"lacir-sih-ingest-2026"` quando a env var `SIH_INGEST_SECRET` não está setada no projeto Supabase — confirmado no código real deployado (`VERSION 1`, sem redeploys desde 2026-07-26). **Não corrigido aqui** (fora de escopo — Fase 9), apenas confirmado e registrado, como o CONTEXT já instruía.
4. **Import `jsr:@supabase/supabase-js@2`** — roda em Deno (runtime de Edge Function), não Node — não conflita com a regra de zero deps npm do projeto principal (é um artefato à parte, versionado separadamente pela Supabase, fora do `package.json`).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest `^4.1.10`, config em `vite.config.ts` (não um `vitest.config.ts` separado) — **[VERIFIED]** |
| Config file | `vite.config.ts` — `test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'], css: false, include: ['src/**/*.{test,spec}.{ts,tsx}'] }` |
| Quick run command | `npm run catalog:validate` (CLI, cobre invariantes A-E sobre o catálogo, roda em segundos, sem rede) |
| Full suite command | `npm run test:run` (= `catalog:validate && vitest run`) — já encadeado, nada novo a configurar |

**Implicação importante do `include` glob confirmado:** vitest só enxerga arquivos sob `src/**/*.{test,spec}.{ts,tsx}` — um teste `.test.mjs` colocado em `scripts/catalog/` **não roda** no `vitest run`. Qualquer teste vitest para os invariantes A-F (incluindo a fixture de regressão do D-24) precisa morar sob `src/` (ex.: `src/features/catalog/` ou `src/test/`), mesmo que a função que ele testa venha de `scripts/catalog/validate.mjs` (import relativo funciona normalmente entre as duas árvores, já que ambas são módulos ES).

### Phase Requirements → Test Map

| Req ID | Comportamento | Tipo de teste | Comando automatizado | Arquivo existe? |
|--------|----------|-----------|-------------------|-------------|
| TAX-01 | `id ↔ tabnetCode ↔ cid ↔ label` consistentes para os **331** agravos (330 lista_morb + amputacao_mmii, pós-D-25) | unit (invariantes A/D/E em `validate.mjs`) | `npm run catalog:validate` | ❌ Wave 0 — invariantes A/D/E ainda não existem em `validate.mjs` |
| TAX-02 | Validação falha contra o bug real (`avc`→163) | unit, com fixture da taxonomia pré-migração, sob `src/` para o vitest enxergar | `npx vitest run` (arquivo a criar sob `src/features/catalog/` ou `src/test/`) | ❌ Wave 0 — fixture pré-migração + teste ainda não existem |
| TAX-03 | Contagens exatas + integridade referencial antes/depois | integration, roda contra o Postgres local do ensaio (D-02), não contra prod em CI | SQL de verificação (soma agregada, D-04) rodado manualmente durante o ensaio | ❌ Wave 0 — mecanismo de migração agora **validado empiricamente** (§4), falta escrever o SQL final com os 21 ids reais e o script de verificação |
| TAX-04 | Migração reversível, ciclos não violam PK | integration — script `--down`, **mecânica confirmada por reprodução real nesta pesquisa (§4.2)** | mesmo par de migrations (up/down), chamado no ensaio local | ❌ Wave 0 — falta só transcrever com os 21 ids reais (o padrão já foi testado com o ciclo real) |
| TAX-05 | Apelido resolve para ids canônicos corretos | unit, puro — **algoritmo e limiar já medidos nesta pesquisa (§6.2)** | `npx vitest run` sobre o arquivo novo de apelidos | ❌ Wave 0 |
| TAX-06 | Artefatos derivados batem com a fonte canônica | unit (invariante B em `validate.mjs`) | `npm run catalog:validate` | ❌ Wave 0 — invariante B ainda não existe |

### Sampling Rate
- **Por commit de task:** `npm run catalog:validate` (rápido, sem rede, cobre A-E) a cada mudança em `scripts/catalog/*.mjs` ou nos arquivos de dado (`diseases.json`, `rename-map.json`, `aliases.json`, `exclusions.json`).
- **Por merge de wave:** `npm run test:run` completo (inclui vitest, inclui invariante F).
- **Antes de tocar produção:** o ciclo completo do ensaio local (D-02) — up → verificação de integridade (D-04) → down → verificação de retorno ao estado inicial — roda manualmente, não é parte do gate automático (precisa de um Postgres local populado, o que o CI não tem). O padrão SQL já foi validado por reprodução real nesta pesquisa (§4.2); falta rodar com volume de produção.
- **Phase gate:** `npm run gate` (`test:run && build`) verde antes de `/gsd:verify-work` — já existe, nada novo a configurar.

### Wave 0 Gaps
- [ ] Invariantes A, B, C, D, E como funções exportadas novas em `scripts/catalog/validate.mjs` (mesmo molde de `checkEntry`) — nenhuma existe hoje, o `validate.mjs` atual só cobre proveniência de `variables.json`/packs (Fase 5).
- [ ] Invariante F como teste vitest novo sob `src/` (ex.: `src/test/noTombstoneLiterals.test.ts`), varrendo `git ls-files`.
- [ ] Fixture da taxonomia pré-migração (para TAX-02/D-24) — ainda não existe; decidir formato (array mínimo com os 21 corrompidos + amostra de controle, ou cópia integral congelada do `diseases.json` de hoje).
- [ ] `rename-map.json`, `exclusions.json`, `aliases.json` — nenhum existe ainda; formato é discricionário do planner (CONTEXT já registra isso). `exclusions.json` precisa de entradas para **331/332/333** (motivo: marcador de qualidade de dado, não categoria clínica) — **não** para 330, que agora entra na taxonomia normal (D-25) assim que o filtro `/^todas/i` for corrigido para `code === 'TODAS_AS_CATEGORIAS__'`. `extra-diseases.json` continua só para `amputacao_mmii` (procedimento fora da Lista Morb) — código 330 é `filterKind: 'lista_morb'` genuíno, não precisa de segunda fonte.
- [ ] Script/SQL de verificação de integridade (D-04, soma agregada) — não existe; nem no `scripts/catalog/` nem em `supabase/`. O padrão de SQL (duas passadas, CTEs múltiplas) já está validado por reprodução real (§4.2) — falta só a instância final com os 21 ids.
- [ ] `supabase/` (config.toml, migrations/) — diretório não existe no projeto ainda. Setup confirmado (§3.4): `supabase init` + `supabase link --project-ref hmfbxqemububjyhdckrj` (sem senha do banco) + `supabase migration new <nome>`.
- [ ] Função pura de matching de apelido (algoritmo já medido e recomendado em §6.2 — falta implementar).
- [ ] `supabase/functions/sih-ingest/index.ts` — **não** precisa ser trazido para o repo nesta fase (D-07/Fase 9); auditoria já concluída (§7), nenhuma ação de código necessária dentro da função.

---

## Sources

### Primary (HIGH confidence)
- `http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sih/cnv/nibr.def` — fetch direto nesta sessão, HTTP 200, ISO-8859-1, 334 opções.
- `http://tabnet.datasus.gov.br/cgi/sih/mxcid10lm.htm` — fetch direto nesta sessão, tabela oficial código→CID, 341 itens.
- `http://tabnet.datasus.gov.br/cgi/sih/Morb_geral_loc_int_2008.pdf` — fetch + extração de texto via `pypdf` nesta sessão.
- Leitura completa do código-fonte: `scripts/catalog/sync-lista-morb.mjs`, `validate.mjs`, `build.mjs`, `uploadSihToSupabase.mjs`, `rebuildAfterScrape.mjs`, `syncPackImports.mjs`, `paths.mjs`, `columnMap.json`, `lista-morb-cid.json`; `src/features/catalog/{catalogAnalysisData,taxonomy,types,loadCatalog,filterCatalog}.ts`; `src/routes/mapas/{MeasureDiseasePicker,mockAnalysisData}.tsx`/`.ts`; `src/routes/variaveis/{VariableList,VariaveisPage}.tsx`; `vite.config.ts`.
- Supabase CLI ao vivo nesta máquina: `supabase --version`, `supabase projects list`, `supabase functions list --project-ref hmfbxqemububjyhdckrj`, `supabase functions download sih-ingest --project-ref hmfbxqemububjyhdckrj`, `supabase init`/`link`/`db dump --dry-run`/`db dump -s public` (testados em diretório de scratch, apontando para o projeto real, só leitura).
- **`supabase/functions/sih-ingest/index.ts`** — código-fonte real baixado e lido integralmente nesta sessão.
- **Schema real de produção** — `supabase db dump --linked -s public`, obtido nesta sessão, schema-only, lido integralmente (189 linhas).
- **Reprodução empírica da migração de duas passadas** — container Postgres 17 descartável via Docker, schema idêntico ao de produção, populado com o ciclo real do ground truth, testado up (2 passadas) → down (2 passadas) → estado idêntico ao original. Container destruído ao final da sessão.
- PostgREST ao vivo (chave anon, mesma rota do app): contagens de `sih_disease`/`sih_metric_uf`/`sih_metric_muni`.
- `/Users/pedroalmeida/Projects/Mneuma/meuma.rascunho/supabase/migrations/` — 133 arquivos reais, convenção de nomenclatura observada diretamente.
- Medição programática do algoritmo de apelidos contra os 330 rótulos reais de `scripts/catalog/diseases.json` (Python, reproduzindo a lógica hand-rolled equivalente ao que seria escrito em JS).

### Secondary (MEDIUM confidence)
- WebSearch para localizar `mxcid10lm.htm` (confirmado como página oficial DATASUS pelo domínio e conteúdo, não por citação de terceiros).

### Tertiary (LOW confidence — sinalizado [ASSUMED] no corpo do texto)
- Custo/tempo de execução da migração em volume real de produção (~1,13M linhas) — o *mecanismo* está confirmado (§4.2), o *custo em escala* não foi medido (exigiria rodar contra uma cópia real de 1,13M linhas, fora do escopo desta pesquisa — é o próprio propósito do ensaio local D-02).

## Assumptions Log

| # | Claim | Seção | Status | Risco se errado |
|---|---|---|---|---|
| ~~A1~~ | ~~FKs não-deferráveis do Postgres checam ao final do statement~~ | §4.2 | **RESOLVIDO — confirmado por reprodução empírica real** (container Docker, schema idêntico, ciclo real testado up+down) | — |
| ~~A2~~ | ~~FKs de produção não são `DEFERRABLE`~~ | §4.1 | **RESOLVIDO — confirmado via `pg_dump` real da produção**: nenhuma das duas FKs tem cláusula `DEFERRABLE`; ambas têm `ON DELETE CASCADE` (achado novo, não documentado antes) | — |
| A3 | O volume de linhas efetivamente tocado pela migração é uma fração pequena das 1,13M linhas totais (só os 21 ids afetados, não a tabela inteira) | §4.4 | Aberto | Se a distribuição de linhas por agravo for muito desigual e os 21 ids concentrarem um volume desproporcional, o tempo/lock da migração pode ser maior do que o estimado — medir no ensaio, não assumir |
| A4 | `syncColumnMap.mjs` regenera `columnMap.json` do zero a partir de `diseases.json` (e não faz merge incremental que preservaria entradas com id antigo) | §2.3 | Aberto — não lido o script `syncColumnMap.mjs` nesta pesquisa (só citado) | Se fizer merge incremental, `columnMap.json` pode reter chaves com ids antigos como tombstone residual não coberto pelo invariante F (que varre `git ls-files` de código-fonte, mas `columnMap.json` é dado — precisaria estar coberto por D, não por F) |
| A5 | O tempo de `EXPLAIN ANALYZE` para os UPDATEs em escala real (não medido) não vai exceder um lock aceitável para uma janela de manutenção curta | §4.4 | Aberto | Se for um lock longo, pode ser necessário rodar fora do horário de aula ou em lotes menores (por id, não os 21 de uma vez) — decidir no ensaio, não assumir |

**Nota sobre a 2ª passada:** as duas suposições de maior risco da 1ª passada (A1, A2) foram **resolvidas por medição direta** nesta sessão (dump real de schema + reprodução em container Docker descartável) — não ficaram como suposição. O que resta em aberto (A3-A5) é especificamente o que só um ensaio contra volume real de produção pode responder — não é algo que uma sessão de pesquisa consiga resolver sem tocar os dados de produção, o que está fora do escopo permitido aqui.

## Open Questions

1. ~~Código 330: excluir ou incluir?~~ — **RESOLVIDO por decisão do usuário, registrada como D-25 em CONTEXT.md** (2026-08-03): código 330 **entra** na taxonomia como agravo canônico nº 331, contra a recomendação original deste documento. Ver `## ⚠ Tensão com decisão travada` (agora seção de resolução, não mais aberta) para o histórico completo.

2. **`parseCsv.mjs`/nomes de coluna legados (`internacoes_embolia_trombose_arteriais` etc.) — renomear junto ou deixar como está?**
   - O que sabemos: são nomes de coluna do CSV histórico, referenciados por `columnKey`, camada distinta do `disease.id`.
   - O que não está claro: se D-21 ("packs, imports e variables.json renomeados agora") pretendia incluir isso.
   - Recomendação: deixar como está nesta fase (nomes de coluna não vazam para o estudante do mesmo jeito que `id`/`label` vazam) — mas o planner deve decidir explicitamente, não por omissão.

3. **`ON DELETE CASCADE` não documentado — o plano de migração precisa evitar qualquer caminho que apague `sih_disease` mesmo que temporariamente?**
   - O que sabemos: confirmado via dump real que ambas as FKs têm `ON DELETE CASCADE` (§4.1) — não estava em `docs/SUPABASE-CATALOG.md`.
   - O que não está claro: se algum script existente (fora do que li nesta pesquisa) já faz `DELETE`+`INSERT` em `sih_disease` em vez de `UPDATE` — não encontrei nenhum, mas não é uma garantia de exaustão.
   - Recomendação: o plano de duas passadas com `UPDATE` (D-01, já testado) nunca aciona isso — só registrar o achado como pitfall documentado para não ser reintroduzido por engano numa iteração futura do SQL.

## Metadata

**Confidence breakdown:**
- Fonte oficial / taxonomia: HIGH — fetch direto, duas fontes cruzadas, números medidos programaticamente.
- Blast radius do código: HIGH — grep + leitura de arquivo completa, contagens conferidas.
- Ambiente Supabase (CLI, contagens de produção, schema real): HIGH — comandos rodados ao vivo nesta sessão, incluindo dump de schema real e download do código da Edge Function.
- Mecânica de migração Postgres (duas passadas, ciclos, up/down): **HIGH** (revisado para cima na 2ª passada) — confirmado por reprodução empírica completa contra um schema idêntico ao de produção, exercitando o ciclo real do ground truth.
- Custo/tempo de migração em escala real (1,13M linhas): LOW — não medido, é o propósito do ensaio local D-02, fora do escopo desta pesquisa.
- Invariantes A-F / divisão CLI vs vitest: MEDIUM — mapeamento direto sobre padrão existente (`checkEntry`/`checkCatalog`) e sobre o `include` glob real do vitest, mas nenhuma função nova foi escrita ou testada.
- Apelidos/fuzzy: HIGH (revisado para cima) — algoritmo medido programaticamente contra os 330 rótulos reais, com taxa de falso-positivo real reportada.
- Auditoria `sih-ingest`: HIGH — código-fonte real lido integralmente.

**Research date:** 2026-08-03
**Valid until:** ~7 dias para a parte de custo/tempo de migração em escala (só o ensaio local resolve isso, não uma janela de validade) — ~30 dias para o restante (schema real, blast radius de código, algoritmo de apelidos — estável até o código ou o schema de produção mudarem).

---

## RESEARCH COMPLETE — histórico das duas passadas

**1ª passada** (interrompida por limite de sessão, salva imediatamente): confirmou a fonte oficial da taxonomia, os códigos 330-333, as contagens de produção e a presença/autenticação do Supabase CLI. Deixou como `[ASSUMED]`/pendente: mecânica de FK do Postgres, comando exato de `pg_dump`, auditoria de `sih-ingest`, medição de fuzzy.

**2ª passada** (esta), completou:
1. ✅ Códigos 330-333 — resolvido com evidência de duas fontes DATASUS.
2. ✅ Mecânica de FK do Postgres — **confirmada por reprodução empírica real** (container Docker descartável, ciclo real testado up+down), não mais suposição.
3. ✅ Nomes reais de constraints/índices — obtidos via `pg_dump` real da produção (schema-only, read-only), revelando divergências não documentadas (`ON DELETE CASCADE`, nomes de índice reais).
4. ✅ Setup do Supabase CLI neste projeto — testado em diretório de scratch (`init`/`link`/`db dump --dry-run`/`db dump` real), confirmado que não pede senha do banco manualmente (CLI já autenticado provisiona role temporária via Management API).
5. ✅ Auditoria de `sih-ingest` — código-fonte completo baixado e lido; nenhum id fixado; três superfícies de escrita identificadas para a checagem de tombstone (D-06).
6. ✅ Fuzzy matcher — algoritmo recomendado (piso de 6 caracteres + AND entre tokens) medido contra os 330 rótulos reais, com taxa de falso-positivo reportada.
7. ✅ Blast radius — ampliado além da tabela do CONTEXT (`mockAnalysisData.ts`, `paths.mjs`, `syncColumnMap.mjs`, `columnMap.json`, contagem real de arquivos de teste).
8. ✅ Validation Architecture — `vite.config.ts` confirmado, incluindo a implicação do `include` glob para onde os testes de invariante precisam morar.

**3ª passada** (reconciliação com D-25, decisão do usuário tomada depois da 2ª passada — código 330 entra na taxonomia, contra a recomendação original deste documento):
9. ✅ Documento inteiro reconciliado com D-25: `## ⚠ Tensão` convertida em registro de resolução (histórico preservado, não apagado); `## Summary`/Primary recommendation atualizados; contagem 330→331 propagada em Phase Requirements, Validation Architecture e nas seções 1.2/4/5; nova seção §4.5 cobrindo o `INSERT` do agravo novo (trivial, sem CTE múltipla — sem filhos hoje) e a exceção de invariante que o D-04/invariante D precisam tolerar explicitamente para este único agravo sem métrica; D-25 copiada verbatim para `<user_constraints>`.

**Não medido nesta pesquisa (propositalmente, por estar fora do escopo permitido ou exigir volume real de produção):** tempo/custo de execução da migração em 1,13M linhas reais — isso é o propósito do próprio ensaio local (D-02), que a fase de execução (não a de pesquisa) deve rodar.
