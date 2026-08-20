"""Prova que `aggregate.py` produz as 4 medidas x 2 graos x 2 locais numa passada so, com
casts explicitos (RESEARCH Pitfalls 1/2) e `taxa_mortalidade` derivada de `MORTE` -- DATA-01,
DATA-02, DATA-03. Roda sobre `tests/fixtures/rdac_2019.parquet` (ano inteiro AC/2019, medido:
44.589 registros, 268 KB).
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq
import pytest

from sih_pipeline.aggregate import (
    NEEDED_COLUMNS,
    Row,
    _ano_de_dt_inter,
    _MAX_TAXA_DESCARTE_DT_INTER,
    _MAX_TAXA_DESCARTE_MUNICIPIO,
    _taxa_mortalidade,
    aggregate_parquet_dir,
)
from sih_pipeline.corrections import apply_corrections, load_corrections
from sih_pipeline.matcher import build_index, load_cid_map, match_category
from sih_pipeline.paths import repo_root

# AC, COMPETÊNCIA 2019 inteira (RDAC1901..RDAC1912, 44.589 registros) -- a mesma fixture de
# sempre, regenerada em 09-15-DT-INTER para incluir DT_INTER. Continua sendo um recorte por
# COMPETÊNCIA, e é exatamente por isso que ela é a fixture certa para o gate SC-7: o oráculo
# (`oracle_scrape.py`) submete ao TabNet só os 12 arquivos `nibr19MM.dbf` da competência 2019 e
# lê a coluna `Ano_atendimento` -- ou seja, mede "internações de 2019 que foram faturadas na
# competência 2019", que é precisamente a população desta fixture no ano 2019. Ver
# test_reconcile_gate.py para a medição que estabeleceu isso.
FIXTURE_PATH = Path(__file__).parent / "fixtures" / "rdac_2019.parquet"
# AC, competências 2019 E 2020 (RDAC1901..RDAC2012, 87.816 registros) -- a fixture que permite
# montar um ano de ADMISSÃO completo, que nenhum recorte de competência única consegue: 2019 só
# fecha quando a cauda faturada em 2020 entra na conta. É sobre ela que roda a prova de
# reconciliação de `amputacao_mmii` contra o oráculo `qibr.def` (que, ao contrário do oráculo
# CID, submete os 156 arquivos dos 13 anos -- ver test_amputacao_mmii_ano_de_admissao_2019...).
FIXTURE_ADMISSAO_PATH = Path(__file__).parent / "fixtures" / "rdac_admissao_2019.parquet"
# DF real, competência 2017-08 (RDDF1708.parquet, projetado a NEEDED_COLUMNS), 2.292 registros
# -- reproduz ao vivo o crash "Failed to parse string: '' as a scalar of type double" relatado
# na recoleta nacional (09-04-FIX-AGREGACAO-VAZIO). Contém 46 registros com TODOS os campos
# vazios (IDENT='', ANO_CMPT='' -- lixo/registro corrompido do DBC) e continua abaixo do limite
# de descarte T-09-30 (0,0436% medido) -- ver SUMMARY desta correção para a medição completa.
FIXTURE_DF_VAZIO_PATH = Path(__file__).parent / "fixtures" / "rddf_1708_vazio.parquet"
# PR real, competência 2020-04 inteira (RDPR2004.parquet, projetado a NEEDED_COLUMNS+UF_ZI),
# 25.493 registros -- arquivo COMPLETO (não uma janela) para que a taxa de descarte de
# município medida sobre esta fixture reflita a mesma escala usada por
# _MAX_TAXA_DESCARTE_MUNICIPIO (denominador = total de registros do arquivo, ver docstring de
# aggregate.py). Contém o único registro real que quebrou a recoleta nacional em PR
# (`municipio6: comprimento inválido (esperado 6 ou 7 dígitos): ''`, `MUNIC_MOV=''`, última
# linha do arquivo original, DIAG_PRINC='O021', IDENT='1', ANO_CMPT=2020, MUNIC_RES='410120'
# válido, UF_ZI='410000' válido) -- ver 09-04-FIX-MUNICIPIO-BRANCO-SUMMARY.md para a medição
# completa.
FIXTURE_PR_MUNICIPIO_VAZIO_PATH = Path(__file__).parent / "fixtures" / "rdpr_2004_municipio_vazio.parquet"


def _com_dt_inter_derivado(fixture_path: Path, destino: Path) -> Path:
    """Devolve uma cópia de `fixture_path` com a coluna `DT_INTER` acrescentada, derivada de
    `ANO_CMPT`.

    **Por que esta função existe, e por que a alternativa honesta não estava disponível**
    (09-15-DT-INTER, 2026-08-17). As duas fixtures que passam por aqui
    (`rddf_1708_vazio.parquet`, `rdpr_2004_municipio_vazio.parquet`) são bytes REAIS de arquivos
    que quebraram a recoleta nacional em produção — são a evidência arquivada de duas classes de
    defeito (registro corrompido do DBC com todos os campos vazios; `MUNIC_MOV` em branco). Elas
    foram gravadas ANTES de `DT_INTER` entrar em `NEEDED_COLUMNS`, então não têm a coluna.

    O caminho óbvio seria regerá-las do arquivo original, como foi feito com `rdac_2019.parquet`.
    **Medido em 2026-08-17: não dá mais.** `RDDF1708` e `RDPR2004` foram RE-PUBLICADOS pelo
    DATASUS desde 2026-08-12 — os arquivos que o FTP serve hoje têm contagem diferente (16.292 em
    vez de 2.292 na fatia arquivada; 56.146 em vez de 25.493) e, sobretudo, **zero** dos defeitos
    que estas fixtures capturam (0 registros com `IDENT` vazio, 0 com `MUNIC_MOV` inválido, 0 com
    `VAL_TOT` vazio). Regerar destruiria a única cópia sobrevivente da evidência.

    Então a fixture no disco fica INTOCADA (bytes reais, nunca reescritos) e a coluna que falta é
    derivada aqui, à vista, no código de teste — nunca gravada dentro do binário, onde viraria
    "dado real" indistinguível do resto. A derivação é fiel ao que cada registro é: `ANO_CMPT`
    preenchido vira uma data plausível daquele ano; `ANO_CMPT` vazio (a classe "registro
    corrompido do DBC", em que TODOS os campos vêm vazios juntos, `IDENT` inclusive) vira
    `DT_INTER` vazio, que é o que esses registros de fato tinham.

    Nenhum dos dois testes que usam estas fixtures mede `DT_INTER` — eles medem as guardas de
    valor vazio e de município. A coluna derivada existe só para o arquivo continuar carregável.
    """
    tabela = pq.read_table(fixture_path)
    ano_cmpt = pc.utf8_trim_whitespace(tabela["ANO_CMPT"]).to_pylist()
    dt_inter = [f"{a}0315" if a and a.isdigit() and len(a) == 4 else "" for a in ano_cmpt]
    tabela = tabela.append_column("DT_INTER", pa.array(dt_inter, type=pa.string()))
    pq.write_table(tabela, destino)
    return destino


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


@pytest.fixture(scope="module")
def fixture_admissao_rows(index) -> list[Row]:
    return aggregate_parquet_dir(FIXTURE_ADMISSAO_PATH, index)


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
        "PROC_REA",
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


def test_ano_sai_de_dt_inter_e_e_filtrado_a_janela_schema(fixture_rows):
    schema = _schema_v3()
    for row in fixture_rows:
        assert schema["anoMin"] <= row.ano <= schema["anoMax"]
    # A fixture é a COMPETÊNCIA 2019 inteira do AC -- e produz DOIS anos de internação, não um.
    # É a prova mais direta de que o ano vem de DT_INTER e não do arquivo: 3.493 registros
    # IDENT='1' desses mesmos 12 arquivos são internações de 2018 faturadas em 2019 (7,84% da
    # competência). Sob ANO_CMPT eles apareciam como 2019, contra o denominador populacional
    # errado.
    assert {row.ano for row in fixture_rows} == {2018, 2019}


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
            "DT_INTER": ["20190315"] * 5,
            "IDENT": ["1"] * 5,
            "PROC_REA": ["0000000000"] * 5,
            "UF_ZI": ["120040"] * 5,
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
            "DT_INTER": ["20190315"] * (n_ok + 1),
            "IDENT": ["1"] * (n_ok + 1),
            "PROC_REA": ["0000000000"] * (n_ok + 1),
            "UF_ZI": ["120040"] * (n_ok + 1),
        }
    )
    caminho = tmp_path / "descarte_baixo.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    assert rows  # produziu saída normalmente


def test_ano_fora_da_janela_e_excluido(index, tmp_path):
    # Uma internação de 2010 está fora da janela D-11 (2013-2025, schema-v3.json anoMin/anoMax)
    # -- a linha correspondente nunca aparece na saída, mesmo tendo DIAG_PRINC casável.
    table = pa.table(
        {
            "DIAG_PRINC": ["A00", "A00"],
            "MUNIC_MOV": ["120040", "120040"],
            "MUNIC_RES": ["120040", "120040"],
            "MORTE": ["0", "0"],
            "VAL_TOT": ["  100.00", "  100.00"],
            "DIAS_PERM": ["  1", "  1"],
            "ANO_CMPT": ["2010", "2019"],
            "DT_INTER": ["20100315", "20190315"],
            "IDENT": ["1", "1"],
            "PROC_REA": ["0000000000", "0000000000"],
            "UF_ZI": ["120040", "120040"],
        }
    )
    caminho = tmp_path / "janela_ano.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    assert {row.ano for row in rows} == {2019}


# --- 09-15-DT-INTER: o ano vem da DATA DE INTERNAÇÃO, não da competência de faturamento -------
#
# Ver aggregate.py (docstring do módulo) para o motivo epidemiológico e para a medição de
# defasagem que fundamenta a janela de coleta em enumerate.py.


def _tabela_datas(*, ano_cmpt, dt_inter, ident=None, diag_princ=None):
    n = len(dt_inter)
    assert len(ano_cmpt) == n
    return pa.table(
        {
            "DIAG_PRINC": diag_princ or ["A00"] * n,
            "MUNIC_MOV": ["120040"] * n,
            "MUNIC_RES": ["120040"] * n,
            "MORTE": ["0"] * n,
            "VAL_TOT": ["  100.00"] * n,
            "DIAS_PERM": ["  1"] * n,
            "ANO_CMPT": ano_cmpt,
            "DT_INTER": dt_inter,
            "IDENT": ident or ["1"] * n,
            "PROC_REA": ["0000000000"] * n,
            "UF_ZI": ["120040"] * n,
        }
    )


def test_ano_sai_de_dt_inter_e_nao_de_ano_cmpt(index, tmp_path):
    # O teste central desta correção: competência (ANO_CMPT) e internação (DT_INTER) discordam de
    # propósito. A internação aconteceu em 2019; a AIH só foi faturada na competência de 2020.
    # O ano da linha agregada tem que ser 2019 -- se fosse 2020, a contagem de 2019 estaria
    # sendo comparada contra o denominador populacional do ano errado (ver docstring do módulo).
    table = _tabela_datas(ano_cmpt=["2020"], dt_inter=["20191228"])
    caminho = tmp_path / "ano_de_dt_inter.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    assert {row.ano for row in rows} == {2019}


def test_registro_da_competencia_seguinte_conta_no_ano_da_internacao(index, tmp_path):
    # Reproduz a estrutura real medida: uma internação de dezembro/2019 aparece no arquivo de
    # competência 2020-01 (58,70% dos registros de RDAC2501 são internações do ano anterior --
    # janeiro é o mês de defasagem máxima). Dois ARQUIVOS distintos no mesmo diretório, como a
    # agregação real recebe: os dois registros de DT_INTER 2019 têm que somar no MESMO ano, ainda
    # que venham de anos de competência diferentes.
    dir_ufs = tmp_path / "uf"
    dir_ufs.mkdir()
    pq.write_table(
        _tabela_datas(ano_cmpt=["2019"], dt_inter=["20190610"]),
        dir_ufs / "RDXX1906.parquet",
    )
    pq.write_table(
        _tabela_datas(ano_cmpt=["2020", "2020"], dt_inter=["20191228", "20200104"]),
        dir_ufs / "RDXX2001.parquet",
    )

    rows = aggregate_parquet_dir(dir_ufs, index)
    por_ano = {
        r.ano: r.internacoes for r in rows if r.grao == "uf" and r.local == "ocorrencia"
    }
    assert por_ano == {2019: 2, 2020: 1}


def test_dt_inter_malformado_e_descartado_contado_e_guardado_por_taxa(index, tmp_path):
    # DT_INTER ausente/malformado em AIH REAL (IDENT='1') é perda de informação: a internação
    # existiu mas o pipeline não sabe localizá-la no tempo. Nunca some em silêncio -- é contado
    # e, acima de _MAX_TAXA_DESCARTE_DT_INTER (0,1% da população IDENT='1'), levanta. Aqui:
    # 2 descartes em 4 = 50%.
    table = _tabela_datas(
        ano_cmpt=["2019"] * 4,
        dt_inter=["20190315", "", "2019031", "2019ab15"],
    )
    caminho = tmp_path / "dt_inter_ruim_alto.parquet"
    pq.write_table(table, caminho)

    with pytest.raises(ValueError, match="DT_INTER"):
        aggregate_parquet_dir(caminho, index)


def test_dt_inter_malformado_abaixo_do_limite_e_contado_sem_levantar(index, tmp_path):
    # 1 malformado em 2.000 = 0,05% < 0,1% -- não levanta, mas o descarte continua CONTADO e
    # visível em `stats` (é o que a corrida nacional persiste por UF no CollectLedger). Uma
    # guarda que não registrasse o que tolerou seria um catch-and-ignore com outro nome.
    n_ok = 1999
    table = _tabela_datas(
        ano_cmpt=["2019"] * (n_ok + 1),
        dt_inter=["20190315"] * n_ok + ["00000000"],
    )
    caminho = tmp_path / "dt_inter_ruim_baixo.parquet"
    pq.write_table(table, caminho)

    stats: dict = {}
    rows = aggregate_parquet_dir(caminho, index, stats=stats)
    assert rows
    assert stats["descartes_dt_inter"] == 1
    assert stats["total_ident_1"] == n_ok + 1


def test_dt_inter_fora_da_janela_nunca_conta_como_descarte(index, tmp_path):
    # Distinção que a guarda depende para funcionar: uma internação de 2026 (nos arquivos de
    # competência de cauda, que são feitos majoritariamente dela) é dado SAUDÁVEL fora do
    # recorte, não defeito. Se contasse como descarte, a guarda estouraria em toda UF por dado
    # perfeitamente bom -- e deixaria de pegar o defeito que existe para pegar.
    table = _tabela_datas(
        ano_cmpt=["2026"] * 10,
        dt_inter=["20260115"] * 9 + ["20251228"],
    )
    caminho = tmp_path / "dt_inter_fora_janela.parquet"
    pq.write_table(table, caminho)

    stats: dict = {}
    rows = aggregate_parquet_dir(caminho, index, stats=stats)
    assert stats["fora_da_janela"] == 9
    assert stats["descartes_dt_inter"] == 0
    assert {r.ano for r in rows} == {2025}


def test_dt_inter_com_dia_impossivel_conta_pelo_ano_em_vez_de_ser_descartado(index, tmp_path):
    # 30 de fevereiro não existe no calendário, mas o ANO de '20250230' é inequivocamente 2025 --
    # e o ano é a única coisa que a agregação extrai. Recusar o registro jogaria fora uma
    # internação REAL por um erro de digitação num campo que nem é usado. Semântica explícita e
    # documentada em _ano_de_dt_inter, nunca um acidente.
    assert _ano_de_dt_inter("20250230") == 2025
    # o que NÃO passa: mês/dia fora de intervalo, comprimento errado, não numérico, ano
    # estruturalmente implausível (lixo que por acaso tem 8 dígitos)
    assert _ano_de_dt_inter("20251301") is None
    assert _ano_de_dt_inter("20250100") is None
    assert _ano_de_dt_inter("00000000") is None
    assert _ano_de_dt_inter("99999999") is None
    assert _ano_de_dt_inter("") is None
    assert _ano_de_dt_inter(None) is None
    assert _ano_de_dt_inter("  20190315  ") == 2019


def test_stats_mede_a_defasagem_de_competencia_da_propria_passada(index, tmp_path):
    # A defasagem deixa de ser suposição e passa a ser medida a cada corrida: `lag` é o
    # histograma de (ANO_CMPT - ano(DT_INTER)). É isso que permite verificar, com o dado da
    # corrida, se a cauda de competência escolhida em enumerate.py continua suficiente.
    table = _tabela_datas(
        ano_cmpt=["2019", "2020", "2020", "2021"],
        dt_inter=["20190610", "20191228", "20200104", "20191115"],
    )
    caminho = tmp_path / "stats_lag.parquet"
    pq.write_table(table, caminho)

    stats: dict = {}
    aggregate_parquet_dir(caminho, index, stats=stats)
    assert stats["lag"] == {"0": 2, "1": 1, "2": 1}
    assert stats["total"] == 4
    assert stats["total_ident_1"] == 4


def test_ident_5_continua_excluido_com_o_ano_vindo_de_dt_inter(index, tmp_path):
    # Regressão do achado 09-08-INVESTIGACAO/09-07-IDENT-FIX (53b7323): renovação de AIH de longa
    # permanência é faturamento continuado da MESMA internação, não uma nova admissão. A troca de
    # ANO_CMPT por DT_INTER não pode reabrir isso -- e o filtro de IDENT agora roda ANTES da
    # leitura de data, então precisa continuar valendo para os DOIS eixos de classificação.
    table = _tabela_datas(
        ano_cmpt=["2020"] * 4,
        dt_inter=["20191228"] * 4,
        ident=["1", "1", "5", "9"],
    )
    caminho = tmp_path / "ident_com_dt_inter.parquet"
    pq.write_table(table, caminho)

    stats: dict = {}
    rows = aggregate_parquet_dir(caminho, index, stats=stats)
    total = sum(r.internacoes for r in rows if r.grao == "uf" and r.local == "ocorrencia")
    assert total == 2
    assert stats["total_ident_1"] == 2  # IDENT != '1' nunca entra no denominador da guarda
    assert stats["total"] == 4


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
            "DT_INTER": ["20190315"],
            "IDENT": ["1"],
            "PROC_REA": ["0000000000"],
            "UF_ZI": ["120040"],
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
            "DT_INTER": ["20190315"] * 4,
            "IDENT": ["1", "1", "5", "9"],
            "PROC_REA": ["0000000000"] * 4,
            "UF_ZI": ["120040"] * 4,
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
            "DT_INTER": ["20190315"] * n,
            "IDENT": ident,
            "PROC_REA": proc_rea,
            "UF_ZI": ["120040"] * n,
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


# --- Correção 09-04-FIX-AGREGACAO-VAZIO: VAL_TOT/DIAS_PERM/MORTE/ANO_CMPT vazios -------------
#
# Regressão medida na recoleta nacional (DF e RR falharam com "Failed to parse string: '' as a
# scalar of type double" -- `~/.lacir/sih-cache/agregados/collect_state.json`). Verificado
# contra dado real (não assumido): a mesma versão de `aggregate_parquet_dir` de ANTES do eixo de
# procedimento (9f8545c) já quebrava sobre o mesmo arquivo real (`RDDF1708.parquet`) -- não é
# regressão do eixo PROC_REA, é um cast eager (`pc.cast(..., "float64"/"int64")` sobre a coluna
# inteira, ANTES do filtro por registro) que nunca tratou string vazia. Ver docstring do módulo
# (`aggregate.py`, seção "Correção de valor numérico vazio") para a medição completa e a decisão
# de semântica por medida.


def test_val_tot_vazio_real_df_nao_quebra_a_agregacao_da_uf(tmp_path):
    # Prova de ponta a ponta sobre dado REAL (não sintético) -- reproduz o crash relatado antes
    # da correção (RED) e prova que ele desaparece depois (GREEN), sem trocar o gate de descarte
    # por um coerce cego: os 46 registros com todos os campos vazios (IDENT='') continuam sendo
    # excluídos pelo filtro de IDENT, nunca contados nem como internação nem como descarte.
    # `DT_INTER` é derivado de ANO_CMPT na carga -- ver `_com_dt_inter_derivado` para por que a
    # fixture não pode ser regerada (o DATASUS republicou RDDF1708 limpo).
    cid_map = apply_corrections(load_cid_map(), load_corrections())
    index = build_index(cid_map)
    caminho = _com_dt_inter_derivado(FIXTURE_DF_VAZIO_PATH, tmp_path / "df_vazio.parquet")
    stats: dict = {}
    rows = aggregate_parquet_dir(caminho, index, stats=stats)
    assert rows, "aggregate_parquet_dir nao produziu nenhuma linha para RDDF1708.parquet"
    # Os 46 registros corrompidos nunca chegam à leitura de data: o filtro de IDENT roda antes.
    # É isso que mantém `descartes_dt_inter` medindo só AIH real sem data utilizável.
    assert stats["total"] == 2292
    assert stats["total_ident_1"] == 2292 - 46
    assert stats["descartes_dt_inter"] == 0


def _tabela_valor_vazio(
    *, val_tot, dias_perm, morte, diag_princ=None, ident=None, ano_cmpt=None, dt_inter=None
):
    n = len(val_tot)
    diag_princ = diag_princ or ["A00"] * n
    ident = ident or ["1"] * n
    ano_cmpt = ano_cmpt or ["2019"] * n
    dt_inter = dt_inter or ["20190315"] * n
    return pa.table(
        {
            "DIAG_PRINC": diag_princ,
            "MUNIC_MOV": ["120040"] * n,
            "MUNIC_RES": ["120040"] * n,
            "MORTE": morte,
            "VAL_TOT": val_tot,
            "DIAS_PERM": dias_perm,
            "ANO_CMPT": ano_cmpt,
            "DT_INTER": dt_inter,
            "IDENT": ident,
            "PROC_REA": ["0000000000"] * n,
            "UF_ZI": ["120040"] * n,
        }
    )


def test_val_tot_vazio_conta_internacao_mas_nao_soma_valor_desconhecido(index, tmp_path):
    # AIH real (IDENT='1', ANO_CMPT na janela) pode ter VAL_TOT vazio -- medido ao vivo em
    # RR/RDRR1811.parquet, RR/RDRR1907.parquet, RR/RDRR2208.parquet (a internação existiu, só o
    # campo de faturamento não foi preenchido). AUSÊNCIA NÃO É ZERO -- mas uma SOMA corrente não
    # tem representação de "parcialmente desconhecido": a linha soma só a contribuição CONHECIDA
    # (50,00 do 1º registro + 0,0 do 2º), a internação ainda CONTA (internacoes=2), e
    # valor_total fica SUBESTIMADO (nunca inflado com um zero fabricado que pareça "sabido").
    table = _tabela_valor_vazio(
        val_tot=["  50.00", ""],
        dias_perm=["  1", "  1"],
        morte=["0", "0"],
    )
    caminho = tmp_path / "val_tot_vazio.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    linha = next(r for r in rows if r.grao == "uf" and r.local == "ocorrencia")
    assert linha.internacoes == 2
    assert linha.valor_total == pytest.approx(50.0)


def test_dias_perm_vazio_conta_internacao_mas_nao_soma_dias_desconhecidos(index, tmp_path):
    # Mesma semântica de VAL_TOT: DIAS_PERM vazio contribui 0 para a soma corrente, a internação
    # continua contando.
    table = _tabela_valor_vazio(
        val_tot=["  50.00", "  50.00"],
        dias_perm=["  3", ""],
        morte=["0", "0"],
    )
    caminho = tmp_path / "dias_perm_vazio.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    linha = next(r for r in rows if r.grao == "uf" and r.local == "ocorrencia")
    assert linha.internacoes == 2
    assert linha.dias_permanencia == 3


def test_morte_vazio_conta_internacao_mas_nao_conta_como_obito(index, tmp_path):
    # MORTE vazio NUNCA é tratado como óbito -- inventar uma morte sem nenhuma evidência no
    # dado-fonte inflaria taxa_mortalidade sem base real, o erro mais grave possível para uma
    # medida pública de saúde. A internação continua contando (o AIH existiu, IDENT='1').
    table = _tabela_valor_vazio(
        val_tot=["  50.00", "  50.00"],
        dias_perm=["  1", "  1"],
        morte=["1", ""],
    )
    caminho = tmp_path / "morte_vazio.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    linha = next(r for r in rows if r.grao == "uf" and r.local == "ocorrencia")
    assert linha.internacoes == 2
    assert linha.obitos == 1  # só o registro com MORTE='1' conta -- o vazio não vira óbito
    assert linha.taxa_mortalidade == pytest.approx(0.5)


def test_registro_corrompido_do_dbc_tudo_vazio_continua_excluido_sem_quebrar(index, tmp_path):
    # A classe "registro corrompido do DBC" medida em DF/RDDF1708.parquet (46 de 2.292 linhas com
    # TODOS os campos vazios juntos -- IDENT, ANO_CMPT, DT_INTER, DIAG_PRINC, MUNIC_*) continua
    # excluída pelo filtro de IDENT, que roda ANTES de qualquer leitura de data. O cast eager de
    # ANO_CMPT (que download._valida_registros_alinhados replica por arquivo) continua sem
    # quebrar sobre o vazio, via _blank_to_null.
    table = _tabela_valor_vazio(
        val_tot=["  50.00", ""],
        dias_perm=["  1", ""],
        morte=["0", ""],
        ano_cmpt=["2019", ""],
        dt_inter=["20190315", ""],
        ident=["1", ""],
    )
    caminho = tmp_path / "registro_corrompido.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    linha = next(r for r in rows if r.grao == "uf" and r.local == "ocorrencia")
    assert linha.internacoes == 1  # só a AIH real conta; a linha corrompida nunca chega à data


def test_ano_cmpt_vazio_nao_derruba_aih_real_com_dt_inter_valido(index, tmp_path):
    # MUDANÇA DE COMPORTAMENTO deliberada de 09-15-DT-INTER, registrada aqui em vez de escondida:
    # antes, ANO_CMPT vazio excluía o registro (era ele quem dava o ano). Agora o ano vem de
    # DT_INTER, então uma AIH REAL (IDENT='1', DT_INTER válido) cuja competência veio em branco
    # CONTA -- a internação aconteceu e sabemos exatamente quando. Descartá-la seria perder um
    # evento clínico por causa de um campo administrativo ausente.
    table = _tabela_valor_vazio(
        val_tot=["  50.00", "  50.00"],
        dias_perm=["  1", "  1"],
        morte=["0", "0"],
        ano_cmpt=["2019", ""],
        dt_inter=["20190315", "20190720"],
    )
    caminho = tmp_path / "ano_cmpt_vazio_dt_inter_ok.parquet"
    pq.write_table(table, caminho)

    stats: dict = {}
    rows = aggregate_parquet_dir(caminho, index, stats=stats)
    linha = next(r for r in rows if r.grao == "uf" and r.local == "ocorrencia")
    assert linha.internacoes == 2
    assert linha.ano == 2019
    # o registro sem ANO_CMPT simplesmente não entra no histograma de defasagem (não há
    # competência com que comparar) -- nunca é inventado um lag 0 para ele
    assert stats["lag"] == {"0": 1}
    assert stats["descartes_dt_inter"] == 0


def test_valor_nao_vazio_e_nao_numerico_continua_estourando(index, tmp_path):
    # A correção só troca STRING VAZIA por null -- NUNCA um coerce cego (pedido explícito da
    # correção). Um VAL_TOT não vazio mas genuinamente não numérico (corrupção real de dado,
    # nunca medida em IDENT='1' de DF/RR -- ver SUMMARY) continua estourando ArrowInvalid, exatamente
    # como antes desta correção.
    table = _tabela_valor_vazio(
        val_tot=["  50.00", "lixo-nao-numerico"],
        dias_perm=["  1", "  1"],
        morte=["0", "0"],
    )
    caminho = tmp_path / "val_tot_corrompido.parquet"
    pq.write_table(table, caminho)

    with pytest.raises(pa.lib.ArrowInvalid):
        aggregate_parquet_dir(caminho, index)


def test_saida_congelada_byte_a_byte(fixture_rows):
    # Trava byte a byte a saída inteira sobre a fixture real, para que nenhuma mudança futura
    # desloque um número sem que alguém decida deslocá-lo.
    #
    # ATUALIZADO em 09-15-DT-INTER (2026-08-17): o hash MUDOU, e mudar era o objetivo. A chave
    # `ano` de cada linha passou a vir de DT_INTER; os mesmos 44.563 registros IDENT='1' desta
    # competência agora se repartem em 2018 (3.493) e 2019 (41.070) em vez de irem todos para
    # 2019. O número de linhas cresce de 5.551 para 7.213 pela mesma razão: cada (agravo, grão,
    # local, território) que tem registro nos dois anos passa a ocupar duas linhas.
    #
    # O que NÃO mudou, e é o que prova que a correção não mexeu em nada além da atribuição no
    # tempo: o total de internações agregado continua exatamente 44.613 (44.563 CID + 50
    # amputacao_mmii) -- ver test_ident_5_excluido_da_contagem_real_ac_2019. Nenhum registro
    # entrou, nenhum saiu; só foram para o ano certo.
    linhas_canonicas = sorted(
        (
            r.disease_id,
            r.grao,
            r.local,
            r.territorio_codigo,
            r.ano,
            r.internacoes,
            r.obitos,
            round(r.valor_total, 6),
            r.dias_permanencia,
            None if r.taxa_mortalidade is None else round(r.taxa_mortalidade, 10),
        )
        for r in fixture_rows
    )
    payload = json.dumps(linhas_canonicas, sort_keys=False).encode("utf-8")
    digest = hashlib.sha256(payload).hexdigest()
    assert len(fixture_rows) == 7_213  # medido sobre a fixture regerada -- ver comentário acima
    assert digest == "0c9f8ffeca3a90861563141ff1071ef0d7345f19358887c0bc281eee74b8a49f"


def test_amputacao_mmii_presente_apos_reconstrucao_do_procedimento(fixture_rows):
    # AC/2019 real (12 arquivos RDAC1901..RDAC1912): amputacao_mmii deixa de ser o único agravo
    # sem dado em sih_metric_uf (09-10-SUMMARY.md, "órfão... filterKind=procedimento") -- passa a
    # ter linhas reais assim que PROC_REA é casado.
    ids_presentes = {row.disease_id for row in fixture_rows}
    assert "amputacao_mmii" in ids_presentes


def test_amputacao_mmii_contagem_real_ac_2019_medida(fixture_rows):
    # Sobre a fixture de COMPETÊNCIA 2019 (12 arquivos): os mesmos 50 registros de sempre
    # (PROC_REA=="0408050012" AND IDENT='1'), agora repartidos pelo ano em que a internação
    # ACONTECEU -- 45 em 2019 e 5 em 2018. O total 50 não muda (é o mesmo conjunto de registros);
    # o que muda é a atribuição no tempo, que era justamente o defeito.
    amputacao = [
        r
        for r in fixture_rows
        if r.disease_id == "amputacao_mmii" and r.grao == "uf" and r.local == "ocorrencia"
    ]
    por_ano = {r.ano: r.internacoes for r in amputacao}
    assert por_ano == {2018: 5, 2019: 45}
    assert sum(por_ano.values()) == 50


def test_amputacao_mmii_ano_de_admissao_2019_fecha_exato_com_o_oraculo_qibr(
    fixture_admissao_rows,
):
    # A PROVA da correção 09-15-DT-INTER contra dado real e oráculo externo independente.
    #
    # O oráculo aqui NÃO é o do gate CID: é `trabalhos datasus/scripts/coleta_vascular_amputacao.py`
    # (`sih/cnv/qibr.def`, Coluna=Ano_atendimento), que submete ao TabNet os 156 arquivos dos 13
    # anos -- portanto mede o ano de ADMISSÃO COMPLETO. Ele reporta 66 internações para AC/2019
    # (valor re-confirmado ao vivo em 2026-08-12, byte a byte igual ao scrape de 2026-06-17).
    #
    # Medições, todas sobre este MESMO código, mudando só a chave de ano:
    #   - por ANO_CMPT (produção até esta correção) ......... 50  → -24,2% contra o oráculo
    #   - por DT_INTER, só a competência 2019 ............... 45  → -31,8%
    #   - por DT_INTER, competências 2019 + 2020 (aqui) ..... 66  → EXATO
    #
    # Zero ajuste de código, zero tuning: a única mudança é a chave de ano e a inclusão da
    # competência seguinte na leitura. É o que prova que a defasagem de faturamento cruza o
    # arquivo e que a janela de coleta de enumerate.py precisa da cauda.
    amputacao = {
        r.ano: r.internacoes
        for r in fixture_admissao_rows
        if r.disease_id == "amputacao_mmii" and r.grao == "uf" and r.local == "ocorrencia"
    }
    assert amputacao[2019] == 66


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


# --- Correção 09-04-FIX-MUNICIPIO-BRANCO: MUNIC_MOV/MUNIC_RES em branco ou malformado --------
#
# Regressão medida na recoleta nacional: PR falhou a agregação da UF INTEIRA com
# "municipio6: comprimento inválido (esperado 6 ou 7 dígitos): ''" -- risco lateral já previsto
# (e deliberadamente não corrigido, por estar fora do file_scope daquela correção) pelo SUMMARY
# de 09-04-FIX-AGREGACAO-VAZIO: "se uma futura UF tiver um registro... E MUNIC_MOV/MUNIC_RES
# vazio ou malformado, a agregação dessa UF quebraria". Medido nacionalmente contra as 27 UFs em
# cache (`~/.lacir/sih-cache/parquet/`, ~86 milhões de registros brutos, 11 UFs falhas): dos
# 82.091.610 registros que alcançam este ponto do laço (IDENT='1', ano válido, alguma doença
# casada -- a MESMA população da taxa de descarte de DIAG_PRINC), só 8 têm MUNIC_MOV ou
# MUNIC_RES em branco/malformado (0,00001%) -- dado real esparso, não corrupção sistemática (o
# raw scan sem esses filtros mostra clusters de até ~90% de um ÚNICO arquivo/mês, mas esses
# registros têm IDENT/DIAG_PRINC TAMBÉM corrompidos juntos -- já excluídos antes de alcançar
# este ponto, mesma classe "registro corrompido do DBC" já documentada em
# 09-04-FIX-AGREGACAO-VAZIO). Decisão de semântica por grão, medida e não suposta:
#
# - Grão MUNICÍPIO nunca é recuperável quando o próprio campo (MUNIC_MOV ou MUNIC_RES) vem em
#   branco/malformado -- não há como inferir qual dos milhares de municípios seria o certo.
# - Grão UF de OCORRÊNCIA (MUNIC_MOV) PODE ser recuperado via UF_ZI -- campo oficial e ESTÁVEL
#   do SIH-RD para a UF do estabelecimento, medido idêntico a MUNIC_MOV[:2] em TODO registro
#   válido da amostra nacional (100% de concordância). Nos 8 registros reais afetados, MUNIC_RES
#   sempre veio válido e UF_ZI sempre veio válido -- o único campo problemático era MUNIC_MOV.
# - Grão UF de RESIDÊNCIA (MUNIC_RES) NÃO tem fallback -- o SIH-RD não publica um campo
#   equivalente a UF_ZI para a UF de residência do paciente (UF_ZI é documentadamente a UF do
#   ESTABELECIMENTO, não do paciente); usá-lo aqui juntaria endereço do hospital com residência
#   do paciente, um erro de atribuição pior que o descarte.
#
# Ver `codigos.py` (`municipio6_ou_none`) e `aggregate.py` (`_territorio_ocorrencia`,
# `_territorio_residencia`, `_MAX_TAXA_DESCARTE_MUNICIPIO`) para a implementação, e
# 09-04-FIX-MUNICIPIO-BRANCO-SUMMARY.md para a medição completa.


def test_limiar_de_descarte_de_municipio_e_mais_apertado_que_o_de_diag_princ():
    # município em branco é medida como ~10.000x mais raro que DIAG_PRINC sem categoria (ver
    # bloco de medição acima) -- o limiar precisa refletir essa raridade, nunca reusar
    # _MAX_TAXA_DESCARTE (0,1%) por conveniência, o que toleraria uma corrupção MUITO maior
    # antes de falhar alto.
    from sih_pipeline.aggregate import _MAX_TAXA_DESCARTE

    assert 0 < _MAX_TAXA_DESCARTE_MUNICIPIO < _MAX_TAXA_DESCARTE


# As 4 semânticas abaixo (mov vazio, mov malformado, res vazio, mov+uf_zi vazios) usam 1
# registro problemático "afogado" em N registros bons -- não 1 registro isolado -- porque
# _MAX_TAXA_DESCARTE_MUNICIPIO (0,01%) é calibrado para a escala real de produção (uma UF
# inteira, milhões de registros: aggregate_parquet_dir é sempre chamada por UF completa via
# `aggregate_years`, nunca por arquivo/mês isolado -- ver `collect.py::_aggregate_uf`). Um
# parquet sintético de 1 linha com 1 registro ruim mediria 100% de descarte e estouraria o
# próprio gate que este módulo introduz -- N=20.000 mede 1/20.000=0,005%, abaixo do limiar,
# preservando o isolamento do comportamento POR REGISTRO que estes testes verificam.
_N_PADDING = 20_000


def test_municipio_mov_vazio_e_excluido_do_grao_municipio_mas_uf_e_resgatada_via_uf_zi(index, tmp_path):
    n = _N_PADDING
    table = pa.table(
        {
            "DIAG_PRINC": ["A00"] * n,
            "MUNIC_MOV": [""] + ["120040"] * (n - 1),
            "MUNIC_RES": ["120040"] * n,
            "MORTE": ["0"] * n,
            "VAL_TOT": ["  100.00"] * n,
            "DIAS_PERM": ["  1"] * n,
            "ANO_CMPT": ["2019"] * n,
            "DT_INTER": ["20190315"] * n,
            "IDENT": ["1"] * n,
            "PROC_REA": ["0000000000"] * n,
            "UF_ZI": ["120000"] * n,
        }
    )
    caminho = tmp_path / "mov_vazio.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    uf_ocorrencia = next(r for r in rows if r.grao == "uf" and r.local == "ocorrencia")
    municipio_ocorrencia = next(r for r in rows if r.grao == "municipio" and r.local == "ocorrencia")
    uf_residencia = next(r for r in rows if r.grao == "uf" and r.local == "residencia")
    municipio_residencia = next(r for r in rows if r.grao == "municipio" and r.local == "residencia")

    assert uf_ocorrencia.territorio_codigo == "12"  # de UF_ZI="120000" -- AC
    assert uf_ocorrencia.internacoes == n  # o registro com MUNIC_MOV vazio é resgatado aqui
    assert municipio_ocorrencia.internacoes == n - 1  # mas fica de fora do grão município
    assert uf_residencia.internacoes == n  # residência intacta -- MUNIC_RES sempre válido aqui
    assert municipio_residencia.internacoes == n


def test_municipio_mov_malformado_recebe_o_mesmo_tratamento_do_vazio(index, tmp_path):
    # Classe distinta de branco: comprimento certo (6), caractere não numérico -- medido ao vivo
    # em MUNIC_MOV real de PR/2020 ('01510.', '     8', '51059.'). Mesmo tratamento do vazio.
    n = _N_PADDING
    table = pa.table(
        {
            "DIAG_PRINC": ["A00"] * n,
            "MUNIC_MOV": ["01510."] + ["120040"] * (n - 1),
            "MUNIC_RES": ["120040"] * n,
            "MORTE": ["0"] * n,
            "VAL_TOT": ["  100.00"] * n,
            "DIAS_PERM": ["  1"] * n,
            "ANO_CMPT": ["2019"] * n,
            "DT_INTER": ["20190315"] * n,
            "IDENT": ["1"] * n,
            "PROC_REA": ["0000000000"] * n,
            "UF_ZI": ["120000"] * n,
        }
    )
    caminho = tmp_path / "mov_malformado.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    uf_ocorrencia = next(r for r in rows if r.grao == "uf" and r.local == "ocorrencia")
    municipio_ocorrencia = next(r for r in rows if r.grao == "municipio" and r.local == "ocorrencia")
    assert uf_ocorrencia.internacoes == n  # resgatado via UF_ZI, igual ao caso vazio
    assert municipio_ocorrencia.internacoes == n - 1


def test_municipio_res_vazio_exclui_os_dois_graos_de_residencia_sem_fallback(index, tmp_path):
    # MUNIC_RES não tem campo equivalente a UF_ZI no SIH-RD -- em branco/malformado, os DOIS
    # grãos de residência ficam indisponíveis (nunca um fallback inventado); ocorrência intacta.
    # O contraste com o teste acima (uf_ocorrencia continua = n quando é MUNIC_MOV que falha,
    # mas uf_residencia cai para n-1 quando é MUNIC_RES que falha) é o que prova a assimetria.
    n = _N_PADDING
    table = pa.table(
        {
            "DIAG_PRINC": ["A00"] * n,
            "MUNIC_MOV": ["120040"] * n,
            "MUNIC_RES": [""] + ["120040"] * (n - 1),
            "MORTE": ["0"] * n,
            "VAL_TOT": ["  100.00"] * n,
            "DIAS_PERM": ["  1"] * n,
            "ANO_CMPT": ["2019"] * n,
            "DT_INTER": ["20190315"] * n,
            "IDENT": ["1"] * n,
            "PROC_REA": ["0000000000"] * n,
            "UF_ZI": ["120040"] * n,
        }
    )
    caminho = tmp_path / "res_vazio.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    uf_ocorrencia = next(r for r in rows if r.grao == "uf" and r.local == "ocorrencia")
    municipio_ocorrencia = next(r for r in rows if r.grao == "municipio" and r.local == "ocorrencia")
    uf_residencia = next(r for r in rows if r.grao == "uf" and r.local == "residencia")
    municipio_residencia = next(r for r in rows if r.grao == "municipio" and r.local == "residencia")

    assert uf_ocorrencia.internacoes == n
    assert municipio_ocorrencia.internacoes == n
    assert uf_residencia.internacoes == n - 1  # SEM fallback -- some dos DOIS graos de residência
    assert municipio_residencia.internacoes == n - 1


def test_uf_zi_tambem_invalido_exclui_todo_o_eixo_ocorrencia(index, tmp_path):
    # MUNIC_MOV E UF_ZI inválidos no mesmo registro -- não sobra nenhum campo confiável para
    # localizar a ocorrência. Os DOIS grãos de ocorrência ficam ausentes, nunca uma UF inventada.
    n = _N_PADDING
    table = pa.table(
        {
            "DIAG_PRINC": ["A00"] * n,
            "MUNIC_MOV": [""] + ["120040"] * (n - 1),
            "MUNIC_RES": ["120040"] * n,
            "MORTE": ["0"] * n,
            "VAL_TOT": ["  100.00"] * n,
            "DIAS_PERM": ["  1"] * n,
            "ANO_CMPT": ["2019"] * n,
            "DT_INTER": ["20190315"] * n,
            "IDENT": ["1"] * n,
            "PROC_REA": ["0000000000"] * n,
            "UF_ZI": [""] + ["120040"] * (n - 1),  # também vazio no mesmo registro -- sem resgate
        }
    )
    caminho = tmp_path / "mov_e_uf_zi_vazios.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    uf_ocorrencia = next(r for r in rows if r.grao == "uf" and r.local == "ocorrencia")
    municipio_ocorrencia = next(r for r in rows if r.grao == "municipio" and r.local == "ocorrencia")
    uf_residencia = next(r for r in rows if r.grao == "uf" and r.local == "residencia")
    municipio_residencia = next(r for r in rows if r.grao == "municipio" and r.local == "residencia")

    assert uf_ocorrencia.internacoes == n - 1  # sem UF_ZI válido, o grão UF também fica sem resgate
    assert municipio_ocorrencia.internacoes == n - 1
    assert uf_residencia.internacoes == n  # residência intacta -- MUNIC_RES sempre válido aqui
    assert municipio_residencia.internacoes == n


def test_uf_zi_nunca_sobrepoe_municipio_mov_valido(index, tmp_path):
    # UF_ZI é só um fallback -- quando MUNIC_MOV é válido, o grão UF de ocorrência sai de
    # uf_de_municipio(MUNIC_MOV), exatamente como antes desta correção, mesmo que UF_ZI (que não
    # deveria divergir na prática) aponte para outra UF -- nunca uma preferência silenciosa pelo
    # campo errado.
    table = pa.table(
        {
            "DIAG_PRINC": ["A00"],
            "MUNIC_MOV": ["120040"],  # AC
            "MUNIC_RES": ["120040"],
            "MORTE": ["0"],
            "VAL_TOT": ["  100.00"],
            "DIAS_PERM": ["  1"],
            "ANO_CMPT": ["2019"],
            "DT_INTER": ["20190315"],
            "IDENT": ["1"],
            "PROC_REA": ["0000000000"],
            "UF_ZI": ["350000"],  # SP -- propositalmente divergente
        }
    )
    caminho = tmp_path / "uf_zi_divergente.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    uf_ocorrencia = next(r for r in rows if r.grao == "uf" and r.local == "ocorrencia")
    assert uf_ocorrencia.territorio_codigo == "12"  # de MUNIC_MOV -- nunca "35" de UF_ZI


def test_taxa_descarte_municipio_acima_do_limite_levanta(index, tmp_path):
    # _MAX_TAXA_DESCARTE_MUNICIPIO é muito mais apertado que o de DIAG_PRINC -- município em
    # branco é uma classe de defeito ~10.000x mais rara (medida nacionalmente, ver acima).
    # 2 registros com MUNIC_MOV e UF_ZI ambos vazios (sem resgate) em 1000 = 0,2% > limiar.
    n = 1000
    n_ruim = 2
    table = pa.table(
        {
            "DIAG_PRINC": ["A00"] * n,
            "MUNIC_MOV": [""] * n_ruim + ["120040"] * (n - n_ruim),
            "MUNIC_RES": ["120040"] * n,
            "MORTE": ["0"] * n,
            "VAL_TOT": ["  100.00"] * n,
            "DIAS_PERM": ["  1"] * n,
            "ANO_CMPT": ["2019"] * n,
            "DT_INTER": ["20190315"] * n,
            "IDENT": ["1"] * n,
            "PROC_REA": ["0000000000"] * n,
            "UF_ZI": [""] * n_ruim + ["120040"] * (n - n_ruim),
        }
    )
    caminho = tmp_path / "descarte_municipio_alto.parquet"
    pq.write_table(table, caminho)

    with pytest.raises(ValueError):
        aggregate_parquet_dir(caminho, index)


def test_taxa_descarte_municipio_abaixo_do_limite_nao_levanta(index, tmp_path):
    # 1 registro com MUNIC_MOV vazio em 100.000 = 0,001% < 0,01% -- não levanta; a UF inteira
    # continua agregando normalmente, com o registro problemático descartado só do grão
    # município de ocorrência (mesma disciplina de _MAX_TAXA_DESCARTE para DIAG_PRINC, T-09-30).
    n = 100_000
    table = pa.table(
        {
            "DIAG_PRINC": ["A00"] * n,
            "MUNIC_MOV": [""] + ["120040"] * (n - 1),
            "MUNIC_RES": ["120040"] * n,
            "MORTE": ["0"] * n,
            "VAL_TOT": ["  100.00"] * n,
            "DIAS_PERM": ["  1"] * n,
            "ANO_CMPT": ["2019"] * n,
            "DT_INTER": ["20190315"] * n,
            "IDENT": ["1"] * n,
            "PROC_REA": ["0000000000"] * n,
            "UF_ZI": ["120000"] * n,
        }
    )
    caminho = tmp_path / "descarte_municipio_baixo.parquet"
    pq.write_table(table, caminho)

    rows = aggregate_parquet_dir(caminho, index)
    uf_ocorrencia = next(r for r in rows if r.grao == "uf" and r.local == "ocorrencia")
    municipio_ocorrencia = next(r for r in rows if r.grao == "municipio" and r.local == "ocorrencia")
    assert uf_ocorrencia.internacoes == n  # todos os n contam no grão UF (resgatados via UF_ZI)
    assert municipio_ocorrencia.internacoes == n - 1  # 1 ausente do grão município


def test_municipio_vazio_real_pr_nao_quebra_a_agregacao_da_uf(tmp_path):
    # Prova de ponta a ponta sobre dado REAL (não sintético) -- reproduz ao vivo o crash relatado
    # na recoleta nacional de PR ("municipio6: comprimento inválido (esperado 6 ou 7 dígitos):
    # ''") e prova que ele desaparece depois da correção, sem desativar o gate de taxa de
    # descarte (1/25.493 = 0,00392% < 0,01%, medido). Contagem independente sobre a fixture (via
    # match_category, sem depender dos contadores internos de aggregate_parquet_dir): medido
    # diretamente que, dos 279 registros do arquivo que casam a categoria 260 (DIAG_PRINC
    # 'O008'/'O021', "outras_gravidezes_que_terminam_em_aborto") com IDENT='1' e ANO_CMPT=2020,
    # exatamente 1 (a última linha do arquivo) tem MUNIC_MOV inválido -- e todos os 279 têm
    # MUNIC_RES válido. `DT_INTER` derivado de ANO_CMPT na carga (ver `_com_dt_inter_derivado`),
    # o que mantém os 279 no MESMO ano e portanto preserva exatamente esta medição.
    cid_map = apply_corrections(load_cid_map(), load_corrections())
    index = build_index(cid_map)
    caminho = _com_dt_inter_derivado(
        FIXTURE_PR_MUNICIPIO_VAZIO_PATH, tmp_path / "pr_municipio_vazio.parquet"
    )
    rows = aggregate_parquet_dir(caminho, index)
    assert rows, "aggregate_parquet_dir nao produziu nenhuma linha para RDPR2004.parquet"

    table = pq.read_table(FIXTURE_PR_MUNICIPIO_VAZIO_PATH)
    diag_princ = table["DIAG_PRINC"].to_pylist()
    ident = table["IDENT"].to_pylist()
    ano_cmpt = table["ANO_CMPT"].to_pylist()
    munic_mov = table["MUNIC_MOV"].to_pylist()

    def _mov_valido(v):
        return v is not None and len(str(v).strip()) in (6, 7) and str(v).strip().isdigit()

    casaveis = [
        i
        for i in range(table.num_rows)
        if ident[i] == "1"
        and str(ano_cmpt[i]).strip() == "2020"
        and match_category(diag_princ[i], index) == "260"
    ]
    n_total = len(casaveis)
    n_mov_valido = sum(1 for i in casaveis if _mov_valido(munic_mov[i]))
    assert n_total == 279
    assert n_total - n_mov_valido == 1  # só o registro conhecido (última linha) tem MUNIC_MOV ruim

    disease_id = "outras_gravidezes_que_terminam_em_aborto"
    municipio_ocorrencia = sum(
        r.internacoes
        for r in rows
        if r.disease_id == disease_id and r.grao == "municipio" and r.local == "ocorrencia"
    )
    uf_ocorrencia = sum(
        r.internacoes
        for r in rows
        if r.disease_id == disease_id and r.grao == "uf" and r.local == "ocorrencia"
    )
    municipio_residencia = sum(
        r.internacoes
        for r in rows
        if r.disease_id == disease_id and r.grao == "municipio" and r.local == "residencia"
    )

    assert municipio_ocorrencia == n_mov_valido  # o registro com MUNIC_MOV vazio fica de fora
    assert uf_ocorrencia == n_total  # mas a UF é resgatada via UF_ZI -- ninguém some do grão UF
    assert municipio_residencia == n_total  # MUNIC_RES sempre válido nesta amostra -- ninguém some

    territorios_uf_ocorrencia = {
        r.territorio_codigo
        for r in rows
        if r.disease_id == disease_id and r.grao == "uf" and r.local == "ocorrencia"
    }
    assert "41" in territorios_uf_ocorrencia  # PR -- onde o registro resgatado via UF_ZI cai
