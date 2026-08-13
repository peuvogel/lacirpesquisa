# Fluxo Mapas → Variáveis → análise estatística didática

**Data:** 2026-08-13

**Estado:** desenho funcional aprovado; especificação escrita aguardando revisão final

**Escopo:** reorganizar apenas o fluxo de Mapas, Variáveis e a lógica estatística compartilhada necessária para esse fluxo, incluindo Mann–Whitney. O pipeline SIH e os dados brutos permanecem fora do escopo.

## 1. Objetivo

Transformar o site em uma experiência guiada para a capacitação de bioestatística. O ligante deve começar pela pergunta e pelo recorte epidemiológico, selecionar territórios no mapa, escolher doença e período, conhecer as variáveis realmente disponíveis e executar apenas análises estatisticamente defensáveis.

O sistema deve ensinar sem sobrecarregar. A interface principal mostra nomes curtos, tipos de variável, cobertura, distribuição, testes possíveis e resultados. Proveniência e metodologia continuam preservadas, mas saem da frente do fluxo e ficam em uma divulgação secundária.

O resultado da pesquisa é lido na própria rota **Variáveis**, junto com os gráficos, mapa e conclusão. A rota **Estatística** continua existindo como laboratório de testes manuais e deve usar os mesmos motores e as mesmas regras do fluxo guiado.

## 2. Princípios vinculantes

1. **Falhar fechado.** Ausência de informação suficiente nunca gera um teste padrão. Não existe fallback para teste t.
2. **Forma da pesquisa antes do nome da variável.** Testes dependem do desenho, do tipo das variáveis, da independência, da cobertura e dos valores observados; palavras como “óbitos” ou “taxa” não escolhem um teste sozinhas.
3. **Dado bruto imutável.** Zero suspeito, ausência e exclusão alteram apenas a máscara analítica. Nenhuma heurística da interface reescreve o Supabase, os packs ou o ledger.
4. **Zero não é ausência.** `0`, `null`, não consultado, suprimido e não aplicável são estados distintos em todo o caminho.
5. **Sem imputação automática.** O fluxo guiado não inventa valores nem transforma ausência em zero. A análise usa os dados observados e, quando necessário, uma análise de sensibilidade com cobertura comum.
6. **Resultado completo, linguagem curta.** Tamanho de efeito e intervalo de confiança aparecem antes do valor de *p*. A conclusão informa cobertura, decisões sobre dados e limitações sem uma parede de texto.
7. **Uma fonte de verdade estatística.** Variáveis e Estatística compartilham registro de testes, diagnósticos, motores, interpretações e presets de gráficos.
8. **Sem inferência causal ecológica.** Resultados por estado ou município são apresentados como associações territoriais, nunca como efeitos individuais ou causas.

## 3. Fora do escopo

- Alterar a coleta SIH, a agregação, o ledger, o upload ou as tabelas de produção.
- Reescrever `pipeline/sih/src/sih_pipeline/audit.py`, atualmente modificado por outro trabalho.
- Imputação múltipla ou modelos de dados ausentes no fluxo didático.
- Modelos multinível, painel, zero-inflado, Fisher exato ou séries temporais interrompidas nesta entrega.
- Prometer inferência válida para qualquer combinação de dados. Quando nenhum teste atual serve, o produto diz isso e oferece descrição.
- Substituir o sistema de gráficos existente. Ele será estendido com presets de distribuição e reutilizado.

## 4. Fluxo aprovado

### 4.1 Mapas define o recorte

Mapas passa a terminar depois de quatro decisões:

1. formar e nomear grupos territoriais;
2. escolher uma ou mais doenças;
3. escolher o período, compartilhado ou por grupo;
4. clicar em **Continuar para Variáveis**.

As seções continuam surgindo verticalmente conforme a anterior fica válida. O mapa permanece fluido e permite os agrupamentos, presets e recortes geográficos existentes. Variáveis e testes deixam de ser escolhidos em Mapas.

O estado entregue à próxima rota é um `ResearchDesign`, não uma tabela improvisada e não um `activeTestId`. O desenho preserva grupos, territórios, grão, local de ocorrência/residência, doenças e períodos.

Se grupos usam períodos diferentes, isso continua permitido como desenho descritivo. Uma comparação inferencial só será liberada quando os períodos forem equivalentes ou quando existir uma transformação explicitamente suportada.

### 4.2 Variáveis conduz a pesquisa

A rota abre com um resumo curto do recorte recebido e pergunta o objetivo:

- **Descrever**
- **Comparar**
- **Descrever e comparar**

Depois, exibe apenas variáveis pertinentes às doenças, territórios e períodos escolhidos. A seleção usa checkboxes e colunas por tipo:

- **Contagens**
- **Taxas e percentuais**
- **Numéricas**
- **Categóricas e ordinais**

Variáveis textuais ou apenas referenciais não entram no seletor analítico. Podem ser localizadas numa área secundária, mas aparecem desabilitadas com a razão “não é uma variável analisável neste fluxo”.

