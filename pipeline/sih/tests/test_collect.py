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

    # arquivo genuinamente presente em disco -- a self-cura não tinha nada para curar.
    assert collect_ledger.self_heal_count("AC") == 0


def test_collect_uf_persiste_a_defasagem_medida_antes_de_reciclar_o_bruto(
    cache_dir, index, monkeypatch
):
    """09-15-DT-INTER: o histograma de defasagem (`ANO_CMPT - ano(DT_INTER)`) e os descartes de
    `DT_INTER` são medidos sobre o parquet BRUTO e precisam ser gravados no `CollectLedger` antes
    da reciclagem -- é a única janela em que esse dado existe. Sem isto, responder "a cauda de
    competência de `enumerate.py` foi suficiente?" exigiria re-baixar os ~8,8 GB, que foi
    exatamente o preço que o 09-10 pagou por não ter preservado `PROC_REA`.

    Medido sobre a fixture real (AC, competência 2019 inteira): 44.563 registros `IDENT='1'`, dos
    quais 41.070 são internações de 2019 (defasagem 0) e 3.493 de 2018 (defasagem 1) -- 7,84% da
    competência. Zero `DT_INTER` malformado."""
    monkeypatch.setattr(enumerate_mod, "expected_file_names", lambda: frozenset({"RDAC1901"}))
    _stage_downloaded_file(cache_dir, "RDAC1901")

    collect_ledger = collect.CollectLedger()
    collect.collect_uf(
        "AC", collect_ledger=collect_ledger, index=index, download_fn=_download_fn_proibido
    )

    estatisticas = collect_ledger.entry("AC")["estatisticas"]
    assert estatisticas["total"] == 44_589
    assert estatisticas["total_ident_1"] == 44_563
    assert estatisticas["descartes_dt_inter"] == 0
    assert estatisticas["lag"] == {"0": 41_070, "1": 3_493}

    # sobrevive ao round-trip por JSON do collect_state.json (chaves de lag são string por isso)
    collect_ledger.save()
    recarregado = collect.CollectLedger.load()
    assert recarregado.entry("AC")["estatisticas"] == estatisticas


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
    _disco_generoso(monkeypatch)
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


def _disco_generoso(monkeypatch) -> None:
    """Neutraliza a guarda de disco para os testes que exercitam o LAÇO, não a guarda.

    Sem isto, `test_collect_all_*` depende do espaço livre AMBIENTE da máquina que roda a suíte:
    a guarda usa `shutil.disk_usage` de verdade e projeta ~569 MB para o AC, então num disco
    apertado a corrida para limpo (comportamento CORRETO da guarda) e o teste falha dizendo
    `'nunca_iniciado' == 'falhou'` — uma mensagem que aponta para o ledger quando o problema é o
    disco de quem rodou. Medido em 2026-08-17: com 375 MB livres, 4 testes de laço quebravam sem
    nenhuma regressão de código, e `npm run gate` ficava vermelho por uma razão que não tem nada a
    ver com o que estes testes provam (isolamento de falha por UF e self-cura do ledger).

    A guarda em si continua provada, com disco FALSO nos dois sentidos, em
    `test_garantir_espaco_recusa_uf_que_nao_cabe` / `test_garantir_espaco_aceita_uf_pequena_com_
    disco_generoso` / `test_collect_all_para_limpo_quando_disco_insuficiente`. Estes três é que
    são os testes da guarda; os de laço não podem herdá-la por acidente do ambiente.
    """
    monkeypatch.setattr(collect.shutil, "disk_usage", lambda path: _FakeDiskUsage(64 * 1024**3))


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
    _disco_generoso(monkeypatch)
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


# ---------------------------------------------------------------------------
# Self-cura do ledger (09-04-AUTOCURA-LEDGER) -- ver docstring do módulo, "Self-cura do
# ledger". O incidente real: um arquivo 'baixado' no FileLedger cujo parquet sumiu do disco
# (interrupção entre "arquivo baixado" e "UF marcada agregado_reciclado", nunca a reciclagem de
# fim de UF, que só roda depois de _persist_rows confirmado) nunca voltava a pending() (excluído
# por já estar 'baixado') e nunca conseguia agregar (parquet ausente) -- UF travada para SEMPRE.
# Medido em produção em RO/PB/PI/RN, reparado à mão duas vezes (276 entradas apagadas).
# ---------------------------------------------------------------------------


