# Mapas: grupos explícitos, comparabilidade e gráficos por teste

## Status e precedência

Este documento substitui, para a rota `/mapas`, o desenho de pergunta progressiva
registrado em `2026-08-20-mapas-pergunta-progressiva-design.md`. A análise guiada,
o catálogo, a integridade dos dados e o GitHub Pages permanecem; o que muda é a
ordem da experiência e a autonomia dos grupos.

Decisão aprovada em 20 de agosto de 2026: a pessoa primeiro seleciona e confirma
grupos explícitos. Cada grupo mantém territórios, doença, medida e período próprios.
O mesmo território pode participar de mais de um grupo quando isso representa um
desenho relacionado, temporal ou por doença.

## Objetivo

Recuperar a clareza do fluxo anterior — selecionar territórios, confirmar um grupo
e configurá-lo — sem perder as proteções estatísticas e a análise embutida adicionadas
depois. A rota deve permitir liberdade de recorte, mas nunca transformar uma seleção
arbitrária em um teste inferencial silenciosamente.

O princípio de interação passa a ser:

> SELECIONAR TERRITÓRIOS → CRIAR GRUPO → CONFIGURAR O GRUPO → REPETIR → VALIDAR A COMPARAÇÃO → ANALISAR

## Escopo

Incluído:

- restauração da cesta de seleção territorial antes da criação do grupo;
- criação explícita e edição visual de grupos;
- doença, medida e período independentes por grupo;
- sobreposição territorial entre grupos;
- avaliação determinística de comparabilidade;
- mensagens bloqueantes, alertas e notas metodológicas;
- recomendação de teste subordinada ao desenho e aos diagnósticos reais;
- catálogo de gráficos específico para cada teste já existente;
- testes automatizados, QA visual responsivo e publicação pelo workflow existente.

Fora do escopo:

- criar um novo teste estatístico sem motor já existente;
- inferir efeitos individuais a partir dos dados ecológicos;
- fabricar denominadores, exposições, valores municipais ou células ausentes;
- alterar schema Supabase ou o pipeline SIH;
- modificar a experiência principal das rotas `/estatistica` e `/variaveis`, salvo
  componentes compartilhados opt-in e sem regressão.

## Experiência da pessoa usuária

### 1. Cesta territorial

Sem grupo ativo em modo de edição, clicar em estados, municípios ou presets apenas
altera uma cesta provisória. O mapa usa o próximo acento da paleta com preenchimento
suave e contorno tracejado; o texto **Seleção atual** informa a quantidade e mostra
amostras dos territórios.

A cesta oferece duas ações explícitas:

- **Criar Grupo N**, ação primária;
- **Limpar seleção**, ação secundária.

Nenhum clique cria automaticamente `População selecionada`. Não há gesto obrigatório
de arraste nem ação escondida no botão direito. A colagem territorial alimenta a mesma
cesta e mantém o relatório de itens reconhecidos e não reconhecidos.

### 2. Criação e delimitação do grupo

Ao confirmar a cesta, a aplicação cria um grupo com nome sugerido e cor estável. Os
territórios passam do estado provisório para o preenchimento sólido do grupo. A cesta
é esvaziada e o novo grupo vira o grupo ativo.

O topo do mapa exibe fichas de grupo, não “populações da pergunta”. Cada ficha mostra:

- ponto e borda na cor do grupo;
- nome editável;
- contagem territorial;
- resumo curto de doença, medida e período;
- estado `incompleto`, `pronto`, `atenção` ou `bloqueado` com texto e ícone;
- ações **Editar**, **Renomear** e **Excluir**.

O botão **Novo grupo** sai do modo de edição, abre uma cesta vazia e deixa inequívoco
que os próximos cliques formarão outro grupo. Ao editar territórios de um grupo, o
cabeçalho diz **Editando territórios de Grupo X** e os cliques afetam somente esse
grupo.

### 3. Configuração independente

O painel lateral sempre pertence ao grupo ativo e usa a mesma cor de sua ficha. Ele
contém, nesta ordem:

