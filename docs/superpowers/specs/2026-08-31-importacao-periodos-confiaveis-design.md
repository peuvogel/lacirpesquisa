# Importação fluida e períodos temporais confiáveis

Data: 2026-08-31.
Status: desenho aprovado em conversa, registrado para revisão final do usuário antes da implementação.
Base: `96825c0` (`codex/results-interactions`).

Restrição de entrega: toda a implementação permanece somente na branch local e
deve aparecer por `npm run dev`. Não criar pull request, não fazer push e não
publicar esta revisão no GitHub Pages.

## 1. Objetivo

Fazer com que colar uma tabela ou carregar um arquivo seja uma etapa previsível,
explicável e corrigível nos dez testes estatísticos. O caso obrigatório é a série
semestral `2021.1`, `2021.2`, ..., `2026.2`: ela deve ser reconhecida como
semestral, conservar os rótulos originais, passar pela verificação de regularidade
e executar o Prais–Winsten sem o falso erro de intervalos irregulares.

Correções automáticas seguras devem ser informadas de modo discreto. Ambiguidades
que alterem a interpretação estatística devem ficar visíveis e oferecer ajuste
manual. Dados realmente incompatíveis continuam bloqueados com causa, localização
e orientação; o sistema não deve fabricar períodos, imputar observações ou forçar
uma comparação inválida.

## 2. Diagnóstico confirmado

O erro semestral nasce em `parseTemporalValue`: a função tenta converter o texto
em número antes de reconhecer uma periodicidade. Assim, `2021.1`, `2021.2` e
`2022.1` viram os decimais 2021,1; 2021,2; 2022,1. Os intervalos calculados são
0,1; 0,9; 0,1, e o validador conclui que a série é irregular.

Há problemas relacionados no fluxo compartilhado:

- `Semestre`, `trimestre` e `mês` não pertencem aos aliases temporais do
  Prais–Winsten;
- a coluna `tempo` é validada como numérica, portanto rótulos semânticos como
  `2021-S1` podem ser recusados mesmo sendo períodos válidos;
- o parser já produz informações de aba, formato, separador, vírgula decimal,
  reconhecimento por posição e cabeçalhos duplicados, mas o hook compartilhado
  descarta quase todos esses diagnósticos;
- uma linha mais larga que o cabeçalho pode manter células que não aparecem no
  editor, porque a interface desenha apenas a largura do cabeçalho;
- o leitor XLSX preserva números e fórmulas em cache, porém não interpreta estilos
  de data; uma data formatada pelo Excel pode aparecer como número serial;
- os testes não usam uma matriz única de contratos para as mesmas entradas
  problemáticas, o que permite comportamento diferente entre módulos.

Os testes focados atuais estão verdes; eles não contêm a reprodução semestral nem
todos os contratos cruzados acima. A correção será orientada por novas regressões,
não pela suposição de que a suíte existente já cobre esses casos.

## 3. Decisão de arquitetura

Reforçar o fluxo compartilhado existente e adicionar um reconhecedor temporal
isolado. Os motores estatísticos permanecem responsáveis por pressupostos e
cálculos; importação, diagnóstico estrutural e interpretação de períodos não serão
duplicados em cada teste.

Unidades propostas:

1. **Reconhecedor temporal:** converte um token ou uma coluna em período semântico,
   frequência, índice regular, coordenada de análise e confiança da detecção.
2. **Diagnóstico da importação:** conserva metadados e problemas estruturais desde
   o parser até a interface.
3. **Tabela normalizada:** garante que toda célula importada esteja visível e
   editável, com largura consistente e cabeçalhos estáveis.
4. **Pré-validação por teste:** usa os papéis confirmados e informa bloqueios ou
   alertas antes de chamar o motor.

Alternativas rejeitadas:

- Corrigir somente a expressão `YYYY.1`: resolve a tabela fornecida, mas mantém a
  validação numérica, os diagnósticos perdidos e os demais formatos temporais.
- Substituir todo o importador por uma dependência genérica de planilhas: amplia a
  superfície de regressão e não resolve, por si, a semântica estatística dos
  períodos ou as mensagens dos testes.
- Aceitar qualquer sequência irregular por ordem de linha: esconderia lacunas e
  trataria observações desigualmente espaçadas como uma série AR(1) regular.

## 4. Modelo temporal

### Tipos e saída

O reconhecedor terá uma saída explícita, sem depender do valor numérico bruto:

- rótulo original e rótulo canônico;
- frequência: anual, semestral, trimestral, mensal, diária, numérica ou ordem;
- índice inteiro de período para ordenar, detectar duplicidades e encontrar
  lacunas;
- coordenada do modelo, medida em anos para frequências de calendário;
- formato reconhecido e nível de confiança;
- motivo de invalidez ou ambiguidade, quando houver.

Uma detecção de coluna avalia o conjunto completo. Isso é necessário porque
`2021.1` isoladamente pode ser um decimal; uma coluna intitulada `Semestre`, com
sufixos 1 e 2 e transição de `2021.2` para `2022.1`, forma evidência suficiente
para a leitura semestral.

### Formatos aceitos

O escopo mínimo é:

- ano: `2024`;
- semestre: `2024.1`, `2024.2`, `2024-S1`, `2024-S2`, `S1 2024`;
- trimestre: `2024-T1`, `2024-Q1`, `T1 2024`, com níveis 1 a 4;
- mês: `2024-03`, `03/2024`;
- data: ISO `2024-03-31` e brasileira `31/03/2024`;
- sequência numérica regular e ordem simples, quando escolhidas explicitamente.

Não interpretar `YYYY/1` automaticamente como semestre, pois conflita com
`YYYY/M`; essa forma exige cabeçalho forte ou seleção manual. Formatos
equivalentes da mesma frequência podem ser normalizados com aviso. Misturar
frequências diferentes é bloqueio até a correção.

Datas completas são avaliadas como coluna, não apenas célula a célula. O modo
Automático só as classifica como mensais quando cada par adjacente avança um mês
de calendário e conserva o dia ou representa o último dia de cada mês; a mesma
regra vale para saltos trimestrais, semestrais e anuais. Fora desses padrões, a
frequência é diária e a regularidade usa dias corridos. Ao forçar **Mensal**, a
pessoa escolhe agrupar pela competência ano-mês: deve haver no máximo uma
observação por mês, e a interface informa que o dia do mês não entra na distância.

### Escala estatística

Para períodos de calendário, a coordenada mantém um ano como unidade:

- ano: incremento 1;
- semestre: incremento 1/2;
- trimestre: incremento 1/4;
- mês: incremento 1/12;
- data diária: diferença de dias convertida para fração de ano.

A regularidade é verificada pelo índice do período, não pela aritmética decimal
dos rótulos. Dessa forma, `2021.2 → 2022.1` é um passo semestral regular. A APC e
o coeficiente são apresentados como mudança anualizada para frequências de
calendário. Em sequência numérica ou ordem simples, a interface usa “por unidade
temporal informada” ou “por intervalo observado”, sem chamá-la de anual.

O rótulo original continua nos pontos, tabelas e período analisado. Nenhum período
ausente é criado ou imputado.

## 5. Prais–Winsten: detecção e controle

Na etapa **Configurar**, acima da prévia da série, mostrar:

- `Periodicidade detectada: Semestral`, ou a frequência correspondente;
- a base do efeito, por exemplo `efeito anualizado`;
- um seletor **Interpretar períodos como** com Automático, Anual, Semestral,
  Trimestral, Mensal, Datas, Valores numéricos e Ordem das linhas.

Automático é o padrão. O seletor só muda a interpretação temporal, nunca o texto
da célula. Alterá-lo invalida resultados anteriores e recalcula imediatamente a
prévia. **Ordem das linhas** é uma decisão explícita: não será oferecida como
correção automática de lacunas, e a interface avisará que distâncias reais entre
datas deixam de ser usadas. Nesse modo, qualquer rótulo temporal não vazio é
aceito, a ordem original é preservada e as coordenadas são 0, 1, 2, ...; valores
de desfecho inválidos continuam excluídos e informados.

Adicionar aliases de cabeçalho como semestre, semester, trimestre, quarter, mês,
mes e data. O papel `tempo` deixa de exigir genericamente um número e passa a usar
validação temporal. `variavel_y` continua numérica.

O resultado inclui frequência, base do efeito, quantidade utilizada e intervalo
original. Gráficos usam os rótulos preservados e a ordenação semântica.

## 6. Lacunas, duplicidades e ambiguidades

Substituir o erro único por diagnósticos específicos:

- **lacuna:** `Falta o período 2023.2 entre 2023.1 e 2024.1.`; listar um conjunto
  limitado e informar quantos outros faltam;
