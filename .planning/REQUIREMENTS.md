# Requirements — Bioestatística LACIR v3.0

**Milestone:** v3.0 Dados confiáveis + pesquisa dinâmica via Supabase
**Defined:** 2026-07-28
**Status:** Roadmap mapped — ready for planning

## Contexto

Este milestone é corretivo antes de ser aditivo. O v2.0 entregou as cinco fases planejadas, mas o trabalho pós-Fase-5 seguiu sem commit e chegou aqui com defeitos **verificados** que tornam o produto incorreto, não apenas incompleto:

- 20 agravos exibem dados de outra doença sob rótulo clínico convincente (`sih.avc.internacoes` é rotulado "Internações — AVC" e serve o código 163, "Outras doenças do olho e anexos")
- o mapa promete 330 agravos no seletor e serve 10
- "sem dado", "zero verdadeiro" e "menor balde da escala" pintam o mesmo pixel `#18181b`
- uma consulta de município retorna 1.000 de 6.481 linhas, com HTTP 200 e sem erro
- a suíte está vermelha (24/676) há tempo suficiente para ter parado de sinalizar regressão

Apuração em `.planning/notes/2026-07-28-taxonomia-corrompida-ground-truth.md` e `.planning/notes/2026-07-28-null-vs-zero-choropleth.md`.

O critério de sucesso não é "mais funcionalidades". É: **um estudante da liga consegue pesquisar qualquer um dos 330 agravos no mapa e levar aquele dado até um teste estatístico sem que nada no caminho minta para ele.**

## v3.0 Requirements

### Baseline / Saúde do código

- [x] **QA-01**: `npm run typecheck` passa sem erros
- [x] **QA-02**: A suíte de testes passa integralmente, e passar é pré-condição de commit
- [ ] **QA-03**: Nenhum teste fica vermelho "conhecido" — uma falha nova é distinguível de dívida herdada
- [x] **QA-04**: Registrar um teste novo sem ícone próprio não derruba o sidebar

### Integridade da taxonomia

- [ ] **TAX-01**: Todo agravo tem `id`, `tabnetCode`, `cid` e `label` mutuamente consistentes, derivados da Lista Morb CID-10 oficial
- [ ] **TAX-02**: A validação falha (fail-closed) quando `id ↔ tabnetCode ↔ label` divergem, no CLI e na suíte — o bug `avc` → 163 seria barrado
- [ ] **TAX-03**: A migração preserva a contagem exata de linhas em `sih_disease` (330), `sih_metric_uf` (30.313) e `sih_metric_muni` (1.099.403), com integridade referencial verificada antes e depois
- [ ] **TAX-04**: A migração é reversível e trata os ciclos de renomeação sem violar a chave primária
- [ ] **TAX-05**: O estudante encontra um agravo pelo termo clínico da liga ("AVC", "TVP", "embolia pulmonar") via apelidos curados que resolvem para ids canônicos — o apelido nunca é gravado como chave de dado
- [ ] **TAX-06**: Todo artefato derivado (packs, `variables.json`, seeds SQL, cópia no bundle) é **gerado** a partir da taxonomia canônica, não mantido à mão em paralelo

### Pipeline de coleta

- [ ] **PIPE-01**: Uma falha de rede/DNS/parse é registrada como falha ruidosa, nunca como sucesso com 0 linhas
- [ ] **PIPE-02**: Existe um ledger consultável que informa, por (agravo × medida × grão), se a combinação foi coletada, falhou ou nunca foi tentada — e o app consegue lê-lo
- [ ] **PIPE-03**: A coleta é retomável: reexecutar após interrupção continua de onde parou, sem duplicar linhas
- [ ] **PIPE-04**: O cache bruto só é descartado após o upload correspondente ser confirmado
- [ ] **PIPE-05**: O operador consegue verificar que uma coleta capturou o que afirma ter capturado
- [ ] **PIPE-06**: A coleta respeita limites de requisição do TabNet e sobrevive a execuções longas sem supervisão

### Cobertura de dados

- [ ] **DATA-01**: As 4 medidas (Internações, Óbitos, Valor_total, Dias_permanência) estão coletadas para os 330 agravos no grão UF
- [ ] **DATA-02**: As 4 medidas estão coletadas para os 330 agravos no grão município
- [ ] **DATA-03**: `taxa_mortalidade` é derivável em todo o catálogo, não só nos 5 agravos atuais
- [ ] **DATA-04**: Cada métrica servida ao app carrega a data em que foi coletada

### Mapas dinâmicos

- [ ] **MAPA-01**: O estudante seleciona qualquer um dos 330 agravos e recebe resposta honesta — dado real, "carregando", ou "ainda não coletamos" — nunca clique morto nem mapa vazio sem explicação
- [ ] **MAPA-02**: O choropleth em grão UF é servido ao vivo do Supabase, substituindo os 10 packs embutidos
- [ ] **MAPA-03**: "Sem dado coletado", "zero verdadeiro" e "menor balde" são visualmente distintos no mapa e na legenda
- [ ] **MAPA-04**: Um valor ausente nunca é coagido a 0 — nem no render, nem no domínio da escala, nem na legenda, nem na tabela montada
- [ ] **MAPA-05**: O grão município é buscado sob demanda no drill-down, com carregamento restrito à região aberta
- [ ] **MAPA-06**: Nenhuma consulta é truncada em silêncio — um resultado maior que o limite do PostgREST é paginado por completo ou falha alto
- [ ] **MAPA-07**: Redrilhar o mesmo território/agravo/ano na mesma sessão não refaz a busca
- [ ] **MAPA-08**: Trocar de agravo durante uma busca em voo nunca pinta o dado do agravo anterior sob o rótulo novo
- [ ] **MAPA-09**: Sem Supabase configurado ou acessível, o app diz isso explicitamente na interface
- [ ] **MAPA-10**: A proveniência (fonte, tabela, período, data de coleta, link oficial) fica visível para a métrica ativa durante a exploração, não só no diálogo de revisão

