"""Testes de `audit.py` -- PIPE-05/D-13/D-14. Dados sintéticos pequenos (o comportamento, não a
tabela real de ~69 mil linhas -- `test_reconcile_gate.py` já estabelece o padrão de fixture
pequena para o que precisa ser verificado no `gate`, nunca a rede/tabela real)."""

from __future__ import annotations

import json
from typing import Any

import pytest

import sih_pipeline.audit as audit_mod
from sih_pipeline.aggregate import Row
from sih_pipeline.audit import (
    STATUS_COLETADO,
    STATUS_FALHOU,
    STATUS_NUNCA_TENTADO,
    _fetch_all_paginated,
    anos_incompletos_no_ledger,
    audit_coverage,
    cartesiano_completo,
    classificar_ausencia,
)
from sih_pipeline.enumerate import UFS
from sih_pipeline.ledger import FileLedger


def _cartesiano_pequeno(**overrides: Any) -> frozenset:
    base: dict[str, Any] = dict(
        disease_ids=["doenca_a", "doenca_b"],
        medidas=["internacoes"],
        graos=["uf", "municipio"],
        locais=["ocorrencia"],
        anos=[2019],
    )
    base.update(overrides)
    return cartesiano_completo(**base)


def _status_row(
    *,
    disease_id: str,
    grao: str,
    status: str,
    ano: int = 2019,
    medida: str = "internacoes",
    local: str = "ocorrencia",
) -> dict[str, Any]:
    return {
        "disease_id": disease_id,
        "medida": medida,
        "grao": grao,
        "local": local,
        "ano": ano,
        "status": status,
    }


# ---------------------------------------------------------------------------
# Comportamento 1 -- compara o cartesiano completo contra sih_collection_status, reporta
# faltantes por nome.
# ---------------------------------------------------------------------------


def test_audit_coverage_reporta_combinacao_ausente_de_sih_collection_status_por_nome() -> None:
    cartesiano = _cartesiano_pequeno()
    # só doenca_a/uf tem status -- doenca_a/municipio, doenca_b/uf, doenca_b/municipio faltam
    status_rows = [_status_row(disease_id="doenca_a", grao="uf", status=STATUS_COLETADO)]
    metric_keys = frozenset({("doenca_a", "internacoes", "uf", "ocorrencia", 2019)})

    report = audit_coverage(cartesiano=cartesiano, status_rows=status_rows, metric_keys=metric_keys)

    assert len(report.faltantes) == 3
    assert ("doenca_b", "internacoes", "uf", "ocorrencia", 2019) in report.faltantes
    assert ("doenca_a", "internacoes", "municipio", "ocorrencia", 2019) in report.faltantes
    assert ("doenca_b", "internacoes", "municipio", "ocorrencia", 2019) in report.faltantes


# ---------------------------------------------------------------------------
# Comportamento 2 -- coletado + sem linha de métrica = zero verdadeiro, nunca ausente.
# ---------------------------------------------------------------------------


def test_status_coletado_sem_linha_de_metrica_e_zero_verdadeiro() -> None:
    cartesiano = _cartesiano_pequeno(disease_ids=["doenca_a"], graos=["uf"])
    status_rows = [_status_row(disease_id="doenca_a", grao="uf", status=STATUS_COLETADO)]
    metric_keys: frozenset = frozenset()  # nenhum território reportou -- zero nacional

    report = audit_coverage(cartesiano=cartesiano, status_rows=status_rows, metric_keys=metric_keys)

    chave = ("doenca_a", "internacoes", "uf", "ocorrencia", 2019)
    assert chave in report.zero_verdadeiro
    assert chave not in report.ausente
    assert report.faltantes == ()


# ---------------------------------------------------------------------------
# Comportamento 3 -- falhou/nunca_tentado + sem linha de métrica = ausente.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("status", [STATUS_FALHOU, STATUS_NUNCA_TENTADO])
def test_status_falhou_ou_nunca_tentado_sem_linha_de_metrica_e_ausente(status: str) -> None:
    cartesiano = _cartesiano_pequeno(disease_ids=["doenca_a"], graos=["uf"])
    status_rows = [_status_row(disease_id="doenca_a", grao="uf", status=status)]
    metric_keys: frozenset = frozenset()

    report = audit_coverage(cartesiano=cartesiano, status_rows=status_rows, metric_keys=metric_keys)

    chave = ("doenca_a", "internacoes", "uf", "ocorrencia", 2019)
    assert chave in report.ausente
    assert chave not in report.zero_verdadeiro


# ---------------------------------------------------------------------------
# Comportamento 4 -- a mesma combinação nunca aparece nas duas listas.
# ---------------------------------------------------------------------------


def test_mesma_combinacao_nunca_aparece_em_zero_verdadeiro_e_ausente() -> None:
    cartesiano = _cartesiano_pequeno(disease_ids=["doenca_a", "doenca_b"], graos=["uf"])
    status_rows = [
        _status_row(disease_id="doenca_a", grao="uf", status=STATUS_COLETADO),
        _status_row(disease_id="doenca_b", grao="uf", status=STATUS_FALHOU),
    ]
    metric_keys: frozenset = frozenset()

    report = audit_coverage(cartesiano=cartesiano, status_rows=status_rows, metric_keys=metric_keys)

    assert set(report.zero_verdadeiro) & set(report.ausente) == set()
    assert ("doenca_a", "internacoes", "uf", "ocorrencia", 2019) in report.zero_verdadeiro
    assert ("doenca_b", "internacoes", "uf", "ocorrencia", 2019) in report.ausente


