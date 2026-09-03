# Prontidão do site, GitHub Pages e entrega offline

Data: 2026-09-03.
Status: desenho aprovado em conversa e registrado para revisão do usuário antes
do plano de implementação.
Fonte de verdade: árvore de trabalho local da branch
codex/results-interactions, incluindo todas as alterações ainda não commitadas
que já pertencem ao usuário.

Restrição desta etapa: este documento não autoriza implementar correções, rodar
validações que gerem artefatos, instalar dependências, publicar o site nem gerar
o HTML offline. A próxima etapa só pode começar depois da revisão explícita
desta especificação.

## 1. Objetivo

Preparar o Bioestatística LACIR para uso confiável numa capacitação com mais de
30 participantes simultâneos, entregando duas representações do mesmo produto:

1. o site estático publicado pelo GitHub Pages;
2. um único arquivo HTML autônomo, capaz de abrir por arquivo local e executar
   sem internet.

A entrega deve preservar a área Estatística, corrigir os problemas confirmados
na auditoria e elevar a cobertura de qualidade em cálculos, importação,
persistência, acessibilidade, responsividade, desempenho e tratamento de erros.

Meta-análise, Variáveis e Mapas não fazem parte da implementação funcional.
Essas três áreas permanecem navegáveis apenas como páginas estáticas cujo único
conteúdo de estado é o texto **Em breve**.

Confiabilidade tem prioridade sobre efeitos visuais, novidade técnica ou
otimizações prematuras.

## 2. Escopo funcional

### 2.1 Módulo ativo

A área Estatística permanece ativa com os dez fluxos registrados no produto:

- teste t de Student;
- ANOVA com Tukey;
- Mann-Whitney;
- Kruskal-Wallis com Dunn;
- correlação;
- qui-quadrado;
- regressão de Poisson;
- regressão binomial negativa;
- regressão logística;
- Prais-Winsten.

Para todos eles, o escopo inclui entrada de dados, definição de papéis das
colunas, configuração, execução, indicadores, interpretação, gráficos, cópia e
exportação já previstas pelo produto.

### 2.2 Módulos indisponíveis

As rotas Meta-análise, Variáveis e Mapas:

- renderizam, no corpo da rota, somente o texto literal **Em breve**;
- preservam apenas o cabeçalho e a navegação globais indispensáveis para
  orientação e retorno à área Estatística; o nome da rota pode permanecer na
  navegação e no título do documento, mas não vira conteúdo adicional da página;
- não montam telas, clientes, consultas, catálogos, animações ou efeitos
  específicos dos módulos;
- não carregam código ou dados funcionais dessas áreas no release;
- não fazem requisições de rede;
- não prometem data de lançamento.

Não se deve apagar a implementação histórica desses módulos como efeito
colateral desta entrega. O trabalho consiste em separá-la do release ativo,
mantendo o código existente intacto sempre que possível.

### 2.3 Fora do escopo

- implementar ou redesenhar Meta-análise, Variáveis ou Mapas;
- criar contas, colaboração em tempo real, telemetria ou armazenamento remoto;
- enviar tabelas, resultados ou identificadores a um servidor;
- acrescentar novos testes estatísticos;
- transformar o site em PWA como substituto do HTML único;
- publicar antes de todas as verificações e de uma autorização específica para
  publicação.

## 3. Princípios e invariantes

1. O mesmo código de domínio e a mesma interface sustentam os builds online e
   offline.
2. Cálculos e dados da área Estatística permanecem locais ao navegador.
3. O valor exibido de uma configuração estatística deve ser exatamente o valor
   usado pelo motor.
4. Falhas de persistência, importação, cálculo, clipboard ou exportação nunca
   podem apagar silenciosamente a sessão corrente.
5. Nenhuma informação ou ação essencial pode depender apenas de hover,
   animação, cor ou conexão com a internet.
6. O workflow não publica um commit que não tenha passado pelo gate obrigatório.
7. O arquivo offline não depende de servidor local, CDN, fonte remota, API,
   service worker ou arquivos vizinhos.
8. Alterações locais preexistentes são propriedade do usuário e não podem ser
   descartadas, reformatadas em massa ou incorporadas acidentalmente aos commits
   desta iniciativa.