Cada opção mostra somente:

- checkbox;
- nome curto da variável;
- tipo, em texto discreto;
- uma linha de cobertura quando ela não for completa.

Fonte, tabela, URL e nota metodológica continuam disponíveis em **Fonte e método**, fechado por padrão. A validação de proveniência do catálogo permanece; apenas a apresentação principal deixa de despejar esses campos no estudante.

O seletor pode oferecer variáveis derivadas quando a derivação for semanticamente definida e auditável. Elas recebem nome curto e tipo normal, mas o detalhe informa os componentes. Exemplos:

- **Desfecho hospitalar (óbito/não óbito)** = `óbitos` e `internações − óbitos`, somente quando as duas medidas têm a mesma cobertura e `internações ≥ óbitos` em todas as células usadas;
- **Média de permanência** = `dias de permanência ÷ internações`, nunca o total de dias apresentado como permanência individual;
- **Taxa por 100 mil** = `eventos ÷ população × 100.000`, somente com numerador e denominador compatíveis em território, ano e base local.

Uma porcentagem pronta não é convertida de volta em frequências para qui-quadrado. Se os componentes necessários não existirem, a variável derivada não entra e a justificativa diz qual componente falta.

### 4.3 Divulgação progressiva em Variáveis

As seções abrem na mesma página, de cima para baixo:

1. objetivo da análise;
2. escolha das variáveis;
3. **Conheça seus dados**;
4. testes permitidos;
5. resultados, gráficos, mapa e conclusão.

Trocar uma decisão anterior invalida de imediato os resultados dependentes. A interface nunca deixa visível um valor de *p*, gráfico ou conclusão calculado com uma seleção antiga.

### 4.4 Resultado dentro de Variáveis

O usuário não é enviado para Estatística. Os testes selecionados rodam e aparecem em Variáveis com:

- resumo descritivo;
- estimativa e tamanho de efeito;
- intervalo de confiança;
- estatística do teste e valor de *p*;
- premissas e ressalvas;
- gráficos pertinentes;
- conclusão didática;
- ação **Revisar dados usados na análise**.

## 5. Contratos de domínio

Os nomes finais podem acompanhar o padrão do repositório, mas as responsabilidades abaixo são obrigatórias.

```ts
interface ResearchDesign {
  groups: TerritoryGroup[];
  geography: 'uf' | 'municipio' | 'mesorregiao' | 'macro_saude';
  locationBasis: 'ocorrencia' | 'residencia';
  diseaseIds: string[];
  period: SharedOrPerGroupPeriod;
  goal?: 'describe' | 'compare' | 'describe_and_compare';
}

interface VariableProfile {
  variableId: string;
  label: string;
  variableType: 'count' | 'rate' | 'numeric' | 'categorical' | 'ordinal';
  unit?: string;
  numeratorVariableId?: string;
  denominatorVariableId?: string;
  exposureVariableId?: string;
  temporalAggregation:
    | 'sum'
    | 'recompute_rate'
    | 'weighted_mean'
    | 'point_only';
}

type SourceCellStatus =
  | 'observed'
  | 'collection_zero'
  | 'missing'
  | 'suppressed'
  | 'not_applicable'
  | 'not_queried';

type AnalyticCellStatus =
  | 'include'
  | 'exclude_missing'
  | 'exclude_suspected_noncollection'
  | 'exclude_manual'
  | 'requires_review';

interface AnalysisCell {
  territoryId: string;
  groupId: string;
  periodKey: string;
  variableId: string;
  rawValue: number | null;
  sourceStatus: SourceCellStatus;
  analyticStatus: AnalyticCellStatus;
  reasonCode?: string;
}

interface AnalysisScenario {
  id: string;
  kind: 'recommended' | 'researcher_reviewed';
  cells: AnalysisCell[];
  decisions: MissingDataDecision[];
  createdAfterResults: boolean;
  fingerprint: string;
}

type EligibilityStatus = 'eligible' | 'eligible_with_caveat' | 'ineligible';

interface EligibilityDecision {
  testId: TestId;
  status: EligibilityStatus;
  reasons: EligibilityReason[];
  roleAssignments: Record<string, string>;
  diagnosticsUsed: string[];
}
```

`rawValue` e `sourceStatus` são imutáveis depois da montagem do conjunto. A revisão do pesquisador altera apenas `analyticStatus` e cria um novo `AnalysisScenario`.

## 6. Origem e disponibilidade dos dados

### 6.1 Fonte de verdade

O fluxo guiado não pode depender apenas dos dez packs estáticos atuais. A disponibilidade deve vir da cobertura real da seleção:

- metadados/taxonomia de `sih_disease` e catálogo curado;
- `sih_metric_uf` para UF;
- partições municipais no Supabase Storage para município;
- `sih_collection_status` para cobertura por doença, medida, grão, local e ano;
- tabelas de população quando uma taxa ou exposição exigir denominador.

Os packs locais continuam úteis como cache, fallback controlado e fixtures de teste durante a migração, mas não definem sozinhos quais doenças ou anos existem.