1. **Territórios** — lista resumida, quantidade e ação de editar no mapa;
2. **Doença/condição** — busca no catálogo CID-10;
3. **Medida** — apenas medidas realmente disponíveis para a doença escolhida;
4. **Período** — ano, intervalo ou dois pontos, limitado à cobertura das medidas;
5. **Resumo do grupo** — frase legível com lugar, doença, medida e tempo.

`MapAnalysisGroup.variableIds` continua sendo a fonte persistida para doença × medida,
e `MapAnalysisGroup.time` continua sendo a temporalidade do grupo. Os painéis globais
`SharedDiseasePanel` e `SharedPeriodPanel` deixam de comandar a rota Mapas. Novos
grupos nascem sem doença e período escolhidos; nenhum valor de outro grupo é copiado
silenciosamente.

A independência é o padrão. Esta entrega não terá cópia global ou automática de
configuração entre grupos.

### 4. Sobreposição territorial

O reducer deixa de impor proprietário territorial único. Um território permanece sem
duplicação dentro de um grupo, mas pode aparecer em grupos diferentes.

No mapa:

- grupo ativo: preenchimento sólido e contorno forte;
- um grupo inativo: preenchimento suave e contorno de sua cor;
- dois ou mais grupos: preenchimento neutro com anéis/contornos concêntricos nas cores
  correspondentes;
- foco ou hover: tooltip lista todos os grupos aos quais o território pertence.

Cor nunca é a única pista. `aria-label`, legenda e tooltip dizem os nomes dos grupos.

### 5. Revisão da comparação

Com um grupo completo, a pessoa pode abrir descrição e tendência quando elegíveis.
Com dois ou mais grupos completos, surge **Revisar comparação**. Essa ação abre uma
matriz pequena com uma coluna por grupo e linhas para território, doença, medida e
período. A última coluna, **O que mudou?**, resume as diferenças.

A aplicação infere o desenho a partir dessas diferenças; ela não pergunta primeiro o
nome do teste nem força a pessoa a declarar um eixo que contradiga sua seleção.

Exemplos de mensagens:

- “Somente o lugar mudou: comparação territorial independente.”
- “Somente o período mudou e os territórios são os mesmos: comparação pareada.”
- “A doença e o lugar mudaram ao mesmo tempo. Não será possível atribuir a diferença
  a uma única dimensão.”

## Modelo de comparabilidade

### Contratos

Um módulo puro `comparisonAssessment.ts` recebe grupos normalizados e, depois do
carregamento, perfis/células analíticas. Ele não executa testes e não altera seleção.

```ts
type ComparisonDimension = 'territory' | 'disease' | 'measure' | 'period';
type ComparisonDesignKind =
  | 'descriptive'
  | 'independent_place'
  | 'paired_period'
  | 'paired_disease'
  | 'time_series'
  | 'confounded'
  | 'unsupported';

type ComparisonIssueSeverity = 'block' | 'warning' | 'info';

interface ComparisonIssue {
  code: string;
  severity: ComparisonIssueSeverity;
  title: string;
  message: string;
  groupIds: string[];
  remediation?: string;
}

interface ComparisonAssessment {
  designKind: ComparisonDesignKind;
  differingDimensions: ComparisonDimension[];
  issues: ComparisonIssue[];
  canDescribe: boolean;
  canInfer: boolean;
  candidateTestIds: string[];
}
```

Os códigos, não o texto renderizado, são usados pelos testes e pelas decisões de UI.
Mensagens ficam centralizadas em português claro.

### Validação antes de carregar dados

Bloqueios:

- grupo sem território, doença, medida ou período válido;
- dois grupos com território, doença, medida e período idênticos;
- medidas com tipo ou unidade incompatível;
- grupos que diferem em duas ou mais dimensões analíticas para um teste simples;
- sobreposição parcial enviada a teste independente;
- grupos pareados sem o mesmo conjunto de unidades analíticas;
- variável sem cobertura em todos os grupos necessários;
- contagens territoriais brutas comparadas sem denominador/taxa compatível;
- janelas de duração diferente comparadas por soma bruta;
- desenho para o qual nenhum motor existente preserva a dependência.