def test_collect_uf_incompleta_self_cura_fantasma_e_conclui(cache_dir, index, monkeypatch):
    """UF INCOMPLETA (nunca_iniciado) com um arquivo 'baixado' no ledger cujo parquet sumiu do
    disco -- a self-cura reseta a entrada e o download normal a re-busca; a UF conclui em vez de
    travar para sempre. Round-trip real em disco via `cache_dir` (FileLedger de verdade, não um
    dublê em memória) -- carrega antes, roda, recarrega depois do disco."""
    monkeypatch.setattr(enumerate_mod, "expected_file_names", lambda: frozenset({"RDAC1901"}))

    caminho_fantasma = cache_dir / "parquet" / "RDAC1901-fantasma.parquet"
    file_ledger = FileLedger.load()
    file_ledger.mark_collected(
        "RDAC1901", row_count=1, sha256="a" * 64, parquet_dir=str(caminho_fantasma)
    )
    file_ledger.save()
    assert not caminho_fantasma.exists()  # a divergência é real, não um artefato do teste

    chamadas: list[list[str]] = []

    def download_fn_redownload(*, only):
        chamadas.append(sorted(only))
        _stage_downloaded_file(cache_dir, "RDAC1901")

    collect_ledger = collect.CollectLedger()
    collect.collect_uf(
        "AC", collect_ledger=collect_ledger, index=index, download_fn=download_fn_redownload
    )

    assert chamadas == [["RDAC1901"]]  # self-cura tornou o arquivo elegível a novo download
    assert collect_ledger.status("AC") == collect.ESTADO_AGREGADO_RECICLADO
    assert collect_ledger.self_heal_count("AC") == 1

    # o FileLedger real, recarregado do disco, reflete o re-download -- não o caminho fantasma.
    file_ledger_final = FileLedger.load()
    assert file_ledger_final.status("RDAC1901") == STATUS_BAIXADO
    assert file_ledger_final.entry("RDAC1901")["parquet_dir"] != str(caminho_fantasma)


def test_collect_all_self_cura_uma_uf_e_isola_da_proxima(cache_dir, index, monkeypatch):
    """Mesmo cenário acima, mas via `collect_all` (a corrida real) com uma segunda UF saudável
    ao lado -- prova que a self-cura de AC não vaza para DF."""
    _disco_generoso(monkeypatch)
    monkeypatch.setattr(
        enumerate_mod, "expected_file_names", lambda: frozenset({"RDAC1901", "RDDF1901"})
    )

    file_ledger = FileLedger.load()
    file_ledger.mark_collected(
        "RDAC1901",
        row_count=1,
        sha256="a" * 64,
        parquet_dir=str(cache_dir / "parquet" / "RDAC1901-fantasma.parquet"),
    )
    file_ledger.save()
    _stage_downloaded_file(cache_dir, "RDDF1901")

    def download_fn(*, only):
        if "RDAC1901" in only:
            _stage_downloaded_file(cache_dir, "RDAC1901")

    resultado = collect.collect_all(order=("AC", "DF"), download_fn=download_fn, index=index)

    assert resultado.status("AC") == collect.ESTADO_AGREGADO_RECICLADO
    assert resultado.self_heal_count("AC") == 1
    assert resultado.status("DF") == collect.ESTADO_AGREGADO_RECICLADO
    assert resultado.self_heal_count("DF") == 0


