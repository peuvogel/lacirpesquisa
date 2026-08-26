# Diagnóstico de entrada de dados, gráficos e catálogo

Data: 2026-08-25. Código inspecionado: `6737acb801b72e8f18dbf4ffc695f88d4eb28f6c`.

Este é um registro de diagnóstico, não uma declaração de correção nem uma especificação aprovada. Nenhum código do aplicativo foi alterado nesta etapa. A revisão completa de segurança ainda está pendente.

## Estado local

- A implementação anterior de grupos independentes está na pasta principal do projeto, no commit inspecionado.
- `npm run dev` executa Vite. O servidor já existente em `http://localhost:5176/` foi usado para a reprodução; o processo do usuário não foi interrompido.
- A implementação da revisão descrita abaixo permanece pendente de validação do desenho.

## Falhas confirmadas

### 1. Catálogo no GitHub Pages

`src/features/catalog/loadCatalog.ts` fixa a base em `/data/catalog`, ignorando `import.meta.env.BASE_URL`. O workflow de Pages constrói o aplicativo com `--base /lacirpesquisa/`.

Verificação HTTP nesta etapa:

- `https://peuvogel.github.io/data/catalog/manifest.json`: 404.
- `https://peuvogel.github.io/lacirpesquisa/data/catalog/manifest.json`: 200.

Os testes atuais cobrem somente a base `/`. Faltam regressões para a base de projeto e para falhas de resposta/JSON. O carregador também não compartilha uma promessa em andamento entre chamadas simultâneas.

### 2. Mann–Whitney ao reutilizar dados de outro teste

Reprodução no navegador local:

1. Abrir t de Student, clicar em **Usar exemplo** e **Analisar dados**.
2. Selecionar **Mann–Whitney**.
3. Confirmar a independência dos grupos e clicar em **Analisar dados**.
4. Aparece exatamente: “Mann–Whitney exige exatamente dois grupos independentes com dados.”

A tabela do exemplo t contém duas colunas numéricas, uma por grupo. O fallback de `mannWhitneyConfig.ts` interpreta a primeira como `desfecho` e a segunda como `grupo`, embora ambas estejam marcadas como numéricas. Os sete valores diferentes da segunda coluna passam a ser sete rótulos de grupo. A validação só ocorre após confirmar os dados e a mensagem não explica esse mapeamento.

Regressões necessárias: formato com uma coluna por grupo, formato valor/grupo, reutilização entre testes, contagem dos grupos antes da análise e mensagens que indiquem coluna e ação corretiva. Uma correção não deve presumir independência ou descartar grupos para forçar a execução.

### 3. Entrada, edição e identificação das variáveis

- `useTabularInput.ts`: contadores independentes para arquivo e texto permitem que uma leitura antiga sobrescreva a fonte mais recente. Falta uma geração única de requisição e invalidação cruzada.
- `ColumnPreviewTable.tsx`: uma alteração de célula ou cabeçalho recalcula os papéis detectados e sobrescreve os papéis escolhidos manualmente.
- `SessionProvider.tsx`: a sessão armazena cabeçalhos/linhas, mas não o mapeamento confirmado por teste. Trocar de teste e retornar recalcula o mapeamento.
- `recognizedColumnsFromTabular.ts`: a remontagem usa `join(';')` sem escapar delimitadores, aspas e quebras de linha. Células válidas podem alterar a interpretação das colunas na transferência.
- `deriveRecognizedColumnsFromRoles`: aliases e fallback posicional não respeitam integralmente escolhas explícitas e podem atribuir uma coluna numérica ao papel de grupo.
- `FlowSteps.tsx`: ao carregar dados, a área de entrada é substituída pela configuração. Antes de analisar, não há ação visível para substituir ou limpar a tabela em vários módulos.
- O editor mostra apenas as primeiras oito linhas, mas confirma todas. Não existe paginação para editar o restante.
- A persistência atual é somente em memória; recarregar a página perde os dados. Um teste explicita a ausência de armazenamento no navegador. Persistência entre recarregamentos exige decisão explícita sobre privacidade.
- `TabularInputPanel.tsx`: a mensagem específica produzida pelo parser não aparece no alerta principal.

