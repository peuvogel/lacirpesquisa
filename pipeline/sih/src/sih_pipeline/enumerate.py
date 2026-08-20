"""Enumeração determinística dos arquivos SIH-RD esperados — ausência é falha ruidosa (SC-1/PIPE-01).

A lista dos arquivos `RD{UF}{AA}{MM}` é computada por regra determinística, sem tocar rede. Só
`fetch_actual_file_names()` toca o FTP real do DataSUS — e faz isso importando `pysus` dentro do
próprio corpo da função, nunca no topo do módulo, para que `import sih_pipeline.enumerate`
continue livre de efeito colateral de rede (09-RESEARCH.md §Anti-Patterns: os módulos de
conveniência do `pysus` disparam listagem FTP como efeito colateral do import).

**Duas janelas, deliberadamente separadas (09-15-DT-INTER, 2026-08-17).** Até esta correção
existia UMA janela só (2013-2025) e ela era usada para duas coisas diferentes ao mesmo tempo, o
que só funcionava porque `aggregate.py` agregava por `ANO_CMPT` (competência de FATURAMENTO). Com
a agregação passando a ser por `DT_INTER` (data real de INTERNAÇÃO — ver `aggregate.py`), as duas
deixam de coincidir e precisam ser nomeadas separadamente:

| Janela | O que limita | Valor | Fonte da verdade |
|---|---|---|---|
| **Admissão** (publicação) | o `ano` de cada linha agregada — o ano em que a internação ACONTECEU | 2013-2025 | `scripts/catalog/schema-v3.json` (`anoMin`/`anoMax`), lido por `aggregate.py` |
| **Competência** (coleta) | quais arquivos `RD{UF}{AA}{MM}` baixar | 2013-01 … 2026-05 | este módulo |

A janela D-11 continua sendo 2013-2025 e NÃO foi alargada — ela apenas passou a significar o que
sempre deveria ter significado (anos de internação). A janela de competência é CONSEQUÊNCIA
derivada dela, não uma flexibilização: uma internação de dezembro/2025 pode ter a AIH faturada em
janeiro/2026, e o arquivo de competência 2026-01 é o único lugar onde esse registro existe.

**Por que a cauda vai até 2026-05, medido e não suposto.** A defasagem entre `DT_INTER` e
competência foi medida ao vivo contra dado real (2026-08-17), em duas UFs de portes opostos:

- **AC, competência 2025 inteira** (61.479 registros `IDENT='1'`): 93,94% têm `DT_INTER` no
  próprio ano de competência, 6,06% no ano anterior, e **ZERO com defasagem ≥ 2 anos**. Por mês
  de competência, a massa do ano anterior decai rápido: jan 58,70% · fev 16,39% · mar 6,25% ·
  abr 0,46% · mai 0,02% · jun 0,05% · jul-dez 0,00%.
- **SP, competências 2026-02 a 2026-06** (a UF com 29,20× o volume do AC), fração de cada arquivo
  cujo `DT_INTER` é do ano ANTERIOR (2025): fev 8,460% (19.156) · mar 1,882% (4.725) ·
  abr 0,246% (606) · **mai 0,030% (77)** · **jun 0,007% (17 de 245.252)**.

A cauda decai por um fator de ~4 a ~8 por mês nas duas UFs. Cortar a competência em **2026-05**
deixa de fora, para o ano de admissão 2025, uma massa cujo limite superior medido é o próprio
arquivo de junho: 17 registros em 245.252 na maior UF do país (0,007%), mais o resto da série
geométrica (~6 registros). Não é "assumido que um ano basta" — é medido que a cauda é curta e
que o corte cai onde ela já é ruído.

**Por que 2026-05 e não 2026-06** (medido ao vivo no FTP, 2026-08-17): a competência 2026-06
existe para **25 das 27 UFs**, não 27. Incluí-la faria duas UFs falharem a coleta inteira
(`collect.collect_uf` recusa agregar com arquivo faltante, e está certo em recusar) por um
arquivo que contribui 0,007%. O corte em 2026-05, verificado completo para as 27 UFs, evita
trocar 0,007% de completude por 2/27 de cobertura.

**Obrigatório vs. oportunista — a garantia SC-1/PIPE-01 não foi enfraquecida.** Os 4.212 arquivos
de competência 2013-2025 continuam OBRIGATÓRIOS: a ausência de qualquer um deles no FTP continua
sendo `SystemExit`, exatamente como antes. Os 135 arquivos da cauda (27 UFs × 5 meses de 2026)
são OPORTUNISTAS — o DATASUS publica competência nova mês a mês, então "faltar" um arquivo de
2026 é o estado normal do mundo, não um defeito da fonte. `assert_no_missing` trata os dois
conjuntos de forma diferente e explícita (nunca uma tolerância global que enfraqueceria o SC-1):
ausência na cauda vira AVISO ruidoso em `stderr`, ausência no obrigatório continua derrubando a
corrida. `YEARS` (o range que `download.py` usa para pedir a listagem ao FTP) cobre os dois — é
listagem, não promessa.
"""

