# Resultados estatísticos mais diretos e interativos

Data: 2026-08-30.
Status: desenho aprovado em conversa, registrado para revisão final do usuário antes da implementação.
Base: `5367bad` (`main` publicada).

Esta especificação substitui, para a área Estatística, a experiência opt-in de
persistência descrita na seção 4 do desenho de 2026-08-26. Os contratos de
validação, privacidade local e proteção contra gravações obsoletas continuam
válidos.

## 1. Objetivo

Simplificar a área Estatística e tornar seus resultados mais fáceis de explorar e
reutilizar. A pessoa deve encontrar os testes numa barra lateral sempre visível,
perceber visualmente os indicadores e gráficos interativos, e copiar um relatório
textual completo sem carregar a tabela bruta.

A sessão deve sobreviver a recarregamentos e ao fechamento do navegador usando
somente armazenamento local. A interface não deve exibir controles ou mensagens
de persistência, nem enviar os dados a um servidor.

## 2. Decisão de arquitetura

Implementar os comportamentos em componentes compartilhados, com adaptações
mecânicas nos dez módulos estatísticos. Essa abordagem foi escolhida porque
mantém aparência, acessibilidade, cópia e persistência iguais entre os testes.

Alternativas rejeitadas:

- Repetir o comportamento em cada teste: aumenta duplicação e permite que alguns
  testes fiquem sem cópia, hover ou remoção da pergunta.
- Apenas ocultar elementos com CSS: deixaria controles montados, não definiria a
  persistência automática e não produziria um relatório copiável confiável.
- Copiar ou serializar todo o estado interno: incluiria dados brutos e detalhes
  técnicos que o usuário não pediu.

## 3. Cabeçalho da área Estatística

Remover da renderização:

- o link **Portal DATASUS**;
- o painel **Lembrar neste dispositivo**;
- mensagens como **Salvo neste dispositivo** e avisos sobre acesso por outras
  pessoas no mesmo navegador.

O título do teste passa a ocupar sozinho o cabeçalho. Componentes que ficarem sem
consumidores devem ser removidos, junto com contratos e testes específicos da
interface antiga. A infraestrutura de armazenamento permanece, adaptada ao modo
automático descrito abaixo.

## 4. Persistência automática no navegador

Usar o IndexedDB já existente como cache automático e local. Não adicionar
sincronização em nuvem, cookies, backend ou telemetria.

Fluxo:

1. Ao montar o provedor, ler e validar o snapshot antes de permitir gravações.
2. Se houver snapshot válido, restaurar tabela, tipos, vínculos por teste e
   preferências visuais.
3. Se não houver snapshot, iniciar uma sessão vazia com persistência automática
   habilitada.
4. Depois da restauração, cada alteração válida agenda uma gravação serializada;
   a geração mais recente vence e operações antigas não podem ressuscitar dados.
5. **Limpar dados** ou limpar a sessão remove o registro persistido e mantém a
   sessão corrente vazia. Alterações posteriores podem voltar a ser salvas.
6. Snapshot incompatível ou corrompido é descartado com segurança. Falha,
   indisponibilidade ou falta de espaço no IndexedDB degrada para memória sem
   bloquear a análise e sem afirmar visualmente que houve gravação.

Não haverá botão para ativar ou desativar esse cache. O estado continua restrito
ao dispositivo e à origem do site.

## 5. Barra lateral fixa

A barra de testes deve permanecer visível durante o scroll da página:

- posição `sticky` abaixo do cabeçalho global;
- altura máxima equivalente à janela disponível;
- o contêiner lateral não acompanha a altura total dos resultados;
- quando a lista não couber, somente a lista de testes recebe scroll vertical
  interno;
- o controle de expandir/recolher e **Qual teste usar?** permanecem visíveis;
- em tela estreita, a barra continua recolhida por padrão e ocupa sua largura
  compacta, sem provocar scroll horizontal da página.

Teclado, foco visível, rótulos acessíveis e `prefers-reduced-motion` permanecem
obrigatórios.

## 6. Indicadores sensíveis a hover e foco

Todos os cartões de métricas, incluindo média, tamanho amostral, diferença,
intervalo, evidência estatística e tamanho de efeito, recebem o mesmo tratamento
compartilhado:

- pequeno aumento de escala;
- elevação discreta por sombra e realce de borda;
- transição curta, sem deslocar o layout ao redor;
- estado equivalente em `focus-visible`, com o cartão alcançável pelo teclado;
- nenhuma informação pode depender do hover;
- movimento e escala são desativados quando `prefers-reduced-motion: reduce`.

O conteúdo textual e os valores estatísticos não mudam. O cartão de intervalo de
confiança continua separado quando o motor o fornece, mesmo que a diferença entre
médias já traga o intervalo em seu detalhe.

## 7. Gráficos sensíveis a hover e foco

Cada cartão de gráfico cresce levemente no hover e no foco dentro da grade. O
efeito atua no cartão, não recalcula nem estica o canvas, e deve preservar:

- tooltips e hover de pontos do Chart.js;
- botões de editar, ampliar e baixar;
- dimensões e resolução da exportação PNG;
- modo ampliado e preferências de altura;
- ausência de recorte nas bordas;
- desativação de movimento reduzido.