### 4. Gráficos e controles

- `glmCoefForestChart.ts`: calcula limites de IC95%, mas desenha somente estimativas pontuais. Os limites aparecem apenas no tooltip. O eixo de OR é rotulado como logarítmico sem configurar uma escala logarítmica.
- `anovaChart.ts`: apresenta a margem do IC como uma segunda barra partindo de zero, não como intervalo ao redor da média.
- `kruskalCharts.ts`: passa mediana e desvio-padrão ao gráfico de médias da ANOVA, que calcula `1.96 × SD / sqrt(n)` e o rotula como IC. Isso não constitui um IC válido da mediana.
- `ChartCanvas.tsx`: altura fixa de 220/250 px e `overflow-hidden`. Anotações deslocadas acima do maior valor competem com título/legenda e podem ser cortadas, coerentemente com a imagem fornecida.
- Alguns controles de IC, valores, p global, linha ajustada, rótulos e escala não alteram as propriedades anunciadas, ou usam chaves que não correspondem às anotações reais. Há ocorrências em ANOVA, Kruskal, GLM e Prais.
- Faltam opções de altura e expansão. O clique no canvas também abre edição, misturando exploração dos pontos com configuração.

Regressões necessárias: intervalos realmente renderizados; valores/limites verificados com fixtures; todos os controles com efeito observável; rótulos longos, valores negativos e diferentes alturas; comparação de distribuições com pontos e boxplot/mediana-IQR, sem chamar IQR de IC.

### 5. Interações e fonte

- `ResearchAccordionPanel.tsx` monta/desmonta o corpo sem animação.
- O componente compartilhado de conteúdo recolhível não anima a abertura/fechamento.
- A fonte global é Sora, com famílias repetidas no código de gráficos. O carregamento externo inclui 400/700, enquanto o código também solicita 500/600.

A proposta de sistema visual deverá centralizar a fonte do sistema, estados de hover/foco e animações que respeitem `prefers-reduced-motion`.

### 6. Robustez da importação e nomes de grupos

Inspeção complementar, sem carregar arquivos grandes ou provocar indisponibilidade:

- `readWorkbookTablesFromFile` lê todo o arquivo sem verificar `file.size`.
- `unzipDeflateRaw` acumula todo o resultado descompactado com `Response(...).arrayBuffer()` sem teto de bytes. `unzipXlsxEntries` descompacta todas as entradas, inclusive as não utilizadas, sem limite agregado.
- `parseWorksheetRows` converte a referência de célula em índice e aloca uma linha até o maior índice, sem limite de colunas/células. Uma referência malformada pode demandar uma alocação desproporcional.
- Texto colado e arquivos de texto também não têm limites de tamanho na entrada. Limites aplicados pelos motores estatísticos só chegam depois do parsing e da alocação.
- Em Qui-quadrado, a matriz de contingência é alocada antes de validar o limite de 20×20 categorias. Dados de alta cardinalidade podem consumir memória antes que a mensagem de limite seja exibida.

Essas lacunas indicam risco de indisponibilidade da aba por consumo de recursos. Não foi executada uma carga destrutiva para demonstrar travamento. As regressões devem usar limites pequenos configuráveis e fixtures compactas, incluindo cabeçalhos ZIP inválidos e referências de células fora da faixa permitida.

Uma reprodução não destrutiva chamou os motores reais de ANOVA e Kruskal por `ssrLoadModule`, com quatro linhas. O grupo `Grupo A` foi aceito; os grupos `constructor` e `__proto__` causaram `groups[rawGroup].push is not a function` em ambos. A causa é usar um objeto `{}` como dicionário de grupos e consultar propriedades herdadas. Deve-se preservar nomes de grupo arbitrários usando `Map` ou um dicionário sem protótipo, incluindo os resumos e consumidores seguintes.

## Dependências e limites da auditoria de segurança

`npm audit --json` retornou sete pacotes sinalizados: seis de gravidade alta e um moderado, todos com correção disponível. Nenhum crítico.