from __future__ import annotations

import sys

# 27 siglas, na ordem do 09-RESEARCH.md §"Architecture Patterns" Pattern 1.
UFS: tuple[str, ...] = (
    "RO", "AC", "AM", "RR", "PA", "AP", "TO", "MA", "PI", "CE", "RN", "PB", "PE", "AL",
    "SE", "BA", "MG", "ES", "RJ", "SP", "PR", "SC", "RS", "MS", "MT", "GO", "DF",
)

# Competência OBRIGATÓRIA (13 anos): todo mês de 2013-01 a 2025-12, das 27 UFs. Ausência de
# qualquer um destes é falha ruidosa (SC-1/PIPE-01) -- 4.212 arquivos.
ANOS_COMPETENCIA_OBRIGATORIA = range(2013, 2026)

# Competência de CAUDA (oportunista): os meses de 2026 necessários para FECHAR o ano de admissão
# 2025 por `DT_INTER`. Ver a docstring do módulo para a medição que fixa o último mês em 05
# (decaimento medido em AC e SP + verificação ao vivo de que 2026-06 só existe para 25/27 UFs).
# Ausência aqui é AVISO, nunca falha -- o DATASUS publica competência nova mês a mês.
ANO_COMPETENCIA_CAUDA = 2026
ULTIMO_MES_COMPETENCIA_CAUDA = 5

# Range de anos que a LISTAGEM do FTP precisa cobrir para enxergar os dois conjuntos acima
# (`download._fetch_actual_files` importa este nome). Listar um ano não é prometer que ele
# existe: quem promete é `expected_file_names_obrigatorios()`.
YEARS = range(ANOS_COMPETENCIA_OBRIGATORIA.start, ANO_COMPETENCIA_CAUDA + 1)

_FTP_SIH_DIR = "/dissemin/publicos/SIHSUS/200801_/Dados"


def _nome(uf: str, year: int, month: int) -> str:
    return f"RD{uf}{year % 100:02d}{month:02d}"


def expected_file_names_obrigatorios() -> frozenset[str]:
    """Os 4.212 arquivos de competência 2013-2025 (27 × 13 × 12) — o conjunto cuja ausência é
    falha ruidosa (SC-1/PIPE-01). Inalterado por 09-15-DT-INTER."""
    return frozenset(
        _nome(uf, year, month)
        for uf in UFS
        for year in ANOS_COMPETENCIA_OBRIGATORIA
        for month in range(1, 13)
    )


def cauda_file_names() -> frozenset[str]:
    """Os 135 arquivos de competência de cauda (27 UFs × 2026-01..2026-05) — necessários para
    fechar o ano de ADMISSÃO 2025 por `DT_INTER`, e oportunistas por natureza (o DATASUS publica
    competência nova mês a mês). Ver docstring do módulo para a medição do corte."""
    return frozenset(
        _nome(uf, ANO_COMPETENCIA_CAUDA, month)
        for uf in UFS
        for month in range(1, ULTIMO_MES_COMPETENCIA_CAUDA + 1)
    )


