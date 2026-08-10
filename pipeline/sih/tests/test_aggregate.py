"""Prova que `aggregate.py` produz as 4 medidas x 2 graos x 2 locais numa passada so, com
casts explicitos (RESEARCH Pitfalls 1/2) e `taxa_mortalidade` derivada de `MORTE` -- DATA-01,
DATA-02, DATA-03. Roda sobre `tests/fixtures/rdac_2019.parquet` (ano inteiro AC/2019, medido:
44.589 registros, 268 KB).
"""

from __future__ import annotations

import json
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from sih_pipeline.aggregate import (
    NEEDED_COLUMNS,
    Row,
    _taxa_mortalidade,
    aggregate_parquet_dir,
)
from sih_pipeline.corrections import apply_corrections, load_corrections
from sih_pipeline.matcher import build_index, load_cid_map
from sih_pipeline.paths import repo_root

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "rdac_2019.parquet"


def _schema_v3() -> dict:
    path = repo_root() / "scripts" / "catalog" / "schema-v3.json"
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


@pytest.fixture(scope="module")
def index():
    cid_map = apply_corrections(load_cid_map(), load_corrections())
    return build_index(cid_map)


@pytest.fixture(scope="module")
def fixture_rows(index) -> list[Row]:
    return aggregate_parquet_dir(FIXTURE_PATH, index)


def test_needed_columns_contem_as_colunas_obrigatorias():
    assert set(NEEDED_COLUMNS) >= {
        "DIAG_PRINC",
        "MUNIC_MOV",
        "MUNIC_RES",
        "MORTE",
        "VAL_TOT",
        "DIAS_PERM",
        "ANO_CMPT",
        "IDENT",
    }


def test_val_tot_com_padding_soma_como_numero(fixture_rows):
    # Uma soma que virasse concatenação de string produziria um total absurdo (string longa
    # convertida por acidente) em vez de um float plausível -- a fixture tem 44.589 registros
    # com VAL_TOT sempre positivo, então o total agregado (por qualquer chave) tem que ser um
    # float finito e positivo.
    algum_com_valor = [r for r in fixture_rows if r.valor_total > 0]
    assert algum_com_valor, "nenhuma linha com valor_total > 0 -- cast provavelmente falhou"
    for row in fixture_rows:
        assert isinstance(row.valor_total, float)
        assert row.valor_total >= 0


def test_dias_perm_com_padding_soma_como_inteiro(fixture_rows):
    for row in fixture_rows:
        assert isinstance(row.dias_permanencia, int)
        assert row.dias_permanencia >= 0


def test_taxa_mortalidade_from_morte(fixture_rows):
    # Nome exato exigido por 09-VALIDATION.md. Prova taxa_mortalidade = obitos/internacoes
    # quando internacoes > 0, e a derivação pura nunca devolve 0 quando internacoes == 0.
    algum_com_obito = [r for r in fixture_rows if r.obitos > 0]
    assert algum_com_obito, "nenhuma linha com obitos > 0 -- MORTE provavelmente não foi somado"

    for row in fixture_rows:
        assert row.internacoes > 0  # nenhuma linha de saída existe sem pelo menos 1 internação
        assert row.taxa_mortalidade == pytest.approx(row.obitos / row.internacoes)

    assert _taxa_mortalidade(obitos=0, internacoes=0) is None
    assert _taxa_mortalidade(obitos=3, internacoes=10) == pytest.approx(0.3)


def test_cada_registro_contribui_para_quatro_linhas(fixture_rows):
    # AC/2019: MUNIC_MOV e MUNIC_RES quase sempre = 120040 (Rio Branco) ou outros municípios do
    # AC -- para qualquer (disease_id, ano) presente, os 4 combos (grao, local) têm que existir.
    combos_por_chave: dict[tuple, set[tuple[str, str]]] = {}
    for row in fixture_rows:
        chave = (row.disease_id, row.ano)
        combos_por_chave.setdefault(chave, set()).add((row.grao, row.local))

    esperado = {("uf", "ocorrencia"), ("uf", "residencia"), ("municipio", "ocorrencia"), ("municipio", "residencia")}
    incompletos = {k: v for k, v in combos_por_chave.items() if v != esperado}
    assert not incompletos, incompletos