O crescimento deve caber no espaçamento da grade e não criar scroll horizontal.
Quando o painel de edição estiver aberto, seus controles continuam estáveis e
clicáveis.

## 8. Remoção da pergunta de pesquisa

Remover de todos os testes:

- estado e propriedades de `researchQuestion`;
- campo e rótulo **Pergunta de pesquisa**;
- limites e validações exclusivos desse campo;
- frase **Pergunta analisada: …** da interpretação;
- argumentos sem uso nos construtores de interpretação.

As interpretações começam diretamente pela conclusão e pelos resultados. As
perguntas didáticas dos painéis **Entenda este teste** não fazem parte dessa
remoção.

## 9. Copiar relatório completo

Adicionar no fim do painel compartilhado de resultados um botão simples
**Copiar tudo**. O texto copiado deve ser legível fora do aplicativo e seguir esta
ordem:

1. nome do teste/resultado;
2. indicadores, cada um com rótulo, valor e detalhe disponível;
3. grupos e resumos descritivos presentes nesses indicadores;
4. seção **Interpretação**, com todos os parágrafos exibidos.

Não copiar:

- linhas da tabela bruta importada;
- estrutura interna do motor;
- configurações visuais, JSON ou imagens dos gráficos;
- controles e mensagens transitórias da interface.

O formatador recebe somente `title`, `metrics` e `interpretation`, produz texto
determinístico com separadores e quebras de linha, e pode ser testado sem DOM. O
botão usa a Clipboard API quando disponível e um fallback local compatível. Após
sucesso, mostra **Copiado** temporariamente e anuncia o estado por região viva.
Se ambas as estratégias falharem, exibe uma mensagem curta, mantém os resultados
e permite nova tentativa.

## 10. Componentes e contratos afetados

- `EstatisticaPage`: cabeçalho simplificado; deixa de montar link e controle de
  persistência.
- `SessionProvider` e armazenamento: persistência automática, restauração antes
  de gravação e limpeza segura.
- `Sidebar`: geometria sticky e scroll interno.
- `ResultsPanelWithCustomizer` e `ResultsPanel`: cartão compartilhado de métrica,
  hover/foco e ação de copiar.
- Cartões de gráfico e tema/CSS: transformação visual sem alterar canvas.
- Painéis de configuração, módulos de teste e construtores de interpretação:
  remoção da pergunta e da frase gerada.
- Testes existentes de persistência: passam a provar cache automático, não uma
  caixa de seleção.

Se os dois painéis de resultados não puderem consumir o mesmo cartão e formatador
sem duplicar regras, extrair primitivas pequenas compartilhadas; não fundir os
painéis inteiros apenas por esta mudança.

## 11. Erros, privacidade e acessibilidade

- Dados permanecem exclusivamente no navegador do usuário.
- O relatório copiado contém os resultados visíveis; a ação é explícita.
- Falhas de cache ou clipboard não apagam a sessão em memória.
- O botão de copiar é acionável por teclado e informa sucesso/erro sem depender
  de cor.
- Hover possui equivalente de foco; textos mantêm contraste e seleção.
- Transformações respeitam movimento reduzido e não alteram a ordem de foco.

## 12. Verificação e aceite

Implementar por TDD, reproduzindo cada comportamento ausente antes da correção.

Aceite obrigatório:

1. Portal DATASUS, painel de persistência, seus textos e a pergunta de pesquisa
   não aparecem em nenhum teste.
2. Nenhuma interpretação contém **Pergunta analisada**.
3. Uma sessão nova é salva automaticamente; recarregar/restaurar recupera tabela,
   vínculos e preferências sem ação do usuário.
4. Limpar remove o snapshot; uma gravação anterior pendente não o recria.
5. Falha e snapshot inválido mantêm a análise utilizável em memória.
6. Sidebar permanece visível em página longa e sua lista rola internamente em
   390×844 e 1440×1000, sem overflow horizontal.
7. Todos os cartões de métricas têm hover e foco consistentes; movimento reduzido
   remove a transformação.
8. Todos os cartões de gráficos crescem discretamente sem cortar conteúdo,
   afetar o canvas, a edição, a ampliação ou o PNG.
9. **Copiar tudo** inclui título, métricas, detalhes/grupos e interpretação na
   ordem definida, sem linhas da tabela bruta.
10. Sucesso e falha de clipboard têm feedback acessível e permitem repetição.
11. Exemplos dos dez testes continuam executando e mostrando seus gráficos e
    interpretações adequados.
12. `npm run gate`, build com `--base /lacirpesquisa/`, auditoria e inspeção real
    no navegador passam antes da publicação.
13. `npm run dev` na pasta principal mostra a versão final; a mesma revisão é
    publicada e verificada no GitHub Pages.

## 13. Fora do escopo

- Não copiar a tabela bruta, gerar PDF/Word ou copiar imagens dos gráficos.
- Não criar contas, sincronização entre dispositivos ou armazenamento remoto.
- Não alterar cálculos, pressupostos ou escolha dos testes estatísticos.
- Não redesenhar Mapas, Meta-análise ou Variáveis.
- Não adicionar novos testes estatísticos nesta entrega.