## 4. Arquitetura proposta

Adotar duas saídas determinísticas derivadas do mesmo código.

### 4.1 Manifesto de escopo e rotas

Um manifesto de release identifica explicitamente:

- a área Estatística como ativa;
- Meta-análise, Variáveis e Mapas como indisponíveis;
- o componente mínimo de placeholder;
- os recursos permitidos em cada saída.

O manifesto evita depender apenas de links desabilitados ou CSS para esconder
funcionalidade. Código e dados dos módulos indisponíveis não entram no grafo do
bundle público.

### 4.2 Núcleo estatístico compartilhado

O núcleo reúne contratos que não dependem do modo de distribuição:

- documento tabular e tipos de coluna;
- limites e validação de importação;
- vínculos de papéis;
- configuração de cada teste;
- motores numéricos;
- formatação de indicadores e interpretações;
- modelos de gráficos;
- cópia e exportação locais.

Não haverá bifurcação de fórmulas, tolerâncias ou interpretações entre Pages e
offline. Com os mesmos dados e configurações, os valores exibidos devem ser
idênticos e os valores numéricos internos devem coincidir dentro das tolerâncias
explícitas da validação estatística.

### 4.3 Adaptadores de sessão

O provedor de sessão tenta usar IndexedDB para restaurar e gravar:

- tabela e metadados;
- tipos e papéis das colunas;
- configurações por teste, incluindo nível de significância;
- preferências visuais necessárias.

Se IndexedDB estiver indisponível, corrompido, sem quota ou inadequado à origem
file, a análise continua em memória. A interface informa de forma persistente e
acessível que os dados durarão apenas naquela sessão. O fallback não pode afirmar
que houve gravação.

As gravações são serializadas; a geração mais recente vence. Limpar dados
invalida gravações pendentes para impedir que um snapshot antigo ressuscite.

### 4.4 Adaptadores de navegação

- GitHub Pages usa o roteamento web e o base path `/lacirpesquisa/`.
- O HTML offline usa navegação por hash, compatível com `file:`.

As rotas, títulos, estado ativo e conteúdo são compartilhados. Apenas o
mecanismo que lê e escreve a localização muda.

Para o Pages, o build gera entradas estáticas para as quatro rotas públicas, de
modo que abrir ou recarregar uma URL conhecida não dependa apenas de um
index.html servido como página 404. A página 404 genérica continua como fallback
para caminhos desconhecidos e deve encaminhar para uma tela válida do
aplicativo.

### 4.5 Adaptadores de build

O build do Pages mantém HTML, CSS e JavaScript como assets estáticos
cacheáveis, todos sob o base path correto.

O build offline:

- incorpora JavaScript, CSS, ícones e recursos necessários no próprio HTML;
- produz um bundle autocontido, sem imports de runtime ou chunks carregados pelo
  protocolo `file:`;
- não inclui source maps nem arquivos auxiliares;
- elimina imports, URLs de CSS e referências a assets externos;
- incorpora metadados de versão, data e commit;
- produz o arquivo bioestatistica-lacir-offline.html;
- gera um SHA-256 no pipeline de release para conferência do arquivo.

Um verificador estrutural inspeciona o HTML final, seus atributos, CSS e
JavaScript empacotado. Ele falha quando encontra dependência de arquivo vizinho
ou capacidade de conexão não aprovada. O teste decisivo abre o artefato por
file, bloqueia toda rede no navegador e percorre o fluxo crítico.

O HTML usa uma política de segurança por meta tag que bloqueia conexões, frames
e objetos, autorizando apenas o mínimo necessário para script e estilo embutidos,
imagens `data:`/`blob:` e downloads locais. A política final é validada nos três
motores de navegador, sem enfraquecê-la para mascarar erros de build.

## 5. Componentes e responsabilidades

### 5.1 Estrutura global

- AppShell mantém navegação, foco inicial, landmark principal e comportamento
  responsivo.
- O manifesto de rotas determina rótulo, disponibilidade e componente.
- ComingSoonPage torna-se um placeholder compartilhado, estático e cujo único
  conteúdo no `main` é **Em breve**, sem título de módulo, parâmetros de data,
  partículas ou sticker.

