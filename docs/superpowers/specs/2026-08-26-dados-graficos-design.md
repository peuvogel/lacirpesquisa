# Dados, validações e gráficos confiáveis

Data: 2026-08-26.
Status: proposta consolidada para revisão do usuário, antes da implementação.
Base inspecionada: `6737acb`.
Diagnóstico: [achados e reproduções](../../audits/2026-08-25-dados-graficos-diagnostico.md).

## 1. Objetivo e preservação do produto

A pessoa deve conseguir inserir dados, entender quais variáveis e grupos serão analisados, corrigir a tabela, executar um teste compatível e explorar gráficos legíveis. O aplicativo deve explicar por que uma análise não pode ser executada e como corrigir a seleção, sem forçar resultados.

Preservar a seleção explícita de grupos em Mapas: estados/territórios pertencem a grupos identificados, com doenças e períodos independentes. Não reintroduzir o fluxo de pergunta que o usuário rejeitou. Preservar as verificações de sobreposição, diferenças de período, unidade observacional e disponibilidade dos dados já existentes.

A entrega deve estar na pasta principal do projeto, disponível por `npm run dev`. Após os testes, a mesma versão deve ser publicada no GitHub Pages já utilizado pelo projeto, sem trocar a hospedagem ou criar serviços adicionais.

## 2. Decisão de arquitetura

Revisar os componentes compartilhados existentes, com adaptação dos módulos de teste, em vez de reescrever o aplicativo.

Alternativas consideradas:

- Correções pontuais: menor alteração imediata, mas deixam a duplicação de estado e as perdas de mapeamento entre módulos.
- Revisão compartilhada, escolhida: concentra importação, identidade das variáveis, validação e tamanho dos gráficos em contratos testáveis, mantendo motores e navegação existentes.
- Reescrita total: maior custo e risco de perder funcionalidades, sem necessidade demonstrada pelo diagnóstico.

Separar três responsabilidades:

1. **Dados editáveis:** tabela normalizada, identidade das colunas, origem, revisão e escolhas do usuário.
2. **Preparação do teste:** vinculação das colunas aos papéis específicos, definição do formato e validação do conjunto que realmente será analisado.
3. **Resultados:** saída imutável de uma revisão confirmada, com gráficos e opções que correspondem a recursos efetivamente implementados.

Mudanças na tabela, mapeamento ou opções analíticas invalidam o resultado anterior. Mudanças exclusivamente visuais não recalculam o teste. Resultados desatualizados não podem permanecer com aparência de válidos.

## 3. Tabela e fontes de entrada

### Ações acessíveis

Manter **Colar dados**, **Carregar arquivo**, **Usar exemplo**, **Substituir dados** e **Limpar tabela** acessíveis durante a configuração, inclusive quando a primeira importação já deu certo. Não exigir uma análise para chegar ao botão de limpar.

Substituir ou limpar uma tabela com edições deve pedir confirmação. O exemplo substitui a tabela inteira e identifica sua origem; não acrescenta linhas a dados reais. Limpar remove tabela, escolhas analíticas e resultados relacionados, invalida leituras pendentes e volta ao estado inicial. A ação global de limpar sessão também remove dados lembrados no dispositivo.

### Edição

O editor permite alterar cabeçalhos e células de todas as linhas, por paginação de 50 linhas, com numeração e contagem total visíveis. Não apresentar oito linhas editáveis como se fossem a tabela inteira. A tabela não deve analisar somente a página visível.

Papéis escolhidos manualmente sobrevivem a alterações de células e cabeçalhos. Detecção automática sugere escolhas iniciais; não sobrescreve escolhas explícitas. Diferenciar o tipo da coluna — numérica, categórica, tempo ou ignorada — do papel no teste — desfecho, grupo, X, Y, identificador, exposição etc.

Mostrar quantas linhas são válidas, incompletas ou inválidas, com acesso aos números das linhas problemáticas. Não descartar silenciosamente linhas sem mostrar o efeito na amostra. Não transformar dado ausente em zero.

### Uma fonte vence por vez

Texto, arquivo e exemplo compartilham um único identificador crescente de requisição. Somente a última ação do usuário pode confirmar o resultado. Limpar, substituir e desmontar o componente invalidam qualquer leitura/debounce anterior. Erros assíncronos devem chegar ao estado da interface, sem rejeições não tratadas.

### Parsing

Preservar suporte a CSV, TSV, TXT, XLSX e tabelas DATASUS; vírgula decimal; aspas; delimitadores e quebras de linha dentro de células. Transferências internas usam a tabela estruturada diretamente, não uma serialização sem escape seguida de reparsing.

Uma tabela sintaticamente legível pode ir ao editor mesmo que os papéis do teste ainda não estejam completos. A mensagem de mapeamento pertence à configuração, não deve ser confundida com arquivo corrompido.

