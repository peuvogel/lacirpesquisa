"""Upload atômico de `sih_metric_uf` -- COPY para staging + swap transacional (D-16/D-17).

D-16: quando a reconciliação fecha, o dado do microdado substitui o do TabNet POR INTEIRO, numa
transação -- as duas fontes nunca convivem (uma série com 2013-2020 raspado e 2021-2025 agregado
tem um degrau de ~3,5% que o Prais-Winsten leria como tendência real). Não existe estado
intermediário aceitável, então o upload precisa ser tudo-ou-nada de verdade, provado por
`RAISE EXCEPTION` no verify (`scripts/catalog/generateSihSwapVerify.mjs`), não por confiança.

D-17: `COPY` para staging seguido de `swap` transacional, pela conexão Session Pooler (porta 5432,
IPv4) -- NUNCA a conexão Direct (IPv6-only no plano gratuito) nem o Transaction Pooler (porta 6543,
quebra o protocolo `COPY`). `connect()` valida host e porta ANTES de qualquer tentativa de socket:
falhar na primeira linha com a mensagem certa custa segundos; falhar no meio de uma carga longa
custaria horas (RESEARCH Pitfall 12, 09-PATTERNS.md Pattern 4).

PIPE-04/SC-4: a ordem de chamadas é o contrato -- `copy_to_staging` -> `swap` ->
`recount_via_postgrest` -> só se a contagem conferir -> `release_cache`. Nenhum caminho
alternativo chega em `release_cache` (T-09-43): o cache bruto (~10 GB) só é liberado depois que a
contagem relida da fonte SERVIDA (PostgREST, paginada -- MAPA-06/RESEARCH Pitfall 13) confere
contra o que foi de fato escrito.

T-09-42/CR-04 (08-REVIEW.md): nenhuma linha cujo `disease_id` seja um TOMBSTONE da Fase 8 entra no
`COPY` -- é exatamente a guarda que faltava no `uploadSihToSupabase.mjs` que esta fase deleta
(D-19). `TOMBSTONES` é lido de `scripts/catalog/rename-map.json` (nunca uma lista literal aqui);
`CYCLE_CANONICAL_IDS` (`hemorroidas`, `embolia_pulmonar`) são os dois ids que são ao mesmo tempo
tombstone de um `tabnetCode` e canônicos de outro hoje -- não são bloqueados.

Restrição de ORDEM (09-06, não é bloqueio de capacidade): o dimensionamento real mediu que subir a
população ANTES de `sih_metric_muni` ser evacuada (D-20, plano 09-14) faria o banco medir ~472 MB
contra o teto de 500 MB do plano gratuito -- margem de só ~28 MB. `swap()` recusa estruturalmente
rodar para qualquer tabela `sih_population_*` enquanto `sih_metric_muni` ainda existir em produção
-- ver `_assert_municipio_evacuado`. É uma checagem em tempo de execução contra o catálogo real do
banco, não um comentário: uma chamada futura de `swap()` para população não tem como pular isto.

D-17 aposenta a Edge Function de escrita anterior por REMOÇÃO -- este módulo não a referencia em
nenhuma forma (nem para chamar, nem para documentar), porque o caminho de escrita passa a ser
inteiramente este arquivo.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlsplit

import psycopg

from sih_pipeline.aggregate import GRAO_UF, Row
from sih_pipeline.codigos import UF_POR_CODIGO
from sih_pipeline.corrections import apply_corrections, load_corrections
from sih_pipeline.enumerate import expected_file_names
from sih_pipeline.ledger import STATUS_BAIXADO, FileLedger
from sih_pipeline.matcher import build_index, load_cid_map
from sih_pipeline.partitions import cid_map_version, construir_indice_territorial
from sih_pipeline.paths import cache_path, repo_root

# ---------------------------------------------------------------------------
# Conexão -- Session Pooler, nunca Direct nem Transaction Pooler (D-17).
# ---------------------------------------------------------------------------

_POOLER_HOST_MARKER = "pooler.supabase.com"
_SESSION_POOLER_PORT = 5432
_TRANSACTION_POOLER_PORT = 6543


def _validar_url_pooler(url: str) -> None:
    """Valida host e porta de `url` -- Session Pooler (porta 5432, `*.pooler.supabase.com`),
    nunca a conexão Direct (`db.*.supabase.co`, IPv6-only no plano gratuito) nem o Transaction
    Pooler (porta 6543, quebra o protocolo `COPY`). Levanta `RuntimeError` com a mensagem exata
    ANTES de qualquer tentativa de socket -- falhar cedo custa segundos, falhar no meio de uma
    carga longa custaria horas."""
    parsed = urlsplit(url)
    host = parsed.hostname or ""
    porta = parsed.port

    if _POOLER_HOST_MARKER not in host:
        raise RuntimeError(
            f"connect: host {host!r} não é o Session Pooler ({_POOLER_HOST_MARKER}) -- a conexão "
            "Direct (db.*.supabase.co) é IPv6-only no plano gratuito do Supabase (D-17, RESEARCH "
            "Pitfall 12). Use SIH_PIPELINE_DB_URL apontando para o Session Pooler, porta 5432."
        )

    if porta == _TRANSACTION_POOLER_PORT:
        raise RuntimeError(
            f"connect: porta {porta} é o Transaction Pooler -- quebra o protocolo COPY (D-17, "
            "RESEARCH Pitfall 12). Use o Session Pooler, porta 5432."
        )

    if porta != _SESSION_POOLER_PORT:
        raise RuntimeError(
            f"connect: porta {porta} inesperada -- o Session Pooler do Supabase é sempre a porta "
            f"{_SESSION_POOLER_PORT}."
        )


def connect() -> psycopg.Connection:
    """Lê `SIH_PIPELINE_DB_URL` de `.env.pipeline` (offline, nunca commitado) e conecta pelo
    Session Pooler -- a única conexão IPv4-compatível que suporta o protocolo `COPY` no plano
    gratuito do Supabase (D-17)."""
    url = os.environ["SIH_PIPELINE_DB_URL"]
    _validar_url_pooler(url)
    return psycopg.connect(url)


# ---------------------------------------------------------------------------
# Guarda de tombstone (T-09-42/CR-04) -- reproduz assertNoTombstoneRows do uploader deletado,
# lendo de rename-map.json, nunca uma lista literal aqui.
# ---------------------------------------------------------------------------


def _carregar_rename_map() -> dict[str, Any]:
    path = repo_root() / "scripts" / "catalog" / "rename-map.json"
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


_RENAME_MAP = _carregar_rename_map()

# Ids que não identificam mais nenhum agravo (D-06) -- lidos de rename-map.json, nunca digitados.
TOMBSTONES: frozenset[str] = frozenset(_RENAME_MAP["tombstones"])

_CANONICAL_BY_OLD: dict[str, str] = {r["old"]: r["canonical"] for r in _RENAME_MAP["renames"]}

# Os dois ids que são simultaneamente tombstone de um tabnetCode e canônicos de outro HOJE
# (hemorroidas, embolia_pulmonar) -- não são bloqueados. Mesma exceção de scripts/catalog/tombstones.mjs.
CYCLE_CANONICAL_IDS: frozenset[str] = frozenset(
    r["canonical"] for r in _RENAME_MAP["renames"] if r["canonical"] in _CANONICAL_BY_OLD
)


def _assert_no_tombstone_rows(linhas: Sequence[Mapping[str, Any]]) -> None:
    """Levanta `ValueError` na PRIMEIRA linha com `disease_id` tombstone -- rodada sobre TODAS as
    linhas ANTES de qualquer `cur.execute`/`COPY` (T-09-42). Respeita `CYCLE_CANONICAL_IDS`: os
    dois ids que são hoje canônicos de um agravo, mesmo tendo sido tombstone de outro, não são
    recusados -- exatamente a correção que o CR-04 do 08-REVIEW.md documentou como ausente no
    uploader Node que esta fase deleta."""
    for linha in linhas:
        disease_id = linha["disease_id"]
        if disease_id in TOMBSTONES and disease_id not in CYCLE_CANONICAL_IDS:
            raise ValueError(
                f"copy_to_staging: disease_id {disease_id!r} é um tombstone da Fase 8 (D-06) -- "
                "recusado antes de qualquer escrita (T-09-42/CR-04 do 08-REVIEW.md)."
            )


# ---------------------------------------------------------------------------
# Colunas de staging por tabela -- fonte única do que `copy_to_staging`/`swap` escrevem, na
# mesma ordem que o `COPY` grava. `sih_metric_uf` é o alvo real desta plan; as quatro tabelas de
# população entram só para que `_assert_municipio_evacuado` (restrição de ORDEM do 09-06) tenha
# como reconhecer o nome da tabela -- a carga de população em si não é escopo desta plan (09-10).
# ---------------------------------------------------------------------------

_STAGING_COLUMNS: dict[str, tuple[str, ...]] = {
    "sih_metric_uf": (
        "disease_id",
        "uf_codigo",
        "uf",
        "ano",
        "local",
        "internacoes",
        "obitos",
        "valor_total",
        "dias_permanencia",
        "taxa_mortalidade",
    ),
    "sih_population_total_uf": ("uf_codigo", "ano", "populacao"),
    "sih_population_total_muni": ("municipio_codigo", "uf_codigo", "ano", "populacao"),
    "sih_population_uf": ("uf_codigo", "ano", "sexo", "faixa_etaria", "populacao"),
    "sih_population_muni": (
        "municipio_codigo",
        "uf_codigo",
        "ano",
        "sexo",
        "faixa_etaria",
        "populacao",
    ),
}

_POPULATION_TABLES = frozenset(
    {
        "sih_population_total_uf",
        "sih_population_total_muni",
        "sih_population_uf",
        "sih_population_muni",
    }
)

_STAGING_SUFFIX = "_staging"


def row_para_staging_uf(row: Row) -> dict[str, Any]:
    """Converte uma `Row` de grão UF (`aggregate.py`/`partitions.py`) para o dict de colunas de
    `sih_metric_uf` -- a sigla (`uf`) vem de `UF_POR_CODIGO` sobre `territorio_codigo` (o código
    IBGE de 2 dígitos), nunca recomputada por outra via."""
    if row.grao != GRAO_UF:
        raise ValueError(
            f"row_para_staging_uf: linha de grão {row.grao!r} não pertence a sih_metric_uf "
            "(só grão UF entra aqui -- grão município vai para o Storage via partitions.py, D-20)."
        )
    sigla = UF_POR_CODIGO.get(row.territorio_codigo)
    if sigla is None:
        raise ValueError(
            f"row_para_staging_uf: código de UF desconhecido {row.territorio_codigo!r}"
        )
    return {
        "disease_id": row.disease_id,
        "uf_codigo": row.territorio_codigo,
        "uf": sigla,
        "ano": row.ano,
        "local": row.local,
        "internacoes": row.internacoes,
        "obitos": row.obitos,
        "valor_total": row.valor_total,
        "dias_permanencia": row.dias_permanencia,
        "taxa_mortalidade": row.taxa_mortalidade,
    }


def copy_to_staging(
    conn: psycopg.Connection, tabela: str, linhas: Sequence[Mapping[str, Any]]
) -> int:
    """`COPY` de `linhas` para `{tabela}_staging` -- cria a tabela de staging do zero (mesmas
    colunas de `tabela`, sem constraints -- velocidade; a integridade é verificada pelo
    `sih-swap-contagens.sql` DEPOIS do swap) e devolve a contagem escrita.

    Guarda de tombstone roda sobre TODAS as linhas ANTES de qualquer `cur.execute` -- uma linha
    tombstone no meio de um lote de milhares não escreve nem uma parcial (T-09-42)."""
    if tabela not in _STAGING_COLUMNS:
        raise ValueError(f"copy_to_staging: tabela desconhecida {tabela!r}")

    colunas = _STAGING_COLUMNS[tabela]
    if "disease_id" in colunas:
        _assert_no_tombstone_rows(linhas)

    staging = f"{tabela}{_STAGING_SUFFIX}"
    col_list = ", ".join(colunas)

    with conn.cursor() as cur:
        cur.execute(f"DROP TABLE IF EXISTS {staging}")
        cur.execute(f"CREATE TABLE {staging} (LIKE {tabela})")
        with cur.copy(f"COPY {staging} ({col_list}) FROM STDIN") as copy:
            for linha in linhas:
                copy.write_row(tuple(linha[coluna] for coluna in colunas))
    conn.commit()
    return len(linhas)


def _assert_municipio_evacuado(conn: psycopg.Connection) -> None:
    """Restrição de ORDEM registrada pelo 09-06 (não é bloqueio de capacidade, ver docstring do
    módulo): recusa `swap()` para qualquer tabela `sih_population_*` enquanto `sih_metric_muni`
    ainda existir em produção. Checagem em TEMPO DE EXECUÇÃO contra o catálogo real do banco
    (`information_schema.tables`), não uma convenção documentada -- a evacuação de
    `sih_metric_muni` (D-20, plano 09-14) precisa acontecer antes, ou na mesma transação, de
    qualquer upload de população."""
    with conn.cursor() as cur:
        cur.execute(
            "select exists (select 1 from information_schema.tables "
            "where table_schema = 'public' and table_name = 'sih_metric_muni')"
        )
        row = cur.fetchone()
        existe = bool(row[0]) if row is not None else False

    if existe:
        raise RuntimeError(
            "swap: sih_metric_muni ainda existe -- a evacuação do grão município (D-20, plano "
            "09-14) precisa acontecer ANTES de qualquer upload de população, ou o banco mede "
            "~472 MB contra o teto de 500 MB do plano gratuito (margem de ~28 MB, medição real "
            "do 09-06). Restrição de ORDEM, não de capacidade -- ver docstring do módulo."
        )


def swap(conn: psycopg.Connection, tabela: str) -> None:
    """Troca atômica: TRUNCATE da tabela viva + `INSERT ... SELECT` do staging + DROP do
    staging, tudo numa ÚNICA transação (D-16) -- uma exceção em qualquer ponto reverte tudo, a
    tabela viva fica exatamente como estava. `INSERT ... SELECT` (em vez de
    `ALTER TABLE ... RENAME`) foi a escolha medida: mantém as constraints/índices/policies da
    tabela viva intactos durante toda a operação, sem precisar recriá-los -- o volume real
    (dezenas de milhares de linhas) não paga o custo extra de forma perceptível.

    Nunca faz `DELETE FROM sih_disease` nem qualquer operação na tabela pai -- só TRUNCATE/INSERT
    na tabela filha (`sih_metric_uf`/população), respeitando o `ON DELETE CASCADE` que
    `sih_disease` já declara (apagar a tabela pai apagaria as métricas em cascata, sem erro)."""
    if tabela in _POPULATION_TABLES:
        _assert_municipio_evacuado(conn)

    if tabela not in _STAGING_COLUMNS:
        raise ValueError(f"swap: tabela desconhecida {tabela!r}")

    colunas = ", ".join(_STAGING_COLUMNS[tabela])
    staging = f"{tabela}{_STAGING_SUFFIX}"

    with conn.transaction():
        with conn.cursor() as cur:
            cur.execute(f"TRUNCATE TABLE {tabela}")
            cur.execute(f"INSERT INTO {tabela} ({colunas}) SELECT {colunas} FROM {staging}")
            cur.execute(f"DROP TABLE {staging}")


# ---------------------------------------------------------------------------
# PIPE-04/SC-4/MAPA-06 -- releitura paginada via PostgREST antes de liberar o cache.
# ---------------------------------------------------------------------------

_PAGE_SIZE = 1000


def _fetch(request: urllib.request.Request, timeout: int = 30) -> tuple[bytes, Mapping[str, str]]:
    """Abre a conexão de rede -- isolado para que os testes substituam sem tocar a rede (mesmo
    padrão de `partitions._fetch`/`oracle_scrape._fetch`)."""
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read(), dict(response.headers)


def _parse_content_range_total(headers: Mapping[str, str]) -> int:
    """Extrai o total anunciado de `content-range: 0-999/6481` -- levanta se o cabeçalho estiver
    ausente ou malformado (falhar alto, nunca assumir um total)."""
    valor = headers.get("content-range") or headers.get("Content-Range")
    if valor is None:
        raise RuntimeError(
            "recount_via_postgrest: resposta sem cabeçalho content-range -- não há como saber o "
            "total anunciado (MAPA-06/Pitfall 13)."
        )
    try:
        total = valor.rsplit("/", 1)[1]
        return int(total)
    except (IndexError, ValueError) as exc:
        raise RuntimeError(
            f"recount_via_postgrest: content-range malformado: {valor!r}"
        ) from exc


def recount_via_postgrest(tabela: str, filtros: Mapping[str, str] | None = None) -> int:
    """Relê a contagem de `tabela` via PostgREST, PAGINANDO explicitamente pelo cabeçalho
    `Range` -- nunca confia em HTTP 200 sozinho (PIPE-04/MAPA-06). Segue lendo página a página até
    cobrir o total anunciado em `content-range`; se a soma do que foi lido não bater com o total
    anunciado, levanta `RuntimeError` -- falhar alto em vez de truncar em silêncio é a mesma
    classe de defeito que este milestone inteiro existe para matar (1000 de 6481 linhas com HTTP
    200)."""
    supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
    service_role = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    params = {"select": "*", **dict(filtros or {})}
    query = urllib.parse.urlencode(params)

    total_lido = 0
    total_anunciado: int | None = None
    offset = 0

    while True:
        url = f"{supabase_url}/rest/v1/{tabela}?{query}"
        request = urllib.request.Request(
            url,
            method="GET",
            headers={
                "Authorization": f"Bearer {service_role}",
                "apikey": service_role,
                "Range-Unit": "items",
                "Range": f"{offset}-{offset + _PAGE_SIZE - 1}",
                "Prefer": "count=exact",
            },
        )
        body, headers = _fetch(request)
        pagina = json.loads(body)
        anunciado = _parse_content_range_total(headers)

        if total_anunciado is None:
            total_anunciado = anunciado
        elif anunciado != total_anunciado:
            raise RuntimeError(
                f"recount_via_postgrest: content-range mudou de total no meio da paginação de "
                f"{tabela!r} ({total_anunciado} -> {anunciado}) -- dado mudando sob a leitura, "
                "abortando em vez de reportar um número que pode estar errado."
            )

        total_lido += len(pagina)

        if len(pagina) < _PAGE_SIZE or total_lido >= total_anunciado:
            break
        offset += _PAGE_SIZE

    if total_anunciado is not None and total_lido != total_anunciado:
        raise RuntimeError(
            f"recount_via_postgrest: leu {total_lido} de {total_anunciado} linha(s) anunciadas em "
            f"content-range para {tabela!r} -- leitura truncada (MAPA-06/RESEARCH Pitfall 13). "
            "Nunca reportar um total que não foi de fato lido."
        )

    return total_lido


def release_cache(nomes_de_arquivo: Sequence[str]) -> None:
    """Libera (apaga) o cache bruto de `nomes_de_arquivo` -- chamada só quando
    `recount_via_postgrest` confere contra o que `copy_to_staging`/`swap` escreveram (PIPE-04/SC-4:
    copy_to_staging -> swap -> recount_via_postgrest -> só se conferir -> release_cache; ver
    `main()`). Nunca apaga um nome que o `FileLedger` local não marca `baixado` -- um nome
    ausente do ledger, ou marcado `falhou`/`nunca_tentado`, é preservado silenciosamente (T-09-43:
    apagar cedo demais custa dias de re-download). Idempotente: um arquivo já reciclado por
    `collect.py` (09-04-COLETA-INCREMENTAL) simplesmente não existe mais em disco -- `unlink`
    condicional a `exists()`, nunca um erro."""
    ledger = FileLedger.load()
    for nome in nomes_de_arquivo:
        if ledger.status(nome) != STATUS_BAIXADO:
            continue
        caminho = cache_path(f"parquet/{nome}.parquet")
        if caminho.exists():
            caminho.unlink()


# ---------------------------------------------------------------------------
# sih_collection_status -- D-13/D-14/D-15: derived_at e cid_map_version obrigatórios em toda
# linha 'coletado' (o check constraint da 09-03 recusaria None); divergência residual (D-08) vem
# de cid-divergencias.json, aprovado no checkpoint do 09-11.
# ---------------------------------------------------------------------------

_MEDIDAS: tuple[str, ...] = tuple(
    json.loads((repo_root() / "scripts" / "catalog" / "schema-v3.json").read_text("utf-8"))[
        "medidas"
    ]
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def carregar_divergencias() -> dict[str, dict[str, Any]]:
    """`diseaseId -> entrada` de `scripts/catalog/cid-divergencias.json` (aprovado no checkpoint
    do 09-11) -- a proveniência do D-08 que `sih_collection_status.divergencia_pct`/
    `divergencia_razao` carregam."""
    path = repo_root() / "scripts" / "catalog" / "cid-divergencias.json"
    with path.open("r", encoding="utf-8") as fh:
        entradas = json.load(fh)
    return {entrada["diseaseId"]: entrada for entrada in entradas}


def build_collection_status_rows(
    linhas: Sequence[Row],
    *,
    grao: str,
    ano: int,
    divergencias: Mapping[str, Mapping[str, Any]] | None = None,
    derived_at: str | None = None,
    map_version: str | None = None,
) -> list[dict[str, Any]]:
    """Monta as linhas de `sih_collection_status` para uma corrida completa (`grao`/`ano`) --
    D-13/D-14/D-15: uma linha por `(disease_id, medida, grao, local)`, SEMPRE com `derived_at` e
    `cid_map_version` (nunca `None` -- o check constraint da 09-03 recusaria a linha; provado por
    teste antes de sequer chegar no banco). `divergencia_pct`/`divergencia_razao` vêm de
    `cid-divergencias.json`, nulos para qualquer `disease_id` ausente de lá."""
    derived_at = derived_at or _now_iso()
    map_version = map_version or cid_map_version()
    divergencias = divergencias if divergencias is not None else carregar_divergencias()

    contagem_territorios: dict[tuple[str, str], int] = {}
    for linha in linhas:
        if linha.grao != grao or linha.ano != ano:
            continue
        chave = (linha.disease_id, linha.local)
        contagem_territorios[chave] = contagem_territorios.get(chave, 0) + 1

    rows: list[dict[str, Any]] = []
    for (disease_id, local), n_territorios in contagem_territorios.items():
        divergencia = divergencias.get(disease_id)
        for medida in _MEDIDAS:
            rows.append(
                {
                    "disease_id": disease_id,
                    "medida": medida,
                    "grao": grao,
                    "local": local,
                    "ano": ano,
                    "status": "coletado",
                    "derived_at": derived_at,
                    "cid_map_version": map_version,
                    "row_count": n_territorios,
                    "divergencia_pct": divergencia["deltaPctMediano"] if divergencia else None,
                    "divergencia_razao": divergencia["razao"] if divergencia else None,
                }
            )
    return rows


# ---------------------------------------------------------------------------
# CLI -- contrato único que cli.py (09-04, dono único) resolve para o subcomando `upload`.
# ---------------------------------------------------------------------------


def _carregar_index():
    cid_map = apply_corrections(load_cid_map(), load_corrections())
    return build_index(cid_map)


def _linhas_grao_uf(*, nivel: int | None) -> list[Row]:
    """Todas as linhas de grão UF do índice territorial completo (`construir_indice_territorial`,
    09-09-FIX-RESIDENCIA -- nunca `linhas_da_uf` em laço, que recomputaria o índice a cada UF).
    Filtra por `--nivel` de `scripts/catalog/collection-order.json` (D-23) quando informado."""
    index = _carregar_index()
    indice = construir_indice_territorial(index)

    disease_ids_nivel: frozenset[str] | None = None
    if nivel is not None:
        path = repo_root() / "scripts" / "catalog" / "collection-order.json"
        with path.open("r", encoding="utf-8") as fh:
            niveis = json.load(fh)
        entrada = next((n for n in niveis if n["nivel"] == nivel), None)
        if entrada is None:
            raise ValueError(f"upload: nível {nivel} não existe em collection-order.json")
        disease_ids_nivel = frozenset(entrada["diseaseIds"])

    linhas: list[Row] = []
    for _uf, (linhas_uf, _origem) in indice.items():
        for linha in linhas_uf:
            if linha.grao != GRAO_UF:
                continue
            if disease_ids_nivel is not None and linha.disease_id not in disease_ids_nivel:
                continue
            linhas.append(linha)
    return linhas


def main(argv: list[str]) -> int:
    """CLI do subcomando `upload` (contrato resolvido pelo `cli.py` do 09-04, dono único).

    PIPE-04: a ordem de chamadas é `copy_to_staging` -> `swap` -> `recount_via_postgrest` -> só
    se conferir -> `release_cache`. Nenhum caminho alternativo chega em `release_cache`."""
    parser = argparse.ArgumentParser(prog="sih_pipeline.upload")
    parser.add_argument(
        "--tabela", type=str, default="sih_metric_uf", help="tabela alvo do swap"
    )
    parser.add_argument(
        "--nivel", type=int, default=None, help="nível de collection-order.json (D-23) a subir"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="valida a conexão e monta as linhas, sem escrever nada (09-12 confere cada nível)",
    )
    args = parser.parse_args(argv)

    if args.tabela not in _STAGING_COLUMNS:
        print(
            f"upload: tabela {args.tabela!r} não suportada -- {sorted(_STAGING_COLUMNS)}",
            file=sys.stderr,
        )
        return 2

    if args.tabela != "sih_metric_uf":
        print(
            f"upload: {args.tabela!r} ainda não tem carga implementada nesta plan (09-10) -- só "
            "a validação de ordem (_assert_municipio_evacuado) está pronta.",
            file=sys.stderr,
        )
        return 2

    if args.nivel is not None and not args.dry_run:
        # swap() faz TRUNCATE da tabela viva inteira (D-16: substituição total, não incremental
        # por agravo) -- uma carga real restrita a um nível apagaria os agravos dos outros níveis
        # sem repor. --nivel só é suportado combinado com --dry-run (conferência do 09-12); uma
        # carga real por nível exigiria trocar TRUNCATE por DELETE escopado a disease_id, fora do
        # escopo desta plan (09-10 prova o swap total do D-16, não um swap incremental). Checado
        # ANTES de tocar cache/DB -- nem `_linhas_grao_uf` roda para este caminho recusado.
        print(
            "upload: --nivel só é suportado com --dry-run nesta plan -- uma carga real por nível "
            "exigiria um swap incremental (DELETE por disease_id), não o TRUNCATE total do D-16.",
            file=sys.stderr,
        )
        return 2

    # Valida a string de conexão ANTES de qualquer trabalho -- mesmo em --dry-run, para que o
    # nível fique conferido contra o mesmo contrato de credencial da carga real (09-12).
    _validar_url_pooler(os.environ["SIH_PIPELINE_DB_URL"])

    linhas = _linhas_grao_uf(nivel=args.nivel)
    staging_rows = [row_para_staging_uf(linha) for linha in linhas]

    if args.dry_run:
        diseases = {r["disease_id"] for r in staging_rows}
        print(
            f"upload: --dry-run -- {len(staging_rows)} linha(s) de {len(diseases)} agravo(s) "
            f"montada(s) para {args.tabela!r}"
            + (f" (nível {args.nivel})" if args.nivel is not None else "")
            + ", nada escrito"
        )
        return 0

    if not staging_rows:
        print("upload: nenhuma linha para subir -- nada a fazer", file=sys.stderr)
        return 0

    conn = connect()
    try:
        n_copiadas = copy_to_staging(conn, args.tabela, staging_rows)
        swap(conn, args.tabela)

        # PIPE-04: a ordem é copy_to_staging -> swap -> recount_via_postgrest -> só se conferir
        # -> release_cache. Nenhum caminho alternativo chega em release_cache (T-09-43).
        contagem_servida = recount_via_postgrest(args.tabela)
        print(
            f"upload: {n_copiadas} linha(s) copiada(s), {contagem_servida} relida(s) via PostgREST"
        )

        if contagem_servida == n_copiadas:
            esperados = expected_file_names()
            ledger = FileLedger.load()
            nao_baixados = set(ledger.pending(esperados))
            arquivos_baixados = sorted(esperados - nao_baixados)
            release_cache(arquivos_baixados)
        else:
            print(
                "upload: contagem relida não confere -- release_cache NÃO chamada (PIPE-04/SC-4)",
                file=sys.stderr,
            )
            return 1
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