def expected_file_names() -> frozenset[str]:
    """Tudo que a coleta precisa baixar: obrigatório ∪ cauda (4.212 + 135 = 4.347).

    É este conjunto que `download.download_all` usa para decidir o que está pendente e que
    `collect._expected_uf_files` recorta por UF — por isso ele PRECISA conter a cauda, senão os
    arquivos de 2026 nunca seriam baixados e o ano de admissão 2025 ficaria truncado justamente
    no mês de maior massa (janeiro concentra 58,70% da defasagem medida em AC)."""
    return expected_file_names_obrigatorios() | cauda_file_names()


def diff_expected_actual(
    expected: frozenset[str], actual: frozenset[str]
) -> frozenset[str]:
    """Diferença de conjuntos `expected - actual` — ignora qualquer extra presente em `actual`."""
    return frozenset(expected) - frozenset(actual)


def assert_no_missing(expected: frozenset[str], actual: frozenset[str]) -> None:
    """Levanta `SystemExit` se algum nome OBRIGATÓRIO de `expected` estiver ausente em `actual`
    (PIPE-01/SC-1).

    Nunca devolve um código de sucesso silencioso nem imprime "OK" quando não há ausência —
    a ausência de exceção já é o sinal, não uma mensagem.

    **Cauda (09-15-DT-INTER):** um nome ausente que pertence a `cauda_file_names()` (competência
    2026, ver docstring do módulo) NÃO derruba a corrida — o DATASUS publica competência nova mês
    a mês, então "ainda não existe" é o estado normal desses arquivos, não um defeito da fonte.
    Mas também NUNCA é silencioso: cada ausência de cauda vira aviso em `stderr`, porque a
    consequência dela é real e precisa ser visível (o ano de admissão 2025 fecha com menos
    competência do que o desenho previa). A garantia original continua exatamente igual de dura
    para os 4.212 obrigatórios — a tolerância é por NOME, jamais uma banda global."""
    missing = diff_expected_actual(expected, actual)
    if not missing:
        return

    cauda = cauda_file_names()
    missing_cauda = missing & cauda
    missing_obrigatorio = missing - cauda

    if missing_cauda:
        print(
            f"AVISO: {len(missing_cauda)} arquivo(s) de competência de CAUDA ausentes no FTP "
            f"(oportunistas, não derrubam a coleta): {sorted(missing_cauda)[:10]} -- o ano de "
            "admissão 2025 vai fechar com menos competência de 2026 do que o desenho previa; "
            "ver enumerate.py, docstring do módulo, para a massa medida por mês.",
            file=sys.stderr,
        )

    if missing_obrigatorio:
        amostra = sorted(missing_obrigatorio)[:10]
        raise SystemExit(
            f"FALHA: {len(missing_obrigatorio)} arquivo(s) SIH-RD ausentes no FTP: {amostra}"
        )


def fetch_actual_file_names() -> frozenset[str]:
    """Única função deste módulo que toca rede — lista o FTP real do DataSUS.

    Import de `pysus` feito dentro do corpo (nunca no topo do módulo) para que
    `import sih_pipeline.enumerate` continue livre de efeito colateral de rede.
    """
    from pysus.ftp import Directory
    from pysus.ftp.databases.sih import SIH

    s = SIH()
    s.load(directories=[Directory(_FTP_SIH_DIR)])
    files = s.get_files("RD", uf=list(UFS), year=list(YEARS))
    return frozenset(f.name for f in files)


def main(argv: list[str]) -> int:
    """Contrato do despachante `cli.py`: roda a listagem real e devolve o código de saída.

    Nunca devolve 0 se houver ausência OBRIGATÓRIA — `assert_no_missing` é quem decide isso (a
    cauda de competência 2026 conta separado, ver docstring do módulo).
    """
    del argv  # subcomando `enumerate` não tem flags próprias

    expected = expected_file_names()
    actual = fetch_actual_file_names()
    missing = diff_expected_actual(expected, actual)
    cauda = cauda_file_names()

    print(f"esperados: {len(expected)} ({len(expected - cauda)} obrigatórios + {len(cauda)} de cauda)")
    print(f"encontrados: {len(actual)}")
    print(f"ausentes: {len(missing)} ({len(missing - cauda)} obrigatórios + {len(missing & cauda)} de cauda)")

    try:
        assert_no_missing(expected, actual)
    except SystemExit as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