## 4. Identidade, sessão e persistência

Cada coluna recebe um identificador estável na criação da tabela, independente de nome e posição. Renomear ou editar valores não recria esse identificador. Uma tabela substituída recebe nova identidade/revisão; não herda associações de uma tabela anterior por coincidência de cabeçalho.

Armazenar as vinculações por identificador do teste e da coluna. Reabrir o mesmo teste restaura suas escolhas. Trocar para outro teste preserva os dados, mas só reutiliza associações compatíveis; papéis faltantes devem ser mostrados explicitamente. Os índices numéricos exigidos pelos motores atuais são derivados dessas associações no momento da preparação.

Manter a sessão em memória por padrão. Oferecer **Lembrar neste dispositivo**, desativado por padrão, com aviso de que outra pessoa que use o navegador poderá acessar os dados. Não enviar dados colados/importados a um servidor para implementar persistência.

Quando habilitado, usar um adaptador de armazenamento local assíncrono, com IndexedDB, esquema versionado e validação na leitura. Salvar tabela, tipos, vinculações por teste e preferências visuais serializáveis. Resultados são recalculados a partir de dados e configurações válidos; não confiar em resultados serializados de versões antigas.

Exibir os estados de gravação, salvo e erro. Não afirmar que salvou se o armazenamento falhar, estiver cheio ou indisponível. A aplicação continua utilizável em memória. Desabilitar a opção ou limpar a sessão remove o registro persistido e impede que uma gravação antiga o recrie. Preferências e dados não incluem credenciais, tokens ou conexões.

## 5. Preparação dos testes e mensagens

### Comparações de grupos

Disponibilizar os formatos explícitos **uma coluna por grupo** e **valor + coluna de grupo** para Mann–Whitney, e reutilizar o adaptador onde aplicável às comparações de grupos. Mostrar a interpretação escolhida e os nomes/tamanhos dos grupos antes da análise. Não inferir que toda segunda coluna numérica contém rótulos de grupo.

O caso obrigatório é: exemplo de t de Student → confirmar → abrir Mann–Whitney → selecionar/confirmar o formato de duas colunas → analisar os dois grupos reais, preservando os valores. O próprio exemplo longo de Mann–Whitney deve continuar funcionando.

Mann–Whitney continua exigindo dois grupos independentes. Uma tabela com um grupo, três grupos, grupo vazio, valores insuficientes ou todas as observações iguais recebe mensagem específica antes da execução. Não truncar a lista para os dois primeiros grupos. A independência exige informação do desenho do estudo; nomes diferentes não a comprovam. Para dados pareados, orientar para teste compatível, sem executar um teste independente automaticamente.

Nomes arbitrários como `constructor`, `toString` e `__proto__` não podem quebrar agrupamento, resumos ou gráficos. Usar `Map` ou dicionários sem protótipo em todo o trajeto dos rótulos.

### Contrato de validação

Validadores retornam problemas estruturados com código, gravidade, mensagem, referência a coluna/linhas e orientação corretiva. Bloqueios impedem a execução; alertas explicam limitações sem afirmar que a inferência é automaticamente válida. O resumo do conjunto efetivamente utilizado deve permanecer próximo ao resultado.

Exemplos de mensagens:

- “Foram encontrados 7 grupos na coluna Grupo B. Essa coluna parece conter medidas; escolha uma coluna por grupo ou indique a coluna de categorias.”
- “Grupo B ficou sem observações numéricas válidas. Revise as linhas indicadas.”
- “Os resultados anteriores foram invalidados porque a tabela foi alterada.”

As mensagens principais incluem a causa disponível no parser; detalhes técnicos ficam numa área recolhível. Erros inesperados não devem derrubar a rota inteira nem expor dados da tabela em logs. Não substituir erros previsíveis por “algo deu errado”.

Categorias numericamente codificadas podem ser categóricas quando o usuário assim as define; não rejeitar automaticamente códigos como 0/1. Em Qui-quadrado, limitar categorias antes de alocar a matriz completa.

## 6. Gráficos adequados ao teste

“Candlelight” será tratado como a intenção de visualizar distribuição e amplitude: adicionar boxplot (caixa e bigodes), não velas financeiras com abertura/fechamento inexistentes nos dados.

