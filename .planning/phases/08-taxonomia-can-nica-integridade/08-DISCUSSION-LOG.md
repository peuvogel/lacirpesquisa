# Phase 8: Taxonomia canônica + integridade - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-03
**Phase:** 08-taxonomia-canonica-integridade
**Areas discussed:** Migração no Supabase, Fonte da taxonomia, Apelidos clínicos, Alcance da renomeação

---

## Migração no Supabase

### Mecanismo de renomeação no Postgres

| Opção | Descrição | Escolhida |
|---|---|---|
| Duas passadas com ids temporários | `__mig_<id>` e depois canônico, em transação única. Zero DDL, ciclos impossíveis por construção. ~2× escrita | ✓ |
| Constraints DEFERRABLE + 1 UPDATE | Recriar PK como DEFERRABLE + ON UPDATE CASCADE, um UPDATE só. Metade da escrita, DDL em tabela viva | |
| Rebuild em tabelas novas + swap | INSERT..SELECT em tabelas novas, verificar, RENAME. Rollback instantâneo, 2× storage | |

**Notas:** Opção recomendada e aceita. O fator decisivo é que os dois ciclos verificados deixam de existir por construção, sem precisar tocar em constraint alguma.

### Onde ensaiar

| Opção | Descrição | Escolhida |
|---|---|---|
| Dump → Postgres local | Único ensaio que exercita PK/FK/RLS reais e mede o custo dos 1,1M updates | ✓ |
| Cópias de ensaio no próprio projeto | Sem download, mas CTAS não copia PK/FK — não testa a constraint que os ciclos ameaçam; e dobra storage no free tier | |
| Direto em prod, com dump guardado | Aposta na transação em vez do ensaio | |

**Notas:** O ROADMAP já anotava "ensaiar fora da tabela viva"; a discussão só resolveu onde, dado que não existe projeto de staging.

### O que conta como "reversível" (TAX-04)

| Opção | Descrição | Escolhida |
|---|---|---|
| Script `--down` testado + mapa versionado | Reversão vira código testado (up → verifica → down → verifica) | ✓ |
| Dump pré-migração é o rollback | Operação manual, com downtime | |
| Os dois | Script + dump | |

### Prova de integridade

| Opção | Descrição | Escolhida |
|---|---|---|
| Soma agregada por agravo × medida | COUNT + SUM por disease_id, antes sob id antigo e depois sob canônico | ✓ |
| Só contagem + órfãos FK | O piso de TAX-03; embaralhamento entre os 21 passa | |
| Checksum do conjunto completo | Prova total; sort de 1,1M linhas × 2 | |

**Notas:** Claude apontou antes da pergunta que contagem sozinha não detecta renomeação mapeada errado — as três contagens ficariam idênticas e a integridade referencial passaria. É a classe de bug que originou a fase.

### Onde vive o SQL

| Opção | Descrição | Escolhida |
|---|---|---|
| SQL versionado em `supabase/migrations/` | Convenção Supabase CLI; mesmo arquivo no ensaio local e em prod. Ferramenta nova no projeto | ✓ |
| Script `.mjs` em `scripts/catalog/` | Segue a convenção existente do projeto; zero ferramenta nova | |
| SQL solto pelo MCP/dashboard | Rápido de iterar, não versionável — conflita com D-03 | |

**Notas:** Escolhida a opção não-recomendada. O usuário já usa essa convenção em outro projeto (Mneuma, montado como working dir adicional).

### O que impede um id antigo de reentrar

| Opção | Descrição | Escolhida |
|---|---|---|
| Ids antigos viram tombstone no mapa | Todo ponto de entrada rejeita ruidosamente um id que conste como `old` | ✓ |
| Coleta chaveada por tabnetCode | Ataca a raiz; encosta no território da Fase 9 | |
| A FK já basta | Não cobre os ciclos — `hemorroidas` existe antes e depois com significados diferentes | |

**Notas:** Claude levantou o risco antes de perguntar: pelos dois ciclos, `hemorroidas` deixa de ser o código 186 e vira o 187; `embolia_pulmonar` deixa de ser o 182 e vira o 173. Um id antigo passa pela FK e grava no agravo errado. A opção descartada ficou registrada como ideia adiada para a Fase 9.

### Edge Function `sih-ingest`