O cliente usa apenas leitura anônima protegida por RLS. Decisões de uma análise não são gravadas no Supabase.

Esta entrega não cria tabelas. Se o plano posterior descobrir que uma nova tabela exposta é indispensável, ela exigirá `GRANT SELECT TO anon`, RLS habilitada e policy explícita de leitura; o Supabase deixou de expor automaticamente novas tabelas do schema público em projetos novos e passará a impor essa regra a todos os projetos. Buckets públicos podem servir partições por URL, mas continuam sem permissão pública de upload, alteração ou remoção.

### 6.2 Três estados da checkbox

Para cada variável, a cobertura é calculada sobre o produto dos territórios e períodos esperados no desenho:

| Estado | Aparência | Seleção | Regra |
|---|---|---|---|
| Completa | normal | permitida | existe valor utilizável ou zero confirmado em todas as células esperadas |
| Parcial | cinza discreto | permitida | existe ao menos uma célula utilizável e ao menos uma ausente/inaplicável |
| Sem dados | cinza desabilitado | bloqueada | nenhuma célula utilizável entre os grupos e períodos escolhidos |

A justificativa parcial é concreta e curta: “Sem dados em BA e SE em 2025” ou “Disponível de 2013 a 2024; 2025 ainda sem cobertura”. Um detalhe expansível lista todas as células.

Selecionar uma variável parcial é permitido. O conjunto analítico usa somente células válidas e informa `n esperado`, `n usado` e `n ausente`.

### 6.3 Agregação temporal

Um intervalo nunca significa silenciosamente “usar o último ano”. Cada `VariableProfile` declara uma política:

- contagens, custos totais e dias totais: soma dos anos válidos;
- taxas e proporções: recomputadas a partir da soma dos numeradores e denominadores compatíveis, nunca pela média simples de taxas anuais;
- médias: média ponderada pelo denominador apropriado, como internações para permanência média;
- indicador sem agregação temporal defensável: disponível apenas em ponto temporal.

Se faltarem anos dentro do intervalo, a cobertura mostra os anos presentes e ausentes. A análise principal pode usar cobertura parcial, mas a comparação entre grupos também oferece suporte temporal comum. Período A e período B do mesmo território formam medidas relacionadas; não viram grupos independentes.

### 6.4 Precedência para interpretar uma célula

1. Denominador igual a zero → `not_applicable`, nunca taxa zero.
2. Supressão explícita da fonte → `suppressed`, nunca zero.
3. Ledger `falhou` ou `nunca_tentado` → `missing`.
4. Ledger `coletado` e linha de métrica ausente → `collection_zero`, conforme D-14 da Fase 9.
5. Linha numérica finita → `observed`, inclusive quando o valor bruto é zero.
6. Falha de rede, partição incompleta ou consulta cancelada → `not_queried`; nunca é convertida em zero nem tratada como “sem ocorrência”.

## 7. Zero, sem dados e anomalias de cobertura

### 7.1 Estados visuais do mapa

- valor positivo: rampa coroplética;
- zero confirmado e incluído: classe própria clara com legenda **0**;
- sem dados, suprimido ou não aplicável: cinza/hachura com legenda **Sem dados**;
- zero suspeito aguardando decisão: cinza/hachura com contorno de revisão;
- zero suspeito excluído pelo cenário recomendado: visual de **Sem dados**, com tooltip “Valor bruto: 0; tratado como ausência provável de coleta nesta análise”.

O domínio, os cortes e a legenda ignoram `null`, `undefined`, suprimidos e não aplicáveis. Assim, ausência nunca puxa o mínimo da escala para zero.

### 7.2 Detector de zero incompatível

O detector produz uma recomendação analítica; não corrige a fonte. Um zero é excluído por padrão como `suspected_noncollection` somente quando todas estas condições forem satisfeitas:

1. a análise não é municipal;
2. a variável não foi classificada como rara ou de pequeno volume;
3. há pelo menos cinco territórios/períodos comparáveis e pelo menos 80% deles têm valor positivo;
4. existem ao menos dois pontos históricos positivos adjacentes para o mesmo território;
5. tanto a expectativa pelo histórico do território quanto a expectativa pelos pares normalizados por exposição são pelo menos 20 eventos;
6. não existe confirmação territorial explícita da fonte de que aquele zero é verdadeiro.

Medianas robustas, e não médias brutas, formam as duas expectativas. A comparação entre territórios usa população/exposição quando disponível; um estado populoso não é comparado diretamente a um estado pequeno apenas pelo total.

O status anual `coletado` do ledger não conta sozinho como confirmação territorial explícita: ele prova que a combinação doença×medida×grão×local×ano foi processada, mas não elimina a possibilidade de uma falha localizada. Assim, um estado que passa abruptamente de dezenas de milhares para zero, enquanto histórico e pares ajustados por exposição continuam altos, entra como **Sem dados** no cenário recomendado. O `collection_zero` bruto permanece registrado e pode ser restaurado pelo pesquisador. Indicadores relacionados e sinais de completude local reforçam ou enfraquecem a recomendação e aparecem na justificativa.