def test_soma_municipio_da_uf_igual_ao_grao_uf(fixture_rows):
    # A soma de internacoes do grão município de uma UF é igual à do grão UF, para o mesmo
    # local/ano/disease -- AC inteiro está contido no código de UF "12".
    por_uf: dict[tuple, int] = {}
    por_municipio_agregado_em_uf: dict[tuple, int] = {}
    for row in fixture_rows:
        if row.grao == "uf":
            por_uf[(row.disease_id, row.local, row.territorio_codigo, row.ano)] = row.internacoes
        elif row.grao == "municipio":
            uf_codigo = row.territorio_codigo[:2]
            chave = (row.disease_id, row.local, uf_codigo, row.ano)
            por_municipio_agregado_em_uf[chave] = (
                por_municipio_agregado_em_uf.get(chave, 0) + row.internacoes
            )

    assert por_uf  # sanity: a fixture produziu pelo menos uma linha de grão uf
    for chave, total_municipio in por_municipio_agregado_em_uf.items():
        assert por_uf.get(chave) == total_municipio, chave


def test_total_ocorrencia_igual_total_residencia_brasil_inteiro(fixture_rows):
    # A fixture é só AC -- a ressalva do plano é que a igualdade vale para o TOTAL (mesmo
    # conjunto de AIHs, redistribuído por MUNIC_MOV vs MUNIC_RES), não por território
    # individual (pacientes de fora do AC também aparecem em MUNIC_RES).
    total_ocorrencia = sum(r.internacoes for r in fixture_rows if r.grao == "uf" and r.local == "ocorrencia")
    total_residencia = sum(r.internacoes for r in fixture_rows if r.grao == "uf" and r.local == "residencia")
    assert total_ocorrencia == total_residencia
    assert total_ocorrencia > 0


def test_ano_sai_de_ano_cmpt_e_e_filtrado_a_janela_schema(fixture_rows):
    schema = _schema_v3()
    for row in fixture_rows:
        assert schema["anoMin"] <= row.ano <= schema["anoMax"]
    # a fixture é inteiramente AC/2019 -- todo registro casado cai em ano=2019
    assert {row.ano for row in fixture_rows} == {2019}


def test_grao_local_e_medidas_usam_valores_do_schema_v3(fixture_rows):
    schema = _schema_v3()
    graos_vistos = {row.grao for row in fixture_rows}
    locais_vistos = {row.local for row in fixture_rows}
    assert graos_vistos <= set(schema["graos"])
    assert locais_vistos <= set(schema["locais"])
    # as 4 medidas do schema são exatamente os 4 campos numéricos do Row
    assert set(schema["medidas"]) == {
        "internacoes",
        "obitos",
        "valor_total",
        "dias_permanencia",
    }
    assert set(schema["medidas"]) <= set(Row._fields)


def test_registros_sem_categoria_sao_contados_e_acima_de_01_por_cento_levanta(index, tmp_path):
    # Fixture sintética: 3 linhas casáveis (A00) + 2 sem categoria (ZZZ9) -- 2/5 = 40% > 0,1%.
    table = pa.table(
        {
            "DIAG_PRINC": ["A00", "A00", "A00", "ZZZ9", "ZZZ9"],
            "MUNIC_MOV": ["120040"] * 5,
            "MUNIC_RES": ["120040"] * 5,
            "MORTE": ["0"] * 5,
            "VAL_TOT": ["  100.00"] * 5,
            "DIAS_PERM": ["  1"] * 5,
            "ANO_CMPT": ["2019"] * 5,
            "IDENT": ["1"] * 5,
        }
    )
    caminho = tmp_path / "descarte_alto.parquet"
    pq.write_table(table, caminho)

    with pytest.raises(ValueError):
        aggregate_parquet_dir(caminho, index)


def test_registros_sem_categoria_abaixo_do_limite_nao_levanta(index, tmp_path):
    # 1 sem categoria em 2000 = 0,05% < 0,1% -- não levanta.
    n_ok = 1999
    table = pa.table(
        {
            "DIAG_PRINC": ["A00"] * n_ok + ["ZZZ9"],
            "MUNIC_MOV": ["120040"] * (n_ok + 1),
            "MUNIC_RES": ["120040"] * (n_ok + 1),
            "MORTE": ["0"] * (n_ok + 1),
            "VAL_TOT": ["  100.00"] * (n_ok + 1),
            "DIAS_PERM": ["  1"] * (n_ok + 1),
            "ANO_CMPT": ["2019"] * (n_ok + 1),
            "IDENT": ["1"] * (n_ok + 1),
        }
    )
    caminho = tmp_path / "descarte_baixo.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    assert rows  # produziu saída normalmente