| Família | Apresentação a preservar/corrigir | Complemento previsto |
| --- | --- | --- |
| t independente | Pontos individuais e resumo de média/IC corretamente desenhado | Boxplot; barras de média apenas como opção secundária |
| t pareado | Identificação correta dos pares | Pontos ligados e distribuição das diferenças, sem inventar pareamento |
| ANOVA/Tukey | Pontos por grupo, comparações pós-teste e média com intervalo verdadeiro | Boxplot e gráfico de estimativa/intervalo |
| Kruskal/Dunn e Mann–Whitney | Pontos e mediana/IQR, com ranks como complemento | Boxplot; nunca reutilizar IC de média como se fosse IC de mediana |
| Qui-quadrado | Observado/esperado com rótulos legíveis | Proporções por grupo e mapa de resíduos padronizados, com legenda explícita |
| Pearson/Spearman | Dispersão e informação de associação correspondente ao método | Ajuste linear ligado ao caso Pearson; não apresentá-lo como ajuste de Spearman |
| Prais–Winsten | Série observada/ajustada e resíduos | Controles de linha, rótulos, referência zero e escala realmente funcionais; respeitar tempo fornecido |
| Regressões logística/Poisson/binomial negativa | Forest com estimativa e IC95% visíveis, e diagnóstico do ajuste | Linha de referência coerente; OR em escala logarítmica de fato |

Boxplot: mediana e quartis definidos consistentemente, bigodes até observações dentro de 1,5 IQR e outliers identificados. Explicar a convenção. Para amostras pequenas, manter os pontos visíveis. IQR não deve ser rotulado como intervalo de confiança.

Resumo de média: desenhar os limites em torno da estimativa, não uma segunda barra da margem partindo de zero. Usar método de IC declarado e apropriado à amostra, com fixture numérica de referência. Se um intervalo não puder ser estimado, mostrar indisponibilidade em vez de inventar largura zero.

Forest: renderizar linha e extremidades do IC, com posição da estimativa. Referência em 0 para coeficientes e 1 para razões exponenciadas. Valores não finitos ou não positivos numa escala logarítmica recebem tratamento explícito; não são silenciosamente cortados.

Definir capacidades tipadas por preset: dados, anotações, escalas e rótulos. Cada opção exibida no personalizador precisa alterar uma propriedade concreta. Remover opções inaplicáveis ao preset, sem deixar controles decorativos. Preservar escolhas por teste/preset, sem compartilhá-las acidentalmente com outro gráfico.

## 7. Tamanho, leitura, exportação e aparência

Altura padrão confortável de 420 px, controle de altura entre 280 e 900 px, largura fluida e ação **Ampliar gráfico** em diálogo acessível. O modo ampliado usa o espaço disponível da janela e mantém personalizações. Layout de dois gráficos por linha somente quando cada cartão dispõe de largura suficiente; em telas menores, uma coluna.

O contêiner dedicado controla o tamanho real do canvas. Mudanças de altura/largura atualizam a renderização, sem apenas esticar a imagem. Não usar `overflow-hidden` para esconder anotações que não couberam.

Separar títulos, resumo do teste e p-valores das etiquetas posicionadas acima de pontos/barras quando houver risco de colisão. Reservar espaço para os rótulos restantes e adaptar eixos a textos longos. Nenhum resultado essencial deve depender exclusivamente de hover. Tooltips revelam rótulos completos, e os dados/resultados continuam disponíveis em texto ou tabela.

Separar a ação explícita de personalizar do hover/click usado para explorar dados. Hover e foco devem ser visíveis nos elementos interativos, sem sinalizar ação onde ela não existe.

Exportação PNG preserva a resolução, as escolhas e as informações essenciais do gráfico. Uma falha de exportação deve restaurar o estado de exibição e informar o erro, sem deixar tamanho ou pixel ratio alterados.

Centralizar a tipografia da interface e do Chart.js numa pilha de sistema: `-apple-system`, `BlinkMacSystemFont`, `Geist Variable`, `Segoe UI`, sans-serif. Usar a fonte nativa da Apple quando disponível; não distribuir arquivos proprietários de SF Pro. Remover famílias Sora hard-coded e carregamentos externos sem uso.

Unificar a animação de abertura/fechamento dos painéis recolhíveis, com altura/opacidade e duração curta, incluindo estado fechado. Preservar semântica ARIA, teclado e foco. Respeitar `prefers-reduced-motion`, desativando movimento não essencial. Aplicar a grupos, configuração, explicações e personalização sem redesenhar o fluxo de Mapas.

## 8. Catálogo e segurança

### Catálogo

Resolver caminhos de recursos públicos com `import.meta.env.BASE_URL`, tanto em `/` quanto em `/lacirpesquisa/`. Manter o carregamento dos JSON curados na mesma origem; não substituir a falha por busca em servidores externos.

Validar o formato mínimo dos JSON antes de utilizá-los. Rejeitar identificadores de pack com travessia de diretório ou URL externa. Compartilhar carregamentos simultâneos; falha não pode contaminar o cache nem impedir **Tentar novamente**. Mostrar diferença entre erro HTTP, conexão e conteúdo inválido.

### Importações limitadas