O limiar de 20 é uma política conservadora do produto para separar zeros obviamente incompatíveis de contagens pequenas e instáveis. Ele não é apresentado como lei epidemiológica e deve viver em uma configuração central testada, não espalhada na interface.

Se faltar qualquer evidência, o sistema não autoexclui: encaminha para revisão manual.

### 7.3 Revisão obrigatória em recortes pequenos ou raros

Exigem decisão manual antes da inferência:

- qualquer análise municipal com zeros suspeitos;
- qualquer grupo com menos de dez unidades independentes utilizáveis;
- taxa baseada em menos de 16 eventos em parte material da seleção;
- variável com padrão de zeros compatível com evento raro;
- evidência conflitante entre ledger, histórico, pares e indicadores relacionados.

O valor 16 serve apenas para disparar cautela sobre estabilidade de taxas pequenas; ele não suprime automaticamente o dado SIH.

As escolhas são:

- **Incluir mantendo os zeros**;
- **Incluir tratando zeros suspeitos como sem dados**;
- **Não incluir esta variável**.

A decisão fica registrada no cenário e reaparece na conclusão.

### 7.4 Cobertura comum e sensibilidade

Quando grupos têm coberturas diferentes, o cenário recomendado usa o maior conjunto de observações válidas compatível com o teste. Se a comparação puder mudar por causa da cobertura, o sistema também calcula uma sensibilidade no suporte comum, isto é, somente territórios/períodos presentes em todos os lados comparados.

Se direção, tamanho de efeito ou conclusão diferirem materialmente, a conclusão diz que o resultado é sensível à cobertura. Nenhum mecanismo de ausência é chamado de MCAR, MAR ou MNAR sem evidência externa.

## 8. Conheça seus dados

### 8.1 Conteúdo

Para cada variável selecionada:

- `n esperado`, `n disponível`, `n usado` e `n ausente`;
- mínimo, máximo, mediana, média e dispersão pertinentes ao tipo;
- histograma com pontos/boxplot para variáveis numéricas;
- gráfico Q–Q quando a normalidade for uma premissa relevante;
- frequências para categóricas/ordinais;
- proporção de zeros e dispersão para contagens;
- série temporal quando o desenho tiver tempo;
- mapa coroplético quando a geografia for pertinente.

### 8.2 Normalidade

A interface usa três rótulos:

- **Aproximadamente normal**;
- **Não normal**;
- **Dados insuficientes para avaliar**.

O sistema não declara que uma população “é normal” apenas porque um teste não rejeitou a hipótese. A classificação combina Q–Q, assimetria/outliers e Shapiro–Wilk quando o tamanho de amostra suportar. Em amostras grandes, o teste formal não decide sozinho, porque desvios irrelevantes podem gerar valores de *p* pequenos.

Em comparações, a distribuição é avaliada dentro de cada grupo ou nos resíduos do modelo, nunca no conjunto agrupado. Para contagens e categóricas, normalidade aparece como **Não se aplica** e é substituída pelos diagnósticos adequados.

### 8.3 Uso caso a caso dos dados ausentes

- descrição: usa os valores disponíveis de cada variável separadamente;
- comparação de grupos: usa valores disponíveis para o desfecho em cada grupo e mostra o desequilíbrio de cobertura;
- correlação: usa somente pares completos das duas variáveis;
- regressão: usa linhas completas para todas as variáveis do modelo e informa quantas foram perdidas por cada uma;
- sensibilidade de cobertura: restringe ao mesmo conjunto de territórios/períodos quando isso for necessário para comparar cenários.

Uma variável ausente não elimina a observação das descrições de outras variáveis. O conjunto usado é registrado por resultado, não apenas uma vez para a página inteira.

## 9. Motor de elegibilidade estatística

### 9.1 Saída

Cada teste do registro recebe exatamente um estado:

- **Pode usar**;
- **Pode usar com ressalva**;
- **Não pode usar**, sempre com uma razão curta.

O motor recebe `ResearchDesign`, perfis das variáveis, conjunto analítico e diagnósticos. Ele não lê rótulos para adivinhar desenho. Nenhuma lista vazia recebe sugestão, nenhuma variável textual vira teste t e nenhuma contagem vira Poisson sem verificar desfecho, exposição e dispersão.

Antes dos testes, um gate de compatibilidade exige o mesmo grão geográfico, base de localização, chave temporal e definição de unidade entre as células comparadas. Taxas com denominadores conceitualmente diferentes não entram na mesma análise. Contagens brutas entre territórios de exposições muito diferentes são descritivas; para inferência territorial, o sistema exige taxa padronizada/compatível ou modelo de contagem com offset. A exceção é uma pergunta explicitamente sobre volume assistencial por local de ocorrência, ainda assim identificada com ressalva de porte populacional e capacidade instalada.

