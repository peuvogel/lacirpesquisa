"""Prova o raspador mínimo do oráculo TabNet (D-18), usado para re-raspar ao vivo a fixture
de reconciliação (D-04). Nenhum teste desta suíte toca a rede — `post_tabnet`/`_fetch` são
sempre substituídos, porque esta suíte roda dentro de `npm run gate`.
"""

from pathlib import Path

import pytest

from sih_pipeline import oracle_scrape
from sih_pipeline.oracle_scrape import parse_prn_table, post_tabnet, scrape_pairs

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_parse_prn_table_com_pre_devolve_linhas_desescapadas_por_ponto_e_virgula():
    texto = (
        "<HTML><PRE>\"Munic&iacute;pio\";\"2019\"\r\n"
        "\"120040 RIO BRANCO\";1\r\n"
        "</PRE></HTML>"
    )

    linhas = parse_prn_table(texto)

    assert linhas[0] == ["Município", "2019"]
    assert linhas[1] == ["120040 RIO BRANCO", "1"]


def test_parse_prn_table_sem_pre_levanta_runtime_error():
    with pytest.raises(RuntimeError):
        parse_prn_table("<html><body>sem tabela aqui</body></html>")


def test_parse_prn_table_pre_vazio_levanta_runtime_error():
    with pytest.raises(RuntimeError):
        parse_prn_table("<html><PRE>   </PRE></html>")


def test_parse_prn_table_sobre_fixture_real_do_tabnet_roda_sem_rede():
    texto = (FIXTURES_DIR / "tabnet_prn_sample.html").read_text(encoding="latin-1")

    linhas = parse_prn_table(texto)

    assert linhas[0] == ["Município", "2018", "2019", "Total"]
    assert any(linha and linha[0].startswith("120040 RIO BRANCO") for linha in linhas[1:])


def test_post_tabnet_decodifica_latin1_preservando_acentuacao(monkeypatch):
    esperado = "Município"
    payload = f"<PRE>{esperado}</PRE>".encode("latin-1")
    monkeypatch.setattr(oracle_scrape, "_fetch", lambda request, timeout: payload)
    monkeypatch.setattr(oracle_scrape.time, "sleep", lambda segundos: None)

    texto = post_tabnet("http://exemplo.invalido", [("a", "b")])

    assert esperado in texto


def test_post_tabnet_dorme_request_delay_sec_antes_da_requisicao(monkeypatch):
    chamadas = []
    monkeypatch.setattr(
        oracle_scrape.time, "sleep", lambda segundos: chamadas.append(("dormir", segundos))
    )

    def fake_fetch(request, timeout):
        chamadas.append(("buscar", None))
        return b"<PRE>x</PRE>"

    monkeypatch.setattr(oracle_scrape, "_fetch", fake_fetch)

    post_tabnet("http://exemplo.invalido", [("a", "b")])

    assert chamadas[0] == ("dormir", oracle_scrape.REQUEST_DELAY_SEC)
    assert chamadas[1][0] == "buscar"


def test_request_delay_sec_pelo_menos_um_segundo():
    assert oracle_scrape.REQUEST_DELAY_SEC >= 1.0


def test_modulo_nao_declara_segredo_nem_le_os_environ():
    fonte = Path(oracle_scrape.__file__).read_text(encoding="utf-8")

    for termo in (
        "INGEST_SECRET",
        "os.environ",
        "cleanup_raw",
        "disease_done",
        "OUT_ROOT",
    ):
        assert termo not in fonte


def test_scrape_pairs_soma_por_uf_usando_fixture_real(monkeypatch):
    texto = (FIXTURES_DIR / "tabnet_prn_sample.html").read_text(encoding="latin-1")
    monkeypatch.setattr(oracle_scrape, "post_tabnet", lambda url, data, timeout=180: texto)

    resultado = scrape_pairs(
        [{"tabnetCode": "4", "diseaseId": "amebiase", "uf": "AC", "ano": 2019}]
    )

    assert len(resultado) == 1
    assert resultado[0]["valorTabnet"] == 2
    assert resultado[0]["diseaseId"] == "amebiase"
    assert "raspadoEm" in resultado[0]


def test_main_e_chamavel():
    assert callable(oracle_scrape.main)
