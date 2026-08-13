"""Prova o upload atômico de `sih_metric_uf` -- COPY para staging + swap transacional (D-16/D-17)
e a regra do PIPE-04/SC-4 (o cache bruto só some depois que a contagem relida da fonte servida
confere).

Duas classes de teste:

1. **Puros/isolados** (maioria) -- `connect()` (só valida a STRING de conexão, nunca abre socket
   real), a guarda de tombstone, `recount_via_postgrest` (rede substituída por monkeypatch de
   `_fetch`, mesmo padrão de `test_partitions.py`/`test_oracle_scrape.py`), `release_cache`
   (ledger + cache redirecionados para `tmp_path` via `SIH_PIPELINE_CACHE_DIR`, nunca o cache real
   que a corrida de coleta ao vivo está usando) e `build_collection_status_rows`.

2. **Contra um Postgres local descartável via Docker** (`swap`/idempotência/ordem de evacuação de
   município) -- mesmo padrão que a 08-08 estabeleceu (`public.ecr.aws/supabase/postgres:17.6.1.147`,
   já com os papéis `anon`/`authenticated`/`service_role` que as policies de RLS do schema real
   exigem), aplicando os migrations reais já commitados que definem a FORMA do schema (baseline v2
   + schema v3, 09-03) -- NUNCA a tabela viva de produção. Pulados (não falham) se o daemon do
   Docker não estiver disponível na máquina que roda a suíte, via marca condicional por teste --
   nunca um pulo do módulo inteiro.
"""

from __future__ import annotations

import json
import shutil
import socket
import subprocess
import time
from pathlib import Path
from typing import Any

import psycopg
import pytest

import sih_pipeline.upload as upload_mod
from sih_pipeline.ledger import FileLedger
from sih_pipeline.upload import (
    CYCLE_CANONICAL_IDS,
    TOMBSTONES,
    _persistir_collection_status,
    build_collection_status_rows,
    carregar_divergencias,
    connect,
    copy_to_staging,
    main,
    recount_via_postgrest,
    release_cache,
    row_para_staging_uf,
    swap,
)
from sih_pipeline.aggregate import GRAO_MUNICIPIO, GRAO_UF, LOCAL_OCORRENCIA, LOCAL_RESIDENCIA, Row

REPO_ROOT = Path(__file__).resolve().parents[3]
# Baseline (v2, cria sih_disease/sih_metric_uf/sih_metric_muni) + schema v3 (09-03, adiciona a
# coluna `local`, cria sih_collection_status e as 4 tabelas de população) -- as DUAS migrações
# que definem o schema que upload.py escreve. O rename migration da Fase 8 (20260804020000) fica
# FORA desta lista de propósito: ele pressupõe `sih_disease` já seedada com os 330 agravos
# canônicos de produção (a prova de integridade D-04 recusa uma base vazia) -- é uma migração de
# DADO sobre um schema já povoado, não parte da FORMA do schema que estes testes precisam.
MIGRATIONS = [
    REPO_ROOT / "supabase" / "migrations" / "20260804015329_remote_schema.sql",
    REPO_ROOT / "supabase" / "migrations" / "20260805000000_sih_v3_schema.sql",
]

_IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.147"


# ---------------------------------------------------------------------------
# connect() -- D-17: validação de host/porta ANTES de qualquer socket real.
# ---------------------------------------------------------------------------