### 5.2 Área Estatística

- EstatisticaPage coordena sessão, teste selecionado e regiões principais.
- Sidebar lista os dez testes, preserva seleção e fornece comportamento compacto
  em telas estreitas.
- TabularInputPanel coordena arquivo, colagem, preview e mensagens de validação.
- Componentes de papéis e configuração transformam escolhas da interface em um
  contrato tipado para o motor.
- Cada motor recebe entradas validadas e devolve resultado tipado ou erro de
  domínio.
- ResultsPanel e o customizador apresentam indicadores, interpretação,
  gráficos, cópia e exportação sem recalcular dados por efeitos visuais.
- AlphaSelector usa uma representação canônica de alpha decimal no estado e
  converte para percentual apenas na apresentação.

### 5.3 Limites de responsabilidade

Componentes visuais não corrigem ou reinterpretam valores vindos do motor.
Motores não leem DOM, storage, rota ou ambiente de build. O provedor de sessão
não executa cálculos. Adaptadores de Pages e offline não duplicam regras de
negócio.

## 6. Fluxos de dados

### 6.1 Entrada e análise

1. A pessoa escolhe arquivo ou cola dados.
2. O importador valida formato, tamanho, estrutura comprimida e limites.
3. A entrada válida produz um documento tabular normalizado.
4. A interface infere tipos apenas como sugestão; a pessoa pode revisá-los.
5. Papéis de colunas e opções do teste formam uma configuração tipada.
6. A validação de domínio impede execução incompleta ou incompatível.
7. O motor calcula de forma síncrona e determinística sobre dados locais.
8. O resultado tipado alimenta métricas, interpretação e gráficos.
9. Cópia e exportação usam apenas o resultado apresentado e exigem ação
   explícita.
10. A sessão agenda a persistência do documento, dos vínculos e das
    configurações.

### 6.2 Restauração

1. O provedor lê e valida o snapshot antes de permitir nova gravação.
2. Snapshot compatível restaura toda a sessão, inclusive testSlots.
3. Snapshot incompatível ou corrompido é descartado com aviso recuperável.
4. Falha do storage seleciona modo em memória e mantém a área utilizável.
5. Nenhum snapshot antigo pode sobrescrever mudança feita depois da hidratação.

### 6.3 Distribuição

O mesmo commit aprovado produz os dois artefatos. O job de validação antecede os
jobs de build. O Pages publica somente a pasta online aprovada. O HTML offline é
preservado como artefato de workflow e pode ser oferecido para download no site,
sem deixar de funcionar quando copiado isoladamente para outro dispositivo.

## 7. Correções obrigatórias confirmadas

### 7.1 Nível de significância

Defeito confirmado no baseline: o estado decimal `0.1`, que o motor usa como
10%, é normalizado pelo seletor como `0,1%`. Assim, a apresentação contradiz o
cálculo embora o motor receba o valor correto.

O estado usa alpha decimal num intervalo fechado validado. A interface apresenta
alpha em percentual e faz conversão explícita nos dois sentidos.

Casos de fronteira obrigatórios:

- 0,001 corresponde a 0,1%;
- 0,01 corresponde a 1%;
- 0,05 corresponde a 5%;
- 0,10 corresponde a 10%.

Selecionar, persistir, restaurar e executar qualquer valor deve conservar a
mesma quantidade. O destaque visual não altera a configuração.

### 7.2 Persistência de configurações

Mudanças isoladas em testSlots disparam persistência mesmo quando tabela e
preferências visuais não mudam. A detecção de alterações não salvas cobre os
mesmos campos que o snapshot. Testes devem provar alteração, recarga, limpeza,
falha e concorrência entre gravações.

### 7.3 Deploy protegido

O workflow de Pages deve ter uma dependência explícita e interna do job que
instala de forma reproduzível e executa o gate. O job de deploy não pode iniciar
se teste, typecheck, catálogo, auditoria obrigatória ou build falhar.

### 7.4 Custo visual em repouso

Efeitos baseados em WebGL, canvas ou requestAnimationFrame não permanecem em
loop quando nada muda. Efeitos supérfluos são substituídos por CSS ou atualização
orientada a evento. Movimento reduzido desabilita transformações não
essenciais.