Alertas:

- grupos muito desequilibrados;
- período curto para tendência;
- cobertura parcial ou ausência desbalanceada;
- muitas doenças, medidas, grupos ou hipóteses;
- resultado baseado em taxa não padronizada quando estrutura etária pode diferir;
- divergência conhecida entre fonte e coleta local.

Informações sempre visíveis quando pertinentes:

- unidade analítica usada pelo teste;
- base territorial de ocorrência/residência;
- dados agregados não sustentam inferência individual;
- diferença estatística não implica causalidade.

### Regras por diferença entre grupos

| Diferença | Relação territorial | Desenho | Comportamento |
|---|---|---|---|
| nenhuma | qualquer | duplicado | bloquear inferência e sugerir excluir/editar |
| território | conjuntos disjuntos | independente por lugar | liberar testes independentes compatíveis |
| território | sobreposição parcial | dependência mista | bloquear inferência simples |
| período | territórios idênticos | pareado ou série | parear por território; usar série quando houver anos regulares suficientes |
| doença | territórios e período idênticos | pareado por unidade | alinhar a mesma medida; liberar somente motor pareado compatível |
| medida | qualquer | desfechos distintos | descrever separadamente; não testar escalas diferentes |
| duas ou mais dimensões | qualquer | confundido | permitir descrição e bloquear atribuição inferencial simples |

Para `paired_disease`, o handoff alinha valores de doenças diferentes numa única
coluna de desfecho somente quando o `measureId`, a unidade, os territórios e o período
são iguais. A identidade da doença permanece em metadados/grupo; nunca se soma doenças
para fingir uma comparação. Se a alternativa pareada não paramétrica necessária não
existir no registro, o sistema mantém a descrição e explica a limitação.

### Validação depois de carregar dados

O módulo reaproveita os perfis e elegibilidade existentes em vez de duplicar fórmulas.
Ele acrescenta issues para:

- tamanho amostral real insuficiente;
- pares incompletos;
- células esperadas inadequadas no qui-quadrado;
- forte assimetria, outliers influentes ou heterocedasticidade;
- sobredispersão em Poisson;
- separação/convergência na logística;
- autocorrelação ou irregularidade temporal;
- multiplicidade de comparações.

Falha de pressuposto não troca de teste silenciosamente. A tela explica o diagnóstico,
marca a alternativa como principal ou sensibilidade e conserva a escolha visível.

## Dados e estado

`MapAnalysisState` continua persistido pela sessão. A mudança remove o comportamento
automático de `ASSIGN_TERRITORIES_TO_ACTIVE`, restaura criação explícita e adiciona
ações atômicas de inclusão/remoção que não consultam “proprietário” global.

A cesta territorial é estado transitório de `MapasPage`:

```ts
interface TerritoryDraftSelection {
  territories: TerritoryRef[];
  mode: 'new_group' | 'edit_group';
  targetGroupId: string | null;
}
```

Ela não entra no fingerprint da análise até ser confirmada. Alterar qualquer grupo
confirmado invalida resultados cujo fingerprint não corresponda ao novo desenho.

`createResearchDesignFromMapState` passa primeiro por `ComparisonAssessment`. Para
desenhos suportados, ele produz o contrato compatível com o workspace guiado e inclui
somente as configurações necessárias. Para configurações arbitrárias/confundidas, a
rota mantém os grupos para descrição, mas não cria um design inferencial executável.

O montador de tabela usa o assessment:

- lugar: mesma coluna de desfecho, linhas de territórios disjuntos e coluna Grupo;
- período: mesma coluna de desfecho, pareamento por território e período;
- doença: mesma medida alinhada, pareamento por território e doença identificada no grupo;
- série: uma linha por território × ano, sem colapsar o tempo no último ano.

Zeros observados, ausência, supressão, não consultado e revisão continuam distintos.

## Seleção e apresentação de testes

