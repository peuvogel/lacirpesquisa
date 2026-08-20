# Mapas: pergunta progressiva, grupos diretos e análise segura

## Objetivo

Transformar `/mapas` no percurso principal da capacitação: o ligante começa pelo mapa real do Brasil já existente, formula uma pergunta por escolhas visuais e só depois vê dados, teste e interpretação. O usuário não precisa conhecer previamente o teste estatístico.

Princípio da interface:

> PERGUNTA → POPULAÇÃO/VARIÁVEIS → DESCREVER OU COMPARAR → TESTE ADEQUADO → RESULTADO → INTERPRETAÇÃO

Esta entrega altera somente a experiência da rota Mapas. A área Estatística, o backend, o esquema Supabase e o pipeline de dados permanecem inalterados. Arquivos globais podem ser tocados apenas para publicar o mesmo aplicativo no GitHub Pages, sem mudar outras telas.

## Decisões aprovadas

- O mapa do Brasil atual (`BrazilMapCanvas` e sua geometria real) será reutilizado; não haverá outro mock de mapa.
- A interação territorial será direta: o usuário escolhe a população ativa e clica no mapa para “pintar” estados ou municípios nesse conjunto.
- O primeiro conjunto se chama **População selecionada**, não “Grupo A”.
- Um comparador só aparece quando a pergunta realmente precisa dele.
- Cada pergunta tem um único eixo principal de comparação: lugar, período, doença, exposição ou nenhum.
- Múltiplos desfechos podem ser selecionados, mas cada um é analisado separadamente e a família confirmatória mantém a correção de Holm já existente.
- O sistema sugere testes; a pergunta vem antes do nome do teste.
- O trabalho será isolado numa branch e numa referência de restauração anteriores à mudança.

## Fluxo proposto

### 1. Definir a população no mapa

O topo da página apresenta uma frase operacional curta: “Clique no mapa para definir quem entra na sua pergunta”. O grupo ativo aparece como uma pastilha colorida acima do mapa.

Comportamento:

1. No primeiro clique em um território, o sistema cria automaticamente `População selecionada` e inclui o território.
2. Cliques seguintes incluem ou removem territórios do conjunto ativo.
3. Clicar em território pertencente a outro conjunto ativa esse conjunto; não move dados silenciosamente.
4. Regiões, mesorregiões, macrorregiões de saúde, municípios e colagem continuam disponíveis, mas passam a aplicar sua seleção diretamente ao conjunto ativo.
5. O botão **Adicionar comparador** cria `Comparador` e o torna ativo; a cor do mapa mostra imediatamente onde os novos cliques entrarão.
6. Os conjuntos podem ser renomeados e excluídos. Excluir devolve seus territórios ao mapa.
7. Presets territoriais continuam disponíveis como atalhos didáticos e mantêm os mesmos dados geográficos.

Não haverá etapa intermediária de “selecionar e depois adicionar grupo”, arraste obrigatório nem gesto oculto de botão direito.

### 2. Estruturar a pergunta

Depois que a população contém ao menos um território, abre-se a seção **O que você quer descobrir?**. Ela é um construtor visual curto inspirado em PICOT/PECOT, sem obrigar todos os campos:

- `P — População`: resumo territorial do mapa e base ocorrência/residência.
- `Condição`: uma ou mais doenças, com busca por nome/CID, selecionadas no catálogo já existente.
- `Comparação`: nenhum, lugar, período, doença ou exposição.
- `O — Desfecho`: lista compacta de medidas disponíveis.
- `T — Tempo`: ano, intervalo ou períodos distintos.

O eixo de comparação controla o restante do fluxo:

- **Nenhum:** descrição do conjunto e, quando houver série suficiente, tendência Prais–Winsten.
- **Lugar:** exige dois ou mais conjuntos territoriais no mapa e oferece testes entre esses conjuntos.
- **Período:** permite mesmo lugar em janelas distintas e reutiliza a preparação temporal existente.
- **Doença:** mostra doenças lado a lado de forma descritiva no escopo atual. Como o motor ativo agrega doenças antes da análise inferencial, nenhum teste de diferença entre doenças será inventado nesta entrega restrita a Mapas.
- **Exposição:** só é liberada quando a variável contextual está realmente carregável no recorte. Existir no catálogo, sozinho, não significa estar disponível para teste.

O sistema mostra uma frase-resumo sempre atualizada, por exemplo: “Na Bahia, como evoluiu a taxa de internação por diabetes entre 2013 e 2025?” ou “A proporção de óbitos difere entre Bahia e Rio de Janeiro?”.

### 3. Escolher variáveis em lista compacta

A etapa de variáveis da experiência Mapas deixa de usar quatro colunas densas. Ela apresenta uma única lista pesquisável, com filtros por:

- papel: desfecho, exposição/contexto ou denominador;
- tipo: contagem, taxa, numérica ou categórica;
- disponibilidade: completa, parcial ou indisponível;
- fonte/domínio, quando houver mais de uma origem real no recorte.

Cada linha contém somente:

- checkbox;
- nome curto;
- tipo da variável;
- estado de disponibilidade.

Proveniência e método ficam em uma expansão opcional “Fonte e método”. Cobertura parcial continua selecionável e traz uma justificativa curta. Uma variável sem dado em nenhum território selecionado fica desabilitada. Zero, sem dados e dado em revisão permanecem estados distintos.

### 4. Objetivo e teste automático

O usuário escolhe **Descrever**, **Comparar/relacionar** ou **Ambos** em linguagem de pergunta. O motor de elegibilidade existente continua sendo a fonte de verdade:

