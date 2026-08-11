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

**Adaptação 2026-08-11 (09-09-ADAPTACAO-AGREGADOS, ad-hoc, handoff aberto pelo
09-04-COLETA-INCREMENTAL).** `collect.py` agora recicla (apaga) o parquet BRUTO de cada UF logo
depois de persistir o agregado pequeno em `cache_path("agregados/{uf}.parquet")`. `linhas_da_uf`
é a função que fecha esse handoff: para uma UF pedida, prioriza o agregado persistido (pequeno,
rápido, sobrevive à reciclagem) e só cai para o parquet bruto -- sempre ISOLADO a essa UF, nunca
`cache_path("parquet")` inteira, que pode ter sobras de outras UFs ainda não recicladas -- quando
o agregado ainda não existe. Uma UF sem nenhum dos dois é estado NORMAL (a corrida de coleta
processa 27 UFs uma de cada vez), nunca erro.

**Achado real, não corrigido aqui (fora do escopo desta adaptação -- `collect.py` é módulo vivo,
intocável durante a corrida em produção):** o isolamento por UF de `collect.py`
(`_aggregate_uf`, só os arquivos `RD{uf}*`) captura cada hospitalização pela UF onde ela
OCORREU, incluindo as linhas de grão-município `local=residencia` cujo `MUNIC_RES` aponta para
OUTRA UF (D-09: paciente internado numa UF pode residir em outra). Isso significa que o
agregado de uma UF X carrega alguma residência de fora de X (descartada por `build_partition`,
correto -- não pertence à partição de X) MAS a residência de X capturada dentro do agregado de
uma UF Y (paciente de X internado em Y) fica presa em `agregados/Y.parquet` e nunca chega à
partição de X, que só lê `agregados/X.parquet`. Medido ao vivo nesta adaptação (parquet bruto
real, AC e SP, ainda em cache): SP tem 192 registros de residência do AC presos no arquivo bruto
de SP (paciente internado em SP, mora no AC); AC tem 11 registros de residência de SP presos no
arquivo bruto do AC -- de 53.381 e 2.606.482 registros totais respectivamente, uma fração
pequena mas real. É uma característica arquitetural do isolamento por UF do `collect.py`
(09-04-COLETA-INCREMENTAL), não uma regressão desta adaptação: mesmo a leitura antiga (a pasta
`cache_path("parquet")` inteira) só capturava isso quando TODAS as 27 UFs estavam simultaneamente
em cache -- o que o disco do operador nunca permitiu (a razão de `collect.py` existir). Registrado
como achado real para decisão futura (ex.: reagregar `agregados/*.parquet` inteiro depois da
corrida completa, se a completude de residência cross-UF for exigida) -- não resolvido aqui.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import sys
import tempfile
import urllib.request
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

from sih_pipeline.aggregate import GRAO_MUNICIPIO, Row, aggregate_years
from sih_pipeline.codigos import UF_POR_CODIGO, uf_de_municipio
from sih_pipeline.corrections import CORRECTIONS_PATH, apply_corrections, load_corrections
from sih_pipeline.enumerate import UFS
from sih_pipeline.matcher import CidIndex, LISTA_MORB_CID_PATH, build_index, load_cid_map
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


# ---------------------------------------------------------------------------
# Fonte de dado por UF: agregado persistido (prioridade) ou parquet bruto isolado (fallback) --
# ver docstring do módulo, seção "Adaptação 2026-08-11".
# ---------------------------------------------------------------------------

# Schema esperado de cache_path("agregados/{uf}.parquet") -- derivado de Row._fields (fonte
# única), nunca um literal solto: se `collect.py` alguma vez persistir colunas diferentes, a
# comparação em `_linhas_do_agregado_persistido` detecta a divergência e levanta, em vez de
# coagir por posição silenciosamente.
_AGREGADOS_COLUMNS: tuple[str, ...] = tuple(Row._fields)


def _linhas_do_agregado_persistido(uf: str) -> list[Row] | None:
    """Lê `cache_path("agregados/{uf}.parquet")` -- o agregado pequeno e durável que
    `collect.py` (09-04-COLETA-INCREMENTAL) persiste antes de reciclar o parquet bruto da UF.

    Devolve `None` (estado NORMAL, nunca erro) quando o arquivo ainda não existe -- a corrida de
    coleta processa as 27 UFs uma de cada vez, então "esta UF ainda não tem agregado" é esperado
    para a maioria das UFs na maior parte do tempo.

    O schema do arquivo persistido precisa casar exatamente com `Row._fields`, na mesma ordem --
    uma divergência é um achado real (contrato quebrado entre `collect.py` e este módulo), nunca
    coagida silenciosamente: levanta `ValueError` nomeando a diferença exata em vez de tentar
    adivinhar o mapeamento de coluna."""
    caminho = cache_path(f"agregados/{uf}.parquet")
    if not caminho.exists():
        return None

    tabela = pq.read_table(caminho)
    colunas_presentes = tuple(tabela.column_names)
    if colunas_presentes != _AGREGADOS_COLUMNS:
        raise ValueError(
            f"partitions: schema de cache_path('agregados/{uf}.parquet') diverge do esperado -- "
            f"esperado {_AGREGADOS_COLUMNS!r}, encontrado {colunas_presentes!r}. collect.py e "
            "partitions.py dessincronizaram; investigar antes de prosseguir (nunca coagir "
            "colunas por posição)."
        )

    colunas: dict[str, list[Any]] = {
        nome: tabela.column(nome).to_pylist() for nome in _AGREGADOS_COLUMNS
    }
    return [
        Row(**{nome: colunas[nome][i] for nome in _AGREGADOS_COLUMNS})
        for i in range(tabela.num_rows)
    ]


