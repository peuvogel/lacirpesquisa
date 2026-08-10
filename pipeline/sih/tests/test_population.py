"""Prova a coleta de população (fonte POPSVS, nunca a rota de conveniência da biblioteca) por
UF e município, total e estratificada por sexo/idade -- D-24. Roda inteiramente sobre
`tests/fixtures/popsvs_amostra.json` (recorte real de 3 municípios do AC/2019, todas as 81
idades, os 2 sexos, 486 registros) -- nenhum teste desta suíte toca rede: `download_popsvs`/
`read_popsvs_year` são sempre substituídos via monkeypatch, porque esta suíte roda dentro de
`npm run gate`.
"""

from __future__ import annotations

import json
import zipfile
from pathlib import Path

import pytest

from sih_pipeline import population
from sih_pipeline.paths import repo_root
from sih_pipeline.population import aggregate_population

FIXTURES_DIR = Path(__file__).parent / "fixtures"
FIXTURE_PATH = FIXTURES_DIR / "popsvs_amostra.json"


def _load_fixture_records() -> list[dict]:
    with FIXTURE_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _schema_v3() -> dict:
    path = repo_root() / "scripts" / "catalog" / "schema-v3.json"
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


@pytest.fixture
def amostra_2019(monkeypatch) -> list[dict]:
    """Substitui download + leitura pela amostra real congelada -- nenhuma rede tocada."""
    registros = _load_fixture_records()
    monkeypatch.setattr(population, "download_popsvs", lambda ano: Path("/fixture/POPSBR19.zip"))
    monkeypatch.setattr(population, "read_popsvs_year", lambda caminho: iter(registros))
    return registros


@pytest.fixture
def resultado(amostra_2019):
    return aggregate_population([2019])


def test_aggregate_population_devolve_quatro_colecoes_com_nomes_da_09_03(resultado):
    colecoes, _descartes = resultado

    assert set(colecoes.keys()) == {
        "sih_population_total_uf",
        "sih_population_total_muni",
        "sih_population_uf",
        "sih_population_muni",
    }
    # sanity: a amostra (3 municípios x 81 idades x 2 sexos) produziu linhas em todas elas
    assert all(colecoes[nome] for nome in colecoes)


def test_toda_linha_estratificada_tem_faixa_valida_e_sexo_m_f(resultado):
    colecoes, _descartes = resultado
    faixas_validas = {faixa["id"] for faixa in _schema_v3()["faixasEtarias"]}

    for _uf, _ano, sexo, faixa, pop in colecoes["sih_population_uf"]:
        assert faixa in faixas_validas
        assert sexo in {"M", "F"}
        assert pop >= 0

    for _municipio, _uf, _ano, sexo, faixa, pop in colecoes["sih_population_muni"]:
        assert faixa in faixas_validas
        assert sexo in {"M", "F"}
        assert pop >= 0


def test_idade_080_cai_na_faixa_80_mais(amostra_2019, resultado):
    # Assumption A2 (RESEARCH): IDADE=080 é bin aberto -- soma manual da amostra congelada para
    # o município 1200013 (código 6-dígitos 120001), sexo masculino (SEXO='1' no POPSVS).
    colecoes, _descartes = resultado

    esperado = sum(
        registro["POP"]
        for registro in amostra_2019
        if registro["COD_MUN"] == "1200013"
        and registro["SEXO"] == "1"
        and registro["IDADE"] == "080"
    )
    assert esperado > 0

    achado = [
        pop
        for municipio, _uf, _ano, sexo, faixa, pop in colecoes["sih_population_muni"]
        if municipio == "120001" and sexo == "M" and faixa == "80+"
    ]
    assert achado == [esperado]


def test_soma_estratificada_do_municipio_igual_ao_total_do_municipio(resultado):
    colecoes, _descartes = resultado

    soma_estrato: dict[tuple[str, int], int] = {}
    for municipio, _uf, ano, _sexo, _faixa, pop in colecoes["sih_population_muni"]:
        chave = (municipio, ano)
        soma_estrato[chave] = soma_estrato.get(chave, 0) + pop

    total = {
        (municipio, ano): pop for municipio, _uf, ano, pop in colecoes["sih_population_total_muni"]
    }

    assert soma_estrato  # sanity: produziu chaves
    assert soma_estrato == total


def test_soma_dos_municipios_da_uf_igual_ao_total_da_uf(resultado):
    # Pitfall 6: UF derivada por agregação do próprio POPSVS, nunca de outra fonte -- por isso
    # a soma dos municípios (mesmo um subconjunto, como esta amostra) tem que fechar exatamente
    # contra o total de UF que a MESMA passada produziu.
    colecoes, _descartes = resultado

    soma_municipios_por_uf: dict[tuple[str, int], int] = {}
    for _municipio, uf, ano, pop in colecoes["sih_population_total_muni"]:
        chave = (uf, ano)
        soma_municipios_por_uf[chave] = soma_municipios_por_uf.get(chave, 0) + pop

    total_uf = {(uf, ano): pop for uf, ano, pop in colecoes["sih_population_total_uf"]}

    assert soma_municipios_por_uf  # sanity
    assert soma_municipios_por_uf == total_uf