| Opção | Descrição | Escolhida |
|---|---|---|
| Só auditar e registrar | Verificar se há id fixado em código; corrigir se houver | ✓ |
| Trazer para o repo agora | Antecipa item da Fase 9 | |
| Não tocar — é tudo Fase 9 | Risco: mapa de ids próprio só apareceria com a coleta longa rodando | |

### ON UPDATE CASCADE

| Opção | Descrição | Escolhida |
|---|---|---|
| Não adicionar | Facilitaria em silêncio a operação que a fase existe para tornar difícil | ✓ |
| Adicionar como melhoria permanente | Segue anotação do ROADMAP; DDL sobre 1,1M linhas | |
| Decida você | | |

**Notas:** O ROADMAP pedia CASCADE, mas o D-01 tornou o item independente do mecanismo. Decisão contraria a anotação do roadmap de forma deliberada e registrada.

---

## Fonte da taxonomia

### De onde a taxonomia é gerada

| Opção | Descrição | Escolhida |
|---|---|---|
| Snapshot versionado + geração offline | Determinística, roda no CI, `--refresh` explícito com diff revisável | ✓ |
| Fetch ao vivo com snapshot de fallback | Sempre atual, não determinística — mudança de rótulo altera ids em silêncio | |
| Manter fetch ao vivo puro | `catalog:validate` passa a depender do TabNet estar no ar | |

### Invariante fail-closed

| Opção | Descrição | Escolhida |
|---|---|---|
| Os dois: semântico + regeneração | `slug(label)===id` pega gerador errado; regeneração byte-idêntica pega edição à mão | ✓ |
| Só o semântico | Não impede edição à mão internamente consistente | |
| Só regeneração byte-idêntica | Gerador errado reproduz o bug byte a byte e passa verde | |

### Mapa de CID mantido à mão

| Opção | Descrição | Escolhida |
|---|---|---|
| Re-keyar por tabnetCode, seguir como fonte | Quebra o acoplamento ao slug; vira segunda fonte de entrada com invariantes próprios | ✓ |
| Puxar o cid para dentro do snapshot | Fecharia TAX-06 sem exceção, se a fonte expuser os intervalos | |
| Fundir dentro de diseases.json | Quebra o invariante de regeneração do D-10 | |

**Notas:** Claude verificou durante a discussão que **nada gera** `lista-morb-cid.json` — `sync-lista-morb.mjs:104` apenas o lê. São 329 pares mantidos à mão, chaveados pelos ids errados, e o `?? null` da linha 114 zeraria o cid dos 21 na migração. A opção 2 ficou registrada como ideia adiada, condicionada ao que o researcher achar no snapshot.

### Construção do mapa old→canonical

| Opção | Descrição | Escolhida |
|---|---|---|
| Computado do diff, depois congelado | Chaveado por código, commitado, com teste de recomputação | ✓ |
| Escrito à mão a partir da nota corrigida | É a prática que produziu o bug; a nota já errou por 1 em 21 | |
| Computado na hora, sem congelar | `--down` perde referência; tombstones não têm onde morar | |

**Notas:** Foi este método que encontrou o 21º id. Claude rodou a simulação antes da pergunta e descobriu que a nota de ground truth lista 20 ids mas o correto é 21 — falta o código 180 (`outras_doencas_arteriais`, rótulo real "Outras doenças cerebrovasculares", I65-I69). A simulação também confirmou zero colisões de slug.

### Conteúdo do snapshot

| Opção | Descrição | Escolhida |
|---|---|---|
| HTML bruto + extrato, com invariante entre eles | HTML como evidência arquivada, extrato como artefato revisável | ✓ |
| Só o extrato | Parser perde fixture própria | |
| Só o HTML bruto | Diff do `--refresh` vira ruído; a revisão prometida pelo D-09 fica inviável | |

### Exclusões e entrada inserida à mão

| Opção | Descrição | Escolhida |
|---|---|---|
| Vira dado com motivo, validado por partição | `exclusions.json` com motivo por código; `amputacao_mmii` vira `extra-diseases.json` | ✓ |
| Documentar em comentário, manter no código | Código novo no TabNet continua entrando/saindo sem aviso | |
| Investigar primeiro, decidir depois | | |