def test_collect_uf_completa_com_fantasma_fica_intocada(cache_dir, index, monkeypatch):
    """A REGRESSÃO que mais importa: uma UF já `agregado_reciclado` tem, por design, todo
    arquivo 'baixado' sem parquet em disco (reciclado de propósito depois de agregar -- ver
    docstring do módulo). A self-cura tem que reconhecer isso como o estado esperado e NÃO
    tocar -- a primeira tentativa de reparo manual que motivou esta correção errou exatamente
    aqui (apagou entradas de UF completa e forçou re-download em massa sem necessidade)."""
    monkeypatch.setattr(enumerate_mod, "expected_file_names", lambda: frozenset({"RDAC1901"}))

    caminho_fantasma = cache_dir / "parquet" / "RDAC1901-fantasma.parquet"
    file_ledger = FileLedger.load()
    file_ledger.mark_collected(
        "RDAC1901", row_count=1, sha256="a" * 64, parquet_dir=str(caminho_fantasma)
    )
    file_ledger.save()
    entrada_antes = FileLedger.load().entry("RDAC1901")

    collect_ledger = collect.CollectLedger()
    collect_ledger.mark_agregado_reciclado(
        "AC", linhas=10, bytes_persistidos=100, bytes_reciclados=1000
    )
    collect_ledger.save()

    curados = collect._self_heal_ghost_entries(
        "AC", frozenset({"RDAC1901"}), file_ledger, collect_ledger=collect_ledger
    )

    assert curados == 0
    assert collect_ledger.self_heal_count("AC") == 0

    # o FileLedger em disco não mudou NADA -- nem status, nem parquet_dir, nem updated_at.
    entrada_depois = FileLedger.load().entry("RDAC1901")
    assert entrada_depois == entrada_antes

    # e o caminho completo via collect_all nem chega a chamar collect_uf/self-cura para ela --
    # é pulada de saída (retomada), download_fn nunca é chamado.
    resultado = collect.collect_all(
        order=("AC",), download_fn=_download_fn_proibido, index=index
    )
    assert resultado.status("AC") == collect.ESTADO_AGREGADO_RECICLADO
    assert resultado.self_heal_count("AC") == 0


def test_collect_uf_completa_chamada_direto_ainda_recusa_agregar_com_fantasma(
    cache_dir, index, monkeypatch
):
    """Defesa em profundidade: mesmo que `collect_uf` seja chamada diretamente para uma UF já
    `agregado_reciclado` (fora do laço normal de `collect_all`, que pula essas UFs de saída) --
    a self-cura corretamente não toca nada (ghost esperado, prova acima), e a checagem de
    segurança ORIGINAL de `_aggregate_uf` (nunca removida por esta correção) ainda recusa agregar
    em cima do parquet ausente. A safety property nunca fica só nas mãos da self-cura."""
    monkeypatch.setattr(enumerate_mod, "expected_file_names", lambda: frozenset({"RDAC1901"}))

    file_ledger = FileLedger.load()
    file_ledger.mark_collected(
        "RDAC1901",
        row_count=1,
        sha256="a" * 64,
        parquet_dir=str(cache_dir / "parquet" / "RDAC1901-fantasma.parquet"),
    )
    file_ledger.save()

    collect_ledger = collect.CollectLedger()
    collect_ledger.mark_agregado_reciclado(
        "AC", linhas=10, bytes_persistidos=100, bytes_reciclados=1000
    )
    collect_ledger.save()

    with pytest.raises(RuntimeError, match="ledger e disco divergem"):
        collect.collect_uf(
            "AC", collect_ledger=collect_ledger, index=index, download_fn=_download_fn_proibido
        )


def test_collect_uf_self_cura_nao_contorna_seguranca_se_redownload_nao_restaura(
    cache_dir, index, monkeypatch
):
    """A self-cura só ABRE a porta para um novo download -- nunca finge que o arquivo está
    presente. Se o redownload não conseguir repor o parquet (ex.: FTP fora do ar de novo), a UF
    ainda falha de forma limpa (o mesmo RuntimeError de arquivo pendente que já existia), e a
    agregação NUNCA roda sobre um arquivo ausente -- a safety property original continua intacta
    mesmo depois da self-cura ter disparado."""
    monkeypatch.setattr(enumerate_mod, "expected_file_names", lambda: frozenset({"RDAC1901"}))

    file_ledger = FileLedger.load()
    file_ledger.mark_collected(
        "RDAC1901",
        row_count=1,
        sha256="a" * 64,
        parquet_dir=str(cache_dir / "parquet" / "RDAC1901-fantasma.parquet"),
    )
    file_ledger.save()

    def download_fn_nao_restaura(*, only):
        pass  # simula um redownload que não conseguiu repor o arquivo (ex.: FTP fora do ar)

    collect_ledger = collect.CollectLedger()
    with pytest.raises(RuntimeError, match=r"arquivo\(s\) pendente"):
        collect.collect_uf(
            "AC",
            collect_ledger=collect_ledger,
            index=index,
            download_fn=download_fn_nao_restaura,
        )

    # a self-cura já tinha rodado (arquivo virou elegível a download de novo) mas a agregação
    # nunca foi tentada -- nenhum parquet agregado foi escrito.
    assert collect_ledger.self_heal_count("AC") == 1
    assert not (cache_dir / "agregados" / "AC.parquet").exists()