def _arquivos_brutos_da_uf(uf: str) -> list[Path]:
    """Lista as entradas `RD{uf}*.parquet` presentes em `cache_path("parquet")`, isoladas a esta
    UF -- mesmo princípio de `collect.py:_aggregate_uf` (nunca agregar a pasta inteira, que pode
    ter sobras de outras UFs ainda não recicladas). Reimplementado aqui via glob direto em vez de
    importar `collect.py` (módulo vivo, fora do escopo desta adaptação) -- lista vazia quando a
    UF não tem nenhum arquivo bruto em cache (coleta ainda não chegou nela, ou já foi
    reciclada)."""
    parquet_root = cache_path("parquet")
    if not parquet_root.exists():
        return []
    prefixo = f"RD{uf}"
    return sorted(p for p in parquet_root.iterdir() if p.name.startswith(prefixo))


def _linhas_do_parquet_bruto_isolado(uf: str, index: CidIndex) -> list[Row]:
    """Agrega só os arquivos brutos de `uf` (nunca `cache_path("parquet")` inteira) -- um
    diretório temporário de symlinks dá a `aggregate_years` uma visão restrita sem duplicar bytes
    e sem tocar em `collect.py`, mesmo padrão de isolamento que aquele módulo já usa. Lista vazia
    quando a UF não tem nenhum arquivo bruto em cache."""
    arquivos = _arquivos_brutos_da_uf(uf)
    if not arquivos:
        return []
    with tempfile.TemporaryDirectory(prefix=f"sih-partitions-{uf}-") as tmp:
        tmp_path = Path(tmp)
        for origem in arquivos:
            (tmp_path / origem.name).symlink_to(origem)
        return aggregate_years(tmp_path, index)


def linhas_da_uf(uf: str, index: CidIndex) -> tuple[list[Row], str]:
    """Linhas (todos os grãos) de `uf`, priorizando o agregado persistido e caindo para o
    parquet bruto -- sempre isolado a esta UF -- só quando o agregado ainda não existe.

    Devolve `(linhas, origem)` -- `origem` é só rótulo de log (`"agregado"`/`"bruto"`), nunca
    decide conteúdo: as duas fontes precisam produzir exatamente as mesmas `Row` para a mesma UF
    (provado por teste, ver `test_partitions.py`). Lista vazia (com `origem="bruto"`) quando nem
    o agregado nem o parquet bruto existem -- UF ainda não alcançada pela corrida de coleta,
    estado normal, nunca erro.

    Reaproveitada por `reconcile.py` (mesmo handoff, ver auditoria da adaptação 2026-08-11) --
    por isso exposta sem `_` inicial, ao contrário dos três helpers acima."""
    linhas_agregado = _linhas_do_agregado_persistido(uf)
    if linhas_agregado is not None:
        return linhas_agregado, "agregado"
    return _linhas_do_parquet_bruto_isolado(uf, index), "bruto"


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

    cid_map = apply_corrections(load_cid_map(), load_corrections())
    index = build_index(cid_map)

    alvo_ufs = list(UFS) if args.todas else [args.uf]
    for uf in alvo_ufs:
        linhas, origem = linhas_da_uf(uf, index)
        if not linhas:
            print(
                f"partitions: UF {uf} sem dado em cache (nem agregado persistido, nem parquet "
                "bruto) -- pulando (coleta ainda não chegou nesta UF)"
            )
            continue

        rows = _linhas_municipio_por_uf(linhas).get(uf, [])
        if not rows:
            print(f"partitions: UF {uf} sem linha de grão município (origem={origem}) -- pulando")
            continue

        payload = build_partition(uf, rows)
        destino = write_partition(uf, payload)
        print(f"partitions: {uf} -> {destino} ({len(rows)} linha(s), origem={origem})")
        if args.upload:
            upload_partition(destino, uf)
            print(f"partitions: {uf} enviado ao Storage ({BUCKET}/{_object_key(uf)})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