## 8. Tratamento de erros

### 8.1 Importação

Mensagens identificam o arquivo, o limite ou a estrutura recusada e indicam uma
ação segura. Arquivos grandes, ZIP64, conteúdo criptografado, relações externas,
DTD, entidades, path traversal e expansão excessiva continuam bloqueados.

Falha de XLSX por ausência de DecompressionStream não vira erro genérico: a
interface informa a compatibilidade necessária e recomenda CSV/TXT como
alternativa.

### 8.2 Configuração e cálculo

Erros de dados ou pressupostos aparecem junto ao controle que precisa ser
corrigido. Exceções inesperadas de um motor ficam contidas na área de resultados;
tabela, papéis e opções permanecem disponíveis para correção ou nova tentativa.
Nenhuma falha produz página branca.

### 8.3 Persistência

Falha de leitura ou escrita preserva o estado em memória, anuncia o modo
temporário por texto e região viva e permite exportar/copiar antes de sair. O
aviso não depende apenas de cor e não promete recuperação após fechar a aba.

### 8.4 Clipboard e exportação

A Clipboard API é usada quando disponível. Em contexto local sem permissão, a
interface oferece seleção/colagem manual ou fallback já validado. Falha de cópia
ou PNG mantém os resultados e permite repetição.

### 8.5 Navegação e recursos

Rotas desconhecidas caem numa página segura com caminho de volta à Estatística.
Falha de asset no Pages é detectada pelo smoke test de produção. O build offline
trata qualquer requisição externa como falha de release.

## 9. Segurança, privacidade e dependências externas

- Dados e resultados estatísticos não saem do dispositivo.
- O release ativo não inicializa Supabase, não injeta URL/chave pública e não
  contém endpoints de API.
- Código histórico Supabase permanece protegido por RLS e fora do grafo do
  release; reativá-lo exige outro desenho e auditoria.
- Nenhuma fonte, imagem, script ou folha de estilo remota é necessária.
- dangerouslySetInnerHTML só pode receber markup interno fechado e validado;
  conteúdo de arquivo ou usuário nunca entra nesse caminho.
- Fórmulas de planilha permanecem dados inertes e não são avaliadas.
- Links externos remanescentes usam protocolo seguro, nova aba protegida e
  rótulo explícito.
- Instalação em CI usa lockfile; versões de runtime são fixadas e compatíveis com
  a matriz declarada.
- Antes do release, executar auditoria de dependências e registrar riscos
  aceitos. Vulnerabilidade crítica ou alta alcançável bloqueia publicação.
- O HTML offline aplica connect-src equivalente a nenhum destino e é testado com
  rede negada; a ausência de conexão é um contrato, não apenas uma expectativa.

## 10. Concorrência e capacidade

Não há sessão compartilhada nem backend no escopo. Cada navegador executa
cálculo e storage localmente; por isso, 30 participantes simultâneos não
competem por CPU, memória ou banco no servidor.

A validação de capacidade cobre:

- pelo menos 30 downloads frios concorrentes dos assets publicados;
- zero resposta HTTP 4xx/5xx e percentil 95 entre navegação e primeira rota
  utilizável em até 10 segundos, medido com cache vazio no Wi-Fi da capacitação
  ou numa rede com latência e banda iguais ou piores;
- cache headers e reutilização dos assets após a primeira visita;
- latência e taxa de erro observadas no GitHub Pages;
- tamanho total transferido dentro do orçamento;
- ensaio no Wi-Fi real ou numa rede de características equivalentes;
- disponibilidade prévia do HTML offline em cada máquina como contingência.

Não se cria um teste artificial de 30 sessões de API inexistente. O risco
operacional principal é a conectividade do local e o pico de downloads, mitigado
por cache, orçamento de bundle e distribuição antecipada do arquivo offline.

## 11. Acessibilidade e responsividade

### 11.1 Acessibilidade

- landmarks, títulos e ordem de foco representam a hierarquia visual;
- toda ação é operável por teclado e tem foco visível;
- hover possui equivalente de foco ou toque;
- mensagens de erro, sucesso e modo temporário são anunciadas sem interromper a
  navegação;