Nos testes direcionais, o sistema nunca escolhe papéis pela ordem dos checkboxes. O usuário confirma **desfecho** e **fatores explicativos** antes de uma regressão. Em correlação, confirma os pares. Em comparação de grupos, os grupos do mapa fornecem a variável de agrupamento e cada variável numérica selecionada é um desfecho separado. Se houver várias, os resultados permanecem separados e a multiplicidade é tratada.

### 9.2 Regras por família

| Objetivo/estrutura | Teste | Pode usar quando | Bloqueios principais |
|---|---|---|---|
| Descrever | descritiva | existe ao menos uma célula utilizável | nenhuma observação |
| Dois grupos independentes, desfecho numérico | t de Student com Welch como padrão | ao menos 3 observações independentes por grupo, variação e distribuição/resíduos adequados; amostra pequena gera ressalva | uma observação por estado/grupo, dependência, assimetria extrema pequena, variância nula |
| Dois grupos independentes, numérica ou ordinal | Mann–Whitney | ao menos 3 observações independentes por grupo, dados ordenáveis e variação | pareamento, todos os valores empatados, grupos sem replicação |
| Três ou mais grupos independentes | ANOVA + Tukey | numérica, ao menos 3 por grupo, resíduos aproximadamente normais e homogeneidade aceitável | dependência, grupo sem replicação, heterocedasticidade importante, resíduos inadequados |
| Três ou mais grupos independentes | Kruskal–Wallis + Dunn–Holm | numérica/ordinal, ao menos 3 por grupo e variação | pareamento, todos empatados, grupo sem replicação |
| Duas variáveis categóricas | qui-quadrado | tabela de frequências observadas, nenhuma frequência negativa e contagens esperadas adequadas; no exemplo de mortalidade, usa `óbitos` e `internações − óbitos` | taxas/percentuais no lugar de frequências, componentes com coberturas diferentes, `óbitos > internações`, célula esperada <1 ou mais de 20% das células esperadas <5 |
| Duas numéricas em unidades independentes | Pearson | pares completos, relação aproximadamente linear, sem outlier dominante | registros repetidos por território, série temporal autocorrelacionada, relação não linear |
| Duas numéricas/ordinais em unidades independentes | Spearman | pares completos e relação monotônica | repetição dependente, ausência de variação, relação não monotônica |
| Uma série regular | Prais–Winsten | uma série por vez, intervalos iguais, ao menos 8 pontos consecutivos | painel de estados tratado como uma série, lacunas internas não resolvidas, menos de 8 pontos |
| Contagem com fatores | Poisson | inteiros não negativos, exposição positiva, offset `log(exposição)`, tamanho suficiente e dispersão compatível | Poisson escolhido só pelo tipo, ausência de exposição em comparações territoriais, sobredispersão/excesso de zeros |
| Contagem sobredispersa com fatores | binomial negativa | mesmos requisitos estruturais do Poisson e sobredispersão sustentada | exposição ausente, amostra insuficiente, excesso de zeros que exija outro modelo |
| Desfecho binário individual | regressão logística | linhas individuais com 0/1, eventos e não eventos suficientes para os parâmetros | agregado territorial do catálogo, separação, eventos insuficientes |

Regras conservadoras de tamanho de amostra vivem em configuração central. Para regressões, o gate inicial exige `n ≥ max(20, 10 × (parâmetros + 1))`; para logística, eventos e não eventos também devem sustentar os parâmetros. Um teste pode ser matematicamente calculável e ainda assim ficar **Não pode usar** no fluxo didático.

### 9.3 Independência e tempo

- Vários anos do mesmo estado não são observações independentes para teste t, ANOVA ou correlação comum.
- Uma comparação transversal usa um ponto temporal ou uma agregação de período pré-especificada, com uma linha por unidade territorial.
- Uma série de um território pode usar Prais–Winsten. Um painel de vários territórios exige modelo que está fora do escopo e fica descritivo.
- Períodos sobrepostos ou rolling não são tratados como independentes.

### 9.4 Zeros em Prais–Winsten

O motor atual elimina silenciosamente `y = 0`; isso deve ser removido. A estratégia aprovada é:

- série estritamente positiva: transformação logarítmica e variação percentual por período;
- série com zero confirmado: Prais–Winsten na escala original, com mudança absoluta por período;
- nenhum pseudocount automático e nenhum zero descartado em silêncio.

### 9.5 Testes simultâneos

Quando dois testes são defensáveis, o usuário pode marcar ambos. Antes de ver resultados, um fica identificado como **análise principal** e o outro como **sensibilidade**. O sistema mostra que t/Welch e Mann–Whitney não estimam exatamente a mesma coisa.

Mann–Whitney não será descrito automaticamente como teste de medianas. Ele avalia ordenação/distribuição entre dois grupos; a leitura como diferença de localização exige formatos comparáveis. O resultado inclui U, valor de *p*, tamanho de efeito baseado em ranks/probabilidade de superioridade e interpretação correta.