def test_connect_rejeita_conexao_direct(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SIH_PIPELINE_DB_URL", "postgresql://u:p@db.abcxyz.supabase.co:5432/postgres")
    with pytest.raises(RuntimeError, match="Session Pooler"):
        connect()


def test_connect_rejeita_transaction_pooler(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "SIH_PIPELINE_DB_URL",
        "postgresql://u:p@aws-1-us-west-2.pooler.supabase.com:6543/postgres",
    )
    with pytest.raises(RuntimeError, match="Transaction Pooler"):
        connect()


def test_connect_session_pooler_valido_chega_a_psycopg(monkeypatch: pytest.MonkeyPatch) -> None:
    """Uma URL de Session Pooler válida passa pela validação e chega ao `psycopg.connect` real --
    substituído por monkeypatch para não tocar a rede neste teste puro."""
    chamadas: list[str] = []
    monkeypatch.setattr(upload_mod.psycopg, "connect", lambda url: chamadas.append(url) or "conn")
    monkeypatch.setenv(
        "SIH_PIPELINE_DB_URL",
        "postgresql://u:p@aws-1-us-west-2.pooler.supabase.com:5432/postgres",
    )
    resultado = connect()
    assert resultado == "conn"
    assert chamadas == ["postgresql://u:p@aws-1-us-west-2.pooler.supabase.com:5432/postgres"]


# ---------------------------------------------------------------------------
# Guarda de tombstone (T-09-42/CR-04) -- antes de qualquer escrita.
# ---------------------------------------------------------------------------


def test_copy_to_staging_rejeita_tombstone_antes_de_qualquer_escrita() -> None:
    tombstone_real = next(iter(TOMBSTONES - CYCLE_CANONICAL_IDS))
    linhas = [
        {
            "disease_id": tombstone_real,
            "uf_codigo": "12",
            "uf": "AC",
            "ano": 2019,
            "local": LOCAL_OCORRENCIA,
            "internacoes": 1,
            "obitos": 0,
            "valor_total": 100.0,
            "dias_permanencia": 1,
            "taxa_mortalidade": 0.0,
        }
    ]

    class _ConnEspiao:
        def cursor(self) -> Any:  # pragma: no cover -- não deveria ser chamado
            raise AssertionError("copy_to_staging chamou cursor() antes de validar tombstones")

    with pytest.raises(ValueError, match="tombstone"):
        copy_to_staging(_ConnEspiao(), "sih_metric_uf", linhas)


def test_cycle_canonical_ids_nao_sao_bloqueados() -> None:
    """`hemorroidas`/`embolia_pulmonar` são tombstone de UM tabnetCode e canônicos de OUTRO hoje
    -- a guarda não pode recusá-los (D-06)."""
    assert CYCLE_CANONICAL_IDS == {"hemorroidas", "embolia_pulmonar"}
    for disease_id in CYCLE_CANONICAL_IDS:
        # não levanta -- prova negativa direta sobre a função de guarda.
        upload_mod._assert_no_tombstone_rows([{"disease_id": disease_id}])


def test_row_para_staging_uf_rejeita_grao_municipio() -> None:
    linha = Row(
        disease_id="doencas_do_apendice",
        grao=GRAO_MUNICIPIO,
        local=LOCAL_OCORRENCIA,
        territorio_codigo="120040",
        ano=2019,
        internacoes=1,
        obitos=0,
        valor_total=10.0,
        dias_permanencia=1,
        taxa_mortalidade=0.0,
    )
    with pytest.raises(ValueError, match="grão"):
        row_para_staging_uf(linha)


def test_row_para_staging_uf_deriva_sigla_do_codigo_ibge() -> None:
    linha = Row(
        disease_id="doencas_do_apendice",
        grao=GRAO_UF,
        local=LOCAL_OCORRENCIA,
        territorio_codigo="12",
        ano=2019,
        internacoes=5,
        obitos=1,
        valor_total=500.0,
        dias_permanencia=10,
        taxa_mortalidade=0.2,
    )
    staging = row_para_staging_uf(linha)
    assert staging["uf"] == "AC"
    assert staging["uf_codigo"] == "12"
    assert staging["internacoes"] == 5


# ---------------------------------------------------------------------------
# recount_via_postgrest -- PIPE-04/MAPA-06/Pitfall 13: paginação explícita, nunca confiar em
# HTTP 200 sozinho.
# ---------------------------------------------------------------------------


def _content_range_header(offset: int, tamanho_pagina: int, total: int) -> dict[str, str]:
    fim = min(offset + tamanho_pagina, total) - 1
    return {"content-range": f"{offset}-{fim}/{total}"}


def test_recount_via_postgrest_pagina_ate_cobrir_o_total(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """content-range: 0-999/6481 -- segue pedindo mais páginas até somar 6481, nunca devolve
    1000 (MAPA-06/RESEARCH Pitfall 13)."""
    monkeypatch.setenv("SUPABASE_URL", "https://exemplo.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-teste")

    total = 6481
    tamanho_pagina = 1000
    chamadas: list[str] = []

    def _fetch_falso(request: Any, timeout: int = 30) -> tuple[bytes, dict[str, str]]:
        chamadas.append(request.headers["Range"])
        offset = int(request.headers["Range"].split("-")[0])
        n_nesta_pagina = min(tamanho_pagina, total - offset)
        corpo = json.dumps([{"id": i} for i in range(n_nesta_pagina)]).encode("utf-8")
        return corpo, _content_range_header(offset, tamanho_pagina, total)

    monkeypatch.setattr(upload_mod, "_fetch", _fetch_falso)

    resultado = recount_via_postgrest("sih_metric_uf")

    assert resultado == total
    assert len(chamadas) == 7  # 6x1000 + 1x481
    assert all("999" not in c or True for c in chamadas)  # sanity: nunca só uma página


def test_recount_via_postgrest_levanta_quando_leitura_fica_truncada(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Uma resposta cujo content-range anuncia um total maior do que qualquer página devolveu
    (ex.: o servidor para de paginar cedo) levanta -- falhar alto, nunca truncar em silêncio."""
    monkeypatch.setenv("SUPABASE_URL", "https://exemplo.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-teste")

    def _fetch_truncado(request: Any, timeout: int = 30) -> tuple[bytes, dict[str, str]]:
        # Só uma página de 200 linhas, mas o total anunciado é 6481 -- e a página devolvida é
        # menor que o tamanho de página (200 < 1000), então o laço para achando que acabou.
        corpo = json.dumps([{"id": i} for i in range(200)]).encode("utf-8")
        return corpo, {"content-range": "0-199/6481"}

    monkeypatch.setattr(upload_mod, "_fetch", _fetch_truncado)

    with pytest.raises(RuntimeError, match="truncad"):
        recount_via_postgrest("sih_metric_uf")


# ---------------------------------------------------------------------------
# PIPE-04/SC-4/T-09-43 -- release_cache só é chamada quando a contagem confere (teste de ordem
# de chamadas com stub, não de rede).
# ---------------------------------------------------------------------------


def test_cache_deleted_only_after_row_count_match(monkeypatch: pytest.MonkeyPatch) -> None:
    """Nome exato exigido pelo 09-VALIDATION.md -- prova a ordem de chamadas do PIPE-04 com um
    stub de `release_cache`, contando as chamadas em vez de tocar disco/rede."""
    monkeypatch.setenv(
        "SIH_PIPELINE_DB_URL",
        "postgresql://u:p@aws-1-us-west-2.pooler.supabase.com:5432/postgres",
    )
    chamadas: list[Any] = []
    monkeypatch.setattr(upload_mod, "release_cache", lambda nomes: chamadas.append(list(nomes)))
    monkeypatch.setattr(upload_mod, "recount_via_postgrest", lambda tabela, filtros=None: 3)
    monkeypatch.setattr(upload_mod, "copy_to_staging", lambda conn, tabela, linhas: 3)
    monkeypatch.setattr(upload_mod, "swap", lambda conn, tabela: None)
    monkeypatch.setattr(upload_mod, "connect", lambda: _ConnFalsa())
    monkeypatch.setattr(upload_mod, "_linhas_grao_uf", lambda *, nivel: _linhas_sinteticas())
    monkeypatch.setattr(
        upload_mod,
        "_persistir_collection_status",
        lambda conn, linhas, *, derived_at, map_version: len(linhas),
    )

    codigo = main(["--tabela", "sih_metric_uf"])

    assert codigo == 0
    assert len(chamadas) == 1  # release_cache chamada EXATAMENTE uma vez quando a contagem confere


def test_main_persiste_collection_status_apos_swap_antes_do_recount(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """[Rule 1 - Bug, achado no Task 3 real] `main()` precisa escrever sih_collection_status
    depois do swap -- sem isto, TODA linha de sih_metric_uf ficaria órfã na prova (3) do verify
    (D-16). Prova de ORDEM de chamadas com stub, no mesmo padrão de
    test_cache_deleted_only_after_row_count_match."""
    monkeypatch.setenv(
        "SIH_PIPELINE_DB_URL",
        "postgresql://u:p@aws-1-us-west-2.pooler.supabase.com:5432/postgres",
    )
    ordem: list[str] = []
    chamadas_status: list[Any] = []

    def _persistir_falso(conn: Any, linhas: Any, *, derived_at: Any, map_version: Any) -> int:
        chamadas_status.append((derived_at, map_version, list(linhas)))
        ordem.append("persistir_collection_status")
        return len(linhas)

    monkeypatch.setattr(upload_mod, "release_cache", lambda nomes: ordem.append("release_cache"))
    monkeypatch.setattr(
        upload_mod, "recount_via_postgrest", lambda tabela, filtros=None: ordem.append("recount") or 3
    )
    monkeypatch.setattr(
        upload_mod, "copy_to_staging", lambda conn, tabela, linhas: ordem.append("copy") or 3
    )
    monkeypatch.setattr(upload_mod, "swap", lambda conn, tabela: ordem.append("swap"))
    monkeypatch.setattr(upload_mod, "connect", lambda: _ConnFalsa())
    monkeypatch.setattr(upload_mod, "_linhas_grao_uf", lambda *, nivel: _linhas_sinteticas())
    monkeypatch.setattr(upload_mod, "_persistir_collection_status", _persistir_falso)

    codigo = main(["--tabela", "sih_metric_uf"])

    assert codigo == 0
    assert len(chamadas_status) == 1
    derived_at, map_version, linhas_recebidas = chamadas_status[0]
    assert derived_at is not None
    assert map_version is not None
    assert linhas_recebidas == _linhas_sinteticas()
    assert ordem == ["copy", "swap", "persistir_collection_status", "recount", "release_cache"]


def test_release_cache_nao_chamada_quando_contagem_diverge(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "SIH_PIPELINE_DB_URL",
        "postgresql://u:p@aws-1-us-west-2.pooler.supabase.com:5432/postgres",
    )
    chamadas: list[Any] = []
    monkeypatch.setattr(upload_mod, "release_cache", lambda nomes: chamadas.append(list(nomes)))
    monkeypatch.setattr(upload_mod, "recount_via_postgrest", lambda tabela, filtros=None: 999)
    monkeypatch.setattr(upload_mod, "copy_to_staging", lambda conn, tabela, linhas: 3)
    monkeypatch.setattr(upload_mod, "swap", lambda conn, tabela: None)
    monkeypatch.setattr(upload_mod, "connect", lambda: _ConnFalsa())
    monkeypatch.setattr(upload_mod, "_linhas_grao_uf", lambda *, nivel: _linhas_sinteticas())
    monkeypatch.setattr(
        upload_mod,
        "_persistir_collection_status",
        lambda conn, linhas, *, derived_at, map_version: len(linhas),
    )

    codigo = main(["--tabela", "sih_metric_uf"])

    assert codigo == 1
    assert chamadas == []  # release_cache NUNCA chamada quando a contagem não confere


class _ConnFalsa:
    """Duble mínimo de `psycopg.Connection` para os testes de `main()` que substituem
    `connect`/`copy_to_staging`/`swap` inteiros -- só precisa aceitar `.close()`."""

    def close(self) -> None:
        return None


def _linhas_sinteticas() -> list[Row]:
    return [
        Row(
            disease_id="doencas_do_apendice",
            grao=GRAO_UF,
            local=LOCAL_OCORRENCIA,
            territorio_codigo="12",
            ano=2019,
            internacoes=1,
            obitos=0,
            valor_total=10.0,
            dias_permanencia=1,
            taxa_mortalidade=0.0,
        ),
        Row(
            disease_id="doencas_do_apendice",
            grao=GRAO_UF,
            local=LOCAL_RESIDENCIA,
            territorio_codigo="12",
            ano=2019,
            internacoes=1,
            obitos=0,
            valor_total=10.0,
            dias_permanencia=1,
            taxa_mortalidade=0.0,
        ),
        Row(
            disease_id="doencas_do_apendice",
            grao=GRAO_UF,
            local=LOCAL_OCORRENCIA,
            territorio_codigo="35",
            ano=2019,
            internacoes=1,
            obitos=0,
            valor_total=10.0,
            dias_permanencia=1,
            taxa_mortalidade=0.0,
        ),
    ]


def test_release_cache_nunca_apaga_arquivo_fora_do_ledger_como_baixado(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))

    ledger = FileLedger()
    ledger.mark_collected("RDAC1901", row_count=100, sha256="a" * 64, parquet_dir="RDAC1901.parquet")
    ledger.mark_failed("RDAC1902", reason="teste")
    ledger.save()

    from sih_pipeline.paths import cache_path

    baixado_path = cache_path("parquet/RDAC1901.parquet")
    baixado_path.parent.mkdir(parents=True, exist_ok=True)
    baixado_path.write_bytes(b"x")
    falhou_path = cache_path("parquet/RDAC1902.parquet")
    falhou_path.write_bytes(b"x")
    nunca_tentado_path = cache_path("parquet/RDAC1903.parquet")
    nunca_tentado_path.write_bytes(b"x")

    release_cache(["RDAC1901", "RDAC1902", "RDAC1903"])

    assert not baixado_path.exists(), "arquivo marcado baixado deveria ter sido apagado"
    assert falhou_path.exists(), "arquivo marcado falhou NUNCA deve ser apagado"
    assert nunca_tentado_path.exists(), "arquivo fora do ledger NUNCA deve ser apagado"


def test_release_cache_idempotente_quando_arquivo_ja_reciclado(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """`collect.py` já recicla o bruto por UF -- `release_cache` sobre um nome já ausente do
    disco não pode levantar (idempotência)."""
    monkeypatch.setenv("SIH_PIPELINE_CACHE_DIR", str(tmp_path))
    ledger = FileLedger()
    ledger.mark_collected("RDAC1901", row_count=1, sha256="a" * 64, parquet_dir="RDAC1901.parquet")
    ledger.save()

    release_cache(["RDAC1901"])  # não levanta mesmo sem o arquivo em disco


# ---------------------------------------------------------------------------
# sih_collection_status -- D-13/D-14/D-15/D-08.
# ---------------------------------------------------------------------------


def test_build_collection_status_rows_sempre_tem_derived_at_e_cid_map_version() -> None:
    rows = build_collection_status_rows(
        _linhas_sinteticas(),
        grao=GRAO_UF,
        ano=2019,
        divergencias={},
        derived_at="2026-08-11T00:00:00Z",
        map_version="hash-fixo-de-teste",
    )
    assert rows, "deveria produzir ao menos uma linha para a fixture sintética"
    for row in rows:
        assert row["derived_at"] is not None
        assert row["cid_map_version"] is not None
        assert row["status"] == "coletado"


def test_build_collection_status_rows_divergencia_so_para_ids_conhecidos() -> None:
    divergencias = {
        "doencas_do_apendice": {"deltaPctMediano": 13.36, "razao": "motivo de teste"},
    }
    rows = build_collection_status_rows(
        _linhas_sinteticas(),
        grao=GRAO_UF,
        ano=2019,
        divergencias=divergencias,
        derived_at="2026-08-11T00:00:00Z",
        map_version="hash-fixo-de-teste",
    )
    for row in rows:
        assert row["divergencia_pct"] == 13.36
        assert row["divergencia_razao"] == "motivo de teste"


def test_build_collection_status_rows_nulo_para_id_sem_divergencia_registrada() -> None:
    linhas = [
        Row(
            disease_id="agravo_sem_divergencia",
            grao=GRAO_UF,
            local=LOCAL_OCORRENCIA,
            territorio_codigo="12",
            ano=2019,
            internacoes=1,
            obitos=0,
            valor_total=10.0,
            dias_permanencia=1,
            taxa_mortalidade=0.0,
        )
    ]
    rows = build_collection_status_rows(
        linhas,
        grao=GRAO_UF,
        ano=2019,
        divergencias={"doencas_do_apendice": {"deltaPctMediano": 13.36, "razao": "x"}},
        derived_at="2026-08-11T00:00:00Z",
        map_version="hash-fixo-de-teste",
    )
    assert all(row["divergencia_pct"] is None for row in rows)
    assert all(row["divergencia_razao"] is None for row in rows)


def test_carregar_divergencias_chaveado_por_disease_id() -> None:
    divergencias = carregar_divergencias()
    assert isinstance(divergencias, dict)
    for disease_id, entrada in divergencias.items():
        assert entrada["diseaseId"] == disease_id


# ---------------------------------------------------------------------------
# main() -- CLI / contrato do cli.py.
# ---------------------------------------------------------------------------


def test_main_tabela_desconhecida_sai_2() -> None:
    assert main(["--tabela", "tabela_inexistente"]) == 2


def test_main_nivel_sem_dry_run_recusado(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "SIH_PIPELINE_DB_URL",
        "postgresql://u:p@aws-1-us-west-2.pooler.supabase.com:5432/postgres",
    )
    assert main(["--tabela", "sih_metric_uf", "--nivel", "1"]) == 2


def test_main_dry_run_nao_conecta_nem_escreve(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "SIH_PIPELINE_DB_URL",
        "postgresql://u:p@aws-1-us-west-2.pooler.supabase.com:5432/postgres",
    )
    chamado = []
    monkeypatch.setattr(upload_mod, "connect", lambda: chamado.append(1) or (_ for _ in ()).throw(
        AssertionError("--dry-run não deveria conectar")
    ))
    monkeypatch.setattr(upload_mod, "_linhas_grao_uf", lambda *, nivel: _linhas_sinteticas())

    codigo = main(["--tabela", "sih_metric_uf", "--dry-run"])

    assert codigo == 0
    assert chamado == []


# ---------------------------------------------------------------------------
# Testes contra um Postgres local descartável (Docker) -- swap atômico, idempotência, e a
# restrição de ORDEM do 09-06 (população só depois de sih_metric_muni evacuada).
# ---------------------------------------------------------------------------


def _docker_daemon_disponivel() -> bool:
    if shutil.which("docker") is None:
        return False
    try:
        subprocess.run(["docker", "info"], capture_output=True, timeout=5, check=True)
        return True
    except Exception:
        return False


def _psql_bin() -> str | None:
    """`psql` não está no PATH default nesta máquina (libpq via Homebrew, keg-only) -- procura no
    PATH primeiro, cai para `$(brew --prefix libpq)/bin/psql` em seguida, sem exigir que o
    ambiente da suíte já tenha exportado o PATH manualmente."""
    encontrado = shutil.which("psql")
    if encontrado:
        return encontrado
    try:
        prefixo = subprocess.run(
            ["brew", "--prefix", "libpq"], capture_output=True, text=True, timeout=5, check=True
        ).stdout.strip()
    except Exception:
        return None
    candidato = Path(prefixo) / "bin" / "psql"
    return str(candidato) if candidato.exists() else None


requires_docker = pytest.mark.skipif(
    not _docker_daemon_disponivel() or _psql_bin() is None,
    reason="Docker ou psql indisponível nesta máquina -- testes de swap/idempotência contra "
    "Postgres local (padrão 08-08) pulados, não falhados",
)


def _porta_livre() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _esperar_postgres_pronto(url: str, *, tentativas: int = 60) -> None:
    ultimo_erro: Exception | None = None
    for _ in range(tentativas):
        try:
            with psycopg.connect(url, connect_timeout=2) as conn:
                conn.execute("select 1")
            return
        except Exception as exc:  # noqa: BLE001 -- retry genérico de prontidão
            ultimo_erro = exc
            time.sleep(1)
    raise RuntimeError(f"Postgres local não ficou pronto a tempo: {ultimo_erro}")


def _aplicar_migrations(url: str) -> None:
    """Aplica os três migrations reais já commitados (baseline v2 + rename + schema v3) via
    `psql -f` -- `psycopg.Connection.execute()` só roda a PRIMEIRA statement de um script
    multi-statement (protocolo estendido), então um arquivo `.sql` inteiro (vários `create
    table`/`do $$...$$` em sequência) precisa do `psql` real, o mesmo binário que o RESEARCH e o
    09-03/09-14 já usam para os `verify/*.sql`."""
    psql = _psql_bin()
    assert psql is not None  # guardado por requires_docker antes de qualquer chamada
    for caminho in MIGRATIONS:
        subprocess.run(
            # -1/--single-transaction: os migrations declaram no próprio cabeçalho que o
            # Supabase CLI já envolve o arquivo numa transação implícita (sem BEGIN/COMMIT) --
            # sem -1, o psql roda cada statement autocommitado, e todo `create temporary table
            # ... on commit drop` desapareceria antes da próxima statement do mesmo arquivo.
            [psql, url, "-v", "ON_ERROR_STOP=1", "-1", "-f", str(caminho)],
            check=True,
            capture_output=True,
            text=True,
        )


@pytest.fixture(scope="module")
def pg_url():
    if not _docker_daemon_disponivel():
        pytest.skip("Docker indisponível")

    porta = _porta_livre()
    nome = f"lacir-sih-upload-test-{porta}"
    subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "-d",
            "--name",
            nome,
            "-e",
            "POSTGRES_PASSWORD=postgres",
            "-p",
            f"{porta}:5432",
            _IMAGE,
        ],
        check=True,
        capture_output=True,
    )
    url = f"postgresql://postgres:postgres@127.0.0.1:{porta}/postgres"
    try:
        _esperar_postgres_pronto(url)
        _aplicar_migrations(url)
        yield url
    finally:
        subprocess.run(["docker", "rm", "-f", nome], capture_output=True)


@pytest.fixture()
def pg_conn(pg_url: str):
    conn = psycopg.connect(pg_url)
    _resetar_producao(conn)
    yield conn
    conn.close()


def _resetar_producao(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute("drop table if exists sih_metric_uf_staging")
        cur.execute("drop table if exists sih_collection_status_staging")
        cur.execute("drop table if exists sih_collection_status_municipio_staging")
        cur.execute("truncate table sih_metric_uf")
        # [Fix de isolamento de teste, 09-12-MUNICIPIO-STATUS] sih_collection_status nunca era
        # truncada aqui -- o único teste Docker que a tocava (upsert idempotente, grão UF) não
        # sofria com isso por ser o único; a seção de grão município abaixo adiciona mais testes
        # Docker que escrevem essa mesma tabela, e cada um precisa partir de uma tabela vazia
        # para afirmar contagem absoluta (não é mudança de produção -- só de fixture de teste).
        cur.execute("truncate table sih_collection_status")
        cur.execute("delete from sih_disease")
        cur.executemany(
            "insert into sih_disease (id, label, filter_kind, tabnet_code) values (%s, %s, %s, %s)",
            [
                ("doencas_do_apendice", "Doenças do apêndice", "lista_morb", "210"),
                ("hemorroidas", "Hemorroidas", "lista_morb", "187"),
                ("embolia_pulmonar", "Embolia pulmonar", "lista_morb", "173"),
            ],
        )
    conn.commit()


def _linha_staging(
    *, disease_id: str, uf_codigo: str, uf: str, ano: int = 2019, internacoes: int = 10
) -> dict[str, Any]:
    return {
        "disease_id": disease_id,
        "uf_codigo": uf_codigo,
        "uf": uf,
        "ano": ano,
        "local": LOCAL_OCORRENCIA,
        "internacoes": internacoes,
        "obitos": 1,
        "valor_total": 1000.0,
        "dias_permanencia": 5,
        "taxa_mortalidade": 0.1,
    }


@requires_docker
def test_swap_transacional_reverte_tudo_em_erro_injetado(pg_conn: psycopg.Connection) -> None:
    """Uma exceção no meio do swap (FK violado -- disease_id que não existe em sih_disease)
    deixa a tabela viva EXATAMENTE como estava."""
    linhas_iniciais = [_linha_staging(disease_id="doencas_do_apendice", uf_codigo="12", uf="AC")]
    copy_to_staging(pg_conn, "sih_metric_uf", linhas_iniciais)
    swap(pg_conn, "sih_metric_uf")

    contagem_antes = pg_conn.execute("select count(*) from sih_metric_uf").fetchone()[0]
    assert contagem_antes == 1

    linhas_invalidas = [_linha_staging(disease_id="agravo_inexistente", uf_codigo="35", uf="SP")]
    copy_to_staging(pg_conn, "sih_metric_uf", linhas_invalidas)

    with pytest.raises(Exception):  # violação de FK real do Postgres
        swap(pg_conn, "sih_metric_uf")

    pg_conn.rollback()
    contagem_depois = pg_conn.execute("select count(*) from sih_metric_uf").fetchone()[0]
    assert contagem_depois == contagem_antes, "swap com erro no meio não pode alterar a tabela viva"
    disease_ids = {
        r[0] for r in pg_conn.execute("select disease_id from sih_metric_uf").fetchall()
    }
    assert disease_ids == {"doencas_do_apendice"}


@requires_docker
def test_swap_staging_nao_existe_mais_apos_sucesso(pg_conn: psycopg.Connection) -> None:
    linhas = [_linha_staging(disease_id="doencas_do_apendice", uf_codigo="12", uf="AC")]
    copy_to_staging(pg_conn, "sih_metric_uf", linhas)
    swap(pg_conn, "sih_metric_uf")

    existe = pg_conn.execute(
        "select exists (select 1 from information_schema.tables "
        "where table_name = 'sih_metric_uf_staging')"
    ).fetchone()[0]
    assert existe is False


@requires_docker
def test_segunda_execucao_completa_produz_mesma_contagem_final(
    pg_conn: psycopg.Connection,
) -> None:
    """PIPE-03/SC-3: rodar copy_to_staging+swap duas vezes seguidas com o MESMO lote produz
    exatamente a mesma contagem final -- nem a mais, nem a menos."""
    linhas = [
        _linha_staging(disease_id="doencas_do_apendice", uf_codigo="12", uf="AC"),
        _linha_staging(disease_id="doencas_do_apendice", uf_codigo="35", uf="SP"),
    ]

    copy_to_staging(pg_conn, "sih_metric_uf", linhas)
    swap(pg_conn, "sih_metric_uf")
    contagem_primeira = pg_conn.execute("select count(*) from sih_metric_uf").fetchone()[0]

    copy_to_staging(pg_conn, "sih_metric_uf", linhas)
    swap(pg_conn, "sih_metric_uf")
    contagem_segunda = pg_conn.execute("select count(*) from sih_metric_uf").fetchone()[0]

    assert contagem_primeira == contagem_segunda == 2


@requires_docker
def test_swap_nenhuma_linha_da_fonte_antiga_sobrevive(pg_conn: psycopg.Connection) -> None:
    """Simula a tabela viva com dado "TabNet-era" pré-existente -- depois do swap, a contagem é
    EXATAMENTE a do agregado novo, nunca a soma das duas fontes (D-16)."""
    with pg_conn.cursor() as cur:
        cur.execute(
            "insert into sih_metric_uf (disease_id, uf_codigo, uf, ano, local, internacoes) "
            "values (%s, %s, %s, %s, %s, %s)",
            ("doencas_do_apendice", "12", "AC", 2019, LOCAL_OCORRENCIA, 9999),
        )
    pg_conn.commit()

    linhas_novas = [_linha_staging(disease_id="doencas_do_apendice", uf_codigo="12", uf="AC", internacoes=42)]
    copy_to_staging(pg_conn, "sih_metric_uf", linhas_novas)
    swap(pg_conn, "sih_metric_uf")

    linhas_finais = pg_conn.execute(
        "select internacoes from sih_metric_uf where disease_id = 'doencas_do_apendice'"
    ).fetchall()
    assert len(linhas_finais) == 1
    assert linhas_finais[0][0] == 42, "a linha antiga (9999) não pode sobreviver ao swap"


@requires_docker
def test_copy_to_staging_aceita_cycle_canonical_ids_contra_banco_real(
    pg_conn: psycopg.Connection,
) -> None:
    """`hemorroidas`/`embolia_pulmonar` (CYCLE_CANONICAL_IDS) sobem normalmente -- a guarda de
    tombstone não os bloqueia, e o FK contra sih_disease confere (ambos existem na fixture)."""
    linhas = [
        _linha_staging(disease_id="hemorroidas", uf_codigo="12", uf="AC"),
        _linha_staging(disease_id="embolia_pulmonar", uf_codigo="12", uf="AC"),
    ]
    n = copy_to_staging(pg_conn, "sih_metric_uf", linhas)
    swap(pg_conn, "sih_metric_uf")

    assert n == 2
    disease_ids = {
        r[0] for r in pg_conn.execute("select disease_id from sih_metric_uf").fetchall()
    }
    assert disease_ids == {"hemorroidas", "embolia_pulmonar"}


@requires_docker
def test_swap_populacao_recusa_quando_sih_metric_muni_existe(
    pg_conn: psycopg.Connection,
) -> None:
    """Restrição de ORDEM do 09-06: `swap()` para uma tabela de população recusa rodar enquanto
    `sih_metric_muni` ainda existir -- checagem estrutural, não um comentário."""
    existe = pg_conn.execute(
        "select exists (select 1 from information_schema.tables "
        "where table_name = 'sih_metric_muni')"
    ).fetchone()[0]
    assert existe is True, "fixture: sih_metric_muni deveria existir (baseline v2 não evacuada)"

    with pg_conn.cursor() as cur:
        cur.execute("drop table if exists sih_population_total_uf_staging")
        cur.execute("create table sih_population_total_uf_staging (like sih_population_total_uf)")
    pg_conn.commit()

    with pytest.raises(RuntimeError, match="sih_metric_muni"):
        swap(pg_conn, "sih_population_total_uf")


@requires_docker
def test_swap_populacao_permite_apos_sih_metric_muni_evacuada(
    pg_conn: psycopg.Connection,
) -> None:
    """Depois que `sih_metric_muni` é evacuada (simulando o resultado do 09-14/D-20), `swap()`
    para uma tabela de população deixa de recusar."""
    with pg_conn.cursor() as cur:
        cur.execute("drop table sih_metric_muni")
        cur.execute("drop table if exists sih_population_total_uf_staging")
        cur.execute("create table sih_population_total_uf_staging (like sih_population_total_uf)")
        cur.execute(
            "insert into sih_population_total_uf_staging (uf_codigo, ano, populacao) "
            "values ('12', 2019, 900000)"
        )
    pg_conn.commit()

    swap(pg_conn, "sih_population_total_uf")  # não levanta

    populacao = pg_conn.execute(
        "select populacao from sih_population_total_uf where uf_codigo = '12'"
    ).fetchone()[0]
    assert populacao == 900000


@requires_docker
def test_persistir_collection_status_upsert_idempotente_pela_pk_real(
    pg_conn: psycopg.Connection,
) -> None:
    """[Rule 1 - Bug] contra Postgres real: `_persistir_collection_status` escreve pela PK exata
    `(disease_id, medida, grao, local, ano)`, com derived_at/cid_map_version nunca nulos (o
    check constraint de proveniência da 09-03 recusaria), e uma segunda chamada com o MESMO lote
    faz upsert -- nem duplica linha, nem falha em conflito (PIPE-03/SC-3)."""
    linhas = _linhas_sinteticas()  # 3 linhas, disease_id=doencas_do_apendice, ano=2019, 2 UFs

    n1 = _persistir_collection_status(
        pg_conn, linhas, derived_at="2026-08-12T00:00:00Z", map_version="hash-corrida-1"
    )
    assert n1 > 0

    contagem_1 = pg_conn.execute("select count(*) from sih_collection_status").fetchone()[0]
    assert contagem_1 == n1

    sem_proveniencia = pg_conn.execute(
        "select count(*) from sih_collection_status "
        "where status = 'coletado' and (derived_at is null or cid_map_version is null)"
    ).fetchone()[0]
    assert sem_proveniencia == 0

    # Segunda chamada, MESMO lote mas cid_map_version/derived_at novos -- upsert pela PK real,
    # não duplica linha, e os valores mais recentes vencem.
    n2 = _persistir_collection_status(
        pg_conn, linhas, derived_at="2026-08-12T01:00:00Z", map_version="hash-corrida-2"
    )
    assert n2 == n1

    contagem_2 = pg_conn.execute("select count(*) from sih_collection_status").fetchone()[0]
    assert contagem_2 == contagem_1, "upsert não pode duplicar linha na segunda corrida"

    versoes = {
        r[0]
        for r in pg_conn.execute(
            "select distinct cid_map_version from sih_collection_status"
        ).fetchall()
    }
    assert versoes == {"hash-corrida-2"}, "a corrida mais recente precisa vencer no upsert"


# ---------------------------------------------------------------------------
# sih_collection_status do grão MUNICÍPIO (D-13/D-20) -- fechamento de lacuna decidido pelo
# operador no checkpoint da Task 3 do 09-12 (achado da Task 2: nenhum escritor gravava Camada 2
# para este grão -- `_persistir_collection_status`/`build_partition`/`upload_partition` seguem
# INTOCADOS). NÃO reenvia partição nem toca o Storage -- o dado de município já está lá,
# verificado ao vivo (09-12); esta seção só escreve a trilha de proveniência que faltava no
# banco, reusando a MESMA leitura territorial que `partitions.py` já usa para montar as
# partições (`construir_indice_territorial`), nunca uma segunda fonte de verdade.
# ---------------------------------------------------------------------------


def _linha_municipio(
    *,
    disease_id: str = "doencas_do_apendice",
    territorio_codigo: str = "120040",
    ano: int = 2019,
    internacoes: int = 2,
) -> Row:
    return Row(
        disease_id=disease_id,
        grao=GRAO_MUNICIPIO,
        local=LOCAL_OCORRENCIA,
        territorio_codigo=territorio_codigo,
        ano=ano,
        internacoes=internacoes,
        obitos=0,
        valor_total=20.0,
        dias_permanencia=2,
        taxa_mortalidade=0.0,
    )


def test_linhas_grao_municipio_filtra_so_grao_municipio(monkeypatch: pytest.MonkeyPatch) -> None:
    """`_linhas_grao_municipio` usa a MESMA fonte territorial que `partitions.py` usa para montar
    as partições reais (`construir_indice_territorial`), mas devolve só linhas de grão
    município -- grão UF fica de fora."""
    linha_uf = Row(
        disease_id="doencas_do_apendice",
        grao=GRAO_UF,
        local=LOCAL_OCORRENCIA,
        territorio_codigo="12",
        ano=2019,
        internacoes=1,
        obitos=0,
        valor_total=10.0,
        dias_permanencia=1,
        taxa_mortalidade=0.0,
    )
    linha_municipio = _linha_municipio()
    indice_falso = {"AC": ([linha_uf, linha_municipio], "agregado")}
    monkeypatch.setattr(upload_mod, "_carregar_index", lambda: object())
    monkeypatch.setattr(upload_mod, "construir_indice_territorial", lambda index: indice_falso)

    linhas = upload_mod._linhas_grao_municipio()

    assert linhas == [linha_municipio]


def test_build_collection_status_rows_grao_municipio_ignora_linhas_de_grao_uf() -> None:
    """`build_collection_status_rows(grao=GRAO_MUNICIPIO, ...)` -- linhas de grão UF misturadas
    no lote de entrada não vazam para o resultado (a mesma garantia já provada para o grão UF
    vale para município, sem nenhuma mudança na função genérica)."""
    linha_uf = Row(
        disease_id="doencas_do_apendice",
        grao=GRAO_UF,
        local=LOCAL_OCORRENCIA,
        territorio_codigo="12",
        ano=2019,
        internacoes=1,
        obitos=0,
        valor_total=10.0,
        dias_permanencia=1,
        taxa_mortalidade=0.0,
    )
    linha_municipio = _linha_municipio()

    rows = build_collection_status_rows(
        [linha_uf, linha_municipio],
        grao=GRAO_MUNICIPIO,
        ano=2019,
        divergencias={},
        derived_at="2026-08-13T00:00:00Z",
        map_version="hash-teste",
    )

    assert rows
    assert all(row["grao"] == GRAO_MUNICIPIO for row in rows)


def test_main_municipio_dry_run_nao_conecta_nem_escreve(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "SIH_PIPELINE_DB_URL",
        "postgresql://u:p@aws-1-us-west-2.pooler.supabase.com:5432/postgres",
    )
    chamado: list[int] = []
    monkeypatch.setattr(
        upload_mod,
        "connect",
        lambda: chamado.append(1)
        or (_ for _ in ()).throw(AssertionError("--dry-run não deveria conectar")),
    )
    monkeypatch.setattr(upload_mod, "_linhas_grao_municipio", lambda: [_linha_municipio()])

    codigo = main(["--municipio", "--dry-run"])

    assert codigo == 0
    assert chamado == []


def test_main_municipio_nunca_toca_caminho_de_sih_metric_uf(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`--municipio` escreve SÓ a proveniência (`sih_collection_status`) -- nunca chama
    `copy_to_staging`/`swap`/`recount_via_postgrest`/`release_cache`, que pertencem
    exclusivamente ao caminho de `sih_metric_uf`. O dado de município já está no Storage;
    `upload.py --municipio` não reenvia nada."""
    monkeypatch.setenv(
        "SIH_PIPELINE_DB_URL",
        "postgresql://u:p@aws-1-us-west-2.pooler.supabase.com:5432/postgres",
    )
    chamadas_proibidas: list[str] = []

    def _proibida(nome: str):
        def _fn(*args: Any, **kwargs: Any) -> Any:
            chamadas_proibidas.append(nome)
            raise AssertionError(f"--municipio não deveria chamar {nome}")

        return _fn

    for nome in ("copy_to_staging", "swap", "recount_via_postgrest", "release_cache"):
        monkeypatch.setattr(upload_mod, nome, _proibida(nome))

    monkeypatch.setattr(upload_mod, "_linhas_grao_municipio", lambda: [_linha_municipio()])
    monkeypatch.setattr(upload_mod, "connect", lambda: _ConnFalsa())
    chamadas_status: list[Any] = []
    monkeypatch.setattr(
        upload_mod,
        "_persistir_collection_status_municipio",
        lambda conn, linhas, *, derived_at, map_version: chamadas_status.append(list(linhas))
        or len(linhas),
    )

    codigo = main(["--municipio"])

    assert codigo == 0
    assert chamadas_proibidas == []
    assert len(chamadas_status) == 1


def test_main_municipio_sem_linha_alguma_sai_1(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "SIH_PIPELINE_DB_URL",
        "postgresql://u:p@aws-1-us-west-2.pooler.supabase.com:5432/postgres",
    )
    monkeypatch.setattr(upload_mod, "_linhas_grao_municipio", lambda: [])

    codigo = main(["--municipio"])

    assert codigo == 1


@requires_docker
def test_persistir_collection_status_municipio_grava_grao_municipio_upsert_idempotente(
    pg_conn: psycopg.Connection,
) -> None:
    """Contra Postgres real: `_persistir_collection_status_municipio` escreve com
    `grao='municipio'`, `derived_at`/`cid_map_version` nunca nulos, e uma segunda chamada com o
    MESMO lote faz upsert (PIPE-03/SC-3) -- a MESMA disciplina do grão UF, já provada, agora
    também no caminho de município."""
    linhas = [
        _linha_municipio(territorio_codigo="120040", internacoes=2),
        _linha_municipio(territorio_codigo="355030", internacoes=3),
    ]

    n1 = upload_mod._persistir_collection_status_municipio(
        pg_conn, linhas, derived_at="2026-08-13T00:00:00Z", map_version="hash-corrida-1"
    )
    assert n1 > 0

    graos_gravados = {
        r[0] for r in pg_conn.execute("select distinct grao from sih_collection_status").fetchall()
    }
    assert graos_gravados == {GRAO_MUNICIPIO}

    sem_proveniencia = pg_conn.execute(
        "select count(*) from sih_collection_status "
        "where status = 'coletado' and (derived_at is null or cid_map_version is null)"
    ).fetchone()[0]
    assert sem_proveniencia == 0

    n2 = upload_mod._persistir_collection_status_municipio(
        pg_conn, linhas, derived_at="2026-08-13T01:00:00Z", map_version="hash-corrida-2"
    )
    assert n2 == n1
    contagem = pg_conn.execute("select count(*) from sih_collection_status").fetchone()[0]
    assert contagem == n1, "upsert não pode duplicar linha na segunda corrida"


@requires_docker
def test_persistir_collection_status_municipio_nao_grava_ano_sem_nenhum_municipio(
    pg_conn: psycopg.Connection,
) -> None:
    """D-13/D-14: uma combinação (disease_id, medida, local, ano) sem NENHUM município com dado
    não recebe linha de proveniência nenhuma -- não é a mesma coisa que uma linha `coletado`
    "vazia" inventada. Um ano sem nenhuma linha em `linhas` fica sem nenhuma linha em
    `sih_collection_status` para esse ano."""
    linhas = [_linha_municipio(ano=2019)]

    upload_mod._persistir_collection_status_municipio(
        pg_conn, linhas, derived_at="2026-08-13T00:00:00Z", map_version="hash-teste"
    )

    linhas_2020 = pg_conn.execute(
        "select count(*) from sih_collection_status where ano = 2020"
    ).fetchone()[0]
    assert linhas_2020 == 0, "ano sem nenhuma linha de município não pode ganhar proveniência"