O sistema apresenta primeiro o desenho detectado, depois a recomendação. O conjunto
inicial de motores permanece o registro existente:

- `t-student` independente/Welch ou pareado;
- `anova-tukey`;
- `kruskal-dunn`;
- `qui-quadrado`;
- `correlacao` Pearson/Spearman;
- `prais-winsten`;
- `poisson`;
- `binomial-negativa`;
- `logistica`.

Um teste só aparece como executável quando desenho, unidade analítica, tipo de variável,
cobertura e diagnósticos concordam. Testes inelegíveis ficam numa expansão “Por que
este teste não entra?”, com motivo específico. A análise descritiva nunca é ocultada
por falta de teste inferencial.

## Gráficos específicos por teste

O catálogo genérico deixa de ser a navegação principal. Cada teste registra presets
semanticamente válidos e um preset principal. Tipos não aplicáveis não aparecem como
alternativas desabilitadas.

| Teste | Principal | Alternativas e diagnósticos |
|---|---|---|
| t/Welch independente | pontos individuais + resumo/IC | distribuição, diferença com IC, Q–Q e resíduos |
| t pareado | linhas pareadas + diferenças | distribuição das diferenças, diferença com IC e Q–Q das diferenças |
| ANOVA/Tukey | pontos + box/violin por grupo | diferenças Tukey com IC, heatmap pós-hoc, resíduos × ajustados e Q–Q |
| Kruskal/Dunn | pontos + violin/mediana | ECDF, heatmap de Dunn e distribuição de postos |
| Qui-quadrado | proporções por grupo | mosaico e heatmap de resíduos padronizados |
| Correlação | dispersão com ajuste/IC | dispersão de postos, marginais e resíduos |
| Prais–Winsten | série observada + tendência ajustada | resíduos no tempo e lag plot/ACF curta |
| Poisson | coeficientes/razões com IC | observado × previsto, resíduos × ajustados e dispersão |
| Binomial negativa | coeficientes/razões com IC | observado × previsto e resíduos × ajustados |
| Logística | odds ratios com IC | probabilidade prevista, calibração e ROC quando houver ambos os desfechos |

Gráficos de comparação mostram dados observados sempre que o tamanho permitir. Barras
de média/mediana isoladas deixam de ser padrão. Configurações continuam exportáveis em
PNG e editáveis dentro dos limites coerentes com o preset.

## Arquitetura de componentes

Unidades previstas:

- `TerritoryDraftBar`: cesta provisória e confirmação;
- `MapGroupStrip`: fichas estáveis dos grupos e ação Novo grupo;
- `GroupConfigPanel`: configuração completa do grupo ativo;
- `GroupComparisonMatrix`: diferenças entre grupos;
- `ComparisonIssuesPanel`: issues por severidade e remediação;
- `comparisonAssessment.ts`: regras puras de desenho/comparabilidade;
- `comparisonTable.ts`: alinhamento dos dados conforme desenho;
- factories de gráficos existentes: presets adicionais por teste;
- `chartTypeCatalog.ts`: catálogo indexado por teste, não uma lista universal.

`MapasPage` orquestra esses componentes, mas regras de domínio e configuração de
gráficos ficam em módulos puros testáveis. Não se cria um segundo motor de elegibilidade.

## Erros, recuperação e linguagem

- Bloqueio não apaga seleção nem resultado anterior; explica o que corrigir.
- Mudança de grupo invalida resultado antigo e remove apenas a associação incompatível.
- Falha de carregamento mantém a configuração e oferece tentar novamente.
- Dados indisponíveis não viram zero.
- Mensagens nomeiam grupos e dimensões concretas: “Grupo Bahia usa 2019 e Grupo Rio
  usa 2022”, não “configuração inválida”.
- “Comparação espúria” aparece como explicação secundária; o título principal usa
  linguagem operacional, como “Lugar e doença mudaram juntos”.

## Acessibilidade e responsividade