- duas populações independentes com desfecho numérico: t ou Mann–Whitney conforme perfil e pressupostos;
- três ou mais: ANOVA/Tukey ou Kruskal–Wallis/Dunn;
- proporções categóricas: qui-quadrado quando a tabela é válida;
- duas variáveis numéricas com unidades independentes suficientes: Pearson ou Spearman;
- tendência anual descritiva: Prais–Winsten por grupo;
- regressões somente quando papéis, unidade analítica e requisitos do motor forem satisfeitos.

Quando mais de um teste for válido, o sistema marca um como principal e permite a alternativa válida como sensibilidade. Testes inelegíveis não podem ser executados; a razão aparece em linguagem simples. O usuário nunca escolhe um teste antes da pergunta e das variáveis.

### 5. Dados, gráficos e interpretação

Após a pergunta estar completa, o fluxo usa o workspace de análise real já embutido em `/mapas`:

- disponibilidade e cobertura reais do Supabase;
- distribuição, normalidade e Q–Q no sistema Chart.js já alinhado à área Estatística;
- revisão de zeros e ausências;
- teste estatístico elegível;
- mapas de resultado quando territorialmente pertinentes;
- conclusão em linguagem natural, não apenas valor-p;
- ação clicável para recalcular após incluir/excluir dados revisados.

A interface não monta resultados fictícios durante carregamento e não usa fixtures como fallback de produção.

## Estado e arquitetura

### Estado territorial

`MapAnalysisState` continua sendo o estado persistido do recorte. Serão acrescentadas ações atômicas para atribuir e remover territórios diretamente do conjunto ativo. A normalização preserva sessões antigas.

### Estado da pergunta

Um estado local de Mapas, `MapQuestionDraft`, controla apenas a apresentação e o eixo da pergunta:

```ts
type ComparisonAxis = 'none' | 'place' | 'period' | 'disease' | 'exposure';

interface MapQuestionDraft {
  comparisonAxis: ComparisonAxis;
  objective: 'describe' | 'compare' | 'describe_and_compare' | null;
  search: string;
  variableTypeFilter: VariableType | 'all';
  availabilityFilter: 'all' | 'complete' | 'partial' | 'none';
}
```

Ele não duplica valores analíticos nem dados do Supabase. Doença, período, territórios e base continuam no `MapAnalysisState`/`ResearchDesign`. Mudança semântica invalida análise e resultado já calculados pelo fingerprint existente.

### Integração com o fluxo guiado

O workspace estatístico compartilhado pode receber uma variante de apresentação exclusiva de Mapas para a lista compacta e o objetivo pré-selecionado. A rota `/variaveis` mantém sua aparência e comportamento. Qualquer adaptação compartilhada deve ser opt-in e coberta por teste que garanta ausência de regressão fora de Mapas.

## Limites de correção estatística

- Selecionar várias doenças no recorte atual soma as categorias no pipeline analítico. A interface deve chamar isso de “combinar doenças”, nunca “comparar doenças”.
- A comparação inferencial por doença não é liberada enquanto a identidade da doença não fizer parte da unidade analítica do motor. O estado visual pode estruturar a pergunta e oferecer descrição lado a lado, mas deve falhar fechado para testes independentes espúrios.
- Variáveis contextuais como IDHM e cobertura APS só aparecem como exposição calculável se houver junção territorial e temporal real no snapshot; metadado de catálogo não é suficiente.
- Comparações entre períodos que repetem a mesma unidade precisam respeitar o diagnóstico de independência do motor. Nenhum t/Mann–Whitney independente será oferecido para pares repetidos.

## Acessibilidade e responsividade

- Grupo ativo e cor têm texto, não dependem apenas da cor.
- O mapa mantém botões/paths acessíveis e `aria-pressed` coerente.
- Cada etapa desbloqueada recebe heading e foco previsível; rolagem respeita movimento reduzido.
- Busca, filtros, checkboxes e estados desabilitados são operáveis por teclado.
- Em telas menores, o mapa vem antes dos controles; a pergunta progride abaixo, sem painel lateral obrigatório.

## Publicação e restauração

- Branch de implementação: `codex/map-question-flow`.
- Referência local anterior: `restore/pre-mapas-question-flow-2026-08-20` apontando para `7a8d8d0`.
- Antes do primeiro push, publicar também uma branch remota de restauração com o mesmo commit.
- GitHub Pages será configurado por workflow oficial, buildando `dist` com Node atual e `base` do repositório.
- URL-alvo: `https://peuvogel.github.io/lacirpesquisa/`.
- As credenciais públicas anon do Supabase entram como secrets do repositório; nenhum valor é commitado ou impresso.
- A publicação só ocorre depois de catálogo, pipeline Python, testes Vitest, typecheck, build e smoke visual local verdes.

## Critérios de aceite

1. O mapa real atual é preservado.
2. O primeiro clique territorial cria `População selecionada`; não há cesta nem CTA obrigatório “Adicionar grupo”.
3. Um comparador é criado explicitamente e recebe cliques diretamente.
4. A página faz a pergunta antes de exibir teste estatístico.
5. Só um eixo de comparação fica ativo por pergunta.
6. Doença e período têm controles buscáveis/didáticos, sem despejar centenas de itens sem filtro.
7. A experiência de variáveis em Mapas é uma lista compacta com busca e filtros.
8. O motor automático continua bloqueando testes espúrios e explica sua escolha.
9. Distribuição, normalidade, mapas de resultado e interpretação permanecem no mesmo fluxo `/mapas`.
10. Estatística, backend e schema Supabase não mudam.
11. O gate integral passa e o site publicado é navegável no endereço do GitHub Pages.
12. Existe uma referência de restauração documentada e verificável.

