/**
 * O que cada número do resultado quer dizer, em português de quem está
 * aprendendo — o par de saída do {@link ../../features/tests/shared/roleHelp}
 * (que explica as colunas de entrada em "Papéis desta análise").
 *
 * As chaves são o *conceito*, não o rótulo do card: o card diz "Média de
 * Grupo A" ou "OR (idade)", montados em tempo de execução, e o verbete
 * continua sendo um só. Os exemplos são fixos e ficam no terreno do app —
 * internações, municípios, taxas — porque um exemplo concreto ensina o que
 * uma definição não ensina.
 */
export interface MetricHelpEntry {
  /** Nome do conceito, já que o rótulo do card varia. */
  title: string;
  /** Uma frase: o que esse número é. */
  what: string;
  /** Um caso concreto, com número, no domínio da saúde. */
  example: string;
}

const METRIC_HELP = {
  // ---- Comuns a vários testes ----------------------------------------
  'p-valor': {
    title: 'p-valor',
    what: 'A chance de aparecer uma diferença deste tamanho por puro acaso, num mundo em que não existisse diferença nenhuma.',
    example: 'p = 0,03 quer dizer: se os dois municípios tivessem exatamente a mesma taxa, um resultado assim surgiria em 3 de cada 100 pesquisas. É raro o bastante para desconfiar do "não há diferença". Já p = 0,40 apareceria em 40 de cada 100 — não serve de prova.',
  },
  ic95: {
    title: 'Intervalo de confiança de 95%',
    what: 'A faixa de valores plausíveis para o resultado real, e não só para o que saiu nesta amostra.',
    example: 'Diferença de 2,1 internações por mil com IC95% de 0,8 a 3,4: a diferença verdadeira provavelmente está nessa faixa. Se a faixa incluísse o zero (por exemplo, −0,5 a 3,4), não daria para afirmar que existe diferença.',
  },
  observacoes: {
    title: 'Observações',
    what: 'Quantas linhas da sua tabela entraram no cálculo, depois de descartar as incompletas.',
    example: 'Você colou 120 municípios, mas 8 estavam sem população: entram 112. Quanto menos observações, mais larga fica a margem de erro de tudo o que vem depois.',
  },
  'desvio-residual': {
    title: 'Desvio (residual)',
    what: 'O quanto o modelo ainda erra depois de ajustado — sobra entre o que ele previu e o que aconteceu.',
    example: 'Se o modelo prevê 50 internações num município e ocorreram 78, essa sobra entra no desvio. Desvio bem maior que os graus de liberdade é sinal de que falta algo ao modelo.',
  },
  'qui2-pearson': {
    title: 'χ² de Pearson',
    what: 'Outra medida da sobra do modelo, somando o erro de cada linha em relação ao que era esperado.',
    example: 'Serve de companheira do desvio: se os dois ficam muito acima dos graus de liberdade (digamos, 300 para 100 gl), o modelo está apertado demais para esses dados.',
  },
  'convergencia-irls': {
    title: 'Convergência',
    what: 'Diz se o cálculo do modelo chegou a uma resposta estável, repetindo o ajuste até parar de mudar.',
    example: 'Convergiu em 6 iterações: a estimativa assentou e os números podem ser lidos. Se não converge, o resultado não deve ser interpretado — em geral faltam dados ou sobram categorias raras.',
  },
  'coeficiente-taxa': {
    title: 'Coeficiente do preditor',
    what: 'O quanto a taxa muda para cada unidade a mais do preditor. Vem na escala log: elevar e à sua potência devolve o fator multiplicativo.',
    example: 'Coeficiente 0,18 para "ano" dá e^0,18 ≈ 1,20: a cada ano que passa, a taxa fica ~20% maior. Coeficiente negativo (−0,18) seria queda de ~17% ao ano.',
  },

  // ---- t de Student --------------------------------------------------
  'media-grupo': {
    title: 'Média do grupo',
    what: 'O valor típico daquele grupo: a soma dos valores dividida pelo número de linhas.',
    example: 'Sete municípios com taxas 4, 5, 5, 5, 6, 6 e 3 por mil dão média 4,9. A média é sensível a extremos — um município com 40 puxaria tudo para cima, e aí a mediana conta melhor a história.',
  },
  'diferenca-medias': {
    title: 'Diferença entre médias',
    what: 'Quanto a média de um grupo está acima ou abaixo da do outro — o tamanho bruto do efeito, na unidade dos seus dados.',
    example: 'Média de 6,0 no interior e 4,9 na capital dá diferença de 1,1 internação por mil habitantes. É o número que responde "quanto?", enquanto o p-valor responde "dá para confiar?".',
  },
  'cohen-d': {
    title: "Tamanho de efeito (Cohen's d)",
    what: 'A diferença entre os grupos medida em desvios-padrão, para comparar estudos que usam unidades diferentes.',
    example: 'd = 0,2 é diferença pequena; 0,5, média; 0,8, grande. Uma diferença de 1,1 por mil vira d = 0,9 se os municípios variam pouco entre si, e d = 0,1 se variam muito.',
  },

  // ---- Mann-Whitney --------------------------------------------------
  'estatistica-u': {
    title: 'Estatística U',
    what: 'Conta quantas vezes um valor do primeiro grupo é maior que um do segundo, comparando todos os pares. Trabalha com a ordem dos valores, não com a média.',
    example: 'Com 5 municípios de cada lado há 25 pares. Se o grupo A vence em 22 deles, U fica alto e indica que A costuma ter valores maiores — sem precisar supor curva normal.',
  },
  'efeito-postos': {
    title: 'Efeito por postos',
    what: 'Traduz o U num número de −1 a 1: quão longe o resultado está do empate.',
    example: '0 é empate técnico; 0,6 significa que, ao sortear um município de cada grupo, o do primeiro tem valor maior em cerca de 80% das vezes. Negativo inverte os papéis.',
  },

  // ---- ANOVA + Tukey / Kruskal + Dunn --------------------------------
  'estatistica-f': {
    title: 'Estatística F',
    what: 'Compara a variação *entre* os grupos com a variação *dentro* de cada grupo. Quanto maior, mais os grupos se destacam do ruído interno.',
    example: 'F = 1 é o que se espera quando os grupos são iguais. F = 8 diz que a diferença entre as regiões é oito vezes maior do que a bagunça dentro de cada região.',
  },
  eta2: {
    title: 'Tamanho de efeito (η²)',
    what: 'Que fatia da variação total dos dados é explicada pelo fato de as linhas pertencerem a grupos diferentes.',
    example: 'η² = 0,14 quer dizer que 14% da variação das taxas se deve à região; os outros 86% vêm de tudo o mais (perfil dos municípios, cobertura, acaso).',
  },
  'estatistica-h': {
    title: 'Estatística H',
    what: 'A versão por postos do F: compara a posição média dos grupos depois de ordenar todos os valores juntos.',
    example: 'Ordene as 30 taxas de 1 a 30 e veja a média dos postos de cada região. Se as três regiões ficam em torno de 15, H é baixo; se uma fica em 25 e outra em 6, H sobe.',
  },
  grupos: {
    title: 'Grupos',
    what: 'Quantos grupos entraram na comparação e quantas linhas cada um trouxe.',
    example: 'Três regiões com 10, 12 e 8 municípios. Grupos muito desiguais ou muito pequenos (menos de 5) deixam a conclusão frágil, mesmo com p-valor baixo.',
  },

  // ---- Correlação ----------------------------------------------------
  'metodo-correlacao': {
    title: 'Método',
    what: 'Qual correlação foi usada: Pearson mede linha reta; Spearman mede se uma variável sobe quando a outra sobe, mesmo que a subida não seja reta.',
    example: 'Cinco municípios em ordem crescente de renda, com taxas 20, 10, 7, 6 e 5: a taxa cai sempre, mas cada vez menos — é curva, não reta. Spearman, que só olha a ordem, dá ρ = −1,00 (queda perfeita); Pearson, que procura reta, dá r = −0,88.',
  },
  'coeficiente-correlacao': {
    title: 'Coeficiente de correlação',
    what: 'Vai de −1 a 1 e diz se as duas variáveis andam juntas (positivo), em sentidos opostos (negativo) ou nem uma coisa nem outra (perto de 0).',
    example: 'r = 0,72 entre cobertura de atenção básica e queda de internações é uma associação forte no mesmo sentido. E lembre: andar junto não é causar — a terceira variável escondida costuma existir.',
  },
  'amostra-pares': {
    title: 'Amostra',
    what: 'Quantos pares completos entraram na conta: uma linha só serve se tiver as duas variáveis preenchidas.',
    example: '60 municípios, mas 12 sem o dado de renda: sobram 48 pares. Com menos de ~20 pares, o coeficiente vira quase palpite.',
  },
  'ic95-coeficiente': {
    title: 'IC95% do coeficiente',
    what: 'A faixa plausível para a correlação verdadeira, além desta amostra.',
    example: 'r = 0,72 com IC95% de 0,55 a 0,84 é uma associação forte com boa margem. Já 0,72 com IC de 0,05 a 0,93 avisa que a amostra é pequena demais para cravar o tamanho.',
  },
  r2: {
    title: 'R²',
    what: 'O coeficiente ao quadrado: a fatia da variação de uma variável que a outra acompanha.',
    example: 'r = 0,72 dá R² = 0,52: cerca de metade da variação das internações acompanha a cobertura. A outra metade vem de fatores que não estão no gráfico.',
  },

  // ---- Qui-quadrado --------------------------------------------------
  qui2: {
    title: 'Qui-quadrado (χ²)',
    what: 'Compara a tabela que você observou com a tabela que existiria se as duas características não tivessem relação nenhuma.',
    example: 'Esperava-se 30 óbitos na zona rural e observaram-se 48: cada diferença dessas entra na soma. χ² grande significa tabela bem distante da independência.',
  },
  'cramer-v': {
    title: "Tamanho de efeito (Cramér's V)",
    what: 'Traduz o χ² para uma escala de 0 a 1, que não cresce só porque a amostra é grande.',
    example: 'V = 0,10 é associação fraca; 0,30, moderada; 0,50, forte. Com 100 mil linhas, quase todo χ² dá p-valor baixo — o V é quem diz se a associação importa.',
  },
  'total-observacoes': {
    title: 'Total de observações',
    what: 'A soma de todas as células da tabela cruzada.',
    example: '480 internações distribuídas entre zona urbana/rural e alta/óbito. É esse total que dá (ou tira) a confiança do teste.',
  },
  'celulas-esperado-baixo': {
    title: 'Células com esperado < 5',
    what: 'Quantas casas da tabela têm frequência esperada muito baixa — situação em que o χ² perde a validade.',
    example: 'Numa tabela 2×2 esperando só 3 óbitos numa célula, o teste exato de Fisher é a saída mais honesta. Zero células nessa condição significa χ² tranquilo de interpretar.',
  },

  // ---- Poisson / Binomial negativa -----------------------------------
  superdispersao: {
    title: 'Superdispersão (χ²/gl)',
    what: 'Verifica uma exigência do modelo de Poisson: que a variação das contagens seja do tamanho da própria média. Valores bem acima de 1 dizem que não é o caso.',
    example: '1,1 está ótimo. 3,4 significa que os dados variam três vezes mais do que Poisson supõe — as internações se concentram em surtos, e a Binomial Negativa é o modelo certo.',
  },
  'theta-dispersao': {
    title: 'θ (dispersão)',
    what: 'O parâmetro que mede o excesso de variação das contagens. Quanto menor o θ, mais concentrada e irregular é a ocorrência.',
    example: 'θ = 0,5 indica contagens muito irregulares (uns poucos municípios com surtos grandes). θ alto, como 50, quer dizer que os dados quase caberiam numa Poisson simples.',
  },

  // ---- Logística -----------------------------------------------------
  'odds-ratio': {
    title: 'Odds ratio (OR)',
    what: 'Quantas vezes a chance do desfecho muda a cada unidade a mais do preditor. Acima de 1 aumenta a chance; abaixo de 1 reduz.',
    example: 'OR = 1,8 para "internação em UTI" significa 80% mais chance de óbito em quem passou pela UTI. OR = 0,6 seria 40% menos. OR = 1,0 é nenhuma diferença.',
  },
  'proporcao-minoritaria': {
    title: 'Proporção da classe minoritária',
    what: 'Que fatia das linhas tem o desfecho mais raro. Com fatias muito pequenas, o modelo aprende pouco sobre justamente o que interessa.',
    example: '4% de óbitos em 500 internações são só 20 casos. A regra prática pede ~10 casos do desfecho raro por preditor — com 20 casos, um ou dois preditores no máximo.',
  },

  // ---- Fluxo guiado (Variáveis) --------------------------------------
  epsilon2: {
    title: 'Tamanho de efeito (ε²)',
    what: 'A versão por postos do η²: que fatia da variação na ordenação dos valores se explica pelo grupo a que cada linha pertence.',
    example: 'ε² = 0,08 diz que 8% da diferença de posições entre os municípios vem da região; o resto é variação interna. Lê-se na mesma régua do η²: 0,01 pequeno, 0,06 médio, 0,14 grande.',
  },
  'p-ajustado-holm': {
    title: 'p ajustado por Holm',
    what: 'O p-valor recalculado porque vários desfechos foram testados de uma vez — testar muita coisa aumenta a chance de achar "diferença" por acaso.',
    example: 'Testando 5 desfechos, o menor p bruto de 0,012 vira p ajustado de 0,060: sozinho ele passaria no limiar de 5%, mas no meio de cinco tentativas não passa mais.',
  },

  // ---- Prais-Winsten -------------------------------------------------
  'pontos-temporais': {
    title: 'Pontos temporais',
    what: 'Quantos períodos entraram na série e qual intervalo ela cobre.',
    example: '12 anos, de 2012 a 2023. Séries com menos de ~10 pontos deixam a tendência instável: um ano atípico já vira "tendência".',
  },
  'base-temporal': {
    title: 'Base temporal',
    what: 'A frequência da série — anual, mensal, trimestral — e a unidade em que a tendência é lida.',
    example: 'Base mensal faz a tendência ser "por mês"; base anual, "por ano". Ler uma queda mensal de 0,4% como se fosse anual multiplica o efeito por 12 sem querer.',
  },
  'beta-tendencia': {
    title: 'Coeficiente da tendência (β)',
    what: 'A inclinação da reta ajustada: o quanto o indicador muda a cada período.',
    example: 'β = −0,019 na escala log10 vira queda de cerca de 4,3% ao ano. Em série sem log, β = −1,3 significa 1,3 internação por mil a menos a cada ano.',
  },
  'erro-padrao-beta': {
    title: 'Erro-padrão (β)',
    what: 'A margem de incerteza da inclinação. Entra no teste t e no intervalo de confiança.',
    example: 'β = −0,040 com erro-padrão 0,005 é uma queda bem medida. O mesmo β com erro-padrão 0,038 quase encosta no zero: a queda pode não existir.',
  },
  'classificacao-tendencia': {
    title: 'Classificação',
    what: 'A leitura em palavras da tendência: crescente, decrescente ou estacionária, conforme sinal e significância.',
    example: 'Uma série que vai de 12 a 11,6 por mil em 10 anos, subindo e descendo no meio do caminho, sai como estacionária: oscilou sem rumo claro, e não que "nada aconteceu".',
  },
  apc: {
    title: 'Variação percentual anual (APC)',
    what: 'De quantos por cento o indicador muda a cada período, já convertido do β para porcentagem.',
    example: 'APC = −4,2% ao ano quer dizer que a taxa cai cerca de 4% por ano; em 10 anos, isso é uma queda perto de um terço.',
  },
  'mudanca-absoluta': {
    title: 'Mudança absoluta',
    what: 'A variação por período na unidade original do indicador, usada quando a série contém zeros e não pode virar logaritmo.',
    example: '−1,3 internação por mil habitantes a cada ano. É o mesmo fenômeno da APC, contado em unidades em vez de porcentagem.',
  },
  'autocorrelacao-rho': {
    title: 'Autocorrelação (ρ)',
    what: 'O quanto cada período se parece com o anterior. É a correção que o Prais-Winsten faz e que a regressão comum ignora.',
    example: 'ρ = 0,7 significa que um ano alto costuma vir seguido de outro alto. Sem corrigir isso, a incerteza sai subestimada e a tendência parece mais certa do que é.',
  },
} as const satisfies Record<string, MetricHelpEntry>;

export type MetricHelpKey = keyof typeof METRIC_HELP;

export function metricHelp(key: MetricHelpKey): MetricHelpEntry {
  return METRIC_HELP[key];
}

/** Usado pelos testes para varrer todos os verbetes. */
export const METRIC_HELP_KEYS = Object.keys(METRIC_HELP) as MetricHelpKey[];
