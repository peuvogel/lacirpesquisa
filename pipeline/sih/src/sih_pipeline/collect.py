"""Laço incremental por UF — desbloqueia a Task 3 do 09-04 sem exigir ~10-13 GB de disco.

**Por que este módulo existe (2026-08-10).** A Task 3 do 09-04 foi escrita como uma corrida só,
baixando os 4.212 arquivos inteiros (~10-13 GB) e mantendo tudo em disco até o fim. O disco do
operador não aguenta isso: livre medido em 8,4 GB no dia em que este módulo nasceu, depois de já
ter liberado ~3,3 GB de cache regenerável. Mas o mensurado também mostra que **processar uma UF
de cada vez nunca precisa de mais que a maior UF sozinha**: SP, a maior UF do país (29,20× o AC
em contagem de linhas, medido do `sih_metric_muni` legado — ver
`pipeline/sih/reports/particoes-dimensionamento.md` §3.2), projeta ~1,9 GB de parquet bruto para
os 13 anos da janela D-11. 1,9 GB cabe com folga nos 8,4 GB livres; 10-13 GB não cabia.

**O que este módulo faz, por UF, na ordem de `UF_ORDER`:**
1. Baixa os arquivos da UF (todos os 156 = 12 meses × 13 anos) via `download.download_all`
   existente — reaproveitado, nunca reimplementado (isola falha por arquivo, PIPE-06, D-12).
2. Agrega via `aggregate.aggregate_years` existente — só os arquivos DESTA UF, nunca a pasta
   `cache_path("parquet")` inteira (que pode ter sobras de outras UFs — ver `_aggregate_uf`).
3. Persiste as linhas agregadas (pequenas: agregado nacional projetado ~13M linhas, partições
   D-21 medem ~139 MB no total) como parquet durável em `cache_path("agregados/{uf}.parquet")`
   — sobrevive à reciclagem do bruto, que só acontece depois desta escrita ter sucesso e sido
   conferida.
4. Recicla (apaga) o parquet bruto desta UF, usando o caminho exato gravado no `FileLedger`
   (nunca um glob por nome).
5. Passa para a próxima UF.

**O que este módulo NÃO faz:** não decide quais linhas persistem no Postgres nem quais viram
partição de Storage — isso continua sendo `partitions.py` (09-09) e um futuro `upload.py`
(09-10). O parquet AGREGADO durável que este módulo escreve em `cache_path("agregados/")` é o
novo insumo que esses dois consumidores vão precisar ler no lugar do parquet BRUTO (que este
módulo apaga) — ver `09-04-COLETA-INCREMENTAL-SUMMARY.md` §"Handoff" para o que falta adaptar
lá. Nenhum dos dois é tocado aqui (fora do escopo desta plan).

**Sobre `scripts/catalog/collection-order.json` (D-23) e por que ele NÃO ordena UFs.** Esse
arquivo ordena AGRAVOS por relevância cirúrgica — mas cada arquivo bruto `RD{UF}{AA}{MM}` já
contém as 331 doenças na mesma passada (D-01: "agregação é de graça", `aggregate.py`). Não existe
uma forma de "baixar só os agravos vasculares primeiro" no nível de arquivo do SIH-RD — a
primeira UF que este módulo terminar já entrega TODOS os 331 agravos completos para aquele
território. As duas ordens (D-23 por agravo, `UF_ORDER` por UF) são ortogonais: uma não
substitui nem enfraquece a outra.

**Por que `UF_ORDER` vai da menor para a maior UF (não o inverso).** Este laço é novo e nunca
rodou contra I/O real de dias — download real, conversão real, agregação real sobre 13 anos,
deleção real de dado grande. Processar as UFs pequenas primeiro (DF, RR, AP, SE, AC, ...) prova
o mecanismo inteiro (guarda de disco, transição de estado, reciclagem, retomada) em minutos e com
risco de disco desprezível, ANTES de comprometer horas e ~2 GB de disco em SP/MG. Quando a
corrida chegar às UFs grandes, o mecanismo já terá rodado de verdade em ~20 UFs reais e o
operador já terá medição real (não só projeção) para calibrar a guarda de disco das últimas —
ver `RAZAO_LINHAS_VS_AC`/`project_uf_bytes`.

**Sobre o estado do ledger e por que este módulo não corrompe o `baixado` do 09-04.** O
`FileLedger` (09-04) marca um arquivo como `baixado` e isso continua correto e necessário depois
da reciclagem: é o que impede `download_all` de rebaixar/re-baixar um arquivo cujo bruto já foi
apagado de propósito (o `pending()` do 09-04 continua funcionando sem mudança nenhuma). Mas
`baixado` sozinho não distingue "presente em disco, aguardando agregação" de "agregado,
persistido e reciclado" — as duas situações têm exatamente o mesmo status no `FileLedger`. Por
isso este módulo NUNCA edita `ledger.py`: introduz uma camada de estado nova e ortogonal,
`CollectLedger` (por UF, não por arquivo), que é quem sabe a diferença que falta.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import pyarrow as pa
import pyarrow.parquet as pq

from sih_pipeline import enumerate as enumerate_mod
from sih_pipeline.aggregate import Row, aggregate_years
from sih_pipeline.corrections import apply_corrections, load_corrections
from sih_pipeline.download import download_all
from sih_pipeline.ledger import STATUS_BAIXADO, FileLedger
from sih_pipeline.matcher import CidIndex, build_index, load_cid_map
from sih_pipeline.paths import cache_path, cache_root

# ---------------------------------------------------------------------------
# Ordem de coleta por UF — menor para maior (ver docstring do módulo).
# ---------------------------------------------------------------------------
UF_ORDER: tuple[str, ...] = (
    "DF", "RR", "AP", "SE", "AC", "AL", "TO", "RO", "RN", "PB", "PI", "AM",
    "ES", "MS", "MT", "PE", "RJ", "CE", "PA", "GO", "MA", "SC", "PR", "RS",
    "BA", "MG", "SP",
)

# Razão de linhas de cada UF contra o AC (base = 1,00), medida ao vivo do `sih_metric_muni`
# legado (produção, tabela que o D-20 já decidiu evacuar) — fonte:
# pipeline/sih/reports/particoes-dimensionamento.md §3.2 "Método B". Usada só para PROJETAR
# quanto disco a próxima UF vai precisar antes de baixar (guarda de disco) — nunca para decidir
# quais linhas entram na agregação, isso continua sendo `aggregate.py`, intocado.
RAZAO_LINHAS_VS_AC: dict[str, float] = {
    "SP": 29.20, "MG": 26.66, "BA": 17.15, "RS": 16.31, "PR": 13.38, "SC": 10.36,
    "MA": 9.41, "GO": 9.13, "PA": 8.61, "CE": 8.33, "RJ": 7.52, "PE": 6.14,
    "MT": 5.38, "MS": 4.42, "ES": 3.66, "AM": 3.46, "PI": 3.14, "PB": 2.91,
    "RN": 2.86, "RO": 2.77, "TO": 2.04, "AL": 1.78, "AC": 1.00, "SE": 0.98,
    "AP": 0.57, "RR": 0.46, "DF": 0.20,
}

# Semente CONSERVADORA de bytes por "unidade AC" (projeção completa dos 13 anos da janela
# D-11): SP/2019 (12 arquivos) mediu ~145 MB e a projeção completa de 13 anos para SP é ~1,9 GB
# (fatos medidos, registrados no brief operacional 2026-08-10). Dividido pela razão SP/AC
# (29,20×) dá ~66,6 MB/unidade — deliberadamente ACIMA da extrapolação direta do AC (14
# arquivos já em cache, ~40 MB/unidade projetada): esta constante alimenta uma GUARDA de disco,
# então superestimar é seguro e subestimar é o único resultado que não pode acontecer.
BYTES_PER_RATIO_UNIT_SEED: int = int(1.9 * 1024**3 / 29.20)

# Margem de segurança default da guarda de disco — nunca deixa o livre projetado rente ao
# necessário; ajustável via `--margem-mb` na CLI.
DISK_SAFETY_MARGIN_BYTES: int = 500 * 1024 * 1024

# ---------------------------------------------------------------------------
# Estado por UF (camada nova, ortogonal ao FileLedger — ver docstring do módulo).
# ---------------------------------------------------------------------------
ESTADO_NUNCA_INICIADO = "nunca_iniciado"
ESTADO_BAIXADO_PENDENTE_AGREGACAO = "baixado_pendente_agregacao"
ESTADO_AGREGADO_RECICLADO = "agregado_reciclado"
ESTADO_FALHOU = "falhou"

_COLLECT_STATE_RELATIVE_PATH = "agregados/collect_state.json"
_COLLECT_SCHEMA_VERSION = 1

_AGREGADOS_COLUMNS: tuple[str, ...] = (
    "disease_id", "grao", "local", "territorio_codigo", "ano",
    "internacoes", "obitos", "valor_total", "dias_permanencia", "taxa_mortalidade",
)


class DiscoInsuficienteError(RuntimeError):
    """O espaço livre projetado não cobre a próxima UF + margem de segurança.

    Levantado ANTES de qualquer download começar para a UF — o laço para limpo, nunca tenta e
    estoura o disco de boot do operador no meio do caminho (o único resultado que não pode
    acontecer, ver docstring do módulo)."""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class CollectLedger:
    """Estado por UF do laço incremental — mapa `uf -> entrada`, persistido em
    `cache_path("agregados/collect_state.json")` (escrita atômica `.tmp` + `os.replace`, mesmo
    padrão de `sih_pipeline.ledger.FileLedger`, reimplementado aqui em vez de importado porque
    esta é uma camada de estado NOVA e deliberadamente separada — ver docstring do módulo)."""

    def __init__(self, ufs: dict[str, dict[str, Any]] | None = None) -> None:
        self._ufs: dict[str, dict[str, Any]] = ufs if ufs is not None else {}

    @classmethod
    def load(cls) -> "CollectLedger":
        path = cache_path(_COLLECT_STATE_RELATIVE_PATH)
        if not path.exists():
            return cls()
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        return cls(ufs=data.get("ufs", {}))

    def save(self) -> None:
        path = cache_path(_COLLECT_STATE_RELATIVE_PATH)
        payload = {"schema_version": _COLLECT_SCHEMA_VERSION, "ufs": self._ufs}
        tmp_path = path.with_suffix(path.suffix + ".tmp")
        with tmp_path.open("w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2, sort_keys=True)
        os.replace(tmp_path, path)

    def status(self, uf: str) -> str:
        return self._ufs.get(uf, {}).get("status", ESTADO_NUNCA_INICIADO)

    def entry(self, uf: str) -> dict[str, Any]:
        return dict(self._ufs.get(uf, {}))

    def mark_baixado_pendente_agregacao(self, uf: str, *, arquivos: int) -> None:
        self._ufs[uf] = {
            "status": ESTADO_BAIXADO_PENDENTE_AGREGACAO,
            "arquivos": arquivos,
            "updated_at": _now_iso(),
        }

    def mark_agregado_reciclado(
        self, uf: str, *, linhas: int, bytes_persistidos: int, bytes_reciclados: int
    ) -> None:
        entry = self._ufs.setdefault(uf, {})
        entry.update(
            {
                "status": ESTADO_AGREGADO_RECICLADO,
                "linhas": linhas,
                "bytes_persistidos": bytes_persistidos,
                "bytes_reciclados": bytes_reciclados,
                "updated_at": _now_iso(),
            }
        )

    def mark_falhou(self, uf: str, *, reason: str) -> None:
        """Marca `uf` como `falhou`, com o motivo. Não regride uma UF já `agregado_reciclado`
        (mesma disciplina de não-rebaixamento do PIPE-03 do `FileLedger`, aplicada a esta
        camada de estado por UF) — se a UF já terminou, um erro espúrio numa reexecução não
        pode desfazer isso."""
        if self._ufs.get(uf, {}).get("status") == ESTADO_AGREGADO_RECICLADO:
            return
        entry = self._ufs.setdefault(uf, {})
        entry.update({"status": ESTADO_FALHOU, "reason": reason, "updated_at": _now_iso()})

    def summary(self) -> dict[str, Any]:
        contagens: dict[str, int] = {
            ESTADO_BAIXADO_PENDENTE_AGREGACAO: 0,
            ESTADO_AGREGADO_RECICLADO: 0,
            ESTADO_FALHOU: 0,
        }
        linhas_total = 0
        bytes_persistidos_total = 0
        bytes_reciclados_total = 0
        for entry in self._ufs.values():
            status = entry.get("status", ESTADO_NUNCA_INICIADO)
            contagens[status] = contagens.get(status, 0) + 1
            if status == ESTADO_AGREGADO_RECICLADO:
                linhas_total += entry.get("linhas", 0)
                bytes_persistidos_total += entry.get("bytes_persistidos", 0)
                bytes_reciclados_total += entry.get("bytes_reciclados", 0)
        return {
            **contagens,
            "linhas_total": linhas_total,
            "bytes_persistidos_total": bytes_persistidos_total,
            "bytes_reciclados_total": bytes_reciclados_total,
        }


# ---------------------------------------------------------------------------
# Guarda de disco
# ---------------------------------------------------------------------------


def project_uf_bytes(uf: str, *, medicoes: dict[str, int] | None = None) -> int:
    """Projeta bytes de parquet BRUTO que `uf` vai ocupar para a janela D-11 completa (13
    anos).

    Usa o MAIOR entre a semente conservadora (`BYTES_PER_RATIO_UNIT_SEED`) e qualquer
    bytes-por-unidade já observado de verdade em `medicoes` (uf -> bytes reciclados, de UFs já
    processadas nesta corrida) — a projeção fica mais precisa conforme a corrida avança, sempre
    por cima, nunca por baixo (uma guarda de disco não pode subestimar)."""
    razao = RAZAO_LINHAS_VS_AC[uf]
    bytes_por_unidade = float(BYTES_PER_RATIO_UNIT_SEED)
    if medicoes:
        for uf_medida, bytes_medidos in medicoes.items():
            razao_medida = RAZAO_LINHAS_VS_AC.get(uf_medida)
            if razao_medida:
                bytes_por_unidade = max(bytes_por_unidade, bytes_medidos / razao_medida)
    return int(razao * bytes_por_unidade)


def garantir_espaco_suficiente(
    uf: str, *, medicoes: dict[str, int] | None = None, margem: int = DISK_SAFETY_MARGIN_BYTES
) -> None:
    """Recusa iniciar `uf` se o espaço livre não cobrir a projeção de download bruto + margem de
    segurança. Levanta `DiscoInsuficienteError` com números legíveis — nunca deixa o laço tentar
    baixar e arriscar o disco de boot do operador no meio do caminho."""
    livre = shutil.disk_usage(cache_root()).free
    necessario = project_uf_bytes(uf, medicoes=medicoes) + margem
    if livre < necessario:
        raise DiscoInsuficienteError(
            f"collect: espaço livre insuficiente para iniciar {uf} -- "
            f"livre={livre / 1024**2:.0f} MB, necessário≈{necessario / 1024**2:.0f} MB "
            f"(projeção + margem de segurança de {margem / 1024**2:.0f} MB). "
            "Parando a corrida limpo -- libere espaço e rode de novo; a retomada é por UF."
        )


# ---------------------------------------------------------------------------
# Laço por UF
# ---------------------------------------------------------------------------


def _expected_uf_files(uf: str) -> frozenset[str]:
    prefixo = f"RD{uf}"
    return frozenset(nome for nome in enumerate_mod.expected_file_names() if nome.startswith(prefixo))


def _cobertura_uf(uf_files: frozenset[str], file_ledger: FileLedger) -> tuple[set[str], set[str]]:
    baixados = {nome for nome in uf_files if file_ledger.status(nome) == STATUS_BAIXADO}
    faltantes = set(uf_files) - baixados
    return baixados, faltantes


def _aggregate_uf(uf: str, uf_files: frozenset[str], file_ledger: FileLedger, index: CidIndex) -> list[Row]:
    """Agrega só os arquivos de `uf` — NUNCA `cache_path("parquet")` inteira, que pode conter
    sobras de outras UFs (ex.: AC/2019 e SP/2019 já estavam em cache antes deste módulo existir
    e não podem ser tratadas como lixo nem apagadas por engano). Um diretório temporário de
    symlinks, montado só com o caminho exato gravado em `parquet_dir` de cada arquivo desta UF
    no `FileLedger`, dá a `aggregate_years` uma visão isolada sem duplicar bytes e sem tocar em
    nada fora do escopo desta UF."""
    with tempfile.TemporaryDirectory(prefix=f"sih-collect-{uf}-") as tmp:
        tmp_path = Path(tmp)
        for nome in sorted(uf_files):
            entry = file_ledger.entry(nome)
            origem = Path(entry["parquet_dir"])
            if not origem.is_absolute():
                origem = cache_path(str(origem))
            if not origem.exists():
                raise RuntimeError(
                    f"collect: {uf} tem {nome!r} marcado 'baixado' no ledger, mas {origem} "
                    "não existe em disco -- ledger e disco divergem, não é seguro agregar."
                )
            (tmp_path / origem.name).symlink_to(origem)

        return aggregate_years(tmp_path, index)


def _persist_rows(uf: str, linhas: list[Row]) -> Path:
    """Grava `linhas` (a saída já agregada, pequena) como parquet durável em
    `cache_path("agregados/{uf}.parquet")` — sobrevive à reciclagem do parquet BRUTO (centenas
    de vezes maior), que só acontece DEPOIS desta escrita ter sucesso e sido conferida."""
    if not linhas:
        raise ValueError(f"collect: {uf} agregou zero linhas -- nunca persiste vazio silenciosamente")

    colunas: dict[str, list[Any]] = {nome: [] for nome in _AGREGADOS_COLUMNS}
    for linha in linhas:
        for nome in _AGREGADOS_COLUMNS:
            colunas[nome].append(getattr(linha, nome))

    tabela = pa.table(colunas)
    destino = cache_path(f"agregados/{uf}.parquet")
    pq.write_table(tabela, destino)

    conferido = pq.read_table(destino)
    if conferido.num_rows != len(linhas):
        raise RuntimeError(
            f"collect: persistência de {uf} não confere -- gravou {conferido.num_rows} "
            f"linha(s), esperado {len(linhas)} -- reciclagem do bruto NÃO vai rodar."
        )

    return destino


def _reclaim_raw_parquet(uf: str, uf_files: frozenset[str], file_ledger: FileLedger) -> int:
    """Apaga o parquet BRUTO de cada arquivo de `uf` já `baixado`, usando o caminho exato
    gravado em `parquet_dir` (nunca um glob por nome — o ledger é a fonte da verdade de onde o
    arquivo está). Só é chamada DEPOIS que `_persist_rows` teve sucesso e foi conferida: a pior
    interrupção possível deixa o bruto ainda em disco (reagregável), nunca perde o bruto sem o
    agregado ter sido persistido."""
    total_bytes = 0
    for nome in sorted(uf_files):
        entry = file_ledger.entry(nome)
        caminho = Path(entry["parquet_dir"])
        if not caminho.is_absolute():
            caminho = cache_path(str(caminho))
        if caminho.is_dir():
            total_bytes += sum(f.stat().st_size for f in caminho.rglob("*") if f.is_file())
            shutil.rmtree(caminho)
        elif caminho.exists():
            total_bytes += caminho.stat().st_size
            caminho.unlink()
    return total_bytes


def collect_uf(
    uf: str,
    *,
    collect_ledger: CollectLedger,
    index: CidIndex,
    download_fn: Callable[..., FileLedger] = download_all,
) -> None:
    """Processa uma UF inteira: baixa o que falta -> agrega -> persiste -> recicla o bruto.

    Idempotente por construção: se todos os arquivos da UF já estão `baixado` no `FileLedger`
    (retomada depois de uma interrupção pós-download), `download_fn` nunca é chamada -- só quem
    tem arquivo faltante paga o custo de rede."""
    uf_files = _expected_uf_files(uf)
    file_ledger = FileLedger.load()
    _, faltantes = _cobertura_uf(uf_files, file_ledger)

    if faltantes:
        download_fn(only=sorted(uf_files))
        file_ledger = FileLedger.load()
        _, faltantes = _cobertura_uf(uf_files, file_ledger)
        if faltantes:
            raise RuntimeError(
                f"collect: {uf} ainda tem {len(faltantes)} arquivo(s) pendente(s) após "
                f"download_all -- ex.: {sorted(faltantes)[:5]} (PIPE-06 isolou a falha por "
                "arquivo; esta UF fica 'falhou' e será retomada na próxima corrida)."
            )

    collect_ledger.mark_baixado_pendente_agregacao(uf, arquivos=len(uf_files))
    collect_ledger.save()

    linhas = _aggregate_uf(uf, uf_files, file_ledger, index)
    destino = _persist_rows(uf, linhas)
    bytes_persistidos = destino.stat().st_size

    bytes_reciclados = _reclaim_raw_parquet(uf, uf_files, file_ledger)

    collect_ledger.mark_agregado_reciclado(
        uf,
        linhas=len(linhas),
        bytes_persistidos=bytes_persistidos,
        bytes_reciclados=bytes_reciclados,
    )
    collect_ledger.save()


def collect_all(
    *,
    order: tuple[str, ...] = UF_ORDER,
    disk_safety_margin_bytes: int = DISK_SAFETY_MARGIN_BYTES,
    download_fn: Callable[..., FileLedger] = download_all,
    index: CidIndex | None = None,
) -> CollectLedger:
    """Percorre `order`, pulando UFs já `agregado_reciclado` (retomada), recusando iniciar uma
    UF que não caiba no disco livre (guarda), e isolando a falha de uma UF para que ela nunca
    derrube as demais (mesma disciplina PIPE-06 do 09-04, nesta granularidade)."""
    if index is None:
        cid_map = apply_corrections(load_cid_map(), load_corrections())
        index = build_index(cid_map)

    collect_ledger = CollectLedger.load()
    medicoes_bytes: dict[str, int] = {
        uf: collect_ledger.entry(uf)["bytes_reciclados"]
        for uf in order
        if collect_ledger.status(uf) == ESTADO_AGREGADO_RECICLADO
    }

    for uf in order:
        if collect_ledger.status(uf) == ESTADO_AGREGADO_RECICLADO:
            print(f"collect: {uf} já agregado e reciclado -- pulando (retomada)")
            continue

        try:
            garantir_espaco_suficiente(uf, medicoes=medicoes_bytes, margem=disk_safety_margin_bytes)
        except DiscoInsuficienteError as exc:
            print(str(exc), file=sys.stderr)
            break

        print(f"collect: iniciando {uf}")
        try:
            collect_uf(uf, collect_ledger=collect_ledger, index=index, download_fn=download_fn)
        except Exception as exc:  # isola falha por UF -- uma UF ruim não derruba as demais
            collect_ledger.mark_falhou(uf, reason=str(exc))
            collect_ledger.save()
            print(f"collect: {uf} falhou ({exc}) -- ledger registrado, seguindo para a próxima UF", file=sys.stderr)
            continue

        medicoes_bytes[uf] = collect_ledger.entry(uf)["bytes_reciclados"]
        print(f"collect: {uf} concluída -- {collect_ledger.entry(uf)}")

    return collect_ledger


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="sih_pipeline.collect")
    parser.add_argument(
        "--uf", nargs="+", default=None, help="processa só as UFs informadas, nesta ordem (default: UF_ORDER inteira)"
    )
    parser.add_argument("--status", action="store_true", help="só imprime o resumo do collect ledger, sem processar nada")
    parser.add_argument("--margem-mb", type=int, default=None, help="margem de segurança de disco em MB (default 500)")
    args = parser.parse_args(argv)

    if args.status:
        print(CollectLedger.load().summary())
        return 0

    order = tuple(args.uf) if args.uf else UF_ORDER
    margem = args.margem_mb * 1024 * 1024 if args.margem_mb is not None else DISK_SAFETY_MARGIN_BYTES

    collect_ledger = collect_all(order=order, disk_safety_margin_bytes=margem)
    print(collect_ledger.summary())
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
