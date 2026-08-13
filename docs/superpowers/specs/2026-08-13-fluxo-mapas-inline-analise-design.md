# Fluxo progressivo de análise dentro de Mapas

## Objetivo

Manter todo o percurso didático iniciado no mapa na rota `/mapas`. Depois de definir grupos territoriais, doença e período, o ligante desbloqueia as etapas inferiores e continua descendo pela mesma página: objetivo, variáveis, perfil dos dados, testes, resultados e conclusão.

O catálogo independente de `/variaveis` continua disponível para exploração direta, mas deixa de ser o destino do fluxo iniciado em Mapas.

## Fluxo e navegação

1. O ligante monta dois ou mais grupos no mapa.
2. Seleciona doença, base da localização e período.
3. O botão principal valida o recorte e desbloqueia a análise abaixo do mapa, sem `navigate('/variaveis')`.
4. A página faz rolagem suave até a primeira etapa nova, respeitando `prefers-reduced-motion`.
5. Cada escolha revela somente a próxima seção aplicável:
   - objetivo;
   - variáveis;
   - perfil e distribuição;
   - testes permitidos;
   - resultados, mapas e conclusão.
6. Alterações posteriores no recorte invalidam de forma segura seleções e resultados incompatíveis. Nenhum resultado antigo pode permanecer associado a outro desenho.

O desenho de pesquisa continua sendo produzido pelo adaptador atual de Mapas e armazenado pela sessão. A análise guiada será extraída para um componente reutilizável renderizado diretamente por `MapasPage`; a rota `/variaveis` poderá reutilizá-lo somente para compatibilidade com sessões antigas, sem ser necessária no fluxo normal.

## Contexto visível em “Variáveis do recorte”

Antes das checkboxes, a etapa apresenta um resumo compacto e inequívoco:

- doença selecionada;
- período e base de localização;
- cada grupo pelo nome;
- estados ou municípios pertencentes a cada grupo.

Esse resumo é derivado de `ResearchDesign`, nunca duplicado em estado visual. A interface deve deixar explícito que os grupos formados no mapa são o fator de comparação e que cada variável marcada será analisada como um desfecho separado.

## Objetivos e testes

### Descrever

Exibe cobertura, sumários, distribuição e mapa. Para recortes temporais elegíveis, também oferece Prais–Winsten como análise de tendência.

O Prais–Winsten é executado separadamente para cada grupo:

- cada grupo produz uma única série anual agregada, conforme o perfil da variável;
- a série precisa ser regular, ter pelo menos o mínimo já definido pelo motor e apresentar variação;
- zeros observados são preservados; ausências não são imputadas;
- cada grupo recebe sua própria estimativa, intervalo, valor-p, gráfico de tendência e interpretação;
- valores-p de grupos diferentes não são comparados entre si;
- não se conclui que duas tendências diferem apenas porque uma é significativa e a outra não.

### Comparar

Os testes comparam os grupos territoriais do mapa, não variáveis entre si. Cada variável compatível é um desfecho independente:

- exatamente dois grupos: t de Student ou Mann–Whitney, conforme pressupostos;
- três ou mais grupos: ANOVA com Tukey ou Kruskal–Wallis com Dunn;
- resultados múltiplos continuam separados e recebem correção de Holm na família confirmatória;
- uma variável incompatível aparece como não calculável, sem bloquear as demais;
- todos os grupos selecionados precisam estar representados. Não há descarte silencioso de grupo.

Correlação e regressões permanecem direcionais e exigem papéis explícitos. Elas não devem ser apresentadas como comparação automática dos grupos.

### Descrever e comparar

Executa a descrição primeiro e, depois, oferece os testes entre grupos. Prais–Winsten permanece uma tendência descritiva por grupo; os testes de comparação seguem as regras acima.

## Gráficos

O perfil deixa de usar o SVG simplificado de `ProfileDistributionVisual`. Histograma e Q–Q passam a usar o mesmo sistema Chart.js compartilhado pela área “Estatística → Analisar dados”:

- `ChartCanvas`, tema, tipografia, cores e fundo compartilhados;
- eixos com títulos e escala legível;
- tooltips com faixa do intervalo e frequência no histograma;
- linha de referência identificável no Q–Q;
- títulos que incluem a variável e indicam o conjunto analisado;
- texto curto explicando como ler cada gráfico;
- suporte a download no padrão existente, sem introduzir outro motor gráfico.

Os resultados inferenciais continuam usando os gráficos produzidos pelos motores existentes. Prais–Winsten reutiliza os presets de tendência e resíduos da área Estatística. Mapas coropléticos preservam visualmente valor positivo, zero confirmado, sem dados e dado em revisão.

## Dados e desempenho

A mudança não duplica consultas. O componente embutido recebe o mesmo `ResearchDesign` e reutiliza o repositório Supabase paginado, o cache de promessas e o cancelamento por consumidor já implementados.

Para até 40 ligantes simultâneos:

- cada navegador mantém apenas seu estado local de seleção;
- chamadas idênticas no mesmo cliente continuam deduplicadas;
- variáveis e perfis são derivados do snapshot carregado;
- nenhuma seleção de um usuário é persistida globalmente ou compartilhada com outro.

## Estados, acessibilidade e falhas

- Se o recorte ainda não for válido, a análise inferior não é montada.
- Carregamento mostra estado honesto; nenhuma variável ou teste fictício aparece.
- Erros de dados bloqueiam apenas a etapa dependente e mantêm o mapa editável.
- Novas seções recebem foco/rolagem previsível sem sequestrar navegação por teclado.
- Animações respeitam movimento reduzido.
- O resumo dos grupos e as seções progressivas têm landmarks e nomes acessíveis.

## Estratégia de testes

1. Teste de integração prova que confirmar o recorte permanece em `/mapas` e revela a análise abaixo.
2. Testes de reset provam que mudar grupos, doença ou período invalida escolhas incompatíveis.
3. Teste do resumo confirma doença, período, nomes dos grupos e territórios.
4. Testes de objetivo confirmam Prais–Winsten em “Descrever” e “Descrever e comparar”, nunca como inferência de diferença entre grupos.
5. Testes do executor confirmam uma série Prais por grupo e bloqueiam grupos sem série válida.
6. Testes de comparação confirmam que t/Mann/ANOVA/Kruskal usam os grupos do mapa e preservam todos eles.
7. Testes de gráfico confirmam uso de `ChartCanvas`, títulos de eixos, tooltips e linha Q–Q.
8. Suítes focadas, typecheck, catálogo, pipeline, testes integrais e build devem passar.
9. Smoke visual real percorre Mapas até resultados na mesma URL e verifica ausência de erros no console.

## Critérios de aceite

- O fluxo iniciado no mapa não abre `/variaveis`.
- O usuário percorre todas as etapas rolando a página `/mapas`.
- “Variáveis do recorte” identifica doença e composição de cada grupo.
- Comparações são claramente entre os grupos territoriais selecionados.
- Prais–Winsten aparece em Descrever e roda separadamente por grupo.
- Nenhum texto compara significância entre séries Prais independentes.
- Histograma e Q–Q seguem o sistema visual da área Estatística e são didáticos.
- Regras de disponibilidade, zero, ausência, revisão e cobertura comum continuam preservadas.
- O servidor de demonstração completo é atualizado somente depois da verificação automatizada e visual.
