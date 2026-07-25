export interface CollectionLink {
  label: string;
  url: string;
  note?: string;
}

/** Phase 1 mock — portal landing pages only; Phase 5 ships deep links per CAT-02. */
export const MOCK_COLLECTION_LINKS: Record<string, CollectionLink[]> = {
  'Internações por causa': [
    {
      label: 'TABNET: SIH/SUS',
      url: 'http://tabnet.datasus.gov.br/',
      note: 'Abra Morbidade hospitalar (SIH) e selecione Linha = UF ou Município, Coluna = Ano, Conteúdo = Internações.',
    },
  ],
  'Internações hospitalares': [
    {
      label: 'TABNET: SIH/SUS',
      url: 'http://tabnet.datasus.gov.br/',
      note: 'Abra Morbidade hospitalar (SIH) e selecione Linha = UF ou Município, Coluna = Ano, Conteúdo = Internações.',
    },
  ],
  'Internações por embolia e trombose arteriais': [
    {
      label: 'TABNET: SIH/SUS',
      url: 'http://tabnet.datasus.gov.br/',
      note: 'Morbidade hospitalar (SIH/nibr) — embolia e trombose arteriais por UF e ano.',
    },
  ],
  'Óbitos hospitalares': [
    {
      label: 'TABNET: SIH/SUS',
      url: 'http://tabnet.datasus.gov.br/',
      note: 'Em Morbidade hospitalar, use Conteúdo = Óbitos e filtre por causa ou procedimento conforme sua pergunta.',
    },
  ],
  'Óbitos hospitalares por embolia e trombose arteriais': [
    {
      label: 'TABNET: SIH/SUS',
      url: 'http://tabnet.datasus.gov.br/',
      note: 'Morbidade hospitalar (SIH) — óbitos por embolia e trombose arteriais.',
    },
  ],
  'Internações por amputação de membros inferiores': [
    {
      label: 'TABNET: SIH/SUS Procedimentos',
      url: 'http://tabnet.datasus.gov.br/',
      note: 'Procedimentos hospitalares (qibr) — amputação de MMII por UF e ano.',
    },
  ],
  'Taxa de mortalidade infantil': [
    {
      label: 'SIDRA/IBGE',
      url: 'https://sidra.ibge.gov.br/',
      note: 'Busque a tabela de mortalidade infantil ou nascidos vivos por UF/município e ano.',
    },
    {
      label: 'Atlas da Saúde',
      url: 'https://indicadores.saude.saude.gov.br/',
      note: 'Consulte indicadores materno-infantis agregados por território.',
    },
  ],
  'Cobertura de atenção primária': [
    {
      label: 'e-Gestor Atenção Básica',
      url: 'https://relatorioaps.saude.gov.br/',
      note: 'Selecione o indicador de cobertura da APS/ESF por município ou UF e o período desejado.',
    },
  ],
  'Amputações de membros inferiores': [
    {
      label: 'TABNET: SIH/SUS Procedimentos',
      url: 'http://tabnet.datasus.gov.br/',
      note: 'Em Procedimentos do hospitalar, filtre códigos de amputação maior/menor e agregue por UF-ano.',
    },
  ],
  'Procedimentos ambulatoriais': [
    {
      label: 'TABNET: SIA/SUS',
      url: 'http://tabnet.datasus.gov.br/',
      note: 'Abra Procedimentos ambulatoriais (SIA), Linha = UF, Coluna = Ano, Conteúdo = Quantidade apresentada.',
    },
  ],
  'Mortalidade materna': [
    {
      label: 'TABNET: SIM',
      url: 'http://tabnet.datasus.gov.br/',
      note: 'Em Mortalidade (SIM), selecione causas maternas e agregue óbitos por UF ou município.',
    },
    {
      label: 'Atlas da Saúde',
      url: 'https://indicadores.saude.saude.gov.br/',
      note: 'Indicadores de mortalidade materna por território.',
    },
  ],
  'Leitos hospitalares': [
    {
      label: 'TABNET: CNES',
      url: 'http://tabnet.datasus.gov.br/',
      note: 'Em CNES, use a tabela de leitos por UF/município e ano de competência.',
    },
  ],
  'Nascidos vivos': [
    {
      label: 'SIDRA/IBGE',
      url: 'https://sidra.ibge.gov.br/',
      note: 'Tabela de nascidos vivos por residência da mãe, sexo e ano.',
    },
    {
      label: 'TABNET: SINASC',
      url: 'http://tabnet.datasus.gov.br/',
      note: 'Alternativa DATASUS: nascidos vivos por UF/município no SINASC.',
    },
  ],
  'Consultas de atenção básica': [
    {
      label: 'e-Gestor Atenção Básica',
      url: 'https://relatorioaps.saude.gov.br/',
      note: 'Indicadores de produção ambulatorial da APS por equipe ou território.',
    },
    {
      label: 'TABNET: SIA/SUS',
      url: 'http://tabnet.datasus.gov.br/',
      note: 'Procedimentos ambulatoriais de atenção básica agregados por UF-ano.',
    },
  ],
};

export function getCollectionLinks(variable: string): CollectionLink[] {
  return MOCK_COLLECTION_LINKS[variable] ?? [];
}
