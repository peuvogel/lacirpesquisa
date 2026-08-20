"""Prova a reconciliação do agregado do microdado contra o oráculo TabNet re-raspado, com
razão registrada para todo desvio — nunca banda de aceitação percentual — SC-7/D-02.

Dados sintéticos pequenos (não a fixture inteira) — a fixture real é exercitada pela Task 2 e
pelo gate permanente do 09-11 (`test_reconcile_gate.py`).

**Suíte `main()` (adaptação 2026-08-11, 09-09-ADAPTACAO-AGREGADOS):** prova que o CLI `reconcile`
usa `partitions.linhas_da_uf` (agregado persistido > parquet bruto isolado) em vez de ler
`cache_path("parquet")` inteira direto -- mesmo handoff fechado em `partitions.py`. Todo teste
redireciona o cache via `SIH_PIPELINE_CACHE_DIR=tmp_path`, nunca toca `~/.lacir/sih-cache/` (a
corrida real de coleta está usando agora).

**Suíte "território" (correção 2026-08-11, 09-09-FIX-RESIDENCIA):** verifica que a correção da
seleção de linhas por território (`partitions.construir_indice_territorial`) NÃO move a
composição do SC-7 (D-10 só reconcilia `grao=uf`/`local=ocorrencia`, que sempre vem do próprio
arquivo da UF onde ocorreu -- a correção de residência/contaminação nunca as afeta) e prova o
ajuste que `main()` precisou (checar dado reconciliável, não "qualquer linha").
"""

from __future__ import annotations

import json
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from sih_pipeline.aggregate import GRAO_MUNICIPIO, LOCAL_RESIDENCIA, Row
from sih_pipeline.paths import cache_path
from sih_pipeline.reconcile import compare, load_divergencias, load_oracle, main


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


def test_join_com_agregado_real_usa_sigla_de_uf_nao_codigo_ibge():
    # Regressão: Row.territorio_codigo no grão UF é o código IBGE numérico ("12"), não a sigla
    # ("AC") que o oráculo usa como chave -- sem a tradução em main(), TODO par do oráculo
    # aparenta "ausente no agregado" por erro de chave, nunca por divergência real de dado.
    from sih_pipeline.aggregate import GRAO_UF, LOCAL_OCORRENCIA, aggregate_parquet_dir
    from sih_pipeline.codigos import UF_POR_CODIGO
    from sih_pipeline.corrections import apply_corrections, load_corrections
    from sih_pipeline.matcher import build_index, load_cid_map

    fixture = (
        __import__("pathlib").Path(__file__).resolve().parent / "fixtures" / "rdac_2019.parquet"
    )
    index = build_index(apply_corrections(load_cid_map(), load_corrections()))
    linhas = aggregate_parquet_dir(fixture, index)

    agregado = {}
    for linha in linhas:
        if linha.grao != GRAO_UF or linha.local != LOCAL_OCORRENCIA:
            continue
        uf_sigla = UF_POR_CODIGO[linha.territorio_codigo]
        agregado[(linha.disease_id, uf_sigla, linha.ano, "internacoes")] = linha.internacoes

    oraculo_ac_2019 = [e for e in load_oracle() if e["uf"] == "AC" and e["ano"] == 2019]
    resultado = compare(agregado, oraculo_ac_2019, [])

    # Não afirma um número exato aqui (isso é trabalho da Task 2) -- só que a chave junta de
    # verdade: se a tradução de UF quebrar de novo, TODOS os 98 pares voltam a ficar sem
    # correspondente no agregado (valor_agregado is None), o que este teste pega.
    sem_correspondente = sum(1 for p in resultado.inexplicado if p.valor_agregado is None)
    assert sem_correspondente < len(oraculo_ac_2019)


# ---------------------------------------------------------------------------
# Suíte main() -- adaptação 2026-08-11 (09-09-ADAPTACAO-AGREGADOS). `main()` agora usa
# `partitions.linhas_da_uf` por UF necessária (agregado persistido > parquet bruto isolado) em
# vez de agregar `cache_path("parquet")` inteira de uma vez.
# ---------------------------------------------------------------------------

FIXTURE_AC = Path(__file__).resolve().parent / "fixtures" / "rdac_2019.parquet"


def _escrever_oraculo(caminho: Path, entradas: list[dict]) -> None:
    caminho.write_text(json.dumps(entradas), encoding="utf-8")


def _entrada_oraculo(uf: str) -> dict:
    return {
        "diseaseId": "aborto_espontaneo",
        "tabnetCode": "258",
        "uf": uf,
        "ano": 2019,
        "medida": "internacoes",
        "valorTabnet": 10,
    }