- seleção por wheel/listbox expõe opção ativa, nome, estado e instrução adequados
  a leitor de tela;
- controles travados informam aria-disabled ou semântica equivalente;
- nenhuma informação depende exclusivamente de cor;
- contraste atende WCAG 2.2 AA;
- todos os alvos atendem pelo menos 24 por 24 pixels CSS, ressalvadas somente as
  exceções normativas da WCAG 2.2; ações essenciais de toque atendem 44 por 44;
- prefers-reduced-motion elimina loops e transformações não essenciais.

### 11.2 Responsividade

A área deve permanecer utilizável sem scroll horizontal nas referências:

- 360 por 800;
- 390 por 844;
- 768 por 1024;
- 1440 por 900.

Em telas estreitas, sidebar e controles de linha/coluna continuam descobríveis
por toque, sem depender de hover. Tabelas e gráficos podem ter rolagem interna
controlada, mas não expandem a página além do viewport. Teclado virtual,
orientação e zoom de 200% não podem esconder a ação principal ou o erro atual.

## 12. Desempenho

- Nenhum loop de animação fica ativo em repouso sem necessidade funcional.
- Efeitos WebGL/OGL não são carregados quando uma solução estática atende ao
  mesmo papel.
- Módulos e catálogos indisponíveis não entram no bundle nem na pasta de
  distribuição.
- O Pages usa assets com nomes versionados e cacheáveis.
- O build registra tamanhos raw, gzip e do HTML offline e falha quando ultrapassa
  o orçamento aprovado sem justificativa revisada.
- Orçamento inicial do carregamento do Pages: no máximo 1,5 MiB transferidos
  até a primeira rota utilizável, somando HTML, CSS, JavaScript, fontes e imagens
  com cache vazio.
- Orçamento do HTML autônomo: no máximo 2,5 MiB
  (2.621.440 bytes), medidos no arquivo final sem compressão externa.
- O fluxo principal deve permanecer responsivo com os limites máximos aceitos
  pelo importador; operações custosas recebem feedback perceptível e não
  disparam repetidamente por animação ou renderização.
- A inspeção inclui CPU em repouso, memória após 20 alternâncias entre testes e
  custo de interação com desaceleração de CPU 4×. Um trace de 30 segundos em
  repouso não pode registrar tarefa longa, acima de 50 ms, causada por animação.

## 13. GitHub Pages

O release estende o workflow existente `.github/workflows/pages.yml`; não cria
um caminho paralelo de publicação. O `.github/workflows/ci.yml` continua sendo o
gate de push e pull request, mas seu sucesso isolado não autoriza deploy. O
`pages.yml` passa a conter jobs ordenados:

1. checkout do commit exato e runtime fixado;
2. instalação reproduzível pelo lockfile;
3. gate completo;
4. build Pages com base `/lacirpesquisa/`;
5. validação estrutural e smoke test da saída;
6. build e validação do HTML offline a partir do mesmo SHA;
7. upload dos artefatos;
8. deploy, condicionado ao sucesso de todos os passos anteriores.

O job de deploy declara dependência dos jobs de gate e de ambos os builds. O
workflow usa concorrência para impedir dois deploys simultâneos e não publica
artefato parcial. URL raiz, navegação, abertura direta e recarga das quatro rotas
conhecidas são verificadas. Assets devem responder corretamente sob o subpath.
O release não injeta os secrets Supabase hoje presentes no build de Pages.

Após deploy, um smoke test externo confirma versão/SHA, navegação, ausência de
chamadas de API e execução de um exemplo estatístico. Falha pós-deploy é
registrada e exige rollback para o último artefato aprovado; não se corrige
diretamente na infraestrutura.

## 14. HTML único offline

O artefato offline deve:

- ser um único arquivo com extensão html;
- abrir por duplo clique, sem servidor local;
- funcionar com Wi-Fi desligado e requisições de rede bloqueadas;
- usar navegação por hash para a área ativa e os três placeholders;
- carregar todos os estilos, scripts, ícones e recursos internamente;
- importar CSV, TXT, TSV e XLSX nos navegadores suportados;
- executar os dez exemplos e produzir os mesmos valores do Pages;
- copiar ou oferecer fallback manual;
- exportar gráficos/resultados previstos sem recurso externo;
- sobreviver a falha de IndexedDB usando memória e aviso visível;
- incluir versão/SHA legível para suporte;
- não depender de cache ou service worker criado numa visita anterior.