Ao testar várias variáveis para a mesma pergunta, o sistema preserva todos os resultados e aplica correção de Holm na família confirmatória. Não destaca apenas o resultado favorável.

## 10. Mann–Whitney como teste de primeira classe

Mann–Whitney entra em:

- `TEST_REGISTRY` com id próprio;
- sidebar e **Qual teste?** de Estatística;
- renderização exaustiva de `EstatisticaPage`;
- motor, configuração, interpretação e gráficos próprios;
- motor de elegibilidade de Variáveis;
- navegação cruzada com t de Student quando as colunas forem compatíveis.

O teste é para **dois grupos independentes**. Ele não é um novo nome para o Kruskal–Wallis existente e não substitui teste pareado.

O motor deve tratar empates, informar se usou cálculo exato ou aproximação assintótica, aplicar correção apropriada quando necessário e ser validado contra fixture externa de R ou SciPy.

## 11. Resultados e gráficos

### 11.1 Reuso do sistema atual

`ResultsPanelWithCustomizer`, `ChartCanvas`, exportação PNG, editor e factories existentes continuam sendo a base. Serão adicionadas factories/presets de:

- histograma com pontos;
- Q–Q;
- boxplot/dotplot por grupo;
- visual de ranks para Mann–Whitney;
- mapa geográfico incorporado ao resultado.

Os gráficos existentes de dispersão, série temporal, resíduos, floresta de GLM, ANOVA e heatmap pós-hoc são reutilizados.

### 11.2 Quando mostrar mapa ou heatmap

- UF/município + uma variável espacial: mapa coroplético com zero e **Sem dados** distintos.
- ANOVA/Kruskal com até seis grupos: heatmap das comparações par a par, já suportado pelo sistema atual.
- Mais de seis grupos: resumo ordenado e tabela; não produzir uma matriz ilegível por padrão.
- Correlação: dispersão/ranks.
- Tendência: série observada e ajustada.
- GLM: coeficientes e diagnósticos.

## 12. Revisar dados usados na análise

Depois da conclusão aparece o texto clicável **Revisar dados usados na análise**. Ele abre uma tabela com:

| Local/período | Valor original | Classificação | Usado? | Motivo |
|---|---:|---|---|---|

Para uma célula com valor original, as ações são:

- **Usar o valor original**;
- **Tratar como sem dados**;
- **Restaurar recomendação do sistema**.

Uma célula realmente ausente, sem valor numérico, não pode ser incluída. A interface diz “Não existe valor disponível para esta observação”. Excluir um valor positivo observado fica em uma ação avançada, exige justificativa e sempre cria cenário exploratório.

**Aplicar e recalcular** recompõe cobertura, diagnósticos, elegibilidade, resultados, gráficos, mapa e conclusão em uma única transação de estado. Se o novo conjunto não sustentar o teste, o resultado inferencial é removido e resta a descrição.

### 12.1 Proteção contra escolha pós-resultado

O cenário recomendado nunca é apagado. Alteração feita depois de ver os resultados cria **Cenário revisado pelo pesquisador** e fica marcada como exploração/sensibilidade. A interface compara os dois e diz se a direção, magnitude ou interpretação mudou.

Exemplo de conclusão:

> Foram usadas 68 de 70 observações. Bahia/2025 foi tratada como sem dados porque o zero foi incompatível com a série histórica e com a cobertura dos demais estados.

Após revisão:

> No cenário revisado, Bahia/2025 foi incluída como zero verdadeiro. A estimativa mudou pouco e a interpretação permaneceu a mesma.

Ou, quando houver instabilidade:

> A interpretação mudou após a inclusão do zero suspeito. O resultado é sensível à classificação desse dado e deve ser interpretado com cautela.

## 13. Arquitetura de componentes

### 13.1 Camadas puras

1. **research-design**: normaliza e valida o recorte vindo de Mapas.
2. **data-availability**: consulta metadados, ledger e valores; produz `AnalysisCell[]` sem decidir testes.
3. **data-quality**: classifica zeros, ausências, supressão, anomalias e revisão obrigatória.
4. **data-profiling**: calcula descrição, distribuição, normalidade, dispersão e cobertura.
5. **test-eligibility**: recebe desenho + perfis + diagnósticos e devolve decisões, sem renderizar UI.
6. **analysis-scenarios**: mantém cenário recomendado e revisado, fingerprints e decisões.
7. **test engines**: executam somente configurações já validadas; Mann–Whitney entra aqui.
8. **chart presets**: transformam saídas em gráficos reutilizáveis nas duas rotas.

Cada camada expõe tipos e funções puras. Componentes React orquestram essas camadas; não replicam regras estatísticas em condicionais JSX.

### 13.2 Estado de sessão

`SessionProvider` passa a guardar `researchDesign` e o estado guiado da análise. O `mapAnalysis` legado é migrado por adaptador durante a transição. A nova forma não usa `variableIds` dentro de cada grupo para representar doenças.