Centralizar limites e verificá-los antes de alocações grandes: arquivo de 10 MiB, texto colado de 5 milhões de caracteres, 10.000 linhas de dados, 128 colunas e 200.000 células. Mensagens explicam qual limite foi atingido; não truncar dados para caber.

Para XLSX: até 32 abas, 2.048 entradas ZIP, 16 MiB descompactados por entrada e 64 MiB no total. Verificar tamanhos declarados e bytes realmente produzidos pelo stream; parar ao exceder o limite. Validar offsets, cabeçalhos, referências de células e XML antes da utilização. Rejeitar DTD/entidades, ZIP64 e recursos não suportados com mensagem específica. Processar somente os arquivos internos necessários e não buscar relacionamentos externos. Usar valores em cache de fórmulas quando existentes, sem executar fórmulas; informar células sem valor utilizável.

### Dependências e banco

Atualizar versões/lockfile para corrigir os sete alertas encontrados e repetir `npm audit`, distinguindo dependências de execução e CLI. Manter o CLI de geração de componentes como dependência de desenvolvimento. Não usar atualização forçada que ignore incompatibilidades.

Nas tabelas de agregados do projeto Supabase vinculado, preservar SELECT público e RLS; remover privilégios de escrita desnecessários de `anon`/`authenticated` em nova migração. Não alterar permissões do pipeline ou chaves de serviço, não apagar dados e não reescrever migrações históricas geradas. Rever privilégios padrão de novos objetos com o mesmo princípio de mínimo acesso.

Depois, consultar permissões efetivas, confirmar leitura pública, executar advisors e registrar a evidência. A revisão não deve afirmar ausência absoluta de vulnerabilidades; deve informar escopo, resultados e limitações dos verificadores executados.

## 9. Estratégia de verificação e aceite

Implementar regressões reproduzindo os defeitos antes de corrigi-los. A suíte atual verde não cobre os casos já demonstrados.

Aceite obrigatório:

1. Paste→arquivo, arquivo→paste, exemplo→limpar e leitura concluída após desmontagem: a última ação vence, sem ressuscitar dados.
2. Cabeçalhos/células com delimitadores, aspas e quebras de linha permanecem idênticos nas transferências. Nomes duplicados têm IDs distintos e associação visível.
3. Editar a nona linha ou outra página altera o dado realmente analisado; o resumo inclui todas as linhas válidas.
4. Papéis manuais sobrevivem à edição; vínculos de X/Y/desfecho/grupo sobrevivem à navegação e à restauração opt-in.
5. Limpar e desabilitar persistência removem o registro e cancelam gravações pendentes. Falha de armazenamento e versão inválida não derrubam o app nem simulam sucesso.
6. Mann–Whitney funciona com seus dois formatos e na transferência do exemplo t; detecta casos inválidos antes de executar e informa os grupos encontrados.
7. ANOVA/Kruskal funcionam com nomes reservados; Qui-quadrado limita cardinalidade antes da matriz; importações malformadas/grandes são rejeitadas de forma controlada.
8. Todos os presets de todos os testes executam com seus exemplos. ICs, boxplots e resíduos são conferidos numericamente. Todo controle exibido tem efeito testado.
9. Inspeção no navegador de telas estreitas/largas, alturas mínima/padrão/máxima, ampliação, nomes longos, valores negativos e anotações: sem corte ou sobreposição como na imagem fornecida.
10. Exportação PNG verificada; abrir/fechar painéis, foco/teclado e movimento reduzido funcionam.
11. Catálogo carrega em desenvolvimento e no build com base `/lacirpesquisa/`; falha seguida de repetição recupera corretamente.
12. `npm run gate`, auditoria de dependências e checagens de banco têm resultados registrados. Se houver testes ignorados ou limitações, descrevê-los sem tratá-los como validação executada.
13. A pasta principal contém a versão final, `npm run dev` mostra as mudanças e o GitHub Pages publicado é verificado após deploy. Não encerrar com alterações somente em um worktree isolado.

O diagnóstico será atualizado com a correção e evidência correspondente a cada achado, sem apagar o histórico de reprodução.

## 10. Fora do escopo

Não criar autenticação, sincronização de dados pessoais na nuvem, execução de código do usuário ou uma nova plataforma de BI. Não adicionar velas OHLC sem dados desse domínio. Não implementar testes estatísticos novos só para contornar uma seleção incompatível. Não alterar fontes de dados epidemiológicos ou inferir causalidade a partir de comparações agregadas.

## Referências

- [Chart.js — gráficos responsivos](https://www.chartjs.org/docs/latest/configuration/responsive.html).
- [SciPy — Mann–Whitney e pressupostos](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mannwhitneyu.html).
- [NIST — boxplot e convenções](https://www.itl.nist.gov/div898/handbook/eda/section3/boxplot.htm).
- [Supabase — grants e RLS](https://supabase.com/docs/guides/api/securing-your-api).
