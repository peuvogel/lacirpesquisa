"""Prova a geração das partições JSON colunares por UF (gzip) para o Storage — D-20/D-21.

Roda sobre `tests/fixtures/rdac_2019.parquet` (mesma fixture real de AC/2019 do 09-07/09-08) --
nenhum teste desta suíte toca a rede (`upload_partition`/`_fetch` são isolados e substituídos por
monkeypatch, mesmo padrão de `test_oracle_scrape.py`).
"""

from __future__ import annotations

import gzip
import json
from pathlib import Path

import pytest

from sih_pipeline.aggregate import Row, aggregate_parquet_dir
from sih_pipeline.corrections import apply_corrections, load_corrections
from sih_pipeline.matcher import build_index, load_cid_map
from sih_pipeline.partitions import (
    BUCKET,
    COLUNAS_METRICA,
    PARTITION_PREFIX,
    _linhas_municipio_por_uf,
    _object_key,
    build_partition,
    cid_map_version,
    main,
    upload_partition,
    write_partition,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "rdac_2019.parquet"


@pytest.fixture(scope="module")
def index():
    cid_map = apply_corrections(load_cid_map(), load_corrections())
    return build_index(cid_map)


@pytest.fixture(scope="module")
def fixture_rows(index) -> list[Row]:
    return aggregate_parquet_dir(FIXTURE_PATH, index)


@pytest.fixture(scope="module")
def grupos_por_uf(fixture_rows) -> dict[str, list[Row]]:
    return _linhas_municipio_por_uf(fixture_rows)


@pytest.fixture(scope="module")
def ac_municipio_rows(grupos_por_uf) -> list[Row]:
    # Agrupado por UF de fato: MUNIC_RES de um paciente internado no AC pode apontar para outra
    # UF (D-09, residência do paciente != local de internação) -- "grão município" sozinho não
    # basta para "só do AC" (achado real desta plan, ver Deviations do SUMMARY).
    linhas = grupos_por_uf["AC"]
    assert linhas, "fixture sem nenhuma linha de grão município do AC -- fixture quebrada"
    return linhas


def test_build_partition_arrays_paralelos_mesmo_comprimento(ac_municipio_rows):
    payload = build_partition("AC", ac_municipio_rows)
    n = len(ac_municipio_rows)
    assert len(payload["dados"]) == len(payload["colunas"])
    for coluna_lista in payload["dados"]:
        assert len(coluna_lista) == n


def test_build_partition_ordem_de_colunas_fixa(ac_municipio_rows):
    payload = build_partition("AC", ac_municipio_rows)
    assert payload["colunas"] == list(COLUNAS_METRICA)
    assert payload["schema"] == 1


def test_build_partition_so_grao_municipio_e_so_a_uf_pedida(ac_municipio_rows):
    # Injeta uma linha de grão UF -- deve ser rejeitada, nunca silenciosamente incluída.
    linha_uf = Row(
        disease_id="x",
        grao="uf",
        local="ocorrencia",
        territorio_codigo="12",
        ano=2019,
        internacoes=1,
        obitos=0,
        valor_total=1.0,
        dias_permanencia=1,
        taxa_mortalidade=None,
    )
    with pytest.raises(ValueError, match="grão"):
        build_partition("AC", [*ac_municipio_rows, linha_uf])

    # Injeta uma linha de outra UF (município de SP, prefixo "35") -- deve ser rejeitada.
    linha_sp = ac_municipio_rows[0]._replace(territorio_codigo="355030")
    with pytest.raises(ValueError, match="UF"):
        build_partition("AC", [*ac_municipio_rows, linha_sp])


def test_build_partition_dois_locais_na_mesma_particao(ac_municipio_rows):
    payload = build_partition("AC", ac_municipio_rows)
    idx_local = payload["colunas"].index("local")
    locais_presentes = set(payload["dados"][idx_local])
    assert locais_presentes == {"ocorrencia", "residencia"}


def test_build_partition_taxa_mortalidade_ausente_e_null_nunca_zero(ac_municipio_rows):
    # Numa linha REAL agregada (Row só existe quando internacoes >= 1), taxa_mortalidade nunca é
    # None -- é sempre um float (ver _taxa_mortalidade em aggregate.py). O contrato de
    # build_partition (nunca coagir ausência para 0) é sobre o valor que Row carrega, não sobre
    # produzir ausência sozinho -- provado com uma Row sintética de internacoes=0/obitos=0.
    linha_sem_internacao = ac_municipio_rows[0]._replace(
        internacoes=0, obitos=0, taxa_mortalidade=None
    )
    payload = build_partition("AC", [linha_sem_internacao])
    idx_taxa = payload["colunas"].index("taxa_mortalidade")
    assert payload["dados"][idx_taxa] == [None]
    assert payload["dados"][idx_taxa] != [0]


def test_build_partition_uf_sem_linha_levanta():
    with pytest.raises(ValueError, match="sem nenhuma linha"):
        build_partition("AC", [])


def test_build_partition_derived_at_e_cid_map_version_presentes(ac_municipio_rows):
    payload = build_partition("AC", ac_municipio_rows)
    assert payload["derivedAt"].endswith("Z")
    assert len(payload["derivedAt"]) == 20  # 2026-08-10T12:00:00Z
    assert payload["cidMapVersion"] == cid_map_version()
    assert len(payload["cidMapVersion"]) == 64  # sha256 hexdigest


def test_build_partition_familia_default_e_metrica(ac_municipio_rows):
    # Provado mesmo quando a decisão do 09-06 é `popsvs-no-banco` -- o parâmetro existe e o
    # default produz exatamente o mesmo resultado de uma chamada sem `familia`.
    com_default = build_partition("AC", ac_municipio_rows)
    explicito = build_partition("AC", ac_municipio_rows, familia="metrica")
    assert com_default["colunas"] == explicito["colunas"] == list(COLUNAS_METRICA)


def test_build_partition_familia_desconhecida_levanta(ac_municipio_rows):
    with pytest.raises(ValueError, match="familia"):
        build_partition("AC", ac_municipio_rows, familia="inexistente")


def test_write_partition_produz_gzip_valido_conteudo_identico_byte_a_byte(
    ac_municipio_rows, tmp_path, monkeypatch
):
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    payload = build_partition("AC", ac_municipio_rows)

    destino = write_partition("AC", payload)
    assert destino.exists()
    assert destino.name == "AC.json.gz"

    corpo_descomprimido = gzip.decompress(destino.read_bytes())
    esperado = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    assert corpo_descomprimido == esperado
    assert json.loads(corpo_descomprimido) == payload


def test_upload_partition_faz_put_com_service_role_e_sem_cabecalho_de_compressao(
    ac_municipio_rows, tmp_path, monkeypatch
):
    monkeypatch.setenv("SUPABASE_URL", "https://exemplo.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "chave-service-role-fake")

    payload = build_partition("AC", ac_municipio_rows)
    caminho = tmp_path / "AC.json.gz"
    caminho.write_bytes(gzip.compress(json.dumps(payload).encode("utf-8"), mtime=0))

    chamadas = []

    def fake_fetch(request, timeout):
        chamadas.append(request)
        return b""

    monkeypatch.setattr("sih_pipeline.partitions._fetch", fake_fetch)

    upload_partition(caminho, "AC")

    assert len(chamadas) == 1
    req = chamadas[0]
    assert req.full_url == f"https://exemplo.supabase.co/storage/v1/object/{BUCKET}/{PARTITION_PREFIX}/AC.json.gz"
    assert req.get_header("Authorization") == "Bearer chave-service-role-fake"
    assert req.get_header("Apikey") == "chave-service-role-fake"
    # nunca depende do cabeçalho de compressão do servidor (RESEARCH Pitfall 11)
    assert req.get_header("Content-encoding") is None
    assert req.get_header("Content-type") == "application/octet-stream"


def test_object_key_espelha_bucket_e_prefixo():
    assert BUCKET == "sih-municipio"
    assert PARTITION_PREFIX == "v1"
    assert _object_key("SP") == "v1/SP.json.gz"
    assert _object_key("SP", familia="populacao") == "v1/pop/SP.json.gz"


def test_main_help_sai_zero(capsys):
    with pytest.raises(SystemExit) as exc:
        main(["--help"])
    assert exc.value.code == 0


def test_main_sem_uf_nem_todas_sai_dois(capsys):
    assert main([]) == 2