def test_main_uf_unica_sem_dado_avisa_e_nao_reconcilia(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    oraculo_path = tmp_path / "oraculo.json"
    _escrever_oraculo(oraculo_path, [_entrada_oraculo("RO")])
    monkeypatch.setattr("sih_pipeline.reconcile.ORACLE_PATH", oraculo_path)

    resultado = main([])

    assert resultado == 0
    saida = capsys.readouterr()
    assert "RO" in saida.err
    assert "nada a reconciliar" in saida.out


def test_main_uf_com_so_parquet_bruto_reconcilia_via_fallback_isolado(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    destino = cache_path("parquet") / "RDAC1901.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(FIXTURE_AC.read_bytes())

    oraculo_path = tmp_path / "oraculo.json"
    _escrever_oraculo(oraculo_path, [_entrada_oraculo("AC")])
    monkeypatch.setattr("sih_pipeline.reconcile.ORACLE_PATH", oraculo_path)

    main([])

    saida = capsys.readouterr()
    # roda a comparação de verdade (nunca "nada a reconciliar") -- AC tinha dado via fallback
    assert "nada a reconciliar" not in saida.out
    assert "exato" in saida.out or "explicado" in saida.out or "inexplicado" in saida.out


def test_main_mistura_uf_com_dado_e_uf_sem_dado_reconcilia_so_a_disponivel(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    destino = cache_path("parquet") / "RDAC1901.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(FIXTURE_AC.read_bytes())

    oraculo_path = tmp_path / "oraculo.json"
    _escrever_oraculo(oraculo_path, [_entrada_oraculo("AC"), _entrada_oraculo("RO")])
    monkeypatch.setattr("sih_pipeline.reconcile.ORACLE_PATH", oraculo_path)

    main([])

    saida = capsys.readouterr()
    # RO avisada em stderr e pulada; AC (que tinha dado) segue para a comparação de verdade
    assert "RO" in saida.err
    assert "nada a reconciliar" not in saida.out


# ---------------------------------------------------------------------------
# Suíte "território" -- correção 2026-08-11 (09-09-FIX-RESIDENCIA).
# ---------------------------------------------------------------------------


def test_main_composicao_sc7_para_ac_e_identica_ao_gate_congelado_apos_correcao_territorio(
    tmp_path, monkeypatch, capsys
):
    """Verificação explícita pedida pela correção 2026-08-11: a correção da seleção por
    território não pode mover a composição do SC-7 -- só `grao=uf`/`local=ocorrencia` entra
    nesta reconciliação (D-10), e essas linhas SEMPRE vêm do próprio arquivo `RD{uf}*` onde a
    internação ocorreu (`MUNIC_MOV` nunca aponta para fora do arquivo que o produz) -- a correção
    de contaminação/subcontagem de RESIDÊNCIA não as afeta. Prova ao vivo contra a fixture
    congelada real (`rdac_2019.parquet`, mesma usada pelo gate permanente
    `test_reconcile_gate.py`), via fallback bruto isolado de `main()`.

    ATUALIZADO 2026-08-17 (09-15-DT-INTER): a composição esperada passou de
    `exato=34/explicado=61/inexplicado=3` para `exato=98/explicado=0/inexplicado=0`, e o código
    de saída de `main()` de 1 para 0. A propriedade que ESTE teste verifica não mudou (a seleção
    por território continua não movendo a composição do SC-7) -- o que mudou é a composição
    contra a qual ela é verificada, e a razão está inteiramente documentada na docstring de
    `test_reconcile_gate.py`: o agregado e o oráculo passaram a medir a mesma população."""
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    destino = cache_path("parquet") / "RDAC1901.parquet"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(FIXTURE_AC.read_bytes())

    resultado = main(["--uf", "AC"])

    saida = capsys.readouterr().out
    assert "reconcile: 98 exato(s), 0 explicado(s), 0 inexplicado(s)" in saida
    assert resultado == 0  # ok é True -- zero inexplicados, mesmo estado do gate congelado


def test_main_uf_com_so_residencia_contribuida_por_outra_uf_continua_sem_dado(
    tmp_path, monkeypatch, capsys
):
    """Ajuste que `main()` precisou pela correção 2026-08-11: uma UF cuja ÚNICA presença no
    índice territorial é uma linha de RESIDÊNCIA contribuída por outra UF já coletada (paciente
    de RO tratado no AC, corretamente atribuído a RO pela correção) continua "sem dado" para fins
    de reconciliação -- nunca vira "inexplicado" por uma comparação que nunca teve como ser feita,
    porque RO não tem nenhuma linha `grao=uf`/`local=ocorrencia` própria."""
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))

    linha_residencia_ro_presa_no_ac = Row(
        disease_id="teste_residencia_ro",
        grao=GRAO_MUNICIPIO,
        local=LOCAL_RESIDENCIA,
        territorio_codigo="110002",  # Ariquemes, RO
        ano=2019,
        internacoes=1,
        obitos=0,
        valor_total=10.0,
        dias_permanencia=1,
        taxa_mortalidade=0.0,
    )
    tabela = pa.table(
        {nome: [getattr(linha_residencia_ro_presa_no_ac, nome)] for nome in Row._fields}
    )
    pq.write_table(tabela, cache_path("agregados/AC.parquet"))

    oraculo_path = tmp_path / "oraculo.json"
    _escrever_oraculo(oraculo_path, [_entrada_oraculo("RO")])
    monkeypatch.setattr("sih_pipeline.reconcile.ORACLE_PATH", oraculo_path)

    resultado = main([])

    assert resultado == 0
    saida = capsys.readouterr()
    assert "RO" in saida.err
    assert "nada a reconciliar" in saida.out