**Notas:** Claude verificou que os `lista_morb` cobrem os códigos 1–329 sem buracos e que `SKIP_CODES` (331/332/333) mais o código 330 ficam fora sem motivo registrado. O que 330–333 são de fato fica como pergunta para o researcher ao capturar o snapshot.

### O "20" da nota de ground truth

| Opção | Descrição | Escolhida |
|---|---|---|
| Corrigir com emenda datada | Preserva o histórico e entrega documento correto ao downstream | ✓ |
| Só registrar no CONTEXT.md | Nota fica intacta; quem a abrir direto ainda lê 20 | |
| Nada — o D-12 já neutraliza | Sobra documento canônico com fato errado | |

### Cópia no bundle

| Opção | Descrição | Escolhida |
|---|---|---|
| Ambos commitados, ambos sob o invariante | Renomeação visível no diff do PR; sem dependência de script no dev/build | ✓ |
| Gerar no build, tirar do git | Impossível dessincronizar, mas a renomeação some da revisão | |
| Eliminar a cópia, derivar em runtime | `scripts/` entra no grafo do bundle Vite | |

---

## Apelidos clínicos

### De onde vêm os apelidos

| Opção | Descrição | Escolhida |
|---|---|---|
| Curado à mão, semeado pelos 21 ids legados | Os ids legados são o vocabulário que a liga usava; cobertura máxima | |
| Curado do zero, só o que a liga pedir | Perde evidência dos termos em uso | |
| Derivar automaticamente do CID / rótulo | Sem curadoria; Claude apontou que "AVC" não existe como conceito no CID-10 | ✓ (revisada) |

**Notas:** O usuário escolheu a derivação automática. Claude mediu a viabilidade em vez de argumentar: (a) uma regra de sigla por iniciais acha **zero** dos 10 termos testados — "Acid vascular cerebr não espec hemorrág ou isquêm" gera `avchi`, não `avc`; (b) a busca por rótulo que já existe acha 3 de 10 termos, e falha em `avc`, `ait`, `tvp`, `varizes` e `aterosclerose`. A medição também revelou que `aterosclerose` falha por variante ortográfica do DataSUS ("Arteroesclerose", distância de edição 2) — esse caso **é** automatizável. Pergunta reapresentada com os números.

### Reapresentação após a medição

| Opção | Descrição | Escolhida |
|---|---|---|
| Automático onde alcança + lista mínima onde não | Acento/token/fuzzy≤2 resolvem grafia; ~4-6 sinônimos verdadeiros curados | ✓ |
| Só automático, sem lista curada | AVC/TVP/AIT/varizes continuam retornando zero; TAX-05 parcialmente cumprido | |
| Voltar à lista curada semeada pelos 21 | Cobertura máxima, ~21 entradas para manter, sem melhoria de grafia | |

**Notas:** Achado que motivou a área: `MeasureDiseasePicker.tsx:53-60` casa a busca contra `disease.id`. Hoje "avc" funciona porque o id literalmente é `avc`. Depois da canonização nenhum id nem rótulo do AVC verdadeiro contém a substring — sem apelidos, a canonização **piora** a busca.

### Apresentação de apelido com N resultados

| Opção | Descrição | Escolhida |
|---|---|---|
| As N como linhas normais + tira explicativa | Estudante escolhe sabendo; didático quanto ao CID | ✓ |
| Uma linha "AVC (3 categorias)" que seleciona as três | Cria pseudo-entidade inexistente no dado; decisão estatística tomada em silêncio | |
| As N sem tira | Estudante não sabe que as três juntas são o que procurava | |

### Onde o apelido aparece

| Opção | Descrição | Escolhida |
|---|---|---|
| Só busca — rótulo exibido sempre oficial | O que o estudante copia é o que ele reencontra no TabNet | ✓ |
| Rótulo oficial + apelido como badge | Badge em 3 linhas sugeriria que cada uma isoladamente é "AVC" | |
| Apelido vira rótulo principal | Estudante copia o nome errado para o trabalho | |

### Guarda contra o dicionário virar o próximo KNOWN_BY_CODE

| Opção | Descrição | Escolhida |
|---|---|---|
| Cada entrada cita código E rótulo esperado | Validação afirma que o rótulo atual bate; renumeração do TabNet falha alto | ✓ |
| Revisão humana no PR | `KNOWN_BY_CODE` também passou por revisão — 21 linhas plausíveis, nenhuma conferida | |
| Nada específico — a lista é minúscula | | |