def test_self_heal_estoura_apos_limite_de_tentativas(cache_dir, index, monkeypatch):
    """Self-cura repetida na MESMA UF sinaliza algo além de uma interrupção pontual (disco
    apagando parquet fora do FileLedger, corrida concorrente, etc.) -- na (N+1)-ésima vez a
    guarda estoura em vez de tentar de novo para sempre (`_MAX_SELF_HEALS_PER_UF`)."""
    monkeypatch.setattr(enumerate_mod, "expected_file_names", lambda: frozenset({"RDAC1901"}))

    file_ledger = FileLedger.load()
    file_ledger.mark_collected(
        "RDAC1901",
        row_count=1,
        sha256="a" * 64,
        parquet_dir=str(cache_dir / "parquet" / "RDAC1901-fantasma.parquet"),
    )
    file_ledger.save()

    collect_ledger = collect.CollectLedger()
    for _ in range(collect._MAX_SELF_HEALS_PER_UF):
        collect_ledger.record_self_heal("AC", curados=1)
    collect_ledger.save()

    with pytest.raises(RuntimeError, match="self-curou"):
        collect._self_heal_ghost_entries(
            "AC", frozenset({"RDAC1901"}), file_ledger, collect_ledger=collect_ledger
        )

    # a guarda recusou tocar de novo -- a entrada continua exatamente como estava, não mascarada.
    assert FileLedger.load().status("RDAC1901") == STATUS_BAIXADO


def test_collect_all_isola_estouro_de_guarda_de_self_cura_e_processa_a_proxima(
    cache_dir, index, monkeypatch
):
    """O estouro da guarda (teste acima) passando por `collect_all` -- isola a UF (mesma
    disciplina PIPE-06 já provada para falha de download/agregação) em vez de derrubar a
    corrida inteira; a UF seguinte processa normalmente."""
    _disco_generoso(monkeypatch)
    monkeypatch.setattr(
        enumerate_mod, "expected_file_names", lambda: frozenset({"RDAC1901", "RDDF1901"})
    )

    file_ledger = FileLedger.load()
    file_ledger.mark_collected(
        "RDAC1901",
        row_count=1,
        sha256="a" * 64,
        parquet_dir=str(cache_dir / "parquet" / "RDAC1901-fantasma.parquet"),
    )
    file_ledger.save()
    _stage_downloaded_file(cache_dir, "RDDF1901")

    collect_ledger = collect.CollectLedger()
    for _ in range(collect._MAX_SELF_HEALS_PER_UF):
        collect_ledger.record_self_heal("AC", curados=1)
    collect_ledger.save()

    def download_fn(*, only):
        if "RDDF1901" in only:
            _stage_downloaded_file(cache_dir, "RDDF1901")
            return
        raise AssertionError(f"download_fn não deveria ser chamada para AC -- only={only}")

    resultado = collect.collect_all(order=("AC", "DF"), download_fn=download_fn, index=index)

    # AC estourou a guarda de self-cura de forma isolada e resumível -- não derrubou a corrida.
    assert resultado.status("AC") == collect.ESTADO_FALHOU
    assert "self-curou" in resultado.entry("AC")["reason"]
    # a guarda RECUSOU tentar de novo -- o contador não passou do limite já atingido.
    assert resultado.self_heal_count("AC") == collect._MAX_SELF_HEALS_PER_UF

    # DF, a UF seguinte, processou normalmente apesar do estouro de guarda de AC.
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