Ao voltar para Mapas, grupos, doenças e períodos são preservados. Se o usuário mudar esse recorte, variáveis, diagnósticos, testes e cenários incompatíveis são invalidados por fingerprint.

### 13.3 Compatibilidade com Estatística

A rota Estatística continua aceitando tabela colada/importada e configuração manual. Ela recebe Mann–Whitney e passa a consultar as mesmas regras de elegibilidade quando houver metadados suficientes. No modo puramente manual, a interface pede as informações que não podem ser inferidas, como independência, pareamento e exposição.

## 14. Concorrência, erros e consistência

- Toda consulta é associada ao fingerprint atual. Resposta de seleção antiga é descartada.
- Mudança de doença, período ou território cancela requisições em curso.
- Falha de uma partição municipal produz cobertura parcial/erro recuperável, nunca zeros.
- Erro de rede mostra **Não foi possível verificar a disponibilidade** e oferece tentar novamente; não desabilita definitivamente a variável como se ela não existisse.
- Aplicar uma revisão limpa resultados antigos antes do recálculo. Não existe mistura de gráfico novo com métrica antiga.
- O fingerprint inclui versão dos dados, desenho, variáveis, regras e máscara analítica.
- Limites de linhas e parâmetros falham com mensagem didática; nunca truncam silenciosamente.

## 15. Mudanças dirigidas no código existente

O plano de implementação deverá localizar os arquivos exatos, mas o desenho exige estas substituições:

- `suggestResearchForSelection.ts`: retirar heurística por quantidade de UFs/palavras e fallback t; tornar adaptador do novo motor ou aposentar.
- `suggestTestForVariable.ts`: retirar mapeamento univariado tipo → teste e fallback t; uma variável isolada não define um teste.
- `VariableDetailPanel.tsx`: remover a parede de proveniência da composição principal; preservar detalhes sob divulgação secundária.
- `VariaveisPage.tsx`: trocar catálogo list/detail pelo fluxo progressivo aprovado quando houver `ResearchDesign`; manter uma entrada de catálogo simples quando a rota for aberta diretamente.
- `MapasPage.tsx` e `mapAnalysisState.ts`: terminar no recorte e entregar `ResearchDesign`, sem teste sugerido.
- `ReviewAnalysisDialog.tsx`: deixar de escolher teste; virar revisão curta do recorte ou ser removido em favor do CTA direto.
- `assembleHandoffTable.ts`: deixar de colapsar ausência em linha omitida sem status; o novo assembler produz `AnalysisCell[]` antes de qualquer tabela para motor.
- `BrazilMapCanvas.tsx`, `choroplethScale.ts` e `ChoroplethLegend.tsx`: distinguir zero, ausência e não aplicável e excluir não numéricos do domínio.
- `praisEngine.ts`: aceitar zero confirmado e escolher escala/interpretação sem descartá-lo.
- `TEST_REGISTRY` e renderização exaustiva: adicionar Mann–Whitney.
- `src/shared/charts`: adicionar distribuição/Q–Q/box-ranks por factories, sem criar um segundo sistema de gráficos.

## 16. Estratégia de testes

### 16.1 Unidade

- `null`, `undefined` e falha de consulta nunca viram zero.
- ledger coletado + linha ausente produz `collection_zero`.
- taxa com denominador zero produz `not_applicable`.
- escala e legenda de mapa ignoram ausência e diferenciam zero.
- disponibilidade completa, parcial e vazia para combinações de estado/ano.
- detector de zero incompatível em contagem alta; nenhum autoexclude municipal/raro.
- cenário revisado não altera `rawValue` nem apaga o recomendado.
- nenhuma seleção vazia produz teste t.
- uma observação por grupo bloqueia t, Mann–Whitney, ANOVA e Kruskal.
- contagem sem exposição não oferece Poisson para comparação territorial.
- registros repetidos estado×ano bloqueiam testes que exigem independência.
- Prais preserva zero e não cria pseudocount.
- qualquer mudança de fingerprint invalida resultado.

### 16.2 Oráculos estatísticos

- fixtures Mann–Whitney sem empates, com empates e amostras pequenas validadas contra R/SciPy;
- U, valor de *p*, tamanho de efeito e método exato/assintótico;
- paridade de regressões com offset e diagnóstico de dispersão antes de liberar Poisson/NB no fluxo guiado;
- fixtures de Shapiro–Wilk e diagnósticos de grupo, com tolerâncias numéricas explícitas;
- fixture Prais em escala original com zero e fixture positiva em log/APC.

### 16.3 Integração e interface

- Mapas → Variáveis preserva grupos, doença e período e não envia teste.
- checkboxes aparecem em colunas por tipo e respeitam os três estados de disponibilidade.
- variável parcial pode ser selecionada; variável sem nenhuma célula não pode.
- seções surgem progressivamente e resultados antigos somem ao mudar input.
- objetivo **Descrever e comparar** produz ambos os blocos.
- dois testes elegíveis podem ser marcados, com principal e sensibilidade.
- resultado aparece em Variáveis com gráficos e mapa pertinentes.
- **Revisar dados usados** cria cenário revisado, recalcula tudo e preserva o recomendado.
- navegador testa teclado, foco, reduced motion, texto responsivo e estados de erro.

