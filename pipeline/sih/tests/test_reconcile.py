"""Prova a reconciliação do agregado do microdado contra o oráculo TabNet re-raspado, com
razão registrada para todo desvio — nunca banda de aceitação percentual — SC-7/D-02.

Dados sintéticos pequenos (não a fixture inteira) — a fixture real é exercitada pela Task 2 e
pelo gate permanente do 09-11 (`test_reconcile_gate.py`).
"""

from __future__ import annotations

import pytest

from sih_pipeline.reconcile import compare, load_divergencias, load_oracle


def _oraculo(**over):
    entry = {
        "diseaseId": "aborto_espontaneo",
        "tabnetCode": "258",
        "uf": "AC",
        "ano": 2019,
        "medida": "internacoes",
        "valorTabnet": 100,
    }
    entry.update(over)
    return entry


def test_par_exato_quando_agregado_bate_com_tabnet():
    agregado = {("aborto_espontaneo", "AC", 2019, "internacoes"): 100}
    resultado = compare(agregado, [_oraculo()], [])

    assert resultado.ok is True
    assert len(resultado.exato) == 1
    assert resultado.exato[0].status == "exato"
    assert len(resultado.explicado) == 0
    assert len(resultado.inexplicado) == 0


def test_par_com_delta_sem_divergencia_fica_inexplicado_e_ok_falso():
    agregado = {("aborto_espontaneo", "AC", 2019, "internacoes"): 104}
    resultado = compare(agregado, [_oraculo()], [])

    assert resultado.ok is False
    assert len(resultado.inexplicado) == 1
    assert resultado.inexplicado[0].delta == 4


def test_par_com_delta_e_divergencia_fica_explicado_e_nao_derruba_ok():
    agregado = {("aborto_espontaneo", "AC", 2019, "internacoes"): 104}
    divergencias = [
        {
            "diseaseId": "aborto_espontaneo",
            "razao": "categoria absorve registros de uma faixa CID vizinha mais estreita",
        }
    ]
    resultado = compare(agregado, [_oraculo()], divergencias)

    assert resultado.ok is True
    assert len(resultado.explicado) == 1
    assert resultado.explicado[0].status == "explicado"
    assert resultado.explicado[0].razao is not None


def test_delta_pequeno_e_delta_grande_recebem_o_mesmo_tratamento():
    # D-02: um delta de ~1,2% (anemia no spike) e um de ~15% (apêndice no spike) não têm
    # tratamento diferente -- nenhum dos dois é "próximo o suficiente" para escapar da regra.
    oraculo = [
        _oraculo(diseaseId="delta_pequeno", valorTabnet=1000),
        _oraculo(diseaseId="delta_grande", valorTabnet=1000),
    ]
    agregado = {
        ("delta_pequeno", "AC", 2019, "internacoes"): 1012,  # +1,2%
        ("delta_grande", "AC", 2019, "internacoes"): 1150,  # +15%
    }
    resultado = compare(agregado, oraculo, [])

    assert resultado.ok is False
    assert {p.disease_id for p in resultado.inexplicado} == {"delta_pequeno", "delta_grande"}
    assert all(p.status == "inexplicado" for p in resultado.inexplicado)


def test_compare_acumula_todos_os_pares_antes_de_decidir():
    oraculo = [
        _oraculo(diseaseId="a", valorTabnet=10),
        _oraculo(diseaseId="b", valorTabnet=20),
        _oraculo(diseaseId="c", valorTabnet=30),
    ]
    agregado = {
        ("a", "AC", 2019, "internacoes"): 11,
        ("b", "AC", 2019, "internacoes"): 20,
        ("c", "AC", 2019, "internacoes"): 33,
    }
    resultado = compare(agregado, oraculo, [])

    # dois inexplicados (a, c) -- nunca para no primeiro achado
    assert len(resultado.inexplicado) == 2
    assert len(resultado.exato) == 1


def test_par_do_oraculo_sem_correspondente_no_agregado_fica_inexplicado():
    resultado = compare({}, [_oraculo()], [])

    assert resultado.ok is False
    assert len(resultado.inexplicado) == 1
    assert resultado.inexplicado[0].valor_agregado is None
    assert resultado.inexplicado[0].delta is None


def test_par_do_agregado_sem_correspondente_no_oraculo_vira_extra_e_nao_afeta_ok():
    agregado = {
        ("aborto_espontaneo", "AC", 2019, "internacoes"): 100,
        ("nao_esta_no_oraculo", "AC", 2019, "internacoes"): 5,
    }
    resultado = compare(agregado, [_oraculo()], [])

    assert resultado.ok is True
    assert ("nao_esta_no_oraculo", "AC", 2019, "internacoes") in resultado.extras


def test_divergencia_com_razao_curta_e_rejeitada_na_carga():
    agregado = {("aborto_espontaneo", "AC", 2019, "internacoes"): 104}
    divergencias = [{"diseaseId": "aborto_espontaneo", "razao": "curta demais"}]

    with pytest.raises(ValueError):
        compare(agregado, [_oraculo()], divergencias)


def test_render_markdown_tem_as_colunas_esperadas():
    agregado = {("aborto_espontaneo", "AC", 2019, "internacoes"): 104}
    resultado = compare(agregado, [_oraculo()], [])
    md = resultado.render_markdown()

    for coluna in ("código", "faixa antiga", "faixa nova", "delta antes", "delta depois", "razão"):
        assert coluna in md
    assert "aborto_espontaneo" in md


def test_load_oracle_le_a_fixture_real_do_09_05():
    entradas = load_oracle()

    assert len(entradas) == 98
    assert all("diseaseId" in e and "valorTabnet" in e for e in entradas)


def test_load_divergencias_devolve_lista_vazia_quando_arquivo_ausente(tmp_path):
    caminho = tmp_path / "nao-existe.json"
    assert load_divergencias(caminho) == []


def test_load_divergencias_rejeita_razao_curta(tmp_path):
    import json

    caminho = tmp_path / "cid-divergencias.json"
    caminho.write_text(
        json.dumps([{"diseaseId": "x", "razao": "muito curta"}]),
        encoding="utf-8",
    )
    with pytest.raises(ValueError):
        load_divergencias(caminho)