---

## Alcance da renomeação

### Os 10 packs embutidos

| Opção | Descrição | Escolhida |
|---|---|---|
| Renomear tudo agora | Único caminho que mantém o D-06 intacto; parte do trabalho a Fase 10 deleta | ✓ |
| Só os rótulos visíveis | Exigiria enfraquecer o D-06 com exceção para packs | |
| Renomear packs, adiar `variables.json` | Deixaria por último justamente os rótulos que o estudante lê | |

**Notas:** Alcance medido: 9 de 10 packs com nome errado; 50 de 71 entradas de `variables.json` afetadas; os 10 packs importados estaticamente por nome de arquivo em `catalogAnalysisData.ts:9-18`.

### Os 341 diretórios de coleta

| Opção | Descrição | Escolhida |
|---|---|---|
| Não — o tombstone já protege, é Fase 9 | A Fase 9 redefine a relação diretório↔agravo ao introduzir o ledger | ✓ |
| Renomear junto, agora | Nenhuma ponta solta, mas a Fase 9 pode reorganizar tudo | |
| Só os 21 afetados | Renomear a pasta não prova nada sobre o CSV dentro dela | |

### Ids fixados em código e testes

| Opção | Descrição | Escolhida |
|---|---|---|
| Renomear + guarda estrutural no repositório | Teste varre arquivos versionados e falha em qualquer id-tombstone literal | ✓ |
| Só renomear as ocorrências | A lista de 10 veio de um grep, não de prova de exaustão | |
| Renomear + trocar literais por constante nos testes | Não impede id legado em código de produção | |

**Notas:** `'embolia_trombose'` é o único dos 21 que vazou para `src/` — 8 arquivos de teste mais `taxonomy.ts:218`. Precedente citado: decisão 07-03 de que a guarda contra recorrência é estrutural, não documental.

### Sequência de aterrissagem

| Opção | Descrição | Escolhida |
|---|---|---|
| Mesmo commit — invariante nasce fail-closed | Gate nunca vermelho, nenhuma dívida anotada; commit grande mas gerado | ✓ |
| Invariante com allowlist dos 21, removida depois | É anotação de "falha conhecida", proibida em QA-03; mascararia um 22º id | |
| Renomear primeiro, invariante depois | Invariante nunca é visto falhando contra o bug real | |

**Notas:** Claude registrou a consequência: TAX-02 pede que "o bug `avc` → 163 seria barrado", o que com esta escolha vira um teste do invariante contra a taxonomia pré-migração como fixture.

---

## Claude's Discretion

- Formato exato de `rename-map.json`, `aliases.json`, `exclusions.json`, `extra-diseases.json` — previews neste log são ilustrativos.
- Divisão dos seis invariantes entre `validate.mjs` (CLI) e a suíte vitest.
- Algoritmo e limiar de fuzzy, desde que resolva `aterosclerose` → `Arteroesclerose`.
- Ordem interna das ondas de execução.
- Destino de `VARIABLE_ID_ALIASES` (`mock.*` → catálogo).

## Deferred Ideas

- Chavear o pipeline de coleta por `tabnetCode` em vez de slug — Fase 9.
- Versionar a Edge Function `sih-ingest` em `supabase/functions/` — Fase 9.
- Renomear os 341 diretórios de `coleta_sih_multi/` — Fase 9.
- Puxar os intervalos CID para dentro do snapshot, eliminando `lista-morb-cid.json` — condicionado ao que o researcher achar.
- Busca fuzzy sobre o campo CID; cobertura do dicionário em `VariableList.tsx`.
- Agregador real de N categorias ("somar as 3 do AVC") — fase própria.

## Perguntas levantadas e não discutidas

Listadas nas opções de continuação mas não aprofundadas — registradas para o planner:

- O que acontece com `taxa_mortalidade` derivada durante a renomeação.
- Credencial de conexão direta ao Postgres para o `pg_dump` do D-02 (senha do banco ≠ service role key).
- Como o `packId` (`sih.${id}_uf`) fica acoplado ao id canônico daqui para frente.
- Se a busca fuzzy vale também para o campo CID.
- Quem decide os códigos de cada sinônimo — a liga ou o researcher com base clínica.
