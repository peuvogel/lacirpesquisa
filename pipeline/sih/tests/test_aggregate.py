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
    # ocorrência, somado sobre TODAS as disease_id) tem que refletir só os IDENT='1'. Antes desta
    # plan (só o eixo CID): 44.589 - 26 = 44.563. Esta plan soma um SEGUNDO eixo independente
    # (amputacao_mmii via PROC_REA, ver aggregate.py) -- um mesmo registro pode contribuir para
    # os dois eixos, então a soma CRESCE (não se sobrepõe): 44.563 (CID, preservado em
    # test_cid_nao_muda_com_adicao_do_procedimento_regressao) + 50 (amputacao_mmii, medido em
    # test_amputacao_mmii_contagem_real_ac_2019_medida) = 44.613.
    total_ocorrencia = sum(
        r.internacoes for r in fixture_rows if r.grao == "uf" and r.local == "ocorrencia"
    )
    assert total_ocorrencia == 44_613


# --- Agregação por PROCEDIMENTO (amputacao_mmii, filterKind="procedimento") -----------------
#
# amputacao_mmii é o único agravo de scripts/catalog/extra-diseases.json (Fase 8) fora da Lista
# Morb CID-10 que match_category cobre -- vem de sih/cnv/qibr.def, casado por PROC_REA (código
# SIGTAP), não por DIAG_PRINC. Ver aggregate.py (docstring da constante
# `_PROC_REA_AMPUTACAO_MMII`) para a medição completa que estabeleceu "0408050012" como o código
# certo -- fonte autoritativa (TabNet ecoa o rótulo) + medição empírica (reconciliação contra
# AC/2019 real), nunca suposição.

_PROC_REA_AMPUTACAO = "0408050012"
# Código SIGTAP real observado em AC/2019 (não é amputação) -- usado como "fora do conjunto".
_PROC_REA_OUTRO = "0303010126"


def _tabela_com_proc_rea(*, diag_princ, proc_rea, ident):
    n = len(diag_princ)
    assert len(proc_rea) == n and len(ident) == n
    return pa.table(
        {
            "DIAG_PRINC": diag_princ,
            "MUNIC_MOV": ["120040"] * n,
            "MUNIC_RES": ["120040"] * n,
            "MORTE": ["0"] * n,
            "VAL_TOT": ["  100.00"] * n,
            "DIAS_PERM": ["  1"] * n,
            "ANO_CMPT": ["2019"] * n,
            "IDENT": ident,
            "PROC_REA": proc_rea,
        }
    )


def test_proc_rea_no_conjunto_conta_amputacao_mmii(index, tmp_path):
    # Um registro com PROC_REA == 0408050012 e IDENT='1' produz linha para
    # disease_id="amputacao_mmii" -- DIAG_PRINC="A00" (cólera, casa a categoria CID "1") é usado
    # de propósito em vez de um código sem categoria: um DIAG_PRINC sem match dispararia o gate
    # de taxa de descarte (T-09-30, 100% de miss numa amostra de 1) por um motivo TOTALMENTE
    # alheio a este teste. O ponto aqui é que os dois eixos de match (CID/DIAG_PRINC,
    # procedimento/PROC_REA) são independentes -- o registro casa CID E procedimento, e ambos
    # produzem linha própria (ver test_proc_rea_independente_do_match_cid_no_mesmo_registro).
    table = _tabela_com_proc_rea(diag_princ=["A00"], proc_rea=[_PROC_REA_AMPUTACAO], ident=["1"])
    caminho = tmp_path / "proc_rea_no_conjunto.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    amputacao = [r for r in rows if r.disease_id == "amputacao_mmii"]
    assert amputacao, "nenhuma linha amputacao_mmii produzida"
    total = sum(r.internacoes for r in amputacao if r.grao == "uf" and r.local == "ocorrencia")
    assert total == 1


def test_proc_rea_fora_do_conjunto_nao_conta(index, tmp_path):
    # Um PROC_REA que não é o código SIGTAP de amputação nunca produz linha amputacao_mmii.
    # DIAG_PRINC="A00" pelo mesmo motivo do teste acima (evita o gate de descarte, alheio aqui).
    table = _tabela_com_proc_rea(diag_princ=["A00"], proc_rea=[_PROC_REA_OUTRO], ident=["1"])
    caminho = tmp_path / "proc_rea_fora.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    assert not [r for r in rows if r.disease_id == "amputacao_mmii"]


def test_proc_rea_ident_5_excluido_da_contagem(index, tmp_path):
    # IDENT='5' (renovação de longa permanência) é excluído no caminho de procedimento
    # EXATAMENTE como no caminho CID (mesmo `continue` no laço, aplicado antes de qualquer
    # classificação) -- 2 registros com o mesmo PROC_REA casável, só 1 com IDENT='1'. DIAG_PRINC
    # sempre "A00" pelo mesmo motivo dos testes acima (evita o gate de descarte).
    table = _tabela_com_proc_rea(
        diag_princ=["A00", "A00"],
        proc_rea=[_PROC_REA_AMPUTACAO, _PROC_REA_AMPUTACAO],
        ident=["1", "5"],
    )
    caminho = tmp_path / "proc_rea_ident5.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    total = sum(
        r.internacoes
        for r in rows
        if r.disease_id == "amputacao_mmii" and r.grao == "uf" and r.local == "ocorrencia"
    )
    assert total == 1


