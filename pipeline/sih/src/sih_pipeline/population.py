"""Download, decodificação e agregação por faixa etária do POPSVS -- o denominador da Fase 9
(D-24), consumido também por `codigos.py` (09-07) para a canonização de SEXO/município.

RESEARCH Pitfalls 3 e 4 (`09-RESEARCH.md`): a classe de conveniência da biblioteca para o IBGE
tem um bug de correspondência por substring que resolve o parâmetro de fonte pedido para o
diretório errado -- quando pedido um nome curto, a última correspondência de uma varredura sem
interrupção sobrescreve a primeira, entregando o diretório de repasse fiscal em vez do pedido.
Separadamente, o diretório que o docstring da própria biblioteca recomenda como a série "1992
até o presente, estratificada por idade e sexo" na prática só tem arquivos até 2012 -- não cobre
a janela D-11 (2013-2025). Por isso este módulo NUNCA chama as funções de conveniência da
biblioteca para população -- só as primitivas de baixo nível (`Directory`/`File`), como
`enumerate.py`/`download.py` já fazem para o SIH.

Pitfall 7: o SIH usa `SEXO ∈ {1, 3}`, o POPSVS usa `SEXO ∈ {1, 2}` -- a canonização para `"M"`/
`"F"` vem sempre de `sih_pipeline.codigos` (09-07), nunca refeita aqui.

Pitfall 6: a população de UF é derivada por agregação do próprio POPSVS (soma dos seus
municípios), nunca de uma fonte de estimativa separada -- garante que UF e município sempre
somem de forma consistente.

Assumption A2 (RESEARCH `## Assumptions Log`): `IDADE='080'` é interpretado como bin aberto
("80 anos ou mais"), não um valor discreto de idade real -- é por isso que a faixa `80+` de
`schema-v3.json` tem `idadeMax=200`.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import zipfile
from pathlib import Path
from typing import Any, Iterable, Iterator

from sih_pipeline.codigos import municipio6, sexo_popsvs, uf_de_municipio
from sih_pipeline.paths import cache_path, repo_root


def _load_schema_v3() -> dict[str, Any]:
    path = repo_root() / "scripts" / "catalog" / "schema-v3.json"
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


_SCHEMA = _load_schema_v3()
# faixasEtarias/anoMin/anoMax lidos de schema-v3.json em tempo de import -- nunca redeclarados
# como literal solto aqui: é a mesma fonte única que gerou os check constraints da 09-03, e
# divergir aqui produziria linha rejeitada no COPY, ou pior, aceita e errada.
_FAIXAS: list[dict[str, Any]] = _SCHEMA["faixasEtarias"]
ANO_MIN: int = _SCHEMA["anoMin"]
ANO_MAX: int = _SCHEMA["anoMax"]

# Taxa de descarte (SEXO/IDADE não classificável) acima da qual aggregate_population levanta em
# vez de somar em silêncio -- T-09-25.
_MAX_TAXA_DESCARTE = 0.0001  # 0,01%

# RESEARCH Pitfall 5 (09-RESEARCH.md): nenhuma das três fontes que a classe de conveniência da
# biblioteca expõe para o IBGE cobre, ao mesmo tempo, granularidade de município E
# estratificação por sexo/idade: POPTCU é só total por município (sem sexo/idade), projpop é
# estratificada mas só em nível de UF, e POP está desatualizada (Pitfall 4, para em 2012).
# POPSVS cobre as duas coisas e fecha 2013-2025 sem lacuna -- mas não está registrada em
# IBGEDATASUS.paths, por isso é acessada por Directory() direto, nunca pelas funções de
# conveniência (Pitfall 3: bug de substring que resolve para o diretório errado quando chamadas
# com um parâmetro de fonte).
POPSVS_DIR = "/dissemin/publicos/IBGE/POPSVS"


def download_popsvs(ano: int) -> Path:
    """Resolve `POPSBR{AA}` no conteúdo de `Directory(POPSVS_DIR)` e baixa para
    `cache_path("populacao")` -- devolve o caminho do `.zip` baixado (RESEARCH Pattern 5).

    Import de `pysus.ftp` dentro do corpo, nunca no topo do módulo -- mesma disciplina de
    `enumerate.py`/`download.py`: `import sih_pipeline.population` continua livre de rede.
    """
    from pysus.ftp import Directory

    directorio = Directory(POPSVS_DIR)
    nome_arquivo = f"POPSBR{ano % 100:02d}"
    arquivos_por_nome = {arquivo.name: arquivo for arquivo in directorio.content}

    arquivo = arquivos_por_nome.get(nome_arquivo)
    if arquivo is None:
        raise ValueError(
            f"download_popsvs: {nome_arquivo} não encontrado em {POPSVS_DIR} "
            f"(disponíveis: {sorted(arquivos_por_nome)})"
        )

    destino = cache_path("populacao")
    baixado = arquivo.download(local_dir=str(destino))
    caminho = Path(str(baixado))
    if caminho.suffix.lower() != ".zip":
        raise RuntimeError(
            f"download_popsvs: esperava um .zip do POPSVS para {ano}, recebeu {caminho} -- "
            "formato de saída mudou?"
        )
    return caminho


def read_popsvs_year(path: str | Path) -> Iterator[dict[str, Any]]:
    """Streaming do `.dbf` dentro do `.zip` do POPSVS -- nunca carrega o ano inteiro em memória
    de uma vez (um ano tem ~902 mil registros: 5.570 municípios x 81 idades x 2 sexos, contagem
    exata medida ao vivo para 2019).

    Campos devolvidos por registro: `COD_MUN` (7 dígitos), `ANO`, `SEXO` (`'1'`/`'2'`), `IDADE`
    (`'000'`-`'080'`, ano único), `POP`.

    Extrai o `.dbf` para dentro de `cache_path("populacao/...")` -- nunca para fora do cache,
    mesmo com o nome do membro vindo de um `.zip` de terceiro (T-09-08) -- e lê com `dbfread` em
    `load=False` (streaming, um registro por vez, nunca a tabela inteira carregada de uma vez).
    """
    import dbfread

    caminho_zip = Path(path)
    with zipfile.ZipFile(caminho_zip) as arquivo_zip:
        membros_dbf = [
            nome for nome in arquivo_zip.namelist() if nome.lower().endswith(".dbf")
        ]
        if len(membros_dbf) != 1:
            raise ValueError(
                f"read_popsvs_year: esperava exatamente 1 .dbf dentro de {caminho_zip}, "
                f"encontrado {membros_dbf}"
            )
        nome_membro = membros_dbf[0]
        # Path(...).name descarta qualquer diretório embutido no nome do membro do zip --
        # extração sempre resolve para dentro de cache_path("populacao/..."), nunca fora dele.
        caminho_extraido = cache_path(f"populacao/extraido/{Path(nome_membro).name}")
        if not caminho_extraido.exists():
            with arquivo_zip.open(nome_membro) as origem, open(caminho_extraido, "wb") as saida:
                shutil.copyfileobj(origem, saida)

    tabela = dbfread.DBF(str(caminho_extraido), load=False)
    for registro in tabela:
        yield {
            "COD_MUN": str(registro["COD_MUN"]),
            "ANO": str(registro["ANO"]),
            "SEXO": str(registro["SEXO"]),
            "IDADE": str(registro["IDADE"]),
            "POP": int(registro["POP"]),
        }


def _faixa_etaria(idade: int) -> str | None:
    """Faixa cujo `[idadeMin, idadeMax]` contém `idade`; `None` se nenhuma faixa casar
    (descarte). `IDADE=080` cai na faixa `80+` (`idadeMax=200` na fonte única) -- Assumption A2:
    bin aberto, não um valor discreto de idade real."""
    for faixa in _FAIXAS:
        if faixa["idadeMin"] <= idade <= faixa["idadeMax"]:
            return faixa["id"]
    return None


class _AcumuladorAno:
    """Acumuladores de um único ano -- total e estratificado somados A PARTIR DAS MESMAS
    linhas (nunca de uma fonte separada), para que as duas granularidades nunca divirjam."""

    def __init__(self) -> None:
        self.total_muni: dict[tuple[str, str, int], int] = {}
        self.total_uf: dict[tuple[str, int], int] = {}
        self.estrato_muni: dict[tuple[str, str, int, str, str], int] = {}
        self.estrato_uf: dict[tuple[str, int, str, str], int] = {}
        self.lidos = 0
        self.descartados = 0


def _acumular_registro(acumulador: _AcumuladorAno, registro: dict[str, Any], ano: int) -> None:
    acumulador.lidos += 1

    sexo = sexo_popsvs(registro["SEXO"])
    try:
        idade = int(registro["IDADE"])
    except (TypeError, ValueError):
        idade = None
    faixa = _faixa_etaria(idade) if idade is not None else None

    if sexo is None or faixa is None:
        acumulador.descartados += 1
        return

    municipio_codigo = municipio6(registro["COD_MUN"])
    uf_codigo = uf_de_municipio(municipio_codigo)
    populacao = int(registro["POP"])

    chave_total_muni = (municipio_codigo, uf_codigo, ano)
    acumulador.total_muni[chave_total_muni] = (
        acumulador.total_muni.get(chave_total_muni, 0) + populacao
    )

    chave_total_uf = (uf_codigo, ano)
    acumulador.total_uf[chave_total_uf] = acumulador.total_uf.get(chave_total_uf, 0) + populacao

    chave_estrato_muni = (municipio_codigo, uf_codigo, ano, sexo, faixa)
    acumulador.estrato_muni[chave_estrato_muni] = (
        acumulador.estrato_muni.get(chave_estrato_muni, 0) + populacao
    )

    chave_estrato_uf = (uf_codigo, ano, sexo, faixa)
    acumulador.estrato_uf[chave_estrato_uf] = (
        acumulador.estrato_uf.get(chave_estrato_uf, 0) + populacao
    )


def aggregate_population(
    years: Iterable[int],
) -> tuple[dict[str, list[tuple]], dict[str, Any]]:
    """Baixa, lê e agrega o POPSVS para `years` -- devolve `(colecoes, descartes)`.

    `colecoes` traz as quatro coleções com chaves EXATAMENTE iguais aos nomes das tabelas
    criadas na 09-03 (`sih_population_total_uf`, `sih_population_total_muni`,
    `sih_population_uf`, `sih_population_muni`), cada uma uma lista de tuplas na ordem das
    colunas da tabela correspondente. `descartes` traz `registros_lidos`,
    `registros_descartados` e `percentual_descarte`, agregados sobre todos os anos pedidos.

    Cada ano é verificado isoladamente contra `_MAX_TAXA_DESCARTE` (T-09-25) ANTES de suas
    linhas entrarem nas coleções acumuladas -- um ano com descarte alto nunca contribui
    silenciosamente para o resultado final, a função levanta `ValueError` primeiro.
    """
    total_uf: dict[tuple[str, int], int] = {}
    total_muni: dict[tuple[str, str, int], int] = {}
    estrato_uf: dict[tuple[str, int, str, str], int] = {}
    estrato_muni: dict[tuple[str, str, int, str, str], int] = {}
    lidos_total = 0
    descartados_total = 0

    for ano in years:
        caminho = download_popsvs(ano)
        acumulador = _AcumuladorAno()
        for registro in read_popsvs_year(caminho):
            _acumular_registro(acumulador, registro, ano)

        if acumulador.lidos > 0:
            taxa_descarte = acumulador.descartados / acumulador.lidos
            if taxa_descarte > _MAX_TAXA_DESCARTE:
                raise ValueError(
                    f"aggregate_population: taxa de descarte (SEXO/IDADE não classificável) "
                    f"{acumulador.descartados}/{acumulador.lidos} ({taxa_descarte:.4%}) do ano "
                    f"{ano} acima do limite {_MAX_TAXA_DESCARTE:.2%} (T-09-25)"
                )

        for chave, populacao in acumulador.total_uf.items():
            total_uf[chave] = total_uf.get(chave, 0) + populacao
        for chave, populacao in acumulador.total_muni.items():
            total_muni[chave] = total_muni.get(chave, 0) + populacao
        for chave, populacao in acumulador.estrato_uf.items():
            estrato_uf[chave] = estrato_uf.get(chave, 0) + populacao
        for chave, populacao in acumulador.estrato_muni.items():
            estrato_muni[chave] = estrato_muni.get(chave, 0) + populacao

        lidos_total += acumulador.lidos
        descartados_total += acumulador.descartados

    colecoes: dict[str, list[tuple]] = {
        "sih_population_total_uf": [
            (uf_codigo, ano, populacao) for (uf_codigo, ano), populacao in total_uf.items()
        ],
        "sih_population_total_muni": [
            (municipio_codigo, uf_codigo, ano, populacao)
            for (municipio_codigo, uf_codigo, ano), populacao in total_muni.items()
        ],
        "sih_population_uf": [
            (uf_codigo, ano, sexo, faixa, populacao)
            for (uf_codigo, ano, sexo, faixa), populacao in estrato_uf.items()
        ],
        "sih_population_muni": [
            (municipio_codigo, uf_codigo, ano, sexo, faixa, populacao)
            for (municipio_codigo, uf_codigo, ano, sexo, faixa), populacao in estrato_muni.items()
        ],
    }
    descartes = {
        "registros_lidos": lidos_total,
        "registros_descartados": descartados_total,
        "percentual_descarte": (descartados_total / lidos_total) if lidos_total else 0.0,
    }
    return colecoes, descartes


def main(argv: list[str]) -> int:
    """Contrato único que o despachante `cli.py` (09-04) resolve para o subcomando
    `population` -- flags `--ano` (repetível) e `--dry-run` (lê e agrega sem escrever nada)."""
    parser = argparse.ArgumentParser(prog="sih_pipeline.population")
    parser.add_argument(
        "--ano",
        type=int,
        action="append",
        dest="anos",
        help="ano a processar (repetível; default: janela D-11 inteira, schema-v3.json)",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="lê e agrega sem escrever nada em disco"
    )
    args = parser.parse_args(argv)

    anos = args.anos if args.anos else list(range(ANO_MIN, ANO_MAX + 1))

    colecoes, descartes = aggregate_population(anos)

    print(
        f"population: {descartes['registros_lidos']} registro(s) lido(s), "
        f"descarte {descartes['percentual_descarte']:.4%}"
    )
    for nome, linhas in colecoes.items():
        print(f"population: {nome}: {len(linhas)} linha(s)")

    if args.dry_run:
        print("population: --dry-run, nada escrito")
        return 0

    # Escrita persistente (COPY para o banco) fica a cargo do 09-10 (upload) -- esta plan
    # entrega a agregação, não o pipeline de escrita completo (mesmo padrão de aggregate.py).
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