Pacotes: `brace-expansion`, `fast-uri`, `hono`, `js-yaml`, `nanoid`, `react-router` e `react-router-dom`.

Os cinco primeiros estão na árvore transitiva do CLI `shadcn`, atualmente listado em `dependencies`. O alerta do React Router envolve recursos RSC; o aplicativo inspecionado usa uma SPA. A presença do aviso não comprova exploração no aplicativo publicado. Ainda é necessário atualizar de forma compatível, repetir a auditoria e testar o build.

Checagens complementares no projeto Supabase vinculado, por consultas de metadados somente:

- `supabase db advisors --linked --type security --level info --output json`: nenhuma ocorrência reportada.
- As sete tabelas atuais de `public` consultadas têm RLS habilitado, acesso de leitura para `anon` e somente políticas de `SELECT` para `anon`/`authenticated`.
- Há também privilégios SQL de escrita concedidos a `anon`, embora as políticas RLS não autorizem operações de escrita por linha. As migrações locais usam `GRANT ALL` e privilégios padrão amplos. Uma correção deve aplicar menor privilégio sem retirar a leitura pública dos agregados.
- A consulta de funções `SECURITY DEFINER` em `public` retornou zero linhas.
- O cliente frontend inspecionado usa somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; não foi encontrada referência de chave de serviço no código frontend nem no workflow de Pages.
- A única ocorrência funcional de `dangerouslySetInnerHTML` em `src` injeta ícones estáticos de um mapa local, não células ou rótulos importados. Existem testes de renderização inerte para conteúdo parecido com HTML.
- A exportação localizada nesta interface é PNG de canvas; não foi encontrada exportação CSV a ser corrigida por injeção de fórmulas.

Não houve alteração dos dados, schema ou permissões da aplicação. O comando de diagnóstico da CLI informa a inicialização de um papel de login operacional. Este diagnóstico não certifica a segurança integral do backend; o resultado dos advisors e as consultas cobrem apenas os verificadores executados e metadados inspecionados. Limites de importação e permissões mínimas permanecem pendentes de correção.

## Verificações executadas

- Catálogo e Mann–Whitney: 3 arquivos, 13 testes aprovados.
- Auditoria independente de entrada/editor/sessão/limpeza: 28 testes aprovados.
- Auditoria independente de gráficos: 24 testes aprovados.
- Reprodução visual de Mann–Whitney e checagem HTTP dos caminhos do catálogo.
- Verificação completa posterior: `npm run gate` terminou com exit code 0, incluindo catálogo, pipeline Python, 146 arquivos/1.129 testes Vitest e build de produção. A saída contém testes Python ignorados e aviso de bundle principal acima de 500 kB; o comando não prova os cenários ausentes.
- Reprodução direta de rótulos reservados em ANOVA/Kruskal e consultas de segurança do banco vinculado.

Os testes existentes passam apesar das falhas: faltam os cenários de regressão acima. Nenhuma correção foi publicada.

## Referências técnicas consultadas

- [Chart.js: dimensionamento responsivo](https://www.chartjs.org/docs/latest/configuration/responsive.html): o tamanho deve ser controlado pelo contêiner dedicado ao canvas.
- [SciPy: Mann–Whitney](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mannwhitneyu.html): duas amostras independentes; cuidados com empates e método exato/aproximado.
- [NIST: boxplots](https://www.itl.nist.gov/div898/handbook/eda/section3/boxplot.htm): mediana, quartis e variação entre grupos.
- [Supabase: segurança da Data API](https://supabase.com/docs/guides/api/securing-your-api): privilégios e RLS são camadas diferentes; o acesso público deve ter permissões mínimas explícitas.

## Próxima decisão

Validar uma revisão dos componentes compartilhados que preserve a seleção explícita de grupos: tabela editável com identificação estável das colunas e mapeamento por teste; validação antes da execução; gráficos com representação estatística correta e tamanho ajustável; armazenamento no dispositivo somente por escolha explícita. A alternativa de correções isoladas tem menor escopo imediato, mas não resolve a perda de escolhas entre módulos. Uma reescrita total amplia o risco e não é necessária para os problemas encontrados.
