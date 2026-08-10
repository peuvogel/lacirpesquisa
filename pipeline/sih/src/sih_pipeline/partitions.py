"""Produtor das partições de município para o Supabase Storage — D-20/D-21.

O grão município deixa de morar no Postgres (319 MB medidos só com 93/331 agravos e um local
-- CONTEXT §"Restrição dura") e passa a ser servido como 27 arquivos `.json.gz`, um por UF, do
bucket `sih-municipio`. Um drill baixa uma UF uma vez e toda exploração naquela UF (trocar
agravo, ano, medida, comparar `ocorrencia`/`residencia`) fica instantânea e offline (D-21).

Formato: JSON colunar (arrays paralelos), não array de objetos -- um array de objetos repetiria
os nove nomes de coluna em cada uma das centenas de milhares de linhas de uma UF grande, e é
exatamente o custo que o gzip disfarça mas o `JSON.parse` do navegador não.

RESEARCH Pitfall 11: o SDK `supabase-js` não suporta a opção de compressão do servidor no
`upload()` (issue aberta, supabase/supabase-js#1883). `upload_partition` nunca depende disso --
sobe o `.json.gz` como blob opaco (`content-type: application/octet-stream`) e a descompressão é
responsabilidade explícita do cliente (`DecompressionStream('gzip')`, Task 3 desta plan).

`build_partition` recebe um parâmetro `familia`, default `"metrica"`. A família `"populacao"`
(`v1/pop/{sigla}.json.gz`, colunas `municipio_codigo`/`ano`/`sexo`/`faixa_etaria`/`populacao`) só
seria produzida se o checkpoint do 09-06 tivesse escolhido `popsvs-estratificado-no-storage` --
o operador confirmou `popsvs-no-banco` (ver `pipeline/sih/reports/populacao-dimensionamento.md`
§"Decisão do operador"), então essa família nunca é gerada em produção; o parâmetro existe e o
default é testado mesmo assim, exatamente como o plano pede.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import sys
import urllib.request
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sih_pipeline.aggregate import GRAO_MUNICIPIO, Row, aggregate_years
from sih_pipeline.codigos import UF_POR_CODIGO, uf_de_municipio
from sih_pipeline.corrections import CORRECTIONS_PATH, apply_corrections, load_corrections
from sih_pipeline.enumerate import UFS
from sih_pipeline.matcher import LISTA_MORB_CID_PATH, build_index, load_cid_map
from sih_pipeline.paths import cache_path

BUCKET = "sih-municipio"
PARTITION_PREFIX = "v1"

SCHEMA_VERSION = 1

# Ordem fixa e declarada (bloco <interfaces> da plan 09-09) -- mudar a ordem sem mudar
# `SCHEMA_VERSION` quebra o contrato com o consumidor TypeScript (Task 3).
COLUNAS_METRICA: tuple[str, ...] = (
    "disease_id",
    "municipio_codigo",
    "ano",
    "local",
    "internacoes",
    "obitos",
    "valor_total",
    "dias_permanencia",
    "taxa_mortalidade",
)

# Só produzida se o 09-06 tivesse escolhido `popsvs-estratificado-no-storage` -- não é o caminho
# real desta execução (`popsvs-no-banco` confirmado), mas o parâmetro `familia` precisa aceitar
# e testar o default mesmo assim.
COLUNAS_POPULACAO: tuple[str, ...] = (
    "municipio_codigo",
    "ano",
    "sexo",
    "faixa_etaria",
    "populacao",
)

_FAMILIAS: dict[str, tuple[str, ...]] = {
    "metrica": COLUNAS_METRICA,
    "populacao": COLUNAS_POPULACAO,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def cid_map_version() -> str:
    """Hash estável (sha256, hexdigest completo) sobre `lista-morb-cid.json` + `cid-corrections.json`
    -- "a versão do mapa CID que produziu a métrica" que o SC-6 pede (DATA-04). Muda sempre que
    qualquer uma das duas fontes mudar.

    `upload.py` (09-10) precisa chamar exatamente esta função para gravar
    `sih_collection_status.cid_map_version` -- dois cálculos divergentes seriam pior que nenhum.
    """
    h = hashlib.sha256()
    h.update(LISTA_MORB_CID_PATH.read_bytes())
    h.update(CORRECTIONS_PATH.read_bytes())
    return h.hexdigest()


def build_partition(uf: str, rows: Sequence[Row], *, familia: str = "metrica") -> dict[str, Any]:
    """Monta o payload colunar de uma UF -- arrays paralelos, uma lista por coluna, todas do
    mesmo comprimento (igual ao número de linhas).

    `rows` precisa ser só do grão município e só da UF pedida (`familia="metrica"`) -- qualquer
    linha fora disso levanta `ValueError`, porque uma partição misturada quebraria a garantia de
    "um download serve toda a UF" que o D-21 promete. Uma UF sem nenhuma linha também levanta:
    as 27 UFs sempre têm dado real, então uma partição vazia é falha, não zero.

    `taxa_mortalidade` viaja como está em `Row` (nunca coagida para `0`) -- `None` continua
    `None`.
    """
    if familia not in _FAMILIAS:
        raise ValueError(
            f"build_partition: familia desconhecida {familia!r} -- esperado um de "
            f"{sorted(_FAMILIAS)}"
        )
    colunas = _FAMILIAS[familia]

    if not rows:
        raise ValueError(
            f"build_partition: UF {uf!r} (familia={familia!r}) sem nenhuma linha -- as 27 UFs "
            "sempre têm dado; uma partição vazia é falha, não zero."
        )

    dados: list[list[Any]] = [[] for _ in colunas]

    if familia == "metrica":
        for linha in rows:
            if not isinstance(linha, Row):
                raise TypeError(
                    f"build_partition: familia 'metrica' espera sih_pipeline.aggregate.Row, "
                    f"recebeu {type(linha)!r}"
                )
            if linha.grao != GRAO_MUNICIPIO:
                raise ValueError(
                    f"build_partition: linha de grão {linha.grao!r} não pertence a uma "
                    "partição de município (D-20) -- só grão município entra aqui."
                )
            linha_uf_sigla = UF_POR_CODIGO.get(uf_de_municipio(linha.territorio_codigo))
            if linha_uf_sigla != uf:
                raise ValueError(
                    f"build_partition: linha da UF {linha_uf_sigla!r} não pertence à partição "
                    f"pedida ({uf!r}) -- uma partição contém só a UF pedida."
                )
            valores: tuple[Any, ...] = (
                linha.disease_id,
                linha.territorio_codigo,
                linha.ano,
                linha.local,
                linha.internacoes,
                linha.obitos,
                linha.valor_total,
                linha.dias_permanencia,
                linha.taxa_mortalidade,
            )
            for coluna_lista, valor in zip(dados, valores):
                coluna_lista.append(valor)
    else:
        # familia == "populacao" -- caminho não exercitado em produção (popsvs-no-banco
        # confirmado); genérico via atributo nomeado para não amarrar a um tipo concreto que
        # population.py (09-06) não exporta hoje.
        for linha in rows:
            valores = tuple(getattr(linha, campo) for campo in colunas)
            for coluna_lista, valor in zip(dados, valores):
                coluna_lista.append(valor)

    return {
        "schema": SCHEMA_VERSION,
        "uf": uf,
        "colunas": list(colunas),
        "dados": dados,
        "derivedAt": _now_iso(),
        "cidMapVersion": cid_map_version(),
    }


def _local_relative_path(uf: str, *, familia: str = "metrica") -> str:
    if familia == "metrica":
        return f"particoes/{uf}.json.gz"
    return f"particoes/pop/{uf}.json.gz"


def write_partition(uf: str, payload: dict[str, Any], *, familia: str = "metrica") -> Path:
    """Serializa `payload` (a saída de `build_partition`) como JSON UTF-8 e grava comprimido
    (gzip) em `cache_path("particoes")` -- nunca fora do cache (T-09-08).

    `mtime=0` no gzip torna a saída determinística byte a byte entre execuções idênticas (o
    timestamp do gzip não entra na comparação de conteúdo do teste).
    """
    destino = cache_path(_local_relative_path(uf, familia=familia))
    corpo = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    comprimido = gzip.compress(corpo, compresslevel=9, mtime=0)
    destino.write_bytes(comprimido)
    return destino


def _object_key(uf: str, *, familia: str = "metrica") -> str:
    if familia == "metrica":
        return f"{PARTITION_PREFIX}/{uf}.json.gz"
    return f"{PARTITION_PREFIX}/pop/{uf}.json.gz"


def _fetch(request: urllib.request.Request, timeout: int) -> bytes:
    """Abre a conexão de rede -- isolado para que os testes substituam sem tocar a rede (mesmo
    padrão de `oracle_scrape._fetch`)."""
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def upload_partition(path: Path, uf: str, *, familia: str = "metrica", timeout: int = 60) -> None:
    """PUT (via `POST` + `x-upsert: true`, semântica de upload do Storage) do `.json.gz` já
    gravado por `write_partition`, autenticado com `service_role` (nunca a chave anon -- só o
    pipeline escreve, o app só lê).

    Sobe como blob opaco (`content-type: application/octet-stream`); nunca seta nem depende do
    cabeçalho HTTP de compressão do servidor -- ver docstring do módulo (RESEARCH Pitfall 11).
    A descompressão é responsabilidade explícita do cliente (Task 3).
    """
    supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
    service_role = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    url = f"{supabase_url}/storage/v1/object/{BUCKET}/{_object_key(uf, familia=familia)}"
    corpo = path.read_bytes()
    request = urllib.request.Request(
        url,
        data=corpo,
        method="POST",
        headers={
            "Authorization": f"Bearer {service_role}",
            "apikey": service_role,
            "content-type": "application/octet-stream",
            "x-upsert": "true",
        },
    )
    _fetch(request, timeout)


def _linhas_municipio_por_uf(linhas: list[Row]) -> dict[str, list[Row]]:
    """Agrupa as linhas de grão município já agregadas por sigla de UF (`UF_POR_CODIGO` sobre o
    código de 2 dígitos que `uf_de_municipio` extrai de `territorio_codigo`) -- o grão UF é
    ignorado aqui, ele já mora no Postgres (D-20). Chaveado por sigla porque é assim que
    `build_partition`/`UFS`/`--uf` da CLI identificam uma UF."""
    grupos: dict[str, list[Row]] = {}
    for linha in linhas:
        if linha.grao != GRAO_MUNICIPIO:
            continue
        sigla = UF_POR_CODIGO[uf_de_municipio(linha.territorio_codigo)]
        grupos.setdefault(sigla, []).append(linha)
    return grupos


def main(argv: list[str]) -> int:
    """CLI do subcomando `partitions` (contrato resolvido pelo `cli.py` do 09-04, dono único)."""
    parser = argparse.ArgumentParser(prog="sih_pipeline.partitions")
    parser.add_argument("--uf", type=str, default=None, help="gera só uma UF (ex.: AC)")
    parser.add_argument("--todas", action="store_true", help="gera as 27 UFs")
    parser.add_argument(
        "--upload", action="store_true", help="sobe cada partição gravada ao Storage"
    )
    args = parser.parse_args(argv)

    if not args.uf and not args.todas:
        print("partitions: informe --uf SIGLA ou --todas", file=sys.stderr)
        return 2

    parquet_root = cache_path("parquet")
    if not parquet_root.exists() or not any(parquet_root.iterdir()):
        print("partitions: nenhum parquet em cache_path('parquet') -- nada a particionar")
        return 0

    cid_map = apply_corrections(load_cid_map(), load_corrections())
    index = build_index(cid_map)
    linhas = aggregate_years(parquet_root, index)
    grupos = _linhas_municipio_por_uf(linhas)

    alvo_ufs = list(UFS) if args.todas else [args.uf]
    for uf in alvo_ufs:
        rows = grupos.get(uf, [])
        if not rows:
            print(f"partitions: UF {uf} sem linha agregada em cache -- pulando")
            continue
        payload = build_partition(uf, rows)
        destino = write_partition(uf, payload)
        print(f"partitions: {uf} -> {destino} ({len(rows)} linha(s))")
        if args.upload:
            upload_partition(destino, uf)
            print(f"partitions: {uf} enviado ao Storage ({BUCKET}/{_object_key(uf)})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