### Fluxo pesquisa → estatística

- [ ] **FLUXO-01**: O estudante leva a seleção do mapa (território × tempo × agravo × grupo) até um teste estatístico com a tabela montada corretamente a partir dos dados ao vivo
- [ ] **FLUXO-02**: A proveniência sobrevive ao handoff e continua visível no resultado do teste
- [ ] **FLUXO-03**: Valores ausentes chegam ao módulo estatístico como ausentes, e o módulo declara explicitamente o que fez com eles — nunca imputa em silêncio
- [ ] **FLUXO-04**: O estudante é avisado quando a comparação montada é estatisticamente frágil (denominador pequeno, taxa instável)

### Varredura de bugs

- [ ] **BUG-01**: Os 9 módulos estatísticos rodam de ponta a ponta pelo fluxo atual sem erro
- [ ] **BUG-02**: O catálogo de Variáveis navega, filtra e carrega sem rótulo enganoso
- [ ] **BUG-03**: O fluxo de Mapas roda de ponta a ponta em uso didático real (UAT com a liga)

## Future Requirements

- Meta-análise didática: efeito fixo/aleatório, forest plot, I², funnel, teste de Egger (META-01…04, adiado do v2.0 para v3.1)
- Comparação período A × período B renderizada no próprio choropleth (modelo de dados já existe, não consumido pelo mapa)
- Small multiples para comparação multi-agravo/multi-período
- Agrupamento por capítulo CID-10 para navegação exploratória
- Atalho "mais usadas pela LACIR" e lista de usados recentemente no seletor
- Favoritos entre sessões / contas de usuário
- Refresh automatizado do pipeline em CI

## Out of Scope

| Item | Reason |
|------|--------|
| Meta-análise | Pedido explícito: garantir primeiro que o resto funcione. Fase 6 do v2.0 volta em v3.1 |
| Login / contas / escrita no Supabase | App permanece somente-leitura (anon + RLS); nenhum segredo de escrita no bundle |
| Scraping do TabNet em tempo de aula | ToS e instabilidade; o app lê o Supabase, nunca o TabNet |
| Supressão de contagens pequenas | SIH já é dado público agregado; esconder números oficiais divergiria da fonte que o produto ensina a ler |
| Substituir silenciosamente um agravo sem dado pelo "mais próximo" | Antididático: o estudante concluiria errado sem saber da substituição |
| Colaboração em tempo real no mapa | Exige identidade e escrita, ambas fora deste milestone |
| Busca sobre o espaço completo do CID-10 | O produto se limita às 330 categorias da Lista Morb, o mesmo agrupamento do TabNet |
| Grafo de proveniência estilo W3C-PROV | Feito para pesquisadores de proveniência, não para estudantes; a tira plana em PT é o nível certo |
| Virtualização da lista de 330 agravos | O gargalo é relevância de busca, não custo de DOM; 330 linhas renderizam bem |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| QA-01 | Phase 7 | Complete |
| QA-02 | Phase 7 | Complete |
| QA-03 | Phase 7 | Pending |
| QA-04 | Phase 7 | Complete |
| TAX-01 | Phase 8 | Pending |
| TAX-02 | Phase 8 | Pending |
| TAX-03 | Phase 8 | Pending |
| TAX-04 | Phase 8 | Pending |
| TAX-05 | Phase 8 | Pending |
| TAX-06 | Phase 8 | Pending |
| PIPE-01 | Phase 9 | Pending |
| PIPE-02 | Phase 9 | Pending |
| PIPE-03 | Phase 9 | Pending |
| PIPE-04 | Phase 9 | Pending |
| PIPE-05 | Phase 9 | Pending |
| PIPE-06 | Phase 9 | Pending |
| DATA-01 | Phase 9 | Pending |
| DATA-02 | Phase 9 | Pending |
| DATA-03 | Phase 9 | Pending |
| DATA-04 | Phase 9 | Pending |
| MAPA-01 | Phase 10 | Pending |
| MAPA-02 | Phase 10 | Pending |
| MAPA-03 | Phase 10 | Pending |
| MAPA-04 | Phase 10 | Pending |
| MAPA-05 | Phase 10 | Pending |
| MAPA-06 | Phase 10 | Pending |
| MAPA-07 | Phase 10 | Pending |
| MAPA-08 | Phase 10 | Pending |
| MAPA-09 | Phase 10 | Pending |
| MAPA-10 | Phase 10 | Pending |
| FLUXO-01 | Phase 11 | Pending |
| FLUXO-02 | Phase 11 | Pending |
| FLUXO-03 | Phase 11 | Pending |
| FLUXO-04 | Phase 11 | Pending |
| BUG-01 | Phase 12 | Pending |
| BUG-02 | Phase 12 | Pending |
| BUG-03 | Phase 12 | Pending |

**Coverage:** 37/37 requirements mapped ✓
**Orphaned requirements:** (none)
**Phantom phase requirements:** (none)

---
*Last updated: 2026-07-28 — milestone v3.0 defined*