- **duplicidade:** identificar os rótulos e números de linha repetidos;
- **frequências misturadas:** informar os formatos encontrados;
- **token inválido:** indicar as linhas e os valores não reconhecidos;
- **ordem alterada:** informar que a série será ordenada, sem bloquear;
- **inferência ambígua:** pedir confirmação no seletor antes de analisar;
- **intervalo irregular real:** bloquear e explicar que Prais–Winsten pressupõe
  observações igualmente espaçadas para a autocorrelação AR(1).

Valores de desfecho ausentes ou inválidos não podem desaparecer sem contagem. A
prévia informa linhas utilizáveis e problemáticas. Se remover um valor interno
criar lacuna, a lacuna continua bloqueando; se o problema estiver na extremidade,
o período efetivamente analisado e a linha excluída ficam explícitos.

## 7. Importação compartilhada

### Resumo visível

Após colar ou carregar, exibir um resumo compacto:

- origem e nome do arquivo;
- aba escolhida quando for XLSX;
- formato/separador detectado;
- quantidade de linhas e colunas;
- cabeçalho encontrado e método de vinculação: nome, posição ou manual;
- correções e avisos, em uma área expansível.

Não transformar esse resumo num novo assistente obrigatório. Dados claros seguem
direto para a tabela; somente ambiguidades relevantes exigem ação.

### Diagnósticos preservados

O estado compartilhado conserva, em forma tipada:

- cabeçalhos duplicados;
- linhas mais curtas ou mais longas;
- células adicionais e cabeçalhos sintetizados;
- separador e uso de vírgula decimal;
- aba selecionada e outras abas encontradas;
- reconhecimento por posição e as suposições feitas;
- fórmulas sem valor em cache e células XLSX inutilizáveis;
- formatos numéricos misturados e tokens ausentes conhecidos.

Informações não bloqueantes usam aviso; corrupção, limite excedido ou estrutura
irrecuperável usam erro. Mensagens técnicas ficam recolhidas e não substituem a
orientação principal.

### Matriz retangular

Antes de criar o documento editável, normalizar a largura:

- completar linhas curtas com células vazias;
- quando houver células além do cabeçalho, criar `Coluna N` para torná-las
  visíveis, sem descartar conteúdo;
- manter IDs distintos para nomes duplicados e avisar qual coluna foi sugerida;
- nunca truncar silenciosamente para a largura da primeira linha.

### Arquivos

Preservar CSV, TSV, TXT e XLSX, incluindo aspas, quebras de linha em células,
vírgula decimal, BOM e codificações já suportadas. Extensões não suportadas, como
`.xls`, recebem rejeição imediata e orientação para salvar como `.xlsx` ou CSV;
o binário não deve ser tentado como texto.

No XLSX, ler o sistema de datas e os estilos numéricos necessários para converter
somente células inequivocamente formatadas como data. A conversão produz ISO
canônico para análise e rótulo legível para edição. Números seriais sem estilo de
data permanecem números; se aparecerem numa coluna temporal com faixa típica de
serial do Excel, emitir aviso e pedir confirmação, sem conversão silenciosa.

Fórmulas não são executadas. Valor em cache continua permitido; fórmula sem cache
continua ausente e avisada.

## 8. Contrato entre tabela e testes

Tipos de coluna e papéis do teste continuam separados. A importação sugere; a
escolha explícita do usuário vence e sobrevive à edição.

A pré-validação usa o conjunto efetivamente vinculado e segue regras comuns:

- nenhuma célula ausente vira zero;
- nenhuma coluna ou grupo extra é descartado para fazer o teste caber;
- linhas/células excluídas têm contagem e números de linha;
- um resultado só é executado quando todos os bloqueios foram resolvidos;
- alertas de pressuposto permanecem visíveis junto ao resultado;
- a mensagem diferencia arquivo inválido, mapeamento incompleto, dado inválido e
  seleção estatisticamente incompatível.

A auditoria cobre t de Student, Mann–Whitney, ANOVA/Tukey, Kruskal/Dunn,
Qui-quadrado, correlação, Prais–Winsten, logística, Poisson e binomial negativa.
Não alterar fórmulas sem uma regressão numérica de referência demonstrando um
defeito. Ajustes de cálculo descobertos durante a auditoria exigem teste que
reproduza a falha e registro explícito no relatório final.

## 9. Erros e recuperação

- A pessoa pode editar a célula, trocar o papel, substituir o arquivo ou colar
  novamente sem recarregar a página.
