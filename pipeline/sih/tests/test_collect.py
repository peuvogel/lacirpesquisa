"""Prova o laço incremental por UF de `collect.py` -- desbloqueia a Task 3 do 09-04 sem exigir
~10-13 GB de disco simultâneos (D-01).

Roda inteiramente sobre `tests/fixtures/rdac_2019.parquet` (mesma fixture real de AC/2019 já
usada por `test_partitions.py`/`test_aggregate.py`) -- nenhum teste toca rede: `download_fn` é
sempre injetado, nunca o `download_all` real. `cache_dir` (conftest.py) isola cada teste num
`tmp_path` descartável, nunca o cache real do operador.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pyarrow.parquet as pq
import pytest

from sih_pipeline import collect
from sih_pipeline import enumerate as enumerate_mod
from sih_pipeline.corrections import apply_corrections, load_corrections
from sih_pipeline.ledger import STATUS_BAIXADO, FileLedger
from sih_pipeline.matcher import build_index, load_cid_map

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "rdac_2019.parquet"


@pytest.fixture(scope="module")
def index():
    cid_map = apply_corrections(load_cid_map(), load_corrections())
    return build_index(cid_map)


def _stage_downloaded_file(cache_dir: Path, nome: str, row_count: int = 44589) -> Path:
    """Copia a fixture real de AC/2019 para dentro do cache como se `nome` já tivesse sido
    baixado, e registra a entrada correspondente no `FileLedger` -- monta o cenário "já baixado"
    sem tocar rede."""
    destino = cache_dir / "parquet" / f"{nome}.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(FIXTURE_PATH, destino)

    ledger = FileLedger.load()
    ledger.mark_collected(nome, row_count=row_count, sha256="f" * 64, parquet_dir=str(destino))
    ledger.save()
    return destino


def _download_fn_proibido(**kwargs):
    raise AssertionError(f"collect: download_fn não deveria ter sido chamada -- kwargs={kwargs}")


# ---------------------------------------------------------------------------
# Prova 1 -- o laço agrega uma UF, persiste durável e recicla o parquet bruto dela.
# ---------------------------------------------------------------------------


def test_collect_uf_agrega_persiste_e_recicla_o_bruto(cache_dir, index, monkeypatch):
    monkeypatch.setattr(enumerate_mod, "expected_file_names", lambda: frozenset({"RDAC1901"}))
    _stage_downloaded_file(cache_dir, "RDAC1901")

    collect_ledger = collect.CollectLedger()
    collect.collect_uf(
        "AC", collect_ledger=collect_ledger, index=index, download_fn=_download_fn_proibido
    )

    destino_agregado = cache_dir / "agregados" / "AC.parquet"
    assert destino_agregado.exists()
    tabela = pq.read_table(destino_agregado)
    assert tabela.num_rows > 0

    assert not (cache_dir / "parquet" / "RDAC1901.parquet").exists()

    assert collect_ledger.status("AC") == collect.ESTADO_AGREGADO_RECICLADO
    entry = collect_ledger.entry("AC")
    assert entry["linhas"] == tabela.num_rows
    assert entry["bytes_persistidos"] > 0
    assert entry["bytes_reciclados"] > 0

    # o FileLedger do 09-04 continua dizendo 'baixado' -- NUNCA corrompido pela reciclagem
    # (ver docstring do módulo: é o que impede download_all de rebaixar/re-baixar).
    file_ledger = FileLedger.load()
    assert file_ledger.status("RDAC1901") == STATUS_BAIXADO


# ---------------------------------------------------------------------------
# Prova 2 -- retomada: não rebaixa/re-baixa UF já agregada, não pula UF baixada-mas-não-agregada.
# ---------------------------------------------------------------------------


def test_collect_all_pula_uf_ja_agregada_sem_chamar_download(cache_dir, index):
    collect_ledger = collect.CollectLedger()
    collect_ledger.mark_agregado_reciclado(
        "AC", linhas=10, bytes_persistidos=100, bytes_reciclados=1000
    )
    collect_ledger.save()

    resultado = collect.collect_all(
        order=("AC",), download_fn=_download_fn_proibido, index=index
    )

    assert resultado.status("AC") == collect.ESTADO_AGREGADO_RECICLADO
    assert resultado.entry("AC")["linhas"] == 10  # inalterado -- não reprocessou


def test_collect_uf_nao_pula_uf_baixada_mas_nao_agregada(cache_dir, index, monkeypatch):
    monkeypatch.setattr(enumerate_mod, "expected_file_names", lambda: frozenset({"RDAC1901"}))
    _stage_downloaded_file(cache_dir, "RDAC1901")

    collect_ledger = collect.CollectLedger()
    collect_ledger.mark_baixado_pendente_agregacao("AC", arquivos=1)
    collect_ledger.save()

    # download_fn nunca deveria ser chamada (arquivo já baixado) mas a UF PRECISA avançar até
    # 'agregado_reciclado', nunca ficar parada em 'baixado_pendente_agregacao'.
    collect.collect_uf(
        "AC", collect_ledger=collect_ledger, index=index, download_fn=_download_fn_proibido
    )

    assert collect_ledger.status("AC") == collect.ESTADO_AGREGADO_RECICLADO
    assert not (cache_dir / "parquet" / "RDAC1901.parquet").exists()


def test_collect_all_nao_pula_uf_pendente_de_agregacao(cache_dir, index, monkeypatch):
    monkeypatch.setattr(enumerate_mod, "expected_file_names", lambda: frozenset({"RDAC1901"}))
    _stage_downloaded_file(cache_dir, "RDAC1901")
    # nenhuma entrada prévia no collect ledger -- 'nunca_iniciado', mas já baixada em disco.

    resultado = collect.collect_all(
        order=("AC",), download_fn=_download_fn_proibido, index=index
    )

    assert resultado.status("AC") == collect.ESTADO_AGREGADO_RECICLADO


# ---------------------------------------------------------------------------
# Prova 3 -- guarda de disco recusa uma UF que não caiba.
# ---------------------------------------------------------------------------


class _FakeDiskUsage:
    def __init__(self, free: int) -> None:
        self.free = free
        self.total = free * 10
        self.used = 0


def test_garantir_espaco_recusa_uf_que_nao_cabe(cache_dir, monkeypatch):
    monkeypatch.setattr(collect.shutil, "disk_usage", lambda path: _FakeDiskUsage(10 * 1024 * 1024))

    with pytest.raises(collect.DiscoInsuficienteError, match="SP"):
        collect.garantir_espaco_suficiente("SP")


def test_garantir_espaco_aceita_uf_pequena_com_disco_generoso(cache_dir, monkeypatch):
    monkeypatch.setattr(collect.shutil, "disk_usage", lambda path: _FakeDiskUsage(8 * 1024**3))

    collect.garantir_espaco_suficiente("DF")  # não levanta


def test_collect_all_para_limpo_quando_disco_insuficiente(cache_dir, index, monkeypatch):
    monkeypatch.setattr(collect.shutil, "disk_usage", lambda path: _FakeDiskUsage(10 * 1024 * 1024))

    resultado = collect.collect_all(
        order=("SP",), download_fn=_download_fn_proibido, index=index
    )

    # a UF nem chegou a ser tentada -- para limpo, nunca marca 'falhou' por causa de disco
    assert resultado.status("SP") == collect.ESTADO_NUNCA_INICIADO


# ---------------------------------------------------------------------------
# Prova 4 -- isolamento de falha por arquivo (PIPE-06) sobrevive nesta orquestração.
# ---------------------------------------------------------------------------


def test_collect_uf_levanta_quando_download_deixa_arquivo_pendente(cache_dir, index, monkeypatch):
    monkeypatch.setattr(
        enumerate_mod, "expected_file_names", lambda: frozenset({"RDAC1901", "RDAC1902"})
    )

    def download_parcial(*, only):
        # simula o que o download_all real faz sob PIPE-06: isola UM arquivo como 'falhou' e
        # baixa o outro -- nunca levanta, só o ledger reflete a falha isolada por arquivo.
        _stage_downloaded_file(cache_dir, "RDAC1901")
        file_ledger = FileLedger.load()
        file_ledger.mark_failed("RDAC1902", reason="FTP timeout (simulado)")
        file_ledger.save()

    collect_ledger = collect.CollectLedger()
    with pytest.raises(RuntimeError, match=r"arquivo\(s\) pendente"):
        collect.collect_uf(
            "AC", collect_ledger=collect_ledger, index=index, download_fn=download_parcial
        )


def test_collect_all_isola_falha_de_uma_uf_e_processa_a_proxima(cache_dir, index, monkeypatch):
    monkeypatch.setattr(
        enumerate_mod,
        "expected_file_names",
        lambda: frozenset({"RDAC1901", "RDAC1902", "RDDF1901"}),
    )

    def download_fn(*, only):
        only_set = set(only)
        if {"RDAC1901", "RDAC1902"} & only_set:
            _stage_downloaded_file(cache_dir, "RDAC1901")
            file_ledger = FileLedger.load()
            file_ledger.mark_failed("RDAC1902", reason="FTP timeout (simulado)")
            file_ledger.save()
        if "RDDF1901" in only_set:
            _stage_downloaded_file(cache_dir, "RDDF1901")

    resultado = collect.collect_all(order=("AC", "DF"), download_fn=download_fn, index=index)

    # AC falhou de forma isolada e resumível -- não derrubou a corrida inteira.
    assert resultado.status("AC") == collect.ESTADO_FALHOU
    assert "RDAC1902" in resultado.entry("AC")["reason"]

    # DF, a UF seguinte, processou normalmente apesar da falha de AC.
    assert resultado.status("DF") == collect.ESTADO_AGREGADO_RECICLADO


def test_collect_all_isola_divergencia_ledger_disco_na_agregacao(cache_dir, index, monkeypatch):
    monkeypatch.setattr(
        enumerate_mod, "expected_file_names", lambda: frozenset({"RDAC1901", "RDDF1901"})
    )

    file_ledger = FileLedger.load()
    file_ledger.mark_collected(
        "RDAC1901",
        row_count=1,
        sha256="a" * 64,
        parquet_dir=str(cache_dir / "parquet" / "RDAC1901-inexistente.parquet"),
    )
    file_ledger.save()
    _stage_downloaded_file(cache_dir, "RDDF1901")

    resultado = collect.collect_all(
        order=("AC", "DF"), download_fn=_download_fn_proibido, index=index
    )

    assert resultado.status("AC") == collect.ESTADO_FALHOU
    assert "ledger e disco divergem" in resultado.entry("AC")["reason"]
    assert resultado.status("DF") == collect.ESTADO_AGREGADO_RECICLADO


# ---------------------------------------------------------------------------
# Ordem, tabela de razão e projeção de bytes.
# ---------------------------------------------------------------------------


def test_uf_order_contem_as_27_ufs_sem_duplicata():
    assert len(collect.UF_ORDER) == 27
    assert set(collect.UF_ORDER) == set(enumerate_mod.UFS)


def test_razao_linhas_vs_ac_cobre_as_27_ufs():
    assert set(collect.RAZAO_LINHAS_VS_AC) == set(enumerate_mod.UFS)
    assert collect.RAZAO_LINHAS_VS_AC["AC"] == 1.00


def test_project_uf_bytes_sp_maior_que_ac():
    assert collect.project_uf_bytes("SP") > collect.project_uf_bytes("AC")


def test_project_uf_bytes_usa_medicao_real_quando_maior_que_semente():
    base = collect.project_uf_bytes("SE")
    inflado = collect.project_uf_bytes("SE", medicoes={"AC": 10 * collect.BYTES_PER_RATIO_UNIT_SEED})
    assert inflado > base


def test_project_uf_bytes_nao_extrapola_medicao_de_razao_pequena_para_razao_grande():
    # Achado real da primeira corrida (2026-08-10/11): DF (razao=0,20) mediu 163,45 MB brutos --
    # ~12x acima da semente. Extrapolar ISSO para SP (razao=29,20, 146x maior) projetaria ~24 GB
    # quando o real medido de SP (SP/2019 ja em cache) e ~1,9 GB -- a UF pequena nao pode inflar
    # a projecao de uma UF ordens de grandeza maior na razao (RAIO_CONFIANCA_RAZAO).
    medicao_df_real = {"DF": 163_452_924}
    projetado_sp = collect.project_uf_bytes("SP", medicoes=medicao_df_real)
    projetado_sp_sem_medicao = collect.project_uf_bytes("SP")

    assert projetado_sp == projetado_sp_sem_medicao  # DF nao influencia SP (fora do raio)
    assert projetado_sp < 3 * 1024**3  # continua perto da semente (~1,9 GB), nunca ~24 GB


def test_project_uf_bytes_extrapola_medicao_dentro_do_raio_de_confianca():
    # AC (razao=1,00) e SE (razao=0,98) estao dentro do raio -- uma medicao real de AC PODE
    # calibrar a projecao de SE.
    medicao_ac_real = {"AC": 5 * collect.BYTES_PER_RATIO_UNIT_SEED}
    projetado_se = collect.project_uf_bytes("SE", medicoes=medicao_ac_real)
    projetado_se_sem_medicao = collect.project_uf_bytes("SE")

    assert projetado_se > projetado_se_sem_medicao


# ---------------------------------------------------------------------------
# CollectLedger -- estado explícito por UF.
# ---------------------------------------------------------------------------


def test_collect_ledger_vazio_devolve_nunca_iniciado(cache_dir):
    ledger = collect.CollectLedger.load()
    assert ledger.status("AC") == collect.ESTADO_NUNCA_INICIADO
    assert ledger.entry("AC") == {}


def test_collect_ledger_persiste_apos_save_e_load(cache_dir):
    ledger = collect.CollectLedger()
    ledger.mark_agregado_reciclado(
        "AC", linhas=5933, bytes_persistidos=123456, bytes_reciclados=66109
    )
    ledger.save()

    recarregado = collect.CollectLedger.load()
    assert recarregado.status("AC") == collect.ESTADO_AGREGADO_RECICLADO
    assert recarregado.entry("AC")["linhas"] == 5933


def test_collect_ledger_mark_falhou_nao_regride_agregado_reciclado(cache_dir):
    ledger = collect.CollectLedger()
    ledger.mark_agregado_reciclado("AC", linhas=1, bytes_persistidos=1, bytes_reciclados=1)
    ledger.mark_falhou("AC", reason="erro espúrio numa reexecução")

    assert ledger.status("AC") == collect.ESTADO_AGREGADO_RECICLADO


# ---------------------------------------------------------------------------
# CLI fina.
# ---------------------------------------------------------------------------


def test_main_status_nao_processa_nada_e_sai_zero(cache_dir, capsys):
    assert collect.main(["--status"]) == 0
    saida = capsys.readouterr().out
    assert collect.ESTADO_AGREGADO_RECICLADO in saida