def test_ano_fora_da_janela_e_excluido(index, tmp_path):
    # ANO_CMPT=2010 está fora da janela D-11 (2013-2025, schema-v3.json anoMin/anoMax) -- a
    # linha correspondente nunca aparece na saída, mesmo tendo DIAG_PRINC casável.
    table = pa.table(
        {
            "DIAG_PRINC": ["A00", "A00"],
            "MUNIC_MOV": ["120040", "120040"],
            "MUNIC_RES": ["120040", "120040"],
            "MORTE": ["0", "0"],
            "VAL_TOT": ["  100.00", "  100.00"],
            "DIAS_PERM": ["  1", "  1"],
            "ANO_CMPT": ["2010", "2019"],
            "IDENT": ["1", "1"],
        }
    )
    caminho = tmp_path / "janela_ano.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    assert {row.ano for row in rows} == {2019}


def test_morte_tipo_inesperado_levanta_tyoe_error(index, tmp_path):
    # MORTE precisa ser string (medido ao vivo, ver Deviations no SUMMARY) ou inteiro -- outro
    # tipo (ex.: float) é uma mudança de schema do pysus que precisa falhar alto, nunca ser
    # silenciosamente interpretada.
    table = pa.table(
        {
            "DIAG_PRINC": ["A00"],
            "MUNIC_MOV": ["120040"],
            "MUNIC_RES": ["120040"],
            "MORTE": pa.array([0.0], type=pa.float64()),
            "VAL_TOT": ["  100.00"],
            "DIAS_PERM": ["  1"],
            "ANO_CMPT": ["2019"],
            "IDENT": ["1"],
        }
    )
    caminho = tmp_path / "morte_tipo_errado.parquet"
    pq.write_table(table, caminho)

    with pytest.raises(TypeError):
        aggregate_parquet_dir(caminho, index)


def test_codigo_330_sem_dado_em_ac_2019_medido(fixture_rows):
    # Medido diretamente sobre a fixture: AC/2019 não tem NENHUM registro cujo DIAG_PRINC caia
    # na faixa do código TabNet 330 (todas_as_outras_causas_externas, W20-W64/W75-W99/X10-X39/
    # X50-X59/Y10-Y89) -- 0 linhas de saída para esse disease_id é o resultado correto medido,
    # não um bug do matcher (confirmado: 0 descartes fora do 1 miss genérico A188, muito abaixo
    # do limite de 0,1%). Ver SUMMARY "Deviations" para a medição completa.
    ids_presentes = {row.disease_id for row in fixture_rows}
    assert "todas_as_outras_causas_externas" not in ids_presentes


def test_ident_diferente_de_1_e_excluido_da_contagem(index, tmp_path):
    # IDENT (tipo de AIH) marca '1' = AIH normal (nova admissão) e '5' = AIH de longa
    # permanência (renovação MENSAL de faturamento para o MESMO paciente internado, não uma
    # nova internação). Contar '5' junto com '1' infla internacoes em ordens de grandeza para
    # categorias crônicas (achado 09-08-INVESTIGACAO, 2026-08-10 -- ver
    # pipeline/sih/reports/reconciliacao-sc7.md "Investigação nova, 2026-08-10"; decisão do
    # operador 2026-08-10: contar só IDENT='1'). Fixture sintética: 2 registros IDENT='1' + 1
    # IDENT='5' (renovação) + 1 IDENT='9' (qualquer outro valor não-'1', mesmo tratamento) --
    # só os 2 primeiros contam.
    table = pa.table(
        {
            "DIAG_PRINC": ["A00"] * 4,
            "MUNIC_MOV": ["120040"] * 4,
            "MUNIC_RES": ["120040"] * 4,
            "MORTE": ["0"] * 4,
            "VAL_TOT": ["  100.00"] * 4,
            "DIAS_PERM": ["  1"] * 4,
            "ANO_CMPT": ["2019"] * 4,
            "IDENT": ["1", "1", "5", "9"],
        }
    )
    caminho = tmp_path / "ident_longa_permanencia.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    total_ocorrencia_uf = sum(r.internacoes for r in rows if r.grao == "uf" and r.local == "ocorrencia")
    assert total_ocorrencia_uf == 2


def test_ident_5_excluido_da_contagem_real_ac_2019(fixture_rows):
    # Prova sobre dado real (não sintético): AC/2019 tem exatamente 26 registros com IDENT='5'
    # entre os 44.589 do dataset inteiro, e 0 descartes de matcher nesta fixture (medido ao
    # vivo, 2026-08-10 -- ver reconciliacao-sc7.md). O total de internacoes (grão uf, local
    # ocorrência, somado sobre todas as doenças) tem que refletir só os IDENT='1':
    # 44.589 - 26 = 44.563.
    total_ocorrencia = sum(
        r.internacoes for r in fixture_rows if r.grao == "uf" and r.local == "ocorrencia"
    )
    assert total_ocorrencia == 44_563