def test_proc_rea_produz_os_dois_locais(index, tmp_path):
    # Mesmo requisito do caminho CID (test_cada_registro_contribui_para_quatro_linhas): um
    # registro casado produz os 4 combos (grão, local) -- ocorrência E residência, UF E
    # município. DIAG_PRINC="A00" pelo mesmo motivo dos testes acima.
    table = _tabela_com_proc_rea(diag_princ=["A00"], proc_rea=[_PROC_REA_AMPUTACAO], ident=["1"])
    caminho = tmp_path / "proc_rea_locais.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    amputacao = [r for r in rows if r.disease_id == "amputacao_mmii"]
    combos = {(r.grao, r.local) for r in amputacao}
    esperado = {
        ("uf", "ocorrencia"),
        ("uf", "residencia"),
        ("municipio", "ocorrencia"),
        ("municipio", "residencia"),
    }
    assert combos == esperado


def test_proc_rea_independente_do_match_cid_no_mesmo_registro(index, tmp_path):
    # Um registro pode casar CID (A00, cólera -- categoria "1") E procedimento (amputação)
    # simultaneamente -- ex.: paciente internado por uma causa cujo DIAG_PRINC é A00, mas cujo
    # PROC_REA registrado é uma amputação. Os dois eixos NUNCA são mutuamente exclusivos (D-01:
    # agregação é de graça, cada agravo é um teste de pertencimento independente).
    table = _tabela_com_proc_rea(diag_princ=["A00"], proc_rea=[_PROC_REA_AMPUTACAO], ident=["1"])
    caminho = tmp_path / "proc_rea_e_cid.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    ids_presentes = {r.disease_id for r in rows}
    assert "amputacao_mmii" in ids_presentes
    assert len(ids_presentes) == 2  # amputacao_mmii + a categoria CID de A00


def test_proc_rea_nao_isenta_descarte_cid(index, tmp_path):
    # Descarte mede SÓ falha de match do DIAG_PRINC contra a Lista Morb CID-10 -- um DIAG_PRINC
    # sem categoria (ZZZ9) continua contando como descarte mesmo quando o PROC_REA do MESMO
    # registro casa amputacao_mmii (os dois eixos são independentes, nunca um isenta o outro).
    # Mesma fixture de test_registros_sem_categoria_sao_contados_e_acima_de_01_por_cento_levanta
    # (3 casáveis + 2 sem categoria = 40% > 0,1%), agora com os 2 ZZZ9 casando procedimento -- se
    # o descarte fosse (incorretamente) isento por match de procedimento, esta chamada NÃO
    # levantaria.
    table = _tabela_com_proc_rea(
        diag_princ=["A00", "A00", "A00", "ZZZ9", "ZZZ9"],
        proc_rea=[_PROC_REA_OUTRO, _PROC_REA_OUTRO, _PROC_REA_OUTRO, _PROC_REA_AMPUTACAO, _PROC_REA_AMPUTACAO],
        ident=["1"] * 5,
    )
    caminho = tmp_path / "proc_rea_descarte_alto.parquet"
    pq.write_table(table, caminho)

    with pytest.raises(ValueError):
        aggregate_parquet_dir(caminho, index)


def test_amputacao_mmii_presente_apos_reconstrucao_do_procedimento(fixture_rows):
    # AC/2019 real (12 arquivos RDAC1901..RDAC1912): amputacao_mmii deixa de ser o único agravo
    # sem dado em sih_metric_uf (09-10-SUMMARY.md, "órfão... filterKind=procedimento") -- passa a
    # ter linhas reais assim que PROC_REA é casado.
    ids_presentes = {row.disease_id for row in fixture_rows}
    assert "amputacao_mmii" in ids_presentes


def test_amputacao_mmii_contagem_real_ac_2019_medida(fixture_rows):
    # Medido ao vivo, 2026-08-12: PROC_REA=="0408050012" AND IDENT='1' AND ANO_CMPT=2019 no
    # dataset real de AC/2019 (44.589 registros) dá EXATAMENTE 50 internações. O oráculo TabNet
    # (Ano_atendimento=2019, coluna por DT_INTER) mede 66 -- a divergência é reconciliada por
    # competência de processamento (o MESMO mecanismo ANO_CMPT vs DT_INTER já documentado em todo
    # o SC-7): medido que 45/50 destes registros têm DT_INTER em 2019 e que só os 2 primeiros
    # meses de 2020 (RDAC2001+RDAC2002) já somam 20 registros adicionais com PROC_REA casado,
    # IDENT='1' e DT_INTER=2019 -- 45+20=65, a 1 unidade do oráculo. Ver o SUMMARY desta plan
    # para o relato completo. Este teste protege o número MEDIDO sobre a fixture congelada, não o
    # oráculo (D-02: nunca tunar para bater).
    amputacao_uf_ocorrencia = [
        r
        for r in fixture_rows
        if r.disease_id == "amputacao_mmii" and r.grao == "uf" and r.local == "ocorrencia"
    ]
    total = sum(r.internacoes for r in amputacao_uf_ocorrencia)
    assert total == 50


def test_cid_nao_muda_com_adicao_do_procedimento_regressao(fixture_rows):
    # Regressão: o total de internações agregado por TODAS as categorias CID (excluindo
    # amputacao_mmii, o eixo novo e independente) continua EXATAMENTE 44.563 -- o mesmo número
    # medido pelo fix de IDENT (09-07) antes de qualquer trabalho de procedimento. Prova que
    # adicionar o eixo de procedimento não move nem um registro do caminho CID existente.
    total_cid_ocorrencia = sum(
        r.internacoes
        for r in fixture_rows
        if r.disease_id != "amputacao_mmii" and r.grao == "uf" and r.local == "ocorrencia"
    )
    assert total_cid_ocorrencia == 44_563
