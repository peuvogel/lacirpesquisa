"""Comparador agregado x oráculo TabNet — o gate de verdade do SC-7 (D-02/D-06/D-10).

Disciplina copiada de `scripts/catalog/validate.mjs::foldInvariant`: acumular TODOS os pares
antes de decidir, nunca retornar no primeiro achado, e devolver `ok=False` com a lista completa
de problemas — nunca abortar cedo escondendo o resto.

D-02 é absoluto: não existe banda de aceitação percentual neste módulo. Cada par ou bate exato
(`delta == 0`), ou tem uma entrada em `divergencias` (`scripts/catalog/cid-divergencias.json`,
D-08) com razão escrita para aquele `diseaseId` — caso contrário é `inexplicado` e
`ReconciliationResult.ok` fica `False`. Um delta pequeno e um delta grande recebem exatamente o
mesmo tratamento; o tamanho do delta nunca decide a classificação.

D-10: só o lado ocorrência é reconciliado — residência não tem oráculo externo comparável no
`nibr.def` (o TabNet só publica por local de internação). `main()` filtra `grao == uf` e
`local == ocorrencia` antes de comparar; comparar residência contra um oráculo de ocorrência
produziria divergência espúria que consumiria a depuração inteira sem sinalizar nada real.

**Adaptação 2026-08-11 (09-09-ADAPTACAO-AGREGADOS):** o gate permanente (`test_reconcile_gate.py`)
agrega a fixture congelada (`tests/fixtures/rdac_2019.parquet`) direto via `aggregate_parquet_dir`
— nunca passa por `main()` nem por `cache_path("parquet")` — então continua intocado por esta
adaptação (verificado, não assumido: `npm run pipeline:reconcile-gate` permanece
`exato=34, explicado=61, inexplicado=3`). Mas `main()` (o subcomando `pipeline:reconcile`, usado
para checagens ad-hoc contra o cache real — ex.: a confirmação de SP/2019 do 09-11) lia
`cache_path("parquet")` direto, o mesmo defeito que `partitions.py` tinha: uma UF cujo bruto
`collect.py` já reciclou aparentaria "nada a reconciliar". `main()` agora usa
`sih_pipeline.partitions.linhas_da_uf` (mesma priorização agregado-persistido > bruto-isolado)
por UF, restrita ao conjunto de UFs que o oráculo filtrado (`--uf`, se dado) realmente precisa —
uma UF sem dado nenhum vira aviso em stderr e é pulada, nunca crash nem comparação silenciosamente
incompleta sem aviso.

**Correção 2026-08-11 (09-09-FIX-RESIDENCIA):** `linhas_da_uf`/`construir_indice_territorial`
(`partitions.py`) passaram a selecionar linhas por TERRITÓRIO, não por arquivo de origem (ver a
docstring de `partitions.py`, seção "Correção 2026-08-11", para o defeito completo). Efeito
colateral que `main()` precisou absorver: uma UF cuja ÚNICA contribuição em cache é uma linha de
`local=residencia` de OUTRA UF já coletada (ex.: um paciente de RO tratado no AC, capturado no
agregado do AC, agora corretamente atribuído a RO) passou a ter `linhas_da_uf(uf)` não-vazio, mas
essa UF continua SEM nenhum dado `grao=uf`/`local=ocorrencia` — a única coisa que esta
reconciliação compara (D-10). Tratar "tem QUALQUER linha" como "tem dado reconciliável" faria essa
UF aparentar "inexplicado" (comparação que nunca teve como ser feita) em vez do diagnóstico
correto "coleta ainda não chegou nesta UF". `main()` agora checa especificamente
`grao=uf`/`local=ocorrencia` antes de decidir se uma UF entra na comparação -- nunca "tem
qualquer linha".
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from sih_pipeline.aggregate import GRAO_UF, LOCAL_OCORRENCIA, Row
from sih_pipeline.codigos import UF_POR_CODIGO
from sih_pipeline.corrections import apply_corrections, load_corrections
from sih_pipeline.matcher import build_index, load_cid_map
from sih_pipeline.partitions import construir_indice_territorial
from sih_pipeline.paths import repo_root

_PIPELINE_SIH_ROOT = Path(__file__).resolve().parents[2]
ORACLE_PATH = _PIPELINE_SIH_ROOT / "tests" / "fixtures" / "oracle_tabnet.json"
DIVERGENCIAS_PATH = repo_root() / "scripts" / "catalog" / "cid-divergencias.json"

# Limiar arbitrário mas explícito (D-08/T-09-32): força quem escreve uma divergência a
# produzir uma frase que nomeia o mecanismo, não uma etiqueta genérica de duas palavras.
_RAZAO_MIN_LEN = 30

_MEDIDAS = ("internacoes", "obitos", "valor_total", "dias_permanencia")

ChaveAgregado = tuple[str, str, int, str]


@dataclass(frozen=True)
class Pair:
    """Um par (diseaseId, uf, ano, medida) comparado entre o agregado e o oráculo TabNet."""

    disease_id: str
    uf: str
    ano: int
    medida: str
    valor_agregado: float | None
    valor_tabnet: float
    delta: float | None
    delta_pct: float | None
    status: str  # "exato" | "explicado" | "inexplicado"
    razao: str | None = None
    tabnet_code: str | None = None


@dataclass
class ReconciliationResult:
    exato: list[Pair] = field(default_factory=list)
    explicado: list[Pair] = field(default_factory=list)
    inexplicado: list[Pair] = field(default_factory=list)
    extras: list[ChaveAgregado] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        """`True` somente com zero `inexplicado` — nunca há banda de aceitação percentual
        (D-02); as duas únicas saídas aceitáveis são exato e explicado."""
        return len(self.inexplicado) == 0

    def render_markdown(self) -> str:
        """Tabela usada pelo relatório de depuração (Task 2) e pelo checkpoint em lote do
        `09-11` (D-07): código, faixa antiga, faixa nova, delta antes, delta depois, razão.

        `faixa antiga`/`faixa nova` só existem quando o par carrega uma correção de faixa CID
        associada (preenchidas pelo chamador via `Pair` — este módulo não conhece
        `cid-corrections.json`); ficam em travessão quando ausentes, nunca em branco silencioso.
        """
        linhas = [
            "| código | faixa antiga | faixa nova | delta antes | delta depois | razão |",
            "| --- | --- | --- | --- | --- | --- |",
        ]
        for par in (*self.exato, *self.explicado, *self.inexplicado):
            faixa_antiga = "—"
            faixa_nova = "—"
            delta_fmt = f"{par.delta_pct:+.2%}" if par.delta_pct is not None else "—"
            delta_antes = delta_fmt
            delta_depois = delta_fmt if par.status == "explicado" else "—"
            if par.razao is not None:
                razao = par.razao
            elif par.valor_agregado is None:
                razao = "ausente no agregado"
            else:
                razao = "—"
            linhas.append(
                f"| {par.disease_id} | {faixa_antiga} | {faixa_nova} | {delta_antes} | "
                f"{delta_depois} | {razao} |"
            )
        return "\n".join(linhas)


def load_oracle(path: str | Path = ORACLE_PATH) -> list[dict[str, Any]]:
    """Lê o oráculo re-raspado do 09-05 (`oracle_tabnet.json`) com `json.load` direto, sem
    transformação de schema — a mesma disciplina de `load_cid_map`/`load_corrections`."""
    with Path(path).open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _validar_razao(entry: dict[str, Any]) -> str:
    razao = entry.get("razao")
    if not isinstance(razao, str) or len(razao) < _RAZAO_MIN_LEN:
        raise ValueError(
            f"reconcile: divergência sem 'razao' válida (>= {_RAZAO_MIN_LEN} caracteres, "
            f"D-08/T-09-32 — frase escrita, nunca etiqueta genérica): {entry!r}"
        )
    return razao


def load_divergencias(path: str | Path = DIVERGENCIAS_PATH) -> list[dict[str, Any]]:
    """Lê `cid-divergencias.json`. Rejeita (`ValueError`) qualquer entrada cuja `razao` esteja
    ausente ou mais curta que `_RAZAO_MIN_LEN` — a mesma disciplina de `corrections.load_corrections`.
    Arquivo ausente devolve lista vazia (nenhuma divergência registrada ainda)."""
    p = Path(path)
    if not p.exists():
        return []
    with p.open("r", encoding="utf-8") as fh:
        entries = json.load(fh)
    for entry in entries:
        _validar_razao(entry)
    return entries


def compare(
    agregado: dict[ChaveAgregado, float],
    oraculo: list[dict[str, Any]],
    divergencias: list[dict[str, Any]],
) -> ReconciliationResult:
    """Junta `oraculo` (chave `diseaseId`/`uf`/`ano`/`medida`) contra `agregado` (dict chaveado
    pela mesma tupla) e classifica cada par em `exato`, `explicado` ou `inexplicado`.

    Acumula TODOS os pares antes de decidir (disciplina `foldInvariant` de `validate.mjs`) —
    nunca retorna no primeiro `inexplicado`. Um par do oráculo sem correspondente no agregado
    conta como `inexplicado` (nunca é silenciosamente ignorado); um par do agregado sem
    correspondente no oráculo vai para `result.extras` (o oráculo cobre só um subconjunto dos
    territórios/medidas agregados) e nunca afeta `result.ok`.

    `divergencias` é validado aqui mesmo antes de qualquer par ser classificado (fail-closed:
    uma `razao` curta derruba a chamada inteira, não silenciosamente uma entrada).
    """
    razao_por_disease: dict[str, str] = {}
    for entry in divergencias:
        razao_por_disease[entry["diseaseId"]] = _validar_razao(entry)

    exato: list[Pair] = []
    explicado: list[Pair] = []
    inexplicado: list[Pair] = []
    usados: set[ChaveAgregado] = set()

    for entry in oraculo:
        chave: ChaveAgregado = (entry["diseaseId"], entry["uf"], entry["ano"], entry["medida"])
        valor_tabnet = entry["valorTabnet"]
        valor_agregado = agregado.get(chave)
        tabnet_code = entry.get("tabnetCode")

        if valor_agregado is None:
            inexplicado.append(
                Pair(
                    disease_id=entry["diseaseId"],
                    uf=entry["uf"],
                    ano=entry["ano"],
                    medida=entry["medida"],
                    valor_agregado=None,
                    valor_tabnet=valor_tabnet,
                    delta=None,
                    delta_pct=None,
                    status="inexplicado",
                    tabnet_code=tabnet_code,
                )
            )
            continue

        usados.add(chave)
        delta = valor_agregado - valor_tabnet
        delta_pct = (delta / valor_tabnet) if valor_tabnet else None

        razao = razao_por_disease.get(entry["diseaseId"])
        if delta == 0:
            status = "exato"
        elif razao is not None:
            status = "explicado"
        else:
            status = "inexplicado"

        par = Pair(
            disease_id=entry["diseaseId"],
            uf=entry["uf"],
            ano=entry["ano"],
            medida=entry["medida"],
            valor_agregado=valor_agregado,
            valor_tabnet=valor_tabnet,
            delta=delta,
            delta_pct=delta_pct,
            status=status,
            razao=razao if status == "explicado" else None,
            tabnet_code=tabnet_code,
        )
        (exato if status == "exato" else explicado if status == "explicado" else inexplicado).append(par)

    extras = [chave for chave in agregado if chave not in usados]

    return ReconciliationResult(exato=exato, explicado=explicado, inexplicado=inexplicado, extras=extras)


def main(argv: list[str]) -> int:
    """CLI do subcomando `reconcile` (registrado em `cli.py` desde a Onda 1). Para o conjunto de
    UFs que o oráculo (filtrado por `--uf`, se dado) realmente precisa, lê o índice territorial
    completo via `partitions.construir_indice_territorial` -- UMA VEZ por execução, nunca uma vez
    por UF (custo O(27), não O(27²); correção 2026-08-11, ver docstring do módulo e de
    `partitions.py`) -- aplica a camada de correção (D-05), filtra `grao=uf` e `local=ocorrencia`
    (D-10 — só ocorrência é reconciliada, residência não tem oráculo externo comparável no
    `nibr.def`), compara e imprime `render_markdown()`. Sai não-zero quando há `inexplicado` —
    nunca finge sucesso com divergência sem razão.

    Uma UF sem nenhuma linha `grao=uf`/`local=ocorrencia` -- a única coisa que esta reconciliação
    compara -- vira aviso em stderr e é pulada -- estado normal (a corrida de coleta processa 27
    UFs uma de cada vez), nunca crash. Checagem restrita a ocorrência (não "tem qualquer linha")
    desde a correção 2026-08-11: uma UF pode ter linhas de RESIDÊNCIA contribuídas por outra UF já
    coletada sem ter, ela mesma, nenhuma ocorrência coletada ainda -- ver "Correção 2026-08-11" na
    docstring do módulo. Se NENHUMA UF necessária tiver dado reconciliável, a comparação não roda
    e a função devolve 0 com aviso -- nunca finge ter comparado algo que não comparou."""
    parser = argparse.ArgumentParser(prog="sih_pipeline.reconcile")
    parser.add_argument("--uf", type=str, default=None, help="filtra o oráculo por sigla de UF")
    parser.add_argument("--ano", type=int, default=None, help="filtra a agregação por um único ano")
    parser.add_argument(
        "--relatorio", type=str, default=None, help="caminho onde salvar a tabela markdown"
    )
    args = parser.parse_args(argv)

    cid_map = apply_corrections(load_cid_map(), load_corrections())
    index = build_index(cid_map)

    oraculo = load_oracle(ORACLE_PATH)
    if args.uf:
        oraculo = [entry for entry in oraculo if entry["uf"] == args.uf]

    if not oraculo:
        print("reconcile: oráculo vazio após filtro --uf -- nada a comparar")
        return 0

    ufs_necessarias = sorted({entry["uf"] for entry in oraculo})
    indice = construir_indice_territorial(index)
    linhas: list[Row] = []
    ufs_sem_dado: list[str] = []
    for uf in ufs_necessarias:
        linhas_uf, _origem = indice.get(uf, ([], "bruto"))
        # só grao=uf/local=ocorrencia entra nesta reconciliação (D-10) -- "tem qualquer linha"
        # não é mais o mesmo que "tem dado reconciliável" depois da correção 2026-08-11 (uma UF
        # pode ter só residência contribuída por outra UF já coletada).
        tem_dado_reconciliavel = any(
            linha.grao == GRAO_UF and linha.local == LOCAL_OCORRENCIA for linha in linhas_uf
        )
        if not tem_dado_reconciliavel:
            ufs_sem_dado.append(uf)
            continue
        linhas.extend(linhas_uf)

    if ufs_sem_dado:
        print(
            f"reconcile: sem dado em cache (nem agregado persistido, nem parquet bruto) para "
            f"{ufs_sem_dado} -- essas UFs ficam fora desta comparação (coleta ainda não chegou "
            "nelas)",
            file=sys.stderr,
        )

    if not linhas:
        print("reconcile: nenhuma UF necessária tem dado em cache -- nada a reconciliar")
        return 0

    if args.ano is not None:
        linhas = [linha for linha in linhas if linha.ano == args.ano]

    # D-10: só ocorrência é reconciliada -- residência não tem oráculo externo comparável no
    # nibr.def (o TabNet só publica a Lista Morb por município/UF de internação, MUNIC_MOV).
    agregado: dict[ChaveAgregado, float] = {}
    for linha in linhas:
        if linha.grao != GRAO_UF or linha.local != LOCAL_OCORRENCIA:
            continue
        # O oráculo (oracle_scrape.py, 09-05) chaveia por sigla de UF ("AC"), exatamente como o
        # TabNet devolve; Row.territorio_codigo no grão UF é o código IBGE numérico de 2 dígitos
        # ("12") -- sem esta tradução, NENHUM par junta e a reconciliação inteira aparenta zero
        # agregado por engano de chave, não por divergência real de dado.
        uf_sigla = UF_POR_CODIGO.get(linha.territorio_codigo)
        if uf_sigla is None:
            raise KeyError(
                f"reconcile: código de UF {linha.territorio_codigo!r} sem sigla em "
                "codigos.UF_POR_CODIGO — mapa desatualizado."
            )
        for medida in _MEDIDAS:
            valor = getattr(linha, medida)
            if valor is None:
                continue
            agregado[(linha.disease_id, uf_sigla, linha.ano, medida)] = valor

    divergencias = load_divergencias(DIVERGENCIAS_PATH)

    resultado = compare(agregado, oraculo, divergencias)
    md = resultado.render_markdown()
    print(md)
    print(
        f"reconcile: {len(resultado.exato)} exato(s), {len(resultado.explicado)} explicado(s), "
        f"{len(resultado.inexplicado)} inexplicado(s), {len(resultado.extras)} extra(s)"
    )

    if args.relatorio:
        Path(args.relatorio).write_text(md, encoding="utf-8")

    return 0 if resultado.ok else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