# ---------------------------------------------------------------------------
# Comportamento 5 -- leitura paginada de sih_collection_status, falha alto se o total lido não
# bater com o content-range anunciado (T-09-11/Pitfall 13).
# ---------------------------------------------------------------------------


def _content_range(offset: int, tamanho_pagina: int, total: int) -> dict[str, str]:
    fim = min(offset + tamanho_pagina, total) - 1
    return {"content-range": f"{offset}-{fim}/{total}"}


def test_fetch_all_paginated_pagina_ate_cobrir_o_total(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://exemplo.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-teste")

    total = 2500
    tamanho_pagina = audit_mod._PAGE_SIZE

    def _fetch_falso(request: Any, timeout: int = 30) -> tuple[bytes, dict[str, str]]:
        offset = int(request.headers["Range"].split("-")[0])
        n = min(tamanho_pagina, total - offset)
        corpo = json.dumps([{"disease_id": f"d{offset + i}"} for i in range(n)]).encode("utf-8")
        return corpo, _content_range(offset, tamanho_pagina, total)

    monkeypatch.setattr(audit_mod, "_fetch", _fetch_falso)

    linhas = _fetch_all_paginated("sih_collection_status")

    assert len(linhas) == total


def test_fetch_all_paginated_levanta_quando_leitura_fica_truncada(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://exemplo.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-teste")

    def _fetch_truncado(request: Any, timeout: int = 30) -> tuple[bytes, dict[str, str]]:
        # Só uma página de 200 linhas, mas o total anunciado é 6481 -- e a página devolvida é
        # menor que o tamanho de página, então um laço ingênuo pararia achando que acabou.
        corpo = json.dumps([{"disease_id": f"d{i}"} for i in range(200)]).encode("utf-8")
        return corpo, {"content-range": "0-199/6481"}

    monkeypatch.setattr(audit_mod, "_fetch", _fetch_truncado)

    with pytest.raises(RuntimeError, match="truncad"):
        _fetch_all_paginated("sih_collection_status")


# ---------------------------------------------------------------------------
# Comportamento 6 -- um ano com menos arquivos `baixado` do que 27x12 é reportado como
# incompleto, mesmo que todos os agravos tenham linha (o caso do ano mais recente, D-13).
# ---------------------------------------------------------------------------


def test_ano_com_menos_arquivos_que_27x12_e_reportado_incompleto(
    tmp_path: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    ledger = FileLedger()
    # 2019 completo: 27 UFs x 12 meses.
    for uf in UFS:
        for mm in range(1, 13):
            ledger.mark_collected(f"RD{uf}19{mm:02d}", row_count=1, sha256="a" * 64, parquet_dir="x")
    # 2025 incompleto -- só janeiro de cada UF.
    for uf in UFS:
        ledger.mark_collected(f"RD{uf}2501", row_count=1, sha256="a" * 64, parquet_dir="x")
    ledger.save()

    incompletos = anos_incompletos_no_ledger(FileLedger.load(), anos=[2019, 2025])

    assert 2019 not in incompletos
    assert 2025 in incompletos
    assert incompletos[2025] == len(UFS)  # 27 de 324 arquivos esperados


def test_ano_incompleto_aparece_mesmo_quando_todo_agravo_ja_tem_linha(
    tmp_path: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """O caso que o D-13 existe para tornar visível: mesmo com toda combinação `coletada` e com
    linha de métrica, um ano parcial no FTP precisa ficar marcado incompleto -- não é o
    cartesiano de agravos que decide isso, é a contagem de arquivo da Camada 1."""
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    ledger = FileLedger()
    for uf in UFS:
        ledger.mark_collected(f"RD{uf}2501", row_count=1, sha256="a" * 64, parquet_dir="x")
    ledger.save()

    cartesiano = _cartesiano_pequeno(disease_ids=["doenca_a"], graos=["uf"], anos=[2025])
    status_rows = [_status_row(disease_id="doenca_a", grao="uf", ano=2025, status=STATUS_COLETADO)]
    metric_keys = frozenset({("doenca_a", "internacoes", "uf", "ocorrencia", 2025)})
    incompletos = anos_incompletos_no_ledger(FileLedger.load(), anos=[2025])

    report = audit_coverage(
        cartesiano=cartesiano,
        status_rows=status_rows,
        metric_keys=metric_keys,
        anos_incompletos=incompletos,
    )

    assert report.coletado == 1  # toda combinação tem linha de métrica
    assert 2025 in report.anos_incompletos  # mas o ano ainda aparece incompleto


# ---------------------------------------------------------------------------
# Comportamento 7 -- CoverageReport.ok é True somente quando não há nenhuma combinação
# nunca_tentado nem falhou.
# ---------------------------------------------------------------------------


def test_ok_e_true_quando_nao_ha_falhou_nem_nunca_tentado() -> None:
    cartesiano = _cartesiano_pequeno(disease_ids=["doenca_a"], graos=["uf"])
    status_rows = [_status_row(disease_id="doenca_a", grao="uf", status=STATUS_COLETADO)]
    metric_keys = frozenset({("doenca_a", "internacoes", "uf", "ocorrencia", 2019)})

    report = audit_coverage(cartesiano=cartesiano, status_rows=status_rows, metric_keys=metric_keys)

    assert report.ok is True


@pytest.mark.parametrize("status", [STATUS_FALHOU, STATUS_NUNCA_TENTADO])
def test_ok_e_false_quando_ha_falhou_ou_nunca_tentado(status: str) -> None:
    cartesiano = _cartesiano_pequeno(disease_ids=["doenca_a"], graos=["uf"])
    status_rows = [_status_row(disease_id="doenca_a", grao="uf", status=status)]
    metric_keys: frozenset = frozenset()

    report = audit_coverage(cartesiano=cartesiano, status_rows=status_rows, metric_keys=metric_keys)

    assert report.ok is False


def test_ok_ignora_faltantes_sem_linha_de_status_alguma() -> None:
    """Uma combinação sem NENHUMA linha em `sih_collection_status` vira `faltante`, não
    `falhou`/`nunca_tentado` -- `ok` não é derrubado por isso (é o comportamento real hoje do
    grão `municipio`, que não tem escritor de Camada 2 ainda -- ver achado documentado em
    `audit.main()`/`cobertura-final.md`)."""
    cartesiano = _cartesiano_pequeno(disease_ids=["doenca_a"], graos=["uf", "municipio"])
    status_rows = [_status_row(disease_id="doenca_a", grao="uf", status=STATUS_COLETADO)]
    metric_keys = frozenset({("doenca_a", "internacoes", "uf", "ocorrencia", 2019)})

    report = audit_coverage(cartesiano=cartesiano, status_rows=status_rows, metric_keys=metric_keys)

    assert len(report.faltantes) == 1
    assert report.ok is True


# ---------------------------------------------------------------------------
# classificar_ausencia -- a regra do D-14 isolada.
# ---------------------------------------------------------------------------


def test_classificar_ausencia_e_a_regra_do_d14() -> None:
    assert classificar_ausencia(STATUS_COLETADO) == "zero_verdadeiro"
    assert classificar_ausencia(STATUS_FALHOU) == "ausente"
    assert classificar_ausencia(STATUS_NUNCA_TENTADO) == "ausente"


# ---------------------------------------------------------------------------
# _metric_keys_grao_municipio -- fechamento da lacuna do checkpoint da Task 3 (09-12): agora que
# `upload.py --municipio` escreve Camada 2 para este grão, a auditoria precisa de uma fonte
# independente de "tem métrica" para não classificar TODA combinação de município como zero
# verdadeiro por omissão (ver docstring da função em audit.py).
# ---------------------------------------------------------------------------


def test_metric_keys_grao_municipio_com_ao_menos_um_municipio() -> None:
    linha = Row(
        disease_id="doenca_a",
        grao="municipio",
        local="ocorrencia",
        territorio_codigo="120040",
        ano=2019,
        internacoes=1,
        obitos=0,
        valor_total=10.0,
        dias_permanencia=1,
        taxa_mortalidade=0.0,
    )

    chaves = audit_mod._metric_keys_grao_municipio([linha])

    assert ("doenca_a", "internacoes", "municipio", "ocorrencia", 2019) in chaves
    assert ("doenca_a", "obitos", "municipio", "ocorrencia", 2019) in chaves
    assert ("doenca_a", "valor_total", "municipio", "ocorrencia", 2019) in chaves
    assert ("doenca_a", "dias_permanencia", "municipio", "ocorrencia", 2019) in chaves


def test_metric_keys_grao_municipio_vazio_sem_linha_alguma() -> None:
    assert audit_mod._metric_keys_grao_municipio([]) == frozenset()


def test_grao_municipio_com_status_e_sem_metrica_vira_zero_verdadeiro_nao_faltante() -> None:
    """Reproduz o cenário que motivou o fechamento da lacuna: uma vez que
    `sih_collection_status` tem uma linha `coletado` para o grão município, uma combinação sem
    NENHUM município reportando (zero nacional real, não lacuna de escritor) precisa cair em
    `zero_verdadeiro`, nunca em `faltantes` -- a mesma regra do D-14 que já vale para o grão UF."""
    cartesiano = _cartesiano_pequeno(disease_ids=["doenca_a"], graos=["municipio"])
    status_rows = [_status_row(disease_id="doenca_a", grao="municipio", status=STATUS_COLETADO)]
    metric_keys: frozenset = frozenset()  # nenhum município reportou

    report = audit_coverage(cartesiano=cartesiano, status_rows=status_rows, metric_keys=metric_keys)

    chave = ("doenca_a", "internacoes", "municipio", "ocorrencia", 2019)
    assert chave in report.zero_verdadeiro
    assert report.faltantes == ()
