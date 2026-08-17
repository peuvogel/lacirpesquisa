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


# ---------------------------------------------------------------------------
# Janela de competência do oráculo (09-16) -- consulta INGÊNUA vs BEM-FORMADA.
#
# O TabNet tabula `Coluna=Ano_atendimento`, então ele mesmo separa por ano de internação. Mas
# ele só enxerga as internações que estão nos arquivos de competência SUBMETIDOS. Submeter só as
# 12 competências do ano Y (o que este módulo fazia, e o que um aluno faz por padrão) mede
# "internações de Y faturadas em Y" -- não o ano de atendimento. As internações de dezembro/Y
# faturadas em janeiro/Y+1 ficam de fora do próprio oráculo.
# ---------------------------------------------------------------------------


def test_competence_file_names_janela_zero_e_a_consulta_ingenua_12_arquivos():
    nomes = oracle_scrape.competence_file_names(2019, janela=0)

    assert nomes == [f"nibr19{mes:02d}.dbf" for mes in range(1, 13)]
    assert len(nomes) == 12


def test_competence_file_names_janela_um_fecha_o_ano_de_atendimento_com_24_arquivos():
    nomes = oracle_scrape.competence_file_names(2019, janela=1)

    assert nomes[:12] == [f"nibr19{mes:02d}.dbf" for mes in range(1, 13)]
    assert nomes[12:] == [f"nibr20{mes:02d}.dbf" for mes in range(1, 13)]
    assert len(nomes) == 24


def test_competence_file_names_nunca_submete_arquivo_que_o_tabnet_nao_oferece():
    """A cauda do ano corrente não existe inteira: em 2026 o TabNet publica até Jun/2026. Pedir
    `nibr2607.dbf` faria o TabNet responder tabela vazia -- que `parse_prn_table` trata como
    FALHA (correto), derrubando a medição inteira por um arquivo que ainda não foi publicado."""
    disponiveis = {f"nibr25{mes:02d}.dbf" for mes in range(1, 13)}
    disponiveis |= {f"nibr26{mes:02d}.dbf" for mes in range(1, 7)}

    nomes = oracle_scrape.competence_file_names(2025, janela=1, disponiveis=disponiveis)

    assert len(nomes) == 18
    assert "nibr2607.dbf" not in nomes
    assert "nibr2606.dbf" in nomes


def test_parse_arquivos_disponiveis_le_as_options_do_def():
    html = (
        '<SELECT NAME="Arquivos" ID="A" SIZE=4 MULTIPLE>\n'
        '<OPTION VALUE="nibr2606.dbf" SELECTED >Jun/2026\n'
        '<OPTION VALUE="nibr2605.dbf">Mai/2026\n'
        '<OPTION VALUE="nibr1901.dbf">Jan/2019\n'
        "</SELECT>"
    )

    assert oracle_scrape.parse_arquivos_disponiveis(html) == {
        "nibr2606.dbf",
        "nibr2605.dbf",
        "nibr1901.dbf",
    }


def test_scrape_pairs_default_continua_ingenuo_para_nao_mover_a_fixture_congelada(monkeypatch):
    """O default NÃO pode mudar: `oracle_ac_2019.json` foi raspado com a consulta ingênua e o
    gate SC-7 compara contra ela. Mudar o default silenciosamente reescreveria o significado de
    uma fixture congelada sem ninguém pedir."""
    submetidos: list[list[tuple[str, str]]] = []

    def fake_post(url, data, timeout=180):
        submetidos.append(data)
        return (FIXTURES_DIR / "tabnet_prn_sample.html").read_text(encoding="latin-1")

    monkeypatch.setattr(oracle_scrape, "post_tabnet", fake_post)

    scrape_pairs([{"tabnetCode": "4", "diseaseId": "amebiase", "uf": "AC", "ano": 2019}])

    arquivos = [v for k, v in submetidos[0] if k == "Arquivos"]
    assert len(arquivos) == 12


def test_scrape_pairs_repete_quando_o_tabnet_devolve_o_formulario_em_vez_da_tabela(monkeypatch):
    """Medido ao vivo em 2026-08-17: o TabNet devolve, de forma intermitente, a própria página do
    `.def` (44 KB, sem tabela) em vez do resultado — e a MESMA requisição, repetida, funciona.
    Numa corrida de centenas de pares isso é certeza estatística de falha, e derrubar a medição
    inteira por um hiccup de rede seria perder ~20 min de raspagem por nada."""
    chamadas = {"n": 0}
    texto_bom = (FIXTURES_DIR / "tabnet_prn_sample.html").read_text(encoding="latin-1")

    def fake_post(url, data, timeout=180):
        chamadas["n"] += 1
        if chamadas["n"] < 3:
            return "<html><body>formulário do .def, sem tabela</body></html>"
        return texto_bom

    monkeypatch.setattr(oracle_scrape, "post_tabnet", fake_post)
    monkeypatch.setattr(oracle_scrape.time, "sleep", lambda s: None)

    resultado = scrape_pairs(
        [{"tabnetCode": "4", "diseaseId": "amebiase", "uf": "AC", "ano": 2019}]
    )

    assert chamadas["n"] == 3
    assert resultado[0]["valorTabnet"] == 2


def test_scrape_pairs_desiste_depois_do_limite_e_nao_inventa_zero(monkeypatch):
    """Esgotadas as tentativas, a falha SOBE. Devolver 0 seria fabricar um dado de oráculo —
    a classe de erro mais cara possível aqui."""
    monkeypatch.setattr(
        oracle_scrape, "post_tabnet", lambda url, data, timeout=180: "<html>sem tabela</html>"
    )
    monkeypatch.setattr(oracle_scrape.time, "sleep", lambda s: None)

    with pytest.raises(RuntimeError):
        scrape_pairs([{"tabnetCode": "4", "diseaseId": "amebiase", "uf": "AC", "ano": 2019}])


def test_scrape_pairs_com_janela_um_submete_as_competencias_do_ano_seguinte(monkeypatch):
    submetidos: list[list[tuple[str, str]]] = []

    def fake_post(url, data, timeout=180):
        submetidos.append(data)
        return (FIXTURES_DIR / "tabnet_prn_sample.html").read_text(encoding="latin-1")

    monkeypatch.setattr(oracle_scrape, "post_tabnet", fake_post)

    resultado = scrape_pairs(
        [{"tabnetCode": "4", "diseaseId": "amebiase", "uf": "AC", "ano": 2019}], janela=1
    )

    arquivos = [v for k, v in submetidos[0] if k == "Arquivos"]
    assert len(arquivos) == 24
    assert "nibr2001.dbf" in arquivos
    # a janela usada fica registrada NA SAÍDA -- um número de oráculo sem a janela que o produziu
    # é exatamente o tipo de dado que causou o resíduo fantasma do SC-7.
    assert resultado[0]["janelaCompetencia"] == 1