- Uma nova colagem ou arquivo continua vencendo leituras anteriores; limpar
  invalida trabalhos pendentes.
- Erro de uma aba ou arquivo não apaga a tabela válida já confirmada sem a
  confirmação de substituição existente.
- O primeiro aviso traz causa e correção; detalhes listam linhas, células e
  formatos relevantes.
- O aplicativo não registra dados brutos no console nem envia a tabela a servidor.
- Limites de tamanho e proteção do XLSX permanecem iguais ou mais restritivos.

## 10. Estratégia de testes

Implementar por TDD. Cada falha nova começa com teste vermelho focado; somente
depois entra a menor correção que o faz passar.

### Reconhecedor temporal

- caso semestral integral fornecido pelo usuário;
- virada `2021.2 → 2022.1` sem falso intervalo;
- variantes S/T/Q, mês, data brasileira e ISO;
- ordenação, duplicidade, lacuna e frequência misturada;
- ambiguidade entre decimal, mês, trimestre e semestre;
- escala anualizada e texto correto para calendário, número e ordem;
- zeros, desfecho inválido e exclusões nas extremidades/interior.

### Importação

Uma matriz compartilhada será aplicada aos dez `TABULAR_OPTIONS`:

- colagem por tabulação, ponto e vírgula e CSV;
- ponto decimal e vírgula decimal;
- BOM, espaços não separáveis, linhas vazias e metadados antes do cabeçalho;
- células entre aspas, delimitadores e quebras de linha internas;
- cabeçalhos genéricos, duplicados ou trocados;
- linhas curtas, largas e valores ausentes;
- substituições concorrentes e falhas recuperáveis;
- XLSX com múltiplas abas, strings compartilhadas, fórmulas, datas nos sistemas
  1900/1904, estilo de data e serial ambíguo;
- extensão não suportada, arquivo corrompido e limites de segurança.

### Testes estatísticos

Para cada módulo, confirmar com seu exemplo e com entradas problemáticas:

- quantidade e identidade dos grupos;
- tamanho amostral mínimo e variação suficiente;
- pareamento incompleto;
- categorias excessivas ou espúrias;
- contagem negativa/não inteira e exposição inválida;
- desfecho não binário, separação e matriz singular;
- X/Y constantes ou pares insuficientes;
- períodos duplicados, ausentes ou irregulares;
- nenhuma execução quando houver bloqueio e nenhum descarte silencioso para
  produzir um resultado.

## 11. Critérios de aceite

1. Colar exatamente a tabela `Semestre / N de inscritos` detecta 12 pontos
   semestrais de 2021.1 a 2026.2, sem falso erro de irregularidade.
2. A configuração mostra periodicidade semestral e permite corrigi-la; a mudança
   invalida e recalcula o resultado.
3. Lacuna, duplicidade, frequência mista e token temporal inválido geram mensagens
   distintas, com período ou linha correspondente.
4. O resultado informa frequência e base do efeito; não chama uma mudança por
   ordem simples de anual.
5. Toda célula importada fica visível na tabela; nenhuma coluna extra permanece
   escondida por um cabeçalho curto.
6. Cabeçalhos duplicados, reconhecimento por posição, aba, separador e avisos XLSX
   chegam à interface.
7. CSV/TSV/TXT/XLSX e colagem comum funcionam nos dez testes; `.xls` é rejeitado
   com orientação clara.
8. Datas XLSX inequivocamente formatadas são interpretadas; seriais ambíguos não
   são convertidos silenciosamente.
9. Valores ausentes, grupos extras e linhas inválidas não viram zero nem somem
   para tornar uma análise executável.
10. Todos os exemplos atuais continuam produzindo os mesmos resultados dentro das
    tolerâncias já testadas.
11. A matriz de importação, os testes focados, `npm run gate` e a inspeção real no
    navegador local passam antes do fechamento.
12. `npm run dev` na pasta principal mostra a versão final. O repositório remoto e
    o GitHub Pages permanecem inalterados.

## 12. Fora do escopo

- Imputar períodos ou valores ausentes.
- Executar Prais–Winsten em observações realmente irregulares como se fossem
  igualmente espaçadas.
- Inferir causalidade, independência ou pareamento apenas pelo nome das colunas.
- Adicionar novos testes estatísticos.
- Suportar o formato binário legado `.xls` ou executar fórmulas de planilha.
- Criar backend, conta, telemetria ou envio dos dados do usuário.
- Publicar, fazer push, abrir pull request ou alterar o GitHub Pages.