O arquivo é testado após ser copiado isoladamente para outro diretório com nome
contendo espaços e acentos. Também é ensaiado em pelo menos dois
navegadores/máquinas com rede realmente desativada.

## 15. Estratégia de testes e QA

### 15.1 Estático e integração

- diff-check, typecheck, catálogo/proveniência e gate completo existente;
- auditoria de segredos e dependências;
- teste de que módulos indisponíveis não entram no bundle;
- teste de que o release ativo não contém endpoints ou cliente Supabase;
- orçamento de bundle e inventário de recursos.

### 15.2 Regressões obrigatórias

- conversões de alpha 0,001, 0,01, 0,05 e 0,10;
- seleção, cálculo, persistência e restauração de 10%;
- mudança isolada de testSlots;
- limpeza com gravação antiga pendente;
- storage ausente, sem quota e snapshot inválido;
- placeholders com texto literal e sem montagem de efeitos/módulos;
- nenhuma animação contínua em repouso quando desnecessária.

### 15.3 Validação estatística

Cada um dos dez testes executa datasets conhecidos, exemplos do produto e
fixtures golden. Resultados principais, intervalos, p-valores e tamanhos de
efeito usam tolerâncias explícitas. Cada teste tem ao menos uma fixture cujos
valores esperados foram calculados fora do motor do produto, por software
estatístico de referência ou derivação manual revisada, e ficam versionados para
que a validação não dependa de rede. Pages e offline devem produzir resultados
equivalentes.

### 15.4 Navegadores reais

Automação em Chromium, Firefox e WebKit cobre:

- rotas e recarga;
- digitação, colagem e arquivos;
- configuração, cálculo e troca de teste;
- gráficos, cópia e exportação;
- persistência e modo em memória;
- teclado, foco, touch e movimento reduzido;
- quatro viewports de referência;
- console sem erro inesperado.

O suporte funcional cobre as duas versões estáveis mais recentes de Chrome,
Edge, Firefox e Safari no momento do release. Para XLSX, o piso técnico é Chrome
ou Edge 103, Firefox 113 e Safari 16.4 devido a DecompressionStream; navegador
fora desse piso deve continuar aceitando CSV/TXT e mostrar orientação acionável.

### 15.5 Acessibilidade e inspeção humana

- axe sem violações críticas ou sérias;
- navegação completa só por teclado;
- smoke com leitor de tela do seletor de alpha, importação, erros e resultados;
- contraste, zoom de 200%, touch targets e ausência de informação exclusiva por
  hover/cor;
- inspeção responsiva e visual em cada viewport.

### 15.6 Offline e produção

O teste offline intercepta e falha qualquer request, abre o arquivo por file e
percorre importação, dez exemplos, cópia, exportação, navegação e fallback de
storage.

O teste de produção usa a URL publicada, confirma o SHA esperado, assets sob o
base path, rotas diretas, cache, ausência de rede de aplicação e um cálculo
completo.

### 15.7 Classificação de defeitos

- P0: vazamento de dados, resultado estatístico incorreto sem erro detectável,
  perda de sessão corrente, aplicação indisponível, bypass do gate de deploy ou
  dependência de rede no HTML offline.
- P1: qualquer um dos dez fluxos não conclui com entrada suportada, resultado ou
  rótulo diverge entre saídas, placeholder viola o escopo, persistência afirma
  sucesso sem gravar, navegação por teclado bloqueia uma ação essencial ou um
  viewport de referência impede o uso.
- P2 e inferiores: defeitos que não comprometem cálculo, dados, publicação nem
  conclusão dos fluxos. Sua aceitação exige registro explícito no relatório de QA.

## 16. Preservação da árvore local do usuário

Antes de cada fase futura:

1. registrar branch, HEAD, status e lista de arquivos modificados/não rastreados;
2. tratar esse estado como baseline, não como lixo a limpar;
3. nunca usar reset destrutivo, checkout restaurador, clean, stash automático ou
   formatação ampla;