- seleção provisória e grupo confirmado têm texto e padrão visual diferentes;
- cores têm contraste e são acompanhadas por nome/ícone;
- fichas e matriz são operáveis por teclado;
- `aria-live` anuncia criação, remoção e bloqueios sem repetir mensagens a cada hover;
- foco retorna à ficha criada após confirmação;
- movimento reduzido elimina transições de foco/rolagem não essenciais;
- em telas menores, mapa → cesta/fichas → editor do grupo → revisão; nenhum painel
  lateral bloqueia o mapa.

## Estratégia de testes

### Domínio

- reducer: seleção explícita, criação, edição e sobreposição entre grupos;
- normalização de sessões anteriores;
- assessment: tabela completa de dimensões, sobreposição e severidades;
- alinhamento de lugar, período, doença e série;
- fingerprint invalida análise após mudança semântica.

### Interface

- clicar Bahia não cria grupo;
- confirmar cria Grupo 1 e limpa a cesta;
- Grupo 1 e Grupo 2 mantêm doença/período próprios;
- Bahia pode existir em dois grupos;
- matriz diz exatamente o que mudou;
- bloqueio impede começar análise, mas descrição permanece;
- teclado, foco, `aria-pressed` e movimento reduzido;
- desktop e viewport menor que 1024 px.

### Estatística e gráficos

- recomendação por desenho antes e depois dos diagnósticos;
- teste independente nunca recebe pares/sobreposição;
- série temporal nunca cai em t independente;
- cada teste expõe somente presets permitidos;
- configuração Chart.js inclui dados brutos e diagnósticos esperados;
- exports continuam funcionando.

### Gate e publicação

- `npm run test:run`;
- `npm run typecheck`;
- `npm run build -- --base /lacirpesquisa/`;
- smoke visual local em desktop e tablet;
- push no `main` somente depois do gate verde;
- acompanhar o workflow Pages e validar
  `https://peuvogel.github.io/lacirpesquisa/mapas` após o deploy.

## Fundamentação

- NIST recomenda examinar independência, variância e normalidade por gráficos de
  resíduos, ordem temporal e probabilidade normal:
  <https://www.itl.nist.gov/div898/handbook/pri/section2/pri245.htm>.
- O CDC destaca que contagens isoladas não permitem comparações adequadas entre
  populações de tamanhos diferentes; taxas/denominadores e padronização importam:
  <https://www.cdc.gov/field-epi-manual/php/chapters/describing-epi-data.html>.
- Weissgerber et al. mostram que barras resumidas ocultam distribuição, outliers e
  amostras pequenas, recomendando pontos observados e visualização pareada:
  <https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.1002128>.
- Dados agregados não sustentam automaticamente inferência individual:
  <https://pmc.ncbi.nlm.nih.gov/articles/PMC4209486/>.
- Múltiplas comparações aumentam falsos positivos e exigem controle explícito:
  <https://jamanetwork.com/journals/JAMA/articlepdf/1892228/jgm140005.pdf>.

## Critérios de aceite

1. Clicar no mapa nunca cria grupo automaticamente.
2. A pessoa confirma uma cesta territorial por meio de **Criar Grupo N**.
3. Grupos possuem nome, cor, territórios, doença, medida e período próprios.
4. O mesmo território pode participar de grupos diferentes.
5. O mapa e as fichas deixam claro seleção provisória, grupo ativo e sobreposição.
6. A matriz identifica quais dimensões diferem entre grupos.
7. Configurações confundidas ou incompatíveis não executam teste simples.
8. Mensagens bloqueantes explicam o problema e uma remediação concreta.
9. Descrição permanece disponível quando inferência é bloqueada.
10. Recomendação estatística respeita independência, pareamento, tipo, cobertura e
    diagnósticos reais.
11. Cada teste mostra apenas gráficos adequados e inclui dados/diagnósticos relevantes.
12. Nenhum valor ausente é inventado ou convertido em zero.
13. A experiência é acessível por teclado e responsiva.
14. A suíte integral, typecheck, build Pages e smoke visual passam.
15. O site publicado em GitHub Pages contém o novo fluxo e não o automático.