### 16.4 Gates

Antes de concluir a implementação:

```bash
npm run typecheck
npm run test:run
npm run build
```

O gate final inclui o pipeline porque `npm run test:run` já o executa, mas a implementação não modifica arquivos do pipeline. Testes focados rodam durante cada etapa para manter o ciclo curto.

## 17. Critérios de aceitação

1. O fluxo começa em Mapas e termina a seleção de recorte antes de Variáveis.
2. A tela Variáveis não mostra a ficha extensa de proveniência no caminho principal.
3. Variáveis são escolhidas por checkbox, em colunas por tipo, com cobertura contextual.
4. Parcial é selecionável e explicado; nenhuma cobertura é desabilitada.
5. Mapa distingue valor positivo, zero e **Sem dados** sem distorcer a escala.
6. Zero de grande volume claramente incompatível é excluído no cenário recomendado, preservando o valor bruto e permitindo reversão.
7. Município, amostra pequena e evento raro exigem decisão manual quando houver ambiguidade.
8. **Conheça seus dados** mostra distribuição, cobertura e diagnóstico apropriado ao tipo.
9. O motor nunca oferece teste apenas pelo nome/tipo e nunca aplica fallback t.
10. Mann–Whitney existe de fato em Estatística e Variáveis, com U, efeito e interpretação corretos.
11. Usuário pode executar dois testes elegíveis, identificando principal e sensibilidade.
12. Resultados, gráficos, mapa e conclusão aparecem na própria tela Variáveis.
13. A conclusão informa observações usadas/esperadas e explica brevemente exclusões.
14. **Revisar dados usados na análise** recalcula tudo e preserva o cenário original.
15. Nenhum resultado antigo sobrevive a uma mudança de seleção ou cenário.
16. Todos os gates automatizados passam sem tocar na alteração paralela de `audit.py`.

## 18. Referências metodológicas usadas no desenho

- WHO, *Data Quality Review*: distinção entre zero verdadeiro e ausência de notificação. <https://iris.who.int/bitstream/handle/10665/259225/9789241512732-eng.pdf?sequence=1>
- WHO, *Analysis and use of health facility data*: completude, consistência, outliers e ajustes transparentes. <https://www.who.int/docs/default-source/documents/ddi/facilityanalysisguidance-integratedhealthsservices.pdf>
- CDC, *Surveillance Indicators*: necessidade de distinguir ausência de evento de ausência de procura/notificação. <https://www.cdc.gov/surv-manual/php/table-of-contents/chapter-18-surveillance-indicators.html>
- CDC, *Describing Epidemiologic Data*: representação cartográfica distinta para zero e sem dados. <https://www.cdc.gov/field-epi-manual/php/chapters/describing-epi-data.html>
- CDC, *Suppression of Rates and Counts*: instabilidade de taxas baseadas em pequenas contagens. <https://www.cdc.gov/united-states-cancer-statistics/technical-notes/suppression.html>
- STROBE: relato de dados ausentes, população analisada e análises de sensibilidade. <https://www.strobe-statement.org/fileadmin/Strobe/uploads/checklists/STROBE_checklist_v4_combined.pdf>
- ASA, *Statement on Statistical Significance and P-Values*: transparência, multiplicidade e rejeição de conclusões baseadas apenas em limiar de *p*. <https://www.amstat.org/asa/files/pdfs/p-valuestatement.pdf>
- Office of Research Integrity, *Selective Reporting of Results*: mudanças pós-resultado devem ser descritas e justificadas. <https://ori.hhs.gov/selective-reporting-results>
- NIST, diagnóstico de normalidade e resíduos. <https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd445.htm>
- R `wilcox.test`: teste de soma de postos para dois grupos independentes. <https://stat.ethz.ch/R-manual/R-devel/library/stats/html/wilcox.test.html>
- Revisão de zeros em doenças raras e pequenas áreas. <https://pmc.ncbi.nlm.nih.gov/articles/PMC11119276/>
- Avaliação de Prais–Winsten em séries curtas. <https://pmc.ncbi.nlm.nih.gov/articles/PMC10946734/>

## 19. Sequenciamento recomendado da implementação

Esta especificação forma uma entrega integrada, mas deve ser implementada em fatias verificáveis:

1. contratos de domínio, classificação de células e disponibilidade;
2. motor de diagnóstico e elegibilidade fail-closed;
3. Mann–Whitney e correções obrigatórias nos motores atuais;
4. novo handoff de Mapas e fluxo progressivo de Variáveis;
5. gráficos, mapa triestado e resultados inline;
6. cenários recomendado/revisado e revisão pós-conclusão;
7. integração completa, acessibilidade, regressão e gate.

Cada fatia começa por testes que expressem as regras acima. Nenhuma fatia introduz um caminho temporário que volte a sugerir teste por heurística nominal.