4. editar apenas os caminhos definidos para a fase;
5. parar e revisar quando um caminho-alvo já contiver alterações do usuário;
6. inspecionar o diff de cada arquivo antes de testar e antes de adicionar;
7. adicionar ao índice somente caminhos explícitos;
8. confirmar o diff staged e diff-check antes de cada commit;
9. manter commits pequenos, temáticos e sem capturar mudanças adjacentes;
10. deixar todo arquivo não relacionado exatamente como encontrado.

Se não for possível separar com segurança uma correção de uma alteração
preexistente, a fase para e pede decisão ao usuário. Não se cria outra fonte de
verdade sem autorização.

## 17. Sequência única para o plano futuro

Todo o escopo cabe num único plano faseado:

1. baseline e testes de regressão dos bloqueadores confirmados;
2. correções de alpha, persistência e integridade básica;
3. fechamento dos módulos indisponíveis e remoção de custo/rede do release;
4. revisão funcional, estatística, importação, erros, acessibilidade,
   responsividade e desempenho;
5. adaptadores e validação do build offline;
6. workflow protegido do GitHub Pages e documentação operacional;
7. gate final, QA em navegador, ensaio de capacidade e contingência;
8. publicação somente após autorização, seguida de smoke de produção.

As fases são sequenciais porque as saídas de release só são confiáveis depois
que o núcleo compartilhado estiver validado. O plano pode dividir cada fase em
commits pequenos, mas não precisa de um segundo projeto ou de uma implementação
paralela.

## 18. Critérios objetivos de aceite

1. Nenhum defeito P0 ou P1 permanece aberto.
2. Gate, typecheck, diff-check, catálogo, auditoria de dependências e auditoria
   de segredos passam na árvore final.
3. Alpha 0,10 é exibido como 10%, persiste como 0,10 e é calculado como 0,10;
   todos os casos de fronteira passam.
4. Alteração isolada de testSlots persiste; falha de storage é visível e não
   apaga a sessão corrente.
5. Os dez testes passam por validação numérica e fluxo real nos três motores de
   navegador.
6. Meta-análise, Variáveis e Mapas exibem exatamente **Em breve**, não executam
   lógica própria e não acrescentam código ou dados funcionais ao bundle além
   do manifesto e do placeholder compartilhado.
7. Não há requisição Supabase/API nem dependência remota no release ativo.
8. Não há loop visual não essencial consumindo CPU/GPU em repouso.
9. Os quatro viewports funcionam sem overflow horizontal da página; teclado,
   touch, zoom e movimento reduzido são utilizáveis.
10. Axe não encontra violações críticas ou sérias, e os smokes de teclado/leitor
    de tela passam.
11. O workflow não alcança o job de deploy quando qualquer gate anterior falha.
12. As quatro rotas conhecidas — raiz, Meta-análise, Variáveis e Mapas — abrem e
    recarregam corretamente sob /lacirpesquisa/.
13. Com cache vazio, 30 clientes concorrentes recebem zero resposta 4xx/5xx e
    atingem percentil 95 de primeira rota utilizável em até 10 segundos na rede
    definida na seção 10; o carregamento do Pages transfere no máximo 1,5 MiB. O
    HTML é distribuído antecipadamente quando esse limite não puder ser garantido.
14. O HTML offline tem no máximo 2.621.440 bytes, abre isoladamente por `file:`,
    não faz requests, navega, importa dados e executa os dez testes sem internet.
15. Pages e HTML offline registram o mesmo SHA; valores exibidos coincidem e
    valores internos ficam dentro das mesmas tolerâncias golden.
16. O runbook documenta navegador mínimo, formato CSV de contingência,
    persistência local, distribuição do HTML, checksum, publicação, smoke e
    rollback.
17. O diff final contém somente mudanças deliberadas; nenhuma alteração local
    preexistente do usuário foi descartada ou capturada acidentalmente.

## 19. Gate de continuidade

Esta especificação encerra o brainstorming arquitetural. O próximo passo, ainda
não autorizado por este documento, é escrever um plano de implementação
faseado. Não iniciar esse plano nem qualquer correção até que o usuário revise e
aprove explicitamente esta especificação.