def test_municipio_codigo_tem_sempre_6_digitos(resultado):
    colecoes, _descartes = resultado

    for municipio, _uf, _ano, _pop in colecoes["sih_population_total_muni"]:
        assert len(municipio) == 6, municipio

    for municipio, _uf, _ano, _sexo, _faixa, _pop in colecoes["sih_population_muni"]:
        assert len(municipio) == 6, municipio


def test_sexo_nao_classificavel_acima_do_limite_levanta(monkeypatch):
    # T-09-25: 2/10.000 = 0,02% > 0,01% -- levanta em vez de somar em silêncio.
    validos = [
        {"COD_MUN": "1200013", "ANO": "2019", "SEXO": "1", "IDADE": "000", "POP": 10}
        for _ in range(9998)
    ]
    invalidos = [
        {"COD_MUN": "1200013", "ANO": "2019", "SEXO": "9", "IDADE": "000", "POP": 1}
        for _ in range(2)
    ]
    monkeypatch.setattr(population, "download_popsvs", lambda ano: Path("/fixture/x.zip"))
    monkeypatch.setattr(population, "read_popsvs_year", lambda caminho: iter(validos + invalidos))

    with pytest.raises(ValueError):
        aggregate_population([2019])


def test_idade_nao_classificavel_abaixo_do_limite_nao_levanta_e_conta_descarte(monkeypatch):
    # 1/20.000 = 0,005% < 0,01% -- não levanta, mas o descarte aparece na segunda posição.
    validos = [
        {"COD_MUN": "1200013", "ANO": "2019", "SEXO": "1", "IDADE": "000", "POP": 10}
        for _ in range(19999)
    ]
    invalidos = [
        {"COD_MUN": "1200013", "ANO": "2019", "SEXO": "1", "IDADE": "999", "POP": 1}
    ]
    monkeypatch.setattr(population, "download_popsvs", lambda ano: Path("/fixture/x.zip"))
    monkeypatch.setattr(population, "read_popsvs_year", lambda caminho: iter(validos + invalidos))

    colecoes, descartes = aggregate_population([2019])

    assert descartes["registros_descartados"] == 1
    assert descartes["registros_lidos"] == 20000
    assert colecoes["sih_population_total_muni"]  # produziu saída normalmente


def test_import_do_modulo_e_livre_de_rede():
    """Importar sih_pipeline.population nunca abre conexão FTP -- Directory/dbfread não são
    atributos de módulo (só existem dentro do corpo de download_popsvs/read_popsvs_year)."""
    assert not hasattr(population, "Directory")
    assert not hasattr(population, "dbfread")


def test_main_e_chamavel():
    assert callable(population.main)


def test_dry_run_le_e_agrega_sem_escrever_e_imprime_descarte(monkeypatch, amostra_2019, capsys):
    monkeypatch.setattr(population, "download_popsvs", lambda ano: Path("/fixture/POPSBR19.zip"))
    monkeypatch.setattr(population, "read_popsvs_year", lambda caminho: iter(amostra_2019))

    codigo = population.main(["--ano", "2019", "--dry-run"])

    saida = capsys.readouterr()
    assert codigo == 0
    assert "descarte" in saida.out.lower()
    assert "486" in saida.out  # registros lidos da amostra


def test_faixas_etarias_nao_sao_redeclaradas_em_python():
    # As faixas vivem em população._FAIXAS, lidas de schema-v3.json em tempo de import -- nunca
    # uma lista literal solta que possa divergir do check constraint gerado pela 09-03.
    assert population._FAIXAS == _schema_v3()["faixasEtarias"]


def test_read_popsvs_year_normaliza_nomes_de_campo_minusculos(monkeypatch, tmp_path, cache_dir):
    # Desvio medido ao vivo nesta plan (Task 2): POPSBR25 -- o ano mais recente da própria
    # janela D-11 -- vem com nomes de campo em minúsculas (cod_mun/ano/sexo/idade/pop),
    # diferente de POPSBR13..POPSBR24 (maiúsculas). dbfread é substituído por um duble que
    # devolve exatamente essa forma, sem depender de escrever um .dbf binário real.
    import dbfread

    registros_minusculos = [
        {"cod_mun": "1200013", "ano": "2025", "sexo": "1", "idade": "000", "pop": 42},
    ]

    class _DBFDuble:
        def __init__(self, *_args, **_kwargs) -> None:
            pass

        def __iter__(self):
            return iter(registros_minusculos)

    monkeypatch.setattr(dbfread, "DBF", _DBFDuble)

    conteudo_dbf = tmp_path / "pop25.dbf"
    conteudo_dbf.write_bytes(b"conteudo-irrelevante -- DBF() esta substituido pelo duble acima")
    caminho_zip = tmp_path / "POPSBR25.zip"
    with zipfile.ZipFile(caminho_zip, "w") as arquivo_zip:
        arquivo_zip.write(conteudo_dbf, arcname="pop25.dbf")

    resultado = list(population.read_popsvs_year(caminho_zip))

    assert resultado == [
        {"COD_MUN": "1200013", "ANO": "2025", "SEXO": "1", "IDADE": "000", "POP": 42}
    ]
